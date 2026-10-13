import assert from 'node:assert/strict';
import { createDefaultStationProfile, createSnapshot, makeEquipment, getItemsForSnapshot, normalizeSnapshot } from '../src/domain/master-checklist.js';
import { addThreeDCleaningToOpenRound } from '../src/domain/three-d-cleaning.js';
const profile = createDefaultStationProfile();
profile.stationSystems.push({ id: '3d-owner', canonicalItemId: 'dimension-management', scope: '3D', quantity: 1, active: true });
for (const type of ['LASER_SCANNER', 'DIMENSION_CONTROLLER']) profile.equipment.push(makeEquipment(type, 1, { id: type, parentSystemId: '3d-owner', scope: '3D' }));
const snapshot = createSnapshot(profile);
delete snapshot.threeDCleaningVersion;
snapshot.evidenceCatalog = snapshot.evidenceCatalog.filter(slot => !['LASER_SCANNER', 'DIMENSION_CONTROLLER'].includes(slot.cleaningAssetType));
const original = { id: 'open', status: 'draft', snapshot,
  inspectionItems: { existing: { status: 'damaged', value: '12', note: 'keep', evidence: { photo: { attachment: { id: 'original-image' } } } } },
  vehicleSearch: { preserve: true }, meta: { preserve: true } };
const before = structuredClone(original);
const { round, items } = addThreeDCleaningToOpenRound(original);
assert.equal(items.length, 2);
assert.equal(round.snapshot.evidenceCatalog.length, original.snapshot.evidenceCatalog.length + 6);
assert.deepEqual(round.inspectionItems.existing, original.inspectionItems.existing);
assert.deepEqual(round.snapshot.evidenceCatalog.slice(0, original.snapshot.evidenceCatalog.length), original.snapshot.evidenceCatalog);
assert.deepEqual(round.vehicleSearch, original.vehicleSearch);
assert.deepEqual(round.meta, original.meta);
assert.deepEqual(original, before);
assert.equal(getItemsForSnapshot(round.snapshot).filter(item => items.some(added => added.id === item.id)).length, 2);
const loaded = normalizeSnapshot(round.snapshot, profile);
assert.equal(getItemsForSnapshot(loaded).filter(item => items.some(added => added.id === item.id)).length, 2, 'loading the Snapshot must retain 3D cleaning');
assert.deepEqual(addThreeDCleaningToOpenRound(round).round, round, 'upgrade is idempotent and preserves new evidence');
assert.throws(() => addThreeDCleaningToOpenRound({ ...original, status: 'closed' }));
console.log('3D cleaning upgrade: PASS (additive, idempotent, evidence and closed history preserved)');
