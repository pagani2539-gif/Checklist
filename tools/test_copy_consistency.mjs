import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EVIDENCE_CHECKLIST_SECTIONS,
  EVIDENCE_TEMPLATE_VERSION,
  createChecklistCopySnapshot,
  createDefaultStationProfile,
  EQUIPMENT_TYPES,
  getEquipmentEnglishLabel,
  getEquipmentLabel,
  getStationSystemEnglishLabel,
  getStationSystemLabel,
  getItemsForSnapshot,
  makeEquipment,
  MASTER_CHECKLIST_SECTIONS,
  STATUS_OPTIONS,
} from "../src/domain/master-checklist.js";
import { getCanonicalItemsForFormat } from "../src/domain/canonical-station-catalog.js";
import { createLegacyInspectionRound as createInspectionRound } from "./legacy_round_fixture.mjs";
import { EVIDENCE_STATUS_OPTIONS } from "../src/domain/evidence-checklist.js";
import { REPORT_COPY } from "../src/domain/report-companies.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const forbiddenCurrentTerms = ["ปริ้น", "ผ่าน / ปกติ", "รอแก้ไข", "Server สน.", "ตรวจจริง", "แม่แบบสถานี"];
const forbiddenUiAssetTerms = [
  "ทะเบียน Asset",
  "Asset จริง",
  "Custom Asset",
  "Asset เพิ่มเติม",
  "จำนวน Asset",
  "ไม่มี Asset ที่รองรับ",
  "กรอกรายละเอียด Asset",
  "Asset ที่ใช้งาน",
  "รายการ Asset",
  "ไม่ใช่ Asset",
  "Asset ในร่าง",
  "นำ Asset",
  "Asset No. ซ้ำ",
  "ADD ASSET",
];
const currentDocs = [
  "README.md",
  "docs/glossary.md",
  "docs/attachment-audit.md",
  "docs/adr/0001-checklist-mvp.md",
  "docs/design-system/route-map.md",
  "docs/design-system/checklist-operations-master.md",
  "docs/design-system/component-map.md",
  "design-qa.md",
  "src/app/App.jsx",
];

const canonicalItemStatuses = [
  ["pending", "ยังไม่ได้ตรวจ"],
  ["normal", "ปกติ"],
  ["damaged", "ชำรุด"],
  ["waiting", "อยู่ระหว่างรอเปลี่ยนทดแทน"],
  ["not-installed", "ไม่ได้ติดตั้ง"],
  ["na", "ไม่เกี่ยวข้อง"],
];
const canonicalEvidenceStatuses = [
  ["pending", "ยังไม่ได้ระบุ"],
  ["complete", "หลักฐานครบถ้วน"],
  ["no-image", "ไม่มีภาพถ่าย"],
  ["missing", "หลักฐานไม่ครบถ้วน"],
  ["not-installed", "ไม่ได้ติดตั้ง"],
  ["server-site", "จัดเก็บไว้ที่เครื่องแม่ข่ายประจำสถานี"],
  ["na", "ไม่เกี่ยวข้อง"],
];

assert.deepEqual(STATUS_OPTIONS.map(({ value, label }) => [value, label]), canonicalItemStatuses);
assert.deepEqual(EVIDENCE_STATUS_OPTIONS.map(({ value, label }) => [value, label]), canonicalEvidenceStatuses);
assert.equal(EQUIPMENT_TYPES.find((type) => type.value === "NVR")?.label, "เครื่องบันทึกภาพผ่านเครือข่าย");
assert.equal(EQUIPMENT_TYPES.find((type) => type.value === "WIM_LOOP")?.label, "ลูปตรวจจับยานพาหนะ");
const lprEquipmentType = EQUIPMENT_TYPES.find((type) => type.value === "LPR_CONTROL_SYSTEM");
assert.equal(lprEquipmentType?.label, "อุปกรณ์ควบคุมการอ่านป้ายทะเบียน");
assert.equal(lprEquipmentType?.nameEn, "LPR Control System Equipment");
assert.equal(lprEquipmentType?.sourceLabel, "ระบบควบคุมการอ่านป้ายทะเบียน", "preserve the legacy source wording for history");
assert.equal(getStationSystemLabel({ id: "present-lpr-control", sourceLabel: "ระบบเดิม" }), "ระบบควบคุมการอ่านป้ายทะเบียน");
assert.equal(getStationSystemEnglishLabel({ id: "present-lpr-control", sourceLabel: "ระบบเดิม" }), "License Plate Recognition Control System");
assert.equal(EQUIPMENT_TYPES.find((type) => type.value === "DATABASE_SERVER")?.label, "เครื่องแม่ข่ายฐานข้อมูล");
assert.equal(EQUIPMENT_TYPES.find((type) => type.value === "IMPS_DISPLAY_PROCESSING")?.label, "ชุดอุปกรณ์แสดงผลและประมวลผลข้อมูล");
assert.equal(EQUIPMENT_TYPES.find((type) => type.value === "VMS_LIGHT_SENSOR")?.label, "เซนเซอร์วัดแสง VMS");
assert.equal(EQUIPMENT_TYPES.find((type) => type.value === "VMS_DISPLAY")?.label, "จอแสดงผล VMS");
assert.equal(getEquipmentLabel({ type: "WIM_LOOP", sourceLabel: "Loop ตรวจจับ WIM" }), "ลูปตรวจจับยานพาหนะ");
assert.equal(getEquipmentEnglishLabel({ type: "WIM_LOOP" }), "WIM Loop");
assert.equal(getStationSystemLabel({ id: "present-other-display", sourceLabel: "ระบบเดิม" }), "ระบบแสดงผลและประมวลผลข้อมูล");
assert.equal(getStationSystemEnglishLabel({ id: "present-other-display", sourceLabel: "ระบบเดิม" }), "Display and Data Processing System");
const sourcePreservationEquipment = makeEquipment("FIXED_CAMERA", 1, { sourceLabel: "ชื่อกล้องตาม TOR" });
assert.equal(getEquipmentLabel(sourcePreservationEquipment), "กล้องโทรทัศน์วงจรปิดแบบมุมคงที่");
assert.equal(sourcePreservationEquipment.sourceLabel, "ชื่อกล้องตาม TOR");
const activeCanonicalItems = getCanonicalItemsForFormat("SC");
assert.equal(activeCanonicalItems.some((item) => ["image-processor", "image-management"].includes(item.id)), false, "unused Image Processing catalog items must not be selectable");
assert.equal(activeCanonicalItems.some((item) => item.category === "Image Processing"), false, "unused Image Processing category must not be selectable");
assert.equal(activeCanonicalItems.find((item) => item.id === "wim-control")?.checklistMapping[0], "2.2");
assert.equal(activeCanonicalItems.find((item) => item.id === "lpr-camera")?.checklistMapping[0], "3.2");
assert.equal(activeCanonicalItems.find((item) => item.id === "nvr")?.checklistMapping[0], "4.2");

assert.equal(EVIDENCE_TEMPLATE_VERSION, "checklist-master-v5-system-mapped");
assert.equal(EVIDENCE_CHECKLIST_SECTIONS.length, 13);
assert.equal(EVIDENCE_CHECKLIST_SECTIONS.flatMap((section) => section.items).length, 170);
assert.equal(MASTER_CHECKLIST_SECTIONS.length, 13);
assert.equal(MASTER_CHECKLIST_SECTIONS.flatMap((section) => section.items).length, 44);
assert.equal(new Set(EVIDENCE_CHECKLIST_SECTIONS.flatMap((section) => section.items).map((item) => item.id)).size, 170);
assert.equal(new Set(EVIDENCE_CHECKLIST_SECTIONS.flatMap((section) => section.items.flatMap((item) => item.evidenceSlots)).map((slot) => slot.id)).size, 170);
assert.equal(new Set(MASTER_CHECKLIST_SECTIONS.flatMap((section) => section.items).map((item) => item.id)).size, 44);

const evidenceSectionsByCode = new Map(EVIDENCE_CHECKLIST_SECTIONS.map((section) => [section.code, section]));
assert.equal(evidenceSectionsByCode.get("3.1")?.title, "ระบบควบคุมการอ่านป้ายทะเบียน");
assert.equal(evidenceSectionsByCode.get("3.2")?.title, "LPR Camera");
assert.match(evidenceSectionsByCode.get("3.1")?.items.find((item) => item.id === "3.1.lane-1-day")?.displayLabel || "", /WIM/);
assert.match(evidenceSectionsByCode.get("3.2")?.items.find((item) => item.id === "3.2.lane-1-day")?.displayLabel || "", /LPR Camera/);
assert.match(EVIDENCE_CHECKLIST_SECTIONS.find((section) => section.code === "3.1")?.items.find((item) => item.id === "3.1.lane-1-day")?.displayLabel || "", /^License Plate Recognition Control System · /);
assert.match(MASTER_CHECKLIST_SECTIONS.find((section) => section.code === "3.1")?.items.find((item) => item.id === "lpr-lane-1")?.label || "", /^License Plate Recognition Control System · /);

const profile = createDefaultStationProfile();
const round = createInspectionRound(profile);
assert.equal(round.templateVersion, EVIDENCE_TEMPLATE_VERSION);
const roundItems = getItemsForSnapshot(round.snapshot);
assert.equal(round.snapshot.checklistCopy.sections.flatMap((section) => section.items).length, 170);
assert.equal(roundItems.length, 123);
assert.equal(roundItems.filter((item) => item.isEquipmentCleaning).length, 14);
assert.ok(roundItems.some((item) => item.displayLabel.startsWith("Equipment Cleaning · ")));
assert.ok(roundItems.some((item) => item.evidenceSlots.some((slot) => slot.displayLabel === "ก่อนทำความสะอาด")));

const baseCopy = createChecklistCopySnapshot();
const baseCopyItems = baseCopy.sections.flatMap((section) => section.items);
const snapshotCopyItems = round.snapshot.checklistCopy.sections.flatMap((section) => section.items);
assert.deepEqual(snapshotCopyItems.map((item) => item.id), baseCopyItems.map((item) => item.id));
assert.deepEqual(snapshotCopyItems.map((item) => item.sourceLabel), baseCopyItems.map((item) => item.sourceLabel));
assert.deepEqual(snapshotCopyItems.flatMap((item) => item.evidenceSlots.map((slot) => slot.sourceLabel)), baseCopyItems.flatMap((item) => item.evidenceSlots.map((slot) => slot.sourceLabel)));

const docsText = currentDocs.map((relativePath) => [relativePath, read(relativePath)]);
for (const [relativePath, content] of docsText) {
  for (const term of forbiddenCurrentTerms) assert.equal(content.includes(term), false, `${relativePath} contains forbidden current wording: ${term}`);
}
const appText = read("src/app/App.jsx");
const masterChecklistText = read("src/domain/master-checklist.js");
const evidenceChecklistText = read("src/domain/evidence-checklist.js");
for (const term of forbiddenUiAssetTerms) assert.equal(appText.includes(term), false, `App.jsx contains legacy Asset UI wording: ${term}`);
assert.match(appText, /รหัสอุปกรณ์ \(Asset No\.\)/);
assert.match(appText, /อุปกรณ์กำหนดเอง \(Custom\)/);
const stringLiterals = appText.match(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/gs) || [];
const standaloneAssetLiterals = stringLiterals.filter((literal) => /\bAsset\b/.test(literal) && !literal.includes("Asset No."));
assert.deepEqual(standaloneAssetLiterals, [], `App.jsx contains standalone Asset UI string(s): ${standaloneAssetLiterals.join(", ")}`);
assert.match(masterChecklistText, /กรุณาระบุรหัสอุปกรณ์ \(Asset No\.\)/);
assert.match(masterChecklistText, /รหัสอุปกรณ์ \(Asset No\.\) ซ้ำ/);
assert.equal(evidenceChecklistText.includes("ไม่มี Asset ในทะเบียนสถานี"), false);
assert.match(evidenceChecklistText, /ไม่มีอุปกรณ์ในทะเบียนสถานี/);
assert.match(read("README.md"), /อุปกรณ์จริงที่ใช้งานอยู่/);
assert.match(read("docs/glossary.md"), /รหัสอุปกรณ์ \(Asset No\.\)/);
assert.match(appText, /ข้อมูลส่วนนี้ใช้ประกอบการลงนามในรายงานเท่านั้น ไม่ใช่ขั้นตอนการอนุมัติของระบบ/);
const reportCopyText = JSON.stringify(REPORT_COPY.report);
assert.match(reportCopyText, /ผู้จัดทำรายงาน/);
assert.match(reportCopyText, /ผู้ตรวจสอบรายงาน/);
assert.match(reportCopyText, /ผู้มีอำนาจลงนาม/);
assert.match(read("task.md"), /บันทึกเดิม \(Legacy — ไม่ใช่ตัวเลขปัจจุบัน\)/);
assert.match(read("task.md"), /checklist-master-v5-system-mapped/);
assert.match(read("task.md"), /13 หมวด \/ 44 รายการ/);
assert.match(read("task.md"), /13 หมวด \/ 123 รายการตรวจ \/ 170 ช่องหลักฐาน/);

console.log("copy consistency: PASS — canonical wording, current template/counts, IDs, mapping, source labels, Snapshot copy, and legacy labeling are consistent");
