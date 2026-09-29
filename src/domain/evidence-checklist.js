// The BOQ evidence template mirrors the visible evidence cells in the
// supplied one-page PDFs. Source statuses are audit metadata only; every new
// inspection round starts with a pending status.

// Evidence template versions describe the PDF-shaped source catalog. Checklist
// policy versions are separate so a new round can change Station/Asset scope
// without rewriting the catalog stored by an older Snapshot. Policy v4 is the
// current System + related Asset runtime; v1-v3 remain readable for history.
import { isEvidenceBypassItemStatus } from "./inspection-status.js";
import { EQUIPMENT_ORDER_VERSION, sortEquipmentForDisplay } from "./ordering.js";
import { isVehicleApiReviewItem } from "./vehicle-search.js";
import { isWimElectronicsOutputAsset, isWimElectronicsSubEquipmentType, normalizeWimElectronicsOutputVoltages } from "./wim-electronics.js";
import { getCentralChecklistSectionName, getCentralEquipmentName, getCentralSystemNameForRecord, formatCentralNameEnglishFirst } from "./equipment-names.js";
import { BOQ_CHECKLIST_PRESENTATION_VERSION, LEGACY_BOQ_CHECKLIST_PRESENTATION_VERSION, getBoqChecklistDisplaySections } from "./boq-checklist-groups.js";
import { getCanonicalItem } from "./canonical-station-catalog.js";
import { getRelationshipPathForRecord, normalizeRelationshipScope } from "./station-relationship-tree.js";
import { getLaneScope } from "./station-lane-scope.js";

export const LEGACY_EVIDENCE_TEMPLATE_VERSION = "checklist-master-v3-boq-evidence";
export const PREVIOUS_EVIDENCE_TEMPLATE_VERSION = "checklist-master-v4-asset-mapped";
export const EVIDENCE_TEMPLATE_VERSION = "checklist-master-v5-system-mapped";
export const LANE_ASSET_EVIDENCE_TEMPLATE_VERSION = "checklist-master-v6-lane-asset-mapped";
export const CHECKLIST_COPY_REVISION = "checklist-copy-v1";
export const LEGACY_CHECKLIST_COPY_REVISION = "checklist-copy-legacy-frozen";
export const VIDEO_EVIDENCE_PURGE_VERSION = 1;

// These are the evidence topics that are being retired. Keep the identifiers
// stable so the one-time Local/Test migration can remove the same data from
// old drafts, closed rounds, compatibility aliases, and Snapshots.
export const VIDEO_EVIDENCE_ITEM_IDS = Object.freeze([
  "2.3.video-lane-1",
  "2.3.video-lane-2",
  "2.3.video-lane-3",
  "3.1.lane-1-night",
  "3.1.lane-2-night",
  "3.1.lane-3-night",
  "3.2.lane-1-night",
  "3.2.lane-2-night",
  "3.2.lane-3-night",
  "4.2.playback-video",
  "6.1.video-lane-1",
  "6.1.video-lane-2",
  "6.1.video-lane-3",
  "7.1.video-no-staff",
  "7.1.video-with-staff",
]);

export const VIDEO_EVIDENCE_SLOT_IDS = Object.freeze(
  VIDEO_EVIDENCE_ITEM_IDS.map((itemId) => `${itemId}.evidence`),
);

// New inspection rounds use this additive policy for equipment cleaning. The
// evidence catalog version remains unchanged so existing v3 Snapshots can be
// reopened with their original PDF-shaped slots.
export const CLEANING_POLICY_VERSION = "equipment-cleaning-v1";
export const WIM_SORTING_EVIDENCE_VERSION = "wim-sorting-evidence-v1";
export const LEGACY_CHECKLIST_POLICY_VERSION = "station-item-controls-v1";
export const PREVIOUS_CHECKLIST_POLICY_VERSION = "station-item-controls-v2";
export const HISTORICAL_CHECKLIST_POLICY_VERSION = "station-item-controls-v3";
// v4-v8 are kept as frozen compatibility shapes. v6 was the short-lived
// layout that omitted the WIM Control/Electronics System rows. v7 restores
// those System rows; v8 scopes LPR Lane checks to installed LPR Systems.
export const PRIOR_CHECKLIST_POLICY_VERSION = "station-item-controls-v4";
export const PREVIOUS_CURRENT_CHECKLIST_POLICY_VERSION = "station-item-controls-v5";
export const PREVIOUS_NO_WIM_CHECKLIST_POLICY_VERSION = "station-item-controls-v6";
export const PREVIOUS_LPR_SCOPE_CHECKLIST_POLICY_VERSION = "station-item-controls-v7";
export const PREVIOUS_CLEANING_CHECKLIST_POLICY_VERSION = "station-item-controls-v8";
export const CHECKLIST_POLICY_VERSION = "station-item-controls-v9";
export const DEDICATED_ASSET_CHECKLIST_RECIPE_VERSION = "asset-dedicated-checks-v1";

// Retired types remain decodable for existing Snapshots, but are omitted from
// current Station Profile views and every newly generated Checklist Snapshot.
const RETIRED_CURRENT_ASSET_TYPES = new Set(["LPR_CONTROL_SYSTEM", "CABINET"]);

export function getActivePhysicalEquipment(equipment = [], { includeLegacy = false } = {}) {
  return (Array.isArray(equipment) ? equipment : []).filter((asset) => asset?.active !== false
    && asset?.type !== "LANE" && asset?.recordKind !== "legacy-context" && !asset?.systemOnly
    && (includeLegacy || !RETIRED_CURRENT_ASSET_TYPES.has(String(asset?.type || ""))));
}

const WIM_CHILD_TYPES = new Set(["WIM_SENSOR", "WIM_LOOP"]);

const LEGACY_SYSTEM_CHECKLIST_RECIPES = Object.freeze({
  "dimension-management": { code: "1.1.5", name: "3D Truck Dimension Management System" },
  "image-processing-management": { code: "1.1.12", name: "Image Processing Management System" },
  "lpr-control": { code: "3.1", name: "License Plate Recognition Control System" },
  "wim-high-data-control": { code: "1.1.4", name: "WIM High Speed Data Control System" },
  "wim-high-reporting": { code: "1.1.4", name: "WIM High Speed Reporting System" },
  "wim-high-display": { code: "1.1.4", name: "WIM High Speed Display and Processing System" },
  "wim-low-data-control": { code: "1.1.8", name: "WIM Low Speed Data Control System" },
  "wim-low-reporting": { code: "1.1.8", name: "WIM Low Speed Reporting System" },
  "wim-low-display": { code: "1.1.8", name: "WIM Low Speed Display and Processing System" },
  "vms-control": { code: "7.1", name: "VMS Control System" },
});

// v4 adds a functional System row for every canonical System. The Asset row
// remains separate and is generated only from installed, related Assets.
const CURRENT_SYSTEM_CHECKLIST_RECIPES = Object.freeze({
  ...LEGACY_SYSTEM_CHECKLIST_RECIPES,
  "wim-sorting": { code: "2.1", name: "WIM Sorting System" },
  "wim-control": { code: "2.2", name: "WIM Control System" },
  "wim-electronics-system": { code: "2.3", name: "WIM Electronics System" },
  "cctv-system": { code: "4.1", name: "CCTV Camera System" },
  "data-management": { code: "5.1", name: "Database Management and Reporting System" },
  "station-display": { code: "5.2", name: "Display and Data Processing System" },
});

// v5 also used the two WIM System rows. Keep this separate for snapshots
// created under that policy so their original labels and item IDs remain
// readable after the current policy is updated again.
const PREVIOUS_CURRENT_SYSTEM_CHECKLIST_RECIPES = Object.freeze({
  ...CURRENT_SYSTEM_CHECKLIST_RECIPES,
  "wim-control": { code: "2.2", name: "WIM Control System" },
  "wim-electronics-system": { code: "2.3", name: "WIM Electronics System" },
});

// Older station registers stored the document's System rows with a
// `systemId`/`componentId` pair (for example `wim` + `electronics`) instead
// of the canonical catalog id. Resolve both shapes to the same identity so a
// migrated station keeps its System-to-Asset relationship and receives the
// new System-level check without changing the stored Snapshot.
const LEGACY_SYSTEM_IDENTITY = Object.freeze({
  "wim:sorting": "wim-sorting",
  "wim:control": "wim-control",
  "wim:electronics": "wim-electronics-system",
  "lpr:control": "lpr-control",
  "lpr:recognition": "lpr-control",
  "cctv:fixed-camera": "cctv-system",
  "cctv:nvr": "cctv-system",
  "other:database": "data-management",
  "other:display-processing": "station-display",
});

function canonicalSystemIdForRecord(system) {
  const explicit = String(system?.canonicalItemId || "").trim();
  if (explicit) return explicit;
  const key = `${String(system?.systemId || "").trim()}:${String(system?.componentId || "").trim()}`;
  return LEGACY_SYSTEM_IDENTITY[key] || "";
}

function activeSystemsForSnapshot(snapshot) {
  return (Array.isArray(snapshot?.stationSystems) ? snapshot.stationSystems : [])
    .filter((system) => system?.active !== false
      && Number(system?.quantity ?? 1) > 0
      && String(system?.id || "") !== "present-wim-sorting");
}

function canonicalOwnersForAsset(asset, { includeLegacyOwners = false } = {}) {
  const canonical = getCanonicalItem(
    (Array.isArray(asset?.catalogItemId) ? asset.catalogItemId[0] : asset?.catalogItemId) || "",
  );
  const byType = Object.values({
    WIM_SENSOR: "wim-sensor",
    WIM_LOOP: "wim-loop",
    CONTROL_COMPUTER: "wim-control-computer",
    CONTROL_CABINET: "wim-electronics",
    WIM_AC_DC_POWER_SUPPLY: "wim-ac-dc-power-supply",
    WIM_NETWORK_EQUIPMENT: "wim-network-equipment",
    WIM_CONTROLLER: "wim-controller",
    WIM_PHASE_PROTECTION: "wim-phase-protection",
    WIM_SUB_BREAKER: "wim-sub-breaker",
    WIM_SWITCHING_DC: "wim-switching-dc",
    WIM_TRANSFORMER_24VAC: "wim-transformer-24vac",
    LPR_CONTROL_SYSTEM: "lpr-control-system",
    LPR_CAMERA: "lpr-camera",
    FIXED_CAMERA: "fixed-camera",
    PTZ_CAMERA: "ptz-camera",
    NVR: "nvr",
    JOYSTICK: "joystick",
    LASER_SCANNER: "dimension-scanner",
    DIMENSION_CONTROLLER: "dimension-controller",
    IMAGE_PROCESSOR: "image-processor",
    VMS_SIGN: "vms-sign",
    VMS_LIGHT_SENSOR: "vms-light-sensor",
    VMS_DISPLAY: "vms-display",
    DATABASE_SERVER: "database-server",
    IMPS_DISPLAY_PROCESSING: "station-display-equipment",
  }).find((id) => getCanonicalItem(id)?.equipmentType === asset?.type);
  const resolved = canonical || getCanonicalItem(byType);
  const owners = Array.isArray(resolved?.systemIds) ? resolved.systemIds : [];
  const currentWimAssetTypes = new Set([
    "CONTROL_COMPUTER", "CONTROL_CABINET", "WIM_AC_DC_POWER_SUPPLY",
    "WIM_NETWORK_EQUIPMENT", "WIM_CONTROLLER", "WIM_PHASE_PROTECTION",
    "WIM_SUB_BREAKER", "WIM_SWITCHING_DC", "WIM_TRANSFORMER_24VAC",
  ]);
  const currentOwners = currentWimAssetTypes.has(asset?.type) ? [...owners, "wim-sorting"] : owners;
  if (!includeLegacyOwners) return [...new Set(currentOwners)];
  const legacyOwnerByType = {
    CONTROL_COMPUTER: "wim-control",
    CONTROL_CABINET: "wim-electronics-system",
    WIM_AC_DC_POWER_SUPPLY: "wim-electronics-system",
    WIM_NETWORK_EQUIPMENT: "wim-electronics-system",
    WIM_CONTROLLER: "wim-electronics-system",
    WIM_PHASE_PROTECTION: "wim-electronics-system",
    WIM_SUB_BREAKER: "wim-electronics-system",
    WIM_SWITCHING_DC: "wim-electronics-system",
    WIM_TRANSFORMER_24VAC: "wim-electronics-system",
  };
  return [...new Set([...currentOwners, legacyOwnerByType[asset?.type]].filter(Boolean))];
}

function assetRelatedToActiveSystem(asset, systems, { includeLegacyOwners = false } = {}) {
  if (!systems.length) return false;
  if (WIM_CHILD_TYPES.has(asset?.type)) {
    return systems.some((system) => canonicalSystemIdForRecord(system) === "wim-sorting"
      && String(system.id || "") === String(asset?.parentSystemId || "")
      && String(system?.laneId || "").trim());
  }
  if (isWimElectronicsSubEquipmentType(asset?.type)) {
    const scopeEquipment = Array.isArray(asset?.__scopeEquipment) ? asset.__scopeEquipment : [];
    const parent = scopeEquipment
      .find((entry) => String(entry?.id || "") === String(asset?.parentAssetId || ""));
    if (!parent || parent.type !== "CONTROL_CABINET" || parent.active === false
      || !assetRelatedToActiveSystem({ ...parent, __scopeEquipment: scopeEquipment }, systems, { includeLegacyOwners })) return false;
  }
  const owners = canonicalOwnersForAsset(asset, { includeLegacyOwners });
  if (!owners.length) return true;
  const normalizeScope = (value) => String(value || "").trim().toLowerCase();
  const isWildcardScope = (value) => ["", "station-wide", "station", "all", "all-scopes", "ทุกขอบเขต", "ทั้งหมด"].includes(normalizeScope(value));
  const scopesMatch = (assetScope, systemScope) => isWildcardScope(assetScope)
    || isWildcardScope(systemScope)
    || normalizeScope(assetScope) === normalizeScope(systemScope);
  return systems.some((system) => owners.includes(canonicalSystemIdForRecord(system))
    && scopesMatch(asset?.scope, system?.scope));
}

export function getChecklistScopeState(source = {}, { includeLegacy = false, includeLegacyOwners = false } = {}) {
  const systems = activeSystemsForSnapshot(source);
  const assets = getActivePhysicalEquipment(source?.equipment, { includeLegacy });
  // A current round is scoped by the Station Structure first. Assets without
  // an active owner System are retained in the register for correction, but
  // never become runtime Checklist rows.
  const relatedAssets = assets.filter((asset) => assetRelatedToActiveSystem({ ...asset, __scopeEquipment: assets }, systems, { includeLegacyOwners }));
  return {
    activeSystems: systems,
    activeAssets: relatedAssets,
    orphanAssets: assets.filter((asset) => !relatedAssets.includes(asset)),
    hasScope: systems.length > 0 || relatedAssets.length > 0,
  };
}

export function getNewRoundChecklistItems(snapshot) {
  if (!getChecklistScopeState(snapshot).hasScope) return [];
  // Preview callers may pass a normalized Station Profile before the final
  // Snapshot has been created. Use the current BOQ presentation for that
  // runtime calculation while leaving the persisted object untouched.
  const runtimeSnapshot = snapshot?.checklistPresentationVersion
    ? snapshot
    : { ...snapshot, checklistPresentationVersion: BOQ_CHECKLIST_PRESENTATION_VERSION };
  return getStationChecklistItems(runtimeSnapshot);
}
export const CLEANING_TARGET_TYPES = Object.freeze([
  "CONTROL_COMPUTER",
  "CONTROL_CABINET",
  "LPR_CAMERA",
  "FIXED_CAMERA",
  "PTZ_CAMERA",
  "NVR",
  "DATABASE_SERVER",
  "VMS_SIGN",
  "VMS_LIGHT_SENSOR",
  "VMS_DISPLAY",
]);
export const CLEANING_STAGE_DEFINITIONS = Object.freeze([
  { key: "before", label: "ก่อนทำความสะอาด", shortLabel: "ก่อนทำความสะอาด" },
  { key: "during", label: "ระหว่างทำความสะอาด", shortLabel: "ระหว่างทำความสะอาด" },
  { key: "after", label: "หลังทำความสะอาด", shortLabel: "หลังทำความสะอาด" },
]);

// One display title is shared by Evidence, station configuration and the
// Item Library. Keep the technical identifiers in the templates unchanged.
// Source labels remain tied to the supplied PDF so a display rename cannot
// change the audit mapping.
const CHECKLIST_SECTION_CODES = ["1.1", "2.1", "2.2", "2.3", "3.1", "3.2", "4.1", "4.2", "5.1", "5.2", "6.1", "6.2", "6.3", "7.1"];

export const CHECKLIST_SECTION_TITLES = Object.freeze(Object.fromEntries(
  CHECKLIST_SECTION_CODES.map((code) => [code, formatCentralNameEnglishFirst(getCentralChecklistSectionName(code)) || code]),
));

function checklistEquipmentName(type, fallback = "อุปกรณ์") {
  return formatCentralNameEnglishFirst(getCentralEquipmentName(type)) || fallback;
}

// Edit user-facing checklist wording here. Keep the technical identifiers in
// the template below unchanged. Source labels remain tied to the supplied PDF
// so a display rename cannot change the audit mapping.
export const CHECKLIST_COPY_OVERRIDES = Object.freeze({
  sections: CHECKLIST_SECTION_TITLES,
  items: Object.freeze({
    "1.1.staff": "ภาพพนักงานผู้ปฏิบัติงาน ณ หน้างาน",
    "1.1.vehicle": "ภาพยานพาหนะที่ใช้ปฏิบัติงาน",
    "1.1.crane": "ภาพรถบรรทุกติดตั้งเครน ณ หน้างาน",
    "1.1.traffic-cone-light": "ภาพกรวยจราจรและป้ายไฟที่ติดตั้ง",
    "1.1.tools": "ภาพเครื่องมือช่างที่นำมาใช้งาน",
    "1.1.road-closure": "ภาพการติดตั้งกรวยจราจรเพื่อปิดพื้นที่ปฏิบัติงาน",
    "2.1.road-01": "ภาพพื้นที่ติดตั้ง WIM และสภาพหน้างาน — มุมที่ 1",
    "2.1.road-02": "ภาพพื้นที่ติดตั้ง WIM และสภาพหน้างาน — มุมที่ 2",
    "2.1.road-03": "ภาพพื้นที่ติดตั้ง WIM และสภาพหน้างาน — มุมที่ 3",
    "2.2.computer": "ภาพ WIM Control Computer · เครื่องคอมพิวเตอร์ควบคุม WIM",
    "2.2.computer-model-sn": "WIM Control Computer · ภาพรุ่นและหมายเลขประจำเครื่องของเครื่องคอมพิวเตอร์ควบคุม WIM",
    "2.2.lan": "WIM Control System · ภาพการติดป้ายระบุสาย LAN ของระบบควบคุม WIM",
    "2.2.cleaning-01": "WIM Control Computer · ภาพทำความสะอาดเครื่องคอมพิวเตอร์ควบคุม — จุดที่ 1",
    "2.2.cleaning-02": "WIM Control Computer · ภาพทำความสะอาดเครื่องคอมพิวเตอร์ควบคุม — จุดที่ 2",
    "2.2.cleaning-03": "WIM Control Computer · ภาพทำความสะอาดเครื่องคอมพิวเตอร์ควบคุม — จุดที่ 3",
    "2.1.sensor-set-1-01": "ค่าที่วัดได้จาก WIM Sensor · เซนเซอร์ชั่งน้ำหนัก WIM #1",
    "2.1.sensor-set-1-02": "ค่าที่วัดได้จาก WIM Sensor · เซนเซอร์ชั่งน้ำหนัก WIM #2",
    "2.1.sensor-set-1-03": "ค่าที่วัดได้จาก WIM Sensor · เซนเซอร์ชั่งน้ำหนัก WIM #3",
    "2.1.sensor-set-2-01": "ค่าที่วัดได้จาก WIM Sensor · เซนเซอร์ชั่งน้ำหนัก WIM #4",
    "2.1.sensor-set-2-02": "ค่าที่วัดได้จาก WIM Sensor · เซนเซอร์ชั่งน้ำหนัก WIM #5",
    "2.1.sensor-set-2-03": "ค่าที่วัดได้จาก WIM Sensor · เซนเซอร์ชั่งน้ำหนัก WIM #6",
    "2.1.sensor-set-3-01": "ค่าที่วัดได้จาก WIM Sensor · เซนเซอร์ชั่งน้ำหนัก WIM #7",
    "2.1.sensor-set-3-02": "ค่าที่วัดได้จาก WIM Sensor · เซนเซอร์ชั่งน้ำหนัก WIM #8",
    "2.1.sensor-set-3-03": "ค่าที่วัดได้จาก WIM Sensor · เซนเซอร์ชั่งน้ำหนัก WIM #9",
    "2.1.sensor-set-4-01": "ค่าที่วัดได้จาก WIM Sensor · เซนเซอร์ชั่งน้ำหนัก WIM #10",
    "2.1.sensor-set-4-02": "ค่าที่วัดได้จาก WIM Sensor · เซนเซอร์ชั่งน้ำหนัก WIM #11",
    "2.1.sensor-set-4-03": "ค่าที่วัดได้จาก WIM Sensor · เซนเซอร์ชั่งน้ำหนัก WIM #12",
    "2.1.loop-01": "ค่าที่วัดได้จาก WIM Loop · ลูปตรวจจับยานพาหนะ #1",
    "2.1.loop-02": "ค่าที่วัดได้จาก WIM Loop · ลูปตรวจจับยานพาหนะ #2",
    "2.1.loop-03": "ค่าที่วัดได้จาก WIM Loop · ลูปตรวจจับยานพาหนะ #3",
    "2.1.loop-04": "ค่าที่วัดได้จาก WIM Loop · ลูปตรวจจับยานพาหนะ #4",
    "2.1.loop-05": "ค่าที่วัดได้จาก WIM Loop · ลูปตรวจจับยานพาหนะ #5",
    "2.1.loop-06": "ค่าที่วัดได้จาก WIM Loop · ลูปตรวจจับยานพาหนะ #6",
    "2.3.ac-dc-01": "AC/DC Power Supply · ภาพอุปกรณ์แปลงไฟฟ้า AC/DC ลำดับที่ 1",
    "2.3.ac-dc-02": "AC/DC Power Supply · ภาพอุปกรณ์แปลงไฟฟ้า AC/DC ลำดับที่ 2",
    "2.3.network-01": "WIM Network Equipment · ภาพอุปกรณ์เชื่อมต่อเครือข่าย ลำดับที่ 1",
    "2.3.network-02": "WIM Network Equipment · ภาพอุปกรณ์เชื่อมต่อเครือข่าย ลำดับที่ 2",
    "2.3.main-current": "WIM Electronics Cabinet · ภาพการตรวจวัดกระแสไฟฟ้าหลักของตู้ควบคุม",
    "2.3.cabinet-overview": "WIM Electronics Cabinet · ภาพรวมภายในและภายนอกตู้ควบคุม",
    "2.3.electrical-control": "WIM Electronics Cabinet · ภาพอุปกรณ์ควบคุมไฟฟ้าภายในตู้",
    "2.3.wim-controller-01": "WIM Controller · ภาพตัวควบคุม WIM และหมายเลขประจำเครื่อง #1",
    "2.3.wim-controller-02": "WIM Controller · ภาพตัวควบคุม WIM และหมายเลขประจำเครื่อง #2",
    "2.3.wim-controller-03": "WIM Controller · ภาพตัวควบคุม WIM และหมายเลขประจำเครื่อง #3",
    "2.3.cal-factor-1": "ภาพค่า Cal Factor #1",
    "2.3.cal-factor-2": "ภาพค่า Cal Factor #2",
    "2.3.cal-factor-3": "ภาพค่า Cal Factor #3",
    "2.3.incoming-main": "ค่าที่วัดได้จากไฟฟ้าหลัก — ขาเข้า",
    "2.3.phase-protection": "Phase Protection · ค่าที่วัดได้จากอุปกรณ์ป้องกันเฟส — ขาออก",
    "2.3.sub-breaker-1": "Sub Breaker · ค่าที่วัดได้จากเบรกเกอร์ย่อย #1 — ขาออก",
    "2.3.sub-breaker-2": "Sub Breaker · ค่าที่วัดได้จากเบรกเกอร์ย่อย #2 — ขาออก",
    "2.3.sub-breaker-3": "Sub Breaker · ค่าที่วัดได้จากเบรกเกอร์ย่อย #3 — ขาออก",
    "2.3.sub-breaker-4": "Sub Breaker · ค่าที่วัดได้จากเบรกเกอร์ย่อย #4 — ขาออก",
    "2.3.switching-dc-1": "Switching DC Power Supply · ค่าที่วัดได้จากชุดจ่ายไฟ DC แบบสวิตชิ่ง #1 — ขาออก",
    "2.3.switching-dc-2": "Switching DC Power Supply · ค่าที่วัดได้จากชุดจ่ายไฟ DC แบบสวิตชิ่ง #2 — ขาออก",
    "2.3.switching-dc-3": "Switching DC Power Supply · ค่าที่วัดได้จากชุดจ่ายไฟ DC แบบสวิตชิ่ง #3 — ขาออก",
    "2.3.transformer-24v-1": "Transformer AC 24VAC · ค่าที่วัดได้จากหม้อแปลงไฟ AC 24VAC #1 — ขาออก",
    "2.3.transformer-24v-2": "Transformer AC 24VAC · ค่าที่วัดได้จากหม้อแปลงไฟ AC 24VAC #2 — ขาออก",
    "2.3.transformer-24v-3": "Transformer AC 24VAC · ค่าที่วัดได้จากหม้อแปลงไฟ AC 24VAC #3 — ขาออก",
    "2.3.unused-note": "ภาพหรือหมายเหตุจุดที่ไม่ได้ใช้งาน",
    "3.1.lane-1-day": "License Plate Recognition Control System · ผลทดสอบการอ่านป้ายทะเบียนร่วมกับ WIM — ช่องจราจร 1 (ช่วงกลางวัน)",
    "3.1.lane-1-search": "License Plate Recognition Control System · ภาพผลการค้นหาป้ายทะเบียน — ช่องจราจร 1",
    "3.2.overview": "LPR Camera · ภาพรวมตำแหน่งและทิศทางกล้องอ่านป้ายทะเบียน",
    "3.2.camera-1-sn": "LPR Camera · ภาพรุ่นและหมายเลขประจำเครื่องของกล้องอ่านป้ายทะเบียน #1",
    "3.2.camera-2-sn": "LPR Camera · ภาพรุ่นและหมายเลขประจำเครื่องของกล้องอ่านป้ายทะเบียน #2",
    "3.2.camera-3-sn": "LPR Camera · ภาพรุ่นและหมายเลขประจำเครื่องของกล้องอ่านป้ายทะเบียน #3",
    "3.2.camera-1-cleaning": "LPR Camera · ภาพทำความสะอาดกล้องอ่านป้ายทะเบียน #1",
    "3.2.camera-2-cleaning": "LPR Camera · ภาพทำความสะอาดกล้องอ่านป้ายทะเบียน #2",
    "3.2.camera-3-cleaning": "LPR Camera · ภาพทำความสะอาดกล้องอ่านป้ายทะเบียน #3",
    "3.2.lane-1-day": "LPR Camera · ผลจากกล้องอ่านป้ายทะเบียนร่วมกับ WIM — ช่องจราจร 1 (ช่วงกลางวัน)",
    "3.2.lane-1-search": "LPR Camera · ภาพผลการค้นหาที่เชื่อมโยงกับกล้องอ่านป้ายทะเบียน — ช่องจราจร 1",
    "3.2.lane-2-day": "LPR Camera · ผลจากกล้องอ่านป้ายทะเบียนร่วมกับ WIM — ช่องจราจร 2 (ช่วงกลางวัน)",
    "3.2.lane-2-search": "LPR Camera · ภาพผลการค้นหาที่เชื่อมโยงกับกล้องอ่านป้ายทะเบียน — ช่องจราจร 2",
    "3.2.lane-3-day": "LPR Camera · ผลจากกล้องอ่านป้ายทะเบียนร่วมกับ WIM — ช่องจราจร 3 (ช่วงกลางวัน)",
    "3.2.lane-3-search": "LPR Camera · ภาพผลการค้นหาที่เชื่อมโยงกับกล้องอ่านป้ายทะเบียน — ช่องจราจร 3",
    "4.1.overview": "CCTV Camera System · ภาพรวมตำแหน่งกล้องโทรทัศน์วงจรปิดแบบ Fixed และ PTZ",
    "4.1.fixed-1-sn": "Fixed CCTV Camera · ภาพรุ่นและหมายเลขประจำเครื่องของกล้องโทรทัศน์วงจรปิดแบบมุมคงที่ #1",
    "4.1.fixed-2-sn": "Fixed CCTV Camera · ภาพรุ่นและหมายเลขประจำเครื่องของกล้องโทรทัศน์วงจรปิดแบบมุมคงที่ #2",
    "4.1.fixed-3-sn": "Fixed CCTV Camera · ภาพรุ่นและหมายเลขประจำเครื่องของกล้องโทรทัศน์วงจรปิดแบบมุมคงที่ #3",
    "4.1.fixed-4-sn": "Fixed CCTV Camera · ภาพรุ่นและหมายเลขประจำเครื่องของกล้องโทรทัศน์วงจรปิดแบบมุมคงที่ #4",
    "4.1.ptz-1-sn": "PTZ CCTV Camera · ภาพรุ่นและหมายเลขประจำเครื่องของกล้องโทรทัศน์วงจรปิดแบบปรับมุมมอง #1",
    "4.2.device": "Network Video Recorder · ภาพเครื่องบันทึกภาพผ่านเครือข่าย",
    "4.2.model-sn": "Network Video Recorder · ภาพรุ่นและหมายเลขประจำเครื่องของ NVR",
    "4.2.lan": "Network Video Recorder · ภาพการติดป้ายระบุสาย LAN ของ NVR",
    "4.2.cleaning-01": "Network Video Recorder · ภาพทำความสะอาดเครื่องบันทึกภาพ NVR — จุดที่ 1",
    "4.2.cleaning-02": "Network Video Recorder · ภาพทำความสะอาดเครื่องบันทึกภาพ NVR — จุดที่ 2",
    "4.2.cleaning-03": "Network Video Recorder · ภาพทำความสะอาดเครื่องบันทึกภาพ NVR — จุดที่ 3",
    "4.2.hdd": "Network Video Recorder · ภาพการตรวจสอบฮาร์ดดิสก์ (HDD)",
    "4.2.playback": "Network Video Recorder · ภาพผลทดสอบการเรียกดูภาพย้อนหลังจาก NVR",
    "5.1.device": "Database Server · ภาพเครื่องแม่ข่ายฐานข้อมูล",
    "5.1.model-sn": "Database Server · ภาพรุ่นและหมายเลขประจำเครื่องของเครื่องแม่ข่ายฐานข้อมูล",
    "5.1.lan": "Database Server · ภาพการติดป้ายระบุสาย LAN ของระบบฐานข้อมูล",
    "5.1.cleaning-01": "Database Server · ภาพทำความสะอาดเครื่องแม่ข่ายฐานข้อมูล — จุดที่ 1",
    "5.1.cleaning-02": "Database Server · ภาพทำความสะอาดเครื่องแม่ข่ายฐานข้อมูล — จุดที่ 2",
    "5.1.cleaning-03": "Database Server · ภาพทำความสะอาดเครื่องแม่ข่ายฐานข้อมูล — จุดที่ 3",
    "5.1.vehicle-document": "Database Management and Reporting System · ตรวจผลคัดแยกประเภทรถจาก API",
    "5.1.plate-document": "Database Management and Reporting System · ตรวจผลอ่านป้ายทะเบียนจาก API",
    "5.1.data-recording": "Database Management and Reporting System · ภาพตรวจว่าข้อมูลรถและป้ายทะเบียนถูกบันทึกในฐานข้อมูล",
    "6.1.display": "Data Management and Reporting Software · ภาพหน้าจอหรืออุปกรณ์แสดงผล",
    "6.1.report-print": "Data Management and Reporting Software · ภาพการสร้างและพิมพ์รายงาน",
    "6.1.vehicle-search": "Data Management and Reporting Software · ภาพผลการค้นหาข้อมูลรถรายคัน",
    "6.1.report-page": "Data Management and Reporting Software · ภาพหน้าผลรายงาน",
    "6.1.history-months": "Data Management and Reporting Software · ระยะเวลาย้อนหลังที่ค้นข้อมูลได้ (เดือน)",
    "6.1.central-connection": "Data Management and Reporting Software · ภาพสถานะการเชื่อมต่อกับระบบส่วนกลาง",
    "6.1.save-config": "Data Management and Reporting Software · บันทึกการตั้งค่าภาคสนาม (SAVE FIELD CONFIG)",
    "6.2.marker": "ภาพป้ายชื่อและรหัส Asset ของอุปกรณ์",
    "6.3.cabinet-overview": "WIM Electronics Cabinet · ภาพรวมภายนอกและภายในตู้ควบคุม",
    "6.3.around-cabinet-01": "WIM Electronics Cabinet · ภาพทำความสะอาดพื้นที่โดยรอบตู้ควบคุม — จุดที่ 1",
    "6.3.around-cabinet-02": "WIM Electronics Cabinet · ภาพทำความสะอาดพื้นที่โดยรอบตู้ควบคุม — จุดที่ 2",
    "6.3.around-cabinet-03": "WIM Electronics Cabinet · ภาพทำความสะอาดพื้นที่โดยรอบตู้ควบคุม — จุดที่ 3",
    "7.1.overview": "Variable Message Sign · ภาพรวมป้ายข้อความเปลี่ยนแปลงได้",
    "7.1.sign-check": "Variable Message Sign · ภาพผลทดสอบการแสดงข้อความบนป้าย VMS",
    "7.1.light-sensor-check": "VMS Light Sensor · ภาพผลทดสอบเซนเซอร์วัดแสง VMS",
    "7.1.display-check": "VMS Display · ภาพผลตรวจการเรียงลำดับจอภาพ VMS",
    "7.1.save-config": "VMS Control System · บันทึกการตั้งค่าภาคสนาม (SAVE FIELD CONFIG)",
  }),
  units: Object.freeze({}),
  helpers: Object.freeze({}),
});

// Previous current-template defaults are kept only for a safe one-time
// migration. If a stored copy still contains one of these exact defaults, it
// can receive the clearer wording below without touching a user-edited value.
const LEGACY_CURRENT_CHECKLIST_COPY_OVERRIDES = Object.freeze({
  sections: Object.freeze({
    "1.1": ["การเตรียมความพร้อม"],
    "2.1": ["ระบบคัดแยกน้ำหนักด้วย WIM (Sensor)", "ระบบตรวจจับ WIM (Sensor และ Loop)"],
    "2.2": ["ระบบควบคุม WIM"],
    "2.3": ["ระบบอิเล็กทรอนิกส์ WIM (WIM Electronics System)"],
    "3.1": ["ระบบควบคุมการอ่านป้ายทะเบียน"],
    "3.2": ["กล้องอ่านป้ายทะเบียน LPR", "กล้องอ่านป้ายทะเบียน (LPR)"],
    "4.1": ["กล้องวงจรปิด CCTV (Fixed และ PTZ)", "กล้องโทรทัศน์วงจรปิด (CCTV)"],
    "4.2": ["เครื่องบันทึกภาพ NVR", "เครื่องบันทึกภาพผ่านเครือข่าย (NVR)"],
    "5.1": ["เซิร์ฟเวอร์ฐานข้อมูลและระบบรายงาน", "ระบบจัดการฐานข้อมูลและการจัดทำรายงาน"],
    "6.1": ["ซอฟต์แวร์จัดการฐานข้อมูลและการจัดทำรายงาน", "โปรแกรมจัดการข้อมูลและรายงาน"],
    "6.2": ["การทำความสะอาดห้องควบคุม", "ทำความสะอาดห้องควบคุม"],
    "6.3": ["การทำความสะอาดตู้ควบคุม", "ทำความสะอาดตู้ควบคุมและพื้นที่โดยรอบ"],
    "7.1": ["ป้ายข้อความเปลี่ยนแปลงได้ VMS", "ป้ายข้อความเปลี่ยนแปลงได้ (VMS)"],
  }),
  items: Object.freeze({
    "1.1.staff": "พนักงานผู้ปฏิบัติงาน",
    "1.1.vehicle": "รถยนต์สำหรับปฏิบัติงาน",
    "1.1.crane": "รถบรรทุกติดตั้งเครน",
    "1.1.traffic-cone-light": "กรวยจราจรและป้ายไฟ",
    "1.1.tools": "เครื่องมือช่าง",
    "2.2.computer": "ภาพเครื่องคอมพิวเตอร์ควบคุม",
    "2.2.computer-model-sn": "ภาพรุ่นและหมายเลขประจำเครื่องของเครื่องคอมพิวเตอร์ควบคุม",
    "2.2.lan": "ภาพการทำเครื่องหมายสาย LAN ของระบบควบคุม WIM",
    "2.2.cleaning-01": "การทำความสะอาดเครื่องคอมพิวเตอร์ควบคุม ลำดับที่ 1",
    "2.2.cleaning-02": "การทำความสะอาดเครื่องคอมพิวเตอร์ควบคุม ลำดับที่ 2",
    "2.2.cleaning-03": "การทำความสะอาดเครื่องคอมพิวเตอร์ควบคุม ลำดับที่ 3",
    "2.3.ac-dc-01": "ภาพอุปกรณ์แปลงไฟฟ้า AC/DC ลำดับที่ 1",
    "2.3.ac-dc-02": "ภาพอุปกรณ์แปลงไฟฟ้า AC/DC ลำดับที่ 2",
    "2.3.network-01": "ภาพอุปกรณ์เชื่อมต่อเครือข่าย ลำดับที่ 1",
    "2.3.network-02": "ภาพอุปกรณ์เชื่อมต่อเครือข่าย ลำดับที่ 2",
    "2.3.main-current": "ภาพการตรวจวัดกระแสไฟฟ้าหลัก",
    "3.1.lane-1-day": "ภาพการทดสอบการอ่านป้ายทะเบียนจากระบบควบคุมร่วมกับ WIM — ช่องจราจร 1 (ช่วงกลางวัน)",
    "3.1.lane-1-search": "ภาพผลการค้นหาข้อมูลป้ายทะเบียนจากระบบควบคุม — ช่องจราจร 1",
    "3.2.overview": "ภาพรวมกล้องอ่านป้ายทะเบียน",
    "3.2.camera-1-sn": "ภาพรุ่นและหมายเลขประจำเครื่องของกล้อง LPR #1",
    "3.2.camera-2-sn": "ภาพรุ่นและหมายเลขประจำเครื่องของกล้อง LPR #2",
    "3.2.camera-3-sn": "ภาพรุ่นและหมายเลขประจำเครื่องของกล้อง LPR #3",
    "3.2.camera-1-cleaning": "การทำความสะอาดกล้อง LPR #1",
    "3.2.camera-2-cleaning": "การทำความสะอาดกล้อง LPR #2",
    "3.2.camera-3-cleaning": "การทำความสะอาดกล้อง LPR #3",
    "3.2.lane-1-day": "ภาพจากกล้อง LPR ขณะอ่านป้ายทะเบียนร่วมกับ WIM — ช่องจราจร 1 (ช่วงกลางวัน)",
    "3.2.lane-1-search": "ภาพผลการค้นหาที่เชื่อมโยงกับกล้อง LPR — ช่องจราจร 1",
    "3.2.lane-2-day": "ภาพจากกล้อง LPR ขณะอ่านป้ายทะเบียนร่วมกับ WIM — ช่องจราจร 2 (ช่วงกลางวัน)",
    "3.2.lane-2-search": "ภาพผลการค้นหาที่เชื่อมโยงกับกล้อง LPR — ช่องจราจร 2",
    "3.2.lane-3-day": "ภาพจากกล้อง LPR ขณะอ่านป้ายทะเบียนร่วมกับ WIM — ช่องจราจร 3 (ช่วงกลางวัน)",
    "3.2.lane-3-search": "ภาพผลการค้นหาที่เชื่อมโยงกับกล้อง LPR — ช่องจราจร 3",
    "4.1.overview": "ภาพรวมกล้อง CCTV แบบ Fixed และ PTZ",
    "4.1.fixed-1-sn": "ภาพรุ่นและหมายเลขประจำเครื่องของกล้อง CCTV แบบ Fixed #1",
    "4.1.fixed-2-sn": "ภาพรุ่นและหมายเลขประจำเครื่องของกล้อง CCTV แบบ Fixed #2",
    "4.1.fixed-3-sn": "ภาพรุ่นและหมายเลขประจำเครื่องของกล้อง CCTV แบบ Fixed #3",
    "4.1.fixed-4-sn": "ภาพรุ่นและหมายเลขประจำเครื่องของกล้อง CCTV แบบ Fixed #4",
    "4.1.ptz-1-sn": "ภาพรุ่นและหมายเลขประจำเครื่องของกล้อง CCTV แบบ PTZ #1",
    "4.2.device": "ภาพเครื่องบันทึกภาพผ่านเครือข่าย",
    "4.2.model-sn": "ภาพรุ่นและหมายเลขประจำเครื่องของ NVR",
    "4.2.lan": "ภาพการทำเครื่องหมายสาย LAN ของ NVR",
    "4.2.cleaning-01": "การทำความสะอาดเครื่องบันทึกภาพ (NVR) ลำดับที่ 1",
    "4.2.cleaning-02": "การทำความสะอาดเครื่องบันทึกภาพ (NVR) ลำดับที่ 2",
    "4.2.cleaning-03": "การทำความสะอาดเครื่องบันทึกภาพ (NVR) ลำดับที่ 3",
    "4.2.hdd": "ภาพการตรวจสอบฮาร์ดดิสก์ (HDD)",
    "4.2.playback": "ภาพการทดสอบการเรียกดูข้อมูลย้อนหลัง",
    "5.1.device": "ภาพเครื่องแม่ข่ายระบบฐานข้อมูล",
    "5.1.model-sn": "ภาพรุ่นและหมายเลขประจำเครื่องของระบบฐานข้อมูล",
    "5.1.lan": "ภาพการทำเครื่องหมายสาย LAN ของระบบฐานข้อมูล",
    "5.1.cleaning-01": "การทำความสะอาดระบบฐานข้อมูล ลำดับที่ 1",
    "5.1.cleaning-02": "การทำความสะอาดระบบฐานข้อมูล ลำดับที่ 2",
    "5.1.cleaning-03": "การทำความสะอาดระบบฐานข้อมูล ลำดับที่ 3",
    "5.1.vehicle-document": "เอกสารการจำแนกประเภทรถ",
    "5.1.plate-document": "เอกสารการจำแนกป้ายทะเบียน",
    "6.1.display": "ภาพอุปกรณ์แสดงผล",
    "6.1.report-print": "ภาพการจัดทำและพิมพ์รายงาน",
    "6.1.vehicle-search": "ภาพการค้นหาข้อมูลรายคัน",
    "6.1.report-page": "ภาพหน้ารายงาน",
    "6.1.history-months": "จำนวนเดือนสูงสุดที่สามารถค้นหาข้อมูลย้อนหลังได้",
    "6.1.save-config": "บันทึกการตั้งค่าภาคสนาม (SAVE FIELD CONFIG)",
    "6.2.marker": "ภาพป้ายระบุชื่ออุปกรณ์",
    "6.3.cabinet-overview": "ภาพรวมตู้ควบคุม",
    "6.3.around-cabinet-01": "การทำความสะอาดบริเวณรอบตู้ควบคุม ลำดับที่ 1",
    "6.3.around-cabinet-02": "การทำความสะอาดบริเวณรอบตู้ควบคุม ลำดับที่ 2",
    "6.3.around-cabinet-03": "การทำความสะอาดบริเวณรอบตู้ควบคุม ลำดับที่ 3",
    "7.1.overview": "ภาพรวมป้ายข้อความเปลี่ยนแปลงได้",
    "7.1.sign-check": "ภาพการทดสอบการทำงานของป้าย VMS",
    "7.1.light-sensor-check": "ภาพการทดสอบการทำงานของเซนเซอร์วัดแสง",
    "7.1.display-check": "ภาพการตรวจสอบการจัดเรียงจอภาพ",
    "7.1.save-config": "บันทึกการตั้งค่าภาคสนาม (SAVE FIELD CONFIG)",
  }),
});

export const EVIDENCE_STATUS_OPTIONS = [
  { value: "pending", label: "ยังไม่ได้ระบุ" },
  { value: "complete", label: "หลักฐานครบถ้วน" },
  { value: "no-image", label: "ไม่มีภาพถ่าย" },
  { value: "missing", label: "หลักฐานไม่ครบถ้วน" },
  { value: "not-installed", label: "ไม่ได้ติดตั้ง" },
  { value: "server-site", label: "จัดเก็บไว้ที่เครื่องแม่ข่ายประจำสถานี" },
  { value: "na", label: "ไม่เกี่ยวข้อง" },
];

export const EVIDENCE_STATUS_LABELS = Object.fromEntries(
  EVIDENCE_STATUS_OPTIONS.map((option) => [option.value, option.label]),
);

const SOURCE_FILES = {
  "1.1": "1.pdf",
  "2.1": "2.1.pdf",
  "2.2": "2.2.pdf",
  "2.3": "2.3.pdf",
  "3.1": "3.1.pdf",
  "3.2": "3.2.pdf",
  "4.1": "4.1.pdf",
  "4.2": "4.2.pdf",
  "5.1": "5.1.pdf",
  "6.1": "6.1.pdf",
  "6.2": "6.2.pdf",
  "6.3": "6.3.pdf",
  "7.1": "7.1.pdf",
};

function normalizeObservedStatus(status) {
  return EVIDENCE_STATUS_OPTIONS.some((option) => option.value === status) ? status : null;
}

function sourceSlot(sectionCode, id, sourceLabel, sourceOrder, options = {}) {
  return {
    id: `${sectionCode}.${id}.evidence`,
    sourceFile: options.sourceFile || SOURCE_FILES[sectionCode],
    sourceLabel,
    displayLabel: options.displayLabel || sourceLabel,
    sourceOrder,
    fieldType: options.fieldType || "photo",
    required: options.required !== false,
    sourceObservedStatus: normalizeObservedStatus(options.sourceObservedStatus),
  };
}

function sourceItem(sectionCode, id, sourceLabel, sourceOrder, options = {}) {
  const displayLabel = options.displayLabel || sourceLabel;
  const slot = sourceSlot(sectionCode, id, sourceLabel, sourceOrder, { ...options, displayLabel });
  const inputType = options.inputType || (options.unit ? "number" : "none");
  const helper = options.helper
    || (options.fieldType === "document"
      ? "แนบเอกสารที่เกี่ยวข้องกับหัวข้อนี้"
      : inputType === "number"
        ? "กรอกค่าที่วัดได้และแนบภาพจุดวัด"
        : inputType === "text"
          ? "กรอกข้อมูลที่ตรวจพบและแนบหลักฐานที่เกี่ยวข้อง"
          : "แนบภาพหลักฐานให้เห็นอุปกรณ์หรือจุดตรวจตามหัวข้อนี้");
  return {
    id: `${sectionCode}.${id}`,
    label: displayLabel,
    displayLabel,
    vehicleReviewContext: options.vehicleReviewContext || null,
    checklistNumber: options.checklistNumber || null,
    unit: options.unit || "",
    helper,
    inputType,
    fieldType: options.fieldType || "photo",
    repeatScope: options.repeatScope || "fixed",
    legacyIds: options.legacyIds || [],
    sourceFile: slot.sourceFile,
    sourceLabel,
    sourceOrder,
    evidenceSlots: [slot],
  };
}

function buildDynamicWimElectronicsItem(asset, id, label, sourceOrder, {
  unit = "",
  inputType = "none",
  fieldType = "photo",
  helper = "ตรวจอุปกรณ์ตามทะเบียนสถานีและแนบหลักฐานที่เกี่ยวข้อง",
  slots = [{ id: "check", label }],
  parentLabel = "",
} = {}) {
  const itemId = `2.3.${id}`;
  const itemSlots = slots.map((slot, index) => sourceSlot(
    "2.3",
    `${id}.${slot.id || index + 1}`,
    slot.sourceLabel || slot.label || label,
    sourceOrder + index,
    {
      displayLabel: slot.label || slot.sourceLabel || label,
      fieldType: slot.fieldType || fieldType,
      sourceObservedStatus: slot.sourceObservedStatus,
      required: slot.required,
    },
  ));
  return {
    id: itemId,
    label,
    displayLabel: label,
    unit,
    helper,
    inputType,
    fieldType,
    repeatScope: "per-asset",
    legacyIds: [],
    sourceFile: SOURCE_FILES["2.3"],
    sourceLabel: label,
    sourceOrder,
    evidenceSlots: itemSlots,
    sectionCode: "2.3",
    sectionTitle: CHECKLIST_SECTION_TITLES["2.3"],
    assetId: asset?.id || null,
    assetNo: asset?.assetNo || "",
    location: asset?.location || parentLabel || "",
    serialNo: asset?.serialNo || "",
    assetDependent: Boolean(asset),
    assetBinding: asset ? { assetId: asset.id } : null,
    applicable: true,
    checklistDisabled: false,
    isDynamicWimElectronics: true,
  };
}

function buildDynamicWimElectronicsItems(snapshot, equipment) {
  const active = equipment.filter((entry) => entry?.active !== false);
  const cabinets = active.filter((entry) => entry.type === "CONTROL_CABINET");
  const children = active.filter((entry) => isWimElectronicsSubEquipmentType(entry.type));
  const items = [];
  let sourceOrder = 5000;
  const nextOrder = () => sourceOrder++;
  const parentLabelFor = (asset) => {
    const parent = active.find((entry) => entry.id === asset?.parentAssetId);
    return parent?.assetNo ? `ตู้ ${parent.assetNo}` : "";
  };
  const add = (asset, id, label, options = {}) => items.push(buildDynamicWimElectronicsItem(asset, id, label, nextOrder(), {
    ...options,
    parentLabel: parentLabelFor(asset),
  }));

  (cabinets.length ? cabinets : [null]).forEach((cabinet) => {
    const suffix = cabinet?.id ? `-${cabinet.id}` : "";
    const identity = cabinet?.assetNo ? ` · ${cabinet.assetNo}` : "";
    add(cabinet, `cabinet-overview${suffix}`, `WIM Electronics Cabinet · ภาพรวมตู้ควบคุมอิเล็กทรอนิกส์ WIM${identity}`, {
      slots: [
        { id: "outside", label: `WIM Electronics Cabinet · ภาพภายนอกตู้ควบคุมอิเล็กทรอนิกส์ WIM${identity}` },
        { id: "inside", label: `WIM Electronics Cabinet · ภาพภายในตู้ควบคุมอิเล็กทรอนิกส์ WIM${identity}` },
      ],
    });
    add(cabinet, `electrical-control${suffix}`, `WIM Electronics Cabinet · อุปกรณ์ควบคุมไฟฟ้าภายในตู้${identity}`);
    add(cabinet, `incoming-main${suffix}`, `WIM Electronics Cabinet · ไฟฟ้าหลักขาเข้า${identity}`, { unit: "V", inputType: "number" });
    add(cabinet, `main-current${suffix}`, `WIM Electronics Cabinet · กระแสไฟฟ้าหลัก${identity}`, { unit: "A", inputType: "number" });
  });

  children.forEach((asset) => {
    const identity = asset.assetNo ? ` · ${asset.assetNo}` : "";
    const parent = parentLabelFor(asset);
    const context = parent ? ` (${parent})` : "";
    if (asset.type === "WIM_CONTROLLER") {
      add(asset, `controller-${asset.id}-identity`, `WIM Controller · ตัวควบคุม WIM${identity}${context}`, {
        slots: [
          { id: "overview", label: `WIM Controller · ภาพตัวควบคุม WIM และหมายเลขประจำเครื่อง${identity}` },
          { id: "condition", label: `WIM Controller · ภาพสภาพการทำงานของตัวควบคุม WIM${identity}` },
        ],
      });
      add(asset, `controller-${asset.id}-cal-factor`, `WIM Controller · Cal Factor${identity}${context}`, {
        slots: [{ id: "cal-factor", label: `WIM Controller · ภาพค่า Cal Factor${identity}` }],
      });
      return;
    }
    if (isWimElectronicsOutputAsset(asset)) {
      const voltages = normalizeWimElectronicsOutputVoltages(asset.outputVoltages);
      (voltages.length ? voltages : [null]).forEach((voltage) => {
        const voltageLabel = voltage ? ` ${voltage}VDC` : " Output ยังไม่ระบุแรงดัน";
        const voltageKey = voltage ? `${voltage}vdc` : "unassigned";
        add(asset, `switching-dc-${asset.id}-${voltageKey}`, `Switching DC Power Supply · ชุดจ่ายไฟ DC แบบสวิตชิ่ง${identity} · Output${voltageLabel}${context}`, {
          unit: "V",
          inputType: "number",
          helper: voltage ? `วัดแรงดัน Output ${voltage}VDC และแนบภาพจุดวัด` : "เลือกแรงดัน Output ของ Switching DC ในทะเบียนก่อนตรวจ",
          slots: [{ id: voltageKey, label: `Switching DC Power Supply · ค่าที่วัดได้จากชุดจ่ายไฟ DC แบบสวิตชิ่ง${voltageLabel}${identity}` }],
        });
      });
      return;
    }
    if (asset.type === "WIM_TRANSFORMER_24VAC") {
      add(asset, `transformer-${asset.id}`, `Transformer AC 24VAC · หม้อแปลงไฟ AC 24VAC${identity}${context}`, {
        unit: "V",
        inputType: "number",
        slots: [{ id: "output", label: `Transformer AC 24VAC · ค่าที่วัดได้จากหม้อแปลงไฟ AC 24VAC${identity}` }],
      });
      return;
    }
    if (asset.type === "WIM_PHASE_PROTECTION") {
      add(asset, `phase-protection-${asset.id}`, `Phase Protection · อุปกรณ์ป้องกันเฟส ขาออก${identity}${context}`, {
        unit: "V",
        inputType: "number",
        slots: [{ id: "output", label: `Phase Protection · ค่าที่วัดได้จากอุปกรณ์ป้องกันเฟส${identity}` }],
      });
      return;
    }
    if (asset.type === "WIM_SUB_BREAKER") {
      add(asset, `sub-breaker-${asset.id}`, `Sub Breaker · เบรกเกอร์ย่อย ขาออก${identity}${context}`, {
        unit: "V",
        inputType: "number",
        slots: [{ id: "output", label: `Sub Breaker · ค่าที่วัดได้จากเบรกเกอร์ย่อย${identity}` }],
      });
      return;
    }
    add(asset, `${String(asset.type).toLowerCase()}-${asset.id}`, `${checklistEquipmentName(asset.type, asset.catalogItemLabel || asset.sourceLabel || "อุปกรณ์ WIM Electronics")}${identity}${context}`);
  });

  if (snapshot?.wimElectronicsUnusedNote !== false) {
    add(null, "unused-note", "จุดที่ไม่ได้ใช้งานหรือไม่ได้ติดตั้ง", {
      slots: [{ id: "note", label: "ภาพหรือหมายเหตุจุดที่ไม่ได้ใช้งาน", fieldType: "photo" }],
      helper: "ระบุจุดที่ไม่ได้ใช้งานเพื่อไม่ให้สับสนกับรายการที่ยังไม่ได้ตรวจ",
    });
  }
  return items;
}

function hasWimElectronicsContext(equipment = []) {
  return equipment.some((entry) => entry?.active !== false
    && (entry.type === "CONTROL_CABINET" || isWimElectronicsSubEquipmentType(entry.type)));
}

function photoItems(sectionCode, startOrder, entries, options = {}) {
  return entries.map((entry, index) => {
    const [id, label, itemOptions = {}] = entry;
    return sourceItem(sectionCode, id, label, startOrder + index, { ...options, ...itemOptions });
  });
}

function repeatedItems(sectionCode, startOrder, prefix, label, count, options = {}) {
  return Array.from({ length: count }, (_, index) => sourceItem(
    sectionCode,
    `${prefix}-${String(index + 1).padStart(2, "0")}`,
    `${label} #${index + 1}`,
    startOrder + index,
    {
      ...options,
      displayLabel: typeof options.displayLabelFor === "function"
        ? options.displayLabelFor(index)
        : options.displayLabel,
      repeatScope: options.repeatScope || "fixed",
      legacyIds: Array.isArray(options.legacyIds) ? [options.legacyIds[index]].filter(Boolean) : options.legacyIds,
    },
  ));
}

const sections = [
  {
    code: "1.1",
    title: "การแสดงความพร้อม",
    items: photoItems("1.1", 1, [
      ["staff", "พนักงานเข้าปฏิบัติงาน", { legacyIds: ["staff-count"] }],
      ["vehicle", "รถยนต์", { legacyIds: ["vehicle-count"] }],
      ["crane", "รถเฮี๊ยบ", { sourceObservedStatus: "no-image" }],
      ["traffic-cone-light", "กรวยปิดจราจร + ป้ายไฟ"],
      ["tools", "อุปกรณ์เครื่องช่าง", { legacyIds: ["tool-count"] }],
      ["road-closure", "ภาพตอนตั้งกรวยปิดถนนทำงาน"],
    ]),
  },
  {
    code: "2.1",
    title: "WIM SORTING SYSTEM (SENSOR)",
    items: [
      ...photoItems("2.1", 1, [
        ["road-01", "ภาพที่ 1: ภาพหน้างาน"],
        ["road-02", "ภาพที่ 2: ภาพหน้างาน"],
        ["road-03", "ภาพที่ 3: ภาพหน้างาน"],
      ]),
      ...repeatedItems("2.1", 4, "sensor-set-1", "วัดค่า SENSOR", 3, { unit: "ค่า", inputType: "number", repeatScope: "fixed", legacyIds: ["sensor-1", "sensor-2", "sensor-3"], displayLabelFor: (index) => `ค่าที่วัดได้จากเซนเซอร์ชั่งน้ำหนัก WIM #${index + 1}` }),
      ...repeatedItems("2.1", 7, "sensor-set-2", "วัดค่า SENSOR", 3, { unit: "ค่า", inputType: "number", repeatScope: "fixed", displayLabelFor: (index) => `ค่าที่วัดได้จากเซนเซอร์ชั่งน้ำหนัก WIM #${index + 4}` }),
      ...repeatedItems("2.1", 10, "sensor-set-3", "วัดค่า SENSOR", 3, { unit: "ค่า", inputType: "number", repeatScope: "fixed", displayLabelFor: (index) => `ค่าที่วัดได้จากเซนเซอร์ชั่งน้ำหนัก WIM #${index + 7}` }),
      ...repeatedItems("2.1", 13, "sensor-set-4", "วัดค่า SENSOR", 3, { unit: "ค่า", inputType: "number", repeatScope: "fixed", displayLabelFor: (index) => `ค่าที่วัดได้จากเซนเซอร์ชั่งน้ำหนัก WIM #${index + 10}` }),
      ...repeatedItems("2.1", 16, "loop", "วัดค่า LOOP", 6, { unit: "ค่า", inputType: "number", repeatScope: "fixed", legacyIds: ["loop-1", "loop-2", "loop-3", "loop-4", "loop-5", "loop-6"] }),
    ],
  },
  {
    code: "2.2",
    title: "WIM CONTROL SYSTEM FOR IMPS",
    items: photoItems("2.2", 1, [
      ["computer", "ภาพที่ 1: ภาพ Computer", { legacyIds: ["control-computer"] }],
      ["computer-model-sn", "ภาพที่ 2: ภาพรุ่น + SN"],
      ["lan", "ภาพที่ 3: ภาพมาร์คสาย LAN ของ WIM CONTROL SYSTEM FOR IMPS", { legacyIds: ["control-network"] }],
      ["cleaning-01", "ภาพที่ 4: ภาพทำความสะอาด", { legacyIds: ["control-cleaning"] }],
      ["cleaning-02", "ภาพที่ 5: ภาพทำความสะอาด"],
      ["cleaning-03", "ภาพที่ 6: ภาพทำความสะอาด"],
    ]),
  },
  {
    code: "2.3",
    title: "WIM Electronics System for IMPS",
    items: photoItems("2.3", 1, [
      ["cabinet-overview", "ภาพรวมภายในตู้", { legacyIds: ["electronic-cabinet"] }],
      ["electrical-control", "ภาพอุปกรณ์ควบคุมไฟฟ้า"],
      ["ac-dc-01", "ภาพอุปกรณ์แปลงไฟฟ้า AC DC", { displayLabel: "ภาพอุปกรณ์แปลงไฟฟ้า AC DC #1" }],
      ["network-01", "ภาพอุปกรณ์เชื่อมเครือข่าย Network", { displayLabel: "ภาพอุปกรณ์เชื่อมเครือข่าย Network #1" }],
      ["network-02", "ภาพอุปกรณ์เชื่อมเครือข่าย Network", { displayLabel: "ภาพอุปกรณ์เชื่อมเครือข่าย Network #2" }],
      ["ac-dc-02", "ภาพอุปกรณ์แปลงไฟฟ้า AC DC", { displayLabel: "ภาพอุปกรณ์แปลงไฟฟ้า AC DC #2" }],
      ["main-current", "ภาพวัดกระแสไฟฟ้าในตู้ (A)", { unit: "A", inputType: "number", legacyIds: ["main-current"] }],
      ["wim-controller-01", "ภาพ WIM CONTROLLER + SN #1"],
      ["wim-controller-02", "ภาพ WIM CONTROLLER + SN #2"],
      ["wim-controller-03", "ภาพ WIM CONTROLLER + SN #3"],
      ["cal-factor-1", "ภาพ CAL FACTOR #1"],
      ["cal-factor-2", "ภาพ CAL FACTOR #2"],
      ["cal-factor-3", "ภาพ CAL FACTOR #3"],
      ["incoming-main", "ภาพวัดไฟฟ้าหลัก ขาเข้า", { unit: "V", inputType: "number" }],
      ["phase-protection", "ขาออกจาก PHASE PROTECTION", { unit: "V", inputType: "number" }],
      ["sub-breaker-1", "ขาออกจาก SUB BREAKER #1", { unit: "V", inputType: "number" }],
      ["sub-breaker-2", "ขาออกจาก SUB BREAKER #2", { unit: "V", inputType: "number" }],
      ["sub-breaker-3", "ขาออกจาก SUB BREAKER #3", { unit: "V", inputType: "number" }],
      ["sub-breaker-4", "ขาออกจาก SUB BREAKER #4", { unit: "V", inputType: "number" }],
      ["switching-dc-1", "ภาพวัดไฟฟ้าหลัก Switching DC #1", { unit: "V", inputType: "number", legacyIds: ["switching-voltage"] }],
      ["switching-dc-2", "ภาพวัดไฟฟ้าหลัก Switching DC #2", { unit: "V", inputType: "number" }],
      ["switching-dc-3", "ขาออกจาก Switching DC #3", { unit: "V", inputType: "number" }],
      ["transformer-24v-1", "ขาออกจาก Transformers AC 24VAC #1", { unit: "V", inputType: "number", legacyIds: ["transformer-voltage"] }],
      ["transformer-24v-2", "ขาออกจาก Transformers AC 24VAC #2", { unit: "V", inputType: "number" }],
      ["transformer-24v-3", "ขาออกจาก Transformers AC 24VAC #3", { unit: "V", inputType: "number" }],
      ["unused-note", "จุดที่ระบุว่าไม่ได้ใช้งาน", { sourceObservedStatus: "not-installed" }],
    ]),
  },
  {
    code: "3.1",
    title: "ระบบควบคุมการอ่านป้ายทะเบียน",
    items: [
      ...[1, 2, 3].flatMap((lane, laneIndex) => [
        sourceItem("3.1", `lane-${lane}-day`, `ภาพอ่านป้ายทะเบียนพร้อมระบบ WIM ช่องจราจร ${lane} (กลางวัน)`, laneIndex * 3 + 1, { repeatScope: "per-lane", fieldType: "photo", displayLabel: `ผลทดสอบการอ่านป้ายทะเบียนร่วมกับ WIM — ช่องจราจร ${lane} (ช่วงกลางวัน)`, legacyIds: lane === 1 ? ["lpr-lane-1"] : lane === 2 ? ["lpr-lane-2"] : ["lpr-lane-3"] }),
        sourceItem("3.1", `lane-${lane}-search`, `ภาพระบบค้นหาป้ายทะเบียนช่องจราจรที่ ${lane}`, laneIndex * 3 + 3, { repeatScope: "per-lane", displayLabel: `ภาพผลการค้นหาป้ายทะเบียน — ช่องจราจร ${lane}`, sourceObservedStatus: lane === 3 ? "missing" : null }),
      ]),
    ],
  },
  {
    code: "3.2",
    title: "LPR Camera",
    items: [
      ...photoItems("3.2", 1, [
        ["overview", "ภาพรวมกล้องอ่านป้ายทะเบียน LPR CAMERA"],
        ["camera-1-sn", "ภาพ LPR CAMERA #1 SN"],
        ["camera-2-sn", "ภาพ LPR CAMERA #2 SN"],
        ["camera-3-sn", "ภาพ LPR CAMERA #3 SN"],
        ["camera-1-cleaning", "ภาพทำความสะอาด LPR CAMERA #1", { displayLabel: "ภาพทำความสะอาด LPR CAMERA #1 - ภาพที่ 1" }],
        ["camera-2-cleaning", "ภาพทำความสะอาด LPR CAMERA #2", { displayLabel: "ภาพทำความสะอาด LPR CAMERA #2 - ภาพที่ 1" }],
        ["camera-3-cleaning", "ภาพทำความสะอาด LPR CAMERA #3", { displayLabel: "ภาพทำความสะอาด LPR CAMERA #3 - ภาพที่ 1" }],
      ]),
      ...repeatedItems("3.2", 8, "cleaning-row", "ภาพทำความสะอาด LPR CAMERA", 3, { repeatScope: "fixed", displayLabelFor: (index) => `ภาพทำความสะอาดกล้อง LPR #${index + 1} — จุดที่ 2` }),
      ...[1, 2, 3].flatMap((lane, laneIndex) => [
        sourceItem("3.2", `lane-${lane}-day`, `ภาพอ่านป้ายทะเบียนพร้อมระบบ WIM ช่องจราจร ${lane} (กลางวัน)`, 11 + laneIndex * 3, { repeatScope: "per-lane", displayLabel: `ผลจากกล้อง LPR ขณะอ่านป้ายทะเบียนร่วมกับ WIM — ช่องจราจร ${lane} (ช่วงกลางวัน)`, legacyIds: lane === 1 ? ["lpr-camera-1"] : lane === 2 ? ["lpr-camera-2"] : ["lpr-camera-3"] }),
        sourceItem("3.2", `lane-${lane}-search`, `ภาพระบบค้นหาป้ายทะเบียนช่องจราจรที่ ${lane}`, 13 + laneIndex * 3, { repeatScope: "per-lane", displayLabel: `ภาพผลการค้นหาที่เชื่อมโยงกับกล้อง LPR — ช่องจราจร ${lane}`, sourceObservedStatus: lane === 2 ? "missing" : null }),
      ]),
      ...repeatedItems("3.2", 20, "voltage", "ภาพวัดแรงดันไฟฟ้าสำหรับกล้อง LPR CAMERA", 3, { unit: "V", inputType: "number", repeatScope: "per-asset", displayLabelFor: (index) => `ค่าที่วัดได้จากกล้อง LPR #${index + 1}`, legacyIds: ["lpr-camera-1", "lpr-camera-2", "lpr-camera-3"] }),
    ],
  },
  {
    code: "4.1",
    title: "CCTV Camera",
    items: [
      ...photoItems("4.1", 1, [
        ["overview", "ภาพรวม FIXED CAMERA & PTZ"],
        ["fixed-1-sn", "ภาพ FIXED CAMERA #1 SN"],
        ["fixed-2-sn", "ภาพ FIXED CAMERA #2 SN"],
        ["fixed-3-sn", "ภาพ FIXED CAMERA #3 SN"],
        ["fixed-4-sn", "ภาพ FIXED CAMERA #4 SN"],
        ["ptz-1-sn", "ภาพ PTZ CAMERA #1 SN", { sourceObservedStatus: "not-installed" }],
        ["fixed-1-cleaning", "ภาพรวมทำความสะอาด FIXED CAMERA #1"],
        ["fixed-2-cleaning", "ภาพรวมทำความสะอาด FIXED CAMERA #2"],
        ["fixed-3-cleaning", "ภาพรวมทำความสะอาด FIXED CAMERA #3"],
        ["fixed-4-cleaning", "ภาพรวมทำความสะอาด FIXED CAMERA #4"],
        ["ptz-2-overview-cleaning", "ภาพรวมทำความสะอาด FIXED PTZ #2", { sourceObservedStatus: "not-installed" }],
        ["ptz-4-cleaning", "ภาพทำความสะอาด FIXED PTZ #4", { sourceObservedStatus: "not-installed" }],
      ]),
      ...repeatedItems("4.1", 13, "fixed-voltage", "ภาพวัดแรงดันไฟฟ้า FIXED CAMERA", 4, { unit: "V", inputType: "number", repeatScope: "per-asset", displayLabelFor: (index) => `ค่าที่วัดได้จากกล้อง CCTV แบบ Fixed #${index + 1}`, legacyIds: ["fixed-camera-1", "fixed-camera-2", "fixed-camera-3", "fixed-camera-4"] }),
      ...repeatedItems("4.1", 17, "fixed-sd-card", "ติดตั้ง SD CARD สำหรับ FIXED CAMERA", 4, { repeatScope: "per-asset", displayLabelFor: (index) => `ตรวจ SD Card ของกล้อง CCTV แบบ Fixed #${index + 1}`, sourceObservedStatus: "not-installed" }),
      ...repeatedItems("4.1", 21, "fixed-cleaning-detail", "ภาพทำความสะอาด FIXED CAMERA", 4, { repeatScope: "per-asset", displayLabelFor: (index) => `ภาพทำความสะอาดกล้อง CCTV แบบ Fixed #${index + 1}` }),
      ...repeatedItems("4.1", 25, "ptz-voltage", "ภาพวัดแรงดันไฟฟ้า FIXED PTZ", 4, { unit: "V", inputType: "number", repeatScope: "per-asset", displayLabelFor: (index) => `ค่าที่วัดได้จากกล้อง CCTV แบบ PTZ #${index + 1}`, sourceObservedStatus: "not-installed" }),
      ...repeatedItems("4.1", 29, "ptz-cleaning-detail", "ภาพทำความสะอาด FIXED PTZ", 3, { repeatScope: "per-asset", displayLabelFor: (index) => `ภาพทำความสะอาดกล้อง CCTV แบบ PTZ #${index + 1}`, sourceObservedStatus: "not-installed" }),
    ],
  },
  {
    code: "4.2",
    title: "Network Video Recorder (NVR)",
    items: photoItems("4.2", 1, [
      ["device", "ภาพอุปกรณ์เครื่องบันทึก", { legacyIds: ["nvr-count"] }],
      ["model-sn", "ภาพรุ่น + SN"],
      ["lan", "ภาพการมาร์คสาย LAN ของ WIM CONTROL SYSTEM FOR IMPS"],
      ["cleaning-01", "ภาพที่ 4: ภาพทำความสะอาด"],
      ["cleaning-02", "ภาพที่ 5: ภาพทำความสะอาด"],
      ["cleaning-03", "ภาพที่ 6: ภาพทำความสะอาด"],
      ["hdd", "ภาพตรวจสอบ HDD", { sourceObservedStatus: "missing", legacyIds: ["nvr-hdd"] }],
      ["playback", "ภาพการย้อนหลัง", { legacyIds: ["nvr-retention"] }],
    ]),
  },
  {
    code: "5.1",
    title: "Database Management and Reporting System",
    items: photoItems("5.1", 1, [
      ["device", "ภาพอุปกรณ์เครื่อง DATABASE", { legacyIds: ["database-server"] }],
      ["model-sn", "ภาพรุ่น + SN", { sourceObservedStatus: "server-site" }],
      ["lan", "ภาพมาร์คสาย LAN ของ DATABASE", { sourceObservedStatus: "server-site", legacyIds: ["database-network"] }],
      ["cleaning-01", "ภาพทำความสะอาด", { displayLabel: "ภาพทำความสะอาด #1", sourceObservedStatus: "server-site", legacyIds: ["database-cleaning"] }],
      ["cleaning-02", "ภาพทำความสะอาด", { displayLabel: "ภาพทำความสะอาด #2", sourceObservedStatus: "server-site" }],
      ["cleaning-03", "ภาพทำความสะอาด", { displayLabel: "ภาพทำความสะอาด #3", sourceObservedStatus: "server-site" }],
      ["data-recording", "ภาพการบันทึกข้อมูล"],
      ["plate-document", "เอกสารผลการจำแนกป้ายทะเบียน", { fieldType: "document", vehicleReviewContext: "plate", checklistNumber: "5.1.5", helper: "แนบเอกสารผลทดสอบป้ายทะเบียน และตรวจผลรายคันเทียบกับภาพป้ายทะเบียนจาก API" }],
      ["vehicle-document", "เอกสารผลการจำแนกประเภทรถ", { fieldType: "document", vehicleReviewContext: "classification", checklistNumber: "5.1.6", helper: "แนบเอกสารผลคัดแยกประเภทรถ และตรวจประเภท เพลา และน้ำหนักเทียบกับภาพรถจาก API" }],
    ]),
  },
  {
    code: "6.1",
    title: "Database Management and Reporting System (software)",
    items: photoItems("6.1", 1, [
      ["display", "ภาพอุปกรณ์เครื่องแสดงผล"],
      ["report-print", "ภาพการออกรายงาน ปริ้นเอกสาร", { legacyIds: ["software-report"] }],
      ["vehicle-search", "ภาพการค้นหารายงานรายคัน (หน้าสืบค้นข้อมูล)", { legacyIds: ["software-vehicle-search"] }],
      ["report-page", "ภาพการค้นหารายงาน (หน้ารายงาน)"],
      ["central-connection", "ภาพเชื่อมต่อส่วนกลาง", { legacyIds: ["software-history"] }],
      ["history-months", "จำนวนเดือนสูงสุดที่ค้นย้อนหลังได้", { fieldType: "text", inputType: "text", unit: "เดือน" }],
      ["save-config", "SAVE FIELD CONFIG", { fieldType: "document" }],
    ]),
  },
  {
    code: "6.2",
    title: "ทำความสะอาดห้องควบคุม",
    items: [
      sourceItem("6.2", "marker", "ภาพมาร์คเกอร์ชื่ออุปกรณ์", 1, { legacyIds: ["control-room-markers"] }),
      ...repeatedItems("6.2", 2, "room-cleaning", "ภาพทำความสะอาดห้องควบคุม", 11, { repeatScope: "fixed", displayLabelFor: (index) => `ภาพทำความสะอาดห้องควบคุม — จุดที่ ${index + 1}`, legacyIds: ["control-room-cleaning"] }),
    ],
  },
  {
    code: "6.3",
    title: "ทำความสะอาดตู้ควบคุม",
    items: [
      sourceItem("6.3", "cabinet-overview", "ภาพรวมตู้ควบคุม", 1, { legacyIds: ["cabinet-count"] }),
      ...repeatedItems("6.3", 2, "cabinet-cleaning", "ภาพทำความสะอาดตู้ควบคุม", 2, { repeatScope: "fixed", displayLabelFor: (index) => `ภาพทำความสะอาดภายในตู้ควบคุม — จุดที่ ${index + 1}`, legacyIds: ["cabinet-inside"] }),
      ...repeatedItems("6.3", 4, "other-cabinet-cleaning", "ภาพทำความสะอาดตู้ควบคุมอื่น ๆ", 3, { repeatScope: "fixed", displayLabelFor: (index) => `ภาพทำความสะอาดตู้ควบคุมอื่น — จุดที่ ${index + 1}` }),
      ...repeatedItems("6.3", 7, "around-cabinet", "ทำความสะอาดรอบตู้", 3, { repeatScope: "fixed", displayLabelFor: (index) => `ภาพทำความสะอาดพื้นที่โดยรอบตู้ควบคุม — จุดที่ ${index + 1}`, legacyIds: ["cabinet-around"] }),
      ...repeatedItems("6.3", 10, "control-room-cleaning", "ภาพทำความสะอาดห้องควบคุม", 3, { repeatScope: "fixed", displayLabelFor: (index) => `ภาพทำความสะอาดพื้นที่ห้องควบคุมบริเวณตู้ — จุดที่ ${index + 1}` }),
    ],
  },
  {
    code: "7.1",
    title: "Variable Message Sign (VMS)",
    items: photoItems("7.1", 1, [
      ["overview", "ภาพรวมอุปกรณ์", { sourceObservedStatus: "not-installed", displayLabel: "ภาพรวมป้าย VMS และอุปกรณ์ประกอบ", legacyIds: ["vms-sign"] }],
      ["cleaning-01", "ภาพทำความสะอาดห้องควบคุม", { displayLabel: "ภาพทำความสะอาดบริเวณป้าย VMS — จุดที่ 1", sourceObservedStatus: "not-installed" }],
      ["cleaning-02", "ภาพทำความสะอาดห้องควบคุม", { displayLabel: "ภาพทำความสะอาดบริเวณป้าย VMS — จุดที่ 2", sourceObservedStatus: "not-installed" }],
      ["sign-check", "ภาพระบบตรวจสอบการทำงานป้าย", { displayLabel: "ภาพผลทดสอบการแสดงข้อความบนป้าย VMS", sourceObservedStatus: "not-installed" }],
      ["light-sensor-check", "ภาพระบบตรวจสอบการทำงานเซนเซอร์วัดแสง", { displayLabel: "ภาพผลทดสอบเซนเซอร์วัดแสง VMS", sourceObservedStatus: "not-installed", legacyIds: ["vms-light-sensor"] }],
      ["display-check", "ภาพระบบตรวจสอบการเรียงจอภาพ", { displayLabel: "ภาพผลตรวจการเรียงลำดับจอภาพ VMS", sourceObservedStatus: "not-installed", legacyIds: ["vms-display"] }],
      ["save-config", "หมายเหตุ: SAVE FIELD CONFIG ไว้ด้วย", { fieldType: "document", displayLabel: "ไฟล์การตั้งค่าหน้างาน (SAVE FIELD CONFIG)", sourceObservedStatus: "not-installed" }],
    ]),
  },
];

function indexedBinding(types, index) {
  return { types, index };
}

// Applicability must be driven by stable template IDs, never by editable
// display wording. The legacy mapping is kept for v3 Snapshots; current
// rounds use the real Asset Register order for repeated equipment.
function assetBindingForTemplateItem(item, mappingMode = "current") {
  const parts = String(item?.id || "").split(".");
  const sectionCode = parts.slice(0, 2).join(".");
  const id = parts.slice(2).join(".");
  const indexed = (pattern, types) => {
    const match = id.match(pattern);
    return match ? indexedBinding(types, Number(match[1]) - 1) : null;
  };

  if (sectionCode === "1.1" || sectionCode === "6.1" || sectionCode === "6.2" || sectionCode === "6.3") return null;
  if (sectionCode === "2.1") {
    const sensorMatch = id.match(/^sensor-set-(\d+)-(\d+)$/);
    if (sensorMatch) {
      const setIndex = Number(sensorMatch[1]) - 1;
      const position = Number(sensorMatch[2]) - 1;
      return indexedBinding(
        ["WIM_SENSOR"],
        mappingMode === "legacy" ? position : setIndex * 3 + position,
      );
    }
    return indexed(/^sensor-set-\d+-(\d+)$/, ["WIM_SENSOR"])
      || indexed(/^loop-(\d+)$/, ["WIM_LOOP"])
      || (id.startsWith("road-") ? { types: ["WIM_SENSOR"] } : null);
  }
  if (sectionCode === "2.2") return { types: ["CONTROL_COMPUTER"] };
  if (sectionCode === "2.3") return { types: ["CONTROL_CABINET"] };
  if (sectionCode === "3.1") {
    const laneMatch = id.match(/^lane-(\d+)-/);
    if (!laneMatch) return null;
    return mappingMode === "legacy" || mappingMode === "asset-mapped"
      ? indexedBinding(["LANE"], Number(laneMatch[1]) - 1)
      : { laneNumber: Number(laneMatch[1]) };
  }
  if (sectionCode === "3.2") {
    return indexed(/^(?:camera|cleaning|cleaning-row|voltage)-(\d+)(?:-|$)/, ["LPR_CAMERA"])
      || (id === "overview" ? { types: ["LPR_CAMERA"], index: 0 } : null)
      || (id.startsWith("lane-")
        ? (mappingMode === "legacy"
          ? { types: ["LPR_CAMERA"], index: 0 }
          : indexed(/^lane-(\d+)-/, ["LPR_CAMERA"]))
        : null);
  }
  if (sectionCode === "4.1") {
    if (id === "overview") return { types: ["FIXED_CAMERA", "PTZ_CAMERA"] };
    return indexed(/^(?:fixed-\d+-sn|fixed-\d+-cleaning|fixed-voltage|fixed-sd-card|fixed-cleaning-detail)-(\d+)?$/, ["FIXED_CAMERA"])
      || indexed(/^fixed-(\d+)-(?:sn|cleaning)$/, ["FIXED_CAMERA"])
      || indexed(/^ptz-(\d+)-(?:overview-cleaning|cleaning)$/, ["PTZ_CAMERA"])
      || indexed(/^ptz-(?:voltage|cleaning-detail)-(\d+)/, ["PTZ_CAMERA"])
      || (id === "ptz-1-sn" ? indexedBinding(["PTZ_CAMERA"], 0) : null);
  }
  if (sectionCode === "4.2") return { types: ["NVR"] };
  if (sectionCode === "5.1") return { types: ["DATABASE_SERVER"] };
  if (sectionCode === "7.1") {
    if (id === "light-sensor-check") return { types: ["VMS_LIGHT_SENSOR"] };
    if (id === "display-check") return { types: ["VMS_DISPLAY"] };
    return { types: ["VMS_SIGN"] };
  }
  return null;
}

function copyText(overrides, key, fallback, allowEmpty = false) {
  if (!Object.prototype.hasOwnProperty.call(overrides || {}, key)) return fallback;
  const value = overrides[key];
  if (typeof value !== "string") return fallback;
  return allowEmpty || value.trim() ? value : fallback;
}

const CHECKLIST_ITEM_NAME_REPLACEMENTS = Object.freeze([
  ["กล้องโทรทัศน์วงจรปิดแบบ Fixed และ PTZ", { kind: "system", id: "cctv-system" }],
  ["กล้อง CCTV แบบ Fixed", { kind: "asset", id: "FIXED_CAMERA" }],
  ["กล้อง CCTV แบบ PTZ", { kind: "asset", id: "PTZ_CAMERA" }],
  ["กล้อง LPR", { kind: "asset", id: "LPR_CAMERA" }],
  ["เครื่องควบคุม WIM", { kind: "asset", id: "CONTROL_COMPUTER" }],
  ["WIM CONTROLLER", { kind: "asset", id: "WIM_CONTROLLER" }],
  ["PHASE PROTECTION", { kind: "asset", id: "WIM_PHASE_PROTECTION" }],
  ["SUB BREAKER", { kind: "asset", id: "WIM_SUB_BREAKER" }],
  ["เครื่องบันทึกภาพ NVR", { kind: "asset", id: "NVR" }],
  ["ระบบฐานข้อมูล", { kind: "asset", id: "DATABASE_SERVER" }],
  ["เซนเซอร์วัดแสง VMS", { kind: "asset", id: "VMS_LIGHT_SENSOR" }],
  ["จอภาพ VMS", { kind: "asset", id: "VMS_DISPLAY" }],
  ["จอแสดงผล VMS", { kind: "asset", id: "VMS_DISPLAY" }],
  ["ป้าย VMS", { kind: "asset", id: "VMS_SIGN" }],
  ["ระบบควบคุมการอ่านป้ายทะเบียน", { kind: "system", id: "lpr-control" }],
  ["ระบบจัดการฐานข้อมูลและการจัดทำรายงาน", { kind: "system", id: "data-management" }],
  ["ระบบแสดงผลและประมวลผลข้อมูล", { kind: "system", id: "station-display" }],
  ["เครื่องคอมพิวเตอร์ควบคุม WIM", { kind: "asset", id: "CONTROL_COMPUTER" }],
  ["ระบบอิเล็กทรอนิกส์ WIM", { kind: "system", id: "wim-electronics-system" }],
  ["ระบบควบคุม WIM", { kind: "system", id: "wim-control" }],
  ["เซนเซอร์ชั่งน้ำหนัก WIM", { kind: "asset", id: "WIM_SENSOR" }],
  ["ลูปตรวจจับยานพาหนะ", { kind: "asset", id: "WIM_LOOP" }],
  ["กล้องโทรทัศน์วงจรปิดแบบมุมคงที่", { kind: "asset", id: "FIXED_CAMERA" }],
  ["กล้องโทรทัศน์วงจรปิดแบบปรับมุมมอง", { kind: "asset", id: "PTZ_CAMERA" }],
  ["กล้องอ่านป้ายทะเบียน", { kind: "asset", id: "LPR_CAMERA" }],
  ["เครื่องบันทึกภาพผ่านเครือข่าย", { kind: "asset", id: "NVR" }],
  ["ป้ายข้อความเปลี่ยนแปลงได้", { kind: "asset", id: "VMS_SIGN" }],
]);

const CHECKLIST_ITEM_ALIAS_REPLACEMENTS = Object.freeze([
  ["ผลทดสอบการอ่านป้ายทะเบียนร่วมกับ WIM", { kind: "system", id: "lpr-control" }, "ผลทดสอบการอ่านป้ายทะเบียนร่วมกับ WIM"],
  ["ภาพผลการค้นหาป้ายทะเบียน", { kind: "system", id: "lpr-control" }, "ภาพผลการค้นหาป้ายทะเบียน"],
  ["ผลจากกล้อง LPR", { kind: "asset", id: "LPR_CAMERA" }, "ผลจากกล้องอ่านป้ายทะเบียน"],
  ["ภาพผลการค้นหาที่เชื่อมโยงกับกล้อง LPR", { kind: "asset", id: "LPR_CAMERA" }, "ภาพผลการค้นหาที่เชื่อมโยงกับกล้องอ่านป้ายทะเบียน"],
  ["ค่าที่วัดได้จากกล้อง LPR", { kind: "asset", id: "LPR_CAMERA" }, "ค่าที่วัดได้จากกล้องอ่านป้ายทะเบียน"],
  ["ค่าที่วัดได้จากกล้อง CCTV แบบ Fixed", { kind: "asset", id: "FIXED_CAMERA" }, "ค่าที่วัดได้จากกล้องโทรทัศน์วงจรปิดแบบมุมคงที่"],
  ["ตรวจ SD Card ของกล้อง CCTV แบบ Fixed", { kind: "asset", id: "FIXED_CAMERA" }, "ตรวจ SD Card ของกล้องโทรทัศน์วงจรปิดแบบมุมคงที่"],
  ["ค่าที่วัดได้จากกล้อง CCTV แบบ PTZ", { kind: "asset", id: "PTZ_CAMERA" }, "ค่าที่วัดได้จากกล้องโทรทัศน์วงจรปิดแบบปรับมุมมอง"],
  ["ตรวจ SD Card ของกล้อง CCTV แบบ PTZ", { kind: "asset", id: "PTZ_CAMERA" }, "ตรวจ SD Card ของกล้องโทรทัศน์วงจรปิดแบบปรับมุมมอง"],
  ["กล้อง LPR", { kind: "asset", id: "LPR_CAMERA" }, "กล้องอ่านป้ายทะเบียน"],
  ["กล้อง CCTV แบบ Fixed", { kind: "asset", id: "FIXED_CAMERA" }, "กล้องโทรทัศน์วงจรปิดแบบมุมคงที่"],
  ["กล้อง CCTV แบบ PTZ", { kind: "asset", id: "PTZ_CAMERA" }, "กล้องโทรทัศน์วงจรปิดแบบปรับมุมมอง"],
  ["เครื่องควบคุม WIM", { kind: "asset", id: "CONTROL_COMPUTER" }, "เครื่องคอมพิวเตอร์ควบคุม WIM"],
  ["WIM CONTROLLER", { kind: "asset", id: "WIM_CONTROLLER" }, "ตัวควบคุม WIM"],
  ["PHASE PROTECTION", { kind: "asset", id: "WIM_PHASE_PROTECTION" }, "อุปกรณ์ป้องกันเฟส"],
  ["SUB BREAKER", { kind: "asset", id: "WIM_SUB_BREAKER" }, "เบรกเกอร์ย่อย"],
  ["ระบบฐานข้อมูล", { kind: "asset", id: "DATABASE_SERVER" }, "เครื่องแม่ข่ายฐานข้อมูล"],
  ["เซนเซอร์วัดแสง VMS", { kind: "asset", id: "VMS_LIGHT_SENSOR" }, "เซนเซอร์วัดแสง VMS"],
  ["จอภาพ VMS", { kind: "asset", id: "VMS_DISPLAY" }, "จอแสดงผล VMS"],
  ["จอแสดงผล VMS", { kind: "asset", id: "VMS_DISPLAY" }, "จอแสดงผล VMS"],
  ["ป้าย VMS", { kind: "asset", id: "VMS_SIGN" }, "ป้าย VMS"],
]);

function getChecklistName(reference) {
  return reference.kind === "system"
    ? getCentralSystemNameForRecord({ canonicalItemId: reference.id })
    : getCentralEquipmentName(reference.id);
}

export function formatChecklistItemDisplayLabel(label) {
  const aliased = CHECKLIST_ITEM_ALIAS_REPLACEMENTS.reduce((result, [alias, reference, suffix]) => {
    const english = getChecklistName(reference)?.nameEn;
    if (!english) return result;
    const canonical = `${english} · ${suffix}`;
    return result.includes(canonical) ? result : result.replaceAll(alias, (match, offset, source) => (
      source.slice(Math.max(0, offset - 120), offset).includes(english)
        ? match
        : `${offset > 0 && !/\s/.test(source[offset - 1]) ? " " : ""}${canonical}`
    ));
  }, String(label || ""));
  return CHECKLIST_ITEM_NAME_REPLACEMENTS.reduce((result, [thai, reference]) => {
    const name = getChecklistName(reference);
    const combined = formatCentralNameEnglishFirst(name);
    const english = name?.nameEn;
    if (!combined || !english) return result;
    return result.includes(combined) ? result : result.replaceAll(thai, (match, offset, source) => {
      const precedingText = source.slice(Math.max(0, offset - 120), offset);
      if (precedingText.includes(english)) return match;
      return `${offset > 0 && !/\s/.test(source[offset - 1]) ? " " : ""}${combined}`;
    });
  }, aliased);
}

function cloneTemplateSection(section, mappingMode = "current") {
  return {
    ...section,
    items: section.items.map((item) => {
      const displayLabel = mappingMode === "legacy"
        ? item.sourceLabel || item.label
        : item.displayLabel || item.label;
      return {
        ...item,
        label: displayLabel,
        displayLabel,
        // Vehicle API review is a station/system check. Keep the physical
        // Database Server rows asset-bound, but do not hide the API review
        // rows when a station does not register a Database Server asset.
        assetBinding: mappingMode === "current" && item.vehicleReviewContext
          ? null
          : assetBindingForTemplateItem(item, mappingMode),
        evidenceSlots: item.evidenceSlots.map((slot) => ({
          ...slot,
          displayLabel: mappingMode === "legacy"
            ? slot.sourceLabel || displayLabel
            : slot.displayLabel || displayLabel,
        })),
      };
    }),
  };
}

const HISTORICAL_SECTION_TITLES = Object.freeze({
  "2.3": "WIM ELECTRONIC SYSTEM FOR IMPS",
  "3.2": "LPR CAMERA",
  "4.1": "กล้อง Fixed และ PTZ",
  "4.2": "NETWORK VIDEO RECORDER",
  "5.1": "DATABASE MANAGEMENT AND REPORT (ฮาร์ดแวร์)",
  "6.1": "DATABASE MANAGEMENT AND REPORT (ซอฟต์แวร์)",
});
const BASE_EVIDENCE_CHECKLIST_SECTIONS = sections.map((section) => cloneTemplateSection(section, "current"));
const PREVIOUS_EVIDENCE_CHECKLIST_SECTIONS = sections.map((section) => ({
  ...cloneTemplateSection(section, "asset-mapped"),
  title: HISTORICAL_SECTION_TITLES[section.code] || section.title,
}));
const LEGACY_EVIDENCE_CHECKLIST_SECTIONS = sections.map((section) => ({
  ...cloneTemplateSection(section, "legacy"),
  title: HISTORICAL_SECTION_TITLES[section.code] || section.title,
}));

const CLEANING_SECTION_BY_TYPE = Object.freeze({
  CONTROL_COMPUTER: "2.2",
  CONTROL_CABINET: "2.3",
  LPR_CAMERA: "3.2",
  FIXED_CAMERA: "4.1",
  PTZ_CAMERA: "4.1",
  NVR: "4.2",
  DATABASE_SERVER: "5.1",
  VMS_SIGN: "7.1",
  VMS_LIGHT_SENSOR: "7.1",
  VMS_DISPLAY: "7.1",
});

function evidenceTemplateVersionForSnapshot(snapshot) {
  if (isEvidenceTemplateVersion(snapshot?.templateVersion)) return snapshot.templateVersion;
  return snapshot?.id && Array.isArray(snapshot?.evidenceCatalog)
    ? LEGACY_EVIDENCE_TEMPLATE_VERSION
    : EVIDENCE_TEMPLATE_VERSION;
}

function isEquipmentCleaningPolicy(snapshot) {
  return snapshot?.cleaningPolicyVersion === CLEANING_POLICY_VERSION
    && isCurrentEvidenceTemplateVersion(evidenceTemplateVersionForSnapshot(snapshot));
}

export function isCleaningPolicyVersion(version) {
  return version === CLEANING_POLICY_VERSION;
}

function isLegacyCleaningItem(item) {
  const id = String(item?.id || "");
  return /^2\.2\.cleaning-\d+$/.test(id)
    || /^3\.2\.(?:camera-\d+-cleaning|cleaning-row-\d+)$/.test(id)
    || /^4\.1\.(?:fixed-\d+-cleaning|ptz-\d+-(?:overview-cleaning|cleaning)|fixed-cleaning-detail-\d+|ptz-cleaning-detail-\d+)$/.test(id)
    || /^4\.2\.cleaning-\d+$/.test(id)
    || /^5\.1\.cleaning-\d+$/.test(id)
    || /^6\.2\.room-cleaning-\d+$/.test(id)
    || /^6\.3\.(?:cabinet-cleaning|other-cabinet-cleaning|around-cabinet|control-room-cleaning)-\d+$/.test(id)
    || /^7\.1\.cleaning-\d+$/.test(id);
}

function applyChecklistCopy(section, copy = CHECKLIST_COPY_OVERRIDES) {
  const sectionTitle = copyText(copy.sections, section.code, section.title);
  return {
    ...section,
    title: sectionTitle,
    items: section.items.map((item) => {
      const rawDisplayLabel = copyText(copy.items, item.id, item.displayLabel || item.label);
      const displayLabel = copy === CHECKLIST_COPY_OVERRIDES
        ? formatChecklistItemDisplayLabel(rawDisplayLabel)
        : rawDisplayLabel;
      const helper = copyText(copy.helpers, item.id, item.helper);
      const unit = copyText(copy.units, item.id, item.unit, true);
      return {
        ...item,
        label: displayLabel,
        displayLabel,
        helper,
        unit,
        evidenceSlots: item.evidenceSlots.map((slot) => ({ ...slot, displayLabel })),
      };
    }),
  };
}

export function buildChecklistTemplateSections(copy = CHECKLIST_COPY_OVERRIDES) {
  return BASE_EVIDENCE_CHECKLIST_SECTIONS.map((section) => applyChecklistCopy(section, copy));
}

export const EVIDENCE_CHECKLIST_SECTIONS = buildChecklistTemplateSections();

export const EVIDENCE_SECTION_CODES = EVIDENCE_CHECKLIST_SECTIONS.map((section) => section.code);

export function isEvidenceTemplateVersion(version) {
  return version === EVIDENCE_TEMPLATE_VERSION
    || version === LANE_ASSET_EVIDENCE_TEMPLATE_VERSION
    || version === PREVIOUS_EVIDENCE_TEMPLATE_VERSION
    || version === LEGACY_EVIDENCE_TEMPLATE_VERSION;
}

export function isCurrentEvidenceTemplateVersion(version) {
  return version === EVIDENCE_TEMPLATE_VERSION || version === LANE_ASSET_EVIDENCE_TEMPLATE_VERSION;
}

export function isLaneAssetEvidenceTemplateVersion(version) {
  return version === LANE_ASSET_EVIDENCE_TEMPLATE_VERSION;
}

export function getEvidenceTemplateSections(version = EVIDENCE_TEMPLATE_VERSION) {
  if (version === LEGACY_EVIDENCE_TEMPLATE_VERSION) return LEGACY_EVIDENCE_CHECKLIST_SECTIONS;
  if (version === PREVIOUS_EVIDENCE_TEMPLATE_VERSION) return PREVIOUS_EVIDENCE_CHECKLIST_SECTIONS;
  return EVIDENCE_CHECKLIST_SECTIONS;
}

export function getEvidenceItemByLegacyId(legacyId) {
  return EVIDENCE_CHECKLIST_SECTIONS.flatMap((section) => section.items).find((item) => item.legacyIds.includes(legacyId)) || null;
}

// These are the only BOQ sections whose applicability is derived from the
// station Asset Register.  1.1 and 6.x are station-level work and therefore
// remain applicable even when the station has no equipment Assets.
export const EVIDENCE_ASSET_TYPE_MAPPING = Object.freeze({
  "1.1.5": ["LASER_SCANNER", "DIMENSION_CONTROLLER"],
  "1.1.11": ["CABINET"],
  "1.1.12": ["IMAGE_PROCESSOR"],
  "2.1": ["WIM_SENSOR", "WIM_LOOP"],
  "2.2": ["CONTROL_COMPUTER"],
  "2.3": ["CONTROL_CABINET", "WIM_AC_DC_POWER_SUPPLY", "WIM_NETWORK_EQUIPMENT", "WIM_CONTROLLER", "WIM_PHASE_PROTECTION", "WIM_SUB_BREAKER", "WIM_SWITCHING_DC", "WIM_TRANSFORMER_24VAC"],
  "3.1": ["LPR_CONTROL_SYSTEM"],
  "3.2": ["LPR_CAMERA"],
  "4.1": ["FIXED_CAMERA", "PTZ_CAMERA", "JOYSTICK"],
  "4.2": ["NVR"],
  "5.1": ["DATABASE_SERVER"],
  "5.2": ["IMPS_DISPLAY_PROCESSING"],
  "7.1": ["VMS_SIGN", "VMS_LIGHT_SENSOR", "VMS_DISPLAY"],
});

export const EVIDENCE_TYPE_TO_GROUP = Object.freeze(
  Object.fromEntries(
    Object.entries(EVIDENCE_ASSET_TYPE_MAPPING).flatMap(([groupCode, types]) => types.map((type) => [type, groupCode])),
  ),
);

// 5.2 is maintained as an Item Library category, but it has no source PDF
// section in the current 13-section evidence template. A real ImPS asset can
// therefore add a station-only section without changing the base catalog or
// any existing Snapshot ids.
const DYNAMIC_EVIDENCE_SECTION_TITLES = Object.freeze({
  "1.1.5": "3D Truck Dimension Measurement · ระบบวัดมิติรถบรรทุก",
  "1.1.11": "Equipment Cabinet · ตู้ควบคุมอุปกรณ์",
  "1.1.12": "Image Processing · ระบบประมวลผลภาพ",
  "5.2": CHECKLIST_SECTION_TITLES["5.2"],
});

const DEDICATED_ASSET_CHECK_RECIPES = Object.freeze({
  JOYSTICK: {
    sectionCode: "4.1",
    checks: [
      ["connection", "Camera Joystick · สถานะและการเชื่อมต่อ", "ตรวจไฟ สถานะพร้อมใช้งาน และการเชื่อมต่อกับระบบกล้อง"],
      ["ptz-control", "Camera Joystick · ควบคุม Pan / Tilt / Zoom", "ทดลองควบคุมทิศทางและการซูมของกล้องที่ผูกกับระบบ"],
      ["commands", "Camera Joystick · ปุ่มและคำสั่งตอบสนอง", "ทดลองเลือกกล้อง ปุ่มคำสั่ง หรือ Preset ที่หน้างานใช้งานจริง"],
    ],
  },
  IMPS_DISPLAY_PROCESSING: {
    sectionCode: "5.2",
    checks: [
      ["display-status", "Display and Data Processing Equipment · สถานะเครื่องและจอแสดงผล", "ตรวจไฟ สถานะเครื่อง และภาพที่แสดงบนจอ"],
      ["processing-result", "Display and Data Processing Equipment · รับ ประมวลผล และแสดงผลข้อมูล", "ทดลองข้อมูลเข้า ตรวจผลการประมวลผล และผลลัพธ์ที่แสดง"],
      ["connection", "Display and Data Processing Equipment · การเชื่อมต่อระบบ", "ตรวจการเชื่อมต่อกับระบบหรืออุปกรณ์ต้นทางที่เกี่ยวข้อง"],
    ],
  },
  LASER_SCANNER: {
    sectionCode: "1.1.5",
    checks: [
      ["condition", "3D Laser Scanner · สภาพและสถานะ Scanner", "ตรวจตัวเครื่อง เลนส์/หน้าต่างสแกน และไฟสถานะ"],
      ["dimension-result", "3D Laser Scanner · ผลการสแกนวัดมิติ", "ทดลองสแกนและตรวจว่ามีผลวัดมิติส่งออกตามการทำงานจริง"],
      ["controller-connection", "3D Laser Scanner · การเชื่อมต่อ Controller", "ตรวจสายหรือช่องทางสื่อสารกับ Dimension Controller"],
    ],
  },
  DIMENSION_CONTROLLER: {
    sectionCode: "1.1.5",
    checks: [
      ["status", "3D Truck Dimension Controller · สถานะ Controller", "ตรวจการเปิดเครื่อง สถานะพร้อมใช้งาน และข้อความผิดปกติ"],
      ["dimension-processing", "3D Truck Dimension Controller · รับผล Scanner และคำนวณมิติ", "ทดลองรับข้อมูลจาก Scanner และตรวจผลการคำนวณมิติ"],
      ["data-alarm", "3D Truck Dimension Controller · ส่งข้อมูลและแจ้งเตือน", "ตรวจการส่งข้อมูลต่อและการแสดง Alarm เมื่อเกิดปัญหา"],
    ],
  },
  IMAGE_PROCESSOR: {
    sectionCode: "1.1.12",
    checks: [
      ["input-trigger", "Image Processor · รับสัญญาณภาพและ Trigger", "ตรวจสัญญาณภาพเข้าและ Trigger จากอุปกรณ์ต้นทาง"],
      ["processing-result", "Image Processor · ผลการประมวลผลภาพ", "ทดลองประมวลผลและตรวจผลลัพธ์ที่ระบบแสดงหรือส่งต่อ"],
      ["system-output", "Image Processor · การส่งข้อมูลผ่านระบบ", "ตรวจการเชื่อมต่อและการส่งข้อมูลไปยังระบบที่เกี่ยวข้อง"],
    ],
  },
  CABINET: {
    sectionCode: "1.1.11",
    checks: [
      ["condition", "Equipment Cabinet · สภาพและความเรียบร้อย", "ตรวจโครงตู้ ประตู ล็อก และความเรียบร้อยภายใน"],
      ["power-grounding", "Equipment Cabinet · ไฟเข้าและ Grounding", "ตรวจไฟเข้าหลัก จุด Grounding และสัญญาณสถานะที่เกี่ยวข้อง"],
      ["distribution", "Equipment Cabinet · Breaker สาย และจุดต่อ", "ตรวจ Breaker สายไฟ ป้ายกำกับ และจุดต่อภายในตู้"],
    ],
  },
});

function buildDedicatedAssetChecklistItems(asset) {
  const recipe = DEDICATED_ASSET_CHECK_RECIPES[asset?.type];
  if (!recipe) return [];
  const sectionTitle = CHECKLIST_SECTION_TITLES[recipe.sectionCode]
    || DYNAMIC_EVIDENCE_SECTION_TITLES[recipe.sectionCode]
    || `หมวด ${recipe.sectionCode}`;
  const sourceFile = SOURCE_FILES[recipe.sectionCode] || "ทะเบียนสถานี";
  return recipe.checks.map(([key, label, helper], index) => {
    const sourceLabel = `ทะเบียนสถานี · ${label}`;
    return {
      ...sourceItem(recipe.sectionCode, `asset-${String(asset.type).toLowerCase()}-${key}`, sourceLabel, 22000 + index, {
        displayLabel: label,
        helper,
        repeatScope: "per-asset",
        sourceFile,
      }),
      sectionCode: recipe.sectionCode,
      sectionTitle,
      assetId: asset.id,
      assetBinding: { assetId: asset.id },
      assetDependent: true,
      applicable: true,
      checklistDisabled: false,
    };
  });
}

const isBoqSystemGroupsPresentation = (version) => [
  LEGACY_BOQ_CHECKLIST_PRESENTATION_VERSION,
  BOQ_CHECKLIST_PRESENTATION_VERSION,
].includes(version);

const STATION_LEVEL_EVIDENCE_SECTIONS = new Set(["1.1", "6.1", "6.2", "6.3"]);

function assetRequirementForItem(item) {
  if (item?.sectionCode === "3.1" && Number.isInteger(item?.assetBinding?.laneNumber)) return null;
  if (STATION_LEVEL_EVIDENCE_SECTIONS.has(item.sectionCode)) return null;
  if (item && Object.prototype.hasOwnProperty.call(item, "assetBinding")) return item.assetBinding;
  return assetBindingForTemplateItem(item);
}

export function getEvidenceAssetRequirement(item) {
  return assetRequirementForItem(item);
}

function assetForItem(item, equipment) {
  const requirement = assetRequirementForItem(item);
  if (!requirement) return null;
  const active = equipment.filter((entry) => entry.active !== false);
  if (requirement.assetId) return active.find((entry) => entry.id === requirement.assetId) || null;
  if (Number.isInteger(requirement.index)) {
    const matching = active.filter((entry) => requirement.types.includes(entry.type));
    return matching[requirement.index] || null;
  }
  return active.find((entry) => requirement.types.includes(entry.type)) || null;
}

export function normalizeEvidenceSlotState(state, slot, item) {
  const value = state && typeof state === "object" ? state : {};
  const status = EVIDENCE_STATUS_OPTIONS.some((option) => option.value === value.status) ? value.status : "pending";
  return {
    status: item?.applicable === false ? "na" : status,
    value: value.value ?? "",
    note: String(value.note || ""),
    attachment: value.attachment && typeof value.attachment === "object" ? value.attachment : null,
    sourceSlotId: slot.id,
  };
}

export function isCleaningEvidenceComplete(slot, evidence) {
  return Boolean(slot?.cleaningStage && evidence?.status === "complete" && evidence?.attachment?.id);
}

export function isEvidenceSlotComplete(slot, evidence) {
  return slot?.cleaningStage || slot?.photoRequired
    ? evidence?.status === "complete" && Boolean(evidence?.attachment?.id)
    : evidence?.status === "complete";
}

export function emptyEvidence(item) {
  return Object.fromEntries((item?.evidenceSlots || []).map((slot) => [slot.id, normalizeEvidenceSlotState({}, slot, item)]));
}

export function normalizeEvidenceMap(item, previous = {}) {
  const legacy = previous && typeof previous === "object" ? previous : {};
  return Object.fromEntries((item?.evidenceSlots || []).map((slot) => [slot.id, normalizeEvidenceSlotState(legacy[slot.id], slot, item)]));
}

function copySnapshotFromSections(sectionsToCopy, catalogEntries = [], revision = CHECKLIST_COPY_REVISION) {
  const catalogByItem = new Map();
  const catalogBySlot = new Map();
  catalogEntries.forEach((entry) => {
    if (entry?.itemId && !catalogByItem.has(entry.itemId)) catalogByItem.set(entry.itemId, entry);
    if (entry?.slotId) catalogBySlot.set(entry.slotId, entry);
  });
  return {
    revision,
    sections: sectionsToCopy.map((section) => ({
      code: section.code,
      title: section.title,
      items: section.items.map((item) => {
        const catalogItem = catalogByItem.get(item.id);
        const label = catalogItem?.displayLabel || catalogItem?.itemLabel || item.displayLabel || item.label;
        return {
          id: item.id,
          label,
          helper: catalogItem?.helper || item.helper,
          unit: catalogItem?.unit ?? item.unit,
          sourceLabel: catalogItem?.sourceLabel || item.sourceLabel,
          vehicleReviewContext: catalogItem?.vehicleReviewContext || item.vehicleReviewContext || null,
          checklistNumber: catalogItem?.checklistNumber || item.checklistNumber || null,
          evidenceSlots: item.evidenceSlots.map((slot) => {
            const catalogSlot = catalogBySlot.get(slot.id);
            return {
              id: slot.id,
              displayLabel: catalogSlot?.displayLabel || label,
              sourceLabel: catalogSlot?.sourceLabel || slot.sourceLabel,
              sourceOrder: catalogSlot?.sourceOrder ?? slot.sourceOrder,
              fieldType: catalogSlot?.fieldType || slot.fieldType,
              required: catalogSlot?.required !== false,
            };
          }),
        };
      }),
    })),
  };
}

export function normalizeChecklistCopy(copy) {
  if (!copy || typeof copy !== "object" || !Array.isArray(copy.sections)) return null;
  return {
    revision: String(copy.revision || LEGACY_CHECKLIST_COPY_REVISION),
    sections: copy.sections.map((section) => ({
      code: String(section?.code || ""),
      title: String(section?.title || ""),
      items: Array.isArray(section?.items) ? section.items.map((item) => ({
        id: String(item?.id || ""),
        label: String(item?.label || ""),
        helper: String(item?.helper || ""),
        unit: String(item?.unit || ""),
        sourceLabel: String(item?.sourceLabel || ""),
        vehicleReviewContext: item?.vehicleReviewContext ? String(item.vehicleReviewContext) : null,
        checklistNumber: item?.checklistNumber ? String(item.checklistNumber) : null,
        evidenceSlots: Array.isArray(item?.evidenceSlots) ? item.evidenceSlots.map((slot) => ({
          id: String(slot?.id || ""),
          displayLabel: String(slot?.displayLabel || item?.label || ""),
          sourceLabel: String(slot?.sourceLabel || ""),
          sourceOrder: Number(slot?.sourceOrder || 0),
          fieldType: String(slot?.fieldType || "photo"),
          required: slot?.required !== false,
        })) : [],
      })) : [],
    })),
  };
}

export function createChecklistCopySnapshot() {
  return copySnapshotFromSections(EVIDENCE_CHECKLIST_SECTIONS, [], CHECKLIST_COPY_REVISION);
}

// Migrate only labels that still equal the old default. A user-edited label
// or evidence-slot label is intentionally left untouched.
export function migrateChecklistCopyForCurrentTemplate(copy) {
  const normalized = normalizeChecklistCopy(copy) || createChecklistCopySnapshot();
  const legacyCurrentItems = LEGACY_CURRENT_CHECKLIST_COPY_OVERRIDES.items;
  const legacyCurrentSections = LEGACY_CURRENT_CHECKLIST_COPY_OVERRIDES.sections;
  const legacyItems = new Map(LEGACY_EVIDENCE_CHECKLIST_SECTIONS.flatMap((section) => section.items.map((item) => [item.id, item])));
  const currentItems = new Map(EVIDENCE_CHECKLIST_SECTIONS.flatMap((section) => section.items.map((item) => [item.id, item])));
  const legacySections = new Map(LEGACY_EVIDENCE_CHECKLIST_SECTIONS.map((section) => [section.code, section]));
  const currentSections = new Map(EVIDENCE_CHECKLIST_SECTIONS.map((section) => [section.code, section]));
  let changed = false;
  const sections = normalized.sections.map((section) => {
    const legacySectionTitles = new Set([
      legacySections.get(section.code)?.title,
      ...(Array.isArray(legacyCurrentSections[section.code])
        ? legacyCurrentSections[section.code]
        : [legacyCurrentSections[section.code]]),
    ].filter(Boolean));
    const mappedItems = section.items.map((item) => {
        const legacyItem = legacyItems.get(item.id);
        const currentItem = currentItems.get(item.id);
        if (!legacyItem || !currentItem) return item;
        const oldCurrentLabel = legacyCurrentItems[item.id];
        const labelWasDefault = item.label === legacyItem.label || item.label === oldCurrentLabel;
        const nextLabel = labelWasDefault ? currentItem.label : item.label;
        if (nextLabel !== item.label) changed = true;
        const helperWasDefault = item.helper === "ตรวจและบันทึกตามช่องในเอกสารแนบ";
        const nextHelper = helperWasDefault ? currentItem.helper : item.helper;
        if (nextHelper !== item.helper) changed = true;
        const nextSlots = item.evidenceSlots.map((slot) => {
          const legacySlot = legacyItem.evidenceSlots.find((candidate) => candidate.id === slot.id);
          const slotWasDefault = legacySlot && (slot.displayLabel === legacySlot.displayLabel || slot.displayLabel === oldCurrentLabel);
          const nextDisplayLabel = slotWasDefault ? nextLabel : slot.displayLabel;
          if (nextDisplayLabel !== slot.displayLabel) changed = true;
          return { ...slot, displayLabel: nextDisplayLabel };
        });
        const nextContext = currentItem.vehicleReviewContext || item.vehicleReviewContext || null;
        const nextChecklistNumber = currentItem.checklistNumber || item.checklistNumber || null;
        if (nextContext !== (item.vehicleReviewContext || null) || nextChecklistNumber !== (item.checklistNumber || null)) changed = true;
        return { ...item, label: nextLabel, helper: nextHelper, vehicleReviewContext: nextContext, checklistNumber: nextChecklistNumber, evidenceSlots: nextSlots };
      });
    const currentOrder = currentSections.get(section.code)?.items.map((item) => item.id) || [];
    const mappedById = new Map(mappedItems.map((item) => [item.id, item]));
    const orderedItems = section.code === "5.1" && currentOrder.length
      ? [
          ...currentOrder.map((itemId) => mappedById.get(itemId)).filter(Boolean),
          ...mappedItems.filter((item) => !currentOrder.includes(item.id)),
        ]
      : mappedItems;
    if (orderedItems.some((item, index) => item.id !== section.items[index]?.id)) changed = true;
    return {
      ...section,
      title: legacySectionTitles.has(section.title)
        ? (currentSections.get(section.code)?.title || section.title)
        : section.title,
      items: orderedItems,
    };
  });
  const sectionTitlesChanged = sections.some((section, index) => section.title !== normalized.sections[index]?.title);
  return changed || sectionTitlesChanged
    ? { ...normalized, revision: CHECKLIST_COPY_REVISION, sections }
    : normalized;
}

export function updateChecklistCopy(copy, { sectionCode, itemId = null, field, value } = {}) {
  const current = normalizeChecklistCopy(copy) || createChecklistCopySnapshot();
  const nextValue = String(value ?? "");
  const revision = `checklist-copy-local-${Date.now().toString(36)}`;
  const allowedFields = new Set(["title", "label", "unit", "helper"]);
  if (!allowedFields.has(field)) return current;
  return {
    ...current,
    revision,
    sections: current.sections.map((section) => {
      if (section.code !== sectionCode) return section;
      if (!itemId) return field === "title" ? { ...section, title: nextValue } : section;
      return {
        ...section,
        items: section.items.map((item) => {
          if (item.id !== itemId) return item;
          const nextItem = { ...item, [field]: nextValue };
          if (field === "label") {
            nextItem.evidenceSlots = item.evidenceSlots.map((slot) => ({ ...slot, displayLabel: nextValue }));
          }
          return nextItem;
        }),
      };
    }),
  };
}

function getLegacyChecklistCopySnapshot(snapshot) {
  return copySnapshotFromSections(
    LEGACY_EVIDENCE_CHECKLIST_SECTIONS,
    Array.isArray(snapshot?.evidenceCatalog) ? snapshot.evidenceCatalog : [],
    LEGACY_CHECKLIST_COPY_REVISION,
  );
}

function getAssetMappedChecklistCopySnapshot(snapshot) {
  return copySnapshotFromSections(
    PREVIOUS_EVIDENCE_CHECKLIST_SECTIONS,
    Array.isArray(snapshot?.evidenceCatalog) ? snapshot.evidenceCatalog : [],
    CHECKLIST_COPY_REVISION,
  );
}

export function getChecklistCopyForSnapshot(snapshot) {
  const stored = normalizeChecklistCopy(snapshot?.checklistCopy);
  const templateVersion = evidenceTemplateVersionForSnapshot(snapshot);
  if (stored) return !snapshot?.id && isCurrentEvidenceTemplateVersion(templateVersion)
    ? migrateChecklistCopyForCurrentTemplate(stored)
    : stored;
  if (templateVersion === LEGACY_EVIDENCE_TEMPLATE_VERSION) return getLegacyChecklistCopySnapshot(snapshot);
  if (templateVersion === PREVIOUS_EVIDENCE_TEMPLATE_VERSION) return getAssetMappedChecklistCopySnapshot(snapshot);
  return createChecklistCopySnapshot();
}

export function buildCleaningEvidenceItems(snapshot) {
  const equipment = Array.isArray(snapshot?.equipment) ? snapshot.equipment : [];
  const activeTargets = equipment.filter((entry) => entry?.active !== false && CLEANING_TARGET_TYPES.includes(entry?.type));
  const sectionIndexes = new Map();
  return activeTargets.map((asset) => {
    const sectionCode = CLEANING_SECTION_BY_TYPE[asset.type];
    const section = EVIDENCE_CHECKLIST_SECTIONS.find((candidate) => candidate.code === sectionCode);
    const sourceSection = asset.type === "CONTROL_CABINET"
      ? EVIDENCE_CHECKLIST_SECTIONS.find((candidate) => candidate.code === "6.3")
      : section;
    const sectionIndex = sectionIndexes.get(sectionCode) || 0;
    sectionIndexes.set(sectionCode, sectionIndex + 1);
    const assetLabel = asset.assetNo || asset.type || "อุปกรณ์";
    const equipmentLabel = checklistEquipmentName(asset.type, asset.type);
    const itemId = `${sectionCode}.equipment-cleaning-${asset.id}`;
    const sourceFile = sourceSection?.items[0]?.sourceFile || SOURCE_FILES[sectionCode];
    const sourceOrder = 10000 + sectionIndex * CLEANING_STAGE_DEFINITIONS.length;
    const sourceLabel = `ช่องทำความสะอาดอุปกรณ์จาก ${sourceFile || sectionCode}`;
    return {
      id: itemId,
      label: `Equipment Cleaning · ${equipmentLabel} · ${assetLabel}`,
      displayLabel: `Equipment Cleaning · ${equipmentLabel} · ${assetLabel}`,
      unit: "",
      helper: `ต้องแนบภาพถ่ายหลักฐานก่อนทำความสะอาด ระหว่างทำความสะอาด และหลังทำความสะอาด${asset.location ? ` · ${asset.location}` : ""}`,
      inputType: "none",
      fieldType: "photo",
      repeatScope: "per-asset",
      legacyIds: [],
      sourceFile,
      sourceLabel,
      sourceOrder,
      sectionCode,
      sectionTitle: section?.title || "ทำความสะอาดอุปกรณ์",
      evidenceSlots: CLEANING_STAGE_DEFINITIONS.map((stage, stageIndex) => ({
        id: `${itemId}.${stage.key}.evidence`,
        sourceFile,
        sourceLabel,
        displayLabel: stage.label,
        sourceOrder: sourceOrder + stageIndex,
        fieldType: "photo",
        required: true,
        cleaningStage: stage.key,
        cleaningAssetType: asset.type,
      })),
      assetId: asset.id,
      assetNo: asset.assetNo || "",
      location: asset.location || "",
      serialNo: asset.serialNo || "",
      assetDependent: true,
      applicable: true,
      checklistDisabled: false,
      isEquipmentCleaning: true,
      cleaningAssetType: asset.type,
    };
  });
}

function buildScopedCleaningItem({ sectionCode, id, label, helper, sourceOrder, asset = null, sourceLabel = label, sourceFile: sourceFileOverride = null }) {
  const itemId = `${sectionCode}.${id}`;
  const section = EVIDENCE_CHECKLIST_SECTIONS.find((candidate) => candidate.code === sectionCode);
  const sourceFile = sourceFileOverride || section?.items[0]?.sourceFile || SOURCE_FILES[sectionCode];
  return {
    id: itemId,
    label,
    displayLabel: label,
    unit: "",
    helper,
    inputType: "none",
    fieldType: "photo",
    repeatScope: asset ? "per-asset" : "station",
    legacyIds: [],
    sourceFile,
    sourceLabel,
    sourceOrder,
    sectionCode,
    sectionTitle: section?.title || label,
    evidenceSlots: CLEANING_STAGE_DEFINITIONS.map((stage, stageIndex) => ({
      id: `${itemId}.${stage.key}.evidence`,
      sourceFile,
      sourceLabel,
      displayLabel: stage.label,
      sourceOrder: sourceOrder + stageIndex,
      fieldType: "photo",
      required: true,
      cleaningStage: stage.key,
      cleaningScope: asset ? "asset-area" : "station-area",
    })),
    assetId: asset?.id || null,
    assetNo: asset?.assetNo || "",
    location: asset?.location || "",
    serialNo: asset?.serialNo || "",
    assetDependent: Boolean(asset),
    assetBinding: asset ? { assetId: asset.id } : null,
    applicable: true,
    checklistDisabled: false,
    isAreaCleaning: true,
    cleaningAssetType: asset?.type || "STATION_AREA",
  };
}

// Current rounds keep the source-shaped marker/overview rows but replace the
// old fixed cleaning-photo blocks with one auditable station-area control and
// one surrounding-area control per registered WIM cabinet. Older snapshots
// never call this helper, so their evidence identities remain frozen.
function buildAreaCleaningEvidenceItems(snapshot, { groupUnderEquipmentCategories = false } = {}) {
  const equipment = Array.isArray(snapshot?.equipment) ? snapshot.equipment : [];
  const active = getActivePhysicalEquipment(equipment);
  const roomSectionCode = groupUnderEquipmentCategories ? "2.2" : "6.2";
  const cabinetSectionCode = groupUnderEquipmentCategories ? "2.3" : "6.3";
  const items = [buildScopedCleaningItem({
    sectionCode: roomSectionCode,
    id: "control-room-area-cleaning",
    label: "ทำความสะอาดพื้นที่ห้องควบคุม",
    helper: "แนบภาพก่อนทำความสะอาด ระหว่างทำความสะอาด และหลังทำความสะอาดพื้นที่ห้องควบคุม พร้อมตรวจการจัดระเบียบสายและความเรียบร้อย",
    sourceOrder: 30000,
    sourceFile: SOURCE_FILES["6.2"],
    sourceLabel: "ภาพทำความสะอาดพื้นที่ห้องควบคุมจาก 6.2.pdf",
  })];
  active
    .filter((asset) => asset.type === "CONTROL_CABINET")
    .forEach((asset, index) => items.push(buildScopedCleaningItem({
      sectionCode: cabinetSectionCode,
      id: `cabinet-area-cleaning-${asset.id}`,
      label: `Control Cabinet Surrounding Area Cleaning · ${checklistEquipmentName("CONTROL_CABINET", "ตู้ควบคุมอุปกรณ์")}${asset.assetNo ? ` · ${asset.assetNo}` : ""}`,
      helper: `แนบภาพก่อนทำความสะอาด ระหว่างทำความสะอาด และหลังทำความสะอาดพื้นที่โดยรอบตู้${asset.location ? ` · ${asset.location}` : ""}`,
      sourceOrder: 30100 + index * CLEANING_STAGE_DEFINITIONS.length,
      asset,
      sourceFile: SOURCE_FILES["6.3"],
      sourceLabel: "ภาพทำความสะอาดพื้นที่โดยรอบตู้ควบคุมจาก 6.3.pdf",
    })));
  return items;
}

function buildNvrOperationalItems(snapshot) {
  const equipment = Array.isArray(snapshot?.equipment) ? snapshot.equipment : [];
  const activeNvrs = getActivePhysicalEquipment(equipment).filter((asset) => asset.type === "NVR");
  return activeNvrs.flatMap((asset, index) => {
    const identity = asset.assetNo ? ` · ${asset.assetNo}` : "";
    const parent = asset.location ? ` (${asset.location})` : "";
    const baseOrder = 30200 + index * 2;
    return [
      {
        id: `4.2.nvr-${asset.id}-failed-hdd-count`,
        label: `NVR Failed HDD Count · ${checklistEquipmentName("NVR", "NVR")}${identity}${parent}`,
        displayLabel: `NVR Failed HDD Count · ${checklistEquipmentName("NVR", "NVR")}${identity}${parent}`,
        unit: "ลูก",
        helper: "ตรวจสถานะ HDD ของ NVR กรอกจำนวนลูกที่เสีย และแนบภาพหน้าจอหรือผลตรวจสถานะ HDD",
        inputType: "number",
        fieldType: "photo",
        repeatScope: "per-asset",
        legacyIds: [],
        sourceFile: SOURCE_FILES["4.2"],
        sourceLabel: "จำนวน HDD ที่เสียจาก 4.2.pdf",
        sourceOrder: baseOrder,
        sectionCode: "4.2",
        sectionTitle: CHECKLIST_SECTION_TITLES["4.2"],
        evidenceSlots: [sourceSlot("4.2", `nvr-${asset.id}-failed-hdd-count`, "ภาพผลตรวจสถานะ HDD", baseOrder, { displayLabel: "ภาพผลตรวจสถานะ HDD" })],
        assetId: asset.id,
        assetNo: asset.assetNo || "",
        location: asset.location || "",
        serialNo: asset.serialNo || "",
        assetDependent: true,
        assetBinding: { assetId: asset.id },
        applicable: true,
        checklistDisabled: false,
        isNvrOperational: true,
      },
      {
        id: `4.2.nvr-${asset.id}-retention-days`,
        label: `NVR Retention Period · ${checklistEquipmentName("NVR", "NVR")}${identity}${parent}`,
        displayLabel: `NVR Retention Period · ${checklistEquipmentName("NVR", "NVR")}${identity}${parent}`,
        unit: "วัน",
        helper: "ทดสอบเรียกดูภาพย้อนหลังจาก NVR และกรอกจำนวนวันที่ค้นดูได้จริง พร้อมแนบภาพหน้าจอผลทดสอบ",
        inputType: "number",
        fieldType: "photo",
        repeatScope: "per-asset",
        legacyIds: [],
        sourceFile: SOURCE_FILES["4.2"],
        sourceLabel: "ระยะเวลาภาพย้อนหลังจาก 4.2.pdf",
        sourceOrder: baseOrder + 1,
        sectionCode: "4.2",
        sectionTitle: CHECKLIST_SECTION_TITLES["4.2"],
        evidenceSlots: [sourceSlot("4.2", `nvr-${asset.id}-retention-days`, "ภาพผลทดสอบการเรียกดูภาพย้อนหลัง", baseOrder + 1, { displayLabel: "ภาพผลทดสอบการเรียกดูภาพย้อนหลัง" })],
        assetId: asset.id,
        assetNo: asset.assetNo || "",
        location: asset.location || "",
        serialNo: asset.serialNo || "",
        assetDependent: true,
        assetBinding: { assetId: asset.id },
        applicable: true,
        checklistDisabled: false,
        isNvrOperational: true,
      },
    ];
  });
}

function activeLaneTopology(snapshot) {
  const systems = Array.isArray(snapshot?.stationSystems) ? snapshot.stationSystems : [];
  return (Array.isArray(snapshot?.lanes) ? snapshot.lanes : [])
    .filter((lane) => lane?.active !== false)
    .map((lane, index) => ({
      ...lane,
      id: String(lane?.id || "lane-" + (index + 1)),
      laneNo: Number(lane?.laneNo || lane?.number || index + 1),
      scope: getLaneScope(lane, systems),
    }))
    .filter((lane) => Number.isInteger(lane.laneNo) && lane.laneNo > 0)
    .sort((left, right) => left.laneNo - right.laneNo || left.scope.localeCompare(right.scope) || left.id.localeCompare(right.id));
}

function replaceLaneLabel(value, lane) {
  const label = String(lane?.label || `ช่องจราจร ${lane?.laneNo || ""}`).trim();
  return String(value || "").replace(/ช่องจราจร(?:ที่)?\s*\d+/g, label);
}

function expandLaneTemplateItems(section, lanes, {
  uniqueSlotIds = true,
  systems = [],
  requireLprSystemForLane = false,
} = {}) {
  if (section.code !== "3.1") return section.items;
  const prototypes = section.items.filter((item) => /^3\.1\.lane-1-(?:day|search)$/.test(item.id));
  const installedLprScopes = new Set((Array.isArray(systems) ? systems : [])
    .filter((system) => system?.active !== false
      && Number(system?.quantity ?? 1) > 0
      && canonicalSystemIdForRecord(system) === "lpr-control")
    .map((system) => normalizeRelationshipScope(system?.scope))
    .filter(Boolean));
  const applicableLanes = requireLprSystemForLane
    ? lanes.filter((lane) => installedLprScopes.has(normalizeRelationshipScope(lane?.scope)))
    : lanes;
  const laneCounts = new Map();
  applicableLanes.forEach((lane) => laneCounts.set(lane.laneNo, (laneCounts.get(lane.laneNo) || 0) + 1));
  return applicableLanes.flatMap((lane, laneIndex) => prototypes.map((prototype) => {
    const suffix = prototype.id.match(/^3\.1\.lane-\d+-(.+)$/)?.[1] || "day";
    const duplicateLaneNo = laneCounts.get(lane.laneNo) > 1;
    const baseLabel = replaceLaneLabel(prototype.displayLabel || prototype.label, lane);
    const label = duplicateLaneNo && lane.scope ? baseLabel + " · " + lane.scope : baseLabel;
    const laneIdentity = duplicateLaneNo ? lane.laneNo + "-" + encodeURIComponent(lane.id) : lane.laneNo;
    const itemId = `3.1.lane-${laneIdentity}-${suffix}`;
    return {
      ...prototype,
      templateCopyId: prototype.id,
      id: itemId,
      label,
      displayLabel: label,
      laneScopeLabel: duplicateLaneNo ? lane.scope : "",
      sourceOrder: laneIndex * prototypes.length + (suffix === "day" ? 1 : 2),
      assetBinding: { laneNumber: lane.laneNo, laneId: lane.id },
      laneNo: lane.laneNo,
      evidenceSlots: uniqueSlotIds
        ? prototype.evidenceSlots.map((slot, slotIndex) => ({
          ...slot,
          id: `${itemId}.evidence${slotIndex ? `-${slotIndex + 1}` : ""}`,
          sourceSlotId: slot.id,
          displayLabel: replaceLaneLabel(slot.displayLabel || label, lane),
        }))
        : prototype.evidenceSlots,
    };
  }));
}

function laneLabelForAsset(asset, lanes) {
  const lane = lanes.find((entry) => entry.id === asset?.laneId);
  return lane ? `${lane.label || `ช่องจราจร ${lane.laneNo}`} · ` : "ยังไม่ผูกเลน · ";
}

function buildLaneAssetWimItems(section, equipment, lanes, systems = [], { useSystemPhotos = false } = {}) {
  const roadItems = useSystemPhotos ? [] : section.items.filter((item) => /^2\.1\.road-/.test(item.id)).map((item) => ({ ...item, assetBinding: null, assetId: null, assetNo: "", location: "", serialNo: "" }));
  const sensorPrototype = section.items.find((item) => item.id === "2.1.sensor-set-1-01");
  const loopPrototype = section.items.find((item) => item.id === "2.1.loop-01");
  const wimSystemById = new Map((Array.isArray(systems) ? systems : [])
    .filter((system) => system?.active !== false
      && String(system?.canonicalItemId || "") === "wim-sorting"
      && String(system?.laneId || "").trim())
    .map((system) => [String(system.id), system]));
  const linkedWimAsset = (asset) => wimSystemById.get(String(asset?.parentSystemId || "")) || null;
  const wimAssets = equipment
    .filter((entry) => entry?.active !== false && (entry.type === "WIM_SENSOR" || entry.type === "WIM_LOOP") && linkedWimAsset(entry))
    .map((asset, index) => ({ asset: { ...asset, laneId: linkedWimAsset(asset).laneId }, system: linkedWimAsset(asset), index }))
    .sort((left, right) => {
      const leftLane = lanes.find((lane) => lane.id === left.asset.laneId)?.laneNo || Number.MAX_SAFE_INTEGER;
      const rightLane = lanes.find((lane) => lane.id === right.asset.laneId)?.laneNo || Number.MAX_SAFE_INTEGER;
      if (leftLane !== rightLane) return leftLane - rightLane;
      if ((left.system.instanceNo || 0) !== (right.system.instanceNo || 0)) return (left.system.instanceNo || 0) - (right.system.instanceNo || 0);
      if (left.asset.type !== right.asset.type) return left.asset.type === "WIM_SENSOR" ? -1 : 1;
      return left.index - right.index;
    });
  const assetItems = wimAssets.map(({ asset, system }, index) => {
    const prototype = asset.type === "WIM_SENSOR" ? sensorPrototype : loopPrototype;
    if (!prototype) return null;
    const id = `2.1.${asset.type === "WIM_SENSOR" ? "sensor" : "loop"}-asset-${asset.id}`;
    const equipmentLabel = checklistEquipmentName(asset.type);
    const systemLabel = `WIM Sorting System #${system.instanceNo || "?"}`;
    const label = `${laneLabelForAsset(asset, lanes)}${systemLabel} · ค่าที่วัดได้จาก ${equipmentLabel} · ${asset.assetNo || `ลำดับ ${index + 1}`}`;
    const slotPrototype = prototype.evidenceSlots[0];
    return {
      ...prototype,
      id,
      label,
      displayLabel: label,
      sourceOrder: 100 + index,
      assetBinding: { assetId: asset.id },
      assetId: asset.id,
      assetNo: asset.assetNo || "",
      location: asset.location || "",
      serialNo: asset.serialNo || "",
      laneId: asset.laneId || null,
      laneNo: lanes.find((lane) => lane.id === asset.laneId)?.laneNo || null,
      evidenceSlots: [{
        ...slotPrototype,
        id: `${id}.evidence`,
        sourceOrder: 100 + index,
        displayLabel: label,
        ...(useSystemPhotos && asset.type === "WIM_LOOP"
          ? { photoPurpose: "wim-loop-site", photoRequired: true }
          : {}),
      }],
    };
  }).filter(Boolean);
  return [...roadItems, ...assetItems];
}

export function getEvidenceItemsForSnapshot(snapshot, {
  preservePreviousPolicyShape = null,
  includeCurrentStationControls = false,
  requireLprSystemForLane = false,
} = {}) {
  const preserveLegacyShape = preservePreviousPolicyShape === null
    ? !snapshot?.checklistPolicyVersion
    : preservePreviousPolicyShape;
  if (snapshot?.checklistPolicyVersion === PREVIOUS_LPR_SCOPE_CHECKLIST_POLICY_VERSION) {
    return getStationChecklistItems(snapshot, { includeCurrentSystemRows: true });
  }
  if (snapshot?.checklistPolicyVersion === PREVIOUS_CLEANING_CHECKLIST_POLICY_VERSION) {
    return getStationChecklistItems(snapshot, { includeCleaningControls: false });
  }
  if (snapshot?.checklistPolicyVersion === CHECKLIST_POLICY_VERSION) return getStationChecklistItems(snapshot);
  if (snapshot?.checklistPolicyVersion === PREVIOUS_NO_WIM_CHECKLIST_POLICY_VERSION) {
    // v6 was the only current policy without WIM Control/Electronics System
    // rows. Preserve that snapshot shape while v7 restores them for new work.
    return getStationChecklistItems(snapshot, { includeRetiredWimSystems: false });
  }
  if (snapshot?.checklistPolicyVersion === PREVIOUS_CURRENT_CHECKLIST_POLICY_VERSION) {
    return getStationChecklistItems(snapshot, { includeRetiredWimSystems: true });
  }
  if (snapshot?.checklistPolicyVersion === PREVIOUS_CHECKLIST_POLICY_VERSION) {
    return getStationChecklistItems(snapshot, { preservePreviousPolicyShape: true });
  }
  if (snapshot?.checklistPolicyVersion === HISTORICAL_CHECKLIST_POLICY_VERSION) {
    return getStationChecklistItems(snapshot, { preservePreviousPolicyShape: true });
  }
  if (snapshot?.checklistPolicyVersion === PRIOR_CHECKLIST_POLICY_VERSION) {
    return getStationChecklistItems(snapshot, { preservePreviousPolicyShape: true });
  }
  if (snapshot?.checklistPolicyVersion === LEGACY_CHECKLIST_POLICY_VERSION) {
    return getLegacyStationChecklistItems(snapshot, { preservePreviousPolicyShape: true });
  }
  const equipment = Array.isArray(snapshot?.equipment) ? snapshot.equipment : [];
  const disabled = new Set(Array.isArray(snapshot?.checklistConfig?.disabledTemplateIds) ? snapshot.checklistConfig.disabledTemplateIds : []);
  const useEquipmentCleaningPolicy = isEquipmentCleaningPolicy(snapshot);
  const templateVersion = evidenceTemplateVersionForSnapshot(snapshot);
  const useCurrentTemplate = isCurrentEvidenceTemplateVersion(templateVersion);
  const useLaneAssetMapping = isLaneAssetEvidenceTemplateVersion(templateVersion);
  const templateSections = getEvidenceTemplateSections(templateVersion);
  const copy = getChecklistCopyForSnapshot(snapshot);
  const copySections = new Map(copy.sections.map((section) => [section.code, section]));
  const copyItems = new Map(copy.sections.flatMap((section) => section.items.map((item) => [item.id, item])));
  const lanes = activeLaneTopology(snapshot);
  const activeSystems = activeSystemsForSnapshot(snapshot);
  const dynamicWimElectronics = useCurrentTemplate
    && (preserveLegacyShape ? equipment.some((entry) => isWimElectronicsSubEquipmentType(entry.type)) : hasWimElectronicsContext(equipment));
  const baseItems = templateSections.flatMap((section) => (dynamicWimElectronics && section.code === "2.3"
    ? []
    : useLaneAssetMapping && section.code === "2.1"
    ? buildLaneAssetWimItems(section, equipment, lanes, snapshot?.stationSystems, {
      useSystemPhotos: snapshot?.wimSortingEvidenceVersion === WIM_SORTING_EVIDENCE_VERSION,
    })
    : useCurrentTemplate ? expandLaneTemplateItems(section, lanes, {
      uniqueSlotIds: !preserveLegacyShape,
      systems: activeSystems,
      requireLprSystemForLane,
    }) : section.items).filter((item) => !useEquipmentCleaningPolicy || !isLegacyCleaningItem(item)).map((item) => {
    const copyItem = copyItems.get(item.id) || (item.templateCopyId ? copyItems.get(item.templateCopyId) : null);
    const copySection = copySections.get(section.code);
    const boundLaneId = item?.assetBinding?.laneId || item?.laneId || "";
    const lane = boundLaneId
      ? lanes.find((candidate) => candidate.id === boundLaneId)
      : item?.laneNo ? lanes.find((candidate) => candidate.laneNo === item.laneNo) : null;
    const baseLaneLabel = lane && item?.templateCopyId ? item.label : copyItem?.label || item.label;
    const withLaneScope = (value) => {
      const label = String(value || "");
      const scope = String(item?.laneScopeLabel || "").trim();
      return scope && !label.includes(" · " + scope) ? label + " · " + scope : label;
    };
    const resolvedLabel = lane && useCurrentTemplate
      ? withLaneScope(replaceLaneLabel(baseLaneLabel, lane))
      : (copyItem?.label || item.label);
    const evidenceSlots = item.evidenceSlots.map((slot) => {
      const copySlot = copyItem?.evidenceSlots?.find((entry) => entry.id === slot.id);
      return {
        ...slot,
        displayLabel: lane && useCurrentTemplate
          ? withLaneScope(replaceLaneLabel(copySlot?.displayLabel || resolvedLabel || slot.displayLabel || item.label, lane))
          : (copySlot?.displayLabel || copyItem?.label || slot.displayLabel || item.label),
        sourceLabel: copySlot?.sourceLabel || slot.sourceLabel,
        sourceOrder: copySlot?.sourceOrder || slot.sourceOrder,
        fieldType: copySlot?.fieldType || slot.fieldType,
        required: copySlot?.required !== false,
      };
    });
    return {
      ...item,
      label: resolvedLabel,
      displayLabel: resolvedLabel || item.displayLabel || item.label,
      unit: copyItem?.unit ?? item.unit,
      helper: copyItem?.helper || item.helper,
      sectionCode: section.code,
      sectionTitle: copySection?.title || section.title,
      evidenceSlots,
    };
  }));
  const boundItems = baseItems.map((item) => {
    const assetRequirement = assetRequirementForItem(item);
    const boundAsset = assetForItem(item, equipment);
    const laneNumber = Number.isInteger(item?.assetBinding?.laneNumber) ? item.assetBinding.laneNumber : null;
    const laneId = item?.laneId || item?.assetBinding?.laneId || boundAsset?.laneId || null;
    const boundLane = laneId
      ? lanes.find((lane) => lane.id === laneId) || null
      : (laneNumber === null ? null : lanes.find((lane) => lane.laneNo === laneNumber) || null);
    const dynamicLegacyId = boundAsset ? `${String(boundAsset.type || "").toLowerCase()}-${boundAsset.id}` : null;
    const legacyIds = [...new Set([dynamicLegacyId, ...item.legacyIds].filter(Boolean))];
    const disabledByConfig = legacyIds.some((legacyId) => disabled.has(legacyId)) || disabled.has(item.id);
    const assetDependent = Boolean(assetRequirement);
    const topologyDependent = laneNumber !== null;
    const notApplicable = (assetDependent && !boundAsset) || (topologyDependent && !boundLane);
    return {
      ...item,
      legacyIds,
      assetId: boundAsset?.id || null,
      assetNo: boundAsset?.assetNo || "",
      location: boundAsset?.location || "",
      serialNo: boundAsset?.serialNo || "",
      laneId: boundLane?.id || laneId || null,
      laneNo: boundLane?.laneNo || laneNumber || null,
      assetDependent,
      topologyDependent,
      applicable: !disabledByConfig && !notApplicable,
      checklistDisabled: disabledByConfig,
      helper: disabledByConfig
        ? "ปิดใช้งานสำหรับสถานีนี้ · ไม่รวมในความคืบหน้า"
        : notApplicable
          ? "ไม่มีอุปกรณ์ในทะเบียนสถานี · ไม่รวมในความคืบหน้า"
          : item.helper,
    };
  });
  // The PDF contains twelve Sensor evidence cells, but a new round must show
  // only the real active Sensors. Unused Sensor cells are omitted rather than
  // presented as empty/NA rows. Legacy v3 Snapshots retain all source cells.
  const items = useCurrentTemplate
    ? boundItems
      .filter((item) => !(dynamicWimElectronics && item.sectionCode === "2.3"))
      .filter((item) => !(item.sectionCode === "2.1" && /^2\.1\.sensor-set-\d+-\d+$/.test(item.id) && !item.assetId))
      .concat(dynamicWimElectronics ? buildDynamicWimElectronicsItems(snapshot, equipment) : [])
    : boundItems;

  const catalogAssetTypes = new Set(["WIM_SENSOR", "WIM_LOOP", "LPR_CAMERA", "FIXED_CAMERA", "PTZ_CAMERA"]);
  const currentWimSystemIds = new Set((Array.isArray(snapshot?.stationSystems) ? snapshot.stationSystems : [])
    .filter((system) => system?.active !== false && String(system?.canonicalItemId || "") === "wim-sorting" && String(system?.laneId || "").trim())
    .map((system) => String(system.id)));
  const representedAssetIds = new Set(items.map((item) => item.assetId).filter(Boolean));
  const sensorAssets = equipment.filter((entry) => entry.active !== false && entry.type === "WIM_SENSOR");
  const extraItems = equipment
    .filter((entry) => entry.active !== false && catalogAssetTypes.has(entry.type) && !representedAssetIds.has(entry.id)
      && (!(entry.type === "WIM_SENSOR" || entry.type === "WIM_LOOP") || currentWimSystemIds.has(String(entry.parentSystemId || ""))))
    .map((entry, index) => {
      const groupCode = EVIDENCE_TYPE_TO_GROUP[entry.type] || "";
      const section = templateSections.find((candidate) => candidate.code === groupCode);
      const sensorIndex = entry.type === "WIM_SENSOR" ? sensorAssets.findIndex((asset) => asset.id === entry.id) : -1;
      const isSensorOverflow = useCurrentTemplate && sensorIndex >= 0;
      const itemKey = isSensorOverflow ? `sensor-asset-${entry.id}` : `additional-asset-${entry.id}`;
      const id = `${groupCode}.${itemKey}`;
      const additionalLabel = useCurrentTemplate && sensorIndex >= 0
        ? `ค่าที่วัดได้จาก ${checklistEquipmentName("WIM_SENSOR")} #${sensorIndex + 1}`
        : `รายการเพิ่มเติม ${entry.assetNo || entry.type}`;
      const slot = sourceSlot(groupCode, itemKey, additionalLabel, 9000 + index, { sourceObservedStatus: null, displayLabel: additionalLabel });
      return {
        id,
        label: additionalLabel,
        displayLabel: additionalLabel,
        unit: "",
        helper: useCurrentTemplate && sensorIndex >= 0
          ? "อุปกรณ์ Sensor จริงเกิน 12 ช่องในเอกสารแนบ ให้กรอกค่าที่วัดได้ต่อจากลำดับสุดท้ายและแนบภาพจุดวัด"
          : "อุปกรณ์จริงเกินช่องในเอกสารแนบ ให้ตรวจแยกเป็นรายการเพิ่มเติม",
        inputType: "none",
        fieldType: "photo",
        repeatScope: "per-asset",
        legacyIds: [],
        sourceFile: SOURCE_FILES[groupCode],
        sourceLabel: slot.sourceLabel,
        sourceOrder: slot.sourceOrder,
        evidenceSlots: [slot],
        sectionCode: groupCode,
        sectionTitle: section?.title || "รายการเพิ่มเติม",
        assetId: entry.id,
        assetNo: entry.assetNo,
        location: entry.location,
        serialNo: entry.serialNo,
        assetDependent: true,
        applicable: true,
        checklistDisabled: false,
        isAdditional: true,
      };
    });
  const cleaningItems = useEquipmentCleaningPolicy ? buildCleaningEvidenceItems(snapshot) : [];
  const currentStationControls = includeCurrentStationControls
    ? [...buildAreaCleaningEvidenceItems(snapshot), ...buildNvrOperationalItems(snapshot)]
    : [];
  return [...items, ...extraItems, ...cleaningItems, ...currentStationControls];
}

function isLprFunctionalDuplicate(item) {
  return item?.sectionCode === "3.2" && /^3\.2\.lane-\d+-(?:day|search)$/.test(String(item.id || ""));
}

function disambiguateStationChecklistLabels(items) {
  const groups = new Map();
  items.forEach((item) => {
    const label = String(item.displayLabel || item.label || "").trim();
    const key = `${item.sectionCode || ""}::${label}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });
  return items.map((item) => {
    const baseLabel = String(item.displayLabel || item.label || "").trim();
    const group = groups.get(`${item.sectionCode || ""}::${baseLabel}`) || [];
    if (group.length < 2) return item;
    const ordinal = group.indexOf(item) + 1;
    const label = `${baseLabel} · ลำดับที่ ${ordinal} จาก ${group.length}`;
    return {
      ...item,
      label,
      displayLabel: label,
      evidenceSlots: item.evidenceSlots.map((slot) => ({
        ...slot,
        displayLabel: slot.cleaningStage ? slot.displayLabel : label,
      })),
    };
  });
}

function buildStationChecklistItems(snapshot, {
  includeDisabled = false,
  excludeLprFunctionalDuplicates = false,
  clarifyLprSystem = false,
  preservePreviousPolicyShape = false,
  includeRetiredWimSystems = false,
  includeCurrentSystemRows = false,
  includeCleaningControls = !snapshot?.checklistPolicyVersion
    || snapshot.checklistPolicyVersion === CHECKLIST_POLICY_VERSION,
} = {}) {
  const activeEquipment = getActivePhysicalEquipment(snapshot?.equipment, { includeLegacy: preservePreviousPolicyShape });
  const scopeState = getChecklistScopeState(snapshot, {
    includeLegacy: preservePreviousPolicyShape,
    includeLegacyOwners: includeRetiredWimSystems || preservePreviousPolicyShape,
  });
  const scopedEquipment = preservePreviousPolicyShape
    ? activeEquipment
    : activeEquipment.filter((asset) => scopeState.activeAssets.includes(asset));
  const useCanonicalOrder = !snapshot?.checklistPolicyVersion || snapshot?.orderingVersion === EQUIPMENT_ORDER_VERSION;
  const equipment = useCanonicalOrder
    ? sortEquipmentForDisplay(scopedEquipment, snapshot?.lanes)
    : scopedEquipment;
  const config = snapshot?.checklistConfig || {};
  const legacyDisabled = new Set(config.disabledTemplateIds || []);
  const itemDisabled = new Set(config.disabledItemIds || []);
  const legacySnapshot = { ...snapshot, checklistPolicyVersion: null,
    templateVersion: LANE_ASSET_EVIDENCE_TEMPLATE_VERSION, cleaningPolicyVersion: CLEANING_POLICY_VERSION,
    equipment, checklistConfig: { disabledTemplateIds: [] } };
  const evidenceOptions = {
    preservePreviousPolicyShape,
    includeCurrentStationControls: !preservePreviousPolicyShape,
    requireLprSystemForLane: !preservePreviousPolicyShape
      && (!snapshot?.checklistPolicyVersion
        || snapshot.checklistPolicyVersion === CHECKLIST_POLICY_VERSION
        || snapshot.checklistPolicyVersion === PREVIOUS_CLEANING_CHECKLIST_POLICY_VERSION),
  };
  const original = getEvidenceItemsForSnapshot(legacySnapshot, evidenceOptions);
  const oldControls = config.legacyResolved ? [] : getEvidenceItemsForSnapshot({ ...legacySnapshot,
    templateVersion: snapshot?.templateVersion || EVIDENCE_TEMPLATE_VERSION, cleaningPolicyVersion: null }, evidenceOptions);
  const dedicatedAssetRecipesEnabled = !preservePreviousPolicyShape
    && (!snapshot?.checklistPolicyVersion
      || snapshot.assetChecklistRecipeVersion === DEDICATED_ASSET_CHECKLIST_RECIPE_VERSION);
  const recipeKey = (item) => {
    if (item.isEquipmentCleaning || isLegacyCleaningItem(item)) return "equipment-cleaning";
    if (/^2\.1\.sensor-set-/.test(item.id)) return "2.1.sensor";
    if (/^2\.1\.loop-\d+$/.test(item.id)) return "2.1.loop";
    if (/^2\.1\.(sensor|loop)-asset-/.test(item.id)) return item.id.split("-asset-")[0];
    const requirement = assetRequirementForItem(item);
    return Number.isInteger(requirement?.index)
      ? item.id.split(".").map((part, index) => index < 2 ? part : part.replace(/\d+/g, "n")).join(".")
      : item.id;
  };
  const candidates = original.filter((item) => !(includeCleaningControls && item.isAreaCleaning)
    && !item.assetDependent && !item.assetId && item.applicable !== false)
    .map((item) => ({ ...item, id: item.laneId ? `${item.sectionCode}.lane::${encodeURIComponent(item.laneId)}::${item.id.split("-").at(-1)}` : item.id,
      legacyControlIds: [item.id, ...(item.legacyIds || [])] }));
  for (const asset of equipment) {
    const isWimAsset = asset.type === "WIM_SENSOR" || asset.type === "WIM_LOOP";
    const hasWimParent = Array.isArray(snapshot?.stationSystems)
      && snapshot.stationSystems.some((system) => system?.active !== false
        && canonicalSystemIdForRecord(system) === "wim-sorting"
        && String(system?.id || "") === String(asset.parentSystemId || "")
        && String(system?.laneId || "").trim());
    if (isWimAsset && !hasWimParent && !preservePreviousPolicyShape) continue;
    const wimAsset = asset.type === "CONTROL_CABINET" || isWimElectronicsSubEquipmentType(asset.type);
    const recipeEquipment = wimAsset && !preservePreviousPolicyShape
      ? equipment
      : [asset];
    const dedicatedItems = dedicatedAssetRecipesEnabled ? buildDedicatedAssetChecklistItems(asset) : [];
    const single = (dedicatedItems.length
      ? dedicatedItems
      : getEvidenceItemsForSnapshot({ ...legacySnapshot, equipment: recipeEquipment }, evidenceOptions)
        .filter((item) => item.assetId === asset.id && item.applicable !== false)
        .filter((item) => !includeCleaningControls || (!item.isAreaCleaning && !item.isEquipmentCleaning))
        .filter((item) => !excludeLprFunctionalDuplicates || !isLprFunctionalDuplicate(item)));
    if (!single.length) {
      const category = asset.categoryCode || EVIDENCE_TYPE_TO_GROUP[asset.type]
        || (asset.type === "LPR_CONTROL_SYSTEM" ? "3.1" : "6.1");
      const section = EVIDENCE_CHECKLIST_SECTIONS.find((entry) => entry.code === category)
        || (DYNAMIC_EVIDENCE_SECTION_TITLES[category] ? { code: category, title: DYNAMIC_EVIDENCE_SECTION_TITLES[category] } : null)
        || EVIDENCE_CHECKLIST_SECTIONS.find((entry) => entry.code === "6.1");
      const isLprSystem = asset.type === "LPR_CONTROL_SYSTEM";
      single.push({ id: `${section.code}.asset-check`, sectionCode: section.code, sectionTitle: section.title,
        label: clarifyLprSystem && isLprSystem ? "License Plate Recognition Control System · ตรวจการเชื่อมต่อและการทำงานของระบบ LPR" : "ตรวจสภาพและการทำงานของอุปกรณ์",
        helper: clarifyLprSystem && isLprSystem
          ? "ตรวจซอฟต์แวร์/ระบบควบคุม การรับ-ส่งข้อมูลกับกล้องและ WIM · ไม่รวมสภาพตัวกล้อง"
          : "ตรวจอุปกรณ์ตามทะเบียนสถานี",
        inputType: "none",
        unit: "", fieldType: "photo", sourceFile: "ทะเบียนสถานี",
        sourceLabel: clarifyLprSystem && isLprSystem ? "ภาพหน้าจอระบบหรือผลตรวจการเชื่อมต่อ LPR" : "ตรวจสภาพอุปกรณ์ตามทะเบียน", sourceOrder: 20000,
        legacyIds: [], assetId: asset.id, assetName: checklistEquipmentName(asset.type, asset.catalogItemLabel || asset.type), assetBinding: { assetId: asset.id }, assetDependent: true, isGenericFallback: asset.type === "CUSTOM", applicable: true,
        evidenceSlots: [{ id: "condition", fieldType: "photo",
          displayLabel: clarifyLprSystem && isLprSystem ? "License Plate Recognition Control System · ภาพหน้าจอระบบหรือผลตรวจการเชื่อมต่อ LPR" : "ภาพผลตรวจอุปกรณ์", required: true,
          sourceFile: "ทะเบียนสถานี",
          sourceLabel: clarifyLprSystem && isLprSystem ? "ภาพหน้าจอระบบหรือผลตรวจการเชื่อมต่อ LPR" : "ภาพผลตรวจอุปกรณ์ตามทะเบียน", sourceOrder: 20000 }] });
    }
    for (const item of single) {
      const matching = [...original, ...oldControls].filter((entry) => entry.assetId === asset.id && recipeKey(entry) === recipeKey(item));
      const id = `${recipeKey(item)}::asset::${encodeURIComponent(asset.id)}`;
      const labelForAsset = (text) => {
        return String(text || "").replace(/ช่องจราจร\s*\d+/g, "ช่องจราจรที่อุปกรณ์ใช้งาน").trim();
      };
      const label = preservePreviousPolicyShape ? labelForAsset(item.label) : formatChecklistItemDisplayLabel(labelForAsset(item.label));
      candidates.push({ ...item, id, label, displayLabel: label, assetName: checklistEquipmentName(asset.type, asset.catalogItemLabel || asset.type), assetNo: asset.assetNo || "",
        location: asset.location || "", serialNo: asset.serialNo || "",
        legacyControlIds: [...new Set(matching.flatMap((entry) => [entry.id, ...(entry.legacyIds || [])]))],
        evidenceSlots: item.evidenceSlots.map((slot, index) => ({ ...slot, id: `${id}.evidence-${index + 1}`,
          displayLabel: slot.cleaningStage ? slot.displayLabel
            : labelForAsset(slot.displayLabel || item.label) })) });
    }
  }
  if (includeCleaningControls && !preservePreviousPolicyShape) {
    const cleaningSnapshot = { ...snapshot, equipment };
    const cleaningItems = [
      ...buildCleaningEvidenceItems(cleaningSnapshot),
      ...buildAreaCleaningEvidenceItems(cleaningSnapshot, { groupUnderEquipmentCategories: true }),
    ];
    candidates.push(...cleaningItems.map((item) => ({ ...item, legacyControlIds: [] })));
  }
  const currentPolicy = !snapshot?.checklistPolicyVersion
    || snapshot?.checklistPolicyVersion === CHECKLIST_POLICY_VERSION
    || snapshot?.checklistPolicyVersion === PREVIOUS_CLEANING_CHECKLIST_POLICY_VERSION;
  const includePreviousCurrentSystemRows = includeRetiredWimSystems
    || snapshot?.checklistPolicyVersion === PREVIOUS_CURRENT_CHECKLIST_POLICY_VERSION;
  const includeSystemRows = !preservePreviousPolicyShape
    && (currentPolicy || includePreviousCurrentSystemRows || includeCurrentSystemRows);
  if (includeSystemRows || (preservePreviousPolicyShape && isBoqSystemGroupsPresentation(snapshot?.checklistPresentationVersion))) {
    const emittedLegacySystemRecipes = new Set();
    const stationSystems = Array.isArray(snapshot?.stationSystems) ? snapshot.stationSystems : [];
    const orderedSystems = [...stationSystems];
    if (snapshot?.wimSortingEvidenceVersion === WIM_SORTING_EVIDENCE_VERSION) {
      const laneById = new Map((Array.isArray(snapshot?.lanes) ? snapshot.lanes : []).map((lane) => [String(lane.id), lane]));
      const wimSystem = (system) => canonicalSystemIdForRecord(system) === "wim-sorting";
      const wimSystems = stationSystems.filter(wimSystem).sort((left, right) => {
        const scopeRank = (system) => ({ high: 0, low: 1, imps: 2 })[normalizeRelationshipScope(system?.scope)] ?? 3;
        const scopeDifference = scopeRank(left) - scopeRank(right);
        if (scopeDifference) return scopeDifference;
        const leftLane = laneById.get(String(left?.laneId || ""));
        const rightLane = laneById.get(String(right?.laneId || ""));
        const laneDifference = Number(leftLane?.laneNo ?? left?.instanceNo ?? Number.MAX_SAFE_INTEGER)
          - Number(rightLane?.laneNo ?? right?.instanceNo ?? Number.MAX_SAFE_INTEGER);
        if (laneDifference) return laneDifference;
        return Number(left?.instanceNo || 0) - Number(right?.instanceNo || 0);
      });
      let nextWimIndex = 0;
      orderedSystems.forEach((system, index) => {
        if (wimSystem(system)) orderedSystems[index] = wimSystems[nextWimIndex++];
      });
    }
    for (const system of orderedSystems) {
      if (system?.active === false || Number(system?.quantity ?? 1) <= 0) continue;
      const canonicalSystemId = canonicalSystemIdForRecord(system);
      // This legacy row is a TOR quantity reference, not an installed
      // per-lane WIM System. Its actual installed records carry laneId.
      if (String(system?.id || "") === "present-wim-sorting") continue;
      if (String(system?.id || "").startsWith("present-") && emittedLegacySystemRecipes.has(canonicalSystemId)) continue;
      const systemRecipe = (preservePreviousPolicyShape
        ? LEGACY_SYSTEM_CHECKLIST_RECIPES
        : includePreviousCurrentSystemRows
          ? PREVIOUS_CURRENT_SYSTEM_CHECKLIST_RECIPES
          : CURRENT_SYSTEM_CHECKLIST_RECIPES)[canonicalSystemId];
      if (!systemRecipe) continue;
      // LPR System-level evidence is part of the v2 System/Equipment split.
      // Preserve the historical v1 recipe for existing Inspection Snapshots.
      if (canonicalSystemIdForRecord(system) === "lpr-control"
        && snapshot?.checklistPresentationVersion === LEGACY_BOQ_CHECKLIST_PRESENTATION_VERSION) continue;
      const id = `${systemRecipe.code}.system-check::system::${encodeURIComponent(system.id)}`;
      const isWimSortingEvidence = canonicalSystemId === "wim-sorting"
        && snapshot?.wimSortingEvidenceVersion === WIM_SORTING_EVIDENCE_VERSION;
      const systemLaneNo = (Array.isArray(snapshot?.lanes) ? snapshot.lanes : [])
        .find((lane) => String(lane.id) === String(system.laneId || ""))?.laneNo;
      const label = isWimSortingEvidence
        ? `${systemRecipe.name} · ${system.scope || "ไม่ระบุ Scope"} · Lane ${systemLaneNo || system.instanceNo || "?"}`
        : `${systemRecipe.name} · ตรวจการทำงานของซอฟต์แวร์`;
      const wimEvidenceSlots = isWimSortingEvidence ? [
        { id: `${id}.installation-photo`, fieldType: "photo", displayLabel: `${label} · ภาพติดตั้ง Sensor จริง`,
          required: true, photoPurpose: "wim-installation", photoRequired: true,
          sourceFile: "ตรวจ WIM Sorting System", sourceLabel: "ภาพ Sensor ที่ติดตั้งจริง", sourceOrder: 20000 },
        { id: `${id}.weight-result-photo`, fieldType: "photo", displayLabel: `${label} · ภาพผลประมวลค่าน้ำหนัก`,
          required: true, photoPurpose: "wim-weight-result", photoRequired: true,
          sourceFile: "ตรวจ WIM Sorting System", sourceLabel: `ภาพ Sensor ประมวลผลค่าน้ำหนัก ${system.scope || "ตาม Scope"}`, sourceOrder: 20001 },
      ] : [{ id: `${id}.evidence-1`, fieldType: "photo", displayLabel: label,
        required: true, sourceFile: "ทะเบียนระบบสถานี", sourceLabel: system.sourceLabel || systemRecipe.name, sourceOrder: 20000 }];
      candidates.push({ id, sectionCode: systemRecipe.code, sectionTitle: systemRecipe.name,
        label, displayLabel: label, helper: isWimSortingEvidence
          ? "แนบภาพการติดตั้ง Sensor จริงและภาพผลประมวลค่าน้ำหนักของระบบตาม Scope"
          : "ตรวจระบบที่ติดตั้งจริงตาม Station Profile",
        inputType: "none", unit: "", fieldType: "photo", sourceFile: "ทะเบียนระบบสถานี",
        sourceLabel: system.sourceLabel || systemRecipe.name, sourceOrder: 20000,
        systemRecordId: system.id, scope: system.scope || "", assetId: null, assetDependent: false,
        applicable: true, legacyControlIds: [],
        evidenceSlots: wimEvidenceSlots });
      if (String(system?.id || "").startsWith("present-")) emittedLegacySystemRecipes.add(canonicalSystemId);
    }
  }
  const sectionOrder = (code) => {
    const [major, minor] = String(code || "").split(".").map(Number);
    return Number.isFinite(major) && Number.isFinite(minor) ? major * 100 + minor : Number.MAX_SAFE_INTEGER;
  };
  candidates.sort((a, b) => sectionOrder(a.sectionCode) - sectionOrder(b.sectionCode));
  const labeledCandidates = disambiguateStationChecklistLabels(candidates);
  return labeledCandidates.map((item) => {
    const disabled = itemDisabled.has(item.id) || (!config.legacyResolved
      && item.legacyControlIds.some((id) => legacyDisabled.has(id)));
    const relationshipPath = item.assetId
      ? getRelationshipPathForRecord({ stationFormat: snapshot?.stationFormat, systems: snapshot?.stationSystems, equipment: snapshot?.equipment, kind: "asset", recordId: item.assetId })
      : item.systemRecordId
        ? getRelationshipPathForRecord({ stationFormat: snapshot?.stationFormat, systems: snapshot?.stationSystems, equipment: snapshot?.equipment, kind: "system", recordId: item.systemRecordId })
        : "";
    return { ...item, checklistDisabled: disabled, applicable: !disabled, ...(relationshipPath ? { relationshipPath } : {}) };
  }).filter((item) => includeDisabled || item.applicable);
}

// Existing rounds keep their policy-specific recipes, including the historical
// LPR functional rows that were attached to each camera. New rounds use the
// System + Asset split: 3.1 contains Lane/system checks and 3.2 contains
// physical camera checks.
function getLegacyStationChecklistItems(snapshot, options = {}) {
  return buildStationChecklistItems(snapshot, options);
}

export function getStationChecklistItems(snapshot, options = {}) {
  const includeMappedCleaning = options.includeCleaningControls
    ?? (!snapshot?.checklistPolicyVersion || snapshot.checklistPolicyVersion === CHECKLIST_POLICY_VERSION);
  const items = buildStationChecklistItems(snapshot, {
    ...options,
    includeCleaningControls: includeMappedCleaning,
    includeCurrentSystemRows: options.includeCurrentSystemRows
      || snapshot?.checklistPolicyVersion === PREVIOUS_LPR_SCOPE_CHECKLIST_POLICY_VERSION,
    excludeLprFunctionalDuplicates: true,
    clarifyLprSystem: true,
  });
  const excludesLegacyBoqWorkRows = isBoqSystemGroupsPresentation(snapshot?.checklistPresentationVersion);
  // Section 1.1 is station-level readiness work, not an Asset row, but it is
  // still part of every new field checklist. BOQ presentation keeps it as a
  // separate station-level section instead of dropping it or folding it into
  // an equipment/software group.
  return items.filter((item) => !excludesLegacyBoqWorkRows || !(
    item.sectionCode === "6.2"
    || item.sectionCode === "6.3"
    || (!includeMappedCleaning && item.isEquipmentCleaning)
    || /^2\.1\.road-/.test(item.id)
    || item.id === "2.3.unused-note"
  )).map((item) => isVehicleApiReviewItem(item, snapshot)
    ? {
      ...item,
      helper: "ดึงข้อมูลรถจาก API สถานีจริง แล้วตรวจป้ายทะเบียน ประเภทรถ และจำนวนเพลารายคัน",
      fieldType: "api-review",
      inputType: "none",
      evidenceSlots: [],
    }
    : item);
}

// Resolve old position-based controls once, before changing the register/order.
// Keep the old ids for compatibility; only this new policy reads legacyResolved.
export function resolveStationChecklistConfig(snapshot) {
  const config = snapshot?.checklistConfig || {};
  if (config.legacyResolved) return config;
  const disabledItemIds = getStationChecklistItems(snapshot, { includeDisabled: true })
    .filter((item) => item.checklistDisabled).map((item) => item.id);
  return { ...config, disabledItemIds: [...new Set([...(config.disabledItemIds || []), ...disabledItemIds])], legacyResolved: true };
}

function groupEvidenceItemsBySection(snapshot, items) {
  const templateSections = getEvidenceTemplateSections(evidenceTemplateVersionForSnapshot(snapshot));
  const copy = getChecklistCopyForSnapshot(snapshot);
  const copySections = new Map(copy.sections.map((section) => [section.code, section]));
  const sections = templateSections.map((section) => ({
    ...section,
    title: copySections.get(section.code)?.title || section.title,
    items: items.filter((item) => item.sectionCode === section.code),
  }));
  const knownCodes = new Set(templateSections.map((section) => section.code));
  const dynamicCodes = [...new Set(items.map((item) => item.sectionCode)
    .filter((code) => code && !knownCodes.has(code)))]
    .sort((left, right) => String(left).localeCompare(String(right), undefined, { numeric: true }));
  const dynamicSections = dynamicCodes.map((code) => {
    const sectionItems = items.filter((item) => item.sectionCode === code);
    return {
      code,
      title: copySections.get(code)?.title
        || sectionItems[0]?.sectionTitle
        || DYNAMIC_EVIDENCE_SECTION_TITLES[code]
        || `หมวด ${code}`,
      items: sectionItems,
    };
  });
  const sectionOrder = (code) => {
    const [major, minor] = String(code || "").split(".").map(Number);
    return Number.isFinite(major) && Number.isFinite(minor) ? major * 100 + minor : Number.MAX_SAFE_INTEGER;
  };
  return sections.concat(dynamicSections).sort((left, right) => sectionOrder(left.code) - sectionOrder(right.code));
}

export function getStationChecklistSections(snapshot, { includeDisabled = false } = {}) {
  return getBoqChecklistDisplaySections(snapshot,
    groupEvidenceItemsBySection(snapshot, getStationChecklistItems(snapshot, { includeDisabled })));
}

export function getEvidenceSectionsForSnapshot(snapshot) {
  return groupEvidenceItemsBySection(snapshot, getEvidenceItemsForSnapshot(snapshot));
}

export function getEvidenceCatalogForSnapshot(snapshot) {
  const copyRevision = getChecklistCopyForSnapshot(snapshot).revision;
  return getEvidenceItemsForSnapshot(snapshot).flatMap((item) => item.evidenceSlots.map((slot) => ({
    itemId: item.id,
    itemLabel: item.label,
    displayLabel: item.displayLabel || item.label,
    sectionCode: item.sectionCode,
    sectionTitle: item.sectionTitle,
    helper: item.helper,
    vehicleReviewContext: item.vehicleReviewContext || null,
    checklistNumber: item.checklistNumber || null,
    unit: item.unit,
    applicable: item.applicable !== false,
    assetId: item.assetId || null,
    laneId: item.laneId || null,
    laneNo: item.laneNo || null,
    topologyDependent: item.topologyDependent === true,
    sourceFile: slot.sourceFile,
    sourceLabel: slot.sourceLabel,
    slotId: slot.id,
    slotLabel: slot.displayLabel || item.displayLabel || item.label,
    displayLabel: slot.displayLabel || item.displayLabel || item.label,
    sourceOrder: slot.sourceOrder,
    fieldType: slot.fieldType,
    required: slot.required !== false,
    photoRequired: slot.photoRequired === true,
    photoPurpose: slot.photoPurpose || null,
    cleaningStage: slot.cleaningStage || null,
    cleaningAssetType: slot.cleaningAssetType || item.cleaningAssetType || null,
    isEquipmentCleaning: item.isEquipmentCleaning === true,
    isAreaCleaning: item.isAreaCleaning === true,
    assetDependent: item.assetDependent === true,
    copyRevision,
  })));
}

export function buildEvidenceItemState(items, previous = {}) {
  return Object.fromEntries(items.map((item) => {
    const previousItem = previous[item.id] || (Array.isArray(item.legacyIds) ? item.legacyIds.map((id) => previous[id]).find(Boolean) : null) || {};
    const evidence = normalizeEvidenceMap(item, previousItem.evidence);
    if (previousItem.attachment && !Object.values(evidence).some((entry) => entry.attachment?.id === previousItem.attachment?.id)) {
      const attachmentType = String(previousItem.attachment.type || "").toLowerCase();
      const matchingSlot = item.evidenceSlots.find((slot) => (
        (attachmentType.startsWith("image/") && slot.fieldType === "photo")
        || (attachmentType.startsWith("video/") && slot.fieldType === "video")
        || (["application/pdf", "text/plain"].includes(attachmentType) && slot.fieldType === "document")
      )) || item.evidenceSlots.find((slot) => ["photo", "video", "document"].includes(slot.fieldType));
      if (matchingSlot && evidence[matchingSlot.id]?.attachment == null) evidence[matchingSlot.id].attachment = previousItem.attachment;
    }
    return [item.id, {
      value: previousItem.value ?? "",
      // API-only plate review has no physical-condition status. Keep a neutral
      // internal value so legacy summary consumers do not treat it as pending.
      status: item.applicable === false ? "na" : (item.fieldType === "api-review" ? "normal" : (previousItem.status || "pending")),
      note: String(previousItem.note || ""),
      attachment: previousItem.attachment || null,
      evidence,
    }];
  }));
}

export function getEvidenceSummary(round) {
  const values = round?.inspectionItems || {};
  const items = getEvidenceItemsForSnapshot(round?.snapshot).filter((item) => (
    item.applicable !== false && !isVehicleApiReviewItem(item, round?.snapshot) && !isEvidenceBypassItemStatus(values[item.id]?.status)
  ));
  const inspectionPending = items.filter((item) => values[item.id]?.status === "pending").length;
  const inspectionIssues = items.filter((item) => ["damaged", "waiting"].includes(values[item.id]?.status)).length;
  const slots = items.flatMap((item) => item.evidenceSlots.map((slot) => ({ item, slot, value: values[item.id]?.evidence?.[slot.id] })));
  const counts = Object.fromEntries(EVIDENCE_STATUS_OPTIONS.map((option) => [option.value, 0]));
  slots.forEach(({ value }) => { const status = value?.status || "pending"; counts[status] = (counts[status] || 0) + 1; });
  const complete = slots.filter(({ slot, value }) => isEvidenceSlotComplete(slot, value)).length;
  return {
    itemTotal: items.length,
    itemDone: items.length - inspectionPending,
    itemPending: inspectionPending,
    itemIssues: inspectionIssues,
    slotTotal: slots.length,
    slotComplete: complete,
    slotPending: counts.pending || 0,
    slotIncomplete: slots.length - complete,
    statusCounts: counts,
  };
}

export function evidenceAttachmentIds(record) {
  return Object.values(record?.inspectionItems || record?.items || {}).flatMap((item) => [
    item?.attachment?.id,
    ...Object.values(item?.evidence || {}).map((slot) => slot?.attachment?.id),
  ]).filter(Boolean);
}
