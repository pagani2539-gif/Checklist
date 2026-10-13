import { isWimElectronicsSubEquipmentType } from "./wim-electronics.js";
import { normalizeWorkpointScope } from "./station-workpoint-layout.js";

export function getEffectiveEquipmentScope(asset, equipment = [], systems = [], visited = new Set()) {
  if (!asset || visited.has(asset.id)) return "";
  visited.add(asset.id);
  const system = systems.find((entry) => entry.id === asset.parentSystemId);
  if (system?.scope) return String(system.scope).trim();
  const cabinet = equipment.find((entry) => entry.id === asset.parentAssetId);
  return (cabinet && getEffectiveEquipmentScope(cabinet, equipment, systems, visited)) || String(asset.scope || "").trim();
}

export function getEquipmentParentChoices(draft, { type, systemIds = [], scope = "", parentId = "", parentAssetId = "" }) {
  const scopeKey = normalizeWorkpointScope(scope) || String(scope).trim().toLowerCase();
  const matchesScope = (value) => !scopeKey || (normalizeWorkpointScope(value) || String(value || "").trim().toLowerCase()) === scopeKey;
  const systems = (draft.stationSystems || []).filter((system) => system.active !== false && Number(system.quantity ?? 1) > 0
    && systemIds.includes(system.canonicalItemId || system.systemId)
    && matchesScope(system.scope) && (!parentId || system.id === parentId));
  if (isWimElectronicsSubEquipmentType(type)) {
    return (draft.equipment || []).filter((cabinet) => cabinet.active !== false && cabinet.type === "CONTROL_CABINET"
      && (!parentAssetId || cabinet.id === parentAssetId)).flatMap((cabinet) => {
      const system = systems.find((entry) => entry.id === cabinet.parentSystemId);
      return system ? [{ id: cabinet.id, system, cabinet }] : [];
    });
  }
  return systems.filter((system) => !["WIM_SENSOR", "WIM_LOOP"].includes(type)
    || (draft.lanes || []).some((lane) => lane.active !== false && lane.id === system.laneId))
    .map((system) => ({ id: system.id, system, cabinet: null }));
}
