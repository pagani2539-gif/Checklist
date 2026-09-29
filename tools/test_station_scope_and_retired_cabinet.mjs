import assert from "node:assert/strict";
import {
  createDefaultStationProfile,
  createSnapshot,
  getActivePhysicalEquipment,
  getEquipmentGroupsForRegister,
  getItemsForSnapshot,
  makeEquipment,
} from "../src/domain/master-checklist.js";
import { getCanonicalItemsForFormat } from "../src/domain/canonical-station-catalog.js";
import { getEvidenceItemsForSnapshot, HISTORICAL_CHECKLIST_POLICY_VERSION } from "../src/domain/evidence-checklist.js";

const genericCabinet = makeEquipment("CABINET", 1, { id: "legacy-generic-cabinet", assetNo: "CAB-GENERAL-01" });
const wimElectronicsCabinet = makeEquipment("CONTROL_CABINET", 1, { id: "wim-electronics-cabinet", assetNo: "CAB-WIM-01" });

assert.deepEqual(
  getCanonicalItemsForFormat("SC").filter((item) => item.equipmentType === "CABINET"),
  [],
  "generic Station Infrastructure Cabinet must not be offered for new stations",
);
assert.deepEqual(
  getActivePhysicalEquipment([genericCabinet, wimElectronicsCabinet]).map((asset) => asset.type),
  ["CONTROL_CABINET"],
  "generic Cabinet is hidden in current equipment and Checklist scope while WIM Electronics Cabinet remains active",
);
assert.equal(
  getEquipmentGroupsForRegister([genericCabinet], { includeEmptyGroups: true }).some((group) => group.code === "1.1.11"),
  false,
  "generic Cabinet must not keep Station Infrastructure visible in the current register",
);

const profile = {
  ...createDefaultStationProfile(),
  id: "station-retired-cabinet-test",
  equipment: [genericCabinet, wimElectronicsCabinet],
};
const snapshot = createSnapshot(profile);
assert.deepEqual(snapshot.equipment.map((asset) => asset.type), ["CONTROL_CABINET"]);
assert.equal(profile.equipment.some((asset) => asset.type === "CABINET"), true, "legacy Station Profile data is retained");
const newRoundItems = getItemsForSnapshot(snapshot);
assert.equal(newRoundItems.some((item) => item.assetId === genericCabinet.id), false, "a new Snapshot must not produce Checklist items for generic Cabinet");
assert.equal(newRoundItems.some((item) => item.assetId === wimElectronicsCabinet.id), true, "WIM Electronics Cabinet keeps its new-round Checklist items");
const oldSnapshot = {
  ...profile,
  checklistPolicyVersion: HISTORICAL_CHECKLIST_POLICY_VERSION,
  equipment: [genericCabinet],
};
assert.equal(
  getEvidenceItemsForSnapshot(oldSnapshot).some((item) => item.assetId === genericCabinet.id),
  true,
  "a stored historical Snapshot can still render the old generic Cabinet checks",
);

console.log("PASS: generic Cabinet is hidden from current catalogs/register/Snapshots while WIM Electronics Cabinet remains.");
