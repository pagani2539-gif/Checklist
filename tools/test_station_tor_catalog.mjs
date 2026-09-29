import assert from "node:assert/strict";
import {
  createStationDraft,
  createStationProfileFromDraft,
  createSnapshot,
  normalizeSnapshot,
} from "../src/domain/master-checklist.js";
import { getStationTorPresentationItems, STATION_TOR_ITEMS, summarizeStationTorItems } from "../src/domain/station-tor-catalog.js";

const scSummary = summarizeStationTorItems(STATION_TOR_ITEMS.SC);
assert.equal(scSummary.lineCount, 33, "SC must contain all 33 reviewed Ranong TOR lines");
assert.deepEqual(scSummary.quantityByUnit, { ระบบ: 21, ชุด: 20 });

const scPresentation = getStationTorPresentationItems(STATION_TOR_ITEMS.SC);
const vmsPresentation = scPresentation.filter((entry) => entry.canonicalId === "VMS_SIGN");
assert.deepEqual(vmsPresentation.map((entry) => [entry.scope, entry.quantity, entry.displayName]), [
  ["high-speed", 3, "ป้าย VMS"],
  ["low-speed", 1, "ป้าย VMS"],
], "High/Low VMS signs must render as one size-free row per scope");
assert.deepEqual(vmsPresentation[0].sourceEntryIds, ["sc-vms-large", "sc-vms-small"]);
assert.ok(!vmsPresentation.some((entry) => /ขนาด/.test(`${entry.displayName} ${entry.sourceName}`)), "VMS presentation labels must not expose dimensions");

const impsSummary = summarizeStationTorItems(STATION_TOR_ITEMS.IMPS);
assert.equal(impsSummary.lineCount, 13, "IMPS must contain all 13 reviewed Samut Sakhon TOR lines");
assert.deepEqual(impsSummary.quantityByUnit, { ชุด: 8, ระบบ: 9 });

for (const item of [...STATION_TOR_ITEMS.SC, ...STATION_TOR_ITEMS.IMPS]) {
  assert.ok(item.canonicalId, `${item.id} must map to a canonical item`);
  assert.ok(item.displayName, `${item.id} must have a Thai display name`);
  assert.ok(item.sourceName, `${item.id} must preserve the TOR source name`);
  assert.ok(["asset", "system", "service"].includes(item.kind), `${item.id} has an invalid kind`);
  assert.ok(item.quantity > 0, `${item.id} must have a positive TOR quantity`);
  assert.ok(["ชุด", "ระบบ"].includes(item.unit), `${item.id} must preserve its TOR unit`);
}

const scDraft = createStationDraft("SC");
assert.equal(Object.hasOwn(scDraft, "torItems"), false, "new station drafts must not attach TOR rows");
const profile = createStationProfileFromDraft(scDraft, 0);
assert.equal(Object.hasOwn(profile, "torItems"), false, "new Station Profiles must retain only installed records");
const snapshot = createSnapshot(profile);
assert.equal(Object.hasOwn(snapshot, "torItems"), false, "new Snapshots must not attach TOR rows");

const legacySnapshot = normalizeSnapshot({
  id: "legacy-snapshot", stationId: profile.id, stationCode: profile.stationCode,
  stationName: profile.stationName, stationSystems: [], lanes: [], equipment: [], checklistConfig: {},
}, profile);
assert.equal(Object.hasOwn(legacySnapshot, "torItems"), false, "legacy Snapshots must not be backfilled with current TOR references");

console.log("Station TOR catalog tests passed.");
