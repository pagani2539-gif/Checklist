import assert from "node:assert/strict";
import fs from "node:fs";
import { parse } from "@babel/parser";
import * as traverseModule from "@babel/traverse";
import { readAppSource, readSharedSource } from "./source-bundle.mjs";

const appSource = readAppSource();
const appModuleSource = fs.readFileSync(new URL("../src/app/App.jsx", import.meta.url), "utf8");
const checklistRuntimeSource = fs.readFileSync(new URL("../src/app/page-runtimes/checklist.js", import.meta.url), "utf8");
const checklistPageSource = fs.readFileSync(new URL("../src/app/pages/ChecklistPage.jsx", import.meta.url), "utf8");
const moduleSource = readSharedSource("reports/PrintableReport.jsx");
const storageSource = fs.readFileSync(new URL("../src/domain/server-storage.js", import.meta.url), "utf8");
const redesignedStyles = fs.readFileSync(new URL("../src/styles/redesign.css", import.meta.url), "utf8");
const pageRulesStyles = fs.readFileSync(new URL("../src/styles/report-page-rules.css", import.meta.url), "utf8");
const printableRouteStyles = fs.readFileSync(new URL("../src/styles/printable-report-route.css", import.meta.url), "utf8");
const mainSource = fs.readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");

const traverse = traverseModule.default.default || traverseModule.default;
const moduleAst = parse(moduleSource, { sourceType: "module", plugins: ["jsx"] });
const unresolvedReferences = new Set();
traverse(moduleAst, {
  ReferencedIdentifier(path) {
    if (!path.scope.hasBinding(path.node.name)) unresolvedReferences.add(path.node.name);
  },
});
assert.deepEqual([...unresolvedReferences].sort(), ["URL", "window"]);

assert.match(moduleSource, /export function createPrintableReportComponent\(runtime\)/);
assert.match(moduleSource, /return (?:memo\()?PrintableReport\)?;/);
assert.match(appModuleSource, /import\("\.\/page-runtimes\/checklist\.runtime\.js"\)/, "report modules should load with the Checklist page runtime");
assert.match(checklistRuntimeSource, /createPrintableReportComponent\(/);
assert.match(checklistRuntimeSource, /REPORT_TEXT: REPORT_COPY\.report/);
assert.match(checklistRuntimeSource, /buildReportTemplateModel/);
assert.doesNotMatch(appModuleSource, /from ["']\.\/reports\/PrintableReport\.jsx["']/);
assert.match(moduleSource, /function PrintableCleaningChecklistItem\(/);
assert.match(moduleSource, /data-print-cleaning-item-id=\{item\.id\}/);
assert.match(moduleSource, /const categoryCode = item\.sectionCode \|\| section\.code/);
assert.match(moduleSource, /const categoryTitle = item\.sourceSectionTitle \|\| item\.sectionTitle \|\| section\.title/);
assert.match(moduleSource, /data-print-cleaning-section=\{categoryCode\}/);
assert.match(moduleSource, /usesCleaningPages = !isPresentation && round\?\.snapshot\?\.checklistPolicyVersion === "station-item-controls-v9"/);
assert.match(moduleSource, /omitCleaning=\{usesCleaningPages\}/, "v9 cleaning photos are not duplicated in the report gallery");
assert.match(moduleSource, /function getVehiclePresentationSlides\(vehicleReport\)/);
assert.match(moduleSource, /presentationExamples\?\.\[dimension\]/);
assert.match(moduleSource, /<VehicleSnapshotEvidencePage/);
assert.match(moduleSource, /src=\{row\.lprImage\} label="ภาพจากกล้อง LPR"/);
assert.match(moduleSource, /data-presentation-vehicle-slide-count=\{vehicleSlides\.length\}/);
assert.match(moduleSource, /hasPresentationSlides = model\.orderedItems\.length/);
assert.match(moduleSource, /const slideItems = model\.orderedItems\.flatMap/);
assert.equal((moduleSource.match(/model\.orderedItems\.forEach/g) || []).length, 2, "table runs and the evidence gallery should both read orderedItems");
assert.match(pageRulesStyles, /@page presentation16x9\s*\{\s*size:\s*16in 9in;\s*margin:\s*0;/);
assert.match(printableRouteStyles, /\.ops-print-report\[data-report-mode="presentation"\]\s*\{\s*page:\s*presentation16x9;/);
assert.doesNotMatch(mainSource, /report-page-rules\.css/);
assert.match(moduleSource, /import ["']\.\.\/\.\.\/styles\/report-page-rules\.css["']/);
assert.doesNotMatch(checklistPageSource, /printLayoutStyle/);
assert.doesNotMatch(moduleSource, /data-report-print-layout="presentation"/);
assert.match(checklistPageSource, /const attachmentDeadline = Date\.now\(\) \+ 180_000/);
assert.match(checklistPageSource, /checklist:retry-report-attachments/);
assert.match(checklistPageSource, /hasLoadingAttachments\(\) \|\| missingAttachments\(\)\.length/);
assert.ok(checklistPageSource.indexOf("hasLoadingAttachments() || missingAttachments().length") < checklistPageSource.indexOf("window.print()"), "printing must stop while required evidence is missing");
assert.match(moduleSource, /retryAfterMsRef/);
assert.match(moduleSource, /retryableRef\.current = error\?\.status === 429 \|\| error\?\.status >= 500 \|\| error\?\.status == null/);
assert.match(storageSource, /ATTACHMENT_MAX_CONCURRENT_READS = 8/);
assert.match(storageSource, /Retry-After/);
const reportStyles = fs.readFileSync(new URL("../src/styles/foundation.css", import.meta.url), "utf8");
assert.match(reportStyles, /\.ops-print-cleaning-stage-grid \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
assert.match(reportStyles, /\.ops-print-cleaning-page \{[^}]*break-before: page/);
const vehicleReportStyles = fs.readFileSync(new URL("../src/styles/vehicle-report.css", import.meta.url), "utf8");
assert.match(vehicleReportStyles, /\.ops-presentation-vehicle-slide/);
assert.match(vehicleReportStyles, /\.ops-presentation-vehicle-table/);
assert.doesNotMatch(appModuleSource, /function PrintableAttachment\(/);
assert.doesNotMatch(appModuleSource, /function PrintableReport\(/);

console.log("test_printable_report_module: pass");
