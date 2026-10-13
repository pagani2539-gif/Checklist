import assert from 'node:assert/strict';
import { createDefaultStationProfile, createSnapshot, getItemsForSnapshot } from '../src/domain/master-checklist.js';
import { getCentralChecklistItemLabel } from '../src/domain/equipment-names.js';
import { buildReportTemplateModel } from '../src/domain/report-template.js';

for (const scope of ['ImPS', 'High Speed', 'Low Speed', 'Station-wide']) {
  const profile = createDefaultStationProfile();
  const system = profile.stationSystems.find(row => row.id === 'present-cctv-camera');
  system.scope = scope;
  const snapshot = createSnapshot(profile);
  const item = getItemsForSnapshot(snapshot).find(row => row.systemRecordId === system.id);
  assert.ok(item);
  assert.doesNotMatch(item.label, /ยังไม่ระบุตำแหน่ง/, `new system heading: ${scope}`);

  // Replay an old Snapshot with the warning frozen into its evidence catalog.
  const historical = structuredClone(snapshot);
  for (const entry of historical.evidenceCatalog.filter(row => row.itemId === item.id)) {
    entry.itemLabel = `${item.label} · ยังไม่ระบุตำแหน่ง`;
    entry.displayLabel = entry.itemLabel;
  }
  const before = JSON.stringify(historical);
  const oldItem = getItemsForSnapshot(historical).find(row => row.id === item.id);
  assert.match(oldItem.label, /ยังไม่ระบุตำแหน่ง/);
  assert.doesNotMatch(getCentralChecklistItemLabel(oldItem), /ยังไม่ระบุตำแหน่ง/);
  const model = buildReportTemplateModel({ snapshot: historical, inspectionItems: {}, meta: {} });
  assert.doesNotMatch(model.orderedItems.find(row => row.id === item.id).label, /ยังไม่ระบุตำแหน่ง/);
  assert.equal(JSON.stringify(historical), before, 'report must preserve historical Snapshot');
}

const equipmentItem = { assetId: 'camera-1', systemRecordId: 'cctv-1', label: 'ตรวจกล้อง · ยังไม่ระบุตำแหน่ง' };
assert.match(getCentralChecklistItemLabel(equipmentItem), /ยังไม่ระบุตำแหน่ง/, 'physical equipment warning remains');
console.log('System location heading: new scopes, historical reports and Snapshot preservation passed');
