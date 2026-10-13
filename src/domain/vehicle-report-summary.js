export const VEHICLE_REPORT_STATUS_LABELS = Object.freeze({ correct: 'ถูกต้อง', incorrect: 'ไม่ถูกต้อง', 'unable-to-verify': 'ไม่สามารถตรวจสอบได้', pending: 'รอตรวจสอบ' });

export function getVehicleReportScore(period) {
  const correct = period.groups.find(group => group.key === 'correct')?.entries.length || 0;
  const incorrect = period.groups.find(group => group.key === 'incorrect')?.entries.length || 0;
  const decided = correct + incorrect;
  const unable = period.groups.find(group => group.key === 'unable-to-verify')?.entries.length || 0;
  const recorded = decided + unable;
  const denominator = period.total;
  const pending = period.groups.find(group => group.key === 'pending')?.entries.length || 0;
  const evidencePolicy = period.evidencePolicy || (period.sample?.version === 'vehicle-sample-v2' && period.sample?.eligibilityPolicyVersion);
  const accuracy = denominator && recorded ? Number((correct / denominator * 100).toFixed(2)) : null;
  const display = accuracy === null ? '—' : `${accuracy.toFixed(2)}%`;
  const insufficient = evidencePolicy && period.outcome?.dataSufficient === false;
  const status = insufficient ? 'ยังไม่สามารถสรุปผลได้' : period.outcome?.status === 'passed' ? 'ผ่านเกณฑ์' : period.outcome?.status === 'failed' ? 'ไม่ผ่านเกณฑ์' : 'ยังไม่สามารถสรุปผลได้';
  const reason = status !== 'ยังไม่สามารถสรุปผลได้' ? '' : insufficient ? 'ข้อมูลไม่เพียงพอสำหรับการทดสอบ' : evidencePolicy && !period.sampleLocked ? 'ยังไม่ได้ล็อกชุดคะแนน' : accuracy === null ? 'ยังไม่มีผลตัดสิน' : pending ? 'ยังมีรายการรอตรวจสอบ' : 'ต้องพิจารณาเงื่อนไขการทดสอบครบทุกข้อ';
  return { correct, decided, recorded, denominator, pending, evidencePolicy, accuracy, display, status, reason };
}
