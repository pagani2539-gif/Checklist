import { isEvidenceBypassItemStatus } from './inspection-status.js';

// Display-only summary. Never changes the stored Snapshot or attachment metadata.
export function getChecklistCompletion(items, values, isEvidenceComplete, equipment = []) {
  const groups = new Map(equipment.filter(asset => asset.active !== false && asset.recordKind !== 'system').map(asset => [asset.id, { id: asset.id, label: asset.assetNo || asset.catalogItemLabel || asset.type, total: 0, complete: 0, skipped: 0, started: false, firstPendingId: null }]));
  const pendingItems = [];
  let skipped = 0;
  for (const item of items.filter(entry => entry.applicable !== false)) {
    const value = values[item.id] || {};
    const bypassed = isEvidenceBypassItemStatus(value.status);
    const reasonMissing = bypassed && !String(value.note || '').trim();
    const resultMissing = !value.status || value.status === 'pending';
    const evidenceMissing = !bypassed && (item.evidenceSlots || []).some(slot => slot.required !== false && !isEvidenceComplete(slot, value.evidence?.[slot.id]));
    if (bypassed) skipped += 1;
    const complete = !resultMissing && !evidenceMissing && !reasonMissing;
    if (!complete) pendingItems.push({ item, reason: resultMissing ? 'ยังไม่มีผลตรวจ' : reasonMissing ? 'ยังไม่ระบุเหตุผลที่ข้าม' : 'หลักฐานยังไม่ครบ' });
    if (!item.assetId) continue;
    const group = groups.get(item.assetId) || { id: item.assetId, label: item.assetNo || item.assetName || item.label, total: 0, complete: 0, skipped: 0, started: false, firstPendingId: null };
    group.total += 1;
    group.complete += Number(complete);
    group.skipped += Number(bypassed);
    group.issues = (group.issues || 0) + Number(['damaged', 'waiting'].includes(value.status));
    group.started ||= !resultMissing;
    if (!complete && !group.firstPendingId) group.firstPendingId = item.id;
    groups.set(item.assetId, group);
  }
  const assets = [...groups.values()].map(group => ({ ...group, status: !group.total ? 'ไม่มีรายการตรวจที่เปิดใช้' : group.complete === group.total ? group.skipped === group.total ? 'ข้ามพร้อมเหตุผล' : group.issues ? 'ตรวจครบ · ต้องติดตาม' : group.skipped ? 'ครบตามขอบเขต · มีรายการข้าม' : 'ตรวจครบ' : group.started ? 'กำลังตรวจ' : 'ยังไม่เริ่ม' }));
  return { assets, assetTotal: assets.length, assetUncovered: assets.filter(group => !group.total).length, assetComplete: assets.filter(group => group.total > 0 && group.complete === group.total && group.skipped !== group.total).length, assetSkipped: assets.filter(group => group.total > 0 && group.skipped === group.total && group.complete === group.total).length, pendingItems, skipped };
}

export function canUseNotInstalled(item) {
  // Personnel and readiness activities are not installed equipment.
  return Boolean(item?.assetId || item?.systemRecordId || item?.assetType || item?.equipmentType);
}
