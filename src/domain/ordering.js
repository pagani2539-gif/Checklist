export const EQUIPMENT_ORDER_VERSION = "lane-type-asset-v1";

const WIM_TYPE_ORDER = Object.freeze({
  WIM_SENSOR: 0,
  WIM_LOOP: 1,
});

const EQUIPMENT_TYPE_ORDER = Object.freeze({
  WIM_SENSOR: 0,
  WIM_LOOP: 1,
  CONTROL_COMPUTER: 2,
  CONTROL_CABINET: 3,
  WIM_AC_DC_POWER_SUPPLY: 4,
  WIM_NETWORK_EQUIPMENT: 5,
  WIM_CONTROLLER: 6,
  WIM_PHASE_PROTECTION: 7,
  WIM_SUB_BREAKER: 8,
  WIM_SWITCHING_DC: 9,
  WIM_TRANSFORMER_24VAC: 10,
  LPR_CONTROL_SYSTEM: 11,
  LPR_CAMERA: 12,
  FIXED_CAMERA: 13,
  PTZ_CAMERA: 14,
  NVR: 15,
  DATABASE_SERVER: 16,
  IMPS_DISPLAY_PROCESSING: 17,
  VMS_SIGN: 18,
  VMS_LIGHT_SENSOR: 19,
  VMS_DISPLAY: 20,
  CUSTOM: 99,
});

function asText(value) {
  return String(value ?? "").trim();
}

function categoryOrder(value) {
  const parts = asText(value).split(".");
  if (!parts.length || parts.some((part) => !/^\d+$/.test(part))) return Number.MAX_SAFE_INTEGER;
  // Station TOR codes such as 1.1.5 and 1.1.11 are hierarchical. Encode
  // every segment at a fixed width so they sort before Checklist 2.x rather
  // than falling to the unknown-category bucket.
  const [major = 0, minor = 0, detail = 0, subdetail = 0] = parts.map(Number);
  return major * 1_000_000_000 + minor * 1_000_000 + detail * 1_000 + subdetail;
}

function typeOrder(value) {
  return EQUIPMENT_TYPE_ORDER[asText(value)] ?? Number.MAX_SAFE_INTEGER;
}

function laneNumber(item, laneById) {
  const lane = laneById.get(item?.laneId);
  const value = Number(lane?.laneNo);
  return Number.isFinite(value) && value > 0 ? value : Number.MAX_SAFE_INTEGER;
}

function isWim(item) {
  return item?.type === "WIM_SENSOR" || item?.type === "WIM_LOOP";
}

/**
 * Compare Asset No. values without making SENSOR-10 sort before SENSOR-2.
 * Values without a trailing number still get a deterministic text order.
 */
export function compareNaturalAssetNo(left, right) {
  const leftText = asText(left).toUpperCase();
  const rightText = asText(right).toUpperCase();
  if (!leftText && !rightText) return 0;
  if (!leftText) return 1;
  if (!rightText) return -1;

  const leftMatch = leftText.match(/^(.*?)(\d+)$/);
  const rightMatch = rightText.match(/^(.*?)(\d+)$/);
  if (leftMatch && rightMatch) {
    const prefixOrder = leftMatch[1].localeCompare(rightMatch[1], undefined, { sensitivity: "base" });
    if (prefixOrder !== 0) return prefixOrder;
    const numberOrder = Number(leftMatch[2]) - Number(rightMatch[2]);
    if (numberOrder !== 0) return numberOrder;
    return leftMatch[2].length - rightMatch[2].length;
  }

  return leftText.localeCompare(rightText, undefined, { numeric: true, sensitivity: "base" });
}

function compareWimEntries(left, right, laneById) {
  const laneOrder = laneNumber(left.item, laneById) - laneNumber(right.item, laneById);
  if (laneOrder !== 0) return laneOrder;

  const leftTypeOrder = WIM_TYPE_ORDER[left.item?.type] ?? Number.MAX_SAFE_INTEGER;
  const rightTypeOrder = WIM_TYPE_ORDER[right.item?.type] ?? Number.MAX_SAFE_INTEGER;
  if (leftTypeOrder !== rightTypeOrder) return leftTypeOrder - rightTypeOrder;

  const assetOrder = compareNaturalAssetNo(left.item?.assetNo, right.item?.assetNo);
  return assetOrder !== 0 ? assetOrder : left.index - right.index;
}

/**
 * Return a new array ordered for the operational WIM assignment flow.
 * The input array and its objects are never mutated.
 */
export function sortWimEquipment(equipment = [], lanes = []) {
  const laneById = new Map((Array.isArray(lanes) ? lanes : []).map((lane) => [lane?.id, lane]));
  return (Array.isArray(equipment) ? equipment : [])
    .map((item, index) => ({ item, index }))
    .sort((left, right) => compareWimEntries(left, right, laneById))
    .map(({ item }) => item);
}

/**
 * Return a new array ordered for mixed station/equipment views.
 * WIM entries use Lane → type → Asset No.; other entries use BOQ category →
 * equipment type → Asset No. Existing order is the final stable tie-breaker.
 */
export function sortEquipmentForDisplay(equipment = [], lanes = []) {
  const laneById = new Map((Array.isArray(lanes) ? lanes : []).map((lane) => [lane?.id, lane]));
  return (Array.isArray(equipment) ? equipment : [])
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const bothWim = isWim(left.item) && isWim(right.item);
      if (bothWim) return compareWimEntries(left, right, laneById);

      const categoryOrderDelta = categoryOrder(left.item?.categoryCode) - categoryOrder(right.item?.categoryCode);
      if (categoryOrderDelta !== 0) return categoryOrderDelta;

      const typeOrderDelta = typeOrder(left.item?.type) - typeOrder(right.item?.type);
      if (typeOrderDelta !== 0) return typeOrderDelta;

      const assetOrder = compareNaturalAssetNo(left.item?.assetNo, right.item?.assetNo);
      return assetOrder !== 0 ? assetOrder : left.index - right.index;
    })
    .map(({ item }) => item);
}
