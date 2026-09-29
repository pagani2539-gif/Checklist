import assert from "node:assert/strict";
import { getChecklistQueueEquipmentGroups, getChecklistQueueGroups, getChecklistQueueSectionLabel, getChecklistQueueToggle } from "../src/app/checklist-queue-state.js";

const expanded = new Set(["1.1"]);
const collapsed = getChecklistQueueToggle(expanded, "1.1", "1.1");
assert.equal(collapsed.shouldSelect, false, "clicking the selected open category should only collapse it");
assert.equal(collapsed.expandedSections.has("1.1"), false, "selected open category should collapse on click");
assert.equal(expanded.has("1.1"), true, "toggle calculation must not mutate the existing state");

const opened = getChecklistQueueToggle(new Set(), "SC-01.01", "1.1");
assert.equal(opened.shouldSelect, true, "clicking a closed category should select its first item");
assert.deepEqual([...opened.expandedSections], ["SC-01.01"], "opening a category should keep the accordion to one open category");

const queueSections = [
  { code: "1.1", title: "การแสดงความพร้อม", items: [{ id: "readiness", sectionCode: "1.1" }] },
  { code: "SC-01.01", title: "WIM High Speed - Equipment", boqGroupCode: "SC-01", items: [
    { id: "wim-sensor", sectionCode: "2.1", sourceSectionCode: "2.1", sourceSectionTitle: "WIM SORTING SYSTEM (SENSOR)" },
    { id: "lpr-camera", sectionCode: "3.2", sourceSectionCode: "3.2", sourceSectionTitle: "LPR Camera" },
    { id: "cctv-camera", sectionCode: "4.1", sourceSectionCode: "4.1", sourceSectionTitle: "CCTV Camera" },
  ] },
  { code: "SC-01.02", title: "WIM High Speed - Systems & Software", boqGroupCode: "SC-01", items: [
    { id: "lpr-control", sectionCode: "3.1", sourceSectionCode: "3.1", sourceSectionTitle: "ระบบควบคุมการอ่านป้ายทะเบียน" },
  ] },
];
const queueGroups = getChecklistQueueGroups(queueSections, "SC");
assert.deepEqual(queueGroups.map((group) => group.title), [
  "ความพร้อมหน้างาน",
  "SC-01 · WIM High Speed",
], "queue groups should use the station format group while keeping readiness separate");
assert.deepEqual(queueGroups[1].sections.map((section) => [section.code, section.queueDisplayCode, section.title, section.queueSourceSectionCode]), [
  ["SC-01.01", "SC-01.01", "อุปกรณ์", "SC-01.01"],
  ["SC-01.02", "SC-01.02", "ระบบและซอฟต์แวร์", "SC-01.02"],
], "queue child sections should show full presentation codes and retain their source section codes");
assert.deepEqual(queueGroups[1].sections.flatMap((section) => section.items).map((item) => item.id), [
  "wim-sensor", "lpr-camera", "cctv-camera", "lpr-control",
], "queue grouping should retain each original checklist item exactly once");
assert.equal(getChecklistQueueSectionLabel(queueSections[1], "SC"), "SC-01.01 · WIM High Speed - Equipment");

const impsGroups = getChecklistQueueGroups([
  { code: "1.1", title: "การแสดงความพร้อม", items: [{ id: "imps-readiness", sectionCode: "1.1" }] },
  { code: "IMPS-04.01", title: "LPR - Equipment", boqGroupCode: "IMPS-04", items: [{ id: "imps-camera", sectionCode: "3.2" }] },
  { code: "IMPS-04.02", title: "LPR - Systems & Software", boqGroupCode: "IMPS-04", items: [{ id: "imps-control", sectionCode: "3.1" }] },
], "IMPS");
assert.deepEqual(impsGroups.map((group) => group.title), ["ความพร้อมหน้างาน", "IMPS-04 · LPR"]);
assert.deepEqual(impsGroups[1].sections.map((section) => section.queueDisplayCode), ["IMPS-04.01", "IMPS-04.02"]);

const legacyImpsGroups = getChecklistQueueGroups([
  { code: "08.01", title: "WIM - Equipment", boqGroupCode: "08", items: [{ id: "legacy-imps-sensor", sectionCode: "2.1" }] },
  { code: "08.02", title: "WIM - Systems & Software", boqGroupCode: "08", items: [{ id: "legacy-imps-control", sectionCode: "2.2" }] },
], "IMPS");
assert.deepEqual(legacyImpsGroups.map((group) => group.title), ["IMPS-08 · WIM"]);
assert.deepEqual(legacyImpsGroups[0].sections.map((section) => section.queueDisplayCode), ["IMPS-08.01", "IMPS-08.02"]);

const unassignedGroups = getChecklistQueueGroups([
  { code: "SC-VMS?.01", title: "VMS - Assign High or Low Speed - Equipment", boqGroupCode: "SC-VMS?", items: [{ id: "unassigned-vms", sectionCode: "7.1" }] },
], "SC");
assert.equal(unassignedGroups[0].title, "SC · ยังไม่ระบุชุดตรวจ", "unscoped VMS should remain visible without an invented SC assignment");
assert.equal(unassignedGroups[0].sections[0].queueDisplayCode, "SC-VMS?.01");

const legacySourceGroups = getChecklistQueueGroups([
  { code: "2.1", title: "WIM SORTING SYSTEM (SENSOR)", items: [{ id: "source-fallback", sectionCode: "2.1" }] },
], "SC");
assert.deepEqual(legacySourceGroups.map((group) => group.title), ["WIM (Weigh-In-Motion)"]);
assert.equal(legacySourceGroups[0].sections[0].queueDisplayCode, "2.1", "unversioned historical sections should fall back to their source code");

const equipmentGroups = getChecklistQueueEquipmentGroups({ items: [
  { id: "sensor-check", assetId: "sensor-1", assetNo: "SENSOR-01", assetBinding: { types: ["WIM_SENSOR"] } },
  { id: "sensor-note", assetId: "sensor-1", assetNo: "SENSOR-01", assetBinding: { types: ["WIM_SENSOR"] } },
  { id: "shared-system", assetBinding: { types: ["WIM_SENSOR"] } },
  { id: "shared-note" },
] });
assert.deepEqual(equipmentGroups.map((group) => [group.id, group.scope, group.items.length]), [
  ["asset-sensor-1", "asset", 2],
  ["type-WIM_SENSOR", "equipment-type", 1],
  ["shared", "shared", 1],
], "queue should group checklist items by physical asset, equipment type, and shared work");

console.log("checklist queue toggle contract passed");
