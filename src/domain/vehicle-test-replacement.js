import { normalizeThaiDateTimeInput, parseThaiDateTimeInput } from "./date-time.js";
import { filterVehicleSearchRowsByTimeRange, getVehicleClassificationDataset, getVehicleReviewScopeForTimestamp, normalizeVehicleSearchState, prepareVehicleReviewDatasets, updateVehicleSearchScope } from "./vehicle-search.js";
import { selectVehicleTestSample } from "./vehicle-sampling.js";
import { VEHICLE_SAMPLE_ELIGIBILITY_POLICY_VERSION } from "./vehicle-sample-eligibility.js";

export function validateVehicleTestReplacement({ context, scopeKey, criteria, limit }) {
  if (!["plate", "classification"].includes(context)) throw new Error("ไม่พบงานตรวจที่ต้องการเปลี่ยนชุด");
  if (context === "plate" && !["day", "night"].includes(scopeKey)) throw new Error("กรุณาเลือกชุดกลางวันหรือกลางคืน");
  if (![0, 100].includes(limit)) throw new Error("กรุณาเลือกใช้ทุกคันหรือสุ่มกระจาย 100 คัน");
  const normalized = { startAt: normalizeThaiDateTimeInput(criteria?.startAt), endAt: normalizeThaiDateTimeInput(criteria?.endAt) };
  const start = parseThaiDateTimeInput(normalized.startAt);
  const end = parseThaiDateTimeInput(normalized.endAt);
  if (!start || !end || normalized.endAt <= normalized.startAt) throw new Error("กรุณาเลือกวันเวลาให้ถูกต้อง โดยเวลาสิ้นสุดต้องหลังเวลาเริ่ม");
  if (context === "plate") {
    const startTime = Date.parse(`${normalized.startAt}:00+07:00`);
    const endTime = Date.parse(`${normalized.endAt}:00+07:00`);
    const dayStart = startTime - (start.hour * 60 + start.minute) * 60000;
    const shiftEnd = dayStart + (scopeKey === "day" ? 18 : start.hour >= 18 ? 30 : 6) * 3600000;
    if (getVehicleReviewScopeForTimestamp(normalized.startAt) !== scopeKey || endTime > shiftEnd) {
      throw new Error(scopeKey === "day" ? "ชุดกลางวันต้องอยู่ในช่วง 06:00–18:00 ของวันเดียวกัน" : "ชุดกลางคืนต้องอยู่ในช่วง 18:00–06:00 โดยไม่ข้ามช่วงกลางวัน");
    }
  }
  return normalized;
}

// Build a new current dataset only after the API result is available.
// Other datasets keep their original reviews; no previous test sets are added.
export function replaceVehicleTestDataset(current, result, request, options = {}) {
  if (request.readOnly || request.roundStatus === "closed") throw new Error("รอบที่ปิดแล้วไม่สามารถเปลี่ยนชุดทดสอบได้");
  if (current?.independentContext === "classification" && request.scopeKey !== "day") throw new Error("คัดแยกประเภทรถใช้เฉพาะชุดกลางวัน");
  if (request.context === "classification" || current?.independentContext === "classification") validateVehicleTestReplacement({ ...request, context: "plate", scopeKey: "day" });
  const currentPlateDataset = current?.independentContext === "classification" ? null : current?.scopes?.[request.scopeKey] || current;
  if (request.context === "plate" && currentPlateDataset?.sample?.version === "vehicle-sample-v2" && currentPlateDataset.sample.lockedAt && currentPlateDataset.rows?.some((row) => row.reviewStatus && row.reviewStatus !== "pending")) {
    throw new Error("เริ่มตรวจชุดคะแนนแล้ว จึงเปลี่ยนรายการไม่ได้ · สร้างรอบตรวจใหม่เพื่อรักษาผลและหลักฐานเดิม");
  }
  const criteria = validateVehicleTestReplacement(request);
  const normalizedResult = normalizeVehicleSearchState({ ...result, criteria }, {}, options);
  if (!normalizedResult.fetchedAt) throw new Error("ยังไม่มีผลข้อมูลใหม่จาก API");
  const matching = filterVehicleSearchRowsByTimeRange(normalizedResult.rows, criteria);
  const scoped = (request.context === "plate" || current?.independentContext) ? matching.filter(row => getVehicleReviewScopeForTimestamp(row.occurredAt) === request.scopeKey) : matching;
  if (!scoped.length) throw new Error("ไม่พบรถในช่วงที่เลือก จึงยังไม่แทนชุดทดสอบเดิม กรุณาเลือกช่วงเวลาใหม่");
  const rows = scoped.map(row => ({ ...row, reviewStatus: "pending", classificationReviewStatus: "pending", axleReviewStatus: "pending", integrityReviewStatus: "pending", reviewDetails: {} }));
  const dataset = { ...normalizedResult, rows, sourceRows: rows, sample: null, emptyResultAcknowledgedAt: null, pagination: { ...normalizedResult.pagination, totalItems: rows.length } };
  const isPlateDataset = request.context === "plate" && current?.independentContext !== "classification";
  const nextDataset = isPlateDataset && options.plateEligibilityEnabled === true
    ? (() => { const pendingRows = rows.map((row) => ({ ...row, sampleEligibility: { status: "pending", reasonCode: null, note: "", reviewedById: null, reviewedByName: null, reviewedAt: null } })); return { ...dataset, sampleEligibilityPolicyVersion: VEHICLE_SAMPLE_ELIGIBILITY_POLICY_VERSION, rows: pendingRows, sourceRows: pendingRows }; })()
    : selectVehicleTestSample(dataset, { limit: request.limit, ...(options.seed ? { seed: options.seed } : {}) });
  const datasets = prepareVehicleReviewDatasets(current, {}, options);
  if (current?.independentContext) return updateVehicleSearchScope(datasets, request.scopeKey, nextDataset, options);
  const independent = { ...datasets, classification: getVehicleClassificationDataset(current, {}, options) };
  return request.context === "classification"
    ? { ...independent, classification: nextDataset }
    : updateVehicleSearchScope(independent, request.scopeKey, nextDataset, options);
}
