// Item-level inspection statuses that mean there is no evidence work to do
// for the current inspection round. These statuses are different from an
// item being structurally non-applicable in the immutable Snapshot.
export const EVIDENCE_BYPASS_ITEM_STATUSES = Object.freeze(["na", "not-installed"]);

export function isEvidenceBypassItemStatus(status) {
  return EVIDENCE_BYPASS_ITEM_STATUSES.includes(status);
}

export function isReportHiddenItemStatus(status) {
  return isEvidenceBypassItemStatus(status);
}
