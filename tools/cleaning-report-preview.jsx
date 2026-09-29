import React from "react";
import { createRoot } from "react-dom/client";
import { createPrintableReportComponent } from "../src/app/reports/PrintableReport.jsx";
import {
  CLEANING_TARGET_TYPES,
  createDefaultStationProfile,
  createInspectionRound,
  getItemsForSnapshot,
} from "../src/domain/master-checklist.js";
import { getPresentationEvidenceCaption, buildReportTemplateModel } from "../src/domain/report-template.js";
import { REPORT_COPY, getReportCompany } from "../src/domain/report-companies.js";
import {
  VEHICLE_REVIEW_CORRECTION_TARGET_OPTIONS,
  VEHICLE_REVIEW_REASON_OPTIONS,
} from "../src/domain/vehicle-search.js";
import "../src/styles/tokens.css";
import "../src/styles/foundation.css";
import "../src/styles/company-report.css";

const REPORT_TEXT = REPORT_COPY.report;
const STATUS_META = Object.fromEntries(["pending", "normal", "damaged", "waiting", "not-installed", "na"].map((status) => [status, { icon: "check" }]));
const statusClass = (status) => `tone-${status || "pending"}`;
const formatDate = (value) => value ? new Date(value).toLocaleDateString("th-TH") : "—";
const formatDateTime = (value) => value ? new Date(value).toLocaleString("th-TH") : "—";
const shortId = (value) => String(value || "").slice(-8);
const Icon = ({ name }) => <span className="ops-icon" aria-hidden="true">{name}</span>;
const StatusBadge = ({ status, children }) => <span className={`ops-status ${statusClass(status)}`}>{children}</span>;
const EmptyState = ({ title, children }) => <div className="ops-empty-state"><strong>{title}</strong><p>{children}</p></div>;
const CompanyReportCover = ({ model }) => <section className="company-cover"><h1>{model.metadata.stationName}</h1><p>ตัวอย่างสำหรับตรวจรูปแบบรายงานทำความสะอาด</p></section>;
const getStoredAttachment = async () => new Blob([
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="100%" height="100%" fill="#dbeafe"/><path d="M0 480L240 220l160 170 120-120 280 250H0" fill="#93c5fd"/><circle cx="610" cy="150" r="60" fill="#fbbf24"/><text x="40" y="560" font-size="34" fill="#0f2f5f">ภาพตัวอย่างหลักฐาน</text></svg>',
], { type: "image/svg+xml" });

const PrintableReport = createPrintableReportComponent({
  EmptyState,
  Icon,
  REPORT_COPY,
  REPORT_TEXT,
  STATUS_META,
  StatusBadge,
  VEHICLE_REVIEW_CORRECTION_TARGET_OPTIONS,
  VEHICLE_REVIEW_REASON_OPTIONS,
  CompanyReportCover,
  buildReportTemplateModel,
  formatDate,
  formatDateTime,
  getPresentationEvidenceCaption,
  getReportCompany,
  getStoredAttachment,
  shortId,
  statusClass,
});

const profile = createDefaultStationProfile();
profile.stationCode = "CLEAN-QA";
profile.stationName = "สถานีตัวอย่างตรวจรายงานทำความสะอาด";
profile.equipment = profile.equipment.filter((asset) => !(
  (asset.type === "LPR_CAMERA" && asset.id.endsWith("-3"))
  || (asset.type === "FIXED_CAMERA" && asset.id.endsWith("-3"))
  || asset.type === "DATABASE_SERVER"
));
const round = createInspectionRound(profile, { inspectionDate: "2026-09-29" });
const cleaningItems = getItemsForSnapshot(round.snapshot).filter((item) => item.isEquipmentCleaning || item.isAreaCleaning);
cleaningItems.forEach((item) => {
  const itemState = round.inspectionItems[item.id];
  itemState.status = "normal";
  item.evidenceSlots.forEach((slot) => {
    itemState.evidence[slot.id] = {
      ...itemState.evidence[slot.id],
      status: "complete",
      attachment: { id: `qa-${slot.id}`, name: `${slot.cleaningStage}.svg`, type: "image/svg+xml" },
    };
  });
});

const targetCount = round.snapshot.equipment.filter((asset) => asset.active !== false && CLEANING_TARGET_TYPES.includes(asset.type)).length;
document.body.dataset.cleaningItemCount = String(cleaningItems.length);
document.body.dataset.cleaningTargetCount = String(targetCount);
document.body.dataset.cleaningPhotoCount = String(cleaningItems.reduce((count, item) => count + item.evidenceSlots.length, 0));

createRoot(document.getElementById("root")).render(
  <main className="checklist-page">
    <PrintableReport
      round={round}
      preview
      draft
      companyId="ntr"
      reportCoverMeta={{
        reportTitle: "ตัวอย่างตรวจหน้าพิมพ์ทำความสะอาด",
        projectName: "งานทดสอบภายใน",
        inspector: "ผู้ตรวจตัวอย่าง",
        preparedBy: "ผู้จัดทำตัวอย่าง",
        approvedBy: "ผู้อนุมัติตัวอย่าง",
        approvalDate: "2026-09-29",
        isQuickField: true,
      }}
    />
  </main>,
);
