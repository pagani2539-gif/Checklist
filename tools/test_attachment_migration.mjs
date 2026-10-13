import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { Pool } from 'pg';
import { assertIsolatedTestDatabaseUrl } from './database_url_test_support.mjs';

const configuredDatabaseUrl = process.env.CHECKLIST_POSTGRES_TEST_DATABASE_URL;
if (!configuredDatabaseUrl) { console.log('test_attachment_migration: skipped (set CHECKLIST_POSTGRES_TEST_DATABASE_URL for isolated schema test)'); process.exit(0); }
const databaseUrl = assertIsolatedTestDatabaseUrl(configuredDatabaseUrl);
const schema = `attachment_layout_test_${Date.now()}`;
const pool = new Pool({ connectionString: databaseUrl });
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'attachment-migration-'));
const root = path.join(temp, 'attachments');
const output = path.join(temp, 'migration');
const connection = new URL(databaseUrl);
connection.searchParams.set('options', `-csearch_path=${schema}`);
const run = mode => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ['tools/organize_attachments.mjs', mode, output], { env: { ...process.env, CHECKLIST_DATABASE_URL: connection.toString(), CHECKLIST_ATTACHMENTS_DIR: root, CHECKLIST_MIGRATION_SERVICE_URL: 'http://127.0.0.1:1' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let text = '';
  child.stdout.on('data', value => text += value);
  child.stderr.on('data', value => text += value);
  child.on('error', reject);
  child.on('close', code => code === 0 ? resolve(text) : reject(new Error(text)));
});
try {
  await fs.mkdir(root); await fs.mkdir(output);
  await pool.query(`CREATE SCHEMA ${schema}`);
  await pool.query(`CREATE TABLE ${schema}.attachments(id text PRIMARY KEY,storage_name text UNIQUE,size bigint,sha256 text,station_id text,created_at timestamptz,deleted_at timestamptz); CREATE TABLE ${schema}.app_state(id text,version bigint,payload jsonb); CREATE TABLE ${schema}.state_revisions(payload jsonb)`);
  for (const id of ['shared', 'historical', 'unassigned']) {
    const body = Buffer.from(`${id} immutable evidence`);
    await fs.writeFile(path.join(root, `${id}.jpg`), body);
    await pool.query(`INSERT INTO ${schema}.attachments VALUES($1,$2,$3,$4,$5,$6,NULL)`, [id, `${id}.jpg`, body.length, crypto.createHash('sha256').update(body).digest('hex'), 'station-test', '2026-10-06']);
  }
  const round = id => ({ id, stationId: 'station-test', createdAt: '2026-10-06', inspectionItems: { one: { attachment: { id: 'shared' } } } });
  const state = { inspectionRounds: [round('round-a'), round('round-b')] };
  await pool.query(`INSERT INTO ${schema}.app_state VALUES('global',1,$1)`, [state]);
  await pool.query(`INSERT INTO ${schema}.state_revisions VALUES($1)`, [{ inspectionRounds: [{ id: 'round-old', stationId: 'station-test', vehicleEvidenceArchive: { x: { image: { id: 'historical' } } } }] }]);
  await fs.writeFile(path.join(output, 'backup.json'), JSON.stringify({ database: path.join(output, 'backup.dump'), attachments: root }));
  await fs.writeFile(path.join(output, 'backup.dump'), 'fixture backup');
  await run('plan');
  const manifest = JSON.parse(await fs.readFile(path.join(output, 'manifest.json')));
  assert.equal(manifest.sharedFiles, 1); assert.equal(manifest.unassignedFiles, 1);
  const historical = manifest.entries.find(entry => entry.id === 'historical');
  assert.ok(historical.newKey.includes('/rounds/round-old/vehicle-api/originals/'));
  // A corrupt destination must never become authoritative.
  await fs.mkdir(path.dirname(path.join(root, historical.newKey)), { recursive: true });
  await fs.writeFile(path.join(root, historical.newKey), 'corrupt');
  await assert.rejects(() => run('apply'));
  assert.equal((await pool.query(`SELECT storage_name FROM ${schema}.attachments WHERE id='historical'`)).rows[0].storage_name, 'historical.jpg');
  await fs.unlink(path.join(root, historical.newKey));
  await run('apply'); await run('apply'); await run('verify');
  assert.equal((await pool.query(`SELECT payload FROM ${schema}.app_state`)).rows[0].payload.inspectionRounds.length, 2);
  await run('archive-legacy'); await run('archive-legacy');
  assert.equal((await fs.readdir(root)).includes('shared.jpg'), false);
  await run('rollback'); await run('rollback');
  assert.equal((await pool.query(`SELECT count(*)::int AS n FROM ${schema}.attachments WHERE storage_name NOT LIKE '%/%'`)).rows[0].n, 3);
  assert.equal(await fs.readFile(path.join(root, 'shared.jpg'), 'utf8'), 'shared immutable evidence');
  console.log('test_attachment_migration: pass (isolated schema, shared/history, corruption, resume, archive and rollback)');
} finally {
  await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await pool.end();
  await fs.rm(temp, { recursive: true, force: true });
}
