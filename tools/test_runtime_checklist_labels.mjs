import assert from "node:assert/strict";
import {
  createDefaultStationProfile,
  createInspectionRound,
  CHECKLIST_SECTION_TITLES,
  EVIDENCE_CHECKLIST_SECTIONS,
  getItemsForSnapshot,
  getStationChecklistSections,
  ITEM_LIBRARY_CATEGORIES,
  MASTER_CHECKLIST_SECTIONS,
  makeEquipment,
  getEquipmentEnglishLabel,
  getEquipmentDisplayLabel,
  getEquipmentLabel,
  getStationSystemEnglishLabel,
  getStationSystemDisplayLabel,
  getStationSystemLabel,
} from "../src/domain/master-checklist.js";

function duplicateLabels(items) {
  const seen = new Map();
  for (const item of items) {
    const label = String(item.displayLabel || item.label || "").trim();
    const key = `${item.sectionCode || ""}::${label}`;
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key).push(item.id);
  }
  return [...seen.entries()].filter(([, ids]) => ids.length > 1);
}

const baseProfile = createDefaultStationProfile();
const baseCabinet = baseProfile.equipment.find((asset) => asset.type === "CONTROL_CABINET");
baseProfile.equipment.push(makeEquipment("WIM_CONTROLLER", 1, {
  id: "runtime-wim-controller",
  assetNo: "WIMCTRL-01",
  parentAssetId: baseCabinet?.id,
  location: "ตู้ควบคุม WIM",
}));
const baseRound = createInspectionRound(baseProfile);
const baseItems = getItemsForSnapshot(baseRound.snapshot);
assert.deepEqual(duplicateLabels(baseItems), [], "fresh round labels must be unique within each BOQ section");
for (const section of EVIDENCE_CHECKLIST_SECTIONS) {
  assert.equal(section.title, CHECKLIST_SECTION_TITLES[section.code], `evidence title mismatch in ${section.code}`);
}
for (const section of MASTER_CHECKLIST_SECTIONS) {
  assert.equal(section.title, CHECKLIST_SECTION_TITLES[section.code], `master title mismatch in ${section.code}`);
}
for (const category of ITEM_LIBRARY_CATEGORIES) {
  assert.equal(category.title, CHECKLIST_SECTION_TITLES[category.code], `item library title mismatch in ${category.code}`);
}

const calFactorLabels = baseItems
  .filter((item) => item.sectionCode === "2.3" && item.label.includes("Cal Factor"))
  .map((item) => item.label);
assert.equal(calFactorLabels.length, 1, "Cal Factor is generated only for the registered WIM Controller");
assert.equal(baseItems.find((item) => item.label.includes("Cal Factor"))?.assetNo, "WIMCTRL-01");

const impsProfile = {
  ...baseProfile,
  id: "runtime-label-imps",
  stationFormat: "IMPS",
  stationTemplateId: "IMPS",
  stationSystems: baseProfile.stationSystems.map((system) => system.id === "present-lpr-control"
    ? { ...system, scope: "High Speed" }
    : system),
  equipment: [
    ...baseProfile.equipment.filter((asset) => asset.type !== "IMPS_DISPLAY_PROCESSING"),
    makeEquipment("IMPS_DISPLAY_PROCESSING", 1, { id: "imps-dp-01", assetNo: "IMPS-DP-01" }),
    makeEquipment("LPR_CAMERA", 1, { id: "imps-lpr-camera-01", assetNo: "IMPS-LPR-01" }),
  ],
};
const impsRound = createInspectionRound(impsProfile);
const impsItems = getItemsForSnapshot(impsRound.snapshot);
const impsItem = impsItems.find((item) => item.assetId === "imps-dp-01");
assert.ok(impsItem, "an ImPS display/processing asset must create a checklist item");
assert.equal(impsItem.sectionCode, "5.2", "an ImPS display/processing asset must map to BOQ 5.2");
assert.notEqual(impsItem.sectionCode, "6.1", "an ImPS display/processing asset must not fall back to BOQ 6.1");

const impsSections = getStationChecklistSections(impsRound.snapshot, { includeDisabled: true });
const impsSection = impsSections.find((section) => section.items.some((item) => item.assetId === "imps-dp-01"));
assert.equal(impsSection?.code, "IMPS-06.01");
assert.equal(impsSection?.title, "Data Systems - Equipment");
assert.ok(impsSection?.items.some((item) => item.assetId === "imps-dp-01"));
assert.ok(impsSection?.items.some((item) => item.sourceSectionCode === "5.2"));
assert.ok(impsSections.every((section) => section.code.startsWith("IMPS-") || section.code.startsWith("1") || section.code.startsWith("2")));

const lprAsset = impsProfile.equipment.find((asset) => asset.id === "imps-lpr-camera-01");
assert.equal(getEquipmentLabel(lprAsset), "กล้องอ่านป้ายทะเบียน");
assert.equal(getEquipmentEnglishLabel(lprAsset), "LPR Camera");
assert.equal(getEquipmentDisplayLabel(lprAsset), "LPR Camera · กล้องอ่านป้ายทะเบียน");
assert.equal(getStationSystemLabel({ id: "present-lpr-control" }), "ระบบควบคุมการอ่านป้ายทะเบียน");
assert.equal(getStationSystemEnglishLabel({ id: "present-lpr-control" }), "License Plate Recognition Control System");
assert.equal(getStationSystemDisplayLabel({ id: "present-lpr-control" }), "License Plate Recognition Control System · ระบบควบคุมการอ่านป้ายทะเบียน");
assert.ok(impsItems.some((item) => item.systemRecordId === "present-lpr-control"
  && item.label.startsWith("License Plate Recognition Control System · ตรวจการทำงานของซอฟต์แวร์")));
assert.ok(impsItems.some((item) => item.assetId === "imps-lpr-camera-01"
  && String(item.assetName || "").startsWith("LPR Camera ·")));
assert.ok(impsItems.some((item) => item.sectionCode === "3.1"
  && item.label.startsWith("License Plate Recognition Control System · ผลทดสอบการอ่านป้ายทะเบียนร่วมกับ WIM")));
assert.ok(MASTER_CHECKLIST_SECTIONS.find((section) => section.code === "3.1")?.items
  .some((item) => item.label.startsWith("License Plate Recognition Control System · ผลทดสอบการอ่านป้ายทะเบียนร่วมกับ WIM")));

console.log("runtime checklist labels: PASS", JSON.stringify({
  baseItems: baseItems.length,
  calFactorLabels,
  dynamicSections: impsSections.filter((section) => section.code === "IMPS-06.01").map((section) => section.code),
  lprAssetName: getEquipmentEnglishLabel(lprAsset),
  lprSystemName: getStationSystemEnglishLabel({ id: "present-lpr-control" }),
}));
