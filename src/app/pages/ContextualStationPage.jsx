import { BOQ_CHECKLIST_GROUPS, resolveEquipmentPlacement as getBoqAddCategory, sortCanonicalSystemDefinitions } from "../../domain/boq-checklist-groups.js";
import { buildStationRelationshipTree, getRelationshipCategoryForAsset, getRelationshipCategoryForSystem, getRelationshipPath } from "../../domain/station-relationship-tree.js";
import { getStationWorkSpecGroupNote, getStationWorkSpecPurpose } from "../../domain/station-work-spec.js";
import { addStationAssetWithOwner } from "../../domain/station-asset-add.js";
import { getNextLaneNumberForScope, setLaneScope } from "../../domain/station-lane-scope.js";
import { WIM_ELECTRONICS_OUTPUT_VOLTAGES, isWimElectronicsSubEquipmentType } from "../../domain/wim-electronics.js";
import { getWorkSpecEquipmentOwnerVariants } from "../../domain/work-spec-equipment.js";
import { getEquipmentIconName, getScIconName } from "../icon-system.jsx";
import StationRelationshipInlineEditor from "../StationRelationshipInlineEditor.jsx";

const STEP_LABELS = ["ข้อมูลสถานี", "ระบบและอุปกรณ์", "ตรวจสอบและบันทึก"];
const WIM_ID = "wim-sorting";
const WIM_TYPES = new Set(["WIM_SENSOR", "WIM_LOOP"]);
const WIM_PRIMARY_SYSTEM_IDS = new Set([WIM_ID]);
const OUTPUTS = WIM_ELECTRONICS_OUTPUT_VOLTAGES;
const RELATIONSHIP_GROUP_NAME_TH = Object.freeze({
  "SC-01": "ระบบชั่งน้ำหนักขณะรถเคลื่อนที่ความเร็วสูง",
  "SC-02": "ระบบป้ายข้อความเปลี่ยนแปลงได้สำหรับความเร็วสูง",
  "SC-03": "ระบบวัดมิติรถบรรทุก 3 มิติ",
  "SC-04": "ระบบชั่งน้ำหนักขณะรถเคลื่อนที่ความเร็วต่ำ",
  "SC-05": "ระบบป้ายข้อความเปลี่ยนแปลงได้สำหรับความเร็วต่ำ",
  "SC-06": "ระบบส่วนกลาง",
  "IMPS-01": "ระบบประมวลผลภาพ",
  "IMPS-02": "ระบบชั่งน้ำหนักขณะรถเคลื่อนที่",
  "IMPS-03": "ระบบวัดมิติรถบรรทุก 3 มิติ",
  "IMPS-04": "ระบบอ่านป้ายทะเบียน",
  "IMPS-05": "ระบบกล้องโทรทัศน์วงจรปิด",
  "IMPS-06": "ระบบข้อมูลส่วนกลาง",
});

const READINESS_BLOCKER_COPY = Object.freeze({
  EMPTY_REGISTER: "ทะเบียนอุปกรณ์และระบบ",
  ASSET_NO_REQUIRED: "รหัส Asset No.",
  DUPLICATE_ASSET_NO: "รหัสอุปกรณ์ (Asset No.) ซ้ำ",
  WIM_SYSTEM_LANE_REQUIRED: "Lane ของ WIM Sorting System",
  WIM_SYSTEM_LANE_DUPLICATE: "WIM Sorting System ซ้ำใน Lane เดียวกัน",
  WIM_PARENT_SYSTEM_REQUIRED: "ระบบแม่ของ WIM Sensor/Loop",
  WIM_PARENT_SYSTEM_INVALID: "Lane ของระบบแม่ WIM",
  WIM_PARENT_LANE_MISMATCH: "Lane ของอุปกรณ์ WIM ไม่ตรงระบบแม่",
  WIM_ELECTRONICS_PARENT_CABINET_REQUIRED: "Cabinet แม่ของอุปกรณ์ WIM Electronics",
  WIM_ELECTRONICS_SYSTEM_REQUIRED: "WIM Electronics System ของ Cabinet/อุปกรณ์",
  WIM_SWITCHING_DC_OUTPUT_REQUIRED: "แรงดัน Output ของ Switching DC",
  CHECKLIST_MAPPING_REQUIRED: "Checklist mapping ของ System",
});

const STATION_VALIDATION_COPY = Object.freeze({
  stationCode: "รหัสสถานี",
  stationName: "ชื่อสถานี",
  province: "จังหวัด",
  direction: "ทิศทาง",
});

function referenceScopesForSystem(item, format) {
  const normalizedFormat = String(format || "SC").toUpperCase() === "IMPS" ? "IMPS" : "SC";
  const id = String(item?.id || "");
  const allowed = Array.isArray(item?.allowedScopes) ? item.allowedScopes : [];
  if (id.startsWith("dimension-")) return ["3D"];
  if (id === "image-processing-management") {
    return allowed.includes("Image Processing") ? ["Image Processing"] : (allowed.includes("ImPS") ? ["ImPS"] : []);
  }
  if (normalizedFormat === "IMPS") return ["ImPS", "3D"].filter((scope) => allowed.includes(scope));
  if (["data-management", "station-display"].includes(id)) return allowed.includes("Central") ? ["Central"] : [];
  return ["High Speed", "Low Speed", "3D"].filter((scope) => allowed.includes(scope));
}

function buildReferenceSystemCards(systemDefinitions, format) {
  return systemDefinitions.flatMap((item) => referenceScopesForSystem(item, format).map((scope) => ({
    id: `${item.id}-${scope}`,
    code: item.checklistMapping?.join(", ") || "—",
    title: item.nameEn || item.nameTh,
    systemIds: [item.id],
    scope,
    displayCode: `${item.checklistMapping?.join(", ") || "—"} · ${scope}`,
  })));
}

const preferredScopeForFormat = (item, format) => {
  if (String(item?.id || "").startsWith("dimension-")) return "3D";
  const scopes = Array.isArray(item?.allowedScopes) ? item.allowedScopes : [];
  const normalizedFormat = String(format || "SC").toUpperCase() === "IMPS" ? "IMPS" : "SC";
  if (String(item?.id || "") === "image-processing-management" && scopes.includes("Image Processing")) return "Image Processing";
  const isCentralSystem = ["data-management", "station-display"].includes(String(item?.id || ""));
  if (normalizedFormat === "SC" && isCentralSystem) return scopes.includes("Central") ? "Central" : scopes[0] || null;
  const preferred = normalizedFormat === "IMPS"
    ? ["ImPS", "Station-wide", "Central", "High Speed", "Low Speed"]
    : ["High Speed", "Low Speed", "Station-wide", "Central", "ImPS"];
  return preferred.find((scope) => scopes.includes(scope)) || scopes[0] || null;
};

const systemRecord = (item, createId, extra = {}) => ({
  id: createId("system"), canonicalItemId: item.id, systemId: item.id,
  componentId: item.id === WIM_ID ? "sorting" : "canonical",
  displayLabel: item.nameTh, nameEn: item.nameEn, sourceLabel: item.nameEn,
  sourceRefs: [...item.checklistMapping], checklistMapping: [...item.checklistMapping],
  quantity: 1, unit: item.defaultUnit, referenceUnit: item.defaultUnit,
  scope: extra.scope || preferredScopeForFormat(item, extra.stationFormat), active: true, recordKind: "system", ...extra,
});

function eligibleCatalog(catalog, canonical, selectedCategories, selectedSystemIds) {
  const types = new Set(canonical.filter((item) => {
    if (item.kind !== "asset") return false;
    if (Array.isArray(item.systemIds) && item.systemIds.length) return item.systemIds.some((systemId) => selectedSystemIds.has(systemId));
    if (!selectedCategories.has(item.category)) return false;
    if (item.category !== "WIM") return true;
    return selectedSystemIds.has(WIM_ID);
  }).map((item) => item.equipmentType));
  return catalog
    .filter((item) => item.active !== false && types.has(item.type))
    .map((item) => {
      const canonicalItem = canonical.find((entry) => entry.kind === "asset" && entry.equipmentType === item.type && entry.scopeVariants?.length);
      return canonicalItem ? { ...item, scopeVariants: canonicalItem.scopeVariants } : item;
    });
}

export function createContextualStationPage(runtime) {
    const { Breadcrumb, Button, CustomSelect, DEFAULT_STATION_FORMAT, Icon, ITEM_LIBRARY_CATEGORIES, MasterSelect, STATION_ASSET_CATEGORIES, STATION_FORMATS, StatusBadge, VehicleSearchConfigPanel, createId, createStationDraft, createStationProfileFromDraft, getCanonicalItemsForFormat, getCentralChecklistSectionName, getCentralEquipmentName, getCentralSystemCategoryName, getCentralSystemNameForRecord, getNextEquipmentIndex, synchronizeGeneratedAssetNos, getStationChecklistItems, getStationReadiness, makeEquipmentFromCatalogItem, makeLane, navigate, normalizeItemCatalog, setStationChecklistItemEnabled, formatCentralNameEnglishFirst, useEffect, useMemo, useState, validateStationDraft } = runtime;

  return function ContextualStationPage({ state, update, requestConfirm }) {
    const [draft, setDraft] = useState(() => createStationDraft(DEFAULT_STATION_FORMAT));
    const [step, setStep] = useState(1);
    const [showErrors, setShowErrors] = useState(false);
    const [showOther, setShowOther] = useState(false);
    const [showChecklist, setShowChecklist] = useState(false);
    const [openCategory, setOpenCategory] = useState("");
    const [openBoqCategory, setOpenBoqCategory] = useState("");
    const [expandedEquipmentGroups, setExpandedEquipmentGroups] = useState(["SC-01.01"]);
    const [expandedBoqCategories, setExpandedBoqCategories] = useState([]);
    const [expandedReferenceRows, setExpandedReferenceRows] = useState([]);
    const [activeReferenceGroupCode, setActiveReferenceGroupCode] = useState("SC-01.01");
    const [activeRelationshipGroupId, setActiveRelationshipGroupId] = useState(`${DEFAULT_STATION_FORMAT === "IMPS" ? "IMPS" : "SC"}-01`);
    const [selectedRelationshipId, setSelectedRelationshipId] = useState(null);
    const [selectedRelationshipKind, setSelectedRelationshipKind] = useState("asset");
    const [relationshipEdit, setRelationshipEdit] = useState(null);
    const [editingLaneId, setEditingLaneId] = useState(null);
    const [laneEditDraft, setLaneEditDraft] = useState(null);
    const [activeRelationshipCategoryKey, setActiveRelationshipCategoryKey] = useState("wim-sorting");
    const [systemSearch, setSystemSearch] = useState("");
    const [message, setMessage] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const setProvince = (event) => {
      const provinceId = event.target.value;
      const province = (state.referenceData?.provinces || []).find((entry) => entry.id === provinceId);
      setDraft((current) => ({ ...current, provinceId, province: province?.name || "" }));
    };
    const canonical = useMemo(() => getCanonicalItemsForFormat(draft.stationFormat), [draft.stationFormat]);
    const systemDefinitions = sortCanonicalSystemDefinitions(
      canonical.filter((item) => item.kind === "system"),
      draft.stationFormat,
      (item) => draft.stationSystems.find((system) => system.canonicalItemId === item.id)?.scope || preferredScopeForFormat(item, draft.stationFormat),
    );
    const referenceSystemCards = buildReferenceSystemCards(systemDefinitions, draft.stationFormat);
    const formatDefinition = STATION_FORMATS.find((format) => format.value === draft.stationFormat) || STATION_FORMATS[0];
    const wimDefinition = systemDefinitions.find((item) => item.id === WIM_ID);
    const wimCentralName = getCentralSystemNameForRecord(wimDefinition);
    const wimNameTh = wimCentralName?.nameTh || wimDefinition?.nameTh || "";
    const wimNameEn = wimCentralName?.nameEn || wimDefinition?.nameEn || "";
    const wimCategoryCode = wimCentralName?.categoryCode || wimDefinition?.checklistMapping?.[0] || "";
    const centralSystemDisplay = (record) => {
      const central = getCentralSystemNameForRecord(record);
      const thai = central?.nameTh || record?.displayLabel || record?.nameTh || "ระบบ";
      const english = central?.nameEn || record?.nameEn || "";
      return { thai, english, primary: english || thai, secondary: thai || english, display: formatCentralNameEnglishFirst(central) || [english, thai].filter(Boolean).join(" · ") };
    };
    const centralEquipmentDisplay = (item) => {
      const central = getCentralEquipmentName(item?.type) || getCentralEquipmentName(item?.id);
      const thai = central?.nameTh || item?.label || item?.nameTh || item?.type || "อุปกรณ์";
      const english = central?.nameEn || item?.nameEn || "";
      return { thai, english, primary: english || thai, secondary: thai || english };
    };
    const centralSystemCategoryDisplay = (record) => {
      const category = getCentralSystemCategoryName(record);
      const mappedCodes = Array.isArray(record?.checklistMapping) ? record.checklistMapping.filter(Boolean).map(String) : [];
      const installed = draft.stationSystems.find((system) => system.canonicalItemId === record?.id);
      const displayCategory = getBoqAddCategory({ stationFormat: draft.stationFormat, kind: "system", canonicalItemId: record?.id, categoryCode: mappedCodes[0], scope: installed?.scope || (record?.id?.startsWith("dimension-") ? "3D" : preferredScopeForFormat(record, draft.stationFormat)) });
      if (displayCategory.code) return { code: displayCategory.code, english: displayCategory.title, thai: "", display: `${displayCategory.title} · BOQ/TOR ${mappedCodes.join(", ") || "—"}` };
      if (mappedCodes.length > 1) {
        const mappedCategories = mappedCodes.map((code) => getCentralChecklistSectionName(code)).filter(Boolean);
        return {
          code: mappedCodes.join(", "),
          english: mappedCategories.map((entry) => entry.nameEn).filter(Boolean).join(" · "),
          thai: mappedCategories.map((entry) => entry.nameTh).filter(Boolean).join(" · "),
          display: mappedCategories.map((entry) => formatCentralNameEnglishFirst(entry)).filter(Boolean).join(" · "),
        };
      }
      return { code: category?.code || "", english: category?.nameEn || "", thai: category?.nameTh || "", display: formatCentralNameEnglishFirst(category) || category?.nameEn || category?.nameTh || "" };
    };
    const systemIconName = (record) => getScIconName(record?.id === WIM_ID || record?.canonicalItemId === WIM_ID ? WIM_ID : record?.checklistMapping?.[0]);
    const referenceGroupIconName = (group) => {
      const definition = (group?.cards || [])
        .map((card) => systemDefinitions.find((item) => card.systemIds?.includes(item.id)))
        .find(Boolean);
      return systemIconName(definition);
    };
    const catalog = useMemo(() => normalizeItemCatalog(state.itemCatalog, { includeWimElectronics: true }), [state.itemCatalog]);
    const selectedCategories = new Set(draft.stationSystems.filter((item) => item.active !== false).map((item) => systemDefinitions.find((definition) => definition.id === item.canonicalItemId)?.category).filter(Boolean));
    const selectedSystemIds = new Set(draft.stationSystems.filter((item) => item.active !== false).map((item) => item.canonicalItemId));
    const selectedSystemCardCount = referenceSystemCards.filter((card) => card.systemIds.some((systemId) => {
      const record = draft.stationSystems.find((system) => system.canonicalItemId === systemId && system.active !== false);
      return Boolean(record) && (!card.scope || record.scope === card.scope);
    })).length;
    const wimSelected = selectedSystemIds.has(WIM_ID);
    const wimInstances = draft.stationSystems.filter((item) => item.canonicalItemId === WIM_ID && item.active !== false);
    const wimScopeOptions = (wimDefinition?.allowedScopes || []).filter((scope) => draft.stationFormat === "IMPS" ? !["High Speed", "Low Speed"].includes(scope) : scope !== "ImPS");
    const selectedScopesForCatalogItem = (item) => {
      const canonicalItem = canonical.find((entry) => entry.kind === "asset" && entry.equipmentType === item?.type);
      const ownerIds = Array.isArray(canonicalItem?.systemIds) ? canonicalItem.systemIds : [];
      if (!ownerIds.length) return [];
      return [...new Set(draft.stationSystems
        .filter((system) => system.active !== false && ownerIds.includes(system.canonicalItemId))
        .map((system) => String(system.scope || "").trim())
        .filter(Boolean))];
    };
    const effectiveAssetScope = (asset) => WIM_TYPES.has(asset?.type)
      ? wimInstances.find((system) => system.id === asset.parentSystemId)?.scope || ""
      : asset?.scope || "";
    const scopedCatalog = eligibleCatalog(catalog, canonical, selectedCategories, selectedSystemIds);
    const expandCatalogItemVariants = (item, { respectSelectedScopes = true } = {}) => {
      const scopedVariants = item.type === "LPR_CAMERA"
        ? (draft.stationFormat === "IMPS" ? ["ImPS", "3D"] : ["High Speed", "Low Speed", "3D"])
        : ["LASER_SCANNER", "DIMENSION_CONTROLLER"].includes(item.type)
          ? ["3D"]
        : item.type === "FIXED_CAMERA"
          ? (draft.stationFormat === "IMPS" ? ["Image Processing", "ImPS"] : ["High Speed", "Low Speed"])
        : item.type === "IMAGE_PROCESSOR"
          ? ["Image Processing"]
        : item.type === "PTZ_CAMERA" && draft.stationFormat === "IMPS"
          ? ["ImPS"]
        : item.type === "LPR_CONTROL_SYSTEM"
            ? (draft.stationFormat === "IMPS" ? ["ImPS", "3D"] : ["High Speed", "Low Speed", "3D"])
          : draft.stationFormat === "SC" && ["PTZ_CAMERA", "NVR", "JOYSTICK"].includes(item.type)
            ? ["High Speed", "Low Speed"]
          : ["CONTROL_COMPUTER", "CONTROL_CABINET"].includes(item.type)
            || (item.type.startsWith("WIM_") && !WIM_TYPES.has(item.type))
            ? (draft.stationFormat === "IMPS" ? ["ImPS"] : ["High Speed", "Low Speed"])
          : null;
      const variants = scopedVariants || (Array.isArray(item.scopeVariants) && item.scopeVariants.length ? item.scopeVariants : [null]);
      const selectedScopes = selectedScopesForCatalogItem(item);
      const canonicalItem = canonical.find((entry) => entry.kind === "asset" && entry.equipmentType === item?.type);
      const ownerIds = Array.isArray(canonicalItem?.systemIds) ? canonicalItem.systemIds : [];
      const ownerSystems = draft.stationSystems.filter((system) => system.active !== false && ownerIds.includes(system.canonicalItemId));
      const activeCabinets = draft.equipment.filter((asset) => asset.active !== false && asset.type === "CONTROL_CABINET");
      return variants
        .filter((scope) => !respectSelectedScopes || !scope || !selectedScopes.length || selectedScopes.includes(scope))
        .flatMap((scope) => {
          if (WIM_TYPES.has(item.type)) return [scope ? { ...item, variantScope: scope } : item];
          if (isWimElectronicsSubEquipmentType(item.type)) {
            return activeCabinets
              .filter((cabinet) => !scope || !cabinet.scope || String(cabinet.scope).trim() === scope)
              .filter((cabinet) => ownerSystems.some((system) => system.id === cabinet.parentSystemId))
              .map((cabinet) => ({ ...item, variantScope: scope || cabinet.scope, parentId: cabinet.parentSystemId, parentAssetId: cabinet.id }));
          }
          if (ownerIds.length) {
            return getWorkSpecEquipmentOwnerVariants(item, scope, ownerIds, ownerSystems);
          }
          return [scope ? { ...item, variantScope: scope } : item];
        });
    };
    const groupedVariants = scopedCatalog.flatMap(expandCatalogItemVariants).flatMap((item) => WIM_TYPES.has(item.type)
      ? wimInstances.map((parent) => ({ ...item, variantScope: parent.scope, parentId: parent.id }))
      : [item]);
    const groups = BOQ_CHECKLIST_GROUPS[draft.stationFormat === "IMPS" ? "IMPS" : "SC"].map((group) => ({
      code: `${group.groupId}.01`, title: `${group.title} - Equipment`, groupId: group.groupId,
      items: groupedVariants.filter((item) => getBoqAddCategory({ stationFormat: draft.stationFormat, type: item.type, categoryCode: item.categoryCode, scope: item.variantScope }).groupId === group.groupId),
    })).filter((group) => group.items.length);
    const groupDefinitions = BOQ_CHECKLIST_GROUPS[draft.stationFormat === "IMPS" ? "IMPS" : "SC"].map((group) => ({
      ...group,
      code: `${group.groupId}.01`,
      title: `${group.title} - Equipment`,
      systems: systemDefinitions.filter((item) => getBoqAddCategory({
        stationFormat: draft.stationFormat,
        kind: "system",
        canonicalItemId: item.id,
        categoryCode: item.checklistMapping?.[0],
        scope: draft.stationSystems.find((system) => system.canonicalItemId === item.id)?.scope || preferredScopeForFormat(item, draft.stationFormat),
      }).groupId === group.groupId),
    }));
    const activeAssets = draft.equipment.filter((item) => item.active !== false);
    const validation = useMemo(() => validateStationDraft(draft, state.stationProfiles), [draft, state.stationProfiles]);
    const readiness = useMemo(() => getStationReadiness(draft), [draft]);
    const preview = useMemo(() => ({ ...draft, id: "station-draft-preview" }), [draft]);
    const checklistItems = useMemo(() => getStationChecklistItems(preview, { includeDisabled: true }), [preview]);
    const validationIssues = [
      ...Object.entries(STATION_VALIDATION_COPY)
        .filter(([field]) => validation.errors[field])
        .map(([field, label]) => ({ code: `STATION_${field.toUpperCase()}`, field, label, message: validation.errors[field] })),
      ...Object.entries(validation.errors.serialById || {}).map(([assetId, message]) => ({ code: "SERIAL_REQUIRED", assetId, label: "Serial Number", message })),
      ...(validation.errors.duplicateLaneIds?.length ? [{ code: "DUPLICATE_LANE_NO", laneIds: validation.errors.duplicateLaneIds, label: "หมายเลข Lane ซ้ำใน Scope", message: "หมายเลข Lane ซ้ำกันภายใน Scope เดียวกัน กรุณาตรวจสอบโครงสร้าง Lane" }] : []),
    ];
    const blockingIssues = [...readiness.blockers, ...validationIssues];
    const warningMessages = [...new Set([
      ...(readiness.warnings || []).map((warning) => warning?.message || warning),
      ...(validation.warnings || []).map((warning) => warning?.message || warning),
    ].filter(Boolean))];
    const issueCopy = (issue) => {
      const asset = issue.assetId ? activeAssets.find((entry) => entry.id === issue.assetId) : null;
      const system = issue.systemId ? draft.stationSystems.find((entry) => entry.id === issue.systemId) : null;
      const assetLabel = asset ? centralEquipmentDisplay({ id: asset.catalogItemId, type: asset.type, label: asset.catalogItemLabel, nameEn: asset.catalogItemLabelEn }).primary : "";
      const systemLabel = system ? centralSystemDisplay(system).primary : "";
      const subject = asset
        ? ` · ${assetLabel}${asset.assetNo ? ` · ${asset.assetNo}` : ""}`
        : system
          ? ` · ${systemLabel}`
          : issue.assetIds?.length
            ? ` · ${issue.assetIds.length} รายการ`
            : "";
      return {
        label: `${issue.label || READINESS_BLOCKER_COPY[issue.code] || "ข้อมูลประจำสถานี"}${subject}`,
        message: issue.message || "กรุณาตรวจสอบข้อมูลรายการนี้",
      };
    };
    const hasSystems = draft.stationSystems.length > 0;
    const activeGroupDefinition = groupDefinitions.find((group) => group.code === openCategory) || groupDefinitions[0] || null;
    const activeGroup = groups.find((group) => group.code === activeGroupDefinition?.code) || null;
    const activeGroupSystems = activeGroupDefinition?.systems || [];
    const activeBoqCategories = activeGroup ? [...activeGroup.items.reduce((result, item) => {
      const code = String(item.categoryCode || "—");
      if (!result.has(code)) {
        const category = getCentralChecklistSectionName(code);
        result.set(code, { code, title: category?.nameEn || category?.nameTh || code, items: [] });
      }
      result.get(code).items.push(item);
      return result;
    }, new Map()).values()] : [];
    const referenceCatalogTypes = new Set(canonical.filter((item) => item.kind === "asset" && item.equipmentType).map((item) => item.equipmentType));
    const referenceCatalog = catalog.filter((item) => item.active !== false && referenceCatalogTypes.has(item.type));
    const referenceGroupedVariants = referenceCatalog.flatMap((item) => expandCatalogItemVariants(item, { respectSelectedScopes: false })).flatMap((item) => {
      if (!WIM_TYPES.has(item.type)) return [item];
      if (wimInstances.length) return wimInstances.map((parent) => ({ ...item, variantScope: parent.scope, parentId: parent.id }));
      return wimScopeOptions.map((scope) => ({ ...item, variantScope: scope, parentId: null }));
    });
    const referenceGroupDefinitions = groupDefinitions.map((group) => ({ ...group, categoryCodes: null }));
    const referenceEquipmentGroups = referenceGroupDefinitions.map((group) => {
      const items = referenceGroupedVariants.filter((item) => {
        const placement = getBoqAddCategory({ stationFormat: draft.stationFormat, type: item.type, categoryCode: item.categoryCode, scope: item.variantScope });
        return placement.groupId === group.groupId && (!group.categoryCodes || group.categoryCodes.includes(String(item.categoryCode || "")));
      }).reduce((result, item) => {
        const key = WIM_TYPES.has(item.type)
          ? `${item.id}-${item.variantScope || "default"}`
          : `${item.id}-${item.variantScope || "default"}-${item.parentId || "no-system"}-${item.parentAssetId || "no-asset-parent"}`;
        if (!result.has(key)) result.set(key, item);
        return result;
      }, new Map());
      return { ...group, items: [...items.values()] };
    });
    const referenceGroupAssetCount = (group) => activeAssets.filter((asset) => {
      const placement = getBoqAddCategory({ stationFormat: draft.stationFormat, type: asset.type, categoryCode: asset.categoryCode, scope: effectiveAssetScope(asset) });
      return placement.groupId === group.groupId && (!group.categoryCodes || group.categoryCodes.includes(String(asset.categoryCode || "")));
    }).length;
    const isReferenceSystemCardSelected = (card) => card.systemIds.some((systemId) => draft.stationSystems.some((system) => (
      system.canonicalItemId === systemId
      && system.active !== false
      && (!card.scope || String(system.scope || "").trim() === String(card.scope).trim())
    )));
    const referenceGroupCards = BOQ_CHECKLIST_GROUPS[draft.stationFormat === "IMPS" ? "IMPS" : "SC"].map((group) => {
      const code = `${group.groupId}.01`;
      const cards = referenceSystemCards.filter((card) => {
        const item = systemDefinitions.find((definition) => card.systemIds.includes(definition.id));
        if (!item) return false;
        return getBoqAddCategory({
          stationFormat: draft.stationFormat,
          kind: "system",
          canonicalItemId: item.id,
          categoryCode: item.checklistMapping?.[0],
          scope: card.scope,
        }).groupId === group.groupId;
      });
      return {
        ...group,
        code,
        title: `${group.title} - Equipment`,
        cards,
        selected: cards.some(isReferenceSystemCardSelected),
      };
    });
    const activeReferenceGroupCodeResolved = `${activeRelationshipGroupId}.01`;
    const activeReferenceGroupCard = referenceGroupCards.find((group) => group.code === activeReferenceGroupCodeResolved) || referenceGroupCards[0] || null;
    const selectedReferenceGroupCount = referenceGroupCards.filter((group) => group.selected).length;
    const categoryCodesForReferenceGroup = (groupCode) => {
      const group = referenceEquipmentGroups.find((entry) => entry.code === groupCode);
      return [...new Set((group?.items || []).map((item) => String(item.categoryCode || "—")))];
    };
    const activateReferenceGroup = (groupCode) => {
      setActiveReferenceGroupCode(groupCode);
      setExpandedBoqCategories(categoryCodesForReferenceGroup(groupCode));
    };
    useEffect(() => {
      setExpandedBoqCategories(categoryCodesForReferenceGroup(activeReferenceGroupCodeResolved));
    }, [activeReferenceGroupCodeResolved, draft.stationFormat, selectedReferenceGroupCount]);

    const setField = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
    const changeFormat = async (format) => {
      if (format === draft.stationFormat) return;
      const hasDraftEquipment = draft.stationSystems.length > 0 || draft.lanes.length > 0 || draft.equipment.length > 0;
      if (hasDraftEquipment && requestConfirm) {
        const confirmed = await requestConfirm({
          title: `เปลี่ยนรูปแบบสถานีเป็น ${format}`,
          description: "ระบบจะเริ่มรายการระบบ Lane และ Asset ในร่างใหม่ ข้อมูลสถานีที่กรอกไว้จะยังคงอยู่",
          confirmLabel: "เริ่มรายการใหม่",
        });
        if (!confirmed) return;
      }
      setDraft((current) => ({ ...createStationDraft(format), stationCode: current.stationCode, stationName: current.stationName, province: current.province, provinceId: current.provinceId, direction: current.direction, vehicleSearchConfig: current.vehicleSearchConfig }));
      setOpenCategory("");
      setOpenBoqCategory("");
      setExpandedEquipmentGroups([format === "IMPS" ? "IMPS-01.01" : "SC-01.01"]);
      setActiveRelationshipGroupId(`${format === "IMPS" ? "IMPS" : "SC"}-01`);
      setSystemSearch("");
      setSelectedRelationshipId(null);
      setEditingLaneId(null);
      setExpandedBoqCategories([]);
      setExpandedReferenceRows([]);
      setActiveReferenceGroupCode(format === "IMPS" ? "IMPS-01.01" : "SC-01.01");
      setMessage("เปลี่ยนรูปแบบสถานีแล้ว ระบบและอุปกรณ์ในร่างถูกเริ่มใหม่");
    };
    const toggleReferenceGroup = async (group) => {
      if (!group) return;
      const groupAssetCount = referenceGroupAssetCount(group);
      if (group.selected && groupAssetCount > 0 && requestConfirm) {
        const confirmed = await requestConfirm({
          title: `นำ ${group.title} ออกจากร่างสถานีหรือไม่`,
          description: `ระบบจะนำชุดระบบและ Asset ที่อยู่ในกลุ่มนี้ออกจากร่างสถานี ${groupAssetCount} รายการ แต่จะไม่กระทบข้อมูลสถานีหรือประวัติเดิม`,
          confirmLabel: "นำออกจากร่าง",
          confirmVariant: "danger-ghost",
          confirmIcon: "delete",
        });
        if (!confirmed) return;
      }

      activateReferenceGroup(group.code);
      setExpandedEquipmentGroups((current) => current.includes(group.code) ? current : [...current, group.code]);
      setMessage("");
      setDraft((current) => {
        const cards = group.cards || [];
        if (!group.selected) {
          const stationSystems = [...current.stationSystems];
          const lanes = [...current.lanes];
          cards.forEach((card) => {
            const item = systemDefinitions.find((definition) => card.systemIds.includes(definition.id));
            if (!item) return;
            const scope = String(card.scope || preferredScopeForFormat(item, current.stationFormat) || "").trim();
            const exists = stationSystems.some((system) => system.active !== false
              && system.canonicalItemId === item.id
              && String(system.scope || "").trim() === scope);
            if (exists) return;
            if (item.id === WIM_ID) {
              const nextLaneNo = getNextLaneNumberForScope(lanes, scope, stationSystems);
              const lane = makeLane(nextLaneNo, { id: createId("lane"), scope });
              lanes.push(lane);
              stationSystems.push(systemRecord(item, createId, { laneId: lane.id, instanceNo: nextLaneNo, scope }));
              return;
            }
            stationSystems.push(systemRecord(item, createId, { scope }));
          });
          return { ...current, stationSystems, lanes };
        }

        let nextState = {
          ...current,
          stationSystems: [...current.stationSystems],
          lanes: [...current.lanes],
          equipment: [...current.equipment],
        };
        cards.forEach((card) => {
          const item = systemDefinitions.find((definition) => card.systemIds.includes(definition.id));
          if (!item) return;
          const hasExplicitScope = Boolean(String(card.scope || "").trim());
          const scope = String(card.scope || preferredScopeForFormat(item, current.stationFormat) || "").trim();
          const matchingSystems = nextState.stationSystems.filter((system) => system.active !== false
            && system.canonicalItemId === item.id
            && (!hasExplicitScope || String(system.scope || "").trim() === scope));
          if (!matchingSystems.length) return;
          const removedIds = new Set(matchingSystems.map((system) => system.id));
          const stationSystems = nextState.stationSystems.filter((system) => !removedIds.has(system.id));
          let equipment = nextState.equipment;
          if (item.id === WIM_ID) {
            equipment = equipment.filter((asset) => !WIM_TYPES.has(asset.type) || !removedIds.has(asset.parentSystemId));
          } else {
            const ownedTypes = new Set(canonical
              .filter((definition) => definition.kind === "asset" && definition.equipmentType && definition.systemIds?.includes(item.id))
              .map((definition) => definition.equipmentType));
            const activeSystems = stationSystems.filter((system) => system.active !== false);
            equipment = equipment.filter((asset) => {
              if (!ownedTypes.has(asset.type) || WIM_TYPES.has(asset.type)) return true;
              const definition = canonical.find((entry) => entry.kind === "asset" && entry.equipmentType === asset.type);
              const assetScope = String(asset.scope || "").trim();
              const hasRemainingOwner = (definition?.systemIds || []).some((ownerId) => activeSystems.some((system) => (
                system.canonicalItemId === ownerId
                && (!assetScope || String(system.scope || "").trim() === assetScope)
              )));
              if (hasRemainingOwner) return true;
              return hasExplicitScope ? assetScope !== scope : false;
            });
          }
          const referencedLaneIds = new Set([
            ...stationSystems.map((system) => system.laneId).filter(Boolean),
            ...equipment.map((asset) => asset.laneId).filter(Boolean),
          ]);
          const lanes = nextState.lanes.filter((lane) => !matchingSystems.some((system) => system.laneId === lane.id) || referencedLaneIds.has(lane.id));
          nextState = { ...nextState, stationSystems, equipment, lanes };
        });
        return nextState;
      });
    };
    const addWimLane = (scopeOverride = "") => {
      const definition = systemDefinitions.find((item) => item.id === WIM_ID);
      if (!definition) return;
      setMessage("");
      setDraft((current) => {
        const scope = String(scopeOverride || preferredScopeForFormat(definition, current.stationFormat) || "").trim();
        const nextNo = getNextLaneNumberForScope(current.lanes, scope, current.stationSystems);
        const lane = makeLane(nextNo, { id: createId("lane"), scope });
        return {
          ...current,
          lanes: [...current.lanes, lane],
          stationSystems: [...current.stationSystems, systemRecord(definition, createId, { laneId: lane.id, instanceNo: nextNo, scope })],
        };
      });
    };
    const removeWimScope = (scope) => {
      const targetScope = String(scope || "").trim();
      if (!targetScope) return;
      setMessage("");
      setDraft((current) => {
        const removedSystems = current.stationSystems.filter((system) => system.active !== false
          && system.canonicalItemId === WIM_ID
          && String(system.scope || "").trim() === targetScope);
        if (!removedSystems.length) return current;
        const removedIds = new Set(removedSystems.map((system) => system.id));
        const removedLaneIds = new Set(removedSystems.map((system) => system.laneId).filter(Boolean));
        const stationSystems = current.stationSystems.filter((system) => !removedIds.has(system.id));
        const equipment = current.equipment.filter((asset) => !WIM_TYPES.has(asset.type) || !removedIds.has(asset.parentSystemId));
        const referencedLaneIds = new Set([
          ...stationSystems.map((system) => system.laneId).filter(Boolean),
          ...equipment.map((asset) => asset.laneId).filter(Boolean),
        ]);
        const lanes = current.lanes.filter((lane) => !removedLaneIds.has(lane.id) || referencedLaneIds.has(lane.id));
        return { ...current, stationSystems, equipment, lanes };
      });
    };
    const toggleSystem = (item, scopeOverride = "") => {
      setMessage("");
      setDraft((current) => {
        const hasExplicitScope = Boolean(String(scopeOverride || "").trim());
        const scope = String(scopeOverride || preferredScopeForFormat(item, current.stationFormat) || "").trim();
        const matchingSystems = current.stationSystems.filter((system) => system.active !== false
          && system.canonicalItemId === item.id
          && (!hasExplicitScope || String(system.scope || "").trim() === scope));
        if (!matchingSystems.length) {
          return { ...current, stationSystems: [...current.stationSystems, systemRecord(item, createId, { scope })] };
        }

        const removedIds = new Set(matchingSystems.map((system) => system.id));
        const stationSystems = current.stationSystems.filter((system) => !removedIds.has(system.id));
        const activeSystems = stationSystems.filter((system) => system.active !== false);
        const ownedTypes = new Set(canonical
          .filter((definition) => definition.kind === "asset" && definition.equipmentType && definition.systemIds?.includes(item.id))
          .map((definition) => definition.equipmentType));
        const equipment = current.equipment.filter((asset) => {
          if (!ownedTypes.has(asset.type) || WIM_TYPES.has(asset.type)) return true;
          const definition = canonical.find((entry) => entry.kind === "asset" && entry.equipmentType === asset.type);
          const assetScope = String(asset.scope || "").trim();
          const hasRemainingOwner = (definition?.systemIds || []).some((ownerId) => activeSystems.some((system) => (
            system.canonicalItemId === ownerId
            && (!assetScope || String(system.scope || "").trim() === assetScope)
          )));
          if (hasRemainingOwner) return true;
          return hasExplicitScope ? assetScope !== scope : false;
        });
        return { ...current, stationSystems, equipment };
      });
    };
    const addSystemInstanceForScope = (item, scopeOverride = "") => {
      const scope = String(scopeOverride || preferredScopeForFormat(item, draft.stationFormat) || "").trim();
      setDraft((current) => ({
        ...current,
        stationSystems: [...current.stationSystems, systemRecord(item, createId, { scope })],
      }));
    };
    const updateWimScope = (systemId, scope) => setDraft((current) => {
      const parent = current.stationSystems.find((system) => system.id === systemId);
      if (!parent) return current;
      const lanes = setLaneScope(current.lanes, parent.laneId, scope, current.stationSystems);
      const lane = lanes.find((entry) => entry.id === parent.laneId);
      const stationSystems = current.stationSystems.map((system) => system.id === systemId
        ? { ...system, scope, ...(lane ? { instanceNo: lane.laneNo } : {}) }
        : system);
      const equipment = synchronizeGeneratedAssetNos(current.equipment.map((asset) => asset.parentSystemId === systemId ? { ...asset, scope } : asset), stationSystems);
      return {
        ...current,
        lanes,
        stationSystems,
        equipment,
      };
    });
    const removeWimLane = (laneId) => {
      setDraft((current) => {
        const parents = new Set(current.stationSystems.filter((system) => system.canonicalItemId === WIM_ID && system.laneId === laneId).map((system) => system.id));
        return {
          ...current,
          lanes: current.lanes.filter((lane) => lane.id !== laneId),
          stationSystems: current.stationSystems.filter((system) => !parents.has(system.id)),
          equipment: current.equipment.filter((asset) => asset.laneId !== laneId && !parents.has(asset.parentSystemId)),
        };
      });
    };
    const addLane = (scopeOverride = "") => {
      setMessage("");
      setDraft((current) => {
        const scope = String(scopeOverride || (current.stationFormat === "IMPS" ? "ImPS" : "High Speed")).trim();
        const nextNo = getNextLaneNumberForScope(current.lanes, scope, current.stationSystems);
        return { ...current, lanes: [...current.lanes, makeLane(nextNo, { id: createId("lane"), scope })] };
      });
    };
    const addWimParentToLane = (laneId, scopeOverride = "") => {
      const definition = systemDefinitions.find((item) => item.id === WIM_ID);
      if (!definition) return;
      setMessage("");
      setDraft((current) => {
        const lane = current.lanes.find((entry) => entry.id === laneId);
        if (!lane || current.stationSystems.some((system) => system.active !== false && system.canonicalItemId === WIM_ID && system.laneId === laneId)) return current;
        const scope = String(scopeOverride || preferredScopeForFormat(definition, current.stationFormat) || "").trim();
        const lanes = setLaneScope(current.lanes, laneId, scope, current.stationSystems);
        const scopedLane = lanes.find((entry) => entry.id === laneId);
        const instanceNo = Number(scopedLane?.laneNo || lane.laneNo) || Math.max(0, ...current.stationSystems.filter((system) => system.canonicalItemId === WIM_ID).map((system) => Number(system.instanceNo) || 0)) + 1;
        return { ...current, lanes, stationSystems: [...current.stationSystems, systemRecord(definition, createId, { laneId, instanceNo, scope })] };
      });
    };
    const moveWimParent = (systemId, targetLaneId) => {
      setMessage("");
      setDraft((current) => {
        const targetLane = current.lanes.find((lane) => lane.id === targetLaneId);
        const parent = current.stationSystems.find((system) => system.id === systemId && system.canonicalItemId === WIM_ID);
        if (!targetLane || !parent || current.stationSystems.some((system) => system.id !== systemId && system.active !== false && system.canonicalItemId === WIM_ID && system.laneId === targetLaneId)) return current;
        const lanes = setLaneScope(current.lanes, targetLaneId, parent.scope, current.stationSystems);
        const resolvedLane = lanes.find((lane) => lane.id === targetLaneId);
        return {
          ...current,
          lanes,
          stationSystems: current.stationSystems.map((system) => system.id === systemId ? { ...system, laneId: targetLaneId, ...(resolvedLane ? { instanceNo: resolvedLane.laneNo } : {}) } : system),
          equipment: current.equipment.map((asset) => asset.parentSystemId === systemId ? { ...asset, laneId: targetLaneId } : asset),
        };
      });
    };
    const removeWimParent = async (systemId) => {
      const parent = draft.stationSystems.find((system) => system.id === systemId && system.canonicalItemId === WIM_ID);
      if (!parent) return false;
      const childCount = draft.equipment.filter((asset) => asset.parentSystemId === systemId).length;
      if (childCount > 0 && requestConfirm) {
        const confirmed = await requestConfirm({
          title: "นำ WIM Sorting System ออกจาก Lane หรือไม่",
          description: `อุปกรณ์ Sensor/Loop ใต้ระบบแม่ ${childCount} รายการจะถูกนำออกจากร่างสถานีด้วย`,
          confirmLabel: "นำระบบแม่ออก",
          confirmVariant: "danger-ghost",
          confirmIcon: "delete",
        });
        if (!confirmed) return false;
      }
      setDraft((current) => ({
        ...current,
        stationSystems: current.stationSystems.filter((system) => system.id !== systemId),
        equipment: current.equipment.filter((asset) => asset.parentSystemId !== systemId),
      }));
      return true;
    };
    const assignWimParent = (assetId, parentId) => setDraft((current) => {
      const parent = current.stationSystems.find((system) => system.id === parentId && system.canonicalItemId === WIM_ID && system.active !== false);
      const equipment = current.equipment.map((asset) => asset.id === assetId ? { ...asset, parentSystemId: parent?.id || null, laneId: parent?.laneId || null, scope: parent?.scope || asset.scope } : asset);
      return {
        ...current,
        equipment: synchronizeGeneratedAssetNos(equipment, current.stationSystems),
      };
    });
    const addWimAssetForParent = (type, parent) => {
      if (!parent) return;
      const item = catalog.find((entry) => entry.type === type && entry.active !== false);
      if (!item) {
        setMessage(`ยังไม่พบรายการ ${type} ใน Catalog`);
        return;
      }
      const count = activeAssets.filter((asset) => asset.catalogItemId === item.id && asset.parentSystemId === parent.id).length;
      changeAssetQuantity(item, count + 1, parent);
    };
    const renderWimSystemCard = () => {
      const category = centralSystemCategoryDisplay(wimDefinition);
      return <div className="ops-wim-system-block" key={WIM_ID}>
        <div className="ops-config-item" key={WIM_ID}>
          <div><strong>{wimNameEn || wimNameTh}</strong><span>{wimNameTh} · Category {category.code || wimCategoryCode || "—"} · {category.display || "Uncategorized"} · {!wimInstances.length ? "ยังไม่ใช้" : activeAssets.some((asset) => WIM_TYPES.has(asset.type)) ? `พร้อม · ${wimInstances.length} Lane` : `รอระบุอุปกรณ์ · ${wimInstances.length} Lane`}</span></div>
          <button type="button" className={`ops-config-toggle ${wimInstances.length ? "is-enabled" : "is-disabled"}`} aria-pressed={Boolean(wimInstances.length)} onClick={() => {
            if (wimInstances.length) {
              setDraft((current) => ({ ...current, stationSystems: current.stationSystems.filter((system) => system.canonicalItemId !== WIM_ID), lanes: [], equipment: current.equipment.filter((asset) => !WIM_TYPES.has(asset.type)) }));
            } else addWimLane();
          }}>{wimInstances.length ? "เลือกแล้ว" : "เลือกระบบ"}</button>
        </div>
        {wimSelected && <details className="ops-wim-inline" open><summary>ตั้งค่า WIM และ Lane ที่ติดตั้งจริง</summary><section className="ops-panel ops-wizard-card"><div className="ops-panel-heading"><div><h3>WIM และ Lane</h3><span className="ops-heading-note">หนึ่ง Lane มี {wimNameEn} ได้หนึ่งระบบ</span></div></div><div className="ops-lane-list">{draft.lanes.map((lane) => { const system = wimInstances.find((entry) => entry.laneId === lane.id); return <article className="ops-lane-card" key={lane.id}><div className="ops-lane-card-heading"><strong>Lane {lane.laneNo} · {lane.scope || system?.scope || "ไม่ระบุ Scope"}</strong><Button onClick={() => removeWimLane(lane.id)} variant="danger-ghost">นำออก</Button></div><div className="ops-lane-card-fields"><label className="ops-field"><span>ชื่อ Lane</span><input value={lane.label} onChange={(event) => setDraft((current) => ({ ...current, lanes: current.lanes.map((entry) => entry.id === lane.id ? { ...entry, label: event.target.value } : entry) }))} /></label><label className="ops-field"><span>ทิศทาง</span><input value={lane.direction || ""} onChange={(event) => setDraft((current) => ({ ...current, lanes: current.lanes.map((entry) => entry.id === lane.id ? { ...entry, direction: event.target.value } : entry) }))} /></label>{system && <label className="ops-field"><span>ขอบเขต WIM</span><CustomSelect label={`ขอบเขต WIM ของ Lane ${lane.laneNo}`} value={system.scope || preferredScopeForFormat(wimDefinition, draft.stationFormat) || ""} onChange={(event) => updateWimScope(system.id, event.target.value)}>{wimScopeOptions.map((scope) => <option key={scope} value={scope}>{scope}</option>)}</CustomSelect><small>Sensor/Loop ใน Lane นี้จะใช้ขอบเขตจาก WIM Sorting System</small></label>}</div><small>{wimNameEn} #{system?.instanceNo || "?"}</small></article>; })}</div><Button onClick={addWimLane} variant="secondary" icon="plus">เพิ่ม WIM Lane</Button></section></details>}
      </div>;
    };
    const renderSystemCard = (item) => {
      if (item.id === WIM_ID) return renderWimSystemCard();
      const selected = selectedSystemIds.has(item.id);
      const types = new Set(eligibleCatalog(catalog, canonical, new Set([item.category]), new Set([item.id])).map((entry) => entry.type));
      const assetCount = activeAssets.filter((asset) => types.has(asset.type)).length;
      const status = !selected ? "ยังไม่ใช้" : !types.size || assetCount ? "พร้อม" : "รอระบุอุปกรณ์";
      const name = centralSystemDisplay(item);
      const category = centralSystemCategoryDisplay(item);
      const scopeOptions = item.allowedScopes.filter((scope) => draft.stationFormat === "IMPS" ? !["High Speed", "Low Speed"].includes(scope) : scope !== "ImPS");
      return <div className="ops-config-item" key={item.id}>
        <div><strong>{name.primary}</strong><span>{name.secondary} · Category {category.code || "—"} · {category.display || "Uncategorized"} · {status}</span></div>
        <button type="button" className={`ops-config-toggle ${selected ? "is-enabled" : "is-disabled"}`} aria-pressed={selected} onClick={() => toggleSystem(item)}>{selected ? "เลือกแล้ว" : "เลือกระบบ"}</button>
        {selected && !item.id.startsWith("dimension-") && scopeOptions.length > 1 && <CustomSelect label={`ชุดระบบของ ${name.primary}`} value={draft.stationSystems.find((system) => system.canonicalItemId === item.id)?.scope || ""} onChange={(event) => setDraft((current) => {
          const stationSystems = current.stationSystems.map((system) => system.canonicalItemId === item.id ? { ...system, scope: event.target.value } : system);
          const parentIds = new Set(stationSystems.filter((system) => system.canonicalItemId === item.id).map((system) => system.id));
          const equipment = synchronizeGeneratedAssetNos(current.equipment.map((asset) => parentIds.has(asset.parentSystemId) ? { ...asset, scope: event.target.value } : asset), stationSystems);
          return { ...current, stationSystems, equipment };
        })} disabled={assetCount > 0}>{scopeOptions.map((scope) => <option key={scope} value={scope}>{getBoqAddCategory({ stationFormat: draft.stationFormat, kind: "system", canonicalItemId: item.id, categoryCode: item.checklistMapping?.[0], scope }).title}</option>)}</CustomSelect>}
      </div>;
    };
    const addAssetWithSystemOwner = (item, scope, ownerDefinition, parentSystemId = null, parentAssetId = null) => setDraft((current) => addStationAssetWithOwner(current, {
      catalogItem: item,
      scope,
      ownerDefinition,
      parentSystemId: parentSystemId || item.parentId || null,
      parentAssetId: parentAssetId || item.parentAssetId || null,
    }, {
      createId,
      createSystemRecord: systemRecord,
      makeEquipmentFromCatalogItem,
      getNextEquipmentIndex,
    }));
    const changeAssetQuantity = (item, desiredValue, parent = null) => {
      const desired = Math.max(0, Math.min(99, Number(desiredValue) || 0));
      setDraft((current) => {
        const parentSystemId = parent?.id || item.parentId || null;
        const parentAssetId = parent?.parentAssetId || item.parentAssetId || null;
        const matches = (asset) => asset.catalogItemId === item.id
          && (!item.variantScope || effectiveAssetScope(asset) === item.variantScope)
          && (!parentSystemId || asset.parentSystemId === parentSystemId)
          && (!parentAssetId || asset.parentAssetId === parentAssetId);
        const existing = current.equipment.filter(matches);
        const next = current.equipment.filter((asset) => !matches(asset));
        for (let index = 0; index < desired; index += 1) {
          if (existing[index]) { next.push(existing[index]); continue; }
          const canonicalDefinition = canonical.find((entry) => entry.kind === "asset" && entry.equipmentType === item.type);
          const scope = parent?.scope || item.variantScope || preferredScopeForFormat(canonicalDefinition, current.stationFormat);
          const asset = makeEquipmentFromCatalogItem(item, getNextEquipmentIndex([...next, ...existing], { type: item.type, prefix: item.prefix, scope }), { id: createId("asset"), location: "", parentSystemId, parentAssetId, laneId: parent?.laneId || null, scope, assetNoMode: "generated" });
          if (asset) next.push(asset);
        }
        return { ...current, equipment: next };
      });
    };
    const changeAggregateAssetQuantity = (item, desiredValue) => {
      const desired = Math.max(0, Math.min(99, Number(desiredValue) || 0));
      if (!item.parentId && !WIM_TYPES.has(item.type)) { changeAssetQuantity(item, desired); return; }
      let parent = wimInstances.find((entry) => entry.id === item.parentId)
        || draft.stationSystems.find((entry) => entry.id === item.parentId)
        || null;
      if (item.parentAssetId && parent) parent = { ...parent, parentAssetId: item.parentAssetId };
      if (parent) { changeAssetQuantity(item, desired, parent); return; }
      setDraft((current) => {
        const matches = (asset) => asset.catalogItemId === item.id
          && (!item.variantScope || effectiveAssetScope(asset) === item.variantScope)
          && wimInstances.some((parent) => parent.id === asset.parentSystemId);
        const existing = current.equipment.filter(matches);
        const next = current.equipment.filter((asset) => !matches(asset));
        next.push(...existing.slice(0, desired));
        const parent = wimInstances.find((entry) => !item.variantScope || entry.scope === item.variantScope) || wimInstances[0] || null;
        for (let index = next.length - current.equipment.filter((asset) => !matches(asset)).length; index < desired; index += 1) {
          const canonicalDefinition = canonical.find((entry) => entry.kind === "asset" && entry.equipmentType === item.type);
          const scope = parent?.scope || item.variantScope || preferredScopeForFormat(canonicalDefinition, current.stationFormat);
          const asset = makeEquipmentFromCatalogItem(item, getNextEquipmentIndex([...next, ...existing], { type: item.type, prefix: item.prefix, scope }), { id: createId("asset"), location: "", parentSystemId: parent?.id || null, laneId: parent?.laneId || null, scope, assetNoMode: "generated" });
          if (asset) next.push(asset);
        }
        return { ...current, equipment: next };
      });
    };
    const toggleReferenceSystemCard = (card) => {
      const item = systemDefinitions.find((definition) => card.systemIds.includes(definition.id));
      if (!item) return;
      const scope = String(card.scope || preferredScopeForFormat(item, draft.stationFormat) || "").trim();
      const existing = draft.stationSystems.some((system) => system.canonicalItemId === item.id
        && system.active !== false
        && (!scope || String(system.scope || "").trim() === scope));
      if (item.id === WIM_ID) {
        if (existing) removeWimScope(scope);
        else addWimLane(scope);
        return;
      }
      toggleSystem(item, card.scope || "");
    };
    const updateAsset = (id, field, value) => setDraft((current) => {
      const equipment = current.equipment.map((asset) => asset.id === id ? { ...asset, [field]: value, ...(field === "assetNo" ? { assetNoMode: "manual" } : {}) } : asset);
      return { ...current, equipment: synchronizeGeneratedAssetNos(equipment, current.stationSystems) };
    });
    const removeReferenceAsset = async (asset) => {
      if (!asset) return;
      const hasEnteredData = Boolean(String(asset.assetNo || "").trim() || String(asset.serialNo || "").trim() || String(asset.location || "").trim() || (asset.outputVoltages || []).length);
      if (hasEnteredData && requestConfirm) {
        const confirmed = await requestConfirm({
          title: `นำ Asset ${asset.assetNo || "รายการนี้"} ออกจากร่างหรือไม่`,
          description: "ข้อมูล Asset นี้จะถูกนำออกจากร่างสถานี แต่ไม่กระทบข้อมูลสถานีหรือประวัติเดิม",
          confirmLabel: "นำ Asset ออก",
          confirmVariant: "danger-ghost",
          confirmIcon: "delete",
        });
        if (!confirmed) return;
      }
      setDraft((current) => ({ ...current, equipment: current.equipment.filter((entry) => entry.id !== asset.id) }));
    };
    const assetError = (asset) => showErrors ? validation.errors.assetNoById[asset.id] || validation.errors.serialById[asset.id] || validation.errors.wimParentById[asset.id] || validation.errors.laneById[asset.id] : "";
    const showAsset = (asset) => { const name = centralEquipmentDisplay({ id: asset.catalogItemId, type: asset.type, label: asset.catalogItemLabel, nameEn: asset.catalogItemLabelEn }); const parent = wimInstances.find((item) => item.id === asset.parentSystemId); const scope = effectiveAssetScope(asset); const scopeLabel = scope ? ` · ${scope}` : ""; return <div className="ops-equipment-row" key={asset.id} id={`draft-asset-${asset.id}`}><div className="ops-equipment-title"><strong>{name.primary}</strong><small>{name.secondary}{scopeLabel} · {asset.parentSystemId ? `${centralSystemDisplay(parent).english} #${parent?.instanceNo || "?"}` : `${getBoqAddCategory({ stationFormat: draft.stationFormat, type: asset.type, categoryCode: asset.categoryCode, scope }).code || "Assign system group"} · BOQ/TOR ${asset.categoryCode || "—"}`}</small></div><div className="ops-equipment-fields"><label className="ops-field"><span>Asset No. <em>(จำเป็น)</em></span><input value={asset.assetNo || ""} onChange={(event) => updateAsset(asset.id, "assetNo", event.target.value)} aria-invalid={Boolean(assetError(asset))} />{assetError(asset) && <small className="ops-field-error" role="alert">{assetError(asset)}</small>}</label><label className="ops-field"><span>ตำแหน่งติดตั้ง (ภายหลังได้)</span><input value={asset.location || ""} onChange={(event) => updateAsset(asset.id, "location", event.target.value)} /></label><label className="ops-field"><span>Serial Number (ภายหลังได้)</span><input value={asset.serialNo || ""} onChange={(event) => { updateAsset(asset.id, "serialNo", event.target.value); }} onBlur={() => { if (asset.serialNo) updateAsset(asset.id, "serialStatus", "present"); }} /></label>{asset.type === "WIM_SWITCHING_DC" && <fieldset className="ops-serial-fieldset"><legend>Output ของ Switching DC</legend>{OUTPUTS.map((voltage) => <label key={voltage}><input type="checkbox" checked={(asset.outputVoltages || []).includes(voltage)} onChange={() => updateAsset(asset.id, "outputVoltages", (asset.outputVoltages || []).includes(voltage) ? asset.outputVoltages.filter((value) => value !== voltage) : [...(asset.outputVoltages || []), voltage])} />{voltage}VDC</label>)}</fieldset>}</div></div>; };
    const renderEquipmentItem = (item) => {
      if (item.parentId) {
        const parent = wimInstances.find((entry) => entry.id === item.parentId)
          || draft.stationSystems.find((entry) => entry.id === item.parentId);
        const parentCabinet = item.parentAssetId ? draft.equipment.find((asset) => asset.id === item.parentAssetId) : null;
        if (!parent) return null;
        const scopedAssets = activeAssets.filter((asset) => asset.catalogItemId === item.id
          && asset.parentSystemId === parent.id
          && (!item.parentAssetId || asset.parentAssetId === item.parentAssetId)
          && (!item.variantScope || effectiveAssetScope(asset) === item.variantScope));
        const name = centralEquipmentDisplay(item);
        return <div className="ops-boq-equipment" key={`${item.id}-${item.variantScope || "default"}-${parent.id}`}>
          <div className="ops-config-item">
            <div><strong>{name.primary}{parentCabinet ? ` · ${parentCabinet.assetNo || "Cabinet"}` : WIM_TYPES.has(item.type) ? ` · Lane ${draft.lanes.find((lane) => lane.id === parent.laneId)?.laneNo}` : ""}</strong><span>{name.secondary} · ผูกกับ {parentCabinet ? `${wimNameEn} / Cabinet` : `${parent.nameEn || parent.displayLabel || parent.canonicalItemId || wimNameEn}${parent.instanceNo ? ` #${parent.instanceNo}` : ""}`}</span></div>
            <label className="ops-field"><span>จำนวน</span><input type="number" min="0" max="99" value={scopedAssets.length} onChange={(event) => changeAssetQuantity(item, event.target.value, parent)} /></label>
          </div>
          {scopedAssets.map(showAsset)}
        </div>;
      }
      const scopedAssets = activeAssets.filter((asset) => asset.catalogItemId === item.id && (!item.variantScope || asset.scope === item.variantScope));
      const name = centralEquipmentDisplay(item);
      return <div className="ops-boq-equipment" key={`${item.id}-${item.variantScope || "default"}`}>
        <div className="ops-config-item">
          <div><strong>{name.primary}</strong><span>{name.secondary} · BOQ/TOR {item.categoryCode}{item.variantScope ? ` · ${item.variantScope}` : ""}</span></div>
          <label className="ops-field"><span>จำนวน</span><input type="number" min="0" max="99" value={scopedAssets.length} onChange={(event) => changeAssetQuantity(item, event.target.value)} /></label>
        </div>
        {scopedAssets.map(showAsset)}
      </div>;
    };
    const renderBoqCategory = (category, index) => {
      const categoryAssetCount = activeAssets.filter((asset) => String(asset.categoryCode || "—") === category.code && getBoqAddCategory({ stationFormat: draft.stationFormat, type: asset.type, categoryCode: asset.categoryCode, scope: effectiveAssetScope(asset) }).code === activeGroup?.code).length;
      return <details className="ops-boq-category ops-station-category-card" key={category.code} open={openBoqCategory === category.code || (!openBoqCategory && index === 0)} onToggle={(event) => { if (event.currentTarget.open) setOpenBoqCategory(category.code); }}>
        <summary><span className="ops-config-section-code ops-station-category-code">{category.code}</span><span className="ops-station-category-title">{category.title}</span><small className="ops-station-category-meta">{categoryAssetCount} Asset</small></summary>
        <div className="ops-boq-category-items">{category.items.map(renderEquipmentItem)}</div>
      </details>;
    };
    const referenceItemAssets = (item) => activeAssets.filter((asset) => asset.catalogItemId === item.id
      && (!item.variantScope || effectiveAssetScope(asset) === item.variantScope)
      && (!item.parentId || asset.parentSystemId === item.parentId)
      && (!item.parentAssetId || asset.parentAssetId === item.parentAssetId)
      && (!WIM_TYPES.has(item.type) || wimInstances.some((parent) => parent.id === asset.parentSystemId)));
    const renderReferenceEquipmentRow = (item, category, index) => {
      const assets = referenceItemAssets(item);
      const name = centralEquipmentDisplay(item);
      const rowKey = `${category.code}-${item.id}-${item.variantScope || "default"}-${item.parentId || "no-system"}-${item.parentAssetId || "no-asset-parent"}`;
      const expanded = expandedReferenceRows.includes(rowKey);
      const visibleAssets = expanded ? assets : assets.slice(0, 2);
      const toggleDetails = () => setExpandedReferenceRows((current) => current.includes(rowKey)
        ? current.filter((key) => key !== rowKey)
        : [...current, rowKey]);
      return <div className={`ops-reference-equipment-item ${expanded ? "is-expanded" : ""}`} key={rowKey}>
          <div className="ops-reference-equipment-row">
            <span className="ops-reference-item-code">{category.code}.{index + 1}</span>
            <div className="ops-reference-item-name"><span className="ops-reference-item-icon"><Icon name={getEquipmentIconName(item.type)} /></span><span><strong>{name.primary}</strong><small>{name.secondary}{item.variantScope ? ` · ${item.variantScope}` : ""}</small></span></div>
          <div className="ops-reference-quantity" aria-label={`จำนวน ${name.primary}`}><button type="button" aria-label={`ลดจำนวน ${name.primary}`} onClick={() => changeAggregateAssetQuantity(item, assets.length - 1)} disabled={!assets.length}>−</button><strong>{assets.length}</strong><button type="button" aria-label={`เพิ่มจำนวน ${name.primary}`} onClick={() => changeAggregateAssetQuantity(item, assets.length + 1)}>+</button></div>
          <span className="ops-reference-asset-label">Asset No.</span>
          <div className="ops-reference-asset-inputs">{expanded ? <span className="ops-reference-detail-count">{assets.length ? `${assets.length} รายการ Asset` : "ยังไม่มี Asset"}</span> : visibleAssets.map((asset) => <input key={asset.id} value={asset.assetNo || ""} placeholder="ระบุหมายเลข Asset" aria-label={`Asset No. ${name.primary}`} aria-invalid={Boolean(assetError(asset))} onChange={(event) => updateAsset(asset.id, "assetNo", event.target.value)} />)}{assets.length > 2 && !expanded && <button type="button" className="ops-reference-more-assets" onClick={toggleDetails}>{`+${assets.length - 2} เพิ่ม`}</button>}<button type="button" className="ops-reference-add-asset" onClick={() => changeAggregateAssetQuantity(item, assets.length + 1)}><Icon name="plus" size="small" />เพิ่ม Asset</button></div>
          <button type="button" className="ops-reference-row-menu" aria-label={`${expanded ? "ย่อ" : "รายละเอียด"} ${name.primary}`} aria-expanded={expanded} onClick={toggleDetails}><Icon name="dots" size="small" /></button>
        </div>
        {expanded && <div className="ops-reference-asset-detail-list" aria-label={`รายละเอียด Asset ${name.primary}`}>
          {assets.length ? assets.map((asset, assetIndex) => {
            const error = assetError(asset);
            return <article className="ops-reference-asset-detail" id={`draft-asset-${asset.id}`} key={asset.id}>
              <div className="ops-reference-asset-detail-heading"><strong>Asset {assetIndex + 1}</strong><button type="button" className="ops-reference-asset-remove" onClick={() => removeReferenceAsset(asset)} aria-label={`นำ Asset ${asset.assetNo || assetIndex + 1} ออก`}><Icon name="delete" size="small" /></button></div>
              <div className="ops-reference-asset-detail-fields">
                <label className="ops-field"><span>Asset No. <em>(จำเป็น)</em></span><input value={asset.assetNo || ""} aria-invalid={Boolean(error)} onChange={(event) => updateAsset(asset.id, "assetNo", event.target.value)} />{error && <small className="ops-field-error" role="alert">{error}</small>}</label>
                <label className="ops-field"><span>Serial Number</span><input value={asset.serialNo || ""} onChange={(event) => updateAsset(asset.id, "serialNo", event.target.value)} onBlur={() => { if (asset.serialNo) updateAsset(asset.id, "serialStatus", "present"); }} /></label>
                <label className="ops-field"><span>ตำแหน่งติดตั้ง</span><input value={asset.location || ""} onChange={(event) => updateAsset(asset.id, "location", event.target.value)} /></label>
                <label className="ops-field"><span>สถานะ Serial</span><select value={asset.serialStatus || "unknown"} onChange={(event) => updateAsset(asset.id, "serialStatus", event.target.value)}><option value="unknown">ยังไม่ระบุ</option><option value="present">มี Serial</option><option value="not-available">ไม่มี / อ่านไม่ได้</option></select></label>
              </div>
              {asset.type === "WIM_SWITCHING_DC" && <fieldset className="ops-reference-output-fieldset"><legend>Output ของ Switching DC</legend><div className="ops-serial-options"><label><input type="checkbox" checked={(asset.outputVoltages || []).includes(12)} onChange={() => updateAsset(asset.id, "outputVoltages", (asset.outputVoltages || []).includes(12) ? asset.outputVoltages.filter((value) => value !== 12) : [...(asset.outputVoltages || []), 12].sort((left, right) => left - right))} />12VDC</label><label><input type="checkbox" checked={(asset.outputVoltages || []).includes(24)} onChange={() => updateAsset(asset.id, "outputVoltages", (asset.outputVoltages || []).includes(24) ? asset.outputVoltages.filter((value) => value !== 24) : [...(asset.outputVoltages || []), 24].sort((left, right) => left - right))} />24VDC</label><label><input type="checkbox" checked={(asset.outputVoltages || []).includes(48)} onChange={() => updateAsset(asset.id, "outputVoltages", (asset.outputVoltages || []).includes(48) ? asset.outputVoltages.filter((value) => value !== 48) : [...(asset.outputVoltages || []), 48].sort((left, right) => left - right))} />48VDC</label></div></fieldset>}
            </article>;
          }) : <div className="ops-reference-empty">เพิ่ม Asset เพื่อกรอกรายละเอียด</div>}
        </div>}
      </div>;
    };
    const renderReferenceCategory = (category) => {
      const categoryAssetCount = category.items.reduce((total, item) => total + referenceItemAssets(item).length, 0);
      return <details className="ops-reference-category" key={category.code} open={expandedBoqCategories.includes(category.code)} onToggle={(event) => { const isOpen = event.currentTarget.open; setExpandedBoqCategories((current) => isOpen ? [...new Set([...current, category.code])] : current.filter((code) => code !== category.code)); }}>
        <summary><span className="ops-reference-disclosure" aria-hidden="true" /><span className="ops-reference-category-icon"><Icon name={getScIconName(category.code)} size="small" /></span><span className="ops-reference-category-code">{category.code}</span><strong>{category.title}</strong><small>{categoryAssetCount} Asset</small></summary>
        <div className="ops-reference-category-items">{category.items.length ? category.items.map((item, index) => renderReferenceEquipmentRow(item, category, index)) : <div className="ops-reference-empty">ยังไม่มีประเภทอุปกรณ์ในหมวดนี้</div>}</div>
      </details>;
    };
    const renderReferenceSystemRow = (card, index) => {
      const item = systemDefinitions.find((definition) => card.systemIds.includes(definition.id));
      if (!item) return null;
      const selected = isReferenceSystemCardSelected(card);
      const name = centralSystemDisplay(item);
      return <div className={`ops-reference-system-row ${selected ? "is-selected" : ""}`} key={`${card.id}-${index}`}>
        <span className="ops-reference-item-code">{card.code}</span>
        <span className="ops-reference-item-icon"><Icon name={systemIconName(item)} size="small" /></span>
        <span className="ops-reference-system-row-copy"><strong>{name.primary}</strong><small>{name.secondary} · {card.scope} · System</small></span>
        <button type="button" className="ops-reference-system-row-action" aria-pressed={selected} onClick={() => toggleReferenceSystemCard(card)}>{selected ? "เลือกแล้ว" : "เพิ่ม System"}</button>
      </div>;
    };
    const renderReferenceGroup = (group) => {
      const categories = [...group.items.reduce((result, item) => {
        const code = String(item.categoryCode || "—");
        if (!result.has(code)) {
          const category = getCentralChecklistSectionName(code);
          const title = category?.nameEn || category?.nameTh || code;
          result.set(code, { code, title, items: [] });
        }
        result.get(code).items.push(item);
        return result;
      }, new Map()).values()].sort((left, right) => left.code.localeCompare(right.code, undefined, { numeric: true }));
      return <details className="ops-reference-group" key={group.code} open={expandedEquipmentGroups.includes(group.code)} onToggle={(event) => { const isOpen = event.currentTarget.open; setExpandedEquipmentGroups((current) => isOpen ? [...new Set([...current, group.code])] : current.filter((code) => code !== group.code)); }}>
        <summary><span className="ops-reference-group-chevron" aria-hidden="true" /><span className="ops-reference-group-icon"><Icon name={referenceGroupIconName(group)} size="small" /></span><span className="ops-reference-group-code">{group.code}</span><strong>{group.title}</strong><small>{referenceGroupAssetCount(group)} Asset</small></summary>
        <div className="ops-reference-group-body">
          {group.cards?.length > 0 && <div className="ops-reference-system-list" aria-label="รายการ System ในหมวดนี้">{group.cards.map(renderReferenceSystemRow)}</div>}
          {categories.length ? categories.map(renderReferenceCategory) : <div className="ops-reference-empty">เลือกชุดระบบที่เกี่ยวข้องเพื่อเพิ่มอุปกรณ์ในหมวดนี้</div>}
        </div>
      </details>;
    };
    const activeReferenceEquipmentGroup = referenceEquipmentGroups.find((group) => group.code === activeReferenceGroupCodeResolved) || null;
    const filteredReferenceGroups = referenceGroupCards.filter((group) => {
      const query = systemSearch.trim().toLowerCase();
      return !query || `${group.code} ${group.title}`.toLowerCase().includes(query);
    });
    const toStep = (target) => { setStep(target); setMessage(""); window.scrollTo?.({ top: 0, behavior: "smooth" }); };
    const goNext = () => {
      setShowErrors(true);
      if (step === 1 && (validation.errors.stationCode || validation.errors.stationName || validation.errors.province)) return;
      if (step === 2 && !hasSystems) { setMessage("เลือกจุดติดตั้งหรือชุดระบบที่มีจริงอย่างน้อยหนึ่งรายการ"); return; }
      if (step === 2 && wimSelected && !wimInstances.length) { setMessage("เพิ่ม Lane ที่มี WIM อย่างน้อยหนึ่งช่องก่อนเพิ่ม Sensor หรือ Loop"); return; }
      toStep(Math.min(3, step + 1));
    };
    const goBack = () => toStep(Math.max(1, step - 1));
    const resolveBlocker = (blocker) => {
      const assetId = blocker.assetId || blocker.assetIds?.[0];
      if (assetId) {
        const asset = activeAssets.find((entry) => entry.id === assetId);
        const placement = getBoqAddCategory({ stationFormat: draft.stationFormat, type: asset?.type, categoryCode: asset?.categoryCode, scope: effectiveAssetScope(asset) });
        const group = relationshipTree.find((entry) => entry.categories.some((category) => category.assets.some((item) => item.id === assetId)));
        const category = group?.categories.find((entry) => entry.assets.some((item) => item.id === assetId));
        setActiveRelationshipGroupId(placement.groupId || group?.groupId || activeRelationshipGroupId);
        setActiveRelationshipCategoryKey(category?.id || "");
        setSelectedRelationshipId(assetId);
        setSelectedRelationshipKind("asset");
        toStep(2);
        window.setTimeout(() => {
          const target = document.getElementById(`sc-asset-row-${assetId}`);
          target?.scrollIntoView({ block: "center" });
          target?.querySelector("input, select, button")?.focus();
        }, 120);
        return;
      }
      if (blocker.systemId) {
        const system = draft.stationSystems.find((entry) => entry.id === blocker.systemId);
        const placement = getBoqAddCategory({ stationFormat: draft.stationFormat, kind: "system", canonicalItemId: system?.canonicalItemId, categoryCode: system?.checklistMapping?.[0], scope: system?.scope });
        const group = relationshipTree.find((entry) => entry.categories.some((category) => category.systems.some((item) => item.id === blocker.systemId)));
        const category = group?.categories.find((entry) => entry.systems.some((item) => item.id === blocker.systemId));
        setActiveRelationshipGroupId(placement.groupId || group?.groupId || activeRelationshipGroupId);
        setActiveRelationshipCategoryKey(category?.id || "");
        setSelectedRelationshipId(blocker.systemId);
        setSelectedRelationshipKind("system");
      }
      toStep(2);
    };
    const resolveIssue = (issue) => {
      setShowErrors(true);
      if (issue.field) {
        toStep(1);
        window.setTimeout(() => {
          const target = document.getElementById(`draft-station-${issue.field}`);
          (target?.querySelector("button, input, select") || target)?.focus();
        }, 120);
        return;
      }
      resolveBlocker(issue);
    };
    const relationshipCatalogItems = canonical.filter((item) => item.category === "WIM" && (item.kind === "system" || WIM_TYPES.has(item.equipmentType)));
    const filteredRelationshipCatalogItems = relationshipCatalogItems.filter((item) => {
      const query = systemSearch.trim().toLowerCase();
      return !query || `${item.nameEn} ${item.nameTh} ${item.equipmentType || ""}`.toLowerCase().includes(query);
    });
    const nonWimReferenceGroups = filteredReferenceGroups.map((group) => {
      const cards = (group.cards || []).filter((card) => !card.systemIds?.some((systemId) => WIM_PRIMARY_SYSTEM_IDS.has(systemId)));
      return { ...group, cards, selected: cards.some(isReferenceSystemCardSelected) };
    }).filter((group) => group.cards.length);
    const laneForParent = (parent) => draft.lanes.find((lane) => lane.id === parent?.laneId);
    const assetsForParent = (parent) => activeAssets.filter((asset) => WIM_TYPES.has(asset.type) && asset.parentSystemId === parent?.id);
    const unboundWimAssets = activeAssets.filter((asset) => WIM_TYPES.has(asset.type) && !wimInstances.some((parent) => parent.id === asset.parentSystemId));
    const unboundWimParents = wimInstances.filter((parent) => !draft.lanes.some((lane) => lane.id === parent.laneId));
    const catalogItemState = (item) => {
      if (item.id === WIM_ID) return wimInstances.length ? `${wimInstances.length} Lane` : "ยังไม่ได้เพิ่ม";
      if (item.kind === "system") return selectedSystemIds.has(item.id) ? "เลือกแล้ว" : "ยังไม่ได้เลือก";
      const count = activeAssets.filter((asset) => asset.type === item.equipmentType).length;
      return count ? `${count} Asset` : "ยังไม่มี Asset";
    };
    const handleRelationshipCatalogAdd = (item) => {
      if (item.id === WIM_ID) {
        const openLane = draft.lanes.find((lane) => !wimInstances.some((parent) => parent.laneId === lane.id));
        if (openLane) addWimParentToLane(openLane.id);
        else addWimLane();
        return;
      }
      if (item.kind === "system") {
        toggleSystem(item);
        return;
      }
      if (WIM_TYPES.has(item.equipmentType)) {
        if (!wimInstances.length) {
          setMessage("เพิ่ม WIM Sorting System และ Lane ก่อน จึงจะเพิ่ม Sensor หรือ Loop ได้");
          return;
        }
        addWimAssetForParent(item.equipmentType, wimInstances[0]);
        return;
      }
      const ownerCategoryId = activeRelationshipCategoryKey || relationshipCategoryForCatalogItem(item);
      const ownerId = item.systemIds?.find((id) => relationshipCategoryForCatalogItem(systemDefinitions.find((definition) => definition.id === id) || { id, kind: "system" }) === ownerCategoryId)
        || item.systemIds?.find((id) => id !== WIM_ID);
      const owner = systemDefinitions.find((definition) => definition.id === ownerId);
      const ownerSystem = owner && draft.stationSystems.find((system) => system.active !== false && system.canonicalItemId === owner.id);
      const catalogItem = catalog.find((entry) => entry.type === item.equipmentType && entry.active !== false);
      if (!catalogItem) {
        setMessage(`ยังไม่พบรายการ ${item.nameEn || item.nameTh} ใน Catalog`);
        return;
      }
      const scope = String(ownerSystem?.scope || preferredScopeForFormat(owner || item, draft.stationFormat) || "").trim();
      const scopedItem = scope ? { ...catalogItem, variantScope: scope } : catalogItem;
      addAssetWithSystemOwner(scopedItem, scope, owner, ownerSystem?.id || null);
      setMessage(owner && !ownerSystem
        ? `เพิ่ม ${owner.nameEn || owner.nameTh} พร้อม ${item.nameEn || item.nameTh} ใน Scope ${scope} แล้ว`
        : `เพิ่ม ${item.nameEn || item.nameTh} ใน Scope ${scope || "สถานี"} แล้ว`);
    };
    const renderWimAssetCard = (asset) => {
      const name = centralEquipmentDisplay({ id: asset.catalogItemId, type: asset.type, label: asset.catalogItemLabel, nameEn: asset.catalogItemLabelEn });
      const error = assetError(asset);
      return <details className={`ops-wim-asset-card${error ? " has-error" : ""}`} key={asset.id} open={Boolean(error)} id={`draft-asset-${asset.id}`}>
        <summary>
          <span className={`ops-wim-asset-icon is-${asset.type === "WIM_LOOP" ? "loop" : "sensor"}`}><Icon name={getEquipmentIconName(asset.type)} /></span>
          <span className="ops-wim-asset-copy"><strong>{name.primary}</strong><small>{name.secondary} · {asset.assetNo || "ยังไม่มี Asset No."}</small></span>
          <span className={`ops-wim-asset-status${error ? " is-error" : asset.assetNo ? " is-ready" : " is-pending"}`}>{error ? "ต้องแก้ไข" : asset.assetNo ? "ใช้งานแล้ว" : "รอกรอกข้อมูล"}</span>
          <span className="ops-wim-summary-chevron" aria-hidden="true"><Icon name="chevron-down" size="small" /></span>
        </summary>
        <div className="ops-wim-asset-detail">
          <label className="ops-field"><span>Asset No. <em>(จำเป็น)</em></span><input value={asset.assetNo || ""} aria-invalid={Boolean(error)} onChange={(event) => updateAsset(asset.id, "assetNo", event.target.value)} />{error && <small className="ops-field-error" role="alert">{error}</small>}</label>
          <label className="ops-field"><span>ตำแหน่งติดตั้ง</span><input value={asset.location || ""} onChange={(event) => updateAsset(asset.id, "location", event.target.value)} /></label>
          <label className="ops-field"><span>Serial Number</span><input value={asset.serialNo || ""} onChange={(event) => updateAsset(asset.id, "serialNo", event.target.value)} /></label>
          <button type="button" className="ops-wim-text-danger" onClick={() => removeReferenceAsset(asset)}><Icon name="delete" size="small" />นำอุปกรณ์ออก</button>
        </div>
      </details>;
    };
    const renderWimParentActions = (parent) => {
      const currentLane = laneForParent(parent);
      const otherLanes = draft.lanes.filter((lane) => lane.id !== currentLane?.id);
      return <details className="ops-wim-parent-actions">
        <summary aria-label={`จัดการ WIM Sorting System #${parent.instanceNo || "?"}`}><Icon name="dots" size="small" /></summary>
        <div className="ops-wim-parent-menu">
          <button type="button" onClick={() => addWimAssetForParent("WIM_SENSOR", parent)}><Icon name="sensor" size="small" />เพิ่ม WIM Sensor</button>
          <button type="button" onClick={() => addWimAssetForParent("WIM_LOOP", parent)}><Icon name="loop" size="small" />เพิ่ม WIM Loop</button>
          <div className="ops-wim-parent-menu-section"><span>ย้ายไป Lane อื่น</span>{otherLanes.length ? otherLanes.map((lane) => {
            const occupied = wimInstances.some((entry) => entry.id !== parent.id && entry.laneId === lane.id);
            return <button type="button" key={lane.id} disabled={occupied} onClick={() => moveWimParent(parent.id, lane.id)}><Icon name="lane" size="small" />Lane {lane.laneNo}{occupied ? " · มีระบบแม่แล้ว" : ""}</button>;
          }) : <small>เพิ่ม Lane อื่นก่อนจึงย้ายได้</small>}</div>
          <button type="button" className="is-danger" onClick={() => removeWimParent(parent.id)}><Icon name="delete" size="small" />นำระบบแม่ออก</button>
        </div>
      </details>;
    };
    const renderWimLane = (lane) => {
      const parent = wimInstances.find((system) => system.laneId === lane.id);
      const laneAssets = assetsForParent(parent);
      return <article className="ops-wim-lane-card" key={lane.id}>
        <header className="ops-wim-lane-heading">
          <div className="ops-wim-lane-title"><span className="ops-wim-lane-icon"><Icon name="lane" /></span><div><strong>Lane {lane.laneNo} · {parent?.scope || lane.scope || "ไม่ระบุ Scope"}</strong><small>{lane.label || "ช่องจราจร"}{lane.direction ? ` · ${lane.direction}` : ""}</small></div></div>
          <div className="ops-wim-lane-total"><span>รวมทั้งหมด</span><strong>{parent ? 1 + laneAssets.length : 0} อุปกรณ์</strong><button type="button" className="ops-wim-icon-button is-danger" onClick={() => removeWimLane(lane.id)} aria-label={`นำ Lane ${lane.laneNo} ออก`}><Icon name="delete" size="small" /></button></div>
        </header>
        <div className="ops-wim-lane-body">
          {parent ? <>
            <article className="ops-wim-parent-card">
              <span className="ops-wim-parent-icon"><Icon name={systemIconName(parent)} /></span>
              <div className="ops-wim-parent-copy"><strong>WIM Sorting System</strong><small>WIM #{parent.instanceNo || "?"} · {parent.scope || "ยังไม่ระบุขอบเขต"}</small><span>Parent System · ระบบแม่ของ Sensor / Loop</span></div>
              {renderWimParentActions(parent)}
            </article>
            <div className="ops-wim-child-list" aria-label={`อุปกรณ์ลูกของ WIM Sorting System #${parent.instanceNo || "?"}`}>
              {laneAssets.length ? laneAssets.map(renderWimAssetCard) : <div className="ops-wim-child-empty"><Icon name="link" /><span>ยังไม่มี Sensor หรือ Loop</span><small>เพิ่มอุปกรณ์จากเมนูของ WIM Sorting System</small></div>}
            </div>
            <div className="ops-wim-add-child-actions"><button type="button" onClick={() => addWimAssetForParent("WIM_SENSOR", parent)}><Icon name="sensor" size="small" />เพิ่ม WIM Sensor</button><button type="button" onClick={() => addWimAssetForParent("WIM_LOOP", parent)}><Icon name="loop" size="small" />เพิ่ม WIM Loop</button></div>
          </> : <div className="ops-wim-parent-empty"><span className="ops-wim-parent-icon"><Icon name="system" /></span><div><strong>ยังไม่มี WIM Sorting System</strong><small>เพิ่มระบบแม่ก่อนจึงจะเพิ่ม Sensor หรือ Loop ได้</small></div><button type="button" onClick={() => addWimParentToLane(lane.id)}><Icon name="plus" size="small" />เพิ่มระบบแม่</button></div>}
        </div>
      </article>;
    };
    const renderRelationshipMap = () => <>
      <header className="ops-wim-map-heading"><div><p className="ops-eyebrow">WIM RELATIONSHIP MAP</p><h2>แผนผังความสัมพันธ์ ระบบและอุปกรณ์</h2><p>จัดโครงสร้างจาก Lane และผูกอุปกรณ์กับระบบแม่ที่ถูกต้อง</p></div><button type="button" className="ops-wim-view-button" onClick={addLane}><Icon name="plus" size="small" />เพิ่ม Lane</button></header>
      <div className="ops-wim-lane-grid">{draft.lanes.length ? draft.lanes.map(renderWimLane) : <div className="ops-wim-map-empty"><span className="ops-wim-empty-icon"><Icon name="lane" /></span><strong>ยังไม่มี Lane</strong><span>เพิ่ม Lane ก่อน แล้วจึงเพิ่ม WIM Sorting System และอุปกรณ์ลูก</span><button type="button" onClick={addLane}><Icon name="plus" size="small" />เพิ่ม Lane แรก</button></div>}</div>
      <section className="ops-wim-unbound-panel" aria-labelledby="ops-wim-unbound-title"><header><div><span className="ops-wim-unbound-icon"><Icon name="link" /></span><div><h3 id="ops-wim-unbound-title">อุปกรณ์ที่ยังไม่ผูก ({unboundWimAssets.length + unboundWimParents.length})</h3><p>รายการที่ยังไม่สัมพันธ์กับ WIM Parent หรือ Lane จะไม่ถูกซ่อนไว้</p></div></div></header>{unboundWimParents.length || unboundWimAssets.length ? <div className="ops-wim-unbound-list">{unboundWimParents.map((parent) => <div className="ops-wim-unbound-row" key={parent.id}><span className="ops-wim-parent-icon"><Icon name="system" /></span><div><strong>WIM Sorting System #{parent.instanceNo || "?"}</strong><small>ยังไม่ผูกกับ Lane</small></div><div className="ops-wim-unbound-lane-actions">{draft.lanes.map((lane) => <button type="button" key={lane.id} disabled={wimInstances.some((entry) => entry.id !== parent.id && entry.laneId === lane.id)} onClick={() => moveWimParent(parent.id, lane.id)}>ผูก Lane {lane.laneNo}</button>)}</div></div>)}{unboundWimAssets.map((asset) => { const name = centralEquipmentDisplay({ id: asset.catalogItemId, type: asset.type, label: asset.catalogItemLabel, nameEn: asset.catalogItemLabelEn }); return <div className="ops-wim-unbound-row" key={asset.id}><span className={`ops-wim-asset-icon is-${asset.type === "WIM_LOOP" ? "loop" : "sensor"}`}><Icon name={getEquipmentIconName(asset.type)} /></span><div><strong>{name.primary}</strong><small>{asset.assetNo || "ยังไม่มี Asset No."} · ต้องเลือก WIM Parent</small></div><CustomSelect label={`เลือก WIM Sorting System แม่สำหรับ ${name.primary}`} value={asset.parentSystemId || ""} onChange={(event) => assignWimParent(asset.id, event.target.value)}><option value="">ยังไม่ผูกระบบแม่</option>{wimInstances.filter((parent) => draft.lanes.some((lane) => lane.id === parent.laneId)).map((parent) => <option key={parent.id} value={parent.id}>WIM Sorting System #{parent.instanceNo || "?"} · Lane {laneForParent(parent)?.laneNo || "?"}</option>)}</CustomSelect></div>; })}</div> : <div className="ops-wim-unbound-empty"><Icon name="check" /><strong>ไม่มีอุปกรณ์ค้างผูก</strong><span>Sensor และ Loop ทุกตัวจะรับ Lane จาก WIM Sorting System แม่</span></div>}</section>
    </>;

    // The draft wizard and the saved Station Profile intentionally share the
    // same relationship tree.  BOQ/TOR remains secondary metadata; the
    // installed view is built only from the draft's real records.
    // Legacy BOQ decoding remains available for old drafts: renderReferenceSystemRow
    // and cards: activeReferenceGroupCard?.cards || [] are intentionally retained
    // as compatibility helpers, while the visible register below uses the tree.
    const relationshipSystemDefinitionsById = new Map(systemDefinitions.map((item) => [item.id, item]));
    const relationshipTree = buildStationRelationshipTree({
      stationFormat: draft.stationFormat,
      systems: draft.stationSystems,
      equipment: draft.equipment,
      includeEmptyGroups: true,
      includeCatalogOptions: true,
      includeInactive: false,
    });
    const activeRelationshipGroup = relationshipTree.find((group) => group.groupId === activeRelationshipGroupId) || relationshipTree[0] || null;
    const activeWorkSpecNote = getStationWorkSpecGroupNote(draft.stationFormat, activeRelationshipGroup?.groupId);
    const workSpecSystemCountForGroup = (group) => (group?.categories || [])
      .reduce((total, category) => total + (category.systems || []).length, 0);
    const relationshipGroupCountLabel = (group, includeAddHint = false) => {
      const count = `${workSpecSystemCountForGroup(group)} ระบบ · ${group?.assetCount || 0} อุปกรณ์`;
      return includeAddHint && group && !group.hasData ? `${count} · ยังไม่ติดตั้ง · เพิ่มได้` : count;
    };
    const workSpecSystemCountFor = (canonicalItemId, scope) => draft.stationSystems
      .filter((system) => system.active !== false
        && system.canonicalItemId === canonicalItemId
        && String(system.scope || "").trim() === String(scope || "").trim()).length;
    const hiddenWorkSpecSystemIds = new Set(["wim-control", "wim-electronics-system"]);
    const activeWorkSpecSections = (() => {
      const sections = (activeRelationshipGroup?.categories || []).map((category) => ({
        id: category.id,
        category,
        title: category.label,
        titleTh: category.description,
        equipment: [],
        systems: [],
      }));
      const sectionsByCategoryId = new Map(sections.map((section) => [section.id, section]));
      const equipmentKeys = new Set();
      (activeReferenceEquipmentGroup?.items || []).forEach((item) => {
        const categoryId = getRelationshipCategoryForAsset({
          type: item.type,
          categoryCode: item.categoryCode,
          scope: item.variantScope,
        });
        const section = sectionsByCategoryId.get(categoryId);
        const key = `${item.id}::${item.variantScope || "default"}`;
        if (!section || equipmentKeys.has(key)) return;
        equipmentKeys.add(key);
        section.equipment.push(item);
      });
      (activeReferenceGroupCard?.cards || []).forEach((card) => {
        const definition = systemDefinitions.find((item) => card.systemIds.includes(item.id));
        if (!definition || hiddenWorkSpecSystemIds.has(definition.id)) return;
        const categoryId = getRelationshipCategoryForSystem(definition);
        const section = sectionsByCategoryId.get(categoryId);
        if (!section) return;
        section.systems.push({ card, definition });
      });
      // The relationship tree owns category ordering. BOQ/TOR source codes
      // are shown on each row as references, never used as parent headings.
      return sections.filter((section) => section.equipment.length || section.systems.length);
    })();
    const setRelationshipGroup = (group) => {
      if (!group) return;
      setActiveRelationshipGroupId(group.groupId);
      setActiveRelationshipCategoryKey(group.categories[0]?.id || "");
    };
    const relationshipParentForAsset = (asset) => draft.stationSystems.find((system) => system.id === asset?.parentSystemId) || null;
    const relationshipIsWimEquipment = (asset) => WIM_TYPES.has(asset?.type);
    const relationshipIsWimSystem = (system) => system?.canonicalItemId === WIM_ID;
    const relationshipAssetStatus = (asset) => {
      if (asset?.active === false) return "inactive";
      if (showErrors && assetError(asset)) return "blocker";
      if (!String(asset?.assetNo || "").trim()) return "warning";
      return "ready";
    };
    const relationshipSystemStatus = (system) => {
      if (system?.active === false) return "inactive";
      if (relationshipIsWimSystem(system) && !draft.lanes.some((lane) => lane.id === system.laneId)) return "blocker";
      return "ready";
    };
    const relationshipSystemLabel = (system) => centralSystemDisplay(system).primary;
    const relationshipSystemSecondaryLabel = (system) => centralSystemDisplay(system).secondary;
    const relationshipAssetLabel = (asset) => centralEquipmentDisplay({ id: asset?.catalogItemId, type: asset?.type, label: asset?.catalogItemLabel, nameEn: asset?.catalogItemLabelEn }).primary;
    const relationshipAssetSecondaryLabel = (asset) => centralEquipmentDisplay({ id: asset?.catalogItemId, type: asset?.type, label: asset?.catalogItemLabel, nameEn: asset?.catalogItemLabelEn }).secondary;
    const relationshipGroupSecondaryLabel = (group) => RELATIONSHIP_GROUP_NAME_TH[group?.groupId] || "";
    const relationshipGroupSearchText = (group) => [
      group.groupId,
      group.title,
      relationshipGroupSecondaryLabel(group),
      ...(group.sourceRefs || []),
      ...group.categories.flatMap((category) => [
        category.label,
        category.description,
        ...category.equipmentOptions.flatMap((item) => [item.nameEn, item.nameTh, item.scope, ...(item.sourceRefs || [])]),
        ...category.systemOptions.flatMap((item) => [item.nameEn, item.nameTh, item.scope, ...(item.sourceRefs || [])]),
        ...category.assets.flatMap((asset) => [relationshipAssetLabel(asset), relationshipAssetSecondaryLabel(asset), asset.assetNo, asset.scope]),
        ...category.systems.flatMap((system) => [relationshipSystemLabel(system), relationshipSystemSecondaryLabel(system), system.scope]),
      ]),
    ].filter(Boolean).join(" ").toLocaleLowerCase();
    const groupSearchQuery = systemSearch.trim().toLocaleLowerCase();
    const visibleRelationshipGroups = groupSearchQuery
      ? relationshipTree.filter((group) => relationshipGroupSearchText(group).includes(groupSearchQuery))
      : relationshipTree;
    const updateRelationshipGroupSearch = (value) => {
      setSystemSearch(value);
    };
    const addWorkSpecEquipment = (item) => {
      const definition = canonical.find((entry) => entry.kind === "asset" && entry.equipmentType === item.type);
      if (!definition) return setMessage(`ยังไม่พบ ${item.nameEn || item.label || item.type} ในรายการมาตรฐาน`);
      const scope = String(item.variantScope || preferredScopeForFormat(definition, draft.stationFormat) || "").trim();
      const categoryId = getRelationshipCategoryForAsset({ type: item.type, categoryCode: item.categoryCode, scope });
      addRelationshipRecord(categoryId, "asset", {
        canonicalItemId: definition.id,
        nameEn: definition.nameEn,
        nameTh: definition.nameTh,
        scope,
        categoryCode: item.categoryCode,
        parentId: item.parentId || null,
        parentAssetId: item.parentAssetId || null,
      });
    };
    const addWorkSpecSystem = ({ card, definition }) => {
      addRelationshipRecord(getRelationshipCategoryForSystem(definition), "system", {
        canonicalItemId: definition.id,
        scope: String(card.scope || preferredScopeForFormat(definition, draft.stationFormat) || "").trim(),
      });
    };
    const workSpecSourceReference = (sourceRefs) => {
      const refs = (Array.isArray(sourceRefs) ? sourceRefs : String(sourceRefs || "").split(/[;,]/))
        .map((value) => String(value || "").trim())
        .filter((value, index, values) => value && value !== "—" && values.indexOf(value) === index);
      return refs.length ? `BOQ/TOR ${refs.join(", ")}` : "";
    };
    const renderWorkSpecSystem = ({ card, definition }) => {
      const scope = String(card.scope || preferredScopeForFormat(definition, draft.stationFormat) || "").trim();
      const purpose = getStationWorkSpecPurpose(definition.id);
      const installed = draft.stationSystems.filter((system) => system.active !== false
        && system.canonicalItemId === definition.id
        && String(system.scope || "").trim() === scope);
      const name = centralSystemDisplay(definition);
      const sourceReference = workSpecSourceReference(definition.checklistMapping || card.code);
      return <article className={`ops-work-spec-system${installed.length ? " is-installed" : ""}`} key={`${card.id}-${scope}`}>
        <div className="ops-work-spec-copy"><span className="ops-reference-item-icon"><Icon name={systemIconName(definition)} size="small" /></span><span><strong>{name.primary}</strong><small>{name.secondary} · {scope || "Station-wide"} · System</small>{purpose && <small className="ops-work-spec-purpose">หน้าที่: {purpose}</small>}{sourceReference && <small className="ops-work-spec-source-ref">{sourceReference}</small>}</span></div>
        {installed.length > 0 && <div className="ops-work-spec-installed-list">{installed.map((system) => {
          const unit = system.unit || system.referenceUnit || definition.defaultUnit || "ระบบ";
          const isWimInstance = definition.id === WIM_ID;
          const systemRowNo = installed.findIndex((entry) => entry.id === system.id) + 1;
          return <div className="ops-work-spec-installed-row" key={system.id}>
            <span>{isWimInstance ? `Lane ${draft.lanes.find((lane) => lane.id === system.laneId)?.laneNo || system.instanceNo || "—"} · 1 ${unit}` : `System #${systemRowNo} · 1 ${unit}`}</span>
            <div className="ops-work-spec-actions">
              <button type="button" onClick={() => selectRelationshipRecord(system, "system", getRelationshipCategoryForSystem(system))}>แก้ไข</button><button type="button" className="is-danger" onClick={() => deleteRelationshipRecord(system, "system")}>ลบ</button>
            </div>
            {selectedRelationshipId === system.id && selectedRelationshipKind === "system" && renderInlineRelationshipEditor(system, "system", scope)}
          </div>;
        })}</div>}
        <button type="button" className="ops-work-spec-add" onClick={() => addWorkSpecSystem({ card, definition })} aria-label={definition.id === WIM_ID ? `เพิ่ม WIM Lane และ ${name.primary}` : `เพิ่ม System รายการใหม่ ${name.primary} ใน Scope ${scope}`}><Icon name="plus" size="small" />{definition.id === WIM_ID ? "เพิ่ม WIM Lane" : "เพิ่ม System รายการใหม่"}</button>
      </article>;
    };
    const renderWorkSpecEquipment = (item, category) => {
      const assets = referenceItemAssets(item);
      const name = centralEquipmentDisplay(item);
      const scope = item.variantScope || "";
      const sourceReference = workSpecSourceReference(item.categoryCode || item.sourceRefs);
      const hasWimParent = !WIM_TYPES.has(item.type) || wimInstances.some((parent) => parent.active !== false
        && String(parent.scope || "") === String(scope)
        && draft.lanes.some((lane) => lane.id === parent.laneId));
      return <article className="ops-work-spec-equipment" key={`${category.id}-${item.id}-${scope || "default"}`}>
        <div className="ops-work-spec-equipment-heading">
          <span className="ops-reference-item-icon"><Icon name={getEquipmentIconName(item.type)} size="small" /></span>
          <span className="ops-work-spec-copy"><span><strong>{name.primary}</strong><small>{name.secondary}{scope ? ` · ${scope}` : ""}</small>{sourceReference && <small className="ops-work-spec-source-ref">{sourceReference}</small>}</span></span>
          <span className="ops-work-spec-count">{assets.length} Asset</span>
          <button type="button" className="ops-work-spec-add" onClick={() => addWorkSpecEquipment(item)} disabled={!hasWimParent} aria-label={`เพิ่ม ${name.primary}${scope ? ` ${scope}` : ""}`}><Icon name="plus" size="small" />เพิ่ม</button>
        </div>
        {!hasWimParent && <p className="ops-work-spec-requirement">เพิ่ม WIM Sorting System และ Lane ใน Scope {scope} ก่อน จึงจะเพิ่ม Sensor/Loop ได้</p>}
        {assets.map((asset, assetIndex) => {
          const parent = relationshipParentForAsset(asset);
          const error = assetError(asset);
          return <div className="ops-work-spec-asset-instance" id={`sc-asset-row-${asset.id}`} key={asset.id}>
            <span className="ops-work-spec-instance-label">Asset {assetIndex + 1}</span>
            <span className="ops-work-spec-instance-copy"><strong>{asset.assetNo || "ยังไม่ระบุ Asset No."}</strong><small>{asset.serialNo || "ยังไม่ระบุ Serial Number"}{asset.location ? ` · ${asset.location}` : ""}{WIM_TYPES.has(asset.type) ? ` · ${parent ? `${relationshipSystemLabel(parent)} · Lane ${draft.lanes.find((lane) => lane.id === parent.laneId)?.laneNo || "—"}` : "ยังไม่ผูกระบบแม่"}` : ""}</small>{error && <small className="ops-field-error" role="alert">{error}</small>}</span>
            <div className="ops-work-spec-actions"><button type="button" onClick={() => selectRelationshipRecord(asset, "asset", getRelationshipCategoryForAsset(asset, parent))}>แก้ไข</button><button type="button" className="is-danger" onClick={() => deleteRelationshipRecord(asset, "asset")}>ลบ</button></div>
            {selectedRelationshipId === asset.id && selectedRelationshipKind === "asset" && renderInlineRelationshipEditor(asset, "asset", scope)}
          </div>;
        })}
      </article>;
    };
    const renderWorkSpecWimAsset = (asset, scope, index) => {
      const error = assetError(asset);
      const name = centralEquipmentDisplay({ id: asset.catalogItemId, type: asset.type, label: asset.catalogItemLabel, nameEn: asset.catalogItemLabelEn });
      const parent = relationshipParentForAsset(asset);
      const details = [asset.serialNo ? "S/N " + asset.serialNo : "", asset.location || ""].filter(Boolean).join(" · ");
      return <article className="ops-wim-work-spec-asset" id={"sc-asset-row-" + asset.id} key={asset.id}>
        <span className="ops-wim-work-spec-asset-index">Asset {index + 1}</span>
        <div className="ops-wim-work-spec-asset-copy">
          <strong>{asset.assetNo || "ยังไม่ระบุ Asset No."}</strong>
          <small>{name.primary}{details ? " · " + details : ""}{parent ? " · Lane " + (draft.lanes.find((lane) => lane.id === parent.laneId)?.laneNo || "—") : " · ยังไม่ผูกระบบแม่"}</small>
          {error && <small className="ops-field-error" role="alert">{error}</small>}
        </div>
        <div className="ops-work-spec-actions">
          <button type="button" onClick={() => selectRelationshipRecord(asset, "asset", getRelationshipCategoryForAsset(asset, parent))}>แก้ไข</button>
          <button type="button" className="is-danger" onClick={() => deleteRelationshipRecord(asset, "asset")}>ลบ</button>
        </div>
        {selectedRelationshipId === asset.id && selectedRelationshipKind === "asset" && <div className="ops-wim-work-spec-editor">{renderInlineRelationshipEditor(asset, "asset", scope)}</div>}
      </article>;
    };
    const renderWorkSpecWimLane = (section, lane, scope, items, parent) => {
      const laneNo = Number(lane.laneNo) || "—";
      const itemCounts = items.map((item) => ({
        item,
        assets: parent ? referenceItemAssets({ ...item, parentId: parent.id, variantScope: scope }) : [],
      }));
      const sensorCount = itemCounts.filter(({ item }) => item.type === "WIM_SENSOR").reduce((sum, entry) => sum + entry.assets.length, 0);
      const loopCount = itemCounts.filter(({ item }) => item.type === "WIM_LOOP").reduce((sum, entry) => sum + entry.assets.length, 0);
      const definition = relationshipSystemDefinitionsById.get(WIM_ID);
      const systemName = centralSystemDisplay(definition || { id: WIM_ID, nameEn: "WIM Sorting System", nameTh: "ระบบคัดแยกน้ำหนัก WIM" });
      const sourceReference = workSpecSourceReference(parent?.checklistMapping || definition?.checklistMapping || section.systems.find((entry) => entry.definition.id === WIM_ID)?.card?.code);
      const categoryId = getRelationshipCategoryForSystem(parent || definition);
      return <article className="ops-wim-work-spec-lane" key={lane.id} aria-label={"Lane " + laneNo + " · " + scope}>
        <header className="ops-wim-work-spec-lane-heading">
          <div><span className="ops-wim-work-spec-lane-title">Lane {laneNo}</span><small>{lane.label || "ช่องจราจร"}{lane.direction ? " · " + lane.direction : ""}</small></div>
          <div className="ops-wim-work-spec-lane-summary"><span className="ops-wim-work-spec-scope">{scope}</span><span>{sensorCount} Sensor · {loopCount} Loop</span><button type="button" className="ops-wim-work-spec-lane-remove" aria-label={`ลบ Lane ${laneNo}`} title={`ลบ Lane ${laneNo}`} onClick={() => deleteLaneFromRegister(lane.id)}><Icon name="delete" size="small" /><span>ลบ Lane</span></button></div>
        </header>
        <div className="ops-wim-work-spec-lane-body">
          <section className="ops-wim-work-spec-parent">
            {parent
              ? <div className="ops-wim-work-spec-parent-copy">
                  <small>.02 Systems &amp; Software · System</small>
                  <strong>{systemName.primary}</strong>
                  <span>{systemName.secondary} · {scope} · WIM #{parent.instanceNo || laneNo}</span>
                  {sourceReference && <small className="ops-work-spec-source-ref">{sourceReference}</small>}
                </div>
              : <div className="ops-wim-work-spec-parent-empty" role="status">
                  <small>.02 Systems &amp; Software · System</small>
                  <strong>ยังไม่มี WIM Sorting System ใน Lane นี้</strong>
                  <span>Lane ยังคงอยู่ เพิ่มระบบแม่ได้อีกครั้งเมื่อต้องการ</span>
                </div>}
            {parent
              ? <div className="ops-work-spec-actions">
                  <button type="button" onClick={() => selectRelationshipRecord(parent, "system", getRelationshipCategoryForSystem(parent))}>แก้ไข</button>
                  <button type="button" className="is-danger" onClick={() => deleteRelationshipRecord(parent, "system")}>ลบ</button>
                </div>
              : <button type="button" className="ops-work-spec-add" aria-label={`เพิ่ม WIM Sorting System ใน Lane ${laneNo}`} onClick={() => addWimParentToLane(lane.id, scope)}><Icon name="plus" size="small" />เพิ่ม WIM Sorting System</button>}
            {parent && selectedRelationshipId === parent.id && selectedRelationshipKind === "system" && <div className="ops-wim-work-spec-editor">{renderInlineRelationshipEditor(parent, "system", scope)}</div>}
          </section>
          <section className="ops-wim-work-spec-equipment">
            <h4>.01 Equipment <small>อุปกรณ์ใน Lane นี้</small></h4>
            {items.map((item) => {
              const entry = itemCounts.find((candidate) => candidate.item.id === item.id && String(candidate.item.variantScope || "") === String(item.variantScope || ""));
              const assets = entry?.assets || [];
              const laneItem = { ...item, ...(parent ? { parentId: parent.id, variantScope: scope } : {}) };
              const name = centralEquipmentDisplay(laneItem);
              const itemSourceReference = workSpecSourceReference(laneItem.categoryCode || laneItem.sourceRefs);
              return <div className="ops-wim-work-spec-type" key={item.id + "-" + (item.variantScope || "default") + "-" + (parent?.id || "no-parent")}>
                <div className="ops-wim-work-spec-type-heading">
                  <span className="ops-reference-item-icon"><Icon name={getEquipmentIconName(item.type)} size="small" /></span>
                  <span><strong>{name.primary}</strong><small>{name.secondary}{scope ? " · " + scope : ""}{itemSourceReference ? " · " + itemSourceReference : ""}</small></span>
                  <span className="ops-wim-work-spec-type-count">{assets.length} Asset</span>
                  <button type="button" className="ops-work-spec-add" onClick={() => addWimAssetForParent(item.type, parent)} disabled={!parent} aria-label={"เพิ่ม " + name.primary + " ใน Lane " + laneNo}><Icon name="plus" size="small" />เพิ่ม</button>
                </div>
                {assets.length ? assets.map((asset, index) => renderWorkSpecWimAsset(asset, scope, index)) : <p className="ops-wim-work-spec-empty">{parent ? "ยังไม่มี " + name.primary + " ใน Lane นี้" : "เพิ่ม WIM Sorting System ก่อน จึงเพิ่มอุปกรณ์ได้"}</p>}
              </div>;
            })}
          </section>
        </div>
      </article>;
    };
    const renderWorkSpecWimScope = (section, scope, items) => {
      const sectionScopes = new Set([
        ...section.equipment.map((item) => String(item.variantScope || "").trim()),
        ...section.systems.filter((entry) => entry.definition.id === WIM_ID).map((entry) => String(entry.card.scope || "").trim()),
      ].filter(Boolean));
      const scopedLanes = draft.lanes.filter((lane) => {
        if (lane.active === false) return false;
        const parent = wimInstances.find((system) => system.laneId === lane.id);
        const laneScope = String(parent?.scope || lane.scope || "").trim();
        return laneScope === scope || (!laneScope && sectionScopes.size === 1);
      }).sort((left, right) => (Number(left.laneNo) || 0) - (Number(right.laneNo) || 0));
      const lanes = scopedLanes.map((lane) => ({
        lane,
        parent: wimInstances.find((system) => system.laneId === lane.id && String(system.scope || "").trim() === scope) || null,
      }));
      const orphanParents = wimInstances.filter((parent) => String(parent.scope || "").trim() === scope && !draft.lanes.some((lane) => lane.active !== false && lane.id === parent.laneId));
      const unboundAssets = activeAssets.filter((asset) => WIM_TYPES.has(asset.type)
        && String(effectiveAssetScope(asset) || "").trim() === scope
        && !wimInstances.some((parent) => parent.id === asset.parentSystemId && parent.active !== false && draft.lanes.some((lane) => lane.active !== false && lane.id === parent.laneId)));
      const systemRef = section.systems.find((entry) => entry.definition.id === WIM_ID && String(entry.card.scope || "").trim() === scope);
      const addLane = () => addWimLane(scope);
      return <section className="ops-wim-work-spec-scope" key={scope} aria-label={"WIM Scope " + scope}>
        <header className="ops-wim-work-spec-scope-heading">
          <div><strong>WIM Lane · {scope}</strong><small>หนึ่ง WIM Sorting System ต่อหนึ่ง Lane และ Sensor/Loop จะอยู่ใต้ระบบแม่ของเลนนั้น</small></div>
          <button type="button" className="ops-work-spec-add" onClick={addLane}><Icon name="plus" size="small" />เพิ่ม Lane พร้อม WIM Sorting System</button>
        </header>
        <div className="ops-wim-work-spec-lane-grid">
          {lanes.map(({ lane, parent }) => renderWorkSpecWimLane(section, lane, scope, items, parent))}
          {!lanes.length && <div className="ops-wim-work-spec-no-lanes"><Icon name="lane" /><strong>ยังไม่มี Lane ที่ติดตั้ง WIM ใน Scope นี้</strong><span>เพิ่ม Lane พร้อม WIM Sorting System ก่อน แล้วจึงเพิ่ม Sensor หรือ Loop</span><button type="button" className="ops-work-spec-add" onClick={addLane}><Icon name="plus" size="small" />เพิ่ม Lane พร้อม WIM Sorting System</button></div>}
        </div>
        {orphanParents.length > 0 && <div className="ops-wim-work-spec-unbound" role="alert"><strong>มี WIM Sorting System ที่ยังไม่ผูกกับ Lane</strong>{orphanParents.map((parent) => <div className="ops-wim-work-spec-unbound-row" key={parent.id}><span>WIM Sorting System #{parent.instanceNo || "—"} · {scope}</span><div className="ops-work-spec-actions"><button type="button" onClick={() => selectRelationshipRecord(parent, "system", getRelationshipCategoryForSystem(parent))}>แก้ไข</button><button type="button" className="is-danger" onClick={() => deleteRelationshipRecord(parent, "system")}>ลบ</button></div>{selectedRelationshipId === parent.id && selectedRelationshipKind === "system" && <div className="ops-wim-work-spec-editor">{renderInlineRelationshipEditor(parent, "system", scope)}</div>}</div>)}</div>}
        {unboundAssets.length > 0 && <div className="ops-wim-work-spec-unbound" role="alert"><strong>มี Sensor/Loop ที่ยังไม่ผูกกับ Lane</strong>{unboundAssets.map((asset, index) => renderWorkSpecWimAsset(asset, scope, index))}</div>}
        {!systemRef && !items.length && <div className="ops-reference-empty">ไม่มีรายการ WIM ใน Work Spec นี้</div>}
      </section>;
    };
    const renderWorkSpecSection = (section) => {
      const wimItems = section.equipment.filter((item) => WIM_TYPES.has(item.type));
      const wimSystems = section.systems.filter(({ definition }) => definition.id === WIM_ID);
      const isWimSection = wimItems.length > 0 || wimSystems.length > 0;
      const scopes = [...new Set([
        ...wimItems.map((item) => String(item.variantScope || "").trim()),
        ...wimSystems.map(({ card }) => String(card.scope || "").trim()),
      ].filter(Boolean))];
      const defaultWimScope = preferredScopeForFormat(relationshipSystemDefinitionsById.get(WIM_ID), draft.stationFormat);
      const wimScopes = isWimSection ? (scopes.length ? scopes : [defaultWimScope].filter(Boolean)) : [];
      const otherEquipment = isWimSection ? section.equipment.filter((item) => !WIM_TYPES.has(item.type)) : section.equipment;
      const otherSystems = isWimSection ? section.systems.filter(({ definition }) => definition.id !== WIM_ID) : section.systems;
      return <section className="ops-work-spec-card" key={section.id}>
        <header className="ops-work-spec-heading"><span className="ops-reference-item-icon"><Icon name={getScIconName(section.category.icon)} size="small" /></span><div><strong>{section.title}</strong>{section.titleTh && <small>{section.titleTh}</small>}</div><span className="ops-work-spec-count">{section.equipment.reduce((count, item) => count + referenceItemAssets(item).length, 0)} Asset · {section.systems.reduce((total, { card, definition }) => total + workSpecSystemCountFor(definition.id, card.scope), 0)} System</span></header>
        {isWimSection && wimScopes.map((scope) => renderWorkSpecWimScope(section, scope, wimItems.filter((item) => !item.variantScope || String(item.variantScope).trim() === scope)))}
        {otherEquipment.length > 0 && <div className="ops-work-spec-section"><h4>.01 Equipment <small>อุปกรณ์</small></h4>{otherEquipment.map((item) => renderWorkSpecEquipment(item, section))}</div>}
        {otherSystems.length > 0 && <div className="ops-work-spec-section"><h4>.02 Systems &amp; Software <small>ระบบและซอฟต์แวร์</small></h4><div className="ops-work-spec-systems">{otherSystems.map(renderWorkSpecSystem)}</div></div>}
        {!isWimSection && !section.equipment.length && !section.systems.length && <div className="ops-reference-empty">ไม่มีรายการใน Work Spec นี้</div>}
      </section>;
    };
    const relationshipCategoryForCatalogItem = (item) => item?.kind === "system"
      ? getRelationshipCategoryForSystem({ canonicalItemId: item.id, checklistMapping: item.checklistMapping })
      : getRelationshipCategoryForAsset({ type: item?.equipmentType, sourceRefs: item?.checklistMapping, categoryCode: item?.categoryCode });
    const addRelationshipRecord = (categoryId, kind, option) => {
      setActiveRelationshipCategoryKey(categoryId);
      const scope = String(option?.scope || "");
      const group = relationshipTree.find((entry) => entry.categories.some((category) => category.id === categoryId && (
        kind === "system"
          ? category.systemOptions.some((candidate) => candidate.canonicalItemId === option?.canonicalItemId && String(candidate.scope || "") === scope)
          : category.equipmentOptions.some((candidate) => candidate.canonicalItemId === option?.canonicalItemId && String(candidate.scope || "") === scope)
      )));
      if (group) setActiveRelationshipGroupId(group.groupId);
      if (!option) return setMessage("ไม่พบรายการมาตรฐานสำหรับหมวดนี้");
      if (kind === "system") {
        const definition = systemDefinitions.find((item) => item.id === option.canonicalItemId);
        if (!definition) return setMessage("ยังไม่พบ System นี้ในรายการมาตรฐาน");
        if (definition.id === WIM_ID) {
          const freeLane = draft.lanes.find((lane) => {
            const parent = wimInstances.find((system) => system.laneId === lane.id);
            return !parent && String(lane.scope || parent?.scope || scope) === scope;
          });
          if (freeLane) addWimParentToLane(freeLane.id, scope);
          else addWimLane(scope);
          return;
        }
        addSystemInstanceForScope(definition, scope);
        setMessage("เพิ่ม System รายการใหม่ " + (definition.nameEn || definition.nameTh) + " ใน Scope " + (scope || "สถานี") + " แล้ว");
        return;
      }
      const item = canonical.find((entry) => entry.id === option.canonicalItemId && entry.kind === "asset");
      if (!item?.equipmentType) return setMessage("ยังไม่พบอุปกรณ์ชนิดนี้ในรายการมาตรฐาน");
      if (WIM_TYPES.has(item.equipmentType)) {
        const parent = wimInstances.find((system) => system.active !== false && String(system.scope || "") === scope && draft.lanes.some((lane) => lane.id === system.laneId));
        if (!parent) return setMessage("เพิ่ม WIM Sorting System และ Lane ใน Scope นี้ก่อน จึงจะเพิ่ม WIM Sensor หรือ WIM Loop ได้");
        addWimAssetForParent(item.equipmentType, parent);
        return;
      }
      const ownerId = item.systemIds?.find((id) => relationshipCategoryForCatalogItem(systemDefinitions.find((entry) => entry.id === id) || { id, kind: "system" }) === categoryId)
        || item.systemIds?.find((id) => id !== WIM_ID);
      const owner = systemDefinitions.find((entry) => entry.id === ownerId);
      const ownerSystem = owner && draft.stationSystems.find((system) => system.active !== false
        && (system.canonicalItemId || system.systemId) === owner.id
        && String(system.scope || "").trim() === scope
        && (!option.parentId || system.id === option.parentId));
      const ownerReady = !owner || Boolean(ownerSystem);
      const catalogItem = catalog.find((entry) => entry.type === item.equipmentType && entry.active !== false);
      if (!catalogItem) return setMessage("ยังไม่พบ " + (item.nameEn || item.nameTh) + " ใน Catalog สำหรับสร้าง Asset");
      const scopedItem = {
        ...catalogItem,
        ...(scope ? { variantScope: scope } : {}),
        ...(option.parentId ? { parentId: option.parentId } : {}),
        ...(option.parentAssetId ? { parentAssetId: option.parentAssetId } : {}),
      };
      addAssetWithSystemOwner(scopedItem, scope, owner, ownerSystem?.id || option.parentId || null, option.parentAssetId || null);
      setMessage(owner && !ownerReady
        ? "เพิ่ม " + (owner.nameEn || owner.nameTh) + " พร้อม " + (item.nameEn || item.nameTh) + " ใน Scope " + scope + " แล้ว"
        : "เพิ่ม " + (item.nameEn || item.nameTh) + " ใน Scope " + (scope || "สถานี") + " แล้ว");
    };
    const selectRelationshipRecord = (record, kind, categoryId) => {
      if (!record) return;
      setSelectedRelationshipId(record.id);
      setSelectedRelationshipKind(kind);
      setActiveRelationshipCategoryKey(categoryId);
      const group = relationshipTree.find((entry) => entry.categories.some((category) => category.id === categoryId && (
        kind === "system"
          ? category.systems.some((system) => system.id === record.id)
          : category.assets.some((asset) => asset.id === record.id)
      )));
      if (group) setActiveRelationshipGroupId(group.groupId);
    };
    const saveRelationshipRecord = (record, kind, edited, contextScope = "") => {
      if (kind === "asset") {
        const nextEdited = { ...edited };
        if (relationshipIsWimEquipment(record)) {
          const parent = draft.stationSystems.find((system) => system.id === edited.parentSystemId
            && relationshipIsWimSystem(system) && system.active !== false);
          const lane = parent && draft.lanes.find((entry) => entry.id === parent.laneId && entry.active !== false);
          if (!parent || !lane) return setMessage("กรุณาเลือก WIM Sorting System ที่ผูกกับ Lane ใช้งานอยู่");
          if (contextScope && String(parent.scope || "") !== String(contextScope)) return setMessage(`อุปกรณ์นี้อยู่ใน Scope ${contextScope} กรุณาเลือกระบบแม่ใน Scope เดียวกัน`);
          nextEdited.parentSystemId = parent.id;
          nextEdited.laneId = parent.laneId;
          nextEdited.scope = parent.scope;
        }
        const assetDefinition = canonical.find((item) => item.kind === "asset" && item.equipmentType === record.type);
        if (assetDefinition?.systemIds?.length && !relationshipIsWimEquipment(record) && !isWimElectronicsSubEquipmentType(record.type)) {
          const parent = draft.stationSystems.find((system) => system.id === edited.parentSystemId
            && system.active !== false && assetDefinition.systemIds.includes(system.canonicalItemId || system.systemId));
          if (!parent) return setMessage("กรุณาเลือกระบบแม่ที่เป็นเจ้าของอุปกรณ์ก่อนบันทึก");
          if (contextScope && String(parent.scope || "") !== String(contextScope)) return setMessage(`อุปกรณ์นี้อยู่ใน Scope ${contextScope} กรุณาเลือกระบบแม่ใน Scope เดียวกัน`);
          nextEdited.parentSystemId = parent.id;
          nextEdited.scope = parent.scope;
        }
        if (isWimElectronicsSubEquipmentType(record.type)) {
          const cabinet = draft.equipment.find((asset) => asset.id === edited.parentAssetId && asset.type === "CONTROL_CABINET" && asset.active !== false);
          const electronicSystems = draft.stationSystems.filter((system) => system.active !== false
            && system.canonicalItemId === "wim-electronics-system"
            && (!contextScope || String(system.scope || "") === String(contextScope)));
          const parent = electronicSystems.find((system) => system.id === (cabinet?.parentSystemId || edited.parentSystemId))
            || (!cabinet?.parentSystemId && electronicSystems.length === 1 ? electronicSystems[0] : null);
          if (!cabinet || !parent) return setMessage("กรุณาเลือก Cabinet และ WIM Electronics System แม่ที่อยู่ใน Scope เดียวกัน");
          if ((cabinet.scope && parent.scope && String(cabinet.scope) !== String(parent.scope))
            || (contextScope && cabinet.scope && String(cabinet.scope) !== String(contextScope))) return setMessage("Cabinet และ System แม่ต้องอยู่ใน Scope เดียวกันกับหมวดที่กำลังแก้ไข");
          nextEdited.parentAssetId = cabinet.id;
          nextEdited.parentSystemId = parent.id;
          nextEdited.scope = cabinet.scope || parent.scope;
        }
        const duplicate = draft.equipment.some((asset) => asset.id !== record.id && String(nextEdited.assetNo || "").trim()
          && String(asset.assetNo || "").trim().toLowerCase() === String(nextEdited.assetNo || "").trim().toLowerCase());
        if (duplicate) return setMessage("Asset No. นี้ซ้ำกับอุปกรณ์อื่นในสถานี กรุณาแก้รหัสก่อนบันทึก");
        if (Object.prototype.hasOwnProperty.call(nextEdited, "assetNo")
          && String(nextEdited.assetNo || "").trim() !== String(record.assetNo || "").trim()) {
          nextEdited.assetNoMode = "manual";
        }
        setDraft((current) => {
          const equipment = current.equipment.map((asset) => asset.id === record.id ? { ...asset, ...nextEdited } : asset);
          return { ...current, equipment: synchronizeGeneratedAssetNos(equipment, current.stationSystems) };
        });
        const placement = getBoqAddCategory({ stationFormat: draft.stationFormat, type: record.type, categoryCode: record.categoryCode, scope: effectiveAssetScope({ ...record, ...nextEdited }) });
        if (placement.groupId) setActiveRelationshipGroupId(placement.groupId);
      } else {
        if (relationshipIsWimSystem(record) && edited.laneId !== record.laneId) {
          const occupied = draft.stationSystems.some((system) => system.id !== record.id && relationshipIsWimSystem(system) && system.active !== false && system.laneId === edited.laneId);
          if (occupied) return setMessage("Lane นี้มี WIM Sorting System อยู่แล้ว เลือก Lane ว่างก่อนบันทึก");
        }
        setDraft((current) => {
          const laneId = edited.laneId || record.laneId;
          const lanes = relationshipIsWimSystem(record)
            ? setLaneScope(current.lanes, laneId, edited.scope, current.stationSystems)
            : current.lanes;
          const lane = lanes.find((entry) => entry.id === laneId);
          const stationSystems = current.stationSystems.map((system) => system.id === record.id
            ? { ...system, ...edited, ...(lane ? { instanceNo: lane.laneNo } : {}) }
            : system);
          const equipment = current.equipment.map((asset) => asset.parentSystemId === record.id
            ? { ...asset, scope: edited.scope, laneId }
            : asset.parentAssetId && current.equipment.some((cabinet) => cabinet.id === asset.parentAssetId && cabinet.parentSystemId === record.id)
              ? { ...asset, scope: edited.scope }
              : asset);
          return {
            ...current,
            stationSystems,
            equipment: synchronizeGeneratedAssetNos(equipment, stationSystems),
            lanes,
          };
        });
        const placement = getBoqAddCategory({ stationFormat: draft.stationFormat, kind: "system", canonicalItemId: record.canonicalItemId, categoryCode: record.checklistMapping?.[0], scope: edited.scope });
        if (placement.groupId) setActiveRelationshipGroupId(placement.groupId);
      }
      setMessage("บันทึกการแก้ไขในร่างสถานีแล้ว");
      setSelectedRelationshipId(null);
    };
    const updateRelationshipSystemScope = (systemId, scope) => setDraft((current) => {
      const system = current.stationSystems.find((entry) => entry.id === systemId);
      if (!system) return current;
      const lanes = relationshipIsWimSystem(system)
        ? setLaneScope(current.lanes, system.laneId, scope, current.stationSystems)
        : current.lanes;
      const lane = lanes.find((entry) => entry.id === system.laneId);
      const stationSystems = current.stationSystems.map((entry) => entry.id === systemId
        ? { ...entry, scope, ...(lane ? { instanceNo: lane.laneNo } : {}) }
        : entry);
      const cabinetIds = new Set(current.equipment
        .filter((asset) => asset.type === "CONTROL_CABINET" && asset.parentSystemId === systemId)
        .map((asset) => asset.id));
      const equipment = current.equipment.map((asset) => asset.parentSystemId === systemId || cabinetIds.has(asset.parentAssetId)
        ? { ...asset, scope }
        : asset);
      return { ...current, stationSystems, equipment: synchronizeGeneratedAssetNos(equipment, stationSystems), lanes };
    });
    const deleteRelationshipRecord = async (record, kind) => {
      if (!record) return;
      if (kind === "asset") {
        await removeReferenceAsset(record);
        if (selectedRelationshipId === record.id) setSelectedRelationshipId(null);
        return;
      }
      if (relationshipIsWimSystem(record)) {
        const removed = await removeWimParent(record.id);
        if (removed) {
          if (selectedRelationshipId === record.id) setSelectedRelationshipId(null);
          const laneNo = draft.lanes.find((lane) => lane.id === record.laneId)?.laneNo || "—";
          setMessage(`ลบ WIM Sorting System #${record.instanceNo || "—"} ออกจาก Lane ${laneNo} แล้ว · Lane ยังคงอยู่`);
        }
        return;
      }
      const ownerTypes = new Set(canonical.filter((item) => item.kind === "asset" && item.equipmentType && item.systemIds?.includes(record.canonicalItemId)).map((item) => item.equipmentType));
      const scope = String(record.scope || "");
      const related = activeAssets.filter((asset) => ownerTypes.has(asset.type) && String(effectiveAssetScope(asset) || "") === scope);
      if (related.length && requestConfirm) {
        const confirmed = await requestConfirm({ title: "ลบ " + relationshipSystemLabel(record) + " หรือไม่", description: "มีอุปกรณ์ " + related.length + " รายการสัมพันธ์กับ System นี้ อุปกรณ์ที่ไม่มี System เจ้าของอื่นใน Scope เดียวกันจะถูกนำออกจากร่างด้วย", confirmLabel: "ลบ System และรายการที่เกี่ยวข้อง", confirmVariant: "danger-ghost", confirmIcon: "delete" });
        if (!confirmed) return;
      }
      setDraft((current) => {
        const stationSystems = current.stationSystems.filter((system) => system.id !== record.id);
        const equipment = current.equipment.filter((asset) => {
          if (!ownerTypes.has(asset.type) || String(effectiveAssetScope(asset) || "") !== scope) return true;
          const item = canonical.find((entry) => entry.kind === "asset" && entry.equipmentType === asset.type);
          return (item?.systemIds || []).some((ownerId) => stationSystems.some((system) => system.active !== false && system.canonicalItemId === ownerId && String(system.scope || "") === scope));
        });
        return { ...current, stationSystems, equipment };
      });
      setSelectedRelationshipId(null);
      setMessage("ลบ System ออกจากร่างสถานีแล้ว");
    };
    const addLaneForGroup = (groupCode) => {
      const normalizedGroupCode = String(groupCode || "").replace(/^(SC|IMPS)-/i, "");
      return addLane(draft.stationFormat === "IMPS" ? "ImPS" : normalizedGroupCode === "04" ? "Low Speed" : "High Speed");
    };
    const startLaneEdit = (laneId) => {
      const lane = draft.lanes.find((entry) => entry.id === laneId);
      if (!lane) return;
      const parent = wimInstances.find((system) => system.laneId === laneId);
      setEditingLaneId(laneId);
      setLaneEditDraft({ ...lane, scope: lane.scope || parent?.scope || (draft.stationFormat === "IMPS" ? "ImPS" : "High Speed") });
    };
    const saveLaneEdit = () => {
      if (!laneEditDraft) return;
      const laneId = editingLaneId;
      const parent = wimInstances.find((system) => system.laneId === laneId);
      setDraft((current) => {
        const scopedLanes = setLaneScope(current.lanes, laneId, laneEditDraft.scope, current.stationSystems)
          .map((lane) => lane.id === laneId ? { ...lane, label: laneEditDraft.label, direction: laneEditDraft.direction } : lane);
        const scopedLane = scopedLanes.find((lane) => lane.id === laneId);
        const stationSystems = parent ? current.stationSystems.map((system) => system.id === parent.id
          ? { ...system, scope: laneEditDraft.scope, ...(scopedLane ? { instanceNo: scopedLane.laneNo } : {}) }
          : system) : current.stationSystems;
        const equipment = parent ? current.equipment.map((asset) => asset.parentSystemId === parent.id ? { ...asset, scope: laneEditDraft.scope } : asset) : current.equipment;
        return {
          ...current,
          lanes: scopedLanes,
          stationSystems,
          equipment: synchronizeGeneratedAssetNos(equipment, stationSystems),
        };
      });
      setEditingLaneId(null);
      setLaneEditDraft(null);
      setMessage("บันทึกข้อมูล Lane ในร่างสถานีแล้ว");
    };
    const deleteLaneFromRegister = async (laneId) => {
      const lane = draft.lanes.find((entry) => entry.id === laneId);
      if (!lane) return;
      const parents = draft.stationSystems.filter((system) => system.canonicalItemId === WIM_ID && system.laneId === laneId);
      const parentIds = new Set(parents.map((system) => system.id));
      const children = draft.equipment.filter((asset) => asset.laneId === laneId || parentIds.has(asset.parentSystemId));
      if ((parents.length || children.length) && requestConfirm) {
        const confirmed = await requestConfirm({ title: "ลบ Lane " + lane.laneNo + " หรือไม่", description: "Lane นี้มี WIM Sorting System " + parents.length + " ระบบ และอุปกรณ์ที่ผูกอยู่ " + children.length + " รายการ ข้อมูลเหล่านี้จะถูกนำออกจากร่างสถานีด้วย", confirmLabel: "ลบ Lane และรายการที่เกี่ยวข้อง", confirmVariant: "danger-ghost", confirmIcon: "delete" });
        if (!confirmed) return;
      }
      removeWimLane(laneId);
      setEditingLaneId(null);
      setLaneEditDraft(null);
      setMessage(`ลบ Lane ${lane.laneNo} พร้อมรายการ WIM ที่ผูกไว้จากร่างแล้ว`);
    };
    const renderInlineRelationshipEditor = (record, kind, contextScope = "") => {
      if (selectedRelationshipId !== record.id || selectedRelationshipKind !== kind) return null;
      const item = kind === "asset" ? canonical.find((entry) => entry.kind === "asset" && entry.equipmentType === record.type) : systemDefinitions.find((entry) => entry.id === record.canonicalItemId);
      const parent = relationshipParentForAsset(record);
      const formatScopeChoices = (item?.allowedScopes || []).filter((scope) => draft.stationFormat === "IMPS" ? !["High Speed", "Low Speed"].includes(scope) : !["ImPS", "Image Processing"].includes(scope));
      const scopeChoices = contextScope ? formatScopeChoices.filter((scope) => String(scope) === String(contextScope)) : formatScopeChoices;
      const parentScope = String(contextScope || effectiveAssetScope(record) || parent?.scope || "").trim();
      const ownerSystemIds = Array.isArray(item?.systemIds) ? item.systemIds : [];
      const ownerSystemOptions = kind === "asset" && ownerSystemIds.length && !relationshipIsWimEquipment(record) && !isWimElectronicsSubEquipmentType(record.type)
        ? draft.stationSystems.filter((system) => system.active !== false
          && ownerSystemIds.includes(system.canonicalItemId || system.systemId)
          && (!contextScope || String(system.scope || "") === String(contextScope)))
        : [];
      const wimParentOptions = kind === "asset" && relationshipIsWimEquipment(record)
        ? wimInstances.filter((system) => system.active !== false
          && (!parentScope || String(system.scope || "") === parentScope)
          && draft.lanes.some((lane) => lane.id === system.laneId && lane.active !== false))
          .map((system) => ({
            id: system.id,
            laneId: system.laneId,
            scope: system.scope,
            laneLabel: `Lane ${draft.lanes.find((lane) => lane.id === system.laneId)?.laneNo || "—"}`,
            label: `WIM Sorting System #${system.instanceNo || "?"} · Lane ${draft.lanes.find((lane) => lane.id === system.laneId)?.laneNo || "—"} · ${system.scope || "ไม่ระบุ Scope"}`,
          }))
        : [];
      const cabinetOptions = kind === "asset" && isWimElectronicsSubEquipmentType(record.type)
        ? draft.equipment.filter((asset) => asset.type === "CONTROL_CABINET" && asset.active !== false
          && (!contextScope || !asset.scope || String(asset.scope) === String(contextScope)))
        : [];
      const electronicsSystemOptions = kind === "asset" && isWimElectronicsSubEquipmentType(record.type)
        ? draft.stationSystems.filter((system) => system.active !== false
          && system.canonicalItemId === "wim-electronics-system"
          && (!parentScope || String(system.scope || "") === parentScope))
        : [];
      const laneOptions = kind === "system" && relationshipIsWimSystem(record) ? draft.lanes.filter((lane) => {
        const otherParent = wimInstances.find((system) => system.id !== record.id && system.laneId === lane.id);
        const scope = lane.scope || wimInstances.find((system) => system.laneId === lane.id)?.scope || record.scope;
        return !otherParent && String(scope || "") === String(contextScope || record.scope || "");
      }) : [];
      if (kind === "system" && relationshipIsWimSystem(record) && !laneOptions.some((lane) => lane.id === record.laneId)) {
        const currentLane = draft.lanes.find((lane) => lane.id === record.laneId);
        if (currentLane) laneOptions.unshift(currentLane);
      }
      const relationshipText = kind === "asset" && relationshipIsWimEquipment(record) ? (parent ? relationshipSystemLabel(parent) + " · Lane " + (draft.lanes.find((lane) => lane.id === parent.laneId)?.laneNo || "?") : "ยังไม่ผูกระบบแม่") : "";
      return <StationRelationshipInlineEditor record={record} kind={kind} label={kind === "asset" ? relationshipAssetLabel(record) : relationshipSystemLabel(record)} scopeChoices={scopeChoices} laneOptions={laneOptions} wimParentOptions={wimParentOptions} ownerSystemOptions={ownerSystemOptions} ownerSystemRequired={Boolean(ownerSystemIds.length && !relationshipIsWimEquipment(record) && !isWimElectronicsSubEquipmentType(record.type))} cabinetOptions={cabinetOptions} electronicsSystemOptions={electronicsSystemOptions} contextScope={contextScope} relationshipText={relationshipText} error={kind === "asset" ? assetError(record) : ""} showSerialReason={kind === "asset"} showSystemDetails={kind === "system"} saveHint="บันทึกการแก้ไขนี้ไว้ในร่างสถานี" onSave={(edited) => saveRelationshipRecord(record, kind, edited, contextScope)} onCancel={() => setSelectedRelationshipId(null)} />;
    };
    const renderLaneEditor = (lane) => {
      if (!laneEditDraft || editingLaneId !== lane.id) return null;
      const scopeChoices = draft.stationFormat === "IMPS" ? ["ImPS"] : ["High Speed", "Low Speed"];
      return <div className="sc-lane-inline-editor"><label className="ops-field"><span>ชื่อ Lane</span><input value={laneEditDraft.label || ""} onChange={(event) => setLaneEditDraft((current) => ({ ...current, label: event.target.value }))} /></label><label className="ops-field"><span>ทิศทาง</span><input value={laneEditDraft.direction || ""} onChange={(event) => setLaneEditDraft((current) => ({ ...current, direction: event.target.value }))} /></label><label className="ops-field"><span>ขอบเขต WIM</span><select value={laneEditDraft.scope || scopeChoices[0]} onChange={(event) => setLaneEditDraft((current) => ({ ...current, scope: event.target.value }))}>{scopeChoices.map((scope) => <option key={scope} value={scope}>{scope}</option>)}</select></label><div className="sc-lane-inline-actions"><Button variant="secondary" onClick={saveLaneEdit}>บันทึก</Button><Button variant="ghost" onClick={() => { setEditingLaneId(null); setLaneEditDraft(null); }}>ยกเลิก</Button></div></div>;
    };
    const selectedRelationshipAsset = selectedRelationshipKind === "asset" ? draft.equipment.find((asset) => asset.id === selectedRelationshipId) : null;
    const selectedRelationshipSystem = selectedRelationshipKind === "system" ? draft.stationSystems.find((system) => system.id === selectedRelationshipId) : null;
    const renderDraftRelationshipEditor = () => {
      if (!selectedRelationshipAsset && !selectedRelationshipSystem) return null;
      if (selectedRelationshipAsset) {
        const asset = selectedRelationshipAsset;
        const error = assetError(asset);
        const parent = relationshipParentForAsset(asset);
        return <section className="ops-draft-relationship-editor" aria-label={`แก้ไข ${relationshipAssetLabel(asset)}`}><header><div><p className="ops-eyebrow">SELECTED ASSET</p><h3>{relationshipAssetLabel(asset)}</h3><small>{getRelationshipPath({ format: draft.stationFormat, groupCode: relationshipTree.find((group) => group.categories.some((category) => category.assets.some((entry) => entry.id === asset.id)))?.code, categoryId: getRelationshipCategoryForAsset(asset, parent), kind: "asset" })}{parent ? ` · ${relationshipSystemLabel(parent)}` : ""}</small></div><button type="button" className="ops-wim-icon-button" onClick={() => setSelectedRelationshipId(null)} aria-label="ปิดรายละเอียดอุปกรณ์"><Icon name="close" size="small" /></button></header><div className="ops-draft-relationship-editor-grid"><label className="ops-field"><span>Asset No. <em>(จำเป็น)</em></span><input value={asset.assetNo || ""} aria-invalid={Boolean(error)} onChange={(event) => updateAsset(asset.id, "assetNo", event.target.value)} />{error && <small className="ops-field-error" role="alert">{error}</small>}</label><label className="ops-field"><span>ตำแหน่งติดตั้ง</span><input value={asset.location || ""} onChange={(event) => updateAsset(asset.id, "location", event.target.value)} /></label><label className="ops-field"><span>Serial Number</span><input value={asset.serialNo || ""} onChange={(event) => updateAsset(asset.id, "serialNo", event.target.value)} /></label><label className="ops-field"><span>สถานะ Serial</span><select value={asset.serialStatus || "unknown"} onChange={(event) => updateAsset(asset.id, "serialStatus", event.target.value)}><option value="unknown">ยังไม่ระบุ</option><option value="present">มี Serial</option><option value="not-available">ไม่มี / อ่านไม่ได้</option></select></label></div>{asset.type === "WIM_SWITCHING_DC" && <fieldset className="ops-serial-fieldset"><legend>Output ของ Switching DC</legend>{OUTPUTS.map((voltage) => <label key={voltage}><input type="checkbox" checked={(asset.outputVoltages || []).includes(voltage)} onChange={() => updateAsset(asset.id, "outputVoltages", (asset.outputVoltages || []).includes(voltage) ? asset.outputVoltages.filter((value) => value !== voltage) : [...(asset.outputVoltages || []), voltage])} />{voltage}VDC</label>)}</fieldset>}<footer><span className={`ops-status-chip ${error ? "is-warning" : "is-ready"}`}>{error ? "ต้องแก้ไข" : "รายการอยู่ในร่างสถานี"}</span><button type="button" className="ops-wim-text-danger" onClick={() => removeReferenceAsset(asset)}><Icon name="delete" size="small" />นำอุปกรณ์ออก</button></footer></section>;
      }
      const system = selectedRelationshipSystem;
      const definition = relationshipSystemDefinitionsById.get(system.canonicalItemId);
      const scopeOptions = definition?.allowedScopes?.filter((scope) => draft.stationFormat === "IMPS" ? !["High Speed", "Low Speed"].includes(scope) : scope !== "ImPS") || [];
      return <section className="ops-draft-relationship-editor" aria-label={`แก้ไข ${relationshipSystemLabel(system)}`}><header><div><p className="ops-eyebrow">SELECTED SYSTEM</p><h3>{relationshipSystemLabel(system)}</h3><small>{getRelationshipPath({ format: draft.stationFormat, groupCode: relationshipTree.find((group) => group.categories.some((category) => category.systems.some((entry) => entry.id === system.id)))?.code, categoryId: getRelationshipCategoryForSystem(system), kind: "system" })}</small></div><button type="button" className="ops-wim-icon-button" onClick={() => setSelectedRelationshipId(null)} aria-label="ปิดรายละเอียดระบบ"><Icon name="close" size="small" /></button></header><div className="ops-draft-relationship-editor-grid">{scopeOptions.length > 1 && <CustomSelect label={`ขอบเขตของ ${relationshipSystemLabel(system)}`} value={system.scope || ""} onChange={(event) => updateRelationshipSystemScope(system.id, event.target.value)}>{scopeOptions.map((scope) => <option key={scope} value={scope}>{scope}</option>)}</CustomSelect>}<div className="ops-info-banner"><Icon name="info" /><span>System จะตรวจการทำงานของระบบ ส่วนอุปกรณ์จริงจะแสดงแยกในหมวด .01 Equipment</span></div></div>{system.canonicalItemId !== WIM_ID && system.canonicalItemId !== "wim-control" && system.canonicalItemId !== "wim-electronics-system" && <footer><span className="ops-status-chip is-ready">System อยู่ในร่างสถานี</span><button type="button" className="ops-wim-text-danger" onClick={() => { if (definition) toggleSystem(definition, system.scope); setSelectedRelationshipId(null); }}><Icon name="delete" size="small" />นำ System ออก</button></footer>}</section>;
    };
    const confirm = (startInspection = false) => {
      setShowErrors(true);
      if (!validation.valid || !readiness.ready) { setMessage("ยังมีข้อมูลที่ต้องแก้ก่อนสร้างสถานี"); return; }
      setSubmitting(true);
      try {
        const profile = createStationProfileFromDraft(draft, state.stationProfiles.length);
        const savedProfile = startInspection
          ? { ...profile, readinessConfirmedAt: new Date().toISOString() }
          : profile;
        update((current) => ({ ...current, stationProfiles: [...current.stationProfiles, savedProfile], activeStationId: savedProfile.id, ui: { ...(current.ui || {}), selectedStationId: savedProfile.id } }), startInspection ? "สร้างสถานีแล้ว กำลังเตรียมรอบตรวจหน้างาน" : "สร้างสถานีแล้ว");
        navigate(startInspection
          ? `#/inspections/new?stationId=${encodeURIComponent(savedProfile.id)}`
          : `#/stations/${encodeURIComponent(savedProfile.id)}`);
      } catch (error) {
        setSubmitting(false);
        setMessage(error?.message || "บันทึกสถานีไม่สำเร็จ ข้อมูลร่างยังอยู่ ลองตรวจสอบแล้วกดใหม่อีกครั้ง");
      }
    };
    const stationDirectionLabel = { inbound: "ขาเข้า", outbound: "ขาออก", both: "สองทิศทาง" }[draft.direction] || "";
    const currentDateLabel = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" }).format(new Date());

    return (
      <section className="ops-page ops-station-wizard">
        {step === 2 ? <header className="ops-station-workspace-header">
          <div className="ops-station-workspace-heading"><div className="ops-station-breadcrumb" aria-label="เส้นทางปัจจุบัน"><span>ทะเบียนสถานี</span><span aria-hidden="true">›</span><strong>{draft.stationCode || "สร้างสถานีใหม่"}</strong><span aria-hidden="true">›</span><strong>{draft.stationFormat === "IMPS" ? "ผัง IMPS เต็มระบบ" : "ผัง SC เต็มระบบ"}</strong></div><h1 id="page-heading" tabIndex="-1">ผังระบบและอุปกรณ์ประจำสถานี</h1><p>เลือกเพิ่มอุปกรณ์จริงตามที่ติดตั้ง แล้วแก้ไขหรือลบได้ตรงในหมวดระบบที่เกี่ยวข้อง</p></div>
          <div className="ops-station-workspace-meta"><span>สถานี <strong>{draft.stationName || "ยังไม่ระบุ"}</strong>{stationDirectionLabel ? ` · ${stationDirectionLabel}` : ""}</span><span>วันที่ {currentDateLabel}</span></div>
        </header> : <><Breadcrumb items={[{ label: "ทะเบียนสถานี", href: "#/stations" }, { label: "สร้างสถานีใหม่" }]} /><header className="ops-page-header">
          <p className="ops-eyebrow">NEW STATION</p><h1 id="page-heading" tabIndex="-1">สร้างสถานีใหม่</h1><p>เลือกชุดระบบที่มีจริง แล้วจัดการหมวด BOQ และ Asset ของระบบนั้นในหน้าเดียวกัน</p>
        </header><ol className="ops-stepper ops-station-stepper" aria-label="ขั้นตอนสร้างสถานี">{STEP_LABELS.map((label, index) => { const actual = index + 1; return <li key={label} className={step === actual ? "is-current" : step > actual ? "is-complete" : ""} aria-current={step === actual ? "step" : undefined}><span>{actual}</span><div><strong>{label}</strong></div></li>; })}</ol></>}
        {message && <div className="ops-warning-panel" role="status"><Icon name="info" /><span>{message}</span></div>}

        {step === 1 && <section className="ops-panel ops-wizard-card"><div className="ops-panel-heading"><h3>ข้อมูลสถานี</h3></div><div className="ops-station-form"><label className="ops-field"><span>รหัสสถานี <em>(จำเป็น)</em></span><input id="draft-station-stationCode" value={draft.stationCode} onChange={(event) => setField("stationCode", event.target.value)} />{showErrors && validation.errors.stationCode && <small className="ops-field-error">{validation.errors.stationCode}</small>}</label><label className="ops-field"><span>ชื่อสถานี <em>(จำเป็น)</em></span><input id="draft-station-stationName" value={draft.stationName} onChange={(event) => setField("stationName", event.target.value)} />{showErrors && validation.errors.stationName && <small className="ops-field-error">{validation.errors.stationName}</small>}</label><label className="ops-field"><span>รูปแบบสถานี</span><CustomSelect label="รูปแบบสถานี" value={draft.stationFormat} onChange={(event) => changeFormat(event.target.value)}>{STATION_FORMATS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</CustomSelect><small className="ops-field-helper"><strong>{formatDefinition.label}</strong> · {formatDefinition.description}</small></label><div className="ops-field" id="draft-station-province"><MasterSelect kind="province" referenceData={state.referenceData} value={draft.provinceId || ""} onChange={setProvince} label="จังหวัด (จำเป็น)" placeholder="ค้นหาและเลือกจังหวัด" />{showErrors && validation.errors.province && <small className="ops-field-error">{validation.errors.province}</small>}</div><label className="ops-field" id="draft-station-direction"><span>ทิศทาง</span><CustomSelect label="ทิศทาง" value={draft.direction} onChange={(event) => setField("direction", event.target.value)}><option value="unspecified">ไม่ระบุ</option><option value="inbound">ขาเข้า</option><option value="outbound">ขาออก</option><option value="both">สองทิศทาง</option></CustomSelect></label></div><details><summary>ตั้งค่า Vehicle API (ถ้าใช้)</summary><VehicleSearchConfigPanel value={draft.vehicleSearchConfig} stationId="new-station-draft" onChange={(value) => setField("vehicleSearchConfig", value)} /></details></section>}

        {step === 2 && <section className="ops-station-equipment-workspace ops-station-new-equipment-layout" aria-label="ระบบและอุปกรณ์">
          <aside className="ops-station-group-rail" aria-label="เลือกกลุ่มระบบสถานี">
            <header className="ops-station-group-rail-heading"><p className="ops-eyebrow">{draft.stationFormat} EQUIPMENT LAYOUT</p><h2>หมวดหลัก</h2><p>เลือกหมวดทางซ้าย เพื่อดู Work Spec ของหมวดนั้นตรงกลาง</p></header>
            <label className="ops-station-group-search"><Icon name="search" size="small" /><input type="search" value={systemSearch} onChange={(event) => updateRelationshipGroupSearch(event.target.value)} placeholder="ค้นหาชื่ออังกฤษหรือไทย" aria-label="ค้นหากลุ่ม ระบบ หรืออุปกรณ์ ด้วยชื่ออังกฤษหรือไทย" /></label>
            <nav className="ops-station-group-list" aria-label="หมวดหลักของสถานี">
              {visibleRelationshipGroups.map((group) => {
                const isCurrentGroup = group.groupId === activeRelationshipGroup?.groupId;
                const hasItems = group.hasData;
                const secondary = relationshipGroupSecondaryLabel(group);
                return <button type="button" key={group.groupId} className={`ops-station-group-item ${isCurrentGroup ? "is-current" : ""}`} aria-current={isCurrentGroup ? "location" : undefined} aria-controls="station-work-spec-panel" onClick={() => setRelationshipGroup(group)}>
                  <span className="ops-station-group-code">{group.groupId}</span>
                  <span className="ops-station-group-copy"><strong>{group.title}</strong>{secondary && <small className="ops-station-group-th">{secondary}</small>}<small className="ops-station-group-count">{relationshipGroupCountLabel(group, true)}</small></span>
                  <span className={`ops-station-group-state ${hasItems ? "is-selected" : "is-empty"}`}><span aria-hidden="true">{hasItems ? "✓" : "○"}</span>{hasItems ? "เลือกแล้ว" : "ยังไม่เลือก"}</span>
                </button>;
              })}
              {!visibleRelationshipGroups.length && <div className="ops-station-group-search-empty" role="status">ไม่พบกลุ่มหรืออุปกรณ์ที่ตรงกับคำค้น</div>}
            </nav>
          </aside>
          <div className="ops-station-equipment-main" id="station-work-spec-panel" role="region" aria-label={activeRelationshipGroup ? `Work Spec ของ ${activeRelationshipGroup.groupId} ${activeRelationshipGroup.title}` : "Work Spec ของหมวดที่เลือก"}>
            <header className="ops-station-equipment-heading"><div><p className="ops-eyebrow">{draft.stationFormat} · สร้างสถานีใหม่ · WORK SPEC</p><h2>{activeRelationshipGroup ? `${activeRelationshipGroup.groupId} · ${activeRelationshipGroup.title}` : "Work Spec ของหมวดที่เลือก"}</h2><p>{activeRelationshipGroup ? relationshipGroupSecondaryLabel(activeRelationshipGroup) : "เลือกหมวดจากทางซ้าย"} · กำหนดระบบและอุปกรณ์ตั้งต้นก่อนบันทึกสถานี</p></div><div className="ops-station-equipment-total"><strong>{activeRelationshipGroup?.assetCount || 0}</strong><span>อุปกรณ์ในร่าง</span><small>{workSpecSystemCountForGroup(activeRelationshipGroup)} ระบบในร่าง</small></div></header>
            <section className="ops-station-work-spec-panel" aria-labelledby="draft-work-spec-title">
              <header className="ops-station-work-spec-heading"><div><p className="ops-eyebrow">SYSTEM CATEGORY · WORK SPEC</p><h3 id="draft-work-spec-title">รายการระบบและอุปกรณ์ของหมวดนี้</h3><p>จัดตามความสัมพันธ์ของระบบและอุปกรณ์ โดยแสดงรหัส BOQ/TOR เป็นข้อมูลอ้างอิงรอง</p></div></header>
              {activeWorkSpecNote && <aside className="ops-work-spec-scope-note" aria-label={`ขอบเขต Work Spec ${activeWorkSpecNote.scope}`}>
                <div className="ops-work-spec-scope-note-heading"><div><p className="ops-eyebrow">WORK SPEC SCOPE</p><h4>{activeWorkSpecNote.title}</h4></div><span>{activeWorkSpecNote.scope}</span></div>
                <p className="ops-work-spec-scope-note-summary">{activeWorkSpecNote.summary}</p>
                <ul className="ops-work-spec-scope-functions">{activeWorkSpecNote.functions.map((entry) => <li key={entry}>{entry}</li>)}</ul>
                <details className="ops-work-spec-scope-references"><summary>เอกสารและข้อมูลงานที่เกี่ยวข้อง</summary><ul>{activeWorkSpecNote.references.map((entry) => <li key={entry}>{entry}</li>)}</ul></details>
                <small className="ops-work-spec-scope-note-footnote">คำอธิบายนี้ช่วยแยกหน้าที่ของ System ในหน้าสร้างสถานี ไม่ใช่ Asset หรือรายการตรวจเพิ่มเติม</small>
              </aside>}
              <p className="ops-station-work-spec-note" role="status">ซ้าย: หมวดสถานี · กลาง: Work Spec ของหมวดที่เลือก · รายการมาตรฐานยังไม่ใช่ Asset จนกด “เพิ่ม”</p>
              <div className="ops-work-spec-list">{activeWorkSpecSections.length ? activeWorkSpecSections.map(renderWorkSpecSection) : <div className="ops-station-workspace-empty"><Icon name="info" /><strong>หมวดนี้ยังไม่มี Work Spec</strong><span>ไม่พบรายการอ้างอิงที่จัดอยู่ใน {activeRelationshipGroup?.groupId || "หมวดนี้"}</span></div>}</div>
            </section>
          </div>
        </section>}
        {step === 3 && <section className={`ops-readiness-panel ${blockingIssues.length ? "has-blockers" : "is-ready"}`} aria-live="polite" aria-labelledby="new-station-readiness-title">
          <header className="ops-readiness-panel-heading"><div><p className="ops-eyebrow">READINESS CHECK</p><h2 id="new-station-readiness-title">{blockingIssues.length ? "ยังไม่พร้อมสร้างสถานี" : "พร้อมสร้างสถานี"}</h2><p>{blockingIssues.length ? `ยังมี ${blockingIssues.length} รายการที่ต้องแก้ก่อนยืนยันสร้างสถานี` : "ข้อมูลขั้นต่ำครบแล้ว สามารถยืนยันสร้าง Station Profile ได้"}</p></div><StatusBadge status={blockingIssues.length ? "waiting" : "normal"}>{blockingIssues.length ? "ต้องแก้ไข" : "พร้อม"}</StatusBadge></header>
          {blockingIssues.length ? <ul className="ops-readiness-blocker-list">{blockingIssues.map((issue, index) => { const copy = issueCopy(issue); return <li key={`${issue.code}-${issue.assetId || issue.systemId || issue.field || index}`}><span className="ops-readiness-blocker-icon"><Icon name="alert" size="small" /></span><span><strong>{copy.label}</strong><small>{copy.message}</small></span><button type="button" className="ops-readiness-fix" onClick={() => resolveIssue(issue)}>แก้ไข <Icon name="arrow" size="small" /></button></li>; })}</ul> : <div className="ops-readiness-success"><Icon name="check" /><span>ข้อมูลสถานี ระบบ และ Asset พร้อมสำหรับการสร้างสถานีแล้ว</span></div>}
          {warningMessages.length > 0 && <details className="ops-readiness-warnings"><summary>ข้อควรตรวจเพิ่มเติม {warningMessages.length} รายการ</summary><ul>{warningMessages.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul></details>}
        </section>}

        <div className={`ops-wizard-actions ${step === 2 ? "ops-reference-actions" : ""}`}><Button href="#/stations" variant={step === 2 ? "secondary" : "ghost"}>ยกเลิก</Button>{step > 1 && step !== 2 && <Button onClick={goBack}>ย้อนกลับ</Button>}{step === 2 ? <span className="ops-reference-summary"><Icon name="list" size="small" /><strong>ระบบ {draft.stationSystems.filter((item) => item.active !== false).length}</strong><i>·</i><strong>อุปกรณ์ {activeAssets.length}</strong></span> : <span className="ops-context-summary">{step === 3 ? (blockingIssues.length ? `ยังมี ${blockingIssues.length} รายการต้องแก้` : "พร้อมสร้างสถานี") : "กรอกข้อมูลสถานี"}</span>}{step < 3 ? <Button onClick={goNext} variant="primary" icon={step === 2 ? "save" : "arrow"}>{step === 2 ? "ตรวจสอบและบันทึก" : "ถัดไป"}</Button> : <div className="ops-page-actions"><Button onClick={() => confirm(false)} variant="secondary" icon="check" disabled={submitting || !validation.valid || !readiness.ready}>ยืนยันสร้างสถานี</Button><Button onClick={() => confirm(true)} variant="primary" icon="arrow" disabled={submitting || !validation.valid || !readiness.ready}>สร้างสถานีและเริ่มตรวจหน้างาน</Button></div>}</div>
      </section>
    );

  };
}
