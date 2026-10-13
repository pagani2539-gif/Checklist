import assert from 'node:assert/strict';
import { createDefaultStationProfile, createInspectionRound, normalizeRound, getCloseReadiness } from '../src/domain/master-checklist.js';
import { adoptRoundVehicleConnection, getRoundVehicleSearchConfig } from '../src/domain/round-vehicle-connection.js';
import { getVehicleSystemConfig, getInstalledVehicleSystems, projectVehicleRound, setSystemVehicleSearch } from '../src/domain/vehicle-review-systems.js';
import { normalizeServerChecklistState } from '../src/domain/storage.js';
import { buildWorkspaceOperations, applyWorkspaceOperations } from '../src/domain/workspace-operations.js';
import { buildVehicleApiReportModel } from '../src/domain/vehicle-report.js';
import { createRevisionRound } from '../src/domain/correction.js';
import { assertRoundVehicleConnectionUpdates } from '../server/round-vehicle-connection.mjs';
import { createTemporaryWorkspaceStore } from './workspace_temp_store.mjs';

const profile = createDefaultStationProfile();
profile.vehicleSearchConfig = { baseUrl: '' };
const original = createInspectionRound(profile);
original.updatedAt = '2026-10-10T05:00:00Z';
const opening = JSON.stringify(original.snapshot);
profile.vehicleSearchConfig = { systems: { 'sc-hs': { baseUrl: 'http://new-api.test:3005' } } };
const system = getInstalledVehicleSystems(profile).find(system => system.key === 'sc-hs');
const latest = getVehicleSystemConfig(profile, system);
assert.equal(getRoundVehicleSearchConfig(original, system.key).baseUrl, '');
const adopted = adoptRoundVehicleConnection(original, latest, { systemKey: system.key, at: '2026-10-11T05:00:00Z', userLabel: 'ผู้ตรวจ' });
const beforeAdoption = { stationProfiles: [profile], inspectionRounds: [original] };
assert.doesNotThrow(() => assertRoundVehicleConnectionUpdates(beforeAdoption, { inspectionRounds: [adopted] }, { displayName: 'ผู้ตรวจ' }));
const forged = structuredClone(adopted);
forged.vehicleConnectionUpdates['sc-hs'].config.baseUrl = 'http://unapproved.test';
assert.throws(() => assertRoundVehicleConnectionUpdates(beforeAdoption, { inspectionRounds: [forged] }, { displayName: 'ผู้ตรวจ' }));
assert.throws(() => assertRoundVehicleConnectionUpdates(beforeAdoption, { inspectionRounds: [adopted] }, { displayName: 'ผู้อื่น' }));
assert.equal(JSON.stringify(adopted.snapshot), opening);
assert.deepEqual(adopted.inspectionItems, original.inspectionItems);
assert.deepEqual(adopted.vehicleSearch, original.vehicleSearch);
assert.equal(projectVehicleRound(adopted, system.key).snapshot.vehicleSearchConfig.baseUrl, latest.baseUrl);
assert.equal(getRoundVehicleSearchConfig(adopted, system.key).roundId, original.id);
assert.equal(getCloseReadiness(adopted).blockers.some(entry => entry.type === 'vehicle-search-config'), false);
assert.equal(adopted.vehicleConnectionUpdates['sc-hs'].history[0].previous.baseUrl, '');
const loaded = normalizeRound(JSON.parse(JSON.stringify(adopted)), [profile], profile);
assert.deepEqual(loaded.vehicleConnectionUpdates, adopted.vehicleConnectionUpdates);
const central = normalizeServerChecklistState({ stationProfiles: [profile], inspectionRounds: [adopted] });
assert.equal(getRoundVehicleSearchConfig(central.inspectionRounds[0], system.key).baseUrl, latest.baseUrl);
profile.vehicleSearchConfig.systems['sc-hs'].baseUrl = 'http://later-api.test:3005';
assert.equal(getRoundVehicleSearchConfig(adopted, system.key).baseUrl, latest.baseUrl);
assert.throws(() => adoptRoundVehicleConnection({ ...adopted, status: 'closed' }, latest, { systemKey: system.key }), /ยังเปิด/);
assert.throws(() => adoptRoundVehicleConnection(adopted, latest, { systemKey: 'sc-ls' }), /ไม่พบระบบ/);
assert.throws(() => adoptRoundVehicleConnection(original, {}, { systemKey: system.key }), /ให้ครบ/);

let fetched = setSystemVehicleSearch(adopted, system.key, 'classification', {
  scopes: { day: { fetchedAt: '2026-10-11T05:10:00Z', rows: [], criteria: {} }, night: {} },
});
assert.throws(() => adoptRoundVehicleConnection(fetched, latest, { systemKey: system.key }), /ชุดข้อมูลรถแล้ว/);
const closed = { ...fetched, status: 'closed' };
assert.equal(getRoundVehicleSearchConfig(closed, system.key).baseUrl, latest.baseUrl);
assert.equal(getRoundVehicleSearchConfig(createRevisionRound(closed, { reason: 'แก้ไขผลตรวจที่บันทึกไว้' }), system.key).baseUrl, latest.baseUrl);
assert.ok(buildVehicleApiReportModel(projectVehicleRound(closed, system.key)));

const before = { inspectionRounds: [original] };
const after = { inspectionRounds: [adopted] };
const operations = buildWorkspaceOperations(before, after);
const savedRound = applyWorkspaceOperations(before, operations).inspectionRounds[0];
assert.equal(JSON.stringify(savedRound), JSON.stringify(adopted));
assert.throws(() => applyWorkspaceOperations({ inspectionRounds: [{ ...original, status: 'closed' }] }, operations), /conflict/);
const concurrentFetch = structuredClone(original);
concurrentFetch.vehicleSearch.systems['sc-hs'].plate.scopes.night.fetchedAt = 'other-user-fetch';
assert.throws(() => applyWorkspaceOperations({ inspectionRounds: [concurrentFetch] }, operations), /conflict/);

const legacy = { ...original, snapshot: { ...original.snapshot } };
delete legacy.snapshot.vehicleReviewSystems;
delete legacy.snapshot.vehicleReviewSystemsVersion;
const legacyAdopted = adoptRoundVehicleConnection(legacy, latest);
assert.equal(getRoundVehicleSearchConfig(legacyAdopted).baseUrl, latest.baseUrl);
assert.equal(JSON.stringify(legacyAdopted.snapshot), JSON.stringify(legacy.snapshot));

const multiProfile = createDefaultStationProfile();
multiProfile.stationSystems = ['High Speed', 'Low Speed'].map((scope, index) => ({ id: `wim-${index}`, canonicalItemId: 'wim-sorting', scope, laneId: `lane-${index}`, quantity: 1, active: true }));
multiProfile.lanes = ['High Speed', 'Low Speed'].map((scope, index) => ({ id: `lane-${index}`, scope, laneNo: 1, active: true }));
multiProfile.vehicleSearchConfig = { systems: { 'sc-hs': { baseUrl: 'http://hs.test:3005' }, 'sc-ls': { baseUrl: 'http://ls.test:3005' } } };
const multi = createInspectionRound(multiProfile);
multi.vehicleSearch.systems['sc-ls'].plate.scopes.day.fetchedAt = 'existing-ls-fetch';
const multiAdopted = adoptRoundVehicleConnection(multi, latest, { systemKey: 'sc-hs' });
assert.deepEqual(multiAdopted.vehicleSearch.systems['sc-ls'], multi.vehicleSearch.systems['sc-ls']);
assert.equal(getRoundVehicleSearchConfig(multiAdopted, 'sc-ls').baseUrl, 'http://ls.test:3005');
assert.throws(() => adoptRoundVehicleConnection(multiAdopted, {}, { systemKey: 'sc-ls' }), /ชุดข้อมูลรถแล้ว/);
const impsProfile = createDefaultStationProfile();
impsProfile.stationFormat = 'IMPS';
impsProfile.stationSystems = [{ id: 'imps-wim', canonicalItemId: 'wim-sorting', scope: 'ImPS', laneId: 'imps-lane', active: true, quantity: 1 }];
impsProfile.lanes = [{ id: 'imps-lane', scope: 'ImPS', active: true, laneNo: 1 }];
impsProfile.vehicleSearchConfig = { baseUrl: '' };
const imps = createInspectionRound(impsProfile);
impsProfile.vehicleSearchConfig = { systems: { imps: { baseUrl: 'http://imps.test:3005', connectionMode: 'proxy', proxyHost: 'proxy.test', proxyPort: 8080 } } };
const impsSystem = getInstalledVehicleSystems(impsProfile)[0];
const impsConfig = getVehicleSystemConfig(impsProfile, impsSystem);
const impsAdopted = adoptRoundVehicleConnection(imps, impsConfig, { systemKey: 'imps' });
assert.equal(getRoundVehicleSearchConfig(impsAdopted, 'imps').apiProfile, 'imps-v2');
assert.ok(getRoundVehicleSearchConfig(impsAdopted, 'imps').searchUrl.includes('/api?target='));
assert.equal(getCloseReadiness(impsAdopted).blockers.some(entry => entry.type === 'vehicle-search-config'), false);
console.log('PASS receiving API after opening, immutable Snapshot/results, reload, closed/revision history, system isolation and concurrent fetch/close guards');
if (process.env.CHECKLIST_POSTGRES_TEST_DATABASE_URL) {
  const persistedProfile = structuredClone(profile);
  persistedProfile.vehicleSearchConfig.systems['sc-hs'].baseUrl = latest.baseUrl;
  const seed = { stationProfiles: [persistedProfile], inspectionRounds: [original] };
  const next = { ...seed, inspectionRounds: [adopted] };
  const temp = await createTemporaryWorkspaceStore(seed);
  try {
    await temp.store.saveOperations({ operationId: crypto.randomUUID(), operations: buildWorkspaceOperations(seed, next) }, {
      actor: { id: 'test', role: 'admin', displayName: 'ผู้ตรวจ' }, prepareOperation: (current, ops) => {
        const incoming = applyWorkspaceOperations(current, ops);
        assertRoundVehicleConnectionUpdates(current, incoming, { displayName: 'ผู้ตรวจ' });
        return incoming;
      },
    });
    const saved = (await temp.store.getState()).state.inspectionRounds[0];
    assert.deepEqual(saved.snapshot, original.snapshot);
    assert.equal(getRoundVehicleSearchConfig(saved, 'sc-hs').baseUrl, latest.baseUrl);
    const projection = (await temp.query('SELECT data FROM pg_temp.inspection_rounds WHERE id=$1', [original.id])).rows[0].data;
    assert.equal(getRoundVehicleSearchConfig(projection, 'sc-hs').baseUrl, latest.baseUrl);
    console.log('PASS isolated PostgreSQL receiving API, reload and round projection');
  } finally { await temp.close(); }
} else console.log('PostgreSQL receiving API test skipped: no database configured');
