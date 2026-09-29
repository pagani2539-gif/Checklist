import assert from "node:assert/strict";
import { readAppSource, readPageSource } from "./source-bundle.mjs";

const source = readAppSource();
const activeNewStationFlow = readPageSource("ContextualStationPage.jsx");
assert.ok(activeNewStationFlow.includes("STEP_LABELS"));
assert.ok(activeNewStationFlow.includes("createStationDraft") && activeNewStationFlow.includes("createStationProfileFromDraft"));
assert.ok(activeNewStationFlow.includes("ตั้งค่า Vehicle API (ถ้าใช้)"), "Vehicle API stays optional in the transient identity step");
assert.ok(activeNewStationFlow.includes("WIM RELATIONSHIP MAP") || activeNewStationFlow.includes("แผนผังความสัมพันธ์ ระบบและอุปกรณ์"), "active station creation flow keeps the relationship-map workspace");
assert.ok(activeNewStationFlow.includes("scopeVariants"), "contextual equipment rows must support scoped variants such as VMS High/Low");
assert.ok(activeNewStationFlow.includes("ขอบเขต WIM"), "new-station WIM setup must let the user select the parent High/Low scope per Lane");
assert.ok(activeNewStationFlow.includes("effectiveAssetScope"), "WIM children must render from the parent system scope rather than a stale asset scope");
assert.equal(activeNewStationFlow.includes("StationTorSummary"), false, "active station creation flow must not display TOR data");
assert.equal(activeNewStationFlow.includes("torItems"), false, "new station flow must not attach TOR rows to the draft");
assert.ok(source.includes("newStation: createContextualStationPage"), "the route must use the contextual setup flow");
assert.ok(source.includes("VehicleSearchConfigPanel"), "Vehicle API remains available as optional station configuration");
console.log("station setup UI smoke passed");
