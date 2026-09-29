import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hook = fs.readFileSync(path.join(root, "src/app/useServerWorkspaceSync.js"), "utf8");
const app = fs.readFileSync(path.join(root, "src/app/App.jsx"), "utf8");

assert.match(hook, /pending\?\.state[\s\S]*pending\.status !== "conflict"/, "startup should not auto-save a known conflict draft");
assert.match(hook, /if \(pending\.status === "conflict"\) \{\s+activateConflict\(pending, true\);\s+return;\s+\}/, "online recovery should keep conflicts blocked from automatic replay");
assert.match(hook, /if \(!serverConflictRef\.current\?\.downloaded\) return false/, "discard must stay unavailable until the draft is exported");
assert.match(hook, /const latest = await loadServerState\(\);[\s\S]*if \(!await clearPendingServerState\(\)\)/, "returning to server state should load current data before clearing the draft");
assert.match(app, /className="ops-server-conflict" role="alert"/, "a conflict should remain visible beyond the transient toast");
assert.match(app, /disabled=\{!serverConflict\.downloaded\}/, "the discard action must require a successful export first");
console.log("test_server_conflict_recovery_contract: pass");
