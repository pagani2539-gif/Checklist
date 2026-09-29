import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { hashLocalPassword } from "../server/auth.mjs";
import { createPostgresStore } from "../server/postgres-store.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const connectionString = process.env.CHECKLIST_LOCAL_AUTH_TEST_DATABASE_URL || process.env.CHECKLIST_POSTGRES_TEST_DATABASE_URL || process.env.CHECKLIST_DATABASE_URL;
if (!connectionString) {
  console.log("test_local_auth: skipped (set CHECKLIST_LOCAL_AUTH_TEST_DATABASE_URL for PostgreSQL integration coverage)");
  process.exit(0);
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "checklist-local-auth-"));
const port = 48100 + Math.floor(Math.random() * 500);
const baseUrl = `http://127.0.0.1:${port}`;
const stationA = `local-auth-a-${crypto.randomUUID()}`;
const stationB = `local-auth-b-${crypto.randomUUID()}`;
const usernameTag = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
const ids = [];
let child;
let serverStderr = "";
let store;
let seededState = null;
let seededVersion = 0;

function cookieFrom(response) {
  const value = response.headers.get("set-cookie") || "";
  assert.match(value, /checklist_session=/);
  assert.match(value, /;\s*HttpOnly/i);
  assert.match(value, /;\s*Secure/i);
  assert.match(value, /;\s*SameSite=Lax/i);
  return value.split(";", 1)[0];
}

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  return { response, body };
}

async function start() {
  child = spawn(process.execPath, ["server.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      HOST: "127.0.0.1",
      CHECKLIST_STORAGE_BACKEND: "postgres",
      CHECKLIST_DATABASE_URL: connectionString,
      CHECKLIST_ATTACHMENT_BACKEND: "filesystem",
      CHECKLIST_ATTACHMENTS_DIR: path.join(tempRoot, "attachments"),
      CHECKLIST_AUTH_MODE: "local",
      CHECKLIST_COOKIE_SECURE: "true",
      CHECKLIST_ENFORCE_STATION_SCOPE: "true",
      CHECKLIST_PUBLIC_MODE: "true",
      REQUIRE_VEHICLE_API_READY: "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stderr.on("data", (chunk) => { serverStderr += chunk.toString(); });
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`server exited: ${serverStderr}`);
    try { if ((await fetch(`${baseUrl}/health`)).ok) return; } catch { /* wait for listen */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`server did not start: ${serverStderr}`);
}

async function stop() {
  const current = child;
  if (!current || current.exitCode !== null) return;
  await new Promise((resolve) => {
    current.once("exit", resolve);
    current.kill();
  });
  if (child === current) child = null;
}

try {
  store = await createPostgresStore({ connectionString });
  if (await store.countLocalUsers() !== 0) {
    console.log("test_local_auth: skipped (test database already has local users; use an isolated PostgreSQL database)");
    process.exitCode = 0;
  } else {
    await start();
    const config = await request("/api/v1/auth/config");
    assert.equal(config.response.status, 200);
    assert.equal(config.body.mode, "local");
    assert.equal(config.body.hasLocalUsers, false);
    assert.equal((await request("/api/v1/state")).response.status, 401);
    assert.equal((await request("/api/v1/admin/users")).response.status, 401);

    const adminUsername = `admin.${usernameTag}`;
    const admin = await store.createLocalUser({
      id: crypto.randomUUID(), username: adminUsername, displayName: "Local test admin", role: "admin", stationIds: [],
      passwordHash: await hashLocalPassword("Local-Test-Admin-2026!"), mustChangePassword: false, createdBy: "test-bootstrap",
    }, { firstAdminOnly: true });
    ids.push(admin.id);
    await assert.rejects(store.createLocalUser({
      id: crypto.randomUUID(), username: `admin2.${usernameTag}`, displayName: "Second bootstrap", role: "admin", stationIds: [],
      passwordHash: await hashLocalPassword("Local-Test-Admin-2026!"), createdBy: "test-bootstrap",
    }, { firstAdminOnly: true }), { code: "BOOTSTRAP_CLOSED" });

    const configAfterBootstrap = await request("/api/v1/auth/config");
    assert.equal(configAfterBootstrap.body.hasLocalUsers, true);
    assert.equal((await request("/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: adminUsername, password: "wrong-password" }) })).response.status, 401);
    const login = await request("/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: adminUsername, password: "Local-Test-Admin-2026!" }) });
    assert.equal(login.response.status, 200);
    const adminCookie = cookieFrom(login.response);
    assert.equal(login.body.user.role, "admin");

    const me = await request("/api/v1/auth/me", { headers: { Cookie: adminCookie } });
    assert.equal(me.response.status, 200);
    assert.equal(me.body.user.username, adminUsername);
    const emptyState = await request("/api/v1/state", { headers: { Cookie: adminCookie } });
    const baseState = emptyState.body.state || {};
    seededVersion = emptyState.body.version;
    seededState = {
      ...baseState,
      stationProfiles: [
        ...(baseState.stationProfiles || []).filter((station) => ![stationA, stationB].includes(String(station?.id))),
        { id: stationA, stationCode: "TEST-A", stationName: "Local auth test A", stationFormat: "SC", stationSystems: [], lanes: [], equipment: [], torItems: [] },
        { id: stationB, stationCode: "TEST-B", stationName: "Local auth test B", stationFormat: "SC", stationSystems: [], lanes: [], equipment: [], torItems: [] },
      ],
    };
    const stateSaved = await request("/api/v1/state", { method: "PUT", headers: { Cookie: adminCookie, "Content-Type": "application/json" }, body: JSON.stringify({ state: seededState, expectedVersion: seededVersion }) });
    assert.equal(stateSaved.response.status, 200);
    seededVersion = stateSaved.body.version;

    const invalidStation = await request("/api/v1/admin/users", { method: "POST", headers: { Cookie: adminCookie, "Content-Type": "application/json" }, body: JSON.stringify({ username: `bad.${usernameTag}`, displayName: "Invalid assignment", role: "viewer", stationIds: [`missing-${usernameTag}`], password: "Temporary-Test-2026!" }) });
    assert.equal(invalidStation.response.status, 400);
    const emptyScope = await request("/api/v1/admin/users", { method: "POST", headers: { Cookie: adminCookie, "Content-Type": "application/json" }, body: JSON.stringify({ username: `noscope.${usernameTag}`, displayName: "No station", role: "viewer", stationIds: [], password: "Temporary-Test-2026!" }) });
    assert.equal(emptyScope.response.status, 400);

    const created = await request("/api/v1/admin/users", { method: "POST", headers: { Cookie: adminCookie, "Content-Type": "application/json" }, body: JSON.stringify({ username: `field.${usernameTag}`, displayName: "Field operator", role: "inspector", stationIds: [], password: "Temporary-Test-2026!" }) });
    assert.equal(created.response.status, 201);
    assert.equal(created.body.user.mustChangePassword, true);
    const inspectorId = created.body.user.id;
    ids.push(inspectorId);
    assert.equal((await request("/api/v1/admin/users", { headers: { Cookie: adminCookie } })).body.users.some((user) => Object.hasOwn(user, "passwordHash")), false);

    const inspectorLogin = await request("/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: `field.${usernameTag}`, password: "Temporary-Test-2026!" }) });
    assert.equal(inspectorLogin.response.status, 200);
    const tempCookie = cookieFrom(inspectorLogin.response);
    assert.equal(inspectorLogin.body.user.mustChangePassword, true);
    const blockedBeforeChange = await request("/api/v1/state", { headers: { Cookie: tempCookie } });
    assert.equal(blockedBeforeChange.response.status, 403);
    assert.equal(blockedBeforeChange.body.code, "PASSWORD_CHANGE_REQUIRED");
    const changed = await request("/api/v1/auth/password", { method: "POST", headers: { Cookie: tempCookie, "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: "Temporary-Test-2026!", newPassword: "Personal-Password-2026!" }) });
    assert.equal(changed.response.status, 200);
    const inspectorCookie = cookieFrom(changed.response);
    assert.equal(changed.body.user.mustChangePassword, false);
    const inspectorState = await request("/api/v1/state", { headers: { Cookie: inspectorCookie } });
    assert.equal(inspectorState.response.status, 200);
    assert.deepEqual(inspectorState.body.state.stationProfiles.map((station) => station.id), [stationA, stationB]);
    assert.equal((await request("/api/v1/admin/users", { headers: { Cookie: inspectorCookie } })).response.status, 403);
    assert.equal((await request(`/api/v1/admin/users/${inspectorId}`, { method: "PATCH", headers: { Cookie: adminCookie, "Content-Type": "application/json" }, body: JSON.stringify({ active: false }) })).response.status, 200);
    assert.equal((await request("/api/v1/auth/me", { headers: { Cookie: inspectorCookie } })).response.status, 401);

    await store.pool.query("DELETE FROM audit_log WHERE actor_id = ANY($1::text[]) OR resource_id = ANY($1::text[])", [ids]);
    await store.pool.query("DELETE FROM sessions WHERE user_id = ANY($1::text[])", [ids]);
    await store.pool.query("DELETE FROM local_users WHERE id = ANY($1::text[])", [ids]);
    const currentState = await store.getState();
    if (currentState.version === seededVersion && seededState) {
      seededState.stationProfiles = seededState.stationProfiles.filter((station) => ![stationA, stationB].includes(String(station?.id)));
      await store.saveState(seededState, { expectedVersion: currentState.version, actor: { id: "test-cleanup", role: "admin" }, reason: "local-auth-test-cleanup" });
    }
    console.log("test_local_auth: pass (bootstrap closure, secure login, password change, admin account management, station scope, suspension)");
  }
} catch (error) {
  console.error(`test_local_auth: fail ${error?.stack || error}`);
  console.error(serverStderr);
  throw error;
} finally {
  await stop();
  if (ids.length && store) {
    await store.pool.query("DELETE FROM sessions WHERE user_id = ANY($1::text[])", [ids]).catch(() => {});
    await store.pool.query("DELETE FROM local_users WHERE id = ANY($1::text[])", [ids]).catch(() => {});
    await store.pool.query("DELETE FROM audit_log WHERE actor_id = ANY($1::text[]) OR resource_id = ANY($1::text[])", [ids]).catch(() => {});
  }
  await store?.close?.();
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
