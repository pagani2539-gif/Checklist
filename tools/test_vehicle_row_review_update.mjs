import assert from 'node:assert/strict';
import {createUiVehicleSystemsDemoRound} from '../src/domain/demo-fixture.js';
import {updateSystemVehicleRowReview,getSystemVehicleSearch} from '../src/domain/vehicle-review-systems.js';
import {getVehicleReviewDetail,normalizeVehicleSearchState} from '../src/domain/vehicle-search.js';

for(const format of ['SC','IMPS']){
 const round=createUiVehicleSystemsDemoRound(format);
 for(const system of round.snapshot.vehicleReviewSystems){
  for(const context of ['plate','classification']){
   for(const scopeKey of ['day','night']){
    const dataset=round.vehicleSearch.systems[system.key][context];
    const scope=dataset.scopes[scopeKey];
    if(!scope.rows.length)continue;
    const row=scope.rows[0];
    const expectedScope={fetchedAt:scope.fetchedAt,criteria:scope.criteria,sample:scope.sample};
    const options={systemKey:system.key,context,scopeKey,rowId:row.id,reviewStatus:'incorrect',detailPatch:{correctedValue:'verified',reasonCode:'other',reviewedAt:'2026-10-06T00:00:00Z'},expectedScope,expectedRow:row};
    const before=structuredClone(round);
    const next=updateSystemVehicleRowReview(round,options);
    assert.deepEqual(round,before,'input must stay unchanged');
    assert.equal(next.snapshot,round.snapshot,'snapshot reference unchanged');
    for(const other of round.snapshot.vehicleReviewSystems){
     if(other.key!==system.key)assert.equal(next.vehicleSearch.systems[other.key],round.vehicleSearch.systems[other.key],'other system unchanged');
    }
    const nextDataset=next.vehicleSearch.systems[system.key][context];
    assert.equal(next.vehicleSearch.systems[system.key][context==='plate'?'classification':'plate'],round.vehicleSearch.systems[system.key][context==='plate'?'classification':'plate']);
    assert.equal(nextDataset.scopes[scopeKey==='day'?'night':'day'],dataset.scopes[scopeKey==='day'?'night':'day']);
    assert.equal(nextDataset.scopes[scopeKey].sourceRows,scope.sourceRows);
    assert.equal(nextDataset.scopes[scopeKey].rows[1],scope.rows[1]);
    const updated=nextDataset.scopes[scopeKey].rows[0];
    for(const key of ['plateImage','lprImage','overviewImage','raw'])assert.equal(updated[key],row[key],`${key} unchanged`);
    assert.equal(updated[context==='plate'?'reviewStatus':'classificationReviewStatus'],'incorrect');
    assert.equal(getVehicleReviewDetail(updated,context).history.at(-1).correctedValue,'verified');
    assert.throws(()=>updateSystemVehicleRowReview({...round,status:'closed'},options),/ปิด/);
    assert.throws(()=>updateSystemVehicleRowReview(next,options),/เปลี่ยน/,'stale row must not overwrite a later decision');
    assert.throws(()=>updateSystemVehicleRowReview(round,{...options,expectedScope:{...expectedScope,fetchedAt:'different'}}),/เปลี่ยน/);
    assert.throws(()=>updateSystemVehicleRowReview(round,{...options,rowId:'missing'}),/ไม่พบ/);
    const projection=getSystemVehicleSearch(next,system.key,context);
    assert.equal(projection.scopes[scopeKey].rows[0][context==='plate'?'reviewStatus':'classificationReviewStatus'],'incorrect');
   }
  }
 }
}
console.log('PASS row review updates preserve other systems, scopes, rows, image references and Snapshot; stale/closed decisions rejected');

const imageRow={id:'shared',plateImage:'/api/vehicle/image?baseUrl=http%3A%2F%2Fstation.test&path=crop%2Fshared.jpg'};
const options={baseUrl:'http://station.test',stationProfileId:'station-a',systemKey:'sc-hs',roundId:'round-a'};
const first=normalizeVehicleSearchState({rows:[imageRow]}, {}, options).rows[0];
const reviewed=normalizeVehicleSearchState({rows:[{...imageRow,reviewStatus:'correct'}]}, {}, options).rows[0];
assert.equal(reviewed.plateImage,first.plateImage);
assert.equal(reviewed.reviewStatus,'correct','image cache must not cache row results');
for(const patch of [{stationProfileId:'station-b'},{systemKey:'sc-ls'},{roundId:'round-b'},{baseUrl:'http://changed.test'},{apiProfile:'imps-v2'}]){
 const changed=normalizeVehicleSearchState({rows:[imageRow]}, {}, {...options,...patch}).rows[0];
 assert.notEqual(changed.plateImage,first.plateImage,'routing changes must invalidate cached image reference');
}
console.log('PASS image reference reuse keeps changed review data and routing isolated');
