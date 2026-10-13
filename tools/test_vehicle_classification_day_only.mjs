import assert from 'node:assert/strict';
import { createVehicleReviewState, updateVehicleSearchScope, getVehicleReviewScopeEntries, getVehicleSearchReviewSummary, getVehicleReviewState, getVehicleReviewOutcome, getDaytimeVehicleClassificationDataset } from '../src/domain/vehicle-search.js';
import { buildVehicleSnapshotEvidencePages } from '../src/domain/vehicle-snapshot-evidence.js';
import { replaceVehicleTestDataset } from '../src/domain/vehicle-test-replacement.js';

let value = { ...createVehicleReviewState({ dateFrom: '2026-10-04' }), independentContext: 'classification' };
value = updateVehicleSearchScope(value, 'day', { fetchedAt: '2026-10-04T05:00:00Z', criteria: { startAt: '2026-10-04T06:00', endAt: '2026-10-04T18:00' }, rows: [{ id: 'day', occurredAt: '2026-10-04T10:00:00+07:00', classificationReviewStatus: 'correct' }] });
value = updateVehicleSearchScope(value, 'night', { fetchedAt: '2026-10-04T15:00:00Z', rows: [{ id: 'night', occurredAt: '2026-10-04T20:00:00+07:00', classificationReviewStatus: 'pending' }] });
const original = structuredClone(value);
assert.deepEqual(getVehicleReviewScopeEntries(value).map(entry => entry.key), ['day']);
assert.equal(getVehicleSearchReviewSummary(value, { context: 'classification' }).total, 1);
assert.equal(getVehicleReviewState(value, { context: 'classification' }).key, 'complete');
assert.equal(getVehicleReviewOutcome(value, { context: 'classification' }).status, 'passed');
const report = { independentContext: 'classification', scoped: true, scopes: Object.entries(value.scopes).map(([scope, state]) => ({ scope, ...state })) };
for (const scope of ['all', 'day', 'night']) {
  const pages = buildVehicleSnapshotEvidencePages(report, { context: 'classification', scope });
  assert.ok(pages.length);
  assert.ok(pages.every(page => page.period.key === 'day'));
  assert.equal(pages.find(page => page.kind === 'summary').total, 1);
}
assert.deepEqual(value, original, 'reading results must preserve historical night data');
const legacy = { ...value.scopes.day, rows: [...value.scopes.day.rows, ...value.scopes.night.rows] };
assert.equal(getDaytimeVehicleClassificationDataset(legacy).rows.length, 1);
assert.equal(getVehicleSearchReviewSummary(legacy, { context: 'classification' }).pendingChecks, 0);
assert.equal(legacy.rows.length, 2, 'legacy single datasets retain night rows');
const legacyPages = buildVehicleSnapshotEvidencePages({ rows: legacy.rows, supportsClassification: true });
assert.equal(legacyPages.find(page => page.dimension === 'classification' && page.kind === 'summary').total, 1);
const plate = { ...value, independentContext: 'plate' };
assert.deepEqual(getVehicleReviewScopeEntries(plate).map(entry => entry.key), ['day', 'night']);
assert.equal(getVehicleReviewState(plate, { context: 'plate' }).key, 'reviewing');
assert.throws(() => replaceVehicleTestDataset(value, { fetchedAt: 'now', rows: value.scopes.night.rows }, { context: 'plate', scopeKey: 'night', criteria: { startAt: '2026-10-04T18:00', endAt: '2026-10-05T06:00' }, limit: 0 }), /กลางวัน/);
console.log('classification day-only results, reports and historical data preservation passed');
