import assert from "node:assert/strict";
import { applyConflictDraftRoundDeletions, findConflictDraftDeletedRounds } from "../src/domain/conflict-round-deletion.js";

const round = {
  id: "round-deleted-in-draft",
  status: "draft",
  stationId: "station-a",
  snapshot: { id: "snapshot-a", stationId: "station-a" },
};
const centralState = {
  activeRoundId: round.id,
  activeStationId: "station-a",
  inspectionRounds: [round, { id: "round-keep", status: "draft", stationId: "station-a" }],
  inspectionHistory: [{ id: "legacy-round", snapshot: { id: "snapshot-a" } }],
  inspectionWorkspaces: [{ id: round.id, snapshot: { id: "snapshot-a" } }],
  stationInspectionReports: [{ id: "report-a", roundId: round.id }, { id: "report-keep", roundId: "round-keep" }],
  inspectionRoundContextLinks: [{ id: "link-a", roundId: round.id }, { id: "link-keep", roundId: "round-keep" }],
  deletedRoundIds: [],
  stationProfiles: [{ id: "station-a" }],
  contracts: [{ id: "concurrent-central-edit", contractNo: "latest" }],
};
const staleDraft = {
  ...centralState,
  inspectionRounds: [{ id: "round-keep", status: "draft", stationId: "station-a" }],
  deletedRoundIds: [round.id],
};

assert.deepEqual(findConflictDraftDeletedRounds(centralState, staleDraft), [round]);
const recovered = applyConflictDraftRoundDeletions(centralState, staleDraft, [round.id]);
assert.deepEqual(recovered.inspectionRounds.map((entry) => entry.id), ["round-keep"], "a confirmed draft deletion must remove the round from current central state");
assert.deepEqual(recovered.deletedRoundIds, [round.id], "the tombstone must prevent an older client from restoring the round");
assert.deepEqual(recovered.stationInspectionReports, [{ id: "report-keep", roundId: "round-keep" }]);
assert.deepEqual(recovered.inspectionRoundContextLinks, [{ id: "link-keep", roundId: "round-keep" }]);
assert.deepEqual(recovered.inspectionHistory, [], "legacy snapshot aliases must also be removed");
assert.deepEqual(recovered.inspectionWorkspaces, [], "legacy workspace aliases must also be removed");
assert.deepEqual(recovered.contracts, centralState.contracts, "unrelated concurrent central edits must be preserved");
assert.deepEqual(recovered.stationProfiles, centralState.stationProfiles);
assert.deepEqual(findConflictDraftDeletedRounds(centralState, { ...staleDraft, deletedRoundIds: [] }), [], "a missing round alone must not be treated as delete intent");
assert.deepEqual(applyConflictDraftRoundDeletions(centralState, staleDraft, []), centralState, "unconfirmed deletions must not change central state");
console.log("test_conflict_round_deletion: pass");
