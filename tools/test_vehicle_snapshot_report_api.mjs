import assert from 'node:assert/strict';
import http from 'node:http';
import { createApi } from '../server/api.mjs';
const archive = { car: { plateImage: { id: 'stored-image', type: 'image/png' } } };
const api = createApi({ attachmentStore: {}, store: { listRounds: async () => [{ id: 'fixture', stationId: 'fixture-station', status: 'closed', vehicleEvidenceArchive: archive }], audit: async () => {} }, auth: { authenticate: async () => ({ id: 'fixture-user', role: 'admin' }), requireRole: () => {} } });
const server = http.createServer((request, response) => void api.handle(request, response));
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/rounds/fixture/report`);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).report.vehicleEvidenceArchive, archive);
  console.log('PASS report API includes persisted image references');
} finally { await new Promise(resolve => server.close(resolve)); }
