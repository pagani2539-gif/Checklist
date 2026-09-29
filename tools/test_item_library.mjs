import assert from "node:assert/strict";
import {
  EVIDENCE_ASSET_TYPE_MAPPING,
  BOQ_SYSTEMS,
  ITEM_LIBRARY_CATEGORIES,
  ITEM_LIBRARY_CATEGORY_CODES,
  STATION_ASSET_CATEGORY_CODES,
  canPlaceCatalogItemInCategory,
  createCustomItemCatalog,
  createDefaultStationProfile,
  createStationDraft,
  createEmptyStationDraft,
  createSnapshot,
  createSystemItemCatalog,
  getEquipmentCategoryCode,
  getEquipmentGroupsForRegister,
  getItemsForSnapshot,
  makeEquipmentFromCatalogItem,
  normalizeItemCatalog,
} from "../src/domain/master-checklist.js";
import { CURRENT_STATE_VERSION, migrateChecklistState } from "../src/domain/storage.js";

const systemCatalog = createSystemItemCatalog();
assert.equal(systemCatalog.length, 17, "the catalog must include all current Asset types without the retired LPR control Asset");
assert.equal(systemCatalog.find((item) => item.type === "IMAGE_PROCESSOR")?.categoryCode, "1.1.12");
assert.equal(systemCatalog.find((item) => item.type === "JOYSTICK")?.categoryCode, "4.1");
assert.deepEqual(ITEM_LIBRARY_CATEGORY_CODES, ["2.1", "2.2", "2.3", "3.1", "3.2", "4.1", "4.2", "5.1", "5.2", "7.1"]);
assert.equal(ITEM_LIBRARY_CATEGORIES.length, 10, "asset library groups must include every equipment BOQ category");
assert.ok(systemCatalog.every((item) => item.kind === "system" && item.active && STATION_ASSET_CATEGORY_CODES.includes(item.categoryCode)));
assert.equal(systemCatalog.some((item) => item.type === "LANE"), false, "Lane must never be an Item Library Asset");
assert.equal(systemCatalog.some((item) => item.type === "LPR_CONTROL_SYSTEM"), false, "the retired LPR control Asset must not be selectable");
assert.equal(systemCatalog.find((item) => item.type === "IMPS_DISPLAY_PROCESSING")?.categoryCode, "5.2");
assert.deepEqual(BOQ_SYSTEMS.map((system) => system.systemId), ["wim", "lpr", "cctv", "other"]);
assert.equal(systemCatalog.some((item) => item.type === "IMPS_CAMERA"), false, "standalone ImPS equipment must not be in the catalog");
assert.equal(systemCatalog.find((item) => item.type === "NVR").label, "เครื่องบันทึกภาพผ่านเครือข่าย");
assert.equal(systemCatalog.find((item) => item.type === "VMS_SIGN").label, "ป้ายข้อความเปลี่ยนแปลงได้");

const sensor = systemCatalog.find((item) => item.type === "WIM_SENSOR");
const custom = createCustomItemCatalog({ label: "อุปกรณ์ตรวจอุณหภูมิ", categoryCode: "2.1", prefix: "TEMP" });
assert.ok(custom);
assert.equal(custom.kind, "custom");
assert.equal(custom.type, "CUSTOM");
assert.equal(canPlaceCatalogItemInCategory(custom, "2.1"), true);
assert.equal(canPlaceCatalogItemInCategory(custom, "3.2"), false, "catalog items cannot cross BOQ groups");

const customAsset = makeEquipmentFromCatalogItem(custom, 1, { location: "จุดทดสอบ" });
assert.equal(customAsset.catalogItemId, custom.id);
assert.equal(customAsset.catalogItemLabel, custom.label);
assert.equal(customAsset.categoryCode, "2.1");
assert.equal(customAsset.assetNo, "TEMP-GEN-01");
assert.equal(getEquipmentCategoryCode(customAsset), "2.1");

const seededDraft = createEmptyStationDraft();
const seededCount = (type) => seededDraft.equipment.filter((entry) => entry.type === type).length;
assert.deepEqual(
  Object.fromEntries(["CONTROL_COMPUTER", "CONTROL_CABINET", "LPR_CAMERA", "FIXED_CAMERA", "NVR", "DATABASE_SERVER", "WIM_SENSOR", "WIM_LOOP"].map((type) => [type, seededCount(type)])),
  { CONTROL_COMPUTER: 0, CONTROL_CABINET: 0, LPR_CAMERA: 0, FIXED_CAMERA: 0, NVR: 0, DATABASE_SERVER: 0, WIM_SENSOR: 0, WIM_LOOP: 0 },
  "empty station fixtures keep Asset entries transient",
);
assert.equal(seededDraft.lanes.length, 0, "Lane topology starts empty and is not represented as Asset");
assert.equal(seededDraft.stationSystems.length, 0, "new Station Profile starts with zero Systems");

const customGroups = getEquipmentGroupsForRegister([customAsset]);
assert.equal(customGroups.length, 1);
assert.equal(customGroups[0].code, "2.1");
assert.equal(customGroups[0].types[0].isCustom, true);
assert.equal(customGroups[0].types[0].label, [custom.nameEn, custom.label].filter(Boolean).join(" · "));
assert.equal(customGroups[0].types[0].nameTh, custom.label);

const customProfile = {
  ...createDefaultStationProfile(),
  id: "station-custom-library-test",
  equipment: [customAsset],
};
const snapshot = createSnapshot(customProfile);
assert.equal(snapshot.equipment[0].catalogItemId, customAsset.catalogItemId, "Snapshot should copy catalog identity");
assert.equal(snapshot.equipment[0].catalogItemLabel, customAsset.catalogItemLabel, "Snapshot should copy display label");
assert.equal(snapshot.equipment[0].systemId, "wim");
const snapshotItems = getItemsForSnapshot(snapshot);
assert.equal(snapshotItems.filter((item) => item.assetId === customAsset.id).length, 1, "new rounds provide one general condition check for custom equipment");

const hiddenCatalog = normalizeItemCatalog([
  ...systemCatalog.map((item) => item.type === "WIM_SENSOR" ? { ...item, active: false } : item),
  custom,
]);
assert.equal(hiddenCatalog.find((item) => item.type === "WIM_SENSOR").active, false, "system catalog items can be hidden");
assert.equal(hiddenCatalog.filter((item) => item.kind === "custom").length, 1);

const migrated = migrateChecklistState({
  stationProfiles: [{
    id: "station-migration-test",
    stationCode: "MIG-01",
    stationName: "สถานีทดสอบ Migration",
    equipment: [{ id: "legacy-sensor", type: "WIM_SENSOR", assetNo: "SENSOR-01" }],
  }],
  inspectionRounds: [],
});
assert.equal(CURRENT_STATE_VERSION, 18);
assert.equal(migrated.version, 18);
assert.equal(migrated.itemCatalog.length, 24);
assert.equal(migrated.stationProfiles[0].equipment[0].catalogItemId, "system.wim_sensor");
assert.equal(migrated.stationProfiles[0].equipment[0].categoryCode, "2.1");

const historicalSnapshot = {
  id: "snapshot-history-locked",
  templateVersion: "checklist-master-history-v1",
  stationId: "station-history-locked",
  stationCode: "HIST-01",
  stationName: "สถานีประวัติเดิม",
  equipment: [{ id: "history-asset-1", type: "WIM_SENSOR", assetNo: "HIST-01", location: "จุดเดิม", serialNo: "SN-HIST" }],
  checklistConfig: { disabledTemplateIds: [] },
};
const migratedHistory = migrateChecklistState({
  version: 11,
  stationProfiles: [{ id: "station-history-locked", stationCode: "HIST-01", stationName: "สถานีประวัติเดิม", equipment: [] }],
  inspectionRounds: [{ id: "round-history-locked", stationId: "station-history-locked", status: "closed", closedAt: "2026-09-01T00:00:00.000Z", snapshot: historicalSnapshot, inspectionItems: {} }],
});
assert.deepEqual(migratedHistory.inspectionRounds[0].snapshot, historicalSnapshot, "state v12 migration must not rewrite a historical Snapshot");

console.log("item library smoke passed", JSON.stringify({
  systemItems: systemCatalog.length,
  categories: ITEM_LIBRARY_CATEGORIES.length,
  customSnapshotAssets: snapshot.equipment.length,
  customChecklistBindings: snapshotItems.filter((item) => item.assetId === customAsset.id).length,
  migratedVersion: migrated.version,
}));
