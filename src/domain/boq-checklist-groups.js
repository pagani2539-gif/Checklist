import { getCentralEquipmentName } from "./equipment-names.js";
import { getCanonicalItem } from "./canonical-station-catalog.js";

// Presentation-only numbering. Source section codes and item IDs remain the
// evidence/Snapshot identity and must never be replaced by these numbers.
export const LEGACY_BOQ_CHECKLIST_PRESENTATION_VERSION = "boq-system-groups-v1";
export const BOQ_CHECKLIST_PRESENTATION_VERSION = "boq-system-groups-v2";

const makeGroup = (format, code, title, sourceRefs, displayOrder) => Object.freeze({
  format,
  code,
  groupId: `${format}-${code}`,
  groupNumber: code,
  title,
  sourceRefs: Object.freeze([...sourceRefs]),
  displayOrder,
});

export const BOQ_CHECKLIST_GROUPS = Object.freeze({
  SC: Object.freeze([
    makeGroup("SC", "01", "WIM High Speed", ["1.1", "1.2", "1.3", "1.4"], 1),
    makeGroup("SC", "02", "VMS for High Speed", ["5"], 2),
    makeGroup("SC", "03", "3D Truck Dimension Measurement", ["3"], 3),
    makeGroup("SC", "04", "Low Speed WIM", ["4"], 4),
    makeGroup("SC", "05", "VMS for Low Speed", ["5"], 5),
    makeGroup("SC", "06", "Central Systems", ["6", "7"], 6),
  ]),
  IMPS: Object.freeze([
    makeGroup("IMPS", "01", "Image Processing", ["1"], 1),
    makeGroup("IMPS", "02", "WIM", ["2"], 2),
    makeGroup("IMPS", "03", "3D Truck Dimension Measurement", [], 3),
    makeGroup("IMPS", "04", "LPR", ["3"], 4),
    makeGroup("IMPS", "05", "CCTV", ["4"], 5),
    makeGroup("IMPS", "06", "Data Systems", ["5"], 6),
  ]),
});

const GROUP_SCOPE_BY_FORMAT = Object.freeze({
  SC: Object.freeze({
    "01": "High Speed",
    "02": "High Speed",
    "03": "3D",
    "04": "Low Speed",
    "05": "Low Speed",
    "06": "Central",
  }),
  IMPS: Object.freeze({
    "01": "Image Processing",
    "02": "ImPS",
    "03": "3D",
    "04": "ImPS",
    "05": "ImPS",
    "06": "ImPS",
  }),
});

function normalizedBoqGroupCode(value) {
  return String(value || "").trim().replace(/^(SC|IMPS)-/i, "");
}

export function getBoqScopeForGroup(stationFormat = "SC", groupCode = "") {
  const format = String(stationFormat || "SC").toUpperCase() === "IMPS" ? "IMPS" : "SC";
  return GROUP_SCOPE_BY_FORMAT[format][normalizedBoqGroupCode(groupCode)] || "";
}

export function filterCatalogItemsByBoqGroup(items = [], canonicalItems = [], { stationFormat = "SC", groupCode = "" } = {}) {
  const sourceItems = Array.isArray(items) ? items : [];
  const targetGroupCode = normalizedBoqGroupCode(groupCode);
  if (!targetGroupCode) return sourceItems;
  const format = String(stationFormat || "SC").toUpperCase() === "IMPS" ? "IMPS" : "SC";
  const scope = getBoqScopeForGroup(format, targetGroupCode);
  if (!scope) return [];
  const definitions = Array.isArray(canonicalItems) ? canonicalItems : [];
  return sourceItems.filter((item) => {
    if (item?.legacyOnly || (Array.isArray(item?.allowedFormats) && !item.allowedFormats.includes(format))) return false;
    const kind = item?.kind === "system" ? "system" : "asset";
    const definition = kind === "system"
      ? item
      : definitions.find((entry) => entry?.kind === "asset" && entry.equipmentType === (item?.type || item?.equipmentType));
    const allowedScopes = item?.scopeVariants?.length
      ? item.scopeVariants
      : definition?.scopeVariants?.length
        ? definition.scopeVariants
        : item?.allowedScopes || definition?.allowedScopes || [];
    if (allowedScopes.length && !allowedScopes.includes(scope)) return false;
    const placement = getBoqAddCategory({
      stationFormat: format,
      kind,
      type: item?.type || item?.equipmentType,
      categoryCode: item?.categoryCode || definition?.checklistMapping?.[0],
      canonicalItemId: definition?.id || (kind === "system" ? item?.id : ""),
      scope,
    });
    return normalizedBoqGroupCode(placement.groupCode) === targetGroupCode;
  });
}

const LEGACY_BOQ_CHECKLIST_GROUPS = Object.freeze({
  SC: BOQ_CHECKLIST_GROUPS.SC,
  IMPS: Object.freeze([
    makeGroup("IMPS", "07", "Image Processing", ["1"], 1),
    makeGroup("IMPS", "08", "WIM", ["2"], 2),
    makeGroup("IMPS", "09", "3D Truck Dimension Measurement", [], 3),
    makeGroup("IMPS", "10", "LPR", ["3"], 4),
    makeGroup("IMPS", "11", "CCTV", ["4"], 5),
    makeGroup("IMPS", "12", "Data Systems", ["5"], 6),
  ]),
});

const CURRENT_IMPS_GROUP_BY_TOR_CATEGORY = Object.freeze({ "1": "01", "2": "02", "3": "04", "4": "05", "5": "06" });
const LEGACY_IMPS_GROUP_BY_TOR_CATEGORY = Object.freeze({ "1": "07", "2": "08", "3": "10", "4": "11", "5": "12" });

const SYSTEM_DISPLAY_ORDER = Object.freeze({
  SC: Object.freeze([
    "wim-sorting", "wim-control", "wim-electronics-system",
    "wim-high-data-control", "wim-high-reporting", "wim-high-display",
    "lpr-control", "cctv-system", "data-management", "station-display",
    "vms-control", "dimension-management",
    "wim-low-data-control", "wim-low-reporting", "wim-low-display",
  ]),
  IMPS: Object.freeze([
    "image-processing-management", "wim-sorting", "wim-control", "wim-electronics-system",
    "dimension-management", "lpr-control", "cctv-system", "data-management", "station-display",
  ]),
});

// The Ranong construction BOQ and the station TOR use different numbering.
// Keep both references; do not turn BOQ work rows into Assets.
const SC_BOQ_REFS = Object.freeze({
  "sc-hs-wim-sorting": "1.1", "sc-hs-wim-electronics": "1.1", "sc-hs-wim-control": "1.1",
  "sc-lpr-control": "1.2", "sc-lpr-camera": "1.2",
  "sc-hs-cctv-adjustable": "1.3", "sc-hs-cctv-fixed": "1.3", "sc-hs-cctv-joystick": "1.3", "sc-hs-cctv-nvr": "1.3",
  "sc-hs-data-control": "1.4", "sc-hs-reporting": "1.4", "sc-hs-display": "1.4",
  "sc-3d-scanner": "3.1", "sc-3d-controller": "3.2", "sc-3d-management": "3.3", "sc-3d-lpr": "3.4",
  "sc-ls-wim-sorting": "4.1", "sc-ls-wim-electronics": "4.1", "sc-ls-wim-control": "4.1",
  "sc-ls-cctv-adjustable": "4.2", "sc-ls-cctv-fixed": "4.2", "sc-ls-lpr": "4.2",
  "sc-ls-data-control": "4.3", "sc-ls-reporting": "4.3", "sc-ls-display": "4.3",
  "sc-vms-large": "5.1", "sc-vms-small": "5.2", "sc-vms-low": "5.3", "sc-vms-control": "5.7",
  "sc-central-data": "6.1", "sc-central-display": "6.2", "sc-cabinet": "7.1",
});

const SYSTEM_ENGLISH_NAMES = Object.freeze({
  WIM_SORTING: "WIM Sorting System", WIM_ELECTRONICS: "WIM Electronics System", WIM_CONTROL: "WIM Control System",
  LPR_CONTROL: "License Plate Recognition Control System",
  WIM_DATA_CONTROL: "WIM Data Control System", WIM_REPORTING: "WIM Reporting System",
  WIM_DISPLAY_PROCESSING: "WIM Display and Processing System", TRUCK_3D_MANAGEMENT: "3D Truck Dimension Management System",
  VMS_CONTROL: "VMS Control System", CENTRAL_DATA_CONTROL: "Central Data Control System",
  CENTRAL_DISPLAY_PROCESSING: "Central Display and Processing System",
  IMAGE_PROCESSING_MANAGEMENT: "Image Processing Management System",
  DATABASE_REPORTING: "Database Management and Reporting System",
  IMPS_DISPLAY_PROCESSING: "Display and Data Processing System",
});

export function mapTorEquipmentAndSoftware(items = [], format = "SC") {
  const isImps = String(format).toUpperCase() === "IMPS";
  return items.filter((entry) => entry.kind === "asset" || entry.kind === "system").map((entry) => {
    const groupCode = isImps
      ? (CURRENT_IMPS_GROUP_BY_TOR_CATEGORY[entry.category] || null)
      : entry.category === "1.1.9"
        ? (entry.id === "sc-vms-control"
          ? null
          : entry.scope === "low-speed"
            ? "05"
            : entry.scope === "high-speed" ? "02" : null)
        : ({ "1.1.1": "01", "1.1.2": "01", "1.1.3": "01", "1.1.4": "01", "1.1.5": "03",
          "1.1.6": "04", "1.1.7": "04", "1.1.8": "04", "1.1.10": "06", "1.1.11": "06" }[entry.category] || null);
    const group = groupCode ? BOQ_CHECKLIST_GROUPS[isImps ? "IMPS" : "SC"].find((candidate) => candidate.code === groupCode) : null;
    return {
      torItemId: entry.id, canonicalId: entry.canonicalId,
      nameEn: getCentralEquipmentName(entry.assetType)?.nameEn || SYSTEM_ENGLISH_NAMES[entry.canonicalId] || entry.sourceName,
      kind: entry.kind, groupCode, groupId: group?.groupId || null, torSourceRef: entry.category,
      boqSourceRef: isImps ? entry.category : SC_BOQ_REFS[entry.id] || null,
      scope: entry.scope,
      scopeRequired: entry.id === "sc-vms-control",
      sourceScopeConflict: entry.id === "sc-vms-low", // TOR says Low Speed; Ranong BOQ 5.3 says For HI SPEED.
    };
  });
}

const THREED_TYPES = new Set(["LASER_SCANNER", "DIMENSION_CONTROLLER"]);
const VMS_TYPES = new Set(["VMS_SIGN", "VMS_LIGHT_SENSOR", "VMS_DISPLAY"]);

const CANONICAL_CATEGORY_BY_TYPE = Object.freeze({
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

const CANONICAL_CATEGORY_BY_SYSTEM = Object.freeze({
  "wim-sorting": "2.1",
  "wim-control": "2.2",
  "wim-electronics-system": "2.3",
  "lpr-control": "3.1",
  "cctv-system": "4.1",
  "dimension-management": "1.1.5",
  "image-processing-management": "1.1.12",
  "vms-control": "7.1",
  "data-management": "5.1",
  "station-display": "5.2",
});

function canonicalCategoryCodesFor({ type = "", canonicalItemId = "", categoryCode = "" } = {}) {
  const canonical = getCanonicalItem(canonicalItemId);
  const mapped = CANONICAL_CATEGORY_BY_TYPE[String(type || "").trim().toUpperCase()]
    || CANONICAL_CATEGORY_BY_SYSTEM[String(canonicalItemId || "").trim()]
    || canonical?.checklistMapping?.[0]
    || String(categoryCode || "").trim();
  if (!mapped) return [];
  if (canonical?.checklistMapping?.includes(String(categoryCode || "").trim())) {
    return [String(categoryCode).trim()];
  }
  return [mapped];
}

export function getCanonicalEquipmentCategoryCode({ type = "", canonicalItemId = "", categoryCode = "" } = {}) {
  return canonicalCategoryCodesFor({ type, canonicalItemId, categoryCode })[0] || "";
}

/**
 * Resolve the one presentation placement shared by the station register,
 * station wizard, checklist and report. The input category is retained as a
 * source hint, but known canonical types always win when legacy data contains
 * a stale valid category code.
 */
export function resolveEquipmentPlacement({ stationFormat = "SC", kind = "asset", type = "", categoryCode = "", scope = "", canonicalItemId = "" } = {}) {
  const resolvedKind = kind === "system" ? "system" : "asset";
  const resolvedCategoryCode = getCanonicalEquipmentCategoryCode({ type, canonicalItemId, categoryCode });
  const placement = getBoqAddCategory({
    stationFormat,
    kind: resolvedKind,
    type,
    categoryCode: resolvedCategoryCode,
    scope,
    canonicalItemId,
  });
  return {
    ...placement,
    format: String(stationFormat || "SC").toUpperCase() === "IMPS" ? "IMPS" : "SC",
    kind: resolvedKind,
    type: String(type || ""),
    canonicalItemId: String(canonicalItemId || ""),
    categoryCode: resolvedCategoryCode,
    inputCategoryCode: String(categoryCode || ""),
    scope: String(scope || "").trim() || null,
  };
}

export function getBoqAddCategory({ stationFormat = "SC", type = "", categoryCode = "", scope = "", kind = "asset", canonicalItemId = "" } = {}) {
  const format = String(stationFormat).toUpperCase() === "IMPS" ? "IMPS" : "SC";
  const owner = normalizedScope(scope);
  const normalizedType = String(type || "");
  const source = getCanonicalEquipmentCategoryCode({ type, canonicalItemId, categoryCode });
  const id = String(canonicalItemId || "").toLowerCase();
  let groupCode = "";
  if (owner === "3d" || THREED_TYPES.has(normalizedType) || id.includes("dimension") || source === "1.1.5") groupCode = "03";
  else if (format === "IMPS") {
    if (owner === "image" || id.includes("image-processing") || source === "1.1.12") groupCode = "01";
    else if (source.startsWith("2.") || id.startsWith("wim-")) groupCode = "02";
    else if (source.startsWith("3.") || normalizedType === "LPR_CAMERA" || id.includes("lpr")) groupCode = "04";
    else if (source.startsWith("4.") || normalizedType.includes("CAMERA") || id.includes("cctv")) groupCode = "05";
    else groupCode = "06";
  } else if (VMS_TYPES.has(normalizedType) || id.includes("vms") || source.startsWith("7.")) groupCode = owner === "low" ? "05" : owner === "high" ? "02" : "";
  else if (source.startsWith("5.") || source === "1.1.11" || id === "data-management" || id === "station-display" || id.includes("central")) groupCode = "06";
  else if (owner === "low") groupCode = "04";
  else if (owner === "high") groupCode = "01";
  else if (source.startsWith("6.")) groupCode = "06";
  else if (source === "1.1.8") groupCode = "04";
  else if (source.startsWith("1.1.") || source.startsWith("2.") || source.startsWith("3.") || source.startsWith("4.") || id.startsWith("wim-")) groupCode = "01";
  const group = BOQ_CHECKLIST_GROUPS[format].find((entry) => entry.code === groupCode);
  const minor = kind === "system" ? "02" : "01";
  return {
    code: group ? `${group.groupId}.${minor}` : "",
    displayNumber: group ? `${group.groupNumber}.${minor}` : "",
    groupId: group?.groupId || "",
    groupCode: group?.groupNumber || "",
    title: group ? `${group.title} - ${kind === "system" ? "Systems & Software" : "Equipment"}` : "Assign system group",
    sourceCode: source,
  };
}

export function sortCanonicalSystemDefinitions(items = [], stationFormat = "SC", scopeResolver = () => "") {
  const format = String(stationFormat).toUpperCase() === "IMPS" ? "IMPS" : "SC";
  const order = new Map((SYSTEM_DISPLAY_ORDER[format] || []).map((id, index) => [id, index]));
  const groupOrder = new Map(BOQ_CHECKLIST_GROUPS[format].map((group) => [group.code, group.displayOrder]));
  return items.map((item, index) => ({ item, index })).sort((left, right) => {
    const scopeFor = (entry) => typeof scopeResolver === "function" ? scopeResolver(entry) : "";
    const leftPlacement = getBoqAddCategory({
      stationFormat: format,
      kind: "system",
      canonicalItemId: left.item.id,
      categoryCode: left.item.checklistMapping?.[0],
      scope: scopeFor(left.item),
    });
    const rightPlacement = getBoqAddCategory({
      stationFormat: format,
      kind: "system",
      canonicalItemId: right.item.id,
      categoryCode: right.item.checklistMapping?.[0],
      scope: scopeFor(right.item),
    });
    return (groupOrder.get(leftPlacement.groupCode) ?? Number.MAX_SAFE_INTEGER)
      - (groupOrder.get(rightPlacement.groupCode) ?? Number.MAX_SAFE_INTEGER)
      || (order.get(left.item.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(right.item.id) ?? Number.MAX_SAFE_INTEGER)
      || left.index - right.index;
  }).map(({ item }) => item);
}

function normalizedScope(value) {
  const scope = String(value || "").trim().toLowerCase();
  if (scope.includes("low speed") || scope === "low-speed") return "low";
  if (scope.includes("high speed") || scope === "high-speed") return "high";
  if (scope.includes("3d") || scope.includes("dimension")) return "3d";
  if (scope.includes("image processing")) return "image";
  return "";
}

function ownerForItem(item, snapshot) {
  const assets = Array.isArray(snapshot?.equipment) ? snapshot.equipment : [];
  const systems = Array.isArray(snapshot?.stationSystems) ? snapshot.stationSystems : [];
  const asset = assets.find((entry) => entry.id === item.assetId) || null;
  const parent = systems.find((entry) => entry.id === asset?.parentSystemId) || null;
  // Sensor/Loop do not own a WIM operational scope. Their parent WIM Sorting
  // System is the installed source of truth, so legacy/stale child values
  // cannot move a new checklist into a different BOQ presentation group.
  const wimChild = asset?.type === "WIM_SENSOR" || asset?.type === "WIM_LOOP";
  return { asset, scope: normalizedScope(wimChild ? parent?.scope || item?.scope : asset?.scope || parent?.scope || item?.scope) };
}

function groupCodeForItem(item, snapshot, legacy = false) {
  const format = String(snapshot?.stationFormat || "SC").toUpperCase() === "IMPS" ? "IMPS" : "SC";
  const { asset, scope } = ownerForItem(item, snapshot);
  const type = asset?.type || "";
  const sourceCode = String(item.sectionCode || "");
  if (THREED_TYPES.has(type) || scope === "3d" || sourceCode === "1.1.5") return format === "IMPS" ? (legacy ? "09" : "03") : "03";
  if (format === "IMPS") {
    if (scope === "image" || sourceCode === "1.1.12") return legacy ? "07" : "01";
    if (sourceCode.startsWith("2.")) return legacy ? "08" : "02";
    if (sourceCode.startsWith("3.")) return legacy ? "10" : "04";
    if (sourceCode.startsWith("4.")) return legacy ? "11" : "05";
    if (sourceCode.startsWith("5.") || sourceCode.startsWith("6.")) return legacy ? "12" : "06";
    return legacy ? "07" : "01";
  }
  if (VMS_TYPES.has(type) || sourceCode === "7.1") {
    if (scope === "low") return "05";
    if (scope === "high") return "02";
    return "VMS?"; // Never infer ownership from sign dimensions or item type.
  }
  if (sourceCode.startsWith("5.") || sourceCode.startsWith("6.")) return "06";
  if (scope === "low") return "04";
  if (sourceCode === "1.1.4") return "01";
  if (sourceCode === "1.1.8") return "04";
  if (sourceCode.startsWith("2.") || sourceCode.startsWith("3.") || sourceCode.startsWith("4.")) return "01";
  return "06";
}

const STATION_LEVEL_PRESENTATION_SECTIONS = new Set(["1.1"]);

function preserveStationLevelPresentationSection(sourceSection) {
  return {
    ...sourceSection,
    displayCode: sourceSection.code,
    sourceCode: sourceSection.code,
    boqGroupCode: sourceSection.code,
    boqGroupNumber: sourceSection.code,
    boqSourceRefs: [sourceSection.code],
    items: (sourceSection.items || []).map((item, index) => ({
      ...item,
      sourceSectionCode: item.sectionCode || sourceSection.code,
      sourceSectionTitle: sourceSection.title,
      checklistNumber: item.checklistNumber || `${sourceSection.code}.${index + 1}`,
    })),
  };
}

export function getBoqChecklistDisplaySections(snapshot, sourceSections) {
  const presentationVersion = snapshot?.checklistPresentationVersion;
  if (![LEGACY_BOQ_CHECKLIST_PRESENTATION_VERSION, BOQ_CHECKLIST_PRESENTATION_VERSION].includes(presentationVersion)) return sourceSections;
  const format = String(snapshot?.stationFormat || "SC").toUpperCase() === "IMPS" ? "IMPS" : "SC";
  const legacy = presentationVersion === LEGACY_BOQ_CHECKLIST_PRESENTATION_VERSION;
  const groups = (legacy ? LEGACY_BOQ_CHECKLIST_GROUPS : BOQ_CHECKLIST_GROUPS)[format];
  const byCode = new Map(groups.map((group) => [group.code, group]));
  if (format === "SC") byCode.set("VMS?", makeGroup("SC", "VMS?", "VMS - Assign High or Low Speed", ["5"], Number.MAX_SAFE_INTEGER));
  const buckets = new Map();
  const stationLevelSections = [];
  for (const sourceSection of sourceSections || []) {
    if (STATION_LEVEL_PRESENTATION_SECTIONS.has(sourceSection.code)) {
      if (sourceSection.items?.length) stationLevelSections.push(preserveStationLevelPresentationSection(sourceSection));
      continue;
    }
    for (const item of sourceSection.items || []) {
      const groupCode = groupCodeForItem(item, snapshot, legacy);
      const kind = item.assetId ? "Equipment" : "Systems & Software";
      const key = `${groupCode}.${kind === "Equipment" ? "01" : "02"}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push({ ...item, sourceSectionCode: item.sectionCode, sourceSectionTitle: sourceSection.title });
    }
  }
  const result = [];
  for (const group of [...groups, ...(byCode.has("VMS?") ? [byCode.get("VMS?")] : [])]) {
    for (const [minor, kind] of [["01", "Equipment"], ["02", "Systems & Software"]]) {
      const code = legacy ? `${group.code}.${minor}` : `${group.groupId}.${minor}`;
      const bucketKey = `${group.code}.${minor}`;
      const bucketItems = buckets.get(bucketKey) || [];
      if (!bucketItems.length) continue;
      result.push({ code, displayCode: `${group.code}.${minor}`, title: `${group.title} - ${kind}`, boqGroupCode: legacy ? group.code : group.groupId,
        boqGroupNumber: group.code, boqSourceRefs: group.sourceRefs,
        items: bucketItems.map((item, index) => ({ ...item, checklistNumber: `${code}.${String(index + 1).padStart(2, "0")}` })) });
    }
  }
  return [...stationLevelSections, ...result];
}
