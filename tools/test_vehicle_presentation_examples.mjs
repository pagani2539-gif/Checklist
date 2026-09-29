import assert from "node:assert/strict";
import { buildReportTemplateModel } from "../src/domain/report-template.js";
import { createUiVehicleDemoRound } from "../src/domain/demo-fixture.js";
import { VEHICLE_API_REVIEW_LEGACY_VERSION, VEHICLE_API_REVIEW_VERSION } from "../src/domain/vehicle-search.js";

const scopedRound = createUiVehicleDemoRound();
const sourceRows = scopedRound.vehicleSearch.scopes.day.rows;
const baseRow = sourceRows[0];
const makeRow = (id, plateStatus, classificationStatus, index) => ({
  ...baseRow,
  id,
  vehicleId: id,
  plateNumber: `กข ${String(1000 + index)}`,
  vehicleClassLabel: `รถตัวอย่าง ${index}`,
  plateImage: `https://demo.vehicle-api.local/api/images/plate-${id}.jpg`,
  lprImage: `https://demo.vehicle-api.local/api/images/lpr-${id}.jpg`,
  overviewImage: `https://demo.vehicle-api.local/api/images/overview-${id}.jpg`,
  reviewStatus: plateStatus,
  classificationReviewStatus: classificationStatus,
  reviewDetails: {
    plate: {
      status: plateStatus,
      correctedValue: plateStatus === "incorrect" ? "กข 9999" : null,
      evidenceAttachment: plateStatus === "incorrect" ? { id: `plate-evidence-${id}`, name: "plate.jpg", type: "image/jpeg" } : null,
    },
    classification: {
      status: classificationStatus,
      correctedValue: classificationStatus === "incorrect" ? "รถ 6 ล้อ" : null,
      evidenceAttachment: classificationStatus === "incorrect" ? { id: `class-evidence-${id}`, name: "class.jpg", type: "image/jpeg" } : null,
    },
  },
});

const sampleRows = [
  makeRow("first-correct", "correct", "incorrect", 1),
  makeRow("later-correct", "correct", "correct", 2),
  makeRow("first-incorrect", "incorrect", "unable-to-verify", 3),
  makeRow("first-unable", "unable-to-verify", "correct", 4),
  makeRow("pending", "pending", "pending", 5),
];
const flatRound = {
  ...scopedRound,
  vehicleSearch: {
    ...scopedRound.vehicleSearch.scopes.day,
    rows: sampleRows,
    pagination: { page: 1, pageSize: 200, totalItems: sampleRows.length, totalPages: 1 },
  },
};

const model = buildReportTemplateModel(flatRound);
for (const [dimension, statusKey] of [["plate", "reviewStatus"], ["classification", "classificationReviewStatus"]]) {
  const expectedIds = ["correct", "incorrect", "unable-to-verify"]
    .map((status) => model.vehicleSearch.rows.find((row) => row[statusKey] === status)?.id)
    .filter(Boolean);
  assert.deepEqual(model.vehicleSearch.presentationExamples[dimension], expectedIds, `${dimension} samples use the first matching row in report order`);
  assert.equal(model.vehicleSearch.presentationExamples[dimension].some((rowId) => model.vehicleSearch.rows.find((row) => row.id === rowId)?.[statusKey] === "pending"), false, `${dimension} samples skip pending results`);
}
assert.equal(model.vehicleSearch.presentationExamples.plate.length, 3);
assert.equal(model.vehicleSearch.presentationExamples.classification.length, 3);
assert.equal(model.vehicleSearch.supportsClassification, true);
assert.equal(model.vehicleSearch.rows.find((row) => row.id === "first-incorrect").reviewDetails.plate.correctedValue, "กข 9999");
assert.equal(model.vehicleSearch.rows.find((row) => row.id === "first-incorrect").reviewDetails.plate.evidenceAttachment.id, "plate-evidence-first-incorrect");
assert.match(model.vehicleSearch.rows.find((row) => row.id === "first-incorrect").plateImage, /plate-first-incorrect\.jpg/);
assert.match(model.vehicleSearch.rows.find((row) => row.id === "first-incorrect").lprImage, /lpr-first-incorrect\.jpg/);
assert.match(model.vehicleSearch.rows.find((row) => row.id === "first-incorrect").overviewImage, /overview-first-incorrect\.jpg/);

const partialModel = buildReportTemplateModel({
  ...flatRound,
  vehicleSearch: {
    ...flatRound.vehicleSearch,
    rows: [
      makeRow("only-plate-result", "correct", "pending", 6),
      makeRow("only-pending", "pending", "pending", 7),
    ],
    pagination: { page: 1, pageSize: 200, totalItems: 2, totalPages: 1 },
  },
});
assert.deepEqual(partialModel.vehicleSearch.presentationExamples.plate, ["only-plate-result"], "partial results include only the available reviewed category");
assert.deepEqual(partialModel.vehicleSearch.presentationExamples.classification, [], "a dimension with only pending results has no sample rows");
assert.equal(partialModel.vehicleSearch.summary.dimensions.plate.pending, 1, "pending plate reviews remain in the summary");
assert.equal(partialModel.vehicleSearch.summary.dimensions.classification.pending, 2, "pending classification reviews remain in the summary");

const legacyModel = buildReportTemplateModel({
  ...flatRound,
  snapshot: { ...flatRound.snapshot, vehicleReviewVersion: VEHICLE_API_REVIEW_LEGACY_VERSION },
});
assert.equal(legacyModel.vehicleSearch.supportsClassification, false);
assert.deepEqual(legacyModel.vehicleSearch.presentationExamples.classification, []);

const scopedModel = buildReportTemplateModel(scopedRound);
assert.equal(scopedModel.vehicleSearch.scoped, true);
assert.deepEqual(scopedModel.vehicleSearch.scopes.map((scope) => scope.scope), ["day", "night"]);
const dayRowIds = scopedModel.vehicleSearch.scopes.find((scope) => scope.scope === "day").rows.map((row) => row.id);
const nightScope = scopedModel.vehicleSearch.scopes.find((scope) => scope.scope === "night");
for (const dimension of ["plate", "classification"]) {
  for (const rowId of nightScope.presentationExamples[dimension]) {
    assert.equal(nightScope.rows.some((row) => row.id === rowId), true, `night ${dimension} example is from the night scope`);
    assert.equal(dayRowIds.includes(rowId), false, `night ${dimension} example is not drawn from the day scope`);
  }
}

console.log("vehicle presentation examples: pass (status sampling, confirmed values, evidence, legacy, day/night scope)");
