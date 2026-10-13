import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { Pool } from 'pg';
import { FilesystemAttachmentStore } from '../server/attachment-store.mjs';
import { stationFolderSegment } from '../server/attachment-key.mjs';
import { attachmentMetadataFingerprint, verifyFileIndex } from './backup-support.mjs';

const mode = process.argv[2] || 'plan';
const output = path.resolve(process.argv[3] || '.scratch/station-folder-migration');
const selectedStation = process.argv[4] || '';
const root = path.resolve(process.env.CHECKLIST_ATTACHMENTS_DIR || 'data/attachments');
const backupInfoPath = path.join(output, 'backup.json');
const manifestPath = path.join(output, 'manifest.json');
const journalPath = path.join(output, 'journal.jsonl');
const pool = new Pool({ connectionString: process.env.CHECKLIST_DATABASE_URL, max: 2 });
const store = new FilesystemAttachmentStore({ root });
const digest = value => crypto.createHash('sha256').update(value).digest('hex');

function pgRestoreBinary() {
  if (process.env.PG_RESTORE_BIN) return process.env.PG_RESTORE_BIN;
  const base = process.env.ProgramFiles || 'C:\\Program Files';
  const pgRoot = path.join(base, 'PostgreSQL');
  try {
    for (const version of fsSync.readdirSync(pgRoot).filter(value => /^\d+$/.test(value)).sort((a, b) => Number(b) - Number(a))) {
      const candidate = path.join(pgRoot, version, 'bin', 'pg_restore.exe');
      if (fsSync.existsSync(candidate)) return candidate;
    }
  } catch {}
  return 'pg_restore';
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}: ${stderr.trim()}`)));
  });
}

async function log(value) { await fs.appendFile(journalPath, `${JSON.stringify({ at: new Date().toISOString(), ...value })}\n`); }

async function deleteOldStorageName(name) {
  await store.delete(name);
  const stationsRoot = path.resolve(root, 'stations');
  let directory = path.dirname(store.filePath(name));
  while (directory === stationsRoot || directory.startsWith(`${stationsRoot}${path.sep}`)) {
    try { await fs.rmdir(directory); }
    catch (error) {
      if (error.code === 'ENOENT') { if (directory === stationsRoot) break; directory = path.dirname(directory); continue; }
      if (error.code === 'ENOTEMPTY' || error.code === 'EEXIST') break;
      throw error;
    }
    if (directory === stationsRoot) break;
    directory = path.dirname(directory);
  }
}

async function listFiles(directory, prefix = '') {
  const result = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw new Error(`Storage contains a symbolic link: ${relative}`);
    if (entry.isDirectory()) result.push(...await listFiles(path.join(directory, entry.name), relative));
    else if (entry.isFile()) result.push(relative);
  }
  return result;
}

function mapNewStorageName(oldName, folderName) {
  const value = String(oldName || '');
  const match = /^stations\/[^/]+\/(.+)$/.exec(value);
  if (match) return `stations/${folderName}/${match[1]}`;
  if (value.startsWith('unassigned/')) return value;
  return `stations/${folderName}/legacy/${path.posix.basename(value)}`;
}

async function loadStateSnapshot(client, { lock = false } = {}) {
  const result = await client.query(`SELECT version,payload FROM app_state WHERE id='global'${lock ? ' FOR UPDATE' : ''}`);
  const row = result.rows[0];
  if (!row) throw new Error('Global application state is missing');
  return { version: Number(row.version), payload: row.payload, stateSha256: digest(Buffer.from(JSON.stringify(row.payload))) };
}

async function makePlan() {
  const client = await pool.connect();
  let metadata, snapshot, profiles;
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    snapshot = await loadStateSnapshot(client);
    profiles = (snapshot.payload.stationProfiles || []).map(profile => ({ id: String(profile.id), stationCode: profile.stationCode || '', stationName: profile.stationName || '' }));
    metadata = (await client.query('SELECT id,storage_name,size,sha256,station_id,deleted_at FROM attachments ORDER BY id')).rows;
    await client.query('COMMIT');
  } finally { client.release(); }
  const profileById = new Map(profiles.map(profile => [profile.id, profile]));
  const entries = [];
  const exceptions = [];
  for (const row of metadata) {
    if (row.deleted_at) continue;
    if (!row.station_id || !profileById.has(String(row.station_id))) { exceptions.push({ id: row.id, reason: 'station-owner-missing' }); continue; }
    const profile = profileById.get(String(row.station_id));
    const oldKey = String(row.storage_name || '');
    const newKey = mapNewStorageName(oldKey, stationFolderSegment(profile.stationName, profile.id));
    let body;
    try { body = await store.get(oldKey); }
    catch { exceptions.push({ id: row.id, reason: 'missing-file', storageName: oldKey }); continue; }
    if (body.length !== Number(row.size) || digest(body) !== String(row.sha256)) { exceptions.push({ id: row.id, reason: 'hash-or-size-mismatch' }); continue; }
    entries.push({ id: row.id, stationId: profile.id, oldKey, newKey, size: Number(row.size), sha256: row.sha256 });
  }
  const tracked = new Set(metadata.filter(row => !row.deleted_at).map(row => String(row.storage_name)));
  const untrackedFiles = (await listFiles(root)).filter(name => !tracked.has(name));
  const byStation = Object.fromEntries(profiles.map(profile => [profile.id, { stationCode: profile.stationCode, stationName: profile.stationName, folderName: stationFolderSegment(profile.stationName, profile.id), files: 0, bytes: 0 }]));
  for (const entry of entries) { const group = byStation[entry.stationId]; group.files++; group.bytes += entry.size; }
  return { createdAt: new Date().toISOString(), root, stateVersion: snapshot.version, stateSha256: snapshot.stateSha256, attachmentMetadataSha256: attachmentMetadataFingerprint(metadata), metadataCount: metadata.length, activeCount: entries.length, deletedMetadataCount: metadata.filter(row => row.deleted_at).length, entries, exceptions, untrackedFiles, byStation };
}

async function assertStoppedAndBackedUp(manifest) {
  const base = process.env.CHECKLIST_MIGRATION_SERVICE_URL || 'http://127.0.0.1:5220';
  try { await fetch(`${base}/health`, { signal: AbortSignal.timeout(1500) }); throw new Error('Stop the application service before renaming live attachment folders'); }
  catch (error) { if (error.message.startsWith('Stop the application')) throw error; }
  if (manifest.exceptions.length || manifest.untrackedFiles.length) throw new Error('Resolve missing files, hash errors, or untracked files before migration');
  const backup = JSON.parse(await fs.readFile(backupInfoPath, 'utf8'));
  const dump = path.resolve(backup.database);
  const backupAttachments = path.resolve(backup.attachments);
  const dumpInfo = await fs.stat(dump);
  if (!dumpInfo.size) throw new Error('Database backup is missing or empty');
  await fs.access(backupAttachments);
  await run(pgRestoreBinary(), ['--list', dump]);
  const backupManifest = JSON.parse(await fs.readFile(path.join(path.dirname(dump), 'manifest.json'), 'utf8'));
  if (Number(backupManifest.stateVersion) !== Number(manifest.stateVersion) || backupManifest.attachmentMetadataSha256 !== manifest.attachmentMetadataSha256) throw new Error('The full backup does not match the attachment inventory; create a fresh plan after the backup');
  const indexFile = backupManifest.attachmentsIndex ? path.join(path.dirname(dump), backupManifest.attachmentsIndex) : null;
  if (!indexFile) throw new Error('The selected backup has no attachment integrity index');
  const index = JSON.parse(await fs.readFile(indexFile, 'utf8'));
  await verifyFileIndex(backupAttachments, index);
}

async function applyPlan(manifest, stationId = '') {
  await assertStoppedAndBackedUp(manifest);
  const selected = manifest.entries.filter(entry => !stationId || entry.stationId === stationId);
  if (stationId && !Object.hasOwn(manifest.byStation, stationId)) throw new Error(`Station is not in the migration plan: ${stationId}`);
  if (!selected.length && stationId && manifest.byStation[stationId].files) throw new Error('No matching attachment rows in migration manifest');
  const client = await pool.connect();
  const created = new Set();
  const oldNames = new Set();
  let committed = false;
  try {
    await client.query('BEGIN');
    const snapshot = await loadStateSnapshot(client, { lock: true });
    if (snapshot.version !== manifest.stateVersion || snapshot.stateSha256 !== manifest.stateSha256) throw new Error('Central state changed after the plan; create a fresh plan and backup before applying');
    const currentRows = (await client.query('SELECT id,storage_name,size,sha256,station_id FROM attachments WHERE deleted_at IS NULL ORDER BY id')).rows;
    if (currentRows.length !== manifest.entries.length) throw new Error('Attachment metadata changed after planning; create a fresh plan and backup before applying');
    const plannedById = new Map(manifest.entries.map(entry => [entry.id, entry]));
    for (const row of currentRows) {
      const entry = plannedById.get(row.id);
      if (!entry || ![entry.oldKey, entry.newKey].includes(row.storage_name) || Number(row.size) !== entry.size || row.sha256 !== entry.sha256 || String(row.station_id || '') !== entry.stationId) throw new Error(`Attachment inventory changed after planning: ${row.id}`);
    }
    for (const entry of selected) {
      const result = await client.query('SELECT id,storage_name,size,sha256,deleted_at FROM attachments WHERE id=$1 FOR UPDATE', [entry.id]);
      const row = result.rows[0];
      if (!row || row.deleted_at || Number(row.size) !== entry.size || String(row.sha256) !== entry.sha256) throw new Error(`Attachment changed after planning: ${entry.id}`);
      if (row.storage_name === entry.newKey) continue;
      if (row.storage_name !== entry.oldKey) throw new Error(`Attachment path changed after planning: ${entry.id}`);
      const source = await store.get(entry.oldKey);
      if (source.length !== entry.size || digest(source) !== entry.sha256) throw new Error(`Source bytes changed after planning: ${entry.id}`);
      let target, existed = true;
      try { target = await store.get(entry.newKey); }
      catch (error) { if (error.code !== 'ENOENT') throw error; existed = false; }
      if (existed) {
        if (target.length !== entry.size || digest(target) !== entry.sha256) throw new Error(`Destination already contains different data: ${entry.newKey}`);
      } else {
        await store.put(entry.newKey, source);
        created.add(entry.newKey);
        target = await store.get(entry.newKey);
        if (target.length !== entry.size || digest(target) !== entry.sha256) throw new Error(`Copied attachment failed verification: ${entry.id}`);
      }
      const updated = await client.query('UPDATE attachments SET storage_name=$1 WHERE id=$2 AND storage_name=$3 AND deleted_at IS NULL', [entry.newKey, entry.id, entry.oldKey]);
      if (updated.rowCount !== 1) throw new Error(`Attachment metadata changed during migration: ${entry.id}`);
      oldNames.add(entry.oldKey);
      await log({ mode: 'apply', stationId: entry.stationId, id: entry.id, oldKey: entry.oldKey, newKey: entry.newKey });
    }
    await client.query('COMMIT');
    committed = true;
  } catch (error) {
    if (!committed) {
      await client.query('ROLLBACK');
      await Promise.all([...created].map(name => store.delete(name).catch(() => {})));
    }
    throw error;
  } finally { client.release(); }
  for (const name of oldNames) {
    try { await deleteOldStorageName(name); }
    catch (error) { console.warn(JSON.stringify({ event: 'old_station_attachment_path_cleanup_failed', storageName: name, message: error.message })); }
  }
  return { applied: selected.length, stationId: stationId || null, oldCopiesRemoved: oldNames.size };
}

async function verifyPlan(manifest, stationId = '') {
  const selected = manifest.entries.filter(entry => !stationId || entry.stationId === stationId);
  const client = await pool.connect();
  try {
    const snapshot = await loadStateSnapshot(client);
    if (snapshot.version !== manifest.stateVersion || snapshot.stateSha256 !== manifest.stateSha256) throw new Error('Central state changed; file migration verification does not overwrite state');
    for (const entry of selected) {
      const result = await client.query('SELECT storage_name,size,sha256,deleted_at FROM attachments WHERE id=$1', [entry.id]);
      const row = result.rows[0];
      if (!row || row.deleted_at || row.storage_name !== entry.newKey || Number(row.size) !== entry.size || row.sha256 !== entry.sha256) throw new Error(`Attachment metadata is not migrated: ${entry.id}`);
      const body = await store.get(entry.newKey);
      if (body.length !== entry.size || digest(body) !== entry.sha256) throw new Error(`Migrated attachment failed verification: ${entry.id}`);
    }
    return { verified: selected.length, stationId: stationId || null, stateVersion: snapshot.version, stateUnchanged: true };
  } finally { client.release(); }
}

try {
  if (!['plan', 'apply', 'verify'].includes(mode)) throw new Error('Use plan, apply or verify');
  await fs.mkdir(output, { recursive: true });
  if (mode === 'plan') {
    const manifest = await makePlan();
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(JSON.stringify({ mode, manifestPath, stateVersion: manifest.stateVersion, activeFiles: manifest.activeCount, exceptions: manifest.exceptions.length, untracked: manifest.untrackedFiles.length, byStation: manifest.byStation }));
  } else {
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    if (manifest.root !== root) throw new Error('Manifest storage root mismatch');
    if (mode === 'apply') console.log(JSON.stringify({ mode, ...(await applyPlan(manifest, selectedStation)) }));
    else console.log(JSON.stringify({ mode, ...(await verifyPlan(manifest, selectedStation)) }));
  }
} finally { await pool.end(); }
