import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createDefaultStationProfile, createInspectionRound, getItemsForSnapshot,
  getPrintableSectionsForSnapshot, makeEquipment, normalizeRound,
} from "../src/domain/master-checklist.js";
import {
  CHECKLIST_WORDING_VERSION, createChecklistCopySnapshot,
  createContextualChecklistCopy, getEvidenceCatalogForSnapshot,
  getStationChecklistItems, updateChecklistCopy,
} from "../src/domain/evidence-checklist.js";
import { migrateChecklistState } from "../src/domain/storage.js";
import { getChecklistPageNavigationItems, getChecklistPageQueueGroups } from "../src/app/checklist-queue-state.js";

const profile = createDefaultStationProfile();
const cabinet = profile.equipment.find((asset) => asset.type === "CONTROL_CABINET");
profile.equipment.push(makeEquipment("WIM_CONTROLLER", 1, {
  id: "wording-controller", assetNo: "CTRL-01", parentAssetId: cabinet.id,
}));
const cameras = profile.equipment.filter((asset) => asset.type === "LPR_CAMERA");
profile.lanes.push({ id: "wording-ls-lane", laneNo: 1, scope: "Low Speed", active: true });
for (const [index, scope, laneId] of [[0, "High Speed", "lane-1"], [1, "Low Speed", "wording-ls-lane"]]) {
  const systemId = `wording-lpr-${index}`;
  profile.stationSystems.push({ id: systemId, canonicalItemId: "lpr-control", systemId: "lpr-control",
    scope, laneId, quantity: 1, active: true, displayLabel: "ระบบควบคุมการอ่านป้ายทะเบียน" });
  Object.assign(cameras[index], { parentSystemId: systemId, laneId, scope });
}
const round = createInspectionRound(profile);
assert.equal(round.snapshot.checklistWordingVersion, CHECKLIST_WORDING_VERSION);
const items = getItemsForSnapshot(round.snapshot);
const cameraChecks = items.filter((item) => item.id.startsWith("3.2.overview"));
assert.ok(cameraChecks.every((item) => item.label.startsWith("ตรวจตำแหน่งติดตั้งและทิศทางLPR Camera")));
assert.ok(cameraChecks.every((item) => item.label.includes(item.assetNo)));
assert.ok(cameraChecks.some((item) => item.label.includes("ความเร็วสูง · ช่องจราจร 1")));
assert.ok(cameraChecks.some((item) => item.label.includes("ความเร็วต่ำ · ช่องจราจร 1")));
assert.ok(cameraChecks.every((item) => item.evidenceSlots[0].displayLabel === "ภาพตำแหน่งติดตั้งและทิศทางLPR Camera"));
assert.ok(items.every((item) => !/ลำดับที่\s*\d+\s*จาก|#\d+/.test(item.label)));
assert.ok(items.every((item) => /^(?:License Plate Recognition Control System · )?(ตรวจ|วัด|ทดสอบ|ทำความสะอาด|บันทึก|คัดแยก)/.test(item.label)), "every topic describes an inspection task");
assert.ok(items.some((item) => item.label.startsWith("วัดแรงดันไฟฟ้าหลักขาเข้า")));
assert.ok(items.some((item) => item.label.startsWith("วัดกระแสไฟฟ้าหลัก")));
assert.ok(items.some((item) => item.label.includes("Cal Factor")));
assert.ok(items.some((item) => item.systemRecordId === "present-cctv-camera"
  && item.label.startsWith("ตรวจการทำงานของระบบกล้องโทรทัศน์วงจรปิด")), "software/system checks retain the system context, not the physical camera type");
assert.ok(items.filter((item) => item.isEquipmentCleaning || item.isAreaCleaning)
  .every((item) => item.evidenceSlots.map((slot) => slot.displayLabel).join("|")
    === "ภาพก่อนทำความสะอาด|ภาพระหว่างทำความสะอาด|ภาพหลังทำความสะอาด"));
assert.ok(items.filter((item) => item.id.startsWith("4.1.overview"))
  .every((item) => !item.evidenceSlots[0].displayLabel.includes("Fixed และ PTZ")), "camera evidence refers to the actual camera type");

// Compare the complete runtime shape against the pre-wording policy: only
// task and evidence display strings may change, including source references.
const oldSnapshot = { ...structuredClone(round.snapshot), checklistWordingVersion: null,
  checklistCopy: createChecklistCopySnapshot(), evidenceCatalog: [] };
oldSnapshot.evidenceCatalog = getEvidenceCatalogForSnapshot(oldSnapshot);
const oldItems = getItemsForSnapshot(oldSnapshot);
const withoutDisplayCopy = (rows) => rows.map(({ label, displayLabel, evidenceSlots, ...item }) => ({ ...item,
  evidenceSlots: evidenceSlots.map(({ displayLabel: slotLabel, ...slot }) => slot),
}));
assert.deepEqual(withoutDisplayCopy(items), withoutDisplayCopy(oldItems));
assert.ok(oldItems.some((item) => /ลำดับที่ \d+ จาก/.test(item.label)));
const sampleItem = cameraChecks[0];
Object.assign(round.inspectionItems[sampleItem.id], { status: "damaged", value: "12", note: "ตรวจสายไฟ" });
Object.assign(round.inspectionItems[sampleItem.id].evidence[sampleItem.evidenceSlots[0].id], {
  status: "complete", attachment: { id: "wording-evidence-photo", name: "camera.jpg", type: "image/jpeg", size: 100,
    addedAt: "2026-10-02T00:00:00.000Z" },
});
const persisted = migrateChecklistState(JSON.parse(JSON.stringify({ stationProfiles: [profile],
  inspectionRounds: [round, { ...round, id: "wording-old-draft", snapshot: oldSnapshot },
    { ...round, id: "wording-old-closed", snapshot: oldSnapshot, status: "closed", closedAt: "2026-10-01T00:00:00.000Z" }],
})));
assert.deepEqual(getItemsForSnapshot(persisted.inspectionRounds.find((entry) => entry.id === round.id).snapshot), items);
assert.deepEqual(persisted.inspectionRounds.find((entry) => entry.id === round.id).inspectionItems[sampleItem.id], round.inspectionItems[sampleItem.id]);
for (const id of ["wording-old-draft", "wording-old-closed"]) {
  assert.deepEqual(getItemsForSnapshot(persisted.inspectionRounds.find((entry) => entry.id === id).snapshot), oldItems);
}
assert.deepEqual(getItemsForSnapshot(normalizeRound(round, [profile], profile).snapshot), items);

const missing = structuredClone(round.snapshot);
missing.evidenceCatalog = [];
Object.assign(missing.equipment.find((asset) => asset.id === cameras[0].id), { assetNo: "", location: "", laneId: null, parentSystemId: null, scope: "" });
const missingCheck = getStationChecklistItems(missing).find((item) => item.id.startsWith("3.2.overview") && item.assetId === cameras[0].id);
assert.match(missingCheck.label, /ยังไม่ระบุเลขอุปกรณ์/);
assert.match(missingCheck.label, /ยังไม่ระบุตำแหน่ง/);
assert.doesNotMatch(missingCheck.label, /#|ลำดับที่/);

const sections = getPrintableSectionsForSnapshot(round.snapshot);
const itemLabels = new Map(items.map((item) => [item.id, item.label]));
assert.ok(sections.flatMap((section) => section.items).every((item) => item.label === itemLabels.get(item.id)));
const queueGroups = getChecklistPageQueueGroups(sections, round.snapshot.stationFormat, round.snapshot);
assert.deepEqual(getChecklistPageNavigationItems(sections, round.snapshot.stationFormat, round.snapshot).map((item) => item.id),
  queueGroups.flatMap((group) => group.sections.flatMap((section) => section.equipmentGroups.flatMap((equipment) => equipment.items.map((item) => item.id)))));

const copy = createContextualChecklistCopy(createChecklistCopySnapshot());
const originalSlot = copy.sections[0].items[0].evidenceSlots[0].displayLabel;
const editedCopy = updateChecklistCopy(copy, { sectionCode: "1.1", itemId: "1.1.staff", field: "label", value: "ตรวจความพร้อมของทีมงาน" });
assert.equal(editedCopy.sections[0].items[0].evidenceSlots[0].displayLabel, originalSlot);
for (const path of ["src/app/pages/ChecklistPage.jsx", "src/app/App.jsx"]) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  assert.ok(source.includes("รายการตรวจที่") && source.includes("ในรายการที่แสดง"));
}
assert.ok(readFileSync(new URL("../src/app/pages/ChecklistPage.jsx", import.meta.url), "utf8").includes('getChecklistQueueItemLabel(currentVisibleItem)'));
console.log("checklist context wording passed: tasks/evidence, real identity, scope/lane, IDs/rules/order, persistence and frozen draft/history");
