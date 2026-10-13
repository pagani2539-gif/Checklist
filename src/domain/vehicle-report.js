import { isSystemVehicleRound, projectVehicleRound } from "./vehicle-review-systems.js";
import { getRoundVehicleSearchConfig } from './round-vehicle-connection.js';
import {
  getVehicleReviewContextByKey,
  getDaytimeVehicleClassificationDataset,
  getVehicleReviewDetail,
  getVehiclePlateVerificationLabel,
  getVehicleReviewOutcome,
  getVehicleReviewRows,
  getVehicleReviewScopeEntries,
  getVehicleSearchIssueRows,
  getVehicleSearchReviewSummary,
  isVehicleReviewScopeState,
  VEHICLE_API_REVIEW_LEGACY_VERSION,
  VEHICLE_API_REVIEW_VERSION,
  VEHICLE_REVIEW_REASON_OPTIONS,
  VEHICLE_REVIEW_THRESHOLDS,
} from "./vehicle-search.js";

const EMPTY_DIMENSION_SUMMARY = Object.freeze({
  total: 0,
  reviewed: 0,
  decided: 0,
  correct: 0,
  incorrect: 0,
  unableToVerify: 0,
  pending: 0,
  accuracy: null,
  reviewedAccuracy: null,
});

function asTime(value) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function latestValue(values, selector) {
  return values.reduce((latest, value) => {
    const candidate = selector(value);
    return candidate && (!latest || asTime(candidate) > asTime(latest)) ? candidate : latest;
  }, null);
}

function getExampleOptions(rows, statusKey, status, dimensionKey) {
  const eligibleRows = rows.filter((row) => row?.[statusKey] === status);
  eligibleRows.sort((left, right) => {
    const leftDetail = getVehicleReviewDetail(left, dimensionKey);
    const rightDetail = getVehicleReviewDetail(right, dimensionKey);
    return asTime(rightDetail.reviewedAt || right.occurredAt) - asTime(leftDetail.reviewedAt || left.occurredAt);
  });
  return eligibleRows.map((row) => {
    const detail = getVehicleReviewDetail(row, dimensionKey);
    const reasonLabel = VEHICLE_REVIEW_REASON_OPTIONS[dimensionKey]
      ?.find((option) => option.value === detail.reasonCode)?.label || detail.reasonCode || "";
    const imageUrl = dimensionKey === "plate"
      ? row.plateImage || row.lprImage || ""
      : row.overviewImage || "";
    const verificationLabel = dimensionKey === "plate" && status === "unable-to-verify" ? getVehiclePlateVerificationLabel(detail) : "";
    return { status, row, detail, reasonLabel: [reasonLabel, verificationLabel].filter(Boolean).join(" · "), imageUrl };
  });
}

function buildReasonSummary(issues) {
  const grouped = new Map();
  for (const issue of issues) {
    const key = `${issue.status}:${issue.reasonCode || "missing-reason"}`;
    const current = grouped.get(key) || {
      status: issue.status,
      reasonCode: issue.reasonCode || "missing-reason",
      label: issue.reasonLabel || "ไม่ระบุสาเหตุ",
      count: 0,
    };
    current.count += 1;
    grouped.set(key, current);
  }
  return [...grouped.values()].sort((left, right) =>
    right.count - left.count || left.label.localeCompare(right.label, "th"));
}

/**
 * Build a report view model from a round's saved Vehicle API review data.
 * The model is derived at read time and does not modify the round or Snapshot.
 */
export function buildVehicleApiReportModel(round, { context = "plate", scope = "all", systemKey = "" } = {}) {
  if (isSystemVehicleRound(round) && !round.snapshot.vehicleReviewSystemKey) {
    const projected = projectVehicleRound(round, systemKey || round.snapshot.vehicleReviewSystems[0]?.key, context);
    if (!projected) throw new Error("ไม่มีงานตรวจรถของระบบนี้");
    round = projected;
  }
  const contextOption = getVehicleReviewContextByKey(context) || getVehicleReviewContextByKey("plate");
  const contextKey = contextOption.key;
  const snapshot = round?.snapshot || {};
  const fallbackCriteria = {
    dateFrom: round?.meta?.inspectionDate,
    dateTo: round?.meta?.inspectionDate,
    stationCode: snapshot.stationCode,
  };
  const config = getRoundVehicleSearchConfig(round);
  const vehicleSearch = contextKey === "classification" && !round?.vehicleSearch?.independentContext ? getDaytimeVehicleClassificationDataset(round?.vehicleSearch, fallbackCriteria, { baseUrl: config.baseUrl, apiProfile: config.apiProfile }) : round?.vehicleSearch;
  const allEntries = getVehicleReviewScopeEntries(vehicleSearch, fallbackCriteria, {
    baseUrl: config.baseUrl,
    apiProfile: config.apiProfile,
  });
  const selectedEntry = scope !== "all" && allEntries.length > 1
    ? allEntries.find((entry) => entry.key === scope)
    : null;
  const entries = selectedEntry ? [selectedEntry] : allEntries;
  const reportValue = selectedEntry?.state || vehicleSearch;
  const reviewVersion = snapshot.vehicleReviewVersion || VEHICLE_API_REVIEW_LEGACY_VERSION;
  const fullSummary = getVehicleSearchReviewSummary(reportValue, { reviewVersion, context: contextKey });
  const dimensionSummary = fullSummary.dimensions?.[contextKey]
    || fullSummary[contextKey]
    || EMPTY_DIMENSION_SUMMARY;
  const outcome = getVehicleReviewOutcome(reportValue, { reviewVersion, context: contextKey });
  const contextSupported = contextKey !== "classification" || reviewVersion === VEHICLE_API_REVIEW_VERSION;
  const sampleQualified = !contextSupported
    ? false
    : selectedEntry
      ? outcome.sampleQualified
      : Array.isArray(outcome.scopes)
        ? outcome.scopes.every((scopeOutcome) => scopeOutcome.sampleQualified)
        : outcome.sampleQualified;
  const rows = entries.flatMap((entry) => getVehicleReviewRows(entry.state));
  const issues = entries.flatMap((entry) => getVehicleSearchIssueRows(entry.state, {
    reviewVersion,
    context: contextKey,
  }));
  const selectedScope = selectedEntry || (isVehicleReviewScopeState(vehicleSearch)
    ? { key: "all", label: "ทุกช่วงเวลา", timeLabel: "กลางวันและกลางคืน" }
    : allEntries[0]);
  const sourceStation = entries.map((entry) => entry.state?.sourceStation).find(Boolean) || {};
  const criteria = selectedEntry?.state?.criteria || {
    startAt: entries.map((entry) => entry.state?.criteria?.startAt).filter(Boolean).sort()[0] || null,
    endAt: entries.map((entry) => entry.state?.criteria?.endAt).filter(Boolean).sort().at(-1) || null,
  };
  const fetchedAt = selectedEntry
    ? selectedEntry.state?.fetchedAt || null
    : latestValue(entries.map((entry) => entry.state), (entry) => entry?.fetchedAt);
  const dimension = contextKey === "classification" ? "classificationReviewStatus" : "reviewStatus";
  const exampleStatuses = ["correct", "incorrect", "unable-to-verify"];
  const exampleOptions = Object.fromEntries(exampleStatuses.map((status) => [
    status,
    getExampleOptions(rows, dimension, status, contextKey),
  ]));
  const examples = exampleStatuses.map((status) => ({
    ...(exampleOptions[status][0] || { status, row: null, detail: null, reasonLabel: "", imageUrl: "" }),
    title: status === "correct" ? "ตรวจถูก" : status === "incorrect" ? "ตรวจผิด" : "ตรวจไม่ได้",
  }));
  const total = dimensionSummary.total || 0;
  const reviewed = dimensionSummary.reviewed || 0;
  const recorded = dimensionSummary.decided || 0;
  const usesEvidenceEligibility = contextKey === "plate" && entries.some((entry) => entry.state?.sampleEligibilityPolicyVersion === "plate-evidence-v2" || entry.state?.sample?.eligibilityPolicyVersion === "plate-evidence-v2");
  const threshold = contextSupported ? VEHICLE_REVIEW_THRESHOLDS[contextKey] ?? null : null;
  const statusLabel = !contextSupported
    ? "Snapshot นี้ไม่มีผลตรวจคัดประเภทรถ"
    : !fetchedAt
      ? "ยังไม่ได้ดึงข้อมูลจาก API"
    : !total
      ? "ยังไม่มีข้อมูลรถในช่วงนี้"
      : outcome.status === "incomplete"
        ? "ยังสรุปผลรอบไม่ได้"
        : outcome.label;
  const reportOutcome = contextSupported
    ? { ...outcome, label: statusLabel, sampleQualified }
    : {
      ...outcome,
      status: "incomplete",
      label: statusLabel,
      sampleQualified: false,
      reasons: [{ code: "context-not-recorded", label: "รอบนี้ไม่มีการตรวจคัดประเภทรถใน Snapshot" }],
    };

  return {
    roundId: round?.id || "",
    contextSupported,
    context: { key: contextKey, label: contextOption.label, checklistNumber: contextOption.checklistNumber },
    scope: { key: selectedScope?.key || "all", label: selectedScope?.label || "ทุกช่วงเวลา", timeLabel: selectedScope?.timeLabel || "" },
    summary: {
      total,
      correct: dimensionSummary.correct || 0,
      incorrect: dimensionSummary.incorrect || 0,
      unableToVerify: dimensionSummary.unableToVerify || 0,
      pending: dimensionSummary.pending || 0,
      reviewed,
      recorded,
      accuracy: total && recorded ? Number(((dimensionSummary.correct / total) * 100).toFixed(2)) : null,
      accuracyDisplay: total && recorded ? ((dimensionSummary.correct / total) * 100).toFixed(2) : null,
      completionPercent: total ? Math.round((recorded / total) * 100) : null,
      threshold,
    },
    outcome: reportOutcome,
    reasons: buildReasonSummary(issues),
    examples,
    exampleOptions,
    metadata: {
      stationCode: sourceStation.id || snapshot.stationCode || "—",
      stationName: sourceStation.name || snapshot.stationName || "—",
      criteria,
      fetchedAt,
      rowCount: rows.length,
      pageCount: entries.reduce((sum, entry) => sum + (entry.state?.pagination?.totalPages || 0), 0),
      inspectionDate: round?.meta?.inspectionDate || snapshot.createdAt || null,
      generatedAt: new Date().toISOString(),
      reviewMethod: "ผู้ตรวจเทียบผลจาก API กับภาพประกอบ",
      roundStatus: round?.status || "draft",
      reviewVersion,
    },
    rows,
    issues,
  };
}
