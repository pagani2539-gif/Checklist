import assert from "node:assert/strict";
import { archiveVehicleEvidence, getVehicleEvidenceArchiveForRow, vehicleEvidenceRowKey, vehicleEvidenceTasksForReport, vehicleEvidenceTasksForRound } from "../src/domain/vehicle-evidence-images.js";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV9sAAAAASUVORK5CYII=", "base64");
const plateRow = {
  id: "car-1", systemKey: "imps", vehicleReviewContext: "plate", vehicleReviewScope: "day",
  plateImage: "https://fixture/plate.jpg", lprImage: "https://fixture/lpr.jpg", overviewImage: "https://fixture/overview.jpg",
};
const classificationRow = {
  ...plateRow, vehicleReviewContext: "classification",
  plateImage: "https://fixture/classification-plate.jpg",
  lprImage: "https://fixture/classification-lpr.jpg",
  overviewImage: "https://fixture/classification-overview.jpg",
};
const excludedPlateRow = {
  ...plateRow, id: "excluded-car", plateImage: "https://fixture/excluded-plate.jpg",
  lprImage: "https://fixture/excluded-lpr.jpg", sampleEligibility: { status: "excluded", reasonCode: "no-image" },
};
const unselectedPlateRow = {
  ...plateRow, id: "unselected-car", plateImage: "https://fixture/unselected-plate.jpg",
  lprImage: "https://fixture/unselected-lpr.jpg", sampleEligibility: { status: "eligible" },
};
const round = {
  id: "round-context-storage", stationId: "fixture", vehicleEvidenceArchive: {},
  vehicleSearch: { systems: { imps: {
    plate: { scopes: { day: { rows: [plateRow], sourceRows: [plateRow, excludedPlateRow, unselectedPlateRow] } } },
    classification: { scopes: { day: { rows: [classificationRow] } } },
  } } },
};

const allTasks = vehicleEvidenceTasksForRound(round);
const savedPlateTasks = allTasks.filter(({ row, field }) => row.vehicleReviewContext === "plate"
  && row.id === "car-1" && ["plateImage", "lprImage"].includes(field));
assert.equal(savedPlateTasks.length, 2);

const reportTasks = vehicleEvidenceTasksForReport(round);
assert.deepEqual(reportTasks.map(({ row, field }) => `${row.id}:${field}`).sort(), [
  "car-1:lprImage", "car-1:plateImage", "car-1:overviewImage",
  "excluded-car:lprImage", "excluded-car:plateImage",
].sort(), "close-round archival must include report rows and excluded appendix evidence only");
const archivedPlate = { id: "car-1", systemKey: "imps", vehicleReviewContext: "plate", vehicleReviewScope: "day", plateImage: plateRow.plateImage };
assert.equal(getVehicleEvidenceArchiveForRow({
  [vehicleEvidenceRowKey(archivedPlate)]: { plateImage: { id: "saved-plate", sourceUrl: plateRow.plateImage } },
}, archivedPlate).plateImage.id, "saved-plate", "context-keyed archive entries must remain visible to report rows");
assert.equal(getVehicleEvidenceArchiveForRow({
  [vehicleEvidenceRowKey(archivedPlate)]: { plateImage: { id: "saved-plate", sourceUrl: plateRow.plateImage } },
}, { id: archivedPlate.id, plateImage: plateRow.plateImage }).plateImage.id, "saved-plate",
"flattened report Snapshot rows must resolve a contextual archive by matching the original image URL");

const fetched = [];
const saved = [];
globalThis.fetch = async src => {
  fetched.push(String(src));
  return new Response(png, { headers: { "content-type": "image/png" } });
};
await archiveVehicleEvidence(round, {
  tasks: savedPlateTasks,
  save: async (id, file, options) => saved.push({ id, name: file.name, options }),
  createId: kind => `${kind}-${saved.length + 1}`,
});

assert.deepEqual(fetched.sort(), [plateRow.plateImage, plateRow.lprImage].sort(),
  "saving a plate decision must archive only that row's plate and LPR images");
assert.equal(saved.length, 2, "classification and unrelated images must not be uploaded");
assert.ok(saved.every(entry => entry.options.roundId === round.id && entry.options.stationId === round.stationId));
console.log("PASS: Vehicle evidence uploads are limited to the saved review context");
