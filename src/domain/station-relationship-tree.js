/*
 * Presentation model for the current Station Profile.
 *
 * BOQ/TOR codes remain source references.  This module adds the relationship
 * layer used by the station structure and equipment register so System and
 * Asset records are shown under the system they belong to.  It deliberately
 * does not rewrite records, checklist ids, or Snapshots.
 */

import { BOQ_CHECKLIST_GROUPS } from "./boq-checklist-groups.js";
import { getCanonicalItemsForFormat } from "./canonical-station-catalog.js";

const ELECTRONICS_TYPES = new Set([
  "CONTROL_CABINET",
  "WIM_AC_DC_POWER_SUPPLY",
  "WIM_NETWORK_EQUIPMENT",
  "WIM_CONTROLLER",
  "WIM_PHASE_PROTECTION",
  "WIM_SUB_BREAKER",
  "WIM_SWITCHING_DC",
  "WIM_TRANSFORMER_24VAC",
]);

const CCTV_TYPES = new Set(["FIXED_CAMERA", "PTZ_CAMERA", "JOYSTICK", "NVR"]);

const CATEGORY_DEFINITIONS = Object.freeze([
  Object.freeze({ id: "wim-sorting", label: "WIM", description: "ระบบคัดแยกน้ำหนัก WIM", icon: "2.1", order: 1 }),
  Object.freeze({ id: "wim-control", label: "WIM Control", description: "ระบบคอมพิวเตอร์ควบคุม WIM", icon: "2.2", order: 2 }),
  Object.freeze({ id: "wim-electronics", label: "WIM Electronics", description: "ตู้และอุปกรณ์ไฟฟ้าภายในระบบ WIM", icon: "2.3", order: 3 }),
  Object.freeze({ id: "wim-data-control", label: "WIM Data/Control", description: "ระบบข้อมูลและการประมวลผล WIM", icon: "6.1", order: 4 }),
  Object.freeze({ id: "lpr", label: "LPR", description: "ระบบควบคุมการอ่านป้ายทะเบียน", icon: "3.1", order: 5 }),
  Object.freeze({ id: "cctv", label: "CCTV", description: "ระบบกล้องโทรทัศน์วงจรปิด", icon: "4.1", order: 6 }),
  Object.freeze({ id: "3d", label: "3D Dimension", description: "ระบบวัดมิติรถบรรทุก 3 มิติ", icon: "1.1.5", order: 7 }),
  Object.freeze({ id: "image-processing", label: "Image Processing", description: "ระบบประมวลผลสัญญาณภาพ", icon: "1.1.12", order: 8 }),
  Object.freeze({ id: "vms", label: "VMS", description: "ระบบป้ายข้อความเปลี่ยนแปลงได้", icon: "7.1", order: 9 }),
  Object.freeze({ id: "data", label: "Database", description: "ฐานข้อมูลและการจัดทำรายงาน", icon: "5.1", order: 10 }),
  Object.freeze({ id: "display-processing", label: "Display/Data Processing", description: "ระบบแสดงผลและประมวลผลข้อมูล", icon: "5.2", order: 11 }),
  Object.freeze({ id: "station-infrastructure", label: "Station Infrastructure", description: "อุปกรณ์โครงสร้างพื้นฐานประจำสถานี", icon: "1.1.11", order: 12 }),
]);

const CATEGORY_BY_ID = new Map(CATEGORY_DEFINITIONS.map((entry) => [entry.id, entry]));

// These two legacy rows remain in the catalog for source compatibility, but
// the relationship layout treats their physical children as Equipment and
// does not render duplicate System rows for them.
const HIDDEN_RELATIONSHIP_SYSTEM_IDS = new Set(["wim-control", "wim-electronics-system"]);

const SC_GROUP_CATEGORY_IDS = Object.freeze({
  "01": ["wim-sorting", "wim-control", "wim-electronics", "wim-data-control", "lpr", "cctv"],
  "02": ["vms"],
  "03": ["3d", "lpr"],
  "04": ["wim-sorting", "wim-control", "wim-electronics", "wim-data-control", "lpr", "cctv"],
  "05": ["vms"],
  "06": ["data", "display-processing", "station-infrastructure"],
});

const IMPS_GROUP_CATEGORY_IDS = Object.freeze({
  "01": ["image-processing"],
  "02": ["wim-sorting", "wim-control", "wim-electronics"],
  "03": ["3d", "lpr"],
  "04": ["lpr"],
  "05": ["cctv"],
  "06": ["data", "display-processing", "station-infrastructure"],
});

function normalizedFormat(value) {
  return String(value || "SC").toUpperCase() === "IMPS" ? "IMPS" : "SC";
}

export function normalizeRelationshipScope(value) {
  const scope = String(value || "").trim().toLowerCase();
  if (scope.includes("low speed") || scope === "low-speed" || scope === "low") return "low";
  if (scope.includes("high speed") || scope === "high-speed" || scope === "high") return "high";
  if (scope.includes("3d") || scope.includes("dimension")) return "3d";
  if (scope.includes("image processing") || scope === "image") return "image";
  if (scope.includes("imps")) return "imps";
  if (scope.includes("central")) return "central";
  return "";
}

function canonicalSystemId(system = {}) {
  return String(system.canonicalItemId || system.systemId || system.id || "").trim().toLowerCase();
}

function sourceCodes(record = {}) {
  return [
    ...(Array.isArray(record.checklistMapping) ? record.checklistMapping : []),
    ...(Array.isArray(record.sourceRefs) ? record.sourceRefs : []),
    record.categoryCode,
  ].map((value) => String(value || "").trim()).filter(Boolean);
}

function isActiveSystem(system) {
  return system?.active !== false && Number(system?.quantity ?? 1) > 0;
}

function isActiveAsset(asset) {
  return asset?.active !== false && asset?.type !== "LANE";
}

function isRelationshipSystem(system) {
  return !HIDDEN_RELATIONSHIP_SYSTEM_IDS.has(canonicalSystemId(system));
}

function categoryIdForSystem(system = {}) {
  const id = canonicalSystemId(system);
  if (id === "wim-sorting") return "wim-sorting";
  if (id === "wim-control") return "wim-control";
  if (id === "wim-electronics-system") return "wim-electronics";
  if (id === "lpr-control") return "lpr";
  if (id === "cctv-system") return "cctv";
  if (id === "dimension-management" || id.includes("dimension")) return "3d";
  if (id === "image-processing-management" || id.includes("image-processing")) return "image-processing";
  if (id === "vms-control" || id.includes("vms")) return "vms";
  if (id === "data-management" || id === "database-reporting") return "data";
  if (id.includes("wim-high-") || id.includes("wim-low-")) return "wim-data-control";
  if (id === "station-display" || id.includes("display")) return "display-processing";
  const codes = sourceCodes(system);
  if (codes.some((code) => code === "2.1")) return "wim-sorting";
  if (codes.some((code) => code === "2.2")) return "wim-control";
  if (codes.some((code) => code === "2.3")) return "wim-electronics";
  if (codes.some((code) => code === "3.1")) return "lpr";
  if (codes.some((code) => code === "4.1" || code === "4.2")) return "cctv";
  if (codes.some((code) => code === "1.1.5")) return "3d";
  if (codes.some((code) => code === "1.1.12")) return "image-processing";
  if (codes.some((code) => code === "7.1")) return "vms";
  if (codes.some((code) => code === "5.1")) return "data";
  if (codes.some((code) => code === "5.2")) return "display-processing";
  if (codes.some((code) => code === "1.1.11")) return "station-infrastructure";
  return null;
}

function categoryIdForAsset(asset = {}, parentSystem = null) {
  const type = String(asset.type || "").trim().toUpperCase();
  const scope = normalizeRelationshipScope(asset.scope || parentSystem?.scope);
  if (type === "WIM_SENSOR" || type === "WIM_LOOP") return "wim-sorting";
  if (type === "CONTROL_COMPUTER") return "wim-control";
  if (ELECTRONICS_TYPES.has(type)) return "wim-electronics";
  if (type === "LPR_CAMERA") return "lpr";
  if (CCTV_TYPES.has(type)) return scope === "image" ? "image-processing" : "cctv";
  if (type === "LASER_SCANNER" || type === "DIMENSION_CONTROLLER") return "3d";
  if (type === "IMAGE_PROCESSOR") return "image-processing";
  if (type === "VMS_SIGN" || type === "VMS_LIGHT_SENSOR" || type === "VMS_DISPLAY") return "vms";
  if (type === "DATABASE_SERVER") return "data";
  if (type === "IMPS_DISPLAY_PROCESSING") return "display-processing";
  if (type === "CABINET") return "station-infrastructure";
  const codes = sourceCodes(asset);
  if (codes.some((code) => code === "2.1")) return "wim-sorting";
  if (codes.some((code) => code === "2.2")) return "wim-control";
  if (codes.some((code) => code === "2.3")) return "wim-electronics";
  if (codes.some((code) => code === "3.1" || code === "3.2")) return "lpr";
  if (codes.some((code) => code === "4.1" || code === "4.2")) return "cctv";
  if (codes.some((code) => code === "1.1.5")) return "3d";
  if (codes.some((code) => code === "1.1.12")) return "image-processing";
  if (codes.some((code) => code === "7.1")) return "vms";
  if (codes.some((code) => code === "5.1")) return "data";
  if (codes.some((code) => code === "5.2")) return "display-processing";
  if (codes.some((code) => code === "1.1.11")) return "station-infrastructure";
  return null;
}

// Public adapters used by the draft station wizard.  Keeping the category
// rules here prevents the wizard and the saved Station Profile from drifting
// apart when a catalog type or system id is added.
export function getRelationshipCategoryForSystem(system = {}) {
  return categoryIdForSystem(system);
}

export function getRelationshipCategoryForAsset(asset = {}, parentSystem = null) {
  return categoryIdForAsset(asset, parentSystem);
}

function scGroupCodeFor({ categoryId, scope, id = "", sourceCodes: codes = [] }) {
  if (categoryId === "vms") return scope === "low" ? "05" : scope === "high" ? "02" : null;
  if (categoryId === "3d" || scope === "3d") return "03";
  if (categoryId === "data" || categoryId === "display-processing" || categoryId === "station-infrastructure") return "06";
  if (categoryId === "wim-data-control") {
    if (scope === "low") return "04";
    if (scope === "high") return "01";
  }
  if (scope === "low") return "04";
  if (scope === "high") return "01";
  if (id.includes("wim-low-")) return "04";
  if (id.includes("wim-high-")) return "01";
  if (codes.some((code) => code === "1.1.5" || code === "3")) return "03";
  if (codes.some((code) => code === "5" || code === "6" || code === "7")) return "06";
  return null;
}

function impsGroupCodeFor({ categoryId, scope }) {
  if (categoryId === "image-processing" || scope === "image") return "01";
  if (categoryId === "wim-sorting" || categoryId === "wim-control" || categoryId === "wim-electronics") return "02";
  if (categoryId === "3d" || (categoryId === "lpr" && scope === "3d")) return "03";
  if (categoryId === "lpr") return "04";
  if (categoryId === "cctv") return "05";
  if (categoryId === "data" || categoryId === "display-processing" || categoryId === "station-infrastructure") return "06";
  return null;
}

function groupCodeForRecord(record, categoryId, format, parentSystem = null) {
  const scope = normalizeRelationshipScope(record.scope || parentSystem?.scope);
  const id = canonicalSystemId(record);
  const codes = sourceCodes(record);
  return normalizedFormat(format) === "IMPS"
    ? impsGroupCodeFor({ categoryId, scope })
    : scGroupCodeFor({ categoryId, scope, id, sourceCodes: codes });
}

function nodeForCategory(categoryId, groupCode, format) {
  const definition = CATEGORY_BY_ID.get(categoryId);
  const allowed = normalizedFormat(format) === "IMPS" ? IMPS_GROUP_CATEGORY_IDS[groupCode] : SC_GROUP_CATEGORY_IDS[groupCode];
  if (!definition || !allowed?.includes(categoryId)) return null;
  return {
    id: definition.id,
    label: definition.label,
    description: definition.description,
    icon: definition.icon,
    order: definition.order,
    groupCode,
    format: normalizedFormat(format),
    systems: [],
    assets: [],
    systemOptions: [],
    equipmentOptions: [],
  };
}

function cloneCategoryNode(categoryId, groupCode, format) {
  const node = nodeForCategory(categoryId, groupCode, format);
  return node ? { ...node, systems: [], assets: [], systemOptions: [], equipmentOptions: [] } : null;
}

export function getRelationshipCategoryDefinition(categoryId) {
  return CATEGORY_BY_ID.get(String(categoryId || "")) || null;
}

function catalogScopesForFormat(item, format) {
  if (item.kind === "system") {
    const allowed = item.allowedScopes || [];
    if (item.id === "image-processing-management") return [allowed.includes("Image Processing") ? "Image Processing" : "ImPS"].filter((scope) => allowed.includes(scope));
    if (["data-management", "station-display"].includes(item.id)) {
      const preferred = format === "SC" ? "Central" : "ImPS";
      return allowed.includes(preferred) ? [preferred] : allowed.slice(0, 1);
    }
    if (format === "IMPS") return ["ImPS", "3D"].filter((scope) => allowed.includes(scope));
    return ["High Speed", "Low Speed", "3D"].filter((scope) => allowed.includes(scope));
  }
  if (["database-server", "station-display-equipment"].includes(item.id)) {
    const preferred = format === "SC" ? "Central" : "ImPS";
    return (item.allowedScopes || []).includes(preferred) ? [preferred] : [];
  }
  if (item.id === "image-processor") return ["Image Processing"].filter((scope) => (item.allowedScopes || []).includes(scope));
  const scopes = item.scopeVariants?.length ? item.scopeVariants : item.allowedScopes;
  if (!Array.isArray(scopes) || !scopes.length) return [""];
  return scopes.filter((scope) => {
    const normalized = String(scope || "").trim().toLowerCase();
    if (format === "SC") return !["imps", "image processing"].includes(normalized);
    return !["high speed", "low speed"].includes(normalized);
  });
}

export function buildStationRelationshipTree({ stationFormat = "SC", systems = [], equipment = [], includeEmptyGroups = false, includeInactive = false, includeCatalogOptions = false } = {}) {
  const format = normalizedFormat(stationFormat);
  const groupDefinitions = BOQ_CHECKLIST_GROUPS[format] || [];
  const systemById = new Map((Array.isArray(systems) ? systems : []).map((system) => [String(system.id), system]));
  const groups = groupDefinitions.map((group) => ({
    ...group,
    categories: new Map(),
  }));
  const unmatchedSystems = [];
  const unmatchedAssets = [];

  const ensureCategory = (group, categoryId) => {
    if (!categoryId) return null;
    if (!group.categories.has(categoryId)) group.categories.set(categoryId, cloneCategoryNode(categoryId, group.code, format));
    return group.categories.get(categoryId) || null;
  };

  (Array.isArray(systems) ? systems : []).filter((system) => isRelationshipSystem(system) && (includeInactive || isActiveSystem(system))).forEach((system) => {
    const categoryId = categoryIdForSystem(system);
    const groupCode = groupCodeForRecord(system, categoryId, format);
    const group = groups.find((entry) => entry.code === groupCode);
    const category = group ? ensureCategory(group, categoryId) : null;
    if (category) category.systems.push(system);
    else unmatchedSystems.push(system);
  });

  (Array.isArray(equipment) ? equipment : []).filter((asset) => includeInactive || isActiveAsset(asset)).forEach((asset) => {
    const parentSystem = asset.parentSystemId ? systemById.get(String(asset.parentSystemId)) : null;
    const categoryId = categoryIdForAsset(asset, parentSystem);
    const groupCode = groupCodeForRecord(asset, categoryId, format, parentSystem);
    const group = groups.find((entry) => entry.code === groupCode);
    const category = group ? ensureCategory(group, categoryId) : null;
    if (category) category.assets.push(asset);
    else unmatchedAssets.push(asset);
  });

  if (includeCatalogOptions) {
    getCanonicalItemsForFormat(format).forEach((item) => {
      if (item.legacyOnly || (item.kind === "system" && HIDDEN_RELATIONSHIP_SYSTEM_IDS.has(item.id))) return;
      catalogScopesForFormat(item, format).forEach((scope) => {
        const record = item.kind === "system"
          ? { canonicalItemId: item.id, systemId: item.id, scope, sourceRefs: item.checklistMapping }
          : { type: item.equipmentType, scope, sourceRefs: item.checklistMapping };
        const categoryId = item.kind === "system"
          ? categoryIdForSystem(record)
          : categoryIdForAsset(record);
        const groupCode = groupCodeForRecord(record, categoryId, format);
        const group = groups.find((entry) => entry.code === groupCode);
        const category = group ? ensureCategory(group, categoryId) : null;
        if (!category) return;
        const option = {
          id: `${item.id}::${scope || "default"}`,
          canonicalItemId: item.id,
          equipmentType: item.equipmentType,
          kind: item.kind,
          nameTh: item.nameTh,
          nameEn: item.nameEn,
          category: item.category,
          scope,
          defaultUnit: item.defaultUnit,
          sourceRefs: [...(item.checklistMapping || [])],
          systemIds: [...(item.systemIds || [])],
        };
        if (item.kind === "system") category.systemOptions.push(option);
        else category.equipmentOptions.push(option);
      });
    });
  }

  const mappedGroups = groups.map((group) => {
    const categoryIds = normalizedFormat(format) === "IMPS" ? IMPS_GROUP_CATEGORY_IDS[group.code] : SC_GROUP_CATEGORY_IDS[group.code];
    const categories = categoryIds
      .map((categoryId) => group.categories.get(categoryId) || (includeEmptyGroups ? cloneCategoryNode(categoryId, group.code, format) : null))
      .filter(Boolean)
      .map((category) => ({
        ...category,
        systems: [...category.systems],
        assets: [...category.assets],
        systemOptions: [...category.systemOptions],
        equipmentOptions: [...category.equipmentOptions],
        systemCount: category.systems.length,
        assetCount: category.assets.length,
        hasData: category.systems.length > 0 || category.assets.length > 0,
      }));
    const systemCount = categories.reduce((total, category) => total + category.systemCount, 0);
    const assetCount = categories.reduce((total, category) => total + category.assetCount, 0);
    return {
      ...group,
      categories,
      systemCount,
      assetCount,
      hasData: systemCount > 0 || assetCount > 0,
    };
  }).filter((group) => includeEmptyGroups || group.hasData);
  if (!unmatchedSystems.length && !unmatchedAssets.length) return mappedGroups;

  const unmappedCategory = {
    id: "unmapped",
    label: "นอกแบบ / ยังไม่จัดหมวด",
    description: "รายการจริงที่ยังไม่มีตำแหน่งในผังของรูปแบบสถานีนี้",
    icon: "other",
    order: Number.MAX_SAFE_INTEGER,
    groupCode: "unmapped",
    format,
    systems: unmatchedSystems,
    assets: unmatchedAssets,
    systemOptions: [],
    equipmentOptions: [],
    systemCount: unmatchedSystems.length,
    assetCount: unmatchedAssets.length,
    hasData: true,
  };
  return [...mappedGroups, {
    groupId: "unmapped",
    code: "unmapped",
    title: "นอกแบบ / ยังไม่จัดหมวด",
    sourceRefs: [],
    format,
    categories: [unmappedCategory],
    systemCount: unmatchedSystems.length,
    assetCount: unmatchedAssets.length,
    hasData: true,
    isUnmapped: true,
  }];
}

export function getStationRelationshipSystemCount({ stationFormat = "SC", systems = [], includeInactive = false } = {}) {
  const tree = buildStationRelationshipTree({ stationFormat, systems, equipment: [], includeInactive });
  return tree.reduce((total, group) => total + group.systemCount, 0);
}

export function getRelationshipPath({ format = "SC", groupCode = "", categoryId = "", kind = "" } = {}) {
  if (String(groupCode || "") === "unmapped" || String(categoryId || "") === "unmapped") return "นอกแบบ / ยังไม่จัดหมวด";
  const normalized = normalizedFormat(format);
  const minor = kind === "asset" ? "01" : "02";
  return `${normalized}-${String(groupCode || "").padStart(2, "0")}.${minor} · ${CATEGORY_BY_ID.get(categoryId)?.label || "หมวดระบบ"}`;
}

export function getRelationshipPathForRecord({ stationFormat = "SC", systems = [], equipment = [], kind = "", recordId = "" } = {}) {
  const tree = buildStationRelationshipTree({ stationFormat, systems, equipment, includeEmptyGroups: false, includeInactive: true });
  const targetId = String(recordId || "");
  for (const group of tree) {
    for (const category of group.categories) {
      const records = kind === "system" ? category.systems : category.assets;
      if (records.some((record) => String(record.id || "") === targetId)) {
        return getRelationshipPath({ format: group.format, groupCode: group.code, categoryId: category.id, kind });
      }
    }
  }
  return "";
}
