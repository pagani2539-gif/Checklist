import assert from 'node:assert/strict';
import { getVehicleReviewOutcome, VEHICLE_API_REVIEW_VERSION } from '../src/domain/vehicle-search.js';
import { buildVehicleApiReportModel } from '../src/domain/vehicle-report.js';
for (const [context,correct,expected] of [['plate',159,'failed'],['plate',160,'passed'],['classification',179,'failed'],['classification',180,'passed']]) {
 const statusKey=context==='plate'?'reviewStatus':'classificationReviewStatus';
 const dataset={fetchedAt:'2026-10-06T03:00:00Z',criteria:{startAt:'2026-10-06T06:00',endAt:'2026-10-06T12:00'},rows:Array.from({length:200},(_,i)=>({id:String(i),occurredAt:'2026-10-06T09:00:00+07:00',[statusKey]:i<correct?'correct':'incorrect'}))};
 assert.equal(getVehicleReviewOutcome(dataset,{context}).status,expected,`${context}: raw ${correct/2}% must be ${expected}`);
 const model=buildVehicleApiReportModel({id:'boundary',snapshot:{vehicleReviewVersion:VEHICLE_API_REVIEW_VERSION},vehicleSearch:dataset},{context});
 assert.equal(model.outcome.status,expected,'report must use the same threshold');
 assert.equal(model.summary.accuracy,correct/2,'report must show actual percentage');
}
console.log('PASS raw thresholds and report agree at 79.5/80 and 89.5/90');
