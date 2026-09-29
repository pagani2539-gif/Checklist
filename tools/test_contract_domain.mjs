import assert from "node:assert/strict";
import {
  attachContractContextToRound,
  buildContractAgreementCoverSnapshot,
  buildContractDeletionImpact,
  buildContractContextSnapshot,
  contractAgreementCoversForContract,
  createContractAgreementCover,
  createContractCommitteeMember,
  createContractDraft,
  createContractScopeItem,
  createContractStationAssignment,
  createContractWorkReport,
  createRegionDraft,
  createWorkPackageDraft,
  getContractCoreCompleteness,
  getContractContextForRound,
  nextContractAgreementCoverVersion,
  normalizeContractWorkspaceState,
  purgeContractFromState,
  validateContractAgreementCover,
  regionsForContract,
  stationsForWorkPackage,
  workPackagesForContract,
} from "../src/domain/contracts.js";
import { createEmptyChecklistState, normalizeServerChecklistState } from "../src/domain/storage.js";
import { normalizeReferenceData, referenceOptionsFor } from "../src/domain/reference-data.js";

const regions = [
  createRegionDraft({ id: "region-central", code: "C", name: "ภาคกลาง" }),
  createRegionDraft({ id: "region-north", code: "N", name: "ภาคเหนือ" }),
  createRegionDraft({ id: "region-south", code: "S", name: "ภาคใต้" }),
];
const contractA = createContractDraft({ id: "contract-a", contractNo: "สคน.e-12/2568", title: "งานแจ้งเตือนชุด A", regionIds: regions.map((region) => region.id) });
const contractB = createContractDraft({ id: "contract-b", contractNo: "สคน.e-13/2568", title: "งานแจ้งเตือนชุด B", regionIds: [regions[1].id] });
const workPackage = createWorkPackageDraft({ id: "package-a-9", contractId: contractA.id, packageNo: "9", reportSequence: "9", title: "รายงานผลการปฏิบัติงานครั้งที่ 9", periodStart: "2025-12-01", periodEnd: "2025-12-31" });
const stations = [
  { id: "station-1", stationCode: "ST-01", stationName: "สถานีหนึ่ง", province: "นครปฐม" },
  { id: "station-2", stationCode: "ST-02", stationName: "สถานีสอง", province: "เชียงใหม่" },
];
const assignments = stations.map((station) => createContractStationAssignment({ contractId: contractA.id, workPackageId: workPackage.id, stationId: station.id }));
const state = normalizeContractWorkspaceState({ regions, contracts: [contractA, contractB], workPackages: [workPackage], contractStationAssignments: assignments, contractWorkReports: [], stationProfiles: stations });

const defaultReferenceData = normalizeReferenceData({});
assert.deepEqual(referenceOptionsFor(defaultReferenceData, "contractor").map((entry) => entry.name), [
  "บริษัท เอ็นทีอาร์ เอ็นจิเนียร์ จำกัด",
  "บริษัท ไอ-สมาร์ท 8 จำกัด",
  "บริษัท แอลทีพี เอ็นจิเนียริ่ง จำกัด",
], "contractor dropdown must have the standard legal company names");
assert.deepEqual(referenceOptionsFor(defaultReferenceData, "agency").map((entry) => entry.name), ["กรมทางหลวง"], "agency dropdown must have the known owner agency");
const existingReferenceData = normalizeReferenceData({
  contractors: [{ id: "contractor-existing-ntr", name: "บริษัท เอ็นทีอาร์ เอ็นจิเนียร์ จำกัด" }],
  agencies: [{ id: "agency-existing-highways", name: "กรมทางหลวง" }],
});
assert.equal(existingReferenceData.contractors.filter((entry) => entry.name === "บริษัท เอ็นทีอาร์ เอ็นจิเนียร์ จำกัด").length, 1, "existing contractor records must not be duplicated");
assert.equal(existingReferenceData.contractors.find((entry) => entry.name === "บริษัท เอ็นทีอาร์ เอ็นจิเนียร์ จำกัด").id, "contractor-existing-ntr", "existing contractor ID must be preserved");
assert.equal(existingReferenceData.agencies.filter((entry) => entry.name === "กรมทางหลวง").length, 1, "existing agency records must not be duplicated");
assert.equal(existingReferenceData.agencies.find((entry) => entry.name === "กรมทางหลวง").id, "agency-existing-highways", "existing agency ID must be preserved");

assert.equal(regionsForContract(state, contractA).length, 3, "one contract must cover several regions");
assert.equal(workPackagesForContract(state, contractA.id).length, 1);
assert.deepEqual(stationsForWorkPackage(state, workPackage.id, stations).map((station) => station.id), ["station-1", "station-2"]);

const context = buildContractContextSnapshot({ contract: contractA, workPackage, regions: regionsForContract(state, contractA), station: stations[0], assignment: assignments[0] });
const round = attachContractContextToRound({ id: "round-old", stationId: stations[0].id, meta: {}, snapshot: { stationId: stations[0].id, stationCode: stations[0].stationCode, stationName: stations[0].stationName, province: stations[0].province } }, context);
const changedState = { ...state, contracts: [{ ...contractA, title: "ชื่อสัญญาปัจจุบันที่แก้แล้ว" }, contractB], regions: regions.map((region) => region.id === regions[0].id ? { ...region, name: "ภาคกลาง (แก้ชื่อใหม่)" } : region) };
const historical = getContractContextForRound(round, changedState);
assert.equal(historical.contractTitle, context.contractTitle, "round history must keep the captured contract label");
assert.deepEqual(historical.regionNames, context.regionNames, "round history must keep the captured region labels");

const report = createContractWorkReport({ id: "report-a-9", contractId: contractA.id, workPackageId: workPackage.id, stationId: stations[0].id, roundId: round.id, reportSequence: context.reportSequence, snapshot: context });
assert.equal(report.snapshot.contractNo, "สคน.e-12/2568");
assert.equal(report.snapshot.stationName, "สถานีหนึ่ง");

const scopeItems = [
  createContractScopeItem({ id: "scope-2", order: 2, description: "สถานีตรวจสอบน้ำหนักยานพาหนะ Spot Check ราชบุรี" }),
  createContractScopeItem({ id: "scope-1", order: 1, description: "สถานีตรวจสอบน้ำหนักยานพาหนะ Spot Check ระนอง" }),
];
const committeeMembers = [
  createContractCommitteeMember({ id: "committee-2", order: 2, name: "นางสาว ข", role: "กรรมการ" }),
  createContractCommitteeMember({ id: "committee-1", order: 1, name: "นาย ก", role: "ประธานกรรมการ" }),
];
const coverContract = createContractDraft({
  ...contractA,
  agreementCover: {
    scopeItems,
    durationDays: "300",
    contractValue: "4000000.00",
    penaltyPerDay: "10000.00",
    committeeMembers,
  },
});
const incompleteContract = createContractDraft({ contractNo: "สัญญาร่าง-01", title: "งานร่าง" });
const incompleteCore = getContractCoreCompleteness(incompleteContract);
assert.equal(incompleteCore.valid, false, "a contract draft with only identity text must remain incomplete");
assert.deepEqual(incompleteCore.missingFields, ["วันที่ลงนาม", "หน่วยงานเจ้าของงาน", "ผู้รับจ้าง", "วันเริ่มสัญญา", "วันสิ้นสุดสัญญา"]);
assert.equal(getContractCoreCompleteness(createContractDraft({ contractNo: "สัญญาร่าง-02" })).missingFields.includes("ชื่อสัญญา"), true, "the generated draft placeholder must not count as a real title");
const completeCore = getContractCoreCompleteness({ ...incompleteContract, contractDate: "2025-01-15", agency: "กรมทางหลวง", contractor: "บริษัท เอ จำกัด", startDate: "2025-01-16", endDate: "2025-11-11" });
assert.equal(completeCore.valid, true, "a contract with identity, parties, and dates is ready for the next step");
const reversedCore = getContractCoreCompleteness({ ...incompleteContract, contractDate: "2025-01-15", agency: "กรมทางหลวง", contractor: "บริษัท เอ จำกัด", startDate: "2025-11-11", endDate: "2025-01-16" });
assert.equal(reversedCore.dateOrderError, true, "date order must be reported separately from missing fields");
assert.ok(reversedCore.completed >= 0 && reversedCore.completed <= reversedCore.total, "an invalid date range must keep completion within bounds");
const legacyState = normalizeContractWorkspaceState({ contracts: [{ id: "legacy-contract", contractNo: "LEGACY-01", projectName: "ชื่อโครงการเดิม" }] });
assert.equal(legacyState.contracts[0].title, "ชื่อโครงการเดิม", "legacy projectName must remain the contract title fallback");
assert.equal(legacyState.contracts[0].projectName, "ชื่อโครงการเดิม", "legacy projectName must remain available for reports");
const coverSnapshot = buildContractAgreementCoverSnapshot(coverContract, regionsForContract(state, contractA));
assert.equal(validateContractAgreementCover(coverContract, coverContract.agreementCover).valid, false, "cover validation must require contract parties and dates");
const completeCoverContract = createContractDraft({
  ...coverContract,
  contractDate: "2025-01-15",
  agency: "กรมทางหลวง",
  contractor: "บริษัท เอ จำกัด",
  startDate: "2025-01-16",
  endDate: "2025-11-11",
});
assert.equal(validateContractAgreementCover(completeCoverContract, completeCoverContract.agreementCover).valid, true, "complete cover data must validate");
const cover = createContractAgreementCover({ id: "cover-a-1", contractId: coverContract.id, version: 1, snapshot: coverSnapshot });
const coverState = normalizeContractWorkspaceState({ ...state, contracts: [coverContract, contractB], contractAgreementCovers: [cover] });
assert.deepEqual(coverState.contracts[0].agreementCover.scopeItems.map((item) => item.id), ["scope-1", "scope-2"]);
assert.deepEqual(coverState.contracts[0].agreementCover.committeeMembers.map((member) => member.name), ["นาย ก", "นางสาว ข"]);
assert.equal(coverState.contractAgreementCovers[0].snapshot.contractValue, "4000000.00");
assert.equal(contractAgreementCoversForContract(coverState, contractA.id)[0].version, 1);
assert.equal(nextContractAgreementCoverVersion(coverState.contractAgreementCovers, contractA.id), 2);

const deletionState = normalizeContractWorkspaceState({
  ...coverState,
  contracts: [coverContract, contractB],
  workPackages: [workPackage],
  contractStationAssignments: assignments,
  contractWorkReports: [report],
  contractAgreementCovers: [cover],
  inspectionRounds: [{ id: "round-draft", contractId: contractA.id, status: "draft" }, { id: "round-other", contractId: contractB.id, status: "draft" }],
  inspectionHistory: [{ id: "history-a", contractId: contractA.id, status: "closed" }],
  ui: { contractFormDrafts: { [contractA.id]: { title: "ร่างที่ต้องลบ" }, [contractB.id]: { title: "ต้องเก็บ" } } },
});
const deletionImpact = buildContractDeletionImpact(deletionState, contractA.id);
assert.deepEqual(deletionImpact.counts, { workPackages: 1, assignments: 2, reports: 1, covers: 1, preservedDraftRounds: 1, preservedHistory: 1 }, "contract deletion impact must separate owned data from preserved inspections");
const purgedContractState = purgeContractFromState(deletionState, contractA.id);
assert.deepEqual(purgedContractState.contracts.map((entry) => entry.id), [contractB.id], "deleted contract must be removed");
assert.equal(purgedContractState.workPackages.some((entry) => entry.contractId === contractA.id), false, "owned work packages must be removed");
assert.equal(purgedContractState.contractStationAssignments.some((entry) => entry.contractId === contractA.id), false, "owned station assignments must be removed");
assert.equal(purgedContractState.contractWorkReports.some((entry) => entry.contractId === contractA.id), false, "owned contract reports must be removed");
assert.equal(purgedContractState.contractAgreementCovers.some((entry) => entry.contractId === contractA.id), false, "owned agreement covers must be removed");
assert.equal(purgedContractState.inspectionRounds.some((entry) => entry.id === "round-draft"), true, "inspection drafts must remain");
assert.equal(purgedContractState.inspectionHistory.some((entry) => entry.id === "history-a"), true, "inspection history must remain");
assert.equal(purgedContractState.ui.contractFormDrafts[contractA.id], undefined, "deleted contract form drafts must be removed");
assert.ok(purgedContractState.ui.contractFormDrafts[contractB.id], "other contract drafts must remain");

const changedCoverContract = { ...coverContract, agreementCover: { ...coverContract.agreementCover, contractValue: "999.00" } };
assert.equal(cover.snapshot.contractValue, "4000000.00", "issued cover snapshot must not change when current contract changes");
assert.equal(buildContractAgreementCoverSnapshot(changedCoverContract).contractValue, "999.00");

assert.deepEqual(createEmptyChecklistState().contractAgreementCovers, [], "new state must include an empty cover history collection");
assert.deepEqual(normalizeServerChecklistState({ contracts: [], contractWorkReports: [] }).contractAgreementCovers, [], "legacy server state without cover history must normalize safely");

console.log("contract domain tests passed");
