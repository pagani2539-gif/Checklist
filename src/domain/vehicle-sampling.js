import { VEHICLE_SAMPLE_ELIGIBILITY_POLICY_VERSION, getVehicleSampleEligibilitySummary } from "./vehicle-sample-eligibility.js";

function timestamp(row) {
  const value = String(row.occurredAt || '');
  const parsed = Date.parse(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? `${value}:00+07:00` : value);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function randomFromSeed(seed) {
  let state = 2166136261;
  for (const letter of seed) state = Math.imul(state ^ letter.charCodeAt(0), 16777619) >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = Math.imul(state ^ state >>> 15, 1 | state);
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

export function selectVehicleTestSample(dataset, { limit = 100, seed = crypto.randomUUID(), lockedAt = new Date().toISOString(), requireEligibility = false } = {}) {
  if (dataset.sample?.lockedAt) return dataset;
  if (!Number.isFinite(limit) || limit < 0) throw new Error('จำนวนรถในชุดทดสอบไม่ถูกต้อง');
  const sourceRows = [...(dataset.sourceRows || dataset.rows || [])].sort((a,b)=>timestamp(a)-timestamp(b)||String(a.id).localeCompare(String(b.id)));
  if (!sourceRows.length) return dataset;
  const eligibilitySummary = getVehicleSampleEligibilitySummary(sourceRows);
  if (requireEligibility && eligibilitySummary.pending) throw new Error(`ยังคัดข้อมูลต้นทางไม่ครบ ${eligibilitySummary.pending} คัน`);
  const candidates = requireEligibility ? sourceRows.filter((row) => row.sampleEligibility?.status === "eligible") : sourceRows;
  const count = limit === 0 ? candidates.length : Math.min(Math.max(1, Math.floor(limit)), candidates.length);
  if (count < sourceRows.length && sourceRows.some(row=>row.reviewStatus && row.reviewStatus !== 'pending')) throw new Error('เริ่มตรวจแล้ว จึงเปลี่ยนชุดทดสอบไม่ได้ ให้สร้างชุดใหม่เพื่อคงผลตรวจเดิม');
  const random = randomFromSeed(String(seed));
  const rows = Array.from({length:count}, (_,index)=>{
    const start = Math.floor(index*candidates.length/count);
    const end = Math.floor((index+1)*candidates.length/count);
    return candidates[start+Math.floor(random()*(end-start))];
  });
  return { ...dataset, sourceRows, rows, sample: { version: requireEligibility ? 'vehicle-sample-v2' : 'vehicle-sample-v1', ...(requireEligibility ? { eligibilityPolicyVersion: VEHICLE_SAMPLE_ELIGIBILITY_POLICY_VERSION, eligibleCount: eligibilitySummary.eligible, excludedCount: eligibilitySummary.excluded } : {}), method:limit===0?'all':'time-stratified-v1', limit, seed:String(seed), lockedAt, sourceCount:sourceRows.length, selectedIds:rows.map(row=>row.id) } };
}
