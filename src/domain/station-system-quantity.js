const WIM_SORTING_SYSTEM_ID = "wim-sorting";

export function getStationSystemQuantity(system) {
  const rawQuantity = Number(system?.quantity ?? 1);
  return Number.isFinite(rawQuantity) ? Math.max(0, Math.floor(rawQuantity)) : 1;
}

export function adjustStationSystemQuantity(systems, systemId, delta) {
  if (!Array.isArray(systems) || !String(systemId || "").trim()) return systems;
  const change = Number(delta);
  if (!Number.isInteger(change) || ![-1, 1].includes(change)) return systems;

  let changed = false;
  const nextSystems = systems.map((system) => {
    if (system?.id !== systemId || system.active === false || system.canonicalItemId === WIM_SORTING_SYSTEM_ID) return system;
    const currentQuantity = getStationSystemQuantity(system);
    const quantity = Math.max(0, currentQuantity + change);
    if (quantity === currentQuantity) return system;
    changed = true;
    return { ...system, quantity };
  });

  return changed ? nextSystems : systems;
}
