import assert from "node:assert/strict";
import {
  EVIDENCE_CHECKLIST_SECTIONS,
  EVIDENCE_TEMPLATE_VERSION,
  LEGACY_EVIDENCE_TEMPLATE_VERSION,
  MASTER_CHECKLIST_SECTIONS,
  VIDEO_EVIDENCE_ITEM_IDS,
  createDefaultStationProfile,
  
} from "../src/domain/master-checklist.js";
import { createLegacyInspectionRound as createInspectionRound } from "./legacy_round_fixture.mjs";
import {
  buildVideoPurgePlan,
  migrateChecklistState,
  purgeVideoEvidenceFromState,
} from "../src/domain/storage.js";

const profile = createDefaultStationProfile();
const videoItemIds = VIDEO_EVIDENCE_ITEM_IDS;
const currentEvidenceItems = EVIDENCE_CHECKLIST_SECTIONS.flatMap((section) => section.items);
assert.equal(currentEvidenceItems.length, 170);
assert.equal(currentEvidenceItems.flatMap((item) => item.evidenceSlots).filter((slot) => slot.fieldType === "video").length, 0);
assert.equal(currentEvidenceItems.some((item) => videoItemIds?.includes?.(item.id)), false);
assert.equal(MASTER_CHECKLIST_SECTIONS.flatMap((section) => section.items).some((item) => item.id === "vms-video"), false);
const seedRound = createInspectionRound(profile, { projectName: "Purge regression" });
const videoCatalog = videoItemIds.map((itemId, index) => ({
  itemId,
  slotId: `${itemId}.evidence`,
  fieldType: "video",
  sectionCode: itemId.split(".").slice(0, 2).join("."),
  sourceOrder: 20000 + index,
  required: true,
}));
const legacySnapshot = {
  ...seedRound.snapshot,
  id: "snapshot-video-legacy",
  templateVersion: LEGACY_EVIDENCE_TEMPLATE_VERSION,
  cleaningPolicyVersion: null,
  evidenceCatalog: [...seedRound.snapshot.evidenceCatalog, ...videoCatalog],
  checklistCopy: {
    ...seedRound.snapshot.checklistCopy,
    sections: seedRound.snapshot.checklistCopy.sections.map((section, index) => index === 0 ? {
      ...section,
      items: [
        ...section.items,
        {
          id: videoItemIds[0],
          label: "หัวข้อวิดีโอเดิม",
          evidenceSlots: [{ id: `${videoItemIds[0]}.evidence`, fieldType: "video" }],
        },
      ],
    } : section),
  },
  masterChecklistCopy: {
    ...seedRound.snapshot.masterChecklistCopy,
    sections: seedRound.snapshot.masterChecklistCopy.sections.map((section) => section.code === "7.1" ? {
      ...section,
      items: [...section.items, { id: "vms-video", label: "วิดีโอ VMS" }],
    } : section),
  },
};

const preservedItems = {
  ...seedRound.inspectionItems,
  [videoItemIds[0]]: {
    value: "วิดีโอเก่า",
    status: "complete",
    note: "ข้อมูลวิดีโอที่ต้อง purge",
    evidence: {
      [`${videoItemIds[0]}.evidence`]: {
        status: "complete",
        attachment: { id: "video-only", name: "old-video.mp4", type: "video/mp4" },
      },
    },
  },
  "1.1.staff": {
    ...seedRound.inspectionItems["1.1.staff"],
    note: "หมายเหตุภาพต้องคงอยู่",
    evidence: {
      ...seedRound.inspectionItems["1.1.staff"].evidence,
      "1.1.staff.evidence": {
        status: "complete",
        attachment: { id: "photo-only", name: "staff.jpg", type: "image/jpeg" },
      },
    },
  },
  "5.1.vehicle-document": {
    ...seedRound.inspectionItems["5.1.vehicle-document"],
    evidence: {
      ...seedRound.inspectionItems["5.1.vehicle-document"].evidence,
      "5.1.vehicle-document.evidence": {
        status: "complete",
        attachment: { id: "shared-document", name: "document-video.mp4", type: "video/mp4" },
      },
    },
  },
};

const draft = {
  ...seedRound,
  id: "round-video-draft",
  snapshot: legacySnapshot,
  inspectionItems: preservedItems,
};
const closed = {
  ...draft,
  id: "round-video-closed",
  status: "closed",
  closedAt: "2026-09-02T00:00:00.000Z",
};
const history = {
  id: "history-video-closed",
  stationId: profile.id,
  archivedAt: "2026-09-02T00:00:00.000Z",
  stationSnapshot: legacySnapshot,
  items: preservedItems,
};
const workspace = {
  id: "workspace-video-draft",
  stationId: profile.id,
  status: "draft",
  snapshot: legacySnapshot,
  items: preservedItems,
};
const legacyChecklistCopy = legacySnapshot.checklistCopy;
const legacyMasterCopy = legacySnapshot.masterChecklistCopy;
const rawState = {
  version: 12,
  stationProfiles: [{
    ...profile,
    checklistConfig: { disabledTemplateIds: ["vms-video", videoItemIds[0], "1.1.staff"] },
  }],
  inspectionRounds: [draft, closed],
  inspectionHistory: [history],
  inspectionWorkspaces: [workspace],
  activeRoundId: draft.id,
  activeStationId: profile.id,
  ui: { selectedStationId: profile.id },
  items: preservedItems,
  inspectionSnapshot: legacySnapshot,
  checklistCopy: legacyChecklistCopy,
  masterChecklistCopy: legacyMasterCopy,
};

const plan = buildVideoPurgePlan(rawState);
assert.equal(plan.needsPurge, true);
assert.equal(plan.counts.rounds, 4);
assert.equal(plan.counts.draftRounds, 2);
assert.equal(plan.counts.closedRounds, 2);
assert.equal(plan.counts.videoItems, 16, "15 evidence topics plus the legacy vms-video item are removed");
assert.equal(plan.counts.videoSlots, 15);
assert.deepEqual(plan.attachmentIdsToDelete, ["video-only"]);
assert.deepEqual(new Set(plan.backupAttachmentIds), new Set(["video-only", "photo-only", "shared-document"]));

const purged = purgeVideoEvidenceFromState(rawState);
assert.equal(purged.changed, true);
assert.deepEqual(purged.attachmentIdsToDelete, ["video-only"]);
assert.equal(purged.state.items["1.1.staff"].note, "หมายเหตุภาพต้องคงอยู่");
assert.equal(purged.state.items["1.1.staff"].evidence["1.1.staff.evidence"].attachment.id, "photo-only");
assert.equal(purged.state.items["5.1.vehicle-document"].evidence["5.1.vehicle-document.evidence"].attachment.id, "shared-document");
assert.equal(purged.state.items[videoItemIds[0]], undefined);
assert.deepEqual(purged.state.stationProfiles[0].checklistConfig.disabledTemplateIds, ["1.1.staff"]);
assert.equal(JSON.stringify(purged.state).includes('"fieldType":"video"'), false);

const migrated = migrateChecklistState(rawState, { videoPurgePlan: plan });
assert.equal(migrated.version, 18);
assert.equal(migrated.videoEvidencePurge, undefined, "retired video migration marker is removed after automatic purge");
assert.deepEqual(migrated.videoPurgePendingAttachmentIds, ["video-only"]);
assert.equal(migrated.inspectionRounds.length, 4);
assert.equal(migrated.inspectionHistory.length, 2, "closed compatibility aliases are rebuilt from sanitized rounds");
assert.equal(migrated.inspectionWorkspaces.length, 2, "draft compatibility aliases are rebuilt from sanitized rounds");
assert.equal(migrated.items[videoItemIds[0]], undefined);
assert.equal(migrated.items["5.1.vehicle-document"].evidence["5.1.vehicle-document.evidence"].attachment.id, "shared-document");
assert.equal(JSON.stringify(migrated).includes('"fieldType":"video"'), false);

const migratedAgain = migrateChecklistState(migrated);
assert.deepEqual(migratedAgain, migrated, "video purge migration is idempotent after automatic purge");

const clean = migrateChecklistState({ stationProfiles: [profile], inspectionRounds: [] });
assert.equal(clean.videoEvidencePurge, undefined);
assert.equal(clean.inspectionRounds.length, 0);
assert.equal(clean.checklistCopy.sections.flatMap((section) => section.items).length, 170);
assert.equal(clean.masterChecklistCopy.sections.flatMap((section) => section.items).length, 44);
assert.equal(EVIDENCE_TEMPLATE_VERSION, "checklist-master-v5-system-mapped");

console.log("video purge smoke passed", JSON.stringify({
  templateSlots: 170,
  masterItems: 44,
  purge: plan.counts,
  retainedAttachments: ["photo-only", "shared-document"],
}));
