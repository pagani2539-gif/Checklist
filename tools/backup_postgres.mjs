import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Pool } from 'pg';
import { GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { attachmentMetadataFingerprint, createBackupTransaction } from './backup-support.mjs';
import { stationFolderSegment } from '../server/attachment-key.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(root, '..');

function resolvePostgresBinary(name, configured, environment = process.env) {
  if (configured) return configured;
  const base = environment.ProgramFiles || 'C:\\Program Files';
  const rootPath = path.join(base, 'PostgreSQL');
  try {
    const versions = fsSync.readdirSync(rootPath).filter(value => /^\d+$/.test(value)).sort((a, b) => Number(b) - Number(a));
    for (const version of versions) {
      const candidate = path.join(rootPath, version, 'bin', `${name}.exe`);
      if (fsSync.existsSync(candidate)) return candidate;
    }
  } catch {}
  return name;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'], ...options });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}: ${stderr.trim()}`)));
  });
}

async function getStationSnapshot(connectionString, { allowMultipleStorageFolders = false } = {}) {
  const pool = new Pool({ connectionString, max: 1 });
  try {
    const state = (await pool.query(`SELECT version,payload->'stationProfiles' AS profiles FROM app_state WHERE id='global'`)).rows[0];
    if (!state) throw new Error('Global application state is missing');
    const profiles = (state.profiles || []).map(profile => ({ id: String(profile.id), stationCode: profile.stationCode || '', stationName: profile.stationName || '' }));
    const folderRows = (await pool.query(`SELECT DISTINCT station_id, split_part(storage_name, '/', 2) AS folder
      FROM attachments WHERE deleted_at IS NULL AND station_id IS NOT NULL AND storage_name LIKE 'stations/%' ORDER BY station_id, folder`)).rows;
    const attachmentRows = (await pool.query('SELECT id,storage_name,size,sha256,station_id,deleted_at FROM attachments ORDER BY id')).rows;
    const folders = new Map();
    for (const row of folderRows) folders.set(row.station_id, [...(folders.get(row.station_id) || []), row.folder]);
    for (const [stationId, values] of folders) if (!allowMultipleStorageFolders && new Set(values).size > 1) throw new Error(`Station ${stationId} has attachments in multiple storage folders; reconcile them before a name-normalized backup`);
    return {
      stateVersion: Number(state.version),
      attachmentMetadataSha256: attachmentMetadataFingerprint(attachmentRows),
      profiles: profiles.map(profile => ({ ...profile, storageFolders: [...new Set(folders.get(profile.id) || [])] })),
    };
  } finally {
    await pool.end();
  }
}

async function copyStationFolderVerified(source, target) {
  try { await fs.access(target); throw new Error(`Backup already contains two folders for one station: ${target}`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  // The destination is still a disposable staging backup. Rename it atomically
  // on the same volume, then hash the completed tree before the backup commits.
  await fs.rename(source, target);
}

async function populateS3Backup(target) {
  const bucket = process.env.CHECKLIST_S3_BUCKET;
  if (!bucket) throw new Error('CHECKLIST_S3_BUCKET is required for S3 backup');
  const client = new S3Client({
    region: process.env.CHECKLIST_S3_REGION || 'us-east-1',
    ...(process.env.CHECKLIST_S3_ENDPOINT ? { endpoint: process.env.CHECKLIST_S3_ENDPOINT } : {}),
    forcePathStyle: String(process.env.CHECKLIST_S3_FORCE_PATH_STYLE || 'true').toLowerCase() === 'true',
    ...(process.env.CHECKLIST_S3_ACCESS_KEY && process.env.CHECKLIST_S3_SECRET_KEY ? { credentials: { accessKeyId: process.env.CHECKLIST_S3_ACCESS_KEY, secretAccessKey: process.env.CHECKLIST_S3_SECRET_KEY } } : {}),
  });
  await fs.mkdir(target, { recursive: true });
  let token;
  let objectCount = 0;
  do {
    const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }));
    for (const item of page.Contents || []) {
      const key = String(item.Key || '');
      if (!key || key.includes('..') || key.includes('\\') || path.isAbsolute(key)) throw new Error(`Unsafe S3 object key: ${key}`);
      const filePath = path.join(target, key);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      const body = result.Body?.transformToByteArray ? Buffer.from(await result.Body.transformToByteArray()) : Buffer.alloc(0);
      await fs.writeFile(filePath, body, { flag: 'wx' });
      objectCount += 1;
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return objectCount;
}

export async function createPostgresBackup({ env = process.env, now = new Date() } = {}) {
  const databaseUrl = env.CHECKLIST_DATABASE_URL;
  if (!databaseUrl) throw new Error('CHECKLIST_DATABASE_URL is required');
  const parsedDatabaseUrl = new URL(databaseUrl);
  const databasePassword = decodeURIComponent(parsedDatabaseUrl.password);
  parsedDatabaseUrl.password = '';
  const safeDatabaseUrl = parsedDatabaseUrl.toString();
  const backupRoot = path.resolve(env.CHECKLIST_BACKUP_DIR || path.join(projectRoot, 'backups'));
  const attachmentBackend = env.CHECKLIST_ATTACHMENT_BACKEND || 'filesystem';
  const preserveAttachmentLayout = String(env.CHECKLIST_BACKUP_PRESERVE_ATTACHMENT_LAYOUT || '').toLowerCase() === 'true';
  const pgDumpBin = resolvePostgresBinary('pg_dump', env.PG_DUMP_BIN, env);
  const pgRestoreBin = resolvePostgresBinary('pg_restore', env.PG_RESTORE_BIN, env);
  const commandEnv = { ...env, PGPASSWORD: databasePassword };
  let stationSnapshot = { profiles: [], stateVersion: null, attachmentMetadataSha256: null };
  let objectCount = 0;
  if (String(attachmentBackend).toLowerCase() === 'filesystem') stationSnapshot = await getStationSnapshot(databaseUrl, { allowMultipleStorageFolders: preserveAttachmentLayout });

  const result = await createBackupTransaction({
    backupRoot,
    createdAt: now,
    attachmentBackend,
    writeDatabaseDump: databasePath => run(pgDumpBin, ['--format=custom', '--file', databasePath, '--dbname', safeDatabaseUrl], { env: commandEnv }),
    verifyDatabaseDump: databasePath => run(pgRestoreBin, ['--list', databasePath], { env: commandEnv }),
    ...(String(attachmentBackend).toLowerCase() === 'filesystem' ? {
      copyAttachments: target => fs.cp(path.resolve(env.CHECKLIST_ATTACHMENTS_DIR || path.join(projectRoot, 'data', 'attachments')), target, { recursive: true, errorOnExist: true, force: false }),
      prepareAttachments: async target => {
        if (preserveAttachmentLayout) return [];
        const mappings = [];
        const stationRoot = path.join(target, 'stations');
        for (const profile of stationSnapshot.profiles) {
          if (!profile.storageFolders.length) continue;
          if (profile.storageFolders.length > 1) throw new Error(`Station ${profile.id} has attachments in multiple storage folders; reconcile them before a name-normalized backup`);
          const desiredFolder = stationFolderSegment(profile.stationName, profile.id);
          const storageFolder = profile.storageFolders[0];
          const source = path.join(stationRoot, storageFolder);
          const destination = path.join(stationRoot, desiredFolder);
          await fs.access(source);
          if (storageFolder !== desiredFolder) await copyStationFolderVerified(source, destination);
          mappings.push({ stationId: profile.id, stationCode: profile.stationCode || '', stationName: profile.stationName || '', backupFolder: desiredFolder, databaseStoragePrefix: `stations/${storageFolder}/` });
        }
        return mappings;
      },
    } : {
      copyAttachments: async target => { objectCount = await populateS3Backup(target); },
    }),
    verifyBeforeCommit: async () => {
      if (String(attachmentBackend).toLowerCase() !== 'filesystem') return;
      const latest = await getStationSnapshot(databaseUrl, { allowMultipleStorageFolders: preserveAttachmentLayout });
      if (latest.stateVersion !== stationSnapshot.stateVersion || latest.attachmentMetadataSha256 !== stationSnapshot.attachmentMetadataSha256) {
        throw new Error('Database or attachment metadata changed during backup; the partial backup was discarded');
      }
    },
    extraManifest: () => ({
      ...(String(attachmentBackend).toLowerCase() === 'filesystem' ? { stateVersion: stationSnapshot.stateVersion, attachmentMetadataSha256: stationSnapshot.attachmentMetadataSha256 } : {}),
      ...(String(attachmentBackend).toLowerCase() === 'filesystem' ? { attachmentLayout: preserveAttachmentLayout ? 'database-native' : 'station-name' } : {}),
      ...(String(attachmentBackend).toLowerCase() === 's3' ? { objects: 'objects', objectCount } : {}),
    }),
  });
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = await createPostgresBackup();
  console.log(JSON.stringify(result));
}
