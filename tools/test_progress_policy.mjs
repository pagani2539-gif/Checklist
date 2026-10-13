import assert from "node:assert/strict";
import {
  createDefaultStationProfile,
  createInspectionRound,
  getChecklistItemsProgress,
  getInspectionProgressModel,
  getItemsForSnapshot,
  normalizeRound,
  getRoundSummary,
} from "../src/domain/master-checklist.js";
import { buildReportTemplateModel } from "../src/domain/report-template.js";
import { CHECKLIST_PROGRESS_POLICY_VERSION } from "../src/domain/inspection-status.js";
import { isVehicleApiReviewItem } from "../src/domain/vehicle-search.js";

const profile = createDefaultStationProfile();
const created = createInspectionRound(profile, { projectName: "Progress policy test" });
assert.equal(created.progressPolicyVersion, CHECKLIST_PROGRESS_POLICY_VERSION, "new rounds record the current policy version");

const items = getItemsForSnapshot(created.snapshot, created.templateVersion);
const inScope = items.filter((item) => item.applicable !== false && !isVehicleApiReviewItem(item, created.snapshot));
const apiItems = items.filter((item) => isVehicleApiReviewItem(item, created.snapshot));
assert.equal(apiItems.length > 0, true, "the fixture contains Vehicle API work to keep outside Checklist progress");

const [normalItem, damagedItem, waitingItem, notInstalledItem, naItem] = inScope;
const inspectionItems = { ...created.inspectionItems };
inspectionItems[normalItem.id] = { ...inspectionItems[normalItem.id], status: "normal" };
inspectionItems[damagedItem.id] = { ...inspectionItems[damagedItem.id], status: "damaged" };
inspectionItems[waitingItem.id] = { ...inspectionItems[waitingItem.id], status: "waiting" };
inspectionItems[notInstalledItem.id] = { ...inspectionItems[notInstalledItem.id], status: "not-installed" };
inspectionItems[naItem.id] = { ...inspectionItems[naItem.id], status: "na" };
const current = { ...created, inspectionItems };

const summary = getRoundSummary(current);
assert.equal(summary.total, inScope.length - 2, "not-installed and not-applicable leave the denominator");
assert.equal(summary.done, 3, "normal, damaged, and waiting count as recorded results");
assert.equal(summary.issues, 2, "damaged and waiting remain visible as findings");
assert.equal(summary.pending, summary.total - 3, "pending results remain in the denominator");
assert.equal(summary.evidenceComplete, 0, "missing evidence does not lower the main result count");
assert.equal(summary.progress, Math.round((3 / summary.total) * 100), "main progress is based only on recorded in-scope results");
assert.equal(getRoundSummary(current, { excludeSkipped: true }).total, summary.total, "report and Checklist use the same bypass scope for current rounds");

const expectedCurrentEvidence = inScope
  .filter((item) => !["not-installed", "na"].includes(inspectionItems[item.id]?.status))
  .flatMap((item) => item.evidenceSlots.filter((slot) => slot.required !== false));
assert.equal(summary.evidenceTotal, expectedCurrentEvidence.length, "only required evidence slots on in-scope items count");
assert.equal(summary.evidencePending, summary.evidenceTotal, "required evidence remains a separate pending count");

const apiChanged = {
  ...current,
  inspectionItems: {
    ...current.inspectionItems,
    [apiItems[0].id]: { ...current.inspectionItems[apiItems[0].id], status: "normal" },
  },
  vehicleSearch: { fetchedAt: "2026-10-04T00:00:00.000Z", rows: [] },
};
assert.equal(getRoundSummary(apiChanged).total, summary.total, "Vehicle API completion does not affect the Checklist denominator");
assert.equal(getRoundSummary(apiChanged).done, summary.done, "Vehicle API completion does not affect Checklist progress");

const synthetic = getChecklistItemsProgress([
  { id: "in-scope" },
  { id: "structurally-out-of-scope", applicable: false },
], {
  status: "draft",
  snapshot: {},
  inspectionItems: {
    "in-scope": { status: "damaged" },
    "structurally-out-of-scope": { status: "normal" },
  },
});
assert.equal(synthetic.total, 1, "structurally inapplicable items leave the denominator");
assert.equal(synthetic.done, 1, "a recorded issue is still a recorded result");

const optionalSnapshot = structuredClone(created.snapshot);
const copiedItems = optionalSnapshot.checklistCopy.sections.flatMap((section) => section.items);
const optionalCopyItem = copiedItems.find((item) => item.evidenceSlots?.length);
optionalCopyItem.evidenceSlots[0].required = false;
const optionalRound = { ...created, snapshot: optionalSnapshot };
const optionalSummary = getRoundSummary(optionalRound);
const originalSummary = getRoundSummary(created);
assert.equal(optionalSummary.total, originalSummary.total, "optional evidence does not affect Checklist item progress");
assert.equal(optionalSummary.done, originalSummary.done, "optional evidence does not affect Checklist results");
assert.equal(optionalSummary.evidenceTotal, originalSummary.evidenceTotal - 1, "optional slots are excluded from evidence totals");

const oldClosed = {
  ...current,
  status: "closed",
  closedAt: "2026-10-03T00:00:00.000Z",
  progressPolicyVersion: undefined,
  snapshot: optionalSnapshot,
};
const legacySummary = getRoundSummary(oldClosed);
const legacyApplicable = inScope.filter((item) => inspectionItems[item.id]?.status !== "na");
const legacyDone = legacyApplicable.filter((item) => Boolean(inspectionItems[item.id]?.status)
  && inspectionItems[item.id].status !== "pending").length;
const legacyEvidenceTotal = getItemsForSnapshot(optionalSnapshot, created.templateVersion)
  .filter((item) => item.applicable !== false
    && !isVehicleApiReviewItem(item, optionalSnapshot)
    && !["na", "not-installed"].includes(inspectionItems[item.id]?.status))
  .reduce((total, item) => total + item.evidenceSlots.length, 0);
assert.equal(legacySummary.total, legacyApplicable.length, "closed rounds without a marker retain the legacy denominator");
assert.equal(legacySummary.done, legacyDone, "closed rounds without a marker retain legacy recorded-status totals");
assert.equal(legacySummary.evidenceTotal, legacyEvidenceTotal,
  "closed rounds without a marker keep optional slots in their historical evidence total");
const normalizedOldClosed = normalizeRound(oldClosed, [profile], profile);
assert.equal(normalizedOldClosed.progressPolicyVersion, null, "normalization does not assign a new policy marker to an old closed round");
assert.equal(getRoundSummary(normalizedOldClosed).total, legacySummary.total, "normalization keeps the old closed-round denominator");

const versionedClosed = { ...oldClosed, progressPolicyVersion: CHECKLIST_PROGRESS_POLICY_VERSION };
assert.equal(getRoundSummary(versionedClosed).total, summary.total, "versioned closed rounds use the new scope");
assert.equal(buildReportTemplateModel(current).summary.total, summary.total, "reports use the current Checklist summary");
assert.equal(buildReportTemplateModel(oldClosed).summary.total, getRoundSummary(oldClosed, { excludeSkipped: true }).total,
  "historical reports keep their existing skip-excluded totals");

const linkedFileId = "preserved-skip-evidence";
const evidenceItem = inScope.find((item) => item.evidenceSlots.length);
const evidenceSlot = evidenceItem.evidenceSlots[0];
const attachedWhileSkipped = {
  ...created,
  inspectionItems: {
    ...created.inspectionItems,
    [evidenceItem.id]: {
      ...created.inspectionItems[evidenceItem.id],
      status: "na",
      evidence: {
        ...created.inspectionItems[evidenceItem.id].evidence,
        [evidenceSlot.id]: {
          ...created.inspectionItems[evidenceItem.id].evidence[evidenceSlot.id],
          attachment: { id: linkedFileId, name: "evidence.jpg", type: "image/jpeg" },
        },
      },
    },
  },
};
getInspectionProgressModel(attachedWhileSkipped);
assert.equal(attachedWhileSkipped.inspectionItems[evidenceItem.id].evidence[evidenceSlot.id].attachment.id, linkedFileId,
  "excluding a skipped row does not delete its saved evidence attachment");
const restoredToInspection = {
  ...attachedWhileSkipped,
  inspectionItems: {
    ...attachedWhileSkipped.inspectionItems,
    [evidenceItem.id]: { ...attachedWhileSkipped.inspectionItems[evidenceItem.id], status: "normal" },
  },
};
assert.equal(restoredToInspection.inspectionItems[evidenceItem.id].evidence[evidenceSlot.id].attachment.id, linkedFileId,
  "changing the row back to inspected retains the saved evidence attachment");

console.log("Checklist progress policy passed", JSON.stringify({
  current: `${summary.done}/${summary.total}`,
  issues: summary.issues,
  evidence: `${summary.evidenceComplete}/${summary.evidenceTotal}`,
  legacy: `${legacySummary.done}/${legacySummary.total}`,
}));
