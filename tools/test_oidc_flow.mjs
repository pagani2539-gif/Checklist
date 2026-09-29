import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const connectionString = process.env.CHECKLIST_POSTGRES_TEST_DATABASE_URL || process.env.CHECKLIST_DATABASE_URL;
if (!connectionString) {
  console.log("OIDC flow smoke skipped (set CHECKLIST_POSTGRES_TEST_DATABASE_URL or CHECKLIST_DATABASE_URL for PostgreSQL integration coverage)");
  process.exit(0);
}
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "checklist-oidc-test-"));
const oidcPort = 4700 + Math.floor(Math.random() * 100);
const appPort = 4600 + Math.floor(Math.random() * 100);
const issuer = `http://127.0.0.1:${oidcPort}`;
const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicJwk = { ...publicKey.export({ format: "jwk" }), kid: "test-key", use: "sig", alg: "RS256" };
let tokenRole = "inspector";
let tokenStationIds = ["station-sc"];

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signJwt(claims) {
  const header = encode({ alg: "RS256", typ: "JWT", kid: "test-key" });
  const payload = encode(claims);
  const input = `${header}.${payload}`;
  const signature = crypto.createSign("RSA-SHA256").update(input).end().sign(privateKey).toString("base64url");
  return `${input}.${signature}`;
}

function readBody(request) {
  return new Promise((resolve) => {
    let body = "";
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => resolve(body));
  });
}

const oidcServer = http.createServer(async (request, response) => {
  const url = new URL(request.url || "/", issuer);
  if (url.pathname === "/jwks") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ keys: [publicJwk] }));
    return;
  }
  if (url.pathname === "/authorize") {
    const redirectUri = url.searchParams.get("redirect_uri");
    const state = url.searchParams.get("state");
    response.writeHead(302, { Location: `${redirectUri}?code=${encodeURIComponent(tokenRole)}&state=${encodeURIComponent(state)}` });
    response.end();
    return;
  }
  if (url.pathname === "/token" && request.method === "POST") {
    await readBody(request);
    const now = Math.floor(Date.now() / 1000);
    const idToken = signJwt({
      iss: issuer,
      aud: "checklist-web",
      sub: `${tokenRole}-user`,
      preferred_username: `${tokenRole}.user`,
      name: `${tokenRole} user`,
      roles: [tokenRole],
      station_ids: tokenStationIds,
      nonce: currentNonce,
      iat: now,
      exp: now + 300,
    });
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ id_token: idToken }));
    return;
  }
  response.writeHead(404);
  response.end();
});

let currentNonce = "";
const app = spawn(process.execPath, ["server.mjs"], {
  cwd: root,
  env: {
    ...process.env,
    PORT: String(appPort),
    HOST: "127.0.0.1",
    CHECKLIST_STORAGE_BACKEND: "postgres",
    CHECKLIST_DATABASE_URL: connectionString,
    CHECKLIST_ATTACHMENT_BACKEND: "filesystem",
    CHECKLIST_ATTACHMENTS_DIR: path.join(tempRoot, "attachments"),
    CHECKLIST_AUTH_MODE: "oidc",
    CHECKLIST_COOKIE_SECURE: "true",
    CHECKLIST_ENFORCE_STATION_SCOPE: "true",
    REQUIRE_VEHICLE_API_READY: "false",
    OIDC_ISSUER: issuer,
    OIDC_JWKS_URL: `${issuer}/jwks`,
    OIDC_AUDIENCE: "checklist-api",
    OIDC_CLIENT_ID: "checklist-web",
    OIDC_AUTHORIZATION_ENDPOINT: `${issuer}/authorize`,
    OIDC_TOKEN_ENDPOINT: `${issuer}/token`,
    OIDC_REDIRECT_URI: `http://127.0.0.1:${appPort}/api/v1/auth/callback`,
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let stderr = "";
app.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

async function waitFor(url, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`server did not start: ${stderr}`);
}

async function login(role, stationIds) {
  tokenRole = role;
  tokenStationIds = stationIds;
  const loginResponse = await fetch(`http://127.0.0.1:${appPort}/api/v1/auth/login`, { redirect: "manual" });
  assert.equal(loginResponse.status, 302);
  const authorizationUrl = new URL(loginResponse.headers.get("location"));
  currentNonce = authorizationUrl.searchParams.get("nonce");
  assert.ok(authorizationUrl.searchParams.get("code_challenge"));
  const callback = await fetch(`http://127.0.0.1:${appPort}/api/v1/auth/callback?code=${encodeURIComponent(role)}&state=${encodeURIComponent(authorizationUrl.searchParams.get("state"))}`, { redirect: "manual" });
  assert.equal(callback.status, 302);
  const cookie = callback.headers.get("set-cookie");
  assert.match(cookie || "", /checklist_session=/);
  assert.match(cookie || "", /;\s*HttpOnly/i);
  assert.match(cookie || "", /;\s*Secure/i);
  return cookie.split(";", 1)[0];
}

async function json(pathname, options = {}) {
  const response = await fetch(`http://127.0.0.1:${appPort}${pathname}`, options);
  return { response, body: await response.json().catch(() => null) };
}

try {
  await new Promise((resolve, reject) => oidcServer.listen(oidcPort, "127.0.0.1", (error) => error ? reject(error) : resolve()));
  await waitFor(`http://127.0.0.1:${appPort}/health`);
  assert.equal((await json("/api/v1/state")).response.status, 401);

  const adminCookie = await login("admin", []);
  const initialState = {
    itemCatalog: [{ id: "global-item", label: "Global item" }],
    stationProfiles: [{ id: "station-sc", stationCode: "SC-01" }, { id: "station-imps", stationCode: "IMPS-01" }],
    inspectionRounds: [{
      id: "closed-imps-round",
      stationId: "station-imps",
      status: "closed",
      snapshot: { id: "snapshot-imps", stationId: "station-imps", stationCode: "IMPS-01" },
      inspectionItems: { "imps-item-1": { status: "pass" } },
    }],
    inspectionHistory: [],
    inspectionWorkspaces: [],
  };
  const seeded = await json("/api/v1/state", { method: "PUT", headers: { Cookie: adminCookie, "Content-Type": "application/json" }, body: JSON.stringify({ state: initialState, expectedVersion: 0 }) });
  assert.equal(seeded.response.status, 200);
  assert.equal(seeded.body.version, 1);

  const inspectorCookie = await login("inspector", ["station-sc"]);
  const me = await json("/api/v1/auth/me", { headers: { Cookie: inspectorCookie } });
  assert.equal(me.response.status, 200);
  assert.equal(me.body.user.role, "inspector");
  assert.deepEqual(me.body.user.stationIds, ["station-sc"]);

  const visibleState = await json("/api/v1/state", { headers: { Cookie: inspectorCookie } });
  assert.equal(visibleState.response.status, 200);
  assert.deepEqual(visibleState.body.state.stationProfiles.map((station) => station.id), ["station-sc", "station-imps"]);
  assert.equal(visibleState.body.state.inspectionRounds[0]?.id, "closed-imps-round");

  const inspectorWrite = await json("/api/v1/state", { method: "PUT", headers: { Cookie: inspectorCookie, "Content-Type": "application/json" }, body: JSON.stringify({ state: initialState, expectedVersion: 1 }) });
  assert.equal(inspectorWrite.response.status, 200);

  const scopedState = {
    ...visibleState.body.state,
    stationProfiles: visibleState.body.state.stationProfiles.map((station) => station.id === "station-sc" ? { ...station, stationName: "สถานี SC ที่แก้ไขแล้ว" } : station),
  };
  const allowedWrite = await json("/api/v1/state", { method: "PUT", headers: { Cookie: inspectorCookie, "Content-Type": "application/json" }, body: JSON.stringify({ state: scopedState, expectedVersion: inspectorWrite.body.version }) });
  assert.equal(allowedWrite.response.status, 200);
  const scopedStations = await json("/api/v1/stations", { headers: { Cookie: inspectorCookie } });
  assert.deepEqual(scopedStations.body.stations.map((station) => station.id), ["station-sc", "station-imps"]);

  const afterScopedWrite = await json("/api/v1/state", { headers: { Cookie: adminCookie } });
  assert.equal(afterScopedWrite.response.status, 200);
  assert.deepEqual(afterScopedWrite.body.state.stationProfiles.map((station) => station.id), ["station-sc", "station-imps"]);
  assert.equal(afterScopedWrite.body.state.stationProfiles[0].stationName, "สถานี SC ที่แก้ไขแล้ว");
  assert.deepEqual(afterScopedWrite.body.state.stationProfiles[1], initialState.stationProfiles[1]);
  assert.deepEqual(afterScopedWrite.body.state.inspectionRounds[0], initialState.inspectionRounds[0]);
  assert.deepEqual(afterScopedWrite.body.state.itemCatalog, initialState.itemCatalog);

  const managerCookie = await login("station-manager", ["station-sc"]);
  const managerMe = await json("/api/v1/auth/me", { headers: { Cookie: managerCookie } });
  assert.equal(managerMe.body.user.role, "station-manager");
  const managerState = await json("/api/v1/state", { headers: { Cookie: managerCookie } });
  assert.equal(managerState.response.status, 200);
  assert.deepEqual(managerState.body.state.stationProfiles.map((station) => station.id), ["station-sc", "station-imps"]);
  assert.equal(managerState.body.state.inspectionRounds[0]?.id, "closed-imps-round");
  const managerWrite = await json("/api/v1/state", { method: "PUT", headers: { Cookie: managerCookie, "Content-Type": "application/json" }, body: JSON.stringify({ state: managerState.body.state, expectedVersion: managerState.body.version }) });
  assert.equal(managerWrite.response.status, 200, JSON.stringify(managerWrite.body));

  const viewerCookie = await login("viewer", ["station-sc"]);
  const viewerMe = await json("/api/v1/auth/me", { headers: { Cookie: viewerCookie } });
  assert.equal(viewerMe.body.user.role, "viewer");
  const viewerWrite = await json("/api/v1/state", { method: "PUT", headers: { Cookie: viewerCookie, "Content-Type": "application/json" }, body: JSON.stringify({ state: scopedState, expectedVersion: managerWrite.body.version }) });
  assert.equal(viewerWrite.response.status, 403);

  const unassignedInspectorCookie = await login("inspector", []);
  const unassignedState = await json("/api/v1/state", { headers: { Cookie: unassignedInspectorCookie } });
  assert.equal(unassignedState.response.status, 200);
  assert.deepEqual(unassignedState.body.state.stationProfiles.map((station) => station.id), ["station-sc", "station-imps"]);
  const unassignedStations = await json("/api/v1/stations", { headers: { Cookie: unassignedInspectorCookie } });
  assert.equal(unassignedStations.response.status, 200);
  assert.deepEqual(unassignedStations.body.stations.map((station) => station.id), ["station-sc", "station-imps"]);
  const unassignedWrite = await json("/api/v1/state", { method: "PUT", headers: { Cookie: unassignedInspectorCookie, "Content-Type": "application/json" }, body: JSON.stringify({ state: unassignedState.body.state, expectedVersion: managerWrite.body.version }) });
  assert.equal(unassignedWrite.response.status, 200);

  const adminMe = await json("/api/v1/auth/me", { headers: { Cookie: adminCookie } });
  assert.equal(adminMe.body.user.role, "admin");
  const currentAdminState = await json("/api/v1/state", { headers: { Cookie: adminCookie } });
  const adminWrite = await json("/api/v1/state", { method: "PUT", headers: { Cookie: adminCookie, "Content-Type": "application/json" }, body: JSON.stringify({ state: currentAdminState.body.state, expectedVersion: currentAdminState.body.version }) });
  assert.equal(adminWrite.response.status, 200);

  const logout = await json("/api/v1/auth/logout", { method: "POST", headers: { Cookie: viewerCookie } });
  assert.equal(logout.response.status, 200);
  assert.equal((await json("/api/v1/auth/me", { headers: { Cookie: viewerCookie } })).response.status, 401);
  console.log("OIDC flow smoke passed: PKCE, JWT/JWKS, role mapping, station scope, 401/403 and logout");
} finally {
  if (app.exitCode === null) {
    await new Promise((resolve) => {
      app.once("exit", resolve);
      app.kill();
    });
  }
  if (oidcServer.listening) await new Promise((resolve) => oidcServer.close(resolve));
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
