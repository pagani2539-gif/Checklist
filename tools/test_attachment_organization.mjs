import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FilesystemAttachmentStore } from '../server/attachment-store.mjs';
import { attachmentKey } from '../server/attachment-key.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'attachment-layout-'));
const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'attachment-outside-'));
try {
  const store = new FilesystemAttachmentStore({ root });
  const body = Buffer.from('original immutable evidence');
  const key = attachmentKey({ stationId: 'station-1', stationName: 'สถานี ทล.323', roundId: 'round-2', createdAt: '2025-12-31T18:00:00Z', kind: 'vehicle-api/webp', filename: 'unique.webp' });
  assert.equal(key, 'stations/สถานี-ทล-323--station-1/2026/rounds/round-2/vehicle-api/webp/unique.webp');
  for (const name of ['legacy.jpg', key]) {
    await store.put(name, body);
    assert.deepEqual(await store.get(name), body);
    await assert.rejects(() => store.put(name, Buffer.from('overwrite')));
    assert.deepEqual(await store.get(name), body);
    await store.delete(name);
    await assert.rejects(() => store.get(name));
  }
  for (const name of ['../outside.jpg', '/absolute.jpg', 'x/../../escape.jpg', 'x\\escape.jpg', 'C:/escape.jpg', 'x//a.jpg', 'x/./a.jpg']) assert.throws(() => store.filePath(name));
  fs.symlinkSync(outside, path.join(root, 'junction'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(() => store.put('junction/escape.jpg', body));
  assert.equal(fs.existsSync(path.join(outside, 'escape.jpg')), false);
  assert.throws(() => attachmentKey({ stationId: '../station', filename: 'a.jpg' }));
  assert.throws(() => attachmentKey({ stationId: 'station', kind: 'arbitrary', filename: 'a.jpg' }));
  assert.equal(attachmentKey({ stationId: 'station', createdAt: '2026-10-06', filename: 'a.jpg' }), 'stations/สถานี--station/unassigned/2026/a.jpg');
  assert.equal(attachmentKey({ stationId: 'station-id', stationName: 'สถานีตรวจสอบน้ำหนักย่อย ทล.323', filename: 'a.jpg' }).split('/')[1], 'สถานีตรวจสอบน้ำหนักย่อย-ทล-323--station-id');
  assert.ok(!attachmentKey({ stationId: 'station-id', stationName: 'CON', filename: 'a.jpg' }).split('/')[1].startsWith('CON--'), 'Windows device names receive a safe prefix');
  console.log('test_attachment_organization: pass');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(outside, { recursive: true, force: true });
}
