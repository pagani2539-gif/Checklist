import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const connectionString = process.env.CHECKLIST_SERVER_TEST_DATABASE_URL || process.env.CHECKLIST_POSTGRES_TEST_DATABASE_URL || process.env.CHECKLIST_DATABASE_URL;
if (!connectionString) {
  console.log("test_server_api: skipped (set CHECKLIST_SERVER_TEST_DATABASE_URL or CHECKLIST_POSTGRES_TEST_DATABASE_URL for PostgreSQL integration coverage)");
  process.exit(0);
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "checklist-server-test-"));
const attachmentsDir = path.join(tempRoot, "attachments");
const port = 4600 + Math.floor(Math.random() * 200);
let child;
let serverStderr = "";

function start(authMode = "disabled", distDir = "") {
  const environment = {
    ...process.env,
    PORT: String(port),
    HOST: "127.0.0.1",
    CHECKLIST_STORAGE_BACKEND: "postgres",
    CHECKLIST_DATABASE_URL: connectionString,
    CHECKLIST_ATTACHMENT_BACKEND: "filesystem",
    CHECKLIST_ATTACHMENTS_DIR: attachmentsDir,
    CHECKLIST_AUTH_MODE: authMode,
    CHECKLIST_ENFORCE_STATION_SCOPE: authMode === "oidc" ? "true" : "false",
    CHECKLIST_COOKIE_SECURE: "true",
    REQUIRE_VEHICLE_API_READY: "false",
  };
  if (authMode === "oidc") {
    for (const key of ["OIDC_ISSUER", "OIDC_JWKS_URL", "OIDC_AUDIENCE", "OIDC_CLIENT_ID", "OIDC_AUTHORIZATION_ENDPOINT", "OIDC_TOKEN_ENDPOINT", "OIDC_REDIRECT_URI"]) delete environment[key];
  }
  if (distDir) environment.CHECKLIST_DIST_DIR = distDir;
  else delete environment.CHECKLIST_DIST_DIR;
  child = spawn(process.execPath, ["server.mjs"], {
    cwd: root,
    env: environment,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", () => {});
  child.stderr.on("data", (chunk) => { serverStderr += chunk.toString(); });
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 10000;
    const timer = setInterval(async () => {
      if (Date.now() > deadline) { clearInterval(timer); reject(new Error(`server did not start: ${serverStderr}`)); return; }
      try {
        if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) { clearInterval(timer); resolve(); }
      } catch {
        if (child.exitCode !== null) { clearInterval(timer); reject(new Error(`server exited: ${serverStderr}`)); }
      }
    }, 100);
  });
}

async function stop() {
  const current = child;
  if (!current || current.exitCode !== null) return;
  const exited = new Promise((resolve) => current.once("exit", resolve));
  current.kill();
  await exited;
  if (child === current) child = null;
}

async function request(pathname, options = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`, options);
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  return { response, body };
}

try {
  await start();
  assert.equal((await request("/health")).response.status, 200);
  assert.equal((await request("/ready")).response.status, 200);
  assert.equal((await request("/server.mjs")).response.status, 404);
  const authConfig = await request("/api/v1/auth/config");
  assert.equal(authConfig.response.status, 200);
  assert.equal(authConfig.body.mode, "disabled");
  const me = await request("/api/v1/auth/me");
  assert.equal(me.response.status, 200);
  assert.equal(me.body.user.id, "local-admin");
  assert.equal(me.body.user.role, "admin");

  const initial = await request("/api/v1/state");
  assert.equal(initial.response.status, 200);
  assert.equal(initial.body.authMode, "disabled");
  const initialState = initial.body.state || {};
  const stationId = `server-api-${Date.now()}`;
  const station = { id: stationId, stationCode: "PG-API", stationName: "PostgreSQL API smoke", stationFormat: "SC", stationSystems: [], lanes: [], equipment: [], torItems: [] };
  const state = { ...initialState, stationProfiles: [...(initialState.stationProfiles || []).filter((entry) => entry.id !== stationId), station] };
  const created = await request("/api/v1/state", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state, expectedVersion: initial.body.version, reason: "postgres-server-api-smoke" }) });
  assert.equal(created.response.status, 200);
  const closedRound = { id: `${stationId}-round`, stationId, status: "closed", snapshot: { stationId, stationCode: station.stationCode }, inspectionItems: { item1: { status: "pass" } } };
  const closed = { ...state, inspectionRounds: [...(state.inspectionRounds || []), closedRound] };
  const closedResult = await request("/api/v1/state", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state: closed, expectedVersion: created.body.version }) });
  assert.equal(closedResult.response.status, 200);
  const mutation = { ...closed, inspectionRounds: closed.inspectionRounds.map((round) => round.id === closedRound.id ? { ...round, inspectionItems: { item1: { status: "fail" } } } : round) };
  const immutable = await request("/api/v1/state", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state: mutation, expectedVersion: closedResult.body.version }) });
  assert.equal(immutable.response.status, 409);

  const attachmentId = `${stationId}-attachment`;
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  const uploaded = await request(`/api/v1/attachments/${attachmentId}`, { method: "PUT", headers: { "Content-Type": "image/png", "X-Filename": "test.png", "X-Station-Id": stationId, "Content-Length": String(png.length) }, body: png });
  assert.equal(uploaded.response.status, 201);
  const downloaded = await fetch(`http://127.0.0.1:${port}/api/v1/attachments/${attachmentId}`);
  assert.equal(downloaded.status, 200);
  assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), png);

  await stop();
  await start();
  const persisted = await request("/api/v1/state");
  assert.equal(persisted.body.version, closedResult.body.version);
  assert.equal(persisted.body.state.inspectionRounds.find((round) => round.id === closedRound.id).status, "closed");
  const persistedFile = await fetch(`http://127.0.0.1:${port}/api/v1/attachments/${attachmentId}`);
  assert.equal(persistedFile.status, 200);
  const deleted = await request(`/api/v1/attachments/${attachmentId}`, { method: "DELETE" });
  assert.equal(deleted.response.status, 204);
  assert.equal((await fetch(`http://127.0.0.1:${port}/api/v1/attachments/${attachmentId}`)).status, 404);
  await stop();

  await start("oidc");
  assert.equal((await request("/api/v1/state")).response.status, 401);
  assert.equal((await request("/api/v1/auth/login")).response.status, 503);
  await stop();

  const missingBuildDir = path.join(tempRoot, "missing-build");
  await start("oidc", missingBuildDir);
  assert.equal((await fetch(`http://127.0.0.1:${port}/`)).status, 503);
  assert.equal((await fetch(`http://127.0.0.1:${port}/server.mjs`)).status, 503);
  await stop();
  console.log("test_server_api: pass (PostgreSQL)");
} catch (error) {
  console.error(`test_server_api: fail ${error?.stack || error}`);
  console.error(serverStderr);
  throw error;
} finally {
  await stop();
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
