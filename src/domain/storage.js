import {
  ASSET_NO_SCOPE_VERSION,
  createDefaultStationProfile,
  createSnapshot,
  defaultMeta,
  normalizeRound,
  normalizeStationProfile,
  migrateChecklistCopyForCurrentTemplate,
  createMasterChecklistCopySnapshot,
  normalizeMasterChecklistCopy,
  normalizeItemCatalog,
  VIDEO_EVIDENCE_PURGE_VERSION,
  VIDEO_EVIDENCE_ITEM_IDS,
  VIDEO_EVIDENCE_SLOT_IDS,
} from "./master-checklist.js";
import { normalizeVehicleReviewState, normalizeVehicleSearchState, isVehicleReviewScopeState } from "./vehicle-search.js";
import { normalizeContractWorkspaceState } from "./contracts.js";
import { normalizeStationInspectionReports } from "./station-inspection-reports.js";

export const STORAGE_KEY = "checklist-mvp-v1";
export const CURRENT_STATE_VERSION = 18;
export const IMPS_PURGE_VERSION = "imps-data-purge-v1";

function normalizeRoundVehicleSearchForStorage(round) {
  const snapshot = round?.snapshot || {};
  const options = { baseUrl: snapshot?.vehicleSearchConfig?.baseUrl, apiProfile: snapshot?.vehicleSearchConfig?.apiProfile };
  const fallback = { dateFrom: round?.meta?.inspectionDate, dateTo: round?.meta?.inspectionDate, stationCode: snapshot?.stationCode };
  const vehicleSearch = round?.vehicleSearch;
  return snapshot?.vehicleReviewScopeVersion && isVehicleReviewScopeState(vehicleSearch)
    ? normalizeVehicleReviewState(vehicleSearch, fallback, options)
    : normalizeVehicleSearchState(vehicleSearch, fallback, options);
}

export function createEmptyChecklistState() {
  return migrateChecklistState({
    stationProfiles: [],
    inspectionRounds: [],
    inspectionHistory: [],
    inspectionWorkspaces: [],
    itemCatalog: [],
    regions: [],
    referenceData: { provinces: [], contractors: [], agencies: [] },
    contracts: [],
    workPackages: [],
    contractStationAssignments: [],
    contractWorkReports: [],
    contractAgreementCovers: [],
    inspectionRoundContextLinks: [],
    stationInspectionReports: [],
  });
}

export function normalizeServerChecklistState(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  return Object.keys(source).length ? migrateChecklistState(source) : createEmptyChecklistState();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function safeRead() {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function snapshotFromHistory(entry) {
  return entry?.stationSnapshot || entry?.snapshot || entry?.inspectionSnapshot || null;
}

function stationIdForRecord(record) {
  return record?.stationId
    || record?.snapshot?.stationId
    || record?.stationSnapshot?.stationId
    || record?.inspectionSnapshot?.stationId
    || null;
}

function collectAttachmentIds(value, ids = new Set(), seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return ids;
  seen.add(value);
  if (value.attachment?.id) ids.add(String(value.attachment.id));
  if (Array.isArray(value)) {
    value.forEach((entry) => collectAttachmentIds(entry, ids, seen));
  } else {
    Object.values(value).forEach((entry) => collectAttachmentIds(entry, ids, seen));
  }
  return ids;
}

export function attachmentIdsForState(state = {}) {
  const ids = new Set();
  [
    state?.stationProfiles,
    state?.inspectionRounds,
    state?.inspectionHistory,
    state?.inspectionWorkspaces,
    state?.itemCatalog,
    state?.checklistCopy,
    state?.masterChecklistCopy,
    state?.items,
    state?.inspectionSnapshot,
  ].forEach((value) => collectAttachmentIds(value, ids));
  return [...ids];
}

const VIDEO_ITEM_ID_SET = new Set([...VIDEO_EVIDENCE_ITEM_IDS, "vms-video"]);
const VIDEO_SLOT_ID_SET = new Set(VIDEO_EVIDENCE_SLOT_IDS);

function stringId(value) {
  return String(value || "").trim();
}

const STANDALONE_IMPS_SYSTEM_ID = "imps";
const STANDALONE_IMPS_CATEGORY_CODE = "IMPS";
const STANDALONE_IMPS_ASSET_TYPE = "IMPS_CAMERA";
const STANDALONE_IMPS_CATALOG_ITEM_ID = "system.imps_camera";

function isStandaloneImpsSystem(value) {
  const entry = value && typeof value === "object" ? value : {};
  return entry.systemId === STANDALONE_IMPS_SYSTEM_ID
    || entry.id === "present-imps"
    || entry.displayLabel === "ระบบประมวลผลภาพ (ImPS)"
    || entry.sourceLabel === "IMAGE PROCESSING SYSTEM (ImPS)";
}

function isStandaloneImpsAsset(value) {
  const entry = value && typeof value === "object" ? value : {};
  // `IMAGE_PROCESSOR` currently uses systemId "imps" as a catalog grouping
  // value, so that field alone cannot distinguish it from the retired camera.
  return entry.type === STANDALONE_IMPS_ASSET_TYPE
    || entry.categoryCode === STANDALONE_IMPS_CATEGORY_CODE
    || entry.catalogItemId === STANDALONE_IMPS_CATALOG_ITEM_ID
    || entry.catalogItemLabel === "กล้องระบบประมวลผลภาพ (ImPS)";
}

function isStandaloneImpsCatalogItem(value) {
  const entry = value && typeof value === "object" ? value : {};
  return entry.type === STANDALONE_IMPS_ASSET_TYPE
    || entry.categoryCode === STANDALONE_IMPS_CATEGORY_CODE
    || entry.id === STANDALONE_IMPS_CATALOG_ITEM_ID
    || entry.label === "กล้องระบบประมวลผลภาพ (ImPS)";
}

function isStandaloneImpsReference(value, referenceId = "", removedAssetIds = new Set()) {
  const entry = value && typeof value === "object" ? value : {};
  const assetId = stringId(entry.assetId);
  const itemId = stringId(entry.itemId || entry.sourceItemId || referenceId);
  const normalizedItemId = itemId.toLowerCase();
  return (assetId && removedAssetIds.has(assetId))
    || entry.assetType === STANDALONE_IMPS_ASSET_TYPE
    || entry.categoryCode === STANDALONE_IMPS_CATEGORY_CODE
    || entry.catalogItemId === STANDALONE_IMPS_CATALOG_ITEM_ID
    || entry.catalogItemLabel === "กล้องระบบประมวลผลภาพ (ImPS)"
    || entry.sectionCode === STANDALONE_IMPS_CATEGORY_CODE
    || normalizedItemId === "imps"
    || normalizedItemId.startsWith("imps.")
    || normalizedItemId.startsWith("imps-")
    || normalizedItemId.includes("imps_camera");
}

function stripStandaloneImpsFromChecklistCopy(copy, context) {
  if (!copy || typeof copy !== "object" || !Array.isArray(copy.sections)) return { value: copy, changed: false };
  let changed = false;
  const sections = copy.sections.flatMap((section) => {
    const sectionIsStandalone = String(section?.code || "").trim().toUpperCase() === STANDALONE_IMPS_CATEGORY_CODE;
    if (sectionIsStandalone) {
      changed = true;
      return [];
    }
    const sourceItems = Array.isArray(section?.items) ? section.items : [];
    const items = sourceItems.flatMap((item) => {
      const itemId = stringId(item?.id);
      if (isStandaloneImpsReference(item, itemId, context.removedAssetIds)) {
        changed = true;
        if (itemId) context.removedItemIds.add(itemId);
        (Array.isArray(item?.evidenceSlots) ? item.evidenceSlots : []).forEach((slot) => {
          const slotId = stringId(slot?.id);
          if (slotId) context.removedSlotIds.add(slotId);
        });
        return [];
      }
      if (!Array.isArray(item?.evidenceSlots)) return [item];
      const evidenceSlots = item.evidenceSlots.filter((slot) => {
        const slotId = stringId(slot?.id);
        const remove = isStandaloneImpsReference(slot, slotId, context.removedAssetIds);
        if (remove) {
          changed = true;
          if (slotId) context.removedSlotIds.add(slotId);
        }
        return !remove;
      });
      if (!evidenceSlots.length && item.evidenceSlots.length) {
        changed = true;
        if (itemId) context.removedItemIds.add(itemId);
        return [];
      }
      return [{ ...item, evidenceSlots }];
    });
    return [{ ...section, items }];
  });
  return { value: changed ? { ...copy, sections } : copy, changed };
}

function stripStandaloneImpsFromSnapshot(snapshot, context) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return { value: snapshot, changed: false };
  const next = { ...snapshot };
  let changed = false;
  const equipment = Array.isArray(snapshot.equipment) ? snapshot.equipment : null;
  if (equipment) {
    equipment.forEach((entry) => {
      if (isStandaloneImpsAsset(entry) && stringId(entry.id)) context.removedAssetIds.add(stringId(entry.id));
    });
    const filteredEquipment = equipment.filter((entry) => !isStandaloneImpsAsset(entry));
    if (filteredEquipment.length !== equipment.length) {
      next.equipment = filteredEquipment;
      changed = true;
    }
  }
  const systems = Array.isArray(snapshot.stationSystems) ? snapshot.stationSystems : null;
  if (systems) {
    const filteredSystems = systems.filter((entry) => !isStandaloneImpsSystem(entry));
    if (filteredSystems.length !== systems.length) {
      next.stationSystems = filteredSystems;
      changed = true;
    }
  }
  const evidenceCatalog = Array.isArray(snapshot.evidenceCatalog) ? snapshot.evidenceCatalog : null;
  if (evidenceCatalog) {
    const filteredCatalog = evidenceCatalog.filter((entry) => {
      const remove = isStandaloneImpsReference(entry, entry?.slotId || entry?.itemId || "", context.removedAssetIds);
      if (!remove) return true;
      const itemId = stringId(entry?.itemId);
      const slotId = stringId(entry?.slotId);
      if (itemId) context.removedItemIds.add(itemId);
      if (slotId) context.removedSlotIds.add(slotId);
      collectAttachmentIds(entry, context.removedAttachmentIds);
      return false;
    });
    if (filteredCatalog.length !== evidenceCatalog.length) {
      next.evidenceCatalog = filteredCatalog;
      changed = true;
    }
  }
  ["checklistCopy", "masterChecklistCopy"].forEach((key) => {
    const copyResult = stripStandaloneImpsFromChecklistCopy(snapshot[key], context);
    if (copyResult.changed) {
      next[key] = copyResult.value;
      changed = true;
    }
  });
  return { value: changed ? next : snapshot, changed };
}

function stripStandaloneImpsFromInspectionItems(items, context) {
  if (!items || typeof items !== "object" || Array.isArray(items)) return { value: items, changed: false };
  let changed = false;
  const next = {};
  Object.entries(items).forEach(([itemId, itemValue]) => {
    if (isStandaloneImpsReference(itemValue, itemId, context.removedAssetIds)) {
      changed = true;
      context.removedItemIds.add(itemId);
      collectAttachmentIds(itemValue, context.removedAttachmentIds);
      return;
    }
    if (!itemValue || typeof itemValue !== "object" || Array.isArray(itemValue) || !itemValue.evidence || typeof itemValue.evidence !== "object") {
      next[itemId] = itemValue;
      return;
    }
    let evidenceChanged = false;
    const evidence = {};
    Object.entries(itemValue.evidence).forEach(([slotId, evidenceValue]) => {
      if (!isStandaloneImpsReference(evidenceValue, slotId, context.removedAssetIds)) {
        evidence[slotId] = evidenceValue;
        return;
      }
      changed = true;
      evidenceChanged = true;
      context.removedSlotIds.add(slotId);
      collectAttachmentIds(evidenceValue, context.removedAttachmentIds);
    });
    next[itemId] = evidenceChanged ? { ...itemValue, evidence } : itemValue;
  });
  return { value: changed ? next : items, changed };
}

function stripStandaloneImpsFromRecord(record, context) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return { value: record, changed: false };
  const next = { ...record };
  let changed = false;
  ["snapshot", "stationSnapshot", "inspectionSnapshot"].forEach((key) => {
    if (!record[key] || typeof record[key] !== "object") return;
    const result = stripStandaloneImpsFromSnapshot(record[key], context);
    if (result.changed) {
      next[key] = result.value;
      changed = true;
    }
  });
  ["inspectionItems", "items"].forEach((key) => {
    if (!record[key] || typeof record[key] !== "object") return;
    const result = stripStandaloneImpsFromInspectionItems(record[key], context);
    if (result.changed) {
      next[key] = result.value;
      changed = true;
    }
  });
  return { value: changed ? next : record, changed };
}

export function purgeStandaloneImpsFromState(state = {}) {
  const context = {
    removedAssetIds: new Set(),
    removedItemIds: new Set(),
    removedSlotIds: new Set(),
    removedAttachmentIds: new Set(),
  };
  const result = {
    state: { ...state },
    changed: false,
    removedAssetIds: context.removedAssetIds,
    removedItemIds: context.removedItemIds,
    removedSlotIds: context.removedSlotIds,
    removedAttachmentIds: context.removedAttachmentIds,
    attachmentIdsToDelete: [],
  };
  if (Array.isArray(state.stationProfiles)) {
    result.state.stationProfiles = state.stationProfiles.map((profile) => {
      if (!profile || typeof profile !== "object") return profile;
      const filteredSystems = Array.isArray(profile.stationSystems) ? profile.stationSystems.filter((entry) => !isStandaloneImpsSystem(entry)) : null;
      const stationSystems = filteredSystems && filteredSystems.length !== profile.stationSystems.length ? filteredSystems : profile.stationSystems;
      const filteredEquipment = Array.isArray(profile.equipment) ? profile.equipment.filter((entry) => {
        const remove = isStandaloneImpsAsset(entry);
        if (remove && stringId(entry.id)) context.removedAssetIds.add(stringId(entry.id));
        return !remove;
      }) : null;
      const equipment = filteredEquipment && filteredEquipment.length !== profile.equipment.length ? filteredEquipment : profile.equipment;
      const disabledTemplateIds = Array.isArray(profile.checklistConfig?.disabledTemplateIds)
        ? profile.checklistConfig.disabledTemplateIds.filter((id) => !isStandaloneImpsReference({}, id, context.removedAssetIds))
        : null;
      const checklistConfig = disabledTemplateIds && disabledTemplateIds.length !== profile.checklistConfig.disabledTemplateIds.length
        ? { ...profile.checklistConfig, disabledTemplateIds }
        : profile.checklistConfig;
      if (stationSystems === profile.stationSystems && equipment === profile.equipment && checklistConfig === profile.checklistConfig) return profile;
      result.changed = true;
      return { ...profile, stationSystems, equipment, checklistConfig };
    });
  }
  if (Array.isArray(state.itemCatalog)) {
    const itemCatalog = state.itemCatalog.filter((entry) => !isStandaloneImpsCatalogItem(entry));
    if (itemCatalog.length !== state.itemCatalog.length) {
      result.state.itemCatalog = itemCatalog;
      result.changed = true;
    }
  }
  ["inspectionRounds", "inspectionHistory", "inspectionWorkspaces"].forEach((key) => {
    if (!Array.isArray(state[key])) return;
    result.state[key] = state[key].map((record) => {
      const recordResult = stripStandaloneImpsFromRecord(record, context);
      if (recordResult.changed) result.changed = true;
      return recordResult.value;
    });
  });
  if (state.inspectionSnapshot && typeof state.inspectionSnapshot === "object") {
    const snapshotResult = stripStandaloneImpsFromSnapshot(state.inspectionSnapshot, context);
    if (snapshotResult.changed) {
      result.state.inspectionSnapshot = snapshotResult.value;
      result.changed = true;
    }
  }
  if (state.items && typeof state.items === "object") {
    const itemResult = stripStandaloneImpsFromInspectionItems(state.items, context);
    if (itemResult.changed) {
      result.state.items = itemResult.value;
      result.changed = true;
    }
  }
  ["checklistCopy", "masterChecklistCopy"].forEach((key) => {
    if (!state[key] || typeof state[key] !== "object") return;
    const copyResult = stripStandaloneImpsFromChecklistCopy(state[key], context);
    if (copyResult.changed) {
      result.state[key] = copyResult.value;
      result.changed = true;
    }
  });
  const retainedAttachmentIds = new Set(attachmentIdsForState(result.state));
  const existingPending = Array.isArray(state.impsPurgePendingAttachmentIds) ? state.impsPurgePendingAttachmentIds : [];
  result.attachmentIdsToDelete = [...new Set([...existingPending, ...context.removedAttachmentIds])]
    .filter((id) => !retainedAttachmentIds.has(id));
  result.state.impsPurgePendingAttachmentIds = result.attachmentIdsToDelete;
  return result;
}

function videoIdentitiesForSnapshot(snapshot) {
  const itemIds = new Set(VIDEO_ITEM_ID_SET);
  const slotIds = new Set(VIDEO_SLOT_ID_SET);
  (Array.isArray(snapshot?.evidenceCatalog) ? snapshot.evidenceCatalog : []).forEach((entry) => {
    if (entry?.fieldType !== "video") return;
    const itemId = stringId(entry.itemId);
    const slotId = stringId(entry.slotId);
    if (itemId) itemIds.add(itemId);
    if (slotId) slotIds.add(slotId);
  });
  return { itemIds, slotIds };
}

function videoIdentitiesForState(state = {}) {
  const itemIds = new Set(VIDEO_ITEM_ID_SET);
  const slotIds = new Set(VIDEO_SLOT_ID_SET);
  const snapshots = [
    state?.inspectionSnapshot,
    ...asArray(state?.inspectionRounds).map((record) => record?.snapshot || record?.stationSnapshot || record?.inspectionSnapshot),
    ...asArray(state?.inspectionHistory).map((record) => record?.snapshot || record?.stationSnapshot || record?.inspectionSnapshot),
    ...asArray(state?.inspectionWorkspaces).map((record) => record?.snapshot || record?.stationSnapshot || record?.inspectionSnapshot),
  ];
  snapshots.forEach((snapshot) => {
    const identities = videoIdentitiesForSnapshot(snapshot);
    identities.itemIds.forEach((id) => itemIds.add(id));
    identities.slotIds.forEach((id) => slotIds.add(id));
  });
  return { itemIds, slotIds };
}

function isVideoItemId(id, identities) {
  return identities.itemIds.has(stringId(id));
}

function isVideoSlotId(id, identities) {
  return identities.slotIds.has(stringId(id));
}

function stripChecklistCopy(copy, identities, removedItemIds, removedSlotIds) {
  if (!copy || typeof copy !== "object" || !Array.isArray(copy.sections)) return { value: copy, changed: false };
  let changed = false;
  const sections = copy.sections.map((section) => ({
    ...section,
    items: (Array.isArray(section?.items) ? section.items : []).flatMap((item) => {
      const itemId = stringId(item?.id);
      const sourceSlots = Array.isArray(item?.evidenceSlots) ? item.evidenceSlots : null;
      const removeWholeItem = isVideoItemId(itemId, identities)
        || (sourceSlots?.length > 0 && sourceSlots.every((slot) => slot?.fieldType === "video" || isVideoSlotId(slot?.id, identities)));
      if (removeWholeItem) {
        changed = true;
        if (itemId) removedItemIds.add(itemId);
        sourceSlots?.forEach((slot) => {
          const slotId = stringId(slot?.id);
          if (slotId) removedSlotIds.add(slotId);
        });
        return [];
      }
      if (!sourceSlots) return [item];
      const evidenceSlots = sourceSlots.filter((slot) => {
        const remove = slot?.fieldType === "video" || isVideoSlotId(slot?.id, identities);
        if (remove) {
          changed = true;
          const slotId = stringId(slot?.id);
          if (slotId) removedSlotIds.add(slotId);
        }
        return !remove;
      });
      if (!evidenceSlots.length && sourceSlots.length) {
        changed = true;
        if (itemId) removedItemIds.add(itemId);
        return [];
      }
      return [{ ...item, evidenceSlots }];
    }),
  }));
  return { value: changed ? { ...copy, sections } : copy, changed };
}

function stripMasterChecklistCopy(copy, removedItemIds) {
  if (!copy || typeof copy !== "object" || !Array.isArray(copy.sections)) return { value: copy, changed: false };
  let changed = false;
  const sections = copy.sections.map((section) => ({
    ...section,
    items: (Array.isArray(section?.items) ? section.items : []).filter((item) => {
      const remove = VIDEO_ITEM_ID_SET.has(stringId(item?.id));
      if (remove) {
        changed = true;
        removedItemIds.add(stringId(item.id));
      }
      return !remove;
    }),
  }));
  return { value: changed ? { ...copy, sections } : copy, changed };
}

function stripSnapshotVideoData(snapshot, removedItemIds, removedSlotIds) {
  if (!snapshot || typeof snapshot !== "object") return { value: snapshot, identities: videoIdentitiesForSnapshot(null), changed: false, slots: 0 };
  const identities = videoIdentitiesForSnapshot(snapshot);
  let changed = false;
  let slots = 0;
  const next = { ...snapshot };
  if (Array.isArray(snapshot.evidenceCatalog)) {
    next.evidenceCatalog = snapshot.evidenceCatalog.filter((entry) => {
      const remove = entry?.fieldType === "video"
        || isVideoItemId(entry?.itemId, identities)
        || isVideoSlotId(entry?.slotId, identities);
      if (remove) {
        changed = true;
        slots += 1;
        const itemId = stringId(entry?.itemId);
        const slotId = stringId(entry?.slotId);
        if (itemId) removedItemIds.add(itemId);
        if (slotId) removedSlotIds.add(slotId);
      }
      return !remove;
    });
  }
  const copyResult = stripChecklistCopy(snapshot.checklistCopy, identities, removedItemIds, removedSlotIds);
  if (copyResult.changed) {
    changed = true;
    next.checklistCopy = copyResult.value;
  }
  const masterCopyResult = stripMasterChecklistCopy(snapshot.masterChecklistCopy, removedItemIds);
  if (masterCopyResult.changed) {
    changed = true;
    next.masterChecklistCopy = masterCopyResult.value;
  }
  return { value: changed ? next : snapshot, identities, changed, slots };
}

function stripInspectionItems(items, identities, removedItemIds, removedSlotIds, removedAttachmentIds) {
  if (!items || typeof items !== "object" || Array.isArray(items)) return {
    value: items,
    changed: false,
    removedItemIds,
    removedSlotIds,
    removedAttachmentIds,
    items: 0,
    slots: 0,
  };
  let changed = false;
  let itemCount = 0;
  let slotCount = 0;
  const next = {};
  Object.entries(items).forEach(([itemId, itemValue]) => {
    if (isVideoItemId(itemId, identities)) {
      changed = true;
      itemCount += 1;
      removedItemIds.add(itemId);
      collectAttachmentIds(itemValue, removedAttachmentIds);
      return;
    }
    if (!itemValue || typeof itemValue !== "object" || Array.isArray(itemValue) || !itemValue.evidence || typeof itemValue.evidence !== "object") {
      next[itemId] = itemValue;
      return;
    }
    const evidence = {};
    Object.entries(itemValue.evidence).forEach(([slotId, evidenceValue]) => {
      const sourceSlotId = evidenceValue?.sourceSlotId;
      if (isVideoSlotId(slotId, identities) || isVideoSlotId(sourceSlotId, identities)) {
        changed = true;
        slotCount += 1;
        removedSlotIds.add(slotId);
        collectAttachmentIds(evidenceValue, removedAttachmentIds);
        return;
      }
      evidence[slotId] = evidenceValue;
    });
    next[itemId] = { ...itemValue, evidence };
  });
  return {
    value: changed ? next : items,
    changed,
    removedItemIds,
    removedSlotIds,
    removedAttachmentIds,
    items: itemCount,
    slots: slotCount,
  };
}

function stripVideoEvidenceFromRecord(record) {
  if (!record || typeof record !== "object") return { value: record, changed: false, removedItemIds: new Set(), removedSlotIds: new Set(), removedAttachmentIds: new Set(), items: 0, slots: 0 };
  const removedItemIds = new Set();
  const removedSlotIds = new Set();
  const removedAttachmentIds = new Set();
  let changed = false;
  let items = 0;
  let slots = 0;
  const next = { ...record };
  const snapshots = ["snapshot", "stationSnapshot", "inspectionSnapshot"];
  let identities = videoIdentitiesForSnapshot(null);
  snapshots.forEach((key) => {
    if (!record[key] || typeof record[key] !== "object") return;
    const result = stripSnapshotVideoData(record[key], removedItemIds, removedSlotIds);
    identities = result.identities;
    if (result.changed) {
      changed = true;
      next[key] = result.value;
    }
    slots += result.slots;
  });
  ["inspectionItems", "items"].forEach((key) => {
    if (!record[key] || typeof record[key] !== "object") return;
    const result = stripInspectionItems(record[key], identities, removedItemIds, removedSlotIds, removedAttachmentIds);
    if (result.changed) {
      changed = true;
      next[key] = result.value;
    }
    items += result.items;
    slots += result.slots;
  });
  return { value: changed ? next : record, changed, removedItemIds, removedSlotIds, removedAttachmentIds, items, slots };
}

function mergePurgeResult(target, result) {
  result.removedItemIds.forEach((id) => target.removedItemIds.add(id));
  result.removedSlotIds.forEach((id) => target.removedSlotIds.add(id));
  result.removedAttachmentIds.forEach((id) => target.removedAttachmentIds.add(id));
  target.changed = target.changed || result.changed;
  target.items += result.items;
  target.slots += result.slots;
}

export function purgeVideoEvidenceFromState(state = {}) {
  const result = {
    state: { ...state },
    changed: false,
    removedItemIds: new Set(),
    removedSlotIds: new Set(),
    removedAttachmentIds: new Set(),
    items: 0,
    slots: 0,
  };
  ["inspectionRounds", "inspectionHistory", "inspectionWorkspaces"].forEach((key) => {
    if (!Array.isArray(state[key])) return;
    result.state[key] = state[key].map((record) => {
      const next = stripVideoEvidenceFromRecord(record);
      mergePurgeResult(result, next);
      return next.value;
    });
  });
  const legacyIdentities = videoIdentitiesForState(state);
  if (state.inspectionSnapshot) {
    const snapshotResult = stripSnapshotVideoData(state.inspectionSnapshot, result.removedItemIds, result.removedSlotIds);
    if (snapshotResult.changed) result.changed = true;
    result.state.inspectionSnapshot = snapshotResult.value;
  }
  if (state.items) {
    const itemsResult = stripInspectionItems(
      state.items,
      legacyIdentities,
      result.removedItemIds,
      result.removedSlotIds,
      result.removedAttachmentIds,
    );
    mergePurgeResult(result, itemsResult);
    result.state.items = itemsResult.value;
  }
  const checklistCopyResult = stripChecklistCopy(state.checklistCopy, legacyIdentities, result.removedItemIds, result.removedSlotIds);
  if (checklistCopyResult.changed) {
    result.changed = true;
    result.state.checklistCopy = checklistCopyResult.value;
  }
  const masterCopyResult = stripMasterChecklistCopy(state.masterChecklistCopy, result.removedItemIds);
  if (masterCopyResult.changed) {
    result.changed = true;
    result.state.masterChecklistCopy = masterCopyResult.value;
  }
  if (Array.isArray(state.stationProfiles)) {
    result.state.stationProfiles = state.stationProfiles.map((profile) => {
      const disabled = profile?.checklistConfig?.disabledTemplateIds;
      if (!Array.isArray(disabled)) return profile;
      const filtered = disabled.filter((id) => !legacyIdentities.itemIds.has(stringId(id)));
      if (filtered.length === disabled.length) return profile;
      result.changed = true;
      return { ...profile, checklistConfig: { ...profile.checklistConfig, disabledTemplateIds: filtered } };
    });
  }
  const retainedAttachmentIds = new Set(attachmentIdsForState(result.state));
  const attachmentIdsToDelete = [...result.removedAttachmentIds].filter((id) => !retainedAttachmentIds.has(id));
  return {
    ...result,
    attachmentIdsToDelete,
    removedItemIds: [...result.removedItemIds],
    removedSlotIds: [...result.removedSlotIds],
    removedAttachmentIds: [...result.removedAttachmentIds],
  };
}

export function buildVideoPurgePlan(raw = {}) {
  const purged = purgeVideoEvidenceFromState(raw);
  const records = [
    ...asArray(raw?.inspectionRounds).map((record) => ({ record, kind: record?.status === "closed" || record?.closedAt ? "closed" : "draft" })),
    ...asArray(raw?.inspectionHistory).map((record) => ({ record, kind: "closed" })),
    ...asArray(raw?.inspectionWorkspaces).map((record) => ({ record, kind: "draft" })),
  ];
  const affectedRecords = records.filter(({ record }) => stripVideoEvidenceFromRecord(record).changed);
  const roundIds = new Set(affectedRecords.map(({ record }) => stringId(record?.id)).filter(Boolean));
  const draftRounds = new Set(affectedRecords.filter(({ kind }) => kind === "draft").map(({ record }) => stringId(record?.id)).filter(Boolean));
  const closedRounds = new Set(affectedRecords.filter(({ kind }) => kind === "closed").map(({ record }) => stringId(record?.id)).filter(Boolean));
  const needsPurge = purged.changed || purged.attachmentIdsToDelete.length > 0;
  return {
    version: VIDEO_EVIDENCE_PURGE_VERSION,
    needsPurge,
    sourceState: needsPurge ? clone(raw) : null,
    backupAttachmentIds: needsPurge ? attachmentIdsForState(raw) : [],
    attachmentIdsToDelete: purged.attachmentIdsToDelete,
    counts: {
      rounds: roundIds.size,
      draftRounds: draftRounds.size,
      closedRounds: closedRounds.size,
      videoItems: purged.removedItemIds.length,
      videoSlots: purged.removedSlotIds.length,
      attachments: purged.attachmentIdsToDelete.length,
    },
  };
}

function recordsForStation(entries, stationId) {
  return asArray(entries).filter((entry) => stationIdForRecord(entry) === stationId);
}

function currentLegacyStationId(state) {
  return state?.activeStationId || stationIdForRecord({
    stationId: null,
    inspectionSnapshot: state?.inspectionSnapshot,
  });
}

export function buildStationDeletionImpact(state = {}, stationId) {
  const profile = asArray(state.stationProfiles).find((entry) => entry?.id === stationId) || null;
  const rounds = recordsForStation(state.inspectionRounds, stationId);
  const history = recordsForStation(state.inspectionHistory, stationId);
  const workspaces = recordsForStation(state.inspectionWorkspaces, stationId);
  const targetRecords = [...rounds, ...history, ...workspaces];
  const targetAttachmentIds = collectAttachmentIds(targetRecords);
  const currentStationId = currentLegacyStationId(state);
  if (currentStationId === stationId) {
    collectAttachmentIds(state.items, targetAttachmentIds);
    collectAttachmentIds(state.inspectionSnapshot, targetAttachmentIds);
  }

  const remainingAttachmentIds = new Set();
  asArray(state.inspectionRounds).filter((entry) => stationIdForRecord(entry) !== stationId).forEach((entry) => collectAttachmentIds(entry, remainingAttachmentIds));
  asArray(state.inspectionHistory).filter((entry) => stationIdForRecord(entry) !== stationId).forEach((entry) => collectAttachmentIds(entry, remainingAttachmentIds));
  asArray(state.inspectionWorkspaces).filter((entry) => stationIdForRecord(entry) !== stationId).forEach((entry) => collectAttachmentIds(entry, remainingAttachmentIds));
  if (currentStationId !== stationId) {
    collectAttachmentIds(state.items, remainingAttachmentIds);
    collectAttachmentIds(state.inspectionSnapshot, remainingAttachmentIds);
  }
  const sharedAttachmentIds = [...targetAttachmentIds].filter((id) => remainingAttachmentIds.has(id));
  const attachmentIds = [...targetAttachmentIds].filter((id) => !remainingAttachmentIds.has(id));
  const draftRounds = rounds.filter((round) => round?.status !== "closed");
  const closedRounds = rounds.filter((round) => round?.status === "closed");
  return {
    stationId,
    stationCode: profile?.stationCode || "",
    stationName: profile?.stationName || "",
    counts: {
      assets: asArray(profile?.equipment).length,
      draftRounds: draftRounds.length,
      closedHistory: closedRounds.length,
      snapshots: rounds.filter((round) => Boolean(snapshotFromHistory(round))).length,
      attachments: attachmentIds.length,
    },
    roundIds: rounds.map((round) => round.id).filter(Boolean),
    historyIds: history.map((entry) => entry.id).filter(Boolean),
    workspaceIds: workspaces.map((entry) => entry.id).filter(Boolean),
    attachmentIds,
    sharedAttachmentIds,
  };
}

export function purgeStationFromState(state = {}, stationId) {
  const stationProfiles = asArray(state.stationProfiles).filter((profile) => profile?.id !== stationId);
  const inspectionRounds = asArray(state.inspectionRounds).filter((round) => stationIdForRecord(round) !== stationId);
  const inspectionHistory = asArray(state.inspectionHistory).filter((entry) => stationIdForRecord(entry) !== stationId);
  const inspectionWorkspaces = asArray(state.inspectionWorkspaces).filter((entry) => stationIdForRecord(entry) !== stationId);
  const deletedRoundIds = new Set([
    ...asArray(state.inspectionRounds).filter((round) => stationIdForRecord(round) === stationId).map((round) => round?.id),
    ...asArray(state.inspectionHistory).filter((entry) => stationIdForRecord(entry) === stationId).map((entry) => entry?.id),
    ...asArray(state.inspectionWorkspaces).filter((entry) => stationIdForRecord(entry) === stationId).map((entry) => entry?.id),
  ].filter(Boolean));
  const inspectionRoundContextLinks = asArray(state.inspectionRoundContextLinks).filter((entry) => !deletedRoundIds.has(entry?.roundId));
  const stationInspectionReports = asArray(state.stationInspectionReports).filter((entry) => !deletedRoundIds.has(entry?.roundId));
  const deletedStationIds = [...new Set([...asArray(state.deletedStationIds).filter(Boolean), stationId])];
  const remainingProfile = stationProfiles.find((profile) => profile.active !== false) || stationProfiles[0] || null;
  const currentRound = asArray(state.inspectionRounds).find((round) => round.id === state.activeRoundId) || null;
  const currentRoundStillExists = inspectionRounds.some((round) => round.id === state.activeRoundId);
  const currentActiveStationWasDeleted = state.activeStationId === stationId
    || state.ui?.selectedStationId === stationId
    || stationIdForRecord(currentRound) === stationId;
  const nextRound = currentRoundStillExists && !currentActiveStationWasDeleted
    ? inspectionRounds.find((round) => round.id === state.activeRoundId)
    : inspectionRounds.find((round) => round.status === "draft" && round.stationId === remainingProfile?.id)
      || inspectionRounds.find((round) => round.status === "draft")
      || inspectionRounds.find((round) => round.stationId === remainingProfile?.id)
      || null;
  const nextStationId = currentActiveStationWasDeleted
    ? (nextRound?.stationId || remainingProfile?.id || null)
    : (state.activeStationId && stationProfiles.some((profile) => profile.id === state.activeStationId)
      ? state.activeStationId
      : nextRound?.stationId || remainingProfile?.id || null);
  const activeRoundId = nextRound?.id || null;

  return {
    ...state,
    stationProfiles,
    inspectionRounds,
    inspectionHistory,
    inspectionWorkspaces,
    inspectionRoundContextLinks,
    stationInspectionReports,
    deletedStationIds,
    activeStationId: nextStationId,
    activeRoundId,
    ui: { ...(state.ui || {}), selectedStationId: nextStationId },
    items: nextRound?.inspectionItems || {},
    inspectionSnapshot: nextRound?.snapshot || null,
    meta: nextRound?.meta || { ...defaultMeta },
  };
}

function legacyProfile(source, index = 0) {
  const profile = createDefaultStationProfile();
  profile.id = source?.activeStationId || "station-legacy";
  profile.stationCode = String(source?.inspectionSnapshot?.stationCode || `STATION-${String(index + 1).padStart(2, "0")}`);
  profile.stationName = String(source?.meta?.projectName || source?.inspectionSnapshot?.stationName || `สถานีเดิม ${index + 1}`);
  return profile;
}

export function migrateChecklistState(raw = safeRead(), { videoPurgePlan = null } = {}) {
  const rawSource = raw && typeof raw === "object" ? raw : {};
  // Purge retired standalone ImPS data before any normalizer can turn it into
  // UNKNOWN/orphaned records or recreate it in compatibility aliases.
  const impsPurge = purgeStandaloneImpsFromState(rawSource);
  const source = impsPurge.state;
  const checklistCopy = migrateChecklistCopyForCurrentTemplate(source.checklistCopy);
  const masterChecklistCopy = normalizeMasterChecklistCopy(source.masterChecklistCopy) || createMasterChecklistCopySnapshot();
  const itemCatalog = normalizeItemCatalog(source.itemCatalog, { includeWimElectronics: true });
  const deletedStationIds = new Set(asArray(source.deletedStationIds).filter(Boolean));
  const hasExplicitProfiles = Array.isArray(source.stationProfiles);
  const hasLegacySnapshot = Boolean(source.inspectionSnapshot && typeof source.inspectionSnapshot === "object" && Object.keys(source.inspectionSnapshot).length);
  const hasLegacyItems = Boolean(source.items && typeof source.items === "object" && Object.keys(source.items).length);
  const hasLegacyMeta = Boolean(source.meta && typeof source.meta === "object" && Object.values(source.meta).some((value) => String(value ?? "").trim()));
  const hasLegacyPayload = hasLegacySnapshot || hasLegacyItems || hasLegacyMeta;
  const hasLegacyRecords = Boolean(hasLegacyPayload || asArray(source.inspectionRounds).length || asArray(source.inspectionWorkspaces).length || asArray(source.inspectionHistory).length);
  let profiles = asArray(source.stationProfiles).map((profile, index) => normalizeStationProfile(profile, index)).filter((profile) => !deletedStationIds.has(profile.id));
  const legacy = legacyProfile(source);
  if (!profiles.length && hasLegacyPayload && !deletedStationIds.has(legacy.id)) profiles = [legacy];
  if (!profiles.length && !hasExplicitProfiles && !hasLegacyRecords && !deletedStationIds.size) profiles = [normalizeStationProfile(createDefaultStationProfile(), 0)];

  // Keep an internal fallback for normalizing orphaned legacy records without recreating a deleted/default station.
  const fallbackProfile = profiles[0] || normalizeStationProfile(createDefaultStationProfile(), 0);
  const rounds = [];
  const seen = new Set();
  const deletedRoundIds = new Set(asArray(source.deletedRoundIds).filter(Boolean));
  const addRound = (candidate, forcedStatus = null) => {
    if (!candidate || typeof candidate !== "object") return;
    const rawSnapshot = candidate.snapshot || candidate.stationSnapshot || candidate.inspectionSnapshot || null;
    const preserveHistoricalSnapshot = Boolean(rawSnapshot && (forcedStatus === "closed" || candidate.status === "closed" || candidate.closedAt));
    const stationId = candidate.stationId || rawSnapshot?.stationId || fallbackProfile.id;
    if (deletedStationIds.has(stationId)) return;
    const profile = profiles.find((entry) => entry.id === stationId) || fallbackProfile;
    const normalized = normalizeRound({
      ...candidate,
      stationId,
      snapshot: rawSnapshot || createSnapshot(profile),
    }, profiles, profile, forcedStatus);
    const round = preserveHistoricalSnapshot ? { ...normalized, snapshot: clone(rawSnapshot) } : normalized;
    if (!round || deletedRoundIds.has(round.id) || seen.has(round.id)) return;
    seen.add(round.id);
    rounds.push(round);
  };

  asArray(source.inspectionRounds).forEach((round) => addRound(round));
  asArray(source.inspectionWorkspaces).forEach((workspace) => addRound({
    ...workspace,
    id: workspace.id || `round-workspace-${workspace.stationId || "unknown"}`,
    inspectionItems: workspace.inspectionItems || workspace.items,
    snapshot: workspace.snapshot || workspace.inspectionSnapshot,
  }, "draft"));
  asArray(source.inspectionHistory).forEach((entry, index) => addRound({
    ...entry,
    id: entry.id || `round-history-${index + 1}`,
    stationId: entry.stationId || snapshotFromHistory(entry)?.stationId,
    snapshot: snapshotFromHistory(entry),
    inspectionItems: entry.inspectionItems || entry.items,
    createdAt: entry.createdAt || entry.archivedAt,
    closedAt: entry.closedAt || entry.archivedAt,
  }, "closed"));

  if (hasLegacyPayload) addRound({
    id: source.activeRoundId || `round-legacy-${source.inspectionSnapshot?.id || "current"}`,
    stationId: source.activeStationId || source.inspectionSnapshot?.stationId || fallbackProfile.id,
    snapshot: source.inspectionSnapshot,
    inspectionItems: source.items,
    meta: source.meta,
    templateVersion: source.inspectionTemplateVersion,
    updatedAt: source.lastSaved,
  }, "draft");

  const activeRoundId = source.activeRoundId && rounds.some((round) => round.id === source.activeRoundId)
    ? source.activeRoundId
    : rounds.find((round) => round.status === "draft")?.id || rounds[0]?.id || null;
  const activeRound = rounds.find((round) => round.id === activeRoundId);
  const selectedStationId = profiles.some((profile) => profile.id === source.ui?.selectedStationId)
    ? source.ui.selectedStationId
    : activeRound?.stationId || profiles[0]?.id || null;
  const activeStationId = profiles.some((profile) => profile.id === source.activeStationId)
    ? source.activeStationId
    : activeRound?.stationId || profiles[0]?.id || null;
  const legacyAliasDeleted = deletedStationIds.has(source.activeStationId) || deletedStationIds.has(source.inspectionSnapshot?.stationId);
  const inspectionHistory = asArray(source.inspectionHistory).filter((entry) => !deletedStationIds.has(stationIdForRecord(entry)));
  const inspectionWorkspaces = asArray(source.inspectionWorkspaces).filter((entry) => !deletedStationIds.has(stationIdForRecord(entry)));
  const baseState = {
    ...source,
    version: CURRENT_STATE_VERSION,
    assetNoScopeVersion: ASSET_NO_SCOPE_VERSION,
    stationProfiles: profiles,
    inspectionRounds: rounds,
    stationInspectionReports: normalizeStationInspectionReports(source.stationInspectionReports, rounds, {
      migrateLegacyCovers: Number(source.version || 0) < CURRENT_STATE_VERSION,
    }),
    deletedRoundIds: [...deletedRoundIds],
    deletedStationIds: [...deletedStationIds],
    checklistCopy,
    masterChecklistCopy,
    itemCatalog,
    regions: source.regions,
    referenceData: source.referenceData,
    contracts: source.contracts,
    workPackages: source.workPackages,
    contractStationAssignments: source.contractStationAssignments,
    contractWorkReports: source.contractWorkReports,
    contractAgreementCovers: source.contractAgreementCovers,
    impsPurgeVersion: IMPS_PURGE_VERSION,
    impsPurgePendingAttachmentIds: [...impsPurge.attachmentIdsToDelete],
    activeRoundId,
    activeStationId,
    ui: { ...(source.ui || {}), selectedStationId },
    // Compatibility aliases stay available while older static clients are still around.
    items: legacyAliasDeleted ? (activeRound?.inspectionItems || {}) : (source.items || activeRound?.inspectionItems || {}),
    inspectionSnapshot: legacyAliasDeleted ? (activeRound?.snapshot || null) : (source.inspectionSnapshot || activeRound?.snapshot || null),
    meta: legacyAliasDeleted ? { ...defaultMeta, ...(activeRound?.meta || {}) } : { ...defaultMeta, ...(source.meta || activeRound?.meta || {}) },
    inspectionHistory,
    inspectionWorkspaces,
  };
  const purgePlan = videoPurgePlan || buildVideoPurgePlan(source);
  const purged = purgeVideoEvidenceFromState(normalizeContractWorkspaceState(baseState));
  const sanitizedRounds = (purged.state.inspectionRounds || []).map((round) => ({
    ...round,
    vehicleSearch: normalizeRoundVehicleSearchForStorage(round),
  }));
  const sanitizedActiveRound = sanitizedRounds.find((round) => round.id === activeRoundId) || sanitizedRounds[0] || null;
  const previousPurge = source.videoEvidencePurge && typeof source.videoEvidencePurge === "object"
    ? source.videoEvidencePurge
    : null;
  const pendingAttachmentIds = [...new Set([
    ...asArray(source.videoPurgePendingAttachmentIds),
    ...asArray(previousPurge?.pendingAttachmentIds),
    ...asArray(purgePlan?.attachmentIdsToDelete),
    ...asArray(purged.attachmentIdsToDelete),
  ].filter(Boolean))];
  const purgeWasDetected = Boolean(purgePlan?.needsPurge || purged.changed || previousPurge || pendingAttachmentIds.length);
  const sanitizedState = {
    ...purged.state,
    version: CURRENT_STATE_VERSION,
    inspectionRounds: sanitizedRounds,
    // Rebuild compatibility aliases from the sanitized canonical rounds so
    // old clients cannot reintroduce the retired video records after reload.
    inspectionHistory: compatibilityHistoryFromRounds(sanitizedRounds),
    inspectionWorkspaces: compatibilityWorkspacesFromRounds(sanitizedRounds),
    activeRoundId: sanitizedActiveRound?.id || null,
    activeStationId: sanitizedActiveRound?.stationId || activeStationId,
    ui: { ...(purged.state.ui || {}), selectedStationId: sanitizedActiveRound?.stationId || selectedStationId },
    items: sanitizedActiveRound?.inspectionItems || {},
    inspectionSnapshot: sanitizedActiveRound?.snapshot || null,
    meta: sanitizedActiveRound?.meta || { ...defaultMeta },
  };
  // Video topics are retired. Remove their records from every current and
  // compatibility collection immediately, without showing a destructive
  // dialog. Keep only attachment ids that need asynchronous IndexedDB cleanup.
  delete sanitizedState.videoEvidencePurge;
  if (purgeWasDetected && pendingAttachmentIds.length) sanitizedState.videoPurgePendingAttachmentIds = pendingAttachmentIds;
  else delete sanitizedState.videoPurgePendingAttachmentIds;
  return sanitizedState;
}

export function loadChecklistState() {
  return loadChecklistBootstrap().state;
}

export function loadChecklistBootstrap() {
  const source = safeRead();
  const videoPurgePlan = buildVideoPurgePlan(source);
  const state = migrateChecklistState(source, { videoPurgePlan });
  const needsVideoMigrationSave = Boolean(
    videoPurgePlan.needsPurge
    || source.videoEvidencePurge
    || (Array.isArray(source.videoPurgePendingAttachmentIds) && source.videoPurgePendingAttachmentIds.length),
  );
  const needsChecklistCopyMigrationSave = Boolean(
    source.checklistCopy
    && JSON.stringify(source.checklistCopy) !== JSON.stringify(state.checklistCopy),
  );
  const needsAssetNoScopeMigrationSave = source.assetNoScopeVersion !== ASSET_NO_SCOPE_VERSION;
  const needsStationReportMigrationSave = source.version !== CURRENT_STATE_VERSION
    || !Array.isArray(source.stationInspectionReports)
    || JSON.stringify(source.stationInspectionReports) !== JSON.stringify(state.stationInspectionReports);
  if (source.impsPurgeVersion !== IMPS_PURGE_VERSION || needsVideoMigrationSave || needsChecklistCopyMigrationSave || needsAssetNoScopeMigrationSave || needsStationReportMigrationSave) {
    try {
      saveChecklistState(state);
    } catch {
      // The in-memory migration is still usable if localStorage is unavailable.
    }
  }
  return {
    state,
    videoPurgePlan: null,
  };
}

function compatibilityHistoryFromRounds(rounds = []) {
  return rounds.filter((round) => round?.status === "closed").map((round) => ({
    id: round.id,
    stationId: round.stationId,
    archivedAt: round.closedAt || round.updatedAt,
    createdAt: round.createdAt,
    updatedAt: round.updatedAt,
    closedAt: round.closedAt,
    templateVersion: round.templateVersion,
    stationSnapshot: clone(round.snapshot),
    meta: clone(round.meta),
    vehicleSearch: clone(round.vehicleSearch),
    items: clone(round.inspectionItems),
    inspectionItems: clone(round.inspectionItems),
    correctionHistory: clone(round.correctionHistory || []),
    basedOnRoundId: round.basedOnRoundId || null,
    revisionNumber: round.revisionNumber || 0,
    revisionReason: round.revisionReason || "",
    reason: round.reason || round.revisionReason || "",
    revisionCreatedAt: round.revisionCreatedAt || null,
    revisionCreatedByLabel: round.revisionCreatedByLabel || "",
  }));
}

function compatibilityWorkspacesFromRounds(rounds = []) {
  return rounds.filter((round) => round?.status !== "closed").map((round) => ({
    id: round.id,
    stationId: round.stationId,
    snapshot: clone(round.snapshot),
    inspectionSnapshot: clone(round.snapshot),
    vehicleSearch: clone(round.vehicleSearch),
    items: clone(round.inspectionItems),
    inspectionItems: clone(round.inspectionItems),
    meta: clone(round.meta),
    createdAt: round.createdAt,
    updatedAt: round.updatedAt,
    basedOnRoundId: round.basedOnRoundId || null,
    revisionNumber: round.revisionNumber || 0,
    revisionReason: round.revisionReason || "",
    reason: round.reason || round.revisionReason || "",
    revisionCreatedAt: round.revisionCreatedAt || null,
    revisionCreatedByLabel: round.revisionCreatedByLabel || "",
  }));
}

export function saveChecklistState(nextState) {
  const rounds = asArray(nextState?.inspectionRounds);
  const activeRound = rounds.find((round) => round.id === nextState?.activeRoundId) || rounds[0] || null;
  const payload = clone({
    ...nextState,
    version: CURRENT_STATE_VERSION,
    // Keep the old aliases derived from the canonical rounds so an older
    // static client cannot display a stale pre-correction history record.
    inspectionHistory: compatibilityHistoryFromRounds(rounds),
    inspectionWorkspaces: compatibilityWorkspacesFromRounds(rounds),
    items: activeRound?.inspectionItems || {},
    inspectionSnapshot: activeRound?.snapshot || null,
    meta: activeRound?.meta || { ...defaultMeta },
  });
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  return payload;
}
