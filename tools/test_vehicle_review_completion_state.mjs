import assert from "node:assert/strict";
import { createVehicleReviewState, getVehicleReviewOutcome, getVehicleReviewState, updateVehicleSearchScope } from "../src/domain/vehicle-search.js";

const fetchedAt = "2026-10-14T03:00:00.000Z";
const criteria = { startAt: "2026-10-14T06:00", endAt: "2026-10-14T18:00" };

const recordedUnable = {
  fetchedAt,
  criteria,
  rows: [{ id: "unable-1", occurredAt: "2026-10-14T09:00:00+07:00", reviewStatus: "unable-to-verify" }],
};
const recordedUnableState = getVehicleReviewState(recordedUnable, { context: "plate" });
assert.equal(recordedUnableState.key, "recorded-unverified");
assert.equal(recordedUnableState.tone, "normal");
assert.equal(recordedUnableState.label, "บันทึกผลครบแล้ว · ตรวจยืนยันไม่ได้ 1 จุด");
assert.equal(recordedUnableState.summary.pendingChecks, 0);
assert.equal(recordedUnableState.summary.unableToVerifyChecks, 1);
assert.notEqual(getVehicleReviewOutcome(recordedUnable, { context: "plate" }).status, "passed", "record completion must not make unverified data pass the verification criteria");

const partiallyRecorded = {
  fetchedAt,
  criteria,
  rows: [
    { id: "unable-1", occurredAt: "2026-10-14T09:00:00+07:00", reviewStatus: "unable-to-verify" },
    { id: "pending-1", occurredAt: "2026-10-14T09:01:00+07:00", reviewStatus: "pending" },
  ],
};
const partiallyRecordedState = getVehicleReviewState(partiallyRecorded, { context: "plate" });
assert.equal(partiallyRecordedState.key, "reviewing");
assert.equal(partiallyRecordedState.tone, "waiting");
assert.equal(partiallyRecordedState.label, "ยังตรวจไม่ครบ · ค้าง 1 จุด · ตรวจยืนยันไม่ได้ 1 จุด");

let scoped = { ...createVehicleReviewState({ dateFrom: "2026-10-14" }), independentContext: "plate" };
scoped = updateVehicleSearchScope(scoped, "day", {
  fetchedAt,
  criteria,
  rows: [{ id: "day-1", occurredAt: "2026-10-14T09:00:00+07:00", reviewStatus: "unable-to-verify" }],
});
scoped = updateVehicleSearchScope(scoped, "night", {
  fetchedAt,
  criteria: { startAt: "2026-10-14T18:00", endAt: "2026-10-15T06:00" },
  rows: [{ id: "night-1", occurredAt: "2026-10-14T20:00:00+07:00", reviewStatus: "unable-to-verify" }],
});
const scopedState = getVehicleReviewState(scoped, { context: "plate" });
assert.equal(scopedState.key, "recorded-unverified");
assert.equal(scopedState.tone, "normal");
assert.equal(scopedState.label, "บันทึกผลครบแล้ว · ตรวจยืนยันไม่ได้ 2 จุด");

console.log("PASS vehicle review completion is distinct from verification outcome for single and scoped datasets");
