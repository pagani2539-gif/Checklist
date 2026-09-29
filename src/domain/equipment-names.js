const freezeName = (key, nameTh, nameEn, categoryCode, aliases = []) => Object.freeze({
  key,
  nameTh,
  nameEn,
  categoryCode,
  aliases: Object.freeze(aliases),
});

// This is the presentation seam for equipment and system names. Stable ids,
// sourceLabel values, and checklist evidence labels remain separate so a
// wording change cannot rewrite historical source data.
const CENTRAL_NAME_ENTRIES = [
  freezeName("wim-sorting", "ระบบคัดแยกน้ำหนัก WIM", "WIM Sorting System", "2.1", ["present-wim-sorting"]),
  freezeName("wim-high-data-control", "ระบบควบคุมและบริหารข้อมูล WIM ความเร็วสูง", "WIM High Speed Data Control System", "6.1"),
  freezeName("wim-high-reporting", "ระบบรายงานผล WIM ความเร็วสูง", "WIM High Speed Reporting System", "6.1"),
  freezeName("wim-high-display", "ระบบแสดงผลและประมวลผล WIM ความเร็วสูง", "WIM High Speed Display and Processing System", "6.1"),
  freezeName("wim-low-data-control", "ระบบควบคุมและบริหารข้อมูล WIM ความเร็วต่ำ", "WIM Low Speed Data Control System", "6.1"),
  freezeName("wim-low-reporting", "ระบบรายงานผล WIM ความเร็วต่ำ", "WIM Low Speed Reporting System", "6.1"),
  freezeName("wim-low-display", "ระบบแสดงผลและประมวลผล WIM ความเร็วต่ำ", "WIM Low Speed Display and Processing System", "6.1"),
  freezeName("WIM_SENSOR", "เซนเซอร์ชั่งน้ำหนัก WIM", "WIM Sensor", "2.1"),
  freezeName("WIM_LOOP", "ลูปตรวจจับยานพาหนะ", "WIM Loop", "2.1"),
  freezeName("wim-control", "ระบบควบคุม WIM", "WIM Control System", "2.2", ["present-wim-control"]),
  freezeName("CONTROL_COMPUTER", "เครื่องคอมพิวเตอร์ควบคุม WIM", "WIM Control Computer", "2.2"),
  freezeName("wim-electronics-system", "ระบบอิเล็กทรอนิกส์ WIM", "WIM Electronics System", "2.3", ["present-wim-electronics"]),
  freezeName("CONTROL_CABINET", "ตู้ควบคุมอิเล็กทรอนิกส์ WIM", "WIM Electronics Cabinet", "2.3"),
  freezeName("WIM_AC_DC_POWER_SUPPLY", "อุปกรณ์แปลงไฟ AC/DC", "AC/DC Power Supply", "2.3"),
  freezeName("WIM_NETWORK_EQUIPMENT", "อุปกรณ์เชื่อมต่อเครือข่าย WIM", "WIM Network Equipment", "2.3"),
  freezeName("WIM_CONTROLLER", "ตัวควบคุม WIM", "WIM Controller", "2.3"),
  freezeName("WIM_PHASE_PROTECTION", "อุปกรณ์ป้องกันเฟส", "Phase Protection", "2.3"),
  freezeName("WIM_SUB_BREAKER", "เบรกเกอร์ย่อย", "Sub Breaker", "2.3"),
  freezeName("WIM_SWITCHING_DC", "ชุดจ่ายไฟ DC แบบสวิตชิ่ง", "Switching DC Power Supply", "2.3"),
  freezeName("WIM_TRANSFORMER_24VAC", "หม้อแปลงไฟ AC 24VAC", "Transformer AC 24VAC", "2.3"),
  freezeName("lpr-control", "ระบบควบคุมการอ่านป้ายทะเบียน", "License Plate Recognition Control System", "3.1", ["present-lpr-control"]),
  freezeName("LPR_CONTROL_SYSTEM", "อุปกรณ์ควบคุมการอ่านป้ายทะเบียน", "LPR Control System Equipment", "3.1"),
  freezeName("lpr-camera", "กล้องอ่านป้ายทะเบียน", "LPR Camera", "3.2", ["present-lpr-camera"]),
  freezeName("LPR_CAMERA", "กล้องอ่านป้ายทะเบียน", "LPR Camera", "3.2"),
  freezeName("cctv-system", "ระบบกล้องโทรทัศน์วงจรปิด", "CCTV Camera System", "4.1"),
  freezeName("fixed-camera", "กล้องโทรทัศน์วงจรปิดแบบมุมคงที่", "Fixed CCTV Camera", "4.1", ["present-cctv-camera"]),
  freezeName("FIXED_CAMERA", "กล้องโทรทัศน์วงจรปิดแบบมุมคงที่", "Fixed CCTV Camera", "4.1"),
  freezeName("ptz-camera", "กล้องโทรทัศน์วงจรปิดแบบปรับมุมมอง", "PTZ CCTV Camera", "4.1"),
  freezeName("PTZ_CAMERA", "กล้องโทรทัศน์วงจรปิดแบบปรับมุมมอง", "PTZ CCTV Camera", "4.1"),
  freezeName("nvr", "เครื่องบันทึกภาพผ่านเครือข่าย", "Network Video Recorder", "4.2", ["present-cctv-nvr"]),
  freezeName("NVR", "เครื่องบันทึกภาพผ่านเครือข่าย", "Network Video Recorder", "4.2"),
  freezeName("joystick", "ชุดควบคุมกล้อง", "Camera Joystick", "4.1"),
  freezeName("JOYSTICK", "ชุดควบคุมกล้อง", "Camera Joystick", "4.1"),
  freezeName("dimension-scanner", "เครื่องสแกนมิติรถบรรทุก 3 มิติ", "3D Laser Scanner", "1.1.5"),
  freezeName("LASER_SCANNER", "เครื่องสแกนมิติรถบรรทุก 3 มิติ", "3D Laser Scanner", "1.1.5"),
  freezeName("dimension-controller", "ชุดควบคุมวัดมิติรถบรรทุก 3 มิติ", "3D Truck Dimension Controller", "1.1.5"),
  freezeName("DIMENSION_CONTROLLER", "ชุดควบคุมวัดมิติรถบรรทุก 3 มิติ", "3D Truck Dimension Controller", "1.1.5"),
  freezeName("IMAGE_PROCESSOR", "ชุดประมวลผลสัญญาณภาพ", "Image Processor", "1.1.12"),
  freezeName("image-processing-management", "ระบบประมวลผลและบริหารจัดการสัญญาณภาพ", "Image Processing Management System", "1.1.12"),
  freezeName("dimension-management", "ระบบบริหารจัดการข้อมูลมิติรถบรรทุก", "3D Truck Dimension Management System", "1.1.5"),
  freezeName("vms-sign", "ป้ายข้อความเปลี่ยนแปลงได้", "Variable Message Sign", "7.1"),
  freezeName("VMS_SIGN", "ป้ายข้อความเปลี่ยนแปลงได้", "Variable Message Sign", "7.1"),
  freezeName("vms-control", "ระบบควบคุมป้าย VMS", "VMS Control System", "7.1"),
  freezeName("VMS_LIGHT_SENSOR", "เซนเซอร์วัดแสง VMS", "VMS Light Sensor", "7.1"),
  freezeName("VMS_DISPLAY", "จอแสดงผล VMS", "VMS Display", "7.1"),
  freezeName("data-management", "ระบบจัดการฐานข้อมูลและการจัดทำรายงาน", "Database Management and Reporting System", "5.1", ["present-other-database"]),
  freezeName("DATABASE_SERVER", "เครื่องแม่ข่ายฐานข้อมูล", "Database Server", "5.1"),
  freezeName("station-display", "ระบบแสดงผลและประมวลผลข้อมูล", "Display and Data Processing System", "5.2", ["present-other-display"]),
  freezeName("IMPS_DISPLAY_PROCESSING", "ชุดอุปกรณ์แสดงผลและประมวลผลข้อมูล", "Display and Data Processing Equipment", "5.2"),
  freezeName("cabinet", "ตู้ควบคุมอุปกรณ์", "Equipment Cabinet", "1.1.11"),
  freezeName("CABINET", "ตู้ควบคุมอุปกรณ์", "Equipment Cabinet", "1.1.11"),
];

export const CENTRAL_NAME_CATALOG = Object.freeze(CENTRAL_NAME_ENTRIES);
export const CENTRAL_NAMES_BY_KEY = Object.freeze(Object.fromEntries(CENTRAL_NAME_ENTRIES.map((entry) => [entry.key, entry])));

const freezeSectionName = (code, nameTh, nameEn) => Object.freeze({ code, nameTh, nameEn });

// Station TOR has one system group that is not a Checklist section: the SC
// 3D dimension package is documented under 1.1.5. Keep that documentary
// category separate from Checklist 5.1 (Database) so a system card cannot
// display the wrong category title just because both records have a legacy
// 5.1 mapping elsewhere in the app.
export const CENTRAL_STATION_CATEGORY_ENTRIES = Object.freeze([
  freezeSectionName("1.1.5", "ระบบวัดมิติรถบรรทุก", "3D Truck Dimension Measurement"),
  freezeSectionName("1.1.12", "ระบบประมวลผลสัญญาณภาพ", "Image Processing"),
  freezeSectionName("1.1.11", "ตู้ Cabinet", "Equipment Cabinet"),
]);

export const CENTRAL_STATION_CATEGORIES_BY_CODE = Object.freeze(
  Object.fromEntries(CENTRAL_STATION_CATEGORY_ENTRIES.map((entry) => [entry.code, entry])),
);

// Checklist section names are a second presentation seam: they are shared by
// the station wizard, station profile, inspection workspace and reports. The
// section codes remain the stable BOQ/template identifiers.
export const CENTRAL_CHECKLIST_SECTION_ENTRIES = Object.freeze([
  // These labels are the BOQ headings.  Equipment names remain in
  // CENTRAL_NAME_ENTRIES so a category is never accidentally named after one
  // of the assets it contains.
  freezeSectionName("1.1", "การแสดงความพร้อม", ""),
  freezeSectionName("2.1", "WIM SORTING SYSTEM (SENSOR)", ""),
  freezeSectionName("2.2", "WIM CONTROL SYSTEM FOR IMPS", ""),
  freezeSectionName("2.3", "WIM Electronics System for IMPS", ""),
  freezeSectionName("3.1", "ระบบควบคุมการอ่านป้ายทะเบียน", ""),
  freezeSectionName("3.2", "LPR Camera", ""),
  freezeSectionName("4.1", "CCTV Camera", ""),
  freezeSectionName("4.2", "Network Video Recorder (NVR)", ""),
  freezeSectionName("5.1", "Database Management and Reporting System", ""),
  // 5.2 is an ImPS BOQ category rather than one of the 13 evidence PDFs.
  freezeSectionName("5.2", "ระบบแสดงผลและประมวลผลข้อมูลสำหรับ ImPS", ""),
  freezeSectionName("6.1", "Database Management and Reporting System (software)", ""),
  freezeSectionName("6.2", "ทำความสะอาดห้องควบคุม", ""),
  freezeSectionName("6.3", "ทำความสะอาดตู้ควบคุม", ""),
  freezeSectionName("7.1", "Variable Message Sign (VMS)", ""),
]);

export const CENTRAL_CHECKLIST_SECTIONS_BY_CODE = Object.freeze(
  Object.fromEntries(CENTRAL_CHECKLIST_SECTION_ENTRIES.map((entry) => [entry.code, entry])),
);

// Main equipment/system categories are the stable parent groups used by the
// station register. Checklist/BOQ section codes remain the child categories;
// station-level readiness (1.1) is intentionally outside this list.
export const CENTRAL_EQUIPMENT_MAIN_CATEGORIES = Object.freeze([
  Object.freeze({
    id: "wim",
    label: "WIM (Weigh-In-Motion)",
    description: "ระบบชั่งน้ำหนักขณะรถเคลื่อนที่",
    categoryCodes: Object.freeze(["2.1", "2.2", "2.3"]),
    canonicalCategories: Object.freeze(["WIM"]),
    icon: "2.1",
  }),
  Object.freeze({
    id: "lpr",
    label: "LPR (License Plate Recognition)",
    description: "ระบบควบคุมการอ่านป้ายทะเบียน",
    categoryCodes: Object.freeze(["3.1", "3.2"]),
    canonicalCategories: Object.freeze(["LPR"]),
    icon: "3.1",
  }),
  Object.freeze({
    id: "cctv",
    label: "CCTV (Closed Circuit Television)",
    description: "ระบบกล้องโทรทัศน์วงจรปิด",
    categoryCodes: Object.freeze(["4.1", "4.2"]),
    canonicalCategories: Object.freeze(["CCTV"]),
    icon: "4.1",
  }),
  Object.freeze({
    id: "3d",
    label: "3D Truck Dimension Measurement",
    description: "ระบบวัดมิติรถบรรทุก",
    categoryCodes: Object.freeze(["1.1.5"]),
    canonicalCategories: Object.freeze(["3D Dimension"]),
    icon: "1.1.5",
  }),
  Object.freeze({
    id: "image-processing",
    label: "Image Processing",
    description: "ระบบประมวลผลสัญญาณภาพ",
    categoryCodes: Object.freeze(["1.1.12"]),
    canonicalCategories: Object.freeze(["Image Processing"]),
    icon: "1.1.12",
  }),
  Object.freeze({
    id: "vms",
    label: "VMS (Variable Message Sign)",
    description: "ระบบป้ายข้อความเปลี่ยนแปลงได้",
    categoryCodes: Object.freeze(["7.1"]),
    canonicalCategories: Object.freeze(["VMS"]),
    icon: "7.1",
  }),
  Object.freeze({
    id: "data-control",
    label: "Data / Control",
    description: "ระบบประมวลผลและควบคุมข้อมูล",
    categoryCodes: Object.freeze(["5.1", "5.2", "6.1"]),
    canonicalCategories: Object.freeze(["Data/Control"]),
    icon: "5.1",
  }),
  Object.freeze({
    id: "station-infrastructure",
    label: "Station Infrastructure",
    description: "อุปกรณ์โครงสร้างพื้นฐานประจำสถานี",
    categoryCodes: Object.freeze(["1.1.11"]),
    canonicalCategories: Object.freeze(["Station Infrastructure"]),
    icon: "1.1.11",
  }),
]);

export function getCentralNameByKey(key) {
  return CENTRAL_NAMES_BY_KEY[String(key || "").trim()] || null;
}

export function getCentralEquipmentName(type) {
  return getCentralNameByKey(type);
}

export function getCentralSystemNameForRecord(record) {
  const candidates = [record?.canonicalItemId, record?.id];
  for (const candidate of candidates) {
    const direct = getCentralNameByKey(candidate);
    if (direct && !direct.key.includes("_")) return direct;
    const alias = CENTRAL_NAME_ENTRIES.find((entry) => entry.aliases.includes(String(candidate || "").trim()));
    if (alias) return alias;
  }
  const componentMap = {
    sorting: "wim-sorting",
    control: record?.systemId === "lpr" ? "lpr-control" : "wim-control",
    electronics: "wim-electronics-system",
    camera: "lpr-camera",
    nvr: "nvr",
    database: "data-management",
    "display-processing": "station-display",
  };
  return getCentralNameByKey(componentMap[record?.componentId]) || null;
}

export function getCentralChecklistSectionName(code) {
  return CENTRAL_CHECKLIST_SECTIONS_BY_CODE[String(code || "").trim()] || null;
}

export function getCentralSystemCategoryName(record) {
  const canonicalItemId = String(record?.canonicalItemId || record?.id || "").trim();
  const category = String(record?.category || record?.canonicalCategory || "").trim();
  if (category === "3D Dimension" || canonicalItemId === "dimension-management") {
    return CENTRAL_STATION_CATEGORIES_BY_CODE["1.1.5"];
  }
  const central = getCentralSystemNameForRecord(record);
  const code = String(central?.categoryCode || record?.checklistMapping?.[0] || "").trim();
  return getCentralChecklistSectionName(code)
    || (code ? CENTRAL_STATION_CATEGORIES_BY_CODE[code] || null : null);
}

export function formatCentralName(name, { includeEnglish = false } = {}) {
  if (!name) return "";
  return includeEnglish && name.nameEn ? `${name.nameTh} · ${name.nameEn}` : name.nameTh;
}

export function formatCentralNameEnglishFirst(name) {
  if (!name) return "";
  return [name.nameEn, name.nameTh].filter(Boolean).join(" · ");
}
