import assert from "node:assert/strict";
import { getEquipmentSubcategory, groupEquipmentBySubcategory, UNCLASSIFIED_EQUIPMENT_SUBCATEGORY } from "../src/domain/equipment-subcategories.js";

assert.equal(getEquipmentSubcategory("wim-sorting", "WIM_SENSOR").titleEn, "Sensors");
assert.equal(getEquipmentSubcategory("wim-sorting", "WIM_LOOP").titleEn, "Vehicle Detection Loops");
assert.equal(getEquipmentSubcategory("wim-electronics-system", "WIM_SWITCHING_DC").id, "power-supply");
assert.equal(getEquipmentSubcategory("cctv-system", "NVR").id, "recording-control");
assert.equal(getEquipmentSubcategory("image-processing-management", "FIXED_CAMERA").id, "image-input");
assert.equal(getEquipmentSubcategory("cctv-system", "FIXED_CAMERA").id, "cameras", "one Equipment type can have a different subgroup under another System");
assert.equal(getEquipmentSubcategory("unrecognized-system", "UNKNOWN").id, UNCLASSIFIED_EQUIPMENT_SUBCATEGORY.id);

const equipment = [
  { id: "controller", type: "WIM_CONTROLLER" },
  { id: "cabinet", type: "CONTROL_CABINET" },
  { id: "acdc", type: "WIM_AC_DC_POWER_SUPPLY" },
  { id: "unknown", type: "LEGACY_EQUIPMENT" },
  { id: "network", type: "WIM_NETWORK_EQUIPMENT" },
  { id: "loop", type: "WIM_LOOP" },
  { id: "sensor", type: "WIM_SENSOR" },
];
const groupedWim = groupEquipmentBySubcategory("wim-sorting", equipment.filter((item) => item.type === "WIM_LOOP" || item.type === "WIM_SENSOR"), (item) => item.type);
assert.deepEqual(groupedWim.map(({ subcategory }) => subcategory.id), ["sensors", "vehicle-detection"]);
assert.deepEqual(groupedWim.flatMap(({ items }) => items.map((item) => item.id)), ["sensor", "loop"], "grouping preserves items and applies the agreed within-System order");

const groupedElectronics = groupEquipmentBySubcategory("wim-electronics-system", equipment, (item) => item.type);
assert.deepEqual(groupedElectronics.map(({ subcategory }) => subcategory.id), ["cabinet", "power-supply", "controller", "network", "other"]);
assert.deepEqual(groupedElectronics.flatMap(({ items }) => items.map((item) => item.id)).sort(), equipment.map((item) => item.id).sort(), "unclassified legacy equipment remains visible");

console.log("Equipment subcategory mapping tests passed.");
