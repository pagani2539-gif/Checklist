const freezeWorkpoint = (entry) => Object.freeze(entry);

const SC_LAYOUT = Object.freeze([
  freezeWorkpoint({ id: "sc-wim-hs", categoryId: "wim", scope: "High Speed", titleEn: "WIM HS", titleTh: "ระบบชั่งน้ำหนักความเร็วสูง", noteId: "SC-01" }),
  freezeWorkpoint({ id: "sc-lpr-hs", categoryId: "lpr", scope: "High Speed", titleEn: "LPR FOR HS", titleTh: "ระบบอ่านป้ายทะเบียนสำหรับความเร็วสูง", noteId: "SC-01" }),
  freezeWorkpoint({ id: "sc-cctv-hs", categoryId: "cctv", scope: "High Speed", titleEn: "CCTV FOR HS", titleTh: "ระบบกล้องวงจรปิดสำหรับความเร็วสูง", noteId: "SC-01" }),
  freezeWorkpoint({ id: "sc-3d", categoryId: "3d", scope: "3D", titleEn: "3D DIMENSION", titleTh: "ระบบวัดมิติรถบรรทุก 3 มิติ", noteId: "SC-03" }),
  freezeWorkpoint({ id: "sc-lpr-3d", categoryId: "lpr", scope: "3D", titleEn: "LPR FOR 3D", titleTh: "ระบบอ่านป้ายทะเบียนสำหรับระบบวัดมิติรถ 3 มิติ", noteId: "SC-03" }),
  freezeWorkpoint({ id: "sc-vms-hs", categoryId: "vms", scope: "High Speed", titleEn: "VMS FOR HS", titleTh: "ระบบป้ายข้อความสำหรับความเร็วสูง", noteId: "SC-02" }),
  freezeWorkpoint({ id: "sc-wim-ls", categoryId: "wim", scope: "Low Speed", titleEn: "WIM LS", titleTh: "ระบบชั่งน้ำหนักความเร็วต่ำ", noteId: "SC-04" }),
  freezeWorkpoint({ id: "sc-lpr-ls", categoryId: "lpr", scope: "Low Speed", titleEn: "LPR FOR LS", titleTh: "ระบบอ่านป้ายทะเบียนสำหรับความเร็วต่ำ", noteId: "SC-04" }),
  freezeWorkpoint({ id: "sc-cctv-ls", categoryId: "cctv", scope: "Low Speed", titleEn: "CCTV FOR LS", titleTh: "ระบบกล้องวงจรปิดสำหรับความเร็วต่ำ", noteId: "SC-04" }),
  freezeWorkpoint({ id: "sc-vms-ls", categoryId: "vms", scope: "Low Speed", titleEn: "VMS FOR LS", titleTh: "ระบบป้ายข้อความสำหรับความเร็วต่ำ", noteId: "SC-05" }),
  freezeWorkpoint({ id: "sc-data-control-hs", categoryId: "data-control", scope: "High Speed", titleEn: "DATA/CONTROL HS", titleTh: "ระบบข้อมูลและควบคุมสำหรับความเร็วสูง", noteId: "SC-01", sourceCodeScopes: Object.freeze({ "1.1.4": "High Speed" }) }),
  freezeWorkpoint({ id: "sc-data-control-ls", categoryId: "data-control", scope: "Low Speed", titleEn: "DATA/CONTROL LS", titleTh: "ระบบข้อมูลและควบคุมสำหรับความเร็วต่ำ", noteId: "SC-04", sourceCodeScopes: Object.freeze({ "1.1.8": "Low Speed" }) }),
  freezeWorkpoint({ id: "sc-data-control-central", categoryId: "data-control", scope: "Central", titleEn: "DATA/CONTROL CENTRAL", titleTh: "ระบบข้อมูลและควบคุมส่วนกลาง", noteId: "SC-06" }),
]);

const IMPS_LAYOUT = Object.freeze([
  freezeWorkpoint({ id: "imps-image-processing", categoryId: "image-processing", scope: "Image Processing", titleEn: "IMAGE PROCESSING", titleTh: "ระบบประมวลผลภาพ", noteId: "IMPS-01" }),
  freezeWorkpoint({ id: "imps-wim", categoryId: "wim", scope: "ImPS", titleEn: "WIM", titleTh: "ระบบชั่งน้ำหนัก WIM", noteId: "IMPS-02" }),
  freezeWorkpoint({ id: "imps-lpr", categoryId: "lpr", scope: "ImPS", titleEn: "LPR FOR IMPS", titleTh: "ระบบอ่านป้ายทะเบียนสำหรับ IMPS", noteId: "IMPS-04" }),
  freezeWorkpoint({ id: "imps-cctv", categoryId: "cctv", scope: "ImPS", titleEn: "CCTV FOR IMPS", titleTh: "ระบบกล้องวงจรปิดสำหรับ IMPS", noteId: "IMPS-05" }),
  freezeWorkpoint({ id: "imps-3d", categoryId: "3d", scope: "3D", titleEn: "3D DIMENSION", titleTh: "ระบบวัดมิติรถบรรทุก 3 มิติ", noteId: "IMPS-03" }),
  freezeWorkpoint({ id: "imps-lpr-3d", categoryId: "lpr", scope: "3D", titleEn: "LPR FOR 3D", titleTh: "ระบบอ่านป้ายทะเบียนสำหรับระบบวัดมิติรถ 3 มิติ", noteId: "IMPS-03" }),
  freezeWorkpoint({ id: "imps-data-control", categoryId: "data-control", scope: "ImPS", titleEn: "DATA/CONTROL FOR IMPS", titleTh: "ระบบข้อมูลและควบคุมสำหรับ IMPS", noteId: "IMPS-06" }),
]);

export const STATION_WORKPOINT_LAYOUTS = Object.freeze({ SC: SC_LAYOUT, IMPS: IMPS_LAYOUT });

export function normalizeWorkpointScope(value) {
  const scope = String(value || "").trim().toLocaleLowerCase();
  if (scope.includes("low speed") || scope === "low-speed" || scope === "low" || scope.includes("ความเร็วต่ำ")) return "low";
  if (scope.includes("high speed") || scope === "high-speed" || scope === "high" || scope.includes("ความเร็วสูง")) return "high";
  if (scope.includes("3d") || scope.includes("dimension") || scope.includes("สามมิติ")) return "3d";
  if (scope.includes("image processing") || scope === "image" || scope.includes("ประมวลผลภาพ")) return "image";
  if (scope.includes("imps")) return "imps";
  if (scope.includes("central") || scope.includes("ส่วนกลาง")) return "central";
  return "";
}

export function getStationWorkpointLayout(stationFormat = "SC") {
  return STATION_WORKPOINT_LAYOUTS[String(stationFormat || "SC").toUpperCase() === "IMPS" ? "IMPS" : "SC"];
}

// Inspection work only: keep the equipment register and historical layouts intact.
export function getVehicleReviewWorkpoint(systemKey) {
  const suffix = systemKey === "sc-hs" ? "HS" : systemKey === "sc-ls" ? "LS" : "";
  if (!suffix) return null;
  return { id: `sc-data-control-central-${suffix.toLowerCase()}`, categoryId: "data-control",
    scope: suffix === "HS" ? "High Speed" : "Low Speed",
    titleEn: `DATA/CONTROL CENTRAL FOR ${suffix}`,
    titleTh: `งานข้อมูลส่วนกลางและตรวจรถสำหรับความเร็ว${suffix === "HS" ? "สูง" : "ต่ำ"}`, noteId: "SC-06" };
}

export function findStationWorkpoint(stationFormat, categoryId, scope) {
  const normalizedScope = normalizeWorkpointScope(scope);
  if (!normalizedScope) return null;
  return getStationWorkpointLayout(stationFormat).find((point) => point.categoryId === categoryId
    && normalizeWorkpointScope(point.scope) === normalizedScope) || null;
}

export function resolveChecklistWorkpoint(stationFormat, { categoryId, sourceCode = "", item = {} } = {}) {
  if (categoryId === "data-control" && String(stationFormat).toUpperCase() === "SC") {
    const reviewPoint = getVehicleReviewWorkpoint(item.vehicleReviewSystemKey);
    if (reviewPoint) return reviewPoint;
  }
  const layout = getStationWorkpointLayout(stationFormat);
  const directScope = item.scope || item.laneScopeLabel || item.scopeLabel || item.systemScope || "";
  if (directScope) return findStationWorkpoint(stationFormat, categoryId, directScope);

  const sourceCodeText = String(sourceCode || "").trim();
  const codeScopePoint = layout.find((point) => point.categoryId === categoryId
    && point.sourceCodeScopes?.[sourceCodeText]);
  if (codeScopePoint) return codeScopePoint;

  const systemId = String(item.systemRecordId || item.canonicalItemId || "").toLowerCase();
  if (systemId.includes("wim-high-")) return findStationWorkpoint(stationFormat, categoryId, "High Speed");
  if (systemId.includes("wim-low-")) return findStationWorkpoint(stationFormat, categoryId, "Low Speed");

  const candidates = layout.filter((point) => point.categoryId === categoryId);
  return candidates.length === 1 ? candidates[0] : null;
}
