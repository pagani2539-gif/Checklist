const DELETE_REASONS = new Set(['inspection-round-delete', 'station-delete']);
const identifier = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value) ? value : null;

// Never include state, operation values, credentials, or raw error messages.
export function deletionFailureDiagnostic({ reason, operationId, requestId, status, code, preparationError = false, operationCount } = {}) {
  if (!DELETE_REASONS.has(reason)) return null;
  return {
    event: 'workspace.delete.failed',
    at: new Date().toISOString(),
    reason,
    operationId: identifier(operationId),
    requestId: identifier(requestId),
    status: Number.isInteger(Number(status)) && Number(status) > 0 ? Number(status) : null,
    code: identifier(code),
    phase: preparationError ? 'prepare' : 'save',
    operationCount: Number.isInteger(operationCount) && operationCount >= 0 ? operationCount : null,
  };
}
