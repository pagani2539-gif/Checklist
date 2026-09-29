const HIDDEN_SYSTEM_IDS = new Set(["wim-control", "wim-electronics-system"]);

export function getWorkSpecEquipmentOwnerVariants(item, scope, ownerIds, ownerSystems) {
  const installedOwners = ownerSystems
    .filter((system) => system.active !== false
      && ownerIds.includes(system.canonicalItemId)
      && (!scope || !system.scope || String(system.scope).trim() === String(scope).trim()))
    .map((system) => ({ ...item, variantScope: scope || system.scope, parentId: system.id }));
  if (installedOwners.length) return installedOwners;
  if (!ownerIds.some((ownerId) => HIDDEN_SYSTEM_IDS.has(ownerId))) return [];
  return [scope ? { ...item, variantScope: scope } : item];
}
