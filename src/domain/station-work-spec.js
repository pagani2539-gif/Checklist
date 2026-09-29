const SCOPE_SYSTEM_PURPOSES = Object.freeze({
  "wim-high-data-control": "ควบคุมและจัดการข้อมูล WIM สำหรับขอบเขต High Speed",
  "wim-high-reporting": "จัดทำรายงานจากข้อมูล WIM สำหรับขอบเขต High Speed",
  "wim-high-display": "แสดงผลและประมวลผลข้อมูล WIM สำหรับขอบเขต High Speed",
  "wim-low-data-control": "ควบคุมและจัดการข้อมูล WIM สำหรับขอบเขต Low Speed",
  "wim-low-reporting": "จัดทำรายงานจากข้อมูล WIM สำหรับขอบเขต Low Speed",
  "wim-low-display": "แสดงผลและประมวลผลข้อมูล WIM สำหรับขอบเขต Low Speed",
  "lpr-control": "ควบคุมผลอ่านและการค้นหาป้ายทะเบียนในขอบเขตที่เลือก",
  "data-management": "จัดเก็บและจัดการข้อมูลรถกับผลการประมวลผลในขอบเขตที่เลือก",
  "station-display": "แสดงผลและประมวลผลข้อมูลในขอบเขตที่เลือก",
});

const GROUP_WORK_SPEC_NOTES = Object.freeze({
  "SC-01": Object.freeze({
    scope: "High Speed",
    title: "ขอบเขตซอฟต์แวร์ WIM · High Speed",
    summary: "ใช้ซอฟต์แวร์ชุดเดียวกับขอบเขตอื่น แต่ลงทะเบียน System ของ High Speed แยก เพื่อให้รู้ว่าระบบข้อมูล รายงาน และการแสดงผลชุดนี้ดูแลงานความเร็วสูง",
    functions: Object.freeze([
      "ควบคุมและจัดการข้อมูล WIM High Speed",
      "จัดทำรายงานและแสดงผลข้อมูล WIM High Speed",
      "เชื่อมข้อมูลป้ายทะเบียนและผลจำแนกประเภทรถกับขอบเขต High Speed",
    ]),
    references: Object.freeze([
      "LPR: ผลอ่านและค้นหาป้ายทะเบียนตามช่องจราจร · 3.1",
      "ผลอ่านป้ายทะเบียนเทียบภาพและข้อมูล API · 5.1.5",
      "ผลจำแนกประเภทรถ จำนวนเพลา และน้ำหนักเทียบภาพและข้อมูล API · 5.1.6",
      "การแสดงผล ออกรายงาน และค้นข้อมูลรายคัน · 6.1",
    ]),
  }),
  "SC-04": Object.freeze({
    scope: "Low Speed",
    title: "ขอบเขตซอฟต์แวร์ WIM · Low Speed",
    summary: "ใช้ซอฟต์แวร์ชุดเดียวกับ High Speed แต่ลงทะเบียน System ของ Low Speed แยก เพื่อไม่ให้ผลข้อมูลและรายงานของสองความเร็วปะปนกัน",
    functions: Object.freeze([
      "ควบคุมและจัดการข้อมูล WIM Low Speed",
      "จัดทำรายงานและแสดงผลข้อมูล WIM Low Speed",
      "เชื่อมข้อมูลป้ายทะเบียนและผลจำแนกประเภทรถกับขอบเขต Low Speed",
    ]),
    references: Object.freeze([
      "LPR: ผลอ่านและค้นหาป้ายทะเบียนตามช่องจราจร · 3.1",
      "ผลอ่านป้ายทะเบียนเทียบภาพและข้อมูล API · 5.1.5",
      "ผลจำแนกประเภทรถ จำนวนเพลา และน้ำหนักเทียบภาพและข้อมูล API · 5.1.6",
      "การแสดงผล ออกรายงาน และค้นข้อมูลรายคัน · 6.1",
    ]),
  }),
  "SC-06": Object.freeze({
    scope: "Central",
    title: "ขอบเขตระบบข้อมูลส่วนกลาง · SC-06",
    summary: "หมวดนี้รับผิดชอบฐานข้อมูลและการประมวลผลส่วนกลาง สำหรับรวบรวมข้อมูลจากสถานีที่เชื่อมต่อ ไม่แทน System ที่ลงทะเบียนแยกใน High Speed, Low Speed หรือ IMPS",
    functions: Object.freeze([
      "จัดเก็บข้อมูลรถและผลการประมวลผลที่ส่งเข้าส่วนกลาง",
      "ค้นข้อมูลรายคันและจัดทำรายงานส่วนกลาง",
      "แสดงสถานะการเชื่อมต่อและข้อมูลการตั้งค่าระบบส่วนกลาง",
    ]),
    references: Object.freeze([
      "ภาพอุปกรณ์ รุ่น/หมายเลขประจำเครื่อง และการบันทึกข้อมูล · 5.1",
      "ผลอ่านป้ายทะเบียนและผลจำแนกประเภทรถ · 5.1.5–5.1.6",
      "การพิมพ์รายงาน ค้นรถรายคัน เชื่อมต่อส่วนกลาง และกำหนดค่าระบบ · 6.1",
    ]),
  }),
  "IMPS-06": Object.freeze({
    scope: "ImPS",
    title: "ขอบเขตระบบข้อมูล · IMPS",
    summary: "ใช้ซอฟต์แวร์ชุดเดียวกับสถานี SC แต่ลงทะเบียน System ใน Scope ImPS แยก เพื่อระบุข้อมูลและรายงานที่อยู่ในงาน IMPS",
    functions: Object.freeze([
      "จัดเก็บและจัดการข้อมูลรถในขอบเขต IMPS",
      "เชื่อมผลอ่านป้ายทะเบียนและผลจำแนกประเภทรถกับข้อมูล IMPS",
      "แสดงผล ค้นข้อมูล และจัดทำรายงานของขอบเขต IMPS",
    ]),
    references: Object.freeze([
      "ผลอ่านป้ายทะเบียนเทียบภาพและข้อมูล API · 5.1.5",
      "ผลจำแนกประเภทรถ จำนวนเพลา และน้ำหนักเทียบภาพและข้อมูล API · 5.1.6",
      "การแสดงผล ออกรายงาน และค้นข้อมูลรายคัน · 6.1",
    ]),
  }),
});

export function getStationWorkSpecPurpose(systemId) {
  return SCOPE_SYSTEM_PURPOSES[String(systemId || "")] || "";
}

export function getStationWorkSpecGroupNote(format, groupId) {
  const normalizedFormat = String(format || "SC").toUpperCase() === "IMPS" ? "IMPS" : "SC";
  const expectedPrefix = `${normalizedFormat}-`;
  if (!String(groupId || "").startsWith(expectedPrefix)) return null;
  return GROUP_WORK_SPEC_NOTES[String(groupId)] || null;
}
