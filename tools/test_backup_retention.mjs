import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BACKUP_POLICY_VERSION, BACKUP_RETENTION_GROUP, createBackupTransaction } from './backup-support.mjs';
import { restoreBackupAttachments } from './restore_backup_attachments.mjs';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'checklist-backup-retention-'));
const backupRoot = path.join(root, 'backups');
const legacyRoot = path.join(backupRoot, 'legacy-set');
const incompleteRoot = path.join(backupRoot, 'incomplete-set');
await fs.mkdir(legacyRoot, { recursive: true });
await fs.writeFile(path.join(legacyRoot, 'keep.txt'), 'old backup');
await fs.mkdir(incompleteRoot, { recursive: true });
await fs.writeFile(path.join(incompleteRoot, 'partial.txt'), 'incomplete');

async function makeExistingManaged(name, createdAt) {
  const directory = path.join(backupRoot, name);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, 'manifest.json'), JSON.stringify({ backupPolicyVersion: BACKUP_POLICY_VERSION, retentionGroup: BACKUP_RETENTION_GROUP, status: 'complete', createdAt }));
}

const originalSets = ['managed-1', 'managed-2', 'managed-3'];
for (let index = 0; index < originalSets.length; index++) await makeExistingManaged(originalSets[index], `2026-01-0${index + 1}T00:00:00.000Z`);
let counter = 0;
function transactionOptions(createdAt, { failVerify = false } = {}) {
  let verifies = 0;
  return {
    backupRoot,
    createdAt: new Date(createdAt),
    writeDatabaseDump: databasePath => fs.writeFile(databasePath, 'valid test dump'),
    verifyDatabaseDump: async databasePath => {
      verifies++;
      assert.equal(await fs.readFile(databasePath, 'utf8'), 'valid test dump');
      if (failVerify && verifies === 2) throw new Error('simulated final verification failure');
    },
    copyAttachments: async destination => {
      await fs.mkdir(path.join(destination, 'stations', 'สถานีทดสอบ--station-one'), { recursive: true });
      await fs.writeFile(path.join(destination, 'stations', 'สถานีทดสอบ--station-one', 'evidence.txt'), `evidence-${++counter}`);
    },
    prepareAttachments: async () => [{ stationId: 'station-one', stationName: 'สถานีทดสอบ', backupFolder: 'สถานีทดสอบ--station-one', databaseStoragePrefix: 'stations/station-one/' }],
  };
}

try {
  await assert.rejects(() => createBackupTransaction(transactionOptions('2026-02-01T00:00:00.000Z', { failVerify: true })), /simulated final verification failure/);
  for (const name of originalSets) await fs.access(path.join(backupRoot, name));
  assert.deepEqual((await fs.readdir(backupRoot)).filter(name => name.includes('.partial-')), [], 'failed attempts leave no partial backup directory');

  let latest;
  for (let index = 1; index <= 4; index++) latest = await createBackupTransaction(transactionOptions(`2026-03-0${index}T00:00:00.000Z`));
  assert.equal(latest.retention.retained.length, 3);
  assert.equal(latest.retention.removed.length, 1);
  const sets = await fs.readdir(backupRoot);
  assert.equal(sets.filter(name => name.startsWith('2026-03-')).length, 3, 'the fourth new backup removes the oldest new backup');
  for (const name of originalSets) assert.equal(sets.includes(name), false, 'old managed test sets are pruned only after a complete new set exists');
  await fs.access(legacyRoot);
  await fs.access(incompleteRoot);
  assert.equal(sets.includes('legacy-set'), true, 'legacy backups are not included in retention');
  assert.equal(sets.includes('incomplete-set'), true, 'incomplete legacy directories are not included in retention');

  const restoreRoot = path.join(root, 'restored');
  const restored = await restoreBackupAttachments(latest.backupDir, restoreRoot);
  assert.equal(restored.restored, true);
  assert.equal(await fs.readFile(path.join(restoreRoot, 'stations', 'station-one', 'evidence.txt'), 'utf8'), 'evidence-5');

  const oldFlatBackup = path.join(backupRoot, 'old-flat-backup');
  const oldFlatAttachments = path.join(oldFlatBackup, 'attachments');
  await fs.mkdir(oldFlatAttachments, { recursive: true });
  await fs.writeFile(path.join(oldFlatBackup, 'manifest.json'), JSON.stringify({ createdAt: '2025-01-01T00:00:00.000Z', database: 'checklist.dump', attachmentBackend: 'filesystem' }));
  await fs.writeFile(path.join(oldFlatAttachments, 'legacy-attachment.jpg'), 'legacy flat file');
  const oldFlatRestore = await restoreBackupAttachments(oldFlatBackup, path.join(root, 'restored-old-flat'));
  assert.equal(oldFlatRestore.files, 1, 'legacy backups without an index can still restore their original flat keys');
  assert.equal(await fs.readFile(path.join(root, 'restored-old-flat', 'legacy-attachment.jpg'), 'utf8'), 'legacy flat file');
  console.log('test_backup_retention: pass');
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
