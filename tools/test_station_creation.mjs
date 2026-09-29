import assert from "node:assert/strict";
import {
  EVIDENCE_ASSET_TYPE_MAPPING,
  EVIDENCE_CHECKLIST_SECTIONS,
  EVIDENCE_TEMPLATE_VERSION,
  LANE_ASSET_EVIDENCE_TEMPLATE_VERSION,
  CLEANING_POLICY_VERSION,
  CHECKLIST_POLICY_VERSION,
  EQUIPMENT_TYPES,
  STATION_FORMATS,
  MASTER_CHECKLIST_SECTIONS,
  MASTER_TEMPLATE_VERSION,
  createInspectionRound,
  getNewRoundChecklistItems,
  getEquipmentGroupsForRegister,
  getEquipmentLabel,
  buildStationSystemSummaryModel,
  getItemsForSnapshot,
  getRoundSummary,
  makeEquipment,
  getNextEquipmentIndex,
  synchronizeGeneratedAssetNos,
  normalizeStationProfile,
  createStationDraft,
  createEmptyStationDraft,
  validateStationDraft,
  createStationProfileFromDraft,
  makeLane,
} from "../src/domain/master-checklist.js";
import { parseHash, primaryRouteFor } from "../src/app/router.js";
import { CURRENT_STATE_VERSION, migrateChecklistState } from "../src/domain/storage.js";
import { BOQ_CHECKLIST_PRESENTATION_VERSION } from "../src/domain/boq-checklist-groups.js";

const expectedEvidenceSectionCounts = {
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

const expectedAssetMapping = {
  "1.1.5": ["LASER_SCANNER", "DIMENSION_CONTROLLER"],
  "1.1.11": ["CABINET"],
  "1.1.12": ["IMAGE_PROCESSOR"],
  "2.1": ["WIM_SENSOR", "WIM_LOOP"],
  "2.2": ["CONTROL_COMPUTER"],
  "2.3": ["CONTROL_CABINET", "WIM_AC_DC_POWER_SUPPLY", "WIM_NETWORK_EQUIPMENT", "WIM_CONTROLLER", "WIM_PHASE_PROTECTION", "WIM_SUB_BREAKER", "WIM_SWITCHING_DC", "WIM_TRANSFORMER_24VAC"],
  "3.1": ["LPR_CONTROL_SYSTEM"],
  "3.2": ["LPR_CAMERA"],
  "4.1": ["FIXED_CAMERA", "PTZ_CAMERA", "JOYSTICK"],
  "4.2": ["NVR"],
  "5.1": ["DATABASE_SERVER"],
  "5.2": ["IMPS_DISPLAY_PROCESSING"],
  "7.1": ["VMS_SIGN", "VMS_LIGHT_SENSOR", "VMS_DISPLAY"],
};

assert.equal(MASTER_CHECKLIST_SECTIONS.length, 13);
assert.equal(MASTER_CHECKLIST_SECTIONS.flatMap((section) => section.items).length, 44);
assert.deepEqual(
  Object.fromEntries(EVIDENCE_CHECKLIST_SECTIONS.map((section) => [section.code, section.items.length])),
  expectedEvidenceSectionCounts,
);
assert.deepEqual(EVIDENCE_CHECKLIST_SECTIONS.map((section) => section.code), Object.keys(expectedEvidenceSectionCounts));
assert.deepEqual(MASTER_CHECKLIST_SECTIONS.map((section) => section.code), Object.keys(expectedEvidenceSectionCounts));
assert.equal(EVIDENCE_CHECKLIST_SECTIONS.flatMap((section) => section.items).length, 170);
assert.deepEqual(EVIDENCE_ASSET_TYPE_MAPPING, expectedAssetMapping);

const emptyProfile = {
  id: "station-new-test",
  stationCode: "TEST-NEW",
  stationName: "สถานีทดสอบใหม่",
  equipment: [],
  checklistConfig: { disabledTemplateIds: [] },
};

const countByType = (equipment) => Object.fromEntries(EQUIPMENT_TYPES.map((type) => [
  type.value,
  equipment.filter((entry) => entry.type === type.value && entry.active !== false).length,
]));

const stationDraft = createEmptyStationDraft();
assert.equal(stationDraft.stationCode, "");
assert.equal(stationDraft.stationName, "");
assert.deepEqual(stationDraft.lanes, []);
assert.deepEqual(stationDraft.stationSystems, [], "a new station must not seed System records");
assert.deepEqual(stationDraft.equipment, [], "a new station must not seed Asset records");
assert.deepEqual(stationDraft.checklistConfig, { disabledTemplateIds: [], disabledItemIds: [], legacyResolved: false });

const scDraft = createStationDraft("SC");
assert.equal(scDraft.stationFormat, "SC");
assert.equal(scDraft.stationTemplateId, "SC");
assert.deepEqual(STATION_FORMATS.map((format) => format.templateId), ["SC", "IMPS"], "the product exposes exactly two main station templates");
assert.deepEqual(scDraft.stationSystems, [], "SC station draft must start with zero Systems");
assert.deepEqual(scDraft.lanes, [], "SC station draft must start with zero lanes");
assert.deepEqual(scDraft.equipment, [], "SC station draft must start with zero Assets");

const impsDraft = createStationDraft("IMPS");
assert.equal(impsDraft.stationFormat, "IMPS");
assert.equal(impsDraft.stationTemplateId, "IMPS");
assert.deepEqual(impsDraft.stationSystems, [], "IMPS station draft must start with zero Systems");
assert.deepEqual(impsDraft.lanes, [], "IMPS station draft must start with zero lanes");
assert.deepEqual(impsDraft.equipment, [], "IMPS station draft must start with zero Assets");
const impsWithVmsProfile = createStationProfileFromDraft({
  ...impsDraft,
  stationCode: "IMPS-VMS-01",
  stationName: "สถานี IMPS ทดสอบเพิ่ม VMS ภายหลัง",
  stationSystems: [{ id: "imps-vms-system-1", canonicalItemId: "vms-control", systemId: "vms", componentId: "control", scope: "Station-wide", quantity: 1, active: true }],
  equipment: [...impsDraft.equipment, makeEquipment("VMS_SIGN", 1, { id: "imps-vms-sign-1", assetNo: "VMS-01" })],
});
assert.equal(impsWithVmsProfile.stationFormat, "IMPS");
assert.equal(impsWithVmsProfile.equipment.filter((entry) => entry.type === "VMS_SIGN").length, 1, "IMPS must allow VMS to be added after station creation");
const impsWithVmsRound = createInspectionRound(impsWithVmsProfile);
assert.ok(getItemsForSnapshot(impsWithVmsRound.snapshot).some((item) => item.assetId === "imps-vms-sign-1" && item.sectionCode === "7.1"), "a VMS added later must be included in the next round");
assert.equal(impsWithVmsRound.snapshot.stationFormat, "IMPS");
assert.equal(impsWithVmsRound.snapshot.stationTemplateId, "IMPS");

const torNamedEquipment = makeEquipment("FIXED_CAMERA", 1, { sourceLabel: "ชื่อกล้องตาม TOR" });
assert.equal(getEquipmentLabel(torNamedEquipment), "กล้องโทรทัศน์วงจรปิดแบบมุมคงที่", "the central equipment name is shown to users");
assert.equal(torNamedEquipment.sourceLabel, "ชื่อกล้องตาม TOR", "the TOR source label must remain preserved for provenance");

const summaryModel = buildStationSystemSummaryModel(stationDraft.stationSystems, [
  ...stationDraft.equipment,
  makeEquipment("WIM_LOOP", 1, { id: "summary-loop-1" }),
  makeEquipment("PTZ_CAMERA", 1, { id: "summary-ptz-1" }),
  makeEquipment("VMS_SIGN", 1, { id: "summary-vms-sign-1" }),
  makeEquipment("VMS_LIGHT_SENSOR", 1, { id: "summary-vms-light-1", active: false }),
]);
assert.equal(summaryModel.unmapped.some((system) => system.referenceId === "present-lpr-control"), false, "LPR Control must not be classified as unmapped Asset");
assert.equal(summaryModel.unmapped.some((system) => system.referenceId === "present-other-display"), false, "5.2 display-processing must not be classified as unmapped Asset");
assert.equal(summaryModel.systemOnly.some((system) => system.referenceId === "present-lpr-control"), true, "LPR Control is a System-only row");
assert.equal(summaryModel.systemOnly.some((system) => system.referenceId === "present-other-display"), false, "Display and Data Processing remains mapped to its group reference");
assert.equal(summaryModel.groups.find((group) => group.id === "lpr").children.find((child) => child.id === "asset-lpr_camera").actualCount, 0);
assert.equal(summaryModel.groups.find((group) => group.id === "imps").children.find((child) => child.id === "asset-imps_display_processing").actualCount, 0);
assert.equal(summaryModel.groups.find((group) => group.id === "wim").children.find((child) => child.id === "asset-wim_sensor").actualCount, 0);
assert.equal(summaryModel.groups.find((group) => group.id === "wim").children.find((child) => child.id === "asset-wim_loop").actualCount, 1, "adding a WIM Loop must update the actual count");
assert.equal(summaryModel.groups.find((group) => group.id === "cctv").children.find((child) => child.id === "asset-ptz_camera").actualCount, 1);
assert.equal(summaryModel.groups.find((group) => group.id === "vms").children.find((child) => child.id === "asset-vms_light_sensor").actualCount, 0, "inactive VMS assets must not be counted");
assert.equal(summaryModel.groups.find((group) => group.id === "wim").children.find((child) => child.id === "asset-wim_sensor").presentQuantity, null, "new station summaries must not seed Present MA reference quantities");
assert.deepEqual(summaryModel.referenceTotals, [{ unit: "ระบบ", quantity: 8 }, { unit: "ชุด", quantity: 7 }], "summary reference totals remain a separate Present MA reference");
assert.equal(MASTER_CHECKLIST_SECTIONS.find((section) => section.code === "3.1")?.items.length, 4, "lane-based Checklist 3.1 must remain available alongside the LPR Control System row");
const emptyDraftValidation = validateStationDraft(stationDraft, []);
assert.equal(emptyDraftValidation.valid, false);
assert.equal(emptyDraftValidation.errors.stationCode, "กรุณากรอกรหัสสถานี");
assert.equal(emptyDraftValidation.errors.stationName, "กรุณากรอกชื่อสถานี");
assert.ok(emptyDraftValidation.warnings.some((warning) => warning.includes("ยังไม่ได้กำหนดช่องจราจร")));
assert.equal(parseHash("#/stations/new").name, "newStation");
assert.equal(primaryRouteFor("newStation"), "stations");

const duplicateCodeValidation = validateStationDraft({ ...stationDraft, stationCode: " test-01 ", stationName: "สถานีซ้ำ" }, [{ stationCode: "TEST-01" }]);
assert.equal(duplicateCodeValidation.valid, false);
assert.equal(duplicateCodeValidation.errors.stationCode, "รหัสสถานีนี้มีอยู่แล้ว กรุณาใช้รหัสอื่น");

const duplicateAsset = makeEquipment("LPR_CAMERA", 1, { id: "draft-lpr-1", assetNo: "LPR-01" });
const duplicateAssetValidation = validateStationDraft({ stationCode: "TEST-NEW", stationName: "สถานีทดสอบใหม่", equipment: [duplicateAsset, { ...duplicateAsset, id: "draft-lpr-2" }] }, []);
assert.equal(duplicateAssetValidation.valid, false);
assert.equal(duplicateAssetValidation.errors.assetNoById["draft-lpr-1"], "รหัสอุปกรณ์ (Asset No.) ซ้ำกับรายการอื่นในสถานีนี้");
assert.equal(duplicateAssetValidation.errors.assetNoById["draft-lpr-2"], "รหัสอุปกรณ์ (Asset No.) ซ้ำกับรายการอื่นในสถานีนี้");

const committedProfile = createStationProfileFromDraft({
  stationCode: " TEST-COMMIT ",
  stationName: " สถานีที่ยืนยันแล้ว ",
  equipment: [makeEquipment("LPR_CAMERA", 4, { id: "commit-lpr-4", assetNo: " LPR-04 ", location: " Lane 4 ", serialNo: " SN-04 " })],
  checklistConfig: { disabledTemplateIds: ["lpr-camera-1"] },
}, 2);
assert.match(committedProfile.id, /^station-/);
assert.equal(committedProfile.stationCode, "TEST-COMMIT");
assert.equal(committedProfile.stationName, "สถานีที่ยืนยันแล้ว");
assert.equal(committedProfile.equipment[0].assetNo, "LPR-04");
assert.equal(committedProfile.equipment[0].location, "Lane 4");
assert.equal(committedProfile.equipment[0].serialNo, "SN-04");
assert.deepEqual(committedProfile.checklistConfig.disabledTemplateIds, ["lpr-camera-1"]);

const newLane = makeLane(1, { id: "new-lane-1", label: "ช่องทางหลัก" });
const newWimEquipment = [
  ...Array.from({ length: 4 }, (_, index) => makeEquipment("WIM_SENSOR", index + 1, {
    id: `new-sensor-${index + 1}`,
    laneId: newLane.id,
    parentSystemId: "new-wim-sorting-1",
    scope: "High Speed",
    serialNo: `SN-SENSOR-${index + 1}`,
  })),
  ...Array.from({ length: 2 }, (_, index) => makeEquipment("WIM_LOOP", index + 1, {
    id: `new-loop-${index + 1}`,
    laneId: newLane.id,
    parentSystemId: "new-wim-sorting-1",
    scope: "High Speed",
    serialStatus: "not-available",
    serialReason: "ไม่มีป้ายระบุ",
  })),
];
const newStationDraft = {
  ...createStationDraft(),
  stationCode: "TEST-LANE-01",
  stationName: "สถานีทดสอบ Lane + Asset",
  province: "กรุงเทพมหานคร",
  lanes: [newLane],
  stationSystems: [{ id: "new-wim-sorting-1", canonicalItemId: "wim-sorting", systemId: "wim-sorting", quantity: 1, laneId: newLane.id, instanceNo: 1, scope: "High Speed" }],
  equipment: newWimEquipment,
};
assert.equal(validateStationDraft(newStationDraft, []).valid, true, "a new draft accepts Sensor and Loop quantities under a WIM parent");
const newLaneProfile = createStationProfileFromDraft(newStationDraft);
const newLaneRound = createInspectionRound(newLaneProfile);
assert.equal(newLaneRound.templateVersion, LANE_ASSET_EVIDENCE_TEMPLATE_VERSION);
assert.equal(newLaneRound.snapshot.templateVersion, LANE_ASSET_EVIDENCE_TEMPLATE_VERSION);
assert.deepEqual(newLaneRound.snapshot.equipment.map((entry) => ({ id: entry.id, laneId: entry.laneId, serialStatus: entry.serialStatus })), newWimEquipment.map((entry) => ({ id: entry.id, laneId: newLane.id, serialStatus: entry.serialStatus })));
const newLaneWimItems = getItemsForSnapshot(newLaneRound.snapshot).filter((item) => item.sectionCode === "2.1" && item.assetId);
assert.equal(newLaneWimItems.length, 6, "new Lane + Asset mapping creates one checklist item per WIM Asset");
assert.equal(new Set(newLaneWimItems.map((item) => item.assetId)).size, 6);
assert.ok(newLaneWimItems.every((item) => item.laneId === newLane.id && item.laneNo === 1 && item.assetNo));
assert.deepEqual(newLaneProfile.equipment.map((item) => item.assetNo), [
  "SENSOR-HS-01", "SENSOR-HS-02", "SENSOR-HS-03", "SENSOR-HS-04",
  "LOOP-HS-01", "LOOP-HS-02",
]);

const scopedSequenceAssets = [
  { id: "sensor-hs-lane-1", type: "WIM_SENSOR", assetNo: "SENSOR-HS-01", scope: "High Speed", laneId: "hs-lane-1" },
  { id: "sensor-hs-lane-2", type: "WIM_SENSOR", assetNo: "SENSOR-HS-02", scope: "High Speed", laneId: "hs-lane-2" },
  { id: "sensor-ls-lane-1", type: "WIM_SENSOR", assetNo: "SENSOR-LS-01", scope: "Low Speed", laneId: "ls-lane-1" },
];
assert.equal(getNextEquipmentIndex(scopedSequenceAssets, { type: "WIM_SENSOR", scope: "High Speed" }), 3,
  "WIM Asset numbering continues across Lanes within one Scope");
assert.equal(getNextEquipmentIndex(scopedSequenceAssets, { type: "WIM_SENSOR", scope: "Low Speed" }), 2,
  "WIM Asset numbering starts independently in another Scope");
assert.equal(makeEquipment("LPR_CAMERA", 1, { scope: "3D" }).assetNo, "LPR-3D-01");
assert.equal(makeEquipment("IMAGE_PROCESSOR", 1, { scope: "Image Processing" }).assetNo, "IMPS-IP-IMG-01");
assert.equal(makeEquipment("IMAGE_PROCESSOR", 1, { scope: "ImPS" }).assetNo, "IMPS-IP-IMPS-01");
assert.equal(makeEquipment("CONTROL_COMPUTER", 1, { scope: "Central" }).assetNo, "PC-CTR-01");
assert.equal(makeEquipment("VMS_SIGN", 1, { scope: "Station-wide" }).assetNo, "VMS-STN-01");
const changedScopeAssets = synchronizeGeneratedAssetNos([
  makeEquipment("WIM_SENSOR", 1, { id: "generated-sensor", parentSystemId: "scope-parent", scope: "High Speed" }),
  makeEquipment("WIM_SENSOR", 2, { id: "manual-sensor", assetNo: "FIELD-SENSOR-9", assetNoMode: "manual", parentSystemId: "scope-parent", scope: "High Speed" }),
], [{ id: "scope-parent", scope: "Low Speed" }]);
assert.equal(changedScopeAssets[0].assetNo, "SENSOR-LS-01", "generated Asset No. follows its parent System Scope");
assert.equal(changedScopeAssets[1].assetNo, "FIELD-SENSOR-9", "user-defined Asset No. stays unchanged when Scope changes");

const legacyScopedProfile = normalizeStationProfile({
  id: "scope-renumber-test",
  stationSystems: [
    { id: "wim-hs-1", canonicalItemId: "wim-sorting", systemId: "wim-sorting", quantity: 1, laneId: "hs-lane-1", instanceNo: 1, scope: "High Speed" },
    { id: "wim-hs-2", canonicalItemId: "wim-sorting", systemId: "wim-sorting", quantity: 1, laneId: "hs-lane-2", instanceNo: 2, scope: "High Speed" },
    { id: "wim-ls-1", canonicalItemId: "wim-sorting", systemId: "wim-sorting", quantity: 1, laneId: "ls-lane-1", instanceNo: 1, scope: "Low Speed" },
  ],
  lanes: [
    makeLane(1, { id: "hs-lane-1", scope: "High Speed" }),
    makeLane(2, { id: "hs-lane-2", scope: "High Speed" }),
    makeLane(1, { id: "ls-lane-1", scope: "Low Speed" }),
  ],
  equipment: [
    { id: "old-sensor-hs-1", type: "WIM_SENSOR", assetNo: "SENSOR-01", parentSystemId: "wim-hs-1", laneId: "hs-lane-1", scope: "High Speed" },
    { id: "old-sensor-hs-2", type: "WIM_SENSOR", assetNo: "SENSOR-02", parentSystemId: "wim-hs-2", laneId: "hs-lane-2", scope: "High Speed" },
    { id: "old-sensor-ls-1", type: "WIM_SENSOR", assetNo: "SENSOR-09", parentSystemId: "wim-ls-1", laneId: "ls-lane-1", scope: "Low Speed" },
    { id: "old-loop-ls-1", type: "WIM_LOOP", assetNo: "LOOP-05", parentSystemId: "wim-ls-1", laneId: "ls-lane-1", scope: "Low Speed" },
    { id: "old-lpr-hs-1", type: "LPR_CAMERA", assetNo: "LPR-01", scope: "High Speed" },
    { id: "old-lpr-3d-1", type: "LPR_CAMERA", assetNo: "LPR-03", scope: "3D" },
    { id: "old-lpr-ls-1", type: "LPR_CAMERA", assetNo: "LPR-05", scope: "Low Speed" },
    { id: "manual-lpr", type: "LPR_CAMERA", assetNo: "FIELD-CAMERA-A", assetNoMode: "manual", scope: "Low Speed" },
  ],
});
assert.deepEqual(legacyScopedProfile.equipment.map((item) => item.assetNo), [
  "SENSOR-HS-01", "SENSOR-HS-02", "SENSOR-LS-01", "LOOP-LS-01",
  "LPR-HS-01", "LPR-3D-01", "LPR-LS-01", "FIELD-CAMERA-A",
]);
assert.deepEqual(legacyScopedProfile.equipment.map((item) => item.id), [
  "old-sensor-hs-1", "old-sensor-hs-2", "old-sensor-ls-1", "old-loop-ls-1",
  "old-lpr-hs-1", "old-lpr-3d-1", "old-lpr-ls-1", "manual-lpr",
]);
assert.equal(legacyScopedProfile.equipment.find((item) => item.id === "manual-lpr").assetNoMode, "manual");

const lockedLegacySnapshot = {
  id: "scope-migration-locked-snapshot",
  templateVersion: "checklist-master-history-v1",
  stationId: legacyScopedProfile.id,
  stationCode: "TEST-01",
  stationName: "สถานีทดสอบ",
  stationSystems: [],
  equipment: [{ id: "old-sensor-ls-1", type: "WIM_SENSOR", assetNo: "SENSOR-09" }],
  checklistConfig: { disabledTemplateIds: [] },
};
const migratedScopeState = migrateChecklistState({
  version: CURRENT_STATE_VERSION - 1,
  stationProfiles: [legacyScopedProfile],
  inspectionRounds: [{
    id: "scope-migration-closed-round",
    stationId: legacyScopedProfile.id,
    status: "closed",
    closedAt: "2026-09-01T00:00:00.000Z",
    snapshot: lockedLegacySnapshot,
    inspectionItems: {},
  }],
});
assert.equal(migratedScopeState.stationProfiles[0].equipment.find((item) => item.id === "old-sensor-ls-1").assetNo, "SENSOR-LS-01");
assert.deepEqual(migratedScopeState.inspectionRounds[0].snapshot, lockedLegacySnapshot,
  "Scope numbering migration must not change a closed round Snapshot");

const noSerialReasonDraft = { ...newStationDraft, equipment: [{ ...newWimEquipment[0], serialStatus: "not-available", serialReason: "" }] };
assert.equal(validateStationDraft(noSerialReasonDraft, []).valid, true, "ไม่ต้องบังคับกรอกเหตุผลเมื่อไม่มีหรืออ่าน Serial Number ไม่ได้");
const missingSerialValueDraft = { ...newStationDraft, equipment: [{ ...newWimEquipment[0], serialStatus: "present", serialNo: "" }] };
assert.equal(validateStationDraft(missingSerialValueDraft, []).errors.serialById[newWimEquipment[0].id], "เลือกว่ามี Serial Number แต่ยังไม่ได้กรอกค่า");

assert.deepEqual(countByType(emptyProfile.equipment), Object.fromEntries(EQUIPMENT_TYPES.map((type) => [type.value, 0])));

// Model the + and - operations against a new station: one Asset per type,
// deterministic prefix, then remove only one selected type.
let equipment = EQUIPMENT_TYPES.map((type, index) => makeEquipment(type.value, 1, {
  id: `new-${type.value.toLowerCase()}`,
  location: `${type.label} test`,
}));
assert.deepEqual(countByType(equipment), Object.fromEntries(EQUIPMENT_TYPES.map((type) => [type.value, 1])));
equipment.forEach((entry) => {
  const definition = EQUIPMENT_TYPES.find((type) => type.value === entry.type);
  assert.equal(entry.assetNo, `${definition.prefix}-GEN-01`);
  if (expectedAssetMapping[definition.groupCode]) {
    assert.ok(expectedAssetMapping[definition.groupCode].includes(entry.type), `${entry.type} must load its mapped BOQ section`);
    }
});

const registerGroups = getEquipmentGroupsForRegister(equipment);
assert.deepEqual(registerGroups.map((group) => group.code), ["1.1.5", "1.1.12", "2.1", "2.2", "2.3", "3.2", "4.1", "4.2", "5.1", "5.2", "7.1"]);
assert.deepEqual(registerGroups.find((group) => group.code === "3.2").types.map((type) => type.value), ["LPR_CAMERA"]);
assert.deepEqual(registerGroups.find((group) => group.code === "5.2").types.map((type) => type.value), ["IMPS_DISPLAY_PROCESSING"]);
assert.deepEqual(registerGroups.find((group) => group.code === "2.1").types.map((type) => type.value), ["WIM_SENSOR", "WIM_LOOP"]);
assert.deepEqual(registerGroups.find((group) => group.code === "4.1").types.map((type) => type.value), ["FIXED_CAMERA", "PTZ_CAMERA", "JOYSTICK"]);
assert.deepEqual(registerGroups.find((group) => group.code === "7.1").types.map((type) => type.value), ["VMS_SIGN", "VMS_LIGHT_SENSOR", "VMS_DISPLAY"]);

const emptyRegisterGroups = getEquipmentGroupsForRegister([], { includeEmptyGroups: true });
assert.deepEqual(emptyRegisterGroups.map((group) => group.code), ["1.1.5", "1.1.12", "2.1", "2.2", "2.3", "3.2", "4.1", "4.2", "5.1", "5.2", "7.1"]);
assert.ok(emptyRegisterGroups.every((group) => group.types.length > 0 && group.types.every((type) => type.items.length === 0)), "empty register must keep active Asset-capable BOQ groups and subtypes");
assert.deepEqual(getEquipmentGroupsForRegister([]), [], "detail register must hide empty BOQ groups");

const orderedEquipment = [
  makeEquipment("WIM_SENSOR", 2, { id: "ordered-sensor-2" }),
  makeEquipment("WIM_LOOP", 1, { id: "ordered-loop-1" }),
  makeEquipment("WIM_SENSOR", 1, { id: "ordered-sensor-1" }),
  makeEquipment("FIXED_CAMERA", 1, { id: "ordered-fixed-1" }),
  makeEquipment("PTZ_CAMERA", 1, { id: "ordered-ptz-1" }),
];
const orderedGroups = getEquipmentGroupsForRegister(orderedEquipment);
assert.deepEqual(orderedGroups.map((group) => group.code), ["2.1", "4.1"]);
assert.deepEqual(orderedGroups.find((group) => group.code === "2.1").types.find((type) => type.value === "WIM_SENSOR").items.map((item) => item.id), ["ordered-sensor-1", "ordered-sensor-2"], "Asset order within a subtype must use natural Asset No. order");
assert.deepEqual(orderedGroups.find((group) => group.code === "2.1").types.map((type) => type.value), ["WIM_SENSOR", "WIM_LOOP"]);
assert.deepEqual(orderedGroups.find((group) => group.code === "4.1").types.map((type) => type.value), ["FIXED_CAMERA", "PTZ_CAMERA"]);

const partialEquipment = [makeEquipment("WIM_SENSOR", 1, { id: "partial-sensor-1" })];
const partialEquipmentBefore = JSON.stringify(partialEquipment);
const partialGroups = getEquipmentGroupsForRegister(partialEquipment);
assert.deepEqual(partialGroups.map((group) => group.code), ["2.1"]);
assert.deepEqual(partialGroups[0].types[0].items.map((item) => item.id), ["partial-sensor-1"]);
assert.equal(JSON.stringify(partialEquipment), partialEquipmentBefore, "register grouping must not mutate equipment");

const inactiveFixed = makeEquipment("FIXED_CAMERA", 2, { id: "inactive-fixed-2", active: false });
const fixedGroupWithInactive = getEquipmentGroupsForRegister([...equipment, inactiveFixed]).find((group) => group.code === "4.1");
assert.deepEqual(fixedGroupWithInactive.types.find((type) => type.value === "FIXED_CAMERA").items.map((item) => item.id), [
  "new-fixed_camera",
  "inactive-fixed-2",
], "inactive assets must remain under their original subtype");

const beforeMinus = countByType(equipment);
equipment = equipment.filter((entry) => entry.type !== "WIM_SENSOR");
const afterMinus = countByType(equipment);
assert.equal(afterMinus.WIM_SENSOR, 0);
EQUIPMENT_TYPES.filter((type) => type.value !== "WIM_SENSOR").forEach((type) => assert.equal(afterMinus[type.value], beforeMinus[type.value]));

const previewSnapshot = {
  stationFormat: "SC",
  checklistPresentationVersion: BOQ_CHECKLIST_PRESENTATION_VERSION,
  checklistPolicyVersion: CHECKLIST_POLICY_VERSION,
  stationId: emptyProfile.id,
  stationCode: emptyProfile.stationCode,
  stationName: emptyProfile.stationName,
  equipment: emptyProfile.equipment,
  checklistConfig: emptyProfile.checklistConfig,
  templateVersion: MASTER_TEMPLATE_VERSION,
  cleaningPolicyVersion: CLEANING_POLICY_VERSION,
};
const previewItems = getNewRoundChecklistItems(previewSnapshot);
assert.deepEqual(previewItems, [], "an empty Station Profile has no runtime Checklist items");
assert.throws(
  () => createInspectionRound(emptyProfile),
  /ไม่มีรายการตรวจที่เปิดใช้งาน/,
  "an empty Station Profile cannot create a new inspection round",
);

const representativeProfile = {
  ...emptyProfile,
  id: "station-representative-test",
  lanes: [makeLane(1)],
  stationSystems: [
    { id: "representative-wim-sorting", canonicalItemId: "wim-sorting", systemId: "wim", componentId: "sorting", scope: "High Speed", quantity: 1, laneId: "lane-1", instanceNo: 1 },
    { id: "representative-wim-control", canonicalItemId: "wim-control", systemId: "wim", componentId: "control", quantity: 1 },
    { id: "representative-wim-electronics", canonicalItemId: "wim-electronics-system", systemId: "wim", componentId: "electronics", quantity: 1 },
    { id: "representative-lpr", canonicalItemId: "lpr-control", systemId: "lpr", componentId: "control", scope: "High Speed", quantity: 1 },
    { id: "representative-cctv", canonicalItemId: "cctv-system", systemId: "cctv", componentId: "camera", quantity: 1 },
    { id: "representative-data", canonicalItemId: "data-management", systemId: "other", componentId: "database", quantity: 1 },
    { id: "representative-display", canonicalItemId: "station-display", systemId: "other", componentId: "display-processing", quantity: 1 },
    { id: "representative-dimension", canonicalItemId: "dimension-management", systemId: "3d", componentId: "dimension", scope: "3D", quantity: 1 },
    { id: "representative-image", canonicalItemId: "image-processing-management", systemId: "image", componentId: "processing", scope: "Image Processing", quantity: 1 },
    { id: "representative-vms", canonicalItemId: "vms-control", systemId: "vms", componentId: "control", quantity: 1 },
  ],
  equipment: EQUIPMENT_TYPES.map((type, index) => makeEquipment(type.value, 1, {
    id: `representative-${type.value.toLowerCase()}`,
    location: `${type.label} test`,
    ...(type.value === "WIM_SENSOR" || type.value === "WIM_LOOP" ? { parentSystemId: "representative-wim-sorting", laneId: "lane-1" } : {}),
  })),
};
const representativeRound = createInspectionRound(representativeProfile);
const representativeItems = getItemsForSnapshot(representativeRound.snapshot);
const mustBind = [
  ["2.1.sensor", "representative-wim_sensor"],
  ["2.1.loop", "representative-wim_loop"],
  ["2.2.computer", "representative-control_computer"],
  ["2.3.cabinet-overview", "representative-control_cabinet"],
    ["3.1.lane::lane-1::day", null],
  ["3.2.overview", "representative-lpr_camera"],
  ["4.1.overview", "representative-fixed_camera"],
  ["4.2.device", "representative-nvr"],
  ["5.1.device", "representative-database_server"],
  ["7.1.overview", "representative-vms_sign"],
];
mustBind.forEach(([itemId, assetId]) => assert.ok(representativeItems.some((item) => (assetId ? item.id.startsWith(itemId) && item.assetId === assetId : item.id === itemId)), itemId));
assert.equal(representativeItems.find((item) => item.id === "3.1.lane::lane-1::day")?.laneId, "lane-1");
assert.equal(representativeItems.find((item) => item.id === "3.1.lane::lane-1::day")?.assetDependent, false);

const legacySystemProfile = {
  ...emptyProfile,
  id: "station-present-system-migration",
  stationSystems: [{ id: "present-lpr-system", active: false, quantity: 3 }],
};
const migratedPresentState = migrateChecklistState({
  version: CURRENT_STATE_VERSION,
  stationProfiles: [legacySystemProfile],
  inspectionRounds: [],
});
const migratedPresentSystems = migratedPresentState.stationProfiles[0].stationSystems;
assert.equal(migratedPresentSystems.length, 9, "current station profiles must receive the current system rows");
assert.equal(migratedPresentSystems.some((system) => system.id === "present-wim-control"), true, "WIM Control System must be seeded for current profiles");
assert.equal(migratedPresentSystems.some((system) => system.id === "present-wim-electronics"), true, "WIM Electronics System must be seeded for current profiles");
assert.equal(migratedPresentSystems.some((system) => system.id === "present-lpr-system"), false, "legacy LPR Control id must be canonicalized");
assert.equal(migratedPresentSystems.find((system) => system.id === "present-lpr-control")?.active, false, "legacy system state must be preserved");
assert.equal(migratedPresentSystems.find((system) => system.id === "present-lpr-control")?.assetType, null);
assert.equal(migratedPresentSystems.find((system) => system.id === "present-lpr-control")?.assetQuantity, 0);
assert.equal(migratedPresentSystems.some((system) => system.id === "present-other-display"), true);

const historicalSnapshot = {
  id: "snapshot-present-system-locked",
  templateVersion: "checklist-master-history-v1",
  stationId: legacySystemProfile.id,
  stationCode: legacySystemProfile.stationCode,
  stationName: legacySystemProfile.stationName,
  stationSystems: [{ id: "present-lpr-system", displayLabel: "legacy control", quantity: 3 }],
  equipment: [],
  checklistConfig: { disabledTemplateIds: [] },
};
const migratedWithHistory = migrateChecklistState({
  version: CURRENT_STATE_VERSION,
  stationProfiles: [legacySystemProfile],
  inspectionRounds: [{
    id: "round-present-system-locked",
    stationId: legacySystemProfile.id,
    status: "closed",
    closedAt: "2026-09-01T00:00:00.000Z",
    snapshot: historicalSnapshot,
    inspectionItems: {},
  }],
});
assert.deepEqual(migratedWithHistory.inspectionRounds[0].snapshot, historicalSnapshot, "system completeness migration must not rewrite historical Snapshots");

const profileWithInactiveAsset = {
  ...emptyProfile,
  id: "station-active-only-test",
  equipment: [
    makeEquipment("LANE", 1, { id: "active-lane-1" }),
    makeEquipment("LANE", 2, { id: "inactive-lane-2", active: false }),
  ],
};
assert.throws(
  () => createInspectionRound(profileWithInactiveAsset),
  /ไม่มีรายการตรวจที่เปิดใช้งาน/,
  "a station with no active System or physical Asset cannot create a round",
);

const oldRound = createInspectionRound({
  ...emptyProfile,
  id: "station-old-test",
  stationSystems: [{ id: "old-wim-sorting", canonicalItemId: "wim-sorting", systemId: "wim", componentId: "sorting", quantity: 1, laneId: "lane-1", instanceNo: 1 }],
  lanes: [makeLane(1)],
  equipment: [makeEquipment("WIM_SENSOR", 1, { id: "old-sensor-1", location: "old location", parentSystemId: "old-wim-sorting", laneId: "lane-1" })],
  checklistConfig: { disabledTemplateIds: ["sensor-1"] },
});
const newProfileAfterOldRound = {
  ...emptyProfile,
  stationSystems: [{ id: "new-wim-sorting", canonicalItemId: "wim-sorting", systemId: "wim", componentId: "sorting", quantity: 1, laneId: "lane-1", instanceNo: 1 }],
  lanes: [makeLane(1)],
  equipment: [makeEquipment("WIM_LOOP", 1, { id: "new-loop-1", parentSystemId: "new-wim-sorting", laneId: "lane-1" })],
};
const newRound = createInspectionRound(newProfileAfterOldRound);
assert.deepEqual(oldRound.snapshot.equipment.map((entry) => entry.id), ["old-sensor-1"]);
assert.deepEqual(newRound.snapshot.equipment.map((entry) => entry.id), ["new-loop-1"]);
assert.equal(oldRound.snapshot.stationId, "station-old-test");
assert.equal(newRound.snapshot.stationId, emptyProfile.id);
assert.deepEqual(newRound.snapshot.checklistConfig.disabledTemplateIds, [], "new station must not inherit checklist state from the old station");

const migratedState = migrateChecklistState({ stationProfiles: [emptyProfile], inspectionRounds: [] });
assert.equal(migratedState.version, CURRENT_STATE_VERSION, "state migration must initialize the current browser copy model");
assert.equal(migratedState.checklistCopy.sections.length, 13);
assert.equal(migratedState.checklistCopy.sections.flatMap((section) => section.items).length, 170);
assert.equal(migratedState.masterChecklistCopy.sections.length, 13);
assert.equal(migratedState.masterChecklistCopy.sections.flatMap((section) => section.items).length, 44);

console.log("station creation smoke passed", JSON.stringify({
  masterSections: 13,
  masterItems: 44,
  evidenceSlots: 170,
  emptyStation: { activeAssets: 0, applicable: 19, notApplicable: 0 },
  templateVersion: MASTER_TEMPLATE_VERSION,
}));
