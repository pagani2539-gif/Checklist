import { getCentralNameByKey } from "./equipment-names.js";

const FORMATS = Object.freeze({ SC: ["SC"], BOTH: ["SC", "IMPS"], IMPS: ["IMPS"] });
const SCOPES = Object.freeze({ station: ["Station-wide"], imps: ["ImPS"], image: ["Image Processing"], speed: ["High Speed", "Low Speed"], threed: ["3D"], central: ["Central"] });

const ASSET_SYSTEM_IDS_BY_TYPE = Object.freeze({
  WIM_SENSOR: ["wim-sorting"],
  WIM_LOOP: ["wim-sorting"],
  CONTROL_COMPUTER: ["wim-control"],
  CONTROL_CABINET: ["wim-electronics-system"],
  WIM_AC_DC_POWER_SUPPLY: ["wim-electronics-system"],
  WIM_NETWORK_EQUIPMENT: ["wim-electronics-system"],
  WIM_CONTROLLER: ["wim-electronics-system"],
  WIM_PHASE_PROTECTION: ["wim-electronics-system"],
  WIM_SUB_BREAKER: ["wim-electronics-system"],
  WIM_SWITCHING_DC: ["wim-electronics-system"],
  WIM_TRANSFORMER_24VAC: ["wim-electronics-system"],
  // LPR control equipment belongs to the LPR Control System. The System's
  // operational scope places the same equipment in High/Low Speed or 3D.
  LPR_CONTROL_SYSTEM: ["lpr-control"],
  // The LPR camera is owned by the LPR Control System; scope distinguishes its
  // regular High/Low Speed use from its use in the 3D workflow.
  LPR_CAMERA: ["lpr-control"],
  FIXED_CAMERA: ["cctv-system", "image-processing-management"],
  PTZ_CAMERA: ["cctv-system"],
  NVR: ["cctv-system"],
  JOYSTICK: ["cctv-system"],
  LASER_SCANNER: ["dimension-management"],
  DIMENSION_CONTROLLER: ["dimension-management"],
  IMAGE_PROCESSOR: ["image-processing-management"],
  VMS_SIGN: ["vms-control"],
  VMS_LIGHT_SENSOR: ["vms-control"],
  VMS_DISPLAY: ["vms-control"],
  DATABASE_SERVER: ["data-management"],
  IMPS_DISPLAY_PROCESSING: ["station-display"],
});

const item = (id, fallbackNameTh, fallbackNameEn, category, kind, formats, scopes, defaultUnit, checklistMapping, aliases = [], equipmentType = null, options = {}) => {
  const centralName = getCentralNameByKey(id) || getCentralNameByKey(equipmentType);
  return Object.freeze({
    id,
    nameTh: centralName?.nameTh || fallbackNameTh,
    nameEn: centralName?.nameEn || fallbackNameEn,
    aliases: Object.freeze(aliases),
    category,
    kind,
    allowedFormats: Object.freeze(formats),
    allowedScopes: Object.freeze(scopes),
    defaultUnit,
    checklistMapping: Object.freeze(checklistMapping?.length > 1 ? [...checklistMapping] : (centralName?.categoryCode ? [centralName.categoryCode] : checklistMapping)),
    equipmentType,
    systemIds: Object.freeze([...(ASSET_SYSTEM_IDS_BY_TYPE[equipmentType] || [])]),
    scopeVariants: Object.freeze(Array.isArray(options.scopeVariants) ? options.scopeVariants.map(String) : []),
    legacyOnly: options.legacyOnly === true,
  });
};

export const CANONICAL_STATION_ITEMS = Object.freeze([
  item("wim-sensor", "เซนเซอร์ชั่งน้ำหนัก WIM", "WIM Sensor", "WIM", "asset", FORMATS.BOTH, [...SCOPES.imps, ...SCOPES.speed], "แท่ง", ["2.1"], ["WIM SORTING SYSTEM"], "WIM_SENSOR"),
  item("wim-loop", "ลูปตรวจจับยานพาหนะ", "WIM Loop", "WIM", "asset", FORMATS.BOTH, [...SCOPES.imps, ...SCOPES.speed], "ชุด", ["2.1"], [], "WIM_LOOP"),
  // WIM Electronics is a selectable System; its cabinet and electrical
  // sub-equipment remain separate Asset rows owned by this System.
  item("wim-electronics-system", "ระบบอิเล็กทรอนิกส์ WIM", "WIM Electronics System", "WIM", "system", FORMATS.BOTH, [...SCOPES.imps, ...SCOPES.speed], "ระบบ", ["2.3"], ["WIM ELECTRONICS", "WIM ELECTRONICS SYSTEM"]),
  item("wim-electronics", "ตู้ควบคุมอิเล็กทรอนิกส์ WIM", "WIM Electronics Cabinet", "WIM", "asset", FORMATS.BOTH, [...SCOPES.imps, ...SCOPES.speed], "ตู้", ["2.3"], ["WIM ELECTRONICS", "WIM ELECTRONICS CABINET"], "CONTROL_CABINET"),
  item("wim-ac-dc-power-supply", "อุปกรณ์แปลงไฟ AC/DC", "AC/DC Power Supply", "WIM", "asset", FORMATS.BOTH, [...SCOPES.imps, ...SCOPES.speed], "ชุด", ["2.3"], ["AC/DC POWER SUPPLY"], "WIM_AC_DC_POWER_SUPPLY"),
  item("wim-network-equipment", "อุปกรณ์เชื่อมต่อเครือข่าย WIM", "WIM Network Equipment", "WIM", "asset", FORMATS.BOTH, [...SCOPES.imps, ...SCOPES.speed], "ชุด", ["2.3"], ["NETWORK EQUIPMENT"], "WIM_NETWORK_EQUIPMENT"),
  item("wim-controller", "ตัวควบคุม WIM", "WIM Controller", "WIM", "asset", FORMATS.BOTH, [...SCOPES.imps, ...SCOPES.speed], "ชุด", ["2.3"], ["WIM CONTROLLER"], "WIM_CONTROLLER"),
  item("wim-phase-protection", "อุปกรณ์ป้องกันเฟส", "Phase Protection", "WIM", "asset", FORMATS.BOTH, [...SCOPES.imps, ...SCOPES.speed], "ชุด", ["2.3"], ["PHASE PROTECTION"], "WIM_PHASE_PROTECTION"),
  item("wim-sub-breaker", "เบรกเกอร์ย่อย", "Sub Breaker", "WIM", "asset", FORMATS.BOTH, [...SCOPES.imps, ...SCOPES.speed], "ชุด", ["2.3"], ["SUB BREAKER"], "WIM_SUB_BREAKER"),
  item("wim-switching-dc", "ชุดจ่ายไฟ DC แบบสวิตชิ่ง", "Switching DC Power Supply", "WIM", "asset", FORMATS.BOTH, [...SCOPES.imps, ...SCOPES.speed], "ชุด", ["2.3"], ["SWITCHING DC POWER SUPPLY"], "WIM_SWITCHING_DC"),
  item("wim-transformer-24vac", "หม้อแปลงไฟ AC 24VAC", "Transformer AC 24VAC", "WIM", "asset", FORMATS.BOTH, [...SCOPES.imps, ...SCOPES.speed], "ชุด", ["2.3"], ["TRANSFORMER AC 24VAC"], "WIM_TRANSFORMER_24VAC"),
  item("wim-control", "ระบบควบคุม WIM", "WIM Control System", "WIM", "system", FORMATS.BOTH, [...SCOPES.imps, ...SCOPES.speed], "ระบบ", ["2.2"], ["WIM CONTROL SYSTEM"]),
  item("wim-sorting", "ระบบคัดแยกน้ำหนัก WIM", "WIM Sorting System", "WIM", "system", FORMATS.BOTH, [...SCOPES.imps, ...SCOPES.speed], "ระบบ", ["2.1"]),
  item("wim-high-data-control", "ระบบควบคุมและบริหารข้อมูล WIM ความเร็วสูง", "WIM High Speed Data Control System", "Data/Control", "system", FORMATS.SC, ["High Speed"], "ระบบ", ["6.1"]),
  item("wim-high-reporting", "ระบบรายงานผล WIM ความเร็วสูง", "WIM High Speed Reporting System", "Data/Control", "system", FORMATS.SC, ["High Speed"], "ระบบ", ["6.1"]),
  item("wim-high-display", "ระบบแสดงผลและประมวลผล WIM ความเร็วสูง", "WIM High Speed Display and Processing System", "Data/Control", "system", FORMATS.SC, ["High Speed"], "ระบบ", ["6.1"]),
  item("wim-low-data-control", "ระบบควบคุมและบริหารข้อมูล WIM ความเร็วต่ำ", "WIM Low Speed Data Control System", "Data/Control", "system", FORMATS.SC, ["Low Speed"], "ระบบ", ["6.1"]),
  item("wim-low-reporting", "ระบบรายงานผล WIM ความเร็วต่ำ", "WIM Low Speed Reporting System", "Data/Control", "system", FORMATS.SC, ["Low Speed"], "ระบบ", ["6.1"]),
  item("wim-low-display", "ระบบแสดงผลและประมวลผล WIM ความเร็วต่ำ", "WIM Low Speed Display and Processing System", "Data/Control", "system", FORMATS.SC, ["Low Speed"], "ระบบ", ["6.1"]),
  item("lpr-camera", "กล้องอ่านป้ายทะเบียน", "LPR Camera", "LPR", "asset", FORMATS.BOTH, [...SCOPES.imps, ...SCOPES.speed, ...SCOPES.threed], "ชุด", ["3.2"], ["LPR CAMERA"], "LPR_CAMERA"),
  item("lpr-control", "ระบบควบคุมการอ่านป้ายทะเบียน", "License Plate Recognition Control System", "LPR", "system", FORMATS.BOTH, [...SCOPES.imps, ...SCOPES.speed, ...SCOPES.threed], "ระบบ", ["3.1"]),
  // Keep the old Asset identity for decoding historical records. New SC/IMPS
  // layouts expose only the LPR System and LPR Camera.
  item("lpr-control-system", "อุปกรณ์ควบคุมการอ่านป้ายทะเบียน", "LPR Control System Equipment", "LPR", "asset", FORMATS.BOTH, [...SCOPES.imps, ...SCOPES.speed, ...SCOPES.threed], "ชุด", ["3.1"], ["LPR CONTROL SYSTEM"], "LPR_CONTROL_SYSTEM", { legacyOnly: true }),
  item("cctv-system", "ระบบกล้องโทรทัศน์วงจรปิด", "CCTV Camera System", "CCTV", "system", FORMATS.BOTH, [...SCOPES.imps, ...SCOPES.speed], "ระบบ", ["4.1", "4.2"]),
  item("fixed-camera", "กล้องโทรทัศน์วงจรปิดแบบมุมคงที่", "Fixed CCTV Camera", "CCTV", "asset", FORMATS.BOTH, [...SCOPES.imps, ...SCOPES.image, ...SCOPES.speed], "ชุด", ["4.1"], [], "FIXED_CAMERA"),
  item("ptz-camera", "กล้องโทรทัศน์วงจรปิดแบบปรับมุมมอง", "PTZ CCTV Camera", "CCTV", "asset", FORMATS.BOTH, [...SCOPES.imps, ...SCOPES.speed], "ชุด", ["4.1"], [], "PTZ_CAMERA"),
  item("nvr", "เครื่องบันทึกภาพผ่านเครือข่าย", "Network Video Recorder", "CCTV", "asset", FORMATS.BOTH, [...SCOPES.imps, ...SCOPES.speed], "ชุด", ["4.2"], ["NETWORK VIDEO RECORDER"], "NVR"),
  item("joystick", "ชุดควบคุมกล้อง", "Camera Joystick", "CCTV", "asset", FORMATS.SC, SCOPES.speed, "ชุด", ["4.1"], ["JOY STICK"], "JOYSTICK"),
  item("dimension-scanner", "เครื่องสแกนมิติรถบรรทุก 3 มิติ", "3D Laser Scanner", "3D Dimension", "asset", FORMATS.BOTH, SCOPES.threed, "ชุด", ["1.1.5"], [], "LASER_SCANNER"),
  item("dimension-controller", "ชุดควบคุมวัดมิติรถบรรทุก 3 มิติ", "3D Truck Dimension Controller", "3D Dimension", "asset", FORMATS.BOTH, SCOPES.threed, "ชุด", ["1.1.5"], [], "DIMENSION_CONTROLLER"),
  item("dimension-management", "ระบบบริหารจัดการข้อมูลมิติรถบรรทุก", "3D Truck Dimension Management System", "3D Dimension", "system", FORMATS.BOTH, SCOPES.threed, "ระบบ", ["1.1.5"]),
  item("image-processing-management", "ระบบประมวลผลและบริหารจัดการสัญญาณภาพ", "Image Processing Management System", "Image Processing", "system", FORMATS.IMPS, [...SCOPES.imps, ...SCOPES.image], "ระบบ", ["1.1.12"]),
  item("image-processor", "ชุดประมวลผลสัญญาณภาพ", "Image Processor", "Image Processing", "asset", FORMATS.IMPS, [...SCOPES.image, ...SCOPES.imps], "ชุด", ["1.1.12"], [], "IMAGE_PROCESSOR"),
  item("vms-sign", "ป้ายข้อความเปลี่ยนแปลงได้", "Variable Message Sign", "VMS", "asset", FORMATS.SC, SCOPES.speed, "ชุด", ["7.1"], ["VMS FULL COLOR"], "VMS_SIGN", { scopeVariants: ["High Speed", "Low Speed"] }),
  item("vms-light-sensor", "เซนเซอร์วัดแสง VMS", "VMS Light Sensor", "VMS", "asset", FORMATS.SC, SCOPES.speed, "ชุด", ["7.1"], [], "VMS_LIGHT_SENSOR"),
  item("vms-display", "จอแสดงผล VMS", "VMS Display", "VMS", "asset", FORMATS.SC, SCOPES.speed, "ชุด", ["7.1"], [], "VMS_DISPLAY"),
  item("vms-control", "ระบบควบคุมป้าย VMS", "VMS Control System", "VMS", "system", FORMATS.SC, SCOPES.speed, "ระบบ", ["7.1"]),
  item("wim-control-computer", "เครื่องคอมพิวเตอร์ควบคุม WIM", "WIM Control Computer", "WIM", "asset", FORMATS.BOTH, [...SCOPES.imps, ...SCOPES.speed], "ชุด", ["2.2"], ["WIM CONTROL COMPUTER"], "CONTROL_COMPUTER"),
  item("data-management", "ระบบจัดการฐานข้อมูลและการจัดทำรายงาน", "Database Management and Reporting System", "Data/Control", "system", FORMATS.BOTH, [...SCOPES.imps, ...SCOPES.speed, ...SCOPES.central], "ระบบ", ["5.1"]),
  item("database-server", "เครื่องแม่ข่ายฐานข้อมูล", "Database Server", "Data/Control", "asset", FORMATS.BOTH, [...SCOPES.imps, ...SCOPES.speed, ...SCOPES.central], "ชุด", ["5.1"], ["DATABASE SERVER"], "DATABASE_SERVER"),
  item("station-display", "ระบบแสดงผลและประมวลผลข้อมูล", "Display and Data Processing System", "Data/Control", "system", FORMATS.BOTH, [...SCOPES.imps, ...SCOPES.speed, ...SCOPES.central], "ระบบ", ["5.2"]),
  item("station-display-equipment", "ชุดอุปกรณ์แสดงผลและประมวลผลข้อมูล", "Display and Data Processing Equipment", "Data/Control", "asset", FORMATS.BOTH, [...SCOPES.imps, ...SCOPES.speed, ...SCOPES.central], "ชุด", ["5.2"], ["DISPLAY AND DATA PROCESSING EQUIPMENT"], "IMPS_DISPLAY_PROCESSING"),
  // Preserve the old identity for decoding records, but do not offer a generic
  // Cabinet in newly created stations. WIM Electronics Cabinet stays current.
  item("station-cabinet", "ตู้ควบคุมอุปกรณ์", "Equipment Cabinet", "Station Infrastructure", "asset", FORMATS.BOTH, SCOPES.station, "ตู้", ["1.1.11"], ["SYSTEM CABINET"], "CABINET", { legacyOnly: true }),
]);

export function getCanonicalItemsForFormat(format) {
  const normalized = String(format || "SC").toUpperCase() === "IMPS" ? "IMPS" : "SC";
  // Legacy-only identities remain available to Snapshot/history decoders but
  // are excluded from new station catalogs. WIM Control/Electronics are
  // current selectable Systems, while the old LPR control Asset stays hidden.
  return CANONICAL_STATION_ITEMS.filter((entry) => !entry.legacyOnly && entry.allowedFormats.includes(normalized));
}

export function getCanonicalItem(id) {
  return CANONICAL_STATION_ITEMS.find((entry) => entry.id === id) || null;
}
