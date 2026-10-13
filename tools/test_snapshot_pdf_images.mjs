import assert from 'node:assert/strict';
import { prepareSnapshotPdfImages } from '../src/app/reports/snapshot-pdf-images.js';

const oldDocument = globalThis.document;
const oldFetch = globalThis.fetch;
let canvasCount = 0;
let drawn = [];
const canvases = [];
function image({ width = 2592, height = 1944, src = 'blob:loaded-evidence', srcset = null, ready = true, fail = false } = {}) {
  const attributes = new Map([['src', src], ...(srcset === null ? [] : [['srcset', srcset]])]);
  return { complete: ready, naturalWidth: ready ? width : 0, naturalHeight: height, fail,
    getAttribute: name => attributes.get(name) ?? null,
    setAttribute: (name, value) => attributes.set(name, value),
    removeAttribute: name => attributes.delete(name),
    async decode() { if (this.rejectData && this.getAttribute('src').startsWith('data:')) throw new Error('decode failed'); },
  };
}
globalThis.fetch = () => { throw new Error('Export must not fetch decoded evidence'); };
globalThis.document = { createElement(name) {
  assert.equal(name, 'canvas'); canvasCount++;
  const canvas = { width: 0, height: 0,
    getContext: () => ({ drawImage(value) {
      if (value.fail) throw new DOMException('Cross-origin pixels', 'SecurityError');
      drawn.push([canvas.width, canvas.height]);
    } }),
    toDataURL: type => { assert.equal(type, 'image/png'); return 'data:image/png;base64,fixture'; },
  };
  canvases.push(canvas); return canvas;
} };
try {
  const first = image({ srcset: 'blob:alternate 2x' });
  const small = image({ width: 193, height: 64 });
  const restore = await prepareSnapshotPdfImages({ querySelectorAll: () => [first, small] });
  assert.match(first.getAttribute('src'), /^data:image\/png;base64,/);
  assert.equal(first.getAttribute('srcset'), null);
  assert.deepEqual(drawn, [[1200, 900], [193, 64]]);
  await restore();
  assert.equal(first.getAttribute('src'), 'blob:loaded-evidence');
  assert.equal(first.getAttribute('srcset'), 'blob:alternate 2x');
  assert.equal(small.getAttribute('srcset'), null);
  for (const failing of [image({ ready: false }), image({ fail: true }), Object.assign(image(), { rejectData: true })]) {
    await assert.rejects(prepareSnapshotPdfImages({ querySelectorAll: () => [first, failing] }));
    assert.equal(first.getAttribute('src'), 'blob:loaded-evidence');
    assert.equal(first.getAttribute('srcset'), 'blob:alternate 2x');
    assert.equal(failing.getAttribute('src'), 'blob:loaded-evidence');
  }
  assert.ok(canvasCount > 0);
  assert.ok(canvases.every(canvas => canvas.width === 0 && canvas.height === 0));
  console.log('PASS decoded evidence export: no fetch, PNG copies, bounded dimensions, original restoration after success and partial failures');
} finally {
  globalThis.document = oldDocument;
  globalThis.fetch = oldFetch;
}
