import assert from "node:assert/strict";
import {
  CHECKLIST_POLICY_VERSION, PREVIOUS_CHECKLIST_POLICY_VERSION, PREVIOUS_CLEANING_CHECKLIST_POLICY_VERSION, LEGACY_CHECKLIST_POLICY_VERSION, CLEANING_TARGET_TYPES, createDefaultStationProfile, createInspectionRound, createSnapshot,
  getActivePhysicalEquipment, getItemsForSnapshot, getNewRoundChecklistItems, getStationChecklistItems, getRoundSummary,
  getCloseReadiness, makeEquipment, normalizeStationProfile, setStationChecklistItemEnabled,
} from "../src/domain/master-checklist.js";
import { getEvidenceCatalogForSnapshot, getEvidenceItemsForSnapshot } from "../src/domain/evidence-checklist.js";
import { isVehicleApiReviewItem } from "../src/domain/vehicle-search.js";
import { migrateChecklistState } from "../src/domain/storage.js";
import { buildReportTemplateModel } from "../src/domain/report-template.js";

const profile = normalizeStationProfile(createDefaultStationProfile());
assert.equal(CHECKLIST_POLICY_VERSION, "station-item-controls-v9", "new rounds use the installed-scope LPR and cleaning policy");
profile.stationSystems = profile.stationSystems.map((system) => system.id === "present-lpr-control"
  ? { ...system, scope: "High Speed" }
  : system);
profile.equipment.push(makeEquipment("LANE", 1, { id: "legacy-lane" }),
  makeEquipment("NVR", 2, { id: "nvr-extra" }),
  makeEquipment("PTZ_CAMERA", 2, { id: "ptz-inactive", active: false }));
const all = getStationChecklistItems(profile, { includeDisabled: true });
assert.equal(new Set(all.map((item) => item.id)).size, all.length);
assert.deepEqual(new Set(all.map((item) => item.assetId).filter(Boolean)), new Set(getActivePhysicalEquipment(profile.equipment).map((asset) => asset.id)));
assert.ok(all.every((item) => item.applicable));
assert.equal(all.filter((item) => item.assetId === "nvr-extra").length,
  all.filter((item) => item.assetId === profile.equipment.find((asset) => asset.type === "NVR").id).length);
const cameras = profile.equipment.filter((asset) => asset.type === "LPR_CAMERA");
const second = all.find((item) => item.assetId === cameras[1].id && item.id.startsWith("3.2.camera"));
const first = all.find((item) => item.assetId === cameras[0].id && item.id.startsWith("3.2.camera"));
assert.ok(first && second);
profile.checklistConfig = setStationChecklistItemEnabled(profile, second.id, false);
assert.ok(getStationChecklistItems(profile).some((item) => item.id === first.id));
assert.ok(!getStationChecklistItems(profile).some((item) => item.id === second.id));
profile.equipment.reverse();
profile.equipment = profile.equipment.filter((asset) => asset.id !== cameras[0].id);
profile.equipment.push(makeEquipment("LPR_CAMERA", 9, { id: "camera-added" }));
assert.ok(!getStationChecklistItems(profile).some((item) => item.id === second.id), "off control survives deletion, reordering and insertion");
assert.ok(getStationChecklistItems(profile).some((item) => item.assetId === "camera-added"));

// Every actual control, including general and cleaning, can be switched off/on.
const catalog = getStationChecklistItems(profile, { includeDisabled: true });
for (const item of catalog) {
  const config = setStationChecklistItemEnabled(profile, item.id, false);
  const off = { ...profile, checklistConfig: config };
  assert.ok(!getStationChecklistItems(off).some((row) => row.id === item.id), item.id);
  const on = { ...off, checklistConfig: setStationChecklistItemEnabled(off, item.id, true) };
  assert.ok(getStationChecklistItems(on).some((row) => row.id === item.id), item.id);
}
const oldRound = createInspectionRound(profile);
const frozenRound = JSON.stringify(oldRound);
const before = getItemsForSnapshot(oldRound.snapshot);
assert.deepEqual(getNewRoundChecklistItems(profile).map((item) => item.id),
  getStationChecklistItems(profile).map((item) => item.id),
  "the station Checklist preview and new-round generator use the same installed records");
const newSoftwareItems = before.filter((item) => item.sectionCode === "3.1");
const newHardwareItems = before.filter((item) => item.sectionCode === "3.2");
assert.equal(newSoftwareItems.filter((item) => Number.isInteger(item.laneNo)).length, 4,
  "LPR lane checks use only the two High Speed lanes covered by the installed LPR System");
assert.ok(newSoftwareItems.some((item) => item.systemRecordId === "present-lpr-control"
  && item.label.startsWith("License Plate Recognition Control System · ตรวจการทำงานของซอฟต์แวร์")));
assert.ok(newHardwareItems.length > 0);
assert.ok(newHardwareItems.every((item) => !item.id.includes("3.2.lane-") && !item.label.includes("ร่วมกับ WIM")),
  "new 3.2 hardware rows must not repeat lane-level LPR/WIM tests");

// A v1 Snapshot keeps its historical per-camera functional rows and wording.
const legacyProfile = {
  ...profile,
  equipment: [...profile.equipment, makeEquipment("LPR_CONTROL_SYSTEM", 99, { id: "legacy-lpr-control", scope: "High Speed" })],
};
const legacySourceSnapshot = createSnapshot(legacyProfile);
legacySourceSnapshot.equipment = [...legacySourceSnapshot.equipment, makeEquipment("LPR_CONTROL_SYSTEM", 99, { id: "legacy-lpr-control", scope: "High Speed" })];
const legacyPolicySnapshot = { ...legacySourceSnapshot, checklistPolicyVersion: LEGACY_CHECKLIST_POLICY_VERSION, evidenceCatalog: [] };
legacyPolicySnapshot.evidenceCatalog = getEvidenceCatalogForSnapshot(legacyPolicySnapshot);
const legacyPolicyRound = createInspectionRound(profile, {}, { snapshot: legacyPolicySnapshot });
const legacyPolicyItems = getEvidenceItemsForSnapshot(legacyPolicyRound.snapshot);
assert.ok(legacyPolicyItems.some((item) => item.sectionCode === "3.2" && item.id.includes("3.2.lane-")),
  "v1 historical rows must remain available");
assert.ok(legacyPolicyItems.some((item) => item.assetId === "legacy-lpr-control"
  && item.label === "ตรวจสภาพและการทำงานของอุปกรณ์"), "v1 historical system wording must remain frozen");
profile.equipment.find((asset) => asset.id === cameras[1].id).active = false;
const round = createInspectionRound(profile);
const items = getItemsForSnapshot(round.snapshot);
assert.equal(round.snapshot.checklistPolicyVersion, CHECKLIST_POLICY_VERSION);
assert.ok(!items.some((item) => item.assetId === cameras[1].id));
assert.equal(round.snapshot.equipment.length, getActivePhysicalEquipment(profile.equipment).length);
assert.deepEqual(items.map((item) => item.id), getStationChecklistItems(round.snapshot).map((item) => item.id));
const readinessIds = ["1.1.staff", "1.1.vehicle", "1.1.crane", "1.1.traffic-cone-light", "1.1.tools", "1.1.road-closure"];
assert.deepEqual(items.filter((item) => item.sectionCode === "1.1").map((item) => item.id), readinessIds,
  "new rounds keep the six station-level readiness checks");
const currentSlotIds = items.flatMap((item) => item.evidenceSlots.map((slot) => slot.id));
assert.equal(new Set(currentSlotIds).size, currentSlotIds.length, "current rounds must not reuse evidence-slot ids across lanes/assets");
assert.equal(items.some((item) => item.fieldType === "video"), false, "current rounds must not create video checklist fields");
const cleaningItems = items.filter((item) => item.isEquipmentCleaning);
const areaCleaningItems = items.filter((item) => item.isAreaCleaning);
const activeCleaningTargets = round.snapshot.equipment.filter((asset) => asset.active !== false && CLEANING_TARGET_TYPES.includes(asset.type));
assert.equal(cleaningItems.length, activeCleaningTargets.length,
  "new rounds create exactly one equipment-cleaning row per active target Asset");
assert.deepEqual(new Set(cleaningItems.map((item) => item.assetId)), new Set(activeCleaningTargets.map((asset) => asset.id)));
assert.equal(areaCleaningItems.length, 1 + round.snapshot.equipment.filter((asset) => asset.active !== false && asset.type === "CONTROL_CABINET").length,
  "new rounds create one room-area row plus one surrounding-area row per active cabinet");
assert.equal(items.filter((item) => item.isAreaCleaning || item.isEquipmentCleaning).reduce((total, item) => total + item.evidenceSlots.length, 0),
  (cleaningItems.length + areaCleaningItems.length) * 3,
  "every equipment and area cleaning row has three evidence slots");
const cleaningSections = {
  CONTROL_COMPUTER: "2.2", CONTROL_CABINET: "2.3", LPR_CAMERA: "3.2", FIXED_CAMERA: "4.1",
  PTZ_CAMERA: "4.1", NVR: "4.2", DATABASE_SERVER: "5.1", VMS_SIGN: "7.1",
  VMS_LIGHT_SENSOR: "7.1", VMS_DISPLAY: "7.1",
};
assert.ok(cleaningItems.every((item) => item.sectionCode === cleaningSections[item.cleaningAssetType]),
  "equipment cleaning uses its associated equipment category");
assert.ok(areaCleaningItems.some((item) => item.id === "2.2.control-room-area-cleaning"));
assert.ok(areaCleaningItems.filter((item) => item.cleaningAssetType === "CONTROL_CABINET").every((item) => item.sectionCode === "2.3"));
assert.equal(items.filter((item) => item.isNvrOperational).length,
  profile.equipment.filter((asset) => asset.active !== false && asset.type === "NVR").length * 2,
  "current rounds include HDD-failure and retention checks per active NVR");
assert.deepEqual(Object.keys(round.inspectionItems), items.map((item) => item.id));
assert.deepEqual(buildReportTemplateModel(round).sections.flatMap((section) => section.items).map((item) => item.id).sort(),
  items.filter((item) => !isVehicleApiReviewItem(item, round.snapshot)).map((item) => item.id).sort());
assert.deepEqual(buildReportTemplateModel(round).sections.find((section) => section.code === "1.1")?.items.map((item) => item.id), readinessIds,
  "the report keeps readiness as its own section");
const noDatabaseProfile = createDefaultStationProfile();
noDatabaseProfile.equipment = noDatabaseProfile.equipment.filter((asset) => asset.type !== "DATABASE_SERVER");
const noDatabaseRound = createInspectionRound(noDatabaseProfile);
const apiItemsWithoutDatabaseAsset = getItemsForSnapshot(noDatabaseRound.snapshot).filter((item) => isVehicleApiReviewItem(item, noDatabaseRound.snapshot));
assert.deepEqual(apiItemsWithoutDatabaseAsset.map((item) => item.id), ["5.1.plate-document", "5.1.vehicle-document"],
  "API review checks stay available as Data/Control checks without a physical database asset");
assert.ok(apiItemsWithoutDatabaseAsset.every((item) => !item.assetId && item.assetDependent === false),
  "API review checks are station/system-level, not database Asset rows");
assert.equal(getRoundSummary(round).total, items.filter((item) => !isVehicleApiReviewItem(item, round.snapshot)).length);
assert.equal(getRoundSummary(round).evidenceTotal, items.filter((item) => !isVehicleApiReviewItem(item, round.snapshot)).reduce((n, item) => n + item.evidenceSlots.length, 0));
assert.equal(getCloseReadiness(round).blockers.filter((entry) => entry.type === "item").length, items.filter((item) => !isVehicleApiReviewItem(item, round.snapshot)).length);
assert.equal(JSON.stringify(oldRound), frozenRound);
assert.deepEqual(getItemsForSnapshot(oldRound.snapshot), before);

// The immediately previous v2 policy stays readable with its historical
// lane-slot identity and without the newly introduced area/NVR controls.
const previousPolicySnapshot = {
  ...oldRound.snapshot,
  checklistPolicyVersion: PREVIOUS_CHECKLIST_POLICY_VERSION,
  evidenceCatalog: [],
};
const previousPolicyRound = createInspectionRound(profile, {}, { snapshot: previousPolicySnapshot });
const previousPolicyItems = getItemsForSnapshot(previousPolicyRound.snapshot);
assert.equal(previousPolicyItems.some((item) => item.isAreaCleaning || item.isNvrOperational), false);
const previousLaneSlots = previousPolicyItems
  .filter((item) => item.sectionCode === "3.1" && Number.isInteger(item.laneNo))
  .flatMap((item) => item.evidenceSlots.map((slot) => slot.id));
assert.ok(new Set(previousLaneSlots).size < previousLaneSlots.length, "previous v2 lane-slot identity remains available for historical rounds");

const v8Snapshot = { ...round.snapshot, checklistPolicyVersion: PREVIOUS_CLEANING_CHECKLIST_POLICY_VERSION, evidenceCatalog: [] };
const v8Items = getEvidenceItemsForSnapshot(v8Snapshot);
assert.equal(v8Items.some((item) => item.isAreaCleaning || item.isEquipmentCleaning), false,
  "an existing v8 round does not gain cleaning controls");
assert.equal(v8Items.filter((item) => item.isNvrOperational).length, items.filter((item) => item.isNvrOperational).length,
  "v8 keeps its prior NVR controls when the new cleaning policy is introduced");

const disabled = getStationChecklistItems(profile, { includeDisabled: true }).map((item) => item.id);
profile.checklistConfig = { ...profile.checklistConfig, disabledItemIds: disabled, legacyResolved: true };
assert.equal(getStationChecklistItems(profile).length, 0);
assert.throws(() => createInspectionRound(profile), /ไม่มีรายการตรวจที่เปิดใช้งาน/);
const state = { stationProfiles: [profile], inspectionRounds: [oldRound, { ...round, status: "closed", closedAt: "2026-09-05T00:00:00Z" }] };
const saved = migrateChecklistState(JSON.parse(JSON.stringify(state)));
assert.equal(getStationChecklistItems(saved.stationProfiles[0]).length, 0);
assert.deepEqual(getItemsForSnapshot(saved.inspectionRounds.find((r) => r.id === oldRound.id).snapshot), before);
assert.deepEqual(saved.inspectionRounds.find((r) => r.id === round.id).snapshot, round.snapshot);

// Older snapshots retain their original N/A rows and position-based identities.
const legacyConfigProfile = createDefaultStationProfile();
legacyConfigProfile.checklistConfig = { disabledTemplateIds: ["lpr-camera-2", "sensor-2", "1.1.staff"] };
const legacySnapshot = { ...createSnapshot(legacyConfigProfile), templateVersion: "checklist-master-v5-system-mapped", checklistPresentationVersion: null, checklistPolicyVersion: null, checklistConfig: legacyConfigProfile.checklistConfig };
legacySnapshot.evidenceCatalog = getEvidenceCatalogForSnapshot(legacySnapshot);
const legacyRound = createInspectionRound(legacyConfigProfile, {}, { snapshot: legacySnapshot });
const legacyBefore = getItemsForSnapshot(legacyRound.snapshot);
const upgraded = normalizeStationProfile(legacyConfigProfile);
const disabledLegacy = getStationChecklistItems(upgraded, { includeDisabled: true }).filter((item) => item.checklistDisabled);
assert.ok(disabledLegacy.some((item) => item.id === "1.1.staff"), "legacy disabled readiness control remains disabled");
assert.ok(disabledLegacy.some((item) => item.assetId === "sensor-2"));
upgraded.equipment.reverse();
assert.deepEqual(new Set(getStationChecklistItems(upgraded, { includeDisabled: true }).filter((i) => i.checklistDisabled).map((i) => i.id)),
  new Set(disabledLegacy.map((i) => i.id)));
assert.deepEqual(getItemsForSnapshot(legacyRound.snapshot), legacyBefore);
assert.ok(legacyBefore.some((item) => item.applicable === false));
const oldTemplateStation = { ...createDefaultStationProfile(), templateVersion: "checklist-master-v2" };
const upgradedRound = createInspectionRound(oldTemplateStation);
assert.equal(getRoundSummary(upgradedRound).evidenceTotal, upgradedRound.snapshot.evidenceCatalog.length);
assert.deepEqual(getItemsForSnapshot(upgradedRound.snapshot).map((item) => item.id), getStationChecklistItems(upgradedRound.snapshot).map((item) => item.id));
console.log("station checklist controls passed: all toggles, per-asset recipes, stable IDs, empty guard, counts, reports, persistence and frozen history");
