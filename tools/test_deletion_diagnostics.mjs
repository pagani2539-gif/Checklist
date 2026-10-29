import assert from 'node:assert/strict';
import { deletionFailureDiagnostic } from '../src/domain/deletion-diagnostics.js';

for (const reason of ['station-delete', 'inspection-round-delete']) {
  const entry = deletionFailureDiagnostic({ reason, operationId: 'operation-1', requestId: 'request-1',
    status: 409, code: 'WORKSPACE_OPERATION_CONFLICT', operationCount: 4,
    state: { password: 'secret' }, message: 'secret', operations: [{ value: 'secret' }] });
  assert.equal(entry.event, 'workspace.delete.failed');
  assert.equal(entry.status, 409);
  assert.equal(entry.requestId, 'request-1');
  assert.equal(entry.operationId, 'operation-1');
  assert.equal(entry.operationCount, 4);
  assert.equal(JSON.stringify(entry).includes('secret'), false);
}
assert.equal(deletionFailureDiagnostic({ reason: 'state-update' }), null);
const invalid = deletionFailureDiagnostic({ reason: 'station-delete', requestId: 'token=secret', code: 'password secret', preparationError: true });
assert.equal(invalid.requestId, null);
assert.equal(invalid.code, null);
assert.equal(invalid.phase, 'prepare');
assert.equal(invalid.status, null);
console.log('deletion diagnostics: correlation, delete-only scope, and sensitive-data exclusion passed');
