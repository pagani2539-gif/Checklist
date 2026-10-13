const defineSubcategory = (id, titleEn, titleTh, equipmentTypes) => Object.freeze({
  id,
  titleEn,
  titleTh,
  equipmentTypes: Object.freeze(equipmentTypes),
});

const SYSTEM_EQUIPMENT_SUBCATEGORIES = Object.freeze({
  "wim-sorting": Object.freeze([
    defineSubcategory("sensors", "Sensors", "เซนเซอร์ชั่งน้ำหนัก", ["WIM_SENSOR"]),
    defineSubcategory("vehicle-detection", "Vehicle Detection Loops", "ลูปตรวจจับยานพาหนะ", ["WIM_LOOP"]),
  ]),
  "wim-control": Object.freeze([
    defineSubcategory("control-computer", "Control Computer", "คอมพิวเตอร์ควบคุม", ["CONTROL_COMPUTER"]),
  ]),
  "wim-electronics-system": Object.freeze([
    defineSubcategory("cabinet", "Cabinet", "ตู้ควบคุมอิเล็กทรอนิกส์", ["CONTROL_CABINET"]),
    defineSubcategory("protection", "Protection", "อุปกรณ์ป้องกัน", ["WIM_SUB_BREAKER", "WIM_PHASE_PROTECTION"]),
    defineSubcategory("power-supply", "Power Supply", "อุปกรณ์จ่ายไฟ", ["WIM_AC_DC_POWER_SUPPLY", "WIM_SWITCHING_DC", "WIM_TRANSFORMER_24VAC"]),
    defineSubcategory("controller", "Controller", "อุปกรณ์ควบคุม", ["WIM_CONTROLLER"]),
    defineSubcategory("network", "Network Equipment", "อุปกรณ์เครือข่าย", ["WIM_NETWORK_EQUIPMENT"]),
  ]),
  "lpr-control": Object.freeze([
    defineSubcategory("camera", "Camera", "กล้องอ่านป้ายทะเบียน", ["LPR_CAMERA"]),
  ]),
  "cctv-system": Object.freeze([
    defineSubcategory("cameras", "Cameras", "กล้องวงจรปิด", ["FIXED_CAMERA", "PTZ_CAMERA"]),
    defineSubcategory("recording-control", "Recording and Control", "บันทึกภาพและควบคุมกล้อง", ["NVR", "JOYSTICK"]),
  ]),
  "dimension-management": Object.freeze([
    defineSubcategory("scanner", "Measurement Scanner", "เครื่องสแกนวัดมิติ", ["LASER_SCANNER"]),
    defineSubcategory("controller", "System Controller", "ชุดควบคุมระบบ", ["DIMENSION_CONTROLLER"]),
  ]),
  "image-processing-management": Object.freeze([
    defineSubcategory("processor", "Image Processor", "ชุดประมวลผลภาพ", ["IMAGE_PROCESSOR"]),
    defineSubcategory("image-input", "Image Input Camera", "กล้องต้นทางภาพ", ["FIXED_CAMERA"]),
  ]),
  "vms-control": Object.freeze([
    defineSubcategory("signs-displays", "Signs and Displays", "ป้ายและจอแสดงผล", ["VMS_SIGN", "VMS_DISPLAY"]),
    defineSubcategory("light-sensor", "Light Sensor", "เซนเซอร์วัดแสง", ["VMS_LIGHT_SENSOR"]),
  ]),
  "data-management": Object.freeze([
    defineSubcategory("database-server", "Database Server", "เครื่องแม่ข่ายฐานข้อมูล", ["DATABASE_SERVER"]),
  ]),
  "station-display": Object.freeze([
    defineSubcategory("display-equipment", "Display Equipment", "อุปกรณ์แสดงผลและประมวลผล", ["IMPS_DISPLAY_PROCESSING"]),
  ]),
});

export const UNCLASSIFIED_EQUIPMENT_SUBCATEGORY = Object.freeze({
  id: "other",
  titleEn: "Other Equipment",
  titleTh: "อุปกรณ์อื่นใน System นี้",
  equipmentTypes: Object.freeze([]),
});

const SUBCATEGORY_BY_SYSTEM_AND_TYPE = new Map(
  Object.entries(SYSTEM_EQUIPMENT_SUBCATEGORIES).flatMap(([systemId, groups]) => groups.flatMap((group) => group.equipmentTypes.map((type) => [`${systemId}:${type}`, group]))),
);

export function getEquipmentSubcategory(systemCanonicalId, equipmentType) {
  const systemId = String(systemCanonicalId || "").trim().toLowerCase();
  const type = String(equipmentType || "").trim().toUpperCase();
  return SUBCATEGORY_BY_SYSTEM_AND_TYPE.get(`${systemId}:${type}`) || UNCLASSIFIED_EQUIPMENT_SUBCATEGORY;
}

export function groupEquipmentBySubcategory(systemCanonicalId, items = [], getEquipmentType = (item) => item?.equipmentType || item?.type) {
  const groups = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const subcategory = getEquipmentSubcategory(systemCanonicalId, getEquipmentType(item));
    if (!groups.has(subcategory.id)) groups.set(subcategory.id, { subcategory, items: [] });
    groups.get(subcategory.id).items.push(item);
  }

  const configuredOrder = new Map((SYSTEM_EQUIPMENT_SUBCATEGORIES[String(systemCanonicalId || "").trim().toLowerCase()] || [])
    .map((subcategory, index) => [subcategory.id, index]));
  return [...groups.values()].sort((left, right) => {
    const leftOrder = configuredOrder.get(left.subcategory.id) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = configuredOrder.get(right.subcategory.id) ?? Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder;
  });
}
