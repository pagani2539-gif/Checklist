/*
 * Contract-first context for the field-operations UI.
 *
 * This module deliberately owns only the contract topology and the immutable
 * context copied into a round/report. Station Profile and Inspection Round
 * remain the source of truth for station configuration and inspection data.
 */

import { DEFAULT_REGION_DEFINITIONS, mergeLegacyReferenceValues, normalizeReferenceData, provinceOptionFor } from "./reference-data.js";

function text(value) {
  return String(value ?? "").trim();
}

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function now() {
  return new Date().toISOString();
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function unique(values) {
  return [...new Set(list(values).map((value) => text(value)).filter(Boolean))];
}

export const CONTRACT_STATUS_OPTIONS = [
  { value: "draft", label: "ร่าง" },
  { value: "active", label: "ใช้งาน" },
  { value: "closed", label: "ปิดสัญญา" },
];

export const WORK_PACKAGE_STATUS_OPTIONS = [
  { value: "draft", label: "ร่างงวด" },
  { value: "active", label: "กำลังดำเนินงาน" },
  { value: "closed", label: "ปิดงวด" },
];

export const CONTRACT_AGREEMENT_COVER_TEMPLATE_ID = "contract-agreement-cover-v1";

function nonNegativeInteger(value) {
  if (value === null || value === undefined || value === "") return "";
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? String(Math.trunc(number)) : "";
}

function orderedList(value, normalize) {
  return list(value)
    .map((entry, index) => normalize({ ...(entry || {}), order: entry?.order ?? index }))
    .sort((a, b) => a.order - b.order);
}

export function createContractScopeItem(input = {}) {
  const timestamp = now();
  return normalizeContractScopeItem({ id: input.id || makeId("contract-scope"), ...input, createdAt: input.createdAt || timestamp, updatedAt: input.updatedAt || timestamp });
}

export function normalizeContractScopeItem(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  return {
    id: text(source.id) || makeId("contract-scope"),
    description: text(source.description || source.text),
    order: Number.isFinite(Number(source.order)) ? Number(source.order) : 0,
    createdAt: source.createdAt || now(),
    updatedAt: source.updatedAt || source.createdAt || now(),
  };
}

export function createContractCommitteeMember(input = {}) {
  const timestamp = now();
  return normalizeContractCommitteeMember({ id: input.id || makeId("contract-committee"), ...input, createdAt: input.createdAt || timestamp, updatedAt: input.updatedAt || timestamp });
}

export function normalizeContractCommitteeMember(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  return {
    id: text(source.id) || makeId("contract-committee"),
    name: text(source.name),
    role: text(source.role),
    order: Number.isFinite(Number(source.order)) ? Number(source.order) : 0,
    createdAt: source.createdAt || now(),
    updatedAt: source.updatedAt || source.createdAt || now(),
  };
}

export function normalizeContractAgreementData(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  return {
    emblemPath: text(source.emblemPath),
    scopeItems: orderedList(source.scopeItems, normalizeContractScopeItem),
    durationDays: nonNegativeInteger(source.durationDays),
    contractValue: text(source.contractValue),
    penaltyPerDay: text(source.penaltyPerDay),
    committeeMembers: orderedList(source.committeeMembers, normalizeContractCommitteeMember),
    notes: text(source.notes),
  };
}

function moneyValue(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function validateContractAgreementCover(contract = {}, agreementCover = {}) {
  const cover = normalizeContractAgreementData(agreementCover);
  const errors = {};
  if (!text(contract.contractNo)) errors.contractNo = "กรุณาระบุเลขที่สัญญา";
  if (!text(contract.contractDate)) errors.contractDate = "กรุณาระบุวันที่สัญญา";
  if (!text(contract.title || contract.projectName)) errors.title = "กรุณาระบุชื่อสัญญา";
  if (!text(contract.agency)) errors.agency = "กรุณาระบุหน่วยงานเจ้าของงาน";
  if (!text(contract.contractor)) errors.contractor = "กรุณาระบุผู้รับจ้าง";
  if (!text(contract.startDate)) errors.startDate = "กรุณาระบุวันเริ่มสัญญา";
  if (!text(contract.endDate)) errors.endDate = "กรุณาระบุวันสิ้นสุดสัญญา";
  if (text(contract.startDate) && text(contract.endDate) && contract.startDate > contract.endDate) errors.endDate = "วันสิ้นสุดต้องไม่น้อยกว่าวันเริ่มสัญญา";
  if (!cover.scopeItems.some((item) => item.description)) errors.scopeItems = "กรุณาเพิ่มขอบเขตงานอย่างน้อย 1 รายการ";
  if (!cover.durationDays) errors.durationDays = "กรุณาระบุระยะเวลาตามเอกสาร";
  if (moneyValue(cover.contractValue) === null) errors.contractValue = "กรุณาระบุมูลค่าสัญญาเป็นตัวเลข";
  if (moneyValue(cover.penaltyPerDay) === null) errors.penaltyPerDay = "กรุณาระบุค่าปรับรายวันเป็นตัวเลข";
  if (!cover.committeeMembers.some((member) => member.name && member.role)) errors.committeeMembers = "กรุณาเพิ่มคณะกรรมการอย่างน้อย 1 รายการ";
  return { valid: Object.keys(errors).length === 0, errors };
}

export function createRegionDraft(input = {}) {
  const timestamp = now();
  return normalizeRegion({ id: input.id || makeId("region"), ...input, createdAt: input.createdAt || timestamp, updatedAt: input.updatedAt || timestamp });
}

export function normalizeRegion(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  return {
    id: text(source.id) || makeId("region"),
    code: text(source.code),
    name: text(source.name) || text(source.code) || "ไม่ระบุภาค",
    nameEn: text(source.nameEn),
    active: source.active !== false,
    createdAt: source.createdAt || now(),
    updatedAt: source.updatedAt || source.createdAt || now(),
  };
}

export function defaultRegions() {
  return DEFAULT_REGION_DEFINITIONS.map((region) => normalizeRegion(region));
}

export function createContractDraft(input = {}) {
  const timestamp = now();
  return normalizeContract({ id: input.id || makeId("contract"), ...input, createdAt: input.createdAt || timestamp, updatedAt: input.updatedAt || timestamp });
}

export function normalizeContract(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  return {
    id: text(source.id) || makeId("contract"),
    contractNo: text(source.contractNo),
    title: text(source.title) || text(source.projectName) || "สัญญาใหม่",
    projectName: text(source.projectName) || text(source.title),
    contractDate: text(source.contractDate),
    contractorId: text(source.contractorId),
    contractor: text(source.contractor),
    agencyId: text(source.agencyId),
    agency: text(source.agency),
    regionIds: unique(source.regionIds),
    startDate: text(source.startDate),
    endDate: text(source.endDate),
    status: CONTRACT_STATUS_OPTIONS.some((option) => option.value === source.status) ? source.status : "draft",
    reportCompanyId: text(source.reportCompanyId) || "ntr",
    logoPath: text(source.logoPath),
    notes: text(source.notes),
    agreementCover: normalizeContractAgreementData(source.agreementCover || source.contractCover),
    createdAt: source.createdAt || now(),
    updatedAt: source.updatedAt || source.createdAt || now(),
  };
}

const CONTRACT_CORE_FIELDS = Object.freeze([
  ["contractNo", "เลขที่สัญญา"],
  ["contractDate", "วันที่ลงนาม"],
  ["title", "ชื่อสัญญา"],
  ["agency", "หน่วยงานเจ้าของงาน"],
  ["contractor", "ผู้รับจ้าง"],
  ["startDate", "วันเริ่มสัญญา"],
  ["endDate", "วันสิ้นสุดสัญญา"],
]);

export function getContractCoreCompleteness(contract = {}) {
  const missingFields = CONTRACT_CORE_FIELDS.filter(([field]) => {
    const value = field === "title" ? contract?.title || contract?.projectName : contract?.[field];
    return !text(value) || (field === "title" && text(value) === "สัญญาใหม่" && contract?.status === "draft");
  }).map(([, label]) => label);
  const dateOrderError = text(contract?.startDate) && text(contract?.endDate) && text(contract.startDate) > text(contract.endDate);
  if (dateOrderError) missingFields.push("ช่วงวันสัญญา");
  const total = CONTRACT_CORE_FIELDS.length;
  return { valid: missingFields.length === 0, completed: Math.max(0, total - missingFields.length), total, missingFields, dateOrderError };
}

export function createWorkPackageDraft(input = {}) {
  const timestamp = now();
  return normalizeWorkPackage({ id: input.id || makeId("work-package"), ...input, createdAt: input.createdAt || timestamp, updatedAt: input.updatedAt || timestamp });
}

export function normalizeWorkPackage(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  return {
    id: text(source.id) || makeId("work-package"),
    contractId: text(source.contractId),
    packageNo: text(source.packageNo) || text(source.reportSequence),
    title: text(source.title) || "งวดงาน",
    reportSequence: text(source.reportSequence) || text(source.packageNo),
    periodStart: text(source.periodStart),
    periodEnd: text(source.periodEnd),
    status: WORK_PACKAGE_STATUS_OPTIONS.some((option) => option.value === source.status) ? source.status : "draft",
    description: text(source.description),
    createdAt: source.createdAt || now(),
    updatedAt: source.updatedAt || source.createdAt || now(),
  };
}

export function createContractStationAssignment(input = {}) {
  const timestamp = now();
  return normalizeContractStationAssignment({ id: input.id || makeId("assignment"), ...input, createdAt: input.createdAt || timestamp, updatedAt: input.updatedAt || timestamp });
}

export function normalizeContractStationAssignment(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  return {
    id: text(source.id) || makeId("assignment"),
    contractId: text(source.contractId),
    workPackageId: text(source.workPackageId),
    stationId: text(source.stationId),
    effectiveFrom: text(source.effectiveFrom),
    effectiveTo: text(source.effectiveTo),
    status: source.status === "inactive" ? "inactive" : "active",
    createdAt: source.createdAt || now(),
    updatedAt: source.updatedAt || source.createdAt || now(),
  };
}

export function createContractWorkReport(input = {}) {
  const timestamp = now();
  return normalizeContractWorkReport({ id: input.id || makeId("contract-report"), ...input, createdAt: input.createdAt || timestamp, updatedAt: input.updatedAt || timestamp });
}

export function normalizeContractWorkReport(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  return {
    id: text(source.id) || makeId("contract-report"),
    contractId: text(source.contractId),
    workPackageId: text(source.workPackageId),
    stationId: text(source.stationId),
    roundId: text(source.roundId),
    reportSequence: text(source.reportSequence),
    status: source.status === "final" ? "final" : "draft",
    templateId: text(source.templateId) || "contract-work-report-cover-v1",
    snapshot: source.snapshot && typeof source.snapshot === "object" ? structuredCloneSafe(source.snapshot) : null,
    createdAt: source.createdAt || now(),
    updatedAt: source.updatedAt || source.createdAt || now(),
  };
}

export function buildContractAgreementCoverSnapshot(contract = {}, regions = []) {
  const agreementCover = normalizeContractAgreementData(contract?.agreementCover || contract?.contractCover);
  return structuredCloneSafe({
    contractId: text(contract?.id),
    contractNo: text(contract?.contractNo),
    contractDate: text(contract?.contractDate),
    title: text(contract?.title || contract?.projectName),
    projectName: text(contract?.projectName || contract?.title),
    agencyId: text(contract?.agencyId),
    agency: text(contract?.agency),
    contractorId: text(contract?.contractorId),
    contractor: text(contract?.contractor),
    regionIds: unique(contract?.regionIds),
    regionNames: list(regions).map((region) => text(region?.name)).filter(Boolean),
    startDate: text(contract?.startDate),
    endDate: text(contract?.endDate),
    status: text(contract?.status),
    reportCompanyId: text(contract?.reportCompanyId),
    logoPath: text(contract?.logoPath),
    ...agreementCover,
    capturedAt: now(),
  });
}

export function createContractAgreementCover(input = {}) {
  const timestamp = now();
  return normalizeContractAgreementCover({ id: input.id || makeId("contract-cover"), ...input, createdAt: input.createdAt || timestamp, updatedAt: input.updatedAt || timestamp });
}

export function normalizeContractAgreementCover(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const version = Number(source.version);
  return {
    id: text(source.id) || makeId("contract-cover"),
    contractId: text(source.contractId || source.snapshot?.contractId),
    version: Number.isFinite(version) && version > 0 ? Math.trunc(version) : 1,
    status: source.status === "draft" ? "draft" : "issued",
    templateId: text(source.templateId) || CONTRACT_AGREEMENT_COVER_TEMPLATE_ID,
    snapshot: source.snapshot && typeof source.snapshot === "object" ? structuredCloneSafe(source.snapshot) : {},
    createdAt: source.createdAt || now(),
    updatedAt: source.updatedAt || source.createdAt || now(),
  };
}

export function contractAgreementCoversForContract(state, contractId) {
  return list(state?.contractAgreementCovers)
    .filter((entry) => entry.contractId === contractId)
    .sort((a, b) => b.version - a.version || String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function nextContractAgreementCoverVersion(covers = [], contractId) {
  return list(covers)
    .filter((entry) => entry.contractId === contractId)
    .reduce((highest, entry) => Math.max(highest, Number(entry.version) || 0), 0) + 1;
}

function structuredCloneSafe(value) {
  try { return JSON.parse(JSON.stringify(value)); } catch { return value; }
}

export function normalizeContractWorkspaceState(state = {}) {
  const source = state && typeof state === "object" ? state : {};
  const rawRegions = list(source.regions).map(normalizeRegion);
  const regions = rawRegions.length ? rawRegions : defaultRegions();
  const legacyContractors = list(source.contracts).map((entry) => entry?.contractor);
  const legacyAgencies = list(source.contracts).map((entry) => entry?.agency);
  let referenceData = normalizeReferenceData(source.referenceData);
  referenceData = mergeLegacyReferenceValues(referenceData, legacyContractors, "contractor");
  referenceData = mergeLegacyReferenceValues(referenceData, legacyAgencies, "agency");
  const contracts = list(source.contracts).map(normalizeContract).map((contract) => {
    const contractor = referenceData.contractors.find((entry) => entry.id === contract.contractorId || entry.name === contract.contractor);
    const agency = referenceData.agencies.find((entry) => entry.id === contract.agencyId || entry.name === contract.agency);
    return {
      ...contract,
      contractorId: contractor?.id || contract.contractorId,
      agencyId: agency?.id || contract.agencyId,
      contractor: contractor?.name || contract.contractor,
      agency: agency?.name || contract.agency,
    };
  });
  const workPackages = list(source.workPackages).map(normalizeWorkPackage).filter((entry) => !entry.contractId || contracts.some((contract) => contract.id === entry.contractId));
  const contractStationAssignments = list(source.contractStationAssignments)
    .map(normalizeContractStationAssignment)
    .filter((entry) => (!entry.contractId || contracts.some((contract) => contract.id === entry.contractId)) && (!entry.workPackageId || workPackages.some((workPackage) => workPackage.id === entry.workPackageId)));
  const contractWorkReports = list(source.contractWorkReports).map(normalizeContractWorkReport).filter((entry) => !entry.contractId || contracts.some((contract) => contract.id === entry.contractId));
  const contractAgreementCovers = list(source.contractAgreementCovers).map(normalizeContractAgreementCover).filter((entry) => !entry.contractId || contracts.some((contract) => contract.id === entry.contractId));
  const inspectionRoundContextLinks = list(source.inspectionRoundContextLinks)
    .map((entry, index) => normalizeInspectionRoundContextLink(entry, index))
    .filter(Boolean);
  const stationProfiles = list(source.stationProfiles).map((profile) => {
    if (profile?.provinceId || !profile?.province) return profile;
    const province = provinceOptionFor(profile.province, referenceData);
    return province ? { ...profile, provinceId: province.id } : profile;
  });
  return { ...source, regions, referenceData, contracts, stationProfiles, workPackages, contractStationAssignments, contractWorkReports, contractAgreementCovers, inspectionRoundContextLinks };
}

export function regionFor(state, regionId) {
  return list(state?.regions).find((region) => region.id === regionId) || null;
}

export function contractFor(state, contractId) {
  return list(state?.contracts).find((contract) => contract.id === contractId) || null;
}

export function normalizeInspectionRoundContextLink(source = {}, index = 0) {
  const raw = source && typeof source === "object" ? source : {};
  const contextSnapshot = raw.contextSnapshot && typeof raw.contextSnapshot === "object"
    ? structuredCloneSafe(raw.contextSnapshot)
    : null;
  const roundId = text(raw.roundId);
  const contractId = text(raw.contractId || contextSnapshot?.contractId);
  const workPackageId = text(raw.workPackageId || contextSnapshot?.workPackageId);
  if (!roundId || !contractId || !workPackageId) return null;
  return {
    id: text(raw.id) || `round-context-${roundId}-${index + 1}`,
    roundId,
    contractId,
    workPackageId,
    contextSnapshot: contextSnapshot || { contractId, workPackageId },
    linkedAt: text(raw.linkedAt) || now(),
    linkedByLabel: text(raw.linkedByLabel),
    replacesLinkId: text(raw.replacesLinkId) || null,
  };
}

export function createInspectionRoundContextLink({ roundId, context, linkedAt = now(), linkedByLabel = "", replacesLinkId = null } = {}) {
  const normalized = normalizeInspectionRoundContextLink({
    id: makeId("round-context"),
    roundId,
    contractId: context?.contractId,
    workPackageId: context?.workPackageId,
    contextSnapshot: context,
    linkedAt,
    linkedByLabel,
    replacesLinkId,
  });
  if (!normalized) throw new Error("ข้อมูลบริบทสัญญาสำหรับรอบตรวจไม่ครบ");
  return normalized;
}

export function getLatestInspectionRoundContextLink(state = {}, roundId) {
  return list(state?.inspectionRoundContextLinks)
    .filter((entry) => entry?.roundId === roundId)
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => {
      const timeDelta = String(left.entry.linkedAt || "").localeCompare(String(right.entry.linkedAt || ""));
      return timeDelta || left.index - right.index;
    })
    .at(-1)?.entry || null;
}

function contractContextIdForRecord(record) {
  return text(record?.contractId || record?.snapshot?.contractId || record?.meta?.contractId || record?.contractContext?.contractId);
}

export function buildContractDeletionImpact(state = {}, contractId) {
  const id = text(contractId);
  const contract = contractFor(state, id);
  const workPackages = list(state?.workPackages).filter((entry) => entry.contractId === id);
  const workPackageIds = new Set(workPackages.map((entry) => entry.id));
  const assignments = list(state?.contractStationAssignments).filter((entry) => entry.contractId === id || workPackageIds.has(entry.workPackageId));
  const reports = list(state?.contractWorkReports).filter((entry) => entry.contractId === id || workPackageIds.has(entry.workPackageId));
  const covers = list(state?.contractAgreementCovers).filter((entry) => entry.contractId === id);
  const inspectionRounds = list(state?.inspectionRounds).filter((entry) => contractContextIdForRecord(entry) === id);
  const inspectionHistory = list(state?.inspectionHistory).filter((entry) => contractContextIdForRecord(entry) === id);
  return {
    contractId: id,
    contract,
    workPackageIds: [...workPackageIds],
    counts: {
      workPackages: workPackages.length,
      assignments: assignments.length,
      reports: reports.length,
      covers: covers.length,
      preservedDraftRounds: inspectionRounds.filter((entry) => entry?.status !== "closed").length,
      preservedHistory: inspectionHistory.length + inspectionRounds.filter((entry) => entry?.status === "closed").length,
    },
  };
}

export function purgeContractFromState(state = {}, contractId) {
  const id = text(contractId);
  const impact = buildContractDeletionImpact(state, id);
  const workPackageIds = new Set(impact.workPackageIds);
  const contractFormDrafts = { ...(state.ui?.contractFormDrafts || {}) };
  delete contractFormDrafts[id];
  return {
    ...state,
    contracts: list(state.contracts).filter((entry) => entry.id !== id),
    workPackages: list(state.workPackages).filter((entry) => entry.contractId !== id),
    contractStationAssignments: list(state.contractStationAssignments).filter((entry) => entry.contractId !== id && !workPackageIds.has(entry.workPackageId)),
    contractWorkReports: list(state.contractWorkReports).filter((entry) => entry.contractId !== id && !workPackageIds.has(entry.workPackageId)),
    contractAgreementCovers: list(state.contractAgreementCovers).filter((entry) => entry.contractId !== id),
    inspectionRoundContextLinks: list(state.inspectionRoundContextLinks).filter((entry) => entry.contractId !== id && !workPackageIds.has(entry.workPackageId)),
    ui: { ...(state.ui || {}), contractFormDrafts },
  };
}

export function workPackageFor(state, workPackageId) {
  return list(state?.workPackages).find((workPackage) => workPackage.id === workPackageId) || null;
}

export function regionsForContract(state, contractOrId) {
  const contract = typeof contractOrId === "string" ? contractFor(state, contractOrId) : contractOrId;
  return list(contract?.regionIds).map((id) => regionFor(state, id)).filter(Boolean);
}

export function workPackagesForContract(state, contractId) {
  return list(state?.workPackages).filter((entry) => entry.contractId === contractId).sort((a, b) => String(a.reportSequence || a.packageNo).localeCompare(String(b.reportSequence || b.packageNo), "th"));
}

export function assignmentsForWorkPackage(state, workPackageId) {
  return list(state?.contractStationAssignments).filter((entry) => entry.workPackageId === workPackageId && entry.status !== "inactive");
}

export function assignmentsForStation(state, stationId) {
  return list(state?.contractStationAssignments).filter((entry) => entry.stationId === stationId && entry.status !== "inactive");
}

export function activeContractAssignmentForStation(state, stationId, at = "") {
  const point = text(at);
  return assignmentsForStation(state, stationId)
    .filter((entry) => (!point || !entry.effectiveFrom || entry.effectiveFrom <= point) && (!point || !entry.effectiveTo || entry.effectiveTo >= point))
    .sort((a, b) => String(b.effectiveFrom || "").localeCompare(String(a.effectiveFrom || "")))[0] || null;
}

export function stationsForWorkPackage(state, workPackageId, profiles = []) {
  const profileById = new Map(list(profiles).map((profile) => [profile.id, profile]));
  return assignmentsForWorkPackage(state, workPackageId).map((assignment) => profileById.get(assignment.stationId)).filter(Boolean);
}

export function contractLabel(contract) {
  if (!contract) return "ยังไม่ผูกสัญญา";
  return [contract.contractNo, contract.title || contract.projectName].filter(Boolean).join(" · ") || "สัญญาไม่มีชื่อ";
}

export function workPackageLabel(workPackage) {
  if (!workPackage) return "ยังไม่ผูกงวด";
  return [workPackage.reportSequence || workPackage.packageNo, workPackage.title].filter(Boolean).join(" · ") || "งวดงาน";
}

export function buildContractContextSnapshot({ contract, workPackage, regions = [], station = null, assignment = null } = {}) {
  return {
    contractId: text(contract?.id),
    contractNo: text(contract?.contractNo),
    contractTitle: text(contract?.title || contract?.projectName),
    projectName: text(contract?.projectName || contract?.title),
    contractDate: text(contract?.contractDate),
    contractorId: text(contract?.contractorId),
    contractor: text(contract?.contractor),
    agencyId: text(contract?.agencyId),
    agency: text(contract?.agency),
    contractStatus: text(contract?.status),
    reportCompanyId: text(contract?.reportCompanyId),
    regionIds: list(regions).map((region) => text(region?.id)).filter(Boolean),
    regionNames: list(regions).map((region) => text(region?.name)).filter(Boolean),
    workPackageId: text(workPackage?.id),
    workPackageNo: text(workPackage?.packageNo || workPackage?.reportSequence),
    workPackageTitle: text(workPackage?.title),
    reportSequence: text(workPackage?.reportSequence || workPackage?.packageNo),
    periodStart: text(workPackage?.periodStart),
    periodEnd: text(workPackage?.periodEnd),
    stationId: text(station?.id),
    stationCode: text(station?.stationCode),
    stationName: text(station?.stationName),
    provinceId: text(station?.provinceId),
    province: text(station?.province),
    assignmentId: text(assignment?.id),
    capturedAt: now(),
  };
}

export function normalizeContractNumber(value) {
  return text(value).replace(/\s+/g, "").toLocaleLowerCase("th-TH");
}

export function hasDuplicateContractNumber(contracts = [], value, excludeId = "") {
  const normalized = normalizeContractNumber(value);
  if (!normalized) return false;
  return list(contracts).some((contract) => contract.id !== excludeId && normalizeContractNumber(contract.contractNo) === normalized);
}

function dateInRange(value, start, end) {
  if (!value) return true;
  if (start && value < start) return false;
  if (end && value > end) return false;
  return true;
}

export function validateWorkPackageDraft(workPackage = {}, contract = null, existing = []) {
  const packageNo = text(workPackage.packageNo || workPackage.reportSequence);
  const periodStart = text(workPackage.periodStart);
  const periodEnd = text(workPackage.periodEnd);
  const errors = {};
  if (!packageNo) errors.packageNo = "กรุณาระบุเลขงวด";
  if (list(existing).some((entry) => entry.id !== workPackage.id && text(entry.contractId) === text(contract?.id) && text(entry.packageNo || entry.reportSequence) === packageNo)) errors.packageNo = "เลขงวดนี้มีอยู่แล้วในสัญญา";
  if (periodStart && periodEnd && periodStart > periodEnd) errors.periodEnd = "วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มงวด";
  if (!dateInRange(periodStart, contract?.startDate, contract?.endDate)) errors.periodStart = "วันที่เริ่มงวดอยู่นอกช่วงสัญญา";
  if (!dateInRange(periodEnd, contract?.startDate, contract?.endDate)) errors.periodEnd = "วันที่สิ้นสุดงวดอยู่นอกช่วงสัญญา";
  return { valid: Object.keys(errors).length === 0, errors };
}

export function assignmentOverlaps(a, b) {
  if (!a || !b || a.stationId !== b.stationId || a.status === "inactive" || b.status === "inactive") return false;
  const aStart = text(a.effectiveFrom) || "0000-00-00";
  const aEnd = text(a.effectiveTo) || "9999-12-31";
  const bStart = text(b.effectiveFrom) || "0000-00-00";
  const bEnd = text(b.effectiveTo) || "9999-12-31";
  return aStart <= bEnd && bStart <= aEnd;
}

export function attachContractContextToRound(round, context) {
  if (!round || !context) return round;
  const snapshot = { ...round.snapshot, contractId: context.contractId, workPackageId: context.workPackageId, contractContext: structuredCloneSafe(context) };
  return {
    ...round,
    contractId: context.contractId,
    workPackageId: context.workPackageId,
    snapshot,
    meta: {
      ...(round.meta || {}),
      contractId: context.contractId,
      workPackageId: context.workPackageId,
      contractNo: context.contractNo || round.meta?.contractNo || "",
      contractDate: context.contractDate || round.meta?.contractDate || "",
      contractor: context.contractor || round.meta?.contractor || "",
      regionNames: context.regionNames || round.meta?.regionNames || [],
      reportSequence: context.reportSequence || round.meta?.reportSequence || "",
      workPackageNo: context.workPackageNo || round.meta?.workPackageNo || "",
      workPackageTitle: context.workPackageTitle || round.meta?.workPackageTitle || "",
    },
  };
}

export function getContractContextForRound(round, state) {
  const saved = round?.snapshot?.contractContext || round?.contractContext || null;
  const linked = getLatestInspectionRoundContextLink(state, round?.id);
  const linkedContext = linked?.contextSnapshot || null;
  const contractId = text(linked?.contractId || linkedContext?.contractId || saved?.contractId || round?.contractId || round?.meta?.contractId || round?.snapshot?.contractId);
  const workPackageId = text(linked?.workPackageId || linkedContext?.workPackageId || saved?.workPackageId || round?.workPackageId || round?.meta?.workPackageId || round?.snapshot?.workPackageId);
  if (!contractId && !workPackageId && !saved && !linkedContext) return null;
  const contract = contractFor(state, contractId);
  const workPackage = workPackageFor(state, workPackageId);
  const station = list(state?.stationProfiles).find((profile) => profile.id === round?.stationId) || null;
  const regions = regionsForContract(state, contract);
  const assignmentId = linkedContext?.assignmentId || saved?.assignmentId;
  const live = buildContractContextSnapshot({ contract, workPackage, regions, station, assignment: list(state?.contractStationAssignments).find((entry) => entry.id === assignmentId) });
  return {
    ...live,
    ...(saved || {}),
    ...(linkedContext || {}),
    contractId,
    workPackageId,
    stationId: text(saved?.stationId || round?.stationId || live.stationId),
    stationCode: text(saved?.stationCode || round?.snapshot?.stationCode || live.stationCode),
    stationName: text(saved?.stationName || round?.snapshot?.stationName || live.stationName),
    province: text(saved?.province || round?.snapshot?.province || live.province),
    regionNames: list(saved?.regionNames).length ? list(saved.regionNames) : live.regionNames,
  };
}
