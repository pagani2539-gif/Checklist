import { getVehicleReviewDetail, getVehicleReviewScopeForTimestamp, getVehiclePlateVerificationLabel, VEHICLE_REVIEW_REASON_OPTIONS } from "./vehicle-search.js";
import { VEHICLE_SAMPLE_ELIGIBILITY_POLICY_VERSION } from "./vehicle-sample-eligibility.js";
import { buildVehicleAnalyticsPages } from "./vehicle-review-analytics.js";
export { getPlateEvidenceComparison } from "./vehicle-review-confirmation.js";

export function orderVehicleReportPages(pages) {
  const statusOrder = { incorrect: 0, 'unable-to-verify': 1, pending: 2, correct: 3 };
  const periodOrder = { all: 0, day: 1, night: 2, unknown: 3 };
  const stage = page => page.kind === 'summary' ? 0 : page.kind === 'reasons' ? 1 : page.kind === 'analytics' ? ({ pairs: 2, lanes: 4, periods: 5, hours: 6 }[page.analytics.key] ?? 3) : page.kind === 'excluded' ? 8 : 7;
  return pages.map((page, index) => ({ page, index })).sort((a, b) => {
    const left = a.page, right = b.page;
    return stage(left) - stage(right)
      || (left.dimension === 'plate' ? 0 : 1) - (right.dimension === 'plate' ? 0 : 1)
      || (stage(left) === 7 ? (statusOrder[left.group?.key] ?? 4) - (statusOrder[right.group?.key] ?? 4) : 0)
      || (periodOrder[left.period.key] ?? 4) - (periodOrder[right.period.key] ?? 4)
      || a.index - b.index;
  }).map(entry => entry.page);
}

export function buildVehicleSnapshotEvidencePages(report, { context = null, scope = 'all', evidencePageSize = 10, problemPageSize = evidencePageSize, includeDetails = true } = {}) {
  if (!report) return [];
  if (report.systems) return report.systems.flatMap(system => orderVehicleReportPages(Object.entries(system.contexts).filter(([key]) => !context || key === context).flatMap(([key, value]) =>
    buildVehicleSnapshotEvidencePages(value, { context: key, scope, evidencePageSize, problemPageSize, includeDetails }).map(page => ({ ...page, key: `${system.key}-${key}-${page.key}`, systemKey: system.key, systemLabel: system.label })))));
  const scopes = report.scoped ? report.scopes : [report];
  const rows = scopes.flatMap(scope => scope.rows || []);
  const dimensions = report.independentContext ? [report.independentContext] : ["plate", ...((report.classificationReport?.supportsClassification || scopes.some(scope => scope.supportsClassification)) ? ["classification"] : [])];
  const pages = [];
  const periods = [{ key: "day", label: "กลางวัน" }, { key: "night", label: "กลางคืน" }, { key: "unknown", label: "ไม่พบช่วงเวลา" }];
  for (const dimension of dimensions) {
    const dimensionRows = dimension === "classification" ? (report.independentContext && report.scoped ? scopes.filter(scope => scope.scope === "day").flatMap(scope => scope.rows || []) : report.classificationReport?.rows || [...new Map(rows.map(row => [row.id, row])).values()]) : rows;
    const dimensionPeriods = dimension === "classification" ? [{ key: "day", label: "กลางวัน" }] : periods;
    for (const period of dimensionPeriods) {
      const members = dimensionRows.map((row, index) => ({ row, sequence: index + 1 })).filter(entry => dimension === "classification" ? getVehicleReviewScopeForTimestamp(entry.row.occurredAt) !== "night" : (getVehicleReviewScopeForTimestamp(entry.row.occurredAt) || "unknown") === period.key);
      if (period.key === "unknown" && !members.length) continue;
      const statusKey = dimension === "plate" ? "reviewStatus" : "classificationReviewStatus";
      const statuses = [
        { key: "correct", label: "ถูกต้อง", color: "#16a36a" },
        { key: "incorrect", label: "ไม่ถูกต้อง", color: "#e05260" },
        { key: "unable-to-verify", label: "ไม่สามารถตรวจสอบได้", color: "#e7a22c" },
        { key: "pending", label: "รอตรวจสอบ", color: "#8a9bb3" },
      ];
      const groups = statuses.map(status => ({ ...status, entries: members.filter(({ row }) => (row[statusKey] || "pending") === status.key).map(entry => {
        const detail = getVehicleReviewDetail(entry.row, dimension);
        const reason = VEHICLE_REVIEW_REASON_OPTIONS[dimension]?.find(option => option.value === detail.reasonCode)?.label || detail.reasonCode || "ยังไม่ระบุเหตุผล";
        const verificationLabel = dimension === "plate" && status.key === "unable-to-verify" ? getVehiclePlateVerificationLabel(detail) : "";
        return { ...entry, detail, reasonLabel: [reason, verificationLabel].filter(Boolean).join(" · ") };
      }) }));
      const sampleScope = dimension === "plate" || report.independentContext ? (report.scoped ? scopes.find(scope => scope.scope === period.key) : report) : report.classificationReport;
      const sample = sampleScope?.sample;
      const sampleOutcome = sampleScope?.contexts?.find?.(entry => entry.key === dimension)?.outcome || sampleScope?.outcome || report.outcome;
      const isEvidencePolicy = dimension === "plate" && sampleScope?.sampleEligibilityPolicyVersion === VEHICLE_SAMPLE_ELIGIBILITY_POLICY_VERSION;
      const excludedRows = isEvidencePolicy ? (sampleScope?.excludedRows || []).filter(row => (getVehicleReviewScopeForTimestamp(row.occurredAt) || "unknown") === period.key) : [];
      const base = {
        period,
        dimension,
        evidencePolicy: isEvidencePolicy,
        sample: sample || null,
        outcome: sampleOutcome,
        sourceCount: isEvidencePolicy ? sampleScope?.sourceCount || 0 : null,
        eligibleCount: isEvidencePolicy ? sampleScope?.eligibleCount || 0 : null,
        excludedCount: isEvidencePolicy ? sampleScope?.excludedCount || 0 : 0,
        sampleLocked: isEvidencePolicy ? Boolean(sampleScope?.sampleLocked) : Boolean(sample?.lockedAt),
        title: dimension === "plate" ? "ผลทดสอบการอ่านป้ายทะเบียน" : "ผลทดสอบการคัดแยกประเภทรถ",
        total: members.length,
        groups,
        threshold: scopes[0]?.thresholds?.[dimension] || (dimension === "plate" ? 80 : 90),
      };
      pages.push({ ...base, kind: "summary", key: `${period.key}-${dimension}-summary` });
      const problemGroups = groups.filter(group => ["incorrect", "unable-to-verify"].includes(group.key)).flatMap(group => {
        const reasons = new Map();
        for (const entry of group.entries) {
          // Keep causes, correction targets and unverifiable portions separate.
          const reasonKey = JSON.stringify([entry.detail.reasonCode || "missing-reason", entry.detail.correctionTarget || "", entry.detail.verificationScope || ""]);
          const target = entry.detail.correctionTarget === "province" ? "จังหวัด" : entry.detail.correctionTarget === "plate-number" ? "เลขทะเบียน" : "";
          const current = reasons.get(reasonKey) || { ...group, reasonKey, reasonLabel: [entry.reasonLabel, target && `อ่านผิด: ${target}`].filter(Boolean).join(" · "), entries: [] };
          current.entries.push(entry);
          reasons.set(reasonKey, current);
        }
        return [...reasons.values()];
      });
      for (let index = 0; index < Math.max(1, problemGroups.length); index += 8) pages.push({ ...base, kind: "reasons", reasonGroups: problemGroups.slice(index, index + 8), page: index / 8 + 1, pageCount: Math.max(1, Math.ceil(problemGroups.length / 8)), key: `${period.key}-${dimension}-reasons-${index}` });
      for (const group of groups) {
        const evidenceGroups = ["incorrect", "unable-to-verify"].includes(group.key) ? problemGroups.filter(problem => problem.key === group.key) : [group];
        for (const evidenceGroup of evidenceGroups) {
          const groupKey = `${period.key}-${dimension}-${group.key}-${evidenceGroup.reasonKey || "all"}`;
          const pageSize = ["incorrect", "unable-to-verify"].includes(group.key) ? problemPageSize : evidencePageSize;
          for (let index = 0; index < evidenceGroup.entries.length; index += pageSize) pages.push({ ...base, kind: "evidence", group: evidenceGroup, entries: evidenceGroup.entries.slice(index, index + pageSize), page: index / pageSize + 1, pageCount: Math.ceil(evidenceGroup.entries.length / pageSize), key: `${groupKey}-${index}` });
          if (includeDetails && ["incorrect", "unable-to-verify"].includes(group.key)) {
            for (let index = 0; index < evidenceGroup.entries.length; index += 2) pages.push({ ...base, kind: "detail", group: evidenceGroup, entries: evidenceGroup.entries.slice(index, index + 2), page: index / 2 + 1, pageCount: Math.ceil(evidenceGroup.entries.length / 2), key: `${groupKey}-detail-${index}` });
          }
        }
      }
      for (let index = 0; index < excludedRows.length; index += 10) {
        const entries = excludedRows.slice(index, index + 10).map((row, offset) => ({ row, sequence: index + offset + 1 }));
        pages.push({ ...base, title: "ภาคผนวกรายการคัดออกจากชุดคะแนน", kind: "excluded", entries, page: index / 10 + 1, pageCount: Math.ceil(excludedRows.length / 10), key: `${period.key}-plate-excluded-${index}` });
      }
    }
  }
  const selected = pages.filter(page => (!context || page.dimension === context) && (page.dimension === 'classification' || scope === 'all' || page.period.key === scope));
  const comparisonPeriods = selected.filter(page => page.kind === 'summary' && page.dimension === 'plate' && ['day', 'night'].includes(page.period.key));
  const analyticsPages = dimensions.filter(dimension => !context || dimension === context).flatMap(dimension => {
    const summaries = selected.filter(page => page.kind === "summary" && page.dimension === dimension);
    return summaries.flatMap(summary => {
      const entries = summary.groups.flatMap(group => group.entries);
      return buildVehicleAnalyticsPages(summary, entries);
    });
  });
  if (scope === 'all' && comparisonPeriods.length === 2) {
    const comparison = { ...comparisonPeriods[0], key: 'plate-comparison-summary', period: { key: 'all', label: 'กลางวัน–กลางคืน' }, periods: comparisonPeriods, total: comparisonPeriods.reduce((sum, page) => sum + page.total, 0), sample: null };
    return orderVehicleReportPages([comparison, ...analyticsPages, ...selected.filter(page => !comparisonPeriods.includes(page))]);
  }
  return orderVehicleReportPages([...selected.filter(page => page.kind === "summary"), ...analyticsPages, ...selected.filter(page => page.kind !== "summary")]);
}

export function getVehicleChartMaximum(periods) {
  return Math.ceil(Math.max(100, ...periods.map(period => period.total || 0), ...periods.flatMap(period => period.groups.map(group => group.entries.length))) / 20) * 20;
}
