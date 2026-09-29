import assert from "node:assert/strict";
import {
  createCustomItemCatalog,
  
  createStationDraft,
  createEmptyStationDraft,
  getItemsForSnapshot,
  getNextEquipmentIndex,
  makeEquipment,
  makeEquipmentFromCatalogItem,
  validateEquipmentDraft,
  validateStationDraft,
} from "../src/domain/master-checklist.js";
import { createLegacyInspectionRound as createInspectionRound } from "./legacy_round_fixture.mjs";
import {
  buildStationDeletionImpact,
  migrateChecklistState,
  purgeStationFromState,
} from "../src/domain/storage.js";

const customCatalogItem = createCustomItemCatalog({
  label: "เครื่องวัดอุณหภูมิภายนอก",
  categoryCode: "2.2",
  prefix: "TEMP",
});
assert.ok(customCatalogItem);

const draft = createEmptyStationDraft();
assert.equal(draft.equipment.length, 0, "empty station fixture keeps physical Asset entries transient");
assert.equal(draft.stationSystems.length, 0, "station creation starts with zero Systems");
assert.equal(draft.equipment.some((equipment) => equipment.type === "LANE"), false, "station creation must keep Lane out of Asset equipment");
assert.equal(draft.lanes.length, 0, "empty station fixture keeps Lane topology separate");
const seededDraft = createStationDraft("IMPS");
assert.equal(seededDraft.stationFormat, "IMPS");
assert.equal(seededDraft.equipment.some((equipment) => equipment.type.startsWith("VMS_")), false, "IMPS default must not create VMS assets");
assert.equal(seededDraft.lanes.length, 0, "station creation starts with zero Lane topology");
assert.equal(validateStationDraft(draft, []).valid, false);
assert.equal(validateStationDraft({ ...draft, stationCode: "A-01", stationName: "สถานี A", province: "กรุงเทพมหานคร" }, []).valid, true);
assert.equal(validateStationDraft({ ...draft, stationCode: "A-01", stationName: "สถานี A", province: "กรุงเทพมหานคร" }, [{ stationCode: "a-01" }]).valid, false);

const existingEquipment = [makeEquipment("CONTROL_COMPUTER", 1, { id: "computer-1", assetNo: "PC-01" })];
assert.equal(validateEquipmentDraft({ assetNo: "" }, existingEquipment).errors.assetNo, "กรุณาระบุรหัสอุปกรณ์ (Asset No.)");
assert.equal(validateEquipmentDraft({ assetNo: " pc-01 " }, existingEquipment).errors.assetNo, "รหัสอุปกรณ์ (Asset No.) ซ้ำกับรายการอื่นในสถานีนี้");
assert.equal(validateEquipmentDraft({ assetNo: "PC-01" }, existingEquipment, { excludeId: "computer-1" }).valid, true);

const customAsset = makeEquipmentFromCatalogItem(customCatalogItem, getNextEquipmentIndex(existingEquipment, { prefix: customCatalogItem.prefix }));
assert.ok(customAsset);
assert.equal(customAsset.type, "CUSTOM");
assert.equal(customAsset.assetNo, "TEMP-GEN-01");
assert.equal(customAsset.categoryCode, "2.2");
assert.equal(getItemsForSnapshot({
  id: "snapshot-custom",
  stationId: "station-a",
  stationCode: "A-01",
  stationName: "สถานี A",
  equipment: [customAsset],
  checklistConfig: { disabledTemplateIds: [] },
}).filter((item) => item.assetId === customAsset.id).length, 0, "custom assets must not receive automatic Checklist mapping");

const profileA = {
  id: "station-a",
  stationCode: "A-01",
  stationName: "สถานี A",
  active: true,
  equipment: [makeEquipment("LANE", 1, { id: "lane-a-1", assetNo: "LANE-01" }), customAsset],
  checklistConfig: { disabledTemplateIds: [] },
};
const profileB = {
  id: "station-b",
  stationCode: "B-01",
  stationName: "สถานี B",
  active: true,
  equipment: [makeEquipment("LANE", 1, { id: "lane-b-1", assetNo: "LANE-01" })],
  checklistConfig: { disabledTemplateIds: [] },
};

const draftRoundA = createInspectionRound(profileA, { projectName: "รอบ A draft" });
const closedRoundA = { ...createInspectionRound(profileA, { projectName: "รอบ A closed" }), status: "closed" };
const draftRoundB = createInspectionRound(profileB, { projectName: "รอบ B draft" });
const firstItemId = Object.keys(draftRoundA.inspectionItems)[0];
const addAttachment = (round, attachmentId) => ({
  ...round,
  inspectionItems: {
    ...round.inspectionItems,
    [firstItemId]: {
      ...round.inspectionItems[firstItemId],
      attachment: { id: attachmentId, name: `${attachmentId}.jpg`, type: "image/jpeg" },
    },
  },
});
const targetDraft = addAttachment(draftRoundA, "attachment-a-only");
const targetClosed = addAttachment(closedRoundA, "attachment-shared");
const otherDraft = addAttachment(draftRoundB, "attachment-shared");
const state = {
  version: 12,
  stationProfiles: [profileA, profileB],
  inspectionRounds: [targetDraft, targetClosed, otherDraft],
  inspectionHistory: [{ id: "history-a", stationId: "station-a", snapshot: targetClosed.snapshot, items: targetClosed.inspectionItems }],
  inspectionWorkspaces: [{ id: "workspace-a", stationId: "station-a", snapshot: targetDraft.snapshot, items: targetDraft.inspectionItems }],
  deletedStationIds: [],
  itemCatalog: [customCatalogItem],
  activeStationId: "station-a",
  activeRoundId: targetDraft.id,
  ui: { selectedStationId: "station-a" },
  items: targetDraft.inspectionItems,
  inspectionSnapshot: targetDraft.snapshot,
  meta: targetDraft.meta,
};

const impact = buildStationDeletionImpact(state, "station-a");
assert.deepEqual(impact.counts, { assets: 2, draftRounds: 1, closedHistory: 1, snapshots: 2, attachments: 1 });
assert.deepEqual(impact.attachmentIds, ["attachment-a-only"]);
assert.deepEqual(impact.sharedAttachmentIds, ["attachment-shared"]);
assert.ok(impact.roundIds.includes(targetDraft.id));
assert.ok(impact.historyIds.includes("history-a"));
assert.ok(impact.workspaceIds.includes("workspace-a"));

const changedProfile = {
  ...profileA,
  equipment: profileA.equipment.map((equipment) => equipment.id === "lane-a-1" ? { ...equipment, location: "ตำแหน่งใหม่" } : equipment),
};
const originalSnapshotLocation = targetDraft.snapshot.equipment.find((equipment) => equipment.id === "lane-a-1").location;
assert.ok(originalSnapshotLocation);
assert.equal(targetDraft.snapshot.equipment.find((equipment) => equipment.id === "lane-a-1").location, originalSnapshotLocation);
assert.equal(changedProfile.equipment.find((equipment) => equipment.id === "lane-a-1").location, "ตำแหน่งใหม่");

const purged = purgeStationFromState(state, "station-a");
assert.deepEqual(purged.stationProfiles.map((profile) => profile.id), ["station-b"]);
assert.deepEqual(purged.inspectionRounds.map((round) => round.stationId), ["station-b"]);
assert.equal(purged.inspectionHistory.length, 0);
assert.equal(purged.inspectionWorkspaces.length, 0);
assert.equal(purged.activeStationId, "station-b");
assert.equal(purged.ui.selectedStationId, "station-b");
assert.ok(purged.deletedStationIds.includes("station-a"));
assert.deepEqual(purged.itemCatalog, state.itemCatalog, "global item library must survive station purge");
assert.equal(validateStationDraft({ ...draft, stationCode: "A-01", stationName: "สถานี A ใหม่", province: "กรุงเทพมหานคร" }, purged.stationProfiles).valid, true, "purged station code can be reused");

const lastStationPurged = purgeStationFromState({
  ...state,
  stationProfiles: [profileA],
  inspectionRounds: [targetDraft, targetClosed],
  inspectionHistory: [],
  inspectionWorkspaces: [],
  activeStationId: "station-a",
  activeRoundId: targetDraft.id,
  ui: { selectedStationId: "station-a" },
}, "station-a");
const migratedAfterLastPurge = migrateChecklistState(lastStationPurged);
assert.deepEqual(migratedAfterLastPurge.stationProfiles, [], "purging the last station must not recreate Demo");
assert.equal(migratedAfterLastPurge.activeStationId, null);
assert.equal(migratedAfterLastPurge.ui.selectedStationId, null);

console.log("station lifecycle tests passed", JSON.stringify({
  customAsset: customAsset.assetNo,
  deletedAttachmentCount: impact.attachmentIds.length,
  sharedAttachmentCount: impact.sharedAttachmentIds.length,
}));
