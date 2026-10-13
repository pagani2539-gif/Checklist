import { getItemsForSnapshot, emptyItem, getEvidenceCatalogForSnapshot } from './master-checklist.js';

// Explicit, additive upgrade of an open round. Historical rounds stay frozen.
export function addThreeDCleaningToOpenRound(round) {
  if (round?.status !== 'draft' || round?.closedAt) throw new Error('Only an open draft round can receive 3D cleaning');
  const next = structuredClone(round);
  next.snapshot.threeDCleaningVersion = '3d-cleaning-v1';
  const items = getItemsForSnapshot(next.snapshot).filter(item => item.isEquipmentCleaning
    && ['LASER_SCANNER', 'DIMENSION_CONTROLLER'].includes(item.cleaningAssetType));
  const itemIds = new Set(items.map(item => item.id));
  const catalog = getEvidenceCatalogForSnapshot(next.snapshot).filter(slot => itemIds.has(slot.itemId));
  const existingSlots = new Set((next.snapshot.evidenceCatalog || []).map(slot => slot.slotId));
  next.snapshot.evidenceCatalog = [...(next.snapshot.evidenceCatalog || []), ...catalog.filter(slot => !existingSlots.has(slot.slotId))];
  next.inspectionItems ||= {};
  for (const item of items) next.inspectionItems[item.id] ??= emptyItem(item);
  return { round: next, items };
}
