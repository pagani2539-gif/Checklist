import assert from "node:assert/strict";
import { getStationWorkpointLayout } from "../src/domain/station-workpoint-layout.js";
import { getEffectiveEquipmentScope, getEquipmentParentChoices } from "../src/domain/station-equipment-parent.js";
import { addStationAssetWithOwner } from "../src/domain/station-asset-add.js";

assert.deepEqual(getStationWorkpointLayout("IMPS").map((point) => point.id), [
  "imps-image-processing", "imps-wim", "imps-lpr", "imps-cctv", "imps-3d", "imps-lpr-3d", "imps-data-control",
], "IMPS LPR for 3D must immediately follow 3D Dimension");

const dependencies = {
  createId: (kind) => `${kind}-new`,
  createSystemRecord: (definition, createId, extra) => ({ id: createId("system"), canonicalItemId: definition.id, ...extra }),
  makeEquipmentFromCatalogItem: (item, index, overrides) => ({ type: item.type, ...overrides }),
  getNextEquipmentIndex: () => 1,
};
const systems = ["a", "b"].map((id) => ({ id, canonicalItemId: "lpr-control", scope: "High Speed", active: true }));
const draft = { stationSystems: systems, equipment: [] };
const request = { catalogItem: { type: "LPR_CAMERA" }, ownerDefinition: { id: "lpr-control" }, scope: "High Speed" };
assert.equal(addStationAssetWithOwner(draft, request, dependencies), draft, "ambiguous owners must require a choice instead of taking the first System");
assert.equal(addStationAssetWithOwner(draft, { ...request, parentSystemId: "deleted" }, dependencies), draft, "an invalid explicit parent must not silently fall back");
const selected = addStationAssetWithOwner(draft, { ...request, parentSystemId: "b" }, dependencies);
assert.equal(selected.equipment[0].parentSystemId, "b");
assert.equal(selected.equipment[0].scope, "High Speed");
assert.equal(draft.equipment.length, 0, "adding a selected relationship must not mutate the input");
console.log("installation point order and explicit equipment ownership passed");

const electronics = { stationSystems: [
  { id: 'hs-electronics', canonicalItemId: 'wim-electronics-system', scope: 'High Speed' },
  { id: 'ls-electronics', canonicalItemId: 'wim-electronics-system', scope: 'Low Speed' },
], equipment: [
  { id: 'cabinet-hs-a', type: 'CONTROL_CABINET', parentSystemId: 'hs-electronics', scope: 'Low Speed' },
  { id: 'cabinet-hs-b', type: 'CONTROL_CABINET', parentSystemId: 'hs-electronics' },
  { id: 'cabinet-ls', type: 'CONTROL_CABINET', parentSystemId: 'ls-electronics' },
  { id: 'cabinet-orphan', type: 'CONTROL_CABINET', scope: 'High Speed' },
] };
const childRequest = { type: 'WIM_SWITCHING_DC', systemIds: ['wim-electronics-system'], scope: 'High Speed', parentId: 'hs-electronics' };
assert.deepEqual(getEquipmentParentChoices(electronics, childRequest).map(choice => choice.id), ['cabinet-hs-a', 'cabinet-hs-b']);
assert.deepEqual(getEquipmentParentChoices(electronics, { ...childRequest, parentAssetId: 'cabinet-ls' }), []);
assert.equal(getEquipmentParentChoices(electronics, { ...childRequest, parentAssetId: 'cabinet-hs-b' })[0].system.id, 'hs-electronics');
assert.equal(getEffectiveEquipmentScope(electronics.equipment[0], electronics.equipment, electronics.stationSystems), 'High Speed');
assert.equal(getEffectiveEquipmentScope({ id: 'child', parentAssetId: 'cabinet-hs-b', scope: 'Low Speed' }, electronics.equipment, electronics.stationSystems), 'High Speed');
assert.equal(getEffectiveEquipmentScope({ id: 'old', scope: 'Low Speed' }, electronics.equipment, electronics.stationSystems), 'Low Speed');
console.log('Cabinet choices and inherited System scope passed');

assert.equal(addStationAssetWithOwner(draft, { ...request, scope: "Low Speed", parentSystemId: "b" }, dependencies).equipment[0].scope, "High Speed", "explicit parent determines scope");
