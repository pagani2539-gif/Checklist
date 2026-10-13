// Compact, conditional changes to the existing central workspace document.
// All callers use this seam; server permissions and Snapshot guards still apply.
const TRANSIENT = new Set(['ui', 'activeRoundId', 'activeStationId', 'items', 'inspectionSnapshot', 'meta', 'lastSaved']);
const ROOTS = new Set(['version', 'assetNoScopeVersion', 'inspectionTemplateVersion', 'schemaVersion', 'stationProfiles', 'inspectionRounds', 'inspectionHistory', 'inspectionWorkspaces', 'itemCatalog', 'regions', 'referenceData', 'contracts', 'workPackages', 'contractStationAssignments', 'contractWorkReports', 'contractAgreementCovers', 'inspectionRoundContextLinks', 'stationInspectionReports', 'deletedRoundIds', 'deletedStationIds', 'impsPurgePendingAttachmentIds', 'impsPurgeVersion', 'videoPurgeVersion', 'videoPurgePendingAttachmentIds', 'checklistCopy', 'masterChecklistCopy']);
const FORBIDDEN = new Set(['__proto__', 'prototype', 'constructor']);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const copy = value => value === undefined ? undefined : structuredClone(value);
const equal = (a, b) => {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => equal(v, b[i]));
  if (object(a) && object(b)) { const keys = Object.keys(a); return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && equal(a[key], b[key])); }
  return false;
};
const keyed = value => Array.isArray(value) && value.every(v => object(v) && typeof v.id === 'string' && v.id && !FORBIDDEN.has(v.id)) && new Set(value.map(v => v.id)).size === value.length;
const conflict = () => Object.assign(new Error('Workspace changed; reload before saving (conflict)'), { statusCode: 409, code: 'WORKSPACE_OPERATION_CONFLICT' });
function read(root, path) {
  let value = root;
  for (const part of path) {
    if (object(part)) { if (!Array.isArray(value)) return undefined; value = value.find(v => v?.id === part.id); }
    else { if (!object(value) || !Object.hasOwn(value, part)) return undefined; value = value[part]; }
  }
  return value;
}
function validPath(path) {
  if (!Array.isArray(path) || !path.length || path.length > 40 || !ROOTS.has(path[0])) throw Object.assign(new Error('Invalid workspace path'), { statusCode: 400 });
  for (const part of path) if (!(typeof part === 'string' && part && !FORBIDDEN.has(part) || object(part) && Object.keys(part).length === 1 && typeof part.id === 'string' && part.id && !FORBIDDEN.has(part.id))) throw Object.assign(new Error('Invalid workspace path'), { statusCode: 400 });
}
export function buildWorkspaceOperations(previous = {}, next = {}) {
  const operations = [];
  const guards = new Map();
  function guard(path) { const key = JSON.stringify(path); if (!guards.has(key)) { const value = read(previous, path); guards.set(key, { type: 'check', path, exists: value !== undefined, ...(value !== undefined ? { before: copy(value) } : {}) }); } }
  function walk(before, value, path) {
    if (equal(before, value)) return;
    // A newly fetched vehicle dataset is one replacement, not thousands of
    // field edits. Checking its entire previous value also protects reviews
    // recorded by another inspector while the replacement was being fetched.
    if (path.includes('vehicleSearch') && object(before) && object(value)
      && Array.isArray(before.rows) && Array.isArray(value.rows)
      && (!equal(before.fetchedAt, value.fetchedAt) || !equal(before.sample?.adjustedAt, value.sample?.adjustedAt) || !equal(before.sample?.deletedRowCount, value.sample?.deletedRowCount))) {
      operations.push({ type: 'set', path, exists: true, before: copy(before), value: copy(value) });
      return;
    }
    if (object(before) && object(value)) { for (const key of new Set([...Object.keys(before), ...Object.keys(value)])) walk(before[key], value[key], [...path, key]); return; }
    if (keyed(before) && keyed(value)) {
      const old = new Map(before.map(v => [v.id, v])); const fresh = new Map(value.map(v => [v.id, v]));
      for (const id of old.keys()) if (!fresh.has(id)) walk(old.get(id), undefined, [...path, { id }]);
      for (let i = value.length - 1; i >= 0; i--) { const start = operations.length; walk(old.get(value[i].id), value[i], [...path, { id: value[i].id }]); if (!old.has(value[i].id) && operations.length > start) operations.at(-1).beforeId = value[i + 1]?.id || null; }
      const oldOrder = before.filter(v => fresh.has(v.id)).map(v => v.id);
      const newOrder = value.filter(v => old.has(v.id)).map(v => v.id);
      if (!equal(oldOrder,newOrder)) operations.push({ type: 'order', path, before: before.map(v => v.id), value: value.map(v => v.id), exists: true });
      return;
    }
    const type = value === undefined ? 'remove' : path.at(-1) === 'updatedAt' && typeof value === 'string' ? 'touch' : 'set';
    operations.push({ type, path, exists: before !== undefined, ...(before !== undefined ? { before: copy(before) } : {}), ...(value !== undefined ? { value: copy(value) } : {}) });
  }
  for (const key of new Set([...Object.keys(previous), ...Object.keys(next)])) {
    if (TRANSIENT.has(key)) continue;
    if (!ROOTS.has(key)) { if (!equal(previous[key], next[key])) throw new Error(`Unsupported workspace field: ${key}`); continue; }
    walk(previous[key], next[key], [key]);
  }
  for (const op of operations) {
    if (op.path[0] === 'inspectionRounds' && object(op.path[1])) {
      const roundPath = op.path.slice(0, 2);
      if (read(previous, roundPath)) guard([...roundPath, 'status']);
      if (op.path[2] === 'status' && op.value === 'closed') guard(roundPath);
      // Receiving a connection must conflict with an intervening fetch/review.
      if (op.path[2] === 'vehicleConnectionUpdates') {
        guard([...roundPath, 'vehicleSearch']);
        guard([...roundPath, 'snapshot']);
      }
      const rowsIndex = op.path.findIndex(part => part === 'rows' || part === 'sourceRows');
      if (op.path.includes('vehicleSearch') && rowsIndex > 0) for (const key of ['criteria', 'fetchedAt', 'sample']) guard([...op.path.slice(0, rowsIndex), key]);
    }
  }
  return [...guards.values(), ...operations];
}

// The rendered view may contain compatibility/default fields that are absent
// from central storage. Compile only the user's edits, then condition them on
// the actual central values rather than persisting the view's normalization.
export function prepareWorkspaceViewUpdate(central, view, nextView) {
  const intent = buildWorkspaceOperations(view, nextView);
  const checks = intent.filter(op => op.type === 'check').map(op => {
    const before = read(central, op.path);
    return { type: 'check', path: op.path, exists: before !== undefined, ...(before !== undefined ? { before: copy(before) } : {}) };
  });
  const changes = [];
  for (const op of intent.filter(op => op.type !== 'check')) {
    let path = op.path;
    for (let length = 1; length < path.length; length++) {
      const prefix = path.slice(0, length);
      const actual = read(central, prefix);
      const visible = read(view, prefix);
      if (actual === undefined || Array.isArray(actual) !== Array.isArray(visible) || object(actual) !== object(visible)) {
        path = prefix;
        break;
      }
    }
    const before = read(central, path);
    const lifted = path.length !== op.path.length;
    const orderNeedsReplacement = op.type === 'order' && (!Array.isArray(before)
      || !equal(before.map(row => row.id), op.before));
    const type = lifted || orderNeedsReplacement ? 'set' : op.type;
    if (type === 'remove' && before === undefined) continue;
    const change = { ...op, type, path, exists: before !== undefined };
    delete change.before;
    if (before !== undefined) change.before = copy(type === 'order' ? before.map(row => row.id) : before);
    if (lifted || orderNeedsReplacement) change.value = copy(read(nextView, path));
    const isPrefix = (a, b) => a.length <= b.length && equal(a, b.slice(0, a.length));
    if (changes.some(existing => equal(existing.path, path) || existing.type === 'set' && isPrefix(existing.path, path))) continue;
    for (let index = changes.length - 1; index >= 0; index--) if (type === 'set' && isPrefix(path, changes[index].path)) changes.splice(index, 1);
    changes.push(change);
  }
  const operations = changes.length ? [...checks, ...changes] : [];
  return { operations, state: operations.length ? applyWorkspaceOperations(central, operations) : central };
}
export function applyWorkspaceOperations(current, operations, { check = true } = {}) {
  if (!Array.isArray(operations) || operations.length > 10000) throw Object.assign(new Error('Invalid workspace operations'), { statusCode: 400 });
  for (const op of operations) {
    validPath(op.path);
    if (!['check', 'set', 'remove', 'touch', 'order'].includes(op.type)) throw Object.assign(new Error('Invalid workspace operation'), { statusCode: 400 });
    if (typeof op.exists !== 'boolean' || op.exists && !Object.hasOwn(op,'before') || !['remove','check'].includes(op.type) && !Object.hasOwn(op,'value') || op.type === 'touch' && (op.path.at(-1) !== 'updatedAt' || typeof op.value !== 'string') || op.type === 'order' && (!Array.isArray(op.before) || !Array.isArray(op.value) || op.value.some(id=>typeof id!=='string') || new Set(op.value).size!==op.value.length)) throw Object.assign(new Error('Invalid workspace operation value'), {statusCode:400});
    const actual = read(current, op.path);
    if (check && op.type !== 'touch' && !equal(op.type === 'order' ? Array.isArray(actual) ? actual.map(v => v.id) : undefined : actual, op.exists ? op.before : undefined)) throw conflict();
  }
  // Copy only containers on changed paths. Untouched records retain their
  // identity, so a row save does not clone every historical round.
  const next = { ...(current || {}) };
  function writableParent(path) {
    let parent = next;
    for (const part of path) {
      const key = object(part) ? Array.isArray(parent) ? parent.findIndex(v => v?.id === part.id) : -1 : part;
      if (key === -1) throw conflict();
      const child = parent?.[key];
      if (!Array.isArray(child) && !object(child)) throw conflict();
      parent[key] = Array.isArray(child) ? [...child] : { ...child };
      parent = parent[key];
    }
    return parent;
  }
  for (const op of operations) {
    if (op.type === 'check') continue;
    const parent = writableParent(op.path.slice(0, -1)); const key = op.path.at(-1);
    if (op.type === 'order') { const values = read(next, op.path); if (!Array.isArray(values)) throw conflict(); const map = new Map(values.map(v => [v.id, v])); if (op.value.length !== map.size || op.value.some(id => !map.has(id))) throw conflict(); const sorted = op.value.map(id => map.get(id)); if (object(key)) throw new Error('Invalid array order path'); parent[key] = sorted; continue; }
    if (object(key)) {
      if (!Array.isArray(parent)) throw conflict(); const index = parent.findIndex(v => v?.id === key.id);
      if (op.type === 'remove') { if (index >= 0) parent.splice(index, 1); }
      else { if (!object(op.value) || op.value.id !== key.id) throw Object.assign(new Error('Invalid record identity'), { statusCode: 400 }); if (index >= 0) parent[index] = copy(op.value); else { const before = parent.findIndex(v => v?.id === op.beforeId); parent.splice(before >= 0 ? before : parent.length, 0, copy(op.value)); } }
    } else {
      if (!object(parent)) throw conflict();
      if (op.type === 'remove') delete parent[key];
      else parent[key] = op.type === 'touch' && typeof parent[key] === 'string' && parent[key] > op.value ? parent[key] : copy(op.value);
    }
  }
  return next;
}
