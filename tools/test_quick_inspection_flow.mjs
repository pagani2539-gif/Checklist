import assert from "node:assert/strict";
import {
  buildContractContextSnapshot,
  createContractDraft,
  createContractStationAssignment,
  createInspectionRoundContextLink,
  createRegionDraft,
  createWorkPackageDraft,
  getContractContextForRound,
  getLatestInspectionRoundContextLink,
  normalizeContractWorkspaceState,
} from "../src/domain/contracts.js";
import {
  createDefaultStationProfile,
  createInspectionRound,
} from "../src/domain/master-checklist.js";
import { CURRENT_STATE_VERSION, migrateChecklistState } from "../src/domain/storage.js";

const profile = {
  ...createDefaultStationProfile(),
  id: "station-quick-01",
  stationCode: "QUICK-01",
  stationName: "สถานีตรวจด่วน",
};
const round = createInspectionRound(profile, {
  projectName: "งานตรวจหน้างานด่วน",
  inspectionDate: "2026-09-22",
  inspectionMode: "quick_field",
});
assert.equal(round.status, "draft");
assert.equal(round.meta.inspectionMode, "quick_field");
assert.equal(round.snapshot.stationId, profile.id);
const originalSnapshot = JSON.stringify(round.snapshot);

const regions = [createRegionDraft({ id: "region-central", code: "C", name: "ภาคกลาง" })];
const contract = createContractDraft({ id: "contract-quick", contractNo: "สัญญา-QUICK", title: "งานตรวจหน้างาน" });
const workPackage = createWorkPackageDraft({ id: "package-quick", contractId: contract.id, packageNo: "1", reportSequence: "1", title: "งวดตรวจหน้างาน" });
const assignment = createContractStationAssignment({ contractId: contract.id, workPackageId: workPackage.id, stationId: profile.id });
const state = normalizeContractWorkspaceState({
  stationProfiles: [profile],
  inspectionRounds: [round],
  regions,
  contracts: [contract],
  workPackages: [workPackage],
  contractStationAssignments: [assignment],
  inspectionRoundContextLinks: [],
});
const context = buildContractContextSnapshot({ contract, workPackage, regions, station: profile, assignment });
const firstLink = createInspectionRoundContextLink({ roundId: round.id, context, linkedAt: "2026-09-22T10:00:00.000Z", linkedByLabel: "ผู้ตรวจสอบ" });
const linkedState = normalizeContractWorkspaceState({ ...state, inspectionRoundContextLinks: [firstLink] });
const resolved = getContractContextForRound(round, linkedState);
assert.equal(resolved.contractId, contract.id);
assert.equal(resolved.workPackageId, workPackage.id);
assert.equal(resolved.contractNo, context.contractNo);
assert.equal(JSON.stringify(round.snapshot), originalSnapshot, "linking a quick round must not mutate its station Snapshot");

const secondLink = createInspectionRoundContextLink({ roundId: round.id, context: { ...context, reportSequence: "2", workPackageNo: "2" }, linkedAt: "2026-09-22T11:00:00.000Z", replacesLinkId: firstLink.id });
const relinkedState = normalizeContractWorkspaceState({ ...linkedState, inspectionRoundContextLinks: [firstLink, secondLink] });
assert.equal(getLatestInspectionRoundContextLink(relinkedState, round.id).id, secondLink.id);
assert.equal(getContractContextForRound(round, relinkedState).reportSequence, "2");
assert.equal(relinkedState.inspectionRoundContextLinks.length, 2, "relinking must retain append-only history");

const closedRound = { ...round, status: "closed", closedAt: "2026-09-22T12:00:00.000Z" };
const closedLink = createInspectionRoundContextLink({ roundId: closedRound.id, context, linkedAt: "2026-09-22T13:00:00.000Z" });
const closedState = normalizeContractWorkspaceState({ ...relinkedState, inspectionRounds: [closedRound], inspectionRoundContextLinks: [closedLink] });
assert.equal(closedState.inspectionRounds[0].status, "closed");
assert.equal(closedState.inspectionRounds[0].closedAt, closedRound.closedAt);
assert.equal(JSON.stringify(closedState.inspectionRounds[0].snapshot), originalSnapshot, "linking a closed round must preserve its Snapshot");

const migrated = migrateChecklistState({ stationProfiles: [profile], inspectionRounds: [round] });
assert.equal(CURRENT_STATE_VERSION, 18);
assert.deepEqual(migrated.inspectionRoundContextLinks, [], "legacy state must receive an empty context-link collection");
const migratedLinked = migrateChecklistState({ ...linkedState });
assert.equal(migratedLinked.inspectionRoundContextLinks.length, 1);

console.log("quick inspection flow tests passed");
