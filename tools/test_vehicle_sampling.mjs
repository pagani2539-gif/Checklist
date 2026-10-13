import assert from 'node:assert/strict';
import { selectVehicleTestSample } from '../src/domain/vehicle-sampling.js';
import { normalizeVehicleSearchState, updateVehicleSearchDimensionReview, getNextPendingVehicleId, getVehicleSearchReviewSummary, getVehicleReviewOutcome } from '../src/domain/vehicle-search.js';
import { getVehicleSampleEligibilitySummary, updateVehicleSampleEligibility, VEHICLE_SAMPLE_ELIGIBILITY_POLICY_VERSION } from '../src/domain/vehicle-sample-eligibility.js';
const rows = Array.from({length:256}, (_,index)=>({id:`car-${index}`,occurredAt:new Date(Date.UTC(2026,9,1,11,index)).toISOString(),plateNumber:index%3?'83-0256':'ไม่พบผลอ่านป้าย',province:index%3?'กาญจนบุรี':null,reviewStatus:'pending'}));
const result=selectVehicleTestSample({rows,fetchedAt:'2026-10-02T12:00:00Z'}, {limit:100,seed:'fixed',lockedAt:'2026-10-02T12:00:00Z'});
assert.equal(result.rows.length,100);
assert.equal(result.sourceRows.length,256);
assert.equal(new Set(result.rows.map(row=>row.id)).size,100);
assert.deepEqual(result.rows,selectVehicleTestSample({rows:[...rows].reverse()},{limit:100,seed:'fixed',lockedAt:'2026-10-02T12:00:00Z'}).rows);
assert.ok(result.rows.some(row=>row.plateNumber==='ไม่พบผลอ่านป้าย'), 'unreadable results remain eligible');
assert.ok(Number(result.rows.at(-1).id.slice(4))>250,'sample spans the full interval');
assert.deepEqual(selectVehicleTestSample(result,{limit:100,seed:'another'}),result,'locked samples cannot be rerolled');
assert.throws(()=>selectVehicleTestSample({rows:rows.map((row,index)=>index===0?{...row,reviewStatus:'correct'}:row)},{limit:100,seed:'fixed'}),/เริ่มตรวจ/);
const normalized=normalizeVehicleSearchState(result);
assert.equal(normalized.sourceRows.length,256);
assert.deepEqual(normalized.sample.selectedIds,result.sample.selectedIds);
const reviewed=updateVehicleSearchDimensionReview(normalized,normalized.rows[0].id,'plate','correct');
assert.equal(reviewed.sample.seed,'fixed');
assert.equal(reviewed.sourceRows.length,256);
assert.equal(selectVehicleTestSample({rows:rows.slice(0,62)},{limit:100,seed:'fixed'}).rows.length,62);
console.log('PASS locked time-distributed 100 samples, raw provenance, unreadable eligibility and review preservation');
assert.throws(()=>selectVehicleTestSample({rows},{limit:NaN}),/ไม่ถูกต้อง/);
const decisions=normalizeVehicleSearchState({rows:[{...rows[0],reviewStatus:'unable-to-verify'},{...rows[1],reviewStatus:'pending'}]});
assert.equal(getNextPendingVehicleId(decisions,{context:'plate',includeUnableToVerify:false}),rows[1].id);
const finished=updateVehicleSearchDimensionReview(decisions,rows[1].id,'plate','correct');
assert.equal(getNextPendingVehicleId(finished,{context:'plate',includeUnableToVerify:false}),null);
assert.equal(getVehicleSearchReviewSummary(finished,{context:'plate'}).pendingChecks,0);
assert.equal(getVehicleSearchReviewSummary(finished,{context:'plate'}).unableToVerifyChecks,1);
console.log('PASS completed decisions stay separate from unverifiable outcomes');

const apiRows = Array.from({ length: 4 }, (_, index) => ({
  id: `api-${index}`,
  occurredAt: `2026-10-01T0${8 + index}:00:00+07:00`,
  plateNumber: index === 0 ? 'ไม่พบผลอ่านป้าย' : '83-0256',
  province: index === 0 ? null : 'กาญจนบุรี',
  plateImage: `/plate-${index}.jpg`,
  reviewStatus: 'pending',
}));
let triage = normalizeVehicleSearchState({ fetchedAt: '2026-10-02T12:00:00Z', sampleEligibilityPolicyVersion: VEHICLE_SAMPLE_ELIGIBILITY_POLICY_VERSION, rows: apiRows, sourceRows: apiRows });
assert.throws(() => selectVehicleTestSample(triage, { limit: 100, seed: 'before-triage', requireEligibility: true }), /คัดข้อมูลต้นทางไม่ครบ/);
triage = updateVehicleSampleEligibility(triage, 'api-0', 'eligible', { reviewer: { id: 'reviewer-1', displayName: 'ผู้ตรวจ' }, reviewedAt: '2026-10-02T13:00:00Z' });
triage = updateVehicleSampleEligibility(triage, 'api-1', 'eligible', { reviewer: { id: 'reviewer-1', displayName: 'ผู้ตรวจ' }, reviewedAt: '2026-10-02T13:01:00Z' });
triage = updateVehicleSampleEligibility(triage, 'api-2', 'excluded', { reasonCode: 'plate-unreadable', reviewer: { id: 'reviewer-1', displayName: 'ผู้ตรวจ' }, reviewedAt: '2026-10-02T13:02:00Z' });
triage = updateVehicleSampleEligibility(triage, 'api-3', 'excluded', { reasonCode: 'wrong-vehicle-image', note: 'ภาพคนละคัน', reviewer: { id: 'reviewer-1', displayName: 'ผู้ตรวจ' }, reviewedAt: '2026-10-02T13:03:00Z' });
const triageRoundTrip = normalizeVehicleSearchState(JSON.parse(JSON.stringify(triage)));
assert.equal(triageRoundTrip.sourceRows.length, 4, 'the full API source remains available');
assert.equal(triageRoundTrip.sourceRows[0].sampleEligibility.reviewedByName, 'ผู้ตรวจ');
assert.equal(triageRoundTrip.sourceRows[0].sampleEligibility.reviewedAt, '2026-10-02T13:00:00Z');
assert.deepEqual(getVehicleSampleEligibilitySummary(triageRoundTrip), { total: 4, pending: 0, eligible: 2, excluded: 2, byReason: { 'plate-unreadable': 1, 'wrong-vehicle-image': 1 } });
const eligibleSample = selectVehicleTestSample(triageRoundTrip, { limit: 100, seed: 'after-triage', lockedAt: '2026-10-02T14:00:00Z', requireEligibility: true });
assert.equal(eligibleSample.rows.length, 2, 'a clear photo stays scoreable even when the API has no plate or province');
assert.deepEqual(new Set(eligibleSample.rows.map(row => row.id)), new Set(['api-0', 'api-1']));
assert.equal(eligibleSample.sourceRows.length, 4);
assert.equal(eligibleSample.sample.version, 'vehicle-sample-v2');
assert.equal(eligibleSample.sample.eligibleCount, 2);
assert.equal(eligibleSample.sample.excludedCount, 2);
assert.equal(getVehicleReviewOutcome(eligibleSample, { context: 'plate' }).status, 'incomplete', 'a locked set below 100 cannot pass');
assert.throws(() => updateVehicleSampleEligibility(normalizeVehicleSearchState({ rows: [{ id: 'no-image' }] }), 'no-image', 'eligible'), /ไม่มีภาพจากต้นทาง/);
const allExcluded = normalizeVehicleSearchState({ fetchedAt: '2026-10-02T12:00:00Z', sampleEligibilityPolicyVersion: VEHICLE_SAMPLE_ELIGIBILITY_POLICY_VERSION, rows: [{ ...apiRows[2], sampleEligibility: { status: 'excluded', reasonCode: 'plate-unreadable' } }] });
const emptyScoreSet = selectVehicleTestSample(allExcluded, { limit: 100, seed: 'empty', lockedAt: '2026-10-02T14:00:00Z', requireEligibility: true });
assert.equal(emptyScoreSet.sample.lockedAt, '2026-10-02T14:00:00Z');
assert.equal(emptyScoreSet.rows.length, 0);

const thresholdRows = Array.from({ length: 200 }, (_, index) => ({ ...apiRows[1], id: `threshold-${index}`, reviewStatus: index < 159 ? 'correct' : 'incorrect', sampleEligibility: { status: 'eligible' } }));
const exactBoundary = normalizeVehicleSearchState({ fetchedAt: '2026-10-02T12:00:00Z', sampleEligibilityPolicyVersion: VEHICLE_SAMPLE_ELIGIBILITY_POLICY_VERSION, rows: thresholdRows, sourceRows: thresholdRows, sample: { version: 'vehicle-sample-v2', eligibilityPolicyVersion: VEHICLE_SAMPLE_ELIGIBILITY_POLICY_VERSION, eligibleCount: 200, excludedCount: 0, sourceCount: 200, limit: 100, seed: 'boundary', lockedAt: '2026-10-02T14:00:00Z' } });
const boundaryOutcome = getVehicleReviewOutcome(exactBoundary, { context: 'plate' });
assert.equal(boundaryOutcome.summary.accuracy, 79.5);
assert.equal(boundaryOutcome.summary.accuracyExact, 79.5);
assert.equal(boundaryOutcome.status, 'failed', '79.50% must fail an 80% threshold despite whole-number display rounding');

const legacyBoundaryRows = thresholdRows.map((row, index) => ({ ...row, id: `legacy-${index}` }));
const oldSnapshot = normalizeVehicleSearchState({ fetchedAt: '2026-10-02T12:00:00Z', rows: legacyBoundaryRows, sample: { version: 'vehicle-sample-v1', sourceCount: 200, limit: 100, seed: 'legacy', lockedAt: '2026-10-02T14:00:00Z' } });
assert.equal(getVehicleReviewOutcome(oldSnapshot, { context: 'plate' }).status, 'passed', 'legacy v1 retains its preexisting rounded threshold rule');
console.log('PASS pre-score image eligibility, source preservation, reviewer audit, insufficient samples, exact boundary and legacy v1 compatibility');
