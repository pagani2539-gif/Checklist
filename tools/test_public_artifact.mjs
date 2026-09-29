import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const connectionString = process.env.CHECKLIST_POSTGRES_TEST_DATABASE_URL || process.env.CHECKLIST_DATABASE_URL;
if (!connectionString) {
  console.log("public artifact smoke skipped (set CHECKLIST_POSTGRES_TEST_DATABASE_URL or CHECKLIST_DATABASE_URL for PostgreSQL integration coverage)");
  process.exit(0);
}
const artifactDir = path.resolve(process.env.CHECKLIST_DIST_DIR || path.join(root, "dist"));
assert.ok(fs.existsSync(path.join(artifactDir, "index.html")), `missing build artifact: ${artifactDir}`);

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "checklist-public-artifact-"));
const port = 4800 + Math.floor(Math.random() * 100);
const child = spawn(process.execPath, ["server.mjs"], {
  cwd: root,
  env: {
    ...process.env,
    PORT: String(port),
    HOST: "127.0.0.1",
    CHECKLIST_DIST_DIR: artifactDir,
    CHECKLIST_STORAGE_BACKEND: "postgres",
    CHECKLIST_DATABASE_URL: connectionString,
    CHECKLIST_ATTACHMENT_BACKEND: "filesystem",
    CHECKLIST_ATTACHMENTS_DIR: path.join(tempRoot, "attachments"),
    CHECKLIST_AUTH_MODE: "oidc",
    CHECKLIST_ENFORCE_STATION_SCOPE: "true",
    CHECKLIST_COOKIE_SECURE: "true",
    VEHICLE_SEARCH_PROXY_ALLOWED_ORIGINS: "http://proxy.example.test:3005",
    REQUIRE_VEHICLE_API_READY: "false",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let stderr = "";
child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

try {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  assert.equal(child.exitCode, null, `server exited before smoke test: ${stderr}`);
  const home = await fetch(`http://127.0.0.1:${port}/`);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /Checklist Operations Hub/);
  const contentSecurityPolicy = home.headers.get("content-security-policy") || "";
  assert.match(contentSecurityPolicy, /connect-src 'self' http:\/\/proxy\.example\.test:3005/);
  assert.match(contentSecurityPolicy, /img-src 'self' data: blob:/);
  assert.match(contentSecurityPolicy, /frame-ancestors 'none'/);
  assert.equal((await fetch(`http://127.0.0.1:${port}/server.mjs`)).status, 404);
  assert.equal((await fetch(`http://127.0.0.1:${port}/src/app/App.jsx`)).status, 404);
  assert.equal((await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`)).status, 503);
  console.log(`public artifact smoke passed (${artifactDir})`);
} finally {
  child.kill();
  await new Promise((resolve) => child.once("exit", resolve));
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
