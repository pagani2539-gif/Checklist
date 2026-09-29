const item = (id, canonicalId, category, displayName, sourceName, quantity, unit, kind, scope, assetType = null) => Object.freeze({
  id, canonicalId, category, displayName, sourceName, quantity, unit, kind, scope, assetType,
});

const SC_TOR_ITEMS = [
  item("sc-hs-wim-sorting", "WIM_SORTING", "1.1.1", "ระบบคัดแยกรถ WIM", "WIM SORTING SYSTEM FOR SPOT CHECK (2 set/lane)", 2, "ระบบ", "system", "high-speed"),
  item("sc-hs-wim-electronics", "WIM_ELECTRONICS", "1.1.1", "ระบบอิเล็กทรอนิกส์ WIM", "WIM ELECTRONICS FOR SPOT CHECK", 1, "ระบบ", "system", "high-speed"),
  item("sc-hs-wim-control", "WIM_CONTROL", "1.1.1", "ระบบควบคุม WIM", "WIM CONTROL SYSTEM FOR SPOT CHECK", 1, "ระบบ", "system", "high-speed"),
  item("sc-lpr-control", "LPR_CONTROL", "1.1.2", "ระบบควบคุมการอ่านป้ายทะเบียน", "ระบบควบคุมการอ่านป้ายทะเบียน", 2, "ระบบ", "system", "station"),
  item("sc-lpr-camera", "LPR_CAMERA", "1.1.2", "กล้องอ่านป้ายทะเบียน", "LPR CAMERA", 2, "ชุด", "asset", "station", "LPR_CAMERA"),
  item("sc-hs-cctv-adjustable", "CCTV_ADJUSTABLE_CAMERA", "1.1.3", "กล้อง CCTV แบบปรับมุมมอง", "กล้องโทรทัศน์วงจรปิดชนิดเครือข่าย แบบปรับมุมมอง แบบที่ 2 สำหรับติดตั้งภายนอกอาคาร", 1, "ชุด", "asset", "high-speed", "PTZ_CAMERA"),
  item("sc-hs-cctv-fixed", "CCTV_FIXED_CAMERA", "1.1.3", "กล้อง CCTV แบบมุมมองคงที่", "กล้องโทรทัศน์วงจรปิดชนิดเครือข่ายแบบมุมมองคงที่สำหรับติดตั้งภายนอกอาคาร แบบที่ 2", 4, "ชุด", "asset", "high-speed", "FIXED_CAMERA"),
  item("sc-hs-cctv-joystick", "CCTV_JOYSTICK", "1.1.3", "อุปกรณ์ควบคุมกล้อง CCTV", "JOY STICK", 1, "ชุด", "asset", "high-speed", "JOYSTICK"),
  item("sc-hs-cctv-nvr", "CCTV_NVR", "1.1.3", "เครื่องบันทึกภาพผ่านเครือข่าย", "NETWORK VIDEO RECORDER", 1, "ชุด", "asset", "high-speed", "NVR"),
  item("sc-hs-data-control", "WIM_DATA_CONTROL", "1.1.4", "ระบบควบคุมและบริหารข้อมูล WIM", "ระบบควบคุมการบริหารข้อมูลสำหรับ HI SPEED WEIGH IN MOTION SYSTEM", 1, "ระบบ", "system", "high-speed"),
  item("sc-hs-reporting", "WIM_REPORTING", "1.1.4", "ระบบรายงานผล WIM", "ระบบรายงานผลสำหรับ HI SPEED WEIGH IN MOTION SYSTEM", 1, "ระบบ", "system", "high-speed"),
  item("sc-hs-display", "WIM_DISPLAY_PROCESSING", "1.1.4", "ระบบแสดงผลและประมวลผล WIM", "ระบบแสดงผลและประมวลผลข้อมูลสำหรับ HI SPEED WEIGH IN MOTION SYSTEM", 1, "ระบบ", "system", "high-speed"),
  item("sc-3d-scanner", "TRUCK_3D_LASER_SCANNER", "1.1.5", "เครื่องสแกนเลเซอร์สามมิติ", "3D Laser Scanner", 1, "ชุด", "asset", "3d", "LASER_SCANNER"),
  item("sc-3d-controller", "TRUCK_3D_CONTROLLER", "1.1.5", "ชุดควบคุมการวัดมิติรถบรรทุก", "3D Truck Dimension Controller", 1, "ชุด", "asset", "3d", "DIMENSION_CONTROLLER"),
  item("sc-3d-management", "TRUCK_3D_MANAGEMENT", "1.1.5", "ระบบบริหารจัดการการวัดมิติรถบรรทุก", "3D Truck Dimension Management System", 1, "ชุด", "system", "3d"),
  item("sc-3d-lpr", "LPR_CAMERA", "1.1.5", "กล้องอ่านป้ายทะเบียน", "LPR CAMERA", 1, "ชุด", "asset", "3d", "LPR_CAMERA"),
  item("sc-ls-wim-sorting", "WIM_SORTING", "1.1.6", "ระบบคัดแยกรถ WIM", "WIM SORTING SYSTEM FOR Low Speed", 1, "ระบบ", "system", "low-speed"),
  item("sc-ls-wim-electronics", "WIM_ELECTRONICS", "1.1.6", "ระบบอิเล็กทรอนิกส์ WIM", "WIM ELECTRONICS FOR Low Speed", 1, "ระบบ", "system", "low-speed"),
  item("sc-ls-wim-control", "WIM_CONTROL", "1.1.6", "ระบบควบคุม WIM", "WIM CONTROL SYSTEM FOR Low Speed", 1, "ระบบ", "system", "low-speed"),
  item("sc-ls-cctv-adjustable", "CCTV_ADJUSTABLE_CAMERA", "1.1.7", "กล้อง CCTV แบบปรับมุมมอง", "กล้องโทรทัศน์วงจรปิดชนิดเครือข่าย แบบปรับมุมมอง แบบที่ 2 สำหรับติดตั้งภายนอกอาคาร", 1, "ชุด", "asset", "low-speed", "PTZ_CAMERA"),
  item("sc-ls-cctv-fixed", "CCTV_FIXED_CAMERA", "1.1.7", "กล้อง CCTV แบบมุมมองคงที่", "กล้องโทรทัศน์วงจรปิดชนิดเครือข่ายแบบมุมมองคงที่สำหรับติดตั้งภายนอกอาคาร แบบที่ 2", 1, "ชุด", "asset", "low-speed", "FIXED_CAMERA"),
  item("sc-ls-lpr", "LPR_CAMERA", "1.1.7", "กล้องอ่านป้ายทะเบียน", "LPR CAMERA", 1, "ชุด", "asset", "low-speed", "LPR_CAMERA"),
  item("sc-ls-data-control", "WIM_DATA_CONTROL", "1.1.8", "ระบบควบคุมและบริหารข้อมูล WIM", "ระบบควบคุมการบริหารข้อมูลสำหรับ LOW SPEED WEIGH IN MOTION SYSTEM", 1, "ระบบ", "system", "low-speed"),
  item("sc-ls-reporting", "WIM_REPORTING", "1.1.8", "ระบบรายงานผล WIM", "ระบบรายงานผลสำหรับ LOW SPEED WEIGH IN MOTION SYSTEM", 1, "ระบบ", "system", "low-speed"),
  item("sc-ls-display", "WIM_DISPLAY_PROCESSING", "1.1.8", "ระบบแสดงผลและประมวลผล WIM", "ระบบแสดงผลและประมวลผลข้อมูลสำหรับ LOW SPEED WEIGH IN MOTION SYSTEM", 1, "ระบบ", "system", "low-speed"),
  // Keep the reviewed TOR wording in sourceName for traceability, while the
  // station-facing label stays one canonical VMS Sign item per speed.
  item("sc-vms-large", "VMS_SIGN", "1.1.9", "ป้าย VMS", "ป้าย VMS ชนิด FULL COLOR ขนาด 3.20 × 6.40 ม. For HI SPEED", 1, "ชุด", "asset", "high-speed", "VMS_SIGN"),
  item("sc-vms-small", "VMS_SIGN", "1.1.9", "ป้าย VMS", "ป้าย VMS ชนิด FULL COLOR ขนาด 1.60 × 1.60 ม. For HI SPEED", 2, "ชุด", "asset", "high-speed", "VMS_SIGN"),
  item("sc-vms-low", "VMS_SIGN", "1.1.9", "ป้าย VMS", "ป้าย VMS ชนิด FULL COLOR ขนาด 1.25 × 3.20 ม. For LOW SPEED", 1, "ชุด", "asset", "low-speed", "VMS_SIGN"),
  item("sc-vms-control", "VMS_CONTROL", "1.1.9", "ระบบควบคุมป้าย VMS", "ระบบควบคุมป้าย VMS", 2, "ระบบ", "system", "station"),
  item("sc-central-data", "CENTRAL_DATA_CONTROL", "1.1.10", "ระบบควบคุมการบริหารข้อมูลรวม", "ระบบควบคุมการบริหารข้อมูล", 1, "ระบบ", "system", "central"),
  item("sc-central-display", "CENTRAL_DISPLAY_PROCESSING", "1.1.10", "ระบบแสดงผลและประมวลผลข้อมูลรวม", "ระบบแสดงผลและประมวลผลข้อมูลของระบบรวม", 1, "ระบบ", "system", "central"),
  item("sc-central-integration", "CENTRAL_NETWORK_INTEGRATION", "1.1.10", "งานเชื่อมต่อระบบเครือข่ายส่วนกลาง", "งานเชื่อมต่อระบบเครือข่ายสื่อสารข้อมูลกับส่วนกลางสำหรับเจ้าหน้าที่ตรวจสอบน้ำหนักย่อยและจุด Check Point", 1, "ระบบ", "service", "central"),
  item("sc-cabinet", "SYSTEM_CABINET", "1.1.11", "ตู้ Cabinet", "ตู้ Cabinet", 1, "ระบบ", "asset", "station", "CABINET"),
];

const IMPS_TOR_ITEMS = [
  item("imps-image-camera", "CCTV_FIXED_CAMERA", "1", "กล้องประมวลผลภาพแบบมุมมองคงที่", "กล้องโทรทัศน์วงจรปิดชนิดเครือข่าย แบบมุมมองคงที่ สำหรับติดตั้งภายนอกอาคาร แบบที่ 2", 1, "ชุด", "asset", "imps", "FIXED_CAMERA"),
  item("imps-image-processor", "IMAGE_PROCESSOR", "1", "ชุดประมวลผลสัญญาณภาพ", "ชุดประมวลผลสัญญาณภาพ", 1, "ชุด", "asset", "imps", "IMAGE_PROCESSOR"),
  item("imps-image-management", "IMAGE_PROCESSING_MANAGEMENT", "1", "ระบบประมวลผลและบริหารจัดการสัญญาณภาพ", "ระบบประมวลผลสัญญาณภาพและบริหารจัดการ (Image Processing Management System)", 1, "ระบบ", "system", "imps"),
  item("imps-wim-sorting", "WIM_SORTING", "2", "ระบบคัดแยกรถ WIM", "WIM SORTING SYSTEM FOR ImPS", 2, "ระบบ", "system", "imps"),
  item("imps-wim-control", "WIM_CONTROL", "2", "ระบบควบคุม WIM", "WIM CONTROL SYSTEM FOR ImPS", 1, "ระบบ", "system", "imps"),
  item("imps-wim-electronics", "WIM_ELECTRONICS", "2", "ระบบอิเล็กทรอนิกส์ WIM", "WIM ELECTRONICS FOR ImPS", 1, "ระบบ", "system", "imps"),
  item("imps-lpr-control", "LPR_CONTROL", "3", "ระบบควบคุมการอ่านป้ายทะเบียน", "ระบบควบคุมการอ่านป้ายทะเบียน", 2, "ระบบ", "system", "imps"),
  item("imps-lpr-camera", "LPR_CAMERA", "3", "กล้องอ่านป้ายทะเบียน", "LPR CAMERA", 2, "ชุด", "asset", "imps", "LPR_CAMERA"),
  item("imps-cctv-camera", "CCTV_FIXED_CAMERA", "4", "กล้อง CCTV แบบมุมมองคงที่", "กล้องโทรทัศน์วงจรปิดชนิดเครือข่าย แบบมุมมองคงที่ สำหรับติดตั้งภายนอกอาคาร แบบที่ 2", 2, "ชุด", "asset", "imps", "FIXED_CAMERA"),
  item("imps-cctv-nvr", "CCTV_NVR", "4", "เครื่องบันทึกภาพผ่านเครือข่าย", "NETWORK VIDEO RECORDER", 1, "ชุด", "asset", "imps", "NVR"),
  item("imps-database-report", "DATABASE_REPORTING", "5", "ระบบจัดการฐานข้อมูลและรายงาน", "DATABASE MANAGEMENT AND REPORTING SYSTEM", 1, "ระบบ", "system", "imps"),
  item("imps-display", "IMPS_DISPLAY_PROCESSING", "5", "ระบบแสดงผลและประมวลผลข้อมูล ImPS", "ระบบแสดงผลและประมวลผลข้อมูลสำหรับ ImPS", 1, "ระบบ", "system", "imps"),
  item("imps-cabinet", "SYSTEM_CABINET", "5", "ตู้ Cabinet", "ตู้ Cabinet", 1, "ชุด", "asset", "imps", "CABINET"),
];

export const STATION_TOR_ITEMS = Object.freeze({
  SC: Object.freeze(SC_TOR_ITEMS),
  IMPS: Object.freeze(IMPS_TOR_ITEMS),
});

export function createStationTorItems(format = "SC") {
  const key = String(format || "SC").toUpperCase() === "IMPS" ? "IMPS" : "SC";
  return STATION_TOR_ITEMS[key].map((entry) => ({ ...entry }));
}

export function normalizeStationTorItem(value = {}) {
  return {
    id: String(value.id || ""), canonicalId: String(value.canonicalId || ""), category: String(value.category || ""),
    displayName: String(value.displayName || value.sourceName || ""), sourceName: String(value.sourceName || value.displayName || ""),
    quantity: Math.max(0, Number(value.quantity || 0)), unit: String(value.unit || "ระบบ"),
    kind: ["asset", "system", "service"].includes(value.kind) ? value.kind : "system",
    scope: String(value.scope || "station"), assetType: value.assetType ? String(value.assetType) : null,
  };
}

/**
 * Return the station-facing TOR list. Source rows remain unchanged in
 * STATION_TOR_ITEMS; only High/Low VMS sign rows are combined for display.
 * This keeps one canonical label per speed without losing the source IDs or
 * the original TOR quantities used for audit and comparison.
 */
export function getStationTorPresentationItems(values = []) {
  const items = Array.isArray(values) ? values.map(normalizeStationTorItem) : [];
  const result = [];
  const vmsGroups = new Map();
  for (const entry of items) {
    const isScopedVmsSign = entry.canonicalId === "VMS_SIGN" && ["high-speed", "low-speed"].includes(entry.scope);
    if (!isScopedVmsSign) {
      result.push(entry);
      continue;
    }
    const key = `${entry.canonicalId}:${entry.scope}`;
    const existing = vmsGroups.get(key);
    if (existing) {
      existing.quantity += entry.quantity;
      existing.sourceEntryIds.push(entry.id);
      continue;
    }
    const grouped = {
      ...entry,
      id: `tor-vms-sign-${entry.scope}`,
      displayName: "ป้าย VMS",
      sourceName: "ป้าย VMS",
      sourceEntryIds: [entry.id],
    };
    vmsGroups.set(key, grouped);
    result.push(grouped);
  }
  return result;
}

export function summarizeStationTorItems(values = []) {
  const items = Array.isArray(values) ? values.map(normalizeStationTorItem) : [];
  return {
    lineCount: items.length,
    quantityByUnit: items.reduce((totals, entry) => ({ ...totals, [entry.unit]: (totals[entry.unit] || 0) + entry.quantity }), {}),
    countByKind: items.reduce((totals, entry) => ({ ...totals, [entry.kind]: (totals[entry.kind] || 0) + 1 }), {}),
  };
}
