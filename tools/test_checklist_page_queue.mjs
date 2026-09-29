import assert from "node:assert/strict";
import { getChecklistPageNavigationItems, getChecklistPageQueueGroups, getCleaningQueueItemCount, getChecklistQueueItemLabel } from "../src/app/checklist-queue-state.js";
import { CENTRAL_EQUIPMENT_MAIN_CATEGORIES } from "../src/domain/equipment-names.js";

const sourceSections = [
  { code: "6.1", title: "Data and Control source", items: [
    { id: "wim-low-system", sectionCode: "6.1", systemRecordId: "wim-low", scope: "Low Speed" },
    { id: "wim-high-system", sectionCode: "6.1", systemRecordId: "wim-high", scope: "High Speed" },
  ] },
  { code: "3.2", title: "LPR Camera", items: [
    { id: "lpr-camera", sectionCode: "3.2", assetId: "camera-1" },
  ] },
  { code: "2.3", title: "WIM Electronics", items: [
    { id: "wim-system", sectionCode: "2.3", systemRecordId: "wim-electronics", scope: "High Speed" },
    { id: "wim-cabinet", sectionCode: "2.3", assetId: "cabinet-1" },
  ] },
  { code: "2.1", title: "WIM Sorting", items: [
    { id: "sorting-system-low", sectionCode: "2.1", systemRecordId: "sorting-low", scope: "Low Speed" },
    { id: "sorting-lane-work", sectionCode: "2.1", laneId: "lane-1" },
    { id: "sorting-sensor", sectionCode: "2.1", assetId: "sensor-1" },
    { id: "sorting-system-high", sectionCode: "2.1", systemRecordId: "sorting-high", scope: "High Speed" },
  ] },
  { code: "1.1", title: "ความพร้อมหน้างาน", items: [
    { id: "readiness", sectionCode: "1.1" },
  ] },
  { code: "6.3", title: "ทำความสะอาดตู้ควบคุม", items: [
    { id: "cabinet-cleaning", sectionCode: "6.3", assetId: "cabinet-1" },
  ] },
  { code: "6.2", title: "ทำความสะอาดห้องควบคุม", items: [
    { id: "control-room-cleaning", sectionCode: "6.2" },
  ] },
  { code: "9.9", title: "รายการเก่าที่ยังไม่แมป", items: [
    { id: "unmapped", sectionCode: "9.9" },
  ] },
];

const groups = getChecklistPageQueueGroups(sourceSections);
assert.deepEqual(groups.map((group) => group.title), [
  "ความพร้อมหน้างาน",
  "WIM",
  "LPR",
  "Data/Control",
  "งานทำความสะอาด",
  "รายการที่ยังไม่มีหมวดในผัง",
], "Checklist should sort real main categories, keep readiness separate, and expose unmapped records last");

const wim = groups.find((group) => group.id === "checklist-main-wim");
assert.equal(wim.categoryDescription, "ระบบชั่งน้ำหนักขณะรถเคลื่อนที่", "Checklist should show the shared Thai description beneath the canonical category name");
assert.equal(wim.categoryLabel, "WIM", "Checklist should use the short canonical category name instead of creating a screen-specific label");
assert.deepEqual(wim.sections.map((section) => section.code), ["2.1", "2.3"], "WIM subcategories should follow the canonical category order");
assert.deepEqual(wim.sections[0].items.map((item) => item.id), [
  "sorting-sensor",
  "sorting-lane-work",
  "sorting-system-high",
  "sorting-system-low",
], "within each subcategory equipment comes before station work and systems; High Speed precedes Low Speed");
assert.deepEqual(wim.sections[0].equipmentGroups.map((group) => group.kind), ["equipment", "station", "system", "system"]);
assert.equal(groups.find((group) => group.id === "checklist-main-data-control").sections[0].items[0].id, "wim-high-system", "WIM High/Low systems stay under their actual Data / Control category");
assert.deepEqual(groups.find((group) => group.id === "checklist-cleaning").sections.map((section) => section.code), ["6.2", "6.3"], "known cleaning sections should keep their source order in a separate support group");
assert.equal(getCleaningQueueItemCount(groups.find((group) => group.id === "checklist-cleaning").sections.flatMap((section) => section.items)), 2,
  "legacy cleaning controls remain counted in their saved cleaning sections");

const currentCleaningGroups = getChecklistPageQueueGroups([
  { code: "2.2", title: "WIM Control System", items: [
    { id: "computer-cleaning", sectionCode: "2.2", assetId: "pc-1", isEquipmentCleaning: true },
    { id: "room-cleaning", sectionCode: "2.2", isAreaCleaning: true },
  ] },
  { code: "3.2", title: "LPR Camera", items: [
    { id: "camera-cleaning", sectionCode: "3.2", assetId: "camera-1", isEquipmentCleaning: true },
  ] },
]);
const currentWim = currentCleaningGroups.find((group) => group.id === "checklist-main-wim");
assert.equal(getCleaningQueueItemCount(currentWim.sections.flatMap((section) => section.items)), 2,
  "cleaning counts stay inside their related WIM category");
assert.equal(getCleaningQueueItemCount(currentWim.sections.find((section) => section.code === "2.2").equipmentGroups[0].items), 1,
  "each equipment header can announce its own cleaning row");
assert.equal(getCleaningQueueItemCount(currentWim.sections.find((section) => section.code === "2.2").items), 2,
  "the related subcategory header counts both equipment and room-area cleaning");
assert.equal(getCleaningQueueItemCount(groups.find((group) => group.id === "checklist-cleaning").sections.flatMap((section) => section.items)), 2,
  "legacy cleaning controls remain counted in their saved cleaning sections");
const equipmentCleaningLabel = "Equipment Cleaning · WIM Control Computer · PC-IMPS-01";
const equipmentCleaningItem = { isEquipmentCleaning: true, label: equipmentCleaningLabel };
assert.equal(getChecklistQueueItemLabel(equipmentCleaningItem),
  "ทำความสะอาดอุปกรณ์ · WIM Control Computer · PC-IMPS-01",
  "Checklist shows a Thai label without rewriting the stored item label");
assert.equal(equipmentCleaningItem.label, equipmentCleaningLabel);
assert.equal(getChecklistQueueItemLabel({ isAreaCleaning: true, cleaningAssetType: "CONTROL_CABINET", label: "Control Cabinet Surrounding Area Cleaning · Cabinet · CAB-01" }),
  "ทำความสะอาดพื้นที่โดยรอบตู้ควบคุม · Cabinet · CAB-01");

const allSourceIds = sourceSections.flatMap((section) => section.items.map((item) => item.id)).sort();
const allQueueIds = groups.flatMap((group) => group.sections.flatMap((section) => section.items.map((item) => item.id))).sort();
assert.deepEqual(allQueueIds, allSourceIds, "display grouping must keep every source checklist item exactly once");

const everyCategoryGroup = getChecklistPageQueueGroups([
  ["1.1.11", "station-infrastructure"],
  ["7.1", "vms"],
  ["6.1", "data-control"],
  ["1.1.12", "image-processing"],
  ["1.1.5", "dimension-3d"],
  ["4.2", "cctv-nvr"],
  ["4.1", "cctv-camera"],
  ["3.1", "lpr"],
  ["2.2", "wim"],
].map(([code, id]) => ({ code, title: code, items: [{ id, sectionCode: code }] })));
assert.deepEqual(
  everyCategoryGroup.map((group) => group.id),
  CENTRAL_EQUIPMENT_MAIN_CATEGORIES.map((category) => `checklist-main-${category.id}`),
  "all present Checklist categories should follow the shared station-map order",
);
assert.deepEqual(
  everyCategoryGroup.map(({ title, categoryDescription }) => [title, categoryDescription]),
  CENTRAL_EQUIPMENT_MAIN_CATEGORIES.map(({ canonicalCategories, label, description }) => [canonicalCategories?.[0] || label, description]),
  "Checklist should use each central canonical category name and Thai description without inventing screen-specific labels",
);

const pagerSections = [
  { code: "1.1", title: "ความพร้อมหน้างาน", items: [{ id: "readiness", sectionCode: "1.1" }] },
  { code: "1.1.4", title: "WIM High Speed Data Control System", items: [{ id: "wim-data-control", sectionCode: "1.1.4", systemRecordId: "wim-high-data-control" }] },
  { code: "2.1", title: "WIM Sorting System", items: [{ id: "wim-sorting", sectionCode: "2.1", assetId: "sensor-1" }] },
  { code: "3.1", title: "LPR", items: [{ id: "lpr-camera", sectionCode: "3.1", assetId: "lpr-1" }] },
  { code: "4.1", title: "CCTV", items: [{ id: "cctv-camera", sectionCode: "4.1", assetId: "cctv-1" }] },
  { code: "7.1", title: "VMS", items: [{ id: "vms-control", sectionCode: "7.1", systemRecordId: "vms-control" }] },
  { code: "6.1", title: "Data/Control", items: [{ id: "data-control", sectionCode: "6.1", systemRecordId: "data-control" }] },
  { code: "9.9", title: "รายการเก่าที่ยังไม่แมป", items: [{ id: "unmapped", sectionCode: "9.9" }] },
];
const pagerItems = getChecklistPageNavigationItems(pagerSections);
assert.deepEqual(pagerItems.map((item) => item.id), [
  "readiness",
  "wim-sorting",
  "lpr-camera",
  "cctv-camera",
  "vms-control",
  "wim-data-control",
  "data-control",
  "unmapped",
], "Next/Previous should follow the displayed category order and legacy WIM data systems should stay in Data/Control");
const pagerGroups = getChecklistPageQueueGroups(pagerSections);
assert.equal(pagerGroups.find((group) => group.id === "checklist-main-data-control").sections.some((section) => section.code === "1.1.4"), true,
  "legacy WIM high-speed software systems belong to the Data/Control category");
assert.equal(pagerGroups.find((group) => group.id === "checklist-unmapped").sections.some((section) => section.code === "1.1.4"), false,
  "legacy WIM high-speed software systems should not fall into the unmapped category");

console.log("Checklist station-category queue contract passed");
