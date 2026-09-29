import assert from "node:assert/strict";
import { BOQ_CHECKLIST_GROUPS, LEGACY_BOQ_CHECKLIST_PRESENTATION_VERSION, getBoqAddCategory, getBoqChecklistDisplaySections, mapTorEquipmentAndSoftware } from "../src/domain/boq-checklist-groups.js";
import { getCanonicalItem } from "../src/domain/canonical-station-catalog.js";
import { STATION_TOR_ITEMS } from "../src/domain/station-tor-catalog.js";
import { createStationDraft, createStationProfileFromDraft, createSnapshot, getItemsForSnapshot,
  getStationChecklistSections, makeEquipment } from "../src/domain/master-checklist.js";

assert.deepEqual(BOQ_CHECKLIST_GROUPS.SC.map((group) => group.code), ["01", "02", "03", "04", "05", "06"]);
assert.deepEqual(BOQ_CHECKLIST_GROUPS.IMPS.map((group) => group.code), ["01", "02", "03", "04", "05", "06"]);
assert.equal(getBoqAddCategory({ stationFormat: "SC", type: "VMS_SIGN", categoryCode: "7.1", scope: "High Speed" }).code, "SC-02.01");
assert.equal(getBoqAddCategory({ stationFormat: "SC", type: "VMS_SIGN", categoryCode: "7.1", scope: "Low Speed" }).code, "SC-05.01");
assert.equal(getBoqAddCategory({ stationFormat: "SC", type: "VMS_SIGN", categoryCode: "7.1" }).code, "", "unassigned VMS must not get a guessed number");
assert.equal(getBoqAddCategory({ stationFormat: "SC", type: "LPR_CAMERA", categoryCode: "3.2", scope: "3D" }).code, "SC-03.01");
const threeDLprControl = getCanonicalItem("lpr-control-system");
assert.deepEqual(threeDLprControl?.systemIds, ["lpr-control"], "legacy LPR control identity still belongs to the LPR Control System");
assert.equal(threeDLprControl?.legacyOnly, true, "LPR control equipment must be legacy-only");
assert.equal(getCanonicalItem("lpr-camera")?.legacyOnly, false, "LPR Camera remains a current Asset");
assert.ok(!getCanonicalItem("lpr-camera")?.systemIds.includes("dimension-management"), "3D LPR Camera must not be duplicated under 3D Dimension Management");
assert.equal(getBoqAddCategory({ stationFormat: "SC", type: "LPR_CONTROL_SYSTEM", categoryCode: "3.1", scope: "3D" }).code, "SC-03.01");
assert.equal(getBoqAddCategory({ stationFormat: "SC", kind: "system", canonicalItemId: "lpr-control", categoryCode: "3.1", scope: "Low Speed" }).code, "SC-04.02");
assert.equal(getBoqAddCategory({ stationFormat: "SC", kind: "system", canonicalItemId: "lpr-control", categoryCode: "3.1", scope: "3D" }).code, "SC-03.02");
assert.equal(getBoqAddCategory({ stationFormat: "IMPS", type: "LPR_CAMERA", categoryCode: "3.2", scope: "3D" }).code, "IMPS-03.01");
assert.equal(getBoqAddCategory({ stationFormat: "IMPS", type: "LPR_CONTROL_SYSTEM", categoryCode: "3.1", scope: "3D" }).code, "IMPS-03.01");
assert.equal(getBoqAddCategory({ stationFormat: "IMPS", kind: "system", canonicalItemId: "lpr-control", categoryCode: "3.1", scope: "3D" }).code, "IMPS-03.02");
assert.equal(getBoqAddCategory({ stationFormat: "IMPS", type: "IMAGE_PROCESSOR", categoryCode: "1.1.12", scope: "Image Processing" }).code, "IMPS-01.01");
assert.equal(getBoqAddCategory({ stationFormat: "SC", kind: "system", canonicalItemId: "vms-control", categoryCode: "7.1", scope: "Low Speed" }).code, "SC-05.02");

const scRows = mapTorEquipmentAndSoftware(STATION_TOR_ITEMS.SC, "SC");
assert.equal(scRows.length, STATION_TOR_ITEMS.SC.length - 1, "network integration work is not equipment or software");
assert.ok(scRows.every((row) => row.torSourceRef && row.boqSourceRef && row.nameEn));
assert.equal(scRows.find((row) => row.torItemId === "sc-3d-lpr")?.groupCode, "03");
assert.equal(scRows.find((row) => row.torItemId === "sc-ls-lpr")?.groupCode, "04");
assert.deepEqual(
  scRows.filter((row) => ["sc-vms-large", "sc-vms-small", "sc-vms-low"].includes(row.torItemId)).map((row) => [row.torItemId, row.scope, row.groupCode]),
  [["sc-vms-large", "high-speed", "02"], ["sc-vms-small", "high-speed", "02"], ["sc-vms-low", "low-speed", "05"]],
  "VMS signs must follow their explicit High/Low scope",
);
assert.equal(scRows.find((row) => row.torItemId === "sc-vms-low")?.sourceScopeConflict, true);
assert.equal(scRows.find((row) => row.torItemId === "sc-vms-low")?.groupCode, "05", "Low Speed VMS must stay in SC-05 even when the BOQ source label conflicts");
assert.equal(scRows.find((row) => row.torItemId === "sc-vms-control")?.scopeRequired, true);

const impsRows = mapTorEquipmentAndSoftware(STATION_TOR_ITEMS.IMPS, "IMPS");
assert.equal(impsRows.find((row) => row.torItemId === "imps-image-processor")?.nameEn, "Image Processor");
assert.ok(!impsRows.some((row) => row.groupCode === "09"), "ImPS 3D is installed-conditionally, not a fabricated TOR row");

const makeItem = (id, sectionCode, assetId = null) => ({ id, sectionCode, assetId, label: id, evidenceSlots: [] });
const scSnapshot = { stationFormat: "SC", checklistPresentationVersion: "boq-system-groups-v1", equipment: [
  { id: "high-lpr", type: "LPR_CAMERA", scope: "High Speed" },
  { id: "low-lpr", type: "LPR_CAMERA", scope: "Low Speed" },
  { id: "three-d-lpr", type: "LPR_CAMERA", scope: "3D" },
  { id: "high-vms", type: "VMS_SIGN", scope: "High Speed" },
  { id: "low-vms", type: "VMS_SIGN", scope: "Low Speed" },
  { id: "unknown-vms", type: "VMS_SIGN" },
] };
const sourceSections = [
  { code: "3.2", title: "LPR Camera", items: [makeItem("a", "3.2", "high-lpr"), makeItem("b", "3.2", "low-lpr"), makeItem("c", "3.2", "three-d-lpr")] },
  { code: "7.1", title: "VMS", items: [makeItem("d", "7.1", "high-vms"), makeItem("e", "7.1", "low-vms"), makeItem("f", "7.1", "unknown-vms")] },
];
const display = getBoqChecklistDisplaySections(scSnapshot, sourceSections);
const byItem = new Map(display.flatMap((section) => section.items.map((item) => [item.id, section.code])));
assert.deepEqual([...byItem.entries()], [["a", "01.01"], ["d", "02.01"], ["c", "03.01"], ["b", "04.01"], ["e", "05.01"], ["f", "VMS?.01"]]);
assert.equal(new Set(display.flatMap((section) => section.items.map((item) => item.id))).size, 6, "each check occurs once");
assert.ok(display.every((section) => section.items.every((item) => item.sectionCode === item.sourceSectionCode)), "technical codes remain intact");
assert.equal(getBoqChecklistDisplaySections({ stationFormat: "SC" }, sourceSections), sourceSections, "old Snapshot stays unchanged");

// WIM child equipment inherits its operational scope from its installed
// WIM Sorting System. A stale scope persisted on the child must never move
// the new-round presentation to the wrong BOQ group.
const wimScopeSnapshot = {
  stationFormat: "SC",
  checklistPresentationVersion: "boq-system-groups-v1",
  stationSystems: [{ id: "wim-high", canonicalItemId: "wim-sorting", laneId: "lane-1", scope: "High Speed", active: true }],
  equipment: [{ id: "wim-sensor-stale", type: "WIM_SENSOR", parentSystemId: "wim-high", laneId: "lane-1", scope: "Low Speed", active: true }],
};
const wimScopeDisplay = getBoqChecklistDisplaySections(wimScopeSnapshot, [
  { code: "2.1", title: "WIM", items: [makeItem("wim-scope-check", "2.1", "wim-sensor-stale")] },
]);
assert.equal(wimScopeDisplay[0]?.code, "01.01", "WIM child must derive High Speed ownership from its parent system");

const wimScopeAfterParentChange = getBoqChecklistDisplaySections({
  ...wimScopeSnapshot,
  stationSystems: [{ ...wimScopeSnapshot.stationSystems[0], scope: "Low Speed" }],
}, [
  { code: "2.1", title: "WIM", items: [makeItem("wim-scope-check", "2.1", "wim-sensor-stale")] },
]);
assert.equal(wimScopeAfterParentChange[0]?.code, "04.01", "changing the parent scope must move the child checklist with the parent");

const impsSnapshot = { stationFormat: "IMPS", checklistPresentationVersion: "boq-system-groups-v1", equipment: [
  { id: "scanner", type: "LASER_SCANNER" }, { id: "imps-lpr", type: "LPR_CAMERA", scope: "ImPS" },
] };
const impsDisplay = getBoqChecklistDisplaySections(impsSnapshot, [
  { code: "1.1.5", title: "3D", items: [makeItem("scanner-check", "1.1.5", "scanner")] },
  { code: "3.2", title: "LPR", items: [makeItem("lpr-check", "3.2", "imps-lpr")] },
]);
assert.deepEqual(impsDisplay.map((section) => section.code), ["09.01", "10.01"]);
assert.ok(!getBoqChecklistDisplaySections(impsSnapshot, [{ code: "3.2", title: "LPR", items: [makeItem("lpr-check", "3.2", "imps-lpr")] }]).some((section) => section.code.startsWith("09")));

const impsDraft = createStationDraft("IMPS");
const impsProfile = createStationProfileFromDraft(impsDraft);
const without3d = createSnapshot(impsProfile);
assert.ok(!getStationChecklistSections(without3d).some((section) => section.code.startsWith("09")));
impsProfile.equipment.push(
  makeEquipment("LASER_SCANNER", 1, { id: "imps-scanner", scope: "3D" }),
  makeEquipment("DIMENSION_CONTROLLER", 1, { id: "imps-controller", scope: "3D" }),
  makeEquipment("LPR_CAMERA", 1, { id: "imps-3d-lpr", scope: "3D" }),
  makeEquipment("LPR_CAMERA", 2, { id: "imps-regular-lpr", scope: "ImPS" }),
  makeEquipment("IMAGE_PROCESSOR", 1, { id: "imps-processor", scope: "Image Processing" }),
  makeEquipment("FIXED_CAMERA", 1, { id: "imps-image-camera", scope: "Image Processing" }),
  makeEquipment("FIXED_CAMERA", 2, { id: "imps-cctv-camera", scope: "ImPS" }),
);
impsProfile.stationSystems.push(
  { id: "imps-3d-management", canonicalItemId: "dimension-management", scope: "3D", quantity: 1, active: true },
  { id: "imps-3d-lpr-system", canonicalItemId: "lpr-control", scope: "3D", quantity: 1, active: true },
  { id: "imps-regular-lpr-system", canonicalItemId: "lpr-control", scope: "ImPS", quantity: 1, active: true },
  { id: "imps-image-processing-system", canonicalItemId: "image-processing-management", scope: "Image Processing", quantity: 1, active: true },
  { id: "imps-cctv-system", canonicalItemId: "cctv-system", scope: "ImPS", quantity: 1, active: true },
);
const with3d = createSnapshot(impsProfile);
const with3dItems = getItemsForSnapshot(with3d);
assert.ok(with3dItems.some((item) => item.id.includes("imps-3d-management") && item.sectionCode === "1.1.5"));
assert.deepEqual(with3dItems.filter((item) => item.sectionCode === "1.1").map((item) => item.id), [
  "1.1.staff", "1.1.vehicle", "1.1.crane", "1.1.traffic-cone-light", "1.1.tools", "1.1.road-closure",
], "new rounds retain station-level readiness checks");
assert.ok(!with3dItems.some((item) => item.sectionCode === "6.2" || item.sectionCode === "6.3" || item.isEquipmentCleaning));
const actual3d = getStationChecklistSections(with3d).filter((section) => section.code.startsWith("IMPS-03"));
assert.ok(actual3d.flatMap((section) => section.items).some((item) => item.assetId === "imps-3d-lpr"));
assert.ok(!actual3d.flatMap((section) => section.items).some((item) => item.assetId === "imps-3d-lpr-control"));
assert.ok(actual3d.find((section) => section.code === "IMPS-03.02")?.items.some((item) => item.systemRecordId === "imps-3d-lpr-system"));
const impsLprSection = getStationChecklistSections(with3d).find((section) => section.code === "IMPS-04.01");
assert.ok(!impsLprSection?.items.some((item) => ["imps-3d-lpr", "imps-3d-lpr-control"].includes(item.assetId)), "3D LPR Assets must not leak into regular IMPS LPR");
assert.ok(impsLprSection?.items.some((item) => item.assetId === "imps-regular-lpr"));
assert.ok(!impsLprSection?.items.some((item) => item.assetId === "imps-regular-lpr-control"));
assert.ok(getStationChecklistSections(with3d).find((section) => section.code === "IMPS-04.02")?.items.some((item) => item.systemRecordId === "imps-regular-lpr-system"));
assert.equal(actual3d.flatMap((section) => section.items).filter((item) => item.assetId === "imps-3d-lpr").length,
  with3dItems.filter((item) => item.assetId === "imps-3d-lpr").length, "3D LPR checks are not duplicated in regular ImPS LPR");
assert.ok(getStationChecklistSections(with3d).some((section) => section.code.startsWith("IMPS-01") && section.items.some((item) => item.assetId === "imps-processor")));
assert.ok(getStationChecklistSections(with3d).some((section) => section.code.startsWith("IMPS-01") && section.items.some((item) => item.assetId === "imps-image-camera")));
assert.ok(getStationChecklistSections(with3d).some((section) => section.code.startsWith("IMPS-05") && section.items.some((item) => item.assetId === "imps-cctv-camera")));

const scDraft = createStationDraft("SC");
scDraft.stationSystems = [
  { id: "sc-high-reporting", canonicalItemId: "wim-high-reporting", scope: "High Speed", quantity: 1, active: true },
  { id: "sc-low-reporting", canonicalItemId: "wim-low-reporting", scope: "Low Speed", quantity: 1, active: true },
  { id: "sc-low-vms-control", canonicalItemId: "vms-control", scope: "Low Speed", quantity: 1, active: true },
  { id: "sc-high-lpr-control", canonicalItemId: "lpr-control", scope: "High Speed", quantity: 1, active: true },
  { id: "sc-low-lpr-control", canonicalItemId: "lpr-control", scope: "Low Speed", quantity: 1, active: true },
];
const scSoftwareProfile = createStationProfileFromDraft(scDraft);
scSoftwareProfile.equipment.push(
  makeEquipment("LPR_CAMERA", 1, { id: "sc-high-lpr-camera", scope: "High Speed" }),
  makeEquipment("LPR_CAMERA", 2, { id: "sc-low-lpr-camera", scope: "Low Speed" }),
);
const scSoftware = createSnapshot(scSoftwareProfile);
const scSoftwareSections = getStationChecklistSections(scSoftware);
assert.ok(scSoftwareSections.find((section) => section.code === "SC-01.02")?.items.some((item) => item.systemRecordId === "sc-high-reporting"));
assert.ok(scSoftwareSections.find((section) => section.code === "SC-01.02")?.items.some((item) => item.systemRecordId === "sc-high-lpr-control"));
assert.ok(scSoftwareSections.find((section) => section.code === "SC-04.02")?.items.some((item) => item.systemRecordId === "sc-low-reporting"));
assert.ok(scSoftwareSections.find((section) => section.code === "SC-04.02")?.items.some((item) => item.systemRecordId === "sc-low-lpr-control"));
assert.ok(scSoftwareSections.find((section) => section.code === "SC-05.02")?.items.some((item) => item.systemRecordId === "sc-low-vms-control"));
assert.ok(scSoftwareSections.find((section) => section.code === "SC-01.01")?.items.some((item) => item.assetId === "sc-high-lpr-camera"));
assert.ok(scSoftwareSections.find((section) => section.code === "SC-04.01")?.items.some((item) => item.assetId === "sc-low-lpr-camera"));
assert.ok(!scSoftwareSections.find((section) => section.code === "SC-04.01")?.items.some((item) => item.assetId === "sc-low-lpr-equipment"));

const sc3dDraft = createStationDraft("SC");
sc3dDraft.stationSystems = [
  { id: "sc-3d-management", canonicalItemId: "dimension-management", scope: "3D", quantity: 1, active: true },
  { id: "sc-3d-lpr-system", canonicalItemId: "lpr-control", scope: "3D", quantity: 1, active: true },
];
const sc3dProfile = createStationProfileFromDraft(sc3dDraft);
sc3dProfile.equipment.push(
  makeEquipment("LPR_CAMERA", 1, { id: "sc-3d-lpr-camera", scope: "3D" }),
);
const sc3dSnapshot = createSnapshot(sc3dProfile);
const sc3dSections = getStationChecklistSections(sc3dSnapshot);
assert.ok(!sc3dSections.find((section) => section.code === "SC-03.01")?.items.some((item) => item.assetId === "sc-3d-lpr-control"), "retired 3D LPR Control Asset must not be listed in SC-03");
assert.ok(sc3dSections.find((section) => section.code === "SC-03.01")?.items.some((item) => item.assetId === "sc-3d-lpr-camera"), "3D LPR Camera must be listed in SC-03");
assert.ok(sc3dSections.find((section) => section.code === "SC-03.02")?.items.some((item) => item.systemRecordId === "sc-3d-lpr-system"), "3D LPR Control System must have its own System check");
const legacySc3dSnapshot = { ...sc3dSnapshot, checklistPresentationVersion: LEGACY_BOQ_CHECKLIST_PRESENTATION_VERSION };
assert.ok(!getStationChecklistSections(legacySc3dSnapshot).flatMap((section) => section.items).some((item) => item.systemRecordId === "sc-3d-lpr-system"), "adding a v2 LPR System check must not alter a v1 Snapshot");
assert.ok(!sc3dSections.find((section) => section.code === "SC-01.01")?.items.some((item) => item.assetId === "sc-3d-lpr-control"), "3D LPR Control must not leak into SC-01");
assert.ok(!sc3dSections.find((section) => section.code === "SC-04.01")?.items.some((item) => item.assetId === "sc-3d-lpr-control"), "3D LPR Control must not leak into SC-04");

console.log("BOQ Checklist group tests passed.");
