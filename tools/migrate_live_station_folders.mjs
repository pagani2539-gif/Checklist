import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { FilesystemAttachmentStore } from '../server/attachment-store.mjs';
import { prepareStationAttachmentRenames } from '../server/station-attachment-migration.mjs';
import { stationFolderSegment } from '../server/attachment-key.mjs';

const mode = process.argv[2] || 'plan';
const selectedStation = process.argv[3] || '';
if (!['plan', 'apply', 'verify'].includes(mode)) throw new Error('Use plan, apply [station-id], or verify');
const root = path.resolve(process.env.CHECKLIST_ATTACHMENTS_DIR || 'data/attachments');
const output = path.resolve('.scratch/station-folder-migration/live');
const planPath = path.join(output, 'plan.json');
const resultPath = path.join(output, 'apply-results.json');
const store = new FilesystemAttachmentStore({ root });
const pool = new Pool({ connectionString: process.env.CHECKLIST_DATABASE_URL, max: 2 });
const digest = value => crypto.createHash('sha256').update(value).digest('hex');

function desiredKey(storageName, stationId, folder) {
  const value = String(storageName || '');
  const match = /^stations\/[^/]+\/(.+)$/.exec(value);
  if (match) return `stations/${folder}/${match[1]}`;
  if (value.startsWith('unassigned/')) return value;
  return `stations/${folder}/legacy/${path.posix.basename(value)}`;
}

async function readState(client) {
  const row = (await client.query("SELECT version,payload FROM app_state WHERE id='global'")).rows[0];
  if (!row) throw new Error('Global application state is missing');
  return { version: Number(row.version), payload: row.payload, sha256: digest(Buffer.from(JSON.stringify(row.payload))) };
}

async function readPlan() {
  return JSON.parse(await fs.readFile(planPath, 'utf8'));
}

async function createPlan() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const state = await readState(client);
    const profiles = (state.payload.stationProfiles || []).map(profile => ({
      id: String(profile.id), stationCode: profile.stationCode || '', stationName: profile.stationName || '',
      targetFolder: stationFolderSegment(profile.stationName, String(profile.id)),
    }));
    const byId = new Map(profiles.map(profile => [profile.id, profile]));
    const rows = (await client.query('SELECT id,station_id,storage_name,size,sha256 FROM attachments WHERE deleted_at IS NULL AND station_id IS NOT NULL ORDER BY station_id,id')).rows;
    const entries = [];
    const destinations = new Map();
    for (const row of rows) {
      const stationId = String(row.station_id);
      const profile = byId.get(stationId);
      if (!profile) throw new Error(`Active attachment ${row.id} belongs to unknown station ${stationId}`);
      const newKey = desiredKey(row.storage_name, stationId, profile.targetFolder);
      const previous = destinations.get(newKey);
      if (previous && (previous.sha256 !== row.sha256 || Number(previous.size) !== Number(row.size))) throw new Error(`Two attachments with different contents map to ${newKey}`);
      destinations.set(newKey, { id: row.id, sha256: row.sha256, size: Number(row.size) });
      entries.push({ id: String(row.id), stationId, oldKey: String(row.storage_name), newKey, size: Number(row.size), sha256: String(row.sha256) });
    }
    await client.query('COMMIT');
    const groups = profiles.map(profile => {
      const items = entries.filter(entry => entry.stationId === profile.id);
      return { ...profile, attachmentCount: items.length, attachmentBytes: items.reduce((sum, entry) => sum + entry.size, 0), alreadyNamedCount: items.filter(entry => entry.oldKey === entry.newKey).length };
    });
    const plan = {
      version: 1, createdAt: new Date().toISOString(), stateVersion: state.version, stateSha256: state.sha256,
      attachmentRoot: root, stationCount: profiles.length, activeAttachmentCount: entries.length,
      activeAttachmentBytes: entries.reduce((sum, entry) => sum + entry.size, 0), groups, entries,
    };
    await fs.mkdir(output, { recursive: true });
    await fs.writeFile(planPath, JSON.stringify(plan, null, 2));
    console.log(JSON.stringify({ mode: 'plan', stateVersion: plan.stateVersion, stationCount: plan.stationCount, activeAttachmentCount: plan.activeAttachmentCount, activeAttachmentBytes: plan.activeAttachmentBytes, groups: groups.map(({ id, stationCode, stationName, targetFolder, attachmentCount, attachmentBytes, alreadyNamedCount }) => ({ id, stationCode, stationName, targetFolder, attachmentCount, attachmentBytes, alreadyNamedCount })) }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); }
}

async function applyPlan() {
  const plan = await readPlan();
  const client = await pool.connect();
  let state;
  try { state = await readState(client); }
  finally { client.release(); }
  if (state.version !== plan.stateVersion || state.sha256 !== plan.stateSha256) throw new Error('Application state changed since the migration plan was created');
  const targets = plan.groups.filter(profile => profile.attachmentCount > 0 && (!selectedStation || profile.id === selectedStation));
  if (selectedStation && !plan.groups.some(profile => profile.id === selectedStation)) throw new Error(`Unknown station in migration plan: ${selectedStation}`);
  if (!targets.length) throw new Error('No station attachments selected');
  const existing = await fs.readFile(resultPath, 'utf8').then(value => JSON.parse(value)).catch(error => error.code === 'ENOENT' ? { planCreatedAt: plan.createdAt, completed: [] } : Promise.reject(error));
  const completed = new Map(existing.completed.map(item => [item.stationId, item]));
  for (const profile of targets) {
    if (completed.has(profile.id)) continue;
    const client = await pool.connect();
    let prepared;
    let committed = false;
    try {
      await client.query('BEGIN');
      const syntheticOldName = `__codex_migration_source__${profile.id}`;
      if (stationFolderSegment(syntheticOldName, profile.id) === profile.targetFolder) throw new Error('Synthetic old station name unexpectedly matches target folder');
      prepared = await prepareStationAttachmentRenames(
        client,
        { stationProfiles: [{ id: profile.id, stationName: syntheticOldName }] },
        { stationProfiles: [{ id: profile.id, stationName: profile.stationName }] },
        store,
      );
      await client.query('COMMIT');
      committed = true;
      await prepared.afterCommit();
      const current = (await client.query('SELECT id,storage_name,size,sha256 FROM attachments WHERE station_id=$1 AND deleted_at IS NULL ORDER BY id', [profile.id])).rows;
      const expected = new Map(plan.entries.filter(entry => entry.stationId === profile.id).map(entry => [entry.id, entry]));
      if (current.length !== expected.size) throw new Error(`Attachment count changed during migration for ${profile.id}`);
      for (const row of current) {
        const item = expected.get(String(row.id));
        if (!item || row.storage_name !== item.newKey || Number(row.size) !== item.size || row.sha256 !== item.sha256) throw new Error(`Attachment metadata verification failed for ${row.id}`);
      }
      const result = { stationId: profile.id, stationName: profile.stationName, targetFolder: profile.targetFolder, attachmentCount: current.length, attachmentBytes: profile.attachmentBytes, verifiedByCopyHash: true, completedAt: new Date().toISOString() };
      completed.set(profile.id, result);
      await fs.writeFile(resultPath, JSON.stringify({ planCreatedAt: plan.createdAt, completed: [...completed.values()] }, null, 2));
      console.log(JSON.stringify({ mode: selectedStation ? 'pilot' : 'apply', ...result }));
    } catch (error) {
      if (!committed) {
        await client.query('ROLLBACK').catch(() => {});
        await prepared?.afterRollback().catch(() => {});
      }
      throw error;
    } finally { client.release(); }
  }
}

async function verifyPlan() {
  const plan = await readPlan();
  const state = await readState(pool);
  if (state.version !== plan.stateVersion || state.sha256 !== plan.stateSha256) throw new Error('Application state changed during attachment migration');
  const current = (await pool.query('SELECT id,station_id,storage_name,size,sha256 FROM attachments WHERE deleted_at IS NULL AND station_id IS NOT NULL ORDER BY station_id,id')).rows;
  const expected = new Map(plan.entries.map(entry => [entry.id, entry]));
  if (current.length !== plan.activeAttachmentCount) throw new Error(`Active attachment count changed: expected ${plan.activeAttachmentCount}, got ${current.length}`);
  let bytes = 0;
  const folders = new Map();
  for (const row of current) {
    const entry = expected.get(String(row.id));
    if (!entry || row.storage_name !== entry.newKey || Number(row.size) !== entry.size || row.sha256 !== entry.sha256) throw new Error(`Database reference verification failed for ${row.id}`);
    const body = await store.get(row.storage_name);
    if (body.length !== entry.size || digest(body) !== entry.sha256) throw new Error(`File hash verification failed for ${row.id}`);
    bytes += body.length;
    const folder = String(row.storage_name).split('/')[1] || '';
    folders.set(row.station_id, [...(folders.get(row.station_id) || []), folder]);
  }
  const folderMismatches = plan.groups.flatMap(profile => {
    const actual = [...new Set(folders.get(profile.id) || [])];
    return actual.filter(folder => folder !== profile.targetFolder).map(folder => ({ stationId: profile.id, folder }));
  });
  if (folderMismatches.length) throw new Error(`Active files remain in old folders: ${JSON.stringify(folderMismatches)}`);
  const deleted = await pool.query('SELECT count(*)::int AS count,coalesce(sum(size),0)::bigint AS bytes FROM attachments WHERE deleted_at IS NOT NULL AND station_id IS NOT NULL');
  console.log(JSON.stringify({ mode: 'verify', stateUnchanged: true, stationCount: plan.stationCount, activeAttachmentCount: current.length, activeAttachmentBytesVerified: bytes, allActiveSha256Verified: true, legacyActivePaths: 0, deletedMetadataPreserved: Number(deleted.rows[0].count), deletedMetadataBytes: String(deleted.rows[0].bytes) }, null, 2));
}

try {
  if (mode === 'plan') await createPlan();
  else if (mode === 'apply') await applyPlan();
  else await verifyPlan();
} finally { await pool.end(); }
