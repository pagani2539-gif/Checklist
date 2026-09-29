import assert from "node:assert/strict";
import { createDefaultStationProfile,  LEGACY_MASTER_TEMPLATE_VERSION, updateMasterChecklistCopy } from "../../src/domain/master-checklist.js";
import { createLegacyInspectionRound as createInspectionRound } from "../legacy_round_fixture.mjs";
import { buildReportTemplateModel, getPresentationEvidenceCaption } from "../../src/domain/report-template.js";
import { normalizeStationInspectionReports } from "../../src/domain/station-inspection-reports.js";

const profile = createDefaultStationProfile();
profile.checklistConfig.disabledTemplateIds = ["sensor-2", "vms-video"];
const round = createInspectionRound(profile, {
  projectName: "โครงการทดสอบ Template",
  inspectionDate: "2026-09-01",
  inspector: "ผู้ตรวจสอบตัวอย่าง",
  documentNo: "MA-2026-001",
  preparedBy: "ผู้จัดทำตัวอย่าง",
  approvedBy: "ผู้อนุมัติตัวอย่าง",
  approvalDate: "2026-09-03",
});

round.snapshot.checklistCopy = {
  ...round.snapshot.checklistCopy,
  revision: "checklist-copy-report-test",
  sections: round.snapshot.checklistCopy.sections.map((section) => section.code === "1.1" ? {
    ...section,
    title: "Readiness report",
    items: section.items.map((item) => item.id === "1.1.staff" ? {
      ...item,
      label: "Staff on site",
      helper: "Record the field team",
      unit: "people",
      evidenceSlots: item.evidenceSlots.map((slot) => ({ ...slot, displayLabel: "Staff evidence" })),
    } : item),
  } : section),
};
round.snapshot.copyRevision = round.snapshot.checklistCopy.revision;

const firstItemId = Object.keys(round.inspectionItems)[0];
round.inspectionItems[firstItemId] = {
  ...round.inspectionItems[firstItemId],
  value: "12.5",
  status: "normal",
  note: "ภาพหลักฐานทดสอบ",
  attachment: {
    id: "attachment-demo",
    name: "evidence.jpg",
    type: "image/jpeg",
    size: 12345,
  },
};

round.vehicleSearch = {
  apiProfile: "imps-v2",
  fetchedAt: "2026-09-01T10:00:00.000Z",
  criteria: { startAt: "2026-09-01T00:00", endAt: "2026-09-01T23:59" },
  sourceStation: { id: "6", name: "สถานี API ทดสอบ" },
  pagination: { totalItems: 1, totalPages: 1, pageSize: 200 },
  rawResponse: { secret: "must not enter the report" },
  rows: [{
    id: "vehicle-1",
    vehicleId: "9001",
    plateNumber: "กข 1234",
    province: "เพชรบุรี",
    stationId: "6",
    stationName: "สถานี API ทดสอบ",
    occurredAt: "2026-09-01T10:00:00+07:00",
    lane: "1",
    vehicleClassId: "2",
    vehicleClassLabel: "รถ 6 ล้อ",
    axleCount: 2,
    axles: [],
    grossWeight: 8000,
    grossWeightLimit: 15000,
    reviewStatus: "incorrect",
    classificationReviewStatus: "correct",
    axleReviewStatus: "correct",
    integrityReviewStatus: "correct",
    integrityWarnings: [{ code: "warning-flags", message: "พบ warning flags 1 รายการ" }],
  }],
};

const migratedReports = normalizeStationInspectionReports([], [round]);
const model = buildReportTemplateModel(round, { stationInspectionReports: migratedReports });
const items = model.sections.flatMap((section) => section.items);
const baselineSummary = model.summary;

const scDisplayRound = {
  ...round,
  snapshot: { ...round.snapshot, stationFormat: "SC", checklistPresentationVersion: "boq-system-groups-v2" },
};
const scDisplayModel = buildReportTemplateModel(scDisplayRound);
assert.ok(scDisplayModel.sections.some((section) => section.code === "SC-01.01"), "new SC reports should use format-qualified presentation group IDs");
assert.ok(scDisplayModel.sections.some((section) => section.code === "SC-01.02"), "new SC reports should separate systems and software");
assert.ok(scDisplayModel.sections.some((section) => section.code === "1.1"), "station-level readiness remains a separate section");

const impsDisplayRound = {
  ...round,
  snapshot: { ...round.snapshot, stationFormat: "IMPS", checklistPresentationVersion: "boq-system-groups-v2" },
};
const impsDisplayModel = buildReportTemplateModel(impsDisplayRound);
assert.ok(impsDisplayModel.sections.some((section) => section.code === "IMPS-02.01"), "new IMPS reports should use IMPS-qualified display IDs");
assert.ok(impsDisplayModel.sections.some((section) => section.code === "IMPS-06.02"), "new IMPS reports should use full IMPS codes for system/software groups");

const legacyImpsDisplayRound = {
  ...round,
  snapshot: { ...round.snapshot, stationFormat: "IMPS", checklistPresentationVersion: "boq-system-groups-v1" },
};
const legacyImpsDisplayModel = buildReportTemplateModel(legacyImpsDisplayRound);
assert.ok(legacyImpsDisplayModel.sections.some((section) => section.code === "08.01"), "legacy IMPS reports should retain their saved presentation numbering");
assert.equal(round.snapshot.checklistPresentationVersion, undefined, "report presentation projection must not mutate the stored Snapshot");

assert.equal(model.templateId, "checklist-report-a4-portrait-v1");
assert.equal(model.schemaVersion, "checklist-report-model-v2");
assert.equal(model.page.orientation, "portrait");
assert.equal(model.metadata.documentNo, "MA-2026-001");
assert.equal(model.metadata.preparedBy, "ผู้จัดทำตัวอย่าง");
assert.equal(model.metadata.approvedBy, "ผู้อนุมัติตัวอย่าง");
assert.equal(model.metadata.approvalDate, "2026-09-03");
assert.equal(model.summary.total, 110);
assert.equal(items.length, 110);
assert.equal(model.vehicleSearch.pagination.totalItems, 1);
assert.equal(model.vehicleSearch.summary.dimensions.plate.incorrect, 1);
assert.deepEqual(model.vehicleSearch.contexts.map((context) => ({ key: context.key, checklistNumber: context.checklistNumber })), [
  { key: "plate", checklistNumber: "5.1.5" },
  { key: "classification", checklistNumber: "5.1.6" },
]);
assert.equal(model.vehicleSearch.contexts.find((context) => context.key === "plate").label, "ตรวจผลอ่านป้ายทะเบียนจาก API");
assert.equal(model.vehicleSearch.contexts.find((context) => context.key === "classification").label, "ตรวจผลคัดแยกประเภทรถจาก API");
assert.equal(model.vehicleSearch.contexts.find((context) => context.key === "plate").summary.dimensions.plate.incorrect, 1);
assert.equal(model.vehicleSearch.contexts.find((context) => context.key === "classification").summary.dimensions.classification.correct, 1);
assert.equal(model.vehicleSearch.issues.some((issue) => issue.kind === "vehicle-review" && issue.status === "incorrect"), true);
assert.equal(model.vehicleSearch.issues.some((issue) => issue.kind === "integrity-warning" && issue.code === "warning-flags"), false, "v2 review keeps axle/integrity warnings outside the two pass/fail dimensions");
assert.equal(Object.hasOwn(model.vehicleSearch, "rows"), true, "reports include every vehicle row for the printable detail table and evidence appendix");
assert.equal(model.vehicleSearch.rows[0].reviewStatus, "incorrect");
assert.equal(model.vehicleSearch.rows[0].grossWeight, 8000);
assert.equal(model.vehicleSearch.rows[0].integrityWarnings[0].code, "warning-flags");
assert.equal(JSON.stringify(model.vehicleSearch).includes("must not enter the report"), false, "raw Vehicle API response is never copied into the report model");
assert.equal(items.some((item) => item.id.includes("5.1.plate-document")), false, "new API-only plate review is reported separately from the physical checklist table");
assert.equal(items.every((item) => item.applicable !== false), true, "print model excludes non-applicable Snapshot items");
assert.equal(items.some((item) => item.evidenceSlots.length > 0), true);
assert.equal(items.some((item) => item.evidenceSlots.some((slot) => slot.status === "pending")), true);
assert.equal(model.sections.find((section) => section.code === "1.1").title, "Readiness report");
assert.equal(items.find((item) => item.id === "1.1.staff").label, "Staff on site");
assert.equal(items.find((item) => item.id === "1.1.staff").helper, "Record the field team");
assert.equal(items.find((item) => item.id === "1.1.staff").unit, "people");
assert.equal(items.find((item) => item.id === "1.1.staff").evidenceSlots[0].displayLabel, "Staff evidence");
assert.equal(items.find((item) => item.id === "1.1.staff").evidenceSlots[0].sourceLabel, "พนักงานเข้าปฏิบัติงาน");
assert.equal(items.find((item) => item.id === firstItemId).attachment.source, "indexeddb");
assert.equal(items.find((item) => item.id === firstItemId).note, "ภาพหลักฐานทดสอบ");
assert.equal(getPresentationEvidenceCaption({ note: "", sourceObservedStatus: "not-installed", statusLabel: "หลักฐานครบถ้วน", attachment: { id: "attached" } }, "หลักฐานตามขั้นตอนการตรวจ"), "หลักฐานตามขั้นตอนการตรวจ", "source status is hidden when evidence is attached");
assert.equal(getPresentationEvidenceCaption({ note: "", sourceObservedStatus: "not-installed", statusLabel: "ไม่ได้ติดตั้ง", attachment: null }, "หลักฐานตามขั้นตอนการตรวจ"), "ไม่ได้ติดตั้ง", "missing evidence keeps the localized status label");
assert.equal(getPresentationEvidenceCaption({ note: "ตรวจซ้ำแล้ว", sourceObservedStatus: "not-installed", statusLabel: "หลักฐานครบถ้วน", attachment: { id: "attached" } }, "หลักฐานตามขั้นตอนการตรวจ"), "ตรวจซ้ำแล้ว", "authored evidence note has priority");

const hiddenStatusIds = items.slice(0, 2).map((item) => item.id);
const hiddenStatusRound = {
  ...round,
  inspectionItems: {
    ...round.inspectionItems,
    [hiddenStatusIds[0]]: {
      ...round.inspectionItems[hiddenStatusIds[0]],
      status: "na",
      evidence: Object.fromEntries(Object.entries(round.inspectionItems[hiddenStatusIds[0]]?.evidence || {}).map(([slotId, evidence]) => [slotId, { ...evidence, status: "pending", attachment: { id: `hidden-${slotId}` } }])),
    },
    [hiddenStatusIds[1]]: {
      ...round.inspectionItems[hiddenStatusIds[1]],
      status: "not-installed",
      note: "",
    },
  },
};
const hiddenStatusModel = buildReportTemplateModel(hiddenStatusRound);
const hiddenStatusItems = hiddenStatusModel.sections.flatMap((section) => section.items);
assert.equal(hiddenStatusItems.some((item) => hiddenStatusIds.includes(item.id)), false, "not-applicable and not-installed items are hidden from reports");
assert.equal(hiddenStatusModel.summary.total, baselineSummary.total - hiddenStatusIds.length, "report item total excludes hidden statuses");
assert.equal(hiddenStatusModel.summary.evidenceTotal, baselineSummary.evidenceTotal - (round.inspectionItems[hiddenStatusIds[0]].evidence ? Object.keys(round.inspectionItems[hiddenStatusIds[0]].evidence).length : 0) - (round.inspectionItems[hiddenStatusIds[1]].evidence ? Object.keys(round.inspectionItems[hiddenStatusIds[1]].evidence).length : 0), "report evidence total excludes hidden statuses");

const correctedModel = buildReportTemplateModel({
  ...round,
  status: "closed",
  closedAt: "2026-09-02T09:00:00.000Z",
  correctionHistory: [{
    id: "correction-report-test",
    reason: "แก้ค่าตามใบตรวจหน้างาน",
    editedAt: "2026-09-02T10:00:00.000Z",
    editedBy: "local-browser-user",
  }],
});
assert.equal(correctedModel.metadata.closedAt, "2026-09-02T09:00:00.000Z");
assert.deepEqual(correctedModel.correction, {
  count: 1,
  latestAt: "2026-09-02T10:00:00.000Z",
  latestReason: "แก้ค่าตามใบตรวจหน้างาน",
  latestEditor: "local-browser-user",
});

profile.checklistConfig.disabledTemplateIds = [];
profile.equipment.find((equipment) => equipment.id === "sensor-1").active = false;
const snapshotStableModel = buildReportTemplateModel(round);
assert.equal(snapshotStableModel.sections.flatMap((section) => section.items).length, 110, "model must remain bound to the round snapshot");

const legacyRound = {
  ...createInspectionRound(profile, { projectName: "ประวัติเดิม" }, {
    snapshot: {
      ...round.snapshot,
      templateVersion: LEGACY_MASTER_TEMPLATE_VERSION,
      masterChecklistCopy: updateMasterChecklistCopy(round.snapshot.masterChecklistCopy, {
        sectionCode: "1.1",
        itemId: "staff-count",
        field: "label",
        value: "เจ้าหน้าที่ประจำหน้างาน",
      }),
    },
    templateVersion: LEGACY_MASTER_TEMPLATE_VERSION,
  }),
  meta: { projectName: "ประวัติเดิม" },
};
const legacyModel = buildReportTemplateModel(legacyRound);
assert.equal(legacyModel.summary.total, 43, "closed legacy rounds keep their v2 item template");
assert.equal(legacyModel.sections.flatMap((section) => section.items).length, 43);
assert.equal(legacyModel.sections.find((section) => section.code === "1.1").items.find((item) => item.id === "staff-count").label, "เจ้าหน้าที่ประจำหน้างาน");
assert.equal(legacyModel.metadata.documentNo, "", "legacy rounds may omit document metadata");
assert.equal(legacyModel.metadata.preparedBy, "", "legacy rounds may omit prepared-by metadata");
assert.equal(legacyModel.metadata.approvedBy, "", "legacy rounds may omit approved-by metadata");
assert.equal(legacyModel.metadata.approvalDate, "", "legacy rounds may omit approval-date metadata");

console.log("report-template model smoke passed", JSON.stringify({ sections: model.sections.length, items: items.length }));
