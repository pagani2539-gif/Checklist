import assert from "node:assert/strict";
import { getVehicleAfterDeletion } from "../src/domain/vehicle-deletion-navigation.js";
const rows = Array.from({ length: 15 }, (_, i) => ({ id: String(i), status: [2, 5, 12].includes(i) ? "pending" : "correct" }));
const pending = row => row.status === "pending";
for (const [ids, expected] of [ [["0"], "2"], [["2"], "5"], [["14"], "2"], [["2", "3"], "5"], [["0", "5"], "12"], [["12", "2"], "5"], [["5", "12"], "2"] ]) {
  assert.equal(getVehicleAfterDeletion(rows, ids, pending).nextRow.id, expected);
}
const complete = getVehicleAfterDeletion(rows, ["2", "5", "12"], pending);
assert.equal(complete.nextRow, null);
assert.equal(complete.complete, true);
assert.equal(complete.remainingRows.length, 12);
const empty = getVehicleAfterDeletion(rows, rows.map(row => row.id), pending);
assert.equal(empty.complete, false);
assert.deepEqual(empty.remainingRows, []);
assert.equal(rows.length, 15);
console.log("PASS deletion navigation: first/middle/last, wrap, adjacent/scattered bulk, reversed input, complete and empty");
