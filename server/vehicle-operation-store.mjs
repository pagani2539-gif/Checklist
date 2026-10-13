import crypto from 'node:crypto';
// Vehicle decisions and uploaded vehicle-image references stay inside one
// round. Fetches, checklist evidence, deletions, closing a round, and edits
// spanning rounds retain the full workspace transaction path.
export function focusedVehicleRoundId(operations) {
  if (!Array.isArray(operations) || !operations.length || operations.length > 50) return null;
  const id = operations[0]?.path?.[1]?.id;
  if (typeof id !== 'string' || !id) return null;
  let changed = false;
  const matches = operations.every(op => {
    const p = op?.path;
    if (!Array.isArray(p) || p[0] !== 'inspectionRounds' || p[1]?.id !== id) return false;
    if (op.type === 'check') return true;
    if (op.type === 'touch' && p.length === 3 && p[2] === 'updatedAt') return true;
    const archive = op.type === 'set' && p[2] === 'vehicleEvidenceArchive'
      && p.slice(3).every(part => typeof part === 'string');
    const rows = p.indexOf('rows');
    const dataset = rows === 3 || rows === 5 && p[3] === 'scopes' || rows === 8 && p[3] === 'systems' && p[6] === 'scopes';
    const decision = op.type === 'set' && p[2] === 'vehicleSearch' && dataset && typeof p[rows+1]?.id === 'string'
      && ['reviewStatus','classificationReviewStatus','reviewDetails'].includes(p[rows+2])
      && (p.length === rows+3 || p[rows+2] === 'reviewDetails' && p.length > rows+3);
    changed ||= decision || archive;
    return decision || archive;
  });
  return matches && changed ? id : null;
}

export async function saveFocusedVehicleOperations(store, operation, options, id) {
  await store.ready;
  const ops = operation.operations;
    const client=await store.pool.connect();
    try {
      await client.query('BEGIN');
      const global=(await client.query("SELECT version,updated_at,updated_by FROM app_state WHERE id='global' FOR UPDATE")).rows[0];
      if (!global) throw Object.assign(Error('Workspace not found'), {statusCode:409});
      const hash=crypto.createHash('sha256').update(JSON.stringify({operations:ops,reason:options.reason||'state-update'})).digest('hex');
      const actor=options.actor;const actorKey=String(actor?.id||actor?.role||'anonymous');
      const receipt=(await client.query('SELECT actor_id,request_hash,result FROM workspace_operations WHERE operation_id=$1',[operation.operationId])).rows[0];
      if(receipt){
        if(receipt.actor_id!==actorKey||receipt.request_hash!==hash)throw Object.assign(Error('Operation identity already used'),{statusCode:409});
        await client.query('COMMIT');return {...receipt.result,replayed:true};
      }
      const record=(await client.query('SELECT data AS round FROM inspection_rounds WHERE id=$1 FOR UPDATE',[id])).rows[0];
      if(!record)throw Object.assign(Error('Round not found'),{statusCode:409});
      const round=record.round;
      if(round.status==='closed')throw Object.assign(Error('Closed inspection round is immutable'),{statusCode:409});
      // Focused decisions only touch the round and do not alter shared topology.
      // Read the existing station projection instead of detoasting the workspace.
      const station=(await client.query('SELECT data FROM stations WHERE id=$1',[round.stationId || round.snapshot?.stationId || ''])).rows[0]?.data;
      if(!station)throw Object.assign(Error('Station not found'),{statusCode:409});
      const current={stationProfiles:[station],inspectionRounds:[round],contracts:[],workPackages:[],contractStationAssignments:[]};
      // Existing API authorization, conditional edits and connection checks run here.
      const next=await options.prepareOperation(current,ops);
      const nextRound=next.inspectionRounds.find(r=>r.id===id);
      const version=Number(global.version)+1,updatedAt=new Date().toISOString(),actorId=actor?.id||null;
      const roundOps=ops.map(op=>({...op,path:op.path.slice(2)}));
      const existing=(await client.query('SELECT 1 FROM state_revisions WHERE state_version=$1 LIMIT 1',[Number(global.version)])).rows.length;
      if(!existing)await client.query("INSERT INTO state_revisions(state_version,payload,created_at,created_by,reason) SELECT version,payload,$1,$2,'operation-baseline' FROM app_state WHERE id='global'",[updatedAt,actorId]);
      // The full state is materialized from this acknowledged delta on reads.
      // Keep the global version row small; the round projection is updated below.
      await client.query("UPDATE app_state SET version=$1,updated_at=$2,updated_by=$3 WHERE id='global'",[version,updatedAt,actorId]);
      await client.query('INSERT INTO state_revisions(state_version,payload,created_at,created_by,reason) VALUES($1,$2::jsonb,$3,$4,$5)',[version,JSON.stringify({_workspaceDeltaV1:true,operations:ops.filter(op=>op.type!=='check')}),updatedAt,actorId,options.reason||'state-update']);
      await store.syncProjections(client,next,{updatedAt,actorId,previous:current,operations:ops});
      await store.auditWithClient(client,'state.update',actor,'state','global',{version,reason:options.reason||'state-update'},options.requestId);
      const result={version,updatedAt,updatedBy:actorId,operationId:operation.operationId};
      await client.query('INSERT INTO workspace_operations(operation_id,actor_id,request_hash,result) VALUES($1,$2,$3,$4::jsonb)',[operation.operationId,actorKey,hash,JSON.stringify(result)]);
      await client.query('COMMIT');return result;
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
