import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { makeEquipment, createInspectionRound, getItemsForSnapshot, normalizeRound, normalizeStationProfile, getChecklistItemsProgress } from '../src/domain/master-checklist.js';
import { splitAcDcState, AC_DC_SPLIT_VERSION } from '../src/domain/ac-dc-split.js';
import { attachmentIdsForState } from '../src/domain/storage.js';
import { getChecklistPageNavigationItems } from '../src/domain/checklist-queue-state.js';
import { sortEquipmentForDisplay } from '../src/domain/ordering.js';
import { getCanonicalItemsForFormat } from '../src/domain/canonical-station-catalog.js';
import { verifyAcDcMigrationBackup } from './ac_dc_backup_verification.mjs';

const backupDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ac-dc-backup-verification-'));
try {
  await fs.mkdir(path.join(backupDir, 'attachments'));
  await fs.writeFile(path.join(backupDir, 'checklist.dump'), 'verified database');
  await fs.writeFile(path.join(backupDir, 'attachments', 'evidence.bin'), 'verified attachment');
  const databaseBytes = (await fs.stat(path.join(backupDir, 'checklist.dump'))).size;
  await fs.writeFile(path.join(backupDir, 'manifest.json'), JSON.stringify({
    status: 'complete', stateVersion: 17, database: 'checklist.dump', attachments: 'attachments', attachmentFileCount: 1,
  }));
  await fs.writeFile(path.join(backupDir, 'ac-dc-backup-check.json'), JSON.stringify({
    stateVersion: 17, attachmentFileCount: 1, databaseBytes,
  }));
  const verified = await verifyAcDcMigrationBackup(backupDir, 17);
  assert.equal(verified.databasePath, path.join(backupDir, 'checklist.dump'));
  await assert.rejects(verifyAcDcMigrationBackup(backupDir, 18), /does not match expected version/);
} finally {
  await fs.rm(backupDir, { recursive: true, force: true });
}

const system = { id: 'electronics', canonicalItemId: 'wim-electronics-system', systemId: 'wim', scope: 'IMPS', quantity: 1, active: true };
const asset = (type, id) => makeEquipment(type, 1, { id, parentAssetId: 'cab', parentSystemId: system.id, scope: 'IMPS', outputVoltages: [12, 24], serialNo: `${id}-serial` });
const profile = { id: 'station', stationFormat: 'IMPS', stationCode: 'TEST', stationName: 'TEST', stationSystems: [system], lanes: [], equipment: [
  makeEquipment('CONTROL_CABINET', 1, { id: 'cab', parentSystemId: system.id, scope: 'IMPS' }),
  asset('WIM_AC_DC_POWER_SUPPLY', 'combined'), asset('WIM_TRANSFORMER_24VAC', 'ac'), asset('WIM_SWITCHING_DC', 'dc'),
] };
const round = createInspectionRound(profile, {}, { id: 'open' });
delete round.snapshot.acDcSplitVersion; // Requirements as saved before this migration.
const originalItems = getItemsForSnapshot(round.snapshot);
const combinedItems = originalItems.filter(item => item.assetId === 'combined');
const attachment = { id: 'original-image', name: 'original.png', type: 'image/png', imageAnnotation: { renderedAttachment: { id: 'annotated-image' } } };
for (const item of combinedItems) round.inspectionItems[item.id] = { ...round.inspectionItems[item.id], status: 'damaged', note: 'original note', evidence: { [item.evidenceSlots[0].id]: { status: 'complete', attachment, note: 'photo note' } } };
const acItem = originalItems.find(item => item.assetId === 'ac' && /transformer-/.test(item.id));
round.inspectionItems[acItem.id] = { ...round.inspectionItems[acItem.id], status: 'normal', value: '24.2', evidence: { [acItem.evidenceSlots[0].id]: { status: 'complete', attachment: { id: 'existing-ac-image' } } } };
const dcItem = originalItems.find(item => item.assetId === 'dc' && /switching-dc-/.test(item.id));
round.inspectionItems[dcItem.id] = { ...round.inspectionItems[dcItem.id], status: 'normal', value: '12.1' };
const closed = { ...structuredClone(round), id: 'closed', status: 'closed', closedAt: '2026-01-01' };
const state = { stationProfiles: [profile], inspectionRounds: [round, closed], activeRoundId: round.id, items: round.inspectionItems, inspectionSnapshot: round.snapshot };
const before = JSON.stringify(state);
const migrated = splitAcDcState(state, { migratedAt: '2026-10-12' });
assert.equal(JSON.stringify(state), before, 'migration is pure');
assert.equal(migrated.inspectionRounds[1], closed, 'closed round stays untouched');
assert.deepEqual(migrated.stationProfiles[0].equipment.filter(a => a.active !== false).map(a => a.id).sort(), ['ac', 'cab', 'dc'], 'reuse existing equipment; no new assets');
for (const id of ['ac', 'dc']) assert.deepEqual(migrated.stationProfiles[0].equipment.find(a => a.id === id), profile.equipment.find(a => a.id === id), 'existing device ids and serials are preserved');
const updated = migrated.inspectionRounds[0];
assert.equal(updated.snapshot.acDcSplitVersion, AC_DC_SPLIT_VERSION);
assert.deepEqual(updated.acDcSplitArchive.entries.map(e => e.item.id), combinedItems.map(i => i.id));
assert.deepEqual(updated.acDcSplitArchive.entries[0].value, round.inspectionItems[combinedItems[0].id]);
assert.deepEqual(updated.inspectionItems[acItem.id], round.inspectionItems[acItem.id]);
assert.deepEqual(updated.inspectionItems[dcItem.id], round.inspectionItems[dcItem.id]);
assert(attachmentIdsForState(migrated).includes('original-image'));
assert(attachmentIdsForState(migrated).includes('annotated-image'));
const items = getItemsForSnapshot(updated.snapshot);
assert(!items.some(i => i.assetId === 'combined'), 'combined items leave active progress');
for (const id of ['ac', 'dc']) {
  const points = items.filter(i => i.assetId === id && !i.isEquipmentCleaning);
  assert(points.some(i => /-condition/.test(i.id)));
  assert(points.some(i => /-input/.test(i.id)));
  assert(points.some(i => /-function/.test(i.id)));
  assert(points.every(i => i.evidenceSlots.length === 1));
  assert.equal(updated.inspectionItems[points.find(i => /-function/.test(i.id)).id].status, 'pending', 'new point starts pending');
}
assert.equal(getChecklistItemsProgress(items.filter(i => i.assetId === 'ac'), updated).done, 1, 'archived damaged result does not complete AC points');
assert.deepEqual(sortEquipmentForDisplay(updated.snapshot.equipment).map(a => a.id), ['cab', 'ac', 'dc']);
const navigation = getChecklistPageNavigationItems([{ code: '2.3', title: 'WIM', items }], 'IMPS', updated.snapshot);
assert.equal(new Set(navigation.map(i => i.id)).size, navigation.length);
assert.equal(navigation.filter(i => i.assetId === 'dc').length, 5, 'DC has five separate item pages');
assert.equal(splitAcDcState(migrated), migrated, 'second migration is a no-op');
const normalized = normalizeRound(updated, migrated.stationProfiles, migrated.stationProfiles[0]);
assert.deepEqual(normalized.acDcSplitArchive, updated.acDcSplitArchive, 'archive survives server reload');
assert.equal(normalized.snapshot.acDcSplitVersion, AC_DC_SPLIT_VERSION);
assert.deepEqual(normalizeStationProfile(migrated.stationProfiles[0]).acDcSplitArchive, migrated.stationProfiles[0].acDcSplitArchive);
assert(!getCanonicalItemsForFormat('IMPS').some(i => i.equipmentType === 'WIM_AC_DC_POWER_SUPPLY'), 'no combined choice for new stations');
const missingAc = { ...profile, equipment: profile.equipment.filter(a => a.id !== 'ac') };
const unmatched = { stationProfiles: [missingAc], inspectionRounds: [] };
const unmatchedMigrated = splitAcDcState(unmatched, { migratedAt: '2026-10-12' });
assert.notEqual(unmatchedMigrated, unmatched, 'retire the combined row even when the separate AC device is missing');
assert.equal(unmatchedMigrated.stationProfiles[0].equipment.find(a => a.id === 'combined').active, false);
assert.deepEqual(unmatchedMigrated.stationProfiles[0].acDcSplitArchive.links, [], 'do not create a false link for an incomplete pair');
assert.deepEqual(unmatchedMigrated.stationProfiles[0].acDcSplitArchive.unmatched[0].missingTypes, ['WIM_TRANSFORMER_24VAC']);
assert.deepEqual(unmatchedMigrated.stationProfiles[0].equipment.filter(a => a.active !== false).map(a => a.id).sort(), ['cab', 'dc']);
const unmatchedRound = createInspectionRound(missingAc, {}, { id: 'unmatched-open' });
delete unmatchedRound.snapshot.acDcSplitVersion;
const unmatchedOldItems = getItemsForSnapshot(unmatchedRound.snapshot).filter(item => item.assetId === 'combined');
const oldValue = { ...unmatchedRound.inspectionItems[unmatchedOldItems[0].id], status: 'damaged', note: 'legacy result',
  evidence: { [unmatchedOldItems[0].evidenceSlots[0].id]: { status: 'complete', attachment: { id: 'legacy-acdc-photo' } } } };
unmatchedRound.inspectionItems[unmatchedOldItems[0].id] = oldValue;
const unmatchedRoundState = { stationProfiles: [missingAc], inspectionRounds: [unmatchedRound] };
const unmatchedRoundMigrated = splitAcDcState(unmatchedRoundState, { migratedAt: '2026-10-12' });
const archivedRound = unmatchedRoundMigrated.inspectionRounds[0];
assert(!archivedRound.snapshot.equipment.some(a => a.id === 'combined'), 'unmatched legacy device leaves open-round checks');
assert.deepEqual(archivedRound.acDcSplitArchive.entries.find(e => e.item.id === unmatchedOldItems[0].id).value, oldValue, 'legacy result and photo remain readable');
assert(!getItemsForSnapshot(archivedRound.snapshot).some(item => item.assetId === 'combined'));
assert.equal(splitAcDcState(unmatchedRoundMigrated), unmatchedRoundMigrated, 'unmatched migration is idempotent');
const otherCab = { ...profile, equipment: profile.equipment.map(a => a.id === 'ac' ? { ...a, parentAssetId: 'another-cab' } : a) };
const otherCabMigrated = splitAcDcState({ stationProfiles: [otherCab], inspectionRounds: [] });
assert.equal(otherCabMigrated.stationProfiles[0].equipment.find(a => a.id === 'combined').active, false, 'retire legacy row without binding across cabinets');
assert.deepEqual(otherCabMigrated.stationProfiles[0].acDcSplitArchive.links, [], 'never bind across cabinets');
console.log('AC/DC reuse, archive, evidence, closed history, five item pages, incomplete mapping and idempotence passed');
