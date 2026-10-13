export const VEHICLE_SAMPLE_ELIGIBILITY_POLICY_VERSION = "plate-evidence-v2";

export const VEHICLE_SAMPLE_ELIGIBILITY_OPTIONS = Object.freeze([
  { value: "no-image", label: "ไม่มีภาพจากต้นทาง" },
  { value: "image-unavailable", label: "เปิดภาพไม่ได้หลังลองใหม่" },
  { value: "plate-partial", label: "เห็นป้ายไม่ครบ" },
  { value: "plate-obscured", label: "ป้ายถูกบัง" },
  { value: "plate-unreadable", label: "ภาพไม่ชัดจนยืนยันเลขหรือจังหวัดไม่ได้" },
  { value: "wrong-vehicle-image", label: "ภาพเป็นรถคนละคัน" },
]);

const ELIGIBILITY_STATES = new Set(["pending", "eligible", "excluded"]);
const EXCLUSION_REASONS = new Set(VEHICLE_SAMPLE_ELIGIBILITY_OPTIONS.map(({ value }) => value));

export function normalizeVehicleSampleEligibility(value) {
  const source = value && typeof value === "object" ? value : {};
  const status = ELIGIBILITY_STATES.has(source.status) ? source.status : "pending";
  const reasonCode = status === "excluded" && EXCLUSION_REASONS.has(source.reasonCode) ? source.reasonCode : null;
  return {
    status,
    reasonCode,
    note: typeof source.note === "string" ? source.note.trim().slice(0, 500) : "",
    reviewedById: typeof source.reviewedById === "string" ? source.reviewedById : null,
    reviewedByName: typeof source.reviewedByName === "string" ? source.reviewedByName : null,
    reviewedAt: typeof source.reviewedAt === "string" ? source.reviewedAt : null,
  };
}

export function updateVehicleSampleEligibility(value, rowId, status, { reasonCode = null, note = "", reviewer = null, reviewedAt = new Date().toISOString() } = {}) {
  if (!ELIGIBILITY_STATES.has(status) || status === "pending") throw new Error("กรุณาเลือกว่าข้อมูลพร้อมคิดคะแนนหรือคัดออก");
  if (status === "excluded" && !EXCLUSION_REASONS.has(reasonCode)) throw new Error("กรุณาระบุเหตุผลที่คัดข้อมูลออก");
  if (status === "eligible" && reasonCode) throw new Error("ข้อมูลพร้อมคิดคะแนนไม่ต้องระบุเหตุผลคัดออก");
  const sourceRows = Array.isArray(value?.sourceRows) ? value.sourceRows : (value?.rows || []);
  const targetRow = sourceRows.find((row) => row.id === rowId);
  if (!targetRow) throw new Error("ไม่พบรถที่ต้องการคัดข้อมูล");
  if (status === "eligible" && ![targetRow.plateImage, targetRow.lprImage, targetRow.overviewImage].some((image) => typeof image === "string" && image.trim())) {
    throw new Error("รายการนี้ไม่มีภาพจากต้นทาง จึงพร้อมคิดคะแนนไม่ได้ กรุณาคัดออกพร้อมเหตุผล");
  }
  const sampleEligibility = normalizeVehicleSampleEligibility({
    status,
    reasonCode,
    note,
    reviewedById: reviewer?.id || null,
    reviewedByName: reviewer?.displayName || reviewer?.username || null,
    reviewedAt,
  });
  const update = (rows = []) => rows.map((row) => row.id === rowId ? { ...row, sampleEligibility } : row);
  const nextSourceRows = update(sourceRows);
  const nextRows = value?.sample?.lockedAt ? update(value.rows) : nextSourceRows;
  return {
    ...value,
    sampleEligibilityPolicyVersion: VEHICLE_SAMPLE_ELIGIBILITY_POLICY_VERSION,
    sourceRows: nextSourceRows,
    rows: nextRows,
  };
}

export function getVehicleSampleEligibilitySummary(value) {
  const rows = Array.isArray(value) ? value : (value?.sourceRows || value?.rows || []);
  const summary = {
    total: rows.length,
    pending: 0,
    eligible: 0,
    excluded: 0,
    byReason: {},
  };
  for (const row of rows) {
    const eligibility = normalizeVehicleSampleEligibility(row?.sampleEligibility);
    summary[eligibility.status] += 1;
    if (eligibility.status === "excluded" && eligibility.reasonCode) {
      summary.byReason[eligibility.reasonCode] = (summary.byReason[eligibility.reasonCode] || 0) + 1;
    }
  }
  return summary;
}
