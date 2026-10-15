import assert from 'node:assert/strict';
import { createDefaultStationProfile, createSnapshot, createInspectionRound, normalizeRound, getItemsForSnapshot, getCloseReadiness, getChecklistItemsProgress, buildInspectionSections } from '../src/domain/master-checklist.js';
import { getChecklistPageQueueGroups, getVehicleReviewQueueProgress } from '../src/app/checklist-queue-state.js';
import { getBoqChecklistDisplaySections } from '../src/domain/boq-checklist-groups.js';
import { getInstalledVehicleSystems, getSystemVehicleSearch, setSystemVehicleSearch, projectVehicleRound, normalizeSystemVehicleSearch } from '../src/domain/vehicle-review-systems.js';
import { createVehicleReviewState, getVehicleReviewState, updateVehicleSearchScope, searchVehicles, buildVehicleSearchPayload } from '../src/domain/vehicle-search.js';
import { buildReportTemplateModel } from '../src/domain/report-template.js';
import { buildVehicleSnapshotEvidencePages } from '../src/domain/vehicle-snapshot-evidence.js';
import { normalizeServerChecklistState } from '../src/domain/storage.js';
import { replaceVehicleTestDataset } from '../src/domain/vehicle-test-replacement.js';
import { vehicleEvidenceRowKey } from '../src/domain/vehicle-evidence-images.js';

function profileFor(scopes, format = 'SC') {
  const profile = createDefaultStationProfile();
  profile.stationFormat = format;
  profile.stationSystems = scopes.map((scope, index) => ({ id: `system-${index}`, canonicalItemId: 'wim-sorting', laneId: `lane-${index}`, scope, quantity: 1, active: true }));
  profile.lanes = scopes.map((scope, index) => ({ id: `lane-${index}`, laneNo: index + 1, scope, active: true }));
  profile.equipment = profile.equipment.map(asset => ({ ...asset, scope: scopes[0] || "Station-wide" }));
  profile.vehicleSearchConfig = { systems: Object.fromEntries(scopes.map(scope => {
    const key = format === 'IMPS' ? 'imps' : scope === 'High Speed' ? 'sc-hs' : 'sc-ls';
    return [key, { baseUrl: `http://${key}.test:3005`, stationId: 'api-station', stationName: 'API station',
      ...(key === 'imps' ? { connectionMode: 'proxy', proxyHost: 'proxy.test', proxyPort: 8080 } : {}) }];
  })) };
  return profile;
}

for (const [scopes, format, keys] of [
  [['High Speed'], 'SC', ['sc-hs']], [['Low Speed'], 'SC', ['sc-ls']],
  [['High Speed', 'Low Speed'], 'SC', ['sc-hs', 'sc-ls']], [['ImPS'], 'IMPS', ['imps']], [[], 'SC', []],
]) {
  const profile = profileFor(scopes, format);
  assert.deepEqual(getInstalledVehicleSystems(profile).map(s => s.key), keys);
  const round = createInspectionRound(profile, { inspectionDate: '2026-10-03' }, !keys.length ? { snapshot: createSnapshot(profile) } : {});
  const items = getItemsForSnapshot(round.snapshot).filter(item => item.vehicleReviewSystemKey);
  assert.equal(items.length, keys.length * 9);
  const sections = buildInspectionSections(round.snapshot);
  const groups = getChecklistPageQueueGroups(sections, format, round.snapshot);
  for (const key of keys.filter(key => key.startsWith('sc-'))) {
    const title = `DATA/CONTROL CENTRAL FOR ${key === 'sc-hs' ? 'HS' : 'LS'}`;
    const group = groups.find(group => group.title === title);
    assert.ok(group, `missing ${title}`);
    const groupedItems = group.sections.flatMap(section => section.items);
    assert.equal(groupedItems.length, 9);
    assert.ok(groupedItems.every(item => item.vehicleReviewSystemKey === key));
    assert.equal(getBoqChecklistDisplaySections(round.snapshot, sections).filter(section => section.items.some(item => item.vehicleReviewSystemKey === key)).flatMap(section => section.items).length, 9);
  }
  assert.deepEqual(Object.keys(round.vehicleSearch.systems), keys);
  assert.equal(getCloseReadiness(round).blockers.filter(b => b.type === 'vehicle-search-fetch').length, keys.length * 3);
  const reopened = normalizeRound(JSON.parse(JSON.stringify(round)), [profile], profile);
  assert.deepEqual(reopened.vehicleSearch, round.vehicleSearch);
  for (const key of keys) {
    for (const context of ['plate', 'classification']) {
      assert.deepEqual(Object.keys(getSystemVehicleSearch(round, key, context).scopes), ['day', 'night']);
      assert.equal(getVehicleReviewState(round.vehicleSearch, { systemKey: key, context }).key, 'not-fetched');
    }
    assert.equal(round.snapshot.vehicleReviewSystems.find(s => s.key === key).config.apiProfile, key === 'imps' ? 'imps-v2' : 'legacy-v1');
  }
}

const profile = profileFor(['High Speed', 'Low Speed']);
let round = createInspectionRound(profile, { inspectionDate: '2026-10-03' });
const hsQueueGroup = getChecklistPageQueueGroups(buildInspectionSections(round.snapshot), 'SC', round.snapshot).find(group => group.title === 'DATA/CONTROL CENTRAL FOR HS');
const hsGroupItems = hsQueueGroup.sections.flatMap(section => section.items);
const hsReviewItems = hsGroupItems.filter(item => item.vehicleReviewSystemKey === 'sc-hs' && item.vehicleReviewContext);
const initialChecklistProgress = getChecklistItemsProgress(hsGroupItems, round);
assert.deepEqual({ done: initialChecklistProgress.done, total: initialChecklistProgress.total, pending: initialChecklistProgress.pending }, { done: 0, total: 7, pending: 7 }, 'ordinary checklist work keeps its own count');
assert.deepEqual(getVehicleReviewQueueProgress(hsReviewItems, round), { total: 2, done: 0, pending: 2, progress: 0 }, 'unfetched review tasks stay pending in the queue summary');
const reviewedContext = (context) => {
  const state = createVehicleReviewState();
  state.independentContext = context;
  const scopeKeys = context === 'classification' ? ['day'] : ['day', 'night'];
  state.scopes = {
    ...state.scopes,
    ...Object.fromEntries(scopeKeys.map((scopeKey) => [scopeKey, {
      ...state.scopes[scopeKey],
      fetchedAt: '2026-10-03T03:00:00.000Z',
      rows: [{ id: `${context}-${scopeKey}`, occurredAt: scopeKey === 'night' ? '2026-10-03T20:00:00+07:00' : '2026-10-03T10:00:00+07:00', reviewStatus: 'correct', classificationReviewStatus: 'correct' }],
    }])),
  };
  return state;
};
const reviewedRound = {
  ...round,
  vehicleSearch: { systems: { 'sc-hs': { plate: reviewedContext('plate'), classification: reviewedContext('classification') } } },
};
assert.deepEqual(getVehicleReviewQueueProgress(hsReviewItems, reviewedRound), { total: 2, done: 2, pending: 0, progress: 100 }, 'recorded vehicle review tasks are complete in the queue summary');
const reviewedChecklistProgress = getChecklistItemsProgress(hsGroupItems, reviewedRound);
assert.deepEqual({ done: reviewedChecklistProgress.done, total: reviewedChecklistProgress.total, pending: reviewedChecklistProgress.pending }, { done: 0, total: 7, pending: 7 }, 'recording vehicle reviews does not mark separate system checks complete');
const unableToVerifyContext = (context) => {
  const state = reviewedContext(context);
  state.scopes = Object.fromEntries(Object.entries(state.scopes).map(([scopeKey, scope]) => [scopeKey, {
    ...scope,
    rows: scope.rows.map(row => ({ ...row, reviewStatus: 'unable-to-verify', classificationReviewStatus: 'unable-to-verify' })),
  }]));
  return state;
};
const unableToVerifyRound = {
  ...round,
  vehicleSearch: { systems: { 'sc-hs': { plate: unableToVerifyContext('plate'), classification: unableToVerifyContext('classification') } } },
};
assert.equal(getVehicleReviewState(unableToVerifyRound.vehicleSearch, { reviewVersion: round.snapshot.vehicleReviewVersion, context: 'plate', systemKey: 'sc-hs' }).key, 'recorded-unverified', 'the sample with unable-to-verify decisions is recorded');
assert.deepEqual(getVehicleReviewQueueProgress(hsReviewItems, unableToVerifyRound), { total: 2, done: 2, pending: 0, progress: 100 }, 'unable-to-verify is a saved review decision, not pending work');
const savedConfig = structuredClone(round.snapshot.vehicleReviewSystems);
profile.vehicleSearchConfig.systems['sc-hs'].baseUrl = 'http://changed.test';
assert.deepEqual(round.snapshot.vehicleReviewSystems, savedConfig, 'snapshot endpoints are frozen');
let plate = getSystemVehicleSearch(round, 'sc-hs', 'plate');
plate = updateVehicleSearchScope(plate, 'day', { ...plate.scopes.day, fetchedAt: '2026-10-03T03:00:00Z', sourceStation: { id: 'api-station', name: 'API station' }, rows: [{ id: 'same-id', plateNumber: 'HS plate', occurredAt: '2026-10-03T10:00:00+07:00', reviewStatus: 'correct', plateImage: 'crop/hs.jpg' }] });
round = setSystemVehicleSearch(round, 'sc-hs', 'plate', plate);
assert.equal(getSystemVehicleSearch(round, 'sc-hs', 'plate').scopes.day.rows[0].plateNumber, 'HS plate');
assert.equal(getSystemVehicleSearch(round, 'sc-ls', 'plate').scopes.day.rows.length, 0);
assert.equal(getSystemVehicleSearch(round, 'sc-hs', 'classification').scopes.day.rows.length, 0);
assert.equal(getSystemVehicleSearch(round, 'sc-hs', 'plate').scopes.night.fetchedAt, null);
assert.equal(getCloseReadiness(round).blockers.filter(b => b.type === 'vehicle-search-fetch').length, 5);
const classification = updateVehicleSearchScope(getSystemVehicleSearch(round, 'sc-ls', 'classification'), 'night', { fetchedAt: '2026-10-03T15:00:00Z', rows: [{ id: 'same-id', plateNumber: 'LS class', occurredAt: '2026-10-03T21:00:00+07:00', classificationReviewStatus: 'incorrect', overviewImage: 'overview/ls.jpg' }] });
round = setSystemVehicleSearch(round, 'sc-ls', 'classification', classification);
const stored = normalizeServerChecklistState({ stationProfiles: [profile], inspectionRounds: [round] });
assert.deepEqual(stored.inspectionRounds.find(entry => entry.id === round.id).vehicleSearch, round.vehicleSearch, 'storage preserves each system dataset');
const replaced = replaceVehicleTestDataset(getSystemVehicleSearch(round, 'sc-ls', 'classification'), { fetchedAt: '2026-10-03T15:00:00Z', rows: [{ id: 'replacement', occurredAt: '2026-10-03T10:00:00+07:00' }] }, { context: 'plate', scopeKey: 'day', criteria: { startAt: '2026-10-03T06:00', endAt: '2026-10-03T18:00' }, limit: 0 });
assert.equal(replaced.scopes.day.rows[0].id, 'replacement');
assert.equal(replaced.scopes.night.rows[0].id, 'same-id', 'night history stays stored');
const model = buildReportTemplateModel(round);
assert.equal(model.vehicleSearch.systems.length, 2);
const pages = buildVehicleSnapshotEvidencePages(model.vehicleSearch);
assert.ok(pages.some(page => page.systemKey === 'sc-hs' && page.dimension === 'plate' && page.total === 1));
assert.ok(!pages.some(page => page.dimension === 'classification' && page.period.key === 'night'));
assert.ok(pages.some(page => page.systemKey === 'sc-ls' && page.dimension === 'classification' && page.period.key === 'day' && page.total === 0));
assert.ok(!pages.some(page => page.systemKey === 'sc-hs' && page.dimension === 'classification' && page.total));
assert.notEqual(vehicleEvidenceRowKey(getSystemVehicleSearch(round, 'sc-hs', 'plate').scopes.day.rows[0]), vehicleEvidenceRowKey(getSystemVehicleSearch(round, 'sc-ls', 'classification').scopes.night.rows[0]));
assert.ok(getSystemVehicleSearch(round, 'sc-hs', 'plate').scopes.day.rows[0].plateImage.includes('systemKey=sc-hs'));
assert.equal(projectVehicleRound(round, 'sc-ls', 'classification').snapshot.vehicleReviewSystemLabel, 'LS');

const legacySnapshot = structuredClone(round.snapshot);
delete legacySnapshot.vehicleReviewSystemsVersion;
delete legacySnapshot.vehicleReviewSystems;
const oldData = createVehicleReviewState();
oldData.scopes.day.rows = [{ id: 'historical', plateNumber: 'old plate' }];
const oldRound = createInspectionRound(profile, {}, { snapshot: legacySnapshot, vehicleSearch: oldData });
const oldReopened = normalizeRound(JSON.parse(JSON.stringify(oldRound)), [profile], profile);
assert.equal(oldReopened.snapshot.vehicleReviewSystemsVersion, undefined);
assert.equal(oldReopened.vehicleSearch.systems, undefined);
assert.equal(oldReopened.vehicleSearch.scopes.day.rows[0].plateNumber, 'old plate');

const one = profileFor(['High Speed']);
one.vehicleSearchConfig = { baseUrl: 'http://legacy.test', stationId: 'legacy', stationName: 'Legacy' };
assert.equal(createInspectionRound(one).snapshot.vehicleReviewSystems[0].config.baseUrl, 'http://legacy.test');
const multiple = profileFor(['High Speed', 'Low Speed']);
multiple.vehicleSearchConfig = one.vehicleSearchConfig;
assert.throws(() => createInspectionRound(multiple), /IP/);
one.vehicleSearchConfig = {};
assert.ok(getCloseReadiness(createInspectionRound(one)).blockers.some(b => b.message === 'ยังไม่ได้ตั้งค่าการเชื่อมต่อ'));
assert.equal(normalizeSystemVehicleSearch(oldData, round.snapshot).systems['sc-hs'].plate.scopes.day.rows.length, 0, 'never fan out legacy results');

for (const key of ['sc-hs', 'sc-ls', 'imps']) {
  const requests = [];
  const apiProfile = key === 'imps' ? 'imps-v2' : 'legacy-v1';
  await searchVehicles({ dateFrom: '2026-10-03', dateTo: '2026-10-03' }, { baseUrl: `http://${key}.test`, apiProfile, systemKey: key, roundId: round.id, stationProfileId: profile.id, transport: 'direct-first', fetchImpl: async (url, options) => {
    requests.push({ url, body: JSON.parse(options.body) });
    return { ok: true, status: 200, text: async () => JSON.stringify({ data: [] }) };
  } });
  if (key === 'imps') {
    assert.equal(requests[0].url, '/api/vehicle/search');
    assert.equal(requests[0].body.systemKey, key);
    assert.equal(requests[0].body.roundId, round.id);
    assert.ok('startDateTime' in requests[0].body.payload);
  } else {
    assert.equal(requests[0].url, `http://${key}.test/api/vehicle/search`);
    assert.deepEqual(requests[0].body, buildVehicleSearchPayload({ dateFrom: '2026-10-03', dateTo: '2026-10-03' }));
    assert.ok(!('systemKey' in requests[0].body), 'SC upstream payload is unchanged');
  }
}
console.log('vehicle review system isolation, snapshots, reports and transport passed');
