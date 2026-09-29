import assert from "node:assert/strict";

const values = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  },
};

const storage = await import("../src/domain/server-storage.js?server-storage-conflict-test");
const { clearPendingServerState, loadPendingServerState, saveServerState } = storage;
const state = { stationProfiles: [{ id: "station-conflict-test", stationName: "สถานีทดสอบ" }] };
const nativeSetTimeout = globalThis.setTimeout;

try {
  globalThis.fetch = async () => ({
    ok: false,
    status: 409,
    json: async () => ({ message: "version conflict", currentVersion: 4 }),
  });
  await assert.rejects(
    () => saveServerState(state, 3, "conflict-test"),
    (error) => error.status === 409 && error.draftPreserved === true,
  );
  const conflict = await loadPendingServerState();
  assert.equal(conflict.status, "conflict");
  assert.equal(conflict.expectedVersion, 3);
  assert.equal(conflict.reason, "conflict-test");
  assert.deepEqual(conflict.state, state);
  assert.equal(await clearPendingServerState(), true);
  assert.equal(await loadPendingServerState(), null);

  globalThis.fetch = async (_url, options) => {
    assert.ok(options.signal instanceof AbortSignal, "state requests should have an abort signal");
    throw new TypeError("network unavailable");
  };
  await assert.rejects(
    () => saveServerState(state, 4, "offline-test"),
    (error) => error.offline === true && error.draftPreserved === true,
  );
  const offline = await loadPendingServerState();
  assert.equal(offline.status, "offline");
  assert.equal(offline.expectedVersion, 4);
  assert.deepEqual(offline.state, state);
  await clearPendingServerState();

  globalThis.setTimeout = (callback, _delay, ...args) => nativeSetTimeout(callback, 1, ...args);
  globalThis.fetch = (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
  });
  await assert.rejects(
    () => saveServerState(state, 5, "timeout-test"),
    (error) => error.offline === true && error.draftPreserved === true,
  );
  const timeoutDraft = await loadPendingServerState();
  assert.equal(timeoutDraft.status, "offline");
  assert.equal(timeoutDraft.expectedVersion, 5);
  assert.deepEqual(timeoutDraft.state, state);
  assert.equal(await clearPendingServerState(), true);

  globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({ message: "unavailable" }) });
  await assert.rejects(() => saveServerState(state, 6, "server-error-test"), (error) => error.status === 503);
  assert.equal(await loadPendingServerState(), null, "non-conflict server errors should not be queued for replay");
  console.log("test_server_storage_conflict: pass");
} catch (error) {
  console.error(`test_server_storage_conflict: fail ${error?.stack || error}`);
  process.exitCode = 1;
} finally {
  globalThis.setTimeout = nativeSetTimeout;
  delete globalThis.fetch;
  delete globalThis.window;
}
