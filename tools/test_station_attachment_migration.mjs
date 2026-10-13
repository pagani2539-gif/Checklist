import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { FilesystemAttachmentStore } from '../server/attachment-store.mjs';
import { stationFolderSegment } from '../server/attachment-key.mjs';
import { prepareStationAttachmentRenames } from '../server/station-attachment-migration.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'station-folder-rename-'));
const store = new FilesystemAttachmentStore({ root });
const oldProfile = { id: 'station-one', stationName: 'ชื่อเดิม' };
const nextProfile = { ...oldProfile, stationName: 'สถานีใหม่ ทล.9' };
const id = 'attachment-12345678';
const oldName = `stations/${stationFolderSegment(oldProfile.stationName, oldProfile.id)}/2026/unassigned/file.jpg`;
const body = Buffer.from('original evidence bytes');
const sha256 = crypto.createHash('sha256').update(body).digest('hex');
await store.put(oldName, body);

function mockClient(row = { id, storage_name: oldName, size: body.length, sha256, content_type: 'image/jpeg' }) {
  const updates = [];
  return {
    updates,
    async query(sql, values) {
      if (sql.startsWith('SELECT id,storage_name')) return { rows: row ? [row] : [] };
      if (sql.startsWith('UPDATE attachments')) { updates.push(values); return { rowCount: 1 }; }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
}

try {
  const client = mockClient();
  const lifecycle = await prepareStationAttachmentRenames(client, { stationProfiles: [oldProfile] }, { stationProfiles: [nextProfile] }, store);
  const newName = `stations/${stationFolderSegment(nextProfile.stationName, nextProfile.id)}/2026/unassigned/file.jpg`;
  assert.equal(client.updates.length, 1);
  assert.deepEqual(await store.get(newName), body);
  assert.deepEqual(await store.get(oldName), body, 'the old bytes remain until the metadata transaction commits');
  await lifecycle.afterCommit();
  await assert.rejects(() => store.get(oldName));
  assert.deepEqual(await store.get(newName), body);

  const brokenOld = `stations/${stationFolderSegment(oldProfile.stationName, oldProfile.id)}/2026/unassigned/bad.jpg`;
  await store.put(brokenOld, body);
  const rollbackClient = mockClient({ id: 'attachment-bad-1234', storage_name: brokenOld, size: body.length, sha256: '0'.repeat(64), content_type: 'image/jpeg' });
  await assert.rejects(() => prepareStationAttachmentRenames(rollbackClient, { stationProfiles: [oldProfile] }, { stationProfiles: [nextProfile] }, store), /SHA-256 verification/);
  await assert.deepEqual(await store.get(brokenOld), body, 'a failed verification leaves the previous attachment untouched');
  assert.equal(rollbackClient.updates.length, 0);
  console.log('test_station_attachment_migration: pass');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
