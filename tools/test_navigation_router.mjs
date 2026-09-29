import assert from "node:assert/strict";
import { canNavigateBackInApp, initializeRouteHistory, navigate, navigateBack, normalizeHash } from "../src/app/navigation.js";
import { getBackFallbackTarget, parseHash, primaryRouteFor, PRIMARY_ROUTES, ROUTE_META } from "../src/app/router.js";

assert.equal(PRIMARY_ROUTES.length, 4);
assert.deepEqual(PRIMARY_ROUTES.map((route) => route.key), ["dashboard", "stations", "inspections", "history"]);
assert.equal(PRIMARY_ROUTES.find((route) => route.key === "stations")?.label, "ทะเบียนสถานี");
assert.equal(ROUTE_META.stations?.[0], "ทะเบียนสถานี");

const cases = [
  ["#/dashboard", "dashboard"],
  ["#/contracts", "dashboard"],
  ["#/contracts/new", "newContract"],
  ["#/contracts/contract-1", "contractDetail"],
  ["#/contracts/contract-1/edit", "contractEdit"],
  ["#/contracts/contract-1/cover", "contractAgreementCover"],
  ["#/contracts/contract-1/work-packages/package-9", "workPackage"],
  ["#/contracts/contract-1/work-packages/package-9/reports/new?stationId=station-1", "contractReportNew"],
  ["#/stations", "stations"],
  ["#/stations/new", "newStation"],
  ["#/stations/station-1", "stationDetail"],
  ["#/inspections", "inspections"],
  ["#/inspections/new", "newInspection"],
  ["#/inspections/round-1", "checklist"],
  ["#/inspections/round-1/vehicle-api/classification", "vehicleApi"],
  ["#/inspections/round-1/vehicle-api-report/plate?scope=day", "vehicleApiReport"],
  ["#/history", "history"],
  ["#/history/round-1", "historyDetail"],
  ["#/history/round-1/vehicle-api/axles", "historyVehicleApi"],
  ["#/history/round-1/vehicle-api-report/classification?scope=night", "historyVehicleApiReport"],
  ["#/history/round-1/revise", "historyRevise"],
  ["#/admin/users", "adminUsers"],
];

for (const [hash, expectedName] of cases) {
  const route = parseHash(hash);
  assert.equal(route.name, expectedName, hash);
  assert.ok(ROUTE_META[route.name], `Missing metadata for ${route.name}`);
}

assert.equal(parseHash("#/contracts").redirectTo, "#/dashboard");

assert.equal(primaryRouteFor("stationDetail"), "stations");
assert.equal(primaryRouteFor("contractDetail"), null);
assert.equal(primaryRouteFor("contractAgreementCover"), null);
assert.equal(primaryRouteFor("workPackage"), null);
assert.equal(primaryRouteFor("newInspection"), "inspections");
assert.equal(primaryRouteFor("vehicleApiReport"), "inspections");
assert.equal(primaryRouteFor("historyVehicleApiReport"), "history");
assert.equal(primaryRouteFor("historyRevise"), "history");
assert.equal(primaryRouteFor("adminUsers"), "adminUsers");
assert.equal(getBackFallbackTarget(parseHash("#/dashboard")), null);
assert.equal(getBackFallbackTarget(parseHash("#/stations/new")), "#/stations");
assert.equal(getBackFallbackTarget(parseHash("#/stations/station-1")), "#/stations");
assert.equal(getBackFallbackTarget(parseHash("#/inspections/round-1/vehicle-api/classification")), "#/inspections/round-1");
assert.equal(getBackFallbackTarget(parseHash("#/history/round-1/vehicle-api/axles")), "#/history/round-1");
assert.equal(getBackFallbackTarget(parseHash("#/inspections/round-1/vehicle-api-report/plate?scope=day")), "#/inspections/round-1/vehicle-api/plate?scope=day");
assert.equal(getBackFallbackTarget(parseHash("#/history/round-1/vehicle-api-report/classification?scope=night")), "#/history/round-1/vehicle-api/classification?scope=night");
assert.equal(getBackFallbackTarget(parseHash("#/contracts/contract-1/work-packages/package-9")), "#/contracts/contract-1");
assert.equal(normalizeHash("stations"), "#/stations");
assert.equal(normalizeHash("/history/round-1"), "#/history/round-1");
assert.equal(normalizeHash("#/dashboard"), "#/dashboard");
assert.equal(normalizeHash(""), "#/dashboard");

const previousWindow = globalThis.window;
const testLocation = { href: "http://localhost/#/stations/new", hash: "#/stations/new", pathname: "/", search: "" };
const testHistory = {
  state: null,
  backCalls: 0,
  replaceState(state, _title, url) {
    this.state = state;
    const value = String(url);
    const nextHash = value.includes("#") ? value.slice(value.indexOf("#")) : "";
    testLocation.hash = nextHash;
    testLocation.href = "http://localhost/" + nextHash;
  },
  pushState(state, _title, url) {
    this.replaceState(state, _title, url);
  },
  back() {
    this.backCalls += 1;
  },
};
globalThis.window = {
  history: testHistory,
  location: testLocation,
  dispatchEvent() {},
};
try {
  initializeRouteHistory();
  assert.equal(canNavigateBackInApp(), false);
  navigate("#/stations");
  assert.equal(testLocation.hash, "#/stations");
  assert.equal(canNavigateBackInApp(), true);
  navigateBack("#/dashboard");
  assert.equal(testHistory.backCalls, 1);
  testHistory.state.__checklistAppNavigation.index = 0;
  navigateBack("#/dashboard");
  assert.equal(testLocation.hash, "#/dashboard");
  assert.equal(testHistory.state.__checklistAppNavigation.index, 0);
} finally {
  if (previousWindow === undefined) delete globalThis.window;
  else globalThis.window = previousWindow;
}

console.log(`navigation/router checks passed (${cases.length} deep routes)`);
