import assert from "node:assert/strict";
import {
  createSnapshot,
  createStationDraft,
  createStationProfileFromDraft,
  getStationReadiness,
  makeEquipment,
  makeLane,
  normalizeSnapshot,
  validateStationDraft,
} from "../src/domain/master-checklist.js";
import { getCanonicalItemsForFormat } from "../src/domain/canonical-station-catalog.js";

for (const format of ["SC", "IMPS"]) {
  const draft = createStationDraft(format);
  assert.equal(draft.stationFormat, format);
  assert.deepEqual(draft.equipment, [], `${format} starts with zero Assets`);
  assert.deepEqual(draft.stationSystems, [], `${format} starts with zero Systems`);
  assert.deepEqual(draft.lanes, [], `${format} starts with zero Lanes`);
  assert.equal(Object.hasOwn(draft, "torItems"), false, "new Draft must not own TOR data");
  assert.equal(draft.direction, "unspecified");
}

const incomplete = validateStationDraft(createStationDraft("SC"), []);
assert.equal(incomplete.valid, false);
assert.ok(incomplete.errors.stationCode);
assert.ok(incomplete.errors.stationName);
assert.ok(incomplete.errors.province);

const validDraft = {
  ...createStationDraft("SC"),
  stationCode: "SC-001",
  stationName: "สถานีทดสอบ",
  province: "ระนอง",
  direction: "both",
};
assert.equal(validateStationDraft(validDraft, []).valid, true, "an empty identity-only Station Profile can be created");
assert.ok(validateStationDraft(validDraft, [{ stationCode: "sc-001" }]).errors.stationCode, "station code is unique case-insensitively");

const profile = createStationProfileFromDraft(validDraft);
assert.equal(profile.province, "ระนอง");
assert.equal(profile.direction, "both");
assert.equal(getStationReadiness(profile).ready, false);
assert.ok(getStationReadiness(profile).blockers.some((item) => item.code === "EMPTY_REGISTER"));
const snapshot = createSnapshot(profile);
assert.equal(Object.hasOwn(snapshot, "torItems"), false, "new Snapshot must not contain station TOR data");

const legacyTorItems = [{ id: "legacy-tor-row", quantity: 2, unit: "ชุด" }];
const normalizedLegacy = normalizeSnapshot({ ...snapshot, id: "legacy", torItems: legacyTorItems }, profile);
assert.deepEqual(normalizedLegacy.torItems, legacyTorItems, "legacy Snapshot TOR data remains byte-for-byte compatible");

const lane = makeLane(1, { id: "lane-1" });
const wim = makeEquipment("WIM_SENSOR", 1, { id: "sensor-1", assetNo: "WIM-001", laneId: null, location: "" });
const missingLane = getStationReadiness({ ...profile, lanes: [lane], equipment: [wim] });
assert.ok(missingLane.blockers.some((item) => item.code === "WIM_PARENT_SYSTEM_REQUIRED"));
assert.ok(missingLane.warnings.some((item) => item.code === "ASSET_DETAILS_INCOMPLETE"));
assert.deepEqual(missingLane.warnings.find((item) => item.assetId === wim.id)?.missingFields, ["ตำแหน่งติดตั้ง", "สถานะ Serial"], "readiness warnings identify each field that needs attention");
const ready = getStationReadiness({ ...profile, lanes: [lane], stationSystems: [{ id: "wim-sorting-1", canonicalItemId: "wim-sorting", systemId: "wim-sorting", quantity: 1, laneId: lane.id, instanceNo: 1 }], equipment: [{ ...wim, parentSystemId: "wim-sorting-1", laneId: lane.id }] });
assert.equal(ready.ready, true);

const electronicsSystem = { id: "wim-electronics-1", canonicalItemId: "wim-electronics-system", systemId: "wim-electronics-system", quantity: 1, checklistMapping: ["2.3"], scope: "High Speed" };
const electronicsCabinet = makeEquipment("CONTROL_CABINET", 1, { id: "electronics-cabinet-1", assetNo: "CAB-01", scope: "High Speed" });
const unlinkedElectronicsAsset = makeEquipment("WIM_AC_DC_POWER_SUPPLY", 1, { id: "electronics-acdc-1", assetNo: "ACDC-01", scope: "High Speed" });
const missingCabinetParent = getStationReadiness({ ...profile, stationSystems: [electronicsSystem], equipment: [electronicsCabinet, unlinkedElectronicsAsset] });
assert.ok(missingCabinetParent.blockers.some((item) => item.code === "WIM_ELECTRONICS_PARENT_CABINET_REQUIRED" && item.assetId === unlinkedElectronicsAsset.id), "WIM Electronics child without a real Cabinet parent must block incomplete Checklist creation");
const missingElectronicsSystem = getStationReadiness({ ...profile, stationSystems: [], equipment: [electronicsCabinet, { ...unlinkedElectronicsAsset, parentAssetId: electronicsCabinet.id }] });
assert.ok(missingElectronicsSystem.blockers.some((item) => item.code === "WIM_ELECTRONICS_SYSTEM_REQUIRED"), "Cabinet and children must belong to an active WIM Electronics System");

const switchingCabinet = makeEquipment("CONTROL_CABINET", 1, { id: "switching-cabinet-1", assetNo: "CAB-DC-01", scope: "High Speed" });
const switchingDc = makeEquipment("WIM_SWITCHING_DC", 1, { id: "switching-dc-1", assetNo: "SWDC-01", serialStatus: "unknown", scope: "High Speed", parentAssetId: switchingCabinet.id });
const switchingDraft = {
  ...validDraft,
  stationCode: "SC-SWITCHING-DC",
  stationSystems: [electronicsSystem],
  equipment: [switchingCabinet, switchingDc],
};
assert.equal(validateStationDraft(switchingDraft, []).valid, true, "Switching DC output selection is a readiness rule, not identity validation");
const switchingNotReady = getStationReadiness(switchingDraft);
assert.equal(switchingNotReady.ready, false);
assert.ok(switchingNotReady.blockers.some((item) => item.code === "WIM_SWITCHING_DC_OUTPUT_REQUIRED"), "Switching DC without an output must expose a specific blocker");
const switchingReady = getStationReadiness({ ...switchingDraft, equipment: [switchingCabinet, { ...switchingDc, outputVoltages: [12] }] });
assert.equal(switchingReady.ready, true, "selecting one installed Switching DC output must clear the blocker");

const systemOnlyProfile = createStationProfileFromDraft({ ...validDraft, stationCode: "SC-SYSTEM", stationSystems: [{ id: "system-1", canonicalItemId: "wim-control", systemId: "wim-control", displayLabel: "ระบบควบคุม WIM", quantity: 1, unit: "ระบบ", checklistMapping: ["2.1"], scope: "High Speed" }] });
assert.equal(systemOnlyProfile.stationSystems.length, 1, "canonical Systems must not cause legacy Present MA seeds to be restored");
assert.equal(getStationReadiness(systemOnlyProfile).ready, true, "a mapped System-only station can be ready");

const scItems = getCanonicalItemsForFormat("SC");
const impsItems = getCanonicalItemsForFormat("IMPS");
assert.ok(scItems.length > impsItems.length, "SC exposes the broader catalog");
assert.ok(scItems.some((item) => item.category === "VMS"));
assert.equal(impsItems.some((item) => item.category === "VMS"), false);
assert.ok(scItems.every((item) => ["asset", "system"].includes(item.kind)));
assert.equal(new Set(scItems.map((item) => item.id)).size, scItems.length);
assert.ok(scItems.every((item) => item.nameTh && item.nameEn && item.defaultUnit && item.checklistMapping.length));

console.log("station profile setup tests passed");
