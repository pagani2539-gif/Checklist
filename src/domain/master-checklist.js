import {
  EVIDENCE_CHECKLIST_SECTIONS,
  CHECKLIST_POLICY_VERSION,
  PREVIOUS_CHECKLIST_POLICY_VERSION,
  LEGACY_CHECKLIST_POLICY_VERSION,
  HISTORICAL_CHECKLIST_POLICY_VERSION,
  PRIOR_CHECKLIST_POLICY_VERSION,
  PREVIOUS_CURRENT_CHECKLIST_POLICY_VERSION,
  PREVIOUS_NO_WIM_CHECKLIST_POLICY_VERSION,
  PREVIOUS_LPR_SCOPE_CHECKLIST_POLICY_VERSION,
  PREVIOUS_CLEANING_CHECKLIST_POLICY_VERSION,
  DEDICATED_ASSET_CHECKLIST_RECIPE_VERSION,
  WIM_SORTING_EVIDENCE_VERSION,
  getActivePhysicalEquipment,
  getChecklistScopeState,
  getNewRoundChecklistItems,
  getStationChecklistItems,
  getStationChecklistSections,
  resolveStationChecklistConfig,
  EVIDENCE_STATUS_OPTIONS,
  EVIDENCE_TEMPLATE_VERSION,
  PREVIOUS_EVIDENCE_TEMPLATE_VERSION,
  LEGACY_EVIDENCE_TEMPLATE_VERSION,
  LANE_ASSET_EVIDENCE_TEMPLATE_VERSION,
  buildEvidenceItemState,
  emptyEvidence,
  getEvidenceCatalogForSnapshot,
  getEvidenceSectionsForSnapshot,
  getEvidenceSummary,
  createChecklistCopySnapshot,
  buildChecklistTemplateSections,
  getChecklistCopyForSnapshot,
  normalizeChecklistCopy,
  migrateChecklistCopyForCurrentTemplate,
  updateChecklistCopy,
  EVIDENCE_ASSET_TYPE_MAPPING,
  formatChecklistItemDisplayLabel,
  EVIDENCE_TYPE_TO_GROUP,
  getEvidenceAssetRequirement,
  isEvidenceTemplateVersion,
  isCurrentEvidenceTemplateVersion,
  isLaneAssetEvidenceTemplateVersion,
  CLEANING_POLICY_VERSION,
  CLEANING_TARGET_TYPES,
  CLEANING_STAGE_DEFINITIONS,
  VIDEO_EVIDENCE_PURGE_VERSION,
  VIDEO_EVIDENCE_ITEM_IDS,
  VIDEO_EVIDENCE_SLOT_IDS,
  buildCleaningEvidenceItems,
  isCleaningEvidenceComplete,
  isEvidenceSlotComplete,
  CHECKLIST_COPY_REVISION,
  LEGACY_CHECKLIST_COPY_REVISION,
  CHECKLIST_SECTION_TITLES,
} from "./evidence-checklist.js";
import { getLaneScope } from "./station-lane-scope.js";
import { isEvidenceBypassItemStatus, isReportHiddenItemStatus } from "./inspection-status.js";
import { normalizeCorrectionHistory } from "./correction.js";
import { EQUIPMENT_ORDER_VERSION, sortEquipmentForDisplay } from "./ordering.js";
import { createVehicleSearchConfig, createVehicleReviewState, getVehicleReviewContext, getVehicleReviewOutcome, getVehicleReviewState, getVehicleReviewDimensions, getVehicleReviewScopeEntries, getVehicleReviewScopeState, getVehicleSearchIssueRows, getVehicleSearchSummary, isVehicleApiReviewItem, isVehicleSearchItem, isVehicleReviewScopeState, normalizeVehicleReviewState, normalizeVehicleSearchState, VEHICLE_API_REVIEW_VERSION, VEHICLE_REVIEW_SCOPE_VERSION, VEHICLE_SEARCH_ITEM_ID } from "./vehicle-search.js";
import { WIM_ELECTRONICS_SUB_EQUIPMENT_TYPES, normalizeWimElectronicsOutputVoltages, getWimElectronicsSubEquipmentType, getWimElectronicsHierarchyIssue } from "./wim-electronics.js";
import { getCentralEquipmentName, getCentralSystemNameForRecord, getCentralChecklistSectionName, CENTRAL_STATION_CATEGORIES_BY_CODE, formatCentralNameEnglishFirst } from "./equipment-names.js";
import { BOQ_CHECKLIST_PRESENTATION_VERSION, getBoqChecklistDisplaySections, getCanonicalEquipmentCategoryCode } from "./boq-checklist-groups.js";

export const STATUS_OPTIONS = [
  { value: "pending", label: "ยังไม่ได้ตรวจ" },
  { value: "normal", label: "ปกติ" },
  { value: "damaged", label: "ชำรุด" },
  { value: "waiting", label: "อยู่ระหว่างรอเปลี่ยนทดแทน" },
  { value: "not-installed", label: "ไม่ได้ติดตั้ง" },
  { value: "na", label: "ไม่เกี่ยวข้อง" },
];

export const MASTER_TEMPLATE_VERSION = EVIDENCE_TEMPLATE_VERSION;
export { EQUIPMENT_ORDER_VERSION };
export { CHECKLIST_POLICY_VERSION, PREVIOUS_CHECKLIST_POLICY_VERSION, LEGACY_CHECKLIST_POLICY_VERSION, HISTORICAL_CHECKLIST_POLICY_VERSION, PRIOR_CHECKLIST_POLICY_VERSION, PREVIOUS_CURRENT_CHECKLIST_POLICY_VERSION, PREVIOUS_NO_WIM_CHECKLIST_POLICY_VERSION, PREVIOUS_LPR_SCOPE_CHECKLIST_POLICY_VERSION, PREVIOUS_CLEANING_CHECKLIST_POLICY_VERSION, DEDICATED_ASSET_CHECKLIST_RECIPE_VERSION, getActivePhysicalEquipment, getChecklistScopeState, getNewRoundChecklistItems, getStationChecklistItems, getStationChecklistSections, resolveStationChecklistConfig };
export const STATION_DRAFT_TEMPLATE_VERSION = LANE_ASSET_EVIDENCE_TEMPLATE_VERSION;
export const LEGACY_MASTER_TEMPLATE_VERSION = "checklist-master-v2";
export const MASTER_CHECKLIST_COPY_REVISION = "master-checklist-copy-v1";
export const LEGACY_MASTER_CHECKLIST_COPY_REVISION = "master-checklist-copy-legacy-frozen";
export { EVIDENCE_CHECKLIST_SECTIONS, EVIDENCE_STATUS_OPTIONS, EVIDENCE_TEMPLATE_VERSION, LANE_ASSET_EVIDENCE_TEMPLATE_VERSION, PREVIOUS_EVIDENCE_TEMPLATE_VERSION, LEGACY_EVIDENCE_TEMPLATE_VERSION, EVIDENCE_ASSET_TYPE_MAPPING, EVIDENCE_TYPE_TO_GROUP, getEvidenceAssetRequirement, getEvidenceCatalogForSnapshot, getEvidenceSummary, isEvidenceTemplateVersion, isCurrentEvidenceTemplateVersion, isLaneAssetEvidenceTemplateVersion, CLEANING_POLICY_VERSION, CLEANING_TARGET_TYPES, CLEANING_STAGE_DEFINITIONS, WIM_SORTING_EVIDENCE_VERSION, VIDEO_EVIDENCE_PURGE_VERSION, VIDEO_EVIDENCE_ITEM_IDS, VIDEO_EVIDENCE_SLOT_IDS, buildCleaningEvidenceItems, isCleaningEvidenceComplete, isEvidenceSlotComplete, CHECKLIST_COPY_REVISION, LEGACY_CHECKLIST_COPY_REVISION, CHECKLIST_SECTION_TITLES, buildChecklistTemplateSections, createChecklistCopySnapshot, normalizeChecklistCopy, migrateChecklistCopyForCurrentTemplate, updateChecklistCopy, isEvidenceBypassItemStatus, isReportHiddenItemStatus };

export const BOQ_SYSTEMS = Object.freeze([
  { systemId: "wim", order: 1, displayLabel: "ระบบชั่งน้ำหนักขณะรถเคลื่อนที่ (WIM)", sourceLabel: "WEIGH-IN-MOTION (WIM)", sourceRefs: ["2"] },
  { systemId: "lpr", order: 2, displayLabel: "ระบบควบคุมการอ่านป้ายทะเบียน (License Plate Recognition System)", sourceLabel: "ระบบควบคุมการอ่านป้ายทะเบียน (License Plate Recognition System)", sourceRefs: ["3"] },
  { systemId: "cctv", order: 3, displayLabel: "ระบบกล้องวงจรปิด (CCTV)", sourceLabel: "ระบบกล้องโทรทัศน์วงจรปิด (CCTV)", sourceRefs: ["4"] },
  { systemId: "other", order: 4, displayLabel: "ระบบส่วนควบอื่น ๆ", sourceLabel: "ระบบส่วนควบอื่นๆ", sourceRefs: ["5"] },
]);

const ITEM_LIBRARY_CATEGORY_DEFINITIONS = [
  { code: "2.1", systemId: "wim", sourceRefs: ["2.1"] },
  { code: "2.2", systemId: "wim", sourceRefs: ["2.2"] },
  { code: "2.3", systemId: "wim", sourceRefs: ["2.3"] },
  { code: "3.1", systemId: "lpr", sourceRefs: ["3.1"] },
  { code: "3.2", systemId: "lpr", sourceRefs: ["3.2"] },
  { code: "4.1", systemId: "cctv", sourceRefs: ["4.1"] },
  { code: "4.2", systemId: "cctv", sourceRefs: ["4.2"] },
  { code: "5.1", systemId: "other", sourceRefs: ["5.1"] },
  { code: "5.2", systemId: "other", sourceRefs: ["5.2"] },
  { code: "7.1", systemId: "other", sourceRefs: ["7.1"] },
].map((category) => ({ ...category, title: CHECKLIST_SECTION_TITLES[category.code] || category.code }));

export const ITEM_LIBRARY_CATEGORIES = Object.freeze(ITEM_LIBRARY_CATEGORY_DEFINITIONS.map((category) => ({ ...category })));
export const ITEM_LIBRARY_CATEGORY_CODES = Object.freeze(ITEM_LIBRARY_CATEGORIES.map((category) => category.code));
// These two station-TOR groups are physical Asset categories but are not
// sections in the shared evidence Item Library. Keep them additive so older
// Item Library contracts and historical records remain unchanged.
const STATION_ASSET_CATEGORY_DEFINITIONS = [
  { code: "1.1.5", systemId: "3d", sourceRefs: ["1.1.5"], title: formatCentralNameEnglishFirst(CENTRAL_STATION_CATEGORIES_BY_CODE["1.1.5"]) },
  { code: "1.1.12", systemId: "imps", sourceRefs: ["1"], title: formatCentralNameEnglishFirst(CENTRAL_STATION_CATEGORIES_BY_CODE["1.1.12"]) },
  { code: "1.1.11", systemId: "other", sourceRefs: ["1.1.11"], title: formatCentralNameEnglishFirst(CENTRAL_STATION_CATEGORIES_BY_CODE["1.1.11"]) },
];
export const STATION_ASSET_CATEGORIES = Object.freeze([
  ...STATION_ASSET_CATEGORY_DEFINITIONS,
  ...ITEM_LIBRARY_CATEGORIES,
]);
export const STATION_ASSET_CATEGORY_CODES = Object.freeze(STATION_ASSET_CATEGORIES.map((category) => category.code));
export const STATION_FORMATS = Object.freeze([
  { value: "SC", templateId: "SC", label: "SC — Spot Check", shortLabel: "SC", description: "สถานีตรวจสอบน้ำหนักย่อยสำหรับ Spot Check · รองรับป้าย VMS" },
  { value: "IMPS", templateId: "IMPS", label: "IMPS — Image Processing System", shortLabel: "IMPS", description: "ระบบแจ้งเตือนรถไม่เข้าชั่งด้วย Image Processing System · ไม่สร้างป้าย VMS อัตโนมัติ" },
]);
export const DEFAULT_STATION_FORMAT = "SC";
export const DEFAULT_STATION_LANE_COUNTS = Object.freeze({ SC: 2, IMPS: 2 });
export const DEFAULT_STATION_EQUIPMENT_COUNTS = Object.freeze({
  SC: Object.freeze({
    WIM_SENSOR: 8,
    WIM_LOOP: 4,
    CONTROL_COMPUTER: 1,
    CONTROL_CABINET: 1,
    // LPR control is a System record. The former control-box Asset remains
    // decodable for history but is no longer seeded for new stations.
    LPR_CONTROL_SYSTEM: 0,
    LPR_CAMERA: 3,
    FIXED_CAMERA: 3,
    PTZ_CAMERA: 1,
    NVR: 1,
    DATABASE_SERVER: 1,
    IMPS_DISPLAY_PROCESSING: 1,
    VMS_SIGN: 1,
    VMS_LIGHT_SENSOR: 1,
    VMS_DISPLAY: 1,
  }),
  IMPS: Object.freeze({
    WIM_SENSOR: 8,
    WIM_LOOP: 4,
    CONTROL_COMPUTER: 1,
    CONTROL_CABINET: 1,
    LPR_CONTROL_SYSTEM: 0,
    LPR_CAMERA: 3,
    FIXED_CAMERA: 3,
    PTZ_CAMERA: 1,
    NVR: 1,
    DATABASE_SERVER: 1,
    IMPS_DISPLAY_PROCESSING: 1,
    VMS_SIGN: 0,
    VMS_LIGHT_SENSOR: 0,
    VMS_DISPLAY: 0,
  }),
});
const CUSTOM_EQUIPMENT_TYPE = Object.freeze({ value: "CUSTOM", label: "อุปกรณ์กำหนดเอง (Custom)", prefix: "ITEM", groupCode: null });
const LEGACY_LANE_TYPE = Object.freeze({ value: "LANE", label: "ช่องจราจร (ข้อมูลเดิม)", prefix: "LANE", groupCode: null });
const UNKNOWN_EQUIPMENT_TYPE = Object.freeze({ value: "UNKNOWN", label: "อุปกรณ์ไม่ระบุประเภท", prefix: "ITEM", groupCode: null });
const ASSET_TYPE_TO_CATEGORY = Object.freeze({
  WIM_SENSOR: "2.1",
  WIM_LOOP: "2.1",
  CONTROL_COMPUTER: "2.2",
  CONTROL_CABINET: "2.3",
  WIM_AC_DC_POWER_SUPPLY: "2.3",
  WIM_NETWORK_EQUIPMENT: "2.3",
  WIM_CONTROLLER: "2.3",
  WIM_PHASE_PROTECTION: "2.3",
  WIM_SUB_BREAKER: "2.3",
  WIM_SWITCHING_DC: "2.3",
  WIM_TRANSFORMER_24VAC: "2.3",
  LPR_CONTROL_SYSTEM: "3.1",
  LPR_CAMERA: "3.2",
  FIXED_CAMERA: "4.1",
  PTZ_CAMERA: "4.1",
  JOYSTICK: "4.1",
  NVR: "4.2",
  DATABASE_SERVER: "5.1",
  IMPS_DISPLAY_PROCESSING: "5.2",
  VMS_SIGN: "7.1",
  VMS_LIGHT_SENSOR: "7.1",
  VMS_DISPLAY: "7.1",
  LASER_SCANNER: "1.1.5",
  DIMENSION_CONTROLLER: "1.1.5",
  IMAGE_PROCESSOR: "1.1.12",
  CABINET: "1.1.11",
});

const centralEquipmentDefinition = (value, overrides = {}) => {
  const centralName = getCentralEquipmentName(value);
  return {
    value,
    label: centralName?.nameTh || value,
    nameTh: centralName?.nameTh || value,
    nameEn: centralName?.nameEn || "",
    ...overrides,
  };
};

export const EQUIPMENT_TYPES = [
  centralEquipmentDefinition("WIM_SENSOR", { sourceLabel: "WIM SENSOR", prefix: "SENSOR", groupCode: "2.1", systemId: "wim", sourceRefs: ["2.1"] }),
  centralEquipmentDefinition("WIM_LOOP", { sourceLabel: "WIM LOOP", prefix: "LOOP", groupCode: "2.1", systemId: "wim", sourceRefs: ["2.1"] }),
  centralEquipmentDefinition("CONTROL_COMPUTER", { sourceLabel: "WIM Control Computer", prefix: "PC", groupCode: "2.2", systemId: "wim", sourceRefs: ["2.2"] }),
  centralEquipmentDefinition("CONTROL_CABINET", { sourceLabel: "WIM Electronics Cabinet", prefix: "CAB", groupCode: "2.3", systemId: "wim", sourceRefs: ["2.3"] }),
  centralEquipmentDefinition("LPR_CONTROL_SYSTEM", { sourceLabel: "ระบบควบคุมการอ่านป้ายทะเบียน", prefix: "LPR-SYS", groupCode: "3.1", systemId: "lpr", sourceRefs: ["3.1"], legacyOnly: true }),
  centralEquipmentDefinition("LPR_CAMERA", { sourceLabel: "LPR CAMERA", prefix: "LPR", groupCode: "3.2", systemId: "lpr", sourceRefs: ["3.2"] }),
  centralEquipmentDefinition("FIXED_CAMERA", { sourceLabel: "NETWORK FIXED CCTV CAMERA", prefix: "CCTV", groupCode: "4.1", systemId: "cctv", sourceRefs: ["4.1"] }),
  centralEquipmentDefinition("PTZ_CAMERA", { sourceLabel: "PTZ CAMERA", prefix: "PTZ", groupCode: "4.1", systemId: "cctv", sourceRefs: ["4.1"], optional: true }),
  centralEquipmentDefinition("JOYSTICK", { sourceLabel: "JOY STICK", prefix: "CCTV-JS", groupCode: "4.1", systemId: "cctv", sourceRefs: ["4.1"], optional: true }),
  centralEquipmentDefinition("NVR", { sourceLabel: "NETWORK VIDEO RECORDER", prefix: "NVR", groupCode: "4.2", systemId: "cctv", sourceRefs: ["4.2"] }),
  centralEquipmentDefinition("DATABASE_SERVER", { sourceLabel: "DATABASE MANAGEMENT AND REPORTING SYSTEM", prefix: "DB", groupCode: "5.1", systemId: "other", sourceRefs: ["5.1"] }),
  centralEquipmentDefinition("IMPS_DISPLAY_PROCESSING", { sourceLabel: "ระบบแสดงผลและระบบประมวลผลข้อมูล", prefix: "IMPS-DP", groupCode: "5.2", systemId: "other", sourceRefs: ["5.2"] }),
  centralEquipmentDefinition("LASER_SCANNER", { sourceLabel: "3D LASER SCANNER", prefix: "3D-LS", groupCode: "1.1.5", systemId: "3d", sourceRefs: ["1.1.5"] }),
  centralEquipmentDefinition("DIMENSION_CONTROLLER", { sourceLabel: "3D TRUCK DIMENSION CONTROLLER", prefix: "3D-CTRL", groupCode: "1.1.5", systemId: "3d", sourceRefs: ["1.1.5"] }),
  centralEquipmentDefinition("IMAGE_PROCESSOR", { sourceLabel: "IMAGE PROCESSOR", prefix: "IMPS-IP", groupCode: "1.1.12", systemId: "imps", sourceRefs: ["1"] }),
  centralEquipmentDefinition("VMS_SIGN", { sourceLabel: "VARIABLE MESSAGE SIGN", prefix: "VMS", groupCode: "7.1", systemId: "other", sourceRefs: ["7.1"], optional: true }),
  centralEquipmentDefinition("VMS_LIGHT_SENSOR", { sourceLabel: "VMS LIGHT SENSOR", prefix: "VMS-LS", groupCode: "7.1", systemId: "other", sourceRefs: ["7.1"], optional: true }),
  centralEquipmentDefinition("VMS_DISPLAY", { sourceLabel: "VMS DISPLAY", prefix: "VMS-D", groupCode: "7.1", systemId: "other", sourceRefs: ["7.1"], optional: true }),
  // Keep generic Station Infrastructure Cabinet readable in legacy data only.
  centralEquipmentDefinition("CABINET", { sourceLabel: "SYSTEM CABINET", prefix: "CAB", groupCode: "1.1.11", systemId: "other", sourceRefs: ["1.1.11"], legacyOnly: true }),
];

export const ALL_EQUIPMENT_TYPES = Object.freeze([
  ...EQUIPMENT_TYPES,
  ...WIM_ELECTRONICS_SUB_EQUIPMENT_TYPES,
]);

export function normalizeStationFormat(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return STATION_FORMATS.some((format) => format.value === normalized) ? normalized : DEFAULT_STATION_FORMAT;
}

export function getStationFormatDefinition(value) {
  return STATION_FORMATS.find((format) => format.value === normalizeStationFormat(value)) || STATION_FORMATS[0];
}

export function getDefaultStationEquipmentCounts(value) {
  return { ...(DEFAULT_STATION_EQUIPMENT_COUNTS[normalizeStationFormat(value)] || DEFAULT_STATION_EQUIPMENT_COUNTS[DEFAULT_STATION_FORMAT]) };
}

export function getDefaultStationLaneCount(value) {
  return Math.max(0, Number(DEFAULT_STATION_LANE_COUNTS[normalizeStationFormat(value)] || 0));
}

export const PRESENT_MA8_SYSTEM_SEEDS = Object.freeze([
  // This is a TOR/reference row only. Installed WIM systems are represented
  // by one canonical system record per physical WIM-enabled lane.
  { id: "present-wim-sorting", systemId: "wim", componentId: "sorting", displayLabel: "ระบบคัดแยกน้ำหนัก WIM", nameEn: "WIM Sorting System", sourceLabel: "WIM SORTING SYSTEM", sourceRefs: ["2.1"], quantity: 3, referenceUnit: "ระบบ", assetType: null, assetQuantity: 0 },
  { id: "present-wim-control", systemId: "wim", componentId: "control", displayLabel: "ระบบควบคุม WIM", nameEn: "WIM Control System", sourceLabel: "WIM CONTROL SYSTEM", sourceRefs: ["2.2"], quantity: 1, referenceUnit: "ระบบ", assetType: "CONTROL_COMPUTER", assetQuantity: 1 },
  { id: "present-wim-electronics", systemId: "wim", componentId: "electronics", displayLabel: "ระบบอิเล็กทรอนิกส์ WIM", nameEn: "WIM Electronics System", sourceLabel: "WIM ELECTRONICS SYSTEM", sourceRefs: ["2.3"], quantity: 1, referenceUnit: "ระบบ", assetType: "CONTROL_CABINET", assetQuantity: 1 },
  { id: "present-lpr-control", systemId: "lpr", componentId: "control", displayLabel: "ระบบควบคุมการอ่านป้ายทะเบียน", nameEn: "License Plate Recognition Control System", sourceLabel: "ระบบควบคุมการอ่านป้ายทะเบียน", sourceRefs: ["3.1"], quantity: 1, referenceUnit: "ระบบ", assetType: null, assetQuantity: 0 },
  { id: "present-lpr-camera", systemId: "lpr", componentId: "camera", displayLabel: "กล้องอ่านป้ายทะเบียน", nameEn: "LPR Camera", sourceLabel: "LPR CAMERA", sourceRefs: ["3.2"], quantity: 3, referenceUnit: "ชุด", assetType: "LPR_CAMERA", assetQuantity: 3 },
  { id: "present-cctv-camera", systemId: "cctv", componentId: "fixed-camera", displayLabel: "กล้องโทรทัศน์วงจรปิดแบบมุมคงที่", nameEn: "Fixed CCTV Camera", sourceLabel: "NETWORK FIXED CCTV CAMERA", sourceRefs: ["4.1"], quantity: 3, referenceUnit: "ชุด", assetType: "FIXED_CAMERA", assetQuantity: 3 },
  { id: "present-cctv-nvr", systemId: "cctv", componentId: "nvr", displayLabel: "เครื่องบันทึกภาพผ่านเครือข่าย", nameEn: "Network Video Recorder", sourceLabel: "NETWORK VIDEO RECORDER", sourceRefs: ["4.2"], quantity: 1, referenceUnit: "ชุด", assetType: "NVR", assetQuantity: 1 },
  { id: "present-other-database", systemId: "other", componentId: "database", displayLabel: "ระบบจัดการฐานข้อมูลและการจัดทำรายงาน", nameEn: "Database Management and Reporting System", sourceLabel: "DATABASE MANAGEMENT AND REPORTING SYSTEM", sourceRefs: ["5.1"], quantity: 1, referenceUnit: "ระบบ", assetType: "DATABASE_SERVER", assetQuantity: 1 },
  { id: "present-other-display", systemId: "other", componentId: "display-processing", displayLabel: "ระบบแสดงผลและประมวลผลข้อมูล", nameEn: "Display and Data Processing System", sourceLabel: "ระบบแสดงผลและระบบประมวลผลข้อมูล", sourceRefs: ["5.2"], quantity: 1, referenceUnit: "ระบบ", assetType: "IMPS_DISPLAY_PROCESSING", assetQuantity: 1 },
]);

const LEGACY_WIM_CONTROL_SEED = Object.freeze(PRESENT_MA8_SYSTEM_SEEDS.find((seed) => seed.id === "present-wim-control"));
const LEGACY_WIM_ELECTRONICS_SEED = Object.freeze(PRESENT_MA8_SYSTEM_SEEDS.find((seed) => seed.id === "present-wim-electronics"));

// Compatibility aliases used to seed physical rows for older profiles. The
// seed loop below de-duplicates them against the current System rows.
const CURRENT_WIM_PHYSICAL_ASSET_SEEDS = Object.freeze([
  LEGACY_WIM_CONTROL_SEED,
  LEGACY_WIM_ELECTRONICS_SEED,
]);

export const WIM_SORTING_SYSTEM_CANONICAL_ID = "wim-sorting";
export const WIM_SYSTEM_INSTANCE_MODEL_VERSION = "wim-system-instance-v1";

export function isWimSortingSystemRecord(system) {
  return String(system?.canonicalItemId || "") === WIM_SORTING_SYSTEM_CANONICAL_ID
    || String(system?.id || "") === WIM_SORTING_SYSTEM_CANONICAL_ID;
}

export function isWimSortingSystemInstance(system) {
  return isWimSortingSystemRecord(system)
    && system?.active !== false
    && Number(system?.quantity ?? 1) > 0
    && Boolean(String(system?.laneId || "").trim());
}

export function getWimSortingSystemInstances(systems = []) {
  return (Array.isArray(systems) ? systems : [])
    .filter((system) => isWimSortingSystemInstance(system));
}

export function getWimSortingInstalledQuantity(systems = []) {
  return getWimSortingSystemInstances(systems).length;
}

export function getWimSortingSystemById(systems = [], systemId) {
  const id = String(systemId || "").trim();
  if (!id) return null;
  return getWimSortingSystemInstances(systems).find((system) => String(system.id) === id) || null;
}

export function getWimSystemLaneId(equipment, systems = []) {
  if (!isWimEquipmentType(equipment?.type)) return null;
  return getWimSortingSystemById(systems, equipment?.parentSystemId)?.laneId || null;
}

function isWimEquipmentType(type) {
  return type === "WIM_SENSOR" || type === "WIM_LOOP";
}

const STATION_SYSTEM_SOURCE_LABELS = Object.freeze({
  SC: Object.freeze({
    "present-wim-sorting": "WIM SORTING SYSTEM FOR SPOT CHECK",
    "present-wim-control": "WIM CONTROL SYSTEM FOR SPOT CHECK",
    "present-wim-electronics": "WIM ELECTRONICS FOR SPOT CHECK",
  }),
  IMPS: Object.freeze({
    "present-wim-sorting": "WIM SORTING SYSTEM FOR ImPS",
    "present-wim-control": "WIM CONTROL SYSTEM FOR ImPS",
    "present-wim-electronics": "WIM ELECTRONICS FOR ImPS",
    "present-other-display": "ระบบแสดงผลและประมวลผลข้อมูลสำหรับ ImPS",
  }),
});

// Keep the old positional order only as a fallback for legacy station records
// that were saved without stable system ids. The old LPR Control row is kept
// only for compatibility and is canonicalized to present-lpr-control below.
const LEGACY_PRESENT_MA8_SYSTEM_SEEDS = Object.freeze([
  PRESENT_MA8_SYSTEM_SEEDS[0],
  LEGACY_WIM_CONTROL_SEED,
  LEGACY_WIM_ELECTRONICS_SEED,
  { id: "present-lpr-system", systemId: "lpr", componentId: "recognition", displayLabel: "ระบบควบคุมการอ่านป้ายทะเบียน (LPR)", sourceLabel: "ระบบควบคุมการอ่านป้ายทะเบียน", sourceRefs: ["3"], quantity: 3, assetType: null, assetQuantity: 0 },
  PRESENT_MA8_SYSTEM_SEEDS[4],
  PRESENT_MA8_SYSTEM_SEEDS[5],
  PRESENT_MA8_SYSTEM_SEEDS[6],
  PRESENT_MA8_SYSTEM_SEEDS[7],
  PRESENT_MA8_SYSTEM_SEEDS[8],
]);

// Older current-station records may have been saved without the deprecated
// LPR Control row. Keep their positional fallback separate from the legacy
// nine-row layout so the old camera row is never misclassified as control.
const PREVIOUS_PRESENT_MA8_SYSTEM_SEEDS = Object.freeze([
  PRESENT_MA8_SYSTEM_SEEDS[0],
  LEGACY_WIM_CONTROL_SEED,
  LEGACY_WIM_ELECTRONICS_SEED,
  PRESENT_MA8_SYSTEM_SEEDS[3],
  PRESENT_MA8_SYSTEM_SEEDS[4],
  PRESENT_MA8_SYSTEM_SEEDS[5],
  PRESENT_MA8_SYSTEM_SEEDS[6],
  PRESENT_MA8_SYSTEM_SEEDS[7],
  PRESENT_MA8_SYSTEM_SEEDS[8],
]);

const STATION_SYSTEM_SUMMARY_GROUPS = Object.freeze([
  { id: "wim", label: "ระบบชั่งน้ำหนักขณะรถเคลื่อนที่ (WIM)", nameEn: "Weigh-In-Motion System", sourceLabel: "WIM · กลุ่ม 2.1–2.3", sourceRefs: ["2"], icon: "equipment", defaultOpen: true, assetTypes: ["WIM_SENSOR", "WIM_LOOP", "CONTROL_COMPUTER", "CONTROL_CABINET"] },
  { id: "lpr", label: "กลุ่มระบบอ่านป้ายทะเบียน", nameEn: "License Plate Recognition System", sourceLabel: "LICENSE PLATE RECOGNITION SYSTEM · กลุ่ม 3.1–3.2", sourceRefs: ["3"], icon: "camera", defaultOpen: true, assetTypes: ["LPR_CAMERA"] },
  { id: "cctv", label: "ระบบกล้องวงจรปิด (CCTV)", nameEn: "CCTV System", sourceLabel: "CCTV · กลุ่ม 4.1–4.2", sourceRefs: ["4.1", "4.2"], icon: "camera", defaultOpen: true, assetTypes: ["FIXED_CAMERA", "PTZ_CAMERA", "NVR"] },
  { id: "database", label: "ระบบจัดการฐานข้อมูลและการจัดทำรายงาน", nameEn: "Database Management and Reporting System", sourceLabel: "DATABASE · กลุ่ม 5.1", sourceRefs: ["5.1"], icon: "archive", defaultOpen: false, assetTypes: ["DATABASE_SERVER"] },
  { id: "imps", label: "ระบบแสดงผลและประมวลผลข้อมูล", nameEn: "Display and Data Processing System", sourceLabel: "ImPS · กลุ่ม 5.2", sourceRefs: ["5.2"], icon: "archive", defaultOpen: false, assetTypes: ["IMPS_DISPLAY_PROCESSING"] },
  { id: "vms", label: "ป้ายข้อความเปลี่ยนแปลงได้", nameEn: "Variable Message Sign System", sourceLabel: "VMS · กลุ่ม 7.1", sourceRefs: ["7.1"], icon: "video", defaultOpen: true, assetTypes: ["VMS_SIGN", "VMS_LIGHT_SENSOR", "VMS_DISPLAY"] },
]);

const STATION_SYSTEM_SUMMARY_REFERENCE_BY_ASSET_TYPE = Object.freeze({
  LPR_CAMERA: "present-lpr-camera",
  FIXED_CAMERA: "present-cctv-camera",
  NVR: "present-cctv-nvr",
  DATABASE_SERVER: "present-other-database",
  IMPS_DISPLAY_PROCESSING: "present-other-display",
});
const SYSTEM_ITEM_REVISION = "system-item-v2";

export function isItemLibraryCategoryCode(categoryCode) {
  return ITEM_LIBRARY_CATEGORY_CODES.includes(String(categoryCode || ""));
}

export function isStationAssetCategoryCode(categoryCode) {
  return STATION_ASSET_CATEGORY_CODES.includes(String(categoryCode || ""));
}

export function systemCatalogItemId(type) {
  return `system.${String(type || "").toLowerCase()}`;
}

export function createSystemItemCatalog({ includeWimElectronics = false } = {}) {
  const definitions = includeWimElectronics ? ALL_EQUIPMENT_TYPES : EQUIPMENT_TYPES;
  return definitions
    .filter((definition) => !definition.legacyOnly && isStationAssetCategoryCode(definition.groupCode))
    .map((definition) => ({
      id: systemCatalogItemId(definition.value),
      kind: "system",
      label: definition.label,
      nameTh: definition.nameTh || definition.label,
      nameEn: definition.nameEn || "",
      displayLabel: definition.label,
      sourceLabel: definition.sourceLabel || definition.label,
      categoryCode: definition.groupCode,
      type: definition.value,
      prefix: definition.prefix,
      systemId: definition.systemId,
      sourceRefs: [...(definition.sourceRefs || [])],
      outputVoltageOptions: Array.isArray(definition.outputVoltageOptions) ? [...definition.outputVoltageOptions] : [],
      optional: definition.optional === true,
      active: true,
      revision: SYSTEM_ITEM_REVISION,
    }));
}

function normalizeCustomCatalogItem(item) {
  const label = String(item?.label || "").trim();
  const categoryCode = String(item?.categoryCode || "").trim();
  if (!label || !isStationAssetCategoryCode(categoryCode)) return null;
  return {
    id: String(item?.id || createId("catalog")),
    kind: "custom",
    label,
    nameTh: String(item?.nameTh || item?.displayLabel || label),
    nameEn: String(item?.nameEn || ""),
    displayLabel: String(item?.displayLabel || label),
    sourceLabel: String(item?.sourceLabel || label),
    categoryCode,
    type: "CUSTOM",
    prefix: String(item?.prefix || "ITEM").trim().toUpperCase() || "ITEM",
    systemId: String(item?.systemId || STATION_ASSET_CATEGORIES.find((category) => category.code === categoryCode)?.systemId || "other"),
    sourceRefs: Array.isArray(item?.sourceRefs) ? item.sourceRefs.map(String) : [],
    active: item?.active !== false,
    revision: String(item?.revision || `custom-${Date.now().toString(36)}`),
  };
}

export function normalizeItemCatalog(catalog, { includeWimElectronics = false } = {}) {
  const stored = Array.isArray(catalog) ? catalog : [];
  const storedSystem = new Map(
    stored
      .filter((item) => item?.kind === "system" || ALL_EQUIPMENT_TYPES.some((definition) => definition.value === item?.type))
      .map((item) => [String(item?.type || ""), item]),
  );
  const system = createSystemItemCatalog({ includeWimElectronics }).map((definition) => {
    const storedItem = storedSystem.get(definition.type);
    return {
      ...definition,
      id: definition.id,
      active: storedItem?.active !== false,
      revision: String(storedItem?.revision || definition.revision),
    };
  });
  const systemIds = new Set(system.map((item) => item.id));
  const seenCustomIds = new Set();
  const custom = stored
    .filter((item) => item?.kind === "custom")
    .map(normalizeCustomCatalogItem)
    .filter((item) => item && !systemIds.has(item.id) && !seenCustomIds.has(item.id))
    .map((item) => {
      seenCustomIds.add(item.id);
      return item;
    });
  return [...system, ...custom];
}

export function createCustomItemCatalog({ label, categoryCode, prefix = "ITEM" } = {}) {
  const normalizedLabel = String(label || "").trim();
  const normalizedCategory = String(categoryCode || "").trim();
  if (!normalizedLabel || !isStationAssetCategoryCode(normalizedCategory)) return null;
  return normalizeCustomCatalogItem({
    id: createId("catalog"),
    label: normalizedLabel,
    categoryCode: normalizedCategory,
    prefix,
    active: true,
    revision: `custom-${Date.now().toString(36)}`,
  });
}

export function getCatalogItem(catalog, catalogItemId) {
  return normalizeItemCatalog(catalog).find((item) => item.id === catalogItemId) || null;
}

export function getItemLibraryCategory(categoryCode) {
  return ITEM_LIBRARY_CATEGORIES.find((category) => category.code === categoryCode) || null;
}

export function canPlaceCatalogItemInCategory(catalogItem, categoryCode) {
  return Boolean(catalogItem && catalogItem.categoryCode === categoryCode && isStationAssetCategoryCode(categoryCode));
}

const formatMasterChecklistLabel = formatChecklistItemDisplayLabel;

function formatMasterChecklistSectionTitle(code, title) {
  const value = String(title || "").trim();
  const central = getCentralChecklistSectionName(code);
  const canonical = CHECKLIST_SECTION_TITLES[code] || formatCentralNameEnglishFirst(central);
  if (!value || value === central?.nameTh || value === central?.nameEn || value === canonical) return canonical || value;
  return value;
}

export const MASTER_CHECKLIST_SECTIONS = [
  ["1.1", "การแสดงความพร้อม", [["staff-count", "จำนวนพนักงานที่เข้าปฏิบัติงานจริง", "คน", "นับจำนวนพนักงานที่เข้าปฏิบัติงานจริง"], ["vehicle-count", "จำนวนยานพาหนะที่ใช้ปฏิบัติงาน", "คัน", "นับรถยนต์และรถบรรทุกติดตั้งเครนที่ใช้ปฏิบัติงาน"], ["tool-count", "จำนวนชุดเครื่องมือช่างที่นำมาใช้งาน", "ชุด", "ตรวจความพร้อมของเครื่องมือก่อนเริ่มงาน"]]],
  ["2.1", "WIM SORTING SYSTEM (SENSOR)", [["sensor-1", "ค่าที่วัดได้จากเซนเซอร์ชั่งน้ำหนัก WIM #1", "ค่า", "กรอกค่าที่วัดได้จากเซนเซอร์ชั่งน้ำหนัก WIM จริงและแนบภาพจุดวัด"], ["sensor-2", "ค่าที่วัดได้จากเซนเซอร์ชั่งน้ำหนัก WIM #2", "ค่า", "กรอกค่าที่วัดได้จากเซนเซอร์ชั่งน้ำหนัก WIM จริงและแนบภาพจุดวัด"], ["sensor-3", "ค่าที่วัดได้จากเซนเซอร์ชั่งน้ำหนัก WIM #3", "ค่า", "กรอกค่าที่วัดได้จากเซนเซอร์ชั่งน้ำหนัก WIM จริงและแนบภาพจุดวัด"], ["loop-1", "ค่าที่วัดได้จากลูปตรวจจับยานพาหนะ #1", "ค่า", "กรอกค่าที่วัดได้จากลูปตรวจจับยานพาหนะจริงและแนบภาพจุดวัด"], ["loop-2", "ค่าที่วัดได้จากลูปตรวจจับยานพาหนะ #2", "ค่า", "กรอกค่าที่วัดได้จากลูปตรวจจับยานพาหนะจริงและแนบภาพจุดวัด"]]],
  ["2.2", "WIM CONTROL SYSTEM FOR IMPS", [["control-computer", "จำนวนเครื่องคอมพิวเตอร์ควบคุม WIM", "เครื่อง", "ตรวจเครื่องควบคุม รุ่น และหมายเลขประจำเครื่อง"], ["control-network", "จำนวนจุดเชื่อมต่อเครือข่าย (LAN)", "จุด", "ตรวจการติดป้ายสาย LAN และการเชื่อมต่อ"], ["control-cleaning", "จำนวนจุดทำความสะอาดเครื่องควบคุม WIM", "จุด", "ตรวจสภาพภายนอกและความสะอาดของอุปกรณ์"]]],
  ["2.3", "WIM Electronics System for IMPS", [["electronic-cabinet", "จำนวนตู้ควบคุมไฟฟ้า WIM", "ตู้", "ตรวจภาพรวมภายในและภายนอกตู้ควบคุม"], ["main-current", "ค่ากระแสไฟฟ้าหลัก", "A", "กรอกค่าที่วัดได้จากจุดรับไฟหลัก"], ["switching-voltage", "ค่าแรงดันไฟฟ้าของ Switching DC", "V", "กรอกค่าที่วัดได้จากแหล่งจ่าย Switching DC"], ["transformer-voltage", "ค่าแรงดันไฟฟ้าของ Transformer AC 24V", "V", "กรอกค่าที่วัดได้จากจุดจ่าย Transformer AC 24V"]]],
  ["3.1", "ระบบควบคุมการอ่านป้ายทะเบียน", [["lpr-lane-count", "จำนวนช่องจราจรที่ตรวจ", "ช่อง", "ระบุจำนวนช่องจราจรที่มีอุปกรณ์และทดสอบช่วงกลางวัน"], ["lpr-lane-1", "ผลทดสอบการอ่านป้ายทะเบียนร่วมกับ WIM — ช่องจราจร 1", "ครั้ง", "ทดสอบช่วงกลางวันตามช่องจราจรที่มีอุปกรณ์"], ["lpr-lane-2", "ผลทดสอบการอ่านป้ายทะเบียนร่วมกับ WIM — ช่องจราจร 2", "ครั้ง", "ทดสอบช่วงกลางวันตามช่องจราจรที่มีอุปกรณ์"], ["lpr-lane-3", "ผลทดสอบการอ่านป้ายทะเบียนร่วมกับ WIM — ช่องจราจร 3", "ครั้ง", "ทดสอบช่วงกลางวันตามช่องจราจรที่มีอุปกรณ์"]]],
  ["3.2", "LPR Camera", [["lpr-camera-1", "ค่าแรงดันไฟฟ้าของกล้องอ่านป้ายทะเบียน #1", "V", "ตรวจรุ่น หมายเลขประจำเครื่อง การทำความสะอาด และค่าแรงดันไฟฟ้า"], ["lpr-camera-2", "ค่าแรงดันไฟฟ้าของกล้องอ่านป้ายทะเบียน #2", "V", "ตรวจรุ่น หมายเลขประจำเครื่อง การทำความสะอาด และค่าแรงดันไฟฟ้า"], ["lpr-camera-3", "ค่าแรงดันไฟฟ้าของกล้องอ่านป้ายทะเบียน #3", "V", "ตรวจรุ่น หมายเลขประจำเครื่อง การทำความสะอาด และค่าแรงดันไฟฟ้า"]]],
  ["4.1", "CCTV Camera", [["fixed-camera-1", "ค่าแรงดันไฟฟ้าของกล้อง CCTV แบบ Fixed #1", "V", "ตรวจภาพรวม การทำความสะอาด SD Card และค่าแรงดันไฟฟ้า"], ["fixed-camera-2", "ค่าแรงดันไฟฟ้าของกล้อง CCTV แบบ Fixed #2", "V", "ตรวจภาพรวม การทำความสะอาด SD Card และค่าแรงดันไฟฟ้า"], ["fixed-camera-3", "ค่าแรงดันไฟฟ้าของกล้อง CCTV แบบ Fixed #3", "V", "ตรวจภาพรวม การทำความสะอาด และค่าแรงดันไฟฟ้า"], ["ptz-camera-1", "ค่าแรงดันไฟฟ้าของกล้อง CCTV แบบ PTZ #1", "V", "ตรวจการติดตั้ง ความพร้อมใช้งาน และค่าแรงดันไฟฟ้า"]]],
  ["4.2", "Network Video Recorder (NVR)", [["nvr-count", "จำนวนเครื่องบันทึกภาพผ่านเครือข่าย", "เครื่อง", "ตรวจรุ่น หมายเลขประจำเครื่อง และสาย LAN"], ["nvr-hdd", "จำนวนฮาร์ดดิสก์ (HDD) ที่ใช้งาน", "ลูก", "ตรวจ HDD และสถานะการบันทึก"], ["nvr-retention", "ระยะเวลาที่เรียกดูภาพย้อนหลังได้", "วัน", "ทดสอบเรียกดูภาพย้อนหลังและระบุจำนวนวัน"]]],
  ["5.1", "Database Management and Reporting System", [["database-server", "จำนวนเครื่องแม่ข่ายฐานข้อมูล", "เครื่อง", "ตรวจอุปกรณ์ รุ่น และหมายเลขประจำเครื่อง"], ["database-network", "จำนวนจุดเชื่อมต่อระบบส่วนกลาง (LAN)", "จุด", "ตรวจการเชื่อมต่อและการติดป้ายสาย LAN"], ["database-cleaning", "จำนวนจุดทำความสะอาดเครื่องแม่ข่ายฐานข้อมูล", "จุด", "ตรวจสภาพและความสะอาดของเครื่องแม่ข่าย"]]],
  ["6.1", "Database Management and Reporting System (software)", [["software-report", "จำนวนรูปแบบรายงานที่ทดสอบ", "แบบ", "ตรวจการสร้างและพิมพ์รายงาน"], ["software-history", "ระยะเวลาย้อนหลังที่ค้นข้อมูลได้", "เดือน", "ตรวจหน้าค้นหาข้อมูลและระบุจำนวนเดือนย้อนหลัง"], ["software-vehicle-search", "จำนวนรายการค้นหาข้อมูลรถรายคันที่ทดสอบ", "รายการ", "ตรวจผลการค้นหารถและป้ายทะเบียนรายคัน"]]],
  ["6.2", "ทำความสะอาดห้องควบคุม", [["control-room-markers", "จำนวนอุปกรณ์ที่ติดป้ายชื่อและรหัส Asset", "ชิ้น", "ตรวจป้ายชื่อและรหัส Asset ของอุปกรณ์"], ["control-room-cleaning", "จำนวนจุดทำความสะอาดห้องควบคุม", "จุด", "ตรวจพื้นที่ห้องควบคุมและระบุจุดที่ทำความสะอาด"], ["control-room-cables", "จำนวนจุดจัดระเบียบสาย", "จุด", "ตรวจการจัดระเบียบสายและระบุจุดที่ดำเนินการ"]]],
  ["6.3", "ทำความสะอาดตู้ควบคุม", [["cabinet-count", "จำนวนตู้ควบคุมที่ตรวจ", "ตู้", "ตรวจและระบุรหัสตู้ควบคุมที่ตรวจ"], ["cabinet-inside", "จำนวนจุดทำความสะอาดภายในตู้ควบคุม", "จุด", "ตรวจอุปกรณ์ภายในตู้และระบุจุดที่ทำความสะอาด"], ["cabinet-around", "จำนวนจุดทำความสะอาดพื้นที่โดยรอบตู้ควบคุม", "จุด", "ตรวจพื้นที่โดยรอบตู้และระบุจุดที่ทำความสะอาด"]]],
  ["7.1", "Variable Message Sign (VMS)", [["vms-sign", "จำนวนป้ายข้อความเปลี่ยนแปลงได้", "ป้าย", "ตรวจภาพรวมและความพร้อมใช้งานของป้ายข้อความเปลี่ยนแปลงได้"], ["vms-light-sensor", "จำนวนเซนเซอร์วัดแสง VMS", "ตัว", "ตรวจการทำงานของเซนเซอร์วัดแสง VMS"], ["vms-display", "จำนวนจอแสดงผล VMS ที่ตรวจ", "จอ", "ตรวจการเรียงลำดับจอแสดงผลและการแสดงผล"]]],
].map(([code, title, items]) => ({
  code,
  title: formatMasterChecklistSectionTitle(code, title),
  items: items.map(([id, label, unit, helper]) => ({
    id,
    label: formatMasterChecklistLabel(label),
    unit,
    helper: formatMasterChecklistLabel(helper),
  })),
}));

const BASE_MASTER_CHECKLIST_SECTIONS = MASTER_CHECKLIST_SECTIONS.map((section) => ({
  ...section,
  items: section.items.map((item) => ({ ...item })),
}));

export function createMasterChecklistCopySnapshot() {
  return {
    revision: MASTER_CHECKLIST_COPY_REVISION,
    sections: BASE_MASTER_CHECKLIST_SECTIONS.map((section) => ({
      code: section.code,
      title: section.title,
      items: section.items.map((item) => ({ ...item })),
    })),
  };
}

export function normalizeMasterChecklistCopy(copy) {
  if (!copy || typeof copy !== "object" || !Array.isArray(copy.sections)) return null;
  const sectionsByCode = new Map(copy.sections.map((section) => [String(section?.code || ""), section]));
  return {
    revision: String(copy.revision || LEGACY_MASTER_CHECKLIST_COPY_REVISION),
    sections: BASE_MASTER_CHECKLIST_SECTIONS.map((section) => {
      const storedSection = sectionsByCode.get(section.code);
      const itemsById = new Map((Array.isArray(storedSection?.items) ? storedSection.items : []).map((item) => [String(item?.id || ""), item]));
      return {
        code: section.code,
        title: formatMasterChecklistSectionTitle(section.code, typeof storedSection?.title === "string" ? storedSection.title : section.title),
        items: section.items.map((item) => {
          const storedItem = itemsById.get(item.id);
          return {
            id: item.id,
            label: formatMasterChecklistLabel(typeof storedItem?.label === "string" ? storedItem.label : item.label),
            unit: typeof storedItem?.unit === "string" ? storedItem.unit : item.unit,
            helper: typeof storedItem?.helper === "string" ? storedItem.helper : item.helper,
          };
        }),
      };
    }),
  };
}

export function buildMasterChecklistSections(copy) {
  const normalized = normalizeMasterChecklistCopy(copy) || createMasterChecklistCopySnapshot();
  const sectionsByCode = new Map(normalized.sections.map((section) => [section.code, section]));
  return BASE_MASTER_CHECKLIST_SECTIONS.map((section) => {
    const storedSection = sectionsByCode.get(section.code);
    const itemsById = new Map((storedSection?.items || []).map((item) => [item.id, item]));
    return {
      ...section,
      title: formatMasterChecklistSectionTitle(section.code, storedSection?.title?.trim() || section.title),
      items: section.items.map((item) => {
        const storedItem = itemsById.get(item.id);
        return {
          ...item,
          label: formatMasterChecklistLabel(storedItem?.label?.trim() || item.label),
          unit: storedItem?.unit ?? item.unit,
          helper: storedItem?.helper?.trim() || item.helper,
        };
      }),
    };
  });
}

export function updateMasterChecklistCopy(copy, { sectionCode, itemId = null, field, value } = {}) {
  const current = normalizeMasterChecklistCopy(copy) || createMasterChecklistCopySnapshot();
  const nextValue = String(value ?? "");
  const allowedFields = new Set(["title", "label", "unit", "helper"]);
  if (!allowedFields.has(field)) return current;
  return {
    ...current,
    revision: `master-checklist-copy-local-${Date.now().toString(36)}`,
    sections: current.sections.map((section) => {
      if (section.code !== sectionCode) return section;
      if (!itemId) return field === "title" ? { ...section, title: nextValue } : section;
      return {
        ...section,
        items: section.items.map((item) => item.id === itemId ? { ...item, [field]: nextValue } : item),
      };
    }),
  };
}

export function getMasterChecklistCopyForSnapshot(snapshot) {
  const stored = normalizeMasterChecklistCopy(snapshot?.masterChecklistCopy);
  if (stored) return stored;
  const fallback = createMasterChecklistCopySnapshot();
  return snapshot?.id ? { ...fallback, revision: LEGACY_MASTER_CHECKLIST_COPY_REVISION } : fallback;
}

const REPEATABLE_FAMILIES = [
  { family: "WIM_SENSOR", equipmentType: "WIM_SENSOR", templateIds: ["sensor-1", "sensor-2", "sensor-3"], label: (index) => `WIM Sensor Reading · ค่าที่วัดได้จากเซนเซอร์ชั่งน้ำหนัก WIM #${index}`, emptyLabel: "WIM Sensor · เซนเซอร์ชั่งน้ำหนัก WIM" },
  { family: "WIM_LOOP", equipmentType: "WIM_LOOP", templateIds: ["loop-1", "loop-2"], label: (index) => `WIM Loop Reading · ค่าที่วัดได้จากลูปตรวจจับยานพาหนะ #${index}`, emptyLabel: "WIM Loop · ลูปตรวจจับยานพาหนะ" },
  { family: "LPR_CAMERA", equipmentType: "LPR_CAMERA", templateIds: ["lpr-camera-1", "lpr-camera-2", "lpr-camera-3"], label: (index) => `LPR Camera Voltage · ค่าแรงดันไฟฟ้าของกล้องอ่านป้ายทะเบียน #${index}`, emptyLabel: "LPR Camera · กล้องอ่านป้ายทะเบียน" },
  { family: "FIXED_CAMERA", equipmentType: "FIXED_CAMERA", templateIds: ["fixed-camera-1", "fixed-camera-2", "fixed-camera-3"], label: (index) => `Fixed CCTV Camera Voltage · ค่าแรงดันไฟฟ้าของกล้องโทรทัศน์วงจรปิดแบบมุมคงที่ #${index}`, emptyLabel: "Fixed CCTV Camera · กล้องโทรทัศน์วงจรปิดแบบมุมคงที่" },
  { family: "PTZ_CAMERA", equipmentType: "PTZ_CAMERA", templateIds: ["ptz-camera-1"], label: (index) => `PTZ CCTV Camera Voltage · ค่าแรงดันไฟฟ้าของกล้องโทรทัศน์วงจรปิดแบบปรับมุมมอง #${index}`, emptyLabel: "PTZ CCTV Camera · กล้องโทรทัศน์วงจรปิดแบบปรับมุมมอง" },
];

const QUANTITY_RULES = { "control-computer": "CONTROL_COMPUTER", "electronic-cabinet": "CONTROL_CABINET", "lpr-lane-count": "LANE", "nvr-count": "NVR", "database-server": "DATABASE_SERVER", "vms-sign": "VMS_SIGN", "vms-light-sensor": "VMS_LIGHT_SENSOR", "vms-display": "VMS_DISPLAY" };

export const defaultMeta = {
  projectName: "",
  inspectionDate: "",
  contractor: "",
  contractNo: "",
  inspector: "",
  documentNo: "",
  preparedBy: "",
  approvedBy: "",
  approvalDate: "",
};

export function normalizeChecklistConfig(config = {}) {
  const disabledTemplateIds = Array.isArray(config?.disabledTemplateIds)
    ? [...new Set(config.disabledTemplateIds.filter((templateId) => typeof templateId === "string" && templateId.trim()))]
    : [];
  const disabledItemIds = [...new Set((Array.isArray(config?.disabledItemIds) ? config.disabledItemIds : [])
    .filter((id) => typeof id === "string" && id.trim()))];
  return { disabledTemplateIds, disabledItemIds, legacyResolved: config?.legacyResolved === true };
}

export function setStationChecklistItemEnabled(snapshot, itemId, enabled) {
  const config = resolveStationChecklistConfig(snapshot);
  const disabled = new Set(config.disabledItemIds || []);
  if (enabled) disabled.delete(itemId); else disabled.add(itemId);
  return normalizeChecklistConfig({ ...config, disabledItemIds: [...disabled] });
}

export function normalizeAttachment(attachment) {
  if (!attachment || typeof attachment !== "object" || !String(attachment.id || "").trim()) return null;
  return {
    id: String(attachment.id),
    name: String(attachment.name || "ภาพแนบ"),
    type: String(attachment.type || "image/*"),
    size: Number.isFinite(Number(attachment.size)) ? Number(attachment.size) : 0,
    addedAt: attachment.addedAt || new Date().toISOString(),
  };
}

export function isChecklistItemDisabled(config, templateId) {
  return normalizeChecklistConfig(config).disabledTemplateIds.includes(templateId);
}

export function createId(prefix) { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`; }
export function getEquipmentType(type) {
  if (type === CUSTOM_EQUIPMENT_TYPE.value) return CUSTOM_EQUIPMENT_TYPE;
  if (type === LEGACY_LANE_TYPE.value) return LEGACY_LANE_TYPE;
  return ALL_EQUIPMENT_TYPES.find((entry) => entry.value === type) || UNKNOWN_EQUIPMENT_TYPE;
}

export function getEquipmentLabel(equipment) {
  const definition = getEquipmentType(equipment?.type);
  const centralName = getCentralEquipmentName(equipment?.type);
  if (centralName?.nameTh) return centralName.nameTh;
  return String(equipment?.catalogItemLabel || definition.label || equipment?.sourceLabel || "อุปกรณ์");
}

export function getEquipmentEnglishLabel(equipment) {
  const definition = getEquipmentType(equipment?.type);
  const centralName = getCentralEquipmentName(equipment?.type);
  return String(centralName?.nameEn || equipment?.catalogItemLabelEn || definition.nameEn || "").trim();
}

export function getEquipmentDisplayLabel(equipment) {
  const english = getEquipmentEnglishLabel(equipment);
  const thai = getEquipmentLabel(equipment);
  return [english, thai].filter(Boolean).join(" · ");
}

export function getStationSystemLabel(system) {
  const centralName = getCentralSystemNameForRecord(system);
  return String(centralName?.nameTh || system?.displayLabel || "ระบบส่วนควบอื่น ๆ").trim();
}

export function getStationSystemEnglishLabel(system) {
  const centralName = getCentralSystemNameForRecord(system);
  return String(centralName?.nameEn || system?.nameEn || system?.displayLabelEn || "").trim();
}

export function getStationSystemDisplayLabel(system) {
  const centralName = getCentralSystemNameForRecord(system);
  const english = getStationSystemEnglishLabel(system);
  const thai = getStationSystemLabel(system);
  return formatCentralNameEnglishFirst(centralName) || [english, thai].filter(Boolean).join(" · ");
}

export function getEquipmentCategoryCode(equipment) {
  const stored = String(equipment?.categoryCode || "").trim();
  if (isStationAssetCategoryCode(stored)) return stored;
  return ASSET_TYPE_TO_CATEGORY[equipment?.type] || null;
}

export function getEquipmentGroupsForRegister(equipment = [], { includeEmptyGroups = false, lanes = [] } = {}) {
  const equipmentList = Array.isArray(equipment) ? equipment : [];
  return STATION_ASSET_CATEGORIES.map((category) => {
    const systemTypes = ALL_EQUIPMENT_TYPES
      .filter((type) => !type.legacyOnly)
      .filter((type) => type.groupCode === category.code)
      .filter(Boolean)
      .map((type) => ({
        ...type,
        nameTh: type.label,
        label: formatCentralNameEnglishFirst(getCentralEquipmentName(type.value)) || [type.nameEn, type.label].filter(Boolean).join(" · "),
        displayLabel: formatCentralNameEnglishFirst(getCentralEquipmentName(type.value)) || [type.nameEn, type.label].filter(Boolean).join(" · "),
        items: sortEquipmentForDisplay(equipmentList.filter((entry) => entry?.type === type.value), lanes),
      }));
    const customTypes = [...new Set(equipmentList
      .filter((entry) => entry?.type === "CUSTOM" && getEquipmentCategoryCode(entry) === category.code)
      .map((entry) => entry.catalogItemId || entry.catalogItemLabel || entry.id))]
      .map((catalogItemId) => {
        const items = sortEquipmentForDisplay(equipmentList.filter((entry) => entry?.type === "CUSTOM"
          && getEquipmentCategoryCode(entry) === category.code
          && (entry.catalogItemId || entry.catalogItemLabel || entry.id) === catalogItemId), lanes);
        const first = items[0] || {};
        const nameTh = getEquipmentLabel(first);
        const nameEn = getEquipmentEnglishLabel(first);
        return {
          value: `CUSTOM:${catalogItemId}`,
          type: "CUSTOM",
          label: [nameEn, nameTh].filter(Boolean).join(" · "),
          nameTh,
          nameEn,
          displayLabel: [nameEn, nameTh].filter(Boolean).join(" · "),
          prefix: first.prefix || CUSTOM_EQUIPMENT_TYPE.prefix,
          groupCode: category.code,
          isCustom: true,
          items,
        };
      });
    const types = [...systemTypes, ...customTypes]
      .filter((type) => includeEmptyGroups || type.items.length > 0);
    return types.length ? { code: category.code, title: category.title, systemId: category.systemId, types } : null;
  }).filter(Boolean);
}

export function makeEquipment(type, index, overrides = {}) {
  const definition = getEquipmentType(type);
  const wimDefinition = getWimElectronicsSubEquipmentType(type);
  const serialNo = String(overrides.serialNo || "").trim();
  const hasLocationOverride = Object.prototype.hasOwnProperty.call(overrides, "location");
  const prefix = overrides.prefix || definition.prefix;
  const scope = String(overrides.scope || "").trim() || null;
  const suppliedAssetNo = String(overrides.assetNo || "").trim();
  return {
    id: overrides.id || createId(type.toLowerCase()),
    type,
    catalogItemId: overrides.catalogItemId || (type === "CUSTOM" || type === "LANE" || type === "UNKNOWN" ? "" : systemCatalogItemId(type)),
    catalogItemLabel: overrides.catalogItemLabel || getCentralEquipmentName(type)?.nameTh || definition.label,
    catalogItemLabelEn: overrides.catalogItemLabelEn || getCentralEquipmentName(type)?.nameEn || definition.nameEn || "",
    sourceLabel: overrides.sourceLabel || definition.sourceLabel || definition.label,
    categoryCode: overrides.categoryCode || ASSET_TYPE_TO_CATEGORY[type] || definition.groupCode || null,
    prefix,
    assetNo: suppliedAssetNo || formatAssetNo(prefix, index, scope),
    assetNoMode: overrides.assetNoMode || (suppliedAssetNo ? "manual" : "generated"),
    location: hasLocationOverride ? String(overrides.location || "") : `${definition.label} ${index}`,
    serialNo,
    serialStatus: overrides.serialStatus || (serialNo ? "present" : "unknown"),
    serialReason: String(overrides.serialReason || "").trim(),
    laneId: isWimEquipmentType(type) ? (overrides.laneId || null) : null,
    systemId: overrides.systemId || definition.systemId || null,
    parentSystemId: String(overrides.parentSystemId || "") || null,
    parentAssetId: String(overrides.parentAssetId || "") || null,
    wimElectronicsRole: String(overrides.wimElectronicsRole || wimDefinition?.role || "") || null,
    outputVoltages: wimDefinition?.value === "WIM_SWITCHING_DC"
      ? normalizeWimElectronicsOutputVoltages(overrides.outputVoltages)
      : [],
    sourceRefs: Array.isArray(overrides.sourceRefs) ? [...overrides.sourceRefs] : [...(definition.sourceRefs || [])],
    scope,
    recordKind: overrides.recordKind || (type === "LANE" ? "legacy-context" : "asset"),
    active: overrides.active !== false,
  };
}

export function makeEquipmentFromCatalogItem(catalogItem, index, overrides = {}) {
  if (!catalogItem || !isStationAssetCategoryCode(catalogItem.categoryCode)) return null;
  const hasLocationOverride = Object.prototype.hasOwnProperty.call(overrides, "location");
  return makeEquipment(catalogItem.kind === "custom" ? "CUSTOM" : catalogItem.type, index, {
    ...overrides,
    catalogItemId: catalogItem.id,
    catalogItemLabel: catalogItem.label,
    catalogItemLabelEn: catalogItem.nameEn || catalogItem.labelEn || "",
    categoryCode: catalogItem.categoryCode,
    prefix: catalogItem.prefix,
    systemId: catalogItem.systemId,
    parentAssetId: overrides.parentAssetId || catalogItem.parentAssetId,
    sourceLabel: catalogItem.sourceLabel,
    sourceRefs: catalogItem.sourceRefs,
    location: hasLocationOverride ? overrides.location : `${catalogItem.label} ${index}`,
  });
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const ASSET_NO_SCOPE_VERSION = "asset-no-scope-v1";

const ASSET_NO_SCOPE_CODES = Object.freeze({
  "high speed": "HS",
  "low speed": "LS",
  "3d": "3D",
  "image processing": "IMG",
  imps: "IMPS",
  central: "CTR",
  "station wide": "STN",
});

function normalizeAssetNoScope(scope) {
  return String(scope || "").trim().toLocaleLowerCase("en-US").replace(/[\s_-]+/g, " ");
}

export function getAssetNoScopeCode(scope) {
  return ASSET_NO_SCOPE_CODES[normalizeAssetNoScope(scope)] || "GEN";
}

export function formatAssetNo(prefix, index, scope = "") {
  const resolvedPrefix = String(prefix || "ITEM").trim().toUpperCase() || "ITEM";
  const resolvedIndex = Math.max(1, Number(index) || 1);
  return `${resolvedPrefix}-${getAssetNoScopeCode(scope)}-${String(resolvedIndex).padStart(2, "0")}`;
}

function isLegacyGeneratedAssetNo(assetNo, prefix) {
  const resolvedPrefix = String(prefix || "ITEM").trim().toUpperCase() || "ITEM";
  return new RegExp(`^${escapeRegExp(resolvedPrefix)}-(\\d+)$`, "i").test(String(assetNo || "").trim());
}

export function isLegacyGeneratedAssetNoValue(assetNo, prefix) {
  return isLegacyGeneratedAssetNo(assetNo, prefix);
}

function effectiveAssetScope(asset, equipment = [], stationSystems = []) {
  const parentSystem = (Array.isArray(stationSystems) ? stationSystems : [])
    .find((system) => system?.id === asset?.parentSystemId);
  if (parentSystem?.scope) return String(parentSystem.scope).trim();

  const parentAsset = (Array.isArray(equipment) ? equipment : [])
    .find((entry) => entry?.id === asset?.parentAssetId);
  if (parentAsset?.scope) return String(parentAsset.scope).trim();

  return String(asset?.scope || "").trim();
}

/** Update generated Asset Nos. when an Asset's effective Scope changes. */
export function synchronizeGeneratedAssetNos(equipment = [], stationSystems = []) {
  const result = (Array.isArray(equipment) ? equipment : []).map((entry) => ({ ...entry }));
  result.forEach((entry, index) => {
    if (entry.assetNoMode !== "generated") return;
    const prefix = String(entry.prefix || getEquipmentType(entry.type).prefix || "ITEM").trim().toUpperCase() || "ITEM";
    const scope = effectiveAssetScope(entry, result, stationSystems);
    const currentPattern = new RegExp(`^${escapeRegExp(prefix)}-${escapeRegExp(getAssetNoScopeCode(scope))}-\\d+$`, "i");
    if (currentPattern.test(String(entry.assetNo || "").trim())) return;
    const nextIndex = getNextEquipmentIndex(result, { type: entry.type, prefix, scope });
    result[index] = { ...entry, assetNo: formatAssetNo(prefix, nextIndex, scope) };
  });
  return result;
}

export function getNextEquipmentIndex(equipment = [], { type = "", prefix = "", scope = "" } = {}) {
  const definition = type ? getEquipmentType(type) : null;
  const resolvedPrefix = String(prefix || definition?.prefix || "ITEM").trim().toUpperCase() || "ITEM";
  const pattern = new RegExp(`^${escapeRegExp(resolvedPrefix)}-${escapeRegExp(getAssetNoScopeCode(scope))}-(\\d+)$`, "i");
  const indexes = (Array.isArray(equipment) ? equipment : [])
    .map((entry) => Number(String(entry?.assetNo || "").trim().match(pattern)?.[1] || 0))
    .filter((index) => Number.isFinite(index) && index > 0);
  return Math.max(0, ...indexes) + 1;
}

export function validateEquipmentDraft(draft = {}, existingEquipment = [], { excludeId = null } = {}) {
  const assetNo = String(draft?.assetNo || "").trim();
  const errors = {};
  if (!assetNo) errors.assetNo = "กรุณาระบุรหัสอุปกรณ์ (Asset No.)";
  else if ((Array.isArray(existingEquipment) ? existingEquipment : []).some((entry) => (
    entry?.id !== excludeId
    && String(entry?.assetNo || "").trim().toLowerCase() === assetNo.toLowerCase()
  ))) errors.assetNo = "รหัสอุปกรณ์ (Asset No.) ซ้ำกับรายการอื่นในสถานีนี้";
  return { valid: Object.keys(errors).length === 0, errors };
}

export function makeLane(index, overrides = {}) {
  const laneNo = Number(overrides.laneNo || overrides.number || index || 1);
  return {
    id: overrides.id || `lane-${laneNo}`,
    laneNo,
    label: String(overrides.label || `ช่องจราจร ${laneNo}`),
    scope: String(overrides.scope || "").trim(),
    direction: String(overrides.direction || ""),
    sourceRefs: Array.isArray(overrides.sourceRefs) ? [...overrides.sourceRefs] : ["3.1"],
    active: overrides.active !== false,
  };
}

export function normalizeLane(lane, index = 0) {
  const fallback = makeLane(index + 1);
  return makeLane(index + 1, {
    ...lane,
    id: lane?.id || fallback.id,
    laneNo: Number(lane?.laneNo || lane?.number || index + 1),
    label: lane?.label || fallback.label,
  });
}

export function createPresentStationSeed(stationFormat = DEFAULT_STATION_FORMAT) {
  const format = normalizeStationFormat(stationFormat);
  const sourceLabels = STATION_SYSTEM_SOURCE_LABELS[format] || {};
  const stationSystems = PRESENT_MA8_SYSTEM_SEEDS.map((seed) => ({
    ...seed,
    sourceLabel: sourceLabels[seed.id] || seed.sourceLabel,
    sourceRefs: [...seed.sourceRefs],
    active: true,
    recordKind: "system",
  }));
  const equipment = [];
  const seedCounts = new Map();
  [...CURRENT_WIM_PHYSICAL_ASSET_SEEDS, ...PRESENT_MA8_SYSTEM_SEEDS]
    .filter((seed, index, all) => all.findIndex((candidate) => candidate.id === seed.id) === index)
    .forEach((seed) => {
    if (!seed.assetType || !seed.assetQuantity) return;
    for (let index = 1; index <= seed.assetQuantity; index += 1) {
      const typeCount = (seedCounts.get(seed.assetType) || 0) + 1;
      seedCounts.set(seed.assetType, typeCount);
      equipment.push(makeEquipment(seed.assetType, typeCount, {
        id: `draft-${seed.assetType.toLowerCase()}-${typeCount}`,
        location: "ระบุตำแหน่ง",
        systemId: seed.systemId,
        sourceRefs: seed.sourceRefs,
        presentSystemId: seed.id,
      }));
    }
  });
  return { stationSystems, lanes: [], equipment };
}

export function createDefaultStationLanes(stationFormat = DEFAULT_STATION_FORMAT) {
  const laneCount = getDefaultStationLaneCount(stationFormat);
  return Array.from({ length: laneCount }, (_, index) => makeLane(index + 1, { id: `draft-lane-${index + 1}` }));
}

export function createDefaultStationEquipment(stationFormat = DEFAULT_STATION_FORMAT, lanes = createDefaultStationLanes(stationFormat)) {
  const format = normalizeStationFormat(stationFormat);
  const counts = getDefaultStationEquipmentCounts(format);
  const activeLanes = (Array.isArray(lanes) ? lanes : []).filter((lane) => lane?.active !== false);
  const seed = createPresentStationSeed(format);
  const presentSystemByType = new Map(seed.stationSystems.filter((system) => system.assetType).map((system) => [system.assetType, system]));

  return EQUIPMENT_TYPES.flatMap((definition) => {
    const count = Math.max(0, Number(counts[definition.value] || 0));
    const presentSystem = presentSystemByType.get(definition.value);
    return Array.from({ length: count }, (_, index) => makeEquipment(definition.value, index + 1, {
      id: `draft-${definition.value.toLowerCase()}-${index + 1}`,
      location: "",
      laneId: isWimEquipmentType(definition.value) && activeLanes.length
        ? activeLanes[index % activeLanes.length].id
        : null,
      systemId: definition.systemId,
      sourceRefs: definition.sourceRefs,
      presentSystemId: presentSystem?.id || null,
    }));
  });
}

export function createDefaultStationProfile() {
  const seed = createPresentStationSeed("SC");
  // The demo profile includes WIM Control/Electronics as System rows while
  // keeping their Computer/Cabinet records as physical Assets.
  const seededEquipment = createDefaultStationEquipment("SC", [1, 2, 3].map((lane) => makeLane(lane)))
    .filter((entry) => !isWimEquipmentType(entry.type));
  const wimSystemInstances = [1, 2].map((laneNo) => ({
    id: `wim-sorting-${laneNo}`,
    canonicalItemId: WIM_SORTING_SYSTEM_CANONICAL_ID,
    systemId: WIM_SORTING_SYSTEM_CANONICAL_ID,
    componentId: "sorting",
    displayLabel: "ระบบคัดแยกน้ำหนัก WIM",
    nameEn: "WIM Sorting System",
    sourceLabel: "WIM SORTING SYSTEM",
    sourceRefs: ["2.1"],
    quantity: 1,
    referenceUnit: "ระบบ",
    unit: "ระบบ",
    laneId: `lane-${laneNo}`,
    instanceNo: laneNo,
    scope: "High Speed",
    checklistMapping: ["2.1"],
    active: true,
    recordKind: "system",
  }));
  const seedEquipment = seededEquipment;
  const demoWimEquipment = [
    ...[1, 2, 3].map((index) => makeEquipment("WIM_SENSOR", index, {
      id: `sensor-${index}`,
      location: `จุด Sensor ${index}`,
      parentSystemId: index <= 2 ? "wim-sorting-1" : "wim-sorting-2",
      laneId: index <= 2 ? "lane-1" : "lane-2",
      systemId: "wim",
    })),
    ...[1, 2].map((index) => makeEquipment("WIM_LOOP", index, {
      id: `loop-${index}`,
      location: `จุด Loop ${index}`,
      parentSystemId: index === 1 ? "wim-sorting-1" : "wim-sorting-2",
      laneId: index === 1 ? "lane-1" : "lane-2",
      systemId: "wim",
    })),
  ];
  const equipment = [
    ...demoWimEquipment,
    ...seedEquipment,
  ];
  // Keep the Present MA row as a TOR reference, alongside the two installed
  // instance records used by the current station workflow.
  const stationSystems = seed.stationSystems.concat(wimSystemInstances, {
    id: "vms-control-default",
    canonicalItemId: "vms-control",
    systemId: "vms",
    componentId: "control",
    displayLabel: "ระบบควบคุมป้าย VMS",
    nameEn: "VMS Control System",
    sourceLabel: "VMS CONTROL SYSTEM",
    sourceRefs: ["7.1"],
    quantity: 1,
    referenceUnit: "ระบบ",
    unit: "ระบบ",
    scope: "Station-wide",
    active: true,
    recordKind: "system",
  });
  return { id: "station-demo", stationFormat: "SC", stationCode: "NKS-OUT", stationName: "สถานีตรวจสอบน้ำหนักนครชัยศรี (ขาออก) จ.นครปฐม", active: true, stationSystems, lanes: [1, 2, 3].map((lane) => makeLane(lane)), equipment, checklistConfig: normalizeChecklistConfig(), vehicleSearchConfig: createVehicleSearchConfig() };
}

export function normalizeEquipment(equipment, index = 0) {
  const knownDefinition = ALL_EQUIPMENT_TYPES.find((entry) => entry.value === equipment?.type)
    || (equipment?.type === LEGACY_LANE_TYPE.value ? LEGACY_LANE_TYPE : null);
  const custom = equipment?.type === "CUSTOM" && isStationAssetCategoryCode(equipment?.categoryCode);
  const type = knownDefinition?.value || (custom ? "CUSTOM" : "UNKNOWN");
  const definition = knownDefinition || getEquipmentType(type);
  const categoryCode = custom ? equipment.categoryCode : (equipment?.categoryCode || ASSET_TYPE_TO_CATEGORY[type] || definition.groupCode || null);
  const catalogItemLabel = type === "CUSTOM"
    ? String(equipment?.catalogItemLabel || definition.label || "อุปกรณ์").trim()
    : String(getCentralEquipmentName(type)?.nameTh || definition.label || equipment?.catalogItemLabel || "อุปกรณ์").trim();
  const catalogItemLabelEn = type === "CUSTOM"
    ? String(equipment?.catalogItemLabelEn || equipment?.nameEn || "").trim()
    : String(getCentralEquipmentName(type)?.nameEn || definition.nameEn || equipment?.catalogItemLabelEn || "").trim();
  const prefix = String(equipment?.prefix || definition.prefix || "ITEM").trim().toUpperCase() || "ITEM";
  const assetNo = String(equipment?.assetNo || formatAssetNo(prefix, index + 1, equipment?.scope));
  const assetNoMode = ["generated", "manual"].includes(equipment?.assetNoMode)
    ? equipment.assetNoMode
    : (!String(equipment?.assetNo || "").trim() || isLegacyGeneratedAssetNo(assetNo, prefix) ? "generated" : "manual");
  const serialNo = String(equipment?.serialNo || "").trim();
  const serialStatus = ["present", "not-available", "unknown"].includes(equipment?.serialStatus)
    ? equipment.serialStatus
    : (serialNo ? "present" : "unknown");
  return {
    id: equipment?.id || createId(type.toLowerCase()),
    type,
    catalogItemId: String(equipment?.catalogItemId || (type === "CUSTOM" || type === "LANE" || type === "UNKNOWN" ? "" : systemCatalogItemId(type))),
    catalogItemLabel,
    catalogItemLabelEn,
    sourceLabel: String(equipment?.sourceLabel || definition.sourceLabel || catalogItemLabel),
    categoryCode,
    prefix,
    assetNo,
    assetNoMode,
    location: String(equipment?.location || ""),
    serialNo,
    serialStatus: serialNo ? "present" : serialStatus,
    serialReason: String(equipment?.serialReason || "").trim(),
    laneId: isWimEquipmentType(type) ? String(equipment?.laneId || "") || null : null,
    systemId: String(equipment?.systemId || definition.systemId || "") || null,
    parentSystemId: String(equipment?.parentSystemId || "") || null,
    parentAssetId: String(equipment?.parentAssetId || "") || null,
    wimElectronicsRole: String(equipment?.wimElectronicsRole || getWimElectronicsSubEquipmentType(type)?.role || "") || null,
    outputVoltages: type === "WIM_SWITCHING_DC" ? normalizeWimElectronicsOutputVoltages(equipment?.outputVoltages) : [],
    sourceRefs: Array.isArray(equipment?.sourceRefs) ? equipment.sourceRefs.map(String) : [...(definition.sourceRefs || [])],
    scope: String(equipment?.scope || "").trim() || null,
    presentSystemId: String(equipment?.presentSystemId || "") || null,
    recordKind: String(equipment?.recordKind || (type === "LANE" ? "legacy-context" : "asset")),
    active: equipment?.active !== false,
  };
}
function normalizeStationSystem(system, index = 0, fallbackSeeds = LEGACY_PRESENT_MA8_SYSTEM_SEEDS) {
  const stableFallback = PRESENT_MA8_SYSTEM_SEEDS.find((entry) => entry.id === system?.id);
  const legacyStableFallback = LEGACY_PRESENT_MA8_SYSTEM_SEEDS.find((entry) => entry.id === system?.id);
  const fallback = stableFallback || legacyStableFallback || fallbackSeeds[index] || {};
  const canonicalItemId = String(system?.canonicalItemId || "");
  const isWimInstance = isWimSortingSystemRecord(system);
  return {
    id: String(system?.id || fallback.id || createId("system")),
    systemId: String(system?.systemId || fallback.systemId || "other"),
    componentId: String(system?.componentId || fallback.componentId || "custom"),
    displayLabel: String(system?.displayLabel || fallback.displayLabel || "ระบบส่วนควบอื่น ๆ"),
    nameEn: String(system?.nameEn || fallback.nameEn || getCentralSystemNameForRecord({ ...fallback, ...system })?.nameEn || "").trim(),
    sourceLabel: String(system?.sourceLabel || fallback.sourceLabel || system?.displayLabel || ""),
    sourceRefs: Array.isArray(system?.sourceRefs) ? system.sourceRefs.map(String) : [...(fallback.sourceRefs || [])],
    quantity: Math.max(0, Number(system?.quantity ?? fallback.quantity ?? 0)),
    referenceUnit: String(system?.referenceUnit || fallback.referenceUnit || "ระบบ"),
    assetType: canonicalItemId === WIM_SORTING_SYSTEM_CANONICAL_ID ? null : (system?.assetType || fallback.assetType || null),
    assetQuantity: canonicalItemId === WIM_SORTING_SYSTEM_CANONICAL_ID ? 0 : Math.max(0, Number(system?.assetQuantity ?? fallback.assetQuantity ?? 0)),
    recordKind: "system",
    active: system?.active !== false,
    canonicalItemId,
    laneId: isWimInstance ? String(system?.laneId || "") || null : null,
    instanceNo: isWimInstance ? Math.max(1, Number(system?.instanceNo || index + 1)) : null,
    scope: String(system?.scope || "Station-wide"),
    unit: String(system?.unit || system?.referenceUnit || fallback.referenceUnit || "ระบบ"),
    note: String(system?.note || ""),
    checklistMapping: Array.isArray(system?.checklistMapping) ? [...system.checklistMapping] : [],
  };
}

function normalizePresentStationSystems(systems = []) {
  const source = Array.isArray(systems) ? systems : [];
  const hasStableId = source.some((system) => String(system?.id || "").trim());
  const fallbackSeeds = !hasStableId && source.length === PREVIOUS_PRESENT_MA8_SYSTEM_SEEDS.length
    ? PREVIOUS_PRESENT_MA8_SYSTEM_SEEDS
    : LEGACY_PRESENT_MA8_SYSTEM_SEEDS;
  const normalized = source
    .map((system, index) => normalizeStationSystem(system, index, fallbackSeeds))
    .map((system) => system.id === "present-lpr-system"
      ? {
        ...system,
        id: "present-lpr-control",
        systemId: "lpr",
        componentId: "control",
        displayLabel: "ระบบควบคุมการอ่านป้ายทะเบียน",
        sourceLabel: "ระบบควบคุมการอ่านป้ายทะเบียน",
        sourceRefs: ["3.1"],
        assetType: null,
        assetQuantity: 0,
      }
      : system.id === "present-lpr-control"
        ? { ...system, assetType: null, assetQuantity: 0, referenceUnit: "ระบบ", unit: "ระบบ" }
        : system);
  const seen = new Set();
  const deduped = normalized.filter((system) => {
    if (seen.has(system.id)) return false;
    seen.add(system.id);
    return true;
  });
  if (source.some((system) => String(system?.canonicalItemId || "").trim())) return deduped;
  const missing = PRESENT_MA8_SYSTEM_SEEDS
    .filter((seed) => !seen.has(seed.id))
    .map((seed, index) => normalizeStationSystem({
      ...seed,
      sourceRefs: [...seed.sourceRefs],
      active: true,
      recordKind: "system",
    }, deduped.length + index, PRESENT_MA8_SYSTEM_SEEDS));
  return [...deduped, ...missing];
}

export function getStationSystemAssetCount(system, equipment = []) {
  if (isWimSortingSystemRecord(system)) {
    return (Array.isArray(equipment) ? equipment : [])
      .filter((entry) => entry?.active !== false
        && isWimEquipmentType(entry?.type)
        && String(entry?.parentSystemId || "") === String(system?.id || ""))
      .length;
  }
  const assetTypes = [...new Set([
    ...(Array.isArray(system?.assetTypes) ? system.assetTypes : []),
    system?.assetType,
  ].map((value) => String(value || "").trim()).filter(Boolean))];
  if (!assetTypes.length) return null;
  return (Array.isArray(equipment) ? equipment : [])
    .filter((entry) => entry?.active !== false && assetTypes.includes(entry?.type))
    .length;
}

export function buildStationSystemSummaryModel(systems = [], equipment = []) {
  const visibleSystems = normalizePresentStationSystems(systems)
    .filter((system) => system.active !== false && system.systemId !== "imps" && system.id !== "present-imps"
    );
  const systemsById = new Map(visibleSystems.map((system) => [system.id, system]));
  const consumedSystemIds = new Set();

  const groups = STATION_SYSTEM_SUMMARY_GROUPS.map((group) => {
    const children = group.assetTypes.map((assetType) => {
      const definition = EQUIPMENT_TYPES.find((entry) => entry.value === assetType) || {};
      const referenceId = STATION_SYSTEM_SUMMARY_REFERENCE_BY_ASSET_TYPE[assetType] || null;
      const reference = referenceId
        ? systemsById.get(referenceId)
          || visibleSystems.find((system) => system.assetType === assetType)
          || PRESENT_MA8_SYSTEM_SEEDS.find((seed) => seed.id === referenceId)
        : null;
      if (reference && visibleSystems.some((system) => system.id === reference.id)) consumedSystemIds.add(reference.id);
      const actualCount = getStationSystemAssetCount({ assetTypes: [assetType] }, equipment);
      return {
        id: `asset-${assetType.toLowerCase()}`,
        kind: "asset",
        label: getEquipmentLabel({ type: assetType }) || definition.label || assetType,
        nameEn: getEquipmentEnglishLabel({ type: assetType }),
        sourceLabel: definition.sourceLabel || assetType,
        sourceRefs: [...(definition.sourceRefs || [])],
        assetTypes: [assetType],
        actualCount,
        status: reference ? "mapped" : "additional",
        referenceId: reference?.id || null,
        presentQuantity: reference ? reference.quantity : null,
        referenceUnit: reference?.referenceUnit || null,
        referenceLabel: reference ? `TOR: ${reference.quantity} ${reference.referenceUnit || "ระบบ"}` : "ไม่มีรายการ TOR อ้างอิง",
      };
    });
    const presentChildren = children.filter((child) => child.presentQuantity !== null);
    const groupReferenceTotals = Object.entries(presentChildren.reduce((totals, child) => {
      const unit = child.referenceUnit || "ระบบ";
      totals[unit] = (totals[unit] || 0) + child.presentQuantity;
      return totals;
    }, {}));
    return {
      ...group,
      actualCount: children.reduce((total, child) => total + (child.actualCount || 0), 0),
      presentQuantity: presentChildren.reduce((total, child) => total + child.presentQuantity, 0),
      hasPresentReference: presentChildren.length > 0,
      referenceLabel: groupReferenceTotals.length
        ? `TOR: ${groupReferenceTotals.map(([unit, quantity]) => `${quantity} ${unit}`).join(" · ")}`
        : "ไม่มีรายการ TOR อ้างอิง",
      children,
    };
  });

  const systemOnly = visibleSystems
    .filter((system) => !consumedSystemIds.has(system.id) && !system.assetType)
    .map((system) => {
      const wimInstance = isWimSortingSystemInstance(system);
      const childAssets = wimInstance
        ? (Array.isArray(equipment) ? equipment : []).filter((entry) => entry?.active !== false && isWimEquipmentType(entry?.type) && entry.parentSystemId === system.id)
        : [];
      const laneLabel = wimInstance && system.laneId ? `Lane ${String(system.laneId).replace(/^.*?lane-/, "")}` : "";
      return {
        id: `system-only-${system.id}`,
        kind: "system",
        label: getStationSystemLabel(system),
        nameEn: getStationSystemEnglishLabel(system),
        sourceLabel: system.sourceLabel,
        sourceRefs: [...system.sourceRefs],
        assetTypes: [],
        actualCount: wimInstance ? 1 : null,
        installedQuantity: wimInstance ? 1 : null,
        childAssetCount: childAssets.length,
        childCounts: wimInstance ? {
          WIM_SENSOR: childAssets.filter((entry) => entry.type === "WIM_SENSOR").length,
          WIM_LOOP: childAssets.filter((entry) => entry.type === "WIM_LOOP").length,
        } : null,
        laneId: wimInstance ? system.laneId : null,
        instanceNo: wimInstance ? system.instanceNo : null,
        status: wimInstance ? "installed-system" : "system-only",
        referenceId: system.id,
        presentQuantity: wimInstance ? 1 : system.quantity,
        referenceUnit: system.referenceUnit,
        referenceLabel: wimInstance
          ? `ติดตั้งจริง · Instance #${system.instanceNo || "?"} · ${laneLabel || "ยังไม่ผูก Lane"} · Sensor ${childAssets.filter((entry) => entry.type === "WIM_SENSOR").length} · Loop ${childAssets.filter((entry) => entry.type === "WIM_LOOP").length}`
          : "ระบบจากเอกสาร · ไม่ใช่อุปกรณ์",
      };
    });

  const unmapped = visibleSystems
    .filter((system) => !consumedSystemIds.has(system.id))
    .filter((system) => Boolean(system.assetType))
    .map((system) => ({
      id: `unmapped-${system.id}`,
      kind: "system",
      label: getStationSystemLabel(system),
      nameEn: getStationSystemEnglishLabel(system),
      sourceLabel: system.sourceLabel,
      sourceRefs: [...system.sourceRefs],
      assetTypes: system.assetType ? [system.assetType] : [],
      actualCount: getStationSystemAssetCount(system, equipment),
      status: system.assetType ? "additional" : "unmapped",
      referenceId: system.id,
      presentQuantity: system.quantity,
      referenceUnit: system.referenceUnit,
      referenceLabel: `TOR: ${system.quantity} ${system.referenceUnit || "ระบบ"}`,
    }));

  return {
    groups,
    systemOnly,
    unmapped,
    visibleSystemCount: visibleSystems.length,
    mappedAssetTypeCount: groups.flatMap((group) => group.children).filter((child) => child.status === "mapped").length,
    activeAssetCount: getActivePhysicalEquipment(equipment).length,
    // Present MA totals remain a TOR reference summary. WIM Control and WIM
    // Electronics are now part of the visible current structure, so include
    // each visible System exactly once.
    referenceTotals: Object.entries(visibleSystems.reduce((totals, system) => {
      const unit = String(system.referenceUnit || "ระบบ");
      totals[unit] = (totals[unit] || 0) + Math.max(0, Number(system.quantity || 0));
      return totals;
    }, {})).map(([unit, quantity]) => ({ unit, quantity })),
  };
}

export function normalizeStationProfile(profile, index = 0) {
  const stationFormat = normalizeStationFormat(profile?.stationFormat);
  const normalized = {
    id: profile?.id || createId("station"),
    stationFormat,
    stationTemplateId: normalizeStationFormat(profile?.stationTemplateId || profile?.stationFormat),
    checklistPresentationVersion: profile?.checklistPresentationVersion || BOQ_CHECKLIST_PRESENTATION_VERSION,
    stationCode: String(profile?.stationCode || `STATION-${String(index + 1).padStart(2, "0")}`),
    stationName: String(profile?.stationName || `สถานีใหม่ ${index + 1}`),
    provinceId: String(profile?.provinceId || ""),
    province: String(profile?.province || ""),
    direction: ["inbound", "outbound", "both", "unspecified"].includes(profile?.direction) ? profile.direction : "unspecified",
    templateVersion: String(profile?.templateVersion || "") || null,
    active: profile?.active !== false,
    stationSystems: Array.isArray(profile?.stationSystems) && profile.stationSystems.length === 0 ? [] : normalizePresentStationSystems(profile?.stationSystems),
    lanes: Array.isArray(profile?.lanes) ? profile.lanes.map(normalizeLane).filter((lane) => lane.active !== false) : [],
    equipment: Array.isArray(profile?.equipment) ? profile.equipment.map(normalizeEquipment) : [],
    checklistConfig: normalizeChecklistConfig(profile?.checklistConfig),
    vehicleSearchConfig: createVehicleSearchConfig(profile?.vehicleSearchConfig),
    readinessConfirmedAt: profile?.readinessConfirmedAt || null,
  };
  normalized.equipment = synchronizeGeneratedAssetNos(normalized.equipment, normalized.stationSystems);
  normalized.checklistConfig = normalizeChecklistConfig(resolveStationChecklistConfig(normalized));
  return normalized;
}

export function createStationDraft(stationFormat = DEFAULT_STATION_FORMAT) {
  const format = normalizeStationFormat(stationFormat);
  return { stationFormat: format, stationTemplateId: format, checklistPresentationVersion: BOQ_CHECKLIST_PRESENTATION_VERSION, stationCode: "", stationName: "", provinceId: "", province: "", direction: "unspecified", templateVersion: STATION_DRAFT_TEMPLATE_VERSION, stationSystems: [], lanes: [], equipment: [], checklistConfig: normalizeChecklistConfig(), vehicleSearchConfig: createVehicleSearchConfig(), readinessConfirmedAt: null };
}

export function createEmptyStationDraft(stationFormat = DEFAULT_STATION_FORMAT) {
  return createStationDraft(stationFormat);
}

export function validateStationDraft(draft = {}, profiles = []) {
  const stationCode = String(draft?.stationCode || "").trim();
  const stationName = String(draft?.stationName || "").trim();
  const activeEquipment = (Array.isArray(draft?.equipment) ? draft.equipment : []).filter((equipment) => equipment?.active !== false);
  const activeLanes = (Array.isArray(draft?.lanes) ? draft.lanes : []).filter((lane) => lane?.active !== false);
  const activeSystems = (Array.isArray(draft?.stationSystems) ? draft.stationSystems : []).filter((system) => system?.active !== false && Number(system?.quantity ?? 0) > 0);
  const wimSystems = activeSystems.filter(isWimSortingSystemRecord);
  const wimSystemById = new Map(wimSystems.map((system) => [String(system.id), system]));
  const errors = { assetNoById: {}, serialById: {}, laneById: {}, wimSystemLaneById: {}, wimParentById: {} };

  wimSystems.forEach((system) => {
    const laneId = String(system?.laneId || "").trim();
    if (!laneId || !activeLanes.some((lane) => lane.id === laneId)) {
      errors.wimSystemLaneById[system.id] = activeLanes.length ? "กรุณาผูก WIM Sorting System กับเลนที่ติดตั้งจริง" : "กรุณาสร้างเลนก่อนผูก WIM Sorting System";
    }
  });
  const wimSystemLanes = new Map();
  wimSystems.forEach((system) => {
    const laneId = String(system?.laneId || "").trim();
    if (!laneId) return;
    wimSystemLanes.set(laneId, [...(wimSystemLanes.get(laneId) || []), system.id]);
  });
  const duplicateWimSystemLaneIds = [...wimSystemLanes.values()].filter((ids) => ids.length > 1).flat();

  if (!stationCode) errors.stationCode = "กรุณากรอกรหัสสถานี";
  else if (profiles.some((profile) => String(profile?.stationCode || "").trim().toLowerCase() === stationCode.toLowerCase())) errors.stationCode = "รหัสสถานีนี้มีอยู่แล้ว กรุณาใช้รหัสอื่น";
  if (!stationName) errors.stationName = "กรุณากรอกชื่อสถานี";
  else if (profiles.some((profile) => String(profile?.stationName || "").trim().toLocaleLowerCase("th-TH") === stationName.toLocaleLowerCase("th-TH"))) errors.stationName = "ชื่อสถานีนี้มีอยู่แล้ว กรุณาตรวจสอบชื่อหรือใช้ชื่อที่ชัดเจนขึ้น";
  if (!String(draft?.provinceId || draft?.province || "").trim()) errors.province = "กรุณาเลือกจังหวัด";
  if (!["inbound", "outbound", "both", "unspecified"].includes(draft?.direction)) errors.direction = "กรุณาเลือกทิศทางที่ถูกต้อง";

  const assetIdsByCode = new Map();
  activeEquipment.forEach((equipment) => {
    const assetNo = String(equipment?.assetNo || "").trim();
    if (!assetNo) {
      errors.assetNoById[equipment.id] = "กรุณาระบุรหัสอุปกรณ์ (Asset No.)";
      return;
    }
    const key = assetNo.toLowerCase();
    const duplicateIds = assetIdsByCode.get(key) || [];
    duplicateIds.push(equipment.id);
    assetIdsByCode.set(key, duplicateIds);
    const serialStatus = equipment?.serialStatus;
    const serialNo = String(equipment?.serialNo || "").trim();
    if (serialStatus === "present" && !serialNo) errors.serialById[equipment.id] = "เลือกว่ามี Serial Number แต่ยังไม่ได้กรอกค่า";
    // New stations may be created before field details are known. Keep the
    // unknown state as a visible follow-up warning; only an explicitly present
    // Serial Number without a value blocks station creation.
    if (isWimEquipmentType(equipment.type)) {
      const parentSystemId = String(equipment?.parentSystemId || "").trim();
      const parentSystem = wimSystemById.get(parentSystemId);
      if (!parentSystem) {
        errors.wimParentById[equipment.id] = "กรุณาเลือก WIM Sorting System ที่ติดตั้งจริงเป็นระบบแม่";
      } else if (!activeLanes.some((lane) => lane.id === parentSystem.laneId)) {
        errors.wimParentById[equipment.id] = "WIM Sorting System ที่เลือกยังไม่ผูกกับเลนที่ใช้งาน";
      }
      const laneId = String(equipment?.laneId || "").trim();
      if (laneId && !activeLanes.some((lane) => lane.id === laneId)) errors.laneById[equipment.id] = "เลนของอุปกรณ์ WIM ไม่อยู่ในโครงสร้างสถานี";
    }
  });
  assetIdsByCode.forEach((ids) => {
    if (ids.length > 1) ids.forEach((id) => { errors.assetNoById[id] = "รหัสอุปกรณ์ (Asset No.) ซ้ำกับรายการอื่นในสถานีนี้"; });
  });

  const laneNos = new Map();
  activeLanes.forEach((lane, index) => {
    const laneNo = Number(lane?.laneNo || lane?.number || index + 1);
    if (!Number.isInteger(laneNo) || laneNo < 1) return;
    const scope = getLaneScope(lane, wimSystems);
    const key = JSON.stringify([scope.toLocaleLowerCase("en-US"), laneNo]);
    laneNos.set(key, [...(laneNos.get(key) || []), lane?.id || `lane-${index + 1}`]);
  });
  const duplicateLaneIds = [...laneNos.values()].filter((ids) => ids.length > 1).flat();

  const warnings = [];
  if (!activeEquipment.length) warnings.push("ยังไม่มีอุปกรณ์ในทะเบียน สถานีนี้จะมีเฉพาะรายการตรวจระดับสถานีที่เกี่ยวข้อง");
  if (!activeLanes.length) warnings.push("ยังไม่ได้กำหนดช่องจราจร ระบบจะไม่สร้างรายการตรวจ Lane สำหรับสถานีนี้");
  if (activeEquipment.some((equipment) => equipment.type === "LANE")) warnings.push("พบข้อมูลช่องจราจรที่เก็บเป็นอุปกรณ์แบบเดิม ควรย้ายไปที่ lane topology");
  wimSystems.forEach((system) => {
    if (!activeEquipment.some((equipment) => isWimEquipmentType(equipment.type) && equipment.parentSystemId === system.id)) {
      warnings.push(`WIM Sorting System ${system.instanceNo || ""} ยังไม่มี Sensor หรือ Loop ผูกอยู่`);
    }
  });
  const incompleteDetails = activeEquipment.filter((equipment) => {
    const serialStatus = equipment?.serialStatus;
    const serialNo = String(equipment?.serialNo || "").trim();
    const serialIncomplete = !serialStatus || serialStatus === "unknown" || (serialStatus === "present" && !serialNo);
    return !String(equipment?.location || "").trim() || serialIncomplete;
  }).length;
  if (incompleteDetails) warnings.push(`มีอุปกรณ์ ${incompleteDetails} รายการที่ยังไม่มีตำแหน่งติดตั้งหรือ Serial Number ครบ`);

  const { assetNoById, serialById, laneById, wimSystemLaneById, wimParentById, ...stationErrors } = errors;
  const hasAssetErrors = Object.keys(assetNoById).length > 0;
  const hasSerialErrors = Object.keys(serialById).length > 0;
  const hasLaneErrors = Object.keys(laneById).length > 0;
  const hasWimSystemLaneErrors = Object.keys(wimSystemLaneById).length > 0;
  const hasWimParentErrors = Object.keys(wimParentById).length > 0;
  return { valid: !Object.keys(stationErrors).length && !hasAssetErrors && !hasSerialErrors && !hasLaneErrors && !hasWimSystemLaneErrors && !hasWimParentErrors && !duplicateLaneIds.length && !duplicateWimSystemLaneIds.length, errors: { ...stationErrors, assetNoById, serialById, laneById, wimSystemLaneById, wimParentById, duplicateLaneIds, duplicateWimSystemLaneIds }, warnings };
}

export function getStationReadiness(profile = {}) {
  const equipment = getActivePhysicalEquipment(profile.equipment || []);
  const systems = (profile.stationSystems || []).filter((entry) => entry?.active !== false && Number(entry?.quantity || 0) > 0);
  const lanes = (profile.lanes || []).filter((entry) => entry?.active !== false);
  const wimSystems = systems.filter(isWimSortingSystemRecord);
  const wimSystemById = new Map(wimSystems.map((system) => [String(system.id), system]));
  const blockers = [];
  const warnings = [];
  if (!equipment.length && !systems.length) blockers.push({ code: "EMPTY_REGISTER", message: "เพิ่ม Asset หรือ System อย่างน้อย 1 รายการ" });
  const assetNos = new Map();
  for (const asset of equipment) {
    const key = String(asset.assetNo || "").trim().toLowerCase();
    if (!key) blockers.push({ code: "ASSET_NO_REQUIRED", assetId: asset.id, message: "Asset ต้องมี Asset No." });
    else assetNos.set(key, [...(assetNos.get(key) || []), asset.id]);
    if (isWimEquipmentType(asset.type)) {
      const parentSystemId = String(asset.parentSystemId || "").trim();
      const parentSystem = wimSystemById.get(parentSystemId);
      if (!parentSystem) blockers.push({ code: "WIM_PARENT_SYSTEM_REQUIRED", assetId: asset.id, message: "WIM Sensor/Loop ต้องผูกกับ WIM Sorting System" });
      else if (!lanes.some((lane) => lane.id === parentSystem.laneId)) blockers.push({ code: "WIM_PARENT_SYSTEM_INVALID", assetId: asset.id, systemId: parentSystem.id, message: "WIM Sorting System แม่ยังไม่ผูกกับ Lane ที่ใช้งาน" });
      else if (asset.laneId && asset.laneId !== parentSystem.laneId) blockers.push({ code: "WIM_PARENT_LANE_MISMATCH", assetId: asset.id, systemId: parentSystem.id, message: "Lane ของอุปกรณ์ WIM ไม่ตรงกับ Lane ของระบบแม่" });
    }
    const electronicsHierarchyIssue = getWimElectronicsHierarchyIssue(asset, equipment, systems);
    if (electronicsHierarchyIssue) blockers.push({ ...electronicsHierarchyIssue, assetId: asset.id });
    if (asset.type === "WIM_SWITCHING_DC" && (!Array.isArray(asset.outputVoltages) || asset.outputVoltages.length === 0)) blockers.push({ code: "WIM_SWITCHING_DC_OUTPUT_REQUIRED", assetId: asset.id, message: "Switching DC ต้องเลือก Output 12VDC, 24VDC หรือ 48VDC อย่างน้อย 1 รายการ" });
    const missingFields = [];
    if (!String(asset.location || "").trim()) missingFields.push("ตำแหน่งติดตั้ง");
    if (!asset.serialStatus || asset.serialStatus === "unknown") missingFields.push("สถานะ Serial");
    if (missingFields.length) warnings.push({ code: "ASSET_DETAILS_INCOMPLETE", assetId: asset.id, missingFields, message: "ตำแหน่งหรือ Serial ยังไม่ครบ" });
  }
  const wimSystemLanes = new Map();
  for (const system of wimSystems) {
    if (!lanes.some((lane) => lane.id === system.laneId)) blockers.push({ code: "WIM_SYSTEM_LANE_REQUIRED", systemId: system.id, message: "WIM Sorting System ต้องผูกกับ Lane ที่ติดตั้งจริง" });
    const laneId = String(system.laneId || "").trim();
    if (laneId) wimSystemLanes.set(laneId, [...(wimSystemLanes.get(laneId) || []), system.id]);
    if (!equipment.some((asset) => isWimEquipmentType(asset.type) && asset.parentSystemId === system.id)) warnings.push({ code: "WIM_SYSTEM_NO_CHILD_ASSETS", systemId: system.id, message: `WIM Sorting System ${system.instanceNo || ""} ยังไม่มี Sensor หรือ Loop` });
  }
  for (const ids of wimSystemLanes.values()) if (ids.length > 1) blockers.push({ code: "WIM_SYSTEM_LANE_DUPLICATE", systemIds: ids, message: "ห้ามผูก WIM Sorting System มากกว่า 1 ระบบกับ Lane เดียวกัน" });
  assetNos.forEach((ids) => { if (ids.length > 1) blockers.push({ code: "DUPLICATE_ASSET_NO", assetIds: ids, message: "Asset No. ซ้ำ" }); });
  for (const system of systems) if (!Array.isArray(system.checklistMapping) && !system.systemId) blockers.push({ code: "CHECKLIST_MAPPING_REQUIRED", systemId: system.id, message: "System ไม่มี Checklist mapping" });
  return { ready: blockers.length === 0, blockers, warnings };
}

export function createStationProfileFromDraft(draft = {}, index = 0) {
  const equipment = (Array.isArray(draft?.equipment) ? draft.equipment : []).map((entry) => ({
    ...entry,
    assetNo: String(entry?.assetNo || "").trim(),
    location: String(entry?.location || "").trim(),
    serialNo: String(entry?.serialNo || "").trim(),
    active: entry?.active !== false,
  }));
  return normalizeStationProfile({
    ...draft,
    id: createId("station"),
    stationFormat: normalizeStationFormat(draft?.stationFormat),
    stationTemplateId: normalizeStationFormat(draft?.stationTemplateId || draft?.stationFormat),
    stationCode: String(draft?.stationCode || "").trim(),
    stationName: String(draft?.stationName || "").trim(),
    templateVersion: draft?.templateVersion || STATION_DRAFT_TEMPLATE_VERSION,
    stationSystems: Array.isArray(draft?.stationSystems) ? draft.stationSystems : [],
    lanes: Array.isArray(draft?.lanes) ? draft.lanes : [],
    equipment,
    checklistConfig: normalizeChecklistConfig(draft?.checklistConfig),
  }, index);
}

function applyVehicleApiReviewCopy(copy) {
  const labels = Object.freeze({
    plate: {
      label: "Database Management and Reporting System · ตรวจผลอ่านป้ายทะเบียนจาก API",
      helper: "เลือกช่วงเวลา ดึงข้อมูลจากสถานี แล้วตรวจผลป้ายทะเบียนรายคันจากภาพ Crop",
    },
    classification: {
      label: "Database Management and Reporting System · ตรวจผลคัดแยกประเภทรถจาก API",
      helper: "เลือกช่วงเวลา ดึงข้อมูลจากสถานี แล้วตรวจประเภท เพลา และ GVW รายคันจากภาพรถ",
    },
  });
  return {
    ...copy,
    sections: copy.sections.map((section) => ({
      ...section,
      items: section.items.map((item) => {
        const context = item.vehicleReviewContext;
        const next = labels[context];
        if (!next) return item;
        const evidenceSlots = item.evidenceSlots.map((slot) => ({ ...slot, displayLabel: next.label }));
        return { ...item, label: next.label, helper: next.helper, evidenceSlots };
      }),
    })),
  };
}

export function createSnapshot(profile, { checklistCopy, masterChecklistCopy } = {}) {
  const migratedChecklistCopy = migrateChecklistCopyForCurrentTemplate(checklistCopy);
  const apiChecklistCopy = applyVehicleApiReviewCopy(migratedChecklistCopy);
  const currentChecklistCopy = /^checklist-copy-local-/.test(String(checklistCopy?.revision || ""))
    ? { ...apiChecklistCopy, revision: checklistCopy.revision }
    : apiChecklistCopy;
  const currentMasterChecklistCopy = normalizeMasterChecklistCopy(masterChecklistCopy) || createMasterChecklistCopySnapshot();
  const templateVersion = profile?.templateVersion || MASTER_TEMPLATE_VERSION;
  const snapshotLanes = Array.isArray(profile.lanes) ? profile.lanes.map(normalizeLane).filter((lane) => lane.active !== false) : [];
  const snapshotEquipment = sortEquipmentForDisplay(
    profile.equipment.filter((equipment) => equipment.active !== false),
    snapshotLanes,
  ).map((equipment, index) => {
    const normalized = normalizeEquipment(equipment, index);
    const canonicalCategoryCode = getCanonicalEquipmentCategoryCode({ type: normalized.type, categoryCode: normalized.categoryCode });
    return canonicalCategoryCode ? { ...normalized, categoryCode: canonicalCategoryCode } : normalized;
  });
  const snapshotSystems = Array.isArray(profile.stationSystems) ? profile.stationSystems.map(normalizeStationSystem) : [];
  const snapshotSystemById = new Map(snapshotSystems.filter(isWimSortingSystemRecord).map((system) => [system.id, system]));
  const snapshot = { id: createId("snapshot"), stationFormat: normalizeStationFormat(profile?.stationFormat), stationTemplateId: normalizeStationFormat(profile?.stationTemplateId || profile?.stationFormat), templateVersion, cleaningPolicyVersion: CLEANING_POLICY_VERSION, orderingVersion: EQUIPMENT_ORDER_VERSION, vehicleReviewVersion: VEHICLE_API_REVIEW_VERSION, vehicleReviewScopeVersion: VEHICLE_REVIEW_SCOPE_VERSION, copyRevision: currentChecklistCopy.revision, checklistCopy: currentChecklistCopy, masterCopyRevision: currentMasterChecklistCopy.revision, masterChecklistCopy: currentMasterChecklistCopy, createdAt: new Date().toISOString(), stationId: profile.id, stationCode: profile.stationCode, stationName: profile.stationName, province: profile.province || "", direction: profile.direction || "unspecified", stationSystems: snapshotSystems, lanes: snapshotLanes, equipment: snapshotEquipment.map((equipment) => {
    const parentSystem = snapshotSystemById.get(equipment.parentSystemId);
    return parentSystem ? { ...equipment, laneId: parentSystem.laneId } : equipment;
  }), checklistConfig: normalizeChecklistConfig(profile.checklistConfig), vehicleSearchConfig: createVehicleSearchConfig(profile?.vehicleSearchConfig, "") };
  snapshot.checklistPolicyVersion = CHECKLIST_POLICY_VERSION;
  snapshot.wimSortingEvidenceVersion = WIM_SORTING_EVIDENCE_VERSION;
  snapshot.assetChecklistRecipeVersion = DEDICATED_ASSET_CHECKLIST_RECIPE_VERSION;
  snapshot.checklistPresentationVersion = BOQ_CHECKLIST_PRESENTATION_VERSION;
  snapshot.equipment = getActivePhysicalEquipment(snapshot.equipment);
  snapshot.checklistConfig = normalizeChecklistConfig(resolveStationChecklistConfig(snapshot));
  // A station's old template version must not select the legacy renderer for a new round.
  snapshot.templateVersion = STATION_DRAFT_TEMPLATE_VERSION;
  return { ...snapshot, evidenceCatalog: getEvidenceCatalogForSnapshot(snapshot) };
}
export function normalizeSnapshot(snapshot, fallbackProfile) {
  if (!snapshot || typeof snapshot !== "object") return createSnapshot(fallbackProfile);
  const templateVersion = snapshot.templateVersion || fallbackProfile?.templateVersion || MASTER_TEMPLATE_VERSION;
  const masterChecklistCopy = getMasterChecklistCopyForSnapshot(snapshot);
  const normalizedFormat = normalizeStationFormat(snapshot.stationFormat || fallbackProfile?.stationFormat);
  const normalized = { id: snapshot.id || createId("snapshot"), stationFormat: normalizedFormat, stationTemplateId: normalizeStationFormat(snapshot.stationTemplateId || fallbackProfile?.stationTemplateId || normalizedFormat), templateVersion, cleaningPolicyVersion: snapshot.cleaningPolicyVersion || null, orderingVersion: snapshot.orderingVersion || null, vehicleReviewVersion: snapshot.vehicleReviewVersion || null, vehicleReviewScopeVersion: snapshot.vehicleReviewScopeVersion || null, createdAt: snapshot.createdAt || new Date().toISOString(), stationId: snapshot.stationId || fallbackProfile.id, stationCode: String(snapshot.stationCode || fallbackProfile.stationCode), stationName: String(snapshot.stationName || fallbackProfile.stationName), province: String(snapshot.province || fallbackProfile?.province || ""), direction: snapshot.direction || fallbackProfile?.direction || "unspecified", stationSystems: Array.isArray(snapshot.stationSystems) ? snapshot.stationSystems.map(normalizeStationSystem) : [], lanes: Array.isArray(snapshot.lanes) ? snapshot.lanes.map(normalizeLane).filter((lane) => lane.active !== false) : [], equipment: Array.isArray(snapshot.equipment) ? snapshot.equipment.map(normalizeEquipment).filter((equipment) => equipment.active !== false) : [], checklistConfig: normalizeChecklistConfig(snapshot.checklistConfig), vehicleSearchConfig: createVehicleSearchConfig(snapshot.vehicleSearchConfig, ""), masterCopyRevision: masterChecklistCopy.revision, masterChecklistCopy, ...(snapshot.contractId ? { contractId: snapshot.contractId } : {}), ...(snapshot.workPackageId ? { workPackageId: snapshot.workPackageId } : {}), ...(snapshot.contractContext && typeof snapshot.contractContext === "object" ? { contractContext: snapshot.contractContext } : {}) };
  if (Object.hasOwn(snapshot, "torItems")) normalized.torItems = snapshot.torItems;
  if (snapshot.checklistPresentationVersion) normalized.checklistPresentationVersion = snapshot.checklistPresentationVersion;
  if (snapshot.checklistPolicyVersion) normalized.checklistPolicyVersion = snapshot.checklistPolicyVersion;
  if (snapshot.wimSortingEvidenceVersion) normalized.wimSortingEvidenceVersion = String(snapshot.wimSortingEvidenceVersion);
  if (snapshot.assetChecklistRecipeVersion) normalized.assetChecklistRecipeVersion = String(snapshot.assetChecklistRecipeVersion);
  if (!snapshot.checklistPolicyVersion) normalized.checklistConfig = { disabledTemplateIds: normalized.checklistConfig.disabledTemplateIds };
  if (!isEvidenceTemplateVersion(templateVersion)) return normalized;
  const withCatalog = {
    ...normalized,
    evidenceCatalog: templateVersion === LEGACY_EVIDENCE_TEMPLATE_VERSION && Array.isArray(snapshot.evidenceCatalog)
      ? snapshot.evidenceCatalog.map((slot) => ({ ...slot }))
      : normalized.cleaningPolicyVersion === CLEANING_POLICY_VERSION
      && isCurrentEvidenceTemplateVersion(templateVersion)
      ? getEvidenceCatalogForSnapshot(normalized)
      : (Array.isArray(snapshot.evidenceCatalog) && snapshot.evidenceCatalog.length
        ? snapshot.evidenceCatalog.map((slot) => ({ ...slot }))
        : getEvidenceCatalogForSnapshot(normalized)),
  };
  const checklistCopy = getChecklistCopyForSnapshot({ ...withCatalog, checklistCopy: snapshot.checklistCopy });
  return { ...withCatalog, copyRevision: checklistCopy.revision, checklistCopy };
}

export function buildInspectionSections(snapshot, templateVersion = snapshot?.templateVersion) {
  if (isEvidenceTemplateVersion(templateVersion)) {
    const evidenceSnapshot = snapshot?.templateVersion === templateVersion
      ? snapshot
      : { ...(snapshot || {}), templateVersion };
    return getEvidenceSectionsForSnapshot(evidenceSnapshot);
  }
  const equipment = snapshot?.equipment || [];
  const checklistConfig = normalizeChecklistConfig(snapshot?.checklistConfig);
  return buildMasterChecklistSections(getMasterChecklistCopyForSnapshot(snapshot)).map((section) => {
    const items = [];
    const processed = new Set();
    section.items.forEach((templateItem) => {
      const repeatable = REPEATABLE_FAMILIES.find((family) => family.templateIds.includes(templateItem.id));
      if (repeatable) {
        if (processed.has(repeatable.family)) return;
        processed.add(repeatable.family);
        const assets = equipment.filter((entry) => entry.type === repeatable.equipmentType && entry.active !== false);
        if (!assets.length) { const templateId = repeatable.templateIds[0]; items.push({ ...templateItem, id: `${repeatable.family.toLowerCase()}-not-applicable`, templateId, label: `${repeatable.emptyLabel} — ไม่มีอุปกรณ์ในสถานี`, helper: "รายการนี้ไม่รวมในความคืบหน้า", equipmentType: repeatable.equipmentType, assetId: null, assetNo: "", location: "", applicable: false, checklistDisabled: isChecklistItemDisabled(checklistConfig, templateId) }); return; }
        assets.forEach((asset, index) => {
          const templateId = repeatable.templateIds[Math.min(index, repeatable.templateIds.length - 1)];
          const checklistDisabled = isChecklistItemDisabled(checklistConfig, templateId);
          items.push({ ...templateItem, id: `${repeatable.family.toLowerCase()}-${asset.id}`, templateId, label: repeatable.label(index + 1), helper: checklistDisabled ? "ปิดใช้งานสำหรับสถานีนี้ · ไม่รวมในความคืบหน้า" : (asset.location ? `${templateItem.helper} · ${asset.location}` : templateItem.helper), equipmentType: repeatable.equipmentType, assetId: asset.id, assetNo: asset.assetNo, location: asset.location, serialNo: asset.serialNo, applicable: !checklistDisabled, checklistDisabled });
        });
        return;
      }
      const quantityFor = QUANTITY_RULES[templateItem.id];
      const count = quantityFor === "LANE"
        ? ((Array.isArray(snapshot?.lanes) ? snapshot.lanes : []).filter((lane) => lane?.active !== false).length
          || equipment.filter((entry) => entry.type === quantityFor && entry.active !== false).length)
        : (quantityFor ? equipment.filter((entry) => entry.type === quantityFor && entry.active !== false).length : null);
      const checklistDisabled = isChecklistItemDisabled(checklistConfig, templateItem.id);
      const applicable = !checklistDisabled && (quantityFor ? count > 0 : true);
      items.push({ ...templateItem, templateId: templateItem.id, quantityFor, configuredCount: count, applicable, checklistDisabled, helper: checklistDisabled ? "ปิดใช้งานสำหรับสถานีนี้ · ไม่รวมในความคืบหน้า" : (quantityFor ? `${templateItem.helper} · ${count > 0 ? `ตั้งค่าในสถานี ${count} รายการ` : "ไม่มีอุปกรณ์ประเภทนี้ในสถานี"}` : templateItem.helper) });
    });
    return { ...section, items };
  });
}

export function getItemsForSnapshot(snapshot, templateVersion = snapshot?.templateVersion) { return buildInspectionSections(snapshot, templateVersion).flatMap((section) => section.items); }
export function getChecklistCoverageSummary(snapshot, items = getItemsForSnapshot(snapshot)) {
  const equipment = getActivePhysicalEquipment(snapshot?.equipment);
  const applicableItems = (Array.isArray(items) ? items : []).filter((item) => item?.applicable !== false);
  const equipmentItems = applicableItems.filter((item) => item?.assetId);
  const equipmentIds = new Set(equipment.map((asset) => asset.id));
  const coveredEquipmentIds = new Set(equipmentItems.map((item) => item.assetId).filter((assetId) => equipmentIds.has(assetId)));
  const orphanAssetItems = equipmentItems.filter((item) => !equipmentIds.has(item.assetId));
  const missingEquipment = equipment.filter((asset) => !coveredEquipmentIds.has(asset.id));
  const laneItems = applicableItems.filter((item) => item?.laneId || item?.topologyDependent || String(item?.laneNo ?? "").trim());
  const laneItemSet = new Set(laneItems);
  const stationItems = applicableItems.filter((item) => !item?.assetId && !laneItemSet.has(item));
  const genericEquipment = equipment.filter((asset) => asset.type === "CUSTOM"
    && equipmentItems.some((item) => item.assetId === asset.id && item.isGenericFallback));
  return {
    equipmentCount: equipment.length,
    coveredEquipmentCount: coveredEquipmentIds.size,
    missingEquipmentCount: missingEquipment.length,
    missingEquipment,
    assetItemCount: equipmentItems.length,
    orphanAssetItemCount: orphanAssetItems.length,
    orphanAssetItems,
    sharedItemCount: stationItems.length + laneItems.length,
    laneItemCount: laneItems.length,
    stationItemCount: stationItems.length,
    genericEquipmentCount: genericEquipment.length,
    genericEquipment,
    complete: missingEquipment.length === 0 && orphanAssetItems.length === 0,
  };
}
export function getPrintableSectionsForSnapshot(snapshot, templateVersion = snapshot?.templateVersion) {
  return getBoqChecklistDisplaySections(snapshot, buildInspectionSections(snapshot, templateVersion))
    .map((section) => ({ ...section, items: section.items.filter((item) => item.applicable !== false) }))
    .filter((section) => section.items.length > 0);
}
export function emptyItem(item) { return { value: "", status: item?.applicable === false ? "na" : "pending", note: "", attachment: null, evidence: emptyEvidence(item) }; }
export function buildItemState(items, previous = {}) { if (items.some((item) => Array.isArray(item.evidenceSlots) && item.evidenceSlots.length)) return buildEvidenceItemState(items, previous); return Object.fromEntries(items.map((item) => { const legacyValue = previous[item.id] || previous[item.templateId] || {}; return [item.id, { ...emptyItem(item), ...legacyValue, attachment: normalizeAttachment(legacyValue.attachment), ...(item.applicable === false ? { status: "na" } : {}) }]; })); }
function normalizeRoundVehicleSearch(value, snapshot, fallbackCriteria) {
  const options = { baseUrl: snapshot?.vehicleSearchConfig?.baseUrl, apiProfile: snapshot?.vehicleSearchConfig?.apiProfile };
  if (snapshot?.vehicleReviewScopeVersion === VEHICLE_REVIEW_SCOPE_VERSION) {
    if (isVehicleReviewScopeState(value)) return normalizeVehicleReviewState(value, fallbackCriteria, options);
    if (value && typeof value === "object" && (Object.hasOwn(value, "fetchedAt") || Object.hasOwn(value, "rows"))) return normalizeVehicleSearchState(value, fallbackCriteria, options);
    return createVehicleReviewState(fallbackCriteria);
  }
  return normalizeVehicleSearchState(value, fallbackCriteria, options);
}
function buildInspectionRound(profile, meta = {}, overrides = {}) {
  const isNewRound = !overrides.snapshot;
  const snapshot = isNewRound
    ? createSnapshot(profile, { checklistCopy: overrides.checklistCopy, masterChecklistCopy: overrides.masterChecklistCopy })
    : normalizeSnapshot(overrides.snapshot, profile);
  const timestamp = overrides.createdAt || new Date().toISOString();
  const roundMeta = { ...defaultMeta, ...meta, projectName: meta.projectName || snapshot.stationName || profile.stationName };
  const items = isNewRound ? getNewRoundChecklistItems(snapshot) : getItemsForSnapshot(snapshot);
  return {
    id: overrides.id || createId("round"),
    stationId: profile.id,
    status: overrides.status === "closed" ? "closed" : "draft",
    createdAt: timestamp,
    updatedAt: overrides.updatedAt || timestamp,
    closedAt: overrides.closedAt || null,
    templateVersion: overrides.templateVersion || snapshot.templateVersion,
    snapshot,
    inspectionItems: buildItemState(items, overrides.inspectionItems || overrides.items || {}),
    vehicleSearch: normalizeRoundVehicleSearch(overrides.vehicleSearch, snapshot, { dateFrom: roundMeta.inspectionDate, dateTo: roundMeta.inspectionDate, stationCode: snapshot.stationCode }),
    correctionHistory: normalizeCorrectionHistory(overrides.correctionHistory),
    meta: roundMeta,
  };
}
export function createInspectionRound(profile, meta = {}, overrides = {}) {
  const round = buildInspectionRound(profile, meta, overrides);
  if (!overrides.snapshot && !getNewRoundChecklistItems(round.snapshot).length) {
    throw new Error("ไม่มีรายการตรวจที่เปิดใช้งาน");
  }
  return round;
}
export function normalizeRound(round, profiles, fallbackProfile, forcedStatus = null) {
  const rawSnapshot = round?.snapshot || round?.stationSnapshot || round?.inspectionSnapshot;
  const stationId = round?.stationId || rawSnapshot?.stationId || fallbackProfile.id;
  const profile = profiles.find((entry) => entry.id === stationId) || fallbackProfile;
  const status = forcedStatus || (round?.status === "closed" || round?.closedAt ? "closed" : "draft");
  // A record with an evidence catalog but no explicit version predates the v4
  // Asset mapping. Keep it on the legacy evidence template instead of
  // silently rewriting its history. A closed record without either marker is
  // still the older v2 checklist.
  const declaredTemplateVersion = round?.templateVersion
    || rawSnapshot?.templateVersion
    || (Array.isArray(rawSnapshot?.evidenceCatalog) ? LEGACY_EVIDENCE_TEMPLATE_VERSION : null)
    || (status === "closed" ? LEGACY_MASTER_TEMPLATE_VERSION : MASTER_TEMPLATE_VERSION);
  const migratedDraftChecklistCopy = status === "draft" && rawSnapshot?.checklistCopy
    ? migrateChecklistCopyForCurrentTemplate(rawSnapshot.checklistCopy)
    : rawSnapshot?.checklistCopy;
  const snapshotInput = rawSnapshot ? { ...rawSnapshot, templateVersion: rawSnapshot.templateVersion || declaredTemplateVersion, ...(migratedDraftChecklistCopy ? { checklistCopy: migratedDraftChecklistCopy } : {}), ...(status === "draft" && !rawSnapshot.vehicleSearchConfig ? { vehicleSearchConfig: profile.vehicleSearchConfig } : {}) } : (status === "closed" ? { ...createSnapshot(profile), templateVersion: declaredTemplateVersion } : rawSnapshot);
  const normalizedSnapshot = normalizeSnapshot(snapshotInput, profile);
  const shouldUpgradeDraft = status === "draft" && !isEvidenceTemplateVersion(declaredTemplateVersion);
  const snapshotBeforeCatalog = shouldUpgradeDraft
    ? { ...normalizedSnapshot, templateVersion: MASTER_TEMPLATE_VERSION, cleaningPolicyVersion: null }
    : normalizedSnapshot;
  const snapshot = isEvidenceTemplateVersion(snapshotBeforeCatalog.templateVersion)
    ? (() => {
      const checklistCopy = getChecklistCopyForSnapshot(snapshotBeforeCatalog);
      const masterChecklistCopy = getMasterChecklistCopyForSnapshot(snapshotBeforeCatalog);
      const withCopy = { ...snapshotBeforeCatalog, copyRevision: checklistCopy.revision, checklistCopy, masterCopyRevision: masterChecklistCopy.revision, masterChecklistCopy };
      return Array.isArray(withCopy.evidenceCatalog)
        ? withCopy
        : { ...withCopy, evidenceCatalog: getEvidenceCatalogForSnapshot(withCopy) };
    })()
    : snapshotBeforeCatalog;
  const createdAt = round?.createdAt || round?.archivedAt || snapshot.createdAt;
  return {
    id: round?.id || createId("round"),
    stationId: snapshot.stationId || stationId,
    status,
    createdAt,
    updatedAt: round?.updatedAt || round?.archivedAt || createdAt,
    closedAt: status === "closed" ? (round?.closedAt || round?.archivedAt || createdAt) : null,
    templateVersion: shouldUpgradeDraft ? MASTER_TEMPLATE_VERSION : declaredTemplateVersion,
    snapshot,
    inspectionItems: buildItemState(getItemsForSnapshot(snapshot), round?.inspectionItems || round?.items || {}),
    correctionHistory: normalizeCorrectionHistory(round?.correctionHistory),
    basedOnRoundId: round?.basedOnRoundId || null,
    revisionNumber: Number.isFinite(Number(round?.revisionNumber)) ? Number(round.revisionNumber) : 0,
    revisionReason: String(round?.revisionReason || ""),
    reason: String(round?.reason || round?.revisionReason || ""),
    revisionCreatedAt: round?.revisionCreatedAt || null,
    revisionCreatedByLabel: String(round?.revisionCreatedByLabel || ""),
    vehicleSearch: normalizeRoundVehicleSearch(round?.vehicleSearch, snapshot, { dateFrom: round?.meta?.inspectionDate, dateTo: round?.meta?.inspectionDate, stationCode: snapshot.stationCode }),
    meta: { ...defaultMeta, ...(round?.meta || {}), projectName: round?.meta?.projectName || snapshot.stationName || profile.stationName },
  };
}
export function getInspectionProgressModel(round, options = {}) {
  const items = getItemsForSnapshot(round?.snapshot, round?.templateVersion || round?.snapshot?.templateVersion);
  const values = round?.inspectionItems || {};
  const applicable = items.filter((item) => item.applicable !== false && !isVehicleApiReviewItem(item, round?.snapshot) && (
    options.excludeSkipped !== true || !isReportHiddenItemStatus(values[item.id]?.status)
  ));
  const done = applicable.filter((item) => values[item.id]?.status !== "pending").length;
  const issues = applicable.filter((item) => ["damaged", "waiting"].includes(values[item.id]?.status)).length;
  const evidence = isEvidenceTemplateVersion(round?.templateVersion || round?.snapshot?.templateVersion)
    ? getEvidenceSummary(round)
    : { slotTotal: 0, slotComplete: 0, slotPending: 0, slotIncomplete: 0, statusCounts: {} };
  const coverage = getChecklistCoverageSummary(round?.snapshot, items);
  return {
    items,
    applicableItems: applicable,
    total: applicable.length,
    done,
    issues,
    pending: applicable.length - done,
    progress: applicable.length ? Math.round(done / applicable.length * 100) : 0,
    evidenceTotal: evidence.slotTotal,
    evidenceComplete: evidence.slotComplete,
    evidencePending: evidence.slotPending,
    evidenceIncomplete: evidence.slotIncomplete,
    evidenceStatusCounts: evidence.statusCounts,
    coverage,
  };
}

export function getRoundSummary(round, options = {}) {
  const { items, applicableItems, coverage, ...summary } = getInspectionProgressModel(round, options);
  return summary;
}

const CLOSE_BLOCKING_EVIDENCE_STATUSES = new Set(["pending", "no-image", "missing"]);
const CLOSE_NOTE_REQUIRED_EVIDENCE_STATUSES = new Set(["not-installed", "server-site"]);
const CLOSE_EVIDENCE_STATUS_LABELS = Object.fromEntries(EVIDENCE_STATUS_OPTIONS.map((option) => [option.value, option.label]));

/**
 * Return checklist completeness and whether a user may confirm closing a draft.
 * All incomplete results, evidence, and Vehicle API reviews remain visible as
 * findings but can be acknowledged at close without changing their stored state.
 */
export function getCloseReadiness(round) {
  const sections = buildInspectionSections(round?.snapshot, round?.templateVersion || round?.snapshot?.templateVersion);
  const values = round?.inspectionItems || {};
  const blockers = [];
  const issues = [];
  const push = (collection, payload) => collection.push({
    id: `${payload.type}-${payload.itemId}-${payload.slotId || "item"}`,
    ...payload,
  });

    sections.flatMap((section) => section.items.map((item) => ({ section, item })))
    .filter(({ item }) => item.applicable !== false && !isVehicleApiReviewItem(item, round?.snapshot))
    .forEach(({ section, item }) => {
      const itemValue = values[item.id] || {};
      if (isEvidenceBypassItemStatus(itemValue.status)) return;
      if ((itemValue.status || "pending") === "pending") {
        push(blockers, { type: "item", itemId: item.id, sectionCode: section.code, label: item.label, message: "ยังไม่ได้เลือกสถานะการตรวจ" });
      } else if (["damaged", "waiting"].includes(itemValue.status)) {
        push(issues, { type: "item", itemId: item.id, sectionCode: section.code, label: item.label, message: STATUS_OPTIONS.find((option) => option.value === itemValue.status)?.label || itemValue.status });
      } else if (["not-installed", "server-site"].includes(itemValue.status)) {
        if (!String(itemValue.note || "").trim()) {
          push(blockers, { type: "item-note", itemId: item.id, sectionCode: section.code, label: item.label, message: `${STATUS_OPTIONS.find((option) => option.value === itemValue.status)?.label || itemValue.status} ต้องมีหมายเหตุ` });
        } else {
          push(issues, { type: "item", itemId: item.id, sectionCode: section.code, label: item.label, message: STATUS_OPTIONS.find((option) => option.value === itemValue.status)?.label || itemValue.status });
        }
      }

      (item.evidenceSlots || []).forEach((slot) => {
        if (slot.required === false) return;
        const evidence = itemValue.evidence?.[slot.id] || {};
        const evidenceStatus = evidence.status || "pending";
        const slotLabel = slot.displayLabel || slot.sourceLabel || item.label;
        if (slot.cleaningStage || slot.photoRequired) {
          if (!isEvidenceSlotComplete(slot, evidence)) {
            const message = evidenceStatus === "complete" && !evidence.attachment?.id
              ? `${slotLabel} ยังขาดภาพจริง`
              : `${slotLabel} ยังขาดภาพหรือสถานะหลักฐาน`;
            push(blockers, { type: "evidence-photo", itemId: item.id, slotId: slot.id, sectionCode: section.code,
              photoPurpose: slot.photoPurpose || null, isCleaningPhoto: Boolean(slot.cleaningStage),
              label: `${item.assetNo || item.label} · ${slotLabel}`, message });
          }
          return;
        }
        if (CLOSE_BLOCKING_EVIDENCE_STATUSES.has(evidenceStatus)) {
          push(blockers, { type: "evidence", itemId: item.id, slotId: slot.id, sectionCode: section.code, label: slotLabel, message: CLOSE_EVIDENCE_STATUS_LABELS[evidenceStatus] || evidenceStatus });
          return;
        }
        if (CLOSE_NOTE_REQUIRED_EVIDENCE_STATUSES.has(evidenceStatus)) {
          if (!String(evidence.note || "").trim()) {
            push(blockers, { type: "evidence-note", itemId: item.id, slotId: slot.id, sectionCode: section.code, label: slotLabel, message: `${CLOSE_EVIDENCE_STATUS_LABELS[evidenceStatus] || evidenceStatus} ต้องมีหมายเหตุ` });
          } else {
            push(issues, { type: "evidence", itemId: item.id, slotId: slot.id, sectionCode: section.code, label: slotLabel, message: CLOSE_EVIDENCE_STATUS_LABELS[evidenceStatus] || evidenceStatus });
          }
          return;
        }
        if (evidenceStatus === "na") {
          push(blockers, { type: "evidence-applicability", itemId: item.id, slotId: slot.id, sectionCode: section.code, label: slotLabel, message: "สถานะไม่เกี่ยวข้องต้องมาจากกติกา applicability ของรายการ" });
        }
      });
    });

  const vehicleSearchConfig = createVehicleSearchConfig(round?.snapshot?.vehicleSearchConfig, "");
  const vehicleSearch = round?.snapshot?.vehicleReviewScopeVersion === VEHICLE_REVIEW_SCOPE_VERSION
    ? normalizeVehicleReviewState(round?.vehicleSearch, {}, { baseUrl: vehicleSearchConfig.baseUrl, apiProfile: vehicleSearchConfig.apiProfile })
    : normalizeVehicleSearchState(round?.vehicleSearch, {}, { baseUrl: vehicleSearchConfig.baseUrl, apiProfile: vehicleSearchConfig.apiProfile });
  const vehicleSearchSummary = getVehicleSearchSummary(vehicleSearch);
  const vehicleItems = sections.flatMap((section) => section.items);
  const vehicleReviewItems = vehicleItems.filter((item) => isVehicleApiReviewItem(item, round?.snapshot));
  const vehicleSearchItem = vehicleItems.find(isVehicleSearchItem);
  const vehicleSearchItemId = vehicleSearchItem?.id || VEHICLE_SEARCH_ITEM_ID;
  const vehicleSearchItemValue = values[vehicleSearchItemId] || values[VEHICLE_SEARCH_ITEM_ID] || {};
  const vehicleReviewVersion = round?.snapshot?.vehicleReviewVersion;
  const vehicleSearchBypassed = Boolean(!vehicleReviewItems.length && vehicleSearchItem && (
    vehicleSearchItem.applicable === false
    || isEvidenceBypassItemStatus(vehicleSearchItemValue.status)
  ));
  if (vehicleReviewItems.length) {
    const config = vehicleSearchConfig;
    const primaryItem = vehicleReviewItems.find((item) => getVehicleReviewContext(item)?.key === "plate") || vehicleReviewItems[0];
    const scopeEntries = isVehicleReviewScopeState(vehicleSearch)
      ? getVehicleReviewScopeEntries(vehicleSearch)
      : [{ key: "all", label: "", state: vehicleSearch }];
    scopeEntries.forEach(({ key: scopeKey, label: scopeLabel, state: scopeState }) => {
      const suffix = scopeLabel ? ` (${scopeLabel})` : "";
      if (!scopeState.fetchedAt) {
        push(blockers, { type: "vehicle-search-fetch", itemId: primaryItem.id, sectionCode: "5.1", scope: scopeKey, label: `${primaryItem.label}${suffix}`, message: `ยังไม่ได้ดึงข้อมูลรถช่วง${scopeLabel || "ที่เลือก"}จาก API สถานี` });
        return;
      }
      if (isVehicleReviewScopeState(vehicleSearch) && !scopeState.rows.length && !scopeState.emptyResultAcknowledgedAt) {
        push(blockers, { type: "vehicle-search-empty", itemId: primaryItem.id, sectionCode: "5.1", scope: scopeKey, label: `${primaryItem.label}${suffix}`, message: `ไม่พบรถช่วง${scopeLabel} ยังไม่ได้ยืนยันผลการค้นหา` });
        return;
      }
      if (!config.stationId || !config.stationName) {
        push(blockers, { type: "vehicle-search-station", itemId: primaryItem.id, sectionCode: "5.1", scope: scopeKey, label: `${primaryItem.label}${suffix}`, message: "ข้อมูล stationID หรือชื่อสถานีใน Vehicle API ยังไม่ครบ" });
        return;
      }
      const stationMismatch = isVehicleReviewScopeState(vehicleSearch)
        ? (!scopeState.sourceStation || scopeState.sourceStation.id !== config.stationId || scopeState.sourceStation.name !== config.stationName)
        : (scopeState.sourceStation && (scopeState.sourceStation.id !== config.stationId || scopeState.sourceStation.name !== config.stationName));
      if (stationMismatch) {
        push(blockers, { type: "vehicle-search-station", itemId: primaryItem.id, sectionCode: "5.1", scope: scopeKey, label: `${primaryItem.label}${suffix}`, message: "ผล API มาจากสถานีไม่ตรงกับข้อมูลประจำรอบ" });
        return;
      }
      vehicleReviewItems.forEach((item) => {
        const context = getVehicleReviewContext(item);
        const reviewState = getVehicleReviewState(scopeState, { reviewVersion: vehicleReviewVersion, context: context?.key });
        if (reviewState.summary.unresolvedChecks > 0) {
          const dimensions = getVehicleReviewDimensions(vehicleReviewVersion, context?.key);
          const firstUnresolved = scopeState.rows.find((row) => dimensions.some(({ statusKey }) => ["pending", "unable-to-verify"].includes(row[statusKey])));
          const firstUnresolvedDimension = firstUnresolved ? dimensions.find(({ statusKey }) => ["pending", "unable-to-verify"].includes(firstUnresolved[statusKey])) : null;
          const unresolvedStatus = firstUnresolved?.[firstUnresolvedDimension?.statusKey] || "pending";
          const unresolvedCount = reviewState.summary[firstUnresolvedDimension?.key || context?.key || "plate"]?.[unresolvedStatus] || reviewState.summary.unresolvedChecks;
          const contextLabel = context?.key === "classification" ? "การคัดแยกประเภทรถ" : "ป้ายทะเบียน";
          const message = unresolvedStatus === "unable-to-verify"
            ? `ตรวจ${firstUnresolvedDimension?.label || contextLabel}ไม่ได้ ${unresolvedCount} รายการ${suffix}`
            : `ยังไม่ได้ตรวจ${firstUnresolvedDimension?.label || contextLabel} ${unresolvedCount} รายการ${suffix}`;
          push(blockers, { type: "vehicle-search-review", itemId: item.id, sectionCode: "5.1", scope: scopeKey, rowId: firstUnresolved?.id || null, reviewKind: firstUnresolvedDimension?.key || context?.key || "plate", label: `${item.label}${suffix}`, message });
        }
        getVehicleSearchIssueRows(scopeState, { reviewVersion: vehicleReviewVersion, context: context?.key }).forEach((issue) => {
          if (issue.kind === "vehicle-review" && issue.status !== "incorrect" && issue.status !== "unable-to-verify") return;
          push(issues, { ...issue, type: issue.kind === "integrity-warning" ? "vehicle-search-warning" : "vehicle-search-issue", itemId: item.id, sectionCode: "5.1", scope: scopeKey, label: `${issue.plateNumber} · ${issue.dimensionLabel}${suffix}`, message: issue.message || issue.statusLabel });
        });
        // v2 is API-only: the crop/overview and decisions are the evidence.
        // Keep the document requirement only for the legacy Snapshot renderer.
        if (vehicleReviewVersion !== VEHICLE_API_REVIEW_VERSION) {
          (item.evidenceSlots || []).filter((slot) => slot.required !== false).forEach((slot) => {
            const evidence = values[item.id]?.evidence?.[slot.id] || {};
            const complete = slot.fieldType === "document" ? Boolean(evidence.attachment?.id) : isEvidenceSlotComplete(slot, evidence);
            if (!complete) push(blockers, { type: "vehicle-document-evidence", itemId: item.id, slotId: slot.id, sectionCode: "5.1", label: slot.displayLabel || item.label, message: "รายการนี้ยังขาดเอกสารหรือหลักฐาน" });
          });
        }
      });
      const outcome = getVehicleReviewOutcome(scopeState, { reviewVersion: vehicleReviewVersion });
      outcome.reasons
        .filter((reason) => ["sample-threshold", "no-sample", "missing-weight", "plate-threshold", "classification-threshold"].includes(reason.code))
        .forEach((reason) => push(blockers, {
          type: "vehicle-search-threshold",
          itemId: primaryItem.id,
          sectionCode: "5.1",
          scope: scopeKey,
          label: `${primaryItem.label}${suffix}`,
          message: reason.label,
        }));
    });
  } else if (!vehicleSearchBypassed && vehicleSearchSummary.pending > 0) {
    const firstPending = vehicleSearch.rows.find((row) => row.reviewStatus === "pending");
    push(blockers, {
      type: "vehicle-search-review",
      itemId: vehicleSearchItemId,
      sectionCode: "5.1",
      rowId: firstPending?.id || null,
      label: "ตรวจสอบผลอ่านป้ายทะเบียน",
      message: `ยังไม่ได้ตรวจผลอ่านป้ายทะเบียน ${vehicleSearchSummary.pending} รายการ`,
    });
  }

  return {
    canClose: blockers.length === 0,
    // Every finding can be acknowledged at closure; canClose still reports completeness.
    canConfirmClose: true,
    blockers,
    issues,
    firstBlocker: blockers[0] || null,
    blockerCount: blockers.length,
    issueCount: issues.length,
  };
}
