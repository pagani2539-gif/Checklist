import assert from 'node:assert/strict';
import { focusedVehicleRoundId } from '../server/vehicle-operation-store.mjs';
import { createTemporaryWorkspaceStore } from './workspace_temp_store.mjs';
import { buildWorkspaceOperations, applyWorkspaceOperations } from '../src/domain/workspace-operations.js';

const base = {stationProfiles:[{id:'s'}],inspectionRounds:[{id:'r',stationId:'s',status:'draft',snapshot:{stationId:'s'},vehicleSearch:{systems:{imps:{plate:{scopes:{day:{rows:[{id:'car',reviewStatus:'pending',reviewDetails:{}}]}}}}}}}],contracts:[{id:'c',contractNo:'1'}],workPackages:[],contractStationAssignments:[]};
const next = structuredClone(base);
next.inspectionRounds[0].vehicleSearch.systems.imps.plate.scopes.day.rows[0].reviewStatus='correct';
const operations=buildWorkspaceOperations(base,next);
assert.equal(focusedVehicleRoundId(operations),'r');
const unsupported=structuredClone(next); unsupported.inspectionRounds[0].snapshot.stationId='other';
assert.equal(focusedVehicleRoundId(buildWorkspaceOperations(base,unsupported)),null);
assert.equal(focusedVehicleRoundId([{type:'set',path:['inspectionRounds',{id:'r'},'vehicleSearch','systems','imps','plate','scopes','day','rows',{id:'car'},'reviewStatus','nested']}]),null);
assert.equal(focusedVehicleRoundId([{type:'check',path:['inspectionRounds',{id:'r'},'status']}]),null);
const archived = structuredClone(next);
archived.inspectionRounds[0].vehicleEvidenceArchive = { car: { plateImage: { id: 'proof' } } };
assert.equal(focusedVehicleRoundId(buildWorkspaceOperations(base,archived)),'r');
assert.equal(focusedVehicleRoundId(buildWorkspaceOperations(next,archived)),'r');
assert.equal(focusedVehicleRoundId(buildWorkspaceOperations(archived,next)),null, 'archive deletions retain the full path');
if (!process.env.CHECKLIST_POSTGRES_TEST_DATABASE_URL) {
  console.log('focused vehicle domain checks passed; PostgreSQL save/reload coverage skipped (set CHECKLIST_POSTGRES_TEST_DATABASE_URL)');
} else {
  const temp=await createTemporaryWorkspaceStore(base);
  try {
    const actor={id:'test',role:'admin'};
    const prepareOperation=(current,ops)=>{
      if (focusedVehicleRoundId(ops)) { assert.deepEqual(current.contracts,[]); assert.equal(current.stationProfiles[0].id,'s'); }
      else assert.deepEqual(current.contracts,base.contracts);
      return applyWorkspaceOperations(current,ops);
    };
    const result=await temp.store.saveOperations({operationId:'vehicle-focused-test',operations},{actor,prepareOperation});
    assert.deepEqual((await temp.store.getState()).state,next);
    const rawState=(await temp.query("SELECT version,payload,payload_version FROM app_state WHERE id='global'")).rows[0];
    assert.deepEqual(rawState.payload,base,'focused vehicle saves must leave the large workspace payload untouched');
    assert.equal(Number(rawState.payload_version),1,'the payload checkpoint stays at its original version while the delta is current');
    assert.equal(Number(rawState.version),result.version,'the global version still advances for conflict checks');
    assert.deepEqual((await temp.query('SELECT data FROM inspection_rounds WHERE id=$1',['r'])).rows[0].data,next.inspectionRounds[0]);
    assert.deepEqual(await temp.store.getRevisionState({query:temp.query},result.version),next);
    assert.ok(temp.queries.some(sql=>sql.includes('SELECT version,updated_at,updated_by')),'focused path must avoid reading the entire payload into Node');
    assert.ok(!temp.queries.some(sql=>sql.includes('SELECT version, payload, updated_at') && sql.includes('FOR UPDATE')));
    const closed=structuredClone(next);closed.inspectionRounds[0].status='closed';
    await temp.store.saveOperations({operationId:'vehicle-focused-close',operations:buildWorkspaceOperations(next,closed)},{actor,prepareOperation});
    const edit=structuredClone(closed);edit.inspectionRounds[0].vehicleSearch.systems.imps.plate.scopes.day.rows[0].reviewStatus='incorrect';
    await assert.rejects(()=>temp.store.saveOperations({operationId:'vehicle-focused-closed-edit',operations:buildWorkspaceOperations(closed,edit)},{actor,prepareOperation}),/immutable/);
    console.log('focused vehicle path, delta materialization, projections/history, fallback and closed-round guard passed');
  } finally {await temp.close();}
}
