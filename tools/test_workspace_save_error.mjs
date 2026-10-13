import assert from "node:assert/strict";
import { describeWorkspaceSaveError } from "../src/domain/workspace-save-error.js";

assert.deepEqual(describeWorkspaceSaveError({ status: 409, payload: { requestId: "req-123" } }), {
  message: "ข้อมูลส่วนกลางเปลี่ยนระหว่างบันทึก กรุณาโหลดข้อมูลล่าสุดก่อนลองใหม่ (409)",
  status: 409,
  requestId: "req-123",
  detail: "",
});
assert.equal(describeWorkspaceSaveError({ status: 403 }).message, "บัญชีนี้ไม่มีสิทธิ์บันทึกข้อมูลชุดนี้ (403)");
assert.equal(describeWorkspaceSaveError({ status: 502 }).message, "ระบบส่วนกลางขัดข้องชั่วคราว (502)");
assert.equal(describeWorkspaceSaveError({ status: 400, payload: { message: "Invalid record identity" } }).detail, "Invalid record identity");
assert.equal(describeWorkspaceSaveError({ offline: true }).status, null);
assert.equal(describeWorkspaceSaveError(new Error("Internal validation detail"), { preparationError: true }).message, "ระบบเตรียมข้อมูลชุดนี้เพื่อบันทึกไม่สำเร็จ");
console.log("workspace save error descriptions passed");
