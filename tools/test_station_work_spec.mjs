import assert from "node:assert/strict";
import { getStationWorkSpecGroupNote, getStationWorkSpecPurpose } from "../src/domain/station-work-spec.js";

assert.equal(getStationWorkSpecPurpose("lpr-control"), "ควบคุมผลอ่านและการค้นหาป้ายทะเบียนในขอบเขตที่เลือก");

for (const [groupId, scope] of [["SC-01", "High Speed"], ["SC-04", "Low Speed"]]) {
  const note = getStationWorkSpecGroupNote("SC", groupId);
  assert.equal(note.scope, scope);
  assert.ok(!note.title.includes("WIM"), `${scope} guidance must also fit the LPR Work Spec`);
  assert.ok(note.summary.includes("ป้ายทะเบียน"), `${scope} guidance must describe the LPR relationship`);
  assert.ok(note.functions.some((entry) => entry.includes("Lane")), `${scope} guidance must mention Lane binding`);
}

assert.equal(getStationWorkSpecGroupNote("IMPS", "IMPS-06")?.scope, "ImPS");
assert.equal(getStationWorkSpecGroupNote("SC", "IMPS-06"), null);

console.log("station Work Spec scope copy passed");
