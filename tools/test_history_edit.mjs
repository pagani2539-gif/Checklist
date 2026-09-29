import assert from "node:assert/strict";
import {
  createDefaultStationProfile,
  createInspectionRound,
} from "../src/domain/master-checklist.js";
import {
  applyCorrection,
  cloneRoundForCorrection,
  getCorrectionSummary,
  hasCorrectionChanges,
  validateCorrectionReason,
} from "../src/domain/correction.js";
import { CURRENT_STATE_VERSION, migrateChecklistState } from "../src/domain/storage.js";

const profile = createDefaultStationProfile();
const original = createInspectionRound(profile, {
  projectName: "รอบตรวจเดิม",
  inspectionDate: "2026-09-02",
}, {
  id: "round-history-edit-test",
  status: "closed",
  createdAt: "2026-09-01T01:00:00.000Z",
  updatedAt: "2026-09-01T02:00:00.000Z",
  closedAt: "2026-09-01T02:00:00.000Z",
});
const firstItemId = Object.keys(original.inspectionItems)[0];
original.inspectionItems[firstItemId] = {
  ...original.inspectionItems[firstItemId],
  value: "10",
  status: "normal",
  note: "ค่าก่อนแก้",
};

const originalSnapshot = JSON.stringify(original.snapshot);
const originalJson = JSON.stringify(original);
const draft = cloneRoundForCorrection(original);
draft.meta.contractor = "ทีมช่างแก้ไข";
draft.inspectionItems[firstItemId] = {
  ...draft.inspectionItems[firstItemId],
  value: "12",
  status: "damaged",
  note: "แก้ตามใบตรวจฉบับแก้ไข",
};

assert.equal(hasCorrectionChanges(original, draft), true);
const committed = applyCorrection(original, draft, {
  reason: "แก้ค่าตามใบตรวจหน้างานฉบับแก้ไข",
  editedAt: "2026-09-02T03:00:00.000Z",
});
assert.equal(committed.changed, true);
assert.equal(committed.round.id, original.id);
assert.equal(committed.round.status, "closed");
assert.equal(committed.round.closedAt, original.closedAt);
assert.equal(committed.round.updatedAt, "2026-09-02T03:00:00.000Z");
assert.equal(JSON.stringify(committed.round.snapshot), originalSnapshot, "correction must not change the historical Snapshot");
assert.equal(committed.round.inspectionItems[firstItemId].value, "12");
assert.equal(committed.round.inspectionItems[firstItemId].status, "damaged");
assert.equal(committed.round.correctionHistory.length, 1);
assert.equal(getCorrectionSummary(committed.round).count, 1);
assert.equal(getCorrectionSummary(committed.round).latestReason, "แก้ค่าตามใบตรวจหน้างานฉบับแก้ไข");
assert.equal(JSON.stringify(original), originalJson, "working-copy correction must not mutate the original round");

const noChange = applyCorrection(original, cloneRoundForCorrection(original), { reason: "ไม่มีการเปลี่ยนแปลง" });
assert.equal(noChange.changed, false);
assert.equal(noChange.event, null);

const secondDraft = cloneRoundForCorrection(committed.round);
secondDraft.meta.inspector = "ผู้ตรวจสอบคนใหม่";
const second = applyCorrection(committed.round, secondDraft, {
  reason: "แก้ชื่อผู้ตรวจสอบให้ตรงกับใบส่งงาน",
  editedAt: "2026-09-02T04:00:00.000Z",
});
assert.equal(second.round.correctionHistory.length, 2);
assert.equal(getCorrectionSummary(second.round).latestAt, "2026-09-02T04:00:00.000Z");

assert.equal(validateCorrectionReason("   ").valid, false);
assert.equal(validateCorrectionReason("x".repeat(501)).valid, false);
assert.equal(validateCorrectionReason("แก้ไขข้อมูล").valid, true);
assert.throws(() => applyCorrection({ ...original, status: "draft" }, draft, { reason: "แก้ไข" }), /ปิดแล้ว/);

const migrated = migrateChecklistState({
  version: 8,
  stationProfiles: [profile],
  inspectionRounds: [original],
});
assert.equal(migrated.version, 18);
assert.deepEqual(migrated.inspectionRounds[0].correctionHistory, []);

const migratedCorrected = migrateChecklistState({
  version: 8,
  stationProfiles: [profile],
  inspectionRounds: [second.round],
});
assert.equal(migratedCorrected.inspectionRounds[0].correctionHistory.length, 2);

console.log("history edit smoke passed", JSON.stringify({ corrections: 2, snapshotStable: true, migratedVersion: migrated.version }));
