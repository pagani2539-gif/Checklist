import assert from "node:assert/strict";
import {
  buildVehicleSearchConnection,
  createVehicleSearchConfig,
  getVehicleApiAdapter,
  getVehicleSearchIntegrityWarnings,
  buildVehicleSearchPayload,
  buildVehicleSearchImageUrl,
  buildVehicleSearchDirectImageUrl,
  createEmptyVehicleSearchState,
  getVehicleSearchSummary,
  getVehicleSearchReviewSummary,
  getVehicleQueueGroups,
  getVehicleReviewGroupKey,
  getVehicleReviewRows,
  getVehicleReviewNavigation,
  getNextPendingVehicleId,
  getVehicleReviewState,
  getVehicleReviewOutcome,
  getVehicleReviewContext,
  getVehicleReviewContextByKey,
  getVehicleReviewDimensions,
  isVehicleApiReviewItem,
  isVehicleSearchItem,
  normalizeVehicleSearchRows,
  normalizeVehicleSearchState,
  normalizeVehicleSearchBaseUrl,
  normalizeVehicleSearchEndpoint,
  parseVehicleSearchUrl,
  normalizeVehicleSearchHost,
  normalizeVehicleSearchPort,
  searchVehicles,
  testVehicleSearchConnection,
  VEHICLE_API_PROFILES,
  VEHICLE_CONNECTION_MODES,
  updateVehicleSearchDimensionReview,
  updateVehicleSearchReviewDetails,
  updateVehicleSearchReview,
  VEHICLE_REVIEW_CONTEXT_OPTIONS,
} from "../src/domain/vehicle-search.js";
import {
  createDefaultStationProfile,
  createInspectionRound,
  buildInspectionSections,
  getCloseReadiness,
  normalizeRound,
} from "../src/domain/master-checklist.js";
import { createRevisionRound } from "../src/domain/correction.js";
import { createUiDemoRound } from "../src/domain/demo-fixture.js";

const criteria = { startAt: "2026-09-08T08:15", endAt: "2026-09-08T17:45" };
const baseUrl = "http://test-vehicle-api:3005";
const forwarderUrl = "http://61.19.97.189:3005/api?target=http://192.168.164.90:3005/api/vehicle/search";
assert.equal(normalizeVehicleSearchBaseUrl(`${baseUrl}/`), baseUrl);
assert.equal(normalizeVehicleSearchEndpoint(forwarderUrl), "http://61.19.97.189:3005/api?target=http://192.168.164.90:3005/api/vehicle/search");
assert.equal(normalizeVehicleSearchBaseUrl("file:///tmp/vehicle"), "");
assert.equal(normalizeVehicleSearchBaseUrl("http://user:pass@example.com:3005"), "");
assert.equal(normalizeVehicleSearchHost("192.168.145.90"), "192.168.145.90");
assert.equal(normalizeVehicleSearchHost("http://192.168.145.90"), "");
assert.equal(normalizeVehicleSearchPort("3010"), 3010);
assert.equal(normalizeVehicleSearchPort("65536"), null);
assert.equal(normalizeVehicleSearchPort("", 3005), 3005);
const emptyConfig = createVehicleSearchConfig({ baseUrl: "" });
assert.equal(emptyConfig.baseUrl, "");
assert.equal(emptyConfig.connectionStatus, "not-configured");
assert.equal(emptyConfig.stationPort, 3005);
const directPortConfig = createVehicleSearchConfig({ connectionMode: VEHICLE_CONNECTION_MODES.DIRECT, stationHost: "192.168.145.90", stationPort: 3010, apiProfile: VEHICLE_API_PROFILES.IMPS_V2 });
assert.deepEqual({ baseUrl: directPortConfig.baseUrl, searchUrl: directPortConfig.searchUrl || "", apiProfile: directPortConfig.apiProfile, stationHost: directPortConfig.stationHost, stationPort: directPortConfig.stationPort }, { baseUrl: "http://192.168.145.90:3010", searchUrl: "http://192.168.145.90:3010/api/v2/vehicles/search", apiProfile: "imps-v2", stationHost: "192.168.145.90", stationPort: 3010 });
const directLegacyConfig = createVehicleSearchConfig({ connectionMode: VEHICLE_CONNECTION_MODES.DIRECT, stationHost: "192.168.145.90", stationPort: 3010, apiProfile: VEHICLE_API_PROFILES.LEGACY_V1 });
assert.equal(directLegacyConfig.searchUrl, "http://192.168.145.90:3010/api/vehicle/search");
assert.notEqual(directLegacyConfig.searchUrl, directPortConfig.searchUrl, "changing the API profile must change the generated URL");
const proxyPortConfig = createVehicleSearchConfig({ connectionMode: VEHICLE_CONNECTION_MODES.PROXY, stationHost: "192.168.145.90", stationPort: 3010, proxyHost: "61.19.97.189", proxyPort: 3005, apiProfile: VEHICLE_API_PROFILES.LEGACY_V1 });
assert.equal(proxyPortConfig.baseUrl, "http://192.168.145.90:3010");
assert.equal(proxyPortConfig.searchUrl, "http://61.19.97.189:3005/api?target=http://192.168.145.90:3010/api/vehicle/search");
assert.equal(buildVehicleSearchConnection({ connectionMode: VEHICLE_CONNECTION_MODES.PROXY, stationHost: "192.168.145.90", stationPort: 3010, proxyHost: "61.19.97.189", proxyPort: 3005, apiProfile: VEHICLE_API_PROFILES.IMPS_V2 }).searchUrl, "http://61.19.97.189:3005/api?target=http://192.168.145.90:3010/api/v2/vehicles/search");
const forwarderConfig = createVehicleSearchConfig({ baseUrl: forwarderUrl });
assert.equal(forwarderConfig.baseUrl, "http://192.168.164.90:3005");
assert.equal(forwarderConfig.searchUrl, forwarderUrl);
const pastedProxyV2 = parseVehicleSearchUrl("http://61.19.97.189:3005/api?target=http://192.168.145.90:3010/api/v2/vehicles/search");
assert.equal(pastedProxyV2.valid, true);
assert.equal(pastedProxyV2.mode, VEHICLE_CONNECTION_MODES.PROXY);
assert.equal(pastedProxyV2.apiProfile, VEHICLE_API_PROFILES.IMPS_V2);
assert.equal(pastedProxyV2.stationHost, "192.168.145.90");
assert.equal(pastedProxyV2.stationPort, 3010);
assert.equal(pastedProxyV2.proxyHost, "61.19.97.189");
assert.equal(pastedProxyV2.proxyPort, 3005);
assert.equal(pastedProxyV2.searchUrl, "http://61.19.97.189:3005/api?target=http://192.168.145.90:3010/api/v2/vehicles/search");
const pastedDirectV2 = parseVehicleSearchUrl("http://192.168.145.90:3010/api/v2/vehicles/search");
assert.equal(pastedDirectV2.valid, true);
assert.equal(pastedDirectV2.mode, VEHICLE_CONNECTION_MODES.DIRECT);
assert.equal(pastedDirectV2.apiProfile, VEHICLE_API_PROFILES.IMPS_V2);
assert.equal(pastedDirectV2.searchUrl, "http://192.168.145.90:3010/api/v2/vehicles/search");
assert.equal(parseVehicleSearchUrl("not-a-url").valid, false);
assert.deepEqual(VEHICLE_REVIEW_CONTEXT_OPTIONS.map(({ key, itemId, checklistNumber }) => ({ key, itemId, checklistNumber })), [
  { key: "plate", itemId: "5.1.plate-document", checklistNumber: "5.1.5" },
  { key: "classification", itemId: "5.1.vehicle-document", checklistNumber: "5.1.6" },
]);
assert.equal(getVehicleReviewContext({ id: "5.1.plate-document" })?.key, "plate");
assert.equal(getVehicleReviewContext({ id: "5.1.vehicle-document" })?.key, "classification");
assert.equal(getVehicleReviewContextByKey("classification")?.label, "เอกสารผลการจำแนกประเภทรถ");
assert.deepEqual(getVehicleReviewDimensions("vehicle-api-review-v2", "plate").map(({ key }) => key), ["plate"]);
assert.deepEqual(getVehicleReviewDimensions("vehicle-api-review-v2", "classification").map(({ key }) => key), ["classification"]);
assert.deepEqual(getVehicleReviewDimensions("vehicle-api-review-v1", "classification").map(({ key }) => key), []);
assert.deepEqual(getVehicleApiAdapter(VEHICLE_API_PROFILES.IMPS_V2), {
  searchPath: "/api/v2/vehicles/search",
  imagePath: "/api/v2/vehicles/image",
  healthPath: "/api/v2/health",
  configurationPath: "/api/v2/configurations",
  hourlyCountPath: "/api/v2/vehicles/count/hourly",
  requestFields: { dateFrom: "startDateTime", dateTo: "endDateTime" },
});
assert.equal(buildVehicleSearchImageUrl("crop/2026/09/08/example_cropped.jpg", baseUrl), "/api/vehicle/image?baseUrl=http%3A%2F%2Ftest-vehicle-api%3A3005&path=crop%2F2026%2F09%2F08%2Fexample_cropped.jpg");
assert.equal(buildVehicleSearchImageUrl("overview/2026/09/08/overview_1.jpg", baseUrl), "/api/vehicle/image?baseUrl=http%3A%2F%2Ftest-vehicle-api%3A3005&path=overview%2F2026%2F09%2F08%2Foverview_1.jpg");
assert.equal(buildVehicleSearchImageUrl("images_01/2026/09/08/model.jpg", baseUrl), "", "images_01 is not accepted as review evidence");
assert.equal(buildVehicleSearchDirectImageUrl(buildVehicleSearchImageUrl("crop/2026/09/08/example_cropped.jpg", baseUrl)), "http://test-vehicle-api:3005/api/vehicle/image?path=crop%2F2026%2F09%2F08%2Fexample_cropped.jpg");
assert.equal(buildVehicleSearchDirectImageUrl(buildVehicleSearchImageUrl("overview/2026/09/08/overview_1.jpg", baseUrl)), "http://test-vehicle-api:3005/api/vehicle/image?path=overview%2F2026%2F09%2F08%2Foverview_1.jpg");
const imagePath = "crop/2026/09/14/lpr_1_cropped.jpg";
const configuredProxyImageUrl = buildVehicleSearchImageUrl(imagePath, forwarderConfig.baseUrl, { searchUrl: forwarderConfig.searchUrl });
assert.equal(new URL(configuredProxyImageUrl).origin, "http://61.19.97.189:3005");
const configuredProxyTarget = new URL(new URL(configuredProxyImageUrl).searchParams.get("target"));
assert.equal(configuredProxyTarget.origin, "http://192.168.164.90:3005");
assert.equal(configuredProxyTarget.pathname, "/api/vehicle/image");
assert.equal(configuredProxyTarget.searchParams.get("path"), imagePath);
assert.equal(buildVehicleSearchImageUrl(imagePath, "http://125.26.99.7:3005", { searchUrl: "http://125.26.99.7:3005/api/vehicle/search" }), `http://125.26.99.7:3005/api/vehicle/image?path=${encodeURIComponent(imagePath)}`);
const configuredImageRows = normalizeVehicleSearchRows({ data: [{ id: 1, plate: { license_plate: "90-0117", crop_path: imagePath } }] }, { baseUrl: forwarderConfig.baseUrl, searchUrl: forwarderConfig.searchUrl });
assert.equal(configuredImageRows[0].plateImage, configuredProxyImageUrl, "configured proxy endpoint must also carry image URLs");
const absoluteImageRows = normalizeVehicleSearchRows({
  data: [{
    id: 2,
    plate: {
      license_plate: "64-4153",
      crop_path: `${baseUrl}/api/vehicle/image?path=${encodeURIComponent(imagePath)}`,
    },
  }],
}, { baseUrl });
assert.equal(absoluteImageRows[0].plateImage, buildVehicleSearchImageUrl(imagePath, baseUrl), "absolute Vehicle API image URLs must use the same-origin image proxy");
assert.deepEqual(buildVehicleSearchPayload(criteria), {
  startDate: "2026-09-08T08:15:00+07:00",
  endDate: "2026-09-08T17:45:00+07:00",
  pageSize: 200,
  page: 1,
}, "send the live API contract, not UI-only criteria names");
assert.deepEqual(buildVehicleSearchPayload(criteria, { apiProfile: VEHICLE_API_PROFILES.IMPS_V2 }), {
  startDateTime: "2026-09-08T08:15:00+07:00",
  endDateTime: "2026-09-08T17:45:00+07:00",
  pageSize: 200,
  page: 1,
}, "the IMPS v2 adapter uses its documented datetime field names");

const payload = {
  data: {
    items: [
      { id: "event-1", license_plate: "กข 1234", vehicleType: "รถบรรทุก" },
      { id: "event-2", plate: "9กก-9999", weight: 12000 },
      { id: "event-3", vehicleType: "ไม่มีป้าย" },
      { id: "event-4", plate: "9กก-9999", classification: { name: "รถยนต์" } },
    ],
  },
};
const rows = normalizeVehicleSearchRows(payload);
assert.deepEqual(rows.map(({ id, plateNumber, province, plateImage, reviewStatus }) => ({ id, plateNumber, province, plateImage, reviewStatus })), [
  { id: "vehicle-event-1", plateNumber: "กข 1234", province: null, plateImage: null, reviewStatus: "pending" },
  { id: "vehicle-event-2", plateNumber: "9กก-9999", province: null, plateImage: null, reviewStatus: "pending" },
  { id: "vehicle-event-3", plateNumber: "ไม่พบผลอ่านป้าย", province: null, plateImage: null, reviewStatus: "pending" },
  { id: "vehicle-event-4", plateNumber: "9กก-9999", province: null, plateImage: null, reviewStatus: "pending" },
]);
assert.equal(rows.length, 4, "every vehicle remains in the review population, including a missing plate");

const liveResponseShapeRows = normalizeVehicleSearchRows({
  status: "success",
  pagination: { currentPage: 1, pageSize: 50 },
  data: [
    { id: 458493, vehicleId: 9001, stamp: "2026-09-08T08:15:00+07:00", stationID: 6, lane: 1, plate: { license_plate: "กข 1234", province: "เพชรบุรี", crop_path: "crop/2026/09/08/example_cropped.jpg" }, images: [{ path: "images_01/2026/09/08/model.jpg" }, { path: "overview/2026/09/08/overview_1.jpg" }], VehicleClassID: 2, BosureDescription: "รถ 6 ล้อ (15 ตัน)", LongDescription: "รถ 2 เพลา 4 ล้อ", DisplayID: 2, Reference: "ลำดับ 2", axlesCount: 2, axles: [{ groupID: 0, number: 1, speedLeft: 50, speedRight: 50, weight: 3840, weightLeft: 1900, weightRight: 1940, wheelbase: 0, dualTire: false }, { groupID: 0, number: 2, speedLeft: 50, speedRight: 50, weight: 4160, weightLeft: 2080, weightRight: 2080, wheelbase: 383, dualTire: true }], axlesAfterAllowance: [{ allowance: 0, axleWeight: 4160, number: 2 }, { allowance: 0, axleWeight: 3840, number: 1 }], gvw: 8000, gvwMax: 15000, leftWeight: 3980, rightWeight: 4020, speed: 50, length: 622, esal: 30.67, isOverweight: false, overweightPercentage: 0, errorFlags: [], warningFlags: [], weight: 8000 },
    { id: 458494, plate: { plate_path: "/images/plate.jpg" }, weight: 2140 },
  ],
}, { baseUrl });
assert.deepEqual(liveResponseShapeRows.map(({ id, plateNumber, province, plateImage, reviewStatus }) => ({ id, plateNumber, province, plateImage, reviewStatus })), [
  { id: "vehicle-458493", plateNumber: "กข 1234", province: "เพชรบุรี", plateImage: "/api/vehicle/image?baseUrl=http%3A%2F%2Ftest-vehicle-api%3A3005&stationId=6&path=crop%2F2026%2F09%2F08%2Fexample_cropped.jpg", reviewStatus: "pending" },
  { id: "vehicle-458494", plateNumber: "ไม่พบผลอ่านป้าย", province: null, plateImage: null, reviewStatus: "pending" },
], "adapt the live data[].plate.license_plate shape while retaining records without a result");
assert.equal(liveResponseShapeRows[0].overviewImage, "/api/vehicle/image?baseUrl=http%3A%2F%2Ftest-vehicle-api%3A3005&stationId=6&path=overview%2F2026%2F09%2F08%2Foverview_1.jpg");
assert.equal(liveResponseShapeRows[0].grossWeight, 8000);
assert.equal(liveResponseShapeRows[0].vehicleId, "9001");
assert.equal(liveResponseShapeRows[0].stationId, "6");
assert.equal(liveResponseShapeRows[0].lane, "1");
assert.equal(liveResponseShapeRows[0].grossWeightLimit, 15000);
assert.equal(liveResponseShapeRows[0].speed, 50);
assert.equal(liveResponseShapeRows[0].length, 622);
assert.equal(liveResponseShapeRows[0].esal, 30.67);
assert.equal(liveResponseShapeRows[0].leftWeight, 3980);
assert.equal(liveResponseShapeRows[0].rightWeight, 4020);
assert.equal(liveResponseShapeRows[0].isOverweight, false);
assert.deepEqual(liveResponseShapeRows[0].integrityWarnings, []);
assert.equal(liveResponseShapeRows[1].vehicleClassLabel, "ไม่ระบุประเภทรถ", "missing classification remains explicit for the reviewer");
assert.equal(liveResponseShapeRows[1].vehicleClassDisplayId, null);
assert.deepEqual(liveResponseShapeRows[1].axles, [], "missing axle details remain an empty reviewable payload");
assert.equal(liveResponseShapeRows[1].classificationReviewStatus, "pending");
assert.equal(liveResponseShapeRows[1].axleReviewStatus, "pending");
assert.equal(liveResponseShapeRows[1].integrityReviewStatus, "pending");

const flatV2Rows = normalizeVehicleSearchRows({ data: [{
  id: 560,
  vehicleId: 560,
  axlesCount: 2,
  gvw: 8000,
  gvwMax: 15000,
  stamp: "2025-03-27T08:00:00+07:00",
  vehicleClassId: 2,
  lane: 1,
  leftWeight: 4000,
  rightWeight: 4000,
  length: 620,
  esal: 10,
  displayId: 2,
  bosureDescription: "รถ 6 ล้อ",
  longDescription: "รถบรรทุก 2 เพลา",
  licensePlate: "กข 560",
  province: "นครปฐม",
  cropPath: "crop/2025/03/27/560.jpg",
  overviewPath: "overview/2025/03/27/560.jpg",
  axles: [{ number: 1, weight: 4000, weightLeft: 2000, weightRight: 2000 }, { number: 2, weight: 4000, weightLeft: 2000, weightRight: 2000 }],
  errorFlags: [],
  warningFlags: [],
  stationId: 6,
  stationName: "สถานี API ทดสอบ",
}] }, { baseUrl, apiProfile: VEHICLE_API_PROFILES.IMPS_V2 });
assert.deepEqual({
  plateNumber: flatV2Rows[0].plateNumber,
  stationName: flatV2Rows[0].stationName,
  vehicleClassLabel: flatV2Rows[0].vehicleClassLabel,
  vehicleDescription: flatV2Rows[0].vehicleDescription,
  vehicleClassDisplayId: flatV2Rows[0].vehicleClassDisplayId,
  overviewImage: flatV2Rows[0].overviewImage,
}, {
  plateNumber: "กข 560",
  stationName: "สถานี API ทดสอบ",
  vehicleClassLabel: "รถ 6 ล้อ",
  vehicleDescription: "รถบรรทุก 2 เพลา",
  vehicleClassDisplayId: 2,
  overviewImage: "/api/vehicle/image?baseUrl=http%3A%2F%2Ftest-vehicle-api%3A3005&apiProfile=imps-v2&stationId=6&path=overview%2F2025%2F03%2F27%2F560.jpg",
}, "normalize the flat IMPS v2 vehicle response contract");

const integrityWarnings = getVehicleSearchIntegrityWarnings({
  stamp: "2026-09-08T08:15:00+07:00",
  stationID: 6,
  lane: 1,
  VehicleClassID: 2,
  gvw: 9000,
  gvwMax: 8000,
  leftWeight: 4000,
  rightWeight: 4000,
  isOverweight: false,
  axlesCount: 2,
  axles: [{ number: 1, weight: 5000, weightLeft: 2000, weightRight: 2000 }],
  errorFlags: ["sensor"],
  warningFlags: ["ocr"],
});
assert.deepEqual(integrityWarnings.map((warning) => warning.code), [
  "gross-weight-mismatch",
  "axle-count-mismatch",
  "axle-side-weight-mismatch",
  "gross-side-weight-mismatch",
  "overweight-flag-mismatch",
  "error-flags",
  "warning-flags",
]);
assert.deepEqual({
  vehicleClassId: liveResponseShapeRows[0].vehicleClassId,
  vehicleClassLabel: liveResponseShapeRows[0].vehicleClassLabel,
  vehicleDescription: liveResponseShapeRows[0].vehicleDescription,
  vehicleClassDisplayId: liveResponseShapeRows[0].vehicleClassDisplayId,
  vehicleClassReference: liveResponseShapeRows[0].vehicleClassReference,
  axleCount: liveResponseShapeRows[0].axleCount,
  axles: liveResponseShapeRows[0].axles,
  axlesAfterAllowance: liveResponseShapeRows[0].axlesAfterAllowance,
  classificationReviewStatus: liveResponseShapeRows[0].classificationReviewStatus,
  axleReviewStatus: liveResponseShapeRows[0].axleReviewStatus,
}, {
  vehicleClassId: "2",
  vehicleClassLabel: "รถ 6 ล้อ (15 ตัน)",
  vehicleDescription: "รถ 2 เพลา 4 ล้อ",
  vehicleClassDisplayId: 2,
  vehicleClassReference: "ลำดับ 2",
  axleCount: 2,
  axles: [{ groupId: 0, number: 1, speedLeft: 50, speedRight: 50, weight: 3840, weightLeft: 1900, weightRight: 1940, wheelbase: 0, dualTire: false }, { groupId: 0, number: 2, speedLeft: 50, speedRight: 50, weight: 4160, weightLeft: 2080, weightRight: 2080, wheelbase: 383, dualTire: true }],
  axlesAfterAllowance: [{ allowance: 0, axleWeight: 4160, number: 2 }, { allowance: 0, axleWeight: 3840, number: 1 }],
  classificationReviewStatus: "pending",
  axleReviewStatus: "pending",
});

const dimensionReviewed = updateVehicleSearchDimensionReview(
  updateVehicleSearchDimensionReview(
    updateVehicleSearchDimensionReview({ rows: liveResponseShapeRows }, "vehicle-458493", "plate", "correct"),
    "vehicle-458493",
    "classification",
    "incorrect",
  ),
  "vehicle-458493",
  "axle",
  "correct",
);
assert.deepEqual({
  plate: dimensionReviewed.rows[0].reviewStatus,
  classification: dimensionReviewed.rows[0].classificationReviewStatus,
  axle: dimensionReviewed.rows[0].axleReviewStatus,
}, { plate: "correct", classification: "incorrect", axle: "correct" });
assert.equal(getVehicleSearchReviewSummary(dimensionReviewed).classification.pending, 1);
assert.equal(getVehicleSearchReviewSummary(dimensionReviewed).axles.pending, 1);
const unableReviewed = updateVehicleSearchDimensionReview(dimensionReviewed, "vehicle-458493", "integrity", "unable-to-verify");
assert.equal(getVehicleSearchReviewSummary(unableReviewed).integrity.unableToVerify, 1);
assert.equal(getVehicleSearchReviewSummary(unableReviewed).unresolvedChecks > 0, true);

const initial = { criteria, fetchedAt: "2026-09-08T01:00:00.000Z", rows };
const reviewed = updateVehicleSearchReview(initial, "vehicle-event-1", "correct");
const reviewedAgain = updateVehicleSearchReview(reviewed, "vehicle-event-2", "incorrect");
assert.equal(reviewedAgain.rows[0].reviewStatus, "correct");
assert.equal(reviewedAgain.rows[1].reviewStatus, "incorrect");
assert.deepEqual(getVehicleSearchSummary(reviewedAgain), { total: 4, reviewed: 2, correct: 1, incorrect: 1, pending: 2, accuracy: 50 });
assert.equal(getVehicleSearchSummary(createEmptyVehicleSearchState()).accuracy, null, "accuracy is unavailable before review");

const corrected = updateVehicleSearchDimensionReview(
  { criteria: { startAt: "2026-09-08T00:00", endAt: "2026-09-08T06:00" }, fetchedAt: "2026-09-08T06:00:00.000Z", rows: [{ ...liveResponseShapeRows[0], reviewStatus: "pending" }] },
  "vehicle-458493",
  "plate",
  "incorrect",
  { correctedValue: "กข 9999", reasonCode: "ocr-error", note: "ผู้ตรวจอ่านจากภาพป้าย", reviewedBy: "ผู้ตรวจ A" },
);
assert.equal(corrected.rows[0].plateNumber, "กข 1234", "the API plate remains immutable");
assert.equal(corrected.rows[0].reviewDetails.plate.correctedValue, "กข 9999");
assert.equal(corrected.rows[0].reviewDetails.plate.reasonCode, "ocr-error");
assert.equal(corrected.rows[0].reviewDetails.plate.history.length, 1);
const withEvidence = updateVehicleSearchReviewDetails(corrected, "vehicle-458493", "plate", { evidenceAttachment: { id: "att-1", name: "ป้าย.jpg", type: "image/jpeg", size: 120 } });
assert.equal(withEvidence.rows[0].reviewDetails.plate.evidenceAttachment.id, "att-1");

const outcomeFixture = (fixtureRows, overrides = {}) => ({
  criteria: { startAt: "2026-09-08T00:00", endAt: "2026-09-08T06:00", ...(overrides.criteria || {}) },
  fetchedAt: "2026-09-08T06:00:00.000Z",
  sourceStation: { id: "6", name: "สถานี API ทดสอบ" },
  rows: fixtureRows,
});
const twoRowsAtThreshold = [
  { id: "outcome-1", plateNumber: "A", vehicleClassLabel: "รถ 6 ล้อ", grossWeight: 8000, reviewStatus: "correct", classificationReviewStatus: "correct" },
  { id: "outcome-2", plateNumber: "B", vehicleClassLabel: "รถ 6 ล้อ", grossWeight: 9000, reviewStatus: "correct", classificationReviewStatus: "correct" },
];
assert.equal(getVehicleReviewOutcome(outcomeFixture(twoRowsAtThreshold)).status, "passed", "six hours plus complete results pass both thresholds");
assert.equal(getVehicleReviewOutcome(outcomeFixture([{ ...twoRowsAtThreshold[0], reviewStatus: "incorrect" }, twoRowsAtThreshold[1]])).status, "failed", "plate below 80 percent fails the round");
assert.equal(getVehicleReviewOutcome(outcomeFixture([{ ...twoRowsAtThreshold[0], classificationReviewStatus: "incorrect" }, twoRowsAtThreshold[1]])).status, "failed", "classification below 90 percent fails the round");
assert.equal(getVehicleReviewOutcome(outcomeFixture([{ ...twoRowsAtThreshold[0], reviewStatus: "unable-to-verify" }, twoRowsAtThreshold[1]])).status, "incomplete", "unable-to-verify is not counted as correct");
assert.equal(getVehicleReviewOutcome(outcomeFixture([{ ...twoRowsAtThreshold[0], grossWeight: null }, twoRowsAtThreshold[1]])).status, "failed", "missing gross weight fails the overall round");

const calls = [];
const fetched = await searchVehicles(criteria, {
  fetchImpl: async (endpoint, options) => {
    calls.push({ endpoint, options });
    return { ok: true, status: 200, text: async () => JSON.stringify({ results: [{ plateNumber: "กข 1234", secretField: "discard" }] }) };
  },
  baseUrl,
});
assert.equal(calls.length, 1);
assert.equal(calls[0].options.method, "POST");
assert.deepEqual(JSON.parse(calls[0].options.body), { baseUrl, payload: {
  startDate: "2026-09-08T08:15:00+07:00",
  endDate: "2026-09-08T17:45:00+07:00",
  pageSize: 200,
  page: 1,
} });
assert.equal(fetched.rows[0].plateNumber, "กข 1234");

const noPlateResult = await searchVehicles(criteria, {
  fetchImpl: async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ results: [{ vehicleType: "รถบรรทุก" }] }) }),
  baseUrl,
});
assert.equal(noPlateResult.rows[0].plateNumber, "ไม่พบผลอ่านป้าย", "a vehicle without an OCR result remains in the review queue");

const connectionCalls = [];
const connection = await testVehicleSearchConnection(baseUrl, {
  date: "2026-09-08",
  fetchImpl: async (endpoint, options) => {
    connectionCalls.push({ endpoint, options });
    return { ok: true, status: 200, text: async () => JSON.stringify({ data: [] }) };
  },
});
assert.equal(connection.status, 200);
assert.deepEqual(JSON.parse(connectionCalls[0].options.body), {
  baseUrl,
  payload: { startDate: "2026-09-08T00:00:00+07:00", endDate: "2026-09-08T23:59:00+07:00", pageSize: 200, page: 1 },
});

const directCalls = [];
const directResult = await searchVehicles(criteria, {
  baseUrl,
  transport: "direct-first",
  fetchImpl: async (endpoint, options) => {
    directCalls.push({ endpoint, options });
    return { ok: true, status: 200, text: async () => JSON.stringify({ data: [{ id: "direct-1", plate: { license_plate: "กข 9999", crop_path: "crop/direct.jpg", province: "กรุงเทพมหานคร" } }] }) };
  },
});
assert.equal(directCalls.length, 1);
assert.equal(directCalls[0].endpoint, `${baseUrl}/api/vehicle/search`);
assert.deepEqual(JSON.parse(directCalls[0].options.body), {
  startDate: "2026-09-08T08:15:00+07:00",
  endDate: "2026-09-08T17:45:00+07:00",
  pageSize: 200,
  page: 1,
});
assert.equal(directResult.rows[0].plateNumber, "กข 9999");
assert.equal(directResult.rows[0].plateImage, `${baseUrl}/api/vehicle/image?path=crop%2Fdirect.jpg`);

const forwarderCalls = [];
const forwarderResult = await searchVehicles(criteria, {
  baseUrl: forwarderConfig.baseUrl,
  searchUrl: forwarderConfig.searchUrl,
  transport: "direct-first",
  fetchImpl: async (endpoint, options) => {
    forwarderCalls.push({ endpoint, options });
    return { ok: true, status: 200, text: async () => JSON.stringify({ data: [{ id: "forwarded-1", plateNumber: "กข 6161" }] }) };
  },
});
assert.equal(forwarderCalls.length, 1);
assert.equal(forwarderCalls[0].endpoint, forwarderUrl);
assert.deepEqual(JSON.parse(forwarderCalls[0].options.body), {
  startDate: "2026-09-08T08:15:00+07:00",
  endDate: "2026-09-08T17:45:00+07:00",
  pageSize: 200,
  page: 1,
});
assert.equal(forwarderResult.rows[0].plateNumber, "กข 6161");

const forwarderConnectionCalls = [];
const forwarderConnection = await testVehicleSearchConnection(forwarderConfig.baseUrl, {
  searchUrl: forwarderConfig.searchUrl,
  transport: "direct-first",
  fetchImpl: async (endpoint, options) => {
    forwarderConnectionCalls.push({ endpoint, options });
    return { ok: true, status: 200, text: async () => JSON.stringify({ data: [] }) };
  },
});
assert.equal(forwarderConnection.status, 200);
assert.equal(forwarderConnectionCalls[0].endpoint, forwarderUrl);

const v2Calls = [];
const v2Result = await searchVehicles(criteria, {
  baseUrl,
  apiProfile: VEHICLE_API_PROFILES.IMPS_V2,
  transport: "direct-first",
  fetchImpl: async (endpoint, options) => {
    v2Calls.push({ endpoint, options });
    return { ok: true, status: 200, text: async () => JSON.stringify({ status: "success", pagination: { currentPage: 1, totalPages: 1, pageSize: 200, totalRecords: 1 }, data: [{ id: 42, stationID: 6, stamp: "2026-09-08T08:15:00+07:00", lane: 2, plate: { license_plate: "กข 4242", province: "กาญจนบุรี", crop_path: "crop/v2.jpg" }, VehicleClassID: 2, BosureDescription: "รถ 6 ล้อ", LongDescription: "รถ 2 เพลา", DisplayID: 2, axlesCount: 2, axles: [{ number: 1, weight: 4000, weightLeft: 2000, weightRight: 2000 }, { number: 2, weight: 4000, weightLeft: 2000, weightRight: 2000 }], gvw: 8000, gvwMax: 15000, leftWeight: 4000, rightWeight: 4000, speed: 50, length: 600, esal: 12, isOverweight: false, overweightPercentage: 0, errorFlags: [], warningFlags: [] }] }) };
  },
});
assert.equal(v2Calls.length, 1);
assert.equal(v2Calls[0].endpoint, `${baseUrl}/api/v2/vehicles/search`);
assert.deepEqual(JSON.parse(v2Calls[0].options.body), {
  startDateTime: "2026-09-08T08:15:00+07:00",
  endDateTime: "2026-09-08T17:45:00+07:00",
  pageSize: 200,
  page: 1,
});
assert.equal(v2Result.pagination.totalItems, 1);
assert.equal(v2Result.rows[0].plateImage, `${baseUrl}/api/v2/vehicles/image?path=crop%2Fv2.jpg`);

const abortController = new AbortController();
abortController.abort();
await assert.rejects(
  () => searchVehicles(criteria, {
    signal: abortController.signal,
    baseUrl,
    fetchImpl: async (_endpoint, options) => {
      const error = new Error("aborted");
      error.name = "AbortError";
      assert.equal(options.signal, abortController.signal);
      throw error;
    },
  }),
  (error) => error?.name === "AbortError",
  "aborted requests should remain abortable for the UI",
);

const profile = createDefaultStationProfile();
profile.vehicleSearchConfig = createVehicleSearchConfig({ baseUrl, stationId: "6", stationName: "สถานี API ทดสอบ" });
const round = createInspectionRound(profile, { inspectionDate: "2026-09-08" });
assert.equal(round.snapshot.vehicleSearchConfig.baseUrl, baseUrl);
assert.equal(round.snapshot.vehicleSearchConfig.apiProfile, "legacy-v1");
assert.equal(round.snapshot.vehicleSearchConfig.stationHost, "test-vehicle-api");
assert.equal(round.snapshot.vehicleSearchConfig.stationPort, 3005);
assert.equal(round.snapshot.vehicleSearchConfig.stationId, "6");
assert.equal(round.snapshot.vehicleReviewVersion, "vehicle-api-review-v2", "new rounds snapshot the full vehicle API review workflow");
const snapshotBefore = JSON.stringify(round.snapshot);
const qualifiedRows = rows.map((row) => ({ ...row, grossWeight: 8000, vehicleClassLabel: row.vehicleClassLabel === "ไม่ระบุประเภทรถ" ? "รถบรรทุก" : row.vehicleClassLabel }));
const reviewedForNewRound = { ...reviewedAgain, rows: qualifiedRows.map((row) => ({ ...row, reviewStatus: row.id === "vehicle-event-1" ? "correct" : row.reviewStatus })), sourceStation: { id: "6", name: "สถานี API ทดสอบ" } };
const roundWithVehicleSearch = { ...round, vehicleSearch: reviewedForNewRound };
const readiness = getCloseReadiness(roundWithVehicleSearch);
assert.equal(readiness.blockers.some((entry) => entry.type === "vehicle-search-review" && entry.rowId === "vehicle-event-1" && entry.reviewKind === "classification"), true);
assert.equal(readiness.canConfirmClose, true, "unresolved Vehicle API reviews remain warnings when closing");
assert.equal(JSON.stringify(round.snapshot), snapshotBefore, "vehicle results do not mutate the Snapshot");

const currentVehicleItem = round.inspectionItems && Object.keys(round.inspectionItems).find((id) => id.includes("5.1.plate-document"));
const currentVehicleDefinition = buildInspectionSections(round.snapshot).flatMap((section) => section.items).find((item) => item.id === currentVehicleItem);
assert.equal(isVehicleApiReviewItem(currentVehicleDefinition, round.snapshot), true);
assert.equal(currentVehicleDefinition.label, "Database Management and Reporting System · ตรวจผลอ่านป้ายทะเบียนจาก API", "new v2 snapshots use API-only plate review copy");
assert.equal(currentVehicleDefinition.evidenceSlots.length, 0, "new API-only work has no document slot");
assert.equal(round.inspectionItems[currentVehicleItem].status, "normal", "new API-only work has no pending physical-condition status");
const currentReadiness = getCloseReadiness(roundWithVehicleSearch);
assert.equal(currentReadiness.blockers.find((entry) => entry.type === "vehicle-search-review")?.itemId, currentVehicleItem || "5.1.plate-document", "incomplete review warning targets the stored asset-mapped plate item");
assert.equal(currentReadiness.canConfirmClose, true, "unresolved Vehicle API reviews can be acknowledged at closure");

const plateOnlyReviewed = rows.reduce((state, row) => updateVehicleSearchDimensionReview(state, row.id, "plate", "correct"), { criteria, fetchedAt: "2026-09-08T01:00:00.000Z", sourceStation: { id: "6", name: "สถานี API ทดสอบ" }, rows });
const legacyReadiness = getCloseReadiness({ ...round, snapshot: { ...round.snapshot, vehicleReviewVersion: "vehicle-api-review-v1" }, vehicleSearch: plateOnlyReviewed });
assert.equal(legacyReadiness.blockers.some((entry) => entry.type.startsWith("vehicle-search")), false, "legacy v1 rounds only require plate review");

const fullyReviewed = qualifiedRows.reduce((state, row) => ["plate", "classification"].reduce((next, dimension) => updateVehicleSearchDimensionReview(next, row.id, dimension, "correct"), state), { criteria, fetchedAt: "2026-09-08T01:00:00.000Z", sourceStation: { id: "6", name: "สถานี API ทดสอบ" }, rows: qualifiedRows });
const completeReadiness = getCloseReadiness({ ...round, vehicleSearch: fullyReviewed });
assert.equal(completeReadiness.blockers.some((entry) => entry.type.startsWith("vehicle-search")), false, "v2 rounds close after plate and classification meet all criteria");
const incorrectButReviewed = qualifiedRows.reduce((state, row) => ["plate", "classification"].reduce((next, dimension) => updateVehicleSearchDimensionReview(next, row.id, dimension, "correct"), state), { criteria, fetchedAt: "2026-09-08T01:00:00.000Z", sourceStation: { id: "6", name: "สถานี API ทดสอบ" }, rows: qualifiedRows });
const incorrectVehicle = updateVehicleSearchDimensionReview(incorrectButReviewed, "vehicle-event-1", "plate", "incorrect");
const incorrectReadiness = getCloseReadiness({ ...round, vehicleSearch: incorrectVehicle });
assert.equal(incorrectReadiness.blockers.some((entry) => entry.type === "vehicle-search-threshold" && entry.message.includes("ทะเบียน")), true, "incorrect results below 80 percent remain visible as a finding");
assert.equal(incorrectReadiness.canConfirmClose, true, "results below the Vehicle API threshold can be acknowledged at closure");
assert.equal(incorrectReadiness.issues.some((entry) => entry.type === "vehicle-search-issue" && entry.rowId === "vehicle-event-1"), true, "incorrect vehicle review remains in close issues");
const unableVehicle = updateVehicleSearchDimensionReview(incorrectButReviewed, "vehicle-event-1", "classification", "unable-to-verify");
const unableReadiness = getCloseReadiness({ ...round, vehicleSearch: unableVehicle });
assert.equal(unableReadiness.blockers.some((entry) => entry.type === "vehicle-search-review" && entry.reviewKind === "classification"), true, "unable-to-verify remains visible as an incomplete review");
assert.equal(unableReadiness.canConfirmClose, true, "unable-to-verify can be acknowledged at closure");

const bypassedRound = createUiDemoRound();
const bypassedReadiness = {
  ...bypassedRound,
  snapshot: { ...bypassedRound.snapshot, vehicleReviewVersion: null },
  vehicleSearch: reviewedAgain,
  inspectionItems: {
    ...bypassedRound.inspectionItems,
    "5.1.plate-document": {
      ...(bypassedRound.inspectionItems["5.1.plate-document"] || {}),
      status: "not-installed",
      note: "ไม่มีการติดตั้งที่สถานีนี้",
    },
  },
};
assert.equal(getCloseReadiness(bypassedReadiness).blockers.some((entry) => entry.type === "vehicle-search-review"), false, "bypassed plate-document work does not block close");

const noFetchReadiness = getCloseReadiness(round);
assert.equal(noFetchReadiness.blockers.some((entry) => entry.type === "vehicle-search-fetch"), true, "new API-only work remains visible when no result was fetched");
assert.equal(noFetchReadiness.canConfirmClose, true, "a missing Vehicle API fetch can be acknowledged at closure");
const emptySearch = { criteria, fetchedAt: "2026-09-08T01:00:00.000Z", sourceStation: null, rows: [] };
assert.equal(getVehicleReviewState(emptySearch).key, "empty");
assert.equal(getCloseReadiness({ ...round, vehicleSearch: emptySearch }).blockers.some((entry) => entry.type === "vehicle-search-threshold"), true, "an empty API response cannot satisfy the 6-hour or 100-vehicle sample criterion");
const wrongStation = { ...reviewedForNewRound, sourceStation: { id: "99", name: "สถานีอื่น" } };
const wrongStationReadiness = getCloseReadiness({ ...round, vehicleSearch: wrongStation });
assert.equal(wrongStationReadiness.blockers.some((entry) => entry.type === "vehicle-search-station"), true, "station mismatch remains visible as a finding");
assert.equal(wrongStationReadiness.canConfirmClose, true, "a station mismatch can be acknowledged at closure");

const closedRound = { ...roundWithVehicleSearch, status: "closed", closedAt: "2026-09-08T02:00:00.000Z" };
const revision = createRevisionRound(closedRound, { reason: "ทดสอบผลอ่านป้ายทะเบียน" });
assert.deepEqual(revision.vehicleSearch, reviewedForNewRound, "a correction round carries the latest vehicle result set");
assert.equal(JSON.stringify(closedRound.snapshot), snapshotBefore, "creating a correction does not mutate the source Snapshot");

const normalized = normalizeRound(roundWithVehicleSearch, [profile], profile);
assert.deepEqual(normalized.vehicleSearch, reviewedForNewRound);
assert.equal(normalizeVehicleSearchState({ rows: [{ plateNumber: "ABC", reviewStatus: "unexpected", extra: "discard" }] }).rows[0].reviewStatus, "pending");
assert.equal(normalizeVehicleSearchState({ rows: [{ id: "vehicle-458493", plateNumber: "ABC", plateImage: "/api/vehicle/image/crop/old.jpg" }] }, {}, { baseUrl }).rows[0].plateImage, "/api/vehicle/image?baseUrl=http%3A%2F%2Ftest-vehicle-api%3A3005&path=crop%2Fold.jpg", "old rows recover the image endpoint from the stored crop path");
assert.equal(normalizeVehicleSearchState({ rows: [{ id: "vehicle-458494", plateNumber: "ABC", plateImage: `${baseUrl}/api/vehicle/image?path=${encodeURIComponent(imagePath)}` }] }, {}, { baseUrl }).rows[0].plateImage, buildVehicleSearchImageUrl(imagePath, baseUrl), "stored absolute Vehicle API image URLs must be normalized through the same-origin image proxy");
const grouped = getVehicleQueueGroups({ rows: [{ id: "one", plateNumber: "A", vehicleClassId: "2", vehicleClassLabel: "รถ 6 ล้อ", lane: "TH1" }, { id: "two", plateNumber: "B", vehicleClassId: "2", vehicleClassLabel: "รถ 6 ล้อ", lane: "TH1", reviewStatus: "correct" }] });
assert.equal(grouped.length, 1);
assert.deepEqual({ total: grouped[0].total, reviewed: grouped[0].reviewed, correct: grouped[0].correct, pending: grouped[0].pending }, { total: 2, reviewed: 1, correct: 1, pending: 1 });
const groupedByDescription = getVehicleQueueGroups({ rows: [
  { id: "same-class-a", plateNumber: "A", occurredAt: "2026-09-08T08:03:00+07:00", vehicleClassId: "2", vehicleClassLabel: "รถ 6 ล้อ", lane: "TH1" },
  { id: "same-class-b", plateNumber: "B", occurredAt: "2026-09-08T08:04:00+07:00", vehicleClassId: "2", vehicleClassLabel: "รถ 10 ล้อ", lane: "TH1" },
  { id: "same-description-other-lane", plateNumber: "C", occurredAt: "2026-09-08T08:05:00+07:00", vehicleClassId: "2", vehicleClassLabel: "รถ 6 ล้อ", lane: "TH2" },
  { id: "same-description-same-lane", plateNumber: "D", occurredAt: "2026-09-08T08:06:00+07:00", vehicleClassId: "2", vehicleClassLabel: "รถ 6 ล้อ", lane: "TH1" },
] });
assert.equal(getVehicleReviewGroupKey(groupedByDescription.find((group) => group.key === "2::รถ 6 ล้อ::TH1").rows[0]), "2::รถ 6 ล้อ::TH1", "group identity includes VehicleClassID, BosureDescription and Lane");
assert.equal(groupedByDescription.length, 3, "different class descriptions or lanes stay in separate review groups");
assert.deepEqual(getVehicleReviewRows({ rows: [
  { id: "late", occurredAt: "2026-09-08T08:02:00+07:00", reviewStatus: "pending" },
  { id: "early", occurredAt: "2026-09-08T08:01:00+07:00", reviewStatus: "correct" },
  { id: "missing-time", occurredAt: null, reviewStatus: "pending" },
] }).map((row) => row.id), ["early", "late", "missing-time"], "review navigation follows API event time and keeps untimed rows last");
assert.equal(getVehicleReviewNavigation({ rows: [{ id: "early", occurredAt: "2026-09-08T08:01:00+07:00" }, { id: "late", occurredAt: "2026-09-08T08:02:00+07:00" }] }, { rowId: "early", direction: "next" })?.id, "late");
assert.equal(getVehicleReviewNavigation({ rows: [{ id: "early", occurredAt: "2026-09-08T08:01:00+07:00" }, { id: "late", occurredAt: "2026-09-08T08:02:00+07:00" }] }, { rowId: "late", direction: "previous" })?.id, "early");
assert.equal(getNextPendingVehicleId({ rows: [{ id: "done", occurredAt: "2026-09-08T08:01:00+07:00", reviewStatus: "correct" }, { id: "pending", occurredAt: "2026-09-08T08:02:00+07:00", reviewStatus: "pending" }] }, { rowId: "done", context: "plate" }), "pending");
assert.equal(isVehicleSearchItem({ id: "5.1.plate-document::asset::db-01" }), true, "asset-mapped plate document ids keep the feature identity");
assert.equal(isVehicleSearchItem({ id: "5.1.vehicle-document", label: "เอกสารผลการจำแนกประเภทรถ" }), false, "vehicle classification is not plate search");

console.log(JSON.stringify({
  rows: rows.length,
  reviewed: getVehicleSearchSummary(reviewedAgain).reviewed,
  accuracy: getVehicleSearchSummary(reviewedAgain).accuracy,
  closeBlocker: readiness.blockers.find((entry) => entry.type === "vehicle-search-review")?.message,
}));
