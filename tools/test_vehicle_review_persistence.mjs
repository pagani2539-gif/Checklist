import assert from "node:assert/strict";
import { persistVehicleReviewChange } from "../src/domain/vehicle-review-progress.js";

let resolveSave;
let completed = false;
const saving = persistVehicleReviewChange(
  () => new Promise((resolve) => { resolveSave = resolve; }),
  { id: "replacement-dataset" },
).then(() => { completed = true; });

await Promise.resolve();
assert.equal(completed, false, "replacement must wait for the central save acknowledgement");
resolveSave({ version: 7 });
await saving;
assert.equal(completed, true);

await assert.rejects(
  persistVehicleReviewChange(() => Promise.resolve(null), { id: "replacement-dataset" }),
  /บันทึกชุดใหม่ไม่สำเร็จ/,
  "replacement must report failure when persistence returns no acknowledgement",
);

await assert.rejects(
  persistVehicleReviewChange(() => Promise.resolve({ draftState: {} }), { id: "replacement-dataset" }),
  /ข้อมูลชนกับส่วนกลาง · ชุดเดิมยังอยู่/,
  "replacement must explain that the old set remains when central state conflicts",
);

console.log("Vehicle review persistence acknowledgement tests passed");
