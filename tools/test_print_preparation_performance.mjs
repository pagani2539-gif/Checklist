import assert from "node:assert/strict";
import { createPrintImageCopy, preparePrintableImageCopies, registerPrintableImageSource } from "../src/app/reports/print-image-optimizer.js";
import { archiveVehicleEvidence, loadSnapshotImage, SNAPSHOT_IMAGE_CONCURRENCY, VEHICLE_EVIDENCE_ARCHIVE_CONCURRENCY, vehicleEvidenceArchivePendingCount, vehicleEvidenceAttachmentIds } from "../src/domain/vehicle-evidence-images.js";

let encodes = 0;
let canvases = 0;
globalThis.document = {
  createElement(tag) {
    assert.equal(tag, "canvas");
    canvases++;
    return {
      width: 0, height: 0,
      getContext: () => ({ drawImage() {}, fillRect() {}, getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) }) }),
      toBlob(done, type) { encodes++; setImmediate(() => done(new Blob([new Uint8Array(64 * 1024)], { type }))); },
    };
  },
};
const image = (source, width = 1200, height = 800) => ({
  complete: true, naturalWidth: width, naturalHeight: height, src: source,
  getAttribute(name) { return name === "src" ? this.src : null; },
  setAttribute(name, value) { assert.equal(name, "src"); this.src = value; },
  async decode() {},
});

const compact = new Blob([new Uint8Array(8 * 1024)], { type: "image/jpeg" });
assert.equal(await createPrintImageCopy(image("compact"), { sourceBlob: compact }), null);
assert.equal(canvases, 0, "Small unchanged JPEG must bypass canvas work");
await createPrintImageCopy(image("oversized", 2400, 1600), { sourceBlob: compact });
assert.equal(canvases, 1, "Oversized dimensions still require conversion even for a small file");

const large = new Blob([new Uint8Array(1024 * 1024)], { type: "image/jpeg" });
const first = image("blob:fixture-a", 2400, 1600);
const second = image("blob:fixture-b", 2400, 1600);
const unregister = [registerPrintableImageSource(first.src, large), registerPrintableImageSource(second.src, large)];
const before = encodes;
const progress = [];
const copies = await preparePrintableImageCopies({ querySelectorAll: () => [first, second] }, { onProgress: value => progress.push(value.completed) });
assert.equal(encodes - before, 1, "Two positions sharing a Blob must encode only once");
assert.equal(copies.optimizedCount, 2);
assert.deepEqual(progress.sort(), [1, 2]);
copies.restore();
assert.equal(first.src, "blob:fixture-a");
assert.equal(second.src, "blob:fixture-b");
copies.restore();
unregister.forEach(fn => fn());

const prepared = image("blob:prepared-print", 2400, 1600);
prepared.getAttribute = name => name === "data-print-prepared" ? "true" : name === "src" ? prepared.src : null;
const unregisterPrepared = registerPrintableImageSource(prepared.src, new Blob([new Uint8Array(8 * 1024)], { type: "image/webp" }));
const beforePreparedPrint = encodes;
const preparedResult = await preparePrintableImageCopies({ querySelectorAll: () => [prepared] });
assert.equal(encodes, beforePreparedPrint + 1, "Cached WebP must be encoded for browser PDF even when marked prepared");
assert.equal(preparedResult.optimizedCount, 1, "Use JPEG even when its bytes exceed the compact WebP source");
assert.equal((await fetch(prepared.src).then(response => response.blob())).type, "image/jpeg");
preparedResult.restore();
assert.equal(prepared.src, "blob:prepared-print", "Restore the WebP source after printing");
unregisterPrepared();

const abort = new AbortController();
const cancelledImage = image("blob:fixture-c", 2400, 1600);
const unregisterCancelled = registerPrintableImageSource(cancelledImage.src, large);
const cancelled = await preparePrintableImageCopies({ querySelectorAll: () => [cancelledImage] }, {
  signal: abort.signal, onProgress: () => abort.abort(),
});
assert.equal(cancelled.cancelled, true);
assert.equal(cancelledImage.src, "blob:fixture-c", "Cancellation restores the evidence source");
unregisterCancelled();

const pending = [];
const defaultFetchPriorities = [];
let active = 0;
let peak = 0;
globalThis.fetch = (_src, options = {}) => new Promise(resolve => {
  defaultFetchPriorities.push(options.priority || "auto");
  active++; peak = Math.max(peak, active);
  pending.push(() => {
    active--;
    resolve({ ok: true, blob: async () => new Blob([new Uint8Array([255, 216, 255, 0])], { type: "image/jpeg" }) });
  });
});
const requests = Array.from({ length: SNAPSHOT_IMAGE_CONCURRENCY + 1 }, (_, i) => loadSnapshotImage(`/fixture-image-${i}`));
assert.equal(pending.length, 6, "Load six images concurrently while the seventh stays queued");
while (pending.length) {
  pending.shift()();
  await new Promise(resolve => setImmediate(resolve));
}
await Promise.all(requests);
assert.equal(peak, 6, "The loading queue must retain a bounded concurrency");
assert(defaultFetchPriorities.every(priority => priority === "auto"), "Report image loading should keep the default priority");

globalThis.createImageBitmap = async () => ({ width: 2400, height: 1600, close() {} });
active = 0;
peak = 0;
const archivedFiles = [];
const archiveFetchPriorities = [];
globalThis.fetch = async (_src, options = {}) => {
  archiveFetchPriorities.push(options.priority || "auto");
  active++;
  peak = Math.max(peak, active);
  await new Promise(resolve => setTimeout(resolve, 5));
  active--;
  return { ok: true, blob: async () => new Blob([new Uint8Array([255, 216, 255, 0])], { type: "image/jpeg" }) };
};
let archiveId = 0;
const archiveRound = {
  id: "archive-fixture",
  stationId: "fixture-station",
  vehicleSearch: { scopes: [{ rows: Array.from({ length: 6 }, (_, index) => ({ id: `archive-${index}`, plateImage: `/archive-image-${index}` })) }] },
};
const archive = await archiveVehicleEvidence(archiveRound, {
  createId: prefix => `${prefix}-${++archiveId}`,
  save: async (_id, file) => { archivedFiles.push({ type: file.type, name: file.name }); },
});
assert.equal(peak, VEHICLE_EVIDENCE_ARCHIVE_CONCURRENCY, "Archive fetches must run with the configured bounded concurrency");
assert(archiveFetchPriorities.length > 0 && archiveFetchPriorities.every(priority => priority === "low"), "Background evidence archival should yield image-fetch priority to the active review screen");
assert.equal(archivedFiles.filter(file => file.type === "image/webp").length, 6, "Each JPEG source should add a WebP rendition");
assert.equal(archivedFiles.filter(file => file.type === "image/jpeg").length, 6, "Each source should retain its original JPEG");
assert.equal(vehicleEvidenceAttachmentIds(archive).length, 12, "Cleanup references must include originals and WebP renditions");
assert.equal(vehicleEvidenceArchivePendingCount({ ...archiveRound, vehicleEvidenceArchive: archive }), 0, "Prepared evidence should not be scheduled again");
assert(Object.values(archive).every(fields => fields.plateImage.renditions.webp.type === "image/webp"));
console.log("PASS print performance: WebP converts to temporary JPEG and restores, compact JPEG skips encoding, API cache and archive concurrency remain bounded");
