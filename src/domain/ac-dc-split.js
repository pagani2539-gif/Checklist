import { getItemsForSnapshot, buildItemState } from './master-checklist.js';
import { getEvidenceCatalogForSnapshot } from './evidence-checklist.js';

export const AC_DC_SPLIT_VERSION = 'separate-ac-dc-v1';
// AC and DC are the existing Transformer and Switching records, not new assets.
export const SEPARATE_POWER_SUPPLY_TYPES = ['WIM_TRANSFORMER_24VAC', 'WIM_SWITCHING_DC'];
const clone = value => JSON.parse(JSON.stringify(value));
const isCombined = asset => asset?.active !== false && asset?.type === 'WIM_AC_DC_POWER_SUPPLY';

function splitEquipment(equipment = []) {
  const combined = equipment.filter(isCombined);
  if (!combined.length) return { equipment, links: [], originals: [] };
  const next = [...equipment];
  const links = [];
  const originals = [];
  const unmatched = [];
  for (const original of combined) {
    // Retire every legacy combined record. Link it only when both existing
    // devices are unambiguous in the same cabinet and system; never invent assets.
    originals.push(clone(original));
    next[equipment.indexOf(original)] = { ...original, active: false, acDcSplitVersion: AC_DC_SPLIT_VERSION };
    const matches = original.parentAssetId
      ? SEPARATE_POWER_SUPPLY_TYPES.map(type => equipment.filter(asset => asset.active !== false
        && asset.type === type && asset.parentAssetId === original.parentAssetId
        && asset.parentSystemId === original.parentSystemId))
      : [];
    if (matches.length === 2 && matches.every(records => records.length === 1)) {
      links.push({ originalAssetId: original.id, assetIds: matches.map(records => records[0].id) });
      continue;
    }
    const missingTypes = SEPARATE_POWER_SUPPLY_TYPES.filter((_, index) => matches[index]?.length !== 1);
    unmatched.push({ originalAssetId: original.id, assetNo: original.assetNo || '',
      reason: !original.parentAssetId ? 'missing-cabinet-link' : 'separate-device-not-unambiguous', missingTypes });
  }
  return { equipment: next, links, originals, unmatched };
}

export function splitAcDcRound(round, migratedAt) {
  // A historical record, including its Snapshot, must remain byte-for-byte unchanged.
  if (!round?.snapshot || round.status === 'closed' || round.closedAt || round.archivedAt) return round;
  const split = splitEquipment(round.snapshot.equipment);
  if (!split.originals.length) return round;
  const ids = new Set(split.originals.map(asset => asset.id));
  const originalItems = getItemsForSnapshot(round.snapshot, round.templateVersion);
  const entries = originalItems.filter(item => ids.has(item.assetId)).map(item => ({
    item: clone(item), value: clone(round.inspectionItems?.[item.id] || {}),
  }));
  const snapshot = { ...round.snapshot, equipment: split.equipment.filter(asset => asset.active !== false),
    acDcSplitVersion: AC_DC_SPLIT_VERSION,
    acDcSplitLinks: [...(round.snapshot.acDcSplitLinks || []), ...split.links] };
  // Retain existing requirements; only the newly separated assets get new ids.
  snapshot.evidenceCatalog = getEvidenceCatalogForSnapshot({ ...snapshot, evidenceCatalog: undefined });
  const items = getItemsForSnapshot(snapshot, round.templateVersion);
  // Existing AC/DC equipment keeps its own recorded results and evidence.
  // Additional points have new ids and therefore start pending.
  const inspectionItems = buildItemState(items, round.inspectionItems || {});
  for (const item of items) if (Object.hasOwn(round.inspectionItems || {}, item.id)) {
    inspectionItems[item.id] = clone(round.inspectionItems[item.id]);
  }
  return { ...round, snapshot, inspectionItems, acDcSplitArchive: {
    version: AC_DC_SPLIT_VERSION, migratedAt,
    assets: [...(round.acDcSplitArchive?.assets || []), ...split.originals],
    links: [...(round.acDcSplitArchive?.links || []), ...split.links],
    unmatched: [...(round.acDcSplitArchive?.unmatched || []), ...split.unmatched],
    entries: [...(round.acDcSplitArchive?.entries || []), ...entries],
    // Preserve any old result not represented by the loaded recipe as well.
    originalInspectionItems: { ...(round.acDcSplitArchive?.originalInspectionItems || {}), ...(round.inspectionItems || {}) },
  } };
}

export function splitAcDcState(state, { migratedAt = new Date().toISOString() } = {}) {
  const profiles = (state.stationProfiles || []).map(profile => {
    const split = splitEquipment(profile.equipment);
    return split.originals.length ? { ...profile, equipment: split.equipment, acDcSplitVersion: AC_DC_SPLIT_VERSION,
      acDcSplitArchive: { version: AC_DC_SPLIT_VERSION, migratedAt,
        assets: [...(profile.acDcSplitArchive?.assets || []), ...split.originals],
        links: [...(profile.acDcSplitArchive?.links || []), ...split.links],
        unmatched: [...(profile.acDcSplitArchive?.unmatched || []), ...split.unmatched] } } : profile;
  });
  const rounds = (state.inspectionRounds || []).map(round => splitAcDcRound(round, migratedAt));
  const byId = new Map(rounds.map(round => [round.id, round]));
  const aliases = records => (records || []).map(record => {
    if (record.status === 'closed' || record.closedAt || record.archivedAt) return record;
    const round = byId.get(record.id);
    if (!round || !round.acDcSplitArchive) return record;
    return { ...record, snapshot: round.snapshot, inspectionItems: round.inspectionItems,
      ...(Object.hasOwn(record, 'inspectionSnapshot') ? { inspectionSnapshot: round.snapshot } : {}),
      ...(Object.hasOwn(record, 'items') ? { items: round.inspectionItems } : {}),
      acDcSplitArchive: round.acDcSplitArchive };
  });
  const changed = profiles.some((profile, index) => profile !== state.stationProfiles[index])
    || rounds.some((round, index) => round !== state.inspectionRounds[index]);
  if (!changed) return state;
  const active = byId.get(state.activeRoundId);
  return { ...state, acDcSplitVersion: AC_DC_SPLIT_VERSION, stationProfiles: profiles, inspectionRounds: rounds,
    ...(state.inspectionWorkspaces ? { inspectionWorkspaces: aliases(state.inspectionWorkspaces) } : {}),
    ...(active?.acDcSplitArchive ? { inspectionSnapshot: active.snapshot, items: active.inspectionItems } : {}) };
}
