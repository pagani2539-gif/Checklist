import assert from "node:assert/strict";
import { buildVehicleApiReportModel } from "../src/domain/vehicle-report.js";
import { VEHICLE_API_REVIEW_LEGACY_VERSION, VEHICLE_API_REVIEW_VERSION } from "../src/domain/vehicle-search.js";
import { createUiVehicleDemoRound } from "../src/domain/demo-fixture.js";

function makeRound(rows, overrides = {}) {
  return {
    id: "report-round-1",
    status: "draft",
    meta: { inspectionDate: "2026-09-08" },
    snapshot: {
      vehicleReviewVersion: VEHICLE_API_REVIEW_VERSION,
      stationCode: "ST-01",
      stationName: "สถานีทดสอบ",
      vehicleSearchConfig: {},
    },
    vehicleSearch: {
      criteria: { startAt: "2026-09-08T00:00:00+07:00", endAt: "2026-09-08T06:00:00+07:00" },
      fetchedAt: "2026-09-08T06:01:00+07:00",
      sourceStation: { id: "ST-01", name: "สถานีทดสอบ" },
      rows,
    },
    ...overrides,
  };
}

function makeRow(index, { plateStatus = "pending", classificationStatus = "pending", reasonCode = null, correctedValue = null } = {}) {
  return {
    id: `vehicle-${index}`,
    occurredAt: `2026-09-08T01:${String(index % 60).padStart(2, "0")}:00+07:00`,
    lane: "Lane 1",
    plateNumber: `กข ${String(index).padStart(4, "0")}`,
    vehicleClassLabel: "รถบรรทุก 10 ล้อ",
    reviewStatus: plateStatus,
    classificationReviewStatus: classificationStatus,
    reviewDetails: {
      plate: { reasonCode, correctedValue, reviewedAt: "2026-09-08T06:10:00+07:00" },
      classification: { reasonCode, correctedValue, reviewedAt: "2026-09-08T06:10:00+07:00" },
    },
  };
}

const zeroData = buildVehicleApiReportModel(makeRound([]));
assert.equal(zeroData.summary.total, 0);
assert.equal(zeroData.summary.accuracy, null);
assert.equal(zeroData.outcome.status, "incomplete");
assert.equal(zeroData.examples.every((example) => example.row === null), true);
assert.equal(buildVehicleApiReportModel(makeRound([makeRow(0, { plateStatus: "unable-to-verify", reasonCode: "blurred-image" })])).summary.accuracy, null, "unable-to-verify alone does not produce a 0% accuracy score");

const sample666Rows = Array.from({ length: 666 }, (_, index) => makeRow(index, {
  plateStatus: index === 0 ? "correct" : "pending",
}));
const sample666 = makeRound(sample666Rows);
const snapshotBefore = JSON.stringify(sample666.snapshot);
const partial = buildVehicleApiReportModel(sample666, { context: "plate" });
assert.deepEqual({
  total: partial.summary.total,
  correct: partial.summary.correct,
  incorrect: partial.summary.incorrect,
  unableToVerify: partial.summary.unableToVerify,
  reviewed: partial.summary.reviewed,
  recorded: partial.summary.recorded,
  pending: partial.summary.pending,
  accuracy: partial.summary.accuracy,
}, { total: 666, correct: 1, incorrect: 0, unableToVerify: 0, reviewed: 1, recorded: 1, pending: 665, accuracy: 100 });
assert.equal(partial.outcome.status, "incomplete");
assert.equal(partial.outcome.label, "ยังสรุปผลรอบไม่ได้");
assert.equal(partial.examples.find((example) => example.status === "correct")?.row.id, "vehicle-0");
assert.equal(JSON.stringify(sample666.snapshot), snapshotBefore, "report calculation leaves the saved Snapshot unchanged");

const reasonRows = [
  makeRow(0, { plateStatus: "correct" }),
  makeRow(1, { plateStatus: "incorrect", reasonCode: "ocr-error", correctedValue: "กข 9999" }),
  makeRow(2, { plateStatus: "unable-to-verify", reasonCode: "blurred-image" }),
  makeRow(3, { plateStatus: "unable-to-verify", reasonCode: "dark-or-glare" }),
];
const reasonReport = buildVehicleApiReportModel(makeRound(reasonRows));
assert.equal(reasonReport.summary.correct, 1);
assert.equal(reasonReport.summary.incorrect, 1);
assert.equal(reasonReport.summary.unableToVerify, 2);
assert.equal(reasonReport.summary.recorded, 4);
assert.equal(reasonReport.summary.reviewed, 2);
assert.equal(reasonReport.summary.accuracy, 50, "unable-to-verify results are excluded from the accuracy denominator");
assert.deepEqual(reasonReport.reasons.map((reason) => [reason.status, reason.reasonCode, reason.count]).sort(), [
  ["incorrect", "ocr-error", 1],
  ["unable-to-verify", "blurred-image", 1],
  ["unable-to-verify", "dark-or-glare", 1],
].sort());
assert.equal(reasonReport.examples.find((example) => example.status === "incorrect")?.detail.correctedValue, "กข 9999");
assert.equal(reasonReport.exampleOptions["unable-to-verify"].length, 2, "each recorded unable result can be selected as an example");

const completeRows = Array.from({ length: 100 }, (_, index) => makeRow(index, {
  plateStatus: index < 95 ? "correct" : "incorrect",
  reasonCode: index < 95 ? null : "ocr-error",
  correctedValue: index < 95 ? null : `กข ${String(index).padStart(4, "0")}`,
}));
const complete = buildVehicleApiReportModel(makeRound(completeRows));
assert.equal(complete.summary.accuracy, 95);
assert.equal(complete.summary.recorded, 100);
assert.equal(complete.summary.pending, 0);
assert.equal(complete.outcome.status, "passed", "complete sample meeting the existing threshold passes");

const classification = buildVehicleApiReportModel(makeRound([
  makeRow(0, { classificationStatus: "correct" }),
  makeRow(1, { classificationStatus: "incorrect", reasonCode: "class-mismatch", correctedValue: "รถ 6 ล้อ" }),
]), { context: "classification" });
assert.equal(classification.context.key, "classification");
assert.equal(classification.summary.accuracy, 50);
assert.equal(classification.examples.find((example) => example.status === "incorrect")?.detail.correctedValue, "รถ 6 ล้อ");

const scopedReport = buildVehicleApiReportModel(createUiVehicleDemoRound(), { context: "plate" });
assert.equal(scopedReport.scope.key, "all");
assert.equal(scopedReport.summary.total, 10);
assert.equal(scopedReport.outcome.sampleQualified, true, "combined day/night report shows the existing qualifying period accurately");

const oldRound = makeRound([makeRow(0), makeRow(1)], { snapshot: { vehicleReviewVersion: VEHICLE_API_REVIEW_LEGACY_VERSION, stationCode: "ST-01", stationName: "สถานีทดสอบ" } });
const unsupportedClassification = buildVehicleApiReportModel(oldRound, { context: "classification" });
assert.equal(unsupportedClassification.contextSupported, false);
assert.equal(unsupportedClassification.summary.total, 2);
assert.equal(unsupportedClassification.summary.pending, 2);
assert.equal(unsupportedClassification.summary.threshold, null);
assert.equal(unsupportedClassification.outcome.status, "incomplete");
assert.equal(unsupportedClassification.outcome.label, "Snapshot นี้ไม่มีผลตรวจคัดประเภทรถ");
const unversionedRound = makeRound([makeRow(0)], { snapshot: { stationCode: "ST-01", stationName: "สถานีทดสอบ" } });
assert.equal(buildVehicleApiReportModel(unversionedRound, { context: "classification" }).contextSupported, false, "unversioned historical Snapshots do not claim a new review dimension");

console.log("vehicle report model checks passed (empty, 666 partial, reasons, complete, scopes, classification, legacy Snapshot)");
