import assert from "node:assert/strict";
import {
  EVIDENCE_CHECKLIST_SECTIONS,
  EVIDENCE_STATUS_OPTIONS,
  EVIDENCE_TEMPLATE_VERSION,
  PREVIOUS_EVIDENCE_TEMPLATE_VERSION,
  LEGACY_EVIDENCE_TEMPLATE_VERSION,
  createDefaultStationProfile,
  
  buildChecklistTemplateSections,
  buildMasterChecklistSections,
  createChecklistCopySnapshot,
  createMasterChecklistCopySnapshot,
  getItemsForSnapshot,
  getEvidenceCatalogForSnapshot,
  getRoundSummary,
  makeEquipment,
  makeLane,
  migrateChecklistCopyForCurrentTemplate,
  LEGACY_CHECKLIST_COPY_REVISION,
  LEGACY_MASTER_TEMPLATE_VERSION,
  normalizeRound,
  updateChecklistCopy,
  updateMasterChecklistCopy,
} from "../src/domain/master-checklist.js";
import { createLegacyInspectionRound as createInspectionRound } from "./legacy_round_fixture.mjs";

const expectedSectionCounts = {
  "1.1": 6,
  "2.1": 21,
  "2.2": 6,
  "2.3": 26,
  "3.1": 6,
  "3.2": 19,
  "4.1": 31,
  "4.2": 8,
  "5.1": 9,
  "6.1": 7,
  "6.2": 12,
  "6.3": 12,
  "7.1": 7,
};

assert.deepEqual(Object.fromEntries(EVIDENCE_CHECKLIST_SECTIONS.map((section) => [section.code, section.items.length])), expectedSectionCounts);
assert.equal(Object.keys(expectedSectionCounts).length, 13);
assert.deepEqual(new Set(EVIDENCE_CHECKLIST_SECTIONS.map((section) => section.code)).size, 13);

const catalogItems = EVIDENCE_CHECKLIST_SECTIONS.flatMap((section) => section.items);
const catalogSlots = catalogItems.flatMap((item) => item.evidenceSlots);
assert.equal(catalogItems.length, 170);
assert.equal(new Set(catalogItems.map((item) => item.id)).size, catalogItems.length);
assert.equal(new Set(catalogSlots.map((slot) => slot.id)).size, catalogSlots.length);
catalogSlots.forEach((slot) => {
  assert.ok(slot.sourceFile);
  assert.ok(slot.sourceLabel);
  assert.ok(Number.isInteger(slot.sourceOrder));
  assert.equal(slot.required, true);
});
assert.deepEqual(EVIDENCE_STATUS_OPTIONS.map((option) => option.value), ["pending", "complete", "no-image", "missing", "not-installed", "server-site", "na"]);

const profile = createDefaultStationProfile();
const round = createInspectionRound(profile);
assert.equal(round.templateVersion, EVIDENCE_TEMPLATE_VERSION);
assert.equal(round.snapshot.templateVersion, EVIDENCE_TEMPLATE_VERSION);
assert.equal(round.snapshot.evidenceCatalog.length, 151, "snapshot stores the exact evidence-slot list used by the round");
const items = getItemsForSnapshot(round.snapshot);
assert.equal(items.length, 123);
assert.deepEqual(items.filter((item) => ["5.1.plate-document", "5.1.vehicle-document"].includes(item.id)).map((item) => ({ id: item.id, label: item.label, checklistNumber: item.checklistNumber, vehicleReviewContext: item.vehicleReviewContext })), [
  { id: "5.1.plate-document", label: "เอกสารผลการจำแนกป้ายทะเบียน", checklistNumber: "5.1.5", vehicleReviewContext: "plate" },
  { id: "5.1.vehicle-document", label: "เอกสารผลการจำแนกประเภทรถ", checklistNumber: "5.1.6", vehicleReviewContext: "classification" },
]);
const swappedVehicleCopy = {
  ...round.snapshot.checklistCopy,
  sections: round.snapshot.checklistCopy.sections.map((section) => section.code === "5.1"
    ? { ...section, items: [
        ...section.items.filter((item) => !["5.1.plate-document", "5.1.vehicle-document"].includes(item.id)),
        section.items.find((item) => item.id === "5.1.vehicle-document"),
        section.items.find((item) => item.id === "5.1.plate-document"),
      ] }
    : section),
};
const swappedSnapshot = { ...round.snapshot, checklistCopy: swappedVehicleCopy };
const migratedDraftRound = normalizeRound({ ...round, status: "draft", snapshot: swappedSnapshot }, [profile], profile);
const migratedDraftVehicleItems = migratedDraftRound.snapshot.checklistCopy.sections.find((section) => section.code === "5.1").items.filter((item) => ["5.1.plate-document", "5.1.vehicle-document"].includes(item.id));
assert.deepEqual(migratedDraftVehicleItems.map((item) => item.id), ["5.1.plate-document", "5.1.vehicle-document"], "open drafts adopt the new 5.1.5 then 5.1.6 order");
const closedWithSwappedSnapshot = normalizeRound({ ...round, status: "closed", snapshot: swappedSnapshot }, [profile], profile);
const closedVehicleItems = closedWithSwappedSnapshot.snapshot.checklistCopy.sections.find((section) => section.code === "5.1").items.filter((item) => ["5.1.plate-document", "5.1.vehicle-document"].includes(item.id));
assert.deepEqual(closedVehicleItems.map((item) => item.id), ["5.1.vehicle-document", "5.1.plate-document"], "closed Snapshots keep their historical order");
assert.equal(items.filter((item) => item.isEquipmentCleaning).length, 14);
assert.equal(items.filter((item) => item.isEquipmentCleaning && item.cleaningAssetType.startsWith("VMS_")).length, 3);
assert.equal(items.find((item) => item.id === "2.1.sensor-set-1-03").assetId, "sensor-3");
assert.equal(items.filter((item) => item.sectionCode === "2.1" && item.id.includes("sensor-set")).length, 3);
assert.equal(new Set(items.filter((item) => item.sectionCode === "2.1" && item.id.includes("sensor-set")).map((item) => item.assetId)).size, 3);
assert.deepEqual(
  items.filter((item) => item.sectionCode === "3.2" && item.id.endsWith("-day")).map((item) => item.assetId),
  ["draft-lpr_camera-1", "draft-lpr_camera-2", "draft-lpr_camera-3"],
);
assert.equal(items.find((item) => item.id === "2.1.loop-06").assetId, null, "fixed PDF slot remains visible without an Asset Profile entry");
assert.equal(round.inspectionItems["2.1.loop-06"].status, "na");
assert.equal(round.inspectionItems["2.1.loop-06"].evidence["2.1.loop-06.evidence"].status, "na");
assert.equal(round.inspectionItems["1.1.crane"].evidence["1.1.crane.evidence"].status, "pending", "sourceObservedStatus must not become the new-round default");

const storedOldCopy = {
  ...createChecklistCopySnapshot(),
  sections: createChecklistCopySnapshot().sections.map((section) => section.code === "1.1"
    ? {
      ...section,
      title: "การเตรียมความพร้อม",
      items: section.items.map((item) => item.id === "1.1.staff"
        ? {
          ...item,
          label: "พนักงานผู้ปฏิบัติงาน",
          helper: "ตรวจและบันทึกตามช่องในเอกสารแนบ",
          evidenceSlots: item.evidenceSlots.map((slot) => ({ ...slot, displayLabel: "พนักงานผู้ปฏิบัติงาน" })),
        }
        : item),
    }
    : section),
};
const migratedStoredCopy = migrateChecklistCopyForCurrentTemplate(storedOldCopy);
const migratedStaff = migratedStoredCopy.sections.find((section) => section.code === "1.1")?.items.find((item) => item.id === "1.1.staff");
assert.equal(migratedStaff?.label, "ภาพพนักงานผู้ปฏิบัติงาน ณ หน้างาน", "old generated copy receives the clearer display label");
assert.equal(migratedStaff?.helper, "แนบภาพหลักฐานให้เห็นอุปกรณ์หรือจุดตรวจตามหัวข้อนี้", "old generated copy receives the evidence guidance");
const userEditedStoredCopy = {
  ...storedOldCopy,
  sections: storedOldCopy.sections.map((section) => section.code === "1.1"
    ? { ...section, items: section.items.map((item) => item.id === "1.1.staff" ? { ...item, label: "ชื่อที่ผู้ใช้แก้เอง", helper: "คำแนะนำของผู้ใช้" } : item) }
    : section),
};
const preservedUserCopy = migrateChecklistCopyForCurrentTemplate(userEditedStoredCopy);
assert.equal(preservedUserCopy.sections.find((section) => section.code === "1.1")?.items.find((item) => item.id === "1.1.staff")?.label, "ชื่อที่ผู้ใช้แก้เอง", "user-edited copy is preserved during migration");

const noLaneRound = createInspectionRound({ ...profile, id: "station-no-lane", lanes: [] });
assert.equal(getItemsForSnapshot(noLaneRound.snapshot).some((item) => item.sectionCode === "3.1"), false, "a station without Lane must not create Lane checklist rows");
const twoLaneRound = createInspectionRound({ ...profile, id: "station-two-lane", lanes: [makeLane(1), makeLane(2)] });
assert.equal(getItemsForSnapshot(twoLaneRound.snapshot).filter((item) => item.sectionCode === "3.1").length, 4, "two lanes create exactly two checks per lane");
assert.deepEqual(getItemsForSnapshot(twoLaneRound.snapshot).filter((item) => item.sectionCode === "3.1").map((item) => item.laneId), ["lane-1", "lane-1", "lane-2", "lane-2"]);
const fourLaneRound = createInspectionRound({ ...profile, id: "station-four-lane", lanes: [1, 2, 3, 4].map((lane) => makeLane(lane)) });
assert.equal(getItemsForSnapshot(fourLaneRound.snapshot).filter((item) => item.sectionCode === "3.1").length, 8, "Lane topology can exceed the three lanes shown in the source PDF");
const historicalV4 = getItemsForSnapshot({
  ...round.snapshot,
  id: "snapshot-v4-history",
  templateVersion: PREVIOUS_EVIDENCE_TEMPLATE_VERSION,
  lanes: [],
  equipment: [makeEquipment("LANE", 1, { id: "historical-lane-1", assetNo: "LANE-01" })],
});
assert.equal(historicalV4.find((item) => item.id === "3.1.lane-1-day")?.assetId, "historical-lane-1", "v4 Snapshot keeps the old Lane Asset binding");
assert.equal(historicalV4.find((item) => item.id === "3.1.lane-1-day")?.laneId || null, null, "historical v4 data does not get rewritten as topology");

const sensorProfileWithCount = (count) => ({
  ...profile,
  id: `sensor-count-${count}`,
    equipment: profile.equipment
    .filter((entry) => entry.type !== "WIM_SENSOR")
    .concat(Array.from({ length: count }, (_, index) => makeEquipment("WIM_SENSOR", index + 1, {
      id: `sensor-count-${count}-${index + 1}`,
      assetNo: `SENSOR-${String(index + 1).padStart(2, "0")}`,
      location: `จุด Sensor ${index + 1}`,
      parentSystemId: index % 2 === 0 ? "wim-sorting-1" : "wim-sorting-2",
      laneId: index % 2 === 0 ? "lane-1" : "lane-2",
    }))),
});
for (const count of [0, 3, 12, 13]) {
  const sensorRound = createInspectionRound(sensorProfileWithCount(count));
  const sensorItems = getItemsForSnapshot(sensorRound.snapshot).filter((item) => (
    item.sectionCode === "2.1"
    && item.assetId
    && item.label.includes("WIM Sensor")
  ));
  assert.equal(sensorItems.length, count, `new round with ${count} Sensor(s) has exactly one item per active Asset`);
  assert.equal(getItemsForSnapshot(sensorRound.snapshot).filter((item) => item.sectionCode === "2.1").length, 3 + count + 6, `2.1 keeps the three photo and six Loop source slots around the real Sensors`);
  assert.equal(new Set(sensorItems.map((item) => item.assetId)).size, count, `new round with ${count} Sensor(s) has unique asset bindings`);
  assert.equal(sensorItems.filter((item) => item.id.includes("additional-asset")).length, 0, "current Sensor items use stable template/Asset IDs rather than additional-asset IDs");
  assert.equal(sensorItems.filter((item) => item.isAdditional).length, count > 12 ? count - 12 : 0);
  if (count > 12) assert.equal(sensorItems.at(-1).label, `ค่าที่วัดได้จาก WIM Sensor · เซนเซอร์ชั่งน้ำหนัก WIM #${count}`);
}
assert.deepEqual(
  items.filter((item) => item.sectionCode === "3.2" && item.id.endsWith("-day")).map((item) => item.assetId),
  ["draft-lpr_camera-1", "draft-lpr_camera-2", "draft-lpr_camera-3"],
  "LPR Lane evidence binds to the matching camera order",
);
EVIDENCE_CHECKLIST_SECTIONS.forEach((section) => {
  const labels = section.items.map((item) => item.displayLabel || item.label);
  assert.equal(new Set(labels).size, labels.length, `${section.code} display labels are unique`);
});

const legacyDefaultCopy = {
  revision: "checklist-copy-v1",
  sections: EVIDENCE_CHECKLIST_SECTIONS.map((section) => ({
    code: section.code,
    title: section.title,
    items: section.items.map((item) => ({
      id: item.id,
      label: item.sourceLabel,
      helper: item.helper,
      unit: item.unit,
      sourceLabel: item.sourceLabel,
      evidenceSlots: item.evidenceSlots.map((slot) => ({
        id: slot.id,
        displayLabel: slot.sourceLabel,
        sourceLabel: slot.sourceLabel,
        sourceOrder: slot.sourceOrder,
        fieldType: slot.fieldType,
        required: slot.required,
      })),
    })),
  })),
};
const migratedCopy = migrateChecklistCopyForCurrentTemplate(legacyDefaultCopy);
assert.equal(migratedCopy.sections.find((section) => section.code === "2.1").items.find((item) => item.id === "2.1.sensor-set-2-01").label, "ค่าที่วัดได้จาก WIM Sensor · เซนเซอร์ชั่งน้ำหนัก WIM #4");
const userEditedCopy = migrateChecklistCopyForCurrentTemplate({
  ...legacyDefaultCopy,
  sections: legacyDefaultCopy.sections.map((section) => section.code === "2.1" ? {
    ...section,
    items: section.items.map((item) => item.id === "2.1.sensor-set-2-01"
      ? { ...item, label: "ชื่อที่ผู้ใช้แก้เอง", evidenceSlots: [{ ...item.evidenceSlots[0], displayLabel: "หลักฐานที่ผู้ใช้แก้เอง" }] }
      : item),
  } : section),
});
assert.equal(userEditedCopy.sections.find((section) => section.code === "2.1").items.find((item) => item.id === "2.1.sensor-set-2-01").label, "ชื่อที่ผู้ใช้แก้เอง");
assert.equal(userEditedCopy.sections.find((section) => section.code === "2.1").items.find((item) => item.id === "2.1.sensor-set-2-01").evidenceSlots[0].displayLabel, "หลักฐานที่ผู้ใช้แก้เอง");

const customizedSections = buildChecklistTemplateSections({
  sections: { "2.1": "WIM Sensor readings" },
  items: { "2.1.sensor-set-1-01": "Sensor reading #1" },
  units: { "2.1.sensor-set-1-01": "mm" },
  helpers: { "2.1.sensor-set-1-01": "Record the measured value" },
});
const customizedCopy = {
  revision: "checklist-copy-test",
  sections: customizedSections.map((section) => ({
    code: section.code,
    title: section.title,
    items: section.items.map((item) => ({
      id: item.id,
      label: item.label,
      helper: item.helper,
      unit: item.unit,
      sourceLabel: item.sourceLabel,
      evidenceSlots: item.evidenceSlots.map((slot) => ({
        id: slot.id,
        displayLabel: slot.displayLabel,
        sourceLabel: slot.sourceLabel,
        sourceOrder: slot.sourceOrder,
        fieldType: slot.fieldType,
        required: slot.required,
      })),
    })),
  })),
};
const customizedSnapshot = { ...round.snapshot, copyRevision: customizedCopy.revision, checklistCopy: customizedCopy };
const customizedItems = getItemsForSnapshot(customizedSnapshot);
const customizedSensor = customizedItems.find((item) => item.id === "2.1.sensor-set-1-01");
assert.equal(customizedItems.length, items.length, "copy changes must not change item count");
assert.equal(customizedSensor.label, "Sensor reading #1");
assert.equal(customizedSensor.helper, "Record the measured value");
assert.equal(customizedSensor.unit, "mm");
assert.equal(customizedSensor.assetId, "sensor-1", "copy changes must not change Asset binding");
assert.equal(customizedSensor.sourceLabel, "วัดค่า SENSOR #1", "PDF source label must remain immutable");
assert.equal(customizedSensor.evidenceSlots[0].displayLabel, "Sensor reading #1");
assert.equal(customizedSensor.evidenceSlots[0].sourceLabel, "วัดค่า SENSOR #1");
assert.equal(customizedItems.find((item) => item.id === "2.1.road-01").assetId, "sensor-1", "generic stable-ID binding must remain intact after copy changes");
assert.equal(customizedItems.find((item) => item.sectionCode === "2.1").sectionTitle, "WIM Sensor readings");
assert.equal(getItemsForSnapshot(round.snapshot).find((item) => item.id === "2.1.sensor-set-1-01").label, "ค่าที่วัดได้จาก WIM Sensor · เซนเซอร์ชั่งน้ำหนัก WIM #1", "stored Snapshot copy must not be replaced by another copy");

const editedEvidenceCopy = updateChecklistCopy(round.snapshot.checklistCopy, {
  sectionCode: "2.1",
  itemId: "2.1.sensor-set-1-01",
  field: "label",
  value: "ค่าที่วัด Sensor ช่องที่ 1",
});
const editedMasterCopy = updateMasterChecklistCopy(createMasterChecklistCopySnapshot(), {
  sectionCode: "1.1",
  itemId: "staff-count",
  field: "label",
  value: "พนักงานเข้าตรวจงาน",
});
const editedRound = createInspectionRound(profile, {}, {
  checklistCopy: editedEvidenceCopy,
  masterChecklistCopy: editedMasterCopy,
});
assert.equal(editedRound.snapshot.checklistCopy.revision.startsWith("checklist-copy-local-"), true);
assert.equal(editedRound.snapshot.masterChecklistCopy.revision.startsWith("master-checklist-copy-local-"), true);
assert.equal(getItemsForSnapshot(editedRound.snapshot).find((item) => item.id === "2.1.sensor-set-1-01").label, "ค่าที่วัด Sensor ช่องที่ 1");
assert.equal(getItemsForSnapshot(editedRound.snapshot).length, items.length, "web copy edits must not change evidence item count");
assert.equal(getItemsForSnapshot(editedRound.snapshot).find((item) => item.id === "2.1.sensor-set-1-01").assetId, "sensor-1");
assert.equal(buildMasterChecklistSections(editedRound.snapshot.masterChecklistCopy).find((section) => section.code === "1.1").items.find((item) => item.id === "staff-count").label, "พนักงานเข้าตรวจงาน");
assert.equal(buildMasterChecklistSections(editedRound.snapshot.masterChecklistCopy).flatMap((section) => section.items).length, 44, "web copy edits must not change master item count");
assert.equal(round.snapshot.checklistCopy.sections.find((section) => section.code === "2.1").items.find((item) => item.id === "2.1.sensor-set-1-01").label, "ค่าที่วัดได้จาก WIM Sensor · เซนเซอร์ชั่งน้ำหนัก WIM #1", "editing a new round copy must not rewrite an older Snapshot");

const legacyV3BaseSnapshot = {
  ...round.snapshot,
  cleaningPolicyVersion: null,
  copyRevision: undefined,
  checklistCopy: undefined,
  templateVersion: LEGACY_EVIDENCE_TEMPLATE_VERSION,
  evidenceCatalog: undefined,
};
const legacyV3Snapshot = {
  ...legacyV3BaseSnapshot,
  evidenceCatalog: getEvidenceCatalogForSnapshot(legacyV3BaseSnapshot).map((entry) => entry.itemId === "1.1.staff"
    ? { ...entry, itemLabel: "Historical staff label", displayLabel: undefined }
    : entry),
};
const migratedV3 = normalizeRound({ ...round, snapshot: legacyV3Snapshot }, [profile], profile);
assert.equal(migratedV3.snapshot.copyRevision, LEGACY_CHECKLIST_COPY_REVISION);
assert.equal(migratedV3.snapshot.checklistCopy.sections.length, 13);
assert.equal(getItemsForSnapshot(migratedV3.snapshot).find((item) => item.id === "1.1.staff").label, "Historical staff label", "existing v3 catalog labels must be frozen during migration");
assert.equal(getItemsForSnapshot(migratedV3.snapshot).filter((item) => item.sectionCode === "2.1" && item.id.includes("sensor-set")).length, 12);
assert.deepEqual(
  getItemsForSnapshot(migratedV3.snapshot).filter((item) => item.sectionCode === "2.1" && item.id.includes("sensor-set")).map((item) => item.assetId),
  ["sensor-1", "sensor-2", "sensor-3", "sensor-1", "sensor-2", "sensor-3", "sensor-1", "sensor-2", "sensor-3", "sensor-1", "sensor-2", "sensor-3"],
  "legacy v3 Sensor mapping stays frozen",
);

const disabledSnapshot = { ...round.snapshot, evidenceCatalog: undefined, checklistConfig: { disabledTemplateIds: ["1.1.staff"] } };
const disabledRound = createInspectionRound(profile, {}, { snapshot: disabledSnapshot });
assert.equal(disabledRound.inspectionItems["1.1.staff"].status, "na");
assert.equal(disabledRound.inspectionItems["1.1.staff"].evidence["1.1.staff.evidence"].status, "na");
assert.equal(getRoundSummary(disabledRound).evidenceTotal, 138, "administrator-disabled items leave the active evidence count");

const noImageId = "1.1.traffic-cone-light";
round.inspectionItems[noImageId].evidence["1.1.traffic-cone-light.evidence"].status = "no-image";
round.inspectionItems["5.1.model-sn"].evidence["5.1.model-sn.evidence"].status = "server-site";
round.inspectionItems["1.1.staff"].evidence["1.1.staff.evidence"].attachment = { id: "staff-photo" };
round.inspectionItems["1.1.vehicle"].evidence["1.1.vehicle.evidence"].attachment = { id: "vehicle-photo" };
assert.notEqual(round.inspectionItems["1.1.staff"].evidence["1.1.staff.evidence"].attachment.id, round.inspectionItems["1.1.vehicle"].evidence["1.1.vehicle.evidence"].attachment.id, "evidence attachments stay isolated per slot");
const evidenceSummary = getRoundSummary(round);
assert.equal(evidenceSummary.evidenceTotal, 139);
assert.equal(evidenceSummary.evidenceComplete, 0);
assert.equal(evidenceSummary.evidenceStatusCounts["no-image"], 1);
assert.equal(evidenceSummary.evidenceStatusCounts["server-site"], 1);
assert.equal(evidenceSummary.evidenceIncomplete, 139);

const legacyRound = createInspectionRound(profile, {}, {
  snapshot: { ...round.snapshot, templateVersion: LEGACY_MASTER_TEMPLATE_VERSION, cleaningPolicyVersion: null },
  templateVersion: LEGACY_MASTER_TEMPLATE_VERSION,
});
legacyRound.inspectionItems["sensor-1"] = { value: "12.5", status: "normal", note: "ข้อมูลเดิม", attachment: { id: "legacy-attachment" } };
legacyRound.inspectionItems["wim_sensor-sensor-1"] = { value: "13.5", status: "damaged", note: "ข้อมูลจาก dynamic item เดิม", attachment: { id: "legacy-dynamic-attachment" } };
const migratedDraft = normalizeRound(legacyRound, [profile], profile);
assert.equal(migratedDraft.status, "draft");
assert.equal(migratedDraft.templateVersion, EVIDENCE_TEMPLATE_VERSION);
assert.equal(getItemsForSnapshot(migratedDraft.snapshot).length, 161);
const migratedSensor = migratedDraft.inspectionItems["2.1.sensor-set-1-01"];
assert.equal(migratedSensor.value, "13.5");
assert.equal(migratedSensor.status, "damaged");
assert.equal(migratedSensor.note, "ข้อมูลจาก dynamic item เดิม");
assert.equal(migratedSensor.attachment.id, "legacy-dynamic-attachment");

const closedLegacy = normalizeRound({ ...legacyRound, status: "closed", closedAt: "2026-09-02T00:00:00.000Z" }, [profile], profile);
assert.equal(closedLegacy.templateVersion, LEGACY_MASTER_TEMPLATE_VERSION);
assert.equal(getItemsForSnapshot(closedLegacy.snapshot).length, 44);
const closedLegacyWithoutVersion = normalizeRound({ ...legacyRound, templateVersion: undefined, snapshot: { ...legacyRound.snapshot, templateVersion: undefined }, status: "closed", closedAt: "2026-09-02T00:00:00.000Z" }, [profile], profile);
assert.equal(closedLegacyWithoutVersion.templateVersion, LEGACY_MASTER_TEMPLATE_VERSION);
assert.equal(getItemsForSnapshot(closedLegacyWithoutVersion.snapshot).length, 44);

console.log("evidence checklist smoke passed", JSON.stringify({ sections: 13, evidenceItems: 123, cleaningEvidenceSlots: 42, migratedDraft: migratedDraft.templateVersion }));
