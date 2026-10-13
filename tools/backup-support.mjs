import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const BACKUP_POLICY_VERSION = 1;
export const BACKUP_RETENTION_GROUP = 'checklist-rolling-v1';

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

export function attachmentMetadataFingerprint(rows = []) {
  const normalized = [...rows].sort((a, b) => String(a.id).localeCompare(String(b.id))).map(row => ({
    id: String(row.id),
    storage_name: String(row.storage_name || ''),
    size: String(row.size ?? ''),
    sha256: String(row.sha256 || ''),
    station_id: row.station_id == null ? null : String(row.station_id),
    deleted_at: row.deleted_at ? new Date(row.deleted_at).toISOString() : null,
  }));
  return sha256(Buffer.from(JSON.stringify(normalized)));
}

export async function buildFileIndex(root) {
  const files = [];
  async function visit(directory, prefix = '') {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const fullPath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Backup contains a symbolic link: ${relativePath}`);
      if (entry.isDirectory()) await visit(fullPath, relativePath);
      else if (entry.isFile()) {
        const body = await fs.readFile(fullPath);
        files.push({ path: relativePath, size: body.length, sha256: sha256(body) });
      }
    }
  }
  await visit(root);
  return { files, fileCount: files.length, totalBytes: files.reduce((sum, file) => sum + file.size, 0) };
}

export async function verifyFileIndex(root, index) {
  const actual = await buildFileIndex(root);
  if (actual.fileCount !== index?.fileCount || actual.totalBytes !== index?.totalBytes || actual.files.length !== index?.files?.length) {
    throw new Error(`Backup file inventory differs: expected ${index?.fileCount ?? 0} files/${index?.totalBytes ?? 0} bytes, found ${actual.fileCount}/${actual.totalBytes}`);
  }
  const expectedByPath = new Map(index.files.map(file => [file.path, file]));
  for (const file of actual.files) {
    const expected = expectedByPath.get(file.path);
    if (!expected || expected.size !== file.size || expected.sha256 !== file.sha256) throw new Error(`Backup file verification failed: ${file.path}`);
  }
  return actual;
}

export async function pruneManagedBackups(backupRoot, keep = 3) {
  const entries = await fs.readdir(backupRoot, { withFileTypes: true });
  const candidates = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const directory = path.join(backupRoot, entry.name);
    let manifest;
    try { manifest = JSON.parse(await fs.readFile(path.join(directory, 'manifest.json'), 'utf8')); } catch { continue; }
    if (manifest.backupPolicyVersion !== BACKUP_POLICY_VERSION || manifest.retentionGroup !== BACKUP_RETENTION_GROUP || manifest.status !== 'complete') continue;
    candidates.push({ directory, name: entry.name, createdAt: String(manifest.createdAt || '') });
  }
  candidates.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.name.localeCompare(a.name));
  const removed = [];
  for (const entry of candidates.slice(keep)) {
    await fs.rm(entry.directory, { recursive: true, force: false });
    removed.push(entry.name);
  }
  return { retained: candidates.slice(0, keep).map(entry => entry.name), removed };
}

export async function createBackupTransaction({
  backupRoot,
  createdAt = new Date(),
  attachmentBackend = 'filesystem',
  writeDatabaseDump,
  verifyDatabaseDump,
  copyAttachments,
  prepareAttachments,
  verifyBeforeCommit,
  extraManifest = {},
  keep = 3,
}) {
  if (typeof writeDatabaseDump !== 'function' || typeof verifyDatabaseDump !== 'function') throw new Error('Database backup and validation functions are required');
  const timestamp = createdAt.toISOString().replace(/[:.]/g, '-');
  const destination = path.join(path.resolve(backupRoot), timestamp);
  const staging = path.join(path.resolve(backupRoot), `.${timestamp}.partial-${process.pid}-${crypto.randomUUID()}`);
  await fs.mkdir(path.resolve(backupRoot), { recursive: true });
  try { await fs.access(destination); throw new Error(`Backup destination already exists: ${destination}`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await fs.mkdir(staging, { recursive: false });
  let committed = false;
  try {
    const databasePath = path.join(staging, 'checklist.dump');
    await writeDatabaseDump(databasePath);
    const databaseStat = await fs.stat(databasePath);
    if (!databaseStat.isFile() || databaseStat.size === 0) throw new Error('Database dump is missing or empty');
    await verifyDatabaseDump(databasePath);

    let attachmentRestoreMap = [];
    let attachmentIndex = null;
    if (String(attachmentBackend).toLowerCase() === 'filesystem') {
      if (typeof copyAttachments !== 'function') throw new Error('Attachment copy function is required for filesystem backups');
      const attachmentsPath = path.join(staging, 'attachments');
      await copyAttachments(attachmentsPath);
      attachmentRestoreMap = await prepareAttachments?.(attachmentsPath) || [];
      attachmentIndex = await buildFileIndex(attachmentsPath);
      await fs.writeFile(path.join(staging, 'attachments-index.json'), JSON.stringify(attachmentIndex));
      await verifyFileIndex(attachmentsPath, attachmentIndex);
    }

    const additionalManifest = typeof extraManifest === 'function' ? await extraManifest({ attachmentRestoreMap, attachmentIndex }) : extraManifest;
    const manifest = {
      createdAt: createdAt.toISOString(),
      database: 'checklist.dump',
      attachmentBackend,
      rpoTarget: '1h',
      restoreTarget: '4h',
      backupPolicyVersion: BACKUP_POLICY_VERSION,
      retentionGroup: BACKUP_RETENTION_GROUP,
      status: 'complete',
      ...(attachmentIndex ? { attachments: 'attachments', attachmentsIndex: 'attachments-index.json', attachmentRestoreMap, attachmentFileCount: attachmentIndex.fileCount, attachmentBytes: attachmentIndex.totalBytes } : {}),
      ...additionalManifest,
    };
    await fs.writeFile(path.join(staging, 'manifest.json'), JSON.stringify(manifest, null, 2));
    await verifyDatabaseDump(databasePath);
    if (attachmentIndex) await verifyFileIndex(path.join(staging, 'attachments'), attachmentIndex);
    await verifyBeforeCommit?.({ manifest, staging, attachmentIndex, attachmentRestoreMap });

    await fs.rename(staging, destination);
    committed = true;
    let retention;
    try { retention = await pruneManagedBackups(path.resolve(backupRoot), keep); }
    catch (error) { retention = { error: error.message }; }
    return { ok: true, backupDir: destination, manifest, retention };
  } catch (error) {
    if (!committed) await fs.rm(staging, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}
