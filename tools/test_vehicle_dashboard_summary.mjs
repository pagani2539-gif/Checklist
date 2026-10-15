import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { build } from "esbuild";
import { getVehicleDashboardSummary } from "../src/domain/vehicle-dashboard-summary.js";
import { createVehicleReviewState, updateVehicleSearchScope, VEHICLE_API_REVIEW_VERSION } from "../src/domain/vehicle-search.js";

function dataset(context, statuses) {
  let value = { ...createVehicleReviewState(), independentContext: context };
  return updateVehicleSearchScope(value, "day", {
    fetchedAt: "2026-10-15T03:00:00.000Z",
    rows: statuses.map((status, index) => ({ id: `${context}-${index}`, reviewStatus: status, classificationReviewStatus: status })),
  });
}
const round = {
  snapshot: { vehicleReviewVersion: VEHICLE_API_REVIEW_VERSION, vehicleReviewSystems: [{ key: "sc-hs" }, { key: "sc-ls" }, { key: "imps" }] },
  vehicleSearch: { systems: {
    "sc-hs": { plate: dataset("plate", ["correct", "unable-to-verify", "pending"]), classification: dataset("classification", ["incorrect"]) },
    "sc-ls": { plate: dataset("plate", ["correct"]) },
    imps: { plate: dataset("plate", ["unable-to-verify"]) },
  } },
};
const before = JSON.stringify(round);
const entries = getVehicleDashboardSummary(round);
const hs = entries.find(entry => entry.key === "sc-hs:plate:day");
assert.deepEqual([hs.total, hs.recorded, hs.pending, hs.unableToVerify], [3, 2, 1, 1]);
assert.match(hs.label, /HS · ตรวจป้ายทะเบียน · กลางวัน/);
assert.equal(entries.find(entry => entry.key === "sc-hs:plate:night").state, "not-fetched");
assert.equal(entries.find(entry => entry.key === "sc-ls:plate:day").total, 1);
assert.equal(entries.find(entry => entry.key === "imps:plate:day").recorded, 1);
assert.equal(entries.find(entry => entry.key === "imps:plate:day").pending, 0);
assert.ok(!entries.some(entry => entry.key.includes("classification:night")), "classification uses daytime only");
assert.equal(entries.find(entry => entry.key === "sc-ls:classification:day").state, "not-fetched");
assert.equal(JSON.stringify(round), before, "reading the dashboard never changes stored data");

const legacy = { snapshot: { vehicleReviewVersion: VEHICLE_API_REVIEW_VERSION }, vehicleSearch: {
  fetchedAt: "2026-10-15T03:00:00Z", rows: [{ id: "legacy", reviewStatus: "unable-to-verify", classificationReviewStatus: "correct" }],
} };
const oldEntries = getVehicleDashboardSummary(legacy);
assert.equal(oldEntries.find(entry => entry.key === "legacy:plate:all").pending, 0);
assert.equal(oldEntries.find(entry => entry.key === "legacy:plate:all").recorded, 1);
assert.equal(oldEntries.find(entry => entry.key === "legacy:classification:all").recorded, 1);
const scoped = getVehicleDashboardSummary({ ...legacy, vehicleSearch: { ...dataset("plate", ["correct"]), classification: dataset("classification", ["unable-to-verify"]) } });
assert.equal(scoped.find(entry => entry.key === "legacy:classification:day").unableToVerify, 1);
const empty = getVehicleDashboardSummary({ ...legacy, vehicleSearch: { ...dataset("plate", []), classification: dataset("classification", []) } });
assert.equal(empty.find(entry => entry.key === "legacy:plate:day").state, "empty");
const acknowledged = dataset("plate", []);
acknowledged.scopes.day.emptyResultAcknowledgedAt = "2026-10-15T04:00:00Z";
assert.equal(getVehicleDashboardSummary({ ...legacy, vehicleSearch: acknowledged })[0].state, "empty-acknowledged");
assert.deepEqual(getVehicleDashboardSummary(null), []);
assert.deepEqual(getVehicleDashboardSummary({ vehicleSearch: { systems: {} } }), []);
const temporary = await fs.mkdtemp(path.resolve(".scratch/dashboard-summary-test-"));
try {
  const output = path.join(temporary, "render.mjs");
  await build({ stdin: { contents: `
    export { createDashboardPage } from './src/app/pages/DashboardPage.jsx';
    export { createRuntime } from './src/app/page-runtimes/dashboard.runtime.js';
    export { createUiVehicleSystemsDemoRound } from './src/domain/demo-fixture.js';
    export { createDefaultStationProfile } from './src/domain/master-checklist.js';
    export { createElement } from 'react';
    export { renderToStaticMarkup } from 'react-dom/server';
  `, resolveDir: process.cwd() }, outfile: output, bundle: true, platform: "node", packages: "external", format: "esm", jsx: "automatic", loader: { ".css": "empty" } });
  const runtime = await import(pathToFileURL(output));
  const fixture = runtime.createUiVehicleSystemsDemoRound("SC");
  fixture.vehicleSearch.systems["sc-hs"].plate.scopes.day.rows[0].reviewStatus = "unable-to-verify";
  const snapshot = JSON.stringify(fixture);
  const profile = { ...runtime.createDefaultStationProfile(), id: fixture.stationId };
  const Page = runtime.createDashboardPage(runtime.createRuntime());
  const html = runtime.renderToStaticMarkup(runtime.createElement(Page, { state: { stationProfiles: [profile], inspectionRounds: [fixture], contracts: [], workPackages: [] }, update() {} }));
  assert.match(html, /HS · ตรวจป้ายทะเบียน · กลางวัน/);
  assert.match(html, /LS · ตรวจประเภทรถ · กลางวัน/);
  assert.match(html, /ตรวจยืนยันไม่ได้ <strong>1 คัน/);
  assert.match(html, /ยังไม่บันทึก/);
  assert.doesNotMatch(html, / · ค้าง /);
  assert.equal(JSON.stringify(fixture), snapshot);
} finally {
  assert.equal(path.dirname(temporary), path.resolve(".scratch"));
  await fs.rm(temporary, { recursive: true, force: true });
}
console.log("PASS dashboard vehicle summaries: systems, contexts, periods, recorded/unverified, empty and legacy data");
