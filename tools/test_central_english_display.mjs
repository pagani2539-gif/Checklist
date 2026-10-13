import assert from 'node:assert/strict';
import { CENTRAL_NAME_CATALOG as CENTRAL_NAME_ENTRIES, getCentralChecklistItemLabel, useCentralEnglishNames } from '../src/domain/equipment-names.js';
import { createDefaultStationProfile, createInspectionRound, getItemsForSnapshot, getEquipmentDisplayLabel } from '../src/domain/master-checklist.js';
import { getChecklistQueueItemLabel } from '../src/domain/checklist-queue-state.js';
import { createUiVehicleSystemsDemoRound } from '../src/domain/demo-fixture.js';
import { buildReportTemplateModel } from '../src/domain/report-template.js';

for (const name of CENTRAL_NAME_ENTRIES) {
  assert.equal(useCentralEnglishNames(name.nameTh), name.nameEn);
  assert.equal(useCentralEnglishNames(`${name.nameEn} · ${name.nameTh}`), name.nameEn);
  if (name.key.includes('_')) assert.equal(getEquipmentDisplayLabel({ type: name.key }), name.nameEn);
}
const scanner = { label: 'ตรวจผลการสแกนวัดมิติ · 3D-LS-3D-01 · 3D', assetName: '3D Laser Scanner · เครื่องสแกนมิติรถบรรทุก 3 มิติ' };
assert.equal(getChecklistQueueItemLabel(scanner), '3D Laser Scanner · ตรวจผลการสแกนวัดมิติ · 3D-LS-3D-01 · 3D');
const round = createInspectionRound(createDefaultStationProfile());
const before = JSON.stringify(round);
for (const item of getItemsForSnapshot(round.snapshot)) {
  const label = getCentralChecklistItemLabel(item);
  for (const name of CENTRAL_NAME_ENTRIES) assert.ok(!label.includes(name.nameTh), `${item.id}: ${name.nameTh}`);
  assert.equal(getCentralChecklistItemLabel({ ...item, label }), label, 'formatting must not duplicate names');
}
assert.equal(JSON.stringify(round), before, 'display formatting must preserve Snapshot and inspection values');
for (const format of ['SC', 'IMPS']) {
  const fixture = createUiVehicleSystemsDemoRound(format);
  const saved = JSON.stringify(fixture);
  const model = buildReportTemplateModel(fixture);
  const items = new Map(getItemsForSnapshot(fixture.snapshot).map(item => [item.id, item]));
  for (const item of model.sections.flatMap(section => section.items)) {
    assert.equal(item.label, getCentralChecklistItemLabel(items.get(item.id)));
    for (const slot of item.evidenceSlots) {
      for (const name of CENTRAL_NAME_ENTRIES) assert.ok(!slot.displayLabel.includes(name.nameTh));
    }
  }
  assert.equal(JSON.stringify(fixture), saved, `${format}: report display preserves stored data`);
}
console.log('central English display: PASS');
