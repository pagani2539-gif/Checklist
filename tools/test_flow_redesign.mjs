import assert from "node:assert/strict";
import { parseHash, primaryRouteFor } from "../src/app/router.js";
import {
  createDefaultStationProfile,
  createInspectionRound,
  getCloseReadiness,
  getItemsForSnapshot,
  getRoundSummary,
} from "../src/domain/master-checklist.js";
import { createVehicleSearchConfig } from "../src/domain/vehicle-search.js";
import { createRevisionRound } from "../src/domain/correction.js";
import { CURRENT_STATE_VERSION, migrateChecklistState } from "../src/domain/storage.js";

function completeRound(round) {
  const items = getItemsForSnapshot(round.snapshot);
  const inspectionItems = Object.fromEntries(Object.entries(round.inspectionItems).map(([id, value]) => {
    const item = items.find((entry) => entry.id === id);
    const evidence = Object.fromEntries((item?.evidenceSlots || []).map((slot) => [slot.id, {
      ...(value.evidence?.[slot.id] || {}),
      status: "complete",
      note: value.evidence?.[slot.id]?.note || "",
      ...(slot.cleaningStage || slot.photoRequired ? { attachment: { id: `required-${slot.id}`, name: `${slot.cleaningStage || "evidence"}.jpg`, type: "image/jpeg" } } : {}),
    }]));
    return [id, { ...value, status: item?.applicable === false ? "na" : "normal", evidence }];
  }));
  return {
    ...round,
    inspectionItems,
    vehicleSearch: {
      criteria: {},
      fetchedAt: "2026-09-03T00:00:00.000Z",
      sourceStation: { id: round.snapshot.vehicleSearchConfig.stationId, name: round.snapshot.vehicleSearchConfig.stationName },
      rows: Array.from({ length: 100 }, (_, index) => ({
        id: `flow-vehicle-${index + 1}`,
        plateNumber: `กก-${String(index + 1).padStart(4, "0")}`,
        reviewStatus: "correct",
        classificationReviewStatus: "correct",
        axleReviewStatus: "correct",
        integrityReviewStatus: "correct",
        grossWeight: 8000,
      })),
    },
  };
}

const profile = createDefaultStationProfile();
profile.vehicleSearchConfig = createVehicleSearchConfig({ baseUrl: "http://vehicle-api.test:3005", stationId: profile.id, stationName: profile.stationName });
const draft = createInspectionRound(profile, { projectName: "Flow test" });
const ready = completeRound(draft);
assert.equal(getCloseReadiness(ready).canClose, true, "a complete round should close");
assert.equal(getCloseReadiness(ready).canConfirmClose, true, "a complete round should allow close confirmation");

const firstItem = getItemsForSnapshot(ready.snapshot).find((item) => item.applicable !== false);
const firstSlot = firstItem.evidenceSlots[0];
const pendingItem = { ...ready, inspectionItems: { ...ready.inspectionItems, [firstItem.id]: { ...ready.inspectionItems[firstItem.id], status: "pending" } } };
const pendingReadiness = getCloseReadiness(pendingItem);
assert.equal(pendingReadiness.blockers.some((entry) => entry.type === "item" && entry.itemId === firstItem.id), true);
assert.equal(pendingReadiness.canClose, false, "an uninspected item remains incomplete");
assert.equal(pendingReadiness.canConfirmClose, true, "an uninspected item is a warning, not a close blocker");

const allPending = {
  ...ready,
  inspectionItems: Object.fromEntries(getItemsForSnapshot(ready.snapshot).map((item) => [item.id, {
    ...ready.inspectionItems[item.id],
    status: item.applicable === false ? "na" : "pending",
    evidence: Object.fromEntries((item.evidenceSlots || []).map((slot) => [slot.id, {
      ...(ready.inspectionItems[item.id]?.evidence?.[slot.id] || {}),
      status: "pending",
      attachment: null,
    }])),
  }]))
};
const allPendingBefore = JSON.stringify(allPending);
const allPendingReadiness = getCloseReadiness(allPending);
assert.equal(allPendingReadiness.canClose, false, "a round with no entered results or evidence remains incomplete");
assert.equal(allPendingReadiness.canConfirmClose, true, "a round with all results and evidence missing can still be confirmed closed");
assert.equal(allPendingReadiness.blockers.length > 0, true, "all missing results and evidence remain listed for the warning dialog");
assert.equal(JSON.stringify(allPending), allPendingBefore, "readiness checks must not rewrite the draft or fill missing results");

const noImage = { ...ready, inspectionItems: { ...ready.inspectionItems, [firstItem.id]: { ...ready.inspectionItems[firstItem.id], evidence: { ...ready.inspectionItems[firstItem.id].evidence, [firstSlot.id]: { ...ready.inspectionItems[firstItem.id].evidence[firstSlot.id], status: "no-image" } } } } };
const noImageReadiness = getCloseReadiness(noImage);
assert.equal(noImageReadiness.blockers.some((entry) => entry.slotId === firstSlot.id), true);
assert.equal(noImageReadiness.canConfirmClose, true, "missing evidence can be acknowledged when closing");
const notApplicableBypass = { ...ready, inspectionItems: { ...ready.inspectionItems, [firstItem.id]: { ...ready.inspectionItems[firstItem.id], status: "na" } } };
assert.equal(getCloseReadiness(notApplicableBypass).canClose, true, "manual not-applicable status skips item and evidence blockers");

const naWithPendingEvidence = {
  ...notApplicableBypass,
  inspectionItems: {
    ...notApplicableBypass.inspectionItems,
    [firstItem.id]: {
      ...notApplicableBypass.inspectionItems[firstItem.id],
      evidence: {
        ...notApplicableBypass.inspectionItems[firstItem.id].evidence,
        [firstSlot.id]: { ...notApplicableBypass.inspectionItems[firstItem.id].evidence[firstSlot.id], status: "pending", attachment: null },
      },
    },
  },
};
assert.equal(getCloseReadiness(naWithPendingEvidence).canClose, true, "not-applicable skips pending evidence");
assert.equal(getRoundSummary(naWithPendingEvidence).evidenceTotal, getRoundSummary(ready).evidenceTotal - 1, "not-applicable evidence is removed from the denominator");

const serverSite = { ...ready, inspectionItems: { ...ready.inspectionItems, [firstItem.id]: { ...ready.inspectionItems[firstItem.id], evidence: { ...ready.inspectionItems[firstItem.id].evidence, [firstSlot.id]: { ...ready.inspectionItems[firstItem.id].evidence[firstSlot.id], status: "server-site", note: "" } } } } };
assert.equal(getCloseReadiness(serverSite).canClose, false);
const serverSiteWithNote = { ...serverSite, inspectionItems: { ...serverSite.inspectionItems, [firstItem.id]: { ...serverSite.inspectionItems[firstItem.id], evidence: { ...serverSite.inspectionItems[firstItem.id].evidence, [firstSlot.id]: { ...serverSite.inspectionItems[firstItem.id].evidence[firstSlot.id], note: "ติดตั้งอยู่ที่ Server สน." } } } } };
assert.equal(getCloseReadiness(serverSiteWithNote).canClose, true);

const damaged = { ...ready, inspectionItems: { ...ready.inspectionItems, [firstItem.id]: { ...ready.inspectionItems[firstItem.id], status: "damaged" } } };
assert.equal(getCloseReadiness(damaged).canClose, true, "damaged is follow-up, not a close blocker");
assert.equal(getCloseReadiness(damaged).issues.some((entry) => entry.itemId === firstItem.id), true);
const notInstalled = { ...ready, inspectionItems: { ...ready.inspectionItems, [firstItem.id]: { ...ready.inspectionItems[firstItem.id], status: "not-installed", note: "ยังไม่ติดตั้งในจุดนี้" } } };
assert.equal(getCloseReadiness(notInstalled).canClose, true);
const notInstalledWithoutNote = { ...notInstalled, inspectionItems: { ...notInstalled.inspectionItems, [firstItem.id]: { ...notInstalled.inspectionItems[firstItem.id], note: "" } } };
assert.equal(getCloseReadiness(notInstalledWithoutNote).canClose, true, "not-installed does not require a note");

const notInstalledWithPendingEvidence = {
  ...notInstalledWithoutNote,
  inspectionItems: {
    ...notInstalledWithoutNote.inspectionItems,
    [firstItem.id]: {
      ...notInstalledWithoutNote.inspectionItems[firstItem.id],
      evidence: {
        ...notInstalledWithoutNote.inspectionItems[firstItem.id].evidence,
        [firstSlot.id]: { ...notInstalledWithoutNote.inspectionItems[firstItem.id].evidence[firstSlot.id], status: "pending", attachment: null },
      },
    },
  },
};
assert.equal(getCloseReadiness(notInstalledWithPendingEvidence).canClose, true, "not-installed skips pending evidence");
assert.equal(getRoundSummary(notInstalledWithPendingEvidence).evidenceTotal, getRoundSummary(ready).evidenceTotal - 1, "not-installed evidence is removed from the denominator");

const closed = { ...ready, status: "closed", closedAt: "2026-09-03T01:00:00.000Z" };
const sourceJson = JSON.stringify(closed);
const revision = createRevisionRound(closed, { reason: "แก้ค่าตามใบตรวจฉบับแก้ไข", createdAt: "2026-09-03T02:00:00.000Z" });
assert.equal(closed.status, "closed");
assert.equal(JSON.stringify(closed), sourceJson, "creating a revision must not mutate the source");
assert.notEqual(revision.id, closed.id);
assert.equal(revision.status, "draft");
assert.equal(revision.basedOnRoundId, closed.id);
assert.equal(revision.revisionNumber, 1);
assert.equal(revision.revisionReason, "แก้ค่าตามใบตรวจฉบับแก้ไข");
assert.equal(revision.reason, "แก้ค่าตามใบตรวจฉบับแก้ไข");
assert.deepEqual(revision.snapshot, closed.snapshot);
assert.deepEqual(revision.inspectionItems, closed.inspectionItems);

assert.equal(parseHash("#/stations/station-1").name, "stationDetail");
assert.equal(parseHash("#/settings/checklist-copy").name, "dashboard");
assert.equal(parseHash("#/history/round-1/revise").name, "historyRevise");
assert.deepEqual(parseHash("#/inspections/round-1/vehicle-api/plate"), { name: "vehicleApi", id: "round-1", context: "plate", query: {} });
assert.deepEqual(parseHash("#/inspections/round-1/vehicle-api/classification"), { name: "vehicleApi", id: "round-1", context: "classification", query: {} });
assert.deepEqual(parseHash("#/history/round-1/vehicle-api/classification"), { name: "historyVehicleApi", id: "round-1", context: "classification", query: {} });
assert.equal(primaryRouteFor("stationDetail"), "stations");
assert.equal(primaryRouteFor("historyRevise"), "history");
assert.equal(primaryRouteFor("vehicleApi"), "inspections");
assert.equal(primaryRouteFor("historyVehicleApi"), "history");

const migrated = migrateChecklistState({ stationProfiles: [{ id: "station-1", stationCode: "S-1", stationName: "สถานีทดสอบ" }] });
assert.equal(CURRENT_STATE_VERSION, 18);
assert.equal(migrated.version, 18);
assert.equal(migrated.stationProfiles[0].active, true);

console.log("flow redesign tests passed");
