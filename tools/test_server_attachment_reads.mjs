import assert from "node:assert/strict";

let active = 0;
let maximumActive = 0;
let requestCount = 0;
const originalFetch = globalThis.fetch;
const { getServerAttachment } = await import("../src/domain/server-storage.js?attachment-read-test");

try {
  globalThis.fetch = async (_url, options) => {
    assert.ok(options.signal instanceof AbortSignal, "attachment reads should be cancellable when they time out");
    requestCount += 1;
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return new Response(new Blob(["image-bytes"], { type: "image/png" }), { status: 200 });
  };

  const duplicates = await Promise.all([
    getServerAttachment("duplicate-attachment-001"),
    getServerAttachment("duplicate-attachment-001"),
  ]);
  assert.ok(duplicates.every((blob) => blob instanceof Blob));
  assert.equal(requestCount, 1, "duplicate reads of one attachment should share one request");
  const blobs = await Promise.all(Array.from({ length: 31 }, (_, index) => getServerAttachment(`parallel-attachment-${String(index).padStart(3, "0")}`)));
  assert.equal(blobs.length, 31);
  assert.ok(blobs.every((blob) => blob instanceof Blob));
  assert.equal(requestCount, 32, "duplicate attachment should only be fetched once");
  assert.equal(maximumActive, 8, "browser should schedule no more than eight attachment reads at a time");

  globalThis.fetch = async () => new Response(JSON.stringify({ message: "Please retry" }), {
    status: 429,
    headers: { "Content-Type": "application/json", "Retry-After": "2" },
  });
  await assert.rejects(
    () => getServerAttachment("rate-limited-attachment-001"),
    (error) => error.status === 429 && error.retryAfterMs === 2000,
  );

  globalThis.fetch = async () => new Response("", { status: 404 });
  assert.equal(await getServerAttachment("missing-attachment-001"), null, "a missing source attachment should remain a permanent missing result");

  console.log("test_server_attachment_reads: pass");
} finally {
  if (originalFetch === undefined) delete globalThis.fetch;
  else globalThis.fetch = originalFetch;
}
