import { AppIcon as Icon, getEquipmentIconName, getScIconName } from "./icon-system.jsx";
import { Button, ConfirmDialog } from "./controls/ActionControls.jsx";
import { CloseReadinessDialog } from "./dialogs/CloseReadinessDialog.jsx";
import { domSafeId } from "./dom-safe-id.js";
import { Breadcrumb, EmptyState, PageHeader, ProgressBar } from "./PagePrimitives.jsx";
import { createVehicleReviewComponents } from "./vehicle-review/ReviewPanels.jsx";
import { createPrintableReportComponent } from "./reports/PrintableReport.jsx";
import { createPageRuntime, PAGE_RUNTIME_KEYS } from "./page-runtime.js";
import { createContext, Fragment, useCallback, useContext, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import CustomSelect from "./CustomSelect.jsx";
import { ContractContextSelect, MasterSelect, SearchableMultiSelect } from "./MasterSelect.jsx";
import { ThaiDatePicker, ThaiDateTimePicker } from "./date-picker.jsx";
import { getBackFallbackTarget, parseHash, primaryRouteFor, PRIMARY_ROUTES } from "./router.js";
import { canNavigateBackInApp, initializeRouteHistory, navigate, navigateBack, replaceRoute } from "./navigation.js";
import { getChecklistPageNavigationItems, getChecklistPageQueueGroups, getChecklistQueueGroups, getChecklistQueueSectionLabel, getChecklistQueueToggle, getCleaningQueueItemCount, getChecklistQueueItemLabel } from "./checklist-queue-state.js";
import { renderPage } from "./page-registry.jsx";
import { createDashboardPage } from "./pages/DashboardPage.jsx";
import { createContextualStationPage } from "./pages/ContextualStationPage.jsx";
import { createStationDetailPage } from "./pages/StationDetailPage.jsx";
import { createStationsPage } from "./pages/StationsPage.jsx";
import { createInspectionsPage } from "./pages/InspectionsPage.jsx";
import { createRevisionPage } from "./pages/RevisionPage.jsx";
import { createNewInspectionPage } from "./pages/NewInspectionPage.jsx";
import { createVehicleApiReviewPage } from "./pages/VehicleApiReviewPage.jsx";
import { createVehicleApiReportPage } from "./pages/VehicleApiReportPage.jsx";
import { createChecklistPage } from "./pages/ChecklistPage.jsx";
import StationRelationshipRegister from "./StationRelationshipRegister.jsx";
import StationRelationshipInlineEditor from "./StationRelationshipInlineEditor.jsx";
import { createHistoryPage } from "./pages/HistoryPage.jsx";
import { createNewContractPage, createContractDetailPage, createWorkPackagePage } from "./pages/ContractsPage.jsx";
import { createContractReportPage } from "./pages/ContractReportPage.jsx";
import { createContractAgreementCoverPage } from "./pages/ContractAgreementCoverPage.jsx";
import { createReferenceDataPage } from "./pages/ReferenceDataPage.jsx";
import { AdminUsersPage, LocalLoginScreen, PasswordChangeScreen } from "./LocalAuthScreens.jsx";
import ContractContextBar from "./ContractContextBar.jsx";
import { useServerWorkspaceSync } from "./useServerWorkspaceSync.js";
import {
  buildInspectionSections,
  CHECKLIST_POLICY_VERSION,
  getActivePhysicalEquipment,
  getStationChecklistItems,
  getStationChecklistSections,
  setStationChecklistItemEnabled,
  buildItemState,
  createId,
  createInspectionRound,
  defaultMeta,
  BOQ_SYSTEMS,
  getEquipmentType,
  getEquipmentEnglishLabel,
  getEquipmentDisplayLabel,
  getEquipmentCategoryCode,
  getStationSystemLabel,
  getStationSystemEnglishLabel,
  getStationSystemDisplayLabel,
  buildStationSystemSummaryModel,
  WIM_SORTING_SYSTEM_CANONICAL_ID,
  isWimSortingSystemRecord,
  getWimSortingSystemInstances,
  getWimSortingInstalledQuantity,
  getWimSortingSystemById,
  getEquipmentGroupsForRegister,
  STATION_ASSET_CATEGORIES,
  ITEM_LIBRARY_CATEGORIES,
  STATION_FORMATS,
  DEFAULT_STATION_FORMAT,
  getDefaultStationEquipmentCounts,
  getStationFormatDefinition,
  normalizeItemCatalog,
  makeEquipmentFromCatalogItem,
  getNextEquipmentIndex,
  synchronizeGeneratedAssetNos,
  validateEquipmentDraft,
  getItemsForSnapshot,
  getNewRoundChecklistItems,
  getInspectionProgressModel,
  getChecklistCoverageSummary,
  getRoundSummary,
  getCloseReadiness,
  getStationReadiness,
  makeEquipment,
  makeLane,
  STATION_DRAFT_TEMPLATE_VERSION,
  CLEANING_POLICY_VERSION,
  EVIDENCE_CHECKLIST_SECTIONS,
  createStationDraft,
  validateStationDraft,
  createStationProfileFromDraft,
  STATUS_OPTIONS,
} from "../domain/master-checklist.js";
import { EVIDENCE_STATUS_OPTIONS, evidenceAttachmentIds, isEvidenceSlotComplete } from "../domain/evidence-checklist.js";
import { isEvidenceBypassItemStatus } from "../domain/inspection-status.js";
import { getChecklistWorkContext } from "../domain/checklist-context.js";
import { buildStationRelationshipTree, getRelationshipCategoryForAsset, getRelationshipCategoryForSystem, getRelationshipPath, getStationRelationshipSystemCount } from "../domain/station-relationship-tree.js";
import { buildReportTemplateModel, getPresentationEvidenceCaption, getReportCoverMeta, getReportCoverReadiness, normalizeReportCoverMeta } from "../domain/report-template.js";
import { REPORT_COVER_FIELD_LABELS, REPORT_COVER_REQUIRED_FIELDS, appendStationInspectionReportRevision, saveStationInspectionReportCover, stationInspectionReportForRound } from "../domain/station-inspection-reports.js";
import { EQUIPMENT_ORDER_VERSION, sortEquipmentForDisplay, sortWimEquipment } from "../domain/ordering.js";
import { getStationTorPresentationItems, summarizeStationTorItems } from "../domain/station-tor-catalog.js";
import { BOQ_CHECKLIST_GROUPS, filterCatalogItemsByBoqGroup, getBoqAddCategory, getBoqScopeForGroup } from "../domain/boq-checklist-groups.js";
import { getCanonicalItemsForFormat } from "../domain/canonical-station-catalog.js";
import { WIM_ELECTRONICS_OUTPUT_VOLTAGES, isWimElectronicsSubEquipmentType, getWimElectronicsHierarchyIssue } from "../domain/wim-electronics.js";
import { getLaneScope } from "../domain/station-lane-scope.js";
import { CENTRAL_EQUIPMENT_MAIN_CATEGORIES, getCentralChecklistSectionName, getCentralEquipmentName, getCentralSystemCategoryName, getCentralSystemNameForRecord, formatCentralNameEnglishFirst } from "../domain/equipment-names.js";
import { activeContractAssignmentForStation, assignmentOverlaps, assignmentsForStation, assignmentsForWorkPackage, attachContractContextToRound, buildContractAgreementCoverSnapshot, buildContractContextSnapshot, buildContractDeletionImpact, contractAgreementCoversForContract, contractFor, contractLabel, createContractAgreementCover, createContractCommitteeMember, createContractDraft, createContractScopeItem, createContractStationAssignment, createContractWorkReport, createInspectionRoundContextLink, createRegionDraft, createWorkPackageDraft, getContractContextForRound, getContractCoreCompleteness, getLatestInspectionRoundContextLink, hasDuplicateContractNumber, nextContractAgreementCoverVersion, normalizeContractAgreementData, normalizeContractWorkspaceState, purgeContractFromState, regionsForContract, stationsForWorkPackage, validateContractAgreementCover, validateWorkPackageDraft, workPackageFor, workPackageLabel, workPackagesForContract } from "../domain/contracts.js";

const StationProfileEquipmentContext = createContext({ canonicalItems: [], stationEquipment: [], stationSystems: [] });
import { REPORT_COMPANIES, REPORT_COPY, getCompanyContractorMatch, getReportCompany } from "../domain/report-companies.js";
import CompanyReportCover from "./CompanyReportCover.jsx";
import {
  createRevisionRound,
  getCorrectionSummary,
  validateCorrectionReason,
} from "../domain/correction.js";
import { attachmentIdsForState, buildStationDeletionImpact, createEmptyChecklistState, loadChecklistBootstrap, purgeStationFromState, saveChecklistState } from "../domain/storage.js";
import { deleteStoredAttachment, deleteStoredAttachments, getStoredAttachment, saveStoredAttachment } from "../domain/attachments.js";
import { isServerStorageEnabled } from "../domain/server-storage.js";
import { formatBangkokDateTime, formatThaiDate } from "../domain/date-time.js";
import {
  createUiDemoRound,
  createUiVehicleDemoRound,
  UI_DEMO_ROUND_ID,
  UI_VEHICLE_DEMO_ROUND_ID,
} from "../domain/demo-fixture.js";
import {
  createVehicleSearchConfig,
  parseVehicleSearchUrl,
  createVehicleReviewState,
  filterVehicleSearchRowsByScope,
  getVehicleReviewScopeState,
  VEHICLE_REVIEW_CONTEXT_OPTIONS,
  VEHICLE_REVIEW_SCOPE_VERSION,
  VEHICLE_SEARCH_CONNECTION_STATUS,
  VEHICLE_SEARCH_PURPOSE,
  getVehicleReviewState,
  getVehicleReviewContext,
  getVehicleReviewContextByKey,
  getVehicleReviewScopeEntries,
  getVehicleReviewDetail,
  getVehicleSearchReviewSummary,
  isVehicleReviewScopeState,
  isVehicleApiReviewItem,
  normalizeVehicleReviewState,
  normalizeVehicleSearchState,
  setVehicleSearchEmptyResultAcknowledged,
  testVehicleSearchConnection,
  VEHICLE_API_REVIEW_VERSION,
  VEHICLE_REVIEW_CORRECTION_TARGET_OPTIONS,
  VEHICLE_REVIEW_REASON_OPTIONS,
  VEHICLE_API_PROFILE_OPTIONS,
  VEHICLE_CONNECTION_MODES,
  updateVehicleSearchScope,
  updateVehicleSearchReviewDetails,
} from "../domain/vehicle-search.js";

function inferReportCompanyId(contractor) {
  const value = String(contractor || "").trim();
  if (!value) return "";
  return REPORT_COMPANIES.find((company) => getCompanyContractorMatch(company.id, value).status === "match")?.id || "";
}

const REPORT_TEXT = REPORT_COPY.report;

const STATUS_LABELS = Object.fromEntries(STATUS_OPTIONS.map((option) => [option.value, option.label]));

const STATUS_META = Object.freeze({
  pending: { icon: "info", tone: "pending", label: "ยังไม่ได้ตรวจ", action: "stay" },
  normal: { icon: "check", tone: "normal", label: "ปกติ", action: "advance" },
  damaged: { icon: "alert", tone: "damaged", label: "ชำรุด", action: "follow-up" },
  waiting: { icon: "refresh", tone: "waiting", label: "อยู่ระหว่างรอเปลี่ยนทดแทน", action: "follow-up" },
  "not-installed": { icon: "archive", tone: "not-installed", label: "ไม่ได้ติดตั้ง", action: "follow-up" },
  na: { icon: "close", tone: "na", label: "ไม่เกี่ยวข้อง", action: "advance" },
});

const STATUS_CHOICE_ORDER = Object.freeze(["normal", "damaged", "waiting", "pending", "not-installed", "na"]);

const STATUS_CHOICE_LABELS = Object.freeze({
  waiting: "อยู่ระหว่างรอเปลี่ยนทดแทน",
});

const STATUS_CHOICE_DESCRIPTIONS = Object.freeze({
  normal: "ตรวจแล้ว ใช้งานได้ตามปกติ",
  damaged: "พบปัญหาหรือทำงานผิดปกติ",
  waiting: "รออะไหล่หรืออุปกรณ์ทดแทน",
  pending: "ยังไม่มีผลตรวจในรายการนี้",
  "not-installed": "จุดนี้ไม่มีการติดตั้งอุปกรณ์",
  na: "ไม่อยู่ในขอบเขตของรายการนี้",
});

const STATUS_RESULT_HINTS = Object.freeze({
  pending: { tone: "pending", title: "ยังไม่มีผลตรวจ", message: "เลือกรายการผลตรวจเพื่อบันทึกความคืบหน้า หรือปิดรอบพร้อมคำเตือนได้" },
  normal: { tone: "normal", title: "ตรวจแล้ว", message: "รายการนี้บันทึกผลตรวจแล้ว แต่ยังสามารถเพิ่มหลักฐานประกอบได้" },
  damaged: { tone: "damaged", title: "รายการที่ต้องติดตาม", message: "สถานะนี้จะแสดงในรายการที่ต้องติดตาม ส่วนหลักฐานยังตรวจตามกติกาของรายการ" },
  waiting: { tone: "waiting", title: "รายการที่ต้องติดตาม", message: "สถานะนี้จะแสดงในรายการที่ต้องติดตาม ส่วนหลักฐานยังตรวจตามกติกาของรายการ" },
  "not-installed": { tone: "not-installed", title: "ข้ามหลักฐานรายการนี้", message: "ไม่ต้องแนบหลักฐาน และรายการจะไม่แสดงในรายงานตามกติกาปัจจุบัน" },
  na: { tone: "na", title: "ข้ามหลักฐานรายการนี้", message: "ไม่ต้องแนบหลักฐาน และรายการจะไม่แสดงในรายงานตามกติกาปัจจุบัน" },
});

function getStatusDisplayLabel(value, fallback = "") {
  return STATUS_META[value]?.label || STATUS_LABELS[value] || fallback || value;
}

function formatDate(value) {
  return formatThaiDate(value);
}

function formatDateTime(value) {
  return formatBangkokDateTime(value);
}

function shortId(value) {
  return value ? value.slice(-8).toUpperCase() : "—";
}

function attachmentIdsForRound(round) {
  return [...evidenceAttachmentIds(round), ...Object.values(round?.inspectionItems || {}).map((item) => item?.attachment?.id).filter(Boolean)];
}

function attachmentIdsForRecord(record) {
  return [
    ...attachmentIdsForRound(record),
    ...Object.values(record?.items || {}).map((item) => item?.attachment?.id).filter(Boolean),
  ];
}

function currentAttachmentIdsForStation(state, stationId) {
  const rounds = Array.isArray(state?.inspectionRounds) ? state.inspectionRounds : [];
  const history = Array.isArray(state?.inspectionHistory) ? state.inspectionHistory : [];
  const workspaces = Array.isArray(state?.inspectionWorkspaces) ? state.inspectionWorkspaces : [];
  const ids = [
    ...rounds.filter((round) => belongsToStation(round, stationId)),
    ...history.filter((record) => belongsToStation(record, stationId)),
    ...workspaces.filter((record) => belongsToStation(record, stationId)),
  ].flatMap((record) => attachmentIdsForRecord(record));
  if (state?.activeStationId === stationId) ids.push(...Object.values(state?.items || {}).map((item) => item?.attachment?.id).filter(Boolean));
  return [...new Set(ids)];
}

function attachmentIdsForRoundAndAliases(state, round) {
  const snapshotId = round?.snapshot?.id;
  const history = Array.isArray(state?.inspectionHistory) ? state.inspectionHistory : [];
  const workspaces = Array.isArray(state?.inspectionWorkspaces) ? state.inspectionWorkspaces : [];
  const aliases = [
    ...history,
    ...workspaces,
  ].filter((record) => record?.id === round?.id || (snapshotId && (record?.snapshot?.id || record?.stationSnapshot?.id || record?.inspectionSnapshot?.id) === snapshotId));
  return [...new Set([attachmentIdsForRecord(round), ...aliases.flatMap((record) => attachmentIdsForRecord(record))].flat())];
}

function removeInspectionRoundFromState(state, round) {
  const remainingRounds = (state.inspectionRounds || []).filter((entry) => entry.id !== round.id);
  const removedSnapshotId = round.snapshot?.id;
  const removeLegacyReference = (entries) => Array.isArray(entries)
    ? entries.filter((entry) => {
      const snapshot = entry?.snapshot || entry?.stationSnapshot || entry?.inspectionSnapshot;
      return entry?.id !== round.id && (!removedSnapshotId || snapshot?.id !== removedSnapshotId);
    })
    : entries;
  const deletedRoundIds = [...new Set([...(Array.isArray(state.deletedRoundIds) ? state.deletedRoundIds : []), round.id])];
  const deletingActive = state.activeRoundId === round.id;
  const nextActive = deletingActive
    ? (remainingRounds.find((entry) => entry.status === "draft") || remainingRounds[0] || null)
    : remainingRounds.find((entry) => entry.id === state.activeRoundId) || null;
  return {
    ...state,
    inspectionRounds: remainingRounds,
    stationInspectionReports: (state.stationInspectionReports || []).filter((entry) => entry.roundId !== round.id),
    inspectionRoundContextLinks: (state.inspectionRoundContextLinks || []).filter((entry) => entry.roundId !== round.id),
    deletedRoundIds,
    inspectionHistory: removeLegacyReference(state.inspectionHistory),
    inspectionWorkspaces: removeLegacyReference(state.inspectionWorkspaces),
    ...(deletingActive ? {
      activeRoundId: nextActive?.id || null,
      activeStationId: nextActive?.stationId || state.stationProfiles[0]?.id || null,
      items: nextActive?.inspectionItems || {},
      inspectionSnapshot: nextActive?.snapshot || null,
      meta: nextActive?.meta || state.meta,
    } : {}),
  };
}

function formatBytes(value) {
  const bytes = Number(value) || 0;
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

function profileFor(state, stationId) {
  return state.stationProfiles.find((profile) => profile.id === stationId) || state.stationProfiles[0] || null;
}

function recordStationId(record) {
  const snapshot = record?.snapshot || record?.stationSnapshot || record?.inspectionSnapshot;
  return record?.stationId || snapshot?.stationId || null;
}

function belongsToStation(record, stationId) {
  return recordStationId(record) === stationId;
}

function roundFor(state, roundId) {
  return state.inspectionRounds.find((round) => round.id === roundId) || null;
}

function vehicleApiHref(round, contextKey, { history = false } = {}) {
  const base = history ? "#/history" : "#/inspections";
  return `${base}/${encodeURIComponent(round?.id || "")}/vehicle-api/${encodeURIComponent(contextKey || "plate")}`;
}

function statusClass(status) {
  return `status-${status || "pending"}`;
}

function StatusBadge({ status = "pending", children }) {
  const statusIcon = STATUS_META[status]?.icon || {
    draft: "clipboard",
    inactive: "archive",
    archived: "archive",
    closed: "archive",
  }[status] || "info";
  return <span className={`ops-status ${statusClass(status)}`}><Icon name={statusIcon} size="small" /><span>{children || getStatusDisplayLabel(status)}</span></span>;
}

function StationSelect({ profiles, value, onChange, label = "สถานีที่กำลังดู", includeInactive = false }) {
  const availableProfiles = (Array.isArray(profiles) ? profiles : []).filter((profile) => includeInactive || profile.active !== false);
  const selectedValue = availableProfiles.some((profile) => profile.id === value)
    ? value
    : availableProfiles[0]?.id || "";
  return <label className="ops-field ops-field-select"><span>{label}</span><CustomSelect value={selectedValue} onChange={(event) => onChange(event.target.value)} disabled={!availableProfiles.length} aria-label={label} label={label}>{availableProfiles.length ? availableProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.stationCode} · {profile.stationName}{profile.active === false ? " · ปิดใช้งาน" : ""}</option>) : <option value="">ยังไม่มีสถานีที่ใช้งาน</option>}</CustomSelect></label>;
}

function StationSummary({ profile }) {
  const active = sortEquipmentForDisplay(getActivePhysicalEquipment(profile?.equipment), profile?.lanes);
  const grouped = [...new Set(active.map((equipment) => getEquipmentDisplayLabel(equipment)))];
  return <div className="station-summary"><span className="station-summary-mark"><Icon name="building" /></span><div><p className="ops-station-code">{profile?.stationCode || "ยังไม่มีสถานี"}</p><h3>{profile?.stationName || "สร้างสถานีเพื่อเริ่มต้น"}</h3><span>{active.length} อุปกรณ์ใช้งาน · {grouped.slice(0, 4).join(", ") || "ยังไม่มีอุปกรณ์"}</span></div></div>;
}


const STATION_WIZARD_STEPS = [
  { number: 1, title: "ข้อมูลสถานี", description: "รหัสและชื่อสถานี" },
  { number: 2, title: "ทะเบียนอุปกรณ์", description: "อุปกรณ์จริงในสถานี" },
  { number: 3, title: "ตั้งค่า Checklist", description: "รายการตรวจประจำสถานี" },
  { number: 4, title: "ตรวจสอบและยืนยัน", description: "พร้อมสร้างสถานี" },
];

function StationWizardStepper({ current }) {
  return <ol className="ops-stepper ops-station-stepper" aria-label="ขั้นตอนสร้างสถานีใหม่">
    {STATION_WIZARD_STEPS.map((step) => {
      const complete = current > step.number;
      const active = current === step.number;
      return <li key={step.number} className={`${active ? "is-current" : ""} ${complete ? "is-complete" : ""}`.trim()} aria-current={active ? "step" : undefined}>
        <span>{complete ? <Icon name="check" size="small" /> : step.number}</span>
        <div><strong>{step.title}</strong><small>{step.description}</small></div>
      </li>;
    })}
  </ol>;
}

function nextCatalogIndexForDraft(equipment, catalogItem) {
  return getNextEquipmentIndex(equipment, {
    type: catalogItem?.kind === "custom" ? "CUSTOM" : catalogItem?.type,
    prefix: catalogItem?.prefix,
    scope: catalogItem?.variantScope || "",
  });
}

function systemLabelForCategory(category) {
  const centralSectionName = getCentralChecklistSectionName(category?.code);
  if (centralSectionName) return formatCentralNameEnglishFirst(centralSectionName);
  return BOQ_SYSTEMS.find((system) => system.systemId === category?.systemId)?.displayLabel || "ระบบส่วนควบอื่น ๆ";
}

function getEquipmentTypeDisplayLabel(type) {
  return [type?.nameEn, type?.label].filter(Boolean).join(" · ") || type?.value || "อุปกรณ์";
}

function getCatalogItemDisplayLabel(item) {
  return [item?.nameEn, item?.label].filter(Boolean).join(" · ") || item?.id || "รายการอุปกรณ์";
}

function recommendedAssetCountForCategory(systems = [], categoryCode) {
  return (Array.isArray(systems) ? systems : [])
    .filter((system) => system?.active !== false && system?.assetType && system?.sourceRefs?.includes(categoryCode))
    .reduce((total, system) => total + Math.max(0, Number(system.assetQuantity || 0)), 0);
}

function StationSystemsSummary({ systems = [], equipment = [], compact = false, collapsible = false }) {
  const summary = buildStationSystemSummaryModel(systems, equipment);
  const torReferenceSummary = summary.referenceTotals.map((entry) => `${entry.quantity} ${entry.unit}`).join(" · ");
  const statusLabels = { mapped: "ผูกตรง", additional: "อุปกรณ์เพิ่มเติม", unmapped: "ไม่มี mapping", "system-only": "ระบบแยก", "installed-system": "ติดตั้งจริง" };
  const statusClass = { mapped: "is-mapped", additional: "is-additional", unmapped: "is-unmapped", "system-only": "is-system-only" };
  const renderMetric = (record, className = "") => <output className={`ops-system-summary-count ${className}`} aria-label={`ยอดจริง ${record.label}`}><strong>{record.actualCount === null ? "—" : `${record.actualCount} ${record.kind === "system" ? "ระบบ" : "อุปกรณ์"}`}</strong><span>{record.referenceLabel}</span></output>;
  const renderAssetRow = (record) => <article className={`ops-system-summary-child ${statusClass[record.status] || ""}`} key={record.id}>
    <div className="ops-system-summary-child-main"><span className="ops-system-summary-child-mark"><Icon name={getEquipmentIconName(record.assetType)} size="small" /></span><div><strong>{[record.nameEn, record.label].filter(Boolean).join(" · ")}</strong><span>อ้างอิง {record.sourceRefs?.join(", ") || "-"}</span></div></div>
    <div className="ops-system-summary-child-meta"><span className={`ops-system-summary-status ${statusClass[record.status] || ""}`}>{statusLabels[record.status] || "ตรวจสอบ"}</span>{renderMetric(record)}</div>
  </article>;
  const renderGroup = (group) => <details className="ops-system-summary-group" key={group.id} open={group.defaultOpen}>
    <summary className="ops-system-summary-group-toggle"><span className="ops-system-summary-group-icon"><Icon name={group.icon} /></span><div className="ops-system-summary-group-title"><strong>{[group.nameEn, group.label].filter(Boolean).join(" · ")}</strong><span>{group.sourceLabel} · อ้างอิง {group.sourceRefs.join(", ")}</span></div><div className="ops-system-summary-group-metric"><strong>{group.actualCount} อุปกรณ์</strong><span>{group.referenceLabel}</span></div><span className="ops-system-summary-status is-mapped">ผูกตรง</span></summary>
    <div className="ops-system-summary-children">{group.children.map(renderAssetRow)}</div>
  </details>;
  const renderUnmapped = (record) => <article className="ops-system-summary-child is-unmapped" key={record.id}>
    <div className="ops-system-summary-child-main"><span className="ops-system-summary-child-mark"><Icon name="info" size="small" /></span><div><strong>{[record.nameEn, record.label].filter(Boolean).join(" · ")}</strong><span>อ้างอิง {record.sourceRefs?.join(", ") || "-"}</span></div></div>
    <div className="ops-system-summary-child-meta"><span className="ops-system-summary-status is-unmapped">ไม่มี mapping</span>{renderMetric(record)}</div>
  </article>;
  const renderSystemOnly = (record) => <article className={`ops-system-summary-child ${record.status === "installed-system" ? "is-installed-system" : "is-system-only"}`} key={record.id}>
    <div className="ops-system-summary-child-main"><span className="ops-system-summary-child-mark"><Icon name="archive" size="small" /></span><div><strong>{[record.nameEn, record.label].filter(Boolean).join(" · ")}</strong><span>อ้างอิง {record.sourceRefs?.join(", ") || "-"}</span></div></div>
    <div className="ops-system-summary-child-meta"><span className={`ops-system-summary-status ${record.status === "installed-system" ? "is-mapped" : "is-system-only"}`}>{record.status === "installed-system" ? "ติดตั้งจริง" : "ระบบแยก"}</span>{renderMetric(record)}</div>
  </article>;
  const content = summary.visibleSystemCount || summary.activeAssetCount ? <div className="ops-system-summary-content">
    <div className="ops-system-summary-heading"><div><strong>ความสัมพันธ์ระบบกับทะเบียนอุปกรณ์</strong><span>ยอดจริงนับเฉพาะอุปกรณ์ที่ใช้งานอยู่ · TOR แยกตามหน่วยเดิม</span></div><div className="ops-system-summary-totals"><strong>{summary.activeAssetCount} อุปกรณ์</strong><span>{torReferenceSummary ? `TOR ${torReferenceSummary}` : `${summary.groups.length} กลุ่มระบบ`}</span></div></div>
    <div className="ops-system-summary-legend" aria-label="คำอธิบายสถานะ mapping"><span><i className="ops-system-summary-legend-dot is-mapped" />ผูกตรง</span><span><i className="ops-system-summary-legend-dot is-additional" />อุปกรณ์เพิ่มเติม</span><span><i className="ops-system-summary-legend-dot is-unmapped" />ไม่มี mapping</span><span><i className="ops-system-summary-legend-dot is-system-only" />ระบบแยก</span></div>
    <div className="ops-system-summary-table-head" aria-hidden="true"><span>ระบบ / กลุ่มระบบ</span><span>จำนวนอุปกรณ์ (ที่ใช้งาน)</span><span>อ้างอิง TOR</span></div>
    <div className="ops-system-summary-list">{summary.groups.map(renderGroup)}{summary.systemOnly.length > 0 && <section className="ops-system-summary-system-only"><div className="ops-system-summary-unmapped-heading"><div><strong>ระบบจากเอกสาร / ระบบติดตั้งจริง</strong><span>แยกจำนวน WIM Sorting System ที่ติดตั้งจริงออกจากยอด TOR</span></div><span className="ops-system-summary-status is-system-only">{summary.systemOnly.length} รายการ</span></div>{summary.systemOnly.map(renderSystemOnly)}</section>}{summary.unmapped.length > 0 && <section className="ops-system-summary-unmapped"><div className="ops-system-summary-unmapped-heading"><div><strong>รายการจาก Present MA ที่ยังไม่ผูกกับอุปกรณ์</strong><span>แสดงไว้เพื่อให้ตรวจสอบ ไม่เดาจากอุปกรณ์ใกล้เคียง</span></div><span className="ops-system-summary-status is-unmapped">{summary.unmapped.length} รายการ</span></div>{summary.unmapped.map(renderUnmapped)}</section>}</div>
    <div className="ops-system-summary-note"><Icon name="info" size="small" /><span>อุปกรณ์ในหมวด 3.1 และ 5.2 นับรวมในทะเบียนอุปกรณ์จริงตามรายการที่ใช้งานอยู่</span></div>
  </div> : <p className="ops-empty-note">ยังไม่มีข้อมูลระบบหรืออุปกรณ์จากเอกสารต้นทาง</p>;
  if (collapsible) return <details className={`ops-system-summary ops-system-summary-collapsible ${compact ? "is-compact" : ""}`}>
    <summary className="ops-system-summary-toggle"><div><strong>ระบบและอุปกรณ์จริง</strong><span>สรุปความสัมพันธ์ของระบบกับทะเบียนหน้างาน</span></div><span className="ops-count-badge">{summary.groups.length}</span></summary>
    <div className="ops-system-summary-body">{content}</div>
  </details>;
  return <section className={`ops-system-summary ${compact ? "is-compact" : ""}`} aria-labelledby={compact ? undefined : "station-system-summary-title"}>
    {!compact && <div className="ops-subsection-heading"><strong id="station-system-summary-title">ระบบและอุปกรณ์จริง</strong><span>ยอดอุปกรณ์ที่ใช้งานอยู่เป็นตัวหลัก และ TOR เป็นยอดอ้างอิงตามหน่วยเดิม</span></div>}
    {content}
  </section>;
}

const EQUIPMENT_SELECTION_STEPS = [
  { number: 1, title: "เลือกหมวด BOQ", description: "เลือกหมวดอุปกรณ์" },
  { number: 2, title: "เลือกชนิดและจำนวน", description: "เพิ่มอุปกรณ์ตามจริง" },
  { number: 3, title: "กำหนดเลน", description: "ผูก Sensor และ Loop" },
  { number: 4, title: "กรอกรายละเอียดอุปกรณ์", description: "กรอกทีละรายการ" },
  { number: 5, title: "ตรวจสอบอุปกรณ์", description: "ดูสรุปก่อนถัดไป" },
];

function EquipmentSelectionStepper({ current = 1, onChange }) {
  return <ol className="ops-equipment-selection-stepper" aria-label="ขั้นตอนย่อยของทะเบียนอุปกรณ์">
    {EQUIPMENT_SELECTION_STEPS.map((step) => {
      const complete = current > step.number;
      const active = current === step.number;
      return <li key={step.number} className={`${active ? "is-current" : ""} ${complete ? "is-complete" : ""}`.trim()}>
        <button type="button" onClick={() => onChange?.(step.number)} disabled={step.number > current} aria-current={active ? "step" : undefined}>
          <span>{complete ? <Icon name="check" size="small" /> : step.number}</span>
          <div><strong>{step.title}</strong><small>{step.description}</small></div>
        </button>
      </li>;
    })}
  </ol>;
}

function isEquipmentDetailComplete(equipment) {
  const serialNo = String(equipment?.serialNo || "").trim();
  const serialStatus = equipment?.serialStatus;
  return Boolean(
    (serialStatus === "present" && serialNo)
    || serialStatus === "not-available",
  );
}

function isEquipmentSerialReadyForCreation(equipment) {
  return equipment?.serialStatus === "unknown" || isEquipmentDetailComplete(equipment);
}

function countIncompleteEquipment(equipment = []) {
  return (Array.isArray(equipment) ? equipment : []).filter((item) => !isEquipmentDetailComplete(item)).length;
}

function countMissingEquipmentLocations(equipment = []) {
  return (Array.isArray(equipment) ? equipment : []).filter((item) => {
    const location = String(item?.location || "").trim();
    return !location || location === "ระบุตำแหน่ง";
  }).length;
}

function getEquipmentCategoryCodes(equipment = []) {
  const activeEquipment = (Array.isArray(equipment) ? equipment : []).filter((item) => item?.active !== false);
  return ITEM_LIBRARY_CATEGORIES
    .filter((group) => activeEquipment.some((item) => getEquipmentCategoryCode(item) === group.code))
    .map((group) => group.code);
}

function EquipmentSelectionSummary({ systems = [], equipment = [], lanes = [], selectedCategoryCodes = [], onViewDetails }) {
  const allEquipment = Array.isArray(equipment) ? equipment : [];
  const activeEquipment = sortEquipmentForDisplay(allEquipment.filter((item) => item?.active !== false), lanes);
  const inactiveCount = allEquipment.filter((item) => item?.active === false).length;
  const categoryCount = getEquipmentCategoryCodes(activeEquipment).length;
  const selectedCount = ITEM_LIBRARY_CATEGORIES.filter((group) => selectedCategoryCodes.includes(group.code)).length;
  const recommendedCount = ITEM_LIBRARY_CATEGORIES.reduce((total, group) => total + recommendedAssetCountForCategory(systems, group.code), 0);
  const incompleteCount = countIncompleteEquipment(activeEquipment);
  const missingLocationCount = countMissingEquipmentLocations(activeEquipment);
  return <aside className="ops-equipment-selection-summary" aria-label="สรุปอุปกรณ์ในร่าง">
    <div className="ops-equipment-summary-card">
      <div className="ops-equipment-summary-heading"><div><p className="ops-eyebrow">DRAFT SUMMARY</p><h4>สรุปร่างสถานี</h4><span>ตัวเลขอัปเดตทันทีเมื่อเพิ่มหรือลบ</span></div><StatusBadge status="draft">ร่าง</StatusBadge></div>
      <div className="ops-equipment-summary-progress"><span>ความคืบหน้าการสร้าง</span><strong>ขั้นตอนที่ 2 จาก 4</strong><div className="ops-progress-track"><span style={{ width: "25%" }} /></div></div>
      <div className="ops-equipment-summary-metrics">
        <article><span className="ops-equipment-summary-icon"><Icon name="equipment" /></span><div><strong>{activeEquipment.length}</strong><span>อุปกรณ์จริงในร่าง</span><small>{incompleteCount ? `ข้อมูล Serial ยังไม่ครบ ${incompleteCount} รายการ` : "ข้อมูลหลักครบถ้วน"}</small></div></article>
        <article><span className="ops-equipment-summary-icon is-success"><Icon name="building" /></span><div><strong>{selectedCount}<small> / {ITEM_LIBRARY_CATEGORIES.length}</small></strong><span>หมวดที่เลือก</span><small>{categoryCount} หมวดมีอุปกรณ์</small></div></article>
      </div>
      <div className="ops-equipment-summary-recommendation"><span>Present MA แนะนำ</span><strong>{recommendedCount} รายการ</strong><small>เป็นข้อมูลอ้างอิง ไม่ถูกนับเป็นอุปกรณ์จริงจนกว่าจะกด +</small></div>
      {activeEquipment.length > 0 && <details className="ops-equipment-summary-list"><summary>ดูรายการย่อทั้งหมด ({activeEquipment.length})</summary><ol>{activeEquipment.map((equipment) => { const lane = lanes.find((entry) => entry.id === equipment.laneId); return <li key={equipment.id}><span>{equipment.assetNo || "ยังไม่มีรหัสอุปกรณ์ (Asset No.)"}</span><small>{getEquipmentDisplayLabel(equipment)}{isWimEquipment(equipment) ? ` · ${lane ? `Lane ${lane.laneNo}` : "ยังไม่ผูกเลน"}` : ""}</small></li>; })}</ol></details>}
      <p className="ops-equipment-summary-footnote">{inactiveCount ? `ปิดใช้งาน ${inactiveCount} รายการ · ไม่รวมในจำนวนอุปกรณ์จริง` : missingLocationCount ? `ยังไม่ระบุตำแหน่ง ${missingLocationCount} รายการ · เป็นคำเตือน` : "นับเฉพาะอุปกรณ์ที่ใช้งานอยู่ ไม่รวมรายการ Checklist"}</p>
      <button type="button" className="ops-equipment-summary-link" onClick={onViewDetails}><Icon name="list" />ดูรายการที่เลือก <strong>({activeEquipment.length} รายการ)</strong></button>
    </div>
     <div className="ops-equipment-mobile-summary" role="status" aria-live="polite"><span><strong>{activeEquipment.length}</strong> อุปกรณ์จริง</span><span><strong>{selectedCount}</strong>/{ITEM_LIBRARY_CATEGORIES.length} หมวดที่เลือก</span><span className={incompleteCount ? "has-warning" : ""}><strong>{incompleteCount}</strong> Serial ไม่ครบ</span><button type="button" onClick={onViewDetails}>ดูรายการที่เลือก</button></div>
  </aside>;
}

function EquipmentCategorySelection({ systems = [], equipment = [], selectedCategoryCodes = [], onToggle }) {
  const activeEquipment = (Array.isArray(equipment) ? equipment : []).filter((item) => item?.active !== false);
  return <div className="ops-equipment-category-selection">
     <div className="ops-equipment-step-heading"><div><p className="ops-eyebrow">ส่วนทะเบียนอุปกรณ์ · ขั้นที่ 1 จาก 5</p><h4>เลือกหมวด BOQ</h4><span>ติ๊กหมวดที่ต้องการเพิ่มอุปกรณ์จริง จากนั้นเลือกชนิดและจำนวนในขั้นถัดไป</span></div><span className="ops-count-badge">{ITEM_LIBRARY_CATEGORIES.length} หมวด</span></div>
    <div className="ops-equipment-category-list" role="list" aria-label="หมวด BOQ สำหรับเลือกอุปกรณ์">
       {ITEM_LIBRARY_CATEGORIES.map((group) => {
        const count = activeEquipment.filter((item) => getEquipmentCategoryCode(item) === group.code).length;
        const selected = selectedCategoryCodes.includes(group.code);
        const recommendedCount = recommendedAssetCountForCategory(systems, group.code);
        const checkboxId = `station-equipment-category-${domSafeId(group.code)}`;
        return <div role="listitem" key={group.code}>
          <label htmlFor={checkboxId} className={`ops-equipment-category-row ${selected ? "is-selected" : ""}`.trim()}>
            <input id={checkboxId} className="ops-equipment-category-input" type="checkbox" checked={selected} onChange={() => onToggle?.(group.code)} aria-label={`เลือกหมวด BOQ ${group.code} ${group.title}`} />
            <span className="ops-config-section-code">{group.code}</span>
            <span className="ops-equipment-category-copy"><strong>{group.title}</strong><small>{systemLabelForCategory(group)}</small></span>
            <span className={`ops-equipment-category-state ${selected ? "is-selected" : ""}`}>{selected ? "เลือกแล้ว" : "ยังไม่ได้เลือก"}</span>
            <strong className="ops-equipment-category-count">{count}</strong><span className="ops-equipment-category-unit">อุปกรณ์</span>
          </label>
          <small className="ops-equipment-category-recommendation">Present MA แนะนำ {recommendedCount} รายการ · เพิ่มจริงด้วยปุ่ม + ในขั้นถัดไป</small>
        </div>;
      })}
    </div>
    <div className="ops-equipment-step-note"><Icon name="info" /><span>เลือกได้หลายหมวด · การติ๊กเป็นเพียงความตั้งใจเลือกหมวด ยังไม่สร้างอุปกรณ์จริง</span></div>
  </div>;
}

function EquipmentQuantitySelection({ systems = [], catalog = [], equipment = [], selectedCategoryCodes = [], selectedCategoryCode, onQuantityChange, onQuantitySet, onCategoryChange, onBackToCategories }) {
  const [query, setQuery] = useState("");
  const activeCatalog = (Array.isArray(catalog) ? catalog : []).filter((item) => item.active !== false && !getEquipmentType(item.type)?.legacyOnly);
  const activeEquipment = (Array.isArray(equipment) ? equipment : []).filter((item) => item?.active !== false);
   const availableCategories = ITEM_LIBRARY_CATEGORIES.filter((group) => selectedCategoryCodes.includes(group.code));
  const selectedCategory = availableCategories.find((group) => group.code === selectedCategoryCode) || availableCategories[0] || null;
  const selectedCategoryAssetCount = selectedCategory
    ? activeEquipment.filter((item) => getEquipmentCategoryCode(item) === selectedCategory.code).length
    : 0;
  const selectedCounts = activeEquipment.reduce((result, item) => {
    if (item.catalogItemId) result[item.catalogItemId] = (result[item.catalogItemId] || 0) + 1;
    return result;
  }, {});
  const visibleItems = activeCatalog.filter((item) => {
    const haystack = `${item.label} ${item.type} ${item.categoryCode}`.toLowerCase();
    return selectedCategory && item.categoryCode === selectedCategory.code && (!query.trim() || haystack.includes(query.trim().toLowerCase()));
  });
  return <div className="ops-equipment-quantity-selection">
    <div className="ops-equipment-step-heading"><div><p className="ops-eyebrow">ส่วนทะเบียนอุปกรณ์ · ขั้นที่ 2 จาก 5</p><h4>เลือกชนิดและจำนวน</h4><span>เพิ่มหรือลดจำนวนตามอุปกรณ์ที่ติดตั้งจริง</span></div><span className="ops-count-badge">{activeEquipment.length} อุปกรณ์</span></div>
    <div className="ops-equipment-selected-category">
      {availableCategories.length ? <>
        <label className="ops-field ops-equipment-category-picker" htmlFor="station-equipment-category-picker"><span>หมวด BOQ ที่เลือก ({availableCategories.length})</span><CustomSelect id="station-equipment-category-picker" label="เลือกหมวด BOQ เพื่อเพิ่มอุปกรณ์" value={selectedCategory?.code || ""} onChange={(event) => onCategoryChange?.(event.target.value)} aria-label="เลือกหมวด BOQ เพื่อเพิ่มอุปกรณ์">{availableCategories.map((group) => <option key={group.code} value={group.code}>{group.code} · {group.title}</option>)}</CustomSelect></label>
        <div className="ops-equipment-selected-category-meta"><strong>{selectedCategory?.title}</strong><small>{systemLabelForCategory(selectedCategory)} · มีอุปกรณ์จริง {selectedCategoryAssetCount} รายการ · Present MA แนะนำ {recommendedAssetCountForCategory(systems, selectedCategory?.code)} รายการ</small></div>
      </> : <div className="ops-equipment-no-category"><strong>ยังไม่ได้เลือกหมวด BOQ</strong><small>กลับไปขั้นแรกเพื่อติ๊กหมวดก่อนเพิ่มอุปกรณ์</small></div>}
      <button type="button" onClick={() => onBackToCategories?.()}>แก้หมวด</button>
    </div>
    {availableCategories.length ? <>
      <label className="ops-search ops-equipment-search"><Icon name="search" /><span className="sr-only">ค้นหาอุปกรณ์ในหมวด</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชนิดอุปกรณ์..." /></label>
      <div className="ops-equipment-type-list" aria-live="polite">
        {visibleItems.length ? visibleItems.map((item) => {
          const count = selectedCounts[item.id] || 0;
          const recommendedCount = recommendedAssetCountForCategory(systems, item.categoryCode) && systems.find((system) => system?.assetType === item.type)?.assetQuantity || 0;
          return <article className="ops-equipment-type-card" key={item.id}><div className="ops-equipment-type-main"><span className="ops-equipment-icon"><Icon name={getEquipmentIconName(item.type)} /></span><div><strong>{[item.nameEn, item.label].filter(Boolean).join(" · ")}</strong><small>{item.kind === "custom" ? "อุปกรณ์กำหนดเอง (Custom) · มีรายการตรวจทั่วไป แต่ยังไม่มีรายการตรวจเฉพาะ" : (item.type === "WIM_SENSOR" || item.type === "WIM_LOOP" ? "อุปกรณ์มาตรฐาน · เพิ่มตามหน้างาน" : "อุปกรณ์มาตรฐานจาก Catalog กลาง")} · {item.prefix} · {count ? `เพิ่มแล้ว ${count} รายการ` : "ยังไม่ได้เพิ่ม"}{recommendedCount ? ` · แนะนำ ${recommendedCount}` : ""}</small></div></div><div className="ops-quantity-controls" aria-label={`จำนวน ${item.label}`}><button type="button" className="ops-quantity-button" onClick={() => onQuantityChange(item, -1)} disabled={!count} aria-label={`ลดจำนวน ${item.label} เหลือ ${Math.max(0, count - 1)} รายการ`}>−</button><input className="ops-quantity-input" type="number" min="0" step="1" value={count} onChange={(event) => onQuantitySet?.(item, event.target.value)} aria-label={`จำนวน ${item.label}`} /><button type="button" className="ops-quantity-button" onClick={() => onQuantityChange(item, 1)} aria-label={`เพิ่ม ${item.label} เป็น ${count + 1} รายการ`}>+</button></div></article>;
        }) : <EmptyState icon="search" title="ไม่พบชนิดอุปกรณ์">ลองเปลี่ยนคำค้นหา หรือเลือกหมวดอื่น</EmptyState>}
      </div>
    </> : <EmptyState icon="list" title="ยังไม่ได้เลือกหมวด BOQ" action={<Button onClick={() => onBackToCategories?.()} variant="primary">เลือกหมวด BOQ</Button>}>ติ๊กหมวดที่ต้องการก่อน แล้วจึงเพิ่มอุปกรณ์ตามจริง</EmptyState>}
    <div className="ops-equipment-step-note"><Icon name="info" /><span>ทุกครั้งที่เพิ่ม ระบบจะสร้างรหัสอุปกรณ์ (Asset No.) เริ่มต้นให้ทันที และคุณแก้ไขได้ในขั้นถัดไป</span></div>
  </div>;
}

function isWimEquipment(equipment) {
  return equipment?.type === "WIM_SENSOR" || equipment?.type === "WIM_LOOP";
}

function LaneAssignmentStep({ stationFormat = "SC", lanes = [], equipment = [], stationSystems = [], laneErrors = {}, onChangeLanes, onAssignLane, onAssignParentSystem, onAddLane, onRemoveLane, disabled = false, headingEyebrow = "STEP 3 / 5", headingTitle = "กำหนดเลนและผูกอุปกรณ์", headingDescription = "หนึ่งเลนมี WIM Sorting System ได้หนึ่งระบบ และ Sensor/Loop ใต้ระบบนั้นมีจำนวนตามจริง", showHeading = true }) {
  const activeEquipment = (Array.isArray(equipment) ? equipment : []).filter((item) => item?.active !== false);
  const activeLanes = (Array.isArray(lanes) ? lanes : []).filter((lane) => lane?.active !== false);
  const wimEquipment = sortWimEquipment(activeEquipment.filter(isWimEquipment), activeLanes);
  const wimSystems = getWimSortingSystemInstances(stationSystems);
  const laneScopeOptions = String(stationFormat).toUpperCase() === "IMPS" ? ["ImPS"] : ["High Speed", "Low Speed"];
  const laneCounts = (laneId, type) => wimEquipment.filter((item) => item.laneId === laneId && item.type === type).length;
  return <div className="ops-lane-assignment-step">
    {showHeading && <div className="ops-equipment-step-heading"><div><p className="ops-eyebrow">{headingEyebrow === "STEP 3 / 5" ? "ส่วนทะเบียนอุปกรณ์ · ขั้นที่ 3 จาก 5" : headingEyebrow}</p><h4>{headingTitle}</h4><span>{headingDescription}</span></div><span className="ops-count-badge">{activeLanes.length} เลน</span></div>}
     <div className="ops-lane-toolbar"><div><strong>ช่องจราจรของสถานี</strong><small>เพิ่ม Lane ใน Scope ที่ติดตั้งจริง แล้วเลือก WIM Sorting System แม่ให้ Sensor/Loop</small></div><div>{laneScopeOptions.map((scope) => <button type="button" key={scope} className="ops-button ops-button-secondary" onClick={() => onAddLane?.(scope)} disabled={disabled}><Icon name="plus" />เพิ่ม Lane {scope}</button>)}</div></div>
     {activeLanes.length ? <div className="ops-lane-list">{activeLanes.map((lane) => <article className="ops-lane-card" key={lane.id}><div className="ops-lane-card-heading"><div><span className="ops-config-section-code">Lane {lane.laneNo} · {getLaneScope(lane, stationSystems) || "ไม่ระบุ Scope"}</span><strong>{lane.label}</strong><small>{lane.direction || "ยังไม่ระบุทิศทาง"}</small></div><button type="button" className="ops-button ops-button-danger-ghost" onClick={() => onRemoveLane?.(lane)} disabled={disabled}><Icon name="delete" />ลบเลน</button></div><div className="ops-lane-card-counts"><span><strong>{laneCounts(lane.id, "WIM_SENSOR")}</strong> Sensor</span><span><strong>{laneCounts(lane.id, "WIM_LOOP")}</strong> Loop</span></div><div className="ops-lane-card-fields"><label className="ops-field"><span>ชื่อเลน</span><input value={lane.label || ""} disabled={disabled} onChange={(event) => onChangeLanes?.(activeLanes.map((entry) => entry.id === lane.id ? { ...entry, label: event.target.value } : entry))} placeholder={`ช่องจราจร ${lane.laneNo}`} /></label><label className="ops-field"><span>ทิศทาง</span><CustomSelect label="ทิศทางของ Lane" value={lane.direction || "unspecified"} disabled={disabled} onChange={(event) => onChangeLanes?.(activeLanes.map((entry) => entry.id === lane.id ? { ...entry, direction: event.target.value } : entry))}><option value="unspecified">ไม่ระบุ</option><option value="inbound">ขาเข้า</option><option value="outbound">ขาออก</option><option value="both">สองทิศทาง</option></CustomSelect></label></div></article>)}</div> : <EmptyState icon="list" title="ยังไม่มีเลน" action={<div>{laneScopeOptions.map((scope) => <button type="button" key={scope} className="ops-button ops-button-primary" onClick={() => onAddLane?.(scope)} disabled={disabled}><Icon name="plus" />เพิ่ม Lane {scope}</button>)}</div>}>ต้องมีเลนก่อนจึงผูก Sensor และ Loop กับหน้างานได้</EmptyState>}
     <div className="ops-lane-asset-assignment"><div className="ops-subsection-heading"><strong>ผูก Sensor และ Loop กับ WIM Sorting System</strong><span>{wimEquipment.length} อุปกรณ์ WIM ในร่าง · {wimSystems.length} ระบบแม่</span></div>{wimEquipment.length ? <div className="ops-lane-asset-list">{wimEquipment.map((item) => { const parent = getWimSortingSystemById(stationSystems, item.parentSystemId); const lane = activeLanes.find((entry) => entry.id === parent?.laneId); return <label className="ops-lane-asset-row" key={item.id}><span className="ops-equipment-icon"><Icon name={getEquipmentIconName(item.type)} /></span><span><strong>{getEquipmentDisplayLabel(item)}</strong><small>{item.assetNo} · {lane ? `Lane ${lane.laneNo}` : "ยังไม่ทราบ Lane"}</small></span><CustomSelect label={`เลือก WIM Sorting System สำหรับ ${item.assetNo}`} value={item.parentSystemId || ""} disabled={disabled} onChange={(event) => (onAssignParentSystem || onAssignLane)?.(item.id, event.target.value)} aria-invalid={Boolean(laneErrors[item.id])}><option value="">ยังไม่ผูกระบบแม่</option>{wimSystems.map((system) => { const systemLane = activeLanes.find((entry) => entry.id === system.laneId); return <option key={system.id} value={system.id}>WIM Sorting System #{system.instanceNo || "?"} · Lane {systemLane?.laneNo || "?"} · {getLaneScope(systemLane, stationSystems) || "ไม่ระบุ Scope"}</option>; })}</CustomSelect>{laneErrors[item.id] && <small className="ops-field-error">{laneErrors[item.id]}</small>}</label>; })}</div> : <p className="ops-empty-note">ยังไม่มี Sensor หรือ Loop ให้ผูกระบบแม่ เพิ่ม WIM Sorting System ก่อนเพิ่มอุปกรณ์</p>}</div>
    <div className="ops-equipment-step-note"><Icon name="info" /><span>จำนวน Sensor และ Loop เป็นข้อมูลจริงของแต่ละ WIM Sorting System ไม่บังคับให้เท่ากัน และ Lane ของลูกจะตามระบบแม่อัตโนมัติ</span></div>
  </div>;
}

function EquipmentDetailsReview({ equipment = [], lanes = [], assetErrors = {}, serialErrors = {}, laneErrors = {}, onChange, onRemove, onRegisterInput, onComplete }) {
  const activeEquipment = useMemo(() => sortEquipmentForDisplay(
    (Array.isArray(equipment) ? equipment : []).filter((item) => item?.active !== false),
    lanes,
  ), [equipment, lanes]);
  const [currentId, setCurrentId] = useState(null);
  const current = activeEquipment.find((item) => item.id === currentId) || activeEquipment[0] || null;
  const currentIndex = current ? activeEquipment.findIndex((item) => item.id === current.id) : 0;
  const currentAssetError = current ? assetErrors[current.id] || "" : "";
  const currentSerialError = current ? serialErrors[current.id] || "" : "";
  const currentLaneError = current ? laneErrors[current.id] || "" : "";
  const serialComplete = current ? isEquipmentSerialReadyForCreation(current) : true;
  const detailComplete = Boolean(current && !currentAssetError && !currentSerialError && !currentLaneError && serialComplete);
  useEffect(() => {
    if (!activeEquipment.length) {
      setCurrentId(null);
      return;
    }
    if (currentId && activeEquipment.some((item) => item.id === currentId)) return;
    const firstIncomplete = activeEquipment.find((item) => assetErrors[item.id] || serialErrors[item.id] || laneErrors[item.id] || !isEquipmentDetailComplete(item));
    setCurrentId((firstIncomplete || activeEquipment[0]).id);
  }, [activeEquipment, assetErrors, currentId, laneErrors, serialErrors]);
  if (!current) return <div className="ops-equipment-details-review"><div className="ops-equipment-step-heading"><div><p className="ops-eyebrow">ส่วนทะเบียนอุปกรณ์ · ขั้นที่ 4 จาก 5</p><h4>กรอกรายละเอียดอุปกรณ์</h4></div></div><EmptyState icon="equipment" title="ยังไม่มีอุปกรณ์ที่เลือก">กลับไปเลือกชนิดอุปกรณ์ก่อนกรอกรายละเอียด</EmptyState></div>;
  const lane = lanes.find((entry) => entry.id === current.laneId);
  const setField = (field, value) => onChange?.(current.id, field, value);
  const goNextItem = () => {
    if (!detailComplete) return;
    if (currentIndex >= activeEquipment.length - 1) onComplete?.();
    else setCurrentId(activeEquipment[currentIndex + 1].id);
  };
  return <div className="ops-equipment-details-review">
    <div className="ops-equipment-step-heading"><div><p className="ops-eyebrow">ส่วนทะเบียนอุปกรณ์ · ขั้นที่ 4 จาก 5</p><h4>กรอกรายละเอียดอุปกรณ์ทีละรายการ</h4><span>กรอกข้อมูลหลักให้เสร็จ แล้วกดบันทึกเพื่อไปยังอุปกรณ์ถัดไป</span></div><span className="ops-count-badge">รายการที่ {currentIndex + 1} จาก {activeEquipment.length}</span></div>
    <div className="ops-detail-progress"><span style={{ width: `${((currentIndex + 1) / Math.max(1, activeEquipment.length)) * 100}%` }} /></div>
    <article className="ops-equipment-detail-card"><div className="ops-equipment-detail-card-heading"><div><span className="ops-config-section-code">{getEquipmentCategoryCode(current)}</span><strong>{getEquipmentDisplayLabel(current)}</strong><small>{current.assetNo} · {isWimEquipment(current) ? (lane ? `Lane ${lane.laneNo} · ${lane.label}` : "ยังไม่ผูกเลน") : "อุปกรณ์ระดับสถานี"}</small></div><button type="button" className="ops-button ops-button-danger-ghost" onClick={() => onRemove?.(current)}><Icon name="delete" />นำออก</button></div>
      <div className="ops-equipment-detail-fields"><label className="ops-field ops-code-field"><span>รหัสอุปกรณ์ (Asset No.) <em>(จำเป็น)</em></span><input ref={(node) => onRegisterInput?.(current.id, node)} value={current.assetNo || ""} onChange={(event) => setField("assetNo", event.target.value)} aria-invalid={Boolean(currentAssetError)} />{currentAssetError && <span className="ops-field-error" role="alert">{currentAssetError}</span>}</label>{isWimEquipment(current) && <label className="ops-field"><span>เลนที่ติดตั้ง <em>(จำเป็น)</em></span><CustomSelect label="เลนที่ติดตั้ง" value={current.laneId || ""} onChange={(event) => setField("laneId", event.target.value)} aria-invalid={Boolean(currentLaneError)}><option value="">เลือกเลน</option>{lanes.filter((entry) => entry.active !== false).map((entry) => <option key={entry.id} value={entry.id}>Lane {entry.laneNo} · {entry.label}</option>)}</CustomSelect>{currentLaneError && <span className="ops-field-error" role="alert">{currentLaneError}</span>}</label>}</div>
      <label className="ops-field"><span>ตำแหน่งติดตั้ง <small className="ops-field-optional">(ไม่บังคับ)</small></span><input value={current.location === "ระบุตำแหน่ง" ? "" : current.location || ""} onChange={(event) => setField("location", event.target.value)} placeholder="เช่น ใต้พื้นถนน / ตู้ควบคุม" />{(!current.location || current.location === "ระบุตำแหน่ง") && <small className="ops-field-warning">ยังไม่ระบุตำแหน่ง · สามารถบันทึกต่อได้</small>}</label>
       <fieldset className="ops-serial-fieldset"><legend>Serial Number <em>(ถ้ามีข้อมูลค่อยกรอกภายหลังได้)</em></legend><div className="ops-serial-options"><label><input type="radio" name={`serial-status-${current.id}`} checked={current.serialStatus === "present"} onChange={() => setField("serialStatus", "present")} />มี Serial Number</label><label><input type="radio" name={`serial-status-${current.id}`} checked={current.serialStatus === "not-available"} onChange={() => setField("serialStatus", "not-available")} />ไม่มี / อ่านไม่ได้</label><label><input type="radio" name={`serial-status-${current.id}`} checked={current.serialStatus === "unknown"} onChange={() => setField("serialStatus", "unknown")} />ยังไม่ระบุ</label></div>{current.serialStatus === "present" && <input ref={(node) => onRegisterInput?.(`${current.id}:serial`, node)} className="ops-serial-value" value={current.serialNo || ""} onChange={(event) => setField("serialNo", event.target.value)} placeholder="กรอก Serial Number" aria-label="Serial Number" />}{current.serialStatus === "not-available" && <><input ref={(node) => onRegisterInput?.(`${current.id}:serial`, node)} className="ops-serial-value" value={current.serialReason || ""} onChange={(event) => setField("serialReason", event.target.value)} placeholder="ระบุเหตุผล (ไม่บังคับ) เช่น ไม่มีป้าย หรืออ่านไม่พบ" aria-label="เหตุผลที่ไม่มี Serial Number (ไม่บังคับ)" /><small className="ops-field-helper">เหตุผลเป็นข้อมูลเสริม ไม่จำเป็นต้องกรอก</small></>}{current.serialStatus === "unknown" && <small className="ops-field-helper">ยังไม่ต้องระบุได้ ระบบจะแสดงเป็นงานค้างให้เติมภายหลัง</small>}{currentSerialError && <small className="ops-field-error" role="alert">{currentSerialError}</small>}</fieldset>
      <div className="ops-detail-card-actions"><button type="button" className="ops-button ops-button-secondary" onClick={() => setCurrentId(activeEquipment[Math.max(0, currentIndex - 1)].id)} disabled={currentIndex === 0}><Icon name="arrow" />ก่อนหน้า</button><button type="button" className="ops-button ops-button-primary" onClick={goNextItem} disabled={!detailComplete}>{currentIndex >= activeEquipment.length - 1 ? "บันทึกและตรวจสอบทั้งหมด" : "บันทึกและไปอุปกรณ์ถัดไป"}<Icon name="arrow" /></button></div>
    </article>
    <div className="ops-equipment-step-note"><Icon name="info" /><span>รหัสอุปกรณ์ (Asset No.) และสถานะ Serial เป็นข้อมูลหลักที่ต้องครบ ส่วนตำแหน่งติดตั้งว่างได้แต่จะแสดงคำเตือนในหน้าตรวจสอบ</span></div>
  </div>;
}

function EquipmentFinalReview({ equipment = [], lanes = [] }) {
  const activeLanes = (Array.isArray(lanes) ? lanes : []).filter((lane) => lane?.active !== false);
  const activeEquipment = sortEquipmentForDisplay(
    (Array.isArray(equipment) ? equipment : []).filter((item) => item?.active !== false),
    activeLanes,
  );
  const groups = ITEM_LIBRARY_CATEGORIES.map((group) => ({ ...group, items: activeEquipment.filter((item) => getEquipmentCategoryCode(item) === group.code) })).filter((group) => group.items.length);
  const incompleteCount = countIncompleteEquipment(activeEquipment);
  const missingLocationCount = countMissingEquipmentLocations(activeEquipment);
  const customCount = activeEquipment.filter((item) => item.type === "CUSTOM").length;
  return <div className="ops-equipment-final-review">
    <div className="ops-equipment-step-heading"><div><p className="ops-eyebrow">ส่วนทะเบียนอุปกรณ์ · ขั้นที่ 5 จาก 5</p><h4>ตรวจสอบอุปกรณ์</h4><span>ตรวจจำนวน, Lane และข้อมูลก่อนตั้งค่า Checklist</span></div><StatusBadge status={activeEquipment.length && !incompleteCount ? "normal" : "waiting"}>{activeEquipment.length ? "พร้อมตรวจสอบ" : "ยังไม่มีอุปกรณ์"}</StatusBadge></div>
     <div className="ops-equipment-final-metrics"><div><strong>{activeEquipment.length}</strong><span>อุปกรณ์จริงในร่าง</span></div><div><strong>{activeLanes.length}</strong><span>Lane</span></div><div className={incompleteCount ? "is-warning" : ""}><strong>{incompleteCount}</strong><span>Serial ยังไม่ครบ</span></div></div>
     {activeLanes.length > 0 && <div className="ops-final-lane-summary"><div className="ops-subsection-heading"><strong>สรุปอุปกรณ์รายเลน</strong><span>Lane ไม่ถูกนับรวมเป็นอุปกรณ์</span></div><div className="ops-final-lane-grid">{activeLanes.map((lane) => <div key={lane.id}><strong>Lane {lane.laneNo} · {getLaneScope(lane, stationSystems) || "ไม่ระบุ Scope"}</strong><span>{activeEquipment.filter((item) => item.laneId === lane.id && item.type === "WIM_SENSOR").length} Sensor · {activeEquipment.filter((item) => item.laneId === lane.id && item.type === "WIM_LOOP").length} Loop</span></div>)}</div></div>}
     {groups.length ? <><div className="ops-equipment-final-groups">{groups.map((group) => <div className="ops-equipment-final-group" key={group.code}><span className="ops-config-section-code">{group.code}</span><div><strong>{group.title}</strong><span>{group.items.length} อุปกรณ์จริง</span></div><Icon name="check" /></div>)}</div><div className="ops-equipment-final-list" aria-label="รายการอุปกรณ์ทั้งหมด"><div className="ops-subsection-heading"><strong>รายการอุปกรณ์ทั้งหมด</strong><span>{activeEquipment.length} รายการ · ตรวจสอบรหัสอุปกรณ์ (Asset No.), Serial และ Lane</span></div>{activeEquipment.map((item) => { const lane = activeLanes.find((entry) => entry.id === item.laneId); return <div className="ops-equipment-final-list-row" key={item.id}><strong>{item.assetNo || "ยังไม่มีรหัสอุปกรณ์ (Asset No.)"}</strong><span>{getEquipmentDisplayLabel(item)}</span><small>{isWimEquipment(item) ? (lane ? `Lane ${lane.laneNo}` : "ยังไม่ผูกเลน") : "อุปกรณ์ระดับสถานี"} · {item.serialStatus === "present" ? `S/N ${item.serialNo}` : item.serialStatus === "not-available" ? `ไม่มี Serial · ${item.serialReason}` : "ยังไม่ระบุสถานะ Serial"}</small></div>; })}</div></> : <div className="ops-equipment-step-note"><Icon name="alert" /><span>ยังไม่มีอุปกรณ์จริง สถานีจะใช้เฉพาะรายการตรวจระดับสถานีที่เกี่ยวข้อง</span></div>}
    {missingLocationCount > 0 && <div className="ops-warning-panel" role="status"><Icon name="alert" /><div><strong>ยังไม่ระบุตำแหน่ง {missingLocationCount} รายการ</strong><span>สามารถสร้างสถานีได้ แต่ควรกลับมาเติมข้อมูลตำแหน่งก่อนเริ่มรอบตรวจ</span></div></div>}
    {customCount > 0 && <div className="ops-warning-panel" role="status"><Icon name="alert" /><div><strong>มีอุปกรณ์กำหนดเอง (Custom) {customCount} รายการ</strong><span>จะเก็บไว้ในทะเบียนสถานี และมีรายการตรวจทั่วไป แต่ยังไม่มีรายการตรวจเฉพาะด้าน</span></div></div>}
  </div>;
}

function StationItemComposer({ systems = [], stationSystems = [], catalog, equipment, lanes = [], subStep = 1, selectedCategoryCodes = [], selectedCategoryCode, message, assetErrors = {}, serialErrors = {}, laneErrors = {}, onSubStepChange, onCategoryChange, onToggleCategory, onQuantityChange, onQuantitySet, onChange, onRemove, onRegisterInput, onChangeLanes, onAssignLane, onAssignParentSystem, onAddLane, onRemoveLane, onCompleteDetails }) {
  return <div className="ops-equipment-selection-flow">
    <div className="ops-equipment-selection-main">
      <EquipmentSelectionStepper current={subStep} onChange={onSubStepChange} />
      <div className="ops-equipment-step-pane">
        {message && <div className="ops-composer-live" role="status" aria-live="polite">{message}</div>}
        <div className="ops-equipment-step-content">
          {subStep === 1 && <EquipmentCategorySelection systems={systems} equipment={equipment} selectedCategoryCodes={selectedCategoryCodes} onToggle={onToggleCategory} />}
           {subStep === 2 && <EquipmentQuantitySelection systems={systems} catalog={catalog} equipment={equipment} selectedCategoryCodes={selectedCategoryCodes} selectedCategoryCode={selectedCategoryCode} onQuantityChange={onQuantityChange} onQuantitySet={onQuantitySet} onCategoryChange={onCategoryChange} onBackToCategories={() => onSubStepChange?.(1)} />}
          {subStep === 3 && <LaneAssignmentStep lanes={lanes} equipment={equipment} stationSystems={stationSystems} laneErrors={laneErrors} onChangeLanes={onChangeLanes} onAssignLane={onAssignLane} onAssignParentSystem={onAssignParentSystem} onAddLane={onAddLane} onRemoveLane={onRemoveLane} />}
          {subStep === 4 && <EquipmentDetailsReview equipment={equipment} lanes={lanes} assetErrors={assetErrors} serialErrors={serialErrors} laneErrors={laneErrors} onChange={onChange} onRemove={onRemove} onRegisterInput={onRegisterInput} onComplete={onCompleteDetails} />}
          {subStep === 5 && <EquipmentFinalReview equipment={equipment} lanes={lanes} />}
        </div>
      </div>
    </div>
    <EquipmentSelectionSummary systems={systems} equipment={equipment} lanes={lanes} selectedCategoryCodes={selectedCategoryCodes} onViewDetails={() => onSubStepChange?.(4)} />
  </div>;
}

function StationTorSummary({ items = [], equipment = [], compact = false }) {
  const summary = summarizeStationTorItems(items);
  const presentationItems = getStationTorPresentationItems(items);
  const scopeLabels = { "high-speed": "High Speed", "low-speed": "Low Speed", station: "Station-wide", central: "Central", imps: "ImPS", image: "Image Processing", "3d": "3D" };
  const unitSummary = Object.entries(summary.quantityByUnit).map(([unit, quantity]) => `${quantity} ${unit}`).join(" · ");
  const kindLabels = { asset: "อุปกรณ์", system: "ระบบ", service: "งานบริการ" };
  const activeCounts = (Array.isArray(equipment) ? equipment : []).filter((entry) => entry?.active !== false).reduce((totals, entry) => ({ ...totals, [entry.type]: (totals[entry.type] || 0) + 1 }), {});
  const normalizedScope = (scope) => String(scope || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  const activeCountsByScope = (Array.isArray(equipment) ? equipment : []).filter((entry) => entry?.active !== false).reduce((totals, entry) => {
    const key = normalizedScope(entry.scope);
    if (!key) return totals;
    const typeTotals = totals[entry.type] || {};
    return { ...totals, [entry.type]: { ...typeTotals, [key]: (typeTotals[key] || 0) + 1 } };
  }, {});
  const scopeAwareCounts = new Set(["highspeed", "lowspeed", "3d", "imps", "image", "imageprocessing", "central", "stationwide"]);
  const installedCountFor = (entry) => {
    if (!entry.assetType) return null;
    const scopeKey = normalizedScope(entry.scope);
    return scopeAwareCounts.has(scopeKey)
      ? (activeCountsByScope[entry.assetType]?.[scopeKey] || 0)
      : (activeCounts[entry.assetType] || 0);
  };
  const groups = Object.entries(presentationItems.reduce((result, entry) => {
    const category = entry.category || "อื่น ๆ";
    return { ...result, [category]: [...(result[category] || []), entry] };
  }, {}));
  return <details className={`ops-system-summary ops-system-summary-collapsible ${compact ? "is-compact" : ""}`}>
    <summary className="ops-system-summary-toggle"><div><strong>รายการ TOR ประจำสถานี</strong><span>ชื่อ หมวด ขอบเขต ปริมาณและหน่วยจากเอกสาร แยกจากทะเบียนอุปกรณ์จริง</span></div><span className="ops-count-badge">{summary.lineCount} รายการ</span></summary>
    <div className="ops-system-summary-body"><div className="ops-system-summary-content">
      <div className="ops-system-summary-heading"><div><strong>ยอดอ้างอิงตาม TOR</strong><span>ไม่รวมหน่วยต่างชนิดเป็นจำนวนอุปกรณ์เดียว</span></div><div className="ops-system-summary-totals"><strong>{summary.lineCount} บรรทัด</strong><span>{unitSummary || "ไม่มีข้อมูล"}</span></div></div>
      <div className="ops-system-summary-list">{groups.map(([category, entries]) => <details className="ops-system-summary-group" key={category}><summary className="ops-system-summary-group-toggle"><span className="ops-config-section-code">{category}</span><div className="ops-system-summary-group-title"><strong>หมวด {category}</strong><span>{entries.length} รายการ</span></div></summary><div className="ops-system-summary-children">{entries.map((entry) => <article className={`ops-system-summary-child is-${entry.kind}`} key={entry.id}><div className="ops-system-summary-child-main"><span className="ops-system-summary-child-mark"><Icon name={entry.kind === "asset" ? "equipment" : entry.kind === "service" ? "refresh" : "archive"} size="small" /></span><div><strong>{entry.displayName}</strong><span>{entry.sourceName} · {scopeLabels[entry.scope] || entry.scope}</span></div></div><div className="ops-system-summary-child-meta"><span className={`ops-system-summary-status is-${entry.kind}`}>{kindLabels[entry.kind] || entry.kind}</span><output className="ops-system-summary-count"><strong>{entry.quantity} {entry.unit}</strong><span>{entry.kind === "asset" ? (entry.assetType ? `ติดตั้งจริง ${installedCountFor(entry) || 0} รายการ` : "ยังไม่ผูกกับทะเบียนอุปกรณ์") : "อ้างอิง TOR"}</span></output></div></article>)}</div></details>)}</div>
    </div></div>
  </details>;
}

const VEHICLE_CONNECTION_STATUS_META = Object.freeze({
  [VEHICLE_SEARCH_CONNECTION_STATUS.NOT_CONFIGURED]: { label: "ยังไม่ได้ตั้งค่า", tone: "waiting" },
  [VEHICLE_SEARCH_CONNECTION_STATUS.UNTESTED]: { label: "ตั้งค่าแล้ว ยังไม่ได้ทดสอบ", tone: "waiting" },
  [VEHICLE_SEARCH_CONNECTION_STATUS.CONNECTED]: { label: "เชื่อมต่อได้", tone: "normal" },
  [VEHICLE_SEARCH_CONNECTION_STATUS.FAILED]: { label: "เชื่อมต่อไม่ได้", tone: "damaged" },
});

function VehicleSearchConfigPanel({ value, stationId = "new", disabled = false, onChange, notify }) {
  const normalizedConfig = createVehicleSearchConfig(value, "");
  const [fullUrlDraft, setFullUrlDraft] = useState(() => String(normalizedConfig.searchUrl || (normalizedConfig.connectionMode === VEHICLE_CONNECTION_MODES.PROXY ? "" : normalizedConfig.baseUrl || "")));
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [stationTestNote, setStationTestNote] = useState("");
  const abortRef = useRef(null);
  const status = VEHICLE_CONNECTION_STATUS_META[normalizedConfig.connectionStatus] || VEHICLE_CONNECTION_STATUS_META[VEHICLE_SEARCH_CONNECTION_STATUS.NOT_CONFIGURED];
  const parsedDraft = parseVehicleSearchUrl(fullUrlDraft, { fallbackBaseUrl: "" });
  const summaryMode = parsedDraft.valid ? parsedDraft.mode : normalizedConfig.connectionMode;
  const summaryProfile = parsedDraft.valid ? parsedDraft.apiProfile : normalizedConfig.apiProfile;
  const summaryStationHost = parsedDraft.valid ? parsedDraft.stationHost : normalizedConfig.stationHost;
  const summaryStationPort = parsedDraft.valid ? parsedDraft.stationPort : normalizedConfig.stationPort;
  const summaryProxyHost = parsedDraft.valid ? parsedDraft.proxyHost : normalizedConfig.proxyHost;
  const summaryProxyPort = parsedDraft.valid ? parsedDraft.proxyPort : normalizedConfig.proxyPort;
  const summaryStationId = stationTestNote || normalizedConfig.stationId || "จะอ่านจาก API หลังทดสอบ";

  useEffect(() => {
    setFullUrlDraft(String(normalizedConfig.searchUrl || (normalizedConfig.connectionMode === VEHICLE_CONNECTION_MODES.PROXY ? "" : normalizedConfig.baseUrl || "")));
    setError("");
    setStationTestNote("");
  }, [stationId]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const handleTest = async () => {
    const parsed = parseVehicleSearchUrl(fullUrlDraft, { fallbackBaseUrl: "" });
    if (!parsed.valid) {
      setError(parsed.error || "URL ของ Vehicle API ไม่ถูกต้อง");
      setStationTestNote("");
      return;
    }
    const draftConfig = createVehicleSearchConfig({ baseUrl: parsed.sourceUrl, stationId: null, stationName: null }, "");
    if (!draftConfig.baseUrl) {
      setError("URL ของ Vehicle API ไม่มีปลายทางสถานีที่ใช้งานได้");
      setStationTestNote("");
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setTesting(true);
    setError("");
    setStationTestNote("");
    onChange?.({ ...draftConfig, connectionStatus: VEHICLE_SEARCH_CONNECTION_STATUS.UNTESTED, lastTestedAt: null, stationId: null, stationName: null });
    try {
      const result = await testVehicleSearchConnection(draftConfig.baseUrl, { apiProfile: draftConfig.apiProfile, searchUrl: draftConfig.searchUrl, signal: controller.signal, stationProfileId: stationId, transport: "direct-first" });
      const apiStationId = result.sourceStation?.id || null;
      const apiStationName = result.sourceStation?.name || null;
      onChange?.({ ...draftConfig, stationId: apiStationId, stationName: apiStationName, connectionStatus: VEHICLE_SEARCH_CONNECTION_STATUS.CONNECTED, lastTestedAt: result.testedAt });
      setStationTestNote(apiStationId ? `stationID จาก API: ${apiStationId}${apiStationName ? ` · ${apiStationName}` : ""}` : "API ไม่ส่ง stationID แต่เชื่อมต่อสำเร็จ");
      notify?.("ทดสอบ API ป้ายทะเบียนสำเร็จ");
    } catch (testError) {
      if (testError?.name === "AbortError") return;
      onChange?.({ ...draftConfig, stationId: null, stationName: null, connectionStatus: VEHICLE_SEARCH_CONNECTION_STATUS.FAILED, lastTestedAt: new Date().toISOString() });
      setError(testError?.message || "ทดสอบการเชื่อมต่อ API ไม่สำเร็จ");
      notify?.(testError?.message || "ทดสอบการเชื่อมต่อ API ไม่สำเร็จ");
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setTesting(false);
      }
    }
  };

  const connectionModeLabel = summaryMode === VEHICLE_CONNECTION_MODES.PROXY ? "Proxy" : "Direct";
  const apiProfileLabel = VEHICLE_API_PROFILE_OPTIONS.find((option) => option.value === summaryProfile)?.label || summaryProfile;

  return <section className="ops-vehicle-config-panel" aria-labelledby={`vehicle-config-title-${stationId}`}>
    <div className="ops-vehicle-config-heading"><div><p className="ops-eyebrow">VEHICLE API</p><h4 id={`vehicle-config-title-${stationId}`}>การเชื่อมต่อข้อมูลป้ายทะเบียน</h4><span>ตั้งค่าปลายทางของสถานีนี้เพื่อใช้ดึงผลอ่านและภาพป้ายทะเบียน</span></div><StatusBadge status={status.tone}>{status.label}</StatusBadge></div>
    <div className="ops-vehicle-config-primary">
      <label className="ops-field ops-field-wide" htmlFor={`vehicle-api-full-url-${stationId}`}><span>วาง URL เต็มของ Vehicle API</span><input id={`vehicle-api-full-url-${stationId}`} type="url" value={fullUrlDraft} disabled={disabled || testing} onChange={(event) => { setFullUrlDraft(event.target.value); setError(""); setStationTestNote(""); }} placeholder="เช่น http://proxy-host:port/api?target=http://station-host:port/api/vehicle/search" autoComplete="url" spellCheck="false" /><small className="ops-field-helper">คัดลอก URL จากผู้สร้างสถานีมาวาง ระบบจะแยก Direct/Proxy, IP/Port และรูปแบบ API แล้วทดสอบให้ในปุ่มเดียว</small>{error && <small className="ops-field-error" role="alert">{error}</small>}</label>
      <div className="ops-vehicle-config-primary-actions"><button type="button" className="ops-button ops-button-primary ops-vehicle-config-test" onClick={handleTest} disabled={disabled || testing || !String(fullUrlDraft || "").trim()}>{testing ? "กำลังทดสอบ..." : "วาง URL แล้วทดสอบ"}</button></div>
      <div className="ops-vehicle-config-summary" role="status"><span>การเชื่อมต่อ <strong>{connectionModeLabel}</strong></span><span>API <strong>{apiProfileLabel}</strong></span><span>สถานีจาก URL <strong>{summaryStationHost || "ยังไม่ระบุ"}{summaryStationPort ? `:${summaryStationPort}` : ""}</strong></span>{summaryMode === VEHICLE_CONNECTION_MODES.PROXY && <span>Proxy จาก URL <strong>{summaryProxyHost ? `${summaryProxyHost}${summaryProxyPort ? `:${summaryProxyPort}` : ""}` : "ยังไม่ระบุ"}</strong></span>}<span>stationID <strong>{summaryStationId}</strong></span></div>
    </div>
    <div className="ops-vehicle-config-purpose" role="note"><Icon name="info" size="small" /><div><strong>ใช้สำหรับ</strong><span>{VEHICLE_SEARCH_PURPOSE} · ไม่รวมในตัวนับ Checklist หรือ Evidence</span></div></div>
    {normalizedConfig.lastTestedAt && <small className="ops-vehicle-config-tested">ทดสอบล่าสุด {formatDateTime(normalizedConfig.lastTestedAt)}{normalizedConfig.stationName ? ` · ${normalizedConfig.stationName}` : ""}</small>}
    {error && <div className="ops-vehicle-search-error" role="alert"><Icon name="alert" size="small" /><span>{error}</span></div>}
  </section>;
}


function StationDraftEquipmentRow({ equipment, error, inputRef, onChange, onRemove }) {
  const errorId = `draft-asset-error-${equipment.id}`;
  return <article className="ops-equipment-row ops-draft-equipment-row"><div className="ops-draft-asset-summary"><div className="ops-equipment-title"><span className="ops-equipment-icon"><Icon name={getEquipmentIconName(equipment.type)} /></span><div><strong>{getEquipmentDisplayLabel(equipment)}</strong><span>{equipment.assetNo || "ยังไม่มีรหัสอุปกรณ์ (Asset No.)"} · {equipment.location || "ยังไม่ระบุตำแหน่ง"}</span><small>{equipment.type === "CUSTOM" ? "อุปกรณ์กำหนดเอง (Custom) · มีรายการตรวจทั่วไป แต่ยังไม่มีรายการตรวจเฉพาะ" : `${equipment.categoryCode || getEquipmentCategoryCode(equipment)} · รายการระบบ`}</small></div></div><Button onClick={() => onRemove(equipment)} variant="danger-ghost" icon="delete">นำออก</Button></div><div className="ops-draft-asset-primary"><label className="ops-field ops-code-field" htmlFor={`draft-asset-${equipment.id}`}><span>รหัสอุปกรณ์ (Asset No.) <em>(จำเป็น)</em></span><input id={`draft-asset-${equipment.id}`} ref={inputRef} value={equipment.assetNo} onChange={(event) => onChange(equipment.id, "assetNo", event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} />{error && <span id={errorId} className="ops-field-error" role="alert">{error}</span>}</label><span className="ops-draft-asset-hint">ระบบสร้างรหัสเริ่มต้นให้แล้ว แก้ได้ถ้าหน้างานใช้รหัสอื่น</span></div><details className="ops-draft-asset-details"><summary>รายละเอียดติดตั้ง <span>{equipment.location || "ยังไม่ระบุตำแหน่ง"}{equipment.serialNo ? ` · S/N ${equipment.serialNo}` : ""}</span></summary><div className="ops-equipment-fields"><label className="ops-field" htmlFor={`draft-location-${equipment.id}`}><span>ตำแหน่งติดตั้ง</span><input id={`draft-location-${equipment.id}`} value={equipment.location} onChange={(event) => onChange(equipment.id, "location", event.target.value)} /></label><label className="ops-field ops-code-field" htmlFor={`draft-serial-${equipment.id}`}><span>Serial Number <em>(ถ้ามี)</em></span><input id={`draft-serial-${equipment.id}`} value={equipment.serialNo} onChange={(event) => onChange(equipment.id, "serialNo", event.target.value)} /></label>{equipment.type === "WIM_SWITCHING_DC" && <fieldset className="ops-serial-fieldset"><legend>แรงดัน Output ภายใน Switching DC</legend><div className="ops-serial-options ops-serial-segmented" role="group" aria-label={`แรงดัน Output ของ ${equipment.assetNo}`}>{WIM_ELECTRONICS_OUTPUT_VOLTAGES.map((voltage) => { const selected = (equipment.outputVoltages || []).includes(voltage); return <label key={voltage} className={selected ? "is-selected" : ""}><input type="checkbox" checked={selected} onChange={() => { const current = Array.isArray(equipment.outputVoltages) ? equipment.outputVoltages : []; onChange(equipment.id, "outputVoltages", selected ? current.filter((entry) => entry !== voltage) : [...current, voltage].sort((left, right) => left - right)); }} /><span>{voltage}VDC</span></label>; })}</div><small className="ops-field-helper">เลือกเฉพาะแรงดันที่มีจริง และแยก 24VDC จาก 24VAC</small></fieldset>}</div></details></article>;
}

function EquipmentCatalogAddPanel({ catalog, canonicalItems = [], stationEquipment = [], stationFormat = "SC", stationSystems = [], disabled = false, onAdd }) {
  const stationProfileContext = useContext(StationProfileEquipmentContext);
  const currentCanonicalItems = canonicalItems.length ? canonicalItems : stationProfileContext.canonicalItems;
  const currentStationEquipment = stationProfileContext.stationEquipment || stationEquipment;
  const activeCatalog = (Array.isArray(catalog) ? catalog : []).filter((item) => item.active !== false && !getEquipmentType(item.type)?.legacyOnly);
  const [selectedId, setSelectedId] = useState(activeCatalog[0]?.id || "");
  const [ownerSystemId, setOwnerSystemId] = useState("");
  const [parentCabinetId, setParentCabinetId] = useState("");
  const [wimParentId, setWimParentId] = useState("");
  const selected = activeCatalog.find((item) => item.id === selectedId) || null;
  const isWimChild = isWimEquipment(selected);
  const isElectronicsChild = isWimElectronicsSubEquipmentType(selected?.type);
  const wimParents = getWimSortingSystemInstances(stationSystems);
  const wimParent = wimParents.find((item) => item.id === wimParentId);
  const definition = currentCanonicalItems.find((item) => item.kind === "asset" && item.equipmentType === selected?.type)
    || getCanonicalItemsForFormat(stationFormat).find((item) => item.kind === "asset" && item.equipmentType === selected?.type);
  const ownerIds = definition?.systemIds || [];
  const ownerSystemOptions = stationSystems.filter((system) => system.active !== false && Number(system.quantity ?? 1) > 0
    && ownerIds.includes(system.canonicalItemId || (system.systemId === "wim" && system.componentId === "electronics" ? "wim-electronics-system" : system.systemId)));
  const parentCabinetOptions = currentStationEquipment.filter((asset) => asset.type === "CONTROL_CABINET" && asset.active !== false);
  const parentCabinet = parentCabinetOptions.find((asset) => asset.id === parentCabinetId) || (parentCabinetOptions.length === 1 ? parentCabinetOptions[0] : null);
  const cabinetOwnerOptions = ownerSystemOptions.filter((system) => !parentCabinet?.scope || !system.scope
    || String(system.scope).trim().toLowerCase() === String(parentCabinet.scope).trim().toLowerCase());
  const ownerSystem = ownerSystemOptions.find((system) => system.id === ownerSystemId) || (ownerSystemOptions.length === 1 ? ownerSystemOptions[0] : null);
  const electronicsParentSystem = cabinetOwnerOptions.find((system) => system.id === parentCabinet?.parentSystemId)
    || cabinetOwnerOptions.find((system) => system.id === ownerSystemId)
    || (cabinetOwnerOptions.length === 1 ? cabinetOwnerOptions[0] : null);
  const resolvedParentSystem = isWimChild ? wimParent : isElectronicsChild ? electronicsParentSystem : ownerSystem;
  const allowedScopes = definition?.scopeVariants?.length ? definition.scopeVariants : definition?.allowedScopes || [];
  const selectedScope = isWimChild ? wimParent?.scope || "" : isElectronicsChild ? parentCabinet?.scope || resolvedParentSystem?.scope || "" : resolvedParentSystem?.scope || (allowedScopes.length === 1 ? allowedScopes[0] : "");
  const displayCategory = getBoqAddCategory({ stationFormat, type: selected?.type, categoryCode: selected?.categoryCode, scope: selectedScope });

  useEffect(() => {
    if (!activeCatalog.some((item) => item.id === selectedId)) setSelectedId(activeCatalog[0]?.id || "");
  }, [catalog, selectedId]);

  return <section className="ops-detail-asset-add" aria-labelledby="detail-asset-add-title">
    <div className="ops-detail-asset-add-heading"><div><p className="ops-eyebrow">เพิ่มอุปกรณ์</p><h4 id="detail-asset-add-title">เพิ่มอุปกรณ์</h4><span>เลือกจากระบบหรือคลังอุปกรณ์กำหนดเอง (Custom) ระบบจะสร้างรหัสอุปกรณ์ (Asset No.) ถัดไปให้ไม่ซ้ำในสถานีนี้</span></div><span className="ops-count-badge">{activeCatalog.length}</span></div>
    <div className="ops-detail-asset-add-controls">
      <label className="ops-field ops-field-wide" htmlFor="station-detail-catalog-item"><span>ไอเทมจากคลัง</span><CustomSelect id="station-detail-catalog-item" label="ไอเทมจากคลัง" value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setScope(""); setWimParentId(""); }} disabled={disabled || !activeCatalog.length}><option value="">เลือกไอเทม</option>{ITEM_LIBRARY_CATEGORIES.map((group) => { const items = activeCatalog.filter((item) => item.categoryCode === group.code); return items.length ? <optgroup key={group.code} label={`${group.code} · ${group.title}`}>{items.map((item) => <option key={item.id} value={item.id}>{item.nameEn || item.label} · {item.label} · {item.prefix}</option>)}</optgroup> : null; })}</CustomSelect></label>
      {selected && isWimChild && <label className="ops-field"><span>WIM Sorting System แม่</span><CustomSelect label="WIM Sorting System แม่" value={wimParentId} onChange={(event) => setWimParentId(event.target.value)}><option value="">เลือกระบบแม่</option>{wimParents.map((parent) => <option key={parent.id} value={parent.id}>#{parent.instanceNo || "?"} · {parent.scope || "ไม่ระบุชุด"}</option>)}</CustomSelect></label>}
      {selected && !isWimChild && !isElectronicsChild && ownerSystemOptions.length > 1 && <label className="ops-field"><span>System แม่</span><CustomSelect label="System แม่" value={ownerSystem?.id || ""} onChange={(event) => setOwnerSystemId(event.target.value)}><option value="">เลือกระบบแม่</option>{ownerSystemOptions.map((system) => <option key={system.id} value={system.id}>{system.displayLabel || system.nameEn || system.canonicalItemId} · {system.scope || "ไม่ระบุ Scope"}</option>)}</CustomSelect></label>}
      {selected && isElectronicsChild && parentCabinetOptions.length > 1 && <label className="ops-field"><span>WIM Electronics Cabinet</span><CustomSelect label="WIM Electronics Cabinet" value={parentCabinet?.id || ""} onChange={(event) => { setParentCabinetId(event.target.value); setOwnerSystemId(""); }}><option value="">เลือก Cabinet แม่</option>{parentCabinetOptions.map((cabinet) => <option key={cabinet.id} value={cabinet.id}>{cabinet.assetNo || "ไม่มี Asset No."} · {cabinet.scope || "ไม่ระบุ Scope"}</option>)}</CustomSelect></label>}
      {selected && isElectronicsChild && parentCabinet && !parentCabinet.parentSystemId && cabinetOwnerOptions.length > 1 && <label className="ops-field"><span>WIM Electronics System แม่</span><CustomSelect label="WIM Electronics System แม่" value={electronicsParentSystem?.id || ""} onChange={(event) => setOwnerSystemId(event.target.value)}><option value="">เลือกระบบแม่</option>{cabinetOwnerOptions.map((system) => <option key={system.id} value={system.id}>{system.displayLabel || system.nameEn || system.canonicalItemId} · {system.scope || "ไม่ระบุ Scope"}</option>)}</CustomSelect></label>}
      {selected && !isWimChild && !isElectronicsChild && !ownerIds.length && allowedScopes.length > 1 && <small className="ops-field-helper">เลือกกลุ่มหรือ System ที่เกี่ยวข้องก่อน เพื่อกำหนด Scope อัตโนมัติ</small>}
      <div className="ops-detail-asset-add-preview">{selected ? <><strong>{[selected.nameEn, selected.label].filter(Boolean).join(" · ")}</strong><span>{displayCategory.code || "เลือกชุดระบบ"} · {displayCategory.title}</span><small>BOQ/TOR {selected.categoryCode} · Prefix {selected.prefix}</small></> : <span>ยังไม่มีไอเทมที่เปิดใช้ในคลัง</span>}</div>
      {selected && (ownerIds.length > 0 || isElectronicsChild) && <div className="sc-readonly-field"><span>Scope</span><strong>{selectedScope || "ยังระบุไม่ได้"}</strong><small>กำหนดจาก System หรือ Cabinet แม่</small></div>}
      <Button onClick={() => selected && onAdd(selected, 1, { scope: selectedScope, wimSystemIds: isWimChild ? [wimParentId] : [], parentSystemId: resolvedParentSystem?.id || null, parentAssetId: isElectronicsChild ? parentCabinet?.id || null : null })} variant="primary" icon="plus" disabled={disabled || !selected || !displayCategory.code || (isWimChild && !wimParent) || (!isWimChild && ownerIds.length > 0 && !resolvedParentSystem) || (isElectronicsChild && !parentCabinet)} >เพิ่มเข้าทะเบียน</Button>
    </div>
    {!activeCatalog.length ? <div className="ops-info-banner"><Icon name="info" /><span>ยังไม่มีแม่แบบอุปกรณ์ที่เปิดใช้ในระบบ</span></div> : <small className="ops-field-helper">ตำแหน่งติดตั้งแนะนำให้กรอกหลังเพิ่มรายการ ส่วน Serial Number ไม่บังคับ</small>}
  </section>;
}

function EquipmentQuickAddPanel({ catalog, canonicalItems = [], stationFormat = "SC", initialGroupId = null, initialBoqGroupCode = "", initialCategoryId = "", initialRecordKind = "", activeLanes = [], stationSystems = [], stationEquipment = [], disabled = false, open = false, onClose, onAdd, onAddSystem }) {
  const contextGroup = initialGroupId ? SC_OPERATION_SYSTEM_GROUPS.find((group) => group.id === initialGroupId) || null : null;
  const contextScope = getBoqScopeForGroup(stationFormat, initialBoqGroupCode);
  const contextBoqGroup = BOQ_CHECKLIST_GROUPS[String(stationFormat).toUpperCase() === "IMPS" ? "IMPS" : "SC"].find((group) => group.code === String(initialBoqGroupCode).replace(/^(SC|IMPS)-/i, "")) || null;
  const scopedCanonicalItems = useMemo(() => filterCatalogItemsByBoqGroup(canonicalItems, canonicalItems, { stationFormat, groupCode: initialBoqGroupCode }), [canonicalItems, stationFormat, initialBoqGroupCode]);
  const contextCategoryAssetTypes = useMemo(() => new Set(scopedCanonicalItems
    .filter((item) => item.kind === "asset" && (!initialCategoryId || getRelationshipCategoryForAsset({ type: item.equipmentType, categoryCode: item.checklistMapping?.[0], scope: contextScope }) === initialCategoryId))
    .map((item) => item.equipmentType).filter(Boolean)), [scopedCanonicalItems, initialCategoryId, contextScope]);
  const contextCategorySystemIds = useMemo(() => new Set(scopedCanonicalItems
    .filter((item) => item.kind === "system" && (!initialCategoryId || getRelationshipCategoryForSystem({ canonicalItemId: item.id, systemId: item.id, sourceRefs: item.checklistMapping, scope: contextScope }) === initialCategoryId))
    .map((item) => item.id)), [scopedCanonicalItems, initialCategoryId, contextScope]);
  const groupedCatalog = useMemo(() => filterCatalogItemsByBoqGroup(catalog, canonicalItems, { stationFormat, groupCode: initialBoqGroupCode }), [catalog, canonicalItems, stationFormat, initialBoqGroupCode]);
  const contextAssetTypes = useMemo(() => new Set((Array.isArray(canonicalItems) ? canonicalItems : []).filter((item) => item.kind === "asset" && (!contextGroup || getScSystemGroupForCanonical(item) === contextGroup.id)).map((item) => item.equipmentType).filter(Boolean)), [canonicalItems, contextGroup?.id]);
  const activeCatalog = useMemo(() => groupedCatalog.filter((item) => item.active !== false && !getEquipmentType(item.type)?.legacyOnly
    && (!initialBoqGroupCode && contextGroup ? contextAssetTypes.has(item.type) : true)
    && (!initialCategoryId || contextCategoryAssetTypes.has(item.type))), [groupedCatalog, initialBoqGroupCode, contextGroup?.id, contextAssetTypes, initialCategoryId, contextCategoryAssetTypes]);
  const availableSystems = useMemo(() => scopedCanonicalItems.filter((item) => item.kind === "system"
    && (!initialBoqGroupCode && contextGroup ? getScSystemGroupForCanonical(item) === contextGroup.id : true)
    && (!initialCategoryId || contextCategorySystemIds.has(item.id))), [scopedCanonicalItems, initialBoqGroupCode, contextGroup?.id, initialCategoryId, contextCategorySystemIds]);
  const categories = useMemo(() => ITEM_LIBRARY_CATEGORIES.map((category) => ({
    ...category,
    items: activeCatalog.filter((item) => item.categoryCode === category.code),
  })).filter((category) => category.items.length && (!contextGroup || initialBoqGroupCode || contextGroup.categoryCodes.includes(category.code))), [activeCatalog, contextGroup?.id, initialBoqGroupCode]);
  const catalogItems = useMemo(() => categories.flatMap((category) => category.items.map((item) => ({ ...item, categoryTitle: category.title }))), [categories]);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogCategoryCode, setCatalogCategoryCode] = useState("all");
  const [catalogItemId, setCatalogItemId] = useState("");
  const [recordKind, setRecordKind] = useState(() => initialRecordKind === "system" && availableSystems.length ? "system" : initialRecordKind === "asset" && categories.length ? "asset" : categories.length ? "asset" : availableSystems.length ? "system" : "asset");
  const [systemCategory, setSystemCategory] = useState("all");
  const [systemItemId, setSystemItemId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [laneAssignments, setLaneAssignments] = useState([]);
  const [systemLaneAssignments, setSystemLaneAssignments] = useState([]);
  const [wimParentAssignments, setWimParentAssignments] = useState([]);
  const [selectedScope, setSelectedScope] = useState("");
  const [ownerSystemId, setOwnerSystemId] = useState("");
  const [parentCabinetId, setParentCabinetId] = useState("");
  const selectedItem = catalogItems.find((item) => item.id === catalogItemId) || null;
  const systemCategories = useMemo(() => Array.from(new Set(availableSystems.map((item) => item.category).filter(Boolean))), [availableSystems]);
  const visibleSystems = useMemo(() => availableSystems.filter((item) => systemCategory === "all" || item.category === systemCategory), [availableSystems, systemCategory]);
  const selectedSystem = visibleSystems.find((item) => item.id === systemItemId) || visibleSystems[0] || null;
  const isWimCatalogItem = isWimEquipment(selectedItem);
  const isWimSortingSystem = selectedSystem?.id === WIM_SORTING_SYSTEM_CANONICAL_ID;
  const activeWimSystems = getWimSortingSystemInstances(stationSystems).filter((system) => !contextScope || !system.scope || String(system.scope).trim().toLowerCase() === contextScope.toLowerCase());
  const definition = canonicalItems.find((item) => item.kind === "asset" && item.equipmentType === selectedItem?.type);
  const parentSystemKey = (system) => String(system?.canonicalItemId || (system?.systemId === "wim" && system?.componentId === "electronics" ? "wim-electronics-system" : system?.systemId || system?.id || ""));
  const allowedOwnerIds = definition?.systemIds || [];
  const ownerSystemOptions = (stationSystems || []).filter((system) => system.active !== false && Number(system.quantity ?? 1) > 0
    && allowedOwnerIds.includes(parentSystemKey(system))
    && (!contextScope || !system.scope || String(system.scope).trim().toLowerCase() === contextScope.toLowerCase()));
  const selectedOwnerSystem = ownerSystemOptions.find((system) => system.id === ownerSystemId) || (ownerSystemOptions.length === 1 ? ownerSystemOptions[0] : null);
  const isWimElectronicsChild = isWimElectronicsSubEquipmentType(selectedItem?.type);
  const parentCabinetOptions = (stationEquipment || []).filter((asset) => asset.type === "CONTROL_CABINET" && asset.active !== false
    && (!contextScope || !asset.scope || String(asset.scope).trim().toLowerCase() === contextScope.toLowerCase()));
  const selectedParentCabinet = parentCabinetOptions.find((asset) => asset.id === parentCabinetId) || (parentCabinetOptions.length === 1 ? parentCabinetOptions[0] : null);
  const cabinetOwnerOptions = ownerSystemOptions.filter((system) => !selectedParentCabinet?.scope || !system.scope
    || String(system.scope).trim().toLowerCase() === String(selectedParentCabinet.scope).trim().toLowerCase());
  const selectedCabinetOwner = cabinetOwnerOptions.find((system) => system.id === selectedParentCabinet?.parentSystemId)
    || cabinetOwnerOptions.find((system) => system.id === ownerSystemId)
    || (cabinetOwnerOptions.length === 1 ? cabinetOwnerOptions[0] : null);
  const rawScopeOptions = recordKind === "system" ? selectedSystem?.id?.startsWith("dimension-") ? ["3D"] : selectedSystem?.allowedScopes || [] : ["LASER_SCANNER", "DIMENSION_CONTROLLER"].includes(selectedItem?.type) ? ["3D"] : selectedItem?.type === "LPR_CAMERA" ? (stationFormat === "IMPS" ? ["ImPS", "3D"] : ["High Speed", "Low Speed", "3D"]) : selectedItem?.type === "FIXED_CAMERA" && stationFormat === "IMPS" ? ["Image Processing", "ImPS"] : definition?.scopeVariants?.length ? definition.scopeVariants : definition?.allowedScopes || [];
  const scopeOptions = rawScopeOptions.filter((scope) => stationFormat === "IMPS" ? !["High Speed", "Low Speed"].includes(scope) : scope !== "ImPS");
  const assignedWimParent = activeWimSystems.find((system) => system.id === wimParentAssignments[0]);
  const resolvedScope = isWimCatalogItem
    ? (contextScope || assignedWimParent?.scope || (activeWimSystems.length === 1 ? activeWimSystems[0].scope : "") || selectedScope)
    : isWimElectronicsChild
      ? (contextScope || selectedParentCabinet?.scope || "")
      : (contextScope || selectedOwnerSystem?.scope || (scopeOptions.length === 1 ? scopeOptions[0] : selectedScope));
  const resolvedParentSystem = isWimCatalogItem
    ? assignedWimParent
    : isWimElectronicsChild
      ? selectedCabinetOwner
      : selectedOwnerSystem;
  const selectedCategory = getBoqAddCategory({ stationFormat, type: selectedItem?.type, categoryCode: selectedItem?.categoryCode, scope: resolvedScope, canonicalItemId: definition?.id });
  const selectedSystemCategory = getBoqAddCategory({ stationFormat, kind: "system", categoryCode: selectedSystem?.checklistMapping?.[0], scope: resolvedScope, canonicalItemId: selectedSystem?.id });
  const canSubmit = recordKind === "system"
    ? Boolean(selectedSystem && selectedSystemCategory.code && (contextScope || scopeOptions.length <= 1 || selectedScope)) && (!isWimSortingSystem || (systemLaneAssignments.length === quantity && systemLaneAssignments.every(Boolean)))
    : Boolean(selectedItem && (isWimCatalogItem || selectedCategory.code) && (contextScope || selectedOwnerSystem || isWimElectronicsChild || scopeOptions.length <= 1 || selectedScope)
      && (isWimCatalogItem || isWimElectronicsChild || !allowedOwnerIds.length || Boolean(selectedOwnerSystem))
      && (!isWimElectronicsChild || Boolean(selectedParentCabinet && resolvedParentSystem))
      && (!(selectedItem.type === "CONTROL_CABINET" || isWimElectronicsChild) || Boolean(resolvedParentSystem)))
      && (!isWimCatalogItem || activeWimSystems.length > 0 && (activeWimSystems.length === 1 || (wimParentAssignments.length === quantity && wimParentAssignments.every((id) => activeWimSystems.some((system) => system.id === id)))));
  const resolvedWimParentIds = Array.from({ length: quantity }, (_, index) => wimParentAssignments[index] || (activeWimSystems.length === 1 ? activeWimSystems[0].id : ""));
  const visibleCatalogItems = catalogItems.filter((item) => {
    const searchable = `${item.label} ${item.prefix} ${item.categoryCode} ${item.categoryTitle}`.toLowerCase();
    const matchesCategory = catalogCategoryCode === "all" || item.categoryCode === catalogCategoryCode;
    return matchesCategory && (!catalogQuery.trim() || searchable.includes(catalogQuery.trim().toLowerCase()));
  });

  useEffect(() => {
    if (!catalogItems.some((item) => item.id === catalogItemId)) setCatalogItemId("");
  }, [catalogItems, catalogItemId]);

  useEffect(() => {
    if (catalogCategoryCode !== "all" && !categories.some((category) => category.code === catalogCategoryCode)) setCatalogCategoryCode("all");
  }, [catalogCategoryCode, categories]);

  useEffect(() => {
    if (systemCategory !== "all" && !systemCategories.includes(systemCategory)) setSystemCategory("all");
  }, [systemCategories, systemCategory]);

  useEffect(() => {
    if (!catalogItemId || visibleCatalogItems.some((item) => item.id === catalogItemId)) return;
    setCatalogItemId("");
    setQuantity(1);
    setLaneAssignments([]);
    setWimParentAssignments([]);
  }, [catalogItemId, visibleCatalogItems]);

  useEffect(() => {
    if (!visibleSystems.some((item) => item.id === systemItemId)) setSystemItemId(visibleSystems[0]?.id || "");
  }, [systemItemId, visibleSystems]);

  useEffect(() => {
    if (selectedScope && !scopeOptions.includes(selectedScope)) setSelectedScope("");
  }, [selectedScope, scopeOptions.join("|")]);

  useEffect(() => { setSelectedScope(""); setOwnerSystemId(""); setParentCabinetId(""); }, [systemItemId, catalogItemId, recordKind]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  const chooseItem = (nextItem) => {
    setCatalogItemId(nextItem.id);
    setSelectedScope("");
    setOwnerSystemId("");
    setParentCabinetId("");
    setQuantity(1);
    setLaneAssignments([]);
    setWimParentAssignments([]);
  };

  const changeQuantity = (nextValue) => {
    const nextQuantity = Math.max(1, Math.min(99, Number(nextValue) || 1));
    setQuantity(nextQuantity);
    setLaneAssignments((current) => current.slice(0, nextQuantity));
    setSystemLaneAssignments((current) => current.slice(0, nextQuantity));
    setWimParentAssignments((current) => current.slice(0, nextQuantity));
  };

  if (!open) return null;

  return <div className="sc-add-panel-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
    <aside className="sc-add-panel" role="dialog" aria-modal="true" aria-labelledby="sc-add-panel-title">
      <div className="sc-add-panel-heading">
        <div><h2 id="sc-add-panel-title">เพิ่มอุปกรณ์ / ระบบ</h2><p>เพิ่มข้อมูลจริงเข้าทะเบียนของสถานี</p></div>
        <button type="button" className="sc-close" onClick={onClose} aria-label="ปิดแผงเพิ่มอุปกรณ์">×</button>
      </div>
      <div className="sc-add-panel-body">
        {(contextBoqGroup || contextGroup) && <div className="sc-add-context"><span className="sc-system-card-icon"><ScContextIcon name={contextGroup?.icon || "system"} size={18} /></span><div><small>กำลังเพิ่มในหมวด</small><strong>{contextBoqGroup?.title || contextGroup?.label}</strong>{contextScope && <small>Scope กำหนดตามกลุ่มนี้: {contextScope}</small>}</div></div>}
        <div className="sc-add-kind-switch" role="tablist" aria-label="ชนิดข้อมูลที่จะเพิ่ม">
          <button type="button" role="tab" aria-selected={recordKind === "asset"} className={recordKind === "asset" ? "is-active" : ""} disabled={!categories.length} onClick={() => setRecordKind("asset")}><Icon name="equipment" pixelSize={18} /><span><strong>อุปกรณ์จริง</strong><small>Asset รายตัว</small></span></button>
          <button type="button" role="tab" aria-selected={recordKind === "system"} className={recordKind === "system" ? "is-active" : ""} disabled={!availableSystems.length} onClick={() => setRecordKind("system")}><Icon name="system" pixelSize={18} /><span><strong>ระบบ</strong><small>System จากคลังกลาง</small></span></button>
        </div>
        {recordKind === "system" && selectedSystem && scopeOptions.length > 1 && !contextScope && <label className="ops-field"><span>กลุ่มที่ติดตั้ง</span><CustomSelect label="กลุ่มที่ติดตั้ง" value={selectedScope} onChange={(event) => setSelectedScope(event.target.value)}><option value="">เลือกกลุ่มระบบ</option>{scopeOptions.map((scope) => <option key={scope} value={scope}>{getBoqAddCategory({ stationFormat, kind: "system", categoryCode: selectedSystem.checklistMapping?.[0], scope, canonicalItemId: selectedSystem.id }).title}</option>)}</CustomSelect></label>}
        {recordKind === "system" && selectedSystem && <small>{selectedSystemCategory.code || "เลือกชุดระบบ"} · {selectedSystemCategory.title} · BOQ/TOR {getScSystemCategoryCodes(selectedSystem)}</small>}
        {recordKind === "asset" ? <>
        <section className="sc-add-step" aria-labelledby="sc-add-step-equipment">
          <div className="sc-add-step-heading"><span>1</span><div><strong id="sc-add-step-equipment">เลือกอุปกรณ์ที่ติดตั้งจริง</strong><small>ค้นหาจากชื่ออุปกรณ์ได้เลย ไม่ต้องรู้หมวด BOQ ก่อน</small></div></div>
          {catalogItems.length ? <>
            <label className="sc-add-search"><Icon name="search" /><span className="sr-only">ค้นหาอุปกรณ์ที่จะเพิ่ม</span><input type="search" value={catalogQuery} onChange={(event) => setCatalogQuery(event.target.value)} placeholder="ค้นหา เช่น Sensor, กล้อง, NVR" /></label>
            <label className="ops-field sc-add-category-filter" htmlFor="sc-add-category"><span>หมวด BOQ <em>(ถ้าต้องการกรอง)</em></span><CustomSelect id="sc-add-category" label="หมวด BOQ" value={catalogCategoryCode} onChange={(event) => setCatalogCategoryCode(event.target.value)} disabled={disabled}><option value="all">ทุกหมวด BOQ</option>{categories.map((category) => <option key={category.code} value={category.code}>{category.code} · {category.title}</option>)}</CustomSelect></label>
            <div className="sc-add-item-list" role="listbox" aria-label="เลือกอุปกรณ์ที่ติดตั้งจริง">
              {visibleCatalogItems.length ? visibleCatalogItems.map((item) => <button type="button" role="option" aria-selected={selectedItem?.id === item.id} className={`sc-add-item-option ${selectedItem?.id === item.id ? "is-selected" : ""}`} key={item.id} onClick={() => chooseItem(item)}>
                <span className="sc-add-item-icon"><ScContextIcon name={item.type} size={20} /></span>
                <span className="sc-add-item-copy"><strong>{[item.nameEn, item.label].filter(Boolean).join(" · ")}</strong><small>{getBoqAddCategory({ stationFormat, type: item.type, categoryCode: item.categoryCode, scope: contextScope, canonicalItemId: canonicalItems.find((entry) => entry.kind === "asset" && entry.equipmentType === item.type)?.id }).title} · BOQ/TOR {item.categoryCode}</small></span>
                <span className="sc-add-item-prefix">{item.prefix}</span>
                {selectedItem?.id === item.id && <Icon name="check" size="small" />}
              </button>) : <div className="sc-add-empty"><Icon name="search" /><strong>ไม่พบอุปกรณ์ที่ค้นหา</strong><small>ลองใช้ชื่อสั้นลง หรือค้นหาด้วย Prefix</small></div>}
            </div>
          </> : <div className="sc-add-empty"><Icon name="info" /><strong>{contextGroup ? `ยังไม่มีอุปกรณ์ที่รองรับในหมวด ${contextGroup.label}` : "ยังไม่มีไอเทมที่เปิดใช้ในคลัง"}</strong><small>{contextGroup ? "เลือกข้อมูลระบบ หากหมวดนี้รองรับ หรือเพิ่มรายการในคลังไอเทมก่อน" : "ไปที่คลังไอเทมเพื่อสร้างหรือเปิดใช้งานรายการก่อน"}</small></div>}
        </section>
        <section className="sc-add-step" aria-labelledby="sc-add-step-quantity">
          <div className="sc-add-step-heading"><span>2</span><div><strong id="sc-add-step-quantity">ระบุจำนวน</strong><small>เพิ่มตามจำนวนที่ติดตั้งจริง</small></div></div>
          {selectedItem ? <>
            <div className="sc-add-item-preview"><strong>{[selectedItem.nameEn, selectedItem.label].filter(Boolean).join(" · ")}</strong><span>{selectedCategory.code || (isWimCatalogItem ? "เลือก WIM Sorting System แม่" : "เลือกชุดระบบ")} · {selectedCategory.title}</span><small>BOQ/TOR {selectedItem.categoryCode} · Prefix {selectedItem.prefix}</small></div>
            {!isWimCatalogItem && !isWimElectronicsChild && ownerSystemOptions.length > 1 && <label className="ops-field"><span>System แม่</span><CustomSelect label="System แม่" value={ownerSystemId} onChange={(event) => setOwnerSystemId(event.target.value)}><option value="">เลือกระบบแม่</option>{ownerSystemOptions.map((system) => <option key={system.id} value={system.id}>{getStationSystemDisplayLabel(system)} · {system.scope || contextScope || "ไม่ระบุ Scope"}</option>)}</CustomSelect></label>}
            {!isWimCatalogItem && !isWimElectronicsChild && ownerSystemOptions.length === 1 && <div className="sc-readonly-field"><span>System แม่</span><strong>{getStationSystemDisplayLabel(ownerSystemOptions[0])}</strong></div>}
            {isWimElectronicsChild && parentCabinetOptions.length > 1 && <label className="ops-field"><span>Cabinet แม่</span><CustomSelect label="Cabinet แม่" value={parentCabinetId} onChange={(event) => { setParentCabinetId(event.target.value); setOwnerSystemId(""); }}><option value="">เลือก Cabinet แม่</option>{parentCabinetOptions.map((cabinet) => <option key={cabinet.id} value={cabinet.id}>{cabinet.assetNo || "ไม่มี Asset No."} · {cabinet.scope || contextScope || "ไม่ระบุ Scope"}</option>)}</CustomSelect></label>}
            {isWimElectronicsChild && selectedParentCabinet && !selectedParentCabinet.parentSystemId && cabinetOwnerOptions.length > 1 && <label className="ops-field"><span>WIM Electronics System แม่</span><CustomSelect label="WIM Electronics System แม่" value={selectedCabinetOwner?.id || ""} onChange={(event) => setOwnerSystemId(event.target.value)}><option value="">เลือกระบบแม่</option>{cabinetOwnerOptions.map((system) => <option key={system.id} value={system.id}>{getStationSystemDisplayLabel(system)} · {system.scope || "ไม่ระบุ Scope"}</option>)}</CustomSelect></label>}
            {isWimElectronicsChild && !parentCabinetOptions.length && <small className="sc-add-field-warning"><Icon name="alert" size="small" />ยังไม่มี WIM Electronics Cabinet ในกลุ่มนี้ กรุณาเพิ่ม Cabinet จาก System แม่ก่อน</small>}
            {allowedOwnerIds.length > 0 && !ownerSystemOptions.length && !isWimCatalogItem && <small className="sc-add-field-warning"><Icon name="alert" size="small" />ยังไม่มี System แม่ที่ตรงกับกลุ่มนี้ กรุณาเพิ่ม System ก่อนเพิ่มอุปกรณ์</small>}
            <div className="sc-readonly-field"><span>Scope</span><strong>{resolvedScope || "ยังระบุไม่ได้"}</strong><small>{contextScope ? `กำหนดจากกลุ่ม ${contextBoqGroup?.title || initialBoqGroupCode}` : isWimElectronicsChild ? "กำหนดจาก Cabinet แม่" : isWimCatalogItem ? "กำหนดจาก WIM Sorting System แม่" : selectedOwnerSystem ? "กำหนดจาก System แม่" : "เลือกกลุ่มหรือ System แม่เพื่อกำหนดอัตโนมัติ"}</small></div>
            <div className="sc-add-quantity-control"><button type="button" onClick={() => changeQuantity(quantity - 1)} disabled={quantity <= 1} aria-label="ลดจำนวนอุปกรณ์">−</button><input className="sc-add-quantity-value" type="number" min="1" max="99" value={quantity} onChange={(event) => changeQuantity(event.target.value)} aria-label="จำนวนอุปกรณ์" /><button type="button" onClick={() => changeQuantity(quantity + 1)} disabled={quantity >= 99} aria-label="เพิ่มจำนวนอุปกรณ์">+</button></div>
          </> : <div className="sc-add-empty"><Icon name="info" /><strong>เลือกอุปกรณ์ก่อนระบุจำนวน</strong><small>ระบบจะแสดงหมวด BOQ และข้อมูลที่ต้องกรอกตามประเภทให้อัตโนมัติ</small></div>}
        </section>
        {selectedItem && isWimCatalogItem && <section className="sc-add-step" aria-labelledby="sc-add-step-lane">
          <div className="sc-add-step-heading"><span>3</span><div><strong id="sc-add-step-lane">เลือก WIM Sorting System แม่</strong><small>Sensor/Loop ต้องผูกกับระบบ WIM ที่ติดตั้งในเลนนั้น ระบบจะเติม Lane ให้อัตโนมัติ</small></div></div>
          {activeWimSystems.length === 1 ? <div className="sc-readonly-field"><span>WIM Sorting System แม่</span><strong>WIM Sorting System #{activeWimSystems[0].instanceNo || "?"} · {activeWimSystems[0].scope || contextScope}</strong><small>ใช้ระบบแม่ที่ตรงกับกลุ่มนี้อัตโนมัติ</small></div> : <div className="sc-add-lane-list">{Array.from({ length: quantity }, (_, index) => <label className="sc-add-lane-row" key={`${selectedItem.id}-${index}`}><span><strong>{[selectedItem.nameEn, selectedItem.label].filter(Boolean).join(" · ")} {index + 1}</strong><small>เลือกระบบแม่เพื่อกำหนด Scope และ Lane</small></span><CustomSelect label={`WIM Sorting System ของ ${selectedItem.label} ${index + 1}`} value={wimParentAssignments[index] || ""} disabled={disabled} onChange={(event) => setWimParentAssignments((current) => { const next = [...current]; next[index] = event.target.value; return next; })}><option value="">เลือก WIM Sorting System</option>{activeWimSystems.map((system) => <option key={system.id} value={system.id}>WIM Sorting System #{system.instanceNo || "?"} · Lane {String(system.laneId || "").replace(/^.*?lane-/, "")} · {system.scope || "ไม่ระบุ Scope"}</option>)}</CustomSelect></label>)}</div>}
          {!activeWimSystems.length && <small className="sc-add-field-warning"><Icon name="alert" size="small" />ยังไม่มี WIM Sorting System ที่ผูกกับ Lane กรุณาเพิ่มระบบแม่ก่อนเพิ่ม Sensor/Loop</small>}
        </section>}
        </> : <section className="sc-add-step" aria-labelledby="sc-add-step-system">
          <div className="sc-add-step-heading"><span>1</span><div><strong id="sc-add-step-system">เลือกระบบที่จะลงทะเบียน</strong><small>เลือกจากคลังกลาง ระบบจะถูกจัดเข้ากลุ่มที่เกี่ยวข้องให้อัตโนมัติ</small></div></div>
          {availableSystems.length ? <><label className="ops-field sc-add-category-filter"><span>หมวดระบบ <em>(ถ้าต้องการกรอง)</em></span><CustomSelect id="sc-add-system-category" label="หมวดระบบ" value={systemCategory} onChange={(event) => setSystemCategory(event.target.value)} disabled={disabled}><option value="all">ทุกหมวดระบบ</option>{systemCategories.map((category) => <option key={category} value={category}>{category}</option>)}</CustomSelect></label><label className="ops-field"><span>ข้อมูลระบบ (System)</span><CustomSelect label="ข้อมูลระบบ (System)" value={selectedSystem?.id || ""} onChange={(event) => { setSystemItemId(event.target.value); setQuantity(1); setSystemLaneAssignments([]); }} disabled={disabled}><option value="">เลือก System</option>{visibleSystems.map((item) => <option key={item.id} value={item.id}>{getScSystemCategoryCodes(item)} · {item.nameEn || item.nameTh} · {item.nameTh} · {item.category}</option>)}</CustomSelect></label>{selectedSystem && <div className="sc-add-system-preview"><span className="sc-record-kind is-system">SYSTEM</span><div><strong>{getScSystemCategoryCodes(selectedSystem)} · {selectedSystem.nameEn || selectedSystem.nameTh} · {selectedSystem.nameTh}</strong><small>หมวดระบบ {selectedSystem.category}</small></div></div>}{selectedSystem && <><div className="sc-add-step-heading"><span>2</span><div><strong>จำนวนระบบที่ติดตั้งจริง</strong><small>ระบบละ 1 Lane · ไม่สร้าง Lane เพิ่มให้อัตโนมัติ</small></div></div><div className="sc-add-quantity-control"><button type="button" onClick={() => changeQuantity(quantity - 1)} disabled={quantity <= 1} aria-label="ลดจำนวนระบบ">−</button><input className="sc-add-quantity-value" type="number" min="1" max="99" value={quantity} onChange={(event) => changeQuantity(event.target.value)} aria-label="จำนวนระบบ" /><button type="button" onClick={() => changeQuantity(quantity + 1)} disabled={quantity >= 99} aria-label="เพิ่มจำนวนระบบ">+</button></div>{isWimSortingSystem && <div className="sc-add-lane-list">{Array.from({ length: quantity }, (_, index) => <label className="sc-add-lane-row" key={`${selectedSystem.id}-${index}`}><span><strong>WIM Sorting System #{index + 1}</strong><small>เลือก Lane ที่ติดตั้งระบบนี้จริง</small></span><CustomSelect label={`Lane ของ WIM Sorting System ${index + 1}`} value={systemLaneAssignments[index] || ""} disabled={disabled} onChange={(event) => setSystemLaneAssignments((current) => { const next = [...current]; next[index] = event.target.value; return next; })}><option value="">เลือก Lane</option>{activeLanes.map((lane) => <option key={lane.id} value={lane.id}>Lane {lane.laneNo} · {getLaneScope(lane, stationSystems) || "ไม่ระบุ Scope"} · {lane.label}</option>)}</CustomSelect></label>)}</div>}</>}</> : <div className="sc-add-empty"><Icon name="info" /><strong>{contextGroup ? `ยังไม่มี System ที่รองรับในหมวด ${contextGroup.label}` : "ไม่มี System สำหรับรูปแบบสถานีนี้"}</strong></div>}
        </section>}
        <div className="sc-add-panel-note"><Icon name="info" /><span>เลือกอุปกรณ์ตามที่ติดตั้งจริงได้เลย · หมวด BOQ และ Asset No. จะถูกบันทึกให้อัตโนมัติ · การแก้ทะเบียนมีผลกับรอบตรวจใหม่เท่านั้น</span></div>
      </div>
        <div className="sc-add-panel-footer"><Button onClick={onClose}>ยกเลิก</Button><Button onClick={() => { if (recordKind === "system") onAddSystem?.(selectedSystem, quantity, { laneIds: systemLaneAssignments, scope: resolvedScope }); else onAdd?.(selectedItem, quantity, { laneIds: laneAssignments, wimSystemIds: resolvedWimParentIds, parentSystemId: resolvedParentSystem?.id || null, parentAssetId: selectedParentCabinet?.id || null, scope: resolvedScope }); onClose?.(); }} variant="primary" icon="plus" disabled={disabled || !canSubmit}>{recordKind === "system" ? "เพิ่มระบบเข้าทะเบียน" : "เพิ่มเข้าทะเบียน"}</Button></div>
    </aside>
  </div>;
}

const READINESS_BLOCKER_COPY = Object.freeze({
  EMPTY_REGISTER: { label: "ทะเบียนอุปกรณ์และระบบ", tab: "equipment" },
  ASSET_NO_REQUIRED: { label: "รหัส Asset No.", tab: "equipment" },
  DUPLICATE_ASSET_NO: { label: "รหัสอุปกรณ์ (Asset No.) ซ้ำ", tab: "equipment" },
  WIM_SYSTEM_LANE_REQUIRED: { label: "Lane ของ WIM Sorting System", tab: "equipment" },
  WIM_SYSTEM_LANE_DUPLICATE: { label: "WIM Sorting System ซ้ำใน Lane เดียวกัน", tab: "equipment" },
  WIM_PARENT_SYSTEM_REQUIRED: { label: "ระบบแม่ของ WIM Sensor/Loop", tab: "equipment" },
  WIM_PARENT_SYSTEM_INVALID: { label: "Lane ของระบบแม่ WIM", tab: "equipment" },
  WIM_PARENT_LANE_MISMATCH: { label: "Lane ของอุปกรณ์ WIM ไม่ตรงระบบแม่", tab: "equipment" },
  WIM_ELECTRONICS_PARENT_CABINET_REQUIRED: { label: "Cabinet แม่ของอุปกรณ์ WIM Electronics", tab: "equipment" },
  WIM_ELECTRONICS_SYSTEM_REQUIRED: { label: "WIM Electronics System ของ Cabinet/อุปกรณ์", tab: "equipment" },
  WIM_SWITCHING_DC_OUTPUT_REQUIRED: { label: "แรงดัน Output ของ Switching DC", tab: "equipment" },
  CHECKLIST_MAPPING_REQUIRED: { label: "Checklist mapping ของ System", tab: "checklist" },
});

function readinessBlockerCopy(blocker) {
  return READINESS_BLOCKER_COPY[blocker?.code] || { label: "ข้อมูลประจำสถานี", tab: "general" };
}


function StationProfileRedesigned({ state, profile, setSelected, addStation, updateProfile, notify, onArchiveStation, onPurgeStation, activeEquipment = [], itemCatalog = [], addCatalogEquipment, changeQuantity, canonicalItems = [], addCanonicalSystem, updateCanonicalSystem, removeCanonicalSystem, equipmentRegisterGroups = [], equipmentGroups = [], referenced, updateEquipment, removeEquipment, stationRounds = [], masterConfigSections = [], isMasterConfigDisabled, enabledMasterConfigCount = 0, disabledMasterConfigCount = 0, masterConfigItems = [], toggleChecklist, previewApplicable = 0, previewNotApplicable = 0, updateStationLanes, assignStationLane, assignWimParentSystem, addStationLane, removeStationLane }) {
  const activeLanes = profile?.lanes?.filter((lane) => lane.active !== false) || [];
  const wimAssets = activeEquipment.filter(isWimEquipment);
  const wimSensorCount = wimAssets.filter((equipment) => equipment.type === "WIM_SENSOR").length;
  const wimLoopCount = wimAssets.filter((equipment) => equipment.type === "WIM_LOOP").length;
  const unassignedWimCount = wimAssets.filter((equipment) => !equipment.laneId).length;
  const incompleteEquipmentCount = countIncompleteEquipment(activeEquipment);
  const stationInfoReady = Boolean(profile?.stationCode?.trim() && profile?.stationName?.trim());
  const wimReady = !unassignedWimCount && (!wimAssets.length || activeLanes.length > 0);
  const checklistReady = disabledMasterConfigCount === 0;
  const stationReady = Boolean(profile && profile.active !== false && stationInfoReady && wimReady && !incompleteEquipmentCount);
  const attentionItems = [
    profile?.active === false ? "สถานีปิดใช้งานอยู่" : "",
    incompleteEquipmentCount ? `ข้อมูลอุปกรณ์ยังไม่ครบ ${incompleteEquipmentCount} รายการ` : "",
    unassignedWimCount ? `ยังไม่ผูก Lane ${unassignedWimCount} รายการ` : "",
    disabledMasterConfigCount ? `ปิดรายการตรวจไว้ ${disabledMasterConfigCount} รายการ` : "",
  ].filter(Boolean);
  const scrollToStationSection = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const laneSummary = activeLanes.map((lane) => ({
    ...lane,
    sensorCount: wimAssets.filter((item) => item.laneId === lane.id && item.type === "WIM_SENSOR").length,
    loopCount: wimAssets.filter((item) => item.laneId === lane.id && item.type === "WIM_LOOP").length,
  }));

  if (!profile) return <section className="ops-page station-profile-redesign"><Breadcrumb items={[{ label: "ทะเบียนสถานี", href: "#/stations" }, { label: "รายละเอียดสถานี" }]} /><section className="ops-panel station-profile-empty"><div className="ops-panel-toolbar"><StationSelect profiles={state.stationProfiles} value={profile?.id} onChange={setSelected} label="สถานีที่กำลังแก้ไข" includeInactive /></div><EmptyState title="ยังไม่มีสถานี" action={<Button onClick={addStation} variant="primary" icon="plus">สร้างสถานี</Button>}>สร้างสถานีแรกเพื่อเริ่มเพิ่มอุปกรณ์</EmptyState></section></section>;

  return <StationProfileScWorkspace
    state={state}
    profile={profile}
    setSelected={setSelected}
    updateProfile={updateProfile}
    notify={notify}
    onArchiveStation={onArchiveStation}
    onPurgeStation={onPurgeStation}
    activeEquipment={activeEquipment}
    itemCatalog={itemCatalog}
    addCatalogEquipment={addCatalogEquipment}
    changeQuantity={changeQuantity}
    canonicalItems={canonicalItems}
    addCanonicalSystem={addCanonicalSystem}
    updateCanonicalSystem={updateCanonicalSystem}
    removeCanonicalSystem={removeCanonicalSystem}
    equipmentRegisterGroups={equipmentRegisterGroups}
    equipmentGroups={equipmentGroups}
    referenced={referenced}
    updateEquipment={updateEquipment}
    removeEquipment={removeEquipment}
    stationRounds={stationRounds}
    masterConfigSections={masterConfigSections}
    isMasterConfigDisabled={isMasterConfigDisabled}
    enabledMasterConfigCount={enabledMasterConfigCount}
    disabledMasterConfigCount={disabledMasterConfigCount}
    masterConfigItems={masterConfigItems}
    toggleChecklist={toggleChecklist}
    previewApplicable={previewApplicable}
    previewNotApplicable={previewNotApplicable}
    updateStationLanes={updateStationLanes}
    assignStationLane={assignStationLane}
    assignWimParentSystem={assignWimParentSystem}
    addStationLane={addStationLane}
    removeStationLane={removeStationLane}
  />;

  return <section className="ops-page station-profile-redesign">
    <Breadcrumb items={[{ label: "ทะเบียนสถานี", href: "#/stations" }, { label: profile.stationCode, mono: true }]} />
    <header className="station-profile-hero">
      <div className="station-profile-hero-main"><p className="ops-eyebrow">STATION PROFILE</p><div className="station-profile-title-row"><span className="station-profile-mark"><Icon name="building" /></span><div className="station-profile-title-copy"><h1>{profile.stationName}</h1><p><span className="ops-code">{profile.stationCode}</span> · แก้ไขข้อมูลสำหรับรอบการตรวจถัดไป</p></div><StatusBadge status={profile.active === false ? "inactive" : stationReady ? "normal" : "waiting"}>{profile.active === false ? "ปิดใช้งาน" : stationReady ? "พร้อมใช้งาน" : "ต้องตรวจสอบ"}</StatusBadge></div></div>
      <div className="station-profile-hero-actions"><Button href="#/stations" icon="arrow">กลับทะเบียนสถานี</Button></div>
    </header>
    <section id="station-profile-overview" className="station-profile-context" aria-label="ข้อมูลสถานีที่กำลังแก้ไข"><div className="station-profile-context-grid"><StationSelect profiles={state.stationProfiles} value={profile.id} onChange={setSelected} label="สถานีที่กำลังแก้ไข" includeInactive /><label className="ops-field ops-code-field"><span>รหัสสถานี</span><input value={profile.stationCode} disabled={profile.active === false} onChange={(event) => updateProfile("stationCode", event.target.value)} placeholder="เช่น NKS-OUT" /></label><label className="ops-field ops-field-wide"><span>ชื่อสถานี</span><input value={profile.stationName} disabled={profile.active === false} onChange={(event) => updateProfile("stationName", event.target.value)} placeholder="ชื่อสถานีหรือจุดติดตั้ง" /></label></div><div className="station-profile-context-footer"><span className="station-profile-save"><Icon name="save" />บันทึกอัตโนมัติ</span><span>รอบที่กำลังกรอก {stationRounds.filter((round) => round.status !== "closed").length} รอบ · ประวัติที่ปิดแล้ว {stationRounds.filter((round) => round.status === "closed").length} รายการ</span><div className="station-profile-advanced-actions"><Button onClick={() => onArchiveStation(profile)} variant={profile.active === false ? "secondary" : "danger-ghost"} icon={profile.active === false ? "refresh" : "archive"}>{profile.active === false ? "เปิดใช้งานสถานี" : "ปิดใช้งานสถานี"}</Button><Button onClick={() => onPurgeStation(profile)} variant="danger-ghost" icon="delete">ลบสถานีถาวร</Button></div></div></section>
    <div className={`station-profile-attention ${attentionItems.length ? "has-attention" : "is-ready"}`} role="status"><Icon name={attentionItems.length ? "alert" : "check"} /><div><strong>{attentionItems.length ? `ต้องตรวจสอบ ${attentionItems.length} เรื่องก่อนสร้างรอบตรวจ` : "สถานีพร้อมสร้างรอบตรวจ"}</strong><span>{attentionItems.length ? attentionItems.join(" · ") : "ข้อมูลหลักและการผูกอุปกรณ์พร้อมใช้งาน"}</span></div>{attentionItems.length > 0 && <button type="button" className="station-profile-attention-action" onClick={() => scrollToStationSection(unassignedWimCount ? "station-profile-lanes" : incompleteEquipmentCount ? "station-profile-equipment" : "station-profile-checklist")}>ดูรายละเอียด</button>}</div>
    <section className="station-profile-summary" aria-label="สรุปสถานี"><article><span className="station-profile-summary-icon"><Icon name="building" /></span><div><strong>{activeLanes.length}</strong><span>Lane</span><small>ช่องจราจรที่ใช้งาน</small></div></article><article><span className="station-profile-summary-icon"><Icon name="equipment" /></span><div><strong>{wimAssets.length}</strong><span>WIM Assets</span><small>{wimSensorCount} Sensor · {wimLoopCount} Loop</small></div></article><article><span className="station-profile-summary-icon"><Icon name="checklist" /></span><div><strong>{enabledMasterConfigCount}<small> / {masterConfigItems.length}</small></strong><span>รายการตรวจ</span><small>เปิดใช้สำหรับสถานีนี้</small></div></article><article className={stationReady ? "is-ready" : "is-warning"}><span className="station-profile-summary-icon"><Icon name={stationReady ? "check" : "alert"} /></span><div><strong>{stationReady ? "พร้อม" : "ตรวจสอบ"}</strong><span>สถานะรวม</span><small>{attentionItems.length ? `${attentionItems.length} เรื่องที่ควรดู` : "ไม่มีรายการค้าง"}</small></div></article></section>
     <section className="station-profile-steps" aria-labelledby="station-profile-steps-title"><div className="station-profile-section-heading"><div><p className="ops-eyebrow">START HERE</p><h2 id="station-profile-steps-title">ขั้นตอนของหน้านี้</h2></div><span>ทำตามลำดับเพื่อให้พร้อมสร้างรอบตรวจ</span></div><div className="station-profile-step-list"><button type="button" className={stationInfoReady ? "is-complete" : "is-current"} onClick={() => scrollToStationSection("station-profile-overview")}><span>1</span><div><strong>ตรวจข้อมูลสถานี</strong><small>{stationInfoReady ? "ข้อมูลครบแล้ว" : "กรอกรหัสและชื่อสถานี"}</small></div><Icon name={stationInfoReady ? "check" : "arrow"} /></button><button type="button" className={wimReady ? "is-complete" : "is-current"} onClick={() => scrollToStationSection("station-profile-wim")}><span>2</span><div><strong>ตรวจอุปกรณ์ WIM</strong><small>{wimReady ? String(wimAssets.length) + " รายการพร้อมใช้งาน" : "ตรวจ Lane และการผูก Sensor / Loop"}</small></div><Icon name={wimReady ? "check" : "arrow"} /></button><button type="button" className={checklistReady ? "is-complete" : "is-current"} onClick={() => scrollToStationSection("station-profile-checklist")}><span>3</span><div><strong>ตั้งค่า Checklist</strong><small>{checklistReady ? String(enabledMasterConfigCount) + " รายการเปิดใช้" : "มี " + String(disabledMasterConfigCount) + " รายการปิดใช้งาน"}</small></div><Icon name={checklistReady ? "check" : "arrow"} /></button></div></section>
    <section id="station-profile-wim" className="station-profile-section station-profile-wim" aria-labelledby="station-profile-wim-title"><div className="station-profile-section-heading"><div><p className="ops-eyebrow">BOQ 2.1 · WIM GROUP</p><h2 id="station-profile-wim-title"><span className="ops-config-section-code">2.1</span> {formatCentralNameEnglishFirst(getCentralChecklistSectionName("2.1"))}</h2><span>รวม Sensor และ Loop ไว้ในกลุ่มเดียว เพื่อดูจำนวนและสถานะได้ทันที</span></div><span className={`station-profile-section-status ${wimReady ? "is-ready" : "is-warning"}`}><Icon name={wimReady ? "check" : "alert"} />{wimReady ? "พร้อมใช้งาน" : "ต้องตรวจสอบ"} · {wimAssets.length} รายการ</span></div><div className="station-profile-wim-types"><article><span className="station-profile-wim-icon"><Icon name={getEquipmentIconName("WIM_SENSOR")} /></span><div><strong>{getEquipmentDisplayLabel({ type: "WIM_SENSOR" })}</strong><span>{wimSensorCount} รายการใช้งาน</span><small>อุปกรณ์จริงในทะเบียนสถานี</small></div><div className="ops-quantity-controls"><button type="button" className="ops-quantity-button" onClick={() => changeQuantity("WIM_SENSOR", -1)} disabled={!wimSensorCount || profile.active === false} aria-label="ลดจำนวนเซนเซอร์ WIM"><span aria-hidden="true">−</span></button><output className="ops-quantity-count" aria-label="จำนวนเซนเซอร์ WIM">{wimSensorCount}</output><button type="button" className="ops-quantity-button" onClick={() => changeQuantity("WIM_SENSOR", 1)} disabled={profile.active === false} aria-label="เพิ่มจำนวนเซนเซอร์ WIM"><span aria-hidden="true">+</span></button></div></article><article><span className="station-profile-wim-icon"><Icon name={getEquipmentIconName("WIM_LOOP")} /></span><div><strong>{getEquipmentDisplayLabel({ type: "WIM_LOOP" })}</strong><span>{wimLoopCount} รายการใช้งาน</span><small>อุปกรณ์จริงในทะเบียนสถานี</small></div><div className="ops-quantity-controls"><button type="button" className="ops-quantity-button" onClick={() => changeQuantity("WIM_LOOP", -1)} disabled={!wimLoopCount || profile.active === false} aria-label="ลดจำนวน Loop ตรวจจับ WIM"><span aria-hidden="true">−</span></button><output className="ops-quantity-count" aria-label="จำนวน Loop ตรวจจับ WIM">{wimLoopCount}</output><button type="button" className="ops-quantity-button" onClick={() => changeQuantity("WIM_LOOP", 1)} disabled={profile.active === false} aria-label="เพิ่มจำนวน Loop ตรวจจับ WIM"><span aria-hidden="true">+</span></button></div></article></div><div className="station-profile-wim-lane-summary"><div><strong>สรุปการผูกกับ Lane</strong><span>{activeLanes.length} Lane · {unassignedWimCount ? `ยังไม่ผูก ${unassignedWimCount} รายการ` : "ผูกครบแล้ว"}</span></div><div className="station-profile-lane-pills">{laneSummary.map((lane) => <span key={lane.id}><strong>Lane {lane.laneNo} · {getLaneScope(lane, profile.stationSystems) || "ไม่ระบุ Scope"}</strong><small>{lane.sensorCount} Sensor · {lane.loopCount} Loop</small></span>)}</div><Button onClick={() => scrollToStationSection("station-profile-lanes")} variant="secondary" icon="arrow">ดูการผูก Lane</Button></div><details className="station-profile-system-details"><summary>ดูความสัมพันธ์ระบบกับทะเบียนอุปกรณ์ <span>{profile.stationSystems?.length || 0} กลุ่ม</span></summary><StationSystemsSummary systems={profile.stationSystems} equipment={activeEquipment} compact /></details></section>
    <details id="station-profile-lanes" className="station-profile-disclosure station-profile-lane-disclosure"><summary className="station-profile-disclosure-summary"><span className="station-profile-disclosure-icon"><Icon name="building" /></span><span><strong>Lane Topology</strong><small>กำหนดโครงสร้างช่องจราจรและผูก Sensor / Loop กับ Lane</small></span><span className="station-profile-disclosure-count">{activeLanes.length} เลน{unassignedWimCount ? ` · ค้าง ${unassignedWimCount}` : ""}</span><span className="station-profile-disclosure-chevron" aria-hidden="true" /></summary><div className="station-profile-disclosure-body"><LaneAssignmentStep stationFormat={profile.stationFormat} lanes={profile.lanes} equipment={activeEquipment} stationSystems={profile.stationSystems} disabled={profile.active === false} showHeading={false} headingEyebrow="LANE TOPOLOGY" headingTitle="กำหนดเลนและผูก Sensor / Loop" headingDescription="โครงสร้าง Lane แยกจากอุปกรณ์ และมีผลกับรอบการตรวจใหม่เท่านั้น" onChangeLanes={updateStationLanes} onAssignLane={assignStationLane} onAddLane={addStationLane} onRemoveLane={removeStationLane} /></div></details>
    <details id="station-profile-equipment" className="station-profile-disclosure"><summary className="station-profile-disclosure-summary"><span className="station-profile-disclosure-icon"><Icon name="equipment" /></span><span><strong>ทะเบียนอุปกรณ์</strong><small>ปรับจำนวนและแก้รายละเอียด อุปกรณ์จริงตามหมวด BOQ</small></span><span className="station-profile-disclosure-count">{activeEquipment.length} ใช้งาน · {equipmentGroups.length} กลุ่ม</span><span className="station-profile-disclosure-chevron" aria-hidden="true" /></summary><div className="station-profile-disclosure-body equipment-panel"><EquipmentCatalogAddPanel catalog={itemCatalog} stationFormat={profile.stationFormat} stationSystems={profile.stationSystems} disabled={profile.active === false} onAdd={addCatalogEquipment} /><div className="ops-equipment-quantity-group-list" aria-label="ปรับจำนวนอุปกรณ์ตามหมวด BOQ">{equipmentRegisterGroups.map((group) => { const groupItems = group.types.flatMap((type) => type.items); const groupActiveCount = groupItems.filter((equipment) => equipment.active !== false).length; const groupInactiveCount = groupItems.length - groupActiveCount; return <section className="ops-equipment-quantity-group" key={group.code} aria-labelledby={`station-equipment-quantity-group-${group.code}`}><div className="ops-equipment-quantity-group-heading"><span className="ops-config-section-code">{group.code}</span><div><h4 id={`station-equipment-quantity-group-${group.code}`}>{group.title}</h4><span>{groupActiveCount} ใช้งาน{groupInactiveCount ? ` · ${groupInactiveCount} ปิดใช้งาน` : ""} · {groupItems.length} รายการ</span></div></div><div className="ops-equipment-quantity-subtypes">{group.types.map((type) => { const all = type.items; const activeCount = all.filter((equipment) => equipment.active !== false).length; const inactiveCount = all.length - activeCount; const typeLabel = getEquipmentTypeDisplayLabel(type); return <div className="ops-quantity-row" key={type.value}><div className="ops-quantity-name"><span className="ops-equipment-icon"><Icon name={getEquipmentIconName(type.value)} /></span><div><strong>{typeLabel}</strong><span>{activeCount ? `กำลังใช้งาน ${activeCount} รายการ` : "ยังไม่มีอุปกรณ์ใช้งาน"}{inactiveCount ? ` · ปิดใช้งาน ${inactiveCount}` : ""}</span></div></div><div className="ops-quantity-controls"><button type="button" className="ops-quantity-button" onClick={() => changeQuantity(type.value, -1)} disabled={!activeCount || profile.active === false} aria-label={`ลดจำนวน ${typeLabel}`}><span aria-hidden="true">−</span></button><output className="ops-quantity-count" aria-label={`จำนวนใช้งาน ${typeLabel}`}>{activeCount}</output><button type="button" className="ops-quantity-button" onClick={() => changeQuantity(type.value, 1)} disabled={profile.active === false} aria-label={`เพิ่มจำนวน ${typeLabel}`}><span aria-hidden="true">+</span></button></div></div>; })}</div></section>; })}</div>{profile.equipment.length ? <div className="ops-equipment-list"><div className="ops-subsection-heading"><strong>รายละเอียดอุปกรณ์รายตัว</strong><span>จัดตามหมวด BOQ และแก้ Asset No., ตำแหน่ง และ Serial Number ได้จากรายการด้านล่าง</span></div><div className="ops-equipment-group-list">{equipmentGroups.map((group) => { const groupItems = group.types.flatMap((type) => type.items); const activeCount = groupItems.filter((equipment) => equipment.active !== false).length; const inactiveCount = groupItems.length - activeCount; return <section className="ops-equipment-group" key={group.code} aria-labelledby={`station-equipment-group-${group.code}`}><div className="ops-equipment-group-heading"><span className="ops-config-section-code">{group.code}</span><div><h4 id={`station-equipment-group-${group.code}`}>{group.title}</h4><span>{activeCount} ใช้งาน{inactiveCount ? ` · ปิดใช้งาน ${inactiveCount}` : ""} · {groupItems.length} รายการ</span></div></div><div className="ops-equipment-subgroups">{group.types.map((type) => <section className="ops-equipment-subgroup" key={type.value} aria-labelledby={`station-equipment-subgroup-${group.code}-${type.value}`}><div className="ops-equipment-subgroup-heading"><h5 id={`station-equipment-subgroup-${group.code}-${type.value}`}>{getEquipmentTypeDisplayLabel(type)}</h5><span>{type.items.length} รายการ</span></div><div className="ops-equipment-subgroup-items">{type.items.map((equipment) => <EquipmentRow key={equipment.id} equipment={equipment} isReferenced={referenced(equipment.id)} disabled={profile.active === false} onChange={updateEquipment} onRemove={removeEquipment} />)}</div></section>)}</div></section>; })}</div></div> : <EmptyState icon="equipment" title="ยังไม่มีอุปกรณ์ในสถานีนี้">กดปุ่ม + ของประเภทอุปกรณ์ที่ต้องการเพิ่ม</EmptyState>}</div></details>
    <EquipmentChecklistCoverage equipment={activeEquipment} items={masterConfigItems} displaySections={masterConfigSections} stationFormat={profile.stationFormat} /><details id="station-profile-checklist" className="station-profile-disclosure"><summary className="station-profile-disclosure-summary"><span className="station-profile-disclosure-icon"><Icon name="checklist" /></span><span><strong>การตั้งค่า Checklist</strong><small>เปิดหรือปิดรายการตรวจสำหรับสถานีนี้</small></span><span className="station-profile-disclosure-count">{enabledMasterConfigCount}/{masterConfigItems.length} เปิดใช้{disabledMasterConfigCount ? ` · ปิด ${disabledMasterConfigCount}` : ""}</span><span className="station-profile-disclosure-chevron" aria-hidden="true" /></summary><div className="station-profile-disclosure-body ops-checklist-config"><p className="ops-section-description">ค่าเหล่านี้มีผลกับรอบการตรวจใหม่เท่านั้น รายการใน Snapshot และประวัติเดิมจะไม่เปลี่ยน รายการที่ผูกกับระบบหรืออุปกรณ์จะแสดงตามของจริงและขอบเขตที่ติดตั้ง ส่วนงานระดับสถานีจะแสดงพร้อมป้ายบอกระดับ</p><div className="ops-config-list">{masterConfigSections.map((section, sectionIndex) => <details className="ops-config-section" key={section.code} open={sectionIndex === 0}><summary><span className="ops-config-section-code">{section.code}</span><span className="ops-config-section-title">{section.title}</span><small>{section.items.filter((item) => !isMasterConfigDisabled(item)).length}/{section.items.length} รายการ</small></summary><div className="ops-config-items">{section.items.map((item) => { const disabled = isMasterConfigDisabled(item); const scopeMeta = getChecklistScopeMeta(item); return <div className={`ops-config-item ${disabled ? "is-disabled" : ""}`} key={item.id}><div><strong>{item.label}</strong><span>{scopeMeta.label} · {item.unit || "ข้อมูล"} · {disabled ? "ปิดใช้งานสำหรับสถานีนี้" : "ใช้เป็นกติกาของรอบการตรวจใหม่"}</span></div><button type="button" className={`ops-config-toggle ${disabled ? "is-disabled" : "is-enabled"}`} aria-pressed={!disabled} aria-label={`${disabled ? "เปิด" : "ปิด"} ${item.label}`} onClick={() => toggleChecklist(item.id, disabled)}><Icon name={disabled ? "close" : "check"} /><span>{disabled ? "ปิด" : "เปิด"}</span></button></div>; })}</div></details>)}</div></div></details>
    <details className="station-profile-disclosure station-profile-preview-disclosure"><summary className="station-profile-disclosure-summary"><span className="station-profile-disclosure-icon"><Icon name="archive" /></span><span><strong>ตัวอย่างรายการของรอบตรวจใหม่</strong><small>ดูสิ่งที่จะถูกสร้างเมื่อเริ่มรอบการตรวจ</small></span><span className="station-profile-disclosure-count">{previewApplicable} รายการเกี่ยวข้อง</span><span className="station-profile-disclosure-chevron" aria-hidden="true" /></summary><div className="station-profile-disclosure-body"><div className="ops-preview-metrics"><div><strong>{activeEquipment.length}</strong><span>อุปกรณ์จริงที่ใช้งาน</span></div><div><strong>{previewApplicable}</strong><span>รายการตรวจที่เกี่ยวข้อง</span></div><div><strong>{previewNotApplicable}</strong><span>ไม่เกี่ยวข้อง / ปิดใช้งาน</span></div></div><p className="ops-section-description">อุปกรณ์จริงที่เพิ่มเกินแม่แบบจะสร้างรายการต่อจากลำดับสุดท้ายโดยอัตโนมัติ เช่น LPR #4 และ #5</p></div></details>
  </section>;
}

function StationProfileWimAssetRow({ equipment, lanes = [], disabled = false, onAssignLane, onChange }) {
  const assetNoRef = useRef(null);
  const lane = lanes.find((entry) => entry.id === equipment.laneId);
  const ready = Boolean(lane && isEquipmentDetailComplete(equipment));
  return <div className={`station-profile-wim-asset-row ${ready ? "is-ready" : "is-warning"}`}>
    <div className="station-profile-wim-asset-type"><span className={`station-profile-wim-asset-type-icon ${equipment.type === "WIM_LOOP" ? "is-loop" : ""}`}><Icon name={getEquipmentIconName(equipment.type)} /></span><div><strong>{getEquipmentDisplayLabel(equipment)}</strong></div></div>
    <label className="station-profile-wim-asset-field station-profile-wim-asset-lane"><span>Lane</span><CustomSelect label={`เลือก Lane สำหรับ ${equipment.assetNo}`} value={equipment.laneId || ""} disabled={disabled} onChange={(event) => onAssignLane?.(equipment.id, event.target.value)} aria-label={`เลือก Lane สำหรับ ${equipment.assetNo}`}><option value="">ยังไม่ผูก Lane</option>{lanes.map((entry) => <option key={entry.id} value={entry.id}>Lane {entry.laneNo}{entry.label ? ` · ${entry.label}` : ""}</option>)}</CustomSelect></label>
    <label className="station-profile-wim-asset-field"><span>Asset No.</span><input ref={assetNoRef} value={equipment.assetNo || ""} disabled={disabled} onChange={(event) => onChange?.(equipment.id, "assetNo", event.target.value)} /></label>
    <label className="station-profile-wim-asset-field"><span>ตำแหน่งติดตั้ง</span><input value={equipment.location || ""} disabled={disabled} onChange={(event) => onChange?.(equipment.id, "location", event.target.value)} /></label>
    <StatusBadge status={ready ? "normal" : "waiting"}>{ready ? "ใช้งาน" : "ต้องตรวจสอบ"}</StatusBadge>
    <button type="button" className="ops-button ops-button-ghost station-profile-asset-edit" onClick={() => assetNoRef.current?.focus()} disabled={disabled} aria-label={`แก้ไข ${equipment.assetNo}`}><Icon name="edit" /></button>
  </div>;
}

function EquipmentChecklistCoverage({ equipment, items, onSelectAsset, displaySections = [], stationFormat = "SC" }) {
  return <ChecklistCoverageSummary coverage={getChecklistCoverageSummary({ equipment }, items)} onSelectAsset={onSelectAsset} displaySections={displaySections} stationFormat={stationFormat} />;
}

function CanonicalSystemPanel({ items, systems, stationFormat = "SC", disabled, onAdd, onChange, onRemove }) {
  const available = items.filter((item) => item.kind === "system");
  const [selectedId, setSelectedId] = useState(available[0]?.id || "");
  const [scope, setScope] = useState("");
  const selected = available.find((item) => item.id === selectedId) || available[0];
  const scopes = selected?.id?.startsWith("dimension-") ? ["3D"] : (selected?.allowedScopes || []).filter((value) => stationFormat === "IMPS" ? !["High Speed", "Low Speed"].includes(value) : value !== "ImPS");
  const selectedScope = scopes.length === 1 ? scopes[0] : scope;
  const displayCategory = getBoqAddCategory({ stationFormat, kind: "system", canonicalItemId: selected?.id, categoryCode: selected?.checklistMapping?.[0], scope: selectedScope });
  return <section className="ops-config-list" aria-label="ระบบประจำสถานี">
    <div className="ops-detail-asset-add-controls"><label className="ops-field ops-field-wide"><span>System จากคลังกลาง</span><CustomSelect label="System จากคลังกลาง" value={selected?.id || ""} onChange={(event) => { setSelectedId(event.target.value); setScope(""); }} disabled={disabled}><option value="">เลือก System</option>{available.map((item) => <option key={item.id} value={item.id}>{item.nameEn || item.nameTh} · {item.nameTh} · {item.category}</option>)}</CustomSelect></label>{scopes.length > 1 && <label className="ops-field"><span>ชุดระบบที่ติดตั้ง</span><CustomSelect label="ชุดระบบที่ติดตั้ง" value={scope} onChange={(event) => setScope(event.target.value)}><option value="">เลือกชุดระบบ</option>{scopes.map((value) => <option key={value} value={value}>{getBoqAddCategory({ stationFormat, kind: "system", canonicalItemId: selected?.id, categoryCode: selected?.checklistMapping?.[0], scope: value }).title}</option>)}</CustomSelect></label>}<small>{displayCategory.code || "เลือกชุดระบบ"} · {displayCategory.title} · BOQ/TOR {selected?.checklistMapping?.join(", ") || "—"}</small><Button onClick={() => selected && onAdd(selected, 1, { scope: selectedScope })} disabled={disabled || !selected || !displayCategory.code || (scopes.length > 1 && !scope)} icon="plus">เพิ่ม System</Button></div>
    {systems.map((system) => { const definition = items.find((item) => item.id === system.canonicalItemId); return <div className="ops-config-item" key={system.id}><div><strong>{getStationSystemDisplayLabel(system)}</strong><span>{definition?.category || system.sourceRefs?.join(", ") || "Canonical System"}</span></div><label className="ops-field"><span>ขอบเขต</span><CustomSelect label="ขอบเขต" value={system.scope || definition?.allowedScopes[0] || "Station-wide"} onChange={(event) => onChange(system.id, "scope", event.target.value)} disabled={disabled}>{(definition?.allowedScopes || [system.scope || "Station-wide"]).map((scope) => <option key={scope} value={scope}>{scope}</option>)}</CustomSelect></label><label className="ops-field"><span>จำนวน</span><input type="number" min="0" value={system.quantity ?? 0} onChange={(event) => onChange(system.id, "quantity", event.target.value)} disabled={disabled} /></label><label className="ops-field"><span>หน่วย</span><input value={system.unit || system.referenceUnit || "ระบบ"} onChange={(event) => onChange(system.id, "unit", event.target.value)} disabled={disabled} /></label><label className="ops-field"><span>หมายเหตุ</span><input value={system.note || ""} onChange={(event) => onChange(system.id, "note", event.target.value)} disabled={disabled} /></label><Button onClick={() => onRemove(system.id)} variant="danger-ghost" disabled={disabled}>นำออก</Button></div>; })}
  </section>;
}

function ScContextIcon({ name, size = 20, className = "" }) {
  return <Icon name={getScIconName(name)} pixelSize={size} className={className} />;
}

function getScAssetTypeDisplayName(equipment) {
  return getEquipmentDisplayLabel(equipment);
}

function getScAssetTypeEnglishName(equipment) {
  return getEquipmentEnglishLabel(equipment);
}

function getScSystemShortLabel(systemId) {
  const value = String(systemId || "").trim();
  if (!value) return "—";
  if (value.toLowerCase() === "other") return "SYS";
  return value.toUpperCase();
}

function getScSystemCategoryCodes(item) {
  const codes = Array.isArray(item?.checklistMapping) ? item.checklistMapping.filter(Boolean) : [];
  return codes.length ? codes.join(", ") : "—";
}

const SC_OPERATION_SYSTEM_GROUPS = Object.freeze([
  ...CENTRAL_EQUIPMENT_MAIN_CATEGORIES,
  Object.freeze({ id: "other", label: "Other Systems", description: "ระบบส่วนควบอื่น ๆ", categoryCodes: [], canonicalCategories: [], icon: "other" }),
]);

function currentStationSystemRows(systems = []) {
  return Array.isArray(systems) ? systems : [];
}

function getScSystemGroupForCanonical(item) {
  return SC_OPERATION_SYSTEM_GROUPS.find((group) => group.canonicalCategories.includes(item?.category))?.id || "other";
}

function getScSystemGroupForRegisteredSystem(system, definition) {
  if (definition) return getScSystemGroupForCanonical(definition);
  const searchable = `${system?.canonicalItemId || ""} ${system?.systemId || ""} ${system?.displayLabel || ""} ${system?.sourceLabel || ""}`.toLowerCase();
  if (searchable.includes("wim") || searchable.includes("weigh-in-motion")) return "wim";
  if (searchable.includes("lpr") || searchable.includes("license plate") || searchable.includes("ป้ายทะเบียน")) return "lpr";
  if (searchable.includes("cctv") || searchable.includes("video recorder") || searchable.includes("กล้องวงจรปิด")) return "cctv";
  if (searchable.includes("vms") || searchable.includes("variable message")) return "vms";
  if (searchable.includes("dimension") || searchable.includes("3d")) return "3d";
  if (searchable.includes("image processing") || searchable.includes("image processor") || searchable.includes("ประมวลผลสัญญาณภาพ")) return "image-processing";
  if (searchable.includes("cabinet") || searchable.includes("ตู้ควบคุมอุปกรณ์")) return "station-infrastructure";
  if (searchable.includes("database") || searchable.includes("processing") || searchable.includes("ประมวลผล") || searchable.includes("บริหารข้อมูล")) return "data-control";
  return "other";
}

function getScTemplateCategoryCounts(stationFormat) {
  const counts = getDefaultStationEquipmentCounts(stationFormat);
  return ITEM_LIBRARY_CATEGORIES.map((category) => ({
    ...category,
    expected: Object.entries(counts).filter(([type]) => getEquipmentCategoryCode({ type }) === category.code).reduce((total, [, count]) => total + Number(count || 0), 0),
  }));
}

function isScAssetDataComplete(equipment, activeLanes, stationSystems = [], stationEquipment = []) {
  const location = String(equipment?.location || "").trim();
  const locationReady = Boolean(location && location !== "ระบุตำแหน่ง");
  const wimParent = isWimEquipment(equipment) ? getWimSortingSystemById(stationSystems, equipment?.parentSystemId) : null;
  const laneReady = !isWimEquipment(equipment) || Boolean(wimParent && activeLanes.some((lane) => lane.id === wimParent.laneId) && (!equipment.laneId || equipment.laneId === wimParent.laneId));
  const outputReady = equipment?.type !== "WIM_SWITCHING_DC" || (Array.isArray(equipment?.outputVoltages) && equipment.outputVoltages.length > 0);
  const electronicsHierarchyReady = !getWimElectronicsHierarchyIssue(equipment, stationEquipment, stationSystems);
  return locationReady && isEquipmentDetailComplete(equipment) && laneReady && outputReady && electronicsHierarchyReady;
}

function ScRecordEditor({ asset, system, systemDefinition, profile, activeLanes, stationEquipment = [], onClose, onChangeAsset, onAssignLane, onAssignParentSystem, onRemoveAsset, onChangeSystem, onRemoveSystem }) {
  if (!asset && !system) return <EmptyState icon="equipment" title="เลือกรายการเพื่อดูรายละเอียด">คลิก System หรือ Asset ในทะเบียนเพื่อเปิดข้อมูล</EmptyState>;
  const isSystem = Boolean(system);
  const title = isSystem ? getStationSystemDisplayLabel(system) : asset.assetNo || "ยังไม่มี Asset No.";
  const subtitle = isSystem ? systemDefinition?.category || "Canonical System" : getScAssetTypeDisplayName(asset);
  const inferredSystemGroup = isSystem ? SC_OPERATION_SYSTEM_GROUPS.find((group) => group.id === getScSystemGroupForRegisteredSystem(system, systemDefinition)) : null;
  const isWimElectronicChild = !isSystem && isWimElectronicsSubEquipmentType(asset.type);
  const isWimElectronicsRecord = !isSystem && (asset.type === "CONTROL_CABINET" || isWimElectronicChild);
  const assetCanonicalDefinition = !isSystem ? getCanonicalItemsForFormat(profile?.stationFormat).find((entry) => entry.kind === "asset" && entry.equipmentType === asset.type) : null;
  const assetOwnerSystemOptions = (profile?.stationSystems || []).filter((entry) => entry.active !== false && Number(entry.quantity ?? 1) > 0
    && (assetCanonicalDefinition?.systemIds || []).includes(entry.canonicalItemId || entry.systemId));
  const assetOwnerSystem = assetOwnerSystemOptions.find((entry) => entry.id === asset?.parentSystemId);
  const activeElectronicsSystems = (profile?.stationSystems || []).filter((entry) => entry?.active !== false && Number(entry?.quantity ?? 1) > 0
    && ((entry.canonicalItemId || entry.systemId) === "wim-electronics-system" || (entry.systemId === "wim" && entry.componentId === "electronics")));
  const parentCabinets = !isSystem ? (profile?.equipment || []).filter((entry) => entry.type === "CONTROL_CABINET" && entry.active !== false) : [];
  const parentCabinet = parentCabinets.find((entry) => entry.id === asset?.parentAssetId) || (isWimElectronicChild && parentCabinets.length === 1 ? parentCabinets[0] : null);
  const electronicsParentSystemOptions = activeElectronicsSystems;
  const cabinetOwnerSystemOptions = electronicsParentSystemOptions.filter((entry) => !parentCabinet?.scope || !entry.scope
    || String(entry.scope).trim().toLowerCase() === String(parentCabinet.scope).trim().toLowerCase());
  const electronicsSystemChoices = isWimElectronicChild ? cabinetOwnerSystemOptions : electronicsParentSystemOptions;
  const electronicsParentSystem = electronicsSystemChoices.find((entry) => entry.id === (parentCabinet?.parentSystemId || asset?.parentSystemId))
    || null;
  const electronicsDerivedScope = parentCabinet?.scope || electronicsParentSystem?.scope || String(asset?.scope || "").trim();
  const electronicsHierarchyIssue = !isSystem ? getWimElectronicsHierarchyIssue(asset, stationEquipment, profile?.stationSystems) : null;
  const parentWimSystems = !isSystem ? getWimSortingSystemInstances(profile?.stationSystems) : [];
  const wimParent = !isSystem && isWimEquipment(asset) ? getWimSortingSystemById(profile?.stationSystems, asset.parentSystemId) : null;
  const wimParentLane = wimParent ? activeLanes.find((lane) => lane.id === wimParent.laneId) : null;
  const isWimSystemInstance = isSystem && isWimSortingSystemRecord(system);
  const active = (isSystem ? system.active : asset.active) !== false;
  return <>
    <div className="sc-editor-heading"><div><span className="sc-editor-icon">{isSystem ? <Icon name="system" pixelSize={24} /> : <ScContextIcon name={asset.type} size={24} />}</span><div><h2 id="sc-editor-title">{isSystem ? "รายละเอียดระบบ" : "รายละเอียดอุปกรณ์"}</h2><p>{title} · {subtitle}</p></div></div><button type="button" className="sc-close" onClick={onClose} aria-label="ปิดแผงรายละเอียด">×</button></div>
    <div className="sc-selected-identity"><span className={`sc-record-kind ${isSystem ? "is-system" : "is-asset"}`}>{isSystem ? "SYSTEM" : "ASSET"}</span><strong>{title}</strong><span className={active ? "is-active" : "is-inactive"}>{active ? "ใช้งาน" : "ปิดใช้งาน"}</span></div>
    <div className="sc-editor-tabs"><span className="is-active">ข้อมูลทั่วไป</span><span>การตั้งค่า</span><span>ประวัติ</span></div>
    {isSystem ? <div className="sc-editor-fields" id={`sc-system-field-${system.id}`}>
      <div className="sc-readonly-field"><span>ประเภทข้อมูล</span><strong><Icon name="system" pixelSize={16} />System · {systemDefinition?.category || inferredSystemGroup?.label || "ระบบอื่น"}</strong></div>
      <label className="ops-field"><span>ชื่อระบบ</span><input value={getStationSystemLabel(system)} disabled={profile.active === false} onChange={(event) => onChangeSystem(system.id, "displayLabel", event.target.value)} /></label>
      <label className="ops-field"><span>ขอบเขต</span><CustomSelect label={`ขอบเขตของ ${getStationSystemLabel(system)}`} value={system.scope || systemDefinition?.allowedScopes?.[0] || "Station-wide"} disabled={profile.active === false} onChange={(event) => onChangeSystem(system.id, "scope", event.target.value)}>{(systemDefinition?.allowedScopes || [system.scope || "Station-wide"]).map((scope) => <option key={scope} value={scope}>{scope}</option>)}</CustomSelect></label>
      <label className="ops-field"><span>จำนวน</span><input type="number" min="0" value={system.quantity ?? 0} readOnly={isWimSystemInstance} disabled={profile.active === false || isWimSystemInstance} onChange={(event) => onChangeSystem(system.id, "quantity", event.target.value)} /></label>
      {isWimSystemInstance && <><label className="ops-field"><span>WIM Sorting System Instance</span><input value={`#${system.instanceNo || "?"}`} readOnly /></label><label className="ops-field"><span>Lane ที่ติดตั้ง</span><CustomSelect label={`Lane ของ WIM Sorting System ${system.instanceNo || ""}`} value={system.laneId || ""} disabled={profile.active === false} onChange={(event) => onChangeSystem(system.id, "laneId", event.target.value)}><option value="">เลือก Lane</option>{activeLanes.map((lane) => <option key={lane.id} value={lane.id}>Lane {lane.laneNo} · {getLaneScope(lane, profile?.stationSystems) || "ไม่ระบุ Scope"} · {lane.label}</option>)}</CustomSelect></label></>}
      <label className="ops-field"><span>หน่วย</span><input value={system.unit || system.referenceUnit || systemDefinition?.defaultUnit || "ระบบ"} disabled={profile.active === false} onChange={(event) => onChangeSystem(system.id, "unit", event.target.value)} /></label>
      <label className="ops-field"><span>หมายเหตุ</span><textarea rows="3" value={system.note || ""} disabled={profile.active === false} onChange={(event) => onChangeSystem(system.id, "note", event.target.value)} /></label>
    </div> : <div className="sc-editor-fields" id={`sc-asset-field-${asset.id}`}>
      <label className="ops-field"><span>Asset No.</span><input value={asset.assetNo || ""} disabled={profile.active === false} onChange={(event) => onChangeAsset(asset.id, "assetNo", event.target.value)} /></label>
      <div className="sc-readonly-field"><span>ประเภทและหมวด</span><strong><ScContextIcon name={asset.type} size={16} />{getScAssetTypeDisplayName(asset)} · {getEquipmentCategoryCode(asset) || "—"}</strong></div>
      <div className="sc-readonly-field"><span>ระบบ</span><strong>{getScSystemShortLabel(getEquipmentType(asset.type)?.systemId)}</strong></div>
      <label className="ops-field"><span>ตำแหน่งติดตั้ง</span><input value={asset.location || ""} placeholder="ระบุตำแหน่งติดตั้ง" disabled={profile.active === false} onChange={(event) => onChangeAsset(asset.id, "location", event.target.value)} /></label>
      {isWimElectronicsRecord && asset.type === "CONTROL_CABINET" && electronicsParentSystemOptions.length > 0 && (!asset.parentSystemId || electronicsParentSystemOptions.length > 1) && <label className="ops-field"><span>WIM Electronics System แม่</span><CustomSelect label={`WIM Electronics System ของ ${asset.assetNo}`} value={asset.parentSystemId || ""} disabled={profile.active === false} onChange={(event) => { const parent = electronicsParentSystemOptions.find((entry) => entry.id === event.target.value); onChangeAsset(asset.id, "parentSystemId", parent?.id || null); onChangeAsset(asset.id, "scope", parent?.scope || ""); }}><option value="">เลือก WIM Electronics System</option>{electronicsParentSystemOptions.map((entry) => <option key={entry.id} value={entry.id}>{getStationSystemDisplayLabel(entry)} · {entry.scope || "ไม่ระบุ Scope"}</option>)}</CustomSelect></label>}
      {isWimElectronicsRecord && asset.type === "CONTROL_CABINET" && asset.parentSystemId && electronicsParentSystemOptions.length === 1 && <div className="sc-readonly-field"><span>WIM Electronics System แม่</span><strong>{getStationSystemDisplayLabel(electronicsParentSystemOptions[0])}</strong></div>}
      {!isWimElectronicsRecord && !isWimEquipment(asset) && assetOwnerSystemOptions.length > 0 && (!asset.parentSystemId || assetOwnerSystemOptions.length > 1) && <label className="ops-field"><span>System แม่</span><CustomSelect label={`System แม่ของ ${asset.assetNo}`} value={assetOwnerSystem?.id || ""} disabled={profile.active === false} onChange={(event) => { const parent = assetOwnerSystemOptions.find((entry) => entry.id === event.target.value); onChangeAsset(asset.id, "parentSystemId", parent?.id || null); onChangeAsset(asset.id, "scope", parent?.scope || ""); }}><option value="">เลือกระบบแม่</option>{assetOwnerSystemOptions.map((entry) => <option key={entry.id} value={entry.id}>{getStationSystemDisplayLabel(entry)} · {entry.scope || "ไม่ระบุ Scope"}</option>)}</CustomSelect></label>}
      {isWimElectronicsRecord && asset.type === "CONTROL_CABINET" && electronicsParentSystemOptions.length > 1 && <label className="ops-field"><span>WIM Electronics System แม่</span><CustomSelect label={`WIM Electronics System ของ ${asset.assetNo}`} value={electronicsParentSystem?.id || ""} disabled={profile.active === false} onChange={(event) => { const parent = electronicsParentSystemOptions.find((entry) => entry.id === event.target.value); onChangeAsset(asset.id, "parentSystemId", parent?.id || null); onChangeAsset(asset.id, "scope", parent?.scope || ""); }}><option value="">เลือก WIM Electronics System</option>{electronicsParentSystemOptions.map((entry) => <option key={entry.id} value={entry.id}>{getStationSystemDisplayLabel(entry)} · {entry.scope || "ไม่ระบุ Scope"}</option>)}</CustomSelect></label>}
      {isWimElectronicsRecord && asset.type === "CONTROL_CABINET" && electronicsParentSystemOptions.length === 1 && <div className="sc-readonly-field"><span>WIM Electronics System แม่</span><strong>{getStationSystemDisplayLabel(electronicsParentSystemOptions[0])}</strong></div>}
      {!isWimElectronicsRecord && !isWimEquipment(asset) && assetOwnerSystem && <div className="sc-readonly-field"><span>Scope</span><strong>{assetOwnerSystem.scope || "ยังไม่ระบุ"}</strong><small>กำหนดตาม System แม่</small></div>}
      {isWimElectronicsRecord && <div className="sc-readonly-field"><span>Scope</span><strong>{electronicsParentSystem?.scope || (isWimElectronicChild ? parentCabinet?.scope : asset.parentSystemId ? electronicsDerivedScope : "") || "เลือกระบบแม่เพื่อกำหนด Scope"}</strong><small>กำหนดจาก System หรือ Cabinet แม่</small></div>}
      {isWimElectronicChild && parentCabinets.length > 0 && (!asset.parentAssetId || parentCabinets.length > 1) && <label className="ops-field"><span>อยู่ภายใต้ Cabinet <em>(จำเป็นต่อ Checklist)</em></span><CustomSelect label={`Cabinet ของ ${asset.assetNo}`} value={parentCabinet?.id || ""} disabled={profile.active === false} onChange={(event) => { const cabinet = parentCabinets.find((entry) => entry.id === event.target.value); const compatibleSystems = electronicsParentSystemOptions.filter((entry) => !cabinet?.scope || !entry.scope || String(entry.scope).trim().toLowerCase() === String(cabinet.scope).trim().toLowerCase()); const parentSystem = compatibleSystems.find((entry) => entry.id === cabinet?.parentSystemId) || (compatibleSystems.length === 1 ? compatibleSystems[0] : null); onChangeAsset(asset.id, "parentAssetId", cabinet?.id || null); onChangeAsset(asset.id, "parentSystemId", parentSystem?.id || null); onChangeAsset(asset.id, "scope", cabinet?.scope || parentSystem?.scope || ""); }}><option value="">เลือก Cabinet แม่</option>{parentCabinets.map((cabinet) => <option key={cabinet.id} value={cabinet.id}>{cabinet.assetNo || "ไม่มี Asset No."} · {cabinet.location || "ยังไม่ระบุตำแหน่ง"} · {cabinet.scope || "ทุกขอบเขต"}</option>)}</CustomSelect></label>}
      {isWimElectronicChild && parentCabinet && (!parentCabinet.parentSystemId || asset.parentSystemId !== parentCabinet.parentSystemId) && cabinetOwnerSystemOptions.length > 0 && <label className="ops-field"><span>WIM Electronics System แม่</span><CustomSelect label={`WIM Electronics System ของ ${asset.assetNo}`} value={asset.parentSystemId && cabinetOwnerSystemOptions.some((entry) => entry.id === asset.parentSystemId) ? asset.parentSystemId : ""} disabled={profile.active === false} onChange={(event) => { const parent = cabinetOwnerSystemOptions.find((entry) => entry.id === event.target.value); onChangeAsset(asset.id, "parentSystemId", parent?.id || null); onChangeAsset(asset.id, "scope", parentCabinet.scope || parent?.scope || ""); }}><option value="">เลือกระบบแม่</option>{cabinetOwnerSystemOptions.map((entry) => <option key={entry.id} value={entry.id}>{getStationSystemDisplayLabel(entry)} · {entry.scope || "ไม่ระบุ Scope"}</option>)}</CustomSelect></label>}
      {isWimElectronicChild && parentCabinets.length === 1 && <div className="sc-readonly-field"><span>Cabinet แม่</span><strong>{parentCabinets[0].assetNo || "ไม่มี Asset No."} · {parentCabinets[0].scope || "ไม่ระบุ Scope"}</strong></div>}
      {asset.type === "WIM_SWITCHING_DC" && <fieldset className="ops-serial-fieldset"><legend>แรงดัน Output ภายใน Switching DC</legend><div className="ops-serial-options ops-serial-segmented" role="group" aria-label={`แรงดัน Output ของ ${asset.assetNo}`}>
        {WIM_ELECTRONICS_OUTPUT_VOLTAGES.map((voltage) => { const selected = (asset.outputVoltages || []).includes(voltage); return <label key={voltage} className={selected ? "is-selected" : ""}><input type="checkbox" checked={selected} disabled={profile.active === false} onChange={() => { const current = Array.isArray(asset.outputVoltages) ? asset.outputVoltages : []; onChangeAsset(asset.id, "outputVoltages", selected ? current.filter((entry) => entry !== voltage) : [...current, voltage].sort((left, right) => left - right)); }} /><span>{voltage}VDC</span></label>; })}
      </div><small className="ops-field-warning">เลือกเฉพาะแรงดันที่มีอยู่จริงภายในเครื่องนี้ และแยก 24VDC ออกจาก 24VAC</small></fieldset>}
      {isWimEquipment(asset) && <><label className="ops-field"><span>WIM Sorting System แม่</span><CustomSelect label={`WIM Sorting System ของ ${asset.assetNo}`} value={asset.parentSystemId || ""} disabled={profile.active === false} onChange={(event) => (onAssignParentSystem || onAssignLane)?.(asset.id, event.target.value)}><option value="">ยังไม่ผูกระบบแม่</option>{parentWimSystems.map((parent) => { const lane = activeLanes.find((entry) => entry.id === parent.laneId); return <option key={parent.id} value={parent.id}>WIM Sorting System #{parent.instanceNo || "?"} · Lane {lane?.laneNo || "?"}</option>; })}</CustomSelect></label><div className="sc-readonly-field"><span>Lane ที่ได้จากระบบแม่</span><strong>{wimParentLane ? `Lane ${wimParentLane.laneNo} · ${wimParentLane.label}` : "ยังไม่ทราบ Lane"}</strong></div></>}
      <label className="ops-field"><span>สถานะ Serial Number</span><CustomSelect label={`สถานะ Serial Number ของ ${asset.assetNo}`} value={asset.serialStatus || "unknown"} disabled={profile.active === false} onChange={(event) => onChangeAsset(asset.id, "serialStatus", event.target.value)}><option value="unknown">ยังไม่ระบุ</option><option value="present">มี Serial Number</option><option value="not-available">ไม่มี Serial Number</option></CustomSelect></label>
      {asset.serialStatus === "present" && <label className="ops-field"><span>Serial Number</span><input value={asset.serialNo || ""} disabled={profile.active === false} onChange={(event) => onChangeAsset(asset.id, "serialNo", event.target.value)} /></label>}
      {asset.serialStatus === "not-available" && <label className="ops-field"><span>เหตุผลที่ไม่มี Serial Number</span><input value={asset.serialReason || ""} disabled={profile.active === false} onChange={(event) => onChangeAsset(asset.id, "serialReason", event.target.value)} /></label>}
      <div className="sc-editor-status-row"><span>สถานะเปิดใช้งาน</span><button type="button" className={`sc-toggle ${active ? "is-on" : "is-off"}`} disabled={profile.active === false} onClick={() => onChangeAsset(asset.id, "active", !active)}><i />{active ? "ใช้งานปกติ" : "ปิดใช้งาน"}</button></div>
    </div>}
    {!isSystem && <div className={`sc-derived-status ${isScAssetDataComplete(asset, activeLanes, profile?.stationSystems, stationEquipment) ? "is-complete" : "is-pending"}`}><span className="sc-derived-icon"><Icon name={isScAssetDataComplete(asset, activeLanes, profile?.stationSystems, stationEquipment) ? "check" : "alert"} /></span><div><strong>ความพร้อมของข้อมูล (Derived)</strong><span>{isScAssetDataComplete(asset, activeLanes, profile?.stationSystems, stationEquipment) ? "ข้อมูลพร้อมใช้สำหรับรอบการตรวจใหม่" : electronicsHierarchyIssue?.message || (isWimEquipment(asset) ? "ต้องระบุตำแหน่ง, Serial และ WIM Sorting System แม่ให้ครบ" : "ต้องระบุตำแหน่งและ Serial ให้ครบตามเงื่อนไข")}</span></div></div>}
    <div className="sc-snapshot-note"><Icon name="info" pixelSize={18} /><span>การแก้ไขมีผลกับรอบตรวจใหม่เท่านั้น ข้อมูลใน Snapshot และประวัติเดิมจะคงเดิม</span></div>
    <details className="sc-editor-management"><summary>การจัดการ{isSystem ? "ระบบ" : "อุปกรณ์"}</summary><div><button type="button" className="is-danger" onClick={() => isSystem ? onRemoveSystem(system.id) : onRemoveAsset?.(asset)}>นำออกจากสถานี</button></div></details>
    <div className="sc-editor-footer"><button type="button" className="ops-button ops-button-secondary" onClick={onClose}>ปิดรายละเอียด</button><span>บันทึกอัตโนมัติ</span></div>
  </>;
}

function scRegisterStatusMeta(status) {
  if (status === "inactive") return { label: "ปิดใช้งาน", className: "is-inactive", icon: "archive" };
  if (status === "blocker") return { label: "ต้องแก้", className: "is-blocker", icon: "alert" };
  if (status === "warning") return { label: "ควรเติม", className: "is-warning", icon: "alert" };
  return { label: "พร้อม", className: "is-complete", icon: "check" };
}

function ScWizardSystemRail({ groups = [], selectedGroupId, onSelectGroup, registerView, onRegisterViewChange, groupAttentionCount }) {
  return <aside className="sc-wizard-rail" aria-label="หมวดระบบและอุปกรณ์">
    <div className="sc-wizard-rail-heading"><p className="ops-eyebrow">ทะเบียนอุปกรณ์ประจำสถานี</p><h2>หมวดรายการติดตั้งจริง</h2><p>เลือกหมวดเพื่อดูและจัดการระบบกับอุปกรณ์ที่ติดตั้งในสถานีนี้</p></div>
    <div className="sc-wizard-view-switch" role="group" aria-label="มุมมองทะเบียน">
      <button type="button" className={registerView === "installed" ? "is-active" : ""} aria-pressed={registerView === "installed"} onClick={() => onRegisterViewChange("installed")}>ติดตั้งจริง</button>
      <button type="button" className={registerView === "template" ? "is-active" : ""} aria-pressed={registerView === "template"} onClick={() => onRegisterViewChange("template")}>ตามแม่แบบ</button>
    </div>
    <nav className="sc-wizard-group-list" aria-label="เลือกหมวดระบบ">
      {groups.map((group) => {
        const systemCount = group.allSystems.filter((system) => system.active !== false && Number(system.quantity || 0) > 0).length;
        const assetCount = group.allAssets.filter((asset) => asset.active !== false).length;
        const attention = groupAttentionCount(group);
        return <button type="button" key={group.id} className={`sc-wizard-group ${selectedGroupId === group.id ? "is-selected" : ""}`} aria-current={selectedGroupId === group.id ? "true" : undefined} onClick={() => onSelectGroup(group.id)}>
          <span className="sc-wizard-group-icon"><ScContextIcon name={group.icon} size={18} /></span>
          <span className="sc-wizard-group-copy"><strong>{group.groupId} · {group.label}</strong><small>{systemCount} System · {assetCount} Asset</small></span>
          {attention > 0 && <span className="sc-wizard-group-attention" aria-label={`${attention} รายการต้องตรวจสอบ`}>{attention}</span>}
        </button>;
      })}
      {!groups.length && <div className="sc-wizard-group-empty">ยังไม่มีหมวดที่มีรายการติดตั้งจริง</div>}
    </nav>
  </aside>;
}

function ScUnifiedSystemRegister({ groups, expandedSystemId, onToggleSystem, onAdd, showGroupAdd = true, selectedId, selectedKind, onSelect, activeLanes, stationSystems = [], systemDefinitionsById, templateCategories, showMissingRows, assetStatusFor, systemStatusFor }) {
  return <div className="sc-system-register-list">{groups.map((group) => {
    const expanded = expandedSystemId === group.id;
    const activeSystems = group.allSystems.filter((system) => system.active !== false && Number(system.quantity || 0) > 0);
    const activeAssets = group.allAssets.filter((asset) => asset.active !== false);
    const ready = (activeSystems.length + activeAssets.length) > 0;
    return <article id={`sc-category-${group.id}`} data-station-category={group.id} className={`sc-system-card ${expanded ? "is-expanded" : ""}`} key={group.id}>
      <div className="sc-system-card-heading">
        <button type="button" className="sc-system-card-toggle" aria-expanded={expanded} onClick={() => onToggleSystem(group.id)}>
          <span className="sc-system-chevron" aria-hidden="true">›</span><span className="sc-system-card-icon"><ScContextIcon name={group.icon} size={20} /></span>
          <span className="sc-system-card-copy"><strong>{group.label}</strong><small>{group.description}</small></span>
          <span className="sc-system-card-stat"><strong>{activeSystems.length}</strong><small>System</small></span><span className="sc-system-card-stat"><strong>{activeAssets.length}</strong><small>Asset</small></span>
          <span className={`sc-system-ready ${ready ? "is-ready" : "is-empty"}`}><i />{ready ? "มีข้อมูล" : "ยังไม่มีข้อมูล"}</span>
        </button>
        {showGroupAdd && <button type="button" className="sc-system-add" onClick={() => onAdd(group.id)} aria-label={`เพิ่มอุปกรณ์ใน${group.label}`}><Icon name="plus" />เพิ่มอุปกรณ์</button>}
      </div>
      {expanded && <div className="sc-system-card-body">
        <div className="sc-table-wrap"><table className="sc-table sc-unified-table"><thead><tr><th scope="col">ประเภท</th><th scope="col">ชื่อระบบ / อุปกรณ์</th><th scope="col">Asset No. / จำนวน</th><th scope="col">Lane</th><th scope="col">สถานะข้อมูล</th><th scope="col"><span className="sr-only">เลือก</span></th></tr></thead><tbody>
          {group.systems.length > 0 && <tr className="sc-subgroup-row"><th colSpan="6"><span className="sc-record-kind is-system">SYSTEM</span><strong>ข้อมูลระบบที่ลงทะเบียน</strong><span>{group.systems.length} รายการ</span></th></tr>}
          {group.systems.map((system) => { const definition = systemDefinitionsById.get(system.canonicalItemId); const isWimInstance = isWimSortingSystemRecord(system); const complete = system.active !== false && Number(system.quantity || 0) > 0 && (!isWimInstance || activeLanes.some((lane) => lane.id === system.laneId)); const status = systemStatusFor ? systemStatusFor(system) : (system.active === false ? "inactive" : complete ? "ready" : "blocker"); const statusMeta = scRegisterStatusMeta(status); const baseSystemLabel = getStationSystemDisplayLabel(system); const systemLabel = isWimInstance ? `${baseSystemLabel} #${system.instanceNo || "?"}` : baseSystemLabel; const lane = activeLanes.find((entry) => entry.id === system.laneId); return <tr id={`sc-system-row-${system.id}`} key={system.id} className={`sc-record-row ${selectedKind === "system" && selectedId === system.id ? "is-selected" : ""}`} tabIndex="0" onClick={() => onSelect(system.id, "system", group.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(system.id, "system", group.id); } }}><td><span className="sc-record-kind is-system">SYSTEM</span></td><td><strong>{systemLabel}</strong><small>{definition?.category || system.sourceRefs?.join(", ") || "Canonical System"}</small></td><td>{system.quantity ?? 0} {system.unit || system.referenceUnit || definition?.defaultUnit || "ระบบ"}</td><td>{isWimInstance ? (lane ? `Lane ${lane.laneNo}` : "ยังไม่ผูก Lane") : "ทุกช่อง"}</td><td><span className={`sc-status ${statusMeta.className}`}><i />{statusMeta.label}</span></td><td><button type="button" className="sc-more" aria-label={`เลือก ${systemLabel}`} onClick={(event) => { event.stopPropagation(); onSelect(system.id, "system", group.id); }}>⋮</button></td></tr>; })}
          {group.boqGroups.map((boqGroup) => { const allGroupItems = group.allAssets.filter((item) => getEquipmentCategoryCode(item) === boqGroup.code); const expected = templateCategories.find((category) => category.code === boqGroup.code)?.expected || 0; return <Fragment key={boqGroup.code}><tr className="sc-group-row"><th colSpan="6"><span className="sc-group-icon"><ScContextIcon name={boqGroup.code} size={18} /></span><span className="sc-group-code">{boqGroup.code}</span><strong>{boqGroup.title}</strong><span className="sc-group-count">จริง {allGroupItems.filter((item) => item.active !== false).length} / แม่แบบ {expected}</span></th></tr>{boqGroup.types.map((groupType) => <Fragment key={groupType.value}><tr className="sc-subgroup-row"><th colSpan="6"><span className="sc-record-kind is-asset">ASSET</span><strong>{[groupType.nameEn, groupType.label].filter(Boolean).join(" · ")}</strong><span>{groupType.items.length} รายการ</span></th></tr>{groupType.items.map((equipment) => { const parent = getWimSortingSystemById(stationSystems, equipment.parentSystemId); const lane = parent ? activeLanes.find((entry) => entry.id === parent.laneId) : activeLanes.find((entry) => entry.id === equipment.laneId); const complete = isScAssetDataComplete(equipment, activeLanes, stationSystems); const status = assetStatusFor ? assetStatusFor(equipment) : (equipment.active === false ? "inactive" : complete ? "ready" : "blocker"); const statusMeta = scRegisterStatusMeta(status); return <tr id={`sc-asset-row-${equipment.id}`} key={equipment.id} className={`sc-record-row ${selectedKind === "asset" && selectedId === equipment.id ? "is-selected" : ""} ${equipment.active === false ? "is-inactive" : ""}`} tabIndex="0" onClick={() => onSelect(equipment.id, "asset", group.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(equipment.id, "asset", group.id); } }}><td><span className="sc-record-kind is-asset">ASSET</span></td><td><span className="sc-row-icon"><ScContextIcon name={equipment.type} size={17} /></span><span><strong>{getScAssetTypeDisplayName(equipment)}{isWimEquipment(equipment) && parent ? ` · WIM Sorting System #${parent.instanceNo || "?"}` : ""}</strong><small>{equipment.location || "ยังไม่ระบุตำแหน่ง"}</small></span></td><td><strong className="ops-code">{equipment.assetNo || "ยังไม่มี Asset No."}</strong></td><td>{isWimEquipment(equipment) ? (lane ? `Lane ${lane.laneNo}` : "ยังไม่ผูก Lane") : "—"}</td><td><span className={`sc-status ${statusMeta.className}`}><i />{statusMeta.label}</span></td><td><button type="button" className="sc-more" aria-label={`เลือก ${equipment.assetNo || "อุปกรณ์"}`} onClick={(event) => { event.stopPropagation(); onSelect(equipment.id, "asset", group.id); }}>⋮</button></td></tr>; })}</Fragment>)}</Fragment>; })}
          {group.allSystems.length === 0 && group.allAssets.length === 0 && <tr className="sc-empty-row"><td colSpan="6"><span className="sc-empty-icon"><Icon name="info" pixelSize={17} /></span><span><strong>ยังไม่มีข้อมูลในจุดติดตั้งนี้</strong><small>กด “เพิ่มอุปกรณ์” เพื่อเลือกเฉพาะ System หรือ Asset ที่เข้ากันได้กับชุดระบบนี้</small></span></td></tr>}
        </tbody></table></div>
      </div>}
    </article>;
  })}</div>;
}

function StationProfileScWorkspace({ state, profile, setSelected, addStation, updateProfile, notify, onArchiveStation, onPurgeStation, activeEquipment = [], itemCatalog = [], addCatalogEquipment, canonicalItems = [], addCanonicalSystem, updateCanonicalSystem, removeCanonicalSystem, referenced, updateEquipment, removeEquipment, stationRounds = [], masterConfigSections = [], isMasterConfigDisabled, enabledMasterConfigCount = 0, disabledMasterConfigCount = 0, masterConfigItems = [], toggleChecklist, updateStationLanes, assignStationLane, assignWimParentSystem, addStationLane, removeStationLane }) {
  const [tab, setTab] = useState("equipment");
  const [activeCategoryKey, setActiveCategoryKey] = useState("wim-sorting");
  const [filter, setFilter] = useState("all");
  const [type, setType] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [selectedKind, setSelectedKind] = useState("asset");
  const [expandedSystemId, setExpandedSystemId] = useState("SC-01");
  const [registerView, setRegisterView] = useState("installed");
  const [selectedGroupId, setSelectedGroupId] = useState("wim");
  const [showGeneral, setShowGeneral] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [addContextGroupId, setAddContextGroupId] = useState(null);
  const [addContextBoqGroupCode, setAddContextBoqGroupCode] = useState("");
  const [addContextCategoryId, setAddContextCategoryId] = useState("");
  const [addInitialRecordKind, setAddInitialRecordKind] = useState("");
  const generalRef = useRef(null);
  const activeLanes = (profile?.lanes || []).filter((lane) => lane.active !== false);
  const allAssetEquipment = useMemo(() => sortEquipmentForDisplay((profile?.equipment || []).filter((item) => item.type !== "LANE" && !getEquipmentType(item.type)?.legacyOnly), activeLanes), [profile?.equipment, activeLanes]);
  const activeAssetEquipment = allAssetEquipment.filter((item) => item.active !== false);
  const templateCategories = useMemo(() => getScTemplateCategoryCounts(profile?.stationFormat), [profile?.stationFormat]);
  const templateTotal = templateCategories.reduce((total, category) => total + category.expected, 0);
  const readiness = getStationReadiness(profile);
  const confirmedReady = readiness.ready && Boolean(profile?.readinessConfirmedAt);
  const legacyLaneCount = (profile?.equipment || []).filter((item) => item.type === "LANE").length;
  const pending = activeAssetEquipment.filter((item) => !isScAssetDataComplete(item, activeLanes, profile.stationSystems, allAssetEquipment));
  const typeOptions = Array.from(new Set(allAssetEquipment.map((item) => item.type))).map((value) => ({ value, label: getScAssetTypeDisplayName({ type: value }) }));
  const needsAttention = (item) => item.active !== false && !isScAssetDataComplete(item, activeLanes, profile.stationSystems, allAssetEquipment);
  const filtered = allAssetEquipment.filter((item) => {
    const matchesFilter = filter === "inactive" ? item.active === false : item.active !== false && (filter !== "pending" || needsAttention(item));
    const matchesType = type === "all" || item.type === type;
    const searchable = `${item.assetNo || ""} ${getScAssetTypeDisplayName(item)} ${getScAssetTypeEnglishName(item)} ${item.location || ""}`.toLowerCase();
    return matchesFilter && matchesType && (!query || searchable.includes(query.toLowerCase()));
  });
  const currentCanonicalItems = canonicalItems;
  const systemDefinitionsById = useMemo(() => new Map(currentCanonicalItems.map((item) => [item.id, item])), [currentCanonicalItems]);
  const registeredSystems = profile?.stationSystems || [];
  const visibleStationSystems = currentStationSystemRows(registeredSystems);
  const registerableSystems = visibleStationSystems.filter((system) => system.id !== "present-wim-sorting");
  const relationshipSystemCount = useMemo(() => getStationRelationshipSystemCount({ stationFormat: profile?.stationFormat, systems: registerableSystems }), [profile?.stationFormat, registerableSystems]);
  const wimSystemCount = getWimSortingInstalledQuantity(registeredSystems);
  const blockerAssetIds = new Set((readiness.blockers || []).map((blocker) => blocker.assetId).filter(Boolean));
  const blockerSystemIds = new Set((readiness.blockers || []).map((blocker) => blocker.systemId).filter(Boolean));
  const warningAssetIds = new Set((readiness.warnings || []).map((warning) => warning.assetId).filter(Boolean));
  const warningSystemIds = new Set((readiness.warnings || []).map((warning) => warning.systemId).filter(Boolean));
  const assetRegisterStatus = (asset) => {
    if (asset.active === false) return "inactive";
    if (blockerAssetIds.has(asset.id)) return "blocker";
    if (warningAssetIds.has(asset.id) || !isScAssetDataComplete(asset, activeLanes, profile.stationSystems, allAssetEquipment)) return "warning";
    return "ready";
  };
  const systemRegisterStatus = (system) => {
    if (system.active === false) return "inactive";
    const isWimInstance = isWimSortingSystemRecord(system);
    const complete = Number(system.quantity || 0) > 0 && (!isWimInstance || activeLanes.some((lane) => lane.id === system.laneId));
    if (blockerSystemIds.has(system.id)) return "blocker";
    if (warningSystemIds.has(system.id)) return "warning";
    return complete ? "ready" : "blocker";
  };
  const groupAttentionCount = (group) => [...group.allSystems.map(systemRegisterStatus), ...group.allAssets.map(assetRegisterStatus)].filter((status) => status === "blocker" || status === "warning").length;
  const relationshipTree = useMemo(() => buildStationRelationshipTree({
    stationFormat: profile?.stationFormat,
    systems: registerableSystems.filter((system) => !query || `${getStationSystemLabel(system)} ${getStationSystemEnglishLabel(system)} ${system.displayLabel || ""} ${system.sourceLabel || ""}`.toLowerCase().includes(query.toLowerCase())),
    equipment: filtered,
    includeEmptyGroups: registerView === "template",
    includeInactive: filter === "inactive",
    includeCatalogOptions: true,
  }), [profile?.stationFormat, registerableSystems, filtered, query, registerView, filter]);
  const profileRelationshipTree = useMemo(() => buildStationRelationshipTree({
    stationFormat: profile?.stationFormat,
    systems: registerableSystems,
    equipment: allAssetEquipment,
    includeEmptyGroups: registerView === "template",
    includeInactive: filter === "inactive",
    includeCatalogOptions: true,
  }), [profile?.stationFormat, registerableSystems, allAssetEquipment, registerView, filter]);
  const visibleOperationalGroups = profileRelationshipTree
    .filter((group) => registerView === "template" || group.hasData)
    .map((group) => ({
      ...group,
      id: group.groupId,
      label: group.title,
      description: group.isUnmapped ? "รายการจริงที่ยังไม่มีตำแหน่งในผังสถานี" : `กลุ่ม ${profile.stationFormat || "SC"} ตามแบบสถานี`,
      icon: group.isUnmapped ? "other" : "system",
      allSystems: group.categories.flatMap((category) => category.systems),
      allAssets: group.categories.flatMap((category) => category.assets),
    }));
  const selectedGroup = visibleOperationalGroups.find((group) => group.id === selectedGroupId) || visibleOperationalGroups[0] || null;
  const relationshipGroupForCategory = (categoryId) => {
    return profileRelationshipTree.find((group) => group.categories.some((category) => category.id === categoryId && category.hasData))
    || profileRelationshipTree.find((group) => group.categories.some((category) => category.id === categoryId))
    || profileRelationshipTree[0] || null;
  };
  const relationshipLocationForRecord = (recordId, kind) => {
    for (const group of profileRelationshipTree) {
      const category = group.categories.find((entry) => {
        const records = kind === "system" ? entry.systems : entry.assets;
        return records.some((record) => String(record.id) === String(recordId));
      });
      if (category) return { group, category };
    }
    return null;
  };
  const closedRounds = stationRounds.filter((round) => round.status === "closed");
  const directionLabel = { inbound: "ขาเข้า", outbound: "ขาออก", both: "ทั้งสองทิศทาง", unspecified: "ไม่ระบุ" }[profile?.direction] || profile?.direction || "ไม่ระบุ";
  const switchTab = (nextTab) => { setTab(nextTab); if (nextTab !== "equipment") setSelectedId(null); };
  const selectItem = (id, kind = "asset", systemGroupId = null) => {
    setSelectedId(id);
    setSelectedKind(kind);
    if (systemGroupId) {
      const nextGroup = relationshipGroupForCategory(systemGroupId);
      if (nextGroup) {
        setSelectedGroupId(nextGroup.groupId);
        setExpandedSystemId(nextGroup.groupId);
        setActiveCategoryKey(nextGroup.categories.find((category) => category.id === systemGroupId)?.id || nextGroup.categories[0]?.id || "");
      }
    }
    setTab("equipment");
  };
  const closeEditor = () => {
    const id = selectedId;
    const kind = selectedKind;
    setSelectedId(null);
    requestAnimationFrame(() => document.getElementById(`sc-${kind}-row-${id}`)?.querySelector("button")?.focus());
  };
  const renderProfileWorkSpecEditor = (record, kind) => {
    const location = relationshipLocationForRecord(record.id, kind);
    const category = location?.category;
    const definition = kind === "asset"
      ? currentCanonicalItems.find((item) => item.kind === "asset" && item.equipmentType === record.type)
      : systemDefinitionsById.get(record.canonicalItemId);
    const options = kind === "asset" ? (category?.equipmentOptions || []) : (category?.systemOptions || []);
    const workSpecOption = options.find((item) => kind === "asset"
      ? String(item.equipmentType || "").toUpperCase() === String(record.type || "").toUpperCase()
        && (!record.scope || !item.scope || String(item.scope) === String(record.scope))
      : item.canonicalItemId === record.canonicalItemId
        && (!record.scope || !item.scope || String(item.scope) === String(record.scope)));
    const contextScope = String(workSpecOption?.scope || "").trim();
    const scopeChoices = (definition?.allowedScopes || (kind === "asset" ? equipmentScopeChoices(record.type) : []))
      .filter((scope) => profile.stationFormat === "IMPS" ? !["High Speed", "Low Speed"].includes(scope) : !["ImPS", "Image Processing"].includes(scope));
    const ownerSystemIds = Array.isArray(definition?.systemIds) ? definition.systemIds : [];
    const ownerSystemOptions = kind === "asset" && ownerSystemIds.length && !isWimEquipment(record) && !isWimElectronicsSubEquipmentType(record.type)
      ? registeredSystems.filter((system) => system.active !== false
        && ownerSystemIds.includes(system.canonicalItemId || system.systemId)
        && (!contextScope || String(system.scope || "") === contextScope))
      : [];
    const parentScope = String(contextScope || record.scope || "").trim();
    const wimParentOptions = kind === "asset" && isWimEquipment(record)
      ? getWimSortingSystemInstances(registeredSystems).filter((system) => system.active !== false
        && (!parentScope || String(system.scope || "") === parentScope)
        && activeLanes.some((lane) => lane.id === system.laneId))
        .map((system) => ({
          id: system.id,
          laneId: system.laneId,
          scope: system.scope,
          laneLabel: `Lane ${activeLanes.find((lane) => lane.id === system.laneId)?.laneNo || "—"}`,
          label: `WIM Sorting System #${system.instanceNo || "?"} · Lane ${activeLanes.find((lane) => lane.id === system.laneId)?.laneNo || "—"} · ${system.scope || "ไม่ระบุ Scope"}`,
        }))
      : [];
    const cabinetOptions = kind === "asset" && isWimElectronicsSubEquipmentType(record.type)
      ? allAssetEquipment.filter((asset) => asset.type === "CONTROL_CABINET" && asset.active !== false
        && (!parentScope || !asset.scope || String(asset.scope) === parentScope))
      : [];
    const electronicsSystemOptions = kind === "asset" && (record.type === "CONTROL_CABINET" || isWimElectronicsSubEquipmentType(record.type))
      ? registeredSystems.filter((system) => system.active !== false
        && ((system.canonicalItemId || system.systemId) === "wim-electronics-system" || (system.systemId === "wim" && system.componentId === "electronics"))
        && (!parentScope || !system.scope || String(system.scope) === parentScope))
      : [];
    const laneOptions = kind === "system" && isWimSortingSystemRecord(record)
      ? activeLanes.filter((lane) => !getWimSortingSystemInstances(registeredSystems).some((system) => system.id !== record.id && system.laneId === lane.id))
      : [];
    if (kind === "system" && isWimSortingSystemRecord(record) && record.laneId && !laneOptions.some((lane) => lane.id === record.laneId)) {
      const currentLane = (profile.lanes || []).find((lane) => lane.id === record.laneId);
      if (currentLane) laneOptions.unshift(currentLane);
    }
    const parent = kind === "asset" && isWimEquipment(record) ? getWimSortingSystemById(registeredSystems, record.parentSystemId) : null;
    const parentLane = parent ? activeLanes.find((lane) => lane.id === parent.laneId) : null;
    const relationshipText = parent ? `${getStationSystemDisplayLabel(parent)} · Lane ${parentLane?.laneNo || "—"}` : (kind === "asset" && isWimEquipment(record) ? "ยังไม่ผูกระบบแม่" : "");
    const path = location
      ? getRelationshipPath({ format: profile.stationFormat, groupCode: location.group.code, categoryId: category.id, kind })
      : "รายการนอก Work Spec";
    const validateAssetNo = kind === "asset"
      ? (assetNo) => validateEquipmentDraft({ assetNo }, profile.equipment, { excludeId: record.id }).errors.assetNo || ""
      : undefined;
    const save = (edited) => {
      if (kind === "asset") {
        const fields = ["assetNo", "location", "serialNo", "serialStatus", "serialReason", "parentSystemId", "parentAssetId", "scope", "laneId", "outputVoltages", "active"];
        const patch = Object.fromEntries(fields.filter((field) => Object.prototype.hasOwnProperty.call(edited, field)).map((field) => [field, edited[field]]));
        updateEquipment?.(record.id, patch);
      } else {
        for (const field of ["displayLabel", "scope", "quantity", "unit", "note", "laneId"]) {
          if (Object.prototype.hasOwnProperty.call(edited, field)) updateCanonicalSystem?.(record.id, field, edited[field]);
        }
      }
      setSelectedId(null);
    };
    return <div className="sc-work-spec-inline" aria-label={`แก้ไขรายการติดตั้งจริง ${path}`}>
      <div className="sc-work-spec-inline-heading">
        <p className="ops-eyebrow">ทะเบียนอุปกรณ์ประจำสถานี · แก้ไขรายการติดตั้งจริง</p>
        <strong>{path}</strong>
        {category?.description && <small>{category.description}</small>}
      </div>
      <StationRelationshipInlineEditor
        key={`${kind}-${record.id}`}
        record={record}
        kind={kind}
        label={kind === "asset" ? getScAssetTypeDisplayName(record) : getStationSystemDisplayLabel(record)}
        scopeChoices={scopeChoices}
        laneOptions={laneOptions}
        wimParentOptions={wimParentOptions}
        ownerSystemOptions={ownerSystemOptions}
        ownerSystemRequired={Boolean(ownerSystemIds.length && !isWimEquipment(record) && !isWimElectronicsSubEquipmentType(record.type))}
        cabinetOptions={cabinetOptions}
        electronicsSystemOptions={electronicsSystemOptions}
        contextScope={contextScope}
        relationshipText={relationshipText}
        validateAssetNo={validateAssetNo}
        disabled={profile.active === false}
        showActivation={kind === "asset"}
        showSerialReason={kind === "asset"}
        showSystemDetails={kind === "system"}
        saveHint="บันทึกการแก้ไขลงทะเบียนสถานีนี้"
        onSave={save}
        onCancel={closeEditor}
      />
    </div>;
  };
  useEffect(() => {
    if (!selectedId) return undefined;
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeEditor();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [selectedId, selectedKind]);
  const openGeneral = () => {
    setShowMoreMenu(false);
    setShowGeneral(true);
  };
  const openAddPanel = (groupId = null, initialRecordKind = "", requestedBoqGroupCode = "") => {
    const categoryToOperationGroup = {
      "wim-sorting": "wim", "wim-control": "wim", "wim-electronics": "wim", "wim-data-control": "data-control",
      "display-processing": "data-control", data: "data-control",
    };
    const isGroupSelection = profileRelationshipTree.some((group) => group.groupId === groupId);
    const relationshipGroup = profileRelationshipTree.find((group) => group.groupId === groupId)
      || (groupId ? relationshipGroupForCategory(groupId) : null);
    const categoryId = isGroupSelection ? null : groupId;
    const isRelationshipCategory = Boolean(categoryId && relationshipGroup?.categories.some((category) => category.id === categoryId));
    const normalizedGroupId = categoryToOperationGroup[categoryId] || categoryId;
    const nextGroupId = typeof normalizedGroupId === "string" && SC_OPERATION_SYSTEM_GROUPS.some((group) => group.id === normalizedGroupId) ? normalizedGroupId : null;
    setAddContextGroupId(nextGroupId);
    setAddContextBoqGroupCode(String(requestedBoqGroupCode || ((isGroupSelection || isRelationshipCategory) ? relationshipGroup?.code : "") || ""));
    setAddContextCategoryId(isRelationshipCategory ? categoryId : "");
    setAddInitialRecordKind(initialRecordKind === "asset" || initialRecordKind === "system" ? initialRecordKind : "");
    if (relationshipGroup) {
      setSelectedGroupId(relationshipGroup.groupId);
      setExpandedSystemId(relationshipGroup.groupId);
      setActiveCategoryKey(relationshipGroup.categories.find((category) => category.id === categoryId)?.id || relationshipGroup.categories[0]?.id || "");
    }
    setShowAddPanel(true);
  };
  const openReadiness = (blocker) => {
    const copy = readinessBlockerCopy(blocker);
    switchTab(copy.tab === "general" ? "equipment" : copy.tab);
    if (copy.tab === "equipment") {
      if (blocker?.systemId) {
        const location = relationshipLocationForRecord(blocker.systemId, "system");
        if (location) {
          setFilter("all");
          setType("all");
          setQuery("");
          setRegisterView("installed");
          setSelectedId(blocker.systemId);
          setSelectedKind("system");
          setSelectedGroupId(location.group.groupId);
          setExpandedSystemId(location.group.groupId);
          setActiveCategoryKey(location.category.id);
        }
      } else {
        const asset = allAssetEquipment.find((item) => item.id === blocker?.assetId) || pending[0];
        if (asset) openAssetRecord(asset.id);
      }
    }
  };
  const openAssetRecord = (assetId) => {
    const asset = allAssetEquipment.find((item) => item.id === assetId);
    const location = asset ? relationshipLocationForRecord(asset.id, "asset") : null;
    if (!asset || !location) return;
    setFilter("all");
    setType("all");
    setQuery("");
    setRegisterView("installed");
    setTab("equipment");
    setSelectedId(asset.id);
    setSelectedKind("asset");
    setSelectedGroupId(location.group.groupId);
    setExpandedSystemId(location.group.groupId);
    setActiveCategoryKey(location.category.id);
  };
  const blockerGroups = Object.values((readiness.blockers || []).reduce((groups, blocker) => {
    const key = blocker.code || "UNKNOWN";
    if (!groups[key]) groups[key] = { ...blocker, count: 0 };
    groups[key].count += 1;
    return groups;
  }, {}));

  useEffect(() => {
    setTab("equipment");
    setFilter("all");
    setType("all");
    setQuery("");
    setShowGeneral(false);
    setShowMoreMenu(false);
    setShowAddPanel(false);
    setAddContextGroupId(null);
    setAddInitialRecordKind("");
    setSelectedId(null);
    setSelectedKind("asset");
    setActiveCategoryKey(profile?.stationFormat === "IMPS" ? "image-processing" : "wim-sorting");
    setExpandedSystemId(profile?.stationFormat === "IMPS" ? "IMPS-01" : "SC-01");
    setRegisterView("installed");
    const initialGroup = profile?.stationFormat === "IMPS" ? "IMPS-01" : "SC-01";
    setSelectedGroupId(initialGroup);
  }, [profile?.id]);

  useEffect(() => {
    if (!selectedId) return;
    const exists = selectedKind === "asset" ? allAssetEquipment.some((item) => item.id === selectedId) : registerableSystems.some((item) => item.id === selectedId);
    if (!exists) setSelectedId(null);
  }, [allAssetEquipment, registeredSystems, selectedId, selectedKind]);

  if (!profile) return <section className="ops-page station-profile-redesign"><Breadcrumb items={[{ label: "ทะเบียนสถานี", href: "#/stations" }, { label: "รายละเอียดสถานี" }]} /><section className="ops-panel station-profile-empty"><div className="ops-panel-toolbar"><StationSelect profiles={state.stationProfiles} value={profile?.id} onChange={setSelected} label="สถานีที่กำลังแก้ไข" includeInactive /></div><EmptyState title="ยังไม่มีสถานี" action={<Button onClick={addStation} variant="primary" icon="plus">สร้างสถานี</Button>}>สร้างสถานีแรกเพื่อเริ่มเพิ่มอุปกรณ์</EmptyState></section></section>;

  return <StationProfileEquipmentContext.Provider value={{ canonicalItems, stationEquipment: allAssetEquipment, stationSystems: profile.stationSystems || [] }}><section className="ops-page sc-station-workspace">
    <Breadcrumb items={[{ label: "ทะเบียนสถานี", href: "#/stations" }, { label: "รายการสถานี", href: "#/stations" }, { label: profile.stationName || profile.stationCode, mono: true }]} />
    <header className="sc-station-header">
      <div className="sc-station-heading"><p className="ops-eyebrow">STATION PROFILE</p><div className="sc-title-line"><span className="sc-title-icon"><Icon name="pin" pixelSize={22} /></span><div><h1>{profile.stationName || "รายละเอียดสถานี"}</h1><p><span className="ops-code">{profile.stationCode || "ยังไม่มีรหัส"}</span><span className="sc-meta-divider">|</span><span>{profile.stationFormat === "SC" ? "SC — Spot Check · รองรับ VMS" : getStationFormatDefinition(profile.stationFormat).label}</span><span className="sc-meta-divider">|</span><span>{directionLabel}</span>{profile.province && <><span className="sc-meta-divider">|</span><span>{profile.province}</span></>}</p></div></div></div>
      <div className="sc-header-actions"><button type="button" className="ops-button ops-button-secondary sc-more-menu-toggle" aria-haspopup="menu" aria-expanded={showMoreMenu} onClick={() => setShowMoreMenu((current) => !current)}><Icon name="dots" />เพิ่มเติม</button>{showMoreMenu && <div className="sc-more-menu" role="menu" aria-label="เมนูเพิ่มเติมของสถานี"><button type="button" role="menuitem" onClick={openGeneral}><Icon name="settings" /><span><strong>ข้อมูลสถานีและ Vehicle API</strong><small>รหัส ชื่อ จังหวัด ทิศทาง และการเชื่อมต่อ</small></span></button><button type="button" role="menuitem" onClick={() => { setShowMoreMenu(false); onArchiveStation(profile); }}><Icon name={profile.active === false ? "check" : "archive"} /><span><strong>{profile.active === false ? "เปิดใช้งานสถานี" : "ปิดใช้งานสถานี"}</strong><small>{profile.active === false ? "นำสถานีกลับเข้าสู่ทะเบียนใช้งาน" : "ซ่อนจากการใช้งานใหม่โดยไม่ลบข้อมูล"}</small></span></button><button type="button" role="menuitem" className="is-danger" onClick={() => { setShowMoreMenu(false); onPurgeStation(profile); }}><Icon name="delete" /><span><strong>ลบสถานีถาวร</strong><small>ใช้เมื่อแน่ใจว่าไม่ต้องเก็บข้อมูลสถานีนี้แล้ว</small></span></button></div>}<div className="sc-updated"><Icon name="calendar" pixelSize={16} /><span>บันทึกอัตโนมัติ · ข้อมูลปัจจุบัน</span></div></div>
    </header>
    <section className="sc-metrics" aria-label="สรุปข้อมูลสถานี">
      <article><span className="sc-metric-icon is-blue"><Icon name="equipment" pixelSize={22} /></span><div><strong>{activeAssetEquipment.length}</strong><span>Asset ติดตั้งจริง</span><small>อุปกรณ์จริงที่ลงทะเบียน</small></div></article>
      <article><span className="sc-metric-icon is-blue"><Icon name="system" pixelSize={22} /></span><div><strong>{relationshipSystemCount}</strong><span>System</span><small>ระบบที่แสดงในผัง · WIM {wimSystemCount} ระบบติดตั้งจริง</small></div></article>
      <article><span className="sc-metric-icon is-blue"><Icon name="lane" pixelSize={22} /></span><div><strong>{activeLanes.length}</strong><span>Lane</span><small>ช่องทางที่ใช้งาน</small></div></article>
      <article><span className="sc-metric-icon is-blue"><Icon name="checklist" pixelSize={22} /></span><div><strong>{templateTotal}</strong><span>อุปกรณ์ตามแบบ {profile.stationFormat || "SC"}</span><small>จำนวนอุปกรณ์อ้างอิง ไม่ใช่จำนวนรายการตรวจ</small></div></article>
      <article className={readiness.blockers.length || readiness.warnings?.length ? "is-warning" : "is-ready"}><span className="sc-metric-icon is-warning"><Icon name="alert" pixelSize={22} /></span><div><strong>{readiness.blockers.length}</strong><span>รายการบล็อก</span><small>คำเตือนข้อมูล {readiness.warnings?.length || 0} รายการ</small></div></article>
    </section>
    <section className={`sc-readiness ${readiness.blockers.length ? "has-blockers" : readiness.warnings?.length ? "has-warnings" : confirmedReady ? "is-ready" : "is-unconfirmed"}`} aria-labelledby="sc-readiness-title">
      <div className="sc-readiness-icon"><Icon name={confirmedReady && !readiness.blockers.length && !readiness.warnings?.length ? "check" : "alert"} pixelSize={24} /></div><div className="sc-readiness-copy"><p className="ops-eyebrow">READINESS CHECK</p><h2 id="sc-readiness-title">{confirmedReady && !readiness.blockers.length && !readiness.warnings?.length ? "สถานีพร้อมสร้างรอบตรวจ" : readiness.warnings?.length && !readiness.blockers.length ? "พร้อมสร้างรอบตรวจ แต่มีคำเตือน" : "ความพร้อมก่อนสร้างรอบตรวจ"}</h2><p>{readiness.blockers.length ? `พบรายการที่บล็อกการสร้างรอบ ${readiness.blockers.length} รายการ กรุณาตรวจสอบและดำเนินการ` : readiness.warnings?.length ? `มีคำเตือนข้อมูล ${readiness.warnings.length} รายการ ซึ่งไม่บล็อกการสร้างรอบใหม่ แต่ควรตรวจสอบก่อนเริ่มงาน` : confirmedReady ? "ข้อมูลทะเบียนพร้อมใช้สำหรับรอบใหม่ และประวัติเดิมจะไม่ถูกเปลี่ยน" : "ตรวจข้อมูลให้ครบ แล้วกดยืนยันความพร้อมก่อนสร้างรอบตรวจ"}</p></div><div className="sc-readiness-actions">{readiness.blockers.length ? <button type="button" className="ops-button ops-button-secondary" onClick={() => openReadiness(readiness.blockers[0])}>ดูรายการที่ต้องแก้ <Icon name="arrow" /></button> : !confirmedReady && <button type="button" className="ops-button ops-button-primary" onClick={() => updateProfile("readinessConfirmedAt", new Date().toISOString())}>ยืนยันความพร้อม</button>}</div>
      {blockerGroups.length > 0 && <div className="sc-readiness-reasons">{blockerGroups.map((blocker) => { const copy = readinessBlockerCopy(blocker); return <button type="button" key={blocker.code} onClick={() => openReadiness(blocker)}><span><Icon name="alert" size="small" /><strong>{copy.label}</strong><small>{blocker.count > 1 ? `${blocker.count} รายการ · ` : ""}{blocker.message}</small></span><Icon name="arrow" size="small" /></button>; })}</div>}
      {readiness.warnings?.length > 0 && <details className="sc-readiness-warnings"><summary>คำเตือนข้อมูล {readiness.warnings.length} รายการ</summary><ul>{readiness.warnings.map((warning, index) => {
        const asset = allAssetEquipment.find((entry) => entry.id === warning.assetId);
        const description = warning.missingFields?.length ? `ขาดข้อมูล: ${warning.missingFields.join(" · ")}` : warning.message || warning.label || String(warning);
        return <li key={`${warning.code || "warning"}-${warning.assetId || index}`}><span><strong>{asset ? `${asset.assetNo || "ไม่มี Asset No."} · ${getScAssetTypeDisplayName(asset)}` : warning.label || "คำเตือนข้อมูล"}</strong><small>{description}</small></span>{asset && <button type="button" className="sc-warning-edit" onClick={() => openAssetRecord(asset.id)}>เปิดอุปกรณ์</button>}</li>;
      })}</ul></details>}
    </section>
    <section className="station-profile-workspace-context" aria-live="polite" aria-label="Workspace ปัจจุบัน">
      <div className="station-profile-workspace-context-copy"><p className="ops-eyebrow">CURRENT WORKSPACE</p><span className="station-profile-workspace-breadcrumb" aria-label="ตำแหน่งปัจจุบัน">{profile.stationCode || profile.stationName || "สถานี"} › {selectedGroup?.groupId || "หมวดสถานี"} › Equipment</span><strong>{selectedGroup ? `${selectedGroup.groupId} · ${selectedGroup.label}` : "เลือกหมวดสถานี"}</strong><span>{selectedGroup?.description || "เลือกหมวดเพื่อดูระบบและอุปกรณ์ที่เกี่ยวข้อง"}</span></div>
      <div className="station-profile-workspace-context-meta"><span>สถานี {profile.stationCode || "—"}</span><span>{(selectedGroup?.systemCount || 0) + (selectedGroup?.assetCount || 0)} รายการจริง</span><span className={`station-category-status is-${selectedGroup?.hasData ? "ready" : "empty"}`}>{selectedGroup?.hasData ? "มีรายการจริง" : "ยังไม่มีรายการ"}</span></div>
    </section>
    <nav className="sc-tabs" aria-label="ข้อมูลสถานี">
      {[{ id: "equipment", label: "ระบบและอุปกรณ์", icon: "system" }, { id: "lane", label: "ข้อมูล Lane", icon: "lane" }, { id: "checklist", label: "รายการตรวจสอบ (Checklist)", icon: "checklist" }, { id: "snapshot", label: "ประวัติ/ภาพถ่าย (Snapshot)", icon: "archive" }].map(({ id, label, icon }) => <button type="button" key={id} className={tab === id ? "is-active" : ""} aria-selected={tab === id} onClick={() => switchTab(id)}><Icon name={icon} pixelSize={18} /><span>{label}</span></button>)}
    </nav>
    {tab === "equipment" && <div className="sc-workspace">
      <ScWizardSystemRail groups={visibleOperationalGroups} selectedGroupId={selectedGroup?.id} onSelectGroup={(id) => { const nextGroup = profileRelationshipTree.find((group) => group.groupId === id); setSelectedGroupId(id); setActiveCategoryKey(nextGroup?.categories[0]?.id || (id === "unmapped" ? "unmapped" : "")); setExpandedSystemId(id); setSelectedId(null); }} registerView={registerView} onRegisterViewChange={(view) => { setRegisterView(view); setSelectedId(null); }} groupAttentionCount={groupAttentionCount} />
      <section className="sc-register" aria-labelledby="sc-equipment-title">
         <div className="sc-register-heading"><div><p className="ops-eyebrow">ทะเบียนติดตั้งจริง · STATION PROFILE</p><h2 id="sc-equipment-title">อุปกรณ์ประจำสถานี</h2><p>จัดการระบบและอุปกรณ์ที่ติดตั้งจริงตามหมวด Work Spec การแก้ไขมีผลกับรอบตรวจใหม่ ส่วน Snapshot เดิมคงข้อมูลตามวันที่ตรวจ</p></div><div className="sc-register-heading-actions"><span className="sc-register-total"><strong>{activeAssetEquipment.length + registerableSystems.length}</strong><small>ติดตั้งจริง</small></span><Button onClick={() => openAddPanel(selectedGroup?.id || null, "")} variant="primary" icon="plus" disabled={profile.active === false}>เพิ่มรายการ</Button></div></div>
        <div className="sc-register-view-note"><span className="sc-view-dot" />{registerView === "installed" ? "แสดงเฉพาะหมวดที่มีระบบหรืออุปกรณ์จริงติดตั้ง" : "แสดงตามแม่แบบ พร้อมยอดติดตั้งจริงเทียบกับที่ควรมี"}</div>
        <div className="sc-register-toolbar"><label className="sc-search"><Icon name="search" /><span className="sr-only">ค้นหาระบบหรืออุปกรณ์</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่อระบบ อุปกรณ์ หรือรหัส Asset No." /></label><div className="sc-filter-chips" role="group" aria-label="กรองสถานะอุปกรณ์">{[{ id: "all", label: "ทั้งหมด" }, { id: "pending", label: "ต้องแก้ไข", count: pending.length }, { id: "inactive", label: "ปิดใช้งาน" }].map((option) => <button type="button" key={option.id} className={filter === option.id ? "is-active" : ""} onClick={() => setFilter(option.id)}>{option.label}{option.count !== undefined ? ` ${option.count}` : ""}</button>)}</div><label className="sc-type-filter"><span className="sr-only">กรองประเภทอุปกรณ์</span><CustomSelect label="กรองประเภทอุปกรณ์" value={type} onChange={(event) => setType(event.target.value)}><option value="all">ทุกประเภท</option>{typeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CustomSelect></label></div>
        <p className="sc-result-note">แสดง {relationshipTree.reduce((total, group) => total + group.systemCount, 0)} System · {relationshipTree.reduce((total, group) => total + group.assetCount, 0)} Asset ตามผังความสัมพันธ์ · WIM Sorting System ติดตั้งจริง {wimSystemCount} ระบบ{legacyLaneCount ? ` · มีข้อมูล Lane เดิม ${legacyLaneCount} รายการ (ดูแท็บข้อมูล Lane)` : ""}</p>
        <StationRelationshipRegister tree={relationshipTree} expandedGroupId={expandedSystemId} onToggleGroup={(id) => { const nextGroup = profileRelationshipTree.find((group) => group.groupId === id); setSelectedGroupId(id); setActiveCategoryKey(nextGroup?.categories[0]?.id || ""); setExpandedSystemId((current) => current === id ? "" : id); }} onAdd={openAddPanel} selectedId={selectedId} selectedKind={selectedKind} editingId={selectedId} editingKind={selectedKind} renderInlineEditor={renderProfileWorkSpecEditor} onSelect={selectItem} onDelete={(record, kind) => kind === "asset" ? removeEquipment?.(record) : removeCanonicalSystem?.(record.id)} activeLanes={activeLanes} stationSystems={profile.stationSystems} systemDefinitionsById={systemDefinitionsById} showMissingRows={registerView === "template"} activeCategoryKey={activeCategoryKey} getSystemDisplayLabel={getStationSystemDisplayLabel} getAssetDisplayLabel={getScAssetTypeDisplayName} isWimEquipment={isWimEquipment} getWimSortingSystemById={getWimSortingSystemById} isWimSortingSystemRecord={isWimSortingSystemRecord} isScAssetDataComplete={isScAssetDataComplete} assetStatusFor={assetRegisterStatus} systemStatusFor={systemRegisterStatus} getRelationshipPath={getRelationshipPath} />
      </section>
    </div>}
    {tab === "lane" && <section className="sc-resource-panel"><div className="sc-panel-heading"><span className="sc-panel-icon"><Icon name="lane" pixelSize={22} /></span><div><p className="ops-eyebrow">LANE TOPOLOGY</p><h2>ข้อมูล Lane</h2><p>Lane เป็นโครงสร้างช่องทาง แยกจาก Asset และ WIM Sorting System ใช้ผูกกับ Sensor / Loop เฉพาะ WIM</p></div></div><div className="sc-lane-note"><Icon name="info" pixelSize={18} /><span>ข้อมูล Lane เดิม {legacyLaneCount} รายการถ้ามี จะไม่ถูกรวมในตาราง Asset</span></div><LaneAssignmentStep stationFormat={profile.stationFormat} lanes={profile.lanes} equipment={activeAssetEquipment} stationSystems={profile.stationSystems} disabled={profile.active === false} showHeading={false} onChangeLanes={updateStationLanes} onAssignLane={assignStationLane} onAssignParentSystem={assignWimParentSystem} onAddLane={addStationLane} onRemoveLane={removeStationLane} /></section>}
    {tab === "checklist" && <section className="sc-resource-panel"><div className="sc-panel-heading"><span className="sc-panel-icon"><Icon name="checklist" pixelSize={22} /></span><div><p className="ops-eyebrow">CHECKLIST COVERAGE</p><h2>รายการตรวจสอบ (Checklist)</h2><p>ชื่อหมวดอ้างอิงจาก Checklist Copy และค่าเปิด/ปิดมีผลกับรอบใหม่เท่านั้น</p></div></div><EquipmentChecklistCoverage equipment={activeAssetEquipment} items={masterConfigItems} displaySections={masterConfigSections} stationFormat={profile.stationFormat} onSelectAsset={(asset) => openAssetRecord(asset.id)} /><div className="ops-config-list sc-checklist-list">{masterConfigSections.map((section, sectionIndex) => <details className="ops-config-section" key={section.code} open={sectionIndex === 0}><summary><span className="ops-config-section-code">{section.code}</span><span className="ops-config-section-title">{section.title}</span><small>{section.items.filter((item) => !isMasterConfigDisabled(item)).length}/{section.items.length} รายการ</small></summary><div className="ops-config-items">{section.items.map((item) => { const disabled = isMasterConfigDisabled(item); return <div className={`ops-config-item ${disabled ? "is-disabled" : ""}`} key={item.id}><div><strong>{item.label}</strong><span>{item.unit || "ข้อมูล"} · {disabled ? "ปิดใช้งานสำหรับสถานีนี้" : "ใช้เป็นกติกาของรอบการตรวจใหม่"}</span></div><button type="button" className={`ops-config-toggle ${disabled ? "is-disabled" : "is-enabled"}`} aria-pressed={!disabled} onClick={() => toggleChecklist(item.id, disabled)}><Icon name={disabled ? "close" : "check"} /><span>{disabled ? "ปิด" : "เปิด"}</span></button></div>; })}</div></details>)}</div></section>}
    {tab === "snapshot" && <section className="sc-resource-panel"><div className="sc-panel-heading"><span className="sc-panel-icon"><Icon name="archive" pixelSize={22} /></span><div><p className="ops-eyebrow">READ-ONLY HISTORY</p><h2>ประวัติ/ภาพถ่าย (Snapshot)</h2><p>Snapshot เป็นข้อมูลประจำรอบแบบอ่านอย่างเดียว ไม่ถูกเขียนทับจากการแก้ทะเบียนปัจจุบัน</p></div></div>{closedRounds.length ? <div className="sc-snapshot-list">{closedRounds.map((round) => <a className="sc-snapshot-card" key={round.id} href={`#/history/${encodeURIComponent(round.id)}`}><span className="sc-snapshot-card-icon"><Icon name="archive" pixelSize={20} /></span><span><strong>{round.name || round.title || `รอบตรวจ ${formatDateTime(round.startedAt || round.createdAt)}`}</strong><small>{formatDateTime(round.closedAt || round.updatedAt || round.createdAt)} · Snapshot {round.snapshot?.equipment?.length || 0} Asset · {round.snapshot?.attachments ? "มีไฟล์แนบ" : "ไม่มีไฟล์แนบ"}</small></span><Icon name="arrow" /></a>)}</div> : <EmptyState icon="archive" title="ยังไม่มีประวัติที่ปิดรอบ">เมื่อปิดรอบตรวจแล้ว Snapshot และภาพถ่ายจะแสดงที่นี่</EmptyState>}</section>}
    <details ref={generalRef} className="sc-general-panel" open={showGeneral} onToggle={(event) => setShowGeneral(event.currentTarget.open)}><summary><span><Icon name="settings" /><strong>ข้อมูลสถานีและการตั้งค่าขั้นสูง</strong><small>รหัส ชื่อ จังหวัด ทิศทาง รูปแบบสถานี และ Vehicle API</small></span><span className="sc-general-count">{showGeneral ? "ปิดแผง" : "เปิดจากเมนูเพิ่มเติม"}</span></summary><div className="sc-general-body"><div className="ops-form-grid"><StationSelect profiles={state.stationProfiles} value={profile.id} onChange={setSelected} label="สถานีที่กำลังแก้ไข" includeInactive /><label className="ops-field"><span>รหัสสถานี</span><input value={profile.stationCode || ""} disabled={profile.active === false} onChange={(event) => updateProfile("stationCode", event.target.value)} /></label><label className="ops-field ops-field-wide"><span>ชื่อสถานี</span><input value={profile.stationName || ""} disabled={profile.active === false} onChange={(event) => updateProfile("stationName", event.target.value)} /></label><label className="ops-field"><span>รูปแบบสถานี</span><input value={getStationFormatDefinition(profile.stationFormat).label} readOnly /></label><div className="ops-field"><MasterSelect kind="province" referenceData={state.referenceData} value={profile.provinceId || ""} disabled={profile.active === false} label="จังหวัด" onChange={(event) => { const province = (state.referenceData?.provinces || []).find((entry) => entry.id === event.target.value); updateProfile("provinceId", event.target.value); updateProfile("province", province?.name || ""); }} /></div><label className="ops-field"><span>ทิศทาง</span><CustomSelect label="ทิศทาง" value={profile.direction || "unspecified"} disabled={profile.active === false} onChange={(event) => updateProfile("direction", event.target.value)}><option value="unspecified">ไม่ระบุ</option><option value="inbound">ขาเข้า</option><option value="outbound">ขาออก</option><option value="both">ทั้งสองทิศทาง</option></CustomSelect></label></div><details className="sc-general-advanced"><summary>Vehicle API</summary><VehicleSearchConfigPanel value={profile.vehicleSearchConfig} stationId={profile.id} disabled={profile.active === false} onChange={(value) => updateProfile("vehicleSearchConfig", value)} notify={notify} /></details><p className="ops-info-banner"><Icon name="info" />การแก้ทะเบียนมีผลกับรอบการตรวจใหม่เท่านั้น ข้อมูลประจำรอบ Snapshot และประวัติเดิมจะไม่เปลี่ยน</p></div></details>
    {showAddPanel && <EquipmentQuickAddPanel catalog={itemCatalog} canonicalItems={currentCanonicalItems} stationFormat={profile.stationFormat} stationSystems={profile.stationSystems} stationEquipment={allAssetEquipment} initialGroupId={addContextGroupId} initialBoqGroupCode={addContextBoqGroupCode} initialCategoryId={addContextCategoryId} initialRecordKind={addInitialRecordKind} activeLanes={activeLanes} disabled={profile.active === false} open={showAddPanel} onClose={() => { setShowAddPanel(false); setAddContextGroupId(null); setAddContextBoqGroupCode(""); setAddContextCategoryId(""); setAddInitialRecordKind(""); }} onAdd={addCatalogEquipment} onAddSystem={addCanonicalSystem} />}
  </section></StationProfileEquipmentContext.Provider>;
}

function equipmentScopeChoices(type) {
  if (type === "CONTROL_CABINET" || isWimElectronicsSubEquipmentType(type)) return [];
  if (["VMS_SIGN", "VMS_LIGHT_SENSOR", "VMS_DISPLAY"].includes(type)) return ["High Speed", "Low Speed"];
  if (type === "LPR_CAMERA") return ["High Speed", "Low Speed", "3D", "ImPS"];
  if (["FIXED_CAMERA", "PTZ_CAMERA", "NVR", "JOYSTICK"].includes(type)) return ["High Speed", "Low Speed", "Image Processing", "ImPS"];
  if (["WIM_SENSOR", "WIM_LOOP", "CONTROL_COMPUTER", "CONTROL_CABINET", "LASER_SCANNER", "DIMENSION_CONTROLLER", "IMAGE_PROCESSOR"].includes(type)) return ["High Speed", "Low Speed", "3D", "ImPS", "Image Processing"];
  return [];
}

function EquipmentRow({ equipment, isReferenced, stationSystems = [], canonicalItems = [], disabled = false, onChange, onRemove }) {
  const stationProfileContext = useContext(StationProfileEquipmentContext);
  stationSystems = stationSystems.length ? stationSystems : stationProfileContext.stationSystems;
  canonicalItems = canonicalItems.length ? canonicalItems : stationProfileContext.canonicalItems;
  const isWim = isWimEquipment(equipment);
  const definition = canonicalItems.find((item) => item.kind === "asset" && item.equipmentType === equipment.type);
  const ownerIds = definition?.systemIds || [];
  const ownerSystemKey = (system) => String(system?.canonicalItemId || (system?.systemId === "wim" && system?.componentId === "electronics" ? "wim-electronics-system" : system?.systemId || ""));
  const ownerSystemOptions = stationSystems.filter((system) => system.active !== false && Number(system.quantity ?? 1) > 0 && ownerIds.includes(ownerSystemKey(system)));
  const ownerSystem = ownerSystemOptions.find((system) => system.id === equipment.parentSystemId);
  const inheritsScope = ownerIds.length > 0;
  const assignOwnerSystem = (systemId) => {
    const parent = ownerSystemOptions.find((system) => system.id === systemId);
    onChange(equipment.id, "parentSystemId", parent?.id || null);
    onChange(equipment.id, "scope", parent?.scope || "");
  };
  const serialStatus = equipment.serialStatus || "unknown";
  const serialInputValue = serialStatus === "present" ? equipment.serialNo : serialStatus === "not-available" ? equipment.serialReason || "" : "";
  const serialInputLabel = serialStatus === "not-available" ? `เหตุผลที่ไม่มี Serial ของ ${equipment.assetNo}` : `Serial Number ของ ${equipment.assetNo}`;
  const serialInputPlaceholder = serialStatus === "not-available" ? "เหตุผลที่ไม่มี Serial" : serialStatus === "unknown" ? "เลือกสถานะก่อนกรอก" : "Serial Number";
  return <article className={`ops-equipment-row ops-equipment-split ${equipment.active === false ? "is-inactive" : ""}`}>
    <div className="ops-equipment-identity">
      <span className="ops-equipment-icon"><Icon name={getEquipmentIconName(equipment.type)} /></span>
      <div className="ops-equipment-identity-copy">
        <strong>{getEquipmentDisplayLabel(equipment)}</strong>
        <span>{equipment.type === "CUSTOM" ? "อุปกรณ์กำหนดเอง (Custom) · มีรายการตรวจทั่วไป แต่ยังไม่มีรายการตรวจเฉพาะ" : `${equipment.categoryCode || getEquipmentCategoryCode(equipment)} · ${isReferenced ? "มี Snapshot อ้างอิงแล้ว" : "ยังไม่ถูกอ้างอิงในรอบตรวจ"}${isWim && equipment.laneId ? ` · ผูก Lane แล้ว` : isWim ? " · ยังไม่ผูก Lane" : ""}`}</span>
        <StatusBadge status={equipment.active === false ? "inactive" : "normal"}>{equipment.active === false ? "ปิดใช้งาน" : "ใช้งาน"}</StatusBadge>
      </div>
    </div>
    <div className="ops-equipment-control">
      <div className="ops-equipment-fields">
        <label className="ops-field ops-code-field"><span>รหัสอุปกรณ์ (Asset No.)</span><input value={equipment.assetNo} disabled={disabled} onChange={(event) => onChange(equipment.id, "assetNo", event.target.value)} /></label>
        <label className="ops-field"><span>ตำแหน่งติดตั้ง</span><input value={equipment.location} disabled={disabled} onChange={(event) => onChange(equipment.id, "location", event.target.value)} /></label>
        {inheritsScope && ownerSystemOptions.length > 0 && (!equipment.parentSystemId || ownerSystemOptions.length > 1) && <label className="ops-field"><span>System แม่</span><CustomSelect label={`System แม่ของ ${equipment.assetNo || equipment.type}`} value={ownerSystem?.id || ""} disabled={disabled} onChange={(event) => assignOwnerSystem(event.target.value)}><option value="">เลือกระบบแม่</option>{ownerSystemOptions.map((system) => <option key={system.id} value={system.id}>{system.displayLabel || system.nameEn || system.canonicalItemId} · {system.scope || "ไม่ระบุ Scope"}</option>)}</CustomSelect></label>}
        {inheritsScope && ownerSystemOptions.length === 0 && <div className="sc-readonly-field"><span>System แม่</span><strong>ยังไม่มีระบบแม่ที่ตรงกับอุปกรณ์</strong></div>}
        {inheritsScope && <div className="sc-readonly-field"><span>Scope</span><strong>{ownerSystem?.scope || (equipment.parentSystemId ? equipment.scope || "ยังไม่ระบุ" : "เลือก System แม่เพื่อกำหนด Scope")}</strong><small>กำหนดตาม System แม่</small></div>}
        {!inheritsScope && equipmentScopeChoices(equipment.type).length > 0 && <label className="ops-field"><span>ชุดระบบที่สังกัด</span><CustomSelect label={`ชุดระบบของ ${equipment.assetNo || equipment.type}`} value={equipment.scope || ""} disabled={disabled} onChange={(event) => onChange(equipment.id, "scope", event.target.value)}><option value="">ยังไม่ระบุ</option>{equipmentScopeChoices(equipment.type).map((scope) => <option key={scope} value={scope}>{scope}</option>)}</CustomSelect></label>}
        <fieldset className="ops-serial-fieldset ops-serial-inline">
          <legend>Serial Number</legend>
          <div className="ops-serial-control">
            <div className="ops-serial-options ops-serial-segmented" role="radiogroup" aria-label={`สถานะ Serial Number ของ ${equipment.assetNo}`}>
              <label className={serialStatus === "present" ? "is-selected" : ""}><input type="radio" name={`profile-serial-status-${equipment.id}`} checked={serialStatus === "present"} disabled={disabled} onChange={() => onChange(equipment.id, "serialStatus", "present")} /><span>มี</span></label>
              <label className={serialStatus === "not-available" ? "is-selected" : ""}><input type="radio" name={`profile-serial-status-${equipment.id}`} checked={serialStatus === "not-available"} disabled={disabled} onChange={() => onChange(equipment.id, "serialStatus", "not-available")} /><span>ไม่มี / อ่านไม่ได้</span></label>
              <label className={serialStatus === "unknown" ? "is-selected" : ""}><input type="radio" name={`profile-serial-status-${equipment.id}`} checked={serialStatus === "unknown"} disabled={disabled} onChange={() => onChange(equipment.id, "serialStatus", "unknown")} /><span>ยังไม่ระบุ</span></label>
            </div>
            <input className="ops-serial-value" value={serialInputValue} disabled={disabled || serialStatus === "unknown"} onChange={(event) => onChange(equipment.id, serialStatus === "not-available" ? "serialReason" : "serialNo", event.target.value)} placeholder={serialInputPlaceholder} aria-label={serialInputLabel} />
          </div>
          {serialStatus === "unknown" && <small className="ops-field-warning">ยังไม่ระบุสถานะ</small>}
        </fieldset>
      </div>
    </div>
    <div className="ops-equipment-actions"><Button onClick={() => onChange(equipment.id, "active", equipment.active === false)} variant="ghost" icon={equipment.active === false ? "check" : "close"} disabled={disabled}>{equipment.active === false ? "เปิดใช้งาน" : "ปิดใช้งาน"}</Button><Button onClick={() => onRemove(equipment)} variant="danger-ghost" icon="delete" disabled={disabled || isReferenced}>ลบอุปกรณ์</Button></div>
  </article>;
}

function Stepper({ current = 1 }) {
  return <ol className="ops-stepper" aria-label="ขั้นตอนสร้างรอบการตรวจ"><li className={current >= 1 ? "is-current" : ""}><span>1</span><div><strong>เลือกสถานี</strong><small>ยืนยันทะเบียน</small></div></li><li className={current >= 2 ? "is-current" : ""}><span>2</span><div><strong>สร้างข้อมูลประจำรอบ</strong><small>บันทึกอุปกรณ์ในรอบการตรวจ</small></div></li><li className={current >= 3 ? "is-current" : ""}><span>3</span><div><strong>เริ่มตรวจ</strong><small>กรอกผลหน้างาน</small></div></li></ol>;
}


function RoundCard({ state, round, onDelete }) {
  const profile = profileFor(state, round.stationId);
  const summary = getRoundSummary(round);
  const correction = getCorrectionSummary(round);
  const contractContext = getContractContextForRound(round, state);
  const closed = round.status === "closed";
  const stationCode = closed ? round.snapshot?.stationCode : (profile?.stationCode || round.snapshot?.stationCode);
  return <article className="ops-round-card"><div className="ops-round-copy"><div className="ops-round-meta"><span className="ops-round-code">{stationCode} · รอบการตรวจ {shortId(round.id)}</span><StatusBadge status={closed ? "closed" : "draft"}>{closed ? "ปิดรอบการตรวจแล้ว" : "อยู่ระหว่างกรอกข้อมูล"}</StatusBadge></div><h3>{round.meta.projectName || round.snapshot?.stationName}</h3><p className="ops-round-contract-context">{contractContext ? `${contractContext.contractNo || "สัญญา"} · งวด ${contractContext.reportSequence || contractContext.workPackageNo || "—"} · ${contractContext.regionNames?.join(" · ") || "ไม่ระบุภาค"}` : "ยังไม่ผูกสัญญา · ตรวจหน้างาน"}</p><p>วันที่ตรวจ {round.meta.inspectionDate ? formatDate(round.meta.inspectionDate) : formatDate(round.createdAt)} · อุปกรณ์จริงในข้อมูลประจำรอบ {round.snapshot?.equipment?.length || 0} รายการ{round.revisionNumber ? ` · ฉบับแก้ไขครั้งที่ ${round.revisionNumber}` : correction.count ? ` · แก้ไขย้อนหลัง ${correction.count} ครั้ง` : ""}</p></div><div className="ops-round-progress"><strong>{summary.progress}%</strong><span>ตรวจแล้ว {summary.done}/{summary.total} รายการ</span><span>หลักฐานครบ {summary.evidenceComplete}/{summary.evidenceTotal} ช่อง</span></div><div className="ops-round-actions"><Button href={closed ? `#/history/${encodeURIComponent(round.id)}` : `#/inspections/${encodeURIComponent(round.id)}`} variant="secondary" icon="arrow">{closed ? "เปิดประวัติ" : "เปิดรายการตรวจ"}</Button>{closed ? <><Button href={`#/history/${encodeURIComponent(round.id)}/revise`} variant="ghost" icon="edit">จัดทำฉบับแก้ไข</Button>{onDelete && <Button onClick={() => onDelete(round)} variant="danger-ghost" icon="delete" className="ops-round-delete">ลบประวัติ</Button>}</> : onDelete && <Button onClick={() => onDelete(round)} variant="danger-ghost" icon="delete" className="ops-round-delete">ลบรอบการตรวจ</Button>}</div></article>;
}


function ReportMetadataFields({ meta, onChange }) {
  return <>
    <label className="ops-field"><span>เลขที่เอกสาร</span><input value={meta?.documentNo || ""} onChange={(event) => onChange("documentNo", event.target.value)} placeholder="เช่น MA-2026-001" /></label>
    <label className="ops-field"><span>ผู้จัดทำรายงาน</span><input value={meta?.preparedBy || ""} onChange={(event) => onChange("preparedBy", event.target.value)} placeholder="ชื่อผู้จัดทำรายงาน" /></label>
    <label className="ops-field"><span>ผู้มีอำนาจลงนาม</span><input value={meta?.approvedBy || ""} onChange={(event) => onChange("approvedBy", event.target.value)} placeholder="ชื่อผู้มีอำนาจลงนาม (ถ้ามี)" /></label>
    <label className="ops-field"><span>วันที่ลงนาม</span><ThaiDatePicker value={meta?.approvalDate || ""} label="วันที่ลงนาม" onChange={(nextValue) => onChange("approvalDate", nextValue)} /></label>
    <p className="ops-field-helper ops-field-wide"><strong>ข้อมูลลงนามรายงาน:</strong> ข้อมูลส่วนนี้ใช้ประกอบการลงนามในรายงานเท่านั้น ไม่ใช่ขั้นตอนการอนุมัติของระบบ</p>
  </>;
}


function getItemStatusCounts(items, round) {
  const counts = Object.fromEntries(STATUS_OPTIONS.map((option) => [option.value, 0]));
  (items || []).forEach((item) => {
    const value = round?.inspectionItems?.[item.id];
    const status = item.applicable === false ? "na" : value?.status || "pending";
    counts[status] = (counts[status] || 0) + 1;
  });
  return counts;
}

function StatusOverview({ items, round, status, setStatus }) {
  const summary = getRoundSummary(round);
  const counts = getItemStatusCounts(items, round);
  const toggleStatus = (nextStatus) => setStatus(status === nextStatus ? "all" : nextStatus);
  return <section className="ops-status-overview" aria-labelledby="quick-status-title">
    <div className="ops-status-overview-heading">
      <div><p className="ops-eyebrow">QUICK STATUS</p><h3 id="quick-status-title">ภาพรวมการตรวจ</h3></div>
      <span className="ops-status-overview-progress"><strong>บันทึกสถานะ {summary.done}/{summary.total}</strong> รายการ</span>
    </div>
    <div className="ops-status-overview-grid" role="group" aria-label="กรองตามสถานะการตรวจ">
      {STATUS_OPTIONS.map((option) => {
        const meta = STATUS_META[option.value];
        const label = getStatusDisplayLabel(option.value, option.label);
        return <button type="button" key={option.value} className={`ops-status-overview-button status-${meta.tone} ${status === option.value ? "is-active" : ""}`} aria-pressed={status === option.value} title={`กรอง ${label}`} onClick={() => toggleStatus(option.value)}>
          <span className="ops-status-overview-icon"><Icon name={meta.icon} /></span><strong>{counts[option.value] || 0}</strong><span>{label}</span>
        </button>;
      })}
    </div>
  </section>;
}

function attachmentAccept(fieldType = "photo") {
  if (fieldType === "video") return "video/*";
  if (fieldType === "document") return "image/*,video/*,application/pdf,text/plain";
  return "image/*";
}

function AttachmentPicker({ id, label, accept, allowCamera = false, hasAttachment = false, variant = "default", dropLabel, dropHint, compactLabel, onFile }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectionNotice, setSelectionNotice] = useState("");
  const galleryInputId = `${id}-gallery`;
  const cameraInputId = `${id}-camera`;
  const isWorkspace = variant === "workspace";
  const isCompact = variant === "compact";
  const resolvedDropLabel = dropLabel || (isWorkspace ? "ลากรูปมาวางที่นี่" : hasAttachment ? `เปลี่ยน${label}` : `เลือก${label}จากเครื่อง`);
  const resolvedDropHint = dropHint || (isWorkspace ? "หรือคลิกเลือกจากเครื่อง" : "คลิกเพื่อเลือกจากเครื่อง หรือลากไฟล์มาวางที่นี่");
  const openPicker = (inputId) => document.getElementById(inputId)?.click();
  const pickFiles = (fileList) => {
    const files = Array.from(fileList || []);
    const file = files[0];
    if (!file) return;
    setSelectionNotice(files.length > 1 ? "ช่องนี้รองรับไฟล์เดียว ระบบจะใช้ไฟล์แรก" : "");
    onFile(file);
  };
  const handleDragEnter = (event) => {
    event.preventDefault();
    setIsDragOver(true);
  };
  const handleDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  };
  const handleDragLeave = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setIsDragOver(false);
  };
  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragOver(false);
    pickFiles(event.dataTransfer?.files);
  };
  if (isCompact) return <div className="ops-attachment-picker is-compact">
    <label className="ops-button ops-button-secondary ops-attachment-compact-action" htmlFor={galleryInputId}>
      <Icon name="refresh" size="small" /><span>{compactLabel || `เปลี่ยน${label}`}</span>
      <input id={galleryInputId} className="ops-attachment-input" type="file" accept={accept} aria-label={`เปลี่ยน${label}จากเครื่อง`} onChange={(event) => { pickFiles(event.target.files); event.target.value = ""; }} />
    </label>
    {allowCamera && <label className="ops-button ops-button-secondary ops-attachment-compact-action" htmlFor={cameraInputId}>
      <Icon name="camera" size="small" /><span>ถ่ายรูปใหม่</span>
      <input id={cameraInputId} className="ops-attachment-input" type="file" accept="image/*" capture="environment" aria-label={`ถ่ายรูปใหม่สำหรับ${label}`} onChange={(event) => { pickFiles(event.target.files); event.target.value = ""; }} />
    </label>}
    {selectionNotice && <span className="ops-attachment-picker-status" role="status" aria-live="polite">{selectionNotice}</span>}
  </div>;
  return <div className={`ops-attachment-picker ${isWorkspace ? "is-workspace" : ""} ${isDragOver ? "is-drag-over" : ""}`} onDragEnter={handleDragEnter} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
    <label className="ops-attachment-dropzone" htmlFor={galleryInputId}>
      <span className="ops-attachment-dropzone-icon"><Icon name={allowCamera ? "camera" : "clipboard"} /></span>
      <span className="ops-attachment-dropzone-copy"><strong>{resolvedDropLabel}</strong><small>{resolvedDropHint}</small></span>
      <input id={galleryInputId} className="ops-attachment-input" type="file" accept={accept} aria-label={`${hasAttachment ? "เปลี่ยน" : "เลือก"}${label}จากเครื่อง`} onChange={(event) => { pickFiles(event.target.files); event.target.value = ""; }} />
    </label>
    {isWorkspace ? <>
      <div className="ops-attachment-picker-actions">
        <button type="button" className="ops-button ops-button-secondary ops-attachment-picker-select" onClick={() => openPicker(galleryInputId)}><Icon name="archive" /><span>เลือกจากเครื่อง</span></button>
        {allowCamera && <button type="button" className="ops-button ops-button-primary ops-attachment-camera" onClick={() => openPicker(cameraInputId)}><Icon name="camera" /><span>ถ่ายรูปใหม่</span></button>}
      </div>
      {allowCamera && <input id={cameraInputId} className="ops-attachment-input is-programmatic" type="file" accept="image/*" capture="environment" tabIndex="-1" aria-hidden="true" aria-label={`ถ่ายรูปใหม่สำหรับ${label}`} onChange={(event) => { pickFiles(event.target.files); event.target.value = ""; }} />}
    </> : allowCamera && <label className="ops-button ops-button-secondary ops-attachment-camera" htmlFor={cameraInputId}><Icon name="camera" /><span>ถ่ายรูปใหม่</span><input id={cameraInputId} className="ops-attachment-input" type="file" accept="image/*" capture="environment" aria-label={`ถ่ายรูปใหม่สำหรับ${label}`} onChange={(event) => { pickFiles(event.target.files); event.target.value = ""; }} /></label>}
    {(isDragOver || selectionNotice) && <span className="ops-attachment-picker-status" role="status" aria-live="polite">{isDragOver ? "ปล่อยไฟล์ที่นี่" : selectionNotice}</span>}
  </div>;
}

function AttachmentPreview({ attachment, label, readOnly, onRemove, statusText, statusComplete = false }) {
  const [previewUrl, setPreviewUrl] = useState("");
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    setPreviewUrl("");
    setLoadError(false);
    if (!attachment?.id) return undefined;
    getStoredAttachment(attachment.id).then((blob) => {
      if (!blob) throw new Error("ไม่พบไฟล์ภาพ");
      objectUrl = URL.createObjectURL(blob);
      if (active) setPreviewUrl(objectUrl);
      else URL.revokeObjectURL(objectUrl);
    }).catch(() => { if (active) setLoadError(true); });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment?.id]);

  if (!attachment) return <span className="ops-attachment-empty">ยังไม่มีไฟล์แนบหลักฐาน</span>;
  const isVideo = String(attachment.type || "").startsWith("video/");
  const isImage = String(attachment.type || "").startsWith("image/");
  const isPdf = attachment.type === "application/pdf";
  return <div className="ops-attachment-preview"><div className="ops-attachment-image-wrap">{previewUrl && !loadError && isVideo ? <video className="ops-attachment-video" src={previewUrl} controls preload="metadata" aria-label={`วิดีโอหลักฐาน ${label}`} onError={() => setLoadError(true)} /> : previewUrl && !loadError && isImage ? <img src={previewUrl} alt={`ภาพแนบ ${label}`} onError={() => setLoadError(true)} /> : <span className="ops-attachment-loading">{loadError ? "ไม่พบไฟล์หลักฐานในเครื่องนี้" : isPdf ? "ไฟล์เอกสารแนบ" : "มีไฟล์หลักฐานแนบ"}</span>}</div><div className="ops-attachment-meta"><span>{attachment.name}{formatBytes(attachment.size) ? ` · ${formatBytes(attachment.size)}` : ""}</span><div className="ops-attachment-meta-actions">{statusText && <span className={`ops-attachment-status ${statusComplete ? "is-complete" : ""}`} role="status"><Icon name={statusComplete ? "check" : "info"} size="small" />{statusText}</span>}{!readOnly && <button type="button" className="ops-button ops-button-danger-ghost ops-attachment-remove" onClick={onRemove} aria-label={`ลบหลักฐานของ ${label}`}><Icon name="delete" size="small" />ลบหลักฐาน</button>}</div></div></div>;
}

function AttachmentField({ item, attachment, readOnly, disabled, onChange, onRemove }) {
  return <div className={`ops-attachment-field ${disabled ? "is-disabled" : ""}`}><div className="ops-attachment-copy"><span>ไฟล์แนบหลักฐาน <em>{disabled ? "(ไม่เกี่ยวข้อง)" : "(ถ้ามี)"}</em></span><small>{disabled ? "รายการนี้ไม่ต้องแนบไฟล์หลักฐาน" : "แนบภาพถ่ายหรือไฟล์ของอุปกรณ์หรือจุดตรวจเพื่อใช้อ้างอิง"}</small></div>{!readOnly && !disabled && <AttachmentPicker id={`attachment-${item.id}`} label="รูปหลักฐาน" accept="image/*" allowCamera hasAttachment={Boolean(attachment)} onFile={onChange} />}<AttachmentPreview attachment={attachment} label={item.label} readOnly={readOnly || disabled} onRemove={onRemove} /></div>;
}

function StatusChoiceGroup({ item, value, readOnly, disabled, onChange }) {
  const statusHelpId = `check-status-${domSafeId(item.id)}-help`;
  const describedBy = disabled ? `check-item-${domSafeId(item.id)}-not-applicable` : statusHelpId;
  const statusHint = STATUS_RESULT_HINTS[value] || STATUS_RESULT_HINTS.pending;
  const renderOption = (option) => {
    const label = getStatusDisplayLabel(option.value, option.label);
    const choiceLabel = STATUS_CHOICE_LABELS[option.value] || label;
    const choiceDescription = STATUS_CHOICE_DESCRIPTIONS[option.value];
    return <label className={`ops-status-choice status-${option.value}`} key={option.value} title={label}>
      <input className="ops-choice-input" type="radio" name={`check-status-${domSafeId(item.id)}`} value={option.value} checked={value === option.value} disabled={readOnly || disabled} aria-label={label} aria-describedby={describedBy} onChange={() => onChange(option.value)} />
      <span className="ops-status-choice-body"><span className="ops-status-choice-icon" aria-hidden="true">{value === option.value && <Icon name="check" />}</span><span className="ops-status-choice-copy"><span className="ops-status-choice-label">{choiceLabel}</span>{choiceDescription && <small className="ops-status-choice-description">{choiceDescription}</small>}</span></span>
    </label>;
  };
  return <fieldset className="ops-status-group" disabled={readOnly || disabled} aria-describedby={describedBy}>
    <legend><span>ผลตรวจสภาพ</span><small id={statusHelpId}>{disabled ? "รายการนี้ถูกกำหนดให้ไม่เกี่ยวข้องกับสถานี" : "เลือกเพียง 1 ข้อ"}</small></legend>
    <div className="ops-status-choice-grid ops-status-single-choice">{STATUS_CHOICE_ORDER.map((key) => STATUS_OPTIONS.find((option) => option.value === key)).filter(Boolean).map(renderOption)}</div>
    {!disabled && <div className={`ops-status-result-hint status-${statusHint.tone}`} role="status" aria-live="polite"><Icon name="info" /><span><strong>{statusHint.title}</strong><small>{statusHint.message}</small></span></div>}
  </fieldset>;
}

function EvidenceField({ item, slot, value, readOnly, disabled, onChange, onAttachmentChange, onAttachmentRemove }) {
  const state = value || { status: "pending", value: "", note: "", attachment: null };
  const slotLabel = slot.displayLabel || slot.sourceLabel;
  const typeLabel = { photo: "รูปภาพ", video: "วิดีโอ", document: "เอกสาร", text: "ข้อความ", check: "ผลตรวจ", measurement: "ค่าที่วัด" }[slot.fieldType] || "หลักฐาน";
  const isCleaning = Boolean(slot.cleaningStage);
  const isRequiredPhoto = isCleaning || slot.photoRequired === true;
  const hasAttachment = Boolean(state.attachment?.id);
  const missingRequiredPhoto = isRequiredPhoto && !state.attachment?.id;
  const evidenceComplete = !disabled && isEvidenceSlotComplete(slot, state);
  const evidenceStateLabel = disabled ? "ไม่ต้องใช้หลักฐาน" : evidenceComplete ? "หลักฐานครบถ้วน" : state.attachment?.id ? "มีไฟล์แนบแล้ว" : "รอหลักฐาน";
  const evidenceStateHint = disabled ? "รายการนี้ไม่ต้องแนบหลักฐาน" : evidenceComplete ? "ระบบสรุปจากข้อมูลที่แนบให้โดยอัตโนมัติ" : state.attachment?.id ? "ตรวจความครบถ้วนจากไฟล์แนบ" : "แนบภาพหรือไฟล์เพื่อยืนยันผลการตรวจ";
  const [showNote, setShowNote] = useState(Boolean(state.note));
  useEffect(() => { if (state.note || ["not-installed", "server-site"].includes(state.status)) setShowNote(true); }, [state.note, state.status]);
  return <div id={`evidence-slot-${domSafeId(item.id)}-${domSafeId(slot.id)}`} className={`ops-evidence-slot ${disabled ? "is-disabled" : ""}`} tabIndex="-1">
    <div className="ops-evidence-slot-heading"><div><strong>{slotLabel}</strong><small>{isCleaning ? typeLabel : `${typeLabel} · ช่องที่ ${slot.sourceOrder}`}{isRequiredPhoto ? " · ต้องแนบ 1 ภาพ" : ""}</small></div><span className={`ops-required-mark ${slot.required ? "is-required" : ""}`}>{slot.required ? "จำเป็น" : "เสริม"}</span></div>
    {isRequiredPhoto && <p className={`ops-evidence-cleaning-hint ${missingRequiredPhoto ? "is-missing" : ""}`} role={missingRequiredPhoto ? "status" : undefined}>{missingRequiredPhoto
      ? `ยังขาดภาพหลักฐาน${isCleaning ? "ทำความสะอาด" : ""} 1 ภาพ`
      : isCleaning ? "ภาพถ่ายหลักฐานนี้ต้องเป็นของอุปกรณ์จริงรายการเดียวกับรายการด้านบน" : "แนบภาพหลักฐานให้ตรงกับรายการนี้"}</p>}
    <div className="ops-evidence-inline-workspace">
      <div className={`ops-evidence-proof-panel ${state.attachment ? "has-attachment" : "is-empty"}`}>
        {state.attachment ? <AttachmentPreview attachment={state.attachment} label={slotLabel} readOnly={readOnly || disabled} statusText={evidenceStateLabel} statusComplete={evidenceComplete} onRemove={() => onAttachmentRemove(slot, state.attachment, slotLabel)} /> : <>
          <div className={`ops-evidence-auto-state ${evidenceComplete ? "is-complete" : "is-pending"}`} role="status" aria-live="polite">
            <span className="ops-evidence-auto-state-icon"><Icon name={evidenceComplete ? "check" : "info"} /></span>
            <span><strong>{evidenceStateLabel}</strong><small>{evidenceStateHint}</small></span>
          </div>
          <div className="ops-evidence-proof-empty"><Icon name="camera" /><strong>ยังไม่มีภาพหลักฐาน</strong><small>{evidenceStateHint}</small></div>
        </>}
      </div>
      {!readOnly && !disabled && <AttachmentPicker variant={hasAttachment ? "compact" : "workspace"} id={`evidence-attachment-${slot.id}`} label={typeLabel} accept={attachmentAccept(slot.fieldType)} allowCamera={slot.fieldType === "photo" || slot.fieldType === "document"} hasAttachment={hasAttachment} compactLabel={slot.fieldType === "photo" ? "เปลี่ยนรูป" : "เปลี่ยนไฟล์"} dropLabel={slot.fieldType === "photo" ? "ลากรูปมาวางที่นี่" : "ลากไฟล์มาวางที่นี่"} dropHint="หรือคลิกเลือกจากเครื่อง" onFile={(file) => onAttachmentChange(slot, file)} />}
    </div>
    {!readOnly && !disabled && !showNote && <button type="button" className="ops-note-toggle ops-evidence-note-toggle" onClick={() => setShowNote(true)}>+ เพิ่มหมายเหตุหลักฐาน</button>}
    {showNote && <div className="ops-note-block ops-evidence-note-block"><label className="ops-field" htmlFor={`evidence-note-${slot.id}`}><span>หมายเหตุหลักฐาน</span><textarea id={`evidence-note-${slot.id}`} rows="2" value={state.note || ""} disabled={readOnly || disabled} aria-describedby={`evidence-note-help-${slot.id}`} onChange={(event) => onChange(slot.id, { note: event.target.value })} placeholder="ระบุรายละเอียดของช่องนี้" /></label><small id={`evidence-note-help-${slot.id}`}>บันทึกรายละเอียดที่ช่วยยืนยันหลักฐานของช่องนี้</small></div>}
  </div>;
}

function EvidenceDisclosure({ item, itemValue, readOnly, disabled, onChange, onAttachmentChange, onAttachmentRemove, focusSlotId, onFocusComplete }) {
  const [open, setOpen] = useState(false);
  const slots = item.evidenceSlots || [];
  const complete = disabled ? 0 : slots.filter((slot) => isEvidenceSlotComplete(slot, itemValue.evidence?.[slot.id])).length;
  const disclosureId = `check-item-${domSafeId(item.id)}-evidence`;
  const statusText = disabled ? "ไม่ต้องแนบหลักฐาน" : complete === slots.length ? "หลักฐานครบถ้วน" : `${slots.length - complete} ช่องหลักฐานไม่ครบถ้วน`;
  useEffect(() => {
    if (focusSlotId) setOpen(true);
  }, [focusSlotId]);
  useEffect(() => {
    if (!focusSlotId || !open) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(`evidence-slot-${domSafeId(item.id)}-${domSafeId(focusSlotId)}`);
      if (!target) return;
      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
      const control = target.querySelector("select, textarea, input, button");
      (control || target).focus({ preventScroll: true });
      onFocusComplete?.();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusSlotId, item.id, onFocusComplete, open]);
  return <section className={`ops-evidence-disclosure ${disabled ? "is-disabled" : ""}`}>
    <button type="button" className="ops-evidence-summary" aria-expanded={open} aria-controls={disclosureId} onClick={() => setOpen((current) => !current)}><span><Icon name="camera" /><strong>{disabled ? "รายการนี้ไม่ต้องแนบหลักฐาน" : `หลักฐาน ${complete}/${slots.length} ช่อง`}</strong></span><span className="ops-evidence-summary-state">{statusText}<span aria-hidden="true">{open ? "⌃" : "›"}</span></span></button>
    {open && <div className="ops-evidence-list" id={disclosureId}>{slots.map((slot) => <EvidenceField key={slot.id} item={item} slot={slot} value={itemValue.evidence?.[slot.id]} readOnly={readOnly} disabled={disabled} onChange={(slotId, patch) => onChange({ evidence: { ...(itemValue.evidence || {}), [slotId]: { ...(itemValue.evidence?.[slotId] || {}), ...patch } } })} onAttachmentChange={(slotDefinition, file) => onAttachmentChange(item.id, slotDefinition.id, file, slotDefinition.fieldType)} onAttachmentRemove={(slotDefinition, attachment, label) => onAttachmentRemove(item.id, slotDefinition.id, attachment, label)} />)}</div>}
  </section>;
}

function ChecklistItem({ item, value, readOnly, onChange, onAttachmentChange, onAttachmentRemove, focusEvidenceId, onFocusEvidenceComplete, onStatusChange, hideEvidence = false, focusLayout = false, apiReview = false, vehicleSearch, vehicleReviewVersion, onOpenApiReview }) {
  const itemValue = value || { value: "", status: item.applicable === false ? "na" : "pending", note: "", attachment: null };
  const displayItemLabel = getChecklistQueueItemLabel(item);
  const notApplicable = item.applicable === false;
  const isEvidence = Array.isArray(item.evidenceSlots) && item.evidenceSlots.length > 0;
  const valueType = item.inputType === "text" ? "text" : "number";
  const valueLabel = valueType === "number" ? "ค่าที่ตรวจวัดได้" : "ข้อมูลที่บันทึก";
  const scopeMeta = getChecklistScopeMeta(item);
  const headingId = `check-item-${domSafeId(item.id)}-heading`;
  if (apiReview) {
    const vehicleContext = getVehicleReviewContext(item);
    const reviewState = getVehicleReviewState(vehicleSearch, { reviewVersion: vehicleReviewVersion, context: vehicleContext?.key });
    const openLabel = vehicleContext?.key === "classification" ? "เริ่มตรวจคัดแยกประเภทรถในหน้านี้" : "เริ่มตรวจป้ายทะเบียนในหน้านี้";
    return <article id={`check-item-${domSafeId(item.id)}`} className={`ops-check-item ops-vehicle-api-item is-${reviewState.key} ${hideEvidence ? "ops-check-item-focus" : ""}`} aria-labelledby={headingId}>
      <div className={`ops-check-item-heading ${focusLayout ? "ops-check-item-heading-a11y-only" : ""}`}><span className="ops-item-index">API</span><div><span className="ops-item-scope is-station">ตรวจระดับสถานี</span><h4 id={headingId} tabIndex="-1">{displayItemLabel}</h4><p>{item.helper}</p></div></div>
      <div className={`ops-vehicle-api-status tone-${reviewState.tone}`} role="status"><Icon name={reviewState.tone === "normal" ? "check" : reviewState.tone === "waiting" ? "refresh" : "search"} /><div><strong>{reviewState.label}</strong><span>{reviewState.summary.total ? `ทั้งหมด ${reviewState.summary.total} คัน · ตรวจแล้ว ${reviewState.summary.reviewed} คัน` : "ใช้ช่วงวันและเวลาเพื่อดึงข้อมูลจาก API สถานีจริง"}</span></div>{!readOnly && <button type="button" className="ops-button ops-button-primary" onClick={onOpenApiReview}>{openLabel}</button>}</div>
    </article>;
  }
  return <article id={`check-item-${domSafeId(item.id)}`} className={`ops-check-item ${notApplicable ? "is-na" : ""} ${statusClass(itemValue.status)} ${hideEvidence ? "ops-check-item-focus" : ""}`} aria-labelledby={headingId}>
    <div className={`ops-check-item-heading ${focusLayout ? "ops-check-item-heading-a11y-only" : ""}`}><span className="ops-item-index">{item.assetNo || item.id.split(".").slice(-1)[0]}</span><div><span className={`ops-item-scope ${scopeMeta.className}`}>{scopeMeta.label}</span><h4 id={headingId} tabIndex="-1">{displayItemLabel}</h4>{item.checklistDisabled && <span className="ops-item-config-note"><Icon name="close" />ปิดจากการตั้งค่าสถานี</span>}{item.isAdditional && <span className="ops-item-config-note"><Icon name="info" />รายการเพิ่มเติมจากอุปกรณ์จริง</span>}<p>{item.helper}</p>{(item.assetNo || item.location || item.serialNo) && <span className="ops-asset-line"><Icon name="tag" /><span className="ops-code">{item.assetNo || "ไม่มีรหัส"}</span>{item.location ? ` · ${item.location}` : ""}{item.serialNo ? <> · S/N <span className="ops-code">{item.serialNo}</span></> : ""}</span>}</div></div>
    {notApplicable && <p className="ops-na-explanation" id={`check-item-${domSafeId(item.id)}-not-applicable`}><Icon name="info" /><span>รายการนี้ไม่เกี่ยวข้องกับสถานี จึงไม่ต้องกรอกผลตรวจหรือแนบหลักฐาน</span></p>}
    <div className="ops-check-fields">
      {item.inputType !== "none" && <label className="ops-field ops-value-field" htmlFor={`check-value-${domSafeId(item.id)}`}><span>{valueLabel} <em>({item.unit || "ข้อมูล"})</em></span><input id={`check-value-${domSafeId(item.id)}`} type={valueType} step={valueType === "number" ? "any" : undefined} inputMode={valueType === "number" ? "numeric" : undefined} value={itemValue.value ?? ""} disabled={readOnly || notApplicable} onChange={(event) => onChange(item.id, { value: event.target.value })} placeholder="—" /></label>}
      <StatusChoiceGroup item={item} value={itemValue.status} readOnly={readOnly} disabled={notApplicable} onChange={(nextStatus) => { onChange(item.id, { status: nextStatus }); onStatusChange?.(item, nextStatus, itemValue); }} />
    </div>
    {!hideEvidence && (isEvidence ? <EvidenceDisclosure item={item} itemValue={itemValue} readOnly={readOnly} disabled={notApplicable} focusSlotId={focusEvidenceId} onFocusComplete={onFocusEvidenceComplete} onChange={(patch) => onChange(item.id, patch)} onAttachmentChange={onAttachmentChange} onAttachmentRemove={onAttachmentRemove} /> : <AttachmentField item={item} attachment={itemValue.attachment} readOnly={readOnly} disabled={notApplicable} onChange={(file) => onAttachmentChange(item.id, file)} onRemove={() => onAttachmentRemove(item.id, itemValue.attachment, item.label)} />)}
  </article>;
}

function getSectionEvidenceStats(section, round) {
  const values = round?.inspectionItems || {};
  const slots = section.items
    .filter((item) => item.applicable !== false && !isEvidenceBypassItemStatus(values[item.id]?.status))
    .flatMap((item) => (item.evidenceSlots || []).map((slot) => ({ item, slot })));
  const statusCounts = Object.fromEntries(EVIDENCE_STATUS_OPTIONS.map((option) => [option.value, 0]));
  slots.forEach(({ item, slot }) => { const status = values[item.id]?.evidence?.[slot.id]?.status || "pending"; statusCounts[status] = (statusCounts[status] || 0) + 1; });
  const complete = slots.filter(({ item, slot }) => isEvidenceSlotComplete(slot, values[item.id]?.evidence?.[slot.id])).length;
  return { total: slots.length, complete, pending: statusCounts.pending || 0, incomplete: slots.length - complete, statusCounts };
}

function formatEvidenceCount(complete, total) {
  return total > 0
    ? `หลักฐานครบ ${complete}/${total} ช่อง${complete < total ? ` · ขาด ${total - complete} ช่อง` : ""}`
    : "รอบนี้ไม่มีช่องหลักฐาน";
}

const CHECKLIST_SECTION_META = Object.freeze({
  "3.1": {
    label: "ซอฟต์แวร์ / ระบบตาม Lane",
    hint: "ผลทดสอบการอ่านป้าย การค้นหา และการเชื่อมต่อระบบ เก็บครั้งเดียวตามช่องจราจร",
    drawerNote: "ผลทดสอบ LPR ↔ WIM และผลค้นหาป้ายอยู่ใน 3.1 ตาม Lane ไม่ต้องกรอกซ้ำใน 3.2",
  },
  "3.2": {
    label: "ฮาร์ดแวร์ / ตัวกล้องตามอุปกรณ์",
    hint: "ข้อมูลรุ่น Serial ตำแหน่ง ค่าแรงดัน และสภาพตัวกล้อง เก็บตาม Asset No.",
    drawerNote: "หมวดนี้เก็บเฉพาะข้อมูลฮาร์ดแวร์ของกล้องตาม Asset No. ผลอ่านป้ายอยู่ใน 3.1 ตาม Lane",
  },
});

function getChecklistSectionMeta(section) {
  return CHECKLIST_SECTION_META[section?.code] || null;
}

function getChecklistQueueEquipmentLabel(group, round) {
  if (group.kind === "system") {
    const system = (round?.snapshot?.stationSystems || []).find((entry) => entry.id === group.systemRecordId);
    const systemName = getCentralSystemNameForRecord(system)?.nameTh || group.items?.[0]?.label || "ระบบที่ติดตั้ง";
    const scope = String(group.items?.[0]?.scope || "").trim();
    return [systemName, scope].filter(Boolean).join(" · ");
  }
  if (group.kind === "station") return "งานระดับสถานี / Lane";
  const asset = group.assetId ? (round?.snapshot?.equipment || []).find((entry) => entry.id === group.assetId) : null;
  const type = asset?.type || group.types[0] || "";
  const equipmentLabel = type ? getEquipmentDisplayLabel(asset || { type }) : "";
  if (group.scope === "asset") return [equipmentLabel, group.assetNo || asset?.assetNo].filter(Boolean).join(" · ") || "อุปกรณ์จริง";
  if (group.scope === "equipment-type") return `${equipmentLabel || "อุปกรณ์"} · รายการระดับระบบ`;
  return "งานระดับสถานี / ระบบกลาง";
}

function getChecklistScopeMeta(item) {
  if (item?.assetId) {
    const assetName = String(item.assetName || getEquipmentDisplayLabel({ type: item.equipmentType }) || "อุปกรณ์").trim();
    const assetNo = String(item.assetNo || "").trim();
    return { label: `อุปกรณ์: ${assetName}${assetNo ? ` · ${assetNo}` : ""}`, className: "is-equipment" };
  }
  if (item?.systemRecordId) {
    const scope = String(item.scope || "").trim();
    return { label: `ตรวจระดับระบบ${scope ? ` · ${scope}` : ""}`, className: "is-system" };
  }
  const laneNo = String(item?.laneNo ?? "").trim();
  if (item?.laneId || item?.topologyDependent || laneNo) {
    return { label: laneNo ? `ตรวจระดับ Lane ${laneNo}` : "ตรวจระดับ Lane", className: "is-lane" };
  }
  return { label: "ตรวจระดับสถานี", className: "is-station" };
}

function ChecklistCoverageSummary({ coverage, onSelectAsset, displaySections = [], stationFormat = "SC" }) {
  if (!coverage) return null;
  const hasWarning = coverage.missingEquipmentCount > 0 || coverage.genericEquipmentCount > 0 || coverage.orphanAssetItemCount > 0;
  const format = String(stationFormat || "SC").toUpperCase() === "IMPS" ? "IMPS" : "SC";
  const displayGroups = getChecklistQueueGroups(displaySections, format)
    .map((group) => ({
      ...group,
      sections: group.sections.map((section) => ({
        ...section,
        applicableItemCount: section.items.filter((item) => item.applicable !== false && item.checklistDisabled !== true).length,
      })).filter((section) => section.applicableItemCount > 0),
    }))
    .filter((group) => group.sections.length > 0);
  const renderEquipmentList = (equipment) => <ul className="ops-coverage-asset-list">{equipment.map((asset) => <li key={asset.id}>{onSelectAsset
    ? <button type="button" onClick={() => onSelectAsset(asset)}>{[asset.assetNo || "ไม่มี Asset No.", getEquipmentDisplayLabel(asset)].filter(Boolean).join(" · ")}</button>
    : <span>{[asset.assetNo || "ไม่มี Asset No.", getEquipmentDisplayLabel(asset)].filter(Boolean).join(" · ")}</span>}</li>)}</ul>;
  return <div className={`ops-coverage-summary ${hasWarning ? "is-warning" : "is-complete"}`} role={hasWarning ? "status" : undefined}>
    <Icon name={hasWarning ? "alert" : "check"} />
    <div>
      <strong>{hasWarning ? "ควรตรวจสอบความครบถ้วน" : "อุปกรณ์มีรายการตรวจครบ"}</strong>
      <span>มีรายการตรวจเฉพาะอุปกรณ์ {coverage.coveredEquipmentCount}/{coverage.equipmentCount} ตัว · งานระดับสถานี {coverage.stationItemCount} รายการ · งานระดับ Lane {coverage.laneItemCount} รายการ</span>
      {coverage.missingEquipmentCount > 0 && <><span>อุปกรณ์เหล่านี้ยังไม่มี Checklist เฉพาะ ตรวจความสัมพันธ์กับระบบแม่หรือ Cabinet ก่อนสร้างรอบใหม่</span>{renderEquipmentList(coverage.missingEquipment)}</>}
      {coverage.genericEquipmentCount > 0 && <><span>อุปกรณ์กำหนดเองที่มีเพียงรายการทั่วไป ยังไม่มีรายการตรวจเฉพาะด้าน</span>{renderEquipmentList(coverage.genericEquipment)}</>}
      {coverage.orphanAssetItemCount > 0 && <span>พบรายการตรวจที่ไม่ตรงกับอุปกรณ์ในทะเบียน {coverage.orphanAssetItemCount} รายการ</span>}
      {displayGroups.length > 0 && <div className="ops-coverage-groups" aria-label={`จำนวนรายการตรวจแยกตามกลุ่ม ${format}`}>
        <strong>จำนวนรายการตรวจตามชุดระบบ {format}</strong>
        <ul>{displayGroups.map((group) => <li key={group.id}><span>{group.title}</span><small>{group.sections.map((section) => `${section.queueDisplayCode || section.code} · ${section.title} ${section.applicableItemCount} รายการ`).join(" · ")}</small></li>)}</ul>
      </div>}
    </div>
  </div>;
}

function ChecklistSectionNav({ sections, selected, onSelect, readOnly, round }) {
  const stationFormat = round?.snapshot?.stationFormat || "SC";
  return <>
    <label className="ops-field ops-section-nav-mobile"><span>{readOnly ? "หมวดในประวัติ" : "หมวด Checklist"}</span><CustomSelect value={selected} onChange={(event) => onSelect(event.target.value)} aria-label={readOnly ? "เลือกหมวดในประวัติ" : "เลือกหมวด Checklist"} label={readOnly ? "เลือกหมวดในประวัติ" : "เลือกหมวด Checklist"}>{sections.map((section) => <option key={section.code} value={section.code}>{getChecklistQueueSectionLabel(section, stationFormat)}</option>)}</CustomSelect></label>
    <nav className="ops-section-nav" aria-label={readOnly ? "เลือกหมวดในประวัติ" : "เลือกหมวด Checklist"}>{sections.map((section) => { const evidence = getSectionEvidenceStats(section, round); return <button type="button" key={section.code} className={selected === section.code ? "is-active" : ""} onClick={() => onSelect(section.code)}><span>{getChecklistQueueSectionLabel(section, stationFormat)}</span><small>รายการ {section.items.length} รายการ · {formatEvidenceCount(evidence.complete, evidence.total)}</small></button>; })}</nav>
  </>;
}

function ChecklistTaskQueue({ sections, hierarchy = "format", selected, currentItemId, round, summary, coverage, onSelect, readOnly }) {
  const stationFormat = round?.snapshot?.stationFormat || "SC";
  const queueGroups = useMemo(() => hierarchy === "station-categories"
    ? getChecklistPageQueueGroups(sections)
    : getChecklistQueueGroups(sections, stationFormat), [hierarchy, sections, stationFormat]);
  const queueSectionKey = (section) => section.queueSourceSectionCode ? `${section.queueSourceSectionCode}::${section.code}` : section.code;
  const sourceSectionCode = (section) => section.queueSourceSectionCode || section.code;
  const queueEquipmentGroups = (section) => section?.equipmentGroups?.length
    ? section.equipmentGroups
    : section ? [{ id: "shared", assetId: null, assetNo: "", types: [], scope: "shared", items: section.items }] : [];
  const [expandedGroups, setExpandedGroups] = useState(() => new Set(queueGroups[0]?.id ? [queueGroups[0].id] : []));
  const [expandedSections, setExpandedSections] = useState(() => new Set(sections[0]?.code ? [sections[0].code] : []));
  const [expandedEquipmentGroups, setExpandedEquipmentGroups] = useState(() => new Set());
  useEffect(() => {
    if (!selected) return;
    const selectedGroup = queueGroups.find((group) => group.sections.some((section) => sourceSectionCode(section) === selected && section.items.some((item) => item.id === currentItemId)))
      || queueGroups.find((group) => group.sections.some((section) => sourceSectionCode(section) === selected));
    if (!selectedGroup) return;
    const selectedSection = selectedGroup.sections.find((section) => sourceSectionCode(section) === selected && section.items.some((item) => item.id === currentItemId))
      || selectedGroup.sections.find((section) => sourceSectionCode(section) === selected);
    setExpandedGroups((current) => current.has(selectedGroup.id) ? current : new Set([...current, selectedGroup.id]));
    const selectedSectionKey = selectedSection ? queueSectionKey(selectedSection) : selected;
    setExpandedSections((current) => current.size === 1 && current.has(selectedSectionKey) ? current : new Set([selectedSectionKey]));
    const selectedEquipmentGroup = queueEquipmentGroups(selectedSection).find((group) => group.items.some((item) => item.id === currentItemId))
      || queueEquipmentGroups(selectedSection)[0];
    if (selectedSection && selectedEquipmentGroup) {
      const selectedEquipmentKey = `${selectedSectionKey}::${selectedEquipmentGroup.id}`;
      setExpandedEquipmentGroups((current) => current.size === 1 && current.has(selectedEquipmentKey) ? current : new Set([selectedEquipmentKey]));
    }
  }, [currentItemId, queueGroups, selected]);
  useEffect(() => {
    if (!queueGroups.length) return;
    setExpandedGroups((current) => current.size ? current : new Set([queueGroups[0].id]));
  }, [queueGroups]);
  useEffect(() => {
    if (!selected || !currentItemId) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(`task-queue-item-${domSafeId(currentItemId)}`);
      if (!target) return;
      const queue = target.closest(".ops-task-queue");
      if (!queue) return;
      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      const queueBounds = queue.getBoundingClientRect();
      const targetBounds = target.getBoundingClientRect();
      const targetScrollTop = queue.scrollTop + targetBounds.top - queueBounds.top - queue.clientTop;
      queue.scrollTo({ top: Math.max(0, targetScrollTop), behavior: reducedMotion ? "auto" : "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [currentItemId, expandedEquipmentGroups, expandedGroups, expandedSections, queueGroups, selected]);
  const toggleGroup = (group) => {
    const isGroupActive = group.sections.some((section) => section.items.some((item) => item.id === currentItemId));
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(group.id)) next.delete(group.id);
      else next.add(group.id);
      return next;
    });
    if (!isGroupActive) {
      const targetSection = group.sections[0];
      const targetItem = targetSection?.items?.[0];
      if (targetSection && targetItem) onSelect(sourceSectionCode(targetSection), targetItem.id);
    }
  };
  const toggleSection = (section) => {
    const sectionKey = queueSectionKey(section);
    const toggle = getChecklistQueueToggle(expandedSections, sectionKey, sectionKey === queueSectionKey(section) && sourceSectionCode(section) === selected ? sectionKey : "");
    setExpandedSections(toggle.expandedSections);
    if (toggle.shouldSelect && section.items[0]) onSelect(sourceSectionCode(section), section.items[0].id);
  };
  const toggleEquipmentGroup = (section, equipmentGroup) => {
    const equipmentKey = `${queueSectionKey(section)}::${equipmentGroup.id}`;
    setExpandedEquipmentGroups((current) => current.has(equipmentKey) ? new Set() : new Set([equipmentKey]));
  };
  const selectItem = (section, item) => onSelect(sourceSectionCode(section), item.id);
  const compactSection = queueGroups.flatMap((group) => group.sections).find((section) => sourceSectionCode(section) === selected && section.items.some((item) => item.id === currentItemId))
    || queueGroups.flatMap((group) => group.sections).find((section) => sourceSectionCode(section) === selected)
    || queueGroups[0]?.sections[0];
  const compactEquipmentGroups = compactSection?.equipmentGroups || [];
  const compactEquipmentGroup = compactEquipmentGroups.find((group) => group.items.some((item) => item.id === currentItemId)) || compactEquipmentGroups[0];
  const compactItems = compactEquipmentGroup?.items || compactSection?.items || [];
  const renderQueueItem = (section, item) => {
    const itemValue = round.inspectionItems[item.id] || {};
    const apiReview = isVehicleApiReviewItem(item, round.snapshot);
    const vehicleContext = apiReview ? getVehicleReviewContext(item) : null;
    const vehicleReview = apiReview ? getVehicleReviewState(round.vehicleSearch, { reviewVersion: round.snapshot?.vehicleReviewVersion, context: vehicleContext?.key }) : null;
    const status = itemValue.status || "pending";
    const evidenceSlots = item.evidenceSlots || [];
    const notApplicable = item.applicable === false;
    const evidenceBypassed = notApplicable || isEvidenceBypassItemStatus(status);
    const evidenceComplete = evidenceBypassed ? 0 : evidenceSlots.filter((slot) => isEvidenceSlotComplete(slot, itemValue.evidence?.[slot.id])).length;
    const evidenceIncomplete = !evidenceBypassed && evidenceSlots.length > evidenceComplete;
    const statusMeta = apiReview ? { icon: vehicleReview.tone === "normal" ? "check" : vehicleReview.tone === "waiting" ? "refresh" : "search", tone: vehicleReview.tone, label: vehicleReview.label } : (STATUS_META[status] || STATUS_META.pending);
    const queueTone = apiReview ? statusMeta.tone : (evidenceIncomplete ? "waiting" : statusMeta.tone);
    const evidenceLabel = apiReview
      ? vehicleReview.label
      : evidenceBypassed
      ? "ไม่ต้องตรวจหลักฐาน"
      : evidenceSlots.length
        ? `หลักฐาน ${evidenceComplete}/${evidenceSlots.length} ช่อง${evidenceIncomplete ? ` · ขาด ${evidenceSlots.length - evidenceComplete}` : ""}`
        : "";
    const scopeMeta = getChecklistScopeMeta(item);
    return <button type="button" id={`task-queue-item-${domSafeId(item.id)}`} key={item.id} className={`ops-task-queue-item ${currentItemId === item.id ? "is-active" : ""} tone-${queueTone}`} onClick={() => selectItem(section, item)} aria-current={currentItemId === item.id ? "step" : undefined}>
      <span className="ops-task-queue-item-meta">
        <span className="ops-task-queue-item-state" aria-hidden="true"><Icon name={evidenceIncomplete ? "alert" : statusMeta.icon} size="small" /></span>
      </span>
      <span className="ops-task-queue-item-copy"><em className={`ops-task-queue-item-scope ${scopeMeta.className}`}>{scopeMeta.label}</em><span title={getChecklistQueueItemLabel(item)}>{getChecklistQueueItemLabel(item)}</span><small className={evidenceIncomplete && !apiReview ? "is-incomplete" : "is-complete"}>{evidenceLabel || getStatusDisplayLabel(status)}</small><span className="sr-only">ผลตรวจ {apiReview ? vehicleReview.label : getStatusDisplayLabel(status)}</span></span>
      {evidenceIncomplete && !apiReview && <span className="ops-task-queue-item-alert" aria-label="หลักฐานยังไม่ครบ"><Icon name="alert" size="small" /></span>}
    </button>;
  };
  return <div className="ops-task-queue-wrap"><div className="ops-compact-queue">
    <label className="ops-field"><span>หมวดตรวจ</span><CustomSelect value={selected || ""} onChange={event=>{const section=sections.find(entry=>entry.code===event.target.value);if(section?.items[0])onSelect(section.code,section.items[0].id);}} aria-label="เลือกหมวดตรวจ" label="เลือกหมวดตรวจ">{sections.map(section=><option key={section.code} value={section.code}>{getChecklistQueueSectionLabel(section, stationFormat)}</option>)}</CustomSelect></label>
    <label className="ops-field"><span>{hierarchy === "station-categories" ? "อุปกรณ์ / ระบบ" : "อุปกรณ์"}</span><CustomSelect value={compactEquipmentGroup?.id || ""} onChange={event=>{const group=compactEquipmentGroups.find(entry=>entry.id===event.target.value);if(group?.items[0])onSelect(selected,group.items[0].id);}} aria-label={hierarchy === "station-categories" ? "เลือกอุปกรณ์หรือระบบ" : "เลือกอุปกรณ์"} label={hierarchy === "station-categories" ? "เลือกอุปกรณ์หรือระบบ" : "เลือกอุปกรณ์"}>{compactEquipmentGroups.map(group=><option key={group.id} value={group.id}>{getChecklistQueueEquipmentLabel(group, round)}</option>)}</CustomSelect></label>
    <label className="ops-field"><span>รายการตรวจ</span><CustomSelect value={currentItemId || ""} onChange={event=>onSelect(selected,event.target.value)} aria-label="เลือกรายการตรวจ" label="เลือกรายการตรวจ">{compactItems.map(item=><option key={item.id} value={item.id}>{getChecklistQueueItemLabel(item)}</option>)}</CustomSelect></label>
  </div>
    <nav className="ops-task-queue" aria-label={readOnly ? "รายการในประวัติ" : "รายการตรวจตามหมวด"}>
      {queueGroups.map((group) => {
        const isGroupExpanded = expandedGroups.has(group.id);
        const groupItems = group.sections.flatMap((section) => section.sourceItems || section.items);
        const groupCleaningCount = getCleaningQueueItemCount(groupItems);
        const groupItemCount = groupItems.filter((item) => (round.inspectionItems[item.id]?.status || "pending") !== "pending").length;
        const groupEvidence = getSectionEvidenceStats({ items: groupItems }, round);
        const groupStatusProgress = groupItems.length ? Math.round((groupItemCount / groupItems.length) * 100) : 0;
        const groupEvidenceProgress = groupEvidence.total ? Math.round((groupEvidence.complete / groupEvidence.total) * 100) : 0;
        const isGroupActive = group.sections.some((section) => section.items.some((item) => item.id === currentItemId));
        const groupKindLabel = group.kind === "station-readiness"
          ? "งานระดับสถานี"
          : group.kind === "station-equipment-category"
            ? group.categoryLabel || "หมวดหลัก"
            : group.kind === "station-cleaning"
              ? "งานสนับสนุนการตรวจ"
            : group.kind === "unmapped"
              ? "รายการที่ยังไม่อยู่ในผังหมวด"
              : group.kind === "format-system"
          ? `ชุดระบบ ${group.format}`
          : group.kind === "unassigned"
            ? "รายการที่ยังระบุชุดตรวจไม่ได้"
            : group.id === "section-1.1"
              ? "งานระดับสถานี"
              : group.kind === "equipment-category"
                ? "ประเภทอุปกรณ์ · หมวดต้นทาง"
                : "หมวดต้นทาง";
        return <div className={`ops-task-queue-group ${isGroupExpanded ? "is-expanded" : ""} ${isGroupActive ? "is-active" : ""}`} key={group.id}>
          <button type="button" className="ops-task-queue-group-toggle" aria-expanded={isGroupExpanded} aria-current={isGroupActive ? "page" : undefined} onClick={() => toggleGroup(group)}>
            <span className="ops-task-queue-group-chevron" aria-hidden="true"><Icon name="arrow" size="small" /></span>
          <span className="ops-task-queue-group-copy"><strong>{group.title}</strong><small>{hierarchy === "station-categories" && group.kind === "station-equipment-category" ? group.categoryDescription : groupKindLabel} · บันทึกสถานะ {groupItemCount}/{groupItems.length} รายการ{groupCleaningCount ? ` · ทำความสะอาด ${groupCleaningCount} รายการ` : ""}</small></span>
            <span className="ops-task-queue-group-progress" aria-label={`กลุ่ม ${group.title} บันทึกสถานะ ${groupItemCount} จาก ${groupItems.length} รายการ`}>
              <span className="ops-task-queue-group-progress-row"><span className="ops-task-queue-group-meter" aria-hidden="true"><span style={{ width: `${groupStatusProgress}%` }} /></span><strong>{groupItemCount}/{groupItems.length}</strong></span>
              <span className={`ops-task-queue-group-progress-row ${groupEvidence.total === 0 ? "is-empty" : groupEvidence.complete === groupEvidence.total ? "is-complete" : "is-incomplete"}`}><span className="ops-task-queue-group-meter" aria-hidden="true"><span style={{ width: `${groupEvidenceProgress}%` }} /></span><strong>{groupEvidence.total ? `${groupEvidence.complete}/${groupEvidence.total}` : "ไม่มีช่อง"}</strong></span>
            </span>
          </button>
          {isGroupExpanded && <div className="ops-task-queue-group-sections">
          {group.sections.map((section) => {
        const sectionKey = queueSectionKey(section);
        const isExpanded = expandedSections.has(sectionKey);
        const sourceItems = section.sourceItems || section.items;
        const sectionCleaningCount = getCleaningQueueItemCount(sourceItems);
        const itemCount = sourceItems.filter((item) => (round.inspectionItems[item.id]?.status || "pending") !== "pending").length;
        const evidence = getSectionEvidenceStats({ ...section, items: sourceItems }, round);
        const evidenceLabel = formatEvidenceCount(evidence.complete, evidence.total);
        const filteredLabel = section.excludedItemCount ? ` · ซ่อน ${section.excludedItemCount} รายการที่ไม่รวมความคืบหน้า` : "";
        const sectionMeta = getChecklistSectionMeta(section);
        const statusProgress = sourceItems.length ? Math.round((itemCount / sourceItems.length) * 100) : 0;
        const evidenceProgress = evidence.total ? Math.round((evidence.complete / evidence.total) * 100) : 0;
        const evidenceTone = evidence.total === 0 ? "is-empty" : evidence.complete === evidence.total ? "is-complete" : "is-incomplete";
        const equipmentGroups = queueEquipmentGroups(section);
        const isSectionActive = sourceItems.some((item) => item.id === currentItemId);
        return <div className={`ops-task-queue-section ${isExpanded ? "is-expanded" : ""}`} id={`task-queue-section-${domSafeId(sectionKey)}`} key={sectionKey}>
          <button type="button" className={`ops-task-queue-section-toggle ${isSectionActive ? "is-active" : ""}`} aria-expanded={isExpanded} aria-current={isSectionActive ? "page" : undefined} onClick={() => toggleSection(section)}>
            <span className="ops-task-queue-chevron" aria-hidden="true"><Icon name="arrow" size="small" /></span>
            <span className="ops-task-queue-section-code">{section.queueDisplayCode || section.code}</span>
             <span className="ops-task-queue-section-copy"><strong>{section.title}</strong><small>{group.kind === "format-system" ? "ชุดตรวจย่อย" : "หมวดย่อย"} · {sectionMeta ? `${sectionMeta.label} · ` : ""}บันทึกสถานะ {itemCount}/{sourceItems.length} รายการ{sectionCleaningCount ? ` · ทำความสะอาด ${sectionCleaningCount} รายการ` : ""}{filteredLabel}</small></span>
            <span className="ops-task-queue-section-progress" aria-label={`รายการตรวจบันทึกสถานะ ${itemCount} จาก ${sourceItems.length} รายการ · ${evidenceLabel}`}>
              <span className="ops-task-queue-section-progress-row">
                <span className="ops-task-queue-section-progress-label">รายการ</span>
                <span className="ops-task-queue-section-meter" aria-hidden="true"><span style={{ width: `${statusProgress}%` }} /></span>
                <strong>{itemCount}/{sourceItems.length}</strong>
              </span>
              <span className={`ops-task-queue-section-progress-row ${evidenceTone}`}>
                <span className="ops-task-queue-section-progress-label">หลักฐาน</span>
                <span className="ops-task-queue-section-meter" aria-hidden="true"><span style={{ width: `${evidenceProgress}%` }} /></span>
                <strong>{evidence.total ? `${evidence.complete}/${evidence.total}` : "ไม่มีช่อง"}</strong>
              </span>
            </span>
          </button>
          {isExpanded && <div className="ops-task-queue-items"><div className="ops-task-queue-items-heading">รายการตรวจในหมวดย่อยนี้</div>
            <div className="ops-task-queue-equipment-groups" aria-label={hierarchy === "station-categories" ? "อุปกรณ์และระบบในหมวดย่อยนี้" : "อุปกรณ์ในหมวดย่อยนี้"}>
              {equipmentGroups.map((equipmentGroup) => {
                const isEquipmentActive = equipmentGroup.items.some((item) => item.id === currentItemId);
                const equipmentItemCount = equipmentGroup.items.filter((item) => (round.inspectionItems[item.id]?.status || "pending") !== "pending").length;
                const equipmentEvidence = getSectionEvidenceStats({ items: equipmentGroup.items }, round);
                const equipmentCleaningCount = getCleaningQueueItemCount(equipmentGroup.items);
                const equipmentEvidenceLabel = formatEvidenceCount(equipmentEvidence.complete, equipmentEvidence.total);
                const equipmentStatusProgress = equipmentGroup.items.length ? Math.round((equipmentItemCount / equipmentGroup.items.length) * 100) : 0;
                const equipmentEvidenceProgress = equipmentEvidence.total ? Math.round((equipmentEvidence.complete / equipmentEvidence.total) * 100) : 0;
                const equipmentEvidenceTone = equipmentEvidence.total === 0 ? "is-empty" : equipmentEvidence.complete === equipmentEvidence.total ? "is-complete" : "is-incomplete";
                const equipmentLabel = getChecklistQueueEquipmentLabel(equipmentGroup, round);
                const equipmentKey = `${sectionKey}::${equipmentGroup.id}`;
                const isEquipmentExpanded = expandedEquipmentGroups.has(equipmentKey);
                const equipmentKindLabel = hierarchy === "station-categories"
                  ? equipmentGroup.kind === "system" ? "ระบบ" : equipmentGroup.kind === "station" ? "งานสถานี / Lane" : "อุปกรณ์"
                  : "อุปกรณ์";
                return <div className={`ops-task-queue-equipment-group ${isEquipmentActive ? "is-active" : ""} ${isEquipmentExpanded ? "is-expanded" : ""}`} key={equipmentKey}>
                  <button type="button" className="ops-task-queue-equipment-label" aria-label={`${equipmentKindLabel} ${equipmentLabel}`} aria-expanded={isEquipmentExpanded} onClick={() => toggleEquipmentGroup(section, equipmentGroup)}>
                    <span className="ops-task-queue-equipment-chevron" aria-hidden="true"><Icon name="arrow" size="small" /></span>
                    <span className="ops-task-queue-equipment-copy"><strong>{equipmentLabel}</strong><small>{equipmentKindLabel} · บันทึกสถานะ {equipmentItemCount}/{equipmentGroup.items.length} รายการ · {equipmentEvidenceLabel}{equipmentCleaningCount ? ` · ทำความสะอาด ${equipmentCleaningCount} รายการ` : ""}</small></span>
                    <span className="ops-task-queue-equipment-progress" aria-label={`${equipmentLabel} บันทึกสถานะ ${equipmentItemCount} จาก ${equipmentGroup.items.length} รายการ · ${equipmentEvidenceLabel}`}>
                      <span className="ops-task-queue-equipment-progress-row"><span className="ops-task-queue-equipment-meter" aria-hidden="true"><span style={{ width: `${equipmentStatusProgress}%` }} /></span><strong>{equipmentItemCount}/{equipmentGroup.items.length}</strong></span>
                      <span className={`ops-task-queue-equipment-progress-row ${equipmentEvidenceTone}`}><span className="ops-task-queue-equipment-meter" aria-hidden="true"><span style={{ width: `${equipmentEvidenceProgress}%` }} /></span><strong>{equipmentEvidence.total ? `${equipmentEvidence.complete}/${equipmentEvidence.total}` : "ไม่มีช่อง"}</strong></span>
                    </span>
                  </button>
                  {isEquipmentExpanded && <div className="ops-task-queue-equipment-items">
                    {equipmentGroup.items.map((item) => renderQueueItem(section, item))}
                  </div>}
                </div>;
              })}
            </div>
          </div>}
        </div>;
          })}
          </div>}
        </div>;
      })}
    </nav>
    <section className="ops-task-queue-summary" aria-label="ภาพรวมการตรวจ">
      <div className="ops-task-queue-summary-heading"><span>ภาพรวมการตรวจ</span><strong>{summary.progress}%</strong></div>
      <div className="ops-task-queue-progress" role="progressbar" aria-label="ความคืบหน้าการตรวจ" aria-valuemin="0" aria-valuemax="100" aria-valuenow={summary.progress}><span style={{ width: `${summary.progress}%` }} /></div>
      <div className="ops-task-queue-summary-meta"><span>รายการตรวจ {summary.done} จาก {summary.total} รายการ</span><span>หลักฐานครบ {summary.evidenceComplete} จาก {summary.evidenceTotal} ช่อง</span>{coverage && <><span>อุปกรณ์มีรายการตรวจ {coverage.coveredEquipmentCount}/{coverage.equipmentCount} ตัว</span><span>งานสถานี/Lane {coverage.sharedItemCount} รายการ</span></>}</div>
    </section>
  </div>;
}

function ChecklistEvidenceDrawer({ item, itemValue, readOnly, onChange, onAttachmentChange, onAttachmentRemove, focusSlotId, onFocusComplete, round, vehicleSearch, onVehicleSearchChange, notify, focusVehicleRowId, focusVehicleReviewKind, onFocusVehicleRowComplete, panelId = "", labelledBy = "", hidden = false }) {
  useEffect(() => {
    if (!item || !focusSlotId) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(`evidence-slot-${domSafeId(item.id)}-${domSafeId(focusSlotId)}`);
      if (!target) return;
      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start", inline: "nearest" });
      const control = target.querySelector("input, textarea, button");
      (control || target).focus({ preventScroll: true });
      onFocusComplete?.();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusSlotId, item?.id, onFocusComplete]);
  if (!item) return <aside className="ops-evidence-drawer" id={panelId || undefined} role={panelId ? "tabpanel" : undefined} aria-labelledby={labelledBy || undefined} tabIndex={panelId ? 0 : undefined} hidden={hidden} aria-hidden={hidden ? "true" : undefined}><EmptyState icon="camera" title="เลือกหมวดตรวจเพื่อดูหลักฐาน">หลักฐานของรายการที่เลือกจะแสดงตรงนี้</EmptyState></aside>;
  const value = itemValue || { status: item.applicable === false ? "na" : "pending", evidence: {}, attachment: null };
  const slots = Array.isArray(item.evidenceSlots) ? item.evidenceSlots : [];
  const notApplicable = item.applicable === false;
  const evidenceBypassed = notApplicable || isEvidenceBypassItemStatus(value.status);
  const evidenceBypassLabel = notApplicable
    ? "ไม่เกี่ยวข้องกับสถานี"
    : value.status === "not-installed" ? "ไม่ได้ติดตั้ง" : "ไม่เกี่ยวข้อง";
  const scopeMeta = getChecklistScopeMeta(item);
  const complete = evidenceBypassed ? 0 : slots.filter((slot) => isEvidenceSlotComplete(slot, value.evidence?.[slot.id])).length;
  const evidenceLabel = evidenceBypassed ? "ไม่ต้องตรวจหลักฐาน" : slots.length ? `หลักฐานครบ ${complete}/${slots.length} ช่อง` : "หลักฐานเสริม";
  const isCleaningItem = item.isEquipmentCleaning === true || item.isAreaCleaning === true;
  const updateEvidence = (slotId, patch) => onChange({ evidence: { ...(value.evidence || {}), [slotId]: { ...(value.evidence?.[slotId] || {}), ...patch } } });

  return <aside className={`ops-evidence-drawer ${evidenceBypassed ? "is-disabled" : ""}`} id={panelId || undefined} role={panelId ? "tabpanel" : undefined} aria-labelledby={labelledBy || "evidence-drawer-title"} tabIndex={panelId ? 0 : undefined} hidden={hidden} aria-hidden={hidden ? "true" : undefined}>
    <div className="ops-evidence-drawer-heading">
      <div><h3 id="evidence-drawer-title">หลักฐานประกอบ</h3></div>
      <span className={`ops-evidence-drawer-status ${evidenceBypassed || (slots.length > 0 && complete === slots.length) ? "is-complete" : ""}`} role="status" aria-live="polite"><Icon name={evidenceBypassed || (slots.length > 0 && complete === slots.length) ? "check" : "camera"} size="small" />{evidenceLabel}</span>
    </div>
    <div className={`ops-evidence-drawer-item ${isCleaningItem ? "is-cleaning" : ""}`}><div><strong>{getChecklistQueueItemLabel(item)}</strong><small>{item.helper || "หลักฐานประกอบรายการตรวจ"}</small></div></div>
    {getChecklistSectionMeta(item)?.drawerNote && <div className={`ops-checklist-split-note is-${item.sectionCode}`} role="note"><Icon name="info" size="small" /><span>{getChecklistSectionMeta(item).drawerNote}</span></div>}
    {evidenceBypassed ? <div className="ops-evidence-drawer-disabled"><Icon name="info" /><span>เลือกสถานะ “{evidenceBypassLabel}” จึงไม่ต้องตรวจหรือแนบหลักฐาน รายการนี้จะไม่แสดงในรายงาน</span></div> : slots.length ? <div className="ops-evidence-drawer-slots">{slots.map((slot) => <EvidenceField key={slot.id} item={item} slot={slot} value={value.evidence?.[slot.id]} readOnly={readOnly} disabled={false} onChange={updateEvidence} onAttachmentChange={(slotDefinition, file) => onAttachmentChange(item.id, slotDefinition.id, file, slotDefinition.fieldType)} onAttachmentRemove={(slotDefinition, attachment, label) => onAttachmentRemove(item.id, slotDefinition.id, attachment, label)} />)}</div> : <AttachmentField item={item} attachment={value.attachment} readOnly={readOnly} disabled={false} onChange={(file) => onAttachmentChange(item.id, file)} onRemove={() => onAttachmentRemove(item.id, value.attachment, item.label)} />}
     {!evidenceBypassed && <div className="ops-evidence-drawer-help"><Icon name="info" size="small" /><span>เลือกแถวรายการก่อน แล้วลากรูปลงในพื้นที่อัปโหลด หรือกดเลือกจากเครื่อง</span></div>}
  </aside>;
}

function ChecklistPager({ currentIndex, total, onPrevious, onNext }) {
  const hasItems = total > 0;
  return <nav className="ops-item-pager" aria-label="เลื่อนไปยังรายการตรวจ">
    <div className="ops-item-pager-position">
      <span className="ops-item-position" aria-live="polite">รายการที่ {hasItems ? currentIndex + 1 : 0} จาก {total}</span>
    </div>
    <div className="ops-item-pager-actions">
      <button type="button" className="ops-button ops-button-secondary" onClick={onPrevious} disabled={!hasItems || currentIndex <= 0}><Icon name="arrow" />ก่อนหน้า</button>
      <button type="button" className="ops-button ops-button-primary" onClick={onNext} disabled={!hasItems || currentIndex >= total - 1}>ถัดไป<Icon name="arrow" /></button>
    </div>
  </nav>;
}

const SIDEBAR_SHORT_LABELS = {
  dashboard: "ภาพรวม",
  stations: "ทะเบียนสถานี",
  inspections: "รอบตรวจ",
  history: "ประวัติ",
};

const PAGE_RUNTIME = {
  getChecklistPageNavigationItems,
  attachmentIdsForRound, belongsToStation, Breadcrumb, buildInspectionSections, buildItemState, Button, CHECKLIST_POLICY_VERSION, ChecklistCoverageSummary, ChecklistEvidenceDrawer, ChecklistItem, ChecklistPager, ChecklistTaskQueue, CLEANING_POLICY_VERSION, CloseReadinessDialog, createId, createInspectionRound, createRevisionRound, createStationDraft, createStationProfileFromDraft, createUiDemoRound, createUiVehicleDemoRound, createVehicleReviewState, CustomSelect, DEFAULT_STATION_FORMAT, defaultMeta, deleteStoredAttachment, deleteStoredAttachments, domSafeId, EmptyState, EQUIPMENT_ORDER_VERSION, EquipmentCatalogAddPanel, EquipmentRow, EVIDENCE_CHECKLIST_SECTIONS, EvidenceField, filterVehicleSearchRowsByScope, formatDate, formatDateTime, getActivePhysicalEquipment, getCanonicalItemsForFormat, getCatalogItemDisplayLabel, getChecklistCoverageSummary, getChecklistScopeMeta, getChecklistWorkContext, getCloseReadiness, getCompanyContractorMatch, getCorrectionSummary, getEquipmentDisplayLabel, getEquipmentGroupsForRegister, getEquipmentIconName, getEquipmentType, getEquipmentTypeDisplayLabel, getInspectionProgressModel, getItemsForSnapshot, getNewRoundChecklistItems, getNextEquipmentIndex, synchronizeGeneratedAssetNos, getReportCoverMeta, getReportCoverReadiness, getRoundSummary, getSectionEvidenceStats, getStationChecklistItems, getStationChecklistSections, getStationFormatDefinition, getStationReadiness, getVehicleReviewContext, getVehicleReviewContextByKey, getVehicleReviewDetail, getVehicleReviewScopeEntries, getVehicleReviewScopeState, getVehicleReviewState, getVehicleSearchReviewSummary, getWimSortingSystemById, getWimSortingSystemInstances, getWimElectronicsHierarchyIssue, isWimElectronicsSubEquipmentType, Icon, inferReportCompanyId, isEvidenceBypassItemStatus, isEvidenceSlotComplete, isVehicleApiReviewItem, isVehicleReviewScopeState, isWimEquipment, isWimSortingSystemRecord, ITEM_LIBRARY_CATEGORIES, LaneAssignmentStep, makeEquipment, makeEquipmentFromCatalogItem, makeLane, MAX_ATTACHMENT_BYTES, navigate, normalizeItemCatalog, normalizeReportCoverMeta, normalizeVehicleReviewState, normalizeVehicleSearchState, PageHeader, parseHash, profileFor, ProgressBar, REPORT_COMPANIES, ReportMetadataFields, RoundCard, roundFor, saveStoredAttachment, setStationChecklistItemEnabled, setVehicleSearchEmptyResultAcknowledged, shortId, sortEquipmentForDisplay, STATION_DRAFT_TEMPLATE_VERSION, STATION_FORMATS, StationProfileRedesigned, StationSelect, StationSummary, StationSystemsSummary, StationTorSummary, StatusBadge, Stepper, UI_DEMO_ROUND_ID, UI_VEHICLE_DEMO_ROUND_ID, updateVehicleSearchReviewDetails, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, validateCorrectionReason, validateEquipmentDraft, validateStationDraft, VEHICLE_API_REVIEW_VERSION, VEHICLE_REVIEW_CONTEXT_OPTIONS, VEHICLE_REVIEW_SCOPE_VERSION, vehicleApiHref, WIM_SORTING_SYSTEM_CANONICAL_ID, updateVehicleSearchScope,
  activeContractAssignmentForStation, assignmentOverlaps, assignmentsForStation, assignmentsForWorkPackage, attachContractContextToRound, buildContractAgreementCoverSnapshot, buildContractContextSnapshot, contractAgreementCoversForContract, contractFor, contractLabel, createContractAgreementCover, createContractCommitteeMember, createContractDraft, createContractScopeItem, createContractStationAssignment, createContractWorkReport, createInspectionRoundContextLink, createRegionDraft, createWorkPackageDraft, getContractContextForRound, getContractCoreCompleteness, getLatestInspectionRoundContextLink, hasDuplicateContractNumber, nextContractAgreementCoverVersion, normalizeContractAgreementData, normalizeContractWorkspaceState, regionsForContract, stationsForWorkPackage, validateContractAgreementCover, validateWorkPackageDraft, workPackageFor, workPackageLabel, workPackagesForContract,
};
PAGE_RUNTIME.MasterSelect = MasterSelect;
PAGE_RUNTIME.SearchableMultiSelect = SearchableMultiSelect;
PAGE_RUNTIME.ContractContextSelect = ContractContextSelect;

// Contextual station setup also needs the station-TOR-only groups (for
// example 1.1.5 for the 3D package) in addition to the legacy Item Library.
PAGE_RUNTIME.ThaiDatePicker = ThaiDatePicker;
PAGE_RUNTIME.REPORT_COVER_FIELD_LABELS = REPORT_COVER_FIELD_LABELS;
PAGE_RUNTIME.REPORT_COVER_REQUIRED_FIELDS = REPORT_COVER_REQUIRED_FIELDS;
PAGE_RUNTIME.appendStationInspectionReportRevision = appendStationInspectionReportRevision;
PAGE_RUNTIME.saveStationInspectionReportCover = saveStationInspectionReportCover;
PAGE_RUNTIME.stationInspectionReportForRound = stationInspectionReportForRound;
PAGE_RUNTIME.ThaiDateTimePicker = ThaiDateTimePicker;
PAGE_RUNTIME.STATION_ASSET_CATEGORIES = STATION_ASSET_CATEGORIES;
Object.assign(PAGE_RUNTIME, createVehicleReviewComponents({ AttachmentField, EvidenceField, StatusBadge, ThaiDateTimePicker }));
PAGE_RUNTIME.PrintableReport = createPrintableReportComponent({ ...PAGE_RUNTIME, REPORT_TEXT, getStoredAttachment, statusClass, REPORT_COPY, getPresentationEvidenceCaption, STATUS_META, getReportCompany, VEHICLE_REVIEW_CORRECTION_TARGET_OPTIONS, VEHICLE_REVIEW_REASON_OPTIONS, buildReportTemplateModel, CompanyReportCover });

const contextualStationRuntime = { ...PAGE_RUNTIME, VehicleSearchConfigPanel, getCentralChecklistSectionName, getCentralEquipmentName, getCentralSystemCategoryName, getCentralSystemNameForRecord, formatCentralNameEnglishFirst };
const routeRuntime = (key, runtime = PAGE_RUNTIME) => createPageRuntime(runtime, PAGE_RUNTIME_KEYS[key]);

const PAGE_COMPONENTS = Object.freeze({
  dashboard: createDashboardPage(routeRuntime("dashboard")),
  newContract: createNewContractPage(routeRuntime("contractNew")),
  contractEdit: createNewContractPage(routeRuntime("contractNew")),
  contractDetail: createContractDetailPage(routeRuntime("contractDetail")),
  contractAgreementCover: createContractAgreementCoverPage(routeRuntime("contractAgreementCover")),
  workPackage: createWorkPackagePage(routeRuntime("workPackage")),
  contractReportNew: createContractReportPage(routeRuntime("contractReport")),
  referenceData: createReferenceDataPage(routeRuntime("referenceData")),
  stations: createStationsPage(routeRuntime("stations")),
  stationDetail: createStationDetailPage(routeRuntime("stationDetail")),
  newStation: createContextualStationPage(routeRuntime("contextualStation", contextualStationRuntime)),
  inspections: createInspectionsPage(routeRuntime("inspections")),
  newInspection: createNewInspectionPage(routeRuntime("newInspection")),
  checklist: createChecklistPage(routeRuntime("checklist")),
  vehicleApi: createVehicleApiReviewPage(routeRuntime("vehicleApi")),
  vehicleApiReport: createVehicleApiReportPage(),
  history: createHistoryPage(routeRuntime("history")),
  historyDetail: createChecklistPage(routeRuntime("checklist")),
  historyVehicleApi: createVehicleApiReviewPage(routeRuntime("vehicleApi")),
  historyVehicleApiReport: createVehicleApiReportPage(),
  historyRevise: createRevisionPage(routeRuntime("revision")),
});

function App() {
  initializeRouteHistory();
  const serverStorage = isServerStorageEnabled();
  const [route, setRoute] = useState(() => parseHash());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarToggleRef = useRef(null);
  const [bootstrap] = useState(() => serverStorage ? { state: createEmptyChecklistState() } : loadChecklistBootstrap());
  const [state, setState] = useState(() => bootstrap.state);
  const [toast, setToast] = useState("");
  const [savedAt, setSavedAt] = useState(null);
  const [confirmRequest, setConfirmRequest] = useState(null);
  const [purgeRetry, setPurgeRetry] = useState(null);
  const confirmResolverRef = useRef(null);
  const notify = (message) => { setToast(message); window.clearTimeout(window.__checklistToast); window.__checklistToast = window.setTimeout(() => setToast(""), 2800); };
  const serverSync = useServerWorkspaceSync({ serverStorage, setState, notify });
  const { authConfig, authRequired, currentUser, downloadConflictDraft, persistServerState, remoteLoaded, returnToServerState, serverConflict } = serverSync;
  const handleShellRouteClick = (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target?.closest?.('a[href^="#/"]');
    if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
    event.preventDefault();
    navigate(link.getAttribute("href"));
  };
  const persistState = (payload, reason = "state-update") => {
    if (serverStorage) return persistServerState(payload, reason);
    return saveChecklistState(payload);
  };
  const update = (recipe, message = "", reason = "state-update") => {
    let resolvePersistence;
    const persistence = new Promise((resolve) => { resolvePersistence = resolve; });
    setState((current) => {
      const next = typeof recipe === "function" ? recipe(current) : recipe;
      const payload = { ...next, ui: { ...(next.ui || {}), lastSavedAt: new Date().toISOString() } };
      try {
        Promise.resolve(persistState(payload, reason)).then(resolvePersistence, () => resolvePersistence(null));
      } catch {
        resolvePersistence(null);
      }
      return payload;
    });
    setSavedAt(Date.now());
    if (message) notify(message);
    return persistence;
  };
  useEffect(() => {
    const pendingIds = [...new Set((Array.isArray(state.impsPurgePendingAttachmentIds) ? state.impsPurgePendingAttachmentIds : []).filter(Boolean))];
    if (!pendingIds.length) return undefined;
    let cancelled = false;
    deleteStoredAttachments(pendingIds).then(() => {
      if (cancelled) return;
      setState((current) => {
        const currentPending = Array.isArray(current.impsPurgePendingAttachmentIds) ? current.impsPurgePendingAttachmentIds : [];
        if (!currentPending.some((id) => pendingIds.includes(id))) return current;
        const next = { ...current, impsPurgePendingAttachmentIds: currentPending.filter((id) => !pendingIds.includes(id)) };
        persistState(next, "attachment-purge");
        return next;
      });
    }).catch(() => {
      if (!cancelled) notify("ลบไฟล์แนบของ ImPS ไม่สำเร็จ จะลองใหม่เมื่อเปิดระบบครั้งถัดไป");
    });
    return () => { cancelled = true; };
  }, [state.impsPurgePendingAttachmentIds]);
  useEffect(() => {
    const pendingIds = [...new Set((Array.isArray(state.videoPurgePendingAttachmentIds) ? state.videoPurgePendingAttachmentIds : []).filter(Boolean))];
    if (!pendingIds.length) return undefined;
    let cancelled = false;
    deleteStoredAttachments(pendingIds).then(() => {
      if (cancelled) return;
      setState((current) => {
        const currentPending = Array.isArray(current.videoPurgePendingAttachmentIds) ? current.videoPurgePendingAttachmentIds : [];
        const remaining = currentPending.filter((id) => !pendingIds.includes(id));
        if (remaining.length === currentPending.length) return current;
        const next = { ...current };
        if (remaining.length) next.videoPurgePendingAttachmentIds = remaining;
        else delete next.videoPurgePendingAttachmentIds;
        persistState(next, "attachment-purge");
        return next;
      });
    }).catch(() => {
      if (!cancelled) notify("ลบไฟล์แนบวิดีโอเก่าไม่สำเร็จ ระบบจะลองใหม่เมื่อเปิดครั้งถัดไป");
    });
    return () => { cancelled = true; };
  }, [state.videoPurgePendingAttachmentIds]);
  useEffect(() => {
    const onHashChange = () => {
      const nextRoute = parseHash();
      if (nextRoute.redirectTo) {
        replaceRoute(nextRoute.redirectTo);
        return;
      }
      setRoute(nextRoute);
    };
    window.addEventListener("hashchange", onHashChange);
    if (!window.location.hash) replaceRoute("#/dashboard");
    else if (parseHash().redirectTo) replaceRoute(parseHash().redirectTo);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  useEffect(() => {
    if (route.name === "historyDetail" && route.query?.edit === "1") {
      navigate(`#/history/${encodeURIComponent(route.id)}/revise`);
      return;
    }
    if (route.name === "stations" && route.query?.stationId && state.stationProfiles.some((profile) => profile.id === route.query.stationId)) {
      navigate(`#/stations/${encodeURIComponent(route.query.stationId)}`);
    }
  }, [route.name, route.id, route.query?.edit, route.query?.stationId, state.stationProfiles]);
  useEffect(() => { const heading = document.getElementById("page-heading"); if (heading) requestAnimationFrame(() => heading.focus()); }, [route.name, route.id]);
  const requestConfirm = useCallback((request) => {
    if (confirmResolverRef.current) return Promise.resolve(false);
    return new Promise((resolve) => {
      confirmResolverRef.current = resolve;
      setConfirmRequest(request);
    });
  }, []);
  const resolveConfirm = useCallback((result) => {
    const resolver = confirmResolverRef.current;
    confirmResolverRef.current = null;
    setConfirmRequest(null);
    resolver?.(result);
  }, []);
  const archiveStation = async (profile) => {
    if (!profile) return;
    const stationCode = String(profile.stationCode || "").trim() || "สถานีนี้";
    const archived = profile.active === false;
    const confirmed = await requestConfirm({
      title: archived ? `เปิดใช้งานสถานี ${stationCode}` : `ปิดใช้งานสถานี ${stationCode}`,
      description: archived
        ? "สถานีจะกลับมาเลือกสร้างรอบการตรวจใหม่ได้ ข้อมูลฉบับร่าง ประวัติ และข้อมูลประจำรอบเดิมจะคงเดิม"
        : "สถานีจะไม่แสดงในตัวเลือกสร้างรอบการตรวจใหม่ แต่ฉบับร่าง ประวัติ และข้อมูลประจำรอบเดิมจะคงอยู่ครบถ้วน",
      confirmLabel: archived ? "ยืนยันเปิดใช้งานสถานี" : "ยืนยันปิดใช้งานสถานี",
      confirmVariant: archived ? "primary" : "danger-ghost",
      confirmIcon: archived ? "refresh" : "archive",
    });
    if (!confirmed) return;
    update((current) => {
      const nextProfiles = current.stationProfiles.map((entry) => entry.id === profile.id ? { ...entry, active: archived } : entry);
      const activeProfiles = nextProfiles.filter((entry) => entry.active !== false);
      const nextStationId = archived
        ? (activeProfiles.some((entry) => entry.id === current.activeStationId) ? current.activeStationId : activeProfiles[0]?.id || null)
        : profile.id;
      const currentActiveRound = current.inspectionRounds.find((round) => round.id === current.activeRoundId) || null;
      const nextActiveRound = (currentActiveRound?.stationId === nextStationId ? currentActiveRound : null)
        || current.inspectionRounds.find((round) => round.status === "draft" && round.stationId === nextStationId)
        || null;
      return {
        ...current,
        stationProfiles: nextProfiles,
        activeStationId: nextStationId,
        activeRoundId: nextActiveRound?.id || null,
        ui: { ...(current.ui || {}), selectedStationId: nextStationId },
      };
    }, archived ? "เปิดใช้งานสถานีแล้ว" : "ปิดใช้งานสถานีแล้ว");
  };
  const finishStationPurge = async (stationId, impact) => {
    try {
      await deleteStoredAttachments(impact.attachmentIds);
    } catch (error) {
      const message = error?.message || "ลบไฟล์แนบไม่สำเร็จ จึงยังไม่ลบข้อมูลสถานี";
      setPurgeRetry({ stationId, impact, message, busy: false });
      notify(message);
      return false;
    }
    setPurgeRetry(null);
    update((current) => purgeStationFromState(current, stationId), "ลบสถานีและข้อมูลที่เกี่ยวข้องแล้ว");
    navigate("#/stations");
    return true;
  };
  const retryStationPurge = async () => {
    const pending = purgeRetry;
    if (!pending || pending.busy) return;
    setPurgeRetry((current) => current ? { ...current, busy: true } : current);
    await finishStationPurge(pending.stationId, pending.impact);
  };
  const permanentlyDeleteStation = async (profile) => {
    if (!profile) return;
    const stationCode = String(profile.stationCode || "").trim();
    const impact = buildStationDeletionImpact(state, profile.id);
    const firstConfirmed = await requestConfirm({
      title: `ลบสถานี ${stationCode || "นี้"} ถาวร`,
      description: "การดำเนินการนี้ย้อนกลับไม่ได้ และไม่มี Backup หรือ Undo อัตโนมัติ ข้อมูลของสถานีนี้จะถูกลบออกจาก browser เครื่องนี้ทั้งหมด",
      details: [
        { label: "สถานี", value: `${stationCode || "—"} · ${profile.stationName || "—"}` },
        { label: "อุปกรณ์", value: `${impact.counts.assets} รายการ` },
        { label: "รอบร่าง", value: `${impact.counts.draftRounds} รอบ` },
        { label: "ประวัติปิดแล้ว", value: `${impact.counts.closedHistory} รอบ` },
        { label: "ข้อมูลประจำรอบ (Snapshot)", value: `${impact.counts.snapshots} ชุด` },
        { label: "ไฟล์แนบที่จะลบ", value: `${impact.counts.attachments} ไฟล์` },
      ],
      confirmLabel: "ดำเนินการต่อ",
      confirmVariant: "danger",
      confirmIcon: "delete",
    });
    if (!firstConfirmed) return;
    const secondConfirmed = await requestConfirm({
      title: "ยืนยันการลบถาวรอีกครั้ง",
      description: "ข้อมูลสถานี รอบการตรวจ ประวัติ ข้อมูลประจำรอบ และไฟล์แนบที่ไม่มีสถานีอื่นใช้งานจะถูกลบถาวร หากต้องการดำเนินการ ให้พิมพ์รหัสสถานีให้ตรงทุกตัว",
      requiredCode: stationCode,
      inputLabel: "พิมพ์รหัสสถานีเพื่อยืนยัน",
      confirmLabel: "ลบสถานีและข้อมูลทั้งหมด",
      confirmVariant: "danger",
      confirmIcon: "delete",
    });
    if (!secondConfirmed) return;
    await finishStationPurge(profile.id, impact);
  };
  const permanentlyDeleteContract = async (contract) => {
    if (!contract) return;
    const impact = buildContractDeletionImpact(state, contract.id);
    const contractCode = String(contract.contractNo || contract.id || "").trim();
    const firstConfirmed = await requestConfirm({
      title: `ลบสัญญา ${contractCode || "นี้"} ถาวร`,
      description: "การดำเนินการนี้ย้อนกลับไม่ได้ ข้อมูลสัญญา งวดงาน การผูกสถานี รายงานหน้าปก และ Snapshot หน้าปกของสัญญานี้จะถูกลบออกจากระบบ",
      details: [
        { label: "สัญญา", value: `${contractCode || "—"} · ${contract.title || contract.projectName || "ไม่มีชื่อ"}` },
        { label: "งวดงาน", value: `${impact.counts.workPackages} งวด` },
        { label: "การผูกสถานี", value: `${impact.counts.assignments} รายการ` },
        { label: "รายงานหน้าปก", value: `${impact.counts.reports} รายการ` },
        { label: "หน้าปกสัญญาที่ออกแล้ว", value: `${impact.counts.covers} ฉบับ` },
        { label: "ประวัติการตรวจ", value: `${impact.counts.preservedHistory} รายการจะคงไว้` },
      ],
      confirmLabel: "ดำเนินการต่อ",
      confirmVariant: "danger",
      confirmIcon: "delete",
    });
    if (!firstConfirmed) return;
    const secondConfirmed = await requestConfirm({
      title: "ยืนยันการลบสัญญาถาวรอีกครั้ง",
      description: "ข้อมูลสัญญาและข้อมูลลูกที่ระบุไว้จะถูกลบถาวร ส่วน Station Profile และประวัติการตรวจจะไม่ถูกลบ หากต้องการดำเนินการ ให้พิมพ์เลขที่สัญญาให้ตรงทุกตัว",
      requiredCode: contractCode,
      inputLabel: "พิมพ์เลขที่สัญญาเพื่อยืนยัน",
      inputMismatchText: "เลขที่สัญญายังไม่ตรง กรุณาตรวจสอบอีกครั้ง",
      confirmLabel: "ลบสัญญาและข้อมูลที่เกี่ยวข้อง",
      confirmVariant: "danger",
      confirmIcon: "delete",
    });
    if (!secondConfirmed) return;
    update((current) => purgeContractFromState(current, contract.id), "ลบสัญญาและข้อมูลที่เกี่ยวข้องถาวรแล้ว");
    navigate("#/dashboard");
  };
  const deleteRound = async (round) => {
    if (!round) return;
    const closed = round.status === "closed";
    const roundLabel = `${round.snapshot?.stationCode || "สถานี"} · รอบการตรวจ ${shortId(round.id)}`;
    const confirmed = await requestConfirm({
      title: closed ? `ลบประวัติรอบการตรวจ ${roundLabel}` : `ลบรอบการตรวจ ${roundLabel}`,
      description: closed
        ? "รอบนี้จะถูกนำออกจากประวัติและรายงานสถานี พร้อม Snapshot และผลตรวจ ไฟล์หลักฐานจะลบเมื่อไม่มีรอบอื่นใช้อยู่ การลบย้อนกลับจากหน้าแอปไม่ได้"
        : "ข้อมูลที่กรอกในรอบนี้จะถูกลบจากระบบ",
      details: closed ? [
        { label: "สถานี", value: round.snapshot?.stationName || round.snapshot?.stationCode || "—" },
        { label: "วันที่ตรวจ", value: formatDate(round.meta?.inspectionDate || round.createdAt) },
        { label: "รหัสรอบ", value: shortId(round.id) },
      ] : undefined,
      requiredCode: closed ? shortId(round.id) : undefined,
      inputLabel: closed ? "พิมพ์รหัสรอบเพื่อยืนยัน" : undefined,
      inputMismatchText: closed ? "รหัสรอบยังไม่ตรง กรุณาตรวจสอบอีกครั้ง" : undefined,
      confirmLabel: closed ? "ลบประวัตินี้" : "ยืนยันลบรอบการตรวจ",
      confirmVariant: "danger",
      confirmIcon: "delete",
    });
    if (!confirmed) return;
    const roundAttachmentIds = attachmentIdsForRoundAndAliases(state, round);
    const remainingAttachmentIds = new Set(attachmentIdsForState(removeInspectionRoundFromState(state, round)));
    const attachmentsToDelete = roundAttachmentIds.filter((id) => !remainingAttachmentIds.has(id));
    const persisted = await update(
      (current) => removeInspectionRoundFromState(current, round),
      "",
      "inspection-round-delete",
    );
    const persistenceSucceeded = !serverStorage || Number.isFinite(Number(persisted?.version));
    if (persistenceSucceeded) {
      notify(closed ? "ลบประวัติรอบการตรวจแล้ว" : "ลบรอบการตรวจแล้ว");
      await deleteStoredAttachments(attachmentsToDelete).catch(() => notify("ลบรอบการตรวจแล้ว แต่มีบางไฟล์แนบที่ลบจากพื้นที่จัดเก็บไม่สำเร็จ"));
    } else {
      notify("รอบนี้ถูกนำออกจากหน้าจอนี้ แต่การบันทึกส่วนกลางยังไม่สำเร็จ จึงยังไม่ลบไฟล์หลักฐาน");
    }
    if (route.id === round.id) navigate(closed ? "#/history" : "#/inspections");
  };
  const activeRoute = useMemo(() => primaryRouteFor(route.name), [route.name]);
  const backFallbackTarget = getBackFallbackTarget(route);
  const canGoBack = canNavigateBackInApp();
  if (serverStorage && authRequired) return <LocalLoginScreen authConfig={authConfig} onLogin={() => window.location.reload()} />;
  if (serverStorage && currentUser?.mustChangePassword) return <PasswordChangeScreen onComplete={() => window.location.reload()} />;
  if (serverStorage && !remoteLoaded) {
    return <main className="ops-main" aria-live="polite"><div className="ops-empty-state"><strong>กำลังเชื่อมต่อฐานข้อมูลส่วนกลาง</strong><span>กำลังโหลดข้อมูลจาก Checklist API…</span></div></main>;
  }
  const isReadOnlySurface = route.name === "historyDetail" || route.name === "historyVehicleApi" || route.name === "historyVehicleApiReport"
    || (["checklist", "vehicleApi", "vehicleApiReport"].includes(route.name) && state.inspectionRounds.some((round) => round.id === route.id && round.status === "closed"));
  const pageLayout = {
    dashboard: "dashboard",
    newContract: "contract-setup",
    contractEdit: "contract-setup",
    contractDetail: "contract-detail",
    contractAgreementCover: "contract-agreement-cover",
    workPackage: "contract-work-package",
    contractReportNew: "contract-report",
    stations: "station-directory",
    stationDetail: "station-workspace",
    newStation: "station-setup",
    inspections: "round-queue",
    newInspection: "round-setup",
    checklist: "inspection-workspace",
    vehicleApi: "vehicle-review",
    vehicleApiReport: "vehicle-report",
    history: "history-library",
    historyDetail: "history-detail",
    historyVehicleApi: "history-vehicle-review",
    historyVehicleApiReport: "history-vehicle-report",
    historyRevise: "revision-setup",
    adminUsers: "user-management",
  }[route.name] || "dashboard";
  const isDeepWorkspace = ["inspection-workspace", "vehicle-review", "history-detail", "history-vehicle-review"].includes(pageLayout);
  const shellSaveState = serverConflict
    ? "มี draft ที่ต้องตรวจ"
    : isReadOnlySurface
    ? "อ่านอย่างเดียว"
    : route.name === "newStation"
      ? "ร่างชั่วคราว · บันทึกเมื่อยืนยัน"
    : route.name === "checklist" && route.id === UI_DEMO_ROUND_ID
      ? "ตัวอย่าง · ไม่บันทึกรอบจริง"
      : savedAt
        ? "บันทึกแล้ว"
        : "พร้อมบันทึกอัตโนมัติ";
  const page = route.name === "adminUsers" ? <AdminUsersPage state={state} /> : renderPage(route, PAGE_COMPONENTS, {
    dashboard: { state, update },
    newContract: { state, update, notify, route },
    contractEdit: { state, update, notify, route },
    contractDetail: { state, update, notify, onDeleteContract: permanentlyDeleteContract, route },
    contractAgreementCover: { state, update, notify, route },
    workPackage: { state, update, notify, route },
    contractReportNew: { state, update, notify, route },
    referenceData: { state, update, notify, route },
    stations: { state },
    stationDetail: { state, update, notify, requestConfirm, onArchiveStation: archiveStation, onPurgeStation: permanentlyDeleteStation, route },
    newStation: { state, update, requestConfirm },
    inspections: { state, onDelete: deleteRound },
    newInspection: { state, update, notify, route },
    checklist: { state, update, notify, requestConfirm, route, savedAt },
    vehicleApi: { state, update, notify, route },
    vehicleApiReport: { state, route },
    history: { state, onDelete: deleteRound },
    historyDetail: { state, update, notify, requestConfirm, route, readOnly: true, savedAt },
    historyVehicleApi: { state, update, notify, route },
    historyVehicleApiReport: { state, route },
    historyRevise: { state, update, notify, requestConfirm, route },
  });
  return <div data-page-layout={pageLayout} onClick={handleShellRouteClick} className={`ops-shell ${sidebarCollapsed ? "is-sidebar-collapsed" : ""} ${isDeepWorkspace ? "is-deep-workspace" : ""}`.trim()}><a className="ops-skip-link" href="#main-content">ข้ามไปยังเนื้อหาหลัก</a><aside className="ops-sidebar" aria-label="เมนูหลัก"><div className="ops-brand"><span className="ops-brand-mark"><Icon name="clipboard" /></span><span className="ops-brand-copy"><strong>CHECKLIST</strong><small>Operations Hub</small></span><button ref={sidebarToggleRef} type="button" className="ops-sidebar-toggle" aria-label={sidebarCollapsed ? "ขยายเมนู" : "ย่อเมนู"} aria-expanded={!sidebarCollapsed} aria-controls="primary-navigation" title={sidebarCollapsed ? "ขยายเมนู" : "ย่อเมนู"} onClick={() => setSidebarCollapsed((current) => !current)}><Icon name="arrow" /></button></div><nav id="primary-navigation" className="ops-main-nav" aria-label="ส่วนของระบบ">{PRIMARY_ROUTES.map((item) => <a key={item.key} className={activeRoute === item.key ? "is-active" : ""} aria-current={activeRoute === item.key ? "page" : undefined} aria-label={item.label} title={item.label} href={item.hash}><Icon name={item.key === "dashboard" ? "home" : item.key === "contracts" ? "archive" : item.key === "stations" ? "building" : item.key === "inspections" ? "list" : "archive"} /><span className="ops-nav-label-full" aria-hidden="true">{item.label}</span><span className="ops-nav-label-short" aria-hidden="true">{SIDEBAR_SHORT_LABELS[item.key] || item.label}</span></a>)}{serverStorage && currentUser?.role === "admin" && <a className={activeRoute === "adminUsers" ? "is-active" : ""} aria-current={activeRoute === "adminUsers" ? "page" : undefined} aria-label="จัดการผู้ใช้" title="จัดการผู้ใช้" href="#/admin/users"><Icon name="settings" /><span className="ops-nav-label-full" aria-hidden="true">จัดการผู้ใช้</span><span className="ops-nav-label-short" aria-hidden="true">ผู้ใช้</span></a>}</nav></aside><main id="main-content" className="ops-main" tabIndex="-1"><header className="ops-topbar"><div className="ops-topbar-leading"><button type="button" className="ops-button ops-button-secondary ops-shell-back" onClick={() => navigateBack(backFallbackTarget)} disabled={!canGoBack && !backFallbackTarget}><Icon name="arrow" />ย้อนกลับ</button><div className="ops-topbar-context"><p className="ops-eyebrow">FIELD OPERATIONS / CHECKLIST</p></div></div><div className="ops-topbar-actions">{currentUser && <><span className="ops-current-user">{currentUser.displayName}</span><button type="button" className="ops-button ops-button-secondary ops-logout-button" onClick={async () => { await fetch("/api/v1/auth/logout", { method: "POST", credentials: "include" }); window.location.reload(); }}>ออกจากระบบ</button></>}<div className={`ops-save-indicator ${isReadOnlySurface ? "is-readonly" : ""} ${serverConflict ? "is-conflict" : ""} ${route.name === "checklist" && route.id === UI_DEMO_ROUND_ID ? "is-demo" : ""}`.trim()} role="status" aria-live="polite"><span className="ops-live-dot" /><span>{shellSaveState}</span></div></div></header>{serverConflict && <section className="ops-server-conflict" role="alert" aria-live="assertive"><div><strong>การบันทึกชนกับข้อมูลส่วนกลาง</strong><p>{serverConflict.draftPreserved ? "ระบบเก็บ draft ไว้ในเบราว์เซอร์และหยุดซิงก์อัตโนมัติเพื่อป้องกันการเขียนทับ ดาวน์โหลดไฟล์เพื่อเก็บสำเนาและตรวจรวมข้อมูลก่อนดำเนินการต่อ" : "การบันทึก draft ลงเครื่องไม่สำเร็จ ข้อมูลยังอยู่ในหน่วยความจำของหน้านี้ ดาวน์โหลดไฟล์ทันทีและอย่าปิดหน้านี้"}</p></div><div className="ops-server-conflict-actions"><button type="button" className="ops-button ops-button-secondary" onClick={downloadConflictDraft}>ดาวน์โหลด draft (JSON)</button><button type="button" className="ops-button ops-button-danger" disabled={!serverConflict.downloaded} onClick={() => returnToServerState(requestConfirm).then((loaded) => { if (loaded) setSavedAt(null); })}>ทิ้ง draft และโหลดข้อมูลส่วนกลาง</button></div></section>}<ContractContextBar state={state} route={route} />{page}</main>{purgeRetry ? <div className="ops-toast ops-toast-retry" role="alert" aria-live="assertive"><Icon name="alert" /><span>{purgeRetry.message}</span><Button onClick={retryStationPurge} variant="secondary" icon="refresh" disabled={purgeRetry.busy}>{purgeRetry.busy ? "กำลังลองใหม่..." : "ลองลบไฟล์แนบอีกครั้ง"}</Button></div> : toast && <div className="ops-toast" role="status" aria-live="polite"><Icon name="check" />{toast}</div>}<ConfirmDialog request={confirmRequest} onResolve={resolveConfirm} /></div>;
}

export default App;
