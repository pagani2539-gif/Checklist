import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { stationAttachmentPrefix, stationFolderSegment } from './attachment-key.mjs';

const digest = body => crypto.createHash('sha256').update(body).digest('hex');

function destinationStorageName(storageName, stationId, folderName) {
  const value = String(storageName || '');
  const match = /^stations\/[^/]+\/(.+)$/.exec(value);
  if (match) return `stations/${folderName}/${match[1]}`;
  if (value.startsWith('unassigned/')) return value;
  return `stations/${folderName}/legacy/${path.posix.basename(value)}`;
}

function missingFile(error) {
  return error?.code === 'ENOENT' || error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404;
}

async function removeEmptyStationDirectories(attachmentStore, storageName) {
  if (attachmentStore.kind !== 'filesystem' || !attachmentStore.root) return;
  const root = path.resolve(attachmentStore.root, 'stations');
  let directory = path.dirname(attachmentStore.filePath(storageName));
  while (directory === root || directory.startsWith(`${root}${path.sep}`)) {
    try { await fs.rmdir(directory); } catch (error) { if (error.code !== 'ENOENT' && error.code !== 'ENOTEMPTY' && error.code !== 'EEXIST') throw error; if (error.code !== 'ENOENT') break; }
    if (directory === root) break;
    directory = path.dirname(directory);
  }
}

export async function prepareStationAttachmentRenames(client, beforeState = {}, nextState = {}, attachmentStore) {
  const before = new Map((beforeState.stationProfiles || []).map(profile => [String(profile?.id || ''), profile]));
  const after = new Map((nextState.stationProfiles || []).map(profile => [String(profile?.id || ''), profile]));
  const createdTargets = new Set();
  const oldTargets = new Set();
  try {
    for (const [stationId, nextProfile] of after) {
      const oldProfile = before.get(stationId);
      if (!oldProfile || stationFolderSegment(oldProfile.stationName, stationId) === stationFolderSegment(nextProfile.stationName, stationId)) continue;
      const newPrefix = stationAttachmentPrefix(nextProfile.stationName, stationId);
      const { rows } = await client.query('SELECT id,storage_name,content_type,size,sha256 FROM attachments WHERE station_id=$1 AND deleted_at IS NULL ORDER BY id FOR UPDATE', [stationId]);
      for (const row of rows) {
        const oldName = String(row.storage_name || '');
        const newName = destinationStorageName(oldName, stationId, newPrefix.slice('stations/'.length, -1));
        if (oldName === newName) continue;
        let source;
        try { source = await attachmentStore.get(oldName); }
        catch (error) { if (missingFile(error)) throw new Error(`Cannot rename station folder: attachment ${row.id} is missing at ${oldName}`); throw error; }
        if (source.length !== Number(row.size) || digest(source) !== String(row.sha256)) throw new Error(`Cannot rename station folder: attachment ${row.id} failed size or SHA-256 verification`);
        let target;
        let targetExists = true;
        try { target = await attachmentStore.get(newName); }
        catch (error) { if (!missingFile(error)) throw error; targetExists = false; }
        if (targetExists) {
          if (target.length !== source.length || digest(target) !== String(row.sha256)) throw new Error(`Cannot rename station folder: destination for ${row.id} already contains different data`);
        } else {
          await attachmentStore.put(newName, source, { contentType: row.content_type });
          createdTargets.add(newName);
          target = await attachmentStore.get(newName);
          if (target.length !== source.length || digest(target) !== String(row.sha256)) throw new Error(`Cannot rename station folder: copied attachment ${row.id} failed verification`);
        }
        const update = await client.query('UPDATE attachments SET storage_name=$1 WHERE id=$2 AND storage_name=$3 AND deleted_at IS NULL', [newName, row.id, oldName]);
        if (update.rowCount !== 1) throw new Error(`Cannot rename station folder: attachment ${row.id} changed during migration`);
        oldTargets.add(oldName);
      }
    }
  } catch (error) {
    await Promise.all([...createdTargets].map(name => attachmentStore.delete(name).catch(() => {})));
    throw error;
  }

  return {
    async afterCommit() {
      for (const name of oldTargets) {
        try { await attachmentStore.delete(name); await removeEmptyStationDirectories(attachmentStore, name); }
        catch (error) { console.warn(JSON.stringify({ event: 'station_attachment_old_path_cleanup_failed', storageName: name, message: error.message })); }
      }
    },
    async afterRollback() {
      await Promise.all([...createdTargets].map(name => attachmentStore.delete(name).catch(() => {})));
    },
  };
}
