import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

function resolveBackupPath(backupDir, relativePath, label) {
  assert.equal(typeof relativePath, 'string', `${label} path is missing from the backup manifest`);
  assert(relativePath.trim(), `${label} path is empty in the backup manifest`);
  assert(!path.isAbsolute(relativePath), `${label} path must be relative to the backup directory`);
  const root = path.resolve(backupDir);
  const resolved = path.resolve(root, relativePath);
  const relative = path.relative(root, resolved);
  assert(relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative),
    `${label} path must stay inside the backup directory`);
  return resolved;
}

export async function verifyAcDcMigrationBackup(backupDir, expectedStateVersion) {
  const root = path.resolve(backupDir);
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'manifest.json'), 'utf8'));
  assert.equal(manifest.status, 'complete', 'backup must be complete');
  assert.equal(Number(manifest.stateVersion), Number(expectedStateVersion), 'backup state version does not match expected version');

  const databasePath = resolveBackupPath(root, manifest.database, 'database');
  const attachmentsPath = resolveBackupPath(root, manifest.attachments || manifest.objects, 'attachments');
  const databaseStat = await fs.stat(databasePath);
  const attachmentsStat = await fs.stat(attachmentsPath);
  assert(databaseStat.isFile() && databaseStat.size > 0, 'database backup is empty');
  assert(attachmentsStat.isDirectory(), 'attachments backup is missing');

  const verification = JSON.parse(await fs.readFile(path.join(root, 'ac-dc-backup-check.json'), 'utf8'));
  assert.equal(Number(verification.stateVersion), Number(expectedStateVersion), 'backup verification version does not match expected version');
  assert.equal(Number(verification.attachmentFileCount), Number(manifest.attachmentFileCount), 'backup attachment count changed after verification');
  assert(Number(verification.attachmentFileCount) > 0, 'attachment backup verification is empty');
  assert.equal(Number(verification.databaseBytes), databaseStat.size, 'database backup changed after verification');

  return { manifest, verification, databasePath, attachmentsPath };
}
