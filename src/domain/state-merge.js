const MISSING = Symbol("missing-state-value");
export const STATE_MERGE_IGNORED_KEYS = Object.freeze(["ui", "activeRoundId", "activeStationId", "items", "inspectionSnapshot", "meta", "lastSaved"]);

function isRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cloneValue(value) {
  return value === MISSING ? MISSING : JSON.parse(JSON.stringify(value));
}

function stableJson(value) {
  if (value === MISSING) return "<missing>";
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (!value || typeof value !== "object") return JSON.stringify(value);
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
}

function sameValue(left, right) {
  if (left === MISSING || right === MISSING) return left === right;
  return stableJson(left) === stableJson(right);
}

function arrayMap(value) {
  return new Map(value.map((record) => [String(record.id), record]));
}

function isKeyedRecordArray(values) {
  const arrays = values.map((value) => value === MISSING ? [] : value);
  if (!arrays.every(Array.isArray)) return false;
  return arrays.every((records) => {
    const ids = records.map((record) => record && (typeof record.id === "string" || typeof record.id === "number") && String(record.id).trim());
    return ids.every(Boolean) && new Set(ids).size === ids.length;
  });
}

function mergeKeyedArrays(base, current, incoming, path, conflicts) {
  const baseRecords = arrayMap(base === MISSING ? [] : base);
  const currentRecords = arrayMap(current === MISSING ? [] : current);
  const incomingRecords = arrayMap(incoming === MISSING ? [] : incoming);
  const orderedIds = [...new Set([
    ...(current === MISSING ? [] : current.map((record) => String(record.id))),
    ...(incoming === MISSING ? [] : incoming.map((record) => String(record.id))),
    ...(base === MISSING ? [] : base.map((record) => String(record.id))),
  ])];
  const result = [];
  for (const id of orderedIds) {
    const merged = mergeValue(
      baseRecords.has(id) ? baseRecords.get(id) : MISSING,
      currentRecords.has(id) ? currentRecords.get(id) : MISSING,
      incomingRecords.has(id) ? incomingRecords.get(id) : MISSING,
      [...path, { id }],
      conflicts,
    );
    if (merged !== MISSING) result.push(merged);
  }
  return result;
}

function mergeValue(base, current, incoming, path, conflicts) {
  if (sameValue(incoming, base)) return cloneValue(current);
  if (sameValue(current, base)) return cloneValue(incoming);
  if (sameValue(current, incoming)) return cloneValue(current);

  if ((base === MISSING || isRecord(base)) && isRecord(current) && isRecord(incoming)) {
    const baseObject = base === MISSING ? {} : base;
    const result = {};
    const keys = new Set([...Object.keys(baseObject), ...Object.keys(current), ...Object.keys(incoming)]);
    for (const key of keys) {
      const merged = mergeValue(
        Object.hasOwn(baseObject, key) ? baseObject[key] : MISSING,
        Object.hasOwn(current, key) ? current[key] : MISSING,
        Object.hasOwn(incoming, key) ? incoming[key] : MISSING,
        [...path, key],
        conflicts,
      );
      if (merged !== MISSING) Object.defineProperty(result, key, { value: merged, enumerable: true, writable: true, configurable: true });
    }
    return result;
  }

  if (isKeyedRecordArray([base, current, incoming])) {
    return mergeKeyedArrays(base, current, incoming, path, conflicts);
  }

  conflicts.push({ path });
  return cloneValue(current);
}

function mergeDeletedRoundIds(current, incoming) {
  return [...new Set([
    ...(current === MISSING ? [] : Array.isArray(current) ? current : []),
    ...(incoming === MISSING ? [] : Array.isArray(incoming) ? incoming : []),
  ].map(String))];
}

export function mergeConcurrentState(base, current, incoming, { ignoredKeys = [] } = {}) {
  if (!isRecord(base) || !isRecord(current) || !isRecord(incoming)) {
    return { state: null, conflicts: [{ path: [] }] };
  }

  const ignored = new Set(ignoredKeys);
  const result = { ...current };
  const conflicts = [];
  const keys = new Set([...Object.keys(base), ...Object.keys(current), ...Object.keys(incoming)]);
  for (const key of keys) {
    if (ignored.has(key) || key === "version") continue;
    if (key === "deletedRoundIds") {
      result[key] = mergeDeletedRoundIds(current[key] ?? MISSING, incoming[key] ?? MISSING);
      continue;
    }
    const merged = mergeValue(
      Object.hasOwn(base, key) ? base[key] : MISSING,
      Object.hasOwn(current, key) ? current[key] : MISSING,
      Object.hasOwn(incoming, key) ? incoming[key] : MISSING,
      [key],
      conflicts,
    );
    if (merged === MISSING) delete result[key];
    else Object.defineProperty(result, key, { value: merged, enumerable: true, writable: true, configurable: true });
  }

  const deletedRoundIds = new Set((result.deletedRoundIds || []).map(String));
  if (deletedRoundIds.size) {
    for (const key of ["inspectionRoundContextLinks", "stationInspectionReports"]) {
      if (Array.isArray(result[key])) result[key] = result[key].filter((record) => !deletedRoundIds.has(String(record?.roundId || "")));
    }
  }
  return { state: result, conflicts };
}

export function conflictPathKey(path = []) {
  return JSON.stringify(path);
}

export function getConflictPathValue(state, path = []) {
  let value = state;
  for (const segment of path) {
    if (segment && typeof segment === "object" && Object.hasOwn(segment, "id")) {
      if (!Array.isArray(value)) return { exists: false, value: undefined };
      const found = value.find((record) => String(record?.id) === String(segment.id));
      if (!found) return { exists: false, value: undefined };
      value = found;
    } else {
      if (!value || typeof value !== "object" || !Object.hasOwn(value, segment)) return { exists: false, value: undefined };
      value = value[segment];
    }
  }
  return { exists: true, value };
}

function setConflictPathValue(state, path, replacement) {
  const update = (current, index) => {
    if (index >= path.length) return replacement.exists ? cloneValue(replacement.value) : MISSING;
    const segment = path[index];
    if (segment && typeof segment === "object" && Object.hasOwn(segment, "id")) {
      const records = Array.isArray(current) ? [...current] : [];
      const recordIndex = records.findIndex((record) => String(record?.id) === String(segment.id));
      if (index === path.length - 1) {
        if (!replacement.exists) {
          if (recordIndex >= 0) records.splice(recordIndex, 1);
        } else if (recordIndex >= 0) records[recordIndex] = cloneValue(replacement.value);
        else records.push(cloneValue(replacement.value));
        return records;
      }
      const record = recordIndex >= 0 ? records[recordIndex] : { id: segment.id };
      const nextRecord = update(record, index + 1);
      if (nextRecord === MISSING) {
        if (recordIndex >= 0) records.splice(recordIndex, 1);
      } else if (recordIndex >= 0) records[recordIndex] = nextRecord;
      else records.push(nextRecord);
      return records;
    }
    const result = isRecord(current) ? { ...current } : {};
    const nextValue = update(Object.hasOwn(result, segment) ? result[segment] : MISSING, index + 1);
    if (nextValue === MISSING) delete result[segment];
    else Object.defineProperty(result, segment, { value: nextValue, enumerable: true, writable: true, configurable: true });
    return result;
  };
  const result = update(state, 0);
  return result === MISSING ? {} : result;
}

export function applyConflictChoices(candidateState, draftState, conflicts = [], choices = {}) {
  let resolvedState = cloneValue(candidateState);
  for (const conflict of conflicts) {
    if (choices[conflictPathKey(conflict.path)] !== "draft") continue;
    resolvedState = setConflictPathValue(resolvedState, conflict.path, getConflictPathValue(draftState, conflict.path));
  }
  return resolvedState;
}

export function formatConflictPath(path = []) {
  return path.reduce((label, segment) => segment && typeof segment === "object" && Object.hasOwn(segment, "id")
    ? `${label}[id=${String(segment.id)}]`
    : `${label}.${String(segment)}`, "$");
}
