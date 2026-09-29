import assert from "node:assert/strict";
import fs from "node:fs";
import { parse } from "@babel/parser";
import * as traverseModule from "@babel/traverse";
import { readAppSource, readSharedSource } from "./source-bundle.mjs";

const appSource = readAppSource();
const appModuleSource = fs.readFileSync(new URL("../src/app/App.jsx", import.meta.url), "utf8");
const moduleSource = readSharedSource("reports/PrintableReport.jsx");

const traverse = traverseModule.default.default || traverseModule.default;
const moduleAst = parse(moduleSource, { sourceType: "module", plugins: ["jsx"] });
const unresolvedReferences = new Set();
traverse(moduleAst, {
  ReferencedIdentifier(path) {
    if (!path.scope.hasBinding(path.node.name)) unresolvedReferences.add(path.node.name);
  },
});
assert.deepEqual([...unresolvedReferences].sort(), ["URL"]);

assert.match(moduleSource, /export function createPrintableReportComponent\(runtime\)/);
assert.match(moduleSource, /return PrintableReport;/);
assert.match(appSource, /PAGE_RUNTIME\.PrintableReport = createPrintableReportComponent\(/);
assert.match(appSource, /getStoredAttachment, statusClass, REPORT_COPY, getPresentationEvidenceCaption, STATUS_META, getReportCompany, VEHICLE_REVIEW_CORRECTION_TARGET_OPTIONS, VEHICLE_REVIEW_REASON_OPTIONS, buildReportTemplateModel, CompanyReportCover/);
assert.match(moduleSource, /function PrintableCleaningChecklistItem\(/);
assert.match(moduleSource, /data-print-cleaning-item-id=\{item\.id\}/);
assert.match(moduleSource, /const categoryCode = item\.sectionCode \|\| section\.code/);
assert.match(moduleSource, /const categoryTitle = item\.sourceSectionTitle \|\| item\.sectionTitle \|\| section\.title/);
assert.match(moduleSource, /data-print-cleaning-section=\{categoryCode\}/);
assert.match(moduleSource, /usesCleaningPages = !isPresentation && round\?\.snapshot\?\.checklistPolicyVersion === "station-item-controls-v9"/);
assert.match(moduleSource, /omitCleaning=\{usesCleaningPages\}/, "v9 cleaning photos are not duplicated in the report gallery");
assert.match(moduleSource, /function getVehiclePresentationSlides\(vehicleReport\)/);
assert.match(moduleSource, /presentationExamples\?\.\[dimension\]/);
assert.match(moduleSource, /<PrintableVehiclePresentationSlide/);
assert.match(moduleSource, /src=\{row\.lprImage\} label="ภาพจากกล้อง LPR"/);
assert.match(moduleSource, /data-presentation-vehicle-slide-count=\{vehicleSlides\.length\}/);
assert.match(moduleSource, /hasPresentationSlides = model\.sections\.some/);
const reportStyles = fs.readFileSync(new URL("../src/styles/foundation.css", import.meta.url), "utf8");
assert.match(reportStyles, /\.ops-print-cleaning-stage-grid \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
assert.match(reportStyles, /\.ops-print-cleaning-page \{[^}]*break-before: page/);
const vehicleReportStyles = fs.readFileSync(new URL("../src/styles/vehicle-report.css", import.meta.url), "utf8");
assert.match(vehicleReportStyles, /\.ops-presentation-vehicle-slide/);
assert.match(vehicleReportStyles, /\.ops-presentation-vehicle-table/);
assert.doesNotMatch(appModuleSource, /function PrintableAttachment\(/);
assert.doesNotMatch(appModuleSource, /function PrintableReport\(/);

console.log("test_printable_report_module: pass");
