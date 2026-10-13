import assert from "node:assert/strict";
import { getChecklistPageNavigationItems, getChecklistPageQueueGroups, getCleaningQueueItemCount, getChecklistQueueItemBlocks, getChecklistQueueItemLabel } from "../src/app/checklist-queue-state.js";

const sourceSections = [
  { code: "6.1", title: "Data and Control source", items: [
    { id: "wim-low-system", sectionCode: "6.1", systemRecordId: "wim-low", scope: "Low Speed" },
    { id: "wim-high-system", sectionCode: "6.1", systemRecordId: "wim-high", scope: "High Speed" },
  ] },
  { code: "3.2", title: "LPR Camera", items: [
    { id: "lpr-camera", sectionCode: "3.2", assetId: "camera-1", scope: "High Speed" },
  ] },
  { code: "2.3", title: "WIM Electronics", items: [
    { id: "wim-system", sectionCode: "2.3", systemRecordId: "wim-electronics", scope: "High Speed" },
    { id: "wim-cabinet", sectionCode: "2.3", assetId: "cabinet-1", scope: "High Speed" },
  ] },
  { code: "2.1", title: "WIM Sorting", items: [
    { id: "sorting-system-low", sectionCode: "2.1", systemRecordId: "sorting-low", scope: "Low Speed" },
    { id: "sorting-lane-work", sectionCode: "2.1", laneId: "lane-1", scope: "High Speed" },
    { id: "sorting-sensor", sectionCode: "2.1", assetId: "sensor-1", scope: "High Speed" },
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

const groups = getChecklistPageQueueGroups(sourceSections, "SC");
assert.deepEqual(groups.map((group) => group.title), [
  "STATION READINESS",
  "WIM HS",
  "LPR FOR HS",
  "WIM LS",
  "DATA/CONTROL HS",
  "DATA/CONTROL LS",
  "CLEANING",
  "LEGACY / UNMAPPED",
], "Checklist should sort real main categories, keep readiness separate, and expose unmapped records last");

const wim = groups.find((group) => group.id === "checklist-workpoint-sc-wim-hs");
assert.equal(wim.categoryDescription, "ระบบชั่งน้ำหนักความเร็วสูง", "Checklist should show the Thai workpoint name beneath the English name");
assert.equal(wim.categoryLabel, "WIM HS", "Checklist should use the shared English workpoint name");
assert.deepEqual(wim.sections.map((section) => section.code), ["2.1", "2.3"], "WIM subcategories should follow the canonical category order");
assert.deepEqual(wim.sections[0].items.map((item) => item.id), [
  "sorting-sensor",
  "sorting-lane-work",
  "sorting-system-high",
], "within a workpoint equipment comes before lane work and systems");
assert.deepEqual(wim.sections[0].equipmentGroups.map((group) => group.kind), ["equipment", "station", "system"]);
assert.equal(groups.find((group) => group.id === "checklist-workpoint-sc-data-control-hs").sections[0].items[0].id, "wim-high-system", "WIM High Speed software systems belong to Data/Control HS");
assert.equal(groups.find((group) => group.id === "checklist-workpoint-sc-data-control-ls").sections[0].items[0].id, "wim-low-system", "WIM Low Speed software systems belong to Data/Control LS");
assert.deepEqual(groups.find((group) => group.id === "checklist-cleaning").sections.map((section) => section.code), ["6.2", "6.3"], "known cleaning sections should keep their source order in a separate support group");
assert.equal(getCleaningQueueItemCount(groups.find((group) => group.id === "checklist-cleaning").sections.flatMap((section) => section.items)), 2,
  "legacy cleaning controls remain counted in their saved cleaning sections");

const currentCleaningGroups = getChecklistPageQueueGroups([
  { code: "2.2", title: "WIM Control System", items: [
    { id: "computer-cleaning", sectionCode: "2.2", assetId: "pc-1", isEquipmentCleaning: true, scope: "High Speed" },
    { id: "room-cleaning", sectionCode: "2.2", isAreaCleaning: true, scope: "High Speed" },
  ] },
  { code: "3.2", title: "LPR Camera", items: [
    { id: "camera-cleaning", sectionCode: "3.2", assetId: "camera-1", isEquipmentCleaning: true, scope: "High Speed" },
  ] },
  { code: "2.3", title: "WIM Electronics System", items: [
    { id: "cabinet-outside-inspection", sectionCode: "2.3", assetId: "cabinet-1", scope: "High Speed", label: "WIM Electronics Cabinet · ภาพภายนอกตู้ควบคุมอิเล็กทรอนิกส์ WIM · CAB-HS-01" },
    { id: "cabinet-equipment-cleaning", sectionCode: "2.3", assetId: "cabinet-1", isEquipmentCleaning: true, scope: "High Speed" },
    { id: "cabinet-area-cleaning", sectionCode: "2.3", assetId: "cabinet-1", isAreaCleaning: true, cleaningAssetType: "CONTROL_CABINET", scope: "High Speed" },
  ] },
], "SC");
const currentWim = currentCleaningGroups.find((group) => group.id === "checklist-workpoint-sc-wim-hs");
assert.equal(getCleaningQueueItemCount(currentWim.sections.flatMap((section) => section.items)), 4,
  "equipment and area cleaning counts stay inside their related WIM category");
assert.equal(getCleaningQueueItemCount(currentWim.sections.find((section) => section.code === "2.2").equipmentGroups[0].items), 1,
  "each equipment header can announce its own cleaning row");
assert.equal(getCleaningQueueItemCount(currentWim.sections.find((section) => section.code === "2.2").items), 2,
  "the related subcategory header counts both equipment and room-area cleaning");
assert.equal(currentWim.sections.find((section) => section.code === "2.3").items.find((item) => item.id === "cabinet-area-cleaning")?.isAreaCleaning, true,
  "cabinet surrounding-area cleaning stays under WIM Electronics when it has source category and scope");
const cabinetItems = currentWim.sections.find((section) => section.code === "2.3").items.filter((item) => item.assetId === "cabinet-1");
assert.deepEqual(cabinetItems.map((item) => item.id).sort(), [
  "cabinet-area-cleaning", "cabinet-equipment-cleaning", "cabinet-outside-inspection",
].sort(), "cabinet photo inspection, cabinet cleaning, and surrounding-area cleaning are distinct Checklist items");
assert.equal(getCleaningQueueItemCount(cabinetItems), 2,
  "only the cabinet's two cleaning tasks count as cleaning; the outside photo is a separate inspection");
const cabinetBlocks = getChecklistQueueItemBlocks([
  cabinetItems[2], cabinetItems[0], cabinetItems[1],
]);
assert.deepEqual(cabinetBlocks.map((block) => [block.kind, block.items.map((item) => item.id)]), [
  ["inspection", ["cabinet-outside-inspection"]],
  ["cleaning", ["cabinet-area-cleaning", "cabinet-equipment-cleaning"]],
], "the divider groups cleaning tasks after checks without losing their individual IDs");
assert.deepEqual(getChecklistPageNavigationItems([{ code: "2.3", items: [
  { id: "area-cleaning-first", sectionCode: "2.3", assetId: "cabinet-1", scope: "High Speed", isAreaCleaning: true },
  { id: "cabinet-photo-check", sectionCode: "2.3", assetId: "cabinet-1", scope: "High Speed" },
] }], "SC").map((item) => item.id), ["cabinet-photo-check", "area-cleaning-first"],
"Previous/Next follows the visible inspection then cleaning order");
assert.equal(currentCleaningGroups.some((group) => group.id === "checklist-cleaning"), false,
  "current area cleaning with a known category should not be pushed into the general Cleaning group");
assert.equal(getCleaningQueueItemCount(groups.find((group) => group.id === "checklist-cleaning").sections.flatMap((section) => section.items)), 2,
  "legacy cleaning controls remain counted in their saved cleaning sections");
const equipmentCleaningLabel = "Equipment Cleaning · WIM Control Computer · PC-IMPS-01";
const equipmentCleaningItem = { isEquipmentCleaning: true, label: equipmentCleaningLabel };
assert.equal(getChecklistQueueItemLabel(equipmentCleaningItem),
  "ทำความสะอาดอุปกรณ์ · WIM Control Computer · PC-IMPS-01",
  "Checklist shows a Thai label without rewriting the stored item label");
assert.equal(equipmentCleaningItem.label, equipmentCleaningLabel);
assert.equal(getChecklistQueueItemLabel({ isAreaCleaning: true, cleaningAssetType: "CONTROL_CABINET", label: "Control Cabinet Surrounding Area Cleaning · Cabinet · CAB-01" }),
  "WIM Electronics Cabinet · ทำความสะอาดพื้นที่โดยรอบ · Cabinet · CAB-01");

const allSourceIds = sourceSections.flatMap((section) => section.items.map((item) => item.id)).sort();
const allQueueIds = groups.flatMap((group) => group.sections.flatMap((section) => section.items.map((item) => item.id))).sort();
assert.deepEqual(allQueueIds, allSourceIds, "display grouping must keep every source checklist item exactly once");
const repeatedScopeKeys = groups.filter((group) => group.workpointId?.startsWith("sc-wim-")).flatMap((group) => group.sections.map((section) => section.queueKey));
assert.equal(new Set(repeatedScopeKeys).size, repeatedScopeKeys.length, "same BOQ/TOR codes in different workpoints keep distinct view keys");

const everyCategoryGroup = getChecklistPageQueueGroups([
  ["1.1.11", "station-infrastructure", "ImPS"],
  ["7.1", "vms", "High Speed"],
  ["6.1", "data-control", "Central"],
  ["1.1.12", "image-processing", "Image Processing"],
  ["1.1.5", "dimension-3d", "3D"],
  ["4.2", "cctv-nvr", "High Speed"],
  ["4.1", "cctv-camera", "High Speed"],
  ["3.1", "lpr", "High Speed"],
  ["2.2", "wim", "High Speed"],
].map(([code, id, scope]) => ({ code, title: code, items: [{ id, sectionCode: code, scope }] })), "SC");
assert.deepEqual(
  everyCategoryGroup.map((group) => group.id),
  ["checklist-workpoint-sc-wim-hs", "checklist-workpoint-sc-lpr-hs", "checklist-workpoint-sc-cctv-hs", "checklist-workpoint-sc-3d", "checklist-workpoint-sc-vms-hs", "checklist-workpoint-sc-data-control-central", "checklist-unresolved-scope-image-processing", "checklist-unresolved-scope-station-infrastructure"],
  "Checklist should keep known categories without an SC workpoint separate from truly unmapped data",
);
assert.deepEqual(
  everyCategoryGroup.slice(0, 6).map(({ title, categoryDescription }) => [title, categoryDescription]),
  [["WIM HS", "ระบบชั่งน้ำหนักความเร็วสูง"], ["LPR FOR HS", "ระบบอ่านป้ายทะเบียนสำหรับความเร็วสูง"], ["CCTV FOR HS", "ระบบกล้องวงจรปิดสำหรับความเร็วสูง"], ["3D DIMENSION", "ระบบวัดมิติรถบรรทุก 3 มิติ"], ["VMS FOR HS", "ระบบป้ายข้อความสำหรับความเร็วสูง"], ["DATA/CONTROL CENTRAL", "ระบบข้อมูลและควบคุมส่วนกลาง"]],
  "Checklist uses English-first workpoint titles and the shared Thai secondary names",
);
assert.deepEqual(
  everyCategoryGroup.slice(6).map((group) => group.title),
  ["IMAGE PROCESSING · ยังไม่ระบุช่องทาง", "STATION INFRASTRUCTURE · ยังไม่ระบุช่องทาง"],
  "Known categories outside the SC workpoint layout should remain distinct from Legacy / Unmapped",
);

const impsGroups = getChecklistPageQueueGroups([
  { code: "6.1", title: "Data Control", items: [{ id: "imps-data", sectionCode: "6.1", systemRecordId: "imps-data", scope: "ImPS" }] },
  { code: "1.1.5", title: "3D DIMENSION", items: [{ id: "imps-3d", sectionCode: "1.1.5", systemRecordId: "imps-3d", scope: "3D" }] },
  { code: "4.1", title: "CCTV", items: [{ id: "imps-cctv", sectionCode: "4.1", assetId: "cctv", scope: "ImPS" }] },
  { code: "3.2", title: "LPR 3D", items: [{ id: "imps-lpr-3d", sectionCode: "3.2", assetId: "lpr-3d", scope: "3D" }] },
  { code: "3.1", title: "LPR ImPS", items: [{ id: "imps-lpr", sectionCode: "3.1", assetId: "lpr", scope: "ImPS" }] },
  { code: "2.1", title: "WIM", items: [{ id: "imps-wim", sectionCode: "2.1", assetId: "sensor", scope: "ImPS" }] },
  { code: "1.1.12", title: "Image Processing", items: [{ id: "imps-image", sectionCode: "1.1.12", systemRecordId: "image-processing", scope: "Image Processing" }] },
  { code: "3.1", title: "Legacy LPR", items: [{ id: "imps-lpr-unscoped", sectionCode: "3.1", assetId: "legacy-lpr" }] },
], "IMPS");
assert.deepEqual(impsGroups.map((group) => group.title), [
  "IMAGE PROCESSING",
  "WIM",
  "LPR FOR IMPS",
  "CCTV FOR IMPS",
  "3D DIMENSION",
  "LPR FOR 3D",
  "DATA/CONTROL FOR IMPS",
  "LPR (LICENSE PLATE RECOGNITION) · ยังไม่ระบุช่องทาง",
], "IMPS Checklist keeps known but unscoped LPR separate from truly unmapped items");
assert.equal(impsGroups.at(-1).id, "checklist-unresolved-scope-lpr",
  "known LPR without a resolvable Scope should stay in its category's unresolved group");
assert.deepEqual(impsGroups.flatMap((group) => group.sections.flatMap((section) => section.items.map((item) => item.id))).sort(), [
  "imps-3d", "imps-cctv", "imps-data", "imps-image", "imps-lpr", "imps-lpr-3d", "imps-lpr-unscoped", "imps-wim",
].sort(), "IMPS point grouping preserves every existing checklist item exactly once");

const pagerSections = [
  { code: "1.1", title: "ความพร้อมหน้างาน", items: [{ id: "readiness", sectionCode: "1.1" }] },
  { code: "1.1.4", title: "WIM High Speed Data Control System", items: [{ id: "wim-data-control", sectionCode: "1.1.4", systemRecordId: "wim-high-data-control" }] },
  { code: "2.1", title: "WIM Sorting System", items: [{ id: "wim-sorting", sectionCode: "2.1", assetId: "sensor-1", scope: "High Speed" }] },
  { code: "3.1", title: "LPR", items: [{ id: "lpr-camera", sectionCode: "3.1", assetId: "lpr-1", scope: "High Speed" }] },
  { code: "4.1", title: "CCTV", items: [{ id: "cctv-camera", sectionCode: "4.1", assetId: "cctv-1", scope: "High Speed" }] },
  { code: "7.1", title: "VMS", items: [{ id: "vms-control", sectionCode: "7.1", systemRecordId: "vms-control", scope: "High Speed" }] },
  { code: "6.1", title: "Data/Control", items: [{ id: "data-control", sectionCode: "6.1", systemRecordId: "data-control", scope: "Central" }] },
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
assert.equal(pagerGroups.find((group) => group.id === "checklist-workpoint-sc-data-control-hs").sections.some((section) => section.code === "1.1.4"), true,
  "legacy WIM high-speed software systems belong to the Data/Control HS workpoint");
assert.equal(pagerGroups.find((group) => group.id === "checklist-unmapped").sections.some((section) => section.code === "1.1.4"), false,
  "legacy WIM high-speed software systems should not fall into the unmapped category");

for (const format of ["SC", "IMPS"]) {
  const expected = getChecklistPageQueueGroups(sourceSections, format).flatMap((group) =>
    group.sections.flatMap((section) => section.equipmentGroups.flatMap((equipment) => equipment.items.map((item) => item.id))));
  assert.deepEqual(getChecklistPageNavigationItems(sourceSections, format).map((item) => item.id), expected,
    `${format}: navigation follows workpoints and each expanded equipment group exactly`);
}
const interleaved = [{ code: "2.1", items: [
  { id: "a1", assetId: "a", scope: "High Speed", sectionCode: "2.1" },
  { id: "b1", assetId: "b", scope: "High Speed", sectionCode: "2.1" },
  { id: "a2", assetId: "a", scope: "High Speed", sectionCode: "2.1" },
] }];
assert.deepEqual(getChecklistPageNavigationItems(interleaved).map((item) => item.id), ["a1", "a2", "b1"],
  "finish the displayed equipment group before moving to the next equipment");
console.log("Checklist station-category queue contract passed");

const snapshotContext = { equipment: [
  { id: "pc", type: "CONTROL_COMPUTER", scope: "High Speed" },
  { id: "sensor", type: "WIM_SENSOR", scope: "Low Speed", parentSystemId: "hs-parent" },
], stationSystems: [{ id: "hs-parent", scope: "High Speed", laneId: "lane1" }], lanes: [{ id: "lane1", laneNo: 1 }] };
const contextSections = [
  { code: "2.2", items: [{id:"pc-photo",sectionCode:"2.2",assetId:"pc"}] },
  { code: "2.1", items: [{id:"sensor-photo",sectionCode:"2.1",assetId:"sensor"}] },
  { code: "3.2", items: [{id:"unknown-camera",sectionCode:"3.2"}] },
];
const contextGroups = getChecklistPageQueueGroups(contextSections, "SC", snapshotContext);
assert.ok(contextGroups.find(g => g.title === "WIM HS")?.sections.some(s => s.items.some(i => i.id === "pc-photo")), "bound asset scope must place the computer in WIM HS");
assert.ok(contextGroups.find(g => g.title === "WIM HS")?.sections.some(s => s.items.some(i => i.id === "sensor-photo")), "parent WIM scope wins over stale sensor scope");
assert.equal(contextGroups.find(g => g.id === "checklist-workpoint-sc-lpr-hs").sections[0].title, "LPR Camera", "known LPR category uses its canonical workpoint even when the item has no asset link");
assert.equal(contextGroups.some(g => g.id === "checklist-unmapped"), false, "recognized category codes do not fall into Legacy / Unmapped");
assert.equal(contextSections[0].items[0].scope, undefined, "view enrichment never changes source items");

for (const code of ["2.3", "3.1", "3.2", "4.1", "4.2", "5.1"]) {
  const unknown = getChecklistPageQueueGroups([{code, items:[{id:code,sectionCode:code}]}], "SC");
  assert.notEqual(unknown[0].sections[0].title, code, `unmapped ${code} still shows its category name`);
}
assert.deepEqual(getChecklistPageNavigationItems(contextSections, "SC", snapshotContext).map(i => i.id),
  contextGroups.flatMap(g => g.sections.flatMap(s => s.equipmentGroups.flatMap(e => e.items.map(i => i.id)))),
  "snapshot-derived context is shared by queue and pager");
console.log("Snapshot scope and unmapped category title regressions passed");
