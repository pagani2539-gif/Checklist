import assert from "node:assert/strict";
import {
  createDefaultStationProfile,
  createSnapshot,
  getItemsForSnapshot,
  makeEquipment,
  makeLane,
} from "../src/domain/master-checklist.js";
import { sortEquipmentForDisplay, sortWimEquipment } from "../src/domain/ordering.js";

const lanes = [makeLane(1, { id: "lane-1" }), makeLane(2, { id: "lane-2" })];
const equipment = [
  makeEquipment("WIM_LOOP", 3, { id: "loop-3", assetNo: "LOOP-03", laneId: "lane-2", parentSystemId: "wim-sorting-2" }),
  makeEquipment("WIM_SENSOR", 10, { id: "sensor-10", assetNo: "SENSOR-10", laneId: "lane-1", parentSystemId: "wim-sorting-1" }),
  makeEquipment("WIM_SENSOR", 2, { id: "sensor-2", assetNo: "SENSOR-02", laneId: "lane-1", parentSystemId: "wim-sorting-1" }),
  makeEquipment("WIM_LOOP", 1, { id: "loop-1", assetNo: "LOOP-01", laneId: "lane-1", parentSystemId: "wim-sorting-1" }),
  makeEquipment("WIM_SENSOR", 3, { id: "sensor-3", assetNo: "SENSOR-03" }),
];
const originalIds = equipment.map((item) => item.id);

assert.deepEqual(
  sortWimEquipment(equipment, lanes).map((item) => item.id),
  ["sensor-2", "sensor-10", "loop-1", "loop-3", "sensor-3"],
  "WIM items must use Lane → Sensor → Loop → natural Asset No. order",
);
assert.deepEqual(equipment.map((item) => item.id), originalIds, "sorting must not mutate the source array");

const mixedEquipment = [
  makeEquipment("LPR_CAMERA", 2, { id: "lpr-2", assetNo: "LPR-02" }),
  ...equipment,
  makeEquipment("CONTROL_COMPUTER", 1, { id: "pc-1", assetNo: "PC-01" }),
];
assert.deepEqual(
  sortEquipmentForDisplay(mixedEquipment, lanes).map((item) => item.id),
  ["sensor-2", "sensor-10", "loop-1", "loop-3", "sensor-3", "pc-1", "lpr-2"],
  "mixed equipment must keep BOQ order while using the WIM comparator",
);

const hierarchicalEquipment = [
  makeEquipment("DATABASE_SERVER", 1, { id: "db-1", assetNo: "DB-01" }),
  makeEquipment("CABINET", 1, { id: "cab-1", assetNo: "CAB-01" }),
  makeEquipment("LASER_SCANNER", 1, { id: "scanner-1", assetNo: "3D-LS-01" }),
  makeEquipment("WIM_SENSOR", 1, { id: "sensor-hierarchy-1", assetNo: "SENSOR-01" }),
];
assert.deepEqual(
  sortEquipmentForDisplay(hierarchicalEquipment, []).map((item) => item.id),
  ["scanner-1", "cab-1", "sensor-hierarchy-1", "db-1"],
  "hierarchical station TOR categories must sort before Checklist 2.x categories",
);

const profile = {
  ...createDefaultStationProfile(),
  id: "ordering-test-station",
  lanes,
  stationSystems: [
    { id: "wim-sorting-1", canonicalItemId: "wim-sorting", systemId: "wim-sorting", quantity: 1, laneId: "lane-1", instanceNo: 1 },
    { id: "wim-sorting-2", canonicalItemId: "wim-sorting", systemId: "wim-sorting", quantity: 1, laneId: "lane-2", instanceNo: 2 },
  ],
  equipment: [equipment[0], equipment[1], equipment[2], equipment[3]],
};
const profileOrderBeforeSnapshot = profile.equipment.map((item) => item.id);
const snapshot = createSnapshot(profile);
assert.deepEqual(snapshot.equipment.map((item) => item.id), ["sensor-2", "sensor-10", "loop-1", "loop-3"]);
assert.deepEqual(profile.equipment.map((item) => item.id), profileOrderBeforeSnapshot, "createSnapshot must not reorder the profile");

const snapshotWimItems = getItemsForSnapshot(snapshot)
  .filter((item) => ["sensor-2", "sensor-10", "loop-1", "loop-3"].includes(item.assetId))
  .map((item) => item.assetId);
assert.deepEqual(snapshotWimItems, ["sensor-2", "sensor-10", "loop-1", "loop-3"], "new Checklist items must follow Snapshot equipment order");

const historicSnapshot = {
  ...snapshot,
  orderingVersion: null,
  equipment: [...snapshot.equipment].reverse(),
};
const historicWimItems = getItemsForSnapshot(historicSnapshot)
  .filter((item) => ["sensor-2", "sensor-10", "loop-1", "loop-3"].includes(item.assetId))
  .map((item) => item.assetId);
assert.deepEqual(historicWimItems, ["loop-3", "loop-1", "sensor-10", "sensor-2"], "historic Snapshots without the ordering marker must retain their stored order");

console.log("ordering passed", JSON.stringify({
  wimOrder: sortWimEquipment(equipment, lanes).map((item) => item.assetNo),
  snapshotOrder: snapshot.equipment.map((item) => item.assetNo),
}));
