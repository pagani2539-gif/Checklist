import assert from 'node:assert/strict';
import { createDefaultStationProfile, createSnapshot, makeEquipment, getItemsForSnapshot, getPrintableSectionsForSnapshot, getNewRoundChecklistItems } from '../src/domain/master-checklist.js';
import { getChecklistPageNavigationItems } from '../src/domain/checklist-queue-state.js';
import { buildReportTemplateModel } from '../src/domain/report-template.js';

for (const format of ['SC', 'IMPS']) {
  const profile = createDefaultStationProfile();
  profile.stationFormat = format;
  profile.stationSystems.push({ id: '3d-owner', canonicalItemId: 'dimension-management', scope: '3D', quantity: 1, active: true });
  for (const type of ['LASER_SCANNER', 'DIMENSION_CONTROLLER']) {
    profile.equipment.push(makeEquipment(type, 1, { id: type, parentSystemId: '3d-owner', scope: '3D' }));
  }
  profile.equipment.push(makeEquipment('LASER_SCANNER', 2, { id: 'inactive-3d', active: false }));
  const snapshot = createSnapshot(profile);
  const items = getItemsForSnapshot(snapshot);
  const queue = getChecklistPageNavigationItems(getPrintableSectionsForSnapshot(snapshot), format, snapshot);
  const model = buildReportTemplateModel({ id: 'cleaning-round', snapshot, inspectionItems: {}, meta: {} });
  for (const type of ['LASER_SCANNER', 'DIMENSION_CONTROLLER']) {
    const cleaning = items.filter(item => item.assetId === type && item.isEquipmentCleaning);
    assert.equal(cleaning.length, 1, `${format}: ${type} must have cleaning`);
    assert.equal(cleaning[0].sectionCode, '1.1.5');
    assert.deepEqual(cleaning[0].evidenceSlots.map(slot => slot.cleaningStage), ['before', 'during', 'after']);
    assert.ok(cleaning[0].evidenceSlots.every(slot => slot.required));
    assert.ok(queue.some(item => item.id === cleaning[0].id));
    assert.ok(model.sections.flatMap(section => section.items).some(item => item.id === cleaning[0].id));
    assert.ok(getNewRoundChecklistItems(profile).some(item => item.assetId === type && item.isEquipmentCleaning));
  }
  assert.ok(!items.some(item => item.assetId === 'inactive-3d'));
  const historical = structuredClone(snapshot);
  delete historical.threeDCleaningVersion;
  historical.evidenceCatalog = historical.evidenceCatalog.filter(slot => !['LASER_SCANNER', 'DIMENSION_CONTROLLER'].includes(slot.cleaningAssetType));
  const before = JSON.stringify(historical);
  assert.ok(!getItemsForSnapshot(historical).some(item => ['LASER_SCANNER', 'DIMENSION_CONTROLLER'].includes(item.cleaningAssetType)));
  assert.equal(JSON.stringify(historical), before);
}
console.log('3D cleaning: PASS (SC/IMPS, queue, report, 3 required photos, inactive and historical preservation)');
