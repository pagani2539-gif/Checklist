export const CORRECTION_EDITOR_ID = "local-browser-user";
export const CORRECTION_EDITOR_LABEL = "ผู้ใช้เครื่องนี้";
export const REVISION_EDITOR_LABEL = CORRECTION_EDITOR_LABEL;
export const CORRECTION_REASON_MIN_LENGTH = 1;
export const CORRECTION_REASON_MAX_LENGTH = 500;

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function fallbackCorrectionId(index) {
  return `correction-legacy-${index + 1}`;
}

export function normalizeCorrectionHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object") return null;
    const reason = String(entry.reason || "").trim();
    if (!reason) return null;
    return {
      id: String(entry.id || fallbackCorrectionId(index)),
      reason: reason.slice(0, CORRECTION_REASON_MAX_LENGTH),
      editedAt: entry.editedAt || null,
      editedBy: String(entry.editedBy || CORRECTION_EDITOR_ID),
    };
  }).filter(Boolean);
}

export function getCorrectionSummary(round) {
  const history = normalizeCorrectionHistory(round?.correctionHistory);
  const latest = history[history.length - 1] || null;
  return {
    count: history.length,
    latestAt: latest?.editedAt || null,
    latestReason: latest?.reason || "",
    latestEditor: latest?.editedBy || CORRECTION_EDITOR_ID,
  };
}

export function cloneRoundForCorrection(round) {
  if (!round || typeof round !== "object") return null;
  return clone({
    ...round,
    snapshot: clone(round.snapshot),
    inspectionItems: clone(round.inspectionItems || {}),
    vehicleSearch: clone(round.vehicleSearch || {}),
    meta: clone(round.meta || {}),
    correctionHistory: normalizeCorrectionHistory(round.correctionHistory),
  });
}

/**
 * Create a new draft from a closed round. The source round is never mutated;
 * its Snapshot and inspection values are cloned into a separately identified
 * revision so History remains a stable, read-only record.
 */
export function createRevisionRound(original, { reason, createdAt = new Date().toISOString(), createdByLabel = REVISION_EDITOR_LABEL } = {}) {
  if (!original || original.status !== "closed") throw new Error("สร้างฉบับแก้ไขได้เฉพาะรอบที่ปิดแล้ว");
  const validation = validateCorrectionReason(reason);
  if (!validation.valid) throw new Error(validation.error);
  const previousRevisionNumber = Number(original.revisionNumber || 0);
  const revisionNumber = previousRevisionNumber + 1;
  const source = cloneRoundForCorrection(original);
  return {
    ...source,
    id: `round-revision-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    status: "draft",
    createdAt,
    updatedAt: createdAt,
    closedAt: null,
    basedOnRoundId: original.id,
    revisionNumber,
    revisionReason: validation.reason,
    reason: validation.reason,
    revisionCreatedAt: createdAt,
    revisionCreatedByLabel: String(createdByLabel || REVISION_EDITOR_LABEL),
    correctionHistory: [],
  };
}

function correctionFields(round) {
  return {
    meta: round?.meta || {},
    inspectionItems: round?.inspectionItems || {},
    vehicleSearch: round?.vehicleSearch || {},
  };
}

export function hasCorrectionChanges(original, draft) {
  return JSON.stringify(correctionFields(original)) !== JSON.stringify(correctionFields(draft));
}

export function validateCorrectionReason(reason) {
  const normalized = String(reason || "").trim();
  if (normalized.length < CORRECTION_REASON_MIN_LENGTH) return { valid: false, reason: normalized, error: "กรุณาระบุเหตุผลการแก้ไขย้อนหลัง" };
  if (normalized.length > CORRECTION_REASON_MAX_LENGTH) return { valid: false, reason: normalized, error: `เหตุผลการแก้ไขย้อนหลังต้องไม่เกิน ${CORRECTION_REASON_MAX_LENGTH} ตัวอักษร` };
  return { valid: true, reason: normalized, error: "" };
}

export function applyCorrection(original, draft, { reason, editedAt = new Date().toISOString(), editedBy = CORRECTION_EDITOR_ID } = {}) {
  if (!original || original.status !== "closed") throw new Error("แก้ย้อนหลังได้เฉพาะรอบที่ปิดแล้ว");
  const validation = validateCorrectionReason(reason);
  if (!validation.valid) throw new Error(validation.error);
  if (!hasCorrectionChanges(original, draft)) return { changed: false, round: original, event: null };

  const event = {
    id: `correction-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    reason: validation.reason,
    editedAt,
    editedBy,
  };
  return {
    changed: true,
    event,
    round: {
      ...original,
      status: "closed",
      closedAt: original.closedAt || original.createdAt || editedAt,
      updatedAt: editedAt,
      meta: clone(draft?.meta || original.meta || {}),
      inspectionItems: clone(draft?.inspectionItems || original.inspectionItems || {}),
      vehicleSearch: clone(draft?.vehicleSearch || original.vehicleSearch || {}),
      snapshot: clone(original.snapshot),
      correctionHistory: [...normalizeCorrectionHistory(original.correctionHistory), event],
    },
  };
}
