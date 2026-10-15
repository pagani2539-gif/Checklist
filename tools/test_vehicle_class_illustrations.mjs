import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { VEHICLE_CLASS_OPTIONS } from "../src/domain/vehicle-class-options.js";
import { VEHICLE_CLASS_ILLUSTRATIONS, getVehicleClassIllustration } from "../src/domain/vehicle-class-illustrations.js";

assert.deepEqual(Object.keys(VEHICLE_CLASS_ILLUSTRATIONS), [...VEHICLE_CLASS_OPTIONS]);
for (const label of VEHICLE_CLASS_OPTIONS) {
  const entry = getVehicleClassIllustration(label);
  assert.ok(entry.hint, label);
  assert.ok(entry.geometryNote, `Missing geometry evidence note for ${label}`);
  const bytes = readFileSync(new URL(entry.image));
  assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
  assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
  if (entry.wheels != null) {
    assert.equal(entry.axleTires.reduce((sum, tires) => sum + tires, 0), entry.wheels, label);
    assert.equal(Number(label.match(/(\d+) ล้อ/)[1]), entry.wheels, label);
    assert.ok(entry.axleTires.every(tires => tires === 2 || tires === 4), `Unexpected tire count per axle for ${label}`);
    assert.equal(Object.hasOwn(entry, "singleWheelMarkers"), false, `Illustration should not include wheel marks for ${label}`);
  }
}
assert.equal(getVehicleClassIllustration("ข้อมูลเดิมที่ไม่อยู่ในรายการ"), null);
assert.equal(getVehicleClassIllustration("__proto__"), null);
assert.equal(new Set(Object.values(VEHICLE_CLASS_ILLUSTRATIONS).map(e => e.image)).size, 16);
for (const label of ["รถกึ่งพ่วง 18 ล้อ (40.5 ตัน)", "รถกึ่งพ่วง 20 ล้อ (50 ตัน)", "รถพ่วง 14 ล้อ (37 ตัน)"]) {
  assert.match(getVehicleClassIllustration(label).detail, /รายการอ้างอิงเดิม/);
}
assert.match(getVehicleClassIllustration("รถประเภทอื่นๆ").detail, /ไม่มีรูปแบบเดียว/);
assert.match(getVehicleClassIllustration("รถ 12 ล้อ (30 ตัน)").geometryNote, /1,880 มม/);
assert.match(getVehicleClassIllustration("รถพ่วง 18 ล้อ (47 ตัน)").geometryNote, /4,300 มม/);
assert.match(getVehicleClassIllustration("รถพ่วง 22 ล้อ (50.5 ตัน)").geometryNote, /9,750 มม/);
assert.match(getVehicleClassIllustration("รถกึ่งพ่วง 22 ล้อ (45 ตัน)").geometryNote, /ไม่ใช่ pitch/);
const exampleComponent = readFileSync(new URL("../src/app/vehicle-review/VehicleClassExample.jsx", import.meta.url), "utf8");
const exampleStyles = readFileSync(new URL("../src/styles/vehicle-class-example.css", import.meta.url), "utf8");
assert.doesNotMatch(exampleComponent, /vehicle-class-example-single-wheel-mark|singleWheelMarkers/);
assert.doesNotMatch(exampleComponent, /figcaption|ภาพตัวอย่างโครงสร้างรถ|ภาพตัวอย่างประเภทรถ/);
assert.doesNotMatch(exampleStyles, /\.vehicle-class-example-single-wheel-mark/);
console.log("19 unchanged operator labels mapped to 16 valid assets; axle/tire totals, legacy caveats and fallback passed.");
