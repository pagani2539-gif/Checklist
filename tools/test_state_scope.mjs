import assert from "node:assert/strict";
import {
  assertContractTopology,
  assertStateWithinStationScope,
  assertStationScopeForWrite,
  getScopedStationIds,
  mergeScopedState,
  scopeStateToStations,
} from "../server/state-scope.mjs";

const base = {
  itemCatalog: [{ id: "global-item" }],
  stationProfiles: [
    { id: "station-a", stationName: "A" },
    { id: "station-b", stationName: "B" },
  ],
  inspectionRounds: [
    { id: "round-a", stationId: "station-a", status: "draft" },
    { id: "round-b", stationId: "station-b", status: "closed", snapshot: { stationId: "station-b" } },
  ],
  inspectionHistory: [{ id: "history-b", stationId: "station-b" }],
  inspectionWorkspaces: [{ id: "workspace-a", stationId: "station-a" }],
  regions: [{ id: "region-central", name: "ภาคกลาง" }, { id: "region-north", name: "ภาคเหนือ" }],
  contracts: [{ id: "contract-a", contractNo: "A", regionIds: ["region-central"] }, { id: "contract-b", contractNo: "B", regionIds: ["region-north"] }],
  workPackages: [{ id: "package-a", contractId: "contract-a" }, { id: "package-b", contractId: "contract-b" }],
  contractStationAssignments: [{ id: "assignment-a", contractId: "contract-a", workPackageId: "package-a", stationId: "station-a" }, { id: "assignment-b", contractId: "contract-b", workPackageId: "package-b", stationId: "station-b" }],
  contractWorkReports: [{ id: "report-a", contractId: "contract-a", stationId: "station-a" }, { id: "report-b", contractId: "contract-b", stationId: "station-b" }],
};

const scoped = scopeStateToStations(base, ["station-a"]);
assert.deepEqual(scoped.stationProfiles.map((entry) => entry.id), ["station-a"]);
assert.deepEqual(scoped.inspectionRounds.map((entry) => entry.id), ["round-a"]);
assert.equal(scoped.inspectionHistory.length, 0);
assert.deepEqual(scoped.contracts.map((entry) => entry.id), ["contract-a"]);
assert.deepEqual(scoped.workPackages.map((entry) => entry.id), ["package-a"]);
assert.deepEqual(scoped.contractStationAssignments.map((entry) => entry.id), ["assignment-a"]);
assert.deepEqual(scoped.contractWorkReports.map((entry) => entry.id), ["report-a"]);
assert.equal(scoped.activeStationId, null);

const incoming = {
  ...scoped,
  stationProfiles: [{ id: "station-a", stationName: "A updated" }],
};
const merged = mergeScopedState(base, incoming, ["station-a"]);
assert.deepEqual(merged.stationProfiles, [
  { id: "station-a", stationName: "A updated" },
  { id: "station-b", stationName: "B" },
]);
assert.deepEqual(merged.inspectionRounds, base.inspectionRounds);
assert.deepEqual(merged.inspectionHistory, base.inspectionHistory);
assert.deepEqual(merged.itemCatalog, base.itemCatalog);

const multipleRounds = {
  ...base,
  inspectionRounds: [
    { id: "round-a-1", stationId: "station-a", status: "draft" },
    { id: "round-a-2", stationId: "station-a", status: "closed" },
    ...base.inspectionRounds.filter((round) => round.stationId === "station-b"),
  ],
};
const multipleRoundsIncoming = {
  ...scopeStateToStations(multipleRounds, ["station-a"]),
  inspectionRounds: [
    { id: "round-a-1", stationId: "station-a", status: "closed" },
    { id: "round-a-2", stationId: "station-a", status: "closed" },
    { id: "round-a-3", stationId: "station-a", status: "draft" },
  ],
};
assert.deepEqual(
  mergeScopedState(multipleRounds, multipleRoundsIncoming, ["station-a"]).inspectionRounds.map((round) => round.id),
  ["round-a-1", "round-a-2", "round-a-3", "round-b"],
  "station-scoped merge must preserve multiple rounds for the same station",
);

assert.throws(() => assertStateWithinStationScope({ stationProfiles: [{ id: "station-b" }] }, ["station-a"]), /outside the user scope/);
assert.throws(() => assertStationScopeForWrite([]), /no station scope/);
assert.equal(getScopedStationIds({ enforceStationScope: true, user: { role: "admin", stationIds: [] } }), null);
assert.equal(getScopedStationIds({ enforceStationScope: true, user: { role: "station-manager", stationIds: [] } }), null);
assert.deepEqual(getScopedStationIds({ enforceStationScope: true, user: { role: "inspector", stationIds: [] }, allStationIds: ["station-a", "station-b"] }), ["station-a", "station-b"]);
assert.throws(() => assertContractTopology({ contracts: [{ contractNo: "A-1" }, { contractNo: " A-1 " }] }), /unique/);
assert.throws(() => assertContractTopology({ contractStationAssignments: [{ stationId: "s", contractId: "a", effectiveFrom: "2025-01-01", effectiveTo: "2025-02-01" }, { stationId: "s", contractId: "b", effectiveFrom: "2025-01-15", effectiveTo: "2025-02-10" }] }), /overlapping/);

console.log("state scope tests passed");
