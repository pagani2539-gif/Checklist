import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createApi } from '../server/api.mjs';
import { FilesystemAttachmentStore } from '../server/attachment-store.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'attachment-api-layout-'));
const metadata = new Map();
const store = {
  getState: async () => ({ state: { stationProfiles: [{ id: 'station-one', stationName: 'สถานีทดสอบ' }], inspectionRounds: [{ id: 'round-one', stationId: 'station-one' }] } }),
  audit: async () => {},
  getAttachment: async id => metadata.get(id),
  addAttachment: async value => { metadata.set(value.id, value); return value; },
  deleteAttachment: async id => metadata.delete(id),
};
const auth = { authenticate: async () => ({ id: 'test', role: 'admin' }), requireRole: () => {}, isStationAllowed: (_user, id) => id === 'station-one' };
const api = createApi({ store, auth, attachmentStore: new FilesystemAttachmentStore({ root }), enforceStationScope: true });
const server = http.createServer(async (req, res) => { if (!await api.handle(req, res)) { res.writeHead(404); res.end(); } });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/api/v1/attachments/`;
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
try {
  for (const [suffix, kind] of [['original', 'vehicle-api/originals'], ['webp', 'vehicle-api/webp'], ['inspection', 'inspection/originals']]) {
    const id = `attachment-test-${suffix}`;
    const response = await fetch(base + id, { method: 'PUT', headers: { 'Content-Type': 'image/png', 'X-Station-Id': 'station-one', 'X-Round-Id': 'round-one', 'X-Attachment-Kind': kind }, body: png });
    assert.equal(response.status, 201, await response.text());
    assert.ok(metadata.get(id).storageName.includes(`/rounds/round-one/${kind}/`));
    assert.match(metadata.get(id).storageName, /^stations\/สถานีทดสอบ--station-one\//);
    const read = await fetch(base + id);
    assert.equal(read.status, 200);
    assert.deepEqual(Buffer.from(await read.arrayBuffer()), png);
    assert.equal((await fetch(base + id, { method: 'DELETE' })).status, 204);
    assert.equal((await fetch(base + id)).status, 404);
  }
  for (const [station, round, kind, status] of [['station-one', 'missing', 'inspection/originals', 400], ['station-other', 'round-one', 'inspection/originals', 403], ['station-one', 'round-one', '../escape', 400]]) {
    const response = await fetch(base + 'attachment-invalid-test', { method: 'PUT', headers: { 'Content-Type': 'image/png', 'X-Station-Id': station, 'X-Round-Id': round, 'X-Attachment-Kind': kind }, body: png });
    assert.equal(response.status, status);
  }
  const legacy = await fetch(base + 'attachment-legacy-test', { method: 'PUT', headers: { 'Content-Type': 'image/png', 'X-Station-Id': 'station-one' }, body: png });
  assert.equal(legacy.status, 201);
  assert.match(metadata.get('attachment-legacy-test').storageName, /^stations\/สถานีทดสอบ--station-one\/unassigned\//);
  console.log('test_attachment_organization_api: pass');
} finally {
  await new Promise(resolve => server.close(resolve));
  fs.rmSync(root, { recursive: true, force: true });
}
