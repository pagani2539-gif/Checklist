import { createPrintableReportComponent } from "../reports/PrintableReport.jsx";
import CompanyReportCover from "../CompanyReportCover.jsx";
import { REPORT_COMPANIES, REPORT_COPY, getCompanyContractorMatch, getReportCompany } from "../../domain/report-companies.js";
import { buildReportTemplateModel, getPresentationEvidenceCaption, getReportCoverMeta, getReportCoverReadiness, normalizeReportCoverMeta } from "../../domain/report-template.js";
import { REPORT_COVER_FIELD_LABELS, REPORT_COVER_REQUIRED_FIELDS, appendStationInspectionReportRevision, saveStationInspectionReportCover, stationInspectionReportForRound } from "../../domain/station-inspection-reports.js";
import { VEHICLE_REVIEW_CORRECTION_TARGET_OPTIONS, VEHICLE_REVIEW_REASON_OPTIONS } from "../../domain/vehicle-search.js";
import { createChecklistWorkspaceParts } from "../ChecklistWorkspaceParts.jsx";

function inferReportCompanyId(contractor) {
  const value = String(contractor || "").trim();
  if (!value) return "";
  return REPORT_COMPANIES.find((company) => getCompanyContractorMatch(company.id, value).status === "match")?.id || "";
}

export function createChecklistRuntime(runtime) {
  const checklistRuntime = {
    REPORT_COMPANIES,
    REPORT_COVER_FIELD_LABELS,
    REPORT_COVER_REQUIRED_FIELDS,
    appendStationInspectionReportRevision,
    getReportCoverMeta,
    getReportCoverReadiness,
    inferReportCompanyId,
    normalizeReportCoverMeta,
    saveStationInspectionReportCover,
    stationInspectionReportForRound,
    ...createChecklistWorkspaceParts(runtime),
  };
  checklistRuntime.PrintableReport = createPrintableReportComponent({
    ...runtime,
    ...checklistRuntime,
    REPORT_COPY,
    REPORT_TEXT: REPORT_COPY.report,
    getReportCompany,
    VEHICLE_REVIEW_CORRECTION_TARGET_OPTIONS,
    VEHICLE_REVIEW_REASON_OPTIONS,
    buildReportTemplateModel,
    getPresentationEvidenceCaption,
    CompanyReportCover,
  });
  return checklistRuntime;
}
