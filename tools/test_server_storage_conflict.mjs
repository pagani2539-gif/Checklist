import assert from "node:assert/strict";
const values = new Map([["checklist-server-pending-v1", "legacy"]]);
let writes = 0;
globalThis.window = { localStorage: {
  getItem: key => values.get(key) ?? null,
  setItem: () => { writes += 1; },
  removeItem: key => values.delete(key),
} };
const { clearPendingServerState, saveServerState } = await import("../src/domain/server-storage.js");
await clearPendingServerState();
assert.equal(values.size, 0, "legacy draft is discarded");
for (const status of [409, 429, 503]) {
  globalThis.fetch = async () => ({ ok: false, status, json: async () => ({ message: "failed" }), headers: { get: () => "2" } });
  await assert.rejects(() => saveServerState({ stationProfiles: [] }, 3), error => {
    assert.equal(error.status, status);
    assert.equal(error.draftPreserved, undefined);
    if (status === 429) assert.equal(error.retryAfterMs, 2000);
    return true;
  });
}
globalThis.fetch = async () => { throw new TypeError("offline"); };
await assert.rejects(() => saveServerState({}, 3), error => error.offline === true);
assert.equal(writes, 0, "failed saves must never persist a browser draft");
let sent;
globalThis.fetch = async (_url, options) => {
  sent = JSON.parse(options.body);
  return { ok: true, json: async () => ({ version: 4, state: sent.state }) };
};
assert.equal((await saveServerState({ stationProfiles: [] }, 3, "station-delete")).version, 4);
assert.equal(sent.expectedVersion, 3, "retain central concurrency guard");
assert.equal(sent.reason, "station-delete");
delete globalThis.window;
delete globalThis.fetch;
console.log("test_server_storage_conflict: pass (no browser drafts)");
