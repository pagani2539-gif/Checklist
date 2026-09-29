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

assert.ok(newRoundItems.some((item) => item.systemRecordId && item.label.startsWith("License Plate Recognition Control System")), "new rounds keep the LPR System row");
assert.ok(newRoundItems.some((item) => item.assetId && String(item.assetName || "").startsWith("LPR Camera")), "new rounds keep LPR Camera Asset rows");
assert.equal(newRoundItems.some((item) => item.assetName === "LPR Control System Equipment"), false, "new rounds do not create retired LPR control Asset rows");

const oneSystemAllScopes = {
  ...profile,
  stationSystems: [{ id: "lpr-station-wide", canonicalItemId: "lpr-control", scope: "Station-wide", quantity: 1, active: true }],
  equipment: [
    { ...profile.equipment.find((asset) => asset.type === "LPR_CAMERA"), id: "lpr-high", scope: "High Speed" },
    { ...profile.equipment.find((asset) => asset.type === "LPR_CAMERA"), id: "lpr-low", scope: "Low Speed" },
  ],
};
assert.deepEqual(getChecklistScopeState(oneSystemAllScopes).activeAssets.map((asset) => asset.id), ["lpr-high", "lpr-low"], "one Station-wide LPR System owns cameras in every installed scope");
assert.ok(getNewRoundChecklistItems(oneSystemAllScopes).some((item) => item.assetId === "lpr-high"));
assert.ok(getNewRoundChecklistItems(oneSystemAllScopes).some((item) => item.assetId === "lpr-low"));

console.log("lpr layout tests passed");
