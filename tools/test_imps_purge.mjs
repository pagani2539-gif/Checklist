import assert from "node:assert/strict";
import {
  BOQ_SYSTEMS,
  EQUIPMENT_TYPES,
  ITEM_LIBRARY_CATEGORIES,
  ITEM_LIBRARY_CATEGORY_CODES,
  PRESENT_MA8_SYSTEM_SEEDS,
  createDefaultStationProfile,
  createSnapshot,
  createStationDraft,
  createSystemItemCatalog,
  getNewRoundChecklistItems,
  getStationChecklistSections,
} from "../src/domain/master-checklist.js";
import {
  CURRENT_STATE_VERSION,
  IMPS_PURGE_VERSION,
  loadChecklistBootstrap,
  migrateChecklistState,
  purgeStandaloneImpsFromState,
} from "../src/domain/storage.js";

assert.deepEqual(BOQ_SYSTEMS.map((system) => system.systemId), ["wim", "lpr", "cctv", "other"]);
assert.deepEqual(ITEM_LIBRARY_CATEGORY_CODES, ["2.1", "2.2", "2.3", "3.1", "3.2", "4.1", "4.2", "5.1", "5.2", "7.1"]);
assert.equal(ITEM_LIBRARY_CATEGORIES.length, 10);
assert.equal(EQUIPMENT_TYPES.some((definition) => definition.value === "IMPS_CAMERA"), false);
assert.equal(PRESENT_MA8_SYSTEM_SEEDS.some((system) => system.id === "present-imps"), false);
assert.equal(createSystemItemCatalog().some((item) => item.type === "IMPS_CAMERA"), false);
assert.equal(createStationDraft().stationSystems.some((system) => system.systemId === "imps"), false);
assert.equal(createStationDraft().equipment.some((equipment) => equipment.type === "IMPS_CAMERA"), false);

const baseProfile = createDefaultStationProfile();
const wimSystem = {
  id: "present-wim-control",
  systemId: "wim",
  displayLabel: "ระบบควบคุม WIM",
  sourceLabel: "WIM CONTROL SYSTEM FOR IMPS",
  sourceRefs: ["2.2"],
  quantity: 1,
};
const impsSystem = {
  id: "present-imps",
  systemId: "imps",
  displayLabel: "ระบบประมวลผลภาพ (ImPS)",
  sourceLabel: "IMAGE PROCESSING SYSTEM (ImPS)",
  sourceRefs: ["1"],
  quantity: 1,
};
const wimAsset = {
  id: "wim-asset-1",
  type: "CONTROL_COMPUTER",
  categoryCode: "2.2",
  systemId: "wim",
  assetNo: "PC-01",
  catalogItemId: "system.control_computer",
};
const impsAsset = {
  id: "imps-asset-1",
  type: "IMPS_CAMERA",
  categoryCode: "IMPS",
  systemId: "imps",
  assetNo: "IMPS-01",
  catalogItemId: "system.imps_camera",
};
const impsEvidence = {
  itemId: "imps.camera",
  slotId: "imps.camera.evidence",
  assetId: impsAsset.id,
  categoryCode: "IMPS",
  attachment: { id: "imps-only", name: "imps.jpg", type: "image/jpeg" },
};
const sharedEvidence = {
  itemId: "2.2.control",
  slotId: "2.2.control.evidence",
  assetId: wimAsset.id,
  categoryCode: "2.2",
  attachment: { id: "shared-with-wim", name: "shared.jpg", type: "image/jpeg" },
};
const imageProcessingSystem = {
  id: "system-image-processing-management-current",
  canonicalItemId: "image-processing-management",
  systemId: "image-processing-management",
  componentId: "canonical",
  displayLabel: "ระบบประมวลผลและบริหารจัดการสัญญาณภาพ",
  sourceLabel: "Image Processing Management System",
  scope: "Image Processing",
  quantity: 1,
  active: true,
};
const imageProcessor = {
  id: "image-processor-current",
  type: "IMAGE_PROCESSOR",
  systemId: "imps",
  parentSystemId: imageProcessingSystem.id,
  categoryCode: "1.1.12",
  scope: "Image Processing",
  assetNo: "IMPS-IP-01",
  active: true,
  recordKind: "asset",
};
const currentImpsProfile = {
  ...baseProfile,
  id: "station-current-imps",
  stationCode: "IMPS-CURRENT-01",
  stationName: "สถานีทดสอบ Image Processing ปัจจุบัน",
  stationFormat: "IMPS",
  stationSystems: [imageProcessingSystem],
  equipment: [imageProcessor],
};
const currentImpsSnapshot = createSnapshot(currentImpsProfile);
const currentImpsChecklistItems = getNewRoundChecklistItems(currentImpsSnapshot);
const currentImpsRound = {
  id: "round-current-imps",
  stationId: currentImpsProfile.id,
  status: "draft",
  snapshot: currentImpsSnapshot,
  inspectionItems: Object.fromEntries(currentImpsChecklistItems.map((item) => [item.id, { assetId: item.assetId || null }])),
};
const legacyImpsCopy = {
  revision: "legacy-imps-copy",
  sections: [
    { code: "IMPS", title: "ระบบประมวลผลภาพ (ImPS)", items: [{ id: "imps.camera", label: "กล้อง ImPS" }] },
    { code: "2.2", title: "ระบบควบคุม WIM", items: [{ id: "control-network", label: "WIM CONTROL SYSTEM FOR IMPS" }] },
  ],
};
const snapshot = {
  id: "snapshot-imps-purge",
  templateVersion: "checklist-master-history-v1",
  createdAt: "2026-09-04T00:00:00.000Z",
  stationId: baseProfile.id,
  stationCode: baseProfile.stationCode,
  stationName: baseProfile.stationName,
  stationSystems: [impsSystem, wimSystem],
  equipment: [impsAsset, wimAsset],
  evidenceCatalog: [impsEvidence, sharedEvidence],
  checklistCopy: legacyImpsCopy,
  masterChecklistCopy: legacyImpsCopy,
  checklistConfig: { disabledTemplateIds: [] },
};
const impsItems = {
  "imps.camera": {
    assetId: impsAsset.id,
    categoryCode: "IMPS",
    evidence: { "imps.camera.evidence": { attachment: impsEvidence.attachment, status: "complete" } },
  },
  "2.2.control": {
    assetId: wimAsset.id,
    categoryCode: "2.2",
    evidence: { "2.2.control.evidence": { attachment: sharedEvidence.attachment, status: "complete" } },
  },
};
const draft = {
  id: "round-imps-draft",
  stationId: baseProfile.id,
  status: "draft",
  createdAt: "2026-09-04T00:01:00.000Z",
  snapshot,
  inspectionItems: impsItems,
};
const closed = {
  ...draft,
  id: "round-imps-closed",
  status: "closed",
  closedAt: "2026-09-04T00:02:00.000Z",
};
const rawState = {
  version: 13,
  stationProfiles: [{
    ...baseProfile,
    stationSystems: [impsSystem, wimSystem],
    equipment: [impsAsset, wimAsset],
    checklistConfig: { disabledTemplateIds: ["imps.camera", "2.2.control"] },
  }, currentImpsProfile],
  itemCatalog: [
    { id: "system.imps_camera", kind: "system", type: "IMPS_CAMERA", categoryCode: "IMPS", label: "กล้องระบบประมวลผลภาพ (ImPS)" },
    { id: "system.image_processor", kind: "asset", type: "IMAGE_PROCESSOR", systemId: "imps", categoryCode: "1.1.12", label: "Image Processor" },
    { id: "system.control_computer", kind: "system", type: "CONTROL_COMPUTER", categoryCode: "2.2", label: "เครื่องคอมพิวเตอร์ควบคุม WIM" },
  ],
  inspectionRounds: [draft, closed, currentImpsRound],
  inspectionHistory: [{ id: "history-imps", stationId: baseProfile.id, stationSnapshot: snapshot, items: impsItems }],
  inspectionWorkspaces: [{ id: "workspace-imps", stationId: baseProfile.id, snapshot, items: impsItems }],
  activeRoundId: draft.id,
  activeStationId: baseProfile.id,
  ui: { selectedStationId: baseProfile.id },
  inspectionSnapshot: snapshot,
  items: impsItems,
  checklistCopy: legacyImpsCopy,
  masterChecklistCopy: legacyImpsCopy,
};

const purged = purgeStandaloneImpsFromState(rawState);
assert.equal(purged.changed, true);
assert.equal(purged.state.stationProfiles[0].stationSystems.some((system) => system.systemId === "imps"), false);
assert.equal(purged.state.stationProfiles[0].equipment.some((equipment) => equipment.type === "IMPS_CAMERA"), false);
const purgedCurrentImpsProfile = purged.state.stationProfiles.find((profile) => profile.id === currentImpsProfile.id);
assert.ok(purgedCurrentImpsProfile.equipment.some((equipment) => equipment.id === imageProcessor.id), "current Image Processor must survive legacy ImPS cleanup");
assert.equal(purged.state.itemCatalog.some((item) => item.type === "IMPS_CAMERA"), false);
assert.ok(purged.state.itemCatalog.some((item) => item.id === "system.image_processor"), "current Image Processor catalog row must survive legacy ImPS cleanup");
const purgedCurrentImpsRound = purged.state.inspectionRounds.find((round) => round.id === currentImpsRound.id);
assert.ok(purgedCurrentImpsRound.snapshot.equipment.some((equipment) => equipment.id === imageProcessor.id), "historical Image Processor Snapshot must remain unchanged");
assert.ok(purgedCurrentImpsRound.snapshot.evidenceCatalog.some((item) => item.assetId === imageProcessor.id), "historical Image Processor Checklist rows must remain unchanged");
assert.equal(purged.state.stationProfiles[0].checklistConfig.disabledTemplateIds.includes("imps.camera"), false);
assert.equal(purged.state.stationProfiles[0].checklistConfig.disabledTemplateIds.includes("2.2.control"), true);
assert.equal(purged.state.checklistCopy.sections.some((section) => section.code === "IMPS"), false);
assert.equal(purged.state.masterChecklistCopy.sections.some((section) => section.code === "IMPS"), false);
assert.equal(purged.state.inspectionRounds.some((round) => round.snapshot.equipment.some((equipment) => equipment.type === "IMPS_CAMERA")), false);
assert.equal(purged.state.inspectionRounds.some((round) => Object.keys(round.inspectionItems).some((itemId) => itemId.startsWith("imps."))), false);
assert.ok(purged.attachmentIdsToDelete.includes("imps-only"));
assert.equal(purged.attachmentIdsToDelete.includes("shared-with-wim"), false, "shared evidence must not be deleted");

const migrated = migrateChecklistState(rawState);
assert.equal(CURRENT_STATE_VERSION, 18);
assert.equal(migrated.version, CURRENT_STATE_VERSION);
assert.equal(migrated.impsPurgeVersion, IMPS_PURGE_VERSION);
assert.equal(migrated.itemCatalog.some((item) => item.type === "IMPS_CAMERA"), false);
assert.equal(migrated.stationProfiles.some((profile) => profile.stationSystems.some((system) => system.systemId === "imps")), false);
const migratedCurrentImpsProfile = migrated.stationProfiles.find((profile) => profile.id === currentImpsProfile.id);
assert.ok(migratedCurrentImpsProfile.equipment.some((equipment) => equipment.id === imageProcessor.id), "current Image Processor must survive server-state normalization");
assert.ok(migrated.itemCatalog.some((item) => item.id === "system.image_processor"), "current Image Processor catalog row must survive server-state normalization");
const migratedCurrentImpsRound = migrated.inspectionRounds.find((round) => round.id === currentImpsRound.id);
assert.ok(migratedCurrentImpsRound.snapshot.equipment.some((equipment) => equipment.id === imageProcessor.id), "historical Image Processor Snapshot must survive server-state normalization");
const currentImpsChecklist = getNewRoundChecklistItems(createSnapshot(migratedCurrentImpsProfile));
const imageProcessorChecklist = currentImpsChecklist.filter((item) => item.assetId === imageProcessor.id);
assert.equal(imageProcessorChecklist.length, 3, "current Image Processor must keep all three dedicated Checklist rows");
const imageProcessorSection = getStationChecklistSections(createSnapshot(migratedCurrentImpsProfile)).find((section) => section.code === "IMPS-01.01");
assert.equal(imageProcessorSection?.items.length, 3, "Image Processor checks belong under IMPS-01 Equipment");
assert.equal(migrated.inspectionRounds.some((round) => round.snapshot.equipment.some((equipment) => equipment.type === "IMPS_CAMERA")), false);
assert.equal(migrated.inspectionHistory.some((entry) => JSON.stringify(entry).includes("present-imps")), false);
assert.equal(migrated.inspectionWorkspaces.some((entry) => JSON.stringify(entry).includes("present-imps")), false);
assert.equal(migrated.inspectionRounds.some((round) => JSON.stringify(round).includes('"categoryCode":"IMPS"')), false);
assert.equal(migrated.inspectionRounds.some((round) => JSON.stringify(round).includes('"code":"IMPS"')), false);
assert.ok(migrated.inspectionRounds.some((round) => round.snapshot.stationSystems.some((system) => system.sourceLabel === "WIM CONTROL SYSTEM FOR IMPS")), "WIM source labels must survive");
assert.ok(migrated.impsPurgePendingAttachmentIds.includes("imps-only"));
assert.equal(migrated.impsPurgePendingAttachmentIds.includes("shared-with-wim"), false);

const migratedAgain = migrateChecklistState(migrated);
assert.deepEqual(migratedAgain, migrated, "standalone ImPS migration must be idempotent");

let persistedPayload = null;
globalThis.window = {
  localStorage: {
    getItem: () => JSON.stringify(rawState),
    setItem: (_key, value) => { persistedPayload = JSON.parse(value); },
  },
};
const bootstrap = loadChecklistBootstrap();
assert.ok(persistedPayload, "legacy Local storage must be rewritten after migration");
assert.equal(persistedPayload.version, CURRENT_STATE_VERSION);
assert.equal(persistedPayload.impsPurgeVersion, IMPS_PURGE_VERSION);
assert.equal(persistedPayload.itemCatalog.some((item) => item.type === "IMPS_CAMERA"), false);
assert.equal(JSON.stringify(persistedPayload).includes("present-imps"), false);
assert.equal(bootstrap.state.version, CURRENT_STATE_VERSION);
delete globalThis.window;

console.log("ImPS purge smoke passed", JSON.stringify({
  version: migrated.version,
  marker: migrated.impsPurgeVersion,
  systemItems: createSystemItemCatalog().length,
  categories: ITEM_LIBRARY_CATEGORIES.length,
  deletedAttachments: migrated.impsPurgePendingAttachmentIds,
}));
