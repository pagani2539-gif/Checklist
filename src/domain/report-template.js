import {
  STATUS_OPTIONS,
  getPrintableSectionsForSnapshot,
  getRoundSummary,
  normalizeAttachment,
} from "./master-checklist.js";
import { EVIDENCE_STATUS_LABELS } from "./evidence-checklist.js";
import { isReportHiddenItemStatus } from "./inspection-status.js";
import { getCorrectionSummary } from "./correction.js";
import { createVehicleSearchConfig, getVehicleQueueGroups, getVehicleReviewOutcome, getVehicleReviewRows, getVehicleReviewScopeEntries, getVehicleSearchIssueRows, getVehicleSearchReviewSummary, isVehicleApiReviewItem, isVehicleReviewScopeState, normalizeVehicleReviewState, normalizeVehicleSearchState, VEHICLE_API_REVIEW_VERSION, VEHICLE_REVIEW_CONTEXT_OPTIONS, VEHICLE_REVIEW_THRESHOLDS } from "./vehicle-search.js";
import { REPORT_COVER_FIELD_LABELS, REPORT_COVER_REQUIRED_FIELDS, normalizeReportCoverMeta, stationInspectionReportForRound } from "./station-inspection-reports.js";

export { REPORT_COVER_FIELD_LABELS, REPORT_COVER_REQUIRED_FIELDS, normalizeReportCoverMeta };

export const REPORT_TEMPLATE_ID = "checklist-report-a4-portrait-v1";
export const REPORT_TEMPLATE_SCHEMA_VERSION = "checklist-report-model-v2";

function text(value) {
  return String(value ?? "").trim();
}

/** Cover metadata is a separate editable record; the round fallback reads only an already-saved legacy cover. */
export function getReportCoverMeta(round, { state = null, reportVersionId = "" } = {}) {
  const meta = round?.meta || {};
  const report = stationInspectionReportForRound(state, round?.id);
  const version = reportVersionId ? report?.revisions?.find((entry) => entry.id === reportVersionId) : null;
  return normalizeReportCoverMeta(version?.coverMeta || report?.coverMeta || meta.reportCover);
}

export function getReportCoverReadiness(round, coverOverride = null) {
  const isQuickField = round?.meta?.inspectionMode === "quick_field";
  const cover = normalizeReportCoverMeta(coverOverride || getReportCoverMeta(round));
  const requiredFields = isQuickField
    ? ["reportTitle", "projectName"]
    : REPORT_COVER_REQUIRED_FIELDS;
  const missingFields = requiredFields.filter((field) => !cover[field]);
  return {
    isQuickField,
    ready: missingFields.length === 0,
    missingFields,
    missingLabels: missingFields.map((field) => REPORT_COVER_FIELD_LABELS[field]),
  };
}

function statusLabel(status) {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label || "ยังไม่ได้ตรวจ";
}

function serializeAttachment(attachment) {
  const normalized = normalizeAttachment(attachment);
  return normalized ? { ...normalized, source: "indexeddb" } : null;
}

const VEHICLE_PRESENTATION_SAMPLE_STATUSES = Object.freeze(["correct", "incorrect", "unable-to-verify"]);

function getVehiclePresentationExampleIds(rows, statusKey) {
  return VEHICLE_PRESENTATION_SAMPLE_STATUSES.flatMap((status) => {
    const row = rows.find((entry) => entry[statusKey] === status);
    return row ? [row.id] : [];
  });
}

export function getPresentationEvidenceCaption(entry, fallback = "") {
  const note = text(entry?.note);
  if (note) return note;
  if (!entry?.attachment) return text(entry?.statusLabel) || text(fallback);
  return text(fallback);
}

/**
 * Build a renderer-neutral report model from one immutable inspection round.
 * The model contains attachment metadata only; the renderer resolves each
 * attachment id to its Blob or exported image bytes at render time.
 */
export function buildReportTemplateModel(round, state = null, coverOverride = null) {
  const snapshot = round?.snapshot || {};
  const inspectionItems = round?.inspectionItems || {};
  const sections = getPrintableSectionsForSnapshot(snapshot, round?.templateVersion || snapshot.templateVersion)
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !isVehicleApiReviewItem(item, snapshot) && !isReportHiddenItemStatus(inspectionItems[item.id]?.status)),
    }))
    .filter((section) => section.items.length > 0);
  const correction = getCorrectionSummary(round);
  const vehicleConfig = createVehicleSearchConfig(snapshot.vehicleSearchConfig, "");
  const vehicleSearch = snapshot.vehicleReviewScopeVersion
    ? normalizeVehicleReviewState(round?.vehicleSearch, {}, { baseUrl: vehicleConfig.baseUrl, apiProfile: vehicleConfig.apiProfile })
    : normalizeVehicleSearchState(round?.vehicleSearch, {}, { baseUrl: vehicleConfig.baseUrl, apiProfile: vehicleConfig.apiProfile });
  const buildVehicleReport = (scopeState, scope = null) => {
    if (!scopeState.fetchedAt) return null;
    const rows = getVehicleReviewRows(scopeState).map((row) => ({
      id: row.id,
      vehicleId: row.vehicleId,
      plateNumber: row.plateNumber,
      province: row.province,
      occurredAt: row.occurredAt,
      stationId: row.stationId,
      stationName: row.stationName,
      lane: row.lane,
      plateImage: row.plateImage,
      lprImage: row.lprImage,
      overviewImage: row.overviewImage,
      vehicleClassId: row.vehicleClassId,
      vehicleClassLabel: row.vehicleClassLabel,
      vehicleDescription: row.vehicleDescription,
      axleCount: row.axleCount,
      grossWeight: row.grossWeight,
      grossWeightLimit: row.grossWeightLimit,
      reviewStatus: row.reviewStatus,
      classificationReviewStatus: row.classificationReviewStatus,
      reviewDetails: row.reviewDetails,
      integrityWarnings: row.integrityWarnings,
    }));
    const supportsClassification = snapshot.vehicleReviewVersion === VEHICLE_API_REVIEW_VERSION;
    return {
      scope: scope?.key || null,
      scopeLabel: scope?.label || null,
      scopeTimeLabel: scope?.timeLabel || null,
      emptyResultAcknowledgedAt: scopeState.emptyResultAcknowledgedAt || null,
      fetchedAt: scopeState.fetchedAt,
      criteria: scopeState.criteria,
      sourceStation: scopeState.sourceStation,
      pagination: scopeState.pagination,
      summary: getVehicleSearchReviewSummary(scopeState, { reviewVersion: snapshot.vehicleReviewVersion }),
      outcome: getVehicleReviewOutcome(scopeState, { reviewVersion: snapshot.vehicleReviewVersion }),
      thresholds: { ...VEHICLE_REVIEW_THRESHOLDS },
      supportsClassification,
      presentationExamples: {
        plate: getVehiclePresentationExampleIds(rows, "reviewStatus"),
        classification: supportsClassification ? getVehiclePresentationExampleIds(rows, "classificationReviewStatus") : [],
      },
      rows,
      groups: getVehicleQueueGroups(scopeState, { reviewVersion: snapshot.vehicleReviewVersion }).map(({ rows, ...group }) => group),
      issues: getVehicleSearchIssueRows(scopeState, { reviewVersion: snapshot.vehicleReviewVersion }),
      reasonSummary: getVehicleSearchIssueRows(scopeState, { reviewVersion: snapshot.vehicleReviewVersion }).reduce((result, issue) => {
        if (!issue.reasonCode) return result;
        result[issue.reasonCode] = (result[issue.reasonCode] || 0) + 1;
        return result;
      }, {}),
      contexts: VEHICLE_REVIEW_CONTEXT_OPTIONS.map((context) => ({
        key: context.key,
        checklistNumber: context.checklistNumber,
        label: snapshot.vehicleReviewVersion === VEHICLE_API_REVIEW_VERSION
          ? (context.key === "plate" ? "ตรวจผลอ่านป้ายทะเบียนจาก API" : "ตรวจผลคัดแยกประเภทรถจาก API")
          : context.label,
        summary: getVehicleSearchReviewSummary(scopeState, { reviewVersion: snapshot.vehicleReviewVersion, context: context.key }),
        outcome: getVehicleReviewOutcome(scopeState, { reviewVersion: snapshot.vehicleReviewVersion, context: context.key }),
        thresholds: { ...VEHICLE_REVIEW_THRESHOLDS },
        rows: getVehicleReviewRows(scopeState).map((row) => ({
          id: row.id,
          vehicleId: row.vehicleId,
          plateNumber: row.plateNumber,
          province: row.province,
          occurredAt: row.occurredAt,
          stationId: row.stationId,
          stationName: row.stationName,
          lane: row.lane,
          plateImage: row.plateImage,
          lprImage: row.lprImage,
          overviewImage: row.overviewImage,
          vehicleClassId: row.vehicleClassId,
          vehicleClassLabel: row.vehicleClassLabel,
          vehicleDescription: row.vehicleDescription,
          axleCount: row.axleCount,
          grossWeight: row.grossWeight,
          grossWeightLimit: row.grossWeightLimit,
          reviewStatus: row.reviewStatus,
          classificationReviewStatus: row.classificationReviewStatus,
          reviewDetails: row.reviewDetails,
          integrityWarnings: row.integrityWarnings,
        })),
        groups: getVehicleQueueGroups(scopeState, { reviewVersion: snapshot.vehicleReviewVersion, context: context.key }).map(({ rows, ...group }) => group),
        issues: getVehicleSearchIssueRows(scopeState, { reviewVersion: snapshot.vehicleReviewVersion, context: context.key }),
      })),
    };
  };
  const vehicleReport = isVehicleReviewScopeState(vehicleSearch)
    ? { scoped: true, scopes: getVehicleReviewScopeEntries(vehicleSearch).map((scope) => buildVehicleReport(scope.state, scope)).filter(Boolean), summary: getVehicleSearchReviewSummary(vehicleSearch, { reviewVersion: snapshot.vehicleReviewVersion }) }
    : buildVehicleReport(vehicleSearch);
  const reportCoverMeta = normalizeReportCoverMeta(coverOverride || getReportCoverMeta(round, { state }));
  const reportCoverReadiness = getReportCoverReadiness(round, reportCoverMeta);

  return {
    schemaVersion: REPORT_TEMPLATE_SCHEMA_VERSION,
    templateId: REPORT_TEMPLATE_ID,
    source: "inspection-snapshot",
    page: {
      size: "A4",
      orientation: "portrait",
      marginsMm: { top: 12, right: 12, bottom: 15, left: 12 },
    },
    metadata: {
      roundId: text(round?.id),
      snapshotId: text(snapshot.id),
      stationId: text(snapshot.stationId),
      stationCode: text(snapshot.stationCode),
      stationName: text(snapshot.stationName),
      cleaningPolicyVersion: text(snapshot.cleaningPolicyVersion),
      projectName: text(reportCoverMeta.projectName),
      inspectionDate: text(round?.meta?.inspectionDate),
      contractNo: text(reportCoverMeta.contractNo),
      regionNames: text(snapshot.province) ? [text(snapshot.province)] : [],
      documentNo: text(round?.meta?.documentNo),
      createdAt: text(round?.createdAt || snapshot.createdAt),
      closedAt: text(round?.closedAt),
      status: text(round?.status),
    },
    reportCover: {
      ...reportCoverMeta,
      ...reportCoverReadiness,
      inspectionDate: text(round?.meta?.inspectionDate),
    },
    contractContext: null,
    correction: correction.count ? {
      count: correction.count,
      latestAt: text(correction.latestAt),
      latestReason: text(correction.latestReason),
      latestEditor: text(correction.latestEditor),
    } : null,
    summary: getRoundSummary(round, { excludeSkipped: true }),
    vehicleSearch: vehicleReport,
    sections: sections.map((section) => ({
      code: section.code,
      title: section.title,
      items: section.items.map((item, index) => {
        const value = inspectionItems[item.id] || {};
        const status = text(value.status || "pending");
        return {
          id: item.id,
          templateId: item.templateId || item.id,
          index: index + 1,
          label: item.label,
          helper: item.helper,
          unit: item.unit,
          sectionCode: item.sectionCode,
          sourceSectionTitle: item.sectionTitle || "",
          assetNo: text(item.assetNo),
          location: text(item.location),
          serialNo: text(item.serialNo),
          assetId: text(item.assetId),
          isEquipmentCleaning: item.isEquipmentCleaning === true,
          isAreaCleaning: item.isAreaCleaning === true,
          cleaningAssetType: item.cleaningAssetType || null,
          value: value.value ?? "",
          status,
          statusLabel: statusLabel(status),
          note: text(value.note),
          applicable: item.applicable !== false,
          attachment: serializeAttachment(value.attachment),
          evidenceSlots: (item.evidenceSlots || []).map((slot) => {
            const evidence = value.evidence?.[slot.id] || {};
            const evidenceStatus = text(evidence.status || "pending");
            return {
              id: slot.id,
              sourceFile: slot.sourceFile,
              displayLabel: slot.displayLabel || slot.sourceLabel,
              sourceLabel: slot.sourceLabel,
              sourceOrder: slot.sourceOrder,
              fieldType: slot.fieldType,
              required: slot.required !== false,
              sourceObservedStatus: slot.sourceObservedStatus || null,
              cleaningStage: slot.cleaningStage || null,
              cleaningAssetType: slot.cleaningAssetType || item.cleaningAssetType || null,
              isEquipmentCleaning: slot.isEquipmentCleaning === true || item.isEquipmentCleaning === true,
              photoPurpose: slot.photoPurpose || null,
              photoRequired: Boolean(slot.photoRequired || slot.cleaningStage),
              status: evidenceStatus,
              statusLabel: EVIDENCE_STATUS_LABELS[evidenceStatus] || evidenceStatus,
              value: evidence.value ?? "",
              note: text(evidence.note),
              attachment: serializeAttachment(evidence.attachment),
            };
          }),
        };
      }),
    })),
  };
}
