import assert from "node:assert/strict";
import {
  VEHICLE_REVIEW_SCOPE_KEYS,
  VEHICLE_REVIEW_SCOPE_VERSION,
  createVehicleReviewState,
  filterVehicleSearchRowsByScope,
  getVehicleReviewScopeState,
  getVehicleReviewScopeForTimestamp,
  getVehicleReviewState,
  normalizeVehicleReviewState,
  setVehicleSearchEmptyResultAcknowledged,
  updateVehicleSearchDimensionReview,
  updateVehicleSearchScope,
} from "../src/domain/vehicle-search.js";
import { createDefaultStationProfile, createInspectionRound, getCloseReadiness } from "../src/domain/master-checklist.js";

const scoped = createVehicleReviewState({ dateFrom: "2026-09-08", dateTo: "2026-09-08" });
assert.equal(scoped.scopeVersion, VEHICLE_REVIEW_SCOPE_VERSION);
assert.deepEqual(Object.keys(scoped.scopes), VEHICLE_REVIEW_SCOPE_KEYS);
assert.equal(scoped.scopes.day.criteria.startAt, "2026-09-08T06:00");
assert.equal(scoped.scopes.day.criteria.endAt, "2026-09-08T18:00");
assert.equal(scoped.scopes.night.criteria.startAt, "2026-09-08T18:00");
assert.equal(scoped.scopes.night.criteria.endAt, "2026-09-09T06:00");

assert.equal(getVehicleReviewScopeForTimestamp("2026-09-08T05:59:59+07:00"), "night");
assert.equal(getVehicleReviewScopeForTimestamp("2026-09-08T06:00:00+07:00"), "day");
assert.equal(getVehicleReviewScopeForTimestamp("2026-09-08T17:59:59+07:00"), "day");
assert.equal(getVehicleReviewScopeForTimestamp("2026-09-08T18:00:00+07:00"), "night");

const rows = [
  { id: "day", plateNumber: "กข 1111", occurredAt: "2026-09-08T06:00:00+07:00" },
  { id: "night", plateNumber: "กข 1111", occurredAt: "2026-09-08T18:00:00+07:00" },
  { id: "missing-time", plateNumber: "กข 2222", occurredAt: null },
];
assert.deepEqual(filterVehicleSearchRowsByScope(rows, "day").map((row) => row.id), ["day", "missing-time"]);
assert.deepEqual(filterVehicleSearchRowsByScope(rows, "night").map((row) => row.id), ["night", "missing-time"]);

const dayFetched = updateVehicleSearchScope(scoped, "day", {
  ...scoped.scopes.day,
  fetchedAt: "2026-09-08T11:00:00.000Z",
  sourceStation: { id: "S1", name: "สถานีทดสอบ" },
  rows: [{ id: "day-1", plateNumber: "กข 1111", occurredAt: "2026-09-08T06:01:00+07:00", reviewStatus: "pending" }],
});
assert.equal(getVehicleReviewScopeState(dayFetched, "day").fetchedAt !== null, true);
const reviewedDay = updateVehicleSearchDimensionReview(dayFetched.scopes.day, "day-1", "plate", "correct");
const withReviewedDay = updateVehicleSearchScope(dayFetched, "day", reviewedDay);
assert.equal(getVehicleReviewState(withReviewedDay.scopes.day, { context: "plate" }).key, "complete");
assert.equal(getVehicleReviewState(withReviewedDay, { context: "plate" }).key, "not-fetched", "the night scope remains required");

const emptyNight = updateVehicleSearchScope(withReviewedDay, "night", {
  ...withReviewedDay.scopes.night,
  fetchedAt: "2026-09-08T12:00:00.000Z",
  sourceStation: { id: "S1", name: "สถานีทดสอบ" },
  rows: [],
});
assert.equal(getVehicleReviewState(emptyNight.scopes.night, { context: "plate" }).key, "empty");
const acknowledged = setVehicleSearchEmptyResultAcknowledged(emptyNight.scopes.night, true);
assert.equal(getVehicleReviewState(acknowledged, { context: "plate" }).key, "empty-acknowledged");

const legacy = normalizeVehicleReviewState({ fetchedAt: "2026-09-08T01:00:00.000Z", rows: [] });
assert.equal(legacy.scopeVersion, undefined, "legacy vehicle state remains unscoped");

const profile = createDefaultStationProfile();
profile.vehicleSearchConfig = { ...profile.vehicleSearchConfig, baseUrl: "http://vehicle-api.test", stationId: profile.id, stationName: profile.stationName };
const round = createInspectionRound(profile, { inspectionDate: "2026-09-08" });
assert.equal(round.snapshot.vehicleReviewScopeVersion, VEHICLE_REVIEW_SCOPE_VERSION);
assert.deepEqual(Object.keys(round.vehicleSearch.scopes), VEHICLE_REVIEW_SCOPE_KEYS);
const blocked = getCloseReadiness(round);
assert.equal(blocked.blockers.filter((entry) => entry.type === "vehicle-search-fetch").length, 2, "both day and night scopes must be fetched");
assert.equal(blocked.canClose, false, "missing Vehicle API fetches remain incomplete");
assert.equal(blocked.canConfirmClose, true, "missing Vehicle API fetches are warnings the user can acknowledge when closing");
const dayReady = updateVehicleSearchScope(round.vehicleSearch, "day", {
  ...round.vehicleSearch.scopes.day,
  fetchedAt: "2026-09-08T12:00:00.000Z",
  sourceStation: { id: profile.id, name: profile.stationName },
  rows: [],
  emptyResultAcknowledgedAt: "2026-09-08T12:01:00.000Z",
});
const nightReady = updateVehicleSearchScope(dayReady, "night", {
  ...dayReady.scopes.night,
  fetchedAt: "2026-09-08T20:00:00.000Z",
  sourceStation: { id: profile.id, name: profile.stationName },
  rows: [],
  emptyResultAcknowledgedAt: "2026-09-08T20:01:00.000Z",
});
const emptyReadiness = getCloseReadiness({ ...round, vehicleSearch: nightReady });
assert.equal(emptyReadiness.blockers.some((entry) => entry.type === "vehicle-search-threshold"), true, "acknowledged empty day/night scopes remain visible as incomplete");
assert.equal(emptyReadiness.canConfirmClose, true, "an acknowledged empty Vehicle API response can be saved with a warning");
console.log("vehicle day/night review domain tests passed");
