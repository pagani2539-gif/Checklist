import assert from 'node:assert/strict';
import { createDefaultStationProfile, createSnapshot, createInspectionRound, getItemsForSnapshot, normalizeRound, getCloseReadiness } from '../src/domain/master-checklist.js';
import { getInstalledVehicleSystems, getVehicleSystemInstallation } from '../src/domain/vehicle-review-systems.js';
import { getCanonicalItemsForFormat, getCanonicalItem } from '../src/domain/canonical-station-catalog.js';
import { buildReportTemplateModel } from '../src/domain/report-template.js';
import { isEvidenceSlotComplete } from '../src/domain/evidence-checklist.js';

function makeProfile(scopes, format = 'SC') {
  const profile = createDefaultStationProfile();
  profile.stationFormat = format;
  profile.equipment = [];
  profile.lanes = scopes.map((scope, i) => ({ id: `lane-${i}`, laneNo: i + 1, scope, active: true }));
  profile.stationSystems = scopes.map((scope, i) => ({ id: `wim-${i}`, canonicalItemId: 'wim-sorting', scope, laneId: `lane-${i}`, quantity: 1, active: true }));
  profile.vehicleSearchConfig = { systems: Object.fromEntries(scopes.map(scope => [format === 'IMPS' ? 'imps' : scope === 'High Speed' ? 'sc-hs' : 'sc-ls', { baseUrl: 'http://test.invalid:3005', proxyHost: 'proxy.invalid', proxyPort: 8080 }])) };
  return profile;
}
const profile = makeProfile(['High Speed', 'Low Speed', 'High Speed']);
assert.deepEqual(getInstalledVehicleSystems(profile).map(s => [s.key, s.laneIds.length]), [['sc-hs', 2], ['sc-ls', 1]]);
profile.stationSystems.push({ id: 'manual-program', canonicalItemId: 'wim-high-reporting', scope: 'High Speed', active: true, quantity: 1 });
profile.checklistConfig = { disabledItemIds: ['6.1.report-print'], disabledTemplateIds: ['6.1.vehicle-search'], legacyResolved: false };
let round = createInspectionRound(profile);
const items = getItemsForSnapshot(round.snapshot);
const software = items.filter(item => item.automaticSoftwareTest);
assert.equal(software.length, 14);
assert.equal(new Set(software.map(item => item.id)).size, 14);
assert.equal(new Set(software.flatMap(item => item.evidenceSlots.map(slot => slot.id))).size, 14);
assert.ok(software.every(item => item.applicable && !item.checklistDisabled));
for (const item of software) {
  for (const slot of item.evidenceSlots) {
    assert.equal(isEvidenceSlotComplete(slot, { status: 'complete' }), false, `${item.id}: an empty slot cannot complete the task`);
  }
}
assert.ok(!items.some(item => item.systemRecordId === 'manual-program'));
const hs = software.find(item => item.sourceItemId === '6.1.report-print' && item.softwareTestSystemKey === 'sc-hs');
const ls = software.find(item => item.sourceItemId === '6.1.report-print' && item.softwareTestSystemKey === 'sc-ls');
round.inspectionItems[hs.id] = { ...round.inspectionItems[hs.id], status: 'normal', evidence: Object.fromEntries(hs.evidenceSlots.map(slot => [slot.id, { status: 'complete', attachment: { id: 'hs-proof', name: 'hs.jpg', type: 'image/jpeg' } }])) };
assert.equal(round.inspectionItems[ls.id].status, 'pending');
const reopened = normalizeRound(structuredClone(round), [profile], profile);
assert.equal(reopened.inspectionItems[hs.id].status, 'normal');
assert.deepEqual(reopened.inspectionItems[hs.id].evidence[hs.evidenceSlots[0].id].attachment, round.inspectionItems[hs.id].evidence[hs.evidenceSlots[0].id].attachment);
const report = buildReportTemplateModel(reopened);
assert.equal('maCoverage' in report, false);
assert.ok(report.sections.some(section => section.title === 'ทดสอบโปรแกรมและงานตรวจรถ · HS' && section.items.some(item => item.id === hs.id)));
assert.ok(report.sections.some(section => section.title === 'ทดสอบโปรแกรมและงานตรวจรถ · LS' && section.items.some(item => item.id === ls.id)));
const oldSnapshot = createSnapshot(profile);
delete oldSnapshot.automaticSoftwareTestsVersion;
delete oldSnapshot.vehicleReviewSystemsVersion;
delete oldSnapshot.vehicleReviewSystems;
const old = createInspectionRound(profile, {}, { snapshot: oldSnapshot });
assert.ok(getItemsForSnapshot(old.snapshot).some(item => item.id === '6.1.display'));
assert.ok(!getItemsForSnapshot(old.snapshot).some(item => item.automaticSoftwareTest));
assert.equal(normalizeRound(old, [profile], profile).snapshot.automaticSoftwareTestsVersion, undefined);
const broken = makeProfile(['High Speed']);
broken.lanes = [];
assert.equal(getVehicleSystemInstallation(broken).errors.length, 1);
assert.throws(() => createInspectionRound(broken), /Lane/);
const wrongScope = makeProfile(['High Speed']);
wrongScope.lanes[0].scope = 'Low Speed';
assert.throws(() => createInspectionRound(wrongScope), /Lane/);
const off = makeProfile(['High Speed']);
off.stationSystems[0].active = false;
assert.equal(getInstalledVehicleSystems(off).length, 0);
const unrelated = makeProfile([]);
unrelated.stationSystems = [{ id: 'lpr', canonicalItemId: 'lpr-control', scope: 'High Speed', quantity: 1, active: true }];
assert.equal(getInstalledVehicleSystems(unrelated).length, 0);
const imps = createInspectionRound(makeProfile(['ImPS'], 'IMPS'));
assert.deepEqual(imps.snapshot.vehicleReviewSystems.map(s => s.key), ['imps']);
assert.equal(getItemsForSnapshot(imps.snapshot).filter(item => item.automaticSoftwareTest).length, 7);
assert.ok(!getItemsForSnapshot(imps.snapshot).some(item => item.vehicleReviewSystemKey === 'sc-ls'));
assert.ok(!getCanonicalItemsForFormat('SC').some(item => /^wim-(high|low)-(data-control|reporting|display)$/.test(item.id)));
assert.ok(getCanonicalItem('wim-high-reporting'), 'legacy identity must remain readable');
console.log('PASS automatic MA suites: topology, deduplication, old controls, independent evidence, persistence, reports, legacy and IMPS isolation');
