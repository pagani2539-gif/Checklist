// Presentation only. The operator's labels and persisted review values stay unchanged.
const images = Object.freeze({
  "rigid-4": new URL("../assets/vehicle-classes/rigid-4.webp", import.meta.url).href,
  "rigid-6": new URL("../assets/vehicle-classes/rigid-6.webp", import.meta.url).href,
  "rigid-10": new URL("../assets/vehicle-classes/rigid-10.webp", import.meta.url).href,
  "rigid-12": new URL("../assets/vehicle-classes/rigid-12.webp", import.meta.url).href,
  "semi-14": new URL("../assets/vehicle-classes/semi-14.webp", import.meta.url).href,
  "semi-18-405": new URL("../assets/vehicle-classes/semi-18-405.webp", import.meta.url).href,
  "semi-18-45": new URL("../assets/vehicle-classes/semi-18-45.webp", import.meta.url).href,
  "semi-20": new URL("../assets/vehicle-classes/semi-20.webp", import.meta.url).href,
  "semi-22": new URL("../assets/vehicle-classes/semi-22.webp", import.meta.url).href,
  "semi-24": new URL("../assets/vehicle-classes/semi-24.webp", import.meta.url).href,
  "full-14": new URL("../assets/vehicle-classes/full-14.webp", import.meta.url).href,
  "full-18": new URL("../assets/vehicle-classes/full-18.webp", import.meta.url).href,
  "full-20": new URL("../assets/vehicle-classes/full-20.webp", import.meta.url).href,
  "full-22": new URL("../assets/vehicle-classes/full-22.webp", import.meta.url).href,
  "full-24": new URL("../assets/vehicle-classes/full-24.webp", import.meta.url).href,
  "other": new URL("../assets/vehicle-classes/other.webp", import.meta.url).href,
});

function illustration(image, hint, wheels, axleTires, detail = "") {
  return Object.freeze({ image: images[image], hint, wheels, axleTires: Object.freeze(axleTires), detail });
}

const legacy = "น้ำหนักเป็นรายการอ้างอิงเดิมของสถานี ต้องเทียบเอกสารสถานีก่อนยืนยัน";
const semi22Detail = "ตรวจระยะจากสลักพ่วงถึงเพลาแรกของพ่วง และเงื่อนไขทะเบียนตามเอกสารกรมทางหลวง ภาพตัวอย่างใช้วัดระยะไม่ได้";
export const VEHICLE_CLASS_ILLUSTRATIONS = Object.freeze({
  "รถ 4 ล้อ (9.5 ตัน)": illustration("rigid-4", "2 เพลา · ล้อหลังเดี่ยว", 4, [2, 2]),
  "รถ 6 ล้อ (15 ตัน)": illustration("rigid-6", "2 เพลา · ล้อหลังคู่", 6, [2, 4]),
  "รถ 10 ล้อ (25 ตัน)": illustration("rigid-10", "3 เพลา · เพลาหน้า 1 / หลัง 2", 10, [2, 4, 4]),
  "รถ 12 ล้อ (30 ตัน)": illustration("rigid-12", "4 เพลา · เพลาหน้า 2 / หลัง 2", 12, [2, 2, 4, 4]),
  "รถกึ่งพ่วง 14 ล้อ (35 ตัน)": illustration("semi-14", "หัวลาก 2 เพลา + พ่วง 2 เพลา", 14, [2, 4, 4, 4]),
  "รถกึ่งพ่วง 18 ล้อ (40.5 ตัน)": illustration("semi-18-405", "หัวลาก 2 + พ่วง 3 เพลา · เกณฑ์สถานี", 18, [2, 4, 4, 4, 4], legacy),
  "รถกึ่งพ่วง 18 ล้อ (45 ตัน)": illustration("semi-18-45", "หัวลาก 3 เพลา + พ่วง 2 เพลา", 18, [2, 4, 4, 4, 4]),
  "รถกึ่งพ่วง 20 ล้อ (50 ตัน)": illustration("semi-20", "หัวลาก 4 + พ่วง 2 เพลา · เกณฑ์สถานี", 20, [2, 2, 4, 4, 4, 4], legacy),
  "รถกึ่งพ่วง 22 ล้อ (50.5 ตัน)": illustration("semi-22", "3 + 3 เพลา · ระยะช่วงพ่วง ≥ 8 ม.", 22, [2, 4, 4, 4, 4, 4], semi22Detail),
  "รถกึ่งพ่วง 22 ล้อ (49 ตัน)": illustration("semi-22", "3 + 3 เพลา · ระยะ >7 ถึง <8 ม. / ตรวจทะเบียน", 22, [2, 4, 4, 4, 4, 4], semi22Detail),
  "รถกึ่งพ่วง 22 ล้อ (47 ตัน)": illustration("semi-22", "3 + 3 เพลา · ระยะ >6 ถึง <7 ม. / ตรวจทะเบียน", 22, [2, 4, 4, 4, 4, 4], semi22Detail),
  "รถกึ่งพ่วง 22 ล้อ (45 ตัน)": illustration("semi-22", "3 + 3 เพลา · ระยะ >4.5 ถึง <6 ม. / ตรวจทะเบียน", 22, [2, 4, 4, 4, 4, 4], semi22Detail),
  "รถกึ่งพ่วง 24 ล้อ (50.5 ตัน)": illustration("semi-24", "หัวลาก 4 เพลา + พ่วง 3 เพลา", 24, [2, 2, 4, 4, 4, 4, 4]),
  "รถพ่วง 14 ล้อ (37 ตัน)": illustration("full-14", "รถบรรทุก 2 + พ่วง 2 เพลา · เกณฑ์สถานี", 14, [2, 4, 4, 4], legacy),
  "รถพ่วง 18 ล้อ (47 ตัน)": illustration("full-18", "รถบรรทุก 3 เพลา + พ่วง 2 เพลา", 18, [2, 4, 4, 4, 4]),
  "รถพ่วง 20 ล้อ (50.5 ตัน)": illustration("full-20", "รถบรรทุก 4 เพลา + พ่วง 2 เพลา", 20, [2, 2, 4, 4, 4, 4]),
  "รถพ่วง 22 ล้อ (50.5 ตัน)": illustration("full-22", "รถบรรทุก 3 เพลา + พ่วง 3 เพลา", 22, [2, 4, 4, 4, 4, 4]),
  "รถพ่วง 24 ล้อ (50.5 ตัน)": illustration("full-24", "รถบรรทุก 4 เพลา + พ่วง 3 เพลา", 24, [2, 2, 4, 4, 4, 4, 4]),
  "รถประเภทอื่นๆ": illustration("other", "ตัวอย่างรถเฉพาะงาน · เมื่อไม่ตรงรายการข้างต้น", null, [], "ประเภทนี้ไม่มีรูปแบบเดียว ให้เทียบจำนวนเพลา ล้อ และลักษณะการพ่วงของรถจริง"),
});

export function getVehicleClassIllustration(label) {
  return Object.hasOwn(VEHICLE_CLASS_ILLUSTRATIONS, label) ? VEHICLE_CLASS_ILLUSTRATIONS[label] : null;
}
