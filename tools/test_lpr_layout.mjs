import assert from "node:assert/strict";
import {
  createDefaultStationEquipment,
  createDefaultStationProfile,
  createPresentStationSeed,
} from "../src/domain/master-checklist.js";
import { getCanonicalItemsForFormat } from "../src/domain/canonical-station-catalog.js";
import { getChecklistScopeState, getNewRoundChecklistItems } from "../src/domain/evidence-checklist.js";

for (const format of ["SC", "IMPS"]) {
  const items = getCanonicalItemsForFormat(format);
  assert.ok(items.some((item) => item.id === "lpr-control" && item.kind === "system"), `${format} exposes LPR System`);
  assert.ok(items.some((item) => item.id === "lpr-camera" && item.kind === "asset"), `${format} exposes LPR Camera`);
  assert.equal(items.some((item) => item.id === "lpr-control-system"), false, `${format} hides retired LPR control Asset`);
  assert.equal(createDefaultStationEquipment(format).some((item) => item.type === "LPR_CONTROL_SYSTEM"), false, `${format} does not seed retired LPR control Asset`);
  assert.equal(createPresentStationSeed(format).equipment.some((item) => item.type === "LPR_CONTROL_SYSTEM"), false, `${format} present seed does not create retired LPR control Asset`);
}

const profile = createDefaultStationProfile();
const newRoundItems = getNewRoundChecklistItems({
  ...profile,
  checklistPolicyVersion: "station-item-controls-v5",
  checklistPresentationVersion: "boq-system-groups-v2",
});

assert.ok(newRoundItems.some((item) => item.systemRecordId && item.label.startsWith("ตรวจการทำงานของ License Plate Recognition Control System")), "new rounds keep the LPR System row with the current English-first equipment name");
assert.ok(newRoundItems.some((item) => item.assetId && String(item.assetName || "").startsWith("LPR Camera")), "new rounds keep LPR Camera Asset rows");
assert.equal(newRoundItems.some((item) => item.assetName === "LPR Control System Equipment"), false, "new rounds do not create retired LPR control Asset rows");

const perLaneSystems = [1, 2].map((laneNo) => ({
  id: `lpr-system-lane-${laneNo}`,
  canonicalItemId: "lpr-control",
  scope: laneNo === 1 ? "High Speed" : "Low Speed",
  laneId: `lane-${laneNo}`,
  quantity: 1,
  active: true,
}));
const perLaneProfile = {
  ...profile,
  lanes: [
    { id: "lane-1", laneNo: 1, scope: "High Speed", active: true },
    { id: "lane-2", laneNo: 2, scope: "Low Speed", active: true },
  ],
  stationSystems: perLaneSystems,
  equipment: profile.equipment.filter((asset) => asset.type !== "LPR_CAMERA").concat([
    { ...profile.equipment.find((asset) => asset.type === "LPR_CAMERA"), id: "lpr-high", scope: "High Speed", laneId: "lane-1", parentSystemId: "lpr-system-lane-1" },
    { ...profile.equipment.find((asset) => asset.type === "LPR_CAMERA"), id: "lpr-low", scope: "Low Speed", laneId: "lane-2", parentSystemId: "lpr-system-lane-2" },
  ]),
};
assert.deepEqual(getChecklistScopeState(perLaneProfile).activeAssets.map((asset) => asset.id), ["lpr-high", "lpr-low"], "each Lane-bound LPR System owns its camera");
const perLaneItems = getNewRoundChecklistItems(perLaneProfile);
assert.ok(perLaneItems.some((item) => item.assetId === "lpr-high"));
assert.ok(perLaneItems.some((item) => item.assetId === "lpr-low"));
assert.deepEqual(perLaneItems.filter((item) => item.sectionCode === "3.1" && Number.isInteger(item.laneNo)).map((item) => item.laneNo), [1, 1, 2, 2], "3.1 rows follow the two saved LPR Lane relationships");

console.log("lpr layout tests passed");
