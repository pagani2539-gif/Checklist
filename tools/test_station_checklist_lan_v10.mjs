import assert from "node:assert/strict";
import {
  CHECKLIST_POLICY_VERSION,
  PREVIOUS_CHECKLIST_POLICY_VERSION_V10,
  PREVIOUS_CHECKLIST_POLICY_VERSION_V9,
  createDefaultStationProfile,
  createSnapshot,
  getEvidenceCatalogForSnapshot,
  getItemsForSnapshot,
  getStationChecklistItems,
  makeEquipment,
} from "../src/domain/master-checklist.js";

const LAN_LABEL_TEMPLATE_IDS = new Set(["2.2.lan", "4.2.lan", "5.1.lan"]);
const isLanLabelItem = (item) => LAN_LABEL_TEMPLATE_IDS.has(String(item.id).split("::asset::")[0]);
const isLegacyNvrHddRow = (item) => String(item.id).split("::asset::")[0] === "4.2.hdd";

const profile = createDefaultStationProfile();
profile.equipment.push(makeEquipment("NVR", 2, { id: "nvr-secondary" }));
const snapshotV11 = createSnapshot(profile);
assert.equal(CHECKLIST_POLICY_VERSION, "station-item-controls-v11");
assert.equal(snapshotV11.checklistPolicyVersion, CHECKLIST_POLICY_VERSION);

const roundItemsV11 = getItemsForSnapshot(snapshotV11);
assert.deepEqual(roundItemsV11.filter(isLanLabelItem), []);
assert.deepEqual(roundItemsV11.filter(isLegacyNvrHddRow), [], "new rounds replace the legacy HDD photo row");
assert.equal(roundItemsV11.filter((item) => item.id.includes("failed-hdd-count")).length, 2,
  "one merged disk-health row is generated for each installed NVR");

const previewItems = getStationChecklistItems(profile, { includeDisabled: true });
assert.deepEqual(previewItems.filter(isLanLabelItem), []);
assert.deepEqual(previewItems.filter(isLegacyNvrHddRow), [], "the station preview matches the new-round HDD rows");

const snapshotV10 = { ...snapshotV11, checklistPolicyVersion: PREVIOUS_CHECKLIST_POLICY_VERSION_V10 };
snapshotV10.evidenceCatalog = getEvidenceCatalogForSnapshot(snapshotV10);
const roundItemsV10 = getItemsForSnapshot(snapshotV10);
assert.deepEqual(roundItemsV10.filter(isLanLabelItem), [], "v10 retains its LAN-label removal");
assert.equal(roundItemsV10.filter(isLegacyNvrHddRow).length, 2,
  "existing v10 rounds keep their legacy HDD photo row");

const snapshotV9 = { ...snapshotV11, checklistPolicyVersion: PREVIOUS_CHECKLIST_POLICY_VERSION_V9 };
snapshotV9.evidenceCatalog = getEvidenceCatalogForSnapshot(snapshotV9);
const roundItemsV9 = getItemsForSnapshot(snapshotV9);
assert.deepEqual(
  roundItemsV9.filter(isLanLabelItem).map((item) => item.id.split("::asset::")[0]).sort(),
  ["2.2.lan", "4.2.lan", "4.2.lan", "5.1.lan"],
);

const comparableItems = (items) => items.filter((item) => !isLanLabelItem(item)).map((item) => ({
  id: item.id,
  label: item.label,
  unit: item.unit,
  inputType: item.inputType,
  fieldType: item.fieldType,
  evidenceSlots: item.evidenceSlots.map((slot) => ({
    id: slot.id,
    displayLabel: slot.displayLabel,
    fieldType: slot.fieldType,
    required: slot.required,
  })),
}));
assert.deepEqual(comparableItems(roundItemsV10), comparableItems(roundItemsV9));

console.log("station-checklist-v11-nvr-hdd-merge: ok");
