import assert from 'node:assert/strict';
import { deleteVehicleReviewRow, getVehicleDeletionDataset } from '../src/domain/vehicle-row-deletion.js';
import { getVehicleSearchReviewSummary, normalizeVehicleReviewState, normalizeVehicleSearchState } from '../src/domain/vehicle-search.js';
import { buildWorkspaceOperations, applyWorkspaceOperations } from '../src/domain/workspace-operations.js';
const rows = ['pending', 'correct', 'incorrect', 'unable-to-verify'].map((status, i) => ({ id: `r${i}`, occurredAt: '2026-10-01T09:00:00+07:00', reviewStatus: status, classificationReviewStatus: status }));
const dataset = { rows, sourceRows: rows, fetchedAt: '2026-10-01T03:00:00Z', criteria: { startAt: '2026-10-01T06:00', endAt: '2026-10-01T12:00' }, sample: { limit: 100, lockedAt: 'locked' } };
for (const context of ['plate', 'classification']) {
  const value = { scopeVersion: 'vehicle-review-scopes-v1', independentContext: context, scopes: { day: dataset, night: dataset } };
  for (const row of rows) {
    const next = deleteVehicleReviewRow(value, context, 'day', row.id);
    assert.equal(next.scopes.day.rows.length, 3);
    assert.deepEqual(next.scopes.night, getVehicleDeletionDataset(value, context, 'night'));
    assert.equal(getVehicleSearchReviewSummary(next.scopes.day, {context}).total, 3);
    assert.ok(!next.scopes.day.sourceRows.some(r => r.id === row.id));
    const state = { inspectionRounds: [{id:'round', vehicleSearch: {systems: {sc: {[context]:value, other:dataset}}}}] };
    const changed = structuredClone(state);
    changed.inspectionRounds[0].vehicleSearch.systems.sc[context] = next;
    const restored = applyWorkspaceOperations(state, buildWorkspaceOperations(state, changed));
    assert.deepEqual(restored.inspectionRounds[0].vehicleSearch.systems.sc[context], next);
    assert.deepEqual(restored.inspectionRounds[0].vehicleSearch.systems.sc.other.rows, dataset.rows);
    assert.deepEqual(JSON.parse(JSON.stringify(restored)), restored);
    assert.throws(() => deleteVehicleReviewRow(value, context, 'day', row.id, {}, {}, {readOnly:true}));
    assert.throws(() => deleteVehicleReviewRow(value, context, 'day', row.id, {}, {}, {roundStatus:'closed'}));
  }
}
const night = {...rows[0], id:'night', occurredAt:'2026-10-01T21:00:00+07:00'};
for (const value of [ {...dataset, rows:[...rows, night]}, { scopeVersion:'vehicle-review-scopes-v1', scopes:{day:dataset, night:dataset}, classification:{...dataset, rows:[...rows,night]} } ]) {
  const next = deleteVehicleReviewRow(value, 'classification', 'day', 'r0');
  const saved = next.classification || next;
  assert.ok(saved.rows.some(r => r.id === 'night'));
  assert.ok(!saved.rows.some(r => r.id === 'r0'));
  if (value.scopes) assert.deepEqual(next.scopes, value.scopes);
}
console.log('PASS queue deletion parity, all review statuses, workspace persistence, context isolation, legacy night preservation and closed/history guards');

if (process.env.CHECKLIST_POSTGRES_TEST_DATABASE_URL) {
  const { createTemporaryWorkspaceStore } = await import('./workspace_temp_store.mjs');
  const value = { scopeVersion:'vehicle-review-scopes-v1', scopes:{day:dataset,night:dataset}, classification:dataset };
  const base = {version:18, stationProfiles:[], inspectionRounds:[{id:'queue-parity',status:'draft',snapshot:{},vehicleSearch:value}], contracts:[],referenceData:{}};
  const temp = await createTemporaryWorkspaceStore(base);
  try {
    const changed = structuredClone(base);
    changed.inspectionRounds[0].vehicleSearch = deleteVehicleReviewRow(value, 'classification', 'day', 'r0');
    await temp.store.saveOperations({operationId:crypto.randomUUID(),operations:buildWorkspaceOperations(base,changed)}, {actor:{id:'test',role:'admin'},prepareOperation:applyWorkspaceOperations});
    const saved = (await temp.store.getState()).state.inspectionRounds[0].vehicleSearch;
    assert.equal(saved.classification.rows.length,3);
    assert.ok(!saved.classification.rows.some(r=>r.id==='r0'));
    assert.deepEqual(normalizeVehicleReviewState(saved).scopes, normalizeVehicleReviewState(value).scopes);
    console.log('PASS classification deletion PostgreSQL save/reload with plate scopes preserved');
  } finally { await temp.close(); }
}
