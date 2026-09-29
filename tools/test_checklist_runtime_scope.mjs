import assert from "node:assert/strict";
import {
  createInspectionRound,
  createSnapshot,
  getChecklistScopeState,
  getItemsForSnapshot,
  getNewRoundChecklistItems,
  makeEquipment,
} from "../src/domain/master-checklist.js";

const baseProfile = {
  id: "runtime-scope-test",
  stationFormat: "SC",
  stationCode: "SCOPE-01",
  stationName: "สถานีทดสอบขอบเขต Checklist",
  stationSystems: [],
  lanes: [],
  equipment: [],
  checklistConfig: { disabledTemplateIds: [] },
};

const emptyScope = getChecklistScopeState(baseProfile);
assert.equal(emptyScope.hasScope, false);
assert.deepEqual(getNewRoundChecklistItems(baseProfile), []);
assert.throws(() => createInspectionRound(baseProfile), /ไม่มีรายการตรวจที่เปิดใช้งาน/);
const assetOnlyProfile = {
  ...baseProfile,
  equipment: [makeEquipment("LPR_CAMERA", 1, { id: "scope-orphan-camera", scope: "Low Speed" })],
};
assert.equal(getChecklistScopeState(assetOnlyProfile).hasScope, false, "an Asset without an owner System has no runtime scope");
assert.deepEqual(getNewRoundChecklistItems(assetOnlyProfile), []);
assert.throws(() => createInspectionRound(assetOnlyProfile), /ไม่มีรายการตรวจที่เปิดใช้งาน/);

const lprSystem = {
  id: "scope-lpr-low",
  canonicalItemId: "lpr-control",
  systemId: "lpr",
  componentId: "control",
  scope: "Low Speed",
  quantity: 1,
  active: true,
};
const systemOnlyProfile = { ...baseProfile, stationSystems: [lprSystem] };
const systemOnlyItems = getNewRoundChecklistItems(createSnapshot(systemOnlyProfile));
assert.ok(systemOnlyItems.some((item) => item.sectionCode === "1.1"));
assert.ok(systemOnlyItems.some((item) => item.sectionCode === "5.1"));
assert.ok(systemOnlyItems.some((item) => item.sectionCode === "6.1"));
assert.ok(systemOnlyItems.some((item) => item.systemRecordId === lprSystem.id));
assert.equal(systemOnlyItems.some((item) => item.assetId), false, "System-only scope must not invent Asset rows");

const lowCamera = makeEquipment("LPR_CAMERA", 1, { id: "scope-lpr-low-camera", scope: "Low Speed" });
const highCamera = makeEquipment("LPR_CAMERA", 2, { id: "scope-lpr-high-camera", scope: "High Speed" });
const disabledCamera = makeEquipment("LPR_CAMERA", 3, { id: "scope-lpr-disabled-camera", scope: "Low Speed", active: false });
const relatedProfile = { ...systemOnlyProfile, equipment: [lowCamera, highCamera, disabledCamera] };
const relatedItems = getNewRoundChecklistItems(createSnapshot(relatedProfile));
assert.ok(relatedItems.some((item) => item.assetId === lowCamera.id));
assert.equal(relatedItems.some((item) => item.assetId === highCamera.id), false, "High Speed Asset must not enter Low Speed scope");
assert.equal(relatedItems.some((item) => item.assetId === disabledCamera.id), false, "disabled Asset must not enter a new round");
assert.ok(relatedItems.some((item) => item.systemRecordId === lprSystem.id), "System and Asset rows remain separate");

const electronicsOnlyProfile = {
  ...baseProfile,
  stationSystems: [{ id: "scope-electronics-system", canonicalItemId: "wim-electronics-system", quantity: 1, active: true }],
  equipment: [makeEquipment("WIM_CONTROLLER", 1, { id: "scope-orphan-controller" })],
};
assert.equal(
  getNewRoundChecklistItems(createSnapshot(electronicsOnlyProfile)).some((item) => item.assetId === "scope-orphan-controller"),
  false,
  "WIM Electronics sub-equipment without a Cabinet parent must stay out of the runtime Checklist",
);

const vmsProfile = {
  ...baseProfile,
  stationSystems: [
    { id: "scope-vms-high", canonicalItemId: "vms-control", scope: "High Speed", quantity: 1, active: true },
    { id: "scope-vms-low", canonicalItemId: "vms-control", scope: "Low Speed", quantity: 1, active: true },
  ],
  equipment: [
    makeEquipment("VMS_SIGN", 1, { id: "scope-vms-high-sign", scope: "High Speed" }),
    makeEquipment("VMS_SIGN", 2, { id: "scope-vms-low-sign", scope: "Low Speed" }),
  ],
};
const vmsItems = getNewRoundChecklistItems(createSnapshot(vmsProfile));
assert.ok(vmsItems.some((item) => item.assetId === "scope-vms-high-sign"));
assert.ok(vmsItems.some((item) => item.assetId === "scope-vms-low-sign"));
assert.equal(vmsItems.filter((item) => item.systemRecordId).length, 2, "VMS System rows preserve High/Low separation");

const wimProfile = {
  ...baseProfile,
  stationSystems: [
    { id: "scope-wim-high", canonicalItemId: "wim-sorting", scope: "High Speed", laneId: "lane-high", quantity: 1, active: true },
    { id: "scope-wim-low", canonicalItemId: "wim-sorting", scope: "Low Speed", laneId: "lane-low", quantity: 1, active: true },
  ],
  lanes: [{ id: "lane-high", laneNo: 1, active: true }, { id: "lane-low", laneNo: 2, active: true }],
  equipment: [
    makeEquipment("WIM_SENSOR", 1, { id: "scope-wim-high-sensor", parentSystemId: "scope-wim-high", laneId: "lane-high" }),
    makeEquipment("WIM_LOOP", 1, { id: "scope-wim-low-loop", parentSystemId: "scope-wim-low", laneId: "lane-low" }),
    makeEquipment("WIM_SENSOR", 2, { id: "scope-wim-orphan-sensor", laneId: "lane-high" }),
  ],
};
const wimItems = getNewRoundChecklistItems(createSnapshot(wimProfile));
assert.ok(wimItems.some((item) => item.assetId === "scope-wim-high-sensor"));
assert.ok(wimItems.some((item) => item.assetId === "scope-wim-low-loop"));
assert.equal(wimItems.some((item) => item.assetId === "scope-wim-orphan-sensor"), false);

const wimLaneChecks = wimItems.filter((item) => item.sectionCode === "3.1" && item.laneId);
assert.equal(wimLaneChecks.length, 0, "LPR lane checks must not appear when no LPR System is installed");
assert.ok(wimItems.some((item) => item.sectionCode === "6.1" && !item.assetId && !item.systemRecordId),
  "intentional station-level 6.1 checks stay available without a matching System or Asset");

const highLprProfile = {
  ...wimProfile,
  stationSystems: [...wimProfile.stationSystems, {
    id: "scope-lpr-high",
    canonicalItemId: "lpr-control",
    scope: "High Speed",
    quantity: 1,
    active: true,
  }],
};
const highLprLaneChecks = getNewRoundChecklistItems(createSnapshot(highLprProfile))
  .filter((item) => item.sectionCode === "3.1" && item.laneId);
assert.equal(highLprLaneChecks.length, 2, "one installed High Speed LPR System generates two checks per High Speed lane");
assert.deepEqual(new Set(highLprLaneChecks.map((item) => item.laneId)), new Set(["lane-high"]),
  "LPR lane checks stay inside the installed System scope");

const inactiveLprProfile = {
  ...highLprProfile,
  stationSystems: highLprProfile.stationSystems.map((system) => system.id === "scope-lpr-high"
    ? { ...system, active: false }
    : system),
};
assert.equal(getNewRoundChecklistItems(createSnapshot(inactiveLprProfile))
  .filter((item) => item.sectionCode === "3.1" && item.laneId).length, 0,
"inactive LPR Systems do not generate new lane checks");
const zeroQuantityLprProfile = {
  ...highLprProfile,
  stationSystems: highLprProfile.stationSystems.map((system) => system.id === "scope-lpr-high"
    ? { ...system, quantity: 0 }
    : system),
};
assert.equal(getNewRoundChecklistItems(createSnapshot(zeroQuantityLprProfile))
  .filter((item) => item.sectionCode === "3.1" && item.laneId).length, 0,
"a zero-quantity LPR System does not generate new lane checks");

const v7Snapshot = { ...createSnapshot(wimProfile), checklistPolicyVersion: "station-item-controls-v7" };
assert.equal(getItemsForSnapshot(v7Snapshot).filter((item) => item.sectionCode === "3.1" && item.laneId).length, 4,
  "v7 Snapshot lane checks keep their historical shape after the current policy changes");

const historicalRound = createInspectionRound({
  ...baseProfile,
  stationSystems: [{ id: "scope-wim-control-history", canonicalItemId: "wim-control", quantity: 1, active: true }],
});
const historicalSnapshot = { ...historicalRound.snapshot, checklistPolicyVersion: "station-item-controls-v3" };
const historicalItems = getItemsForSnapshot(historicalSnapshot);
assert.equal(historicalItems.some((item) => item.systemRecordId === lprSystem.id), false, "historical v3 Snapshot shape stays frozen");

console.log("runtime checklist scope passed", JSON.stringify({
  systemOnlyItems: systemOnlyItems.length,
  relatedAssetItems: relatedItems.filter((item) => item.assetId).length,
  vmsAssetItems: vmsItems.filter((item) => item.assetId).length,
  wimAssetItems: wimItems.filter((item) => item.assetId).length,
}));
