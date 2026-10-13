import assert from 'node:assert/strict';
import {getVehicleSearchReviewSummary,getVehicleReviewOutcome,VEHICLE_API_REVIEW_VERSION} from '../src/domain/vehicle-search.js';
import {buildVehicleApiReportModel} from '../src/domain/vehicle-report.js';
for(const context of ['plate','classification']) {
 const key=context==='plate'?'reviewStatus':'classificationReviewStatus';
 for(const [count,correct,expected] of [[99,93,93.94],[100,94,94],[100,0,0]]) {
  const data={fetchedAt:'2026-10-06T03:00:00Z',criteria:{startAt:'2026-10-06T06:00',endAt:'2026-10-06T12:00'},rows:Array.from({length:count},(_,i)=>({id:String(i),occurredAt:'2026-10-06T09:00:00+07:00',[key]:i<correct?'correct':'unable-to-verify'}))};
  assert.equal(getVehicleSearchReviewSummary(data,{context}).accuracy,expected);
  assert.equal(getVehicleReviewOutcome(data,{context}).status,correct?'passed':'failed');
  const report=buildVehicleApiReportModel({id:'test',snapshot:{vehicleReviewVersion:VEHICLE_API_REVIEW_VERSION},vehicleSearch:data},{context});
  assert.equal(report.summary.accuracy,expected);
  assert.equal(report.outcome.status,correct?'passed':'failed');
 }
}
console.log('PASS total denominator, unable counted as recorded, score/report agreement, all unable fails');
