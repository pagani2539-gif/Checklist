import assert from "node:assert/strict";
import { replaceVehicleTestDataset as replaceWithPolicy, validateVehicleTestReplacement } from "../src/domain/vehicle-test-replacement.js";
import { createVehicleReviewState, getVehicleClassificationDataset, getVehicleReviewDetail, getVehicleSearchReviewSummary, getVehicleReviewOutcome, normalizeVehicleReviewState, normalizeVehicleSearchState } from "../src/domain/vehicle-search.js";
import { getVehicleEvidenceArchiveForRow } from "../src/domain/vehicle-evidence-images.js";

const replaceVehicleTestDataset = (current, result, request, options = {}) => replaceWithPolicy(current, result, request, { ...options, plateEligibilityEnabled: true });
const dayCriteria = { startAt: "2026-10-01T06:00", endAt: "2026-10-01T18:00" };
const nightCriteria = { startAt: "2026-10-01T18:00", endAt: "2026-10-02T06:00" };
const dataset = (id, time, criteria) => normalizeVehicleSearchState({ criteria, fetchedAt: "2026-10-02T00:00:00Z", rows: [{ id, occurredAt: time, plateNumber: "50-4989", reviewStatus: "correct", classificationReviewStatus: "incorrect", plateImage: "/old.jpg", reviewDetails: { plate: { reasonCode: "blurred-image", note: "old", history: [{ status: "correct" }] }, classification: { reasonCode: "class-mismatch", correctedValue: "รถบรรทุก" } } }], sample: { lockedAt: "2026-10-02T00:00:00Z", method: "all", sourceCount: 1, limit: 0 } });
const current = createVehicleReviewState(dayCriteria);
current.scopes.day = dataset("same-id", "2026-10-01T09:00:00+07:00", dayCriteria);
current.scopes.night = dataset("old-night", "2026-10-01T19:00:00+07:00", nightCriteria);
current.classification = dataset("old-class", "2026-10-01T09:00:00+07:00", dayCriteria);
const original = structuredClone(current);
const apiResult = { fetchedAt: "2026-10-03T00:00:00Z", sourceStation: { id: "6", name: "Sc-323" }, rows: [{ id: "same-id", occurredAt: "2026-10-01T09:01:00+07:00", plateNumber: "50-4989", province: "กรุงเทพมหานคร", plateImage: "/new.jpg", reviewStatus: "correct", reviewDetails: { plate: { note: "must reset" } } }, { id: "new-night", occurredAt: "2026-10-01T18:00:00+07:00", plateNumber: "OTHER" }] };
const dayRequest = { context: "plate", scopeKey: "day", criteria: dayCriteria, limit: 0 };
const day = replaceVehicleTestDataset(current, apiResult, dayRequest, { seed: "fixed" });
assert.equal(day.scopes.day.rows.length, 1, "the 18:00 boundary belongs to night, not day");
assert.equal(day.scopes.day.rows[0].reviewStatus, "pending", "same vehicle ID must not inherit old reviews");
assert.equal(getVehicleReviewDetail(day.scopes.day.rows[0]).note, "");
assert.equal(getVehicleReviewDetail(day.scopes.day.rows[0]).history.length, 0);
assert.equal(day.scopes.day.sourceRows[0].reviewStatus, "pending");
assert.deepEqual(day.scopes.night, normalizeVehicleReviewState(current).scopes.night);
assert.deepEqual(day.classification, getVehicleClassificationDataset(current));
assert.equal(getVehicleSearchReviewSummary(day, { context: "plate" }).pendingChecks, 1);
assert.equal(getVehicleReviewOutcome(day.scopes.day, { context: "plate" }).status, "incomplete");
assert.deepEqual(current, original, "replacement must not mutate the old root");
assert.deepEqual(normalizeVehicleReviewState(JSON.parse(JSON.stringify(day))), normalizeVehicleReviewState(day));

const night = replaceVehicleTestDataset(current, apiResult, { ...dayRequest, scopeKey: "night", criteria: nightCriteria });
assert.equal(night.scopes.night.rows[0].id, "new-night");
assert.deepEqual(night.scopes.day, normalizeVehicleReviewState(current).scopes.day);
assert.deepEqual(night.classification, getVehicleClassificationDataset(current));

const classification = replaceVehicleTestDataset(current, apiResult, { ...dayRequest, context: "classification" });
assert.equal(classification.classification.rows.length, 2);
assert.equal(classification.classification.rows[0].classificationReviewStatus, "pending");
assert.deepEqual(classification.scopes, normalizeVehicleReviewState(current).scopes);

const legacyScoped = { ...current }; delete legacyScoped.classification;
const migrated = replaceVehicleTestDataset(legacyScoped, apiResult, dayRequest);
assert.deepEqual(migrated.classification, getVehicleClassificationDataset(legacyScoped), "legacy classification must be captured before replacing its fallback plate dataset");
const legacySingle = current.scopes.day;
const migratedSingle = replaceVehicleTestDataset(legacySingle, apiResult, dayRequest);
assert.deepEqual(migratedSingle.classification, normalizeVehicleSearchState(legacySingle));

assert.throws(() => replaceVehicleTestDataset(current, apiResult, { ...dayRequest, roundStatus: "closed" }), /ปิดแล้ว/);
assert.throws(() => replaceVehicleTestDataset(current, { ...apiResult, rows: [] }, dayRequest), /ไม่พบรถ/);
assert.throws(() => replaceVehicleTestDataset(current, { ...apiResult, fetchedAt: null }, dayRequest), /API/);
assert.throws(() => validateVehicleTestReplacement({ ...dayRequest, criteria: { ...dayCriteria, endAt: "2026-10-01T19:00" } }), /กลางวัน/);
assert.throws(() => validateVehicleTestReplacement({ ...dayRequest, scopeKey: "night", criteria: { startAt: "2026-10-01T18:00", endAt: "2026-10-02T06:01" } }), /กลางคืน/);
assert.throws(() => validateVehicleTestReplacement({ ...dayRequest, limit: -1 }), /100/);
assert.throws(() => validateVehicleTestReplacement({ ...dayRequest, criteria: { startAt: "", endAt: "" } }), /วันเวลา/);
const many = { ...apiResult, rows: Array.from({ length: 150 }, (_, index) => ({ id: `car-${index}`, occurredAt: "2026-10-01T10:00:00+07:00", plateNumber: "ไม่พบผลอ่านป้าย" })) };
const sampled = replaceVehicleTestDataset(current, many, { ...dayRequest, limit: 100 }, { seed: "fixed" });
assert.equal(sampled.scopes.day.rows.length, 150, "all source rows stay visible before pre-screen lock");
assert.equal(sampled.scopes.day.sourceRows.length, 150);
assert.equal(sampled.scopes.day.sample, undefined, "new plate replacement starts the evidence eligibility pre-screen before scoring");
assert.equal(sampled.scopes.day.rows.length, 150, "replacement preserves every fetched source row before the score sample is locked");
assert.equal(sampled.scopes.day.sampleEligibilityPolicyVersion, "plate-evidence-v2");
assert.ok(sampled.scopes.day.rows.every(row => row.sampleEligibility?.status === "pending"));

const lockedButUnstarted = normalizeVehicleSearchState({ fetchedAt: "2026-10-02T12:00:00Z", sampleEligibilityPolicyVersion: "plate-evidence-v2", sourceRows: [{ id: "locked-pending", occurredAt: "2026-10-01T10:00:00+07:00", plateNumber: "50-4989", plateImage: "/plate.jpg", reviewStatus: "pending", sampleEligibility: { status: "eligible" } }], rows: [{ id: "locked-pending", occurredAt: "2026-10-01T10:00:00+07:00", plateNumber: "50-4989", plateImage: "/plate.jpg", reviewStatus: "pending", sampleEligibility: { status: "eligible" } }], sample: { version: "vehicle-sample-v2", eligibilityPolicyVersion: "plate-evidence-v2", eligibleCount: 1, sourceCount: 1, lockedAt: "2026-10-02T12:01:00Z" } });
const lockedRoot = { ...current, scopes: { ...current.scopes, day: lockedButUnstarted } };
assert.doesNotThrow(() => replaceVehicleTestDataset(lockedRoot, apiResult, dayRequest), "a locked set can be replaced before its first score review");
const startedDataset = normalizeVehicleSearchState({ ...lockedButUnstarted, rows: lockedButUnstarted.rows.map(row => ({ ...row, reviewStatus: "correct" })) });
assert.throws(() => replaceVehicleTestDataset({ ...lockedRoot, scopes: { ...current.scopes, day: startedDataset } }, apiResult, dayRequest), /เริ่มตรวจชุดคะแนนแล้ว/);

const archive = { "same-id": { plateImage: { id: "old-image", sourceUrl: "/old.jpg" }, lprImage: { id: "unchanged", sourceUrl: "/lpr.jpg" } } };
assert.deepEqual(getVehicleEvidenceArchiveForRow(archive, { id: "same-id", plateImage: "/new.jpg", lprImage: "/lpr.jpg" }), { lprImage: archive["same-id"].lprImage }, "new report must not reuse a stale archived image when the source changes");
console.log("PASS replacement isolation, reset, boundaries, legacy classification, sampling, read-only, empty result and archived-image safety");

const legacyNight = replaceWithPolicy(current, apiResult, { ...dayRequest, scopeKey: "night", criteria: nightCriteria });
assert.equal(legacyNight.scopes.night.sample.version,"vehicle-sample-v1");
assert.equal(legacyNight.scopes.night.sampleEligibilityPolicyVersion,undefined);
assert.equal(legacyNight.scopes.night.rows[0].reviewStatus,"pending");
assert.deepEqual(legacyNight.scopes.day, normalizeVehicleReviewState(current).scopes.day);
console.log("PASS default plate replacement uses legacy rules; evidence policy requires explicit opt-in");
