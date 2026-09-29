import assert from "node:assert/strict";
import {
  BOQ_CHECKLIST_GROUPS,
  BOQ_CHECKLIST_PRESENTATION_VERSION,
  getBoqAddCategory,
  getBoqChecklistDisplaySections,
  sortCanonicalSystemDefinitions,
} from "../src/domain/boq-checklist-groups.js";
import { getCanonicalItemsForFormat } from "../src/domain/canonical-station-catalog.js";
import { EVIDENCE_ASSET_TYPE_MAPPING } from "../src/domain/evidence-checklist.js";
import { CENTRAL_EQUIPMENT_MAIN_CATEGORIES } from "../src/domain/equipment-names.js";

assert.equal(BOQ_CHECKLIST_PRESENTATION_VERSION, "boq-system-groups-v2");
assert.deepEqual(BOQ_CHECKLIST_GROUPS.SC.map((group) => group.groupId), [
  "SC-01", "SC-02", "SC-03", "SC-04", "SC-05", "SC-06",
]);
assert.deepEqual(BOQ_CHECKLIST_GROUPS.IMPS.map((group) => group.groupId), [
  "IMPS-01", "IMPS-02", "IMPS-03", "IMPS-04", "IMPS-05", "IMPS-06",
]);
assert.deepEqual(CENTRAL_EQUIPMENT_MAIN_CATEGORIES.map((category) => category.id), [
  "wim", "lpr", "cctv", "3d", "image-processing", "vms", "data-control", "station-infrastructure",
]);
assert.deepEqual(CENTRAL_EQUIPMENT_MAIN_CATEGORIES.find((category) => category.id === "data-control")?.categoryCodes, ["5.1", "5.2", "6.1"]);
assert.deepEqual(CENTRAL_EQUIPMENT_MAIN_CATEGORIES.find((category) => category.id === "station-infrastructure")?.categoryCodes, ["1.1.11"]);
assert.deepEqual(BOQ_CHECKLIST_GROUPS.SC[0], {
  format: "SC",
  code: "01",
  groupId: "SC-01",
  groupNumber: "01",
  title: "WIM High Speed",
  sourceRefs: ["1.1", "1.2", "1.3", "1.4"],
  displayOrder: 1,
});

assert.deepEqual(
  getBoqAddCategory({ stationFormat: "IMPS", kind: "system", canonicalItemId: "image-processing-management", categoryCode: "1.1.12", scope: "ImPS" }),
  {
    code: "IMPS-01.02",
    displayNumber: "01.02",
    groupId: "IMPS-01",
    groupCode: "01",
    title: "Image Processing - Systems & Software",
    sourceCode: "1.1.12",
  },
);
assert.equal(
  getBoqAddCategory({ stationFormat: "IMPS", kind: "system", canonicalItemId: "wim-control", categoryCode: "2.2", scope: "ImPS" }).code,
  "IMPS-02.02",
);
assert.equal(
  getBoqAddCategory({ stationFormat: "IMPS", type: "WIM_SENSOR", categoryCode: "2.1", scope: "ImPS" }).code,
  "IMPS-02.01",
);
assert.equal(
  getBoqAddCategory({ stationFormat: "IMPS", type: "IMAGE_PROCESSOR", categoryCode: "1.1.12", scope: "Image Processing" }).code,
  "IMPS-01.01",
);
assert.equal(
  getBoqAddCategory({ stationFormat: "SC", kind: "system", canonicalItemId: "vms-control", categoryCode: "7.1", scope: "Low Speed" }).code,
  "SC-05.02",
);
assert.equal(
  getBoqAddCategory({ stationFormat: "SC", kind: "system", canonicalItemId: "data-management", categoryCode: "5.1", scope: "High Speed" }).code,
  "SC-06.02",
);

const impsSections = getBoqChecklistDisplaySections(
  { stationFormat: "IMPS", checklistPresentationVersion: "boq-system-groups-v2", equipment: [] },
  [
    { code: "5.1", title: "Data", items: [{ id: "data", sectionCode: "5.1", applicable: true }] },
    { code: "3.1", title: "LPR", items: [{ id: "lpr", sectionCode: "3.1", applicable: true }] },
    { code: "1.1.12", title: "Image", items: [{ id: "image", sectionCode: "1.1.12", applicable: true }] },
  ],
);
assert.deepEqual(impsSections.map((section) => section.code), [
  "IMPS-01.02", "IMPS-04.02", "IMPS-06.02",
]);
assert.deepEqual(impsSections.map((section) => section.displayCode), ["01.02", "04.02", "06.02"]);

const oldImpsSections = getBoqChecklistDisplaySections(
  { stationFormat: "IMPS", checklistPresentationVersion: "boq-system-groups-v1", equipment: [] },
  [{ code: "2.1", title: "WIM", items: [{ id: "wim", sectionCode: "2.1", applicable: true }] }],
);
assert.equal(oldImpsSections[0].code, "08.02", "v1 Snapshot keeps its historical ImPS display code");

const orderedImpsSystems = sortCanonicalSystemDefinitions(
  getCanonicalItemsForFormat("IMPS").filter((item) => item.kind === "system"),
  "IMPS",
  () => "ImPS",
);
assert.deepEqual(orderedImpsSystems.map((item) => item.id), [
  "image-processing-management",
  "wim-sorting",
  "wim-control",
  "wim-electronics-system",
  "dimension-management",
  "lpr-control",
  "cctv-system",
  "data-management",
  "station-display",
]);

const orderedScSystems = sortCanonicalSystemDefinitions(
  getCanonicalItemsForFormat("SC").filter((item) => item.kind === "system"),
  "SC",
  (item) => item.id.includes("low") || item.id === "vms-control" ? "Low Speed" : "High Speed",
);
assert.deepEqual(orderedScSystems.slice(0, 7).map((item) => item.id), [
  "wim-sorting",
  "wim-control",
  "wim-electronics-system",
  "wim-high-data-control",
  "wim-high-reporting",
  "wim-high-display",
  "lpr-control",
]);
assert.ok(orderedScSystems.indexOf(orderedScSystems.find((item) => item.id === "wim-sorting")) < orderedScSystems.length - 1,
  "WIM Sorting is ordered with WIM systems, not appended after every other system");

assert.ok(EVIDENCE_ASSET_TYPE_MAPPING["3.1"].includes("LPR_CONTROL_SYSTEM"));
assert.ok(EVIDENCE_ASSET_TYPE_MAPPING["4.1"].includes("JOYSTICK"));
assert.ok(EVIDENCE_ASSET_TYPE_MAPPING["1.1.5"].includes("LASER_SCANNER"));
assert.ok(EVIDENCE_ASSET_TYPE_MAPPING["1.1.5"].includes("DIMENSION_CONTROLLER"));
assert.ok(EVIDENCE_ASSET_TYPE_MAPPING["1.1.12"].includes("IMAGE_PROCESSOR"));
assert.ok(EVIDENCE_ASSET_TYPE_MAPPING["1.1.11"].includes("CABINET"));

console.log("BOQ display v2 ordering, format-qualified codes, legacy presentation and direct mapping passed");
