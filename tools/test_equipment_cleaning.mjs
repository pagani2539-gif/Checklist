import assert from "node:assert/strict";
import {
  CLEANING_POLICY_VERSION,
  CLEANING_STAGE_DEFINITIONS,
  CLEANING_TARGET_TYPES,
  CHECKLIST_POLICY_VERSION,
  LEGACY_EVIDENCE_TEMPLATE_VERSION,
  createDefaultStationProfile,
  createInspectionRound as createCurrentInspectionRound,
  getCloseReadiness,
  getItemsForSnapshot,
  getRoundSummary,
  getStationChecklistItems,
  isCleaningEvidenceComplete,
  makeEquipment,
} from "../src/domain/master-checklist.js";
import { createLegacyInspectionRound } from "./legacy_round_fixture.mjs";
import { buildReportTemplateModel } from "../src/domain/report-template.js";

const profile = createDefaultStationProfile();
profile.equipment.push(
  makeEquipment("NVR", 2, { id: "inactive-nvr-2", active: false }),
  makeEquipment("LPR_CAMERA", 9, { id: "inactive-lpr-9", active: false }),
);

const round = createLegacyInspectionRound(profile);
assert.equal(round.snapshot.cleaningPolicyVersion, CLEANING_POLICY_VERSION);
// This smoke test isolates the cleaning close gate from the separate Vehicle
// API review gate. The production close gate still requires the API review
// whenever the snapshot carries the v2 review marker.
round.snapshot.vehicleReviewVersion = null;

const items = getItemsForSnapshot(round.snapshot);
const cleaningItems = items.filter((item) => item.isEquipmentCleaning);
const targetAssetIds = new Set(round.snapshot.equipment
  .filter((asset) => CLEANING_TARGET_TYPES.includes(asset.type))
  .map((asset) => asset.id));

assert.equal(cleaningItems.length, targetAssetIds.size);
assert.deepEqual(new Set(cleaningItems.map((item) => item.assetId)), targetAssetIds);
assert.equal(cleaningItems.some((item) => item.assetId === "inactive-nvr-2"), false);
assert.equal(cleaningItems.some((item) => item.assetId === "inactive-lpr-9"), false);

cleaningItems.forEach((item) => {
  const asset = round.snapshot.equipment.find((entry) => entry.id === item.assetId);
  assert.equal(item.assetNo, asset.assetNo);
  assert.equal(item.location, asset.location);
  assert.equal(item.serialNo, asset.serialNo);
  assert.deepEqual(item.evidenceSlots.map((slot) => slot.cleaningStage), ["before", "during", "after"]);
  assert.deepEqual(item.evidenceSlots.map((slot) => slot.displayLabel), CLEANING_STAGE_DEFINITIONS.map((stage) => stage.label));
  item.evidenceSlots.forEach((slot) => {
    assert.equal(slot.required, true);
    assert.equal(slot.fieldType, "photo");
    assert.equal(isCleaningEvidenceComplete(slot, { status: "complete" }), false);
  });
});

assert.equal(cleaningItems.some((item) => /ห้องควบคุม|รอบตู้/i.test(`${item.label} ${item.cleaningAssetType}`)), false);
assert.equal(cleaningItems.filter((item) => item.cleaningAssetType.startsWith("VMS_")).length, 3);
assert.equal(round.snapshot.evidenceCatalog.filter((entry) => entry.isEquipmentCleaning).length, cleaningItems.length * 3);

const currentWithoutPolicy = { ...round.snapshot, cleaningPolicyVersion: null, evidenceCatalog: undefined };
const currentTemplateItemsWithoutPolicy = getItemsForSnapshot(currentWithoutPolicy);
assert.equal(currentTemplateItemsWithoutPolicy.some((item) => item.isEquipmentCleaning), false);
assert.equal(currentTemplateItemsWithoutPolicy.length, 161, "an existing v5 Snapshot without the policy keeps the v5 catalog shape");

const withoutPolicy = { ...round.snapshot, templateVersion: LEGACY_EVIDENCE_TEMPLATE_VERSION, cleaningPolicyVersion: null, evidenceCatalog: undefined };
const oldV3Items = getItemsForSnapshot(withoutPolicy);
assert.equal(oldV3Items.some((item) => item.isEquipmentCleaning), false);
assert.equal(oldV3Items.length, 170, "a v3 Snapshot without the new policy keeps the historical catalog");
const legacyWithPolicyMarker = createLegacyInspectionRound(profile, {}, {
  snapshot: { ...withoutPolicy, cleaningPolicyVersion: CLEANING_POLICY_VERSION },
});
assert.equal(getItemsForSnapshot(legacyWithPolicyMarker.snapshot).some((item) => item.isEquipmentCleaning), false);
assert.equal(getItemsForSnapshot(legacyWithPolicyMarker.snapshot).length, 170, "a legacy template never receives the new policy by marker alone");

const noPhotos = structuredClone(round);
items.forEach((item) => {
  const value = noPhotos.inspectionItems[item.id];
  value.status = item.applicable === false ? "na" : "normal";
  Object.values(value.evidence).forEach((evidence) => {
    evidence.status = "complete";
    evidence.attachment = null;
  });
});
const noPhotoReadiness = getCloseReadiness(noPhotos);
assert.equal(noPhotoReadiness.canClose, false, "missing required cleaning photos remain incomplete");
assert.equal(noPhotoReadiness.canConfirmClose, true, "the user can confirm closure with missing required cleaning photos");
assert.equal(noPhotoReadiness.blockers.every((blocker) => blocker.type === "evidence-photo"
  && blocker.sectionCode
  && blocker.itemId
  && blocker.slotId
  && blocker.label
  && blocker.message), true, "cleaning blockers retain category, item, slot, and message details");

const complete = structuredClone(noPhotos);
cleaningItems.forEach((item) => {
  item.evidenceSlots.forEach((slot) => {
    complete.inspectionItems[item.id].evidence[slot.id].attachment = {
      id: `photo-${slot.id}`,
      name: `${slot.cleaningStage}.jpg`,
      type: "image/jpeg",
    };
  });
});
assert.equal(getCloseReadiness(complete).canClose, true);
assert.equal(getCloseReadiness(complete).canConfirmClose, true);
assert.equal(getRoundSummary(complete).evidenceComplete, getRoundSummary(complete).evidenceTotal);

const replaced = structuredClone(complete);
const replacedItem = cleaningItems[0];
const replacedSlot = replacedItem.evidenceSlots[0];
replaced.inspectionItems[replacedItem.id].evidence[replacedSlot.id].attachment = {
  id: "replacement-photo",
  name: "replacement.jpg",
  type: "image/jpeg",
};
assert.equal(isCleaningEvidenceComplete(replacedSlot, replaced.inspectionItems[replacedItem.id].evidence[replacedSlot.id]), true, "replacing a stage photo keeps the slot complete");
assert.equal(getRoundSummary(replaced).evidenceComplete, getRoundSummary(complete).evidenceComplete, "replacing a stage photo does not change the evidence count");

const removed = structuredClone(complete);
const removedItem = cleaningItems[0];
const removedSlot = removedItem.evidenceSlots[1];
removed.inspectionItems[removedItem.id].evidence[removedSlot.id].attachment = null;
assert.equal(getCloseReadiness(removed).canClose, false, "removing a stage image still leaves the round incomplete");
assert.equal(getCloseReadiness(removed).canConfirmClose, true);
assert.equal(getRoundSummary(removed).evidenceComplete, getRoundSummary(complete).evidenceComplete - 1);

for (const bypassStatus of ["server-site", "not-installed"]) {
  const bypassRound = structuredClone(complete);
  const bypassSlot = cleaningItems[1].evidenceSlots[0];
  bypassRound.inspectionItems[cleaningItems[1].id].evidence[bypassSlot.id].status = bypassStatus;
  bypassRound.inspectionItems[cleaningItems[1].id].evidence[bypassSlot.id].attachment = null;
  assert.equal(getCloseReadiness(bypassRound).blockers.some((entry) => entry.type === "evidence-photo"), true, `${bypassStatus} does not mark a required cleaning photo complete`);
  assert.equal(getCloseReadiness(bypassRound).canConfirmClose, true, `${bypassStatus} may still be acknowledged when closing`);
}

const model = buildReportTemplateModel(complete);
const reportCleaningItems = model.sections.flatMap((section) => section.items).filter((item) => item.isEquipmentCleaning);
assert.equal(reportCleaningItems.length, cleaningItems.length);
assert.equal(reportCleaningItems.some((item) => item.label === "Equipment Cleaning · WIM Control Computer · เครื่องคอมพิวเตอร์ควบคุม WIM · PC-GEN-01"), true);
reportCleaningItems.forEach((item) => {
  assert.ok(item.assetNo);
  assert.deepEqual(item.evidenceSlots.map((slot) => slot.cleaningStage), ["before", "during", "after"]);
  assert.ok(item.evidenceSlots.every((slot) => slot.attachment?.source === "indexeddb"));
});

console.log("equipment cleaning smoke passed", JSON.stringify({
  policy: CLEANING_POLICY_VERSION,
  targetAssets: cleaningItems.length,
  requiredPhotos: cleaningItems.length * 3,
  historicalV3Items: oldV3Items.length,
}));

const auditedProfile = createDefaultStationProfile();
auditedProfile.equipment = auditedProfile.equipment.filter((asset) => !(
  (asset.type === "LPR_CAMERA" && asset.id.endsWith("-3"))
  || (asset.type === "FIXED_CAMERA" && asset.id.endsWith("-3"))
  || asset.type === "DATABASE_SERVER"
));
auditedProfile.equipment.push(makeEquipment("VMS_SIGN", 9, { id: "inactive-vms-sign", active: false }));

const auditedPreview = getStationChecklistItems(auditedProfile);
const auditedPreviewCleaning = auditedPreview.filter((item) => item.isEquipmentCleaning || item.isAreaCleaning);
assert.equal(auditedPreview.filter((item) => item.isEquipmentCleaning).length, 11);
assert.equal(auditedPreviewCleaning.length, 13);
assert.equal(auditedPreviewCleaning.reduce((total, item) => total + item.evidenceSlots.length, 0), 39);
assert.equal(auditedPreviewCleaning.some((item) => item.assetId === "inactive-vms-sign"), false);

const auditedRound = createCurrentInspectionRound(auditedProfile);
assert.equal(auditedRound.snapshot.checklistPolicyVersion, CHECKLIST_POLICY_VERSION);
const auditedRoundItems = getItemsForSnapshot(auditedRound.snapshot);
const auditedEquipmentCleaning = auditedRoundItems.filter((item) => item.isEquipmentCleaning);
const auditedAreaCleaning = auditedRoundItems.filter((item) => item.isAreaCleaning);
assert.equal(auditedEquipmentCleaning.length, 11, "the audited station has one cleaning row for each of its 11 target devices");
assert.equal(auditedAreaCleaning.length, 2, "the audited station has one room and one cabinet-area row");
assert.ok(auditedAreaCleaning.some((item) => item.label === "ทำความสะอาดพื้นที่ห้องควบคุม"));
assert.ok(auditedAreaCleaning.filter((item) => item.cleaningAssetType === "CONTROL_CABINET")
  .every((item) => item.label.startsWith("Control Cabinet Surrounding Area Cleaning · ")));
assert.equal(auditedRoundItems.filter((item) => item.isEquipmentCleaning || item.isAreaCleaning)
  .reduce((total, item) => total + item.evidenceSlots.length, 0), 39, "the 13 cleaning rows require 39 photos");
assert.deepEqual(new Set(auditedEquipmentCleaning.map((item) => item.assetId)), new Set(auditedRound.snapshot.equipment
  .filter((asset) => asset.active !== false && CLEANING_TARGET_TYPES.includes(asset.type)).map((asset) => asset.id)));
assert.equal(auditedRound.snapshot.evidenceCatalog.filter((entry) => entry.isEquipmentCleaning).length, 33);
assert.ok(auditedEquipmentCleaning.every((item) => item.evidenceSlots.length === 3
  && item.evidenceSlots.every((slot) => slot.required && slot.fieldType === "photo")));
assert.equal(auditedEquipmentCleaning.filter((item) => item.cleaningAssetType.startsWith("VMS_")).length, 3);
assert.equal(auditedEquipmentCleaning.some((item) => ["WIM_SENSOR", "WIM_LOOP"].includes(item.cleaningAssetType)), false);
assert.deepEqual(auditedEquipmentCleaning.reduce((sections, item) => {
  (sections[item.sectionCode] ||= []).push(item.cleaningAssetType);
  return sections;
}, {}), {
  "2.2": ["CONTROL_COMPUTER"],
  "2.3": ["CONTROL_CABINET"],
  "3.2": ["LPR_CAMERA", "LPR_CAMERA"],
  "4.1": ["FIXED_CAMERA", "FIXED_CAMERA", "PTZ_CAMERA"],
  "4.2": ["NVR"],
  "7.1": ["VMS_SIGN", "VMS_LIGHT_SENSOR", "VMS_DISPLAY"],
});
assert.ok(auditedAreaCleaning.some((item) => item.sectionCode === "2.2" && item.cleaningAssetType === "STATION_AREA"));
assert.ok(auditedAreaCleaning.some((item) => item.sectionCode === "2.3" && item.cleaningAssetType === "CONTROL_CABINET"));

const cleaningAssetSlots = (items) => Object.fromEntries(items
  .filter((item) => item.isEquipmentCleaning)
  .map((item) => [item.assetId, item.evidenceSlots.map((slot) => slot.id)])
  .sort(([left], [right]) => left.localeCompare(right)));
const reorderedPreview = getStationChecklistItems({ ...auditedProfile, equipment: [...auditedProfile.equipment].reverse() });
assert.deepEqual(cleaningAssetSlots(reorderedPreview), cleaningAssetSlots(auditedPreview),
  "cleaning evidence IDs stay bound to the Asset when register order changes");

const addedProfile = { ...auditedProfile, equipment: [...auditedProfile.equipment, makeEquipment("NVR", 9, { id: "nvr-added" })] };
const addedCleaning = getStationChecklistItems(addedProfile).filter((item) => item.isEquipmentCleaning || item.isAreaCleaning);
assert.equal(addedCleaning.length, 14, "adding an active cleaning target adds one row");
assert.equal(addedCleaning.reduce((total, item) => total + item.evidenceSlots.length, 0), 42);
const removedProfile = { ...auditedProfile, equipment: auditedProfile.equipment.filter((asset) => asset.id !== "draft-vms_sign-1") };
const removedCleaning = getStationChecklistItems(removedProfile).filter((item) => item.isEquipmentCleaning || item.isAreaCleaning);
assert.equal(removedCleaning.length, 12, "removing a target device removes only its row");
assert.equal(removedCleaning.reduce((total, item) => total + item.evidenceSlots.length, 0), 36);

const auditedReportItems = buildReportTemplateModel(auditedRound).sections.flatMap((section) => section.items);
const auditedReportCleaning = auditedReportItems.filter((item) => item.isEquipmentCleaning || item.isAreaCleaning);
assert.equal(auditedReportCleaning.length, 13);
assert.deepEqual(new Set(auditedReportCleaning.map((item) => item.sectionCode)), new Set(["2.2", "2.3", "3.2", "4.1", "4.2", "7.1"]));
const reportCategoryChecks = new Map([
  ["2.2", /^WIM CONTROL SYSTEM/i],
  ["2.3", /^WIM ELECTRONICS SYSTEM/i],
  ["3.2", /LPR Camera/i],
  ["4.1", /CCTV Camera/i],
  ["4.2", /NVR/i],
  ["7.1", /VMS/i],
]);
for (const [sectionCode, categoryPattern] of reportCategoryChecks) {
  const item = auditedReportCleaning.find((entry) => entry.sectionCode === sectionCode);
  assert.ok(item, `report has a cleaning control under source section ${sectionCode}`);
  assert.match(item.sourceSectionTitle || "", categoryPattern, `report cleaning category follows section ${sectionCode}`);
}
assert.ok(auditedReportCleaning.every((item) => item.evidenceSlots.map((slot) => slot.cleaningStage).join(",") === "before,during,after"));
console.log("current-round cleaning acceptance passed", JSON.stringify({ equipment: auditedEquipmentCleaning.length, area: auditedAreaCleaning.length, photoSlots: 39 }));
