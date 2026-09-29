/**
 * Add one catalog Asset to a station draft, creating and linking its owning
 * System in the same state transition when the owner has not been added yet.
 */
export function addStationAssetWithOwner(draft, {
  catalogItem,
  scope = catalogItem?.variantScope || "",
  ownerDefinition = null,
  parentSystemId = catalogItem?.parentId || null,
  parentAssetId = catalogItem?.parentAssetId || null,
} = {}, {
  createId,
  createSystemRecord,
  makeEquipmentFromCatalogItem,
  getNextEquipmentIndex,
} = {}) {
  if (!draft || !catalogItem || typeof createId !== "function"
    || typeof makeEquipmentFromCatalogItem !== "function"
    || typeof getNextEquipmentIndex !== "function") return draft;

  const targetScope = String(scope || "").trim();
  const isOwner = (system) => system.active !== false
    && (system.canonicalItemId || system.systemId) === ownerDefinition?.id
    && String(system.scope || "").trim() === targetScope;
  const explicitParent = parentSystemId
    ? draft.stationSystems.find((system) => system.id === parentSystemId && system.active !== false
      && (!ownerDefinition || isOwner(system)))
    : null;
  const scopedOwner = ownerDefinition ? draft.stationSystems.find(isOwner) : null;
  const parent = explicitParent || scopedOwner || null;
  const createdOwner = !parent && ownerDefinition && typeof createSystemRecord === "function"
    ? createSystemRecord(ownerDefinition, createId, { scope: targetScope })
    : null;
  const resolvedParent = parent || createdOwner;
  const assetScope = String(resolvedParent?.scope || targetScope || "").trim() || null;
  const asset = makeEquipmentFromCatalogItem(
    catalogItem,
    getNextEquipmentIndex(draft.equipment, { type: catalogItem.type, prefix: catalogItem.prefix, scope: assetScope }),
    {
      id: createId("asset"),
      assetNoMode: "generated",
      location: "",
      parentSystemId: resolvedParent?.id || null,
      parentAssetId: parentAssetId || null,
      laneId: resolvedParent?.laneId || null,
      scope: assetScope,
    },
  );
  if (!asset) return draft;

  return {
    ...draft,
    stationSystems: createdOwner ? [...draft.stationSystems, createdOwner] : draft.stationSystems,
    equipment: [...draft.equipment, asset],
  };
}
