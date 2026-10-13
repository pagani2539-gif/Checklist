import assert from "node:assert/strict";
import fs from "node:fs";
import { parse } from "@babel/parser";
import * as traverseModule from "@babel/traverse";
import { readAppSource, readSharedSource } from "./source-bundle.mjs";

const appSource = readAppSource();
const appModuleSource = fs.readFileSync(new URL("../src/app/App.jsx", import.meta.url), "utf8");
const vehicleRuntimeSource = fs.readFileSync(new URL("../src/app/page-runtimes/vehicle-api.js", import.meta.url), "utf8");
const moduleSource = readSharedSource("vehicle-review/ReviewPanels.jsx");

const traverse = traverseModule.default.default || traverseModule.default;
const moduleAst = parse(moduleSource, { sourceType: "module", plugins: ["jsx"] });
const unresolvedReferences = new Set();
traverse(moduleAst, {
  ReferencedIdentifier(path) {
    if (!path.scope.hasBinding(path.node.name)) unresolvedReferences.add(path.node.name);
  },
});
assert.deepEqual([...unresolvedReferences].sort(), ["AbortController", "Image", "ResizeObserver", "document", "requestAnimationFrame", "window"]);

assert.match(moduleSource, /export function createVehicleReviewComponents\(\{ AttachmentField, EvidenceField, StatusBadge, ThaiDateTimePicker \}\)/);
assert.match(moduleSource, /return \{ VehicleFocusReviewPanel, VehicleSearchReviewPanelLegacy \};/);
assert.match(appModuleSource, /import\("\.\/page-runtimes\/vehicle-api\.runtime\.js"\)/, "vehicle review modules should load on Vehicle API routes");
assert.match(vehicleRuntimeSource, /createVehicleReviewComponents\(/);
assert.doesNotMatch(appModuleSource, /from ["']\.\/vehicle-review\/ReviewPanels\.jsx["']/);
assert.match(moduleSource, /transport: vehicleSearchConfig\.apiProfile === "imps-v2" \? "proxy" : "direct-first"/);
assert.match(moduleSource, /onEvidenceAttachmentChange/);
assert.match(moduleSource, /onEvidenceAttachmentRemove/);
assert.doesNotMatch(appModuleSource, /function VehicleSearchPanel\(/);
assert.doesNotMatch(appModuleSource, /function VehicleFocusReviewPanel\(/);
assert.doesNotMatch(appModuleSource, /function VehicleSearchReviewPanelLegacy\(/);

console.log("test_vehicle_review_module: pass");
