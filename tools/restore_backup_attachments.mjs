import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import crypto from 'node:crypto';
import { buildFileIndex, verifyFileIndex } from './backup-support.mjs';

function storageFolderFromPrefix(value) {
  const prefix = String(value || '');
  const match = /^stations\/([\p{L}\p{M}\p{N}._-]{1,240})\/$/u.exec(prefix);
  if (!match) throw new Error(`Invalid database storage prefix in restore map: ${prefix}`);
  return match[1];
}

export async function restoreBackupAttachments(backupDir, destinationRoot) {
  const sourceRoot = path.resolve(backupDir, 'attachments');
  const targetRoot = path.resolve(destinationRoot);
  const stagingRoot = `${targetRoot}.partial-${process.pid}-${crypto.randomUUID()}`;
  const manifest = JSON.parse(await fs.readFile(path.resolve(backupDir, 'manifest.json'), 'utf8'));
  const indexPath = manifest.attachmentsIndex ? path.resolve(backupDir, manifest.attachmentsIndex) : path.resolve(backupDir, 'attachments-index.json');
  let index;
  try { index = JSON.parse(await fs.readFile(indexPath, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; index = await buildFileIndex(sourceRoot); }
  let mappings = manifest.attachmentRestoreMap;
  if (!mappings) {
    try { mappings = JSON.parse(await fs.readFile(path.resolve(backupDir, 'station-folder-map.json'), 'utf8')).stations || []; }
    catch (error) { if (error.code !== 'ENOENT') throw error; mappings = []; }
  }
  await fs.access(sourceRoot);
  try { await fs.access(targetRoot); throw new Error('Restore target must not already exist'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await fs.mkdir(path.dirname(targetRoot), { recursive: true });
  try {
    await fs.cp(sourceRoot, stagingRoot, { recursive: true, errorOnExist: true, force: false });
    const renames = [];
    for (const mapping of mappings || []) {
      const folder = String(mapping.backupFolder || '');
      if (!/^[\p{L}\p{M}\p{N}._-]{1,240}$/u.test(folder) || folder === '.' || folder === '..') throw new Error(`Invalid backup folder name in restore map: ${folder}`);
      const databaseFolder = storageFolderFromPrefix(mapping.databaseStoragePrefix);
      if (folder === databaseFolder) continue;
      renames.push({ from: path.join(stagingRoot, 'stations', folder), to: path.join(stagingRoot, 'stations', databaseFolder), fromFolder: folder, toFolder: databaseFolder });
    }
    for (const entry of renames) {
      await fs.access(entry.from);
      try { await fs.access(entry.to); throw new Error(`Restore target folder already exists: ${entry.toFolder}`); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      await fs.mkdir(path.dirname(entry.to), { recursive: true });
      await fs.rename(entry.from, entry.to);
    }
    const restoredIndex = {
      ...index,
      files: index.files.map(file => {
        let filePath = file.path;
        for (const entry of renames) {
          const prefix = `stations/${entry.fromFolder}/`;
          if (filePath.startsWith(prefix)) { filePath = `stations/${entry.toFolder}/${filePath.slice(prefix.length)}`; break; }
        }
        return { ...file, path: filePath };
      }),
    };
    const verified = await verifyFileIndex(stagingRoot, restoredIndex);
    await fs.rename(stagingRoot, targetRoot);
    return { restored: true, files: verified.fileCount, bytes: verified.totalBytes, stations: (mappings || []).length, targetRoot };
  } catch (error) {
    await fs.rm(stagingRoot, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.length < 4) throw new Error('Usage: node tools/restore_backup_attachments.mjs <backup-directory> <empty-destination-directory>');
  console.log(JSON.stringify(await restoreBackupAttachments(process.argv[2], process.argv[3])));
}
