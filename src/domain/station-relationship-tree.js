import { electronicsTypeOrder, sortElectronicsByCabinet } from "./wim-electronics-order.js";
/*
 * Presentation model for the current Station Profile.
 *
 * BOQ/TOR codes remain source references.  This module adds the relationship
 * layer used by the station structure and equipment register so System and
 * Asset records are shown under the system they belong to.  It deliberately
 * does not rewrite records, checklist ids, or Snapshots.
 */

import { CANONICAL_STATION_ITEMS, getCanonicalItemsForFormat } from "./canonical-station-catalog.js";
import { CENTRAL_EQUIPMENT_MAIN_CATEGORIES } from "./equipment-names.js";
import { getStationWorkpointLayout, normalizeWorkpointScope } from "./station-workpoint-layout.js";

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

// Mark these catalog owners as virtual in the tree so an uninstalled choice is
// never mistaken for a saved System record. A real parent appears only after
// the user adds it or it already exists in the Station Profile.
const HIDDEN_RELATIONSHIP_SYSTEM_IDS = new Set(["wim-control", "wim-electronics-system"]);

const MAIN_CATEGORY_BY_RELATIONSHIP_CATEGORY = Object.freeze({
  "wim-sorting": "wim",
  "wim-control": "wim",
  "wim-electronics": "wim",
  "wim-data-control": "data-control",
  lpr: "lpr",
  cctv: "cctv",
  "3d": "3d",
  "image-processing": "image-processing",
  vms: "vms",
  data: "data-control",
  "display-processing": "data-control",
  "station-infrastructure": "station-infrastructure",
});

const MAIN_CATEGORY_BY_ID = new Map(CENTRAL_EQUIPMENT_MAIN_CATEGORIES.map((category) => [category.id, category]));

const SCOPE_ORDER_BY_FORMAT = Object.freeze({
  SC: Object.freeze({
    wim: ["High Speed", "Low Speed"],
    lpr: ["High Speed", "Low Speed", "3D"],
    cctv: ["High Speed", "Low Speed"],
    "3d": ["3D"],
    "image-processing": [],
    vms: ["High Speed", "Low Speed"],
    "data-control": ["High Speed", "Low Speed", "Central"],
    "station-infrastructure": ["Central"],
  }),
  IMPS: Object.freeze({
    wim: ["ImPS"],
    lpr: ["ImPS", "3D"],
    cctv: ["ImPS"],
    "3d": ["3D"],
    "image-processing": ["Image Processing"],
    vms: [],
    "data-control": ["ImPS"],
    "station-infrastructure": ["ImPS"],
  }),
});

function mainCategoryIdForRelationshipCategory(categoryId) {
  return MAIN_CATEGORY_BY_RELATIONSHIP_CATEGORY[categoryId] || null;
}

function mainCategoryLabel(categoryId) {
  return MAIN_CATEGORY_BY_ID.get(categoryId)?.canonicalCategories?.[0] || MAIN_CATEGORY_BY_ID.get(categoryId)?.label || categoryId;
}

function scopeKey(scope) {
  return normalizeRelationshipScope(scope) || String(scope || "").trim().toLocaleLowerCase() || "unspecified";
}

function scopeLabelForKey(categoryId, key, scopeValues = []) {
  const expected = Object.values(SCOPE_ORDER_BY_FORMAT).flatMap((format) => format[categoryId] || []);
  return [...expected, ...scopeValues].find((scope) => scopeKey(scope) === key) || "ไม่ระบุ Scope";
}

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
  return mainCategoryIdForRelationshipCategory(categoryIdForSystem(system));
}

export function getRelationshipCategoryForAsset(asset = {}, parentSystem = null) {
  return mainCategoryIdForRelationshipCategory(categoryIdForAsset(asset, parentSystem));
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

export function getRelationshipCategoryDefinition(categoryId) {
  return MAIN_CATEGORY_BY_ID.get(String(categoryId || "")) || CATEGORY_BY_ID.get(String(categoryId || "")) || null;
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
  const sourceSystems = Array.isArray(systems) ? systems : [];
  const sourceEquipment = Array.isArray(equipment) ? equipment : [];
  const visibleSystems = sourceSystems.filter((system) => includeInactive || isActiveSystem(system));
  const visibleAssets = sourceEquipment.filter((asset) => includeInactive || isActiveAsset(asset));
  const systemById = new Map(visibleSystems.map((system) => [String(system.id), system]));
  const catalogItems = getCanonicalItemsForFormat(format).filter((item) => !item.legacyOnly);
  // Keep saved legacy Systems in canonical order without offering them as new choices.
  const catalogOrder = new Map(CANONICAL_STATION_ITEMS.map((item, index) => [item.id, index]));
  const catalogByType = new Map(catalogItems.filter((item) => item.kind === "asset" && item.equipmentType).map((item) => [String(item.equipmentType).toUpperCase(), item]));
  const categories = new Map();

  const ensureCategory = (categoryId) => {
    if (!categoryId) return null;
    if (categories.has(categoryId)) return categories.get(categoryId);
    const definition = MAIN_CATEGORY_BY_ID.get(categoryId);
    if (!definition) return null;
    const category = {
      id: definition.id,
      label: mainCategoryLabel(definition.id),
      description: definition.description,
      icon: definition.icon,
      format,
      scopes: new Map(),
      systems: [],
      assets: [],
      systemOptions: [],
      equipmentOptions: [],
      systemCount: 0,
      assetCount: 0,
      hasData: false,
      hasOptions: false,
    };
    categories.set(categoryId, category);
    return category;
  };

  const ensureUnmappedCategory = () => {
    if (categories.has("unmapped")) return categories.get("unmapped");
    const category = {
      id: "unmapped",
      label: "นอกแบบ / ยังไม่จัดหมวด",
      description: "รายการจริงที่ยังไม่มีหมวดหลักในผัง",
      icon: "other",
      format,
      scopes: new Map(),
      systems: [],
      assets: [],
      systemOptions: [],
      equipmentOptions: [],
      systemCount: 0,
      assetCount: 0,
      hasData: false,
      hasOptions: false,
    };
    categories.set("unmapped", category);
    return category;
  };

  const ensureScope = (category, scope) => {
    if (!category) return null;
    const key = scopeKey(scope);
    if (category.scopes.has(key)) return category.scopes.get(key);
    const scopeNode = {
      id: key,
      key,
      scope: scopeLabelForKey(category.id, key, [scope]),
      label: scopeLabelForKey(category.id, key, [scope]),
      format,
      systems: [],
      systemOptions: [],
      equipmentOptions: [],
      unlinkedAssets: [],
      systemCount: 0,
      assetCount: 0,
      hasData: false,
      hasOptions: false,
    };
    category.scopes.set(key, scopeNode);
    return scopeNode;
  };

  const optionFor = (item, scope, legacyCategoryId) => ({
    id: `${item.id}::${scope || "default"}`,
    canonicalItemId: item.id,
    equipmentType: item.equipmentType,
    kind: item.kind,
    virtualOwner: item.kind === "system" && HIDDEN_RELATIONSHIP_SYSTEM_IDS.has(item.id),
    nameTh: item.nameTh,
    nameEn: item.nameEn,
    category: item.category,
    categoryId: mainCategoryIdForRelationshipCategory(legacyCategoryId),
    relationshipCategoryId: legacyCategoryId,
    scope,
    groupCode: groupCodeForRecord(
      item.kind === "system"
        ? { canonicalItemId: item.id, systemId: item.id, scope, sourceRefs: item.checklistMapping }
        : { type: item.equipmentType, scope, sourceRefs: item.checklistMapping },
      legacyCategoryId,
      format,
    ),
    defaultUnit: item.defaultUnit,
    sourceRefs: [...(item.checklistMapping || [])],
    systemIds: [...(item.systemIds || [])],
  });

  if (includeCatalogOptions) {
    for (const item of catalogItems) {
      for (const scope of catalogScopesForFormat(item, format)) {
        const sample = item.kind === "system"
          ? { canonicalItemId: item.id, systemId: item.id, scope, sourceRefs: item.checklistMapping }
          : { type: item.equipmentType, scope, sourceRefs: item.checklistMapping };
        const legacyCategoryId = item.kind === "system" ? categoryIdForSystem(sample) : categoryIdForAsset(sample);
        const categoryId = mainCategoryIdForRelationshipCategory(legacyCategoryId);
        const category = ensureCategory(categoryId);
        if (!category) continue;
        const scopeNode = ensureScope(category, scope);
        const option = optionFor(item, scope, legacyCategoryId);
        if (item.kind === "system") scopeNode.systemOptions.push(option);
        else scopeNode.equipmentOptions.push(option);
      }
    }
  }

  const sortSystems = (left, right) => (catalogOrder.get(canonicalSystemId(left)) ?? Number.MAX_SAFE_INTEGER)
    - (catalogOrder.get(canonicalSystemId(right)) ?? Number.MAX_SAFE_INTEGER)
    || (Number(left.instanceNo) || 0) - (Number(right.instanceNo) || 0)
    || String(left.id || "").localeCompare(String(right.id || ""));

  for (const system of visibleSystems) {
    const legacyCategoryId = categoryIdForSystem(system);
    const categoryId = mainCategoryIdForRelationshipCategory(legacyCategoryId);
    const category = ensureCategory(categoryId);
    if (!category) {
      const unmapped = ensureUnmappedCategory();
      const scopeNode = ensureScope(unmapped, system.scope);
      scopeNode.systems.push({ record: system, id: system.id, canonicalItemId: canonicalSystemId(system), equipment: [], equipmentOptions: [] });
      unmapped.systems.push(system);
      continue;
    }
    const scopeNode = ensureScope(category, system.scope);
    scopeNode.systems.push({ record: system, id: system.id, canonicalItemId: canonicalSystemId(system), equipment: [], equipmentOptions: [] });
    category.systems.push(system);
  }

  const systemNodeById = new Map();
  for (const category of categories.values()) {
    for (const scopeNode of category.scopes.values()) {
      scopeNode.systems.sort((left, right) => sortSystems(left.record, right.record));
      for (const systemNode of scopeNode.systems) systemNodeById.set(String(systemNode.record.id), systemNode);
    }
  }

  const linkAsset = (asset, scopeNode, systemNode, association) => {
    const entry = { record: asset, association, parentSystem: systemNode?.record || null };
    if (systemNode) {
      systemNode.equipment.push(entry);
      return;
    }
    scopeNode.unlinkedAssets.push(entry);
  };

  for (const asset of visibleAssets) {
    const storedParentId = String(asset.parentSystemId || "").trim();
    let parentNode = storedParentId ? systemNodeById.get(storedParentId) : null;
    let association = parentNode ? "stored" : storedParentId ? "missing-stored-parent" : "unlinked";
    let legacyCategoryId = parentNode ? categoryIdForSystem(parentNode.record) : categoryIdForAsset(asset);

    if (!storedParentId) {
      const catalogItem = catalogByType.get(String(asset.type || "").toUpperCase());
      const ownerIds = new Set(catalogItem?.systemIds || []);
      const wantedScope = scopeKey(asset.scope);
      let candidates = [...systemNodeById.values()].filter((candidate) => ownerIds.has(candidate.canonicalItemId)
        && scopeKey(candidate.record.scope) === wantedScope);
      if ((asset.type === "WIM_SENSOR" || asset.type === "WIM_LOOP") && asset.laneId) {
        candidates = candidates.filter((candidate) => String(candidate.record.laneId || "") === String(asset.laneId));
      }
      if (candidates.length === 1) {
        parentNode = candidates[0];
        association = "catalog-scope-inferred";
        legacyCategoryId = categoryIdForSystem(parentNode.record);
      }
    }

    const categoryId = mainCategoryIdForRelationshipCategory(legacyCategoryId);
    const category = ensureCategory(categoryId) || ensureUnmappedCategory();
    if (!category) continue;
    const displayScope = parentNode?.record.scope || asset.scope || "";
    const scopeNode = ensureScope(category, displayScope);
    category.assets.push(asset);
    if (parentNode) linkAsset(asset, scopeNode, parentNode, association);
    else linkAsset(asset, scopeNode, null, association);
  }

  for (const category of categories.values()) {
    for (const scopeNode of category.scopes.values()) {
      scopeNode.systemOptions = [...scopeNode.systemOptions].sort((left, right) => (catalogOrder.get(left.canonicalItemId) ?? 0) - (catalogOrder.get(right.canonicalItemId) ?? 0));
      scopeNode.equipmentOptions = [...scopeNode.equipmentOptions].sort((left, right) => electronicsTypeOrder(left.equipmentType) - electronicsTypeOrder(right.equipmentType) || (catalogOrder.get(left.canonicalItemId) ?? 0) - (catalogOrder.get(right.canonicalItemId) ?? 0));
      for (const systemNode of scopeNode.systems) {
        systemNode.equipment.sort((left, right) => (catalogOrder.get(String(left.record.catalogItemId || "")) ?? catalogOrder.get(catalogByType.get(String(left.record.type || "").toUpperCase())?.id) ?? Number.MAX_SAFE_INTEGER) - (catalogOrder.get(String(right.record.catalogItemId || "")) ?? catalogOrder.get(catalogByType.get(String(right.record.type || "").toUpperCase())?.id) ?? Number.MAX_SAFE_INTEGER) || String(left.record.assetNo || left.record.id).localeCompare(String(right.record.assetNo || right.record.id)));
        if (systemNode.canonicalItemId === "wim-electronics-system") systemNode.equipment = sortElectronicsByCabinet(systemNode.equipment, entry => entry.record || entry);
        systemNode.equipmentOptions = scopeNode.equipmentOptions.filter((option) => option.systemIds.includes(systemNode.canonicalItemId));
      }
      for (const option of scopeNode.systemOptions) {
        option.equipmentOptions = scopeNode.equipmentOptions.filter((equipmentOption) => equipmentOption.systemIds.includes(option.canonicalItemId));
      }
      scopeNode.systemCount = scopeNode.systems.length;
      scopeNode.assetCount = scopeNode.systems.reduce((count, systemNode) => count + systemNode.equipment.length, 0) + scopeNode.unlinkedAssets.length;
      scopeNode.hasData = scopeNode.systemCount > 0 || scopeNode.assetCount > 0;
      scopeNode.hasOptions = scopeNode.systemOptions.length > 0 || scopeNode.equipmentOptions.length > 0;
    }
    const order = SCOPE_ORDER_BY_FORMAT[format]?.[category.id] || [];
    const scopeValues = [...category.scopes.values()];
    scopeValues.sort((left, right) => {
      const leftIndex = order.findIndex((scope) => scopeKey(scope) === left.key);
      const rightIndex = order.findIndex((scope) => scopeKey(scope) === right.key);
      return (leftIndex < 0 ? Number.MAX_SAFE_INTEGER : leftIndex) - (rightIndex < 0 ? Number.MAX_SAFE_INTEGER : rightIndex)
        || left.label.localeCompare(right.label);
    });
    category.scopes = scopeValues;
    category.systemCount = category.systems.length;
    category.assetCount = category.assets.length;
    category.systemOptions = scopeValues.flatMap((scope) => scope.systemOptions);
    category.equipmentOptions = scopeValues.flatMap((scope) => scope.equipmentOptions);
    category.hasData = category.systemCount > 0 || category.assetCount > 0;
    category.hasOptions = category.systemOptions.length > 0 || category.equipmentOptions.length > 0;
  }

  const pointLayout = getStationWorkpointLayout(format);
  const assignedScopes = new Set();
  const makeScopedCategory = (category, scopeNode) => {
    const systemRecords = scopeNode.systems.map((node) => node.record);
    const assetEntries = [
      ...scopeNode.systems.flatMap((node) => node.equipment),
      ...scopeNode.unlinkedAssets,
    ];
    const assetRecords = [...new Map(assetEntries.map((entry) => [String(entry.record.id), entry.record])).values()];
    return {
      ...category,
      scopes: [scopeNode],
      systems: systemRecords,
      assets: assetRecords,
      systemOptions: scopeNode.systemOptions,
      equipmentOptions: scopeNode.equipmentOptions,
      sourceRefs: [...new Set([
        ...scopeNode.systemOptions.flatMap((option) => option.sourceRefs || []),
        ...scopeNode.equipmentOptions.flatMap((option) => option.sourceRefs || []),
        ...systemRecords.flatMap((record) => sourceCodes(record)),
        ...assetRecords.flatMap((record) => sourceCodes(record)),
      ])],
      systemCount: scopeNode.systemCount,
      assetCount: scopeNode.assetCount,
      hasData: scopeNode.hasData,
      hasOptions: scopeNode.hasOptions,
    };
  };
  const makeGroup = ({ groupId, code, title, description, category, order, workpoint = null, isUnmapped = false }) => ({
    groupId,
    code,
    order,
    title,
    label: title,
    description,
    workpointId: workpoint?.id || null,
    workSpecNoteId: workpoint?.noteId || null,
    scope: workpoint?.scope || category.scopes[0]?.scope || "",
    sourceRefs: category.sourceRefs,
    format,
    categories: [category],
    scopes: category.scopes,
    systems: category.systems,
    assets: category.assets,
    systemCount: category.systemCount,
    assetCount: category.assetCount,
    hasData: category.hasData,
    hasOptions: category.hasOptions,
    ...(isUnmapped ? { isUnmapped: true } : {}),
  });

  const groups = pointLayout.flatMap((workpoint, index) => {
    const category = categories.get(workpoint.categoryId);
    const scopeNode = category?.scopes.find((scope) => normalizeWorkpointScope(scope.scope) === normalizeWorkpointScope(workpoint.scope));
    if (!category || !scopeNode || (!scopeNode.hasData && !(includeEmptyGroups && scopeNode.hasOptions))) return [];
    assignedScopes.add(`${category.id}::${scopeNode.key}`);
    const scopedCategory = makeScopedCategory(category, scopeNode);
    return [makeGroup({
      groupId: workpoint.id,
      code: workpoint.id,
      title: workpoint.titleEn,
      description: workpoint.titleTh,
      category: scopedCategory,
      order: index + 1,
      workpoint,
    })];
  });

  // Keep saved data visible when its Scope is outside the agreed layout.
  // Empty legacy catalog choices stay hidden so they do not become new paths.
  const legacyScopes = [];
  for (const definition of CENTRAL_EQUIPMENT_MAIN_CATEGORIES) {
    const category = categories.get(definition.id);
    for (const scopeNode of category?.scopes || []) {
      if (!scopeNode.hasData || assignedScopes.has(`${category.id}::${scopeNode.key}`)) continue;
      legacyScopes.push({ category, scopeNode });
    }
  }
  legacyScopes.forEach(({ category, scopeNode }, index) => {
    const scopedCategory = makeScopedCategory(category, scopeNode);
    groups.push(makeGroup({
      groupId: `legacy-${category.id}-${scopeNode.id}`,
      code: `legacy-${category.id}-${scopeNode.id}`,
      title: `Legacy · ${category.label} · ${scopeNode.scope}`,
      description: "ข้อมูลเดิมนอกจุดติดตั้งมาตรฐาน · รายการยังแสดงครบ",
      category: scopedCategory,
      order: pointLayout.length + index + 1,
    }));
  });

  if (categories.has("unmapped")) {
    const category = categories.get("unmapped");
    const scopeValues = [...category.scopes.values()].sort((left, right) => left.label.localeCompare(right.label));
    category.scopes = scopeValues;
    category.systemCount = category.systems.length;
    category.assetCount = category.assets.length;
    category.hasData = category.systemCount > 0 || category.assetCount > 0;
    groups.push(makeGroup({
      groupId: "unmapped",
      code: "unmapped",
      title: "Legacy / Unmapped",
      description: "รายการเดิมที่ยังไม่มีหมวดหลักในผัง · แสดงไว้ท้ายรายการ",
      category,
      order: pointLayout.length + legacyScopes.length + 1,
      isUnmapped: true,
    }));
  }

  return groups;
}

export function getStationRelationshipSystemCount({ stationFormat = "SC", systems = [], includeInactive = false } = {}) {
  const tree = buildStationRelationshipTree({ stationFormat, systems, equipment: [], includeInactive });
  return tree.reduce((total, group) => total + group.systemCount, 0);
}

export function getRelationshipPath({ format = "SC", groupCode = "", categoryId = "", scope = "", kind = "" } = {}) {
  if (String(groupCode || "") === "unmapped" || String(categoryId || "") === "unmapped") return "นอกแบบ / ยังไม่จัดหมวด";
  const mainCategoryId = MAIN_CATEGORY_BY_ID.has(String(categoryId || ""))
    ? String(categoryId)
    : mainCategoryIdForRelationshipCategory(String(categoryId || ""));
  const label = mainCategoryLabel(mainCategoryId || String(categoryId || ""));
  return scope ? `${label} · ${scope}` : label;
}

export function getRelationshipPathForRecord({ stationFormat = "SC", systems = [], equipment = [], kind = "", recordId = "" } = {}) {
  const tree = buildStationRelationshipTree({ stationFormat, systems, equipment, includeEmptyGroups: false, includeInactive: true });
  const targetId = String(recordId || "");
  for (const group of tree) {
    for (const category of group.categories) {
      const records = kind === "system" ? category.systems : category.assets;
      if (records.some((record) => String(record.id || "") === targetId)) {
        const record = records.find((entry) => String(entry.id || "") === targetId);
        return `${getRelationshipPath({ format: group.format, groupCode: group.code, categoryId: category.id, kind })} · ${record?.scope || "ไม่ระบุ Scope"}`;
      }
    }
  }
  return "";
}
