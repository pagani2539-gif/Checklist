import assert from "node:assert/strict";
import { getChecklistQueueItemLabel as display } from "../src/app/checklist-queue-state.js";
for (const lane of [1, 2]) {
  for (const task of ["ทดสอบการค้นหาป้ายทะเบียน", "ทดสอบการอ่านป้ายทะเบียนร่วมกับ WIM"]) {
    const period = task.includes("ร่วมกับ") ? " (ช่วงกลางวัน)" : "";
    const item = { label: `${task} — ช่องจราจร ${lane}${period} · ความเร็วสูง · ช่องจราจร ${lane}` };
    const original = item.label;
    assert.equal(display(item), `${task} — ช่องจราจร ${lane}${period}`);
    assert.equal(item.label, original);
  }
}
assert.equal(display({ label: "ตรวจช่องจราจร 1 · ช่องจราจร 2" }), "ตรวจช่องจราจร 1 · ช่องจราจร 2");
assert.equal(display({ label: "ตรวจSD Card ของกล้อง · CCTV-HS-01" }), "ตรวจการ์ดหน่วยความจำของกล้อง · CCTV-HS-01");
assert.equal(display({ label: "วัดค่าของ เซนเซอร์ชั่งน้ำหนัก WIM · SENSOR-LS-05 · ความเร็วต่ำ · ช่องจราจร 1" }), "วัดค่าของ WIM Sensor · SENSOR-LS-05 · ช่องจราจร 1");
assert.equal(display({ label: "ทดสอบการแสดงข้อความบน Variable Message Sign · ป้าย VMS · VMS-HS-01" }), "ทดสอบการแสดงข้อความบนป้าย VMS · VMS-HS-01");
assert.equal(display({ label: "ตรวจตำแหน่ง ป้ายข้อความเปลี่ยนแปลงได้ · VMS-HS-01" }), "ตรวจตำแหน่ง Variable Message Sign · VMS-HS-01");
assert.equal(display({ label: "ตรวจการทำงานของระบบ · ยังไม่ระบุตำแหน่ง" }), "ตรวจการทำงานของระบบ · ยังไม่ระบุตำแหน่ง");
console.log("Checklist display wording regressions passed");
