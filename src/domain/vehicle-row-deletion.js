import { getDaytimeVehicleClassificationDataset, getVehicleClassificationDataset, getVehicleReviewScopeState, isVehicleReviewScopeState, normalizeVehicleSearchState, prepareVehicleReviewDatasets, updateVehicleSearchScope } from './vehicle-search.js';

export function getVehicleDeletionDataset(value, context, scopeKey, criteria = {}, options = {}) {
  return normalizeVehicleSearchState(context === 'classification' && !value?.independentContext
    ? getDaytimeVehicleClassificationDataset(value, criteria, options)
    : getVehicleReviewScopeState(value, scopeKey, criteria, options), criteria, options);
}

export function deleteVehicleReviewRow(value, context, scopeKey, rowId, criteria = {}, options = {}, guards = {}) {
  return deleteVehicleReviewRows(value, context, scopeKey, [rowId], criteria, options, guards);
}

export function deleteVehicleReviewRows(value, context, scopeKey, rowIds, criteria = {}, options = {}, guards = {}) {
  const ids = [...new Set(rowIds)];
  const current = getVehicleDeletionDataset(value, context, scopeKey, criteria, options);
  if (!ids.length || ids.some(id => !current.rows.some(row => row.id === id))) throw new Error("รายการเปลี่ยนไปแล้ว กรุณาโหลดข้อมูลล่าสุด");
  // Legacy classification includes historical night records: remove from the full dataset.
  if (context === 'classification' && !value?.independentContext) {
    const next = deleteVehiclePlateRows(getVehicleClassificationDataset(value, criteria, options), ids, guards);
    return isVehicleReviewScopeState(value) ? { ...value, classification: next } : next;
  }
  const next = deleteVehiclePlateRows(current, ids, guards);
  const datasets = prepareVehicleReviewDatasets(value, criteria, options);
  const preserved = value?.independentContext ? datasets : { ...datasets, classification: getVehicleClassificationDataset(value, criteria, options) };
  return updateVehicleSearchScope(preserved, scopeKey, next, options);
}

export function deleteVehiclePlateRow(dataset, rowId, guards = {}) { return deleteVehiclePlateRows(dataset, [rowId], guards); }

export function deleteVehiclePlateRows(dataset, rowIds, { readOnly = false, roundStatus, now = new Date().toISOString() } = {}) {
  if (readOnly || roundStatus === 'closed') throw new Error('รอบที่ปิดแล้วไม่สามารถลบรายการได้');
  const ids = new Set(rowIds);
  if (!ids.size || [...ids].some(id => !dataset.rows?.some(row => row.id === id))) throw new Error('รายการเปลี่ยนไปแล้ว กรุณาโหลดข้อมูลล่าสุด');
  const rows = dataset.rows.filter(row => !ids.has(row.id));
  const sourceRows = (dataset.sourceRows || dataset.rows).filter(row => !ids.has(row.id));
  return { ...dataset, rows, sourceRows, emptyResultAcknowledgedAt: null,
    pagination: { ...dataset.pagination, totalItems: sourceRows.length },
    sample: { ...(dataset.sample || {}), version: dataset.sample?.version || 'vehicle-sample-v1', method: 'manually-adjusted', lockedAt: dataset.sample?.lockedAt || now,
      adjustedAt: now, deletedRowCount: (dataset.sample?.deletedRowCount || 0) + ids.size,
      sourceCount: sourceRows.length, selectedIds: rows.map(row => row.id) }
  };
}
