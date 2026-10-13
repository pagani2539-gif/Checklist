import assert from 'node:assert/strict';
import { getVehicleReportScore } from '../src/domain/vehicle-report-summary.js';
const period = (counts, extra = {}) => ({ total: counts.reduce((a,b) => a+b,0), groups: ['correct','incorrect','unable-to-verify','pending'].map((key,index) => ({ key, entries: Array(counts[index]).fill({}) })), ...extra });
for (const counts of [[0,0,0,0], [0,0,0,108]]) {
  const result = getVehicleReportScore(period(counts));
  assert.equal(result.display, '—'); assert.equal(result.accuracy, null);
  assert.equal(result.status, 'ยังไม่สามารถสรุปผลได้');
}
assert.equal(getVehicleReportScore(period([90,10,0,8])).display, '83.33%');
assert.equal(getVehicleReportScore(period([2,1,0,1])).display, '50.00%');
assert.equal(getVehicleReportScore(period([2,1,0,1], { evidencePolicy: true })).display, '50.00%');
assert.equal(getVehicleReportScore(period([2,1,0,1], { sample: { version:'vehicle-sample-v2', eligibilityPolicyVersion: 'policy' } })).display, '50.00%');
assert.equal(getVehicleReportScore(period([0,10,0,0])).display, '0.00%');
assert.equal(getVehicleReportScore(period([100,0,0,8])).status, 'ยังไม่สามารถสรุปผลได้');
assert.equal(getVehicleReportScore(period([100,0,0,0], { outcome: { status:'passed' } })).status, 'ผ่านเกณฑ์');
assert.equal(getVehicleReportScore(period([10,90,0,0], { outcome: { status:'failed' } })).status, 'ไม่ผ่านเกณฑ์');
const insufficient = period([100,0,0,0], { evidencePolicy:true, outcome:{ status:'passed', dataSufficient:false } });
const before = structuredClone(insufficient);
assert.equal(getVehicleReportScore(insufficient).status, 'ยังไม่สามารถสรุปผลได้');
assert.ok(getVehicleReportScore(insufficient).reason.includes('ไม่เพียงพอ'));
assert.deepEqual(insufficient,before);
console.log('PASS report score: original rounding/denominator, null versus zero, outcomes and immutable inputs');

assert.equal(getVehicleReportScore(period([105,2,1,0])).display, '97.22%');
assert.equal(getVehicleReportScore(period([105,0,6,0])).display, '94.59%');
assert.equal(getVehicleReportScore(period([0,0,108,0])).display, '0.00%');
