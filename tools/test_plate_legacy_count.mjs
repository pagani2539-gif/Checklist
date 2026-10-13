import assert from 'node:assert/strict';
import { replaceVehicleTestDataset } from '../src/domain/vehicle-test-replacement.js';
import { createVehicleReviewState, normalizeVehicleReviewState, getVehicleSearchReviewSummary, getVehicleReviewOutcome } from '../src/domain/vehicle-search.js';
import { buildWorkspaceOperations,applyWorkspaceOperations } from '../src/domain/workspace-operations.js';
import { createTemporaryWorkspaceStore } from './workspace_temp_store.mjs';
const base={version:18,stationProfiles:[],inspectionRounds:[{id:'r',status:'draft',snapshot:{},vehicleSearch:createVehicleReviewState()}],contracts:[],referenceData:{}};
const temp=await createTemporaryWorkspaceStore(base);
try {
 for(const scopeKey of ['day','night'])for(const limit of [0,100]) {
  const before=(await temp.store.getState()).state;
  const criteria=scopeKey==='day'?{startAt:'2026-10-01T06:00',endAt:'2026-10-01T12:00'}:{startAt:'2026-10-01T00:00',endAt:'2026-10-01T06:00'};
  const result={fetchedAt:`2026-10-05T01:0${scopeKey==='day'?0:1}:00Z`,rows:Array.from({length:162},(_,i)=>({id:`${scopeKey}-${i}`,occurredAt:scopeKey==='day'?'2026-10-01T09:00:00+07:00':'2026-10-01T03:00:00+07:00',plateNumber:`P-${i}`,province:'test'}))};
  const next=structuredClone(before);
  next.inspectionRounds[0].vehicleSearch=replaceVehicleTestDataset(before.inspectionRounds[0].vehicleSearch,result,{context:'plate',scopeKey,criteria,limit},{seed:'matrix'});
  await temp.store.saveOperations({operationId:crypto.randomUUID(),operations:buildWorkspaceOperations(before,next)},{actor:{id:'test',role:'admin'},prepareOperation:applyWorkspaceOperations});
  const reloaded=normalizeVehicleReviewState((await temp.store.getState()).state.inspectionRounds[0].vehicleSearch);
  const dataset=reloaded.scopes[scopeKey];
  assert.equal(dataset.rows.length,limit===0?162:100);assert.equal(dataset.sourceRows.length,162);assert.equal(dataset.sample.limit,limit);assert.equal(dataset.sample.version,'vehicle-sample-v1');assert.equal(dataset.sampleEligibilityPolicyVersion,undefined);
  const summary=getVehicleSearchReviewSummary(dataset,{context:'plate'});assert.equal(summary.total,dataset.rows.length);assert.equal(summary.pendingChecks,dataset.rows.length);
  assert.equal(getVehicleReviewOutcome(dataset,{context:'plate'}).status,'incomplete');
  assert.deepEqual(reloaded.scopes[scopeKey==='day'?'night':'day'],normalizeVehicleReviewState(before.inspectionRounds[0].vehicleSearch).scopes[scopeKey==='day'?'night':'day']);
 }
 console.log('PASS day/night x all/100: real isolated PostgreSQL save/reload, scoring totals, pending outcomes, source rows and other-period preservation');
}finally{await temp.close();}
