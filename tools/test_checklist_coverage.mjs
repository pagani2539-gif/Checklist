import assert from "node:assert/strict";
import {
  createDefaultStationProfile,
  createSnapshot,
  createCustomItemCatalog,
  getChecklistCoverageSummary,
  getItemsForSnapshot,
  makeEquipment,
  makeEquipmentFromCatalogItem,
  EQUIPMENT_TYPES,
} from "../src/domain/master-checklist.js";

const ownerSystemByAssetType = Object.freeze({
  CONTROL_COMPUTER: "wim-control",
  CONTROL_CABINET: "wim-electronics-system",
  WIM_AC_DC_POWER_SUPPLY: "wim-electronics-system",
  WIM_NETWORK_EQUIPMENT: "wim-electronics-system",
  WIM_CONTROLLER: "wim-electronics-system",
  WIM_PHASE_PROTECTION: "wim-electronics-system",
  WIM_SUB_BREAKER: "wim-electronics-system",
  WIM_SWITCHING_DC: "wim-electronics-system",
  WIM_TRANSFORMER_24VAC: "wim-electronics-system",
  LPR_CONTROL_SYSTEM: "lpr-control",
  LPR_CAMERA: "lpr-control",
  FIXED_CAMERA: "cctv-system",
  PTZ_CAMERA: "cctv-system",
  NVR: "cctv-system",
  JOYSTICK: "cctv-system",
  LASER_SCANNER: "dimension-management",
  DIMENSION_CONTROLLER: "dimension-management",
  IMAGE_PROCESSOR: "image-processing-management",
  VMS_SIGN: "vms-control",
  VMS_LIGHT_SENSOR: "vms-control",
  VMS_DISPLAY: "vms-control",
  DATABASE_SERVER: "data-management",
  IMPS_DISPLAY_PROCESSING: "station-display",
});
const electronicsChildTypes = new Set([
  "WIM_AC_DC_POWER_SUPPLY",
  "WIM_NETWORK_EQUIPMENT",
  "WIM_CONTROLLER",
  "WIM_PHASE_PROTECTION",
  "WIM_SUB_BREAKER",
  "WIM_SWITCHING_DC",
  "WIM_TRANSFORMER_24VAC",
]);

function profileWithOwnerSystem(profile, type) {
  const canonicalItemId = ownerSystemByAssetType[type];
  if (!canonicalItemId) return profile;
  const scope = canonicalItemId === "dimension-management" ? "3D" : null;
  return {
    ...profile,
    stationSystems: [...(profile.stationSystems || []), {
      id: `coverage-system-${canonicalItemId}-${type.toLowerCase()}`,
      canonicalItemId,
      quantity: 1,
      active: true,
      ...(scope ? { scope } : {}),
    }],
  };
}

const profile = {
  ...createDefaultStationProfile(),
  id: "station-coverage-test",
  equipment: [
    makeEquipment("WIM_SENSOR", 1, { id: "coverage-sensor-1", parentSystemId: "wim-sorting-1", laneId: "lane-1" }),
    makeEquipment("CONTROL_CABINET", 1, { id: "coverage-cabinet-1" }),
    makeEquipment("NVR", 1, { id: "coverage-inactive-nvr", active: false }),
  ],
};
const snapshot = createSnapshot(profile);
const items = getItemsForSnapshot(snapshot);
const coverage = getChecklistCoverageSummary(snapshot, items);

assert.equal(coverage.equipmentCount, 2, "inactive equipment must not enter the new Snapshot");
assert.equal(coverage.coveredEquipmentCount, 2, "every active equipment must have at least one applicable Checklist item");
assert.equal(coverage.missingEquipmentCount, 0);
assert.equal(coverage.orphanAssetItemCount, 0);
assert.equal(coverage.complete, true);
assert.equal(items.find((item) => item.assetId === "coverage-cabinet-1")?.assetName, "WIM Electronics Cabinet · ตู้ควบคุมอิเล็กทรอนิกส์ WIM");

const missingWimElectronicsTypes = [
  ["WIM_AC_DC_POWER_SUPPLY", "ACDC-01"],
  ["WIM_CONTROLLER", "WIMCTRL-01"],
  ["WIM_PHASE_PROTECTION", "PHASE-01"],
  ["WIM_SUB_BREAKER", "BRK-01"],
  ["WIM_SWITCHING_DC", "SWDC-01"],
  ["WIM_TRANSFORMER_24VAC", "TR24-01"],
];
const electronicsCabinet = makeEquipment("CONTROL_CABINET", 1, { id: "coverage-test-cabinet", assetNo: "CAB-01", scope: "High Speed" });
const electronicsAssets = [
  electronicsCabinet,
  makeEquipment("WIM_NETWORK_EQUIPMENT", 1, { id: "coverage-test-network", assetNo: "NET-01", parentAssetId: electronicsCabinet.id, scope: "High Speed" }),
  ...missingWimElectronicsTypes.map(([type, assetNo]) => makeEquipment(type, 1, { id: `coverage-${assetNo}`, assetNo, scope: "High Speed" })),
];
const electronicsProfile = {
  ...createDefaultStationProfile(),
  id: "station-wim-electronics-parent-test",
  stationFormat: "SC",
  stationSystems: [{ id: "wim-electronics-system-test", canonicalItemId: "wim-electronics-system", systemId: "wim-electronics-system", quantity: 1, scope: "High Speed", active: true }],
  equipment: electronicsAssets,
};
const unlinkedElectronicsSnapshot = createSnapshot(electronicsProfile);
const unlinkedElectronicsCoverage = getChecklistCoverageSummary(unlinkedElectronicsSnapshot, getItemsForSnapshot(unlinkedElectronicsSnapshot));
assert.deepEqual(unlinkedElectronicsCoverage.missingEquipment.map((asset) => asset.assetNo), missingWimElectronicsTypes.map(([, assetNo]) => assetNo), "six WIM Electronics Assets without a Cabinet parent remain visible as uncovered");
const linkedElectronicsProfile = { ...electronicsProfile, equipment: electronicsAssets.map((asset) => asset.type === "CONTROL_CABINET" || asset.type === "WIM_NETWORK_EQUIPMENT" ? asset : { ...asset, parentAssetId: electronicsCabinet.id }) };
const linkedElectronicsSnapshot = createSnapshot(linkedElectronicsProfile);
const linkedElectronicsCoverage = getChecklistCoverageSummary(linkedElectronicsSnapshot, getItemsForSnapshot(linkedElectronicsSnapshot));
assert.equal(linkedElectronicsCoverage.coveredEquipmentCount, electronicsAssets.length, "linking the six children to the active Cabinet restores their Checklist coverage");
assert.equal(linkedElectronicsCoverage.missingEquipmentCount, 0);

const standardCoverage = EQUIPMENT_TYPES.filter((definition) => !definition.legacyOnly).map((definition) => {
  const wimParent = definition.value === "WIM_SENSOR" || definition.value === "WIM_LOOP"
    ? { parentSystemId: "wim-sorting-1", laneId: "lane-1" }
    : {};
  const parentCabinet = electronicsChildTypes.has(definition.value)
    ? makeEquipment("CONTROL_CABINET", 9, { id: `coverage-${definition.value.toLowerCase()}-cabinet` })
    : null;
  const oneAsset = makeEquipment(definition.value, 1, {
    id: `coverage-${definition.value.toLowerCase()}-1`,
    ...wimParent,
    ...(parentCabinet ? { parentAssetId: parentCabinet.id } : {}),
  });
  const supportingAssets = parentCabinet ? [parentCabinet] : [];
  const oneSnapshot = createSnapshot(profileWithOwnerSystem({ ...createDefaultStationProfile(), id: `station-${definition.value.toLowerCase()}-one`, equipment: [...supportingAssets, oneAsset] }, definition.value));
  const oneItems = getItemsForSnapshot(oneSnapshot);
  const oneSummary = getChecklistCoverageSummary(oneSnapshot, oneItems);
  assert.equal(oneSummary.coveredEquipmentCount, supportingAssets.length + 1, `${definition.value} must have an applicable Checklist item`);
  assert.equal(oneSummary.missingEquipmentCount, 0, `${definition.value} must not be reported as missing`);
  assert.ok(oneItems.some((item) => item.assetId === oneAsset.id), `${definition.value} must produce an asset-bound Checklist item`);

  const secondAsset = makeEquipment(definition.value, 2, {
    id: `coverage-${definition.value.toLowerCase()}-2`,
    ...wimParent,
    ...(parentCabinet ? { parentAssetId: parentCabinet.id } : {}),
  });
  const twoSnapshot = createSnapshot(profileWithOwnerSystem({ ...createDefaultStationProfile(), id: `station-${definition.value.toLowerCase()}-two`, equipment: [...supportingAssets, oneAsset, secondAsset] }, definition.value));
  const twoItems = getItemsForSnapshot(twoSnapshot);
  const oneAssetItemCount = oneItems.filter((item) => item.assetId === oneAsset.id).length;
  const twoAssetItemCount = twoItems.filter((item) => item.assetId === oneAsset.id || item.assetId === secondAsset.id).length;
  assert.equal(twoAssetItemCount, oneAssetItemCount * 2, `${definition.value} Checklist items must follow equipment quantity`);
  return { type: definition.value, oneAssetItems: oneAssetItemCount, twoAssetItems: twoAssetItemCount };
});

const dedicatedRecipeExpectations = Object.freeze({
  JOYSTICK: { sectionCode: "4.1", minimumItems: 3 },
  IMPS_DISPLAY_PROCESSING: { sectionCode: "5.2", minimumItems: 3 },
  LASER_SCANNER: { sectionCode: "1.1.5", minimumItems: 3 },
  DIMENSION_CONTROLLER: { sectionCode: "1.1.5", minimumItems: 3 },
  IMAGE_PROCESSOR: { sectionCode: "1.1.12", minimumItems: 3 },
  CONTROL_CABINET: { sectionCode: "2.3", minimumItems: 3 },
});

const dedicatedRecipeCoverage = Object.entries(dedicatedRecipeExpectations).map(([type, expectation]) => {
  const asset = makeEquipment(type, 1, { id: `coverage-dedicated-${type.toLowerCase()}-1` });
  const dedicatedSnapshot = createSnapshot(profileWithOwnerSystem({ ...createDefaultStationProfile(), id: `station-dedicated-${type.toLowerCase()}`, equipment: [asset] }, type));
  const dedicatedItems = getItemsForSnapshot(dedicatedSnapshot).filter((item) => item.assetId === asset.id && item.applicable !== false);
  const assetIds = new Set(dedicatedItems.map((item) => item.id));
  assert.ok(dedicatedItems.length >= expectation.minimumItems, `${type} must have at least ${expectation.minimumItems} dedicated Checklist items`);
  assert.ok(dedicatedItems.every((item) => item.sectionCode === expectation.sectionCode), `${type} dedicated Checklist items must stay in ${expectation.sectionCode}`);
  assert.ok(dedicatedItems.every((item) => item.isGenericFallback !== true), `${type} must not use generic Checklist fallback`);
  assert.equal(assetIds.size, dedicatedItems.length, `${type} dedicated Checklist item IDs must be unique`);
  const secondAsset = makeEquipment(type, 2, { id: `coverage-dedicated-${type.toLowerCase()}-2` });
  const multiAssetSnapshot = createSnapshot(profileWithOwnerSystem({ ...createDefaultStationProfile(), id: `station-dedicated-${type.toLowerCase()}-multi`, equipment: [asset, secondAsset] }, type));
  const multiAssetItems = getItemsForSnapshot(multiAssetSnapshot).filter((item) => item.applicable !== false && (item.assetId === asset.id || item.assetId === secondAsset.id));
  const firstAssetItems = multiAssetItems.filter((item) => item.assetId === asset.id);
  const secondAssetItems = multiAssetItems.filter((item) => item.assetId === secondAsset.id);
  assert.ok(firstAssetItems.length >= expectation.minimumItems, `${type} first Asset must retain dedicated items`);
  assert.ok(secondAssetItems.length >= expectation.minimumItems, `${type} second Asset must retain dedicated items`);
  assert.equal(new Set(multiAssetItems.map((item) => item.id)).size, multiAssetItems.length, `${type} multi-Asset item IDs must be unique`);
  assert.ok(firstAssetItems.every((item) => !secondAssetItems.some((other) => other.id === item.id)), `${type} Assets must not share Checklist item IDs`);
  const coverageSummary = getChecklistCoverageSummary(dedicatedSnapshot, getItemsForSnapshot(dedicatedSnapshot));
  assert.equal(coverageSummary.coveredEquipmentCount, 1, `${type} dedicated Checklist must cover its Asset`);
  assert.equal(coverageSummary.missingEquipmentCount, 0, `${type} must not be reported as missing`);
  return { type, sectionCode: expectation.sectionCode, itemCount: dedicatedItems.length };
});

const historicalSnapshot = createSnapshot({
  ...createDefaultStationProfile(),
  id: "station-historical-dedicated-recipe-test",
  equipment: [makeEquipment("JOYSTICK", 1, { id: "historical-joystick-1" })],
});
delete historicalSnapshot.assetChecklistRecipeVersion;
const historicalItems = getItemsForSnapshot(historicalSnapshot).filter((item) => item.assetId === "historical-joystick-1");
assert.equal(historicalItems.length, 1, "historical Snapshot must retain its original single fallback item");
assert.equal(historicalItems[0].label, "ตรวจสภาพและการทำงานของอุปกรณ์", "historical Snapshot must not receive the new dedicated recipe");

const missingCoverage = getChecklistCoverageSummary(snapshot, items.filter((item) => item.assetId !== "coverage-sensor-1"));
assert.deepEqual(missingCoverage.missingEquipment.map((asset) => asset.id), ["coverage-sensor-1"]);
assert.equal(missingCoverage.complete, false);

const orphanCoverage = getChecklistCoverageSummary(snapshot, [...items, { id: "coverage-ghost-item", assetId: "coverage-ghost", applicable: true }]);
assert.equal(orphanCoverage.orphanAssetItemCount, 1);
assert.equal(orphanCoverage.complete, false);

const customCatalogItem = createCustomItemCatalog({ label: "อุปกรณ์ตรวจอุณหภูมิ", categoryCode: "2.1", prefix: "TEMP" });
const customAsset = makeEquipmentFromCatalogItem(customCatalogItem, 1, { id: "coverage-custom-1" });
const customSnapshot = createSnapshot({ ...createDefaultStationProfile(), id: "station-custom-coverage-test", equipment: [customAsset] });
const customItems = getItemsForSnapshot(customSnapshot);
const customCoverage = getChecklistCoverageSummary(customSnapshot, customItems);
assert.equal(customCoverage.coveredEquipmentCount, 1);
assert.equal(customCoverage.genericEquipmentCount, 1, "custom equipment must be identified as generic-only coverage");
assert.equal(customCoverage.complete, true);

console.log("checklist coverage passed", JSON.stringify({
  activeEquipment: coverage.equipmentCount,
  assetChecklistItems: coverage.assetItemCount,
  sharedChecklistItems: coverage.sharedItemCount,
  standardTypesChecked: standardCoverage.length,
  dedicatedTypesChecked: dedicatedRecipeCoverage.length,
  customGenericEquipment: customCoverage.genericEquipmentCount,
}));
