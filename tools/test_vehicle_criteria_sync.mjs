import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { normalizeVehicleSearchState } from "../src/domain/vehicle-search.js";

// Exercise the actual criteria synchronization effect, including its dependency
// comparison, with freshly projected datasets as the page supplies them.
const source = readFileSync(new URL("../src/app/vehicle-review/ReviewPanels.jsx", import.meta.url), "utf8");
const effect = source.match(/useEffect\(\(\) => \{\s*setCriteria\(normalizeVehicleSearchState\(criteriaValue,[\s\S]*?\}\, \[[^\]]+\]\);/);
assert.ok(effect, "focused criteria synchronization effect exists");
let previous;
let criteria;
const context = {
  normalizeVehicleSearchState,
  round: { id: "round-criteria" }, vehicleSearchBaseUrl: "",
  vehicleSearchConfig: { apiProfile: "legacy-v1" }, context: { key: "plate" },
  scopeKey: "day", activeScopeKey: "day", fallbackCriteria: {},
  setCriteria: next => { criteria = next; }, setError: () => {},
  useEffect: (callback, dependencies) => {
    if (!previous || dependencies.some((value, index) => !Object.is(value, previous[index]))) callback();
    previous = dependencies;
  },
};
const stored = { criteria: { startAt: "2026-10-04T09:00", endAt: "2026-10-04T10:00" }, fetchedAt: "2026-10-04T03:00:00Z", rows: [] };
const render = state => {
  context.value = normalizeVehicleSearchState(state);
  context.criteriaValue = context.value;
  vm.runInNewContext(effect[0], context);
};
render(stored);
criteria = { startAt: "2026-10-03T09:00", endAt: "2026-10-03T10:00" };
render(stored);
assert.equal(criteria.startAt, "2026-10-03T09:00", "status render must not revert the selected start date after an empty result");
assert.equal(criteria.endAt, "2026-10-03T10:00", "status render must not revert the selected end date");
render({ ...stored, criteria: { startAt: "2026-10-02T06:00", endAt: "2026-10-02T18:00" } });
assert.equal(criteria.startAt, "2026-10-02T06:00", "a real stored dataset change still synchronizes");
context.activeScopeKey = "night";
render({ ...stored, criteria: { startAt: "2026-10-02T18:00", endAt: "2026-10-03T06:00" } });
assert.equal(criteria.endAt, "2026-10-03T06:00", "switching day/night still synchronizes");
console.log("PASS empty-result date edits survive projected status renders; dataset and day/night changes synchronize");
