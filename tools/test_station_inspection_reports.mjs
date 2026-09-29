import assert from "node:assert/strict";
import { createDefaultStationProfile, createInspectionRound } from "../src/domain/master-checklist.js";
import { CURRENT_STATE_VERSION, migrateChecklistState } from "../src/domain/storage.js";
import { buildContractContextSnapshot, createContractDraft, createContractStationAssignment, createInspectionRoundContextLink, createWorkPackageDraft } from "../src/domain/contracts.js";
import { buildReportTemplateModel, getReportCoverMeta } from "../src/domain/report-template.js";
import {
  appendStationInspectionReportRevision,
  saveStationInspectionReportCover,
  stationInspectionReportForRound,
} from "../src/domain/station-inspection-reports.js";

const profile = { ...createDefaultStationProfile(), id: "station-report-flow", stationCode: "RPT-01", stationName: "สถานีทดสอบรายงาน" };
const round = createInspectionRound(profile, { inspectionDate: "2026-09-29" });
const closedRound = {
  ...round,
  status: "closed",
  closedAt: "2026-09-29T10:00:00.000Z",
  meta: {
    ...round.meta,
    reportCover: {
      reportTitle: "รายงานตรวจเดิม",
      projectName: "โครงการเดิม",
      contractNo: "สัญญาเดิม",
      agency: "หน่วยงานเดิม",
    },
  },
};
const originalSnapshot = JSON.stringify(closedRound.snapshot);
const originalItems = JSON.stringify(closedRound.inspectionItems);
const migrated = migrateChecklistState({ version: 17, stationProfiles: [profile], inspectionRounds: [closedRound] });
assert.equal(CURRENT_STATE_VERSION, 18);
assert.equal(round.meta.inspectionMode, undefined, "a station and date are enough to create a standard round without contract context");
const currentRoundState = migrateChecklistState({ version: CURRENT_STATE_VERSION, stationProfiles: [profile], inspectionRounds: [round], stationInspectionReports: [] });
assert.deepEqual(getReportCoverMeta(currentRoundState.inspectionRounds[0], { state: currentRoundState }).projectName, "", "new round metadata must not become a report cover automatically");
assert.equal(migrated.inspectionRounds[0].status, "closed");
assert.equal(JSON.stringify(migrated.inspectionRounds[0].snapshot), originalSnapshot, "migration must preserve the closed Snapshot");
assert.equal(JSON.stringify(migrated.inspectionRounds[0].inspectionItems), originalItems, "migration must preserve closed results and evidence");
assert.deepEqual(stationInspectionReportForRound(migrated, round.id).coverMeta, {
  reportTitle: "รายงานตรวจเดิม",
  projectName: "โครงการเดิม",
  contractNo: "สัญญาเดิม",
  contractDate: "",
  contractStartDate: "",
  contractEndDate: "",
  agency: "หน่วยงานเดิม",
  contractor: "",
  inspector: "",
  preparedBy: "",
  approvedBy: "",
  approvalDate: "",
}, "legacy cover values should migrate into the separate report record");

const quickRound = createInspectionRound(profile, { inspectionDate: "2026-09-20", inspectionMode: "quick_field" });
const closedQuickRound = { ...quickRound, status: "closed", closedAt: "2026-09-20T10:00:00.000Z", meta: { ...quickRound.meta, reportCover: { reportTitle: "ปกงานด่วนเดิม", projectName: "งานเฉพาะกิจเดิม" } } };
const migratedQuick = migrateChecklistState({ version: 17, stationProfiles: [profile], inspectionRounds: [closedQuickRound] });
assert.equal(migratedQuick.inspectionRounds[0].meta.inspectionMode, "quick_field", "legacy quick rounds must keep their saved type");
assert.deepEqual(stationInspectionReportForRound(migratedQuick, quickRound.id).coverMeta, {
  reportTitle: "ปกงานด่วนเดิม",
  projectName: "งานเฉพาะกิจเดิม",
  contractNo: "",
  contractDate: "",
  contractStartDate: "",
  contractEndDate: "",
  agency: "",
  contractor: "",
  inspector: "",
  preparedBy: "",
  approvedBy: "",
  approvalDate: "",
}, "legacy quick round cover values should remain available");

const manuallySaved = saveStationInspectionReportCover(migrated, round.id, {
  reportTitle: "รายงานใหม่",
  projectName: "โครงการที่กรอกเอง",
  contractNo: "เลขที่กรอกเอง",
  contractor: "ผู้รับจ้างที่กรอกเอง",
}, "2026-09-29T11:00:00.000Z");
assert.equal(manuallySaved.inspectionRounds[0], migrated.inspectionRounds[0], "saving a cover must not rewrite the closed round");
assert.equal(JSON.stringify(manuallySaved.inspectionRounds[0].snapshot), originalSnapshot);
assert.equal(JSON.stringify(manuallySaved.inspectionRounds[0].inspectionItems), originalItems);
assert.equal(stationInspectionReportForRound(manuallySaved, round.id).coverMeta.contractNo, "เลขที่กรอกเอง");
const clearedCover = saveStationInspectionReportCover(manuallySaved, round.id, { reportTitle: "", projectName: "", contractNo: "" }, "2026-09-29T11:15:00.000Z");
const migratedAfterClear = migrateChecklistState(clearedCover);
assert.equal(stationInspectionReportForRound(migratedAfterClear, round.id).coverMeta.contractNo, "", "a later migration must not restore a deliberately cleared legacy value");

const contract = createContractDraft({ id: "contract-linked-later", contractNo: "CONTRACT-MUST-NOT-FILL-COVER", title: "งานเชื่อมภายหลัง" });
const workPackage = createWorkPackageDraft({ id: "package-linked-later", contractId: contract.id, packageNo: "1", title: "งวดเชื่อมภายหลัง" });
const assignment = createContractStationAssignment({ contractId: contract.id, workPackageId: workPackage.id, stationId: profile.id });
const context = buildContractContextSnapshot({ contract, workPackage, regions: [], station: profile, assignment });
const link = createInspectionRoundContextLink({ roundId: round.id, context, linkedAt: "2026-09-29T11:30:00.000Z" });
const linkedAfterClose = {
  ...manuallySaved,
  contracts: [contract],
  workPackages: [workPackage],
  contractStationAssignments: [assignment],
  inspectionRoundContextLinks: [link],
};
const linkedReportModel = buildReportTemplateModel(closedRound, linkedAfterClose);
assert.equal(linkedReportModel.contractContext, null, "linked context is excluded from the station inspection report");
assert.equal(linkedReportModel.metadata.contractNo, "เลขที่กรอกเอง", "the manually entered cover number wins after linking a contract");
assert.equal(JSON.stringify(linkedAfterClose.inspectionRounds[0].snapshot), originalSnapshot);
assert.equal(JSON.stringify(stationInspectionReportForRound(linkedAfterClose, round.id).coverMeta), JSON.stringify(stationInspectionReportForRound(manuallySaved, round.id).coverMeta));

const firstIssued = appendStationInspectionReportRevision(manuallySaved, round.id, {
  companyId: "ntr",
  format: "standard",
  templateId: "checklist-report-a4-portrait-v1",
  templateSchemaVersion: "checklist-report-model-v2",
  coverMeta: stationInspectionReportForRound(manuallySaved, round.id).coverMeta,
  generatedAt: "2026-09-29T12:00:00.000Z",
});
const secondIssued = appendStationInspectionReportRevision(firstIssued, round.id, {
  companyId: "ltp",
  format: "presentation",
  templateId: "checklist-report-a4-portrait-v1",
  templateSchemaVersion: "checklist-report-model-v2",
  coverMeta: { ...stationInspectionReportForRound(firstIssued, round.id).coverMeta, reportTitle: "ฉบับพรีเซนต์" },
  generatedAt: "2026-09-29T13:00:00.000Z",
});
const revisions = stationInspectionReportForRound(secondIssued, round.id).revisions;
assert.deepEqual(revisions.map((revision) => revision.version), [1, 2], "new report outputs append revisions instead of replacing prior ones");
assert.equal(revisions[0].coverMeta.reportTitle, "รายงานใหม่");
assert.equal(revisions[1].coverMeta.reportTitle, "ฉบับพรีเซนต์");
assert.equal(JSON.stringify(secondIssued.inspectionRounds[0].snapshot), originalSnapshot);

const draftState = { inspectionRounds: [round], stationInspectionReports: [] };
assert.equal(appendStationInspectionReportRevision(draftState, round.id, { companyId: "ntr" }), draftState, "a draft round cannot issue a report revision");

console.log("station inspection reports: migration, cover edits, immutable rounds, and append-only revisions passed");
