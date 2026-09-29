const STATION_SCOPED_COLLECTIONS = Object.freeze([
  "stationProfiles",
  "inspectionRounds",
  "inspectionHistory",
  "inspectionWorkspaces",
  "contractStationAssignments",
  "contractWorkReports",
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function recordScopeKey(collection, record) {
  if (collection === "stationProfiles") return String(record?.id || "");
  return String(record?.stationId || record?.snapshot?.stationId || record?.stationSnapshot?.stationId || "");
}

function scopeError(message) {
  const error = new Error(message);
  error.statusCode = 403;
  error.code = "STATION_SCOPE_VIOLATION";
  return error;
}

function topologyError(message) {
  const error = new Error(message);
  error.statusCode = 409;
  error.code = "CONTRACT_TOPOLOGY_CONFLICT";
  return error;
}

function intervalsOverlap(left, right) {
  const leftStart = String(left?.effectiveFrom || "0000-00-00");
  const leftEnd = String(left?.effectiveTo || "9999-12-31");
  const rightStart = String(right?.effectiveFrom || "0000-00-00");
  const rightEnd = String(right?.effectiveTo || "9999-12-31");
  return leftStart <= rightEnd && rightStart <= leftEnd;
}

export function assertContractTopology(state) {
  const contracts = asArray(state?.contracts);
  const contractNumbers = new Set();
  for (const contract of contracts) {
    const number = String(contract?.contractNo || "").trim().replace(/\s+/g, "").toLocaleLowerCase("th-TH");
    if (number && contractNumbers.has(number)) throw topologyError("Contract number must be unique");
    if (number) contractNumbers.add(number);
  }
  const packageKeys = new Set();
  for (const workPackage of asArray(state?.workPackages)) {
    const key = `${workPackage?.contractId || ""}::${String(workPackage?.packageNo || workPackage?.reportSequence || "").trim()}`;
    if (workPackage?.contractId && key.endsWith("::")) continue;
    if (packageKeys.has(key)) throw topologyError("Work package number must be unique within a contract");
    packageKeys.add(key);
  }
  const activeAssignments = asArray(state?.contractStationAssignments).filter((entry) => entry?.status !== "inactive");
  for (let index = 0; index < activeAssignments.length; index += 1) {
    for (let next = index + 1; next < activeAssignments.length; next += 1) {
      const left = activeAssignments[index];
      const right = activeAssignments[next];
      if (left.stationId === right.stationId && left.contractId !== right.contractId && intervalsOverlap(left, right)) {
        throw topologyError("A station cannot have overlapping active assignments across contracts");
      }
    }
  }
}

export function getScopedStationIds({ enforceStationScope = false, user, allStationIds = [] } = {}) {
  // station-manager is the central contract manager role: it needs the full
  // contract topology and all station assignments. Inspectors can work across
  // every existing station, while other field users remain explicitly scoped.
  if (!enforceStationScope || ["admin", "station-manager"].includes(user?.role)) return null;
  if (user?.role === "inspector") {
    return [...new Set((Array.isArray(allStationIds) ? allStationIds : []).map(String).filter(Boolean))];
  }
  return Array.isArray(user?.stationIds)
    ? [...new Set(user.stationIds.map(String).filter(Boolean))]
    : [];
}

export function assertStateWithinStationScope(state, stationIds) {
  if (!Array.isArray(stationIds)) return;
  const allowed = new Set(stationIds.map(String));
  for (const collection of STATION_SCOPED_COLLECTIONS) {
    for (const record of asArray(state?.[collection])) {
      const stationId = recordScopeKey(collection, record);
      if (!stationId || !allowed.has(stationId)) {
        throw scopeError("State contains a station outside the user scope");
      }
    }
  }
}

export function assertStationScopeForWrite(stationIds) {
  if (Array.isArray(stationIds) && stationIds.length === 0) {
    throw scopeError("User has no station scope for write access");
  }
}

export function assertReferenceDataWriteAllowed(currentState, incomingState, user) {
  if (!user || ["admin", "station-manager"].includes(user.role)) return;
  if (incomingState && Object.prototype.hasOwnProperty.call(incomingState, "referenceData")) {
    const current = JSON.stringify(currentState?.referenceData || {});
    const incoming = JSON.stringify(incomingState?.referenceData || {});
    if (current !== incoming) throw scopeError("Only managers can change reference data");
  }
}

export function scopeStateToStations(state, stationIds) {
  if (!Array.isArray(stationIds)) return state;
  const allowed = new Set(stationIds.map(String));
  const scoped = { ...(state || {}) };
  for (const collection of STATION_SCOPED_COLLECTIONS) {
    scoped[collection] = asArray(state?.[collection]).filter((record) => allowed.has(recordScopeKey(collection, record)));
  }
  // Contract topology is shared by managers, but a field user should only
  // receive contracts/work packages that contain at least one station in the
  // user's station scope. This keeps the context bar and deep links from
  // exposing unrelated contract work without changing the station contract.
  const assignments = asArray(scoped.contractStationAssignments);
  const contractIds = new Set(assignments.map((entry) => String(entry?.contractId || "")).filter(Boolean));
  const workPackageIds = new Set(assignments.map((entry) => String(entry?.workPackageId || "")).filter(Boolean));
  scoped.contracts = asArray(state?.contracts).filter((entry) => contractIds.has(String(entry?.id || "")));
  scoped.workPackages = asArray(state?.workPackages).filter((entry) => workPackageIds.has(String(entry?.id || "")) && contractIds.has(String(entry?.contractId || "")));
  const regionIds = new Set(scoped.contracts.flatMap((entry) => asArray(entry?.regionIds).map(String)));
  scoped.regions = asArray(state?.regions).filter((entry) => regionIds.has(String(entry?.id || "")));
  scoped.activeRoundId = null;
  scoped.activeStationId = null;
  return scoped;
}

function mergeCollection(baseValue, incomingValue, collection, allowed) {
  const incomingByKey = new Map();
  for (const record of asArray(incomingValue)) {
    const key = recordScopeKey(collection, record);
    if (!allowed.has(key)) continue;
    const records = incomingByKey.get(key) || [];
    records.push(record);
    incomingByKey.set(key, records);
  }

  const merged = [];
  const emittedKeys = new Set();
  for (const record of asArray(baseValue)) {
    const key = recordScopeKey(collection, record);
    if (!allowed.has(key)) {
      merged.push(record);
      continue;
    }
    if (!emittedKeys.has(key)) {
      merged.push(...(incomingByKey.get(key) || []));
      emittedKeys.add(key);
    }
  }
  for (const [key, records] of incomingByKey) {
    if (!emittedKeys.has(key)) merged.push(...records);
  }
  return merged;
}

export function mergeScopedState(baseState, incomingState, stationIds) {
  if (!Array.isArray(stationIds)) return incomingState;
  assertStateWithinStationScope(incomingState, stationIds);
  const allowed = new Set(stationIds.map(String));
  const base = baseState && typeof baseState === "object" && !Array.isArray(baseState) ? baseState : {};
  const merged = clone(base);
  for (const collection of STATION_SCOPED_COLLECTIONS) {
    if (Array.isArray(incomingState?.[collection])) {
      merged[collection] = mergeCollection(base[collection], incomingState[collection], collection, allowed);
    }
  }
  const requestedDeletedRoundIds = new Set(asArray(incomingState?.deletedRoundIds).map(String));
  const incomingRoundIds = new Set([
    ...asArray(incomingState?.inspectionRounds),
    ...asArray(incomingState?.inspectionHistory),
    ...asArray(incomingState?.inspectionWorkspaces),
  ].map((round) => String(round?.id || "")).filter(Boolean));
  const baseRoundRecords = [
    ...asArray(base.inspectionRounds),
    ...asArray(base.inspectionHistory),
    ...asArray(base.inspectionWorkspaces),
  ];
  const newlyDeletedRoundIds = baseRoundRecords
    .filter((round) => {
      const id = String(round?.id || "");
      return id
        && allowed.has(recordScopeKey("inspectionHistory", round))
        && !incomingRoundIds.has(id)
        && requestedDeletedRoundIds.has(id);
    })
    .map((round) => String(round.id));
  const deletedRoundIds = new Set([...asArray(base.deletedRoundIds).map(String), ...newlyDeletedRoundIds]);
  merged.deletedRoundIds = [...deletedRoundIds];
  if (newlyDeletedRoundIds.length) {
    const deleted = new Set(newlyDeletedRoundIds);
    for (const collection of ["inspectionRoundContextLinks", "stationInspectionReports"]) {
      merged[collection] = asArray(base[collection]).filter((record) => !deleted.has(String(record?.roundId || "")));
    }
  }
  return merged;
}
