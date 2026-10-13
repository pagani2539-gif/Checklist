import assert from 'node:assert/strict';
import { deleteVehiclePlateRow, deleteVehiclePlateRows } from '../src/domain/vehicle-row-deletion.js';
import { normalizeVehicleSearchState,getVehicleSearchReviewSummary,getVehicleReviewOutcome } from '../src/domain/vehicle-search.js';
import { buildWorkspaceOperations,applyWorkspaceOperations } from '../src/domain/workspace-operations.js';

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
console.log('PASS bulk deletion, unique counts, stale selection, unchanged input, closed and read-only guards');
