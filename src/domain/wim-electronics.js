import { getCentralEquipmentName } from "./equipment-names.js";

export const WIM_ELECTRONICS_SYSTEM_ID = "wim-electronics";
export const WIM_ELECTRONICS_GROUP_CODE = "2.3";
export const WIM_ELECTRONICS_OUTPUT_VOLTAGES = Object.freeze([12, 24, 48]);

const subEquipment = (value, sourceLabel, prefix, role, extra = {}) => ({
  value,
  label: getCentralEquipmentName(value)?.nameTh || value,
  nameTh: getCentralEquipmentName(value)?.nameTh || value,
  nameEn: getCentralEquipmentName(value)?.nameEn || sourceLabel,
  sourceLabel,
  prefix,
  groupCode: WIM_ELECTRONICS_GROUP_CODE,
  systemId: "wim",
  sourceRefs: [WIM_ELECTRONICS_GROUP_CODE],
  role,
  ...extra,
});

export const WIM_ELECTRONICS_SUB_EQUIPMENT_TYPES = Object.freeze([
  subEquipment("WIM_AC_DC_POWER_SUPPLY", "AC/DC POWER SUPPLY", "ACDC", "power-supply"),
  subEquipment("WIM_NETWORK_EQUIPMENT", "NETWORK EQUIPMENT", "NET", "network"),
  subEquipment("WIM_CONTROLLER", "WIM CONTROLLER", "WIMCTRL", "controller"),
  subEquipment("WIM_PHASE_PROTECTION", "PHASE PROTECTION", "PHASE", "protection"),
  subEquipment("WIM_SUB_BREAKER", "SUB BREAKER", "BRK", "protection"),
  subEquipment("WIM_SWITCHING_DC", "SWITCHING DC POWER SUPPLY", "SWDC", "switching-dc", { outputVoltageOptions: WIM_ELECTRONICS_OUTPUT_VOLTAGES }),
  subEquipment("WIM_TRANSFORMER_24VAC", "TRANSFORMER AC 24VAC", "TR24", "transformer"),
]);

const TYPE_MAP = new Map(WIM_ELECTRONICS_SUB_EQUIPMENT_TYPES.map((definition) => [definition.value, definition]));

export function getWimElectronicsSubEquipmentType(type) {
  return TYPE_MAP.get(type) || null;
}

export function isWimElectronicsSubEquipmentType(type) {
  return TYPE_MAP.has(type);
}

function canonicalSystemId(system = {}) {
  const explicit = String(system.canonicalItemId || "").trim();
  if (explicit) return explicit;
  if (system.systemId === "wim" && system.componentId === "electronics") return "wim-electronics-system";
  return String(system.systemId || "").trim();
}

function scopesMatch(left, right) {
  const normalize = (value) => String(value || "").trim().toLowerCase();
  const wildcard = (value) => ["", "station-wide", "station", "all", "all-scopes", "ทุกขอบเขต", "ทั้งหมด"].includes(normalize(value));
  return wildcard(left) || wildcard(right) || normalize(left) === normalize(right);
}

export function getWimElectronicsHierarchyIssue(asset, equipment = [], systems = []) {
  if (!asset || (asset.type !== "CONTROL_CABINET" && !isWimElectronicsSubEquipmentType(asset.type))) return null;
  const children = Array.isArray(equipment) ? equipment : [];
  const activeSystems = (Array.isArray(systems) ? systems : []).filter((system) => system?.active !== false && Number(system?.quantity ?? 1) > 0);
  const parentCabinet = asset.type === "CONTROL_CABINET"
    ? asset
    : children.find((entry) => String(entry?.id || "") === String(asset.parentAssetId || ""));
  if (asset.type !== "CONTROL_CABINET" && (!parentCabinet || parentCabinet.type !== "CONTROL_CABINET" || parentCabinet.active === false)) {
    return { code: "WIM_ELECTRONICS_PARENT_CABINET_REQUIRED", message: "WIM Electronics ต้องผูกกับ Cabinet ที่ติดตั้งจริง" };
  }
  const recordsToCheck = asset.type === "CONTROL_CABINET" ? [asset] : [parentCabinet, asset];
  const hasOwningSystem = (record) => activeSystems.some((system) => canonicalSystemId(system) === "wim-electronics-system"
    && (!record?.parentSystemId || String(record.parentSystemId) === String(system.id))
    && scopesMatch(record?.scope, system?.scope));
  if (recordsToCheck.some((record) => !hasOwningSystem(record))) {
    return { code: "WIM_ELECTRONICS_SYSTEM_REQUIRED", message: "ผูก Cabinet และอุปกรณ์กับ WIM Electronics System ในขอบเขตเดียวกัน" };
  }
  return null;
}

export function normalizeWimElectronicsOutputVoltages(value) {
  const values = Array.isArray(value) ? value : [];
  return [...new Set(values
    .map((entry) => Number(entry))
    .filter((entry) => WIM_ELECTRONICS_OUTPUT_VOLTAGES.includes(entry)))].sort((left, right) => left - right);
}

export function isWimElectronicsOutputAsset(equipment) {
  return equipment?.type === "WIM_SWITCHING_DC";
}
