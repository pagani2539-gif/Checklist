import assert from 'node:assert/strict';
import { deleteVehiclePlateRow, deleteVehiclePlateRows } from '../src/domain/vehicle-row-deletion.js';
import { normalizeVehicleSearchState,getVehicleSearchReviewSummary,getVehicleReviewOutcome } from '../src/domain/vehicle-search.js';
import { buildWorkspaceOperations,applyWorkspaceOperations } from '../src/domain/workspace-operations.js';
import { createTemporaryWorkspaceStore } from './workspace_temp_store.mjs';
const rows=['pending','correct','incorrect','unable-to-verify'].map((reviewStatus,i)=>({id:`car-${i}`,reviewStatus,plateNumber:`P-${i}`,province:'test',reviewDetails:{plate:{note:'saved'}}}));
const dataset={fetchedAt:'2026-10-05T00:00:00Z',criteria:{startAt:'2026-10-01T06:00',endAt:'2026-10-01T12:00'},rows,sourceRows:[...rows,{id:'not-selected',reviewStatus:'pending'}],sample:{version:'vehicle-sample-v1',method:'time-stratified-v1',limit:100,lockedAt:'locked',sourceCount:5,selectedIds:rows.map(r=>r.id)}};
const bulk = deleteVehiclePlateRows(dataset, ['car-0', 'car-1', 'car-0']);
assert.deepEqual(bulk.rows.map(row=>row.id), ['car-2', 'car-3']);
assert.equal(bulk.sample.deletedRowCount,2);
assert.ok(bulk.sourceRows.some(row=>row.id==='not-selected'));
assert.throws(()=>deleteVehiclePlateRows(dataset,['car-0','missing']));
assert.equal(dataset.rows.length,4);
assert.throws(()=>deleteVehiclePlateRows(dataset,['car-0','car-1'],{roundStatus:'closed'}));
assert.throws(()=>deleteVehiclePlateRows(dataset,['car-0'],{readOnly:true}));
if (!process.env.CHECKLIST_POSTGRES_TEST_DATABASE_URL) {
 console.log('PASS vehicle row-deletion domain guards; PostgreSQL save/reload coverage skipped (set CHECKLIST_POSTGRES_TEST_DATABASE_URL)');
} else {
 const base={version:18,stationProfiles:[],inspectionRounds:[{id:'r',status:'draft',snapshot:{},vehicleSearch:{scopes:{day:dataset,night:structuredClone(dataset)},classification:structuredClone(dataset)}}],contracts:[],referenceData:{}};
 const original=structuredClone(base);
 const temp=await createTemporaryWorkspaceStore(base);
 try {
 for(const scope of ['day','night']){
  for(const row of rows){
   const current=(await temp.store.getState()).state;const next=structuredClone(current);
   next.inspectionRounds[0].vehicleSearch.scopes[scope]=deleteVehiclePlateRow(current.inspectionRounds[0].vehicleSearch.scopes[scope],row.id);
   const ops=buildWorkspaceOperations(current,next);assert.ok(ops.length<=2);
   const concurrent=structuredClone(current);concurrent.inspectionRounds[0].vehicleSearch.scopes[scope].rows[0].reviewStatus='incorrect';
   if(JSON.stringify(concurrent)!==JSON.stringify(current))assert.throws(()=>applyWorkspaceOperations(concurrent,ops),/conflict/i);
   await temp.store.saveOperations({operationId:crypto.randomUUID(),operations:ops},{actor:{id:'test',role:'admin'},prepareOperation:applyWorkspaceOperations});
   const saved=(await temp.store.getState()).state;assert.deepEqual(saved,next);
   const reloaded=normalizeVehicleSearchState(saved.inspectionRounds[0].vehicleSearch.scopes[scope]);
   assert.ok(!reloaded.rows.some(r=>r.id===row.id));assert.ok(!reloaded.sourceRows.some(r=>r.id===row.id));assert.equal(reloaded.sample.method,'manually-adjusted');assert.equal(reloaded.sample.sourceCount,reloaded.sourceRows.length);assert.deepEqual(reloaded.sample.selectedIds,reloaded.rows.map(r=>r.id));
   assert.equal(getVehicleSearchReviewSummary(reloaded,{context:'plate'}).total,reloaded.rows.length);
   assert.deepEqual(saved.inspectionRounds[0].vehicleSearch.classification,original.inspectionRounds[0].vehicleSearch.classification);
  }
  const empty=normalizeVehicleSearchState((await temp.store.getState()).state.inspectionRounds[0].vehicleSearch.scopes[scope]);assert.equal(empty.rows.length,0);assert.ok(empty.sample.adjustedAt);assert.notEqual(getVehicleReviewOutcome(empty,{context:'plate'}).status,'passed');assert.equal(empty.emptyResultAcknowledgedAt,null);
 }
 assert.deepEqual(base,original);assert.throws(()=>deleteVehiclePlateRow(dataset,'car-0',{roundStatus:'closed'}));assert.throws(()=>deleteVehiclePlateRow(dataset,'car-0',{readOnly:true}));assert.throws(()=>deleteVehiclePlateRow(dataset,'missing'));
 const all=deleteVehiclePlateRow({...dataset,sample:{...dataset.sample,limit:0,method:'all'}},'car-0');assert.equal(all.sample.limit,0);assert.equal(all.rows.length,3);assert.ok(all.sourceRows.some(r=>r.id==='not-selected'));
 console.log('PASS scoped deletion across review statuses, PostgreSQL save/reload, scores, zero rows, no refill, concurrent edits, closed guards and other-context preservation');
 }finally{await temp.close();}
}
