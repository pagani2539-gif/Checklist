import { isSystemVehicleRound, projectVehicleRound, getVehicleSystemLabel } from "./vehicle-review-systems.js";
import { getRoundVehicleSearchConfig } from './round-vehicle-connection.js';
import {
  STATUS_OPTIONS,
  buildInspectionSections,
  getStationSystemDisplayLabel,
  getPrintableSectionsForSnapshot,
  getRoundSummary,
  normalizeAttachment,
} from "./master-checklist.js";
import { getChecklistPageNavigationItems } from "./checklist-queue-state.js";
import { getCentralChecklistItemLabel, getCentralEquipmentName, useCentralEnglishNames } from "./equipment-names.js";
import { EVIDENCE_STATUS_LABELS } from "./evidence-checklist.js";
import { isReportHiddenItemStatus } from "./inspection-status.js";
import { getCorrectionSummary } from "./correction.js";
import { getDaytimeVehicleClassificationDataset } from "./vehicle-search.js";
import { getVehicleEvidenceArchiveForRow } from "./vehicle-evidence-images.js";
import { getVehicleSampleEligibilitySummary, VEHICLE_SAMPLE_ELIGIBILITY_OPTIONS, VEHICLE_SAMPLE_ELIGIBILITY_POLICY_VERSION } from "./vehicle-sample-eligibility.js";
import { getVehicleQueueGroups, getVehicleReviewOutcome, getVehicleReviewRows, getVehicleReviewScopeEntries, getVehicleSearchIssueRows, getVehicleSearchReviewSummary, isVehicleApiReviewItem, isVehicleReviewScopeState, normalizeVehicleReviewState, normalizeVehicleSearchState, VEHICLE_API_REVIEW_VERSION, VEHICLE_REVIEW_CONTEXT_OPTIONS, VEHICLE_REVIEW_THRESHOLDS } from "./vehicle-search.js";
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

function buildReportChecklistItem(item, section, index, { inspectionItems, navigationItemsById, systemsById, lanesById, assetsById }) {
  const value = inspectionItems[item.id] || {};
  const status = text(value.status || "pending");
  const system = systemsById.get(item.systemRecordId);
  const navigationItem = navigationItemsById.get(item.id);
  const laneId = text(item.laneId || navigationItem?.laneId || system?.laneId);
  const lane = lanesById.get(laneId);
  const asset = assetsById.get(item.assetId);
  const assetType = asset?.type || item.assetType || item.cleaningAssetType || "";
  return {
    id: item.id,
    templateId: item.templateId || item.id,
    index: index + 1,
    checklistNumber: text(item.checklistNumber),
    label: getCentralChecklistItemLabel(item),
    helper: item.helper,
    unit: item.unit,
    sectionCode: item.sectionCode,
    sourceSectionTitle: item.sectionTitle || "",
    assetNo: text(item.assetNo),
    location: text(item.location),
    serialNo: text(item.serialNo),
    assetId: text(item.assetId),
    assetType,
    assetName: getCentralEquipmentName(assetType)?.nameEn || useCentralEnglishNames(asset?.name || item.assetName || "").split(" · ")[0],
    systemRecordId: text(item.systemRecordId),
    systemLabel: system ? getStationSystemDisplayLabel(system) : text(item.systemLabel || item.systemName),
    scope: text(navigationItem?.scope || item.scope || item.laneScopeLabel || system?.scope || lane?.scope),
    laneId,
    laneNo: text(item.laneNo || navigationItem?.laneNo || lane?.laneNo || lane?.number),
    relationshipPath: text(item.relationshipPath),
    presentationSection: { code: section.code, title: section.title },
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
        displayLabel: useCentralEnglishNames(slot.displayLabel || slot.sourceLabel),
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
  const checklistSections = buildInspectionSections(snapshot, round?.templateVersion || snapshot.templateVersion)
    .map((section) => ({ ...section, items: section.items.filter((item) => item.applicable !== false) }))
    .filter((section) => section.items.length > 0);
  const checklistNavigationItems = getChecklistPageNavigationItems(checklistSections, snapshot.stationFormat, snapshot);
  const checklistOrderById = new Map(checklistNavigationItems.map((item, index) => [item.id, index]));
  const navigationItemsById = new Map(checklistNavigationItems.map((item) => [item.id, item]));
  const systemsById = new Map((snapshot.stationSystems || []).map((system) => [system.id, system]));
  const lanesById = new Map((snapshot.lanes || []).map((lane) => [lane.id, lane]));
  const assetsById = new Map((snapshot.equipment || []).map((asset) => [asset.id, asset]));
  const reportSections = sections.map((section) => ({
    code: section.code,
    title: section.title,
    items: section.items.map((item, index) => buildReportChecklistItem(item, section, index, {
      inspectionItems,
      navigationItemsById,
      systemsById,
      lanesById,
      assetsById,
    })),
  }));
  const orderedItems = reportSections.flatMap((section) => section.items)
    .sort((left, right) => (checklistOrderById.get(left.id) ?? Number.MAX_SAFE_INTEGER)
      - (checklistOrderById.get(right.id) ?? Number.MAX_SAFE_INTEGER));
  const correction = getCorrectionSummary(round);
  const vehicleConfig = getRoundVehicleSearchConfig(round);
  const vehicleSearch = snapshot.vehicleReviewScopeVersion || isVehicleReviewScopeState(round?.vehicleSearch)
    ? normalizeVehicleReviewState(round?.vehicleSearch, {}, { baseUrl: vehicleConfig.baseUrl, apiProfile: vehicleConfig.apiProfile })
    : normalizeVehicleSearchState(round?.vehicleSearch, {}, { baseUrl: vehicleConfig.baseUrl, apiProfile: vehicleConfig.apiProfile });
  const buildVehicleReport = (scopeState, scope = null) => {
    if (!scopeState.fetchedAt) return null;
    const eligibilityPolicyVersion = scopeState.sampleEligibilityPolicyVersion || scopeState.sample?.eligibilityPolicyVersion || null;
    const usesEvidenceEligibility = eligibilityPolicyVersion === VEHICLE_SAMPLE_ELIGIBILITY_POLICY_VERSION;
    const sampleLocked = Boolean(scopeState.sample?.lockedAt && scopeState.sample?.version === "vehicle-sample-v2" && scopeState.sample?.eligibilityPolicyVersion === VEHICLE_SAMPLE_ELIGIBILITY_POLICY_VERSION);
    const eligibilitySummary = usesEvidenceEligibility ? getVehicleSampleEligibilitySummary(scopeState.sourceRows || scopeState.rows) : null;
    const scoredState = usesEvidenceEligibility && !sampleLocked ? { ...scopeState, rows: [] } : scopeState;
    const excludedRows = usesEvidenceEligibility ? (scopeState.sourceRows || scopeState.rows)
      .filter((row) => row.sampleEligibility?.status === "excluded")
      .map((row) => ({
        id: row.id,
        vehicleId: row.vehicleId,
        plateNumber: row.plateNumber,
        province: row.province,
        occurredAt: row.occurredAt,
        stationId: row.stationId,
        stationName: row.stationName,
        lane: row.lane,
        apiEvidenceImages: getVehicleEvidenceArchiveForRow(round?.vehicleEvidenceArchive, row),
        plateImage: row.plateImage,
        lprImage: row.lprImage,
        overviewImage: row.overviewImage,
        sampleEligibility: row.sampleEligibility,
        exclusionReasonLabel: VEHICLE_SAMPLE_ELIGIBILITY_OPTIONS.find((option) => option.value === row.sampleEligibility?.reasonCode)?.label || row.sampleEligibility?.reasonCode || "ไม่ระบุเหตุผล",
      })) : [];
    const rows = getVehicleReviewRows(scoredState).map((row) => ({
      id: row.id,
      vehicleId: row.vehicleId,
      plateNumber: row.plateNumber,
      province: row.province,
      occurredAt: row.occurredAt,
      stationId: row.stationId,
      stationName: row.stationName,
      lane: row.lane,
      apiEvidenceImages: getVehicleEvidenceArchiveForRow(round?.vehicleEvidenceArchive, row),
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
      ...(row.sampleEligibility ? { sampleEligibility: row.sampleEligibility } : {}),
    }));
    const supportsClassification = snapshot.vehicleReviewVersion === VEHICLE_API_REVIEW_VERSION;
    return {
      scope: scope?.key || null,
      scopeLabel: scope?.label || null,
      scopeTimeLabel: scope?.timeLabel || null,
      emptyResultAcknowledgedAt: scopeState.emptyResultAcknowledgedAt || null,
      fetchedAt: scopeState.fetchedAt,
      criteria: scopeState.criteria,
      sample: scopeState.sample || null,
      sampleEligibilityPolicyVersion: eligibilityPolicyVersion,
      sourceCount: scopeState.sample?.sourceCount ?? scopeState.sourceRows?.length ?? scopeState.pagination?.totalItems ?? rows.length,
      eligibleCount: usesEvidenceEligibility ? scopeState.sample?.eligibleCount ?? eligibilitySummary.eligible : null,
      excludedCount: usesEvidenceEligibility ? eligibilitySummary.excluded : 0,
      sampleLocked,
      excludedRows,
      sourceStation: scopeState.sourceStation,
      pagination: scopeState.pagination,
      summary: getVehicleSearchReviewSummary(scoredState, { reviewVersion: snapshot.vehicleReviewVersion }),
      outcome: getVehicleReviewOutcome(scoredState, { reviewVersion: snapshot.vehicleReviewVersion }),
      thresholds: { ...VEHICLE_REVIEW_THRESHOLDS },
      supportsClassification,
      presentationExamples: {
        plate: getVehiclePresentationExampleIds(rows, "reviewStatus"),
        classification: supportsClassification ? getVehiclePresentationExampleIds(rows, "classificationReviewStatus") : [],
      },
      rows,
      groups: getVehicleQueueGroups(scoredState, { reviewVersion: snapshot.vehicleReviewVersion }).map(({ rows, ...group }) => group),
      issues: getVehicleSearchIssueRows(scoredState, { reviewVersion: snapshot.vehicleReviewVersion }),
      reasonSummary: getVehicleSearchIssueRows(scoredState, { reviewVersion: snapshot.vehicleReviewVersion }).reduce((result, issue) => {
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
        summary: getVehicleSearchReviewSummary(scoredState, { reviewVersion: snapshot.vehicleReviewVersion, context: context.key }),
        outcome: getVehicleReviewOutcome(scoredState, { reviewVersion: snapshot.vehicleReviewVersion, context: context.key }),
        thresholds: { ...VEHICLE_REVIEW_THRESHOLDS },
        rows: getVehicleReviewRows(scoredState).map((row) => ({
          id: row.id,
          vehicleId: row.vehicleId,
          plateNumber: row.plateNumber,
          province: row.province,
          occurredAt: row.occurredAt,
          stationId: row.stationId,
          stationName: row.stationName,
          lane: row.lane,
          apiEvidenceImages: getVehicleEvidenceArchiveForRow(round?.vehicleEvidenceArchive, row),
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
          ...(row.sampleEligibility ? { sampleEligibility: row.sampleEligibility } : {}),
        })),
        ...(context.key === "plate" && usesEvidenceEligibility ? { sampleEligibilityPolicyVersion: eligibilityPolicyVersion, sourceCount: scopeState.sample?.sourceCount ?? scopeState.sourceRows?.length ?? scopeState.pagination?.totalItems ?? 0, eligibleCount: scopeState.sample?.eligibleCount ?? eligibilitySummary.eligible, excludedCount: eligibilitySummary.excluded, sampleLocked, excludedRows } : {}),
        groups: getVehicleQueueGroups(scoredState, { reviewVersion: snapshot.vehicleReviewVersion, context: context.key }).map(({ rows, ...group }) => group),
        issues: getVehicleSearchIssueRows(scoredState, { reviewVersion: snapshot.vehicleReviewVersion, context: context.key }),
      })),
    };
  };
  const vehicleReport = isSystemVehicleRound(round) && !snapshot.vehicleReviewSystemKey
    ? { systems: snapshot.vehicleReviewSystems.map(system => ({ key: system.key, label: getVehicleSystemLabel(system),
        contexts: Object.fromEntries(["plate", "classification"].map(context => [context, buildReportTemplateModel(projectVehicleRound(round, system.key, context), state, coverOverride).vehicleSearch])) })) }
    : isVehicleReviewScopeState(vehicleSearch)
    ? { scoped: true, scopes: getVehicleReviewScopeEntries(vehicleSearch).map((scope) => buildVehicleReport(scope.state, scope)).filter(Boolean), summary: getVehicleSearchReviewSummary(vehicleSearch, { reviewVersion: snapshot.vehicleReviewVersion }), independentContext: vehicleSearch.independentContext || null, classificationReport: vehicleSearch.independentContext ? null : buildVehicleReport(getDaytimeVehicleClassificationDataset(vehicleSearch)) }
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
      preparedBy: text(round?.meta?.preparedBy),
      approvedBy: text(round?.meta?.approvedBy),
      approvalDate: text(round?.meta?.approvalDate),
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
    sections: reportSections,
    orderedItems,
  };
}
