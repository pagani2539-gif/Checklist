import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const outputRoot = resolve(process.argv[2] || "release/public");
const assetsRoot = join(outputRoot, "assets");
const html = readFileSync(join(outputRoot, "index.html"), "utf8");
const appEntry = html.match(/src=["']\.\/assets\/(index-[^"']+\.js)["']/)?.[1];
assert.ok(appEntry, `No application entry bundle found in ${assetsRoot}`);

const entry = readFileSync(join(assetsRoot, appEntry), "utf8");
const dependencyMapStart = entry.indexOf("m.f=[");
assert.notEqual(dependencyMapStart, -1, "Application entry must include Vite's lazy-route dependency map");
const dependencyArrayStart = entry.indexOf("[", dependencyMapStart);
const dependencyArrayEnd = entry.indexOf("]", dependencyArrayStart);
const dependencyFiles = JSON.parse(entry.slice(dependencyArrayStart, dependencyArrayEnd + 1));

const vehicleRouteStart = entry.indexOf("vehicleApi:()=>");
assert.notEqual(vehicleRouteStart, -1, "Application entry must register the Vehicle API route");
const vehicleRouteEnd = entry.indexOf("}", vehicleRouteStart);
const vehicleRoute = entry.slice(vehicleRouteStart, vehicleRouteEnd);
const routeDependencies = vehicleRoute.match(/__vite__mapDeps\(\[([\d,]+)\]\)/)?.[1]
  .split(",").map(Number);
assert.ok(routeDependencies, "Vehicle API route must declare its lazy-load dependencies");

const routeFiles = routeDependencies.map((index) => dependencyFiles[index]);
const masterSelectModule = routeFiles.find((name) => /^\.\/MasterSelect-.*\.js$/.test(name));
const masterSelectStyles = routeFiles.find((name) => /^\.\/MasterSelect-.*\.css$/.test(name));
const vehicleRuntime = routeFiles.find((name) => /^\.\/vehicle-api\.runtime-.*\.js$/.test(name));
assert.ok(masterSelectModule, "Vehicle API route must load the shared MasterSelect component");
assert.ok(masterSelectStyles, "Vehicle API route must preload MasterSelect styles with the component");
assert.ok(vehicleRuntime, "Vehicle API route must load its runtime module");

const css = readFileSync(join(assetsRoot, masterSelectStyles.slice(2)), "utf8");
assert.ok(/\.master-select-menu\s*\{[^}]*position\s*:\s*absolute[^}]*max-height\s*:\s*300px[^}]*overflow\s*:\s*auto/i.test(css),
  "MasterSelect stylesheet must position searchable dropdowns over content and constrain their height");
assert.ok(/\.master-select-option\s*\{[^}]*width\s*:\s*100%[^}]*display\s*:\s*flex/i.test(css),
  "MasterSelect stylesheet must render dropdown choices as a vertical list");

const runtime = readFileSync(join(assetsRoot, vehicleRuntime.slice(2)), "utf8");
assert.ok(runtime.includes(masterSelectModule),
  "Vehicle API runtime must load the shared MasterSelect component");

console.log("PASS Vehicle API route loads the searchable dropdown component with its bounded menu styles.");
