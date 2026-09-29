export const STATION_INSPECTION_REPORT_SCHEMA_VERSION = 1;

export const REPORT_COVER_REQUIRED_FIELDS = Object.freeze([
  "reportTitle",
  "projectName",
  "contractNo",
]);

export const REPORT_COVER_FIELD_LABELS = Object.freeze({
  reportTitle: "ชื่อรายงาน",
  projectName: "ชื่อโครงการ",
  contractNo: "เลขที่สัญญา",
});

const LEGACY_REPORT_COVER_FIELDS = Object.freeze([
  ...Object.keys(REPORT_COVER_FIELD_LABELS),
  "contractDate",
  "contractStartDate",
  "contractEndDate",
  "agency",
  "contractor",
  "inspector",
  "preparedBy",
  "approvedBy",
  "approvalDate",
]);

const text = (value) => String(value ?? "").trim();
const asArray = (value) => Array.isArray(value) ? value : [];
const hasValues = (value) => Object.values(value || {}).some((entry) => text(entry));

export function normalizeReportCoverMeta(value = {}) {
  return Object.fromEntries(Object.keys(REPORT_COVER_FIELD_LABELS).map((key) => [key, text(value?.[key])]));
}

function normalizeIssuedVersion(value, roundId, index) {
  if (!value || typeof value !== "object") return null;
  // Keep the original cover details on already-issued revisions. New/editable
  // cover metadata is intentionally limited to the fields used on the cover.
  const coverMeta = Object.fromEntries(LEGACY_REPORT_COVER_FIELDS.map((key) => [key, text(value.coverMeta?.[key])]));
  return {
    id: text(value.id) || `station-report-${roundId}-v${Number(value.version) || index + 1}`,
    version: Math.max(1, Number(value.version) || index + 1),
    roundId,
    companyId: text(value.companyId),
    format: value.format === "presentation" ? "presentation" : "standard",
    templateId: text(value.templateId),
    templateSchemaVersion: text(value.templateSchemaVersion),
    coverMeta,
    generatedAt: text(value.generatedAt || value.createdAt),
  };
}

export function normalizeStationInspectionReport(value, index = 0) {
  if (!value || typeof value !== "object") return null;
  const roundId = text(value.roundId);
  if (!roundId) return null;
  return {
    id: text(value.id) || `station-report-${roundId || index + 1}`,
    roundId,
    schemaVersion: STATION_INSPECTION_REPORT_SCHEMA_VERSION,
    coverMeta: normalizeReportCoverMeta(value.coverMeta),
    revisions: asArray(value.revisions)
      .map((revision, revisionIndex) => normalizeIssuedVersion(revision, roundId, revisionIndex))
      .filter(Boolean)
      .sort((a, b) => a.version - b.version),
    createdAt: text(value.createdAt),
    updatedAt: text(value.updatedAt),
  };
}

function legacyCoverForRound(round) {
  const meta = round?.meta || {};
  const saved = normalizeReportCoverMeta(meta.reportCover);
  return normalizeReportCoverMeta({
    ...saved,
    reportTitle: saved.reportTitle || meta.reportTitle,
    projectName: saved.projectName || meta.projectName,
    contractNo: saved.contractNo || meta.contractNo,
  });
}

export function normalizeStationInspectionReports(values, rounds = null, { migrateLegacyCovers = true } = {}) {
  const knownRounds = Array.isArray(rounds) ? rounds : null;
  const validRoundIds = new Set(asArray(knownRounds).map((round) => text(round?.id)).filter(Boolean));
  const byRound = new Map();
  asArray(values).forEach((value, index) => {
    const normalized = normalizeStationInspectionReport(value, index);
    if (!normalized || (knownRounds && !validRoundIds.has(normalized.roundId))) return;
    const existing = byRound.get(normalized.roundId);
    if (!existing) {
      byRound.set(normalized.roundId, normalized);
      return;
    }
    const revisionsById = new Map([...existing.revisions, ...normalized.revisions].map((revision) => [revision.id, revision]));
    const newer = Date.parse(normalized.updatedAt || normalized.createdAt || "") > Date.parse(existing.updatedAt || existing.createdAt || "");
    const selected = newer ? normalized : existing;
    const other = newer ? existing : normalized;
    byRound.set(normalized.roundId, {
      ...selected,
      coverMeta: normalizeReportCoverMeta(Object.fromEntries(Object.keys(REPORT_COVER_FIELD_LABELS).map((key) => [key, selected.coverMeta[key] || other.coverMeta[key]]))),
      revisions: [...revisionsById.values()].sort((a, b) => a.version - b.version),
    });
  });

  if (!migrateLegacyCovers) return [...byRound.values()];

  asArray(rounds).forEach((round) => {
    const roundId = text(round?.id);
    if (!roundId || byRound.has(roundId)) return;
    const coverMeta = legacyCoverForRound(round);
    if (!hasValues(coverMeta)) return;
    byRound.set(roundId, normalizeStationInspectionReport({
      roundId,
      coverMeta,
      createdAt: text(round.createdAt),
      updatedAt: text(round.updatedAt),
    }));
  });

  return [...byRound.values()];
}

export function stationInspectionReportForRound(state, roundId) {
  return asArray(state?.stationInspectionReports).find((entry) => entry?.roundId === roundId) || null;
}

export function saveStationInspectionReportCover(state, roundId, coverMeta, updatedAt = new Date().toISOString()) {
  const id = `station-report-${roundId}`;
  const reports = asArray(state?.stationInspectionReports);
  const existing = stationInspectionReportForRound(state, roundId);
  const report = normalizeStationInspectionReport({
    ...(existing || {}),
    id: existing?.id || id,
    roundId,
    coverMeta: normalizeReportCoverMeta(coverMeta),
    revisions: existing?.revisions || [],
    createdAt: existing?.createdAt || updatedAt,
    updatedAt,
  });
  return {
    ...state,
    stationInspectionReports: existing
      ? reports.map((entry) => entry.roundId === roundId ? report : entry)
      : [report, ...reports],
  };
}

export function appendStationInspectionReportRevision(state, roundId, {
  companyId = "",
  format = "standard",
  templateId = "",
  templateSchemaVersion = "",
  coverMeta = null,
  generatedAt = new Date().toISOString(),
} = {}) {
  const round = asArray(state?.inspectionRounds).find((entry) => entry?.id === roundId);
  if (!round || round.status !== "closed") return state;
  const existing = stationInspectionReportForRound(state, roundId);
  const reportState = saveStationInspectionReportCover(state, roundId, coverMeta || existing?.coverMeta || {}, generatedAt);
  const report = stationInspectionReportForRound(reportState, roundId);
  const version = Math.max(0, ...asArray(report?.revisions).map((entry) => Number(entry.version) || 0)) + 1;
  const revision = normalizeIssuedVersion({
    id: `station-report-${roundId}-v${version}`,
    version,
    companyId,
    format,
    templateId,
    templateSchemaVersion,
    coverMeta: normalizeReportCoverMeta(coverMeta || report?.coverMeta),
    generatedAt,
  }, roundId, version - 1);
  return {
    ...reportState,
    stationInspectionReports: asArray(reportState.stationInspectionReports).map((entry) => entry.roundId === roundId
      ? { ...entry, revisions: [...entry.revisions, revision], updatedAt: generatedAt }
      : entry),
  };
}
