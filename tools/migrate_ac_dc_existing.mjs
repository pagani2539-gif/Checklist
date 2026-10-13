import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createConfiguredStore } from '../server/store.mjs';
import { splitAcDcState } from '../src/domain/ac-dc-split.js';
import { attachmentIdsForState } from '../src/domain/storage.js';

const apply = process.argv.includes('--apply');
const backupIndex = process.argv.indexOf('--backup');
const backupDir = backupIndex >= 0 ? path.resolve(process.argv[backupIndex + 1]) : null;
if (apply && !backupDir) throw new Error('--apply requires --backup with a verified database/attachment backup');
const expectedVersionIndex = process.argv.indexOf('--expected-version');
const expectedBackupVersion = expectedVersionIndex >= 0 ? Number(process.argv[expectedVersionIndex + 1]) : null;
if (apply && !Number.isSafeInteger(expectedBackupVersion)) throw new Error('--apply requires --expected-version captured before backup');
const store = await createConfiguredStore();
try {
  const current = await store.getState();
  if (apply && current.version !== expectedBackupVersion) {
    throw new Error(`State changed after backup baseline ${expectedBackupVersion}; current version is ${current.version}. Take a new backup before applying.`);
  }
  const next = splitAcDcState(current.state);
  const changed = next !== current.state;
  const oldRounds = new Map(current.state.inspectionRounds.map(r => [r.id, r]));
  for (const r of next.inspectionRounds.filter(r => r.status === 'closed' || r.closedAt || r.archivedAt)) assert.deepEqual(r, oldRounds.get(r.id));
  const retained = new Set(attachmentIdsForState(next));
  for (const id of attachmentIdsForState(current.state)) assert(retained.has(id), `Lost attachment ${id}`);
  const summary = {
    version: current.version, changed,
    profiles: next.stationProfiles.filter((p, i) => p !== current.state.stationProfiles[i]).map(p => ({ id: p.id, code: p.stationCode,
      archivedAssets: p.acDcSplitArchive.assets.map(asset => asset.id), links: p.acDcSplitArchive.links, unmatched: p.acDcSplitArchive.unmatched })),
    rounds: next.inspectionRounds.filter((r, i) => r !== current.state.inspectionRounds[i]).map(r => ({ id: r.id, archivedItems: r.acDcSplitArchive.entries.length })),
    activeLegacyAssets: next.stationProfiles.flatMap(p => p.equipment.filter(a => a.type === 'WIM_AC_DC_POWER_SUPPLY' && a.active !== false).map(a => ({ stationCode: p.stationCode, assetNo: a.assetNo }))),
    archivedLegacyAssetCount: next.stationProfiles.reduce((count, profile) => count + (profile.acDcSplitArchive?.assets || []).filter(a => a.type === 'WIM_AC_DC_POWER_SUPPLY').length, 0),
    closedRoundsPreserved: next.inspectionRounds.filter(r => r.status === 'closed').length,
    attachmentIdsPreserved: retained.size,
  };
  if (apply && changed) {
    const manifest = JSON.parse(await fs.readFile(path.join(backupDir, 'manifest.json'), 'utf8'));
    assert((await fs.stat(manifest.database)).size > 0, 'database backup is empty');
    assert((await fs.stat(manifest.attachments || manifest.objects)).isDirectory(), 'attachments backup is missing');
    const verification = JSON.parse(await fs.readFile(path.join(backupDir, 'ac-dc-backup-check.json'), 'utf8'));
    assert.equal(verification.stateVersion, expectedBackupVersion, 'backup verification version does not match expected version');
    assert(verification.attachmentFileCount > 0, 'attachment backup verification is empty');
    assert.equal(verification.databaseBytes, (await fs.stat(manifest.database)).size, 'database backup changed after verification');
    // Write the exact input state before a version-checked commit. No ids/files are deleted.
    await fs.writeFile(path.join(backupDir, `ac-dc-before-v${current.version}.json`), JSON.stringify(current), { flag: 'wx' });
    const saved = await store.saveState(next, { expectedVersion: current.version, requireExactVersion: true,
      actor: { id: 'ac-dc-migration', role: 'admin' }, reason: 'Reuse existing AC Transformer and DC Switching; archive redundant combined AC/DC rows' });
    const persisted = await store.getState();
    assert.deepEqual(persisted.state, next);
    assert.deepEqual(persisted.state.stationProfiles.flatMap(p => p.equipment.filter(a => a.type === 'WIM_AC_DC_POWER_SUPPLY' && a.active !== false)), [], 'an active combined AC/DC asset remains');
    assert.deepEqual(persisted.state.inspectionRounds.filter(r => r.status !== 'closed' && !r.closedAt)
      .flatMap(r => (r.snapshot?.equipment || []).filter(a => a.type === 'WIM_AC_DC_POWER_SUPPLY' && a.active !== false)), [], 'an open round still generates combined AC/DC checks');
    summary.savedVersion = saved.version;
    await fs.writeFile(path.join(backupDir, 'ac-dc-migration-result.json'), JSON.stringify(summary, null, 2));
  }
  console.log(JSON.stringify(summary, null, 2));
} finally { await store.close(); }
