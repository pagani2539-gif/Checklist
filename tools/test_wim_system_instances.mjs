import assert from "node:assert/strict";
import {
  buildStationSystemSummaryModel,
  createInspectionRound,
  createSnapshot,
  getItemsForSnapshot,
  getCloseReadiness,
  getStationReadiness,
  getWimSortingInstalledQuantity,
  getWimSortingSystemInstances,
  makeEquipment,
  makeLane,
  normalizeStationProfile,
  WIM_SORTING_SYSTEM_CANONICAL_ID,
} from "../src/domain/master-checklist.js";
import { buildReportTemplateModel } from "../src/domain/report-template.js";

const system = (id, laneId, instanceNo, scope = "High Speed") => ({
  id,
  canonicalItemId: WIM_SORTING_SYSTEM_CANONICAL_ID,
  systemId: WIM_SORTING_SYSTEM_CANONICAL_ID,
  componentId: "sorting",
  displayLabel: "ระบบคัดแยกน้ำหนัก WIM",
  nameEn: "WIM Sorting System",
  sourceLabel: "WIM SORTING SYSTEM",
  sourceRefs: ["2.1"],
  quantity: 1,
  referenceUnit: "ระบบ",
  unit: "ระบบ",
  laneId,
  instanceNo,
  scope,
  checklistMapping: ["2.1"],
  active: true,
  recordKind: "system",
});

const systems = [system("wim-1", "lane-1", 1), system("wim-2", "lane-2", 2)];
const lanes = [1, 2, 3].map((laneNo) => makeLane(laneNo));
const sensors = [
  ...Array.from({ length: 6 }, (_, index) => makeEquipment("WIM_SENSOR", index + 1, {
    id: `sensor-1-${index + 1}`,
    assetNo: `SENSOR-1-${index + 1}`,
    location: `Lane 1 Sensor ${index + 1}`,
    serialNo: `SN-S1-${index + 1}`,
    parentSystemId: "wim-1",
    laneId: "lane-1",
  })),
  ...Array.from({ length: 4 }, (_, index) => makeEquipment("WIM_SENSOR", index + 7, {
    id: `sensor-2-${index + 1}`,
    assetNo: `SENSOR-2-${index + 1}`,
    location: `Lane 2 Sensor ${index + 1}`,
    serialNo: `SN-S2-${index + 1}`,
    parentSystemId: "wim-2",
    laneId: "lane-2",
  })),
];
const loops = [
  ...Array.from({ length: 2 }, (_, index) => makeEquipment("WIM_LOOP", index + 1, {
    id: `loop-1-${index + 1}`,
    assetNo: `LOOP-1-${index + 1}`,
    location: `Lane 1 Loop ${index + 1}`,
    serialNo: `SN-L1-${index + 1}`,
    parentSystemId: "wim-1",
    laneId: "lane-1",
  })),
  makeEquipment("WIM_LOOP", 3, {
    id: "loop-2-1",
    assetNo: "LOOP-2-1",
    location: "Lane 2 Loop 1",
    serialNo: "SN-L2-1",
    parentSystemId: "wim-2",
    laneId: "lane-2",
  }),
];
const profile = normalizeStationProfile({
  id: "wim-instance-test",
  stationFormat: "SC",
  stationCode: "WIM-INSTANCE-01",
  stationName: "WIM Instance Test",
  province: "นครปฐม",
  stationSystems: systems,
  lanes,
  equipment: [...sensors, ...loops],
});

assert.equal(getWimSortingInstalledQuantity(profile.stationSystems), 2);
assert.deepEqual(getWimSortingSystemInstances(profile.stationSystems).map((entry) => entry.laneId), ["lane-1", "lane-2"]);
assert.equal(getStationReadiness(profile).blockers.length, 0, "variable child counts do not block a valid WIM parent model");

const round = createInspectionRound(profile);
const items = getItemsForSnapshot(round.snapshot);
const wimItems = items.filter((item) => item.sectionCode === "2.1" && item.assetId);
const wimSystemItems = items.filter((item) => item.sectionCode === "2.1" && item.systemRecordId);
assert.equal(round.snapshot.wimSortingEvidenceVersion, "wim-sorting-evidence-v1",
  "new rounds record the WIM-only evidence policy in their Snapshot");
assert.equal(wimSystemItems.length, 2, "each installed WIM Sorting System gets one system-level evidence row");
assert.ok(wimSystemItems.every((item) => item.evidenceSlots.length === 2
  && item.evidenceSlots.some((slot) => slot.photoPurpose === "wim-installation" && slot.photoRequired)
  && item.evidenceSlots.some((slot) => slot.photoPurpose === "wim-weight-result" && slot.photoRequired)),
"each WIM system requires one installation photo and one processed-weight result photo");
assert.equal(items.some((item) => /^2\.1\.road-/.test(item.id)), false,
  "new WIM rounds use per-system installation evidence instead of the old three generic road photos");
assert.ok(items.filter((item) => item.assetId && item.assetId.startsWith("loop-")).every((item) =>
  item.evidenceSlots.some((slot) => slot.photoPurpose === "wim-loop-site" && slot.photoRequired)),
"each installed WIM Loop keeps one required field photo");
const printableModel = buildReportTemplateModel(round);
const printableWimRows = printableModel.sections.flatMap((section) => section.items
  .filter((item) => item.id.includes("system-check::system::") || item.id.includes("loop::asset::")));
assert.ok(printableWimRows.length > 0 && printableWimRows.every((item) => item.evidenceSlots.every((slot) => !slot.photoPurpose || slot.photoRequired)),
  "required WIM photo slots are carried into the printable report model");
const completedWithoutPhotos = Object.fromEntries(items.map((item) => [item.id, {
  status: "normal",
  note: "",
  evidence: Object.fromEntries(item.evidenceSlots.map((slot) => [slot.id, { status: "complete", attachment: null }])),
}]));
const expectedWimPhotoSlots = new Set(wimSystemItems
  .flatMap((item) => item.evidenceSlots.filter((slot) => slot.photoRequired).map((slot) => slot.id))
  .concat(items.filter((item) => item.assetId?.startsWith("loop-")).flatMap((item) => item.evidenceSlots
    .filter((slot) => slot.photoRequired).map((slot) => slot.id))));
const withoutWimPhotosReadiness = getCloseReadiness({ ...round, inspectionItems: completedWithoutPhotos });
const missingWimPhotos = withoutWimPhotosReadiness.blockers
  .filter((entry) => entry.type === "evidence-photo" && expectedWimPhotoSlots.has(entry.slotId));
assert.deepEqual(new Set(missingWimPhotos.map((entry) => entry.slotId)), expectedWimPhotoSlots,
  "a completed photo status without an attached file keeps each required WIM photo listed as incomplete");
assert.equal(withoutWimPhotosReadiness.canClose, false, "missing required WIM photos remain incomplete");
assert.equal(withoutWimPhotosReadiness.canConfirmClose, true, "unresolved Vehicle API requirements can be acknowledged when closing this round");
const completedWithWimPhotos = Object.fromEntries(items.map((item) => [item.id, {
  status: "normal",
  note: "",
  evidence: Object.fromEntries(item.evidenceSlots.map((slot) => [slot.id, {
    status: "complete",
    attachment: slot.photoRequired ? { id: `attachment-${slot.id}` } : null,
  }])),
}]));
assert.equal(getCloseReadiness({ ...round, inspectionItems: completedWithWimPhotos }).blockers
  .some((entry) => entry.type === "evidence-photo" && expectedWimPhotoSlots.has(entry.slotId)), false,
"attached WIM photos clear their incomplete-photo findings");
const oldWimSnapshot = { ...round.snapshot };
delete oldWimSnapshot.wimSortingEvidenceVersion;
oldWimSnapshot.checklistPresentationVersion = null;
const oldWimItems = getItemsForSnapshot(oldWimSnapshot);
assert.equal(oldWimItems.filter((item) => /^2\.1\.road-/.test(item.id)).length, 3,
  "a stored Snapshot without the WIM evidence marker retains its three original site photo slots");
assert.ok(oldWimItems.filter((item) => item.systemRecordId?.startsWith("wim-")).every((item) => item.evidenceSlots.length === 1
  && !item.evidenceSlots.some((slot) => slot.photoRequired)),
"a stored Snapshot without the marker retains the original WIM system evidence shape");
const reopenedOldRound = createInspectionRound(profile, {}, { snapshot: oldWimSnapshot });
const reopenedOldItems = getItemsForSnapshot(reopenedOldRound.snapshot);
assert.equal(reopenedOldItems.filter((item) => /^2\.1\.road-/.test(item.id)).length, 3,
  "reopening a stored Snapshot does not apply the new WIM evidence policy retroactively");
assert.ok(reopenedOldItems.filter((item) => item.systemRecordId?.startsWith("wim-")).every((item) => item.evidenceSlots.length === 1),
  "reopening an old Snapshot preserves its original one-slot WIM system rows");
assert.equal(wimItems.length, 13, "new WIM checklist rows follow actual parent-linked Sensor/Loop counts");
assert.deepEqual(new Set(wimItems.map((item) => item.laneId)), new Set(["lane-1", "lane-2"]));
assert.equal(wimItems.some((item) => item.laneId === "lane-3"), false, "a physical Lane without WIM stays out of WIM rows");
assert.ok(wimItems.every((item) => item.label.includes("WIM Sorting System #")));
assert.equal(items.filter((item) => item.sectionCode === "3.1" && item.laneId).length, 0,
  "lane topology without an installed same-scope LPR System does not create LPR checks");

const summary = buildStationSystemSummaryModel(profile.stationSystems, profile.equipment);
const installed = summary.systemOnly.filter((entry) => entry.status === "installed-system");
assert.equal(installed.length, 2);
assert.deepEqual(installed.map((entry) => entry.childCounts), [
  { WIM_SENSOR: 6, WIM_LOOP: 2 },
  { WIM_SENSOR: 4, WIM_LOOP: 1 },
]);

const mixedScopeProfile = normalizeStationProfile({
  id: "wim-mixed-scope-test",
  stationFormat: "SC",
  stationCode: "WIM-MIXED-SCOPE-01",
  stationName: "WIM Mixed Scope Test",
  province: "นครปฐม",
  stationSystems: [
    system("wim-high", "lane-1", 1, "High Speed"),
    system("wim-low", "lane-2", 2, "Low Speed"),
  ],
  lanes,
  equipment: [
    makeEquipment("WIM_SENSOR", 21, { id: "sensor-high", assetNo: "SENSOR-HIGH", parentSystemId: "wim-high", laneId: "lane-1", scope: "High Speed" }),
    makeEquipment("WIM_LOOP", 21, { id: "loop-high", assetNo: "LOOP-HIGH", parentSystemId: "wim-high", laneId: "lane-1", scope: "High Speed" }),
    makeEquipment("WIM_SENSOR", 22, { id: "sensor-low", assetNo: "SENSOR-LOW", parentSystemId: "wim-low", laneId: "lane-2", scope: "Low Speed" }),
    makeEquipment("WIM_LOOP", 22, { id: "loop-low", assetNo: "LOOP-LOW", parentSystemId: "wim-low", laneId: "lane-2", scope: "Low Speed" }),
  ],
});
assert.equal(getWimSortingInstalledQuantity(mixedScopeProfile.stationSystems), 2, "High Speed and Low Speed WIM instances can coexist");
assert.deepEqual(
  getWimSortingSystemInstances(mixedScopeProfile.stationSystems).map((entry) => ({ scope: entry.scope, laneId: entry.laneId })),
  [{ scope: "High Speed", laneId: "lane-1" }, { scope: "Low Speed", laneId: "lane-2" }],
  "mixed WIM scopes retain separate Lane parents",
);
assert.equal(getStationReadiness(mixedScopeProfile).blockers.length, 0, "mixed WIM scopes do not conflict when each uses a different Lane");
const mixedScopeItems = getItemsForSnapshot(createInspectionRound(mixedScopeProfile).snapshot).filter((item) => item.sectionCode === "2.1" && item.assetId);
assert.deepEqual(new Set(mixedScopeItems.map((item) => item.laneId)), new Set(["lane-1", "lane-2"]), "mixed WIM checklist rows retain both Lane contexts");

const scopeOrderingProfile = normalizeStationProfile({
  ...mixedScopeProfile,
  id: "wim-scope-order-test",
  stationCode: "WIM-SCOPE-ORDER-01",
  stationSystems: [
    system("wim-order-imps", "lane-3", 3, "ImPS"),
    system("wim-order-low", "lane-2", 2, "Low Speed"),
    system("wim-order-high", "lane-1", 1, "High Speed"),
  ],
});
const orderedWimSystems = getItemsForSnapshot(createInspectionRound(scopeOrderingProfile).snapshot)
  .filter((item) => item.sectionCode === "2.1" && item.systemRecordId);
assert.deepEqual(orderedWimSystems.map((item) => item.scope), ["High Speed", "Low Speed", "ImPS"],
  "new WIM system evidence follows High Speed, Low Speed, then ImPS order");
assert.ok(orderedWimSystems[0].label.includes("Lane 1"), "WIM system evidence displays the actual Lane number");

const duplicateLane = normalizeStationProfile({
  ...profile,
  stationSystems: [...profile.stationSystems, system("wim-duplicate", "lane-1", 3)],
});
assert.ok(getStationReadiness(duplicateLane).blockers.some((entry) => entry.code === "WIM_SYSTEM_LANE_DUPLICATE"));

const missingParent = normalizeStationProfile({
  ...profile,
  equipment: [...profile.equipment, makeEquipment("WIM_SENSOR", 99, { id: "sensor-no-parent", assetNo: "SENSOR-NO-PARENT", location: "Lane 1" })],
});
assert.ok(getStationReadiness(missingParent).blockers.some((entry) => entry.code === "WIM_PARENT_SYSTEM_REQUIRED"));
assert.equal(getItemsForSnapshot(createSnapshot(missingParent)).filter((item) => item.assetId === "sensor-no-parent").length, 0, "an unparented WIM asset is not silently turned into an active new-round row");

const noChildren = normalizeStationProfile({
  ...profile,
  equipment: profile.equipment.filter((entry) => entry.parentSystemId !== "wim-2"),
});
assert.equal(getStationReadiness(noChildren).blockers.length, 0);
assert.ok(getStationReadiness(noChildren).warnings.some((entry) => entry.code === "WIM_SYSTEM_NO_CHILD_ASSETS"));

assert.equal(round.snapshot.equipment.find((entry) => entry.id === "sensor-1-1")?.parentSystemId, "wim-1");
assert.equal(round.snapshot.equipment.find((entry) => entry.id === "sensor-1-1")?.laneId, "lane-1");
console.log("WIM system instance smoke passed: per-lane parents, variable child counts, physical Lane separation, checklist binding, readiness and Snapshot fields");
