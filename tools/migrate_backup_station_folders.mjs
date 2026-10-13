import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildFileIndex, verifyFileIndex } from './backup-support.mjs';
import { stationFolderSegment } from '../server/attachment-key.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2] || 'plan';
const backupRoot = path.resolve(process.argv[3] || path.join(projectRoot, 'backups'));
const pgRestoreBin = process.env.PG_RESTORE_BIN || resolvePostgresBinary('pg_restore');

function resolvePostgresBinary(name) {
  const base = process.env.ProgramFiles || 'C:\\Program Files';
  const root = path.join(base, 'PostgreSQL');
  try {
    const versions = fsSync.readdirSync(root).filter(value => /^\d+$/.test(value)).sort((a, b) => Number(b) - Number(a));
    for (const version of versions) {
      const candidate = path.join(root, version, 'bin', `${name}.exe`);
      if (fsSync.existsSync(candidate)) return candidate;
    }
  } catch {}
  return name;
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

function decodeCopyField(value) {
  if (value === '\\N') return null;
  return value.replace(/\\([btnrfv\\])/g, (_match, code) => ({ b: '\b', t: '\t', n: '\n', r: '\r', f: '\f', v: '\v', '\\': '\\' })[code])
    .replace(/\\([0-7]{1,3})/g, (_match, octal) => String.fromCharCode(parseInt(octal, 8)));
}

function readCopyTable(sql, tableName) {
  const startPattern = new RegExp(`^COPY public\\.${tableName} \\(([^)]+)\\) FROM stdin;$`);
  const lines = sql.split(/\r?\n/);
  const records = [];
  let columns = null;
  for (const line of lines) {
    if (!columns) {
      const match = startPattern.exec(line);
      if (match) columns = match[1].split(',').map(value => value.trim().replace(/^"|"$/g, ''));
      continue;
    }
    if (line === '\\.') { columns = null; continue; }
    const values = line.split('\t').map(decodeCopyField);
    records.push(Object.fromEntries(columns.map((column, index) => [column, values[index] ?? null])));
  }
  return records;
}

async function inspectDump(directory) {
  const dump = path.join(directory, 'checklist.dump');
  await run(pgRestoreBin, ['--list', dump]);
  const sqlPath = path.join(os.tmpdir(), `checklist-backup-map-${crypto.randomUUID()}.sql`);
  try {
    await run(pgRestoreBin, ['--data-only', '--table=stations', '--table=attachments', '--file', sqlPath, dump]);
    const sql = await fs.readFile(sqlPath, 'utf8');
    const stations = readCopyTable(sql, 'stations').map(row => ({ id: row.id, stationCode: row.station_code || '', stationName: row.station_name || '' })).filter(row => row.id);
    const attachmentPrefixes = new Map();
    for (const row of readCopyTable(sql, 'attachments')) {
      if (row.deleted_at || !row.station_id) continue;
      const match = /^stations\/([^/]+)\//.exec(row.storage_name || '');
      if (!match) continue;
      attachmentPrefixes.set(row.station_id, [...(attachmentPrefixes.get(row.station_id) || []), match[1]]);
    }
    for (const [stationId, folders] of attachmentPrefixes) {
      const unique = [...new Set(folders)];
      if (unique.length > 1) throw new Error(`Backup ${path.basename(directory)} has multiple storage folders for station ${stationId}`);
      attachmentPrefixes.set(stationId, unique[0]);
    }
    return { stations, attachmentPrefixes };
  } finally {
    await fs.rm(sqlPath, { force: true });
  }
}

async function copyDirectoryVerified(source, destination) {
  const sourceIndex = await buildFileIndex(source);
  try { await fs.access(destination); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await fs.cp(source, destination, { recursive: true, errorOnExist: true, force: false });
  }
  await verifyFileIndex(destination, sourceIndex);
  await fs.rm(source, { recursive: true, force: false });
}

async function listDirectDirectories(directory) {
  try { return (await fs.readdir(directory, { withFileTypes: true })).filter(entry => entry.isDirectory() && !entry.isSymbolicLink()).map(entry => entry.name); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}

async function loadPreviousMap(directory) {
  try { return JSON.parse(await fs.readFile(path.join(directory, 'station-folder-map.json'), 'utf8')).stations || []; }
  catch { return []; }
}

async function planBackup(directory) {
  const manifest = JSON.parse(await fs.readFile(path.join(directory, 'manifest.json'), 'utf8'));
  const stat = await fs.stat(path.join(directory, 'checklist.dump'));
  if (!stat.size) throw new Error('Database dump is empty');
  const attachmentRoot = path.join(directory, 'attachments');
  await fs.access(attachmentRoot);
  const { stations, attachmentPrefixes } = await inspectDump(directory);
  const available = new Set(await listDirectDirectories(path.join(attachmentRoot, 'stations')));
  const previous = new Map((await loadPreviousMap(directory)).map(item => [item.stationId, item]));
  const mappings = [];
  for (const station of stations) {
    const previousMapping = previous.get(station.id);
    const databaseFolder = attachmentPrefixes.get(station.id) || previousMapping?.databaseStoragePrefix?.replace(/^stations\/|\/$/g, '') || station.id;
    const desiredFolder = stationFolderSegment(station.stationName || station.stationCode || 'สถานี', station.id);
    const currentFolder = available.has(databaseFolder) ? databaseFolder : available.has(desiredFolder) ? desiredFolder : null;
    if (!currentFolder) continue;
    mappings.push({ stationId: station.id, stationCode: station.stationCode, stationName: station.stationName, sourceFolder: currentFolder, backupFolder: desiredFolder, databaseStoragePrefix: `stations/${databaseFolder}/` });
  }
  return { manifest, mappings, attachmentRoot, available };
}

async function atomicJson(filePath, value) {
  const temp = `${filePath}.tmp-${crypto.randomUUID()}`;
  await fs.writeFile(temp, JSON.stringify(value, null, 2));
  await fs.rename(temp, filePath);
}

async function migrateBackup(directory, plan) {
  const mapPath = path.join(directory, 'station-folder-map.json');
  const publicMappings = plan.mappings.map(({ sourceFolder: _sourceFolder, ...mapping }) => mapping);
  await atomicJson(mapPath, { version: 1, backupCreatedAt: plan.manifest.createdAt || path.basename(directory), stations: publicMappings });
  const stationRoot = path.join(plan.attachmentRoot, 'stations');
  for (const mapping of plan.mappings) {
    if (mapping.sourceFolder === mapping.backupFolder) continue;
    await copyDirectoryVerified(path.join(stationRoot, mapping.sourceFolder), path.join(stationRoot, mapping.backupFolder));
  }
  const index = await buildFileIndex(plan.attachmentRoot);
  await atomicJson(path.join(directory, 'attachments-index.json'), index);
  await verifyFileIndex(plan.attachmentRoot, index);
  const nextManifest = {
    ...plan.manifest,
    attachmentRestoreMap: publicMappings,
    attachmentsIndex: 'attachments-index.json',
    attachmentFileCount: index.fileCount,
    attachmentBytes: index.totalBytes,
    backupFolderMigrationVersion: 1,
  };
  await atomicJson(path.join(directory, 'manifest.json'), nextManifest);
  return { mappedStations: publicMappings.length, files: index.fileCount, bytes: index.totalBytes };
}

async function main() {
  if (!['plan', 'apply', 'verify'].includes(mode)) throw new Error('Use plan, apply or verify');
  const directories = (await fs.readdir(backupRoot, { withFileTypes: true })).filter(entry => entry.isDirectory() && !entry.isSymbolicLink());
  const results = [];
  for (const entry of directories) {
    const directory = path.join(backupRoot, entry.name);
    try {
      await fs.access(path.join(directory, 'manifest.json'));
      await fs.access(path.join(directory, 'checklist.dump'));
      await fs.access(path.join(directory, 'attachments'));
    } catch { continue; }
    const plan = await planBackup(directory);
    let outcome = { backup: entry.name, stations: plan.mappings.length, changed: plan.mappings.filter(value => value.sourceFolder !== value.backupFolder).length };
    if (mode === 'apply') outcome = { backup: entry.name, ...(await migrateBackup(directory, plan)) };
    else if (mode === 'verify') {
      const manifest = JSON.parse(await fs.readFile(path.join(directory, 'manifest.json'), 'utf8'));
      const indexPath = path.join(directory, manifest.attachmentsIndex || 'attachments-index.json');
      const index = JSON.parse(await fs.readFile(indexPath, 'utf8'));
      await verifyFileIndex(plan.attachmentRoot, index);
      if (manifest.attachmentRestoreMap?.length !== plan.mappings.length) throw new Error('Manifest restoration map differs from backup metadata');
      outcome = { backup: entry.name, verified: true, stations: plan.mappings.length, files: index.fileCount, bytes: index.totalBytes };
    }
    results.push(outcome);
  }
  console.log(JSON.stringify({ mode, completeBackups: results.length, results }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();

export { main as runBackupFolderMigration, readCopyTable };
