import assert from "node:assert/strict";
import { normalizeVehicleSearchState, updateVehicleSearchDimensionReview, getVehicleReviewDetail, getVehicleSearchIssueRows, getVehiclePlateVerificationLabel, VEHICLE_PLATE_VERIFICATION_OPTIONS } from "../src/domain/vehicle-search.js";
import { getPlateEvidenceComparison, buildVehicleSnapshotEvidencePages } from "../src/domain/vehicle-snapshot-evidence.js";

const original = normalizeVehicleSearchState({ rows: [{ id: "partial", plateNumber: "71-2086", province: "กาญจนบุรี", occurredAt: "2026-10-03T08:00:00+07:00" }] });
for (const option of VEHICLE_PLATE_VERIFICATION_OPTIONS) {
  const confirmed = option.value === "province-unverified" ? "71-2086" : option.value === "number-unverified" ? "กาญจนบุรี" : null;
  const state = updateVehicleSearchDimensionReview(original, "partial", "plate", "unable-to-verify", { reasonCode: "blurred-image", verificationScope: option.value, correctedValue: confirmed });
  const restored = normalizeVehicleSearchState(JSON.parse(JSON.stringify(state)));
  const row = restored.rows[0];
  const detail = getVehicleReviewDetail(row, "plate");
  assert.equal(detail.verificationScope, option.value);
  assert.equal(detail.history.at(-1).verificationScope, option.value);
  assert.equal(row.reviewStatus, "unable-to-verify", "partial verification must not count as fully correct");
  assert.equal(getVehiclePlateVerificationLabel(detail), option.label);
  assert.equal(getVehicleSearchIssueRows(restored).find(issue => issue.dimension === "plate").verificationScopeLabel, option.label);
  const comparison = getPlateEvidenceComparison({ row, detail }, "unable-to-verify");
  assert.equal(comparison[0].confirmed, option.value === "province-unverified" ? confirmed : "ยังไม่ยืนยัน");
  assert.equal(comparison[1].confirmed, option.value === "number-unverified" ? confirmed : "ยังไม่ยืนยัน");
  const pages = buildVehicleSnapshotEvidencePages({ rows: restored.rows });
  const entry = pages.flatMap(page => page.entries || []).find(entry => entry.row.id === "partial");
  assert.ok(entry.reasonLabel.includes(option.label), "report must retain the scope of partial verification");
  const corrected = updateVehicleSearchDimensionReview(restored, "partial", "plate", "correct", { verificationScope: null, correctedValue: null, reasonCode: null });
  assert.equal(getVehicleReviewDetail(corrected.rows[0], "plate").verificationScope, null);
  assert.equal(getVehicleReviewDetail(corrected.rows[0], "plate").history[0].verificationScope, option.value, "re-review must preserve earlier verification history");
}
assert.equal(getVehicleReviewDetail(original.rows[0], "plate").verificationScope, null, "older rows remain readable without invented scope");
assert.equal(original.rows[0].reviewStatus, "pending", "original records are not mutated");
console.log("partial plate verification tests passed");
