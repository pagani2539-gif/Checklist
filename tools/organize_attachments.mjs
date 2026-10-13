import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { Pool } from 'pg';
import { FilesystemAttachmentStore } from '../server/attachment-store.mjs';
import { attachmentKey } from '../server/attachment-key.mjs';

const mode = process.argv[2] || 'plan';
if (!['plan', 'apply', 'verify', 'rollback', 'archive-legacy'].includes(mode)) throw new Error('Use plan, apply, verify, rollback or archive-legacy');
const output = path.resolve(process.argv[3] || '.scratch/attachment-organization/migration');
const selectedStation = process.argv[4] || '';
const root = path.resolve(process.env.CHECKLIST_ATTACHMENTS_DIR || 'data/attachments');
const store = new FilesystemAttachmentStore({ root });
const pool = new Pool({ connectionString: process.env.CHECKLIST_DATABASE_URL, max: 2 });
const digest = body => crypto.createHash('sha256').update(body).digest('hex');
await fs.mkdir(output, { recursive: true });
const manifestPath = path.join(output, 'manifest.json');
const journal = path.join(output, 'journal.jsonl');
const log = async value => fs.appendFile(journal, JSON.stringify({ at: new Date().toISOString(), ...value }) + '\n');
async function listFiles(directory, prefix = '') {
  const result = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const key = prefix + entry.name;
    if (entry.isSymbolicLink()) throw new Error(`Storage contains a symbolic link: ${key}`);
    if (entry.isDirectory()) result.push(...await listFiles(path.join(directory, entry.name), key + '/'));
    else if (entry.isFile()) result.push(key);
  }
  return result;
}

try {
  if (mode === 'plan') {
    const client = await pool.connect();
    let metadata, state;
    const historyRounds = [];
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      metadata = (await client.query('SELECT * FROM attachments ORDER BY id')).rows;
      state = (await client.query("SELECT version,payload FROM app_state WHERE id='global'")).rows[0];
      // Retained history may reference files no longer used by current rounds.
      const historical = await client.query("SELECT DISTINCT ON (md5((payload->'inspectionRounds')::text)) payload->'inspectionRounds' AS rounds FROM state_revisions WHERE payload ? 'inspectionRounds'");
      for (const row of historical.rows) historyRounds.push(...(row.rounds || []));
      await client.query('COMMIT');
    } finally { client.release(); }
    const known = new Set(metadata.map(row => row.id));
    const refs = new Map();
    const register = (value, round, location = '') => {
      if (!value || typeof value !== 'object') return;
      if (known.has(value.id)) {
        const kind = location.includes('vehicleEvidenceArchive') ? location.includes('renditions') ? 'vehicle-api/webp' : 'vehicle-api/originals' : 'inspection/originals';
        const entries = refs.get(value.id) || [];
        if (!entries.some(entry => entry.roundId === (round?.id || null) && entry.stationId === (round?.stationId || null) && entry.kind === kind)) entries.push({ roundId: round?.id || null, stationId: round?.stationId || null, createdAt: round?.createdAt || '', kind });
        refs.set(value.id, entries);
      }
      for (const [key, child] of Object.entries(value)) register(child, round, `${location}/${key}`);
    };
    for (const round of state?.payload?.inspectionRounds || []) register(round, round);
    for (const round of historyRounds) register(round, round);
    // Keep non-round references visible; never infer deletion from their absence.
    register(state?.payload, null);
    const entries = [];
    const exceptions = [];
    for (const row of metadata) {
      if (row.deleted_at) continue;
      let body;
      try { body = await store.get(row.storage_name); } catch { exceptions.push({ id: row.id, reason: 'missing-file', storageName: row.storage_name }); continue; }
      if (body.length !== Number(row.size) || digest(body) !== row.sha256) { exceptions.push({ id: row.id, reason: 'hash-or-size-mismatch' }); continue; }
      const uses = refs.get(row.id) || [];
      const owners = uses.filter(ref => ref.roundId && ref.stationId === row.station_id).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)) || a.roundId.localeCompare(b.roundId));
      const crossStation = uses.some(ref => ref.stationId && row.station_id && ref.stationId !== row.station_id);
      const owner = crossStation ? null : owners[0];
      const target = row.storage_name.includes('/') ? row.storage_name : attachmentKey({ stationId: row.station_id, roundId: owner?.roundId, kind: owner?.kind, createdAt: row.created_at, filename: path.basename(row.storage_name) });
      entries.push({ id: row.id, stationId: row.station_id, oldKey: row.storage_name, newKey: target, size: Number(row.size), sha256: row.sha256, roundIds: [...new Set(owners.map(ref => ref.roundId))], kind: owner?.kind || 'unassigned', crossStation });
    }
    const tracked = new Set(metadata.map(row => row.storage_name));
    const untrackedFiles = (await listFiles(root)).filter(key => !tracked.has(key));
    const byStation = {};
    for (const entry of entries) { const key = entry.stationId || 'unassigned'; const group = byStation[key] ||= { files: 0, bytes: 0 }; group.files++; group.bytes += entry.size; }
    const manifest = { createdAt: new Date().toISOString(), root, stateVersion: state?.version, metadataCount: metadata.length, deletedMetadataCount: metadata.filter(row => row.deleted_at).length, entries, exceptions, untrackedFiles, byStation, sharedFiles: entries.filter(row => row.roundIds.length > 1).length, unassignedFiles: entries.filter(row => !row.roundIds.length || row.crossStation).length, stateSha256: digest(Buffer.from(JSON.stringify(state?.payload))) };
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(JSON.stringify({ mode, manifestPath, files: entries.length, shared: manifest.sharedFiles, unassigned: manifest.unassignedFiles, exceptions: exceptions.length, untracked: untrackedFiles.length, byStation }));
  } else {
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    if (manifest.root !== root) throw new Error('Manifest storage root mismatch');
    if (['apply', 'rollback', 'archive-legacy'].includes(mode)) {
      // A stopped service is required: protects against upload/delete races.
      const base = process.env.CHECKLIST_MIGRATION_SERVICE_URL || 'http://127.0.0.1:5220';
      let reachable = false;
      try { await fetch(`${base}/health`, { signal: AbortSignal.timeout(1500) }); reachable = true; } catch {}
      if (reachable) throw new Error('Stop the application service before migrating');
      const backup = JSON.parse(await fs.readFile(path.join(output, 'backup.json'), 'utf8'));
      await fs.access(backup.database);
      await fs.access(backup.attachments);
      if (manifest.exceptions.length || manifest.untrackedFiles.length) throw new Error('Resolve inventory exceptions before migration');
      if (mode === 'apply') {
        const current = (await pool.query("SELECT payload FROM app_state WHERE id='global'")).rows[0];
        if (manifest.stateSha256 !== digest(Buffer.from(JSON.stringify(current.payload)))) throw new Error('State changed after inventory; create a fresh plan before applying');
      }
    }
    let processed = 0;
    const selected = selectedStation ? manifest.entries.filter(entry => entry.stationId === selectedStation) : manifest.entries;
    if (!selected.length) throw new Error('No matching attachments');
    for (const entry of selected) {
      const row = (await pool.query('SELECT storage_name,deleted_at FROM attachments WHERE id=$1', [entry.id])).rows[0];
      if (!row || row.deleted_at) throw new Error(`Attachment changed/deleted: ${entry.id}`);
      if (mode === 'apply') {
        if (![entry.oldKey, entry.newKey].includes(row.storage_name)) throw new Error(`Attachment path changed: ${entry.id}`);
        let target;
        try { target = await store.get(entry.newKey); } catch (error) { if (error.code !== 'ENOENT') throw error; }
        if (!target) { const body = await store.get(entry.oldKey); if (body.length !== entry.size || digest(body) !== entry.sha256) throw new Error(`Source mismatch: ${entry.id}`); await store.put(entry.newKey, body); target = await store.get(entry.newKey); }
        if (target.length !== entry.size || digest(target) !== entry.sha256) throw new Error(`Target mismatch: ${entry.id}`);
        await pool.query('UPDATE attachments SET storage_name=$1 WHERE id=$2 AND storage_name=$3 AND deleted_at IS NULL', [entry.newKey, entry.id, entry.oldKey]);
        await log({ mode, id: entry.id, oldKey: entry.oldKey, newKey: entry.newKey });
      } else if (mode === 'rollback') {
        if (row.storage_name !== entry.newKey && row.storage_name !== entry.oldKey) throw new Error(`Rollback conflict: ${entry.id}`);
        let original;
        try { original = await store.get(entry.oldKey); } catch (error) { if (error.code !== 'ENOENT') throw error; }
        if (!original) { original = await fs.readFile(path.join(output, 'legacy-flat', entry.oldKey)); if (digest(original) !== entry.sha256) throw new Error('Recovery hash mismatch'); await store.put(entry.oldKey, original); }
        if (digest(original) !== entry.sha256) throw new Error('Original hash mismatch');
        await pool.query('UPDATE attachments SET storage_name=$1 WHERE id=$2 AND storage_name=$3 AND deleted_at IS NULL', [entry.oldKey, entry.id, entry.newKey]);
        await log({ mode, id: entry.id });
      } else {
        if (row.storage_name !== entry.newKey) throw new Error(`Not migrated: ${entry.id}`);
        const target = await store.get(row.storage_name);
        if (target.length !== entry.size || digest(target) !== entry.sha256) throw new Error(`Verification failed: ${entry.id}`);
        if (mode === 'archive-legacy' && entry.oldKey !== entry.newKey) {
          const recovery = path.join(output, 'legacy-flat', entry.oldKey);
          await fs.mkdir(path.dirname(recovery), { recursive: true });
          let old;
          try { old = await store.get(entry.oldKey); } catch (error) { if (error.code !== 'ENOENT') throw error; }
          if (old) {
            if (digest(old) !== entry.sha256) throw new Error('Legacy hash mismatch');
            try { await fs.access(recovery); throw new Error('Recovery file already exists'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
            await fs.rename(store.filePath(entry.oldKey), recovery);
          } else if (digest(await fs.readFile(recovery)) !== entry.sha256) throw new Error('Recovery file missing or invalid');
          await log({ mode, id: entry.id, recovery });
        }
      }
      processed++;
      if (processed % 1000 === 0) console.log(JSON.stringify({ mode, processed }));
    }
    const current = (await pool.query("SELECT version,payload FROM app_state WHERE id='global'")).rows[0];
    const stateUnchanged = manifest.stateSha256 === digest(Buffer.from(JSON.stringify(current.payload)));
    const result = { mode, processed, stateUnchanged, stateVersion: current.version, completedAt: new Date().toISOString() };
    await fs.writeFile(path.join(output, `${mode}${selectedStation ? '-pilot' : ''}-result.json`), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  }
} finally { await pool.end(); }
