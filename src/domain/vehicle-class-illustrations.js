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

function illustration(image, hint, wheels, axleTires, detail = "", geometryNote = "") {
  return Object.freeze({ image: images[image], hint, wheels, axleTires: Object.freeze(axleTires), detail, geometryNote });
}

const legacy = "น้ำหนักเป็นรายการอ้างอิงเดิมของสถานี ต้องเทียบเอกสารสถานีก่อนยืนยัน";
const semi22Detail = "ตรวจระยะจากสลักพ่วงถึงเพลาแรกของพ่วง และเงื่อนไขทะเบียนตามเอกสารกรมทางหลวง ภาพตัวอย่างใช้วัดระยะไม่ได้";
export const VEHICLE_CLASS_ILLUSTRATIONS = Object.freeze({
  "รถ 4 ล้อ (9.5 ตัน)": illustration("rigid-4", "2 เพลา · ล้อหลังเดี่ยว", 4, [2, 2], "", "อ้างอิงฐานล้อ Isuzu NLR 2,480 มม. เฉพาะรุ่นตัวอย่าง"),
  "รถ 6 ล้อ (15 ตัน)": illustration("rigid-6", "2 เพลา · ล้อหลังคู่", 6, [2, 4], "", "Isuzu FRR มีฐานล้อ 3,410–4,990 มม. ตามรุ่น ไม่มีค่ากลางเดียว"),
  "รถ 10 ล้อ (25 ตัน)": illustration("rigid-10", "3 เพลา · เพลาหน้า 1 / หลัง 2", 10, [2, 4, 4], "", "Isuzu FXZ ตัวอย่างมีฐานล้อ 4,700 มม.; ไม่พบระยะระหว่างเพลาหลังคู่"),
  "รถ 12 ล้อ (30 ตัน)": illustration("rigid-12", "4 เพลา · เพลาหน้า 2 / หลัง 2", 12, [2, 2, 4, 4], "", "Isuzu FYH ตัวอย่างระบุคู่เพลาหน้า 1,880 มม.; ไม่ระบุระยะ tandem หลัง"),
  "รถกึ่งพ่วง 14 ล้อ (35 ตัน)": illustration("semi-14", "หัวลาก 2 เพลา + พ่วง 2 เพลา", 14, [2, 4, 4, 4], "", "ไม่พบระยะชุดหัวลากและกึ่งพ่วงจากรุ่นอ้างอิงตรงประเภท"),
  "รถกึ่งพ่วง 18 ล้อ (40.5 ตัน)": illustration("semi-18-405", "หัวลาก 2 + พ่วง 3 เพลา · เกณฑ์สถานี", 18, [2, 4, 4, 4, 4], legacy, "เกณฑ์ทั่วไป ≥8 ม. วัดจากสลักพ่วงถึงเพลาแรก ไม่ใช่ระยะในกลุ่ม 3 เพลา; น้ำหนักนี้เป็นรายการอ้างอิงของสถานี"),
  "รถกึ่งพ่วง 18 ล้อ (45 ตัน)": illustration("semi-18-45", "หัวลาก 3 เพลา + พ่วง 2 เพลา", 18, [2, 4, 4, 4, 4], "", "ไม่พบระยะรุ่นอ้างอิงตรงประเภท; ภาพใช้แสดงกลุ่มเพลาเท่านั้น"),
  "รถกึ่งพ่วง 20 ล้อ (50 ตัน)": illustration("semi-20", "หัวลาก 4 + พ่วง 2 เพลา · เกณฑ์สถานี", 20, [2, 2, 4, 4, 4, 4], legacy, "ไม่พบระยะรุ่นอ้างอิงตรงประเภท; ภาพใช้แสดงกลุ่มเพลาเท่านั้น"),
  "รถกึ่งพ่วง 22 ล้อ (50.5 ตัน)": illustration("semi-22", "3 + 3 เพลา · ระยะสลักพ่วงถึงเพลาแรก ≥ 8 ม.", 22, [2, 4, 4, 4, 4, 4], semi22Detail, "ข้อกำหนด ≥8 ม. เป็นระยะสลักพ่วงถึงเพลาแรก ไม่ใช่ pitch ระหว่างเพลาสามเพลา"),
  "รถกึ่งพ่วง 22 ล้อ (49 ตัน)": illustration("semi-22", "3 + 3 เพลา · ระยะสลักพ่วงถึงเพลาแรก ≥7 ถึง <8 ม. / ตรวจทะเบียน", 22, [2, 4, 4, 4, 4, 4], semi22Detail, "ช่วงน้ำหนักนี้มีเงื่อนไขปีจดทะเบียน; ระยะกฎหมายไม่ใช่ pitch ในกลุ่มเพลา"),
  "รถกึ่งพ่วง 22 ล้อ (47 ตัน)": illustration("semi-22", "3 + 3 เพลา · ระยะสลักพ่วงถึงเพลาแรก ≥6 ถึง <7 ม. / ตรวจทะเบียน", 22, [2, 4, 4, 4, 4, 4], semi22Detail, "ช่วงน้ำหนักนี้มีเงื่อนไขปีจดทะเบียน; ระยะกฎหมายไม่ใช่ pitch ในกลุ่มเพลา"),
  "รถกึ่งพ่วง 22 ล้อ (45 ตัน)": illustration("semi-22", "3 + 3 เพลา · ระยะสลักพ่วงถึงเพลาแรก ≥4.5 ถึง <6 ม. / ตรวจทะเบียน", 22, [2, 4, 4, 4, 4, 4], semi22Detail, "ช่วงน้ำหนักนี้มีเงื่อนไขปีจดทะเบียน; ระยะกฎหมายไม่ใช่ pitch ในกลุ่มเพลา"),
  "รถกึ่งพ่วง 24 ล้อ (50.5 ตัน)": illustration("semi-24", "หัวลาก 4 เพลา + พ่วง 3 เพลา", 24, [2, 2, 4, 4, 4, 4, 4], "", "กฎหมายทั่วไปกำหนดสลักพ่วงถึงเพลาแรก ≥8 ม.; ไม่ใช่ pitch ของกลุ่ม tridem และภาพใช้แทนระยะจริงไม่ได้"),
  "รถพ่วง 14 ล้อ (37 ตัน)": illustration("full-14", "รถบรรทุก 2 + พ่วง 2 เพลา · เกณฑ์สถานี", 14, [2, 4, 4, 4], legacy, "รถพ่วงเต็ม 2 เพลามีขั้นต่ำตามกฎหมาย 4,300 มม.; ไม่ใช่ค่ารุ่นจริง"),
  "รถพ่วง 18 ล้อ (47 ตัน)": illustration("full-18", "รถบรรทุก 3 เพลา + พ่วง 2 เพลา", 18, [2, 4, 4, 4, 4], "", "รถพ่วงเต็ม 2 เพลามีขั้นต่ำตามกฎหมาย 4,300 มม.; ไม่ใช่ค่ารุ่นจริง"),
  "รถพ่วง 20 ล้อ (50.5 ตัน)": illustration("full-20", "รถบรรทุก 4 เพลา + พ่วง 2 เพลา", 20, [2, 2, 4, 4, 4, 4], "", "รถพ่วงเต็ม 2 เพลามีขั้นต่ำตามกฎหมาย 4,300 มม.; ไม่ใช่ค่ารุ่นจริง"),
  "รถพ่วง 22 ล้อ (50.5 ตัน)": illustration("full-22", "รถบรรทุก 3 เพลา + พ่วง 3 เพลา", 22, [2, 4, 4, 4, 4, 4], "", "9,750 มม. วัดระหว่างกึ่งกลางกลุ่มเพลาคู่ท้ายสองส่วน ไม่ใช่ระยะในกลุ่ม 3 เพลา"),
  "รถพ่วง 24 ล้อ (50.5 ตัน)": illustration("full-24", "รถบรรทุก 4 เพลา + พ่วง 3 เพลา", 24, [2, 2, 4, 4, 4, 4, 4], "", "9,750 มม. วัดระหว่างกึ่งกลางกลุ่มเพลาคู่ท้ายสองส่วน ไม่ใช่ระยะในกลุ่ม 3 เพลา"),
  "รถประเภทอื่นๆ": illustration("other", "ตัวอย่างรถเฉพาะงาน · เมื่อไม่ตรงรายการข้างต้น", null, [], "ประเภทนี้ไม่มีรูปแบบเดียว ให้เทียบจำนวนเพลา ล้อ และลักษณะการพ่วงของรถจริง", "รถเฉพาะงานไม่มีมาตรฐานฐานล้อหรือกลุ่มเพลากลาง"),
});

export function getVehicleClassIllustration(label) {
  return Object.hasOwn(VEHICLE_CLASS_ILLUSTRATIONS, label) ? VEHICLE_CLASS_ILLUSTRATIONS[label] : null;
}
