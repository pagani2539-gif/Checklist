import assert from 'node:assert/strict';
import http from 'node:http';
import { createApi } from '../server/api.mjs';
import { createTemporaryWorkspaceStore } from './workspace_temp_store.mjs';
import { buildWorkspaceOperations } from '../src/domain/workspace-operations.js';

if (!process.env.CHECKLIST_POSTGRES_TEST_DATABASE_URL) {
  console.log('focused vehicle HTTP integration skipped: set CHECKLIST_POSTGRES_TEST_DATABASE_URL');
  process.exit(0);
}
const state = {
  stationProfiles: [{ id: 's', lanes: [], equipment: [], stationSystems: [] }],
  contracts: [], workPackages: [], contractStationAssignments: [],
  inspectionRounds: [{ id: 'r', stationId: 's', status: 'draft', snapshot: { stationId: 's' },
    vehicleSearch: { systems: { imps: { plate: { scopes: { day: { rows: [
      { id: 'first', reviewStatus: 'pending', reviewDetails: {} },
      { id: 'second', reviewStatus: 'pending', reviewDetails: {} },
    ] } } } } } } }],
};
const temp = await createTemporaryWorkspaceStore(state);
let fullReads = 0;
const getState = temp.store.getState.bind(temp.store);
temp.store.getState = async () => { fullReads += 1; return getState(); };
const users = { inspector: { id: 'inspector', role: 'inspector' }, viewer: { id: 'viewer', role: 'viewer' } };
const api = createApi({ store: temp.store, enforceStationScope: true,
  auth: { mode: 'local', authenticate: async request => users[request.headers['x-test-user']],
    requireRole: (user, roles) => { if (!roles.includes(user?.role)) throw Object.assign(Error('Forbidden'), { statusCode: 403 }); } },
  attachmentStore: { kind: 'isolated-test' },
});
const server = http.createServer(async (request, response) => { if (!await api.handle(request, response)) { response.writeHead(404); response.end(); } });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const edit = (index, status) => { const next = structuredClone(state); next.inspectionRounds[0].vehicleSearch.systems.imps.plate.scopes.day.rows[index].reviewStatus = status; return buildWorkspaceOperations(state, next); };
const send = async (operationId, operations, user = 'inspector') => {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/state`, { method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-test-user': user }, body: JSON.stringify({ operationId, operations }) });
  return { status: response.status, body: await response.json() };
};
try {
  const first = edit(0, 'correct');
  assert.equal((await send('focused-viewer-test', first, 'viewer')).status, 403);
  assert.equal((await send('focused-first-test', first)).status, 200);
  assert.equal(fullReads, 0, 'row decisions must not fetch the full workspace before their locked focused transaction');
  const replay = await send('focused-first-test', first);
  assert.equal(replay.status, 200); assert.equal(replay.body.replayed, true);
  assert.equal((await send('focused-conflict-test', edit(0, 'incorrect'))).status, 409);
  assert.equal((await send('focused-second-test', edit(1, 'correct'))).status, 200);
  assert.equal(fullReads, 0, 'focused conflict and replay must also avoid a full workspace read');
  const rawAfterFocusedSaves = (await temp.query("SELECT version,payload,payload_version FROM app_state WHERE id='global'")).rows[0];
  assert.deepEqual(rawAfterFocusedSaves.payload, state, 'focused decisions must be stored as deltas without rewriting app_state.payload');
  assert.equal(Number(rawAfterFocusedSaves.payload_version), 1);
  assert.equal(Number(rawAfterFocusedSaves.version), 3);
  const persisted = (await getState()).state;
  assert.deepEqual(persisted.inspectionRounds[0].vehicleSearch.systems.imps.plate.scopes.day.rows.map(row => row.reviewStatus), ['correct', 'correct']);
  const archived = structuredClone(persisted);
  archived.inspectionRounds[0].vehicleEvidenceArchive = { first: { plateImage: { id: 'uploaded-proof', type: 'image/jpeg' } } };
  archived.inspectionRounds[0].vehicleSearch.systems.imps.plate.scopes.day.rows[0].classificationReviewStatus = 'correct';
  assert.equal((await send('focused-archive-test', buildWorkspaceOperations(persisted, archived))).status, 200);
  assert.equal(fullReads, 0, 'background archive merged into the next decision must retain the focused path');
  const extraArchive = structuredClone(archived);
  extraArchive.inspectionRounds[0].vehicleEvidenceArchive.first.lprImage = { id: 'uploaded-lpr', type: 'image/jpeg' };
  assert.equal((await send('focused-archive-only', buildWorkspaceOperations(archived, extraArchive))).status, 200);
  assert.equal(fullReads, 0, 'standalone background archive metadata must not fetch the full workspace');
  assert.deepEqual((await getState()).state, extraArchive);
  const normal = structuredClone(extraArchive); normal.inspectionRounds[0].inspectionItems = { item: { status: 'normal' } };
  assert.equal((await send('normal-fallback-test', buildWorkspaceOperations(extraArchive, normal))).status, 200);
  assert.equal(fullReads, 1, 'ordinary checklist writes retain their existing preflight path');
  assert.deepEqual((await getState()).state.inspectionRounds[0], normal.inspectionRounds[0], 'a normal operation after focused saves must preserve all materialized vehicle results');
  console.log('focused HTTP saves avoid full reads; inspector permission, viewer rejection, replay, conflict, independent edits and normal fallback passed');
} finally { await new Promise(resolve => server.close(resolve)); await temp.close(); }
