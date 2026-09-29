import assert from "node:assert/strict";
import {
  createInspectionRound,
  createDefaultStationProfile,
  createSystemItemCatalog,
  getEquipmentGroupsForRegister,
  getItemsForSnapshot,
  getStationReadiness,
  makeEquipment,
  makeEquipmentFromCatalogItem,
} from "../src/domain/master-checklist.js";
import { WIM_ELECTRONICS_OUTPUT_VOLTAGES } from "../src/domain/wim-electronics.js";
import { getEvidenceItemsForSnapshot, PREVIOUS_CURRENT_CHECKLIST_POLICY_VERSION } from "../src/domain/evidence-checklist.js";

const cabinet = makeEquipment("CONTROL_CABINET", 1, {
  id: "wim-cabinet-01",
  assetNo: "CAB-01",
  location: "ห้องควบคุม",
});
const switchingDc = makeEquipment("WIM_SWITCHING_DC", 1, {
  id: "wim-switching-dc-01",
  assetNo: "SWDC-01",
  location: "ตู้ CAB-01",
  parentAssetId: cabinet.id,
  outputVoltages: [48, 12],
});
const controller = makeEquipment("WIM_CONTROLLER", 1, {
  id: "wim-controller-01",
  assetNo: "WIMCTRL-01",
  location: "ตู้ CAB-01",
  parentAssetId: cabinet.id,
});
const transformer = makeEquipment("WIM_TRANSFORMER_24VAC", 1, {
  id: "wim-transformer-01",
  assetNo: "TR24-01",
  location: "ตู้ CAB-01",
  parentAssetId: cabinet.id,
});

const profile = {
  id: "wim-electronics-test-station",
  stationFormat: "SC",
  stationCode: "WIM-EL-01",
  stationName: "สถานีทดสอบ WIM Electronics",
  province: "นครปฐม",
  equipment: [cabinet, switchingDc, controller, transformer],
  stationSystems: [{
    id: "wim-electronics-system-01",
    canonicalItemId: "wim-electronics-system",
    systemId: "wim",
    componentId: "electronics",
    quantity: 1,
    active: true,
  }],
  lanes: [],
  checklistConfig: { disabledTemplateIds: [] },
};
const round = createInspectionRound(profile);
const items = getItemsForSnapshot(round.snapshot);
const electronicsItems = items.filter((item) => item.sectionCode === "2.3");

assert.equal(round.snapshot.equipment.find((entry) => entry.id === switchingDc.id)?.outputVoltages.join(","), "12,48");
assert.equal(electronicsItems.some((item) => item.id === "2.3.ac-dc-01"), false, "dynamic WIM Electronics must not use fixed AC/DC slots");
assert.equal(electronicsItems.some((item) => item.label.includes("12VDC")), true);
assert.equal(electronicsItems.some((item) => item.label.includes("48VDC")), true);
assert.equal(electronicsItems.some((item) => item.label.includes("24VDC")), false, "unselected DC output must not create a checklist item");
assert.equal(electronicsItems.some((item) => item.label.includes("Transformer AC 24VAC")), true);
assert.equal(electronicsItems.filter((item) => item.assetId === controller.id && item.label.includes("Cal Factor")).length, 1);
assert.equal(new Set(electronicsItems.map((item) => item.id)).size, electronicsItems.length);

const catalog = createSystemItemCatalog({ includeWimElectronics: true });
const switchingCatalog = catalog.find((item) => item.type === "WIM_SWITCHING_DC");
assert.deepEqual(switchingCatalog.outputVoltageOptions, WIM_ELECTRONICS_OUTPUT_VOLTAGES);
const catalogAsset = makeEquipmentFromCatalogItem(switchingCatalog, 1, { location: "ตู้ CAB-02" });
assert.equal(catalogAsset.type, "WIM_SWITCHING_DC");
assert.deepEqual(catalogAsset.outputVoltages, [], "adding a Switching DC does not assume all output voltages");
assert.equal(getStationReadiness({ ...profile, equipment: [catalogAsset] }).blockers.some((blocker) => blocker.code === "WIM_SWITCHING_DC_OUTPUT_REQUIRED"), true);

const defaultRound = createInspectionRound(createDefaultStationProfile());
const defaultElectronicsItems = getItemsForSnapshot(defaultRound.snapshot).filter((item) => item.sectionCode === "2.3"
  && !item.isEquipmentCleaning && !item.isAreaCleaning);
assert.deepEqual(defaultElectronicsItems.map((item) => item.label), [
  "WIM Electronics Cabinet · ภาพรวมตู้ควบคุมอิเล็กทรอนิกส์ WIM · CAB-GEN-01",
  "WIM Electronics Cabinet · อุปกรณ์ควบคุมไฟฟ้าภายในตู้ · CAB-GEN-01",
  "WIM Electronics Cabinet · ไฟฟ้าหลักขาเข้า · CAB-GEN-01",
  "WIM Electronics Cabinet · กระแสไฟฟ้าหลัก · CAB-GEN-01",
  "WIM Electronics System · ตรวจการทำงานของซอฟต์แวร์",
]);
assert.equal(defaultElectronicsItems.some((item) => /AC\/DC|Network|WIM Controller|Sub Breaker|Transformer|Switching DC/.test(item.label)), false,
  "a cabinet without registered WIM sub-equipment must not receive phantom child checks");
const historicalWimSnapshot = {
  ...defaultRound.snapshot,
  checklistPolicyVersion: PREVIOUS_CURRENT_CHECKLIST_POLICY_VERSION,
  stationSystems: [
    ...(defaultRound.snapshot.stationSystems || []),
    { id: "present-wim-control", canonicalItemId: "wim-control", active: true, quantity: 1 },
    { id: "present-wim-electronics", canonicalItemId: "wim-electronics-system", active: true, quantity: 1 },
  ],
};
const historicalWimSystemLabels = getEvidenceItemsForSnapshot(historicalWimSnapshot)
  .filter((item) => item.systemRecordId)
  .map((item) => item.label);
assert.equal(historicalWimSystemLabels.some((label) => label.startsWith("WIM Control System")), true, "v5 Snapshot keeps WIM Control System row");
assert.equal(historicalWimSystemLabels.some((label) => label.startsWith("WIM Electronics System")), true, "v5 Snapshot keeps WIM Electronics System row");
const laneEvidenceSlots = getItemsForSnapshot(defaultRound.snapshot)
  .filter((item) => item.sectionCode === "3.1")
  .flatMap((item) => item.evidenceSlots.map((slot) => slot.id));
assert.equal(new Set(laneEvidenceSlots).size, laneEvidenceSlots.length, "active Lane evidence slots must have unique IDs");

const groups = getEquipmentGroupsForRegister([switchingDc]);
assert.equal(groups.find((group) => group.code === "2.3")?.types.some((type) => type.value === "WIM_SWITCHING_DC"), true);

console.log("WIM Electronics smoke passed", JSON.stringify({
  electronicsItems: electronicsItems.length,
  selectedOutputs: switchingDc.outputVoltages,
  catalogTypes: catalog.length,
}));
