import "../../styles/vehicle-report.css";
import "../../styles/report-page-rules.css";
import "../../styles/printable-report-route.css";
import AcDcLegacyArchive from "../AcDcLegacyArchive.jsx";
import { displayedImageAttachment } from '../../domain/image-annotation.js';
import { memo, useEffect, useRef, useState } from "react";
import { getVehiclePlateVerificationLabel } from "../../domain/vehicle-search.js";
import { buildVehicleSnapshotEvidencePages } from "../../domain/vehicle-snapshot-evidence.js";
import { VehicleEvidenceReadiness, VehicleSnapshotEvidencePage, VehicleSnapshotEvidenceReport } from "./VehicleSnapshotEvidence.jsx";
import { registerPrintableImageSource } from "./print-image-optimizer.js";
import { getEquipmentIconName } from "../icon-system.jsx";

export function createPrintableReportComponent(runtime) {
  const {
    EmptyState, Icon, REPORT_COPY, REPORT_TEXT, STATUS_META, StatusBadge, VEHICLE_REVIEW_CORRECTION_TARGET_OPTIONS, VEHICLE_REVIEW_REASON_OPTIONS,
    CompanyReportCover, buildReportTemplateModel, formatDate, formatDateTime, getPresentationEvidenceCaption,
    getReportCompany, getStoredAttachment, shortId, statusClass,
  } = runtime;

  function PrintableAttachment({ attachment: originalAttachment, label }) {
    const attachment = displayedImageAttachment(originalAttachment);
    const [previewUrl, setPreviewUrl] = useState("");
    const [loadError, setLoadError] = useState(false);
    const [mediaReady, setMediaReady] = useState(false);
    const [retryWaiting, setRetryWaiting] = useState(false);
    const [retryAttempt, setRetryAttempt] = useState(0);
    const loadErrorRef = useRef(false);
    const retryableRef = useRef(false);
    const retryAfterMsRef = useRef(0);
    const retryTimerRef = useRef(null);
    const objectUrlRef = useRef("");
    const unregisterPrintSourceRef = useRef(() => {});

    useEffect(() => {
      const retryFailedAttachment = (event) => {
        if (!loadErrorRef.current || !retryableRef.current || retryTimerRef.current) return;
        const deadline = Number(event.detail?.deadline) || Date.now() + 60_000;
        const retryDelay = Math.max(0, retryAfterMsRef.current);
        if (Date.now() + retryDelay >= deadline) return;
        setRetryWaiting(true);
        retryTimerRef.current = window.setTimeout(() => {
          retryTimerRef.current = null;
          retryAfterMsRef.current = 0;
          loadErrorRef.current = false;
          retryableRef.current = false;
          setRetryWaiting(false);
          setRetryAttempt((current) => current + 1);
        }, retryDelay);
      };
      window.addEventListener("checklist:retry-report-attachments", retryFailedAttachment);
      return () => {
        window.removeEventListener("checklist:retry-report-attachments", retryFailedAttachment);
        if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
      };
    }, []);

    useEffect(() => {
      let cancelled = false;
      setPreviewUrl("");
      setLoadError(false);
      loadErrorRef.current = false;
      retryableRef.current = false;
      retryAfterMsRef.current = 0;
      setRetryWaiting(false);
      setMediaReady(false);
      if (!attachment?.id) return undefined;
      const attachmentType = String(attachment.type || "");
      const isMedia = attachmentType.startsWith("image/") || attachmentType.startsWith("video/");
      getStoredAttachment(attachment.id).then((blob) => {
        if (cancelled) return;
        if (!blob) {
          loadErrorRef.current = true;
          retryableRef.current = false;
          setLoadError(true);
          return;
        }
        const nextUrl = URL.createObjectURL(blob);
        objectUrlRef.current = nextUrl;
        unregisterPrintSourceRef.current = registerPrintableImageSource(nextUrl, blob);
        setPreviewUrl(nextUrl);
        if (!isMedia) setMediaReady(true);
      }).catch((error) => {
        if (!cancelled) {
          retryAfterMsRef.current = Number(error?.retryAfterMs) || 0;
          loadErrorRef.current = true;
          retryableRef.current = error?.status === 429 || error?.status >= 500 || error?.status == null;
          setLoadError(true);
        }
      });
      return () => {
        cancelled = true;
        if (retryTimerRef.current) {
          window.clearTimeout(retryTimerRef.current);
          retryTimerRef.current = null;
        }
        if (objectUrlRef.current) {
          unregisterPrintSourceRef.current();
          unregisterPrintSourceRef.current = () => {};
          URL.revokeObjectURL(objectUrlRef.current);
          objectUrlRef.current = "";
        }
      };
    }, [attachment?.id, retryAttempt]);

    if (!attachment) return null;
    const isVideo = String(attachment.type || "").startsWith("video/");
    const isImage = String(attachment.type || "").startsWith("image/");
    const state = retryWaiting ? "loading" : loadError ? "missing" : previewUrl && mediaReady ? "ready" : "loading";
    return <figure className={`ops-print-attachment ${loadError ? "is-missing" : ""}`} data-print-attachment={state}>
      <div className="ops-print-attachment-image-wrap">
        {previewUrl && !loadError && isVideo ? <video src={previewUrl} controls preload="metadata" onLoadedData={() => setMediaReady(true)} onError={() => { loadErrorRef.current = true; retryableRef.current = true; setLoadError(true); }} aria-label={`${REPORT_TEXT.attachment.videoAlt} ${label}`} /> : previewUrl && !loadError && isImage ? <img src={previewUrl} alt={`${REPORT_TEXT.attachment.imageAlt} ${label}`} data-print-image="true" onLoad={() => setMediaReady(true)} onError={() => { loadErrorRef.current = true; retryableRef.current = true; setLoadError(true); }} /> : <span className="ops-print-attachment-warning">{retryWaiting ? "กำลังลองโหลดหลักฐานอีกครั้ง..." : loadError ? REPORT_TEXT.attachment.missingFile : attachment.type === "application/pdf" ? REPORT_TEXT.attachment.documentFile : REPORT_TEXT.attachment.attachedFile}</span>}
      </div>
      <figcaption>{REPORT_TEXT.attachment.caption} · {label}</figcaption>
    </figure>;
  }

  function getPrintableItemValue(item) {
    if (item.value === "" || item.value === null || item.value === undefined) return "-";
    return `${item.value}${item.unit ? ` ${item.unit}` : ""}`;
  }

  function getPrintableEvidenceEntries(item) {
    if (item.evidenceSlots?.length) return item.evidenceSlots;
    if (!item.attachment) return [];
    return [{
      id: `${item.id}-attachment`,
      displayLabel: item.label,
      sourceLabel: REPORT_TEXT.attachment.itemImageSource,
      status: item.status,
      statusLabel: item.statusLabel,
      note: item.note,
      attachment: item.attachment,
    }];
  }

  function PrintableEvidenceCell({ item }) {
    const entries = getPrintableEvidenceEntries(item);
    if (!entries.length) return <span className="ops-print-evidence-empty">{REPORT_TEXT.placeholder.noAttachment}</span>;
    return <div className="ops-print-evidence-list">{entries.map((entry) => {
      const entryLabel = entry.displayLabel || entry.sourceLabel || item.label;
      return <div className="ops-print-evidence-slot" key={entry.id}>
        <div className="ops-print-evidence-heading"><strong>{entryLabel}</strong><span className={`ops-evidence-status ${statusClass(entry.status)}`}>{entry.statusLabel}</span></div>
        {entry.note && <p>{entry.note}</p>}
        {entry.attachment ? <PrintableAttachment attachment={entry.attachment} label={entryLabel} /> : <span className="ops-print-evidence-empty">{REPORT_TEXT.placeholder.noEvidenceFile}</span>}
      </div>;
    })}</div>;
  }

  function PrintableChecklistItem({ item }) {
    const itemContext = [
      item.systemLabel && `ระบบ ${item.systemLabel}`,
      item.scope && `ขอบเขต ${item.scope}`,
      item.laneNo && `${REPORT_TEXT.table.lanePrefix} ${item.laneNo}`,
      item.location,
      item.serialNo && `${REPORT_TEXT.table.serialPrefix} ${item.serialNo}`,
    ].filter(Boolean);
    return <tr className={`ops-print-item ${statusClass(item.status)}`} data-print-item-id={item.id}>
      <td className="ops-print-item-number"><span>{String(item.index || "-").padStart(2, "0")}</span></td>
      <td className="ops-print-item-description"><h4><Icon name={getContextualReportIcon(item)} size="small" /> {item.label}</h4>{(item.assetNo || itemContext.length > 0) && <p>{[item.assetNo, ...itemContext].filter(Boolean).join(" · ")}</p>}{item.relationshipPath && <small className="ops-print-relationship-path">{item.relationshipPath}</small>}</td>
      <td className="ops-print-item-status"><StatusBadge status={item.status}>{item.statusLabel}</StatusBadge></td>
      <td className="ops-print-item-details">{item.value !== "" && item.value != null && <strong>{getPrintableItemValue(item)}</strong>}{item.note && <p><b>{REPORT_TEXT.table.note}</b> {item.note}</p>}</td>
      <td className="ops-print-item-evidence"><PrintableEvidenceCell item={item} /></td>
    </tr>;
  }

  function PrintableCleaningChecklistItem({ item, section }) {
    const evidenceEntries = getPrintableEvidenceEntries(item);
    const categoryCode = item.sectionCode || section.code;
    const categoryTitle = item.sourceSectionTitle || item.sectionTitle || section.title;
    const cleaningName = item.isAreaCleaning
      ? item.cleaningAssetType === "CONTROL_CABINET" ? "พื้นที่โดยรอบตู้ควบคุม" : "พื้นที่ห้องควบคุม"
      : String(item.label || "").replace(/^(?:Equipment Cleaning|ทำความสะอาดอุปกรณ์) · /, "").replace(item.assetNo ? ` · ${item.assetNo}` : "", "") || "อุปกรณ์";
    return <article className={`ops-print-cleaning-page ${statusClass(item.status)}`}
      data-print-cleaning-item-id={item.id} data-print-cleaning-section={categoryCode}>
      <header className="ops-print-cleaning-heading">
        <div className="ops-print-cleaning-category"><span>{categoryCode}</span><div><p>อุปกรณ์ที่เกี่ยวข้อง</p><h3>{categoryTitle}</h3></div></div>
        <StatusBadge status={item.status}>{item.statusLabel}</StatusBadge>
      </header>
      <h2 className="ops-print-cleaning-title"><Icon name="broom" size="small" /> ทำความสะอาด {cleaningName}</h2>
      <dl className="ops-print-cleaning-facts">
        <div><dt>อุปกรณ์</dt><dd>{cleaningName}</dd></div>
        {item.assetNo && <div><dt>Asset No.</dt><dd>{item.assetNo}</dd></div>}
        {item.location && <div><dt>ตำแหน่ง</dt><dd>{item.location}</dd></div>}
      </dl>
      {item.note && <p className="ops-print-cleaning-note"><strong>{REPORT_TEXT.table.note}</strong> {item.note}</p>}
      <div className="ops-print-cleaning-stage-grid">
        {evidenceEntries.map((entry, index) => {
          const stageLabel = entry.displayLabel || ["ก่อนทำความสะอาด", "ระหว่างทำความสะอาด", "หลังทำความสะอาด"][index] || "หลักฐานทำความสะอาด";
          return <section className="ops-print-cleaning-stage" key={entry.id} data-cleaning-stage={entry.cleaningStage || index + 1}>
            <h4>{stageLabel}</h4>
            {entry.attachment
              ? <PrintableAttachment attachment={entry.attachment} label={stageLabel} />
              : <div className="ops-print-cleaning-photo-placeholder">{REPORT_TEXT.placeholder.noEvidenceFile}</div>}
            {entry.note && <p>{entry.note}</p>}
          </section>;
        })}
      </div>
    </article>;
  }

  const PRINT_SECTION_ICON_BY_CODE = Object.freeze({
    "1.1": "equipment",
    "1.1.5": "scan",
    "1.1.11": "server",
    "1.1.12": "analytics",
    "2.1": "sensor",
    "2.2": "settings",
    "2.3": "circuit",
    "3.1": "scan",
    "3.2": "camera",
    "4.1": "video",
    "4.2": "server",
    "5.1": "database",
    "6.1": "clipboard",
    "6.2": "sparkles",
    "6.3": "broom",
    "7.1": "display",
  });

  function getContextualReportIcon(item) {
    if (item.isEquipmentCleaning || item.isAreaCleaning) return "broom";
    if (item.assetType) return getEquipmentIconName(item.assetType);
    const readinessIcons = { "1.1.staff": "users", "1.1.vehicle": "truck", "1.1.crane": "truck", "1.1.traffic-cone-light": "trafficCone", "1.1.tools": "tools", "1.1.road-closure": "trafficCone" };
    return readinessIcons[item.templateId || item.id] || PRINT_SECTION_ICON_BY_CODE[item.sectionCode] || "clipboard";
  }


  function getPresentationEvidenceEntries(item) {
    const entries = getPrintableEvidenceEntries(item);
    if (entries.length) {
      return entries
        .map((entry, index) => ({ entry, index }))
        .sort((left, right) => {
          const leftOrder = Number(left.entry.sourceOrder);
          const rightOrder = Number(right.entry.sourceOrder);
          const leftHasOrder = Number.isFinite(leftOrder);
          const rightHasOrder = Number.isFinite(rightOrder);
          if (leftHasOrder && rightHasOrder && leftOrder !== rightOrder) return leftOrder - rightOrder;
          if (leftHasOrder !== rightHasOrder) return leftHasOrder ? -1 : 1;
          return left.index - right.index;
        })
        .map(({ entry }) => entry);
    }
    return [{
      id: `${item.id}-missing-evidence`,
      displayLabel: REPORT_TEXT.presentation.evidenceCaption,
      sourceLabel: "",
      status: item.status === "na" ? "na" : "pending",
      statusLabel: item.status === "na" ? REPORT_COPY.status.notApplicable : REPORT_TEXT.placeholder.evidenceStatus,
      note: "",
      attachment: null,
      isPlaceholder: true,
    }];
  }

  function isPrintableEvidenceComplete(entry) {
    return entry.status === "complete" && (!entry.photoRequired || Boolean(entry.attachment?.id));
  }

  function chunkPresentationEvidence(entries, size = 4) {
    const chunks = [];
    for (let index = 0; index < entries.length; index += size) chunks.push(entries.slice(index, index + size));
    return chunks.length ? chunks : [[]];
  }

  function PrintablePresentationEvidenceCard({ entry, item, index, total }) {
    const label = entry.displayLabel || entry.sourceLabel || item.label;
    const caption = getPresentationEvidenceCaption(entry, REPORT_TEXT.presentation.evidenceCaption);
    return <article className={`ops-presentation-evidence-card ${entry.attachment ? "has-attachment" : "is-missing"}`.trim()} data-presentation-evidence-id={entry.id}>
      <header className="ops-presentation-evidence-heading">
        <span className="ops-presentation-step">{String(index + 1).padStart(2, "0")}</span>
        <div><strong><Icon name={item.isEquipmentCleaning || item.isAreaCleaning ? "broom" : "camera"} size="small" /> {label}</strong></div>
        <span className={`ops-evidence-status ${statusClass(entry.status)}`}>{entry.statusLabel}</span>
      </header>
      <div className="ops-presentation-evidence-media">
        {entry.attachment ? <PrintableAttachment attachment={entry.attachment} label={label} /> : <div className="ops-presentation-evidence-placeholder"><Icon name="camera" size="small" /><strong>{REPORT_TEXT.placeholder.noEvidenceFile}</strong><span>{entry.statusLabel}</span></div>}
      </div>
      <p className="ops-presentation-evidence-caption">{caption}</p>
      {index < total - 1 && <span className="ops-presentation-evidence-arrow" aria-hidden="true"><Icon name="arrow" size="small" /></span>}
    </article>;
  }

  function getPresentationSummaryCells({ item, metadata, evidenceComplete, evidenceTotal }) {
    const cells = [{ label: REPORT_TEXT.presentation.result, value: item.statusLabel, description: "", icon: STATUS_META[item.status]?.icon || "info" }];
    if (item.value !== "" && item.value !== null && item.value !== undefined) cells.push({ label: "ค่าที่ตรวจวัด", value: getPrintableItemValue(item), description: "", icon: "clipboard" });
    const context = [item.scope && `ขอบเขต ${item.scope}`, item.laneNo && `${REPORT_TEXT.table.lanePrefix} ${item.laneNo}`, item.location].filter(Boolean).join(" · ");
    if (item.assetId || item.assetNo || item.systemRecordId || context) cells.push({ label: item.assetId || item.assetNo ? "อุปกรณ์" : "ขอบเขตการตรวจ", value: item.assetNo || item.assetName || item.systemLabel || context, description: context, icon: item.assetType ? getEquipmentIconName(item.assetType) : "system" });
    if (item.serialNo) cells.push({ label: "Serial", value: item.serialNo, description: "", icon: "tag" });
    return [...cells,
      { label: "หลักฐานประกอบ", value: `${evidenceComplete} / ${evidenceTotal} ช่อง`, description: evidenceTotal > evidenceComplete ? REPORT_TEXT.presentation.evidenceIncomplete : REPORT_TEXT.presentation.evidenceComplete, icon: evidenceTotal > evidenceComplete ? "alert" : "check", emphasis: true },
    ];
  }

  function PrintablePresentationPage({ children, className = "" }) {
    return <div className={`ops-presentation-print-page ${className}`.trim()}>{children}</div>;
  }

  function PrintablePresentationItemSlide({ section, item, position, total, evidenceEntries, allEvidenceEntries, metadata, continuation = false, companyId = "ntr" }) {
    const taskLabel = item.assetName ? item.label.replace(`${item.assetName} · `, "").replace(` · ${item.assetName}`, "").replace(item.assetNo ? ` · ${item.assetNo}` : "\u0000", "") : item.label;
    const itemDetails = [
      item.systemLabel && `ระบบ ${item.systemLabel}`,
      item.scope && `ขอบเขต ${item.scope}`,
      item.assetNo && `${REPORT_TEXT.presentation.assetNo} ${item.assetNo}`,
      item.laneNo && `${REPORT_TEXT.table.lanePrefix} ${item.laneNo}`,
      item.location,
      item.serialNo && `${REPORT_TEXT.table.serialPrefix} ${item.serialNo}`,
    ].filter(Boolean);
    const stationLabel = metadata.stationName || metadata.stationCode || REPORT_TEXT.placeholder.station;
    const evidenceComplete = allEvidenceEntries.filter(isPrintableEvidenceComplete).length;
    const evidenceTotal = allEvidenceEntries.length;
    const summaryCells = getPresentationSummaryCells({ item, metadata, evidenceComplete, evidenceTotal });
    const company = getReportCompany(companyId);
    return <section className={`ops-presentation-item-slide company-slide-${company.id} slots-${Math.min(evidenceEntries.length, 4)}${continuation ? " is-continuation" : ""}`.trim()} data-print-presentation-item-id={item.id} data-print-presentation-position={position} data-presentation-continuation={continuation ? "true" : "false"} aria-label={`${REPORT_TEXT.presentation.itemPrefix}ตรวจ ${item.label}`}>
      <header className="ops-presentation-reference-header without-round">
        <div className="ops-presentation-reference-title"><img className="company-slide-logo" data-company-asset src={`/report/companies/${company.logo}`} alt={`${company.name} logo`} /><div><span>{REPORT_TEXT.presentation.reportByStation} · {company.name}</span><strong>รายงานผลการตรวจสอบและบำรุงรักษา</strong></div></div>
        <div className="ops-presentation-reference-context"><span>{REPORT_TEXT.presentation.referenceStation}</span><strong>{stationLabel}</strong></div>
        <div className={`ops-presentation-reference-status ${statusClass(item.status)}`}><Icon name={STATUS_META[item.status]?.icon || "info"} size="small" /><strong>{item.statusLabel}</strong></div>
      </header>
      <header className="ops-presentation-item-heading">
        <div><p className="ops-eyebrow"><Icon name={getContextualReportIcon(item)} size="small" /> {section.code} · {section.title}{continuation ? ` · ${REPORT_TEXT.presentation.continuation}` : ""}</p><h2>{item.assetName && !item.isAreaCleaning ? item.assetName : item.label}</h2>{item.assetName && !item.isAreaCleaning && <p className="ops-presentation-task"><Icon name={item.isEquipmentCleaning ? "broom" : "clipboard"} size="small" /> รายการตรวจ: {taskLabel}</p>}{itemDetails.length > 0 && <p>{itemDetails.join(" · ")}</p>}</div>
      </header>
      <div className="ops-presentation-evidence-grid">
        {evidenceEntries.map((entry, index) => <PrintablePresentationEvidenceCard key={entry.id} entry={entry} item={item} index={index} total={evidenceEntries.length} />)}
      </div>
      <div className="ops-presentation-summary-band" style={{ "--report-summary-columns": summaryCells.length }} aria-label={REPORT_TEXT.presentation.summary}>
        {summaryCells.map((cell) => <div className={`ops-presentation-summary-cell${cell.emphasis ? " is-emphasis" : ""}`.trim()} key={cell.label}><span className="ops-presentation-summary-icon"><Icon name={cell.icon} size="small" /></span><div><span>{cell.label}</span><strong>{cell.value}</strong><small>{cell.description}</small></div></div>)}
      </div>
      <footer className="ops-presentation-slide-footnote">{item.note && <span>{REPORT_TEXT.presentation.note} {item.note}</span>}<span>หน้า {position} / {total}</span></footer>
    </section>;
  }

  function PrintablePresentationSlides({ model, vehicleSlides = [], companyId = "ntr" }) {
    const slideItems = model.orderedItems.flatMap((item) => {
      const section = item.presentationSection || { code: item.sectionCode || "", title: item.sourceSectionTitle || "" };
      const allEvidenceEntries = getPresentationEvidenceEntries(item);
      return chunkPresentationEvidence(allEvidenceEntries).map((evidenceEntries, index) => ({ section, item, evidenceEntries, allEvidenceEntries, continuation: index > 0 }));
    });
    const totalSlides = slideItems.length + vehicleSlides.length;
    if (!totalSlides) return <div className="ops-presentation-empty"><EmptyState icon="info" title={REPORT_TEXT.placeholder.noActiveItems}>{REPORT_TEXT.presentation.noActiveItemsDetail}</EmptyState></div>;
    return <div className={`ops-presentation-slide-list company-slides-${companyId}`} data-presentation-slide-count={totalSlides} data-presentation-vehicle-slide-count={vehicleSlides.length}>
      {slideItems.map((slide, index) => <PrintablePresentationPage className={`company-slide-page company-${companyId}${index === totalSlides - 1 ? " is-last" : ""}`} key={`checklist-${slide.item.id}-${index}`}><PrintablePresentationItemSlide {...slide} metadata={model.metadata} companyId={companyId} position={index + 1} total={totalSlides} /></PrintablePresentationPage>)}
      {vehicleSlides.map((slide, index) => {
        const position = slideItems.length + index + 1;
        return <VehicleSnapshotEvidencePage key={`vehicle-${slide.key}`} page={slide} metadata={model.metadata} presentation wrapPage={(content, lastPage) => <PrintablePresentationPage className={`company-slide-page company-${companyId}${position === totalSlides && lastPage ? " is-last" : ""}`}>{content}</PrintablePresentationPage>} renderAttachment={attachment => <PrintableAttachment attachment={attachment} label="หลักฐานเดิมประกอบผลตรวจ" />} />;
      })}
    </div>;
  }

  function buildPrintableGalleryItems(model, { omitCleaning = false } = {}) {
    const items = [];
    const seen = new Set();
    model.orderedItems.forEach((item) => {
      if (omitCleaning && (item.isEquipmentCleaning || item.isAreaCleaning)) return;
      getPrintableEvidenceEntries(item).forEach((entry) => {
        const attachment = entry.attachment;
        const type = String(attachment?.type || "");
        if (!attachment?.id || (!type.startsWith("image/") && !type.startsWith("video/")) || seen.has(attachment.id)) return;
        seen.add(attachment.id);
        items.push({ attachment, label: entry.displayLabel || entry.sourceLabel || item.label });
      });
    });
    return items;
  }

  function PrintableEvidenceGallery({ model, omitCleaning = false }) {
    const galleryItems = buildPrintableGalleryItems(model, { omitCleaning });
    if (!galleryItems.length) return null;
    return <section className="ops-print-gallery" aria-label={REPORT_TEXT.aria.gallery}>
      <div className="ops-print-gallery-heading"><div><p className="ops-eyebrow">EVIDENCE GALLERY</p><h3>{REPORT_TEXT.aria.gallery}</h3></div><strong>{galleryItems.length} {REPORT_TEXT.presentation.galleryFileCount}</strong></div>
      <div className="ops-print-gallery-grid">{galleryItems.map((entry) => <PrintableAttachment key={entry.attachment.id} attachment={entry.attachment} label={entry.label} />)}</div>
    </section>;
  }

  function formatVehiclePrintWeight(value) {
    return value === null || value === undefined ? "—" : `${Number(value).toLocaleString("th-TH")} กก.`;
  }

  function vehiclePrintStatusLabel(status) {
    return status === "correct" ? "ถูกต้อง" : status === "incorrect" ? "ไม่ถูกต้อง" : status === "unable-to-verify" ? "ตรวจไม่ได้" : "ยังไม่ตรวจ";
  }

  function vehicleReviewReasonLabel(dimension, reasonCode) {
    return VEHICLE_REVIEW_REASON_OPTIONS[dimension]?.find((option) => option.value === reasonCode)?.label || reasonCode || "";
  }

  function vehicleCorrectionTargetLabel(dimension, target) {
    return VEHICLE_REVIEW_CORRECTION_TARGET_OPTIONS[dimension]?.find((option) => option.value === target)?.label || "";
  }

  function PrintableVehicleChart({ title, summary, threshold }) {
    if (!summary) return null;
    const values = [
      ["ถูกต้อง", summary.correct, "correct"],
      ["ไม่ถูกต้อง", summary.incorrect, "incorrect"],
      ["ตรวจไม่ได้", summary.unableToVerify, "unable"],
      ["ยังไม่ตรวจ", summary.pending, "pending"],
    ];
    const max = Math.max(summary.total || 0, ...values.map(([, value]) => value), 1);
    return <section className="ops-print-vehicle-chart" aria-label={title}>
      <div className="ops-print-vehicle-chart-heading"><h4>{title}</h4><strong>เกณฑ์ ≥ {threshold}%</strong></div>
      <div className="ops-print-vehicle-chart-accuracy"><span>ความถูกต้อง · ถูก {summary.correct}/{summary.reviewed} คันที่ตัดสิน</span><strong>{summary.accuracy === null ? "—" : `${summary.accuracyDisplay || summary.accuracy}%`}</strong><div className="ops-print-vehicle-threshold-track"><span style={{ width: `${Math.min(100, Math.max(0, summary.accuracy || 0))}%` }} /><i style={{ left: `${threshold}%` }} aria-hidden="true" /></div><small>บันทึกผลแล้ว {summary.decided}/{summary.total} คัน · รอตรวจ {summary.pending} คัน</small></div>
      <div className="ops-print-vehicle-chart-bars">{values.map(([label, value, tone]) => <div className={`ops-print-vehicle-chart-row tone-${tone}`} key={label}><div><span>{label}</span><strong>{value} คัน</strong></div><div className="ops-print-vehicle-chart-track"><span style={{ width: `${Math.round((value / max) * 100)}%` }} /></div></div>)}</div>
    </section>;
  }

  function PrintableVehicleReasonChart({ issues }) {
    const reasonRows = Object.values((issues || []).reduce((result, issue) => {
      if (!issue.reasonCode && !issue.reasonLabel) return result;
      const key = `${issue.dimension || "vehicle"}:${issue.reasonCode || issue.reasonLabel}`;
      const current = result[key] || { label: issue.reasonLabel || issue.reasonCode, count: 0 };
      current.count += 1;
      result[key] = current;
      return result;
    }, {})).sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "th"));
    const max = Math.max(...reasonRows.map((row) => row.count), 1);
    return <section className="ops-print-vehicle-reasons" aria-label="กราฟสาเหตุที่อ่านไม่ได้">
      <div className="ops-print-vehicle-chart-heading"><h4>สาเหตุที่อ่านไม่ได้ / ตรวจไม่ได้</h4><strong>{reasonRows.reduce((total, row) => total + row.count, 0)} รายการ</strong></div>
      {reasonRows.length ? <div className="ops-print-vehicle-reason-bars">{reasonRows.map((row) => <div className="ops-print-vehicle-reason-row" key={row.label}><div><span>{row.label}</span><strong>{row.count} รายการ</strong></div><div className="ops-print-vehicle-chart-track"><span style={{ width: `${Math.round((row.count / max) * 100)}%` }} /></div></div>)}</div> : <span className="ops-print-vehicle-reasons-empty">ไม่พบเหตุผลที่บันทึกไว้</span>}
    </section>;
  }

  function PrintableVehicleReportImage({ src, label }) {
    const [failed, setFailed] = useState(false);
    if (!src || failed) return <div className="ops-print-vehicle-image-missing">{src ? "โหลดภาพไม่ได้" : "ไม่มีภาพ"}</div>;
    return <figure className="ops-print-vehicle-evidence-image"><img src={src} alt={label} data-print-image="true" onError={() => setFailed(true)} /><figcaption>{label}</figcaption></figure>;
  }

  function PrintableVehicleEvidenceRow({ row }) {
    const plateDetail = row.reviewDetails?.plate || {};
    const classificationDetail = row.reviewDetails?.classification || {};
    const plateCorrectionTarget = vehicleCorrectionTargetLabel("plate", plateDetail.correctionTarget);
    return <article className="ops-print-vehicle-evidence-row">
      <header><strong>{row.plateNumber || "ไม่พบทะเบียน"}</strong><span>{row.occurredAt ? formatDateTime(row.occurredAt) : "ไม่พบเวลา"} · {row.lane || "ไม่ระบุ Lane"}</span></header>
      <dl><div><dt>ทะเบียนจาก API</dt><dd>{row.plateNumber || "—"} · {vehiclePrintStatusLabel(row.reviewStatus)}</dd></div><div><dt>ทะเบียนที่ยืนยัน</dt><dd>{plateDetail.correctedValue ? `${plateCorrectionTarget ? `${plateCorrectionTarget} · ` : ""}${plateDetail.correctedValue}` : "เหมือนค่า API / ไม่มีการแก้"}</dd></div><div><dt>ประเภทรถจาก API</dt><dd>{row.vehicleClassLabel || "—"} · {vehiclePrintStatusLabel(row.classificationReviewStatus)}</dd></div><div><dt>ประเภทที่ยืนยัน</dt><dd>{classificationDetail.correctedValue || "เหมือนค่า API / ไม่มีการแก้"}</dd></div><div><dt>น้ำหนักรวม</dt><dd>{formatVehiclePrintWeight(row.grossWeight)}</dd></div></dl>
      {(plateDetail.reasonCode || classificationDetail.reasonCode || plateDetail.note || classificationDetail.note || plateDetail.verificationScope) && <div className="ops-print-vehicle-evidence-reason"><strong>เหตุผล/หมายเหตุ</strong><span>{[vehicleReviewReasonLabel("plate", plateDetail.reasonCode), getVehiclePlateVerificationLabel(plateDetail), vehicleReviewReasonLabel("classification", classificationDetail.reasonCode), plateDetail.note, classificationDetail.note].filter(Boolean).join(" · ")}</span></div>}
      <div className="ops-print-vehicle-evidence-images"><PrintableVehicleReportImage src={row.plateImage} label="ภาพป้ายทะเบียนจาก API" /><PrintableVehicleReportImage src={row.overviewImage} label="ภาพรถจาก API" />{plateDetail.evidenceAttachment && <PrintableAttachment attachment={plateDetail.evidenceAttachment} label="หลักฐานเพิ่มเติมด้านทะเบียน" />}{classificationDetail.evidenceAttachment && <PrintableAttachment attachment={classificationDetail.evidenceAttachment} label="หลักฐานเพิ่มเติมด้านประเภทรถ" />}</div>
    </article>;
  }

  function PrintableVehicleReport({ vehicleReport, metadata }) {
    if (!vehicleReport) return null;
    return <VehicleSnapshotEvidenceReport report={vehicleReport} metadata={metadata} renderAttachment={attachment => <PrintableAttachment attachment={attachment} label="หลักฐานเดิมประกอบผลตรวจ" />} />;
  }

  function getVehiclePresentationSlides(vehicleReport) {
    return buildVehicleSnapshotEvidencePages(vehicleReport);
  }

  function getVehiclePresentationSampleRows(scopeReport, dimension) {
    return (scopeReport.presentationExamples?.[dimension] || [])
      .map((rowId) => (scopeReport.rows || []).find((row) => row.id === rowId))
      .filter(Boolean);
  }

  function isUsableVehiclePresentationValue(value) {
    const text = String(value || "").trim();
    return Boolean(text && !["—", "ไม่พบผลอ่านป้าย", "ไม่พบผลอ่านเลขทะเบียน", "ไม่พบทะเบียน", "ไม่ระบุประเภทรถ"].includes(text));
  }

  function getVehiclePresentationConfirmedValue(row, dimension) {
    const detail = row.reviewDetails?.[dimension] || {};
    const status = dimension === "plate" ? row.reviewStatus : row.classificationReviewStatus;
    const apiValue = dimension === "plate" ? row.plateNumber : row.vehicleClassLabel;
    const confirmed = String(detail.correctedValue || "").trim();
    if (confirmed) {
      const correctionTarget = dimension === "plate" ? vehicleCorrectionTargetLabel("plate", detail.correctionTarget) : "";
      return correctionTarget ? `${correctionTarget} · ${confirmed}` : confirmed;
    }
    if (status === "correct" && isUsableVehiclePresentationValue(apiValue)) return `ตรงกับ API · ${apiValue}`;
    return "ยังไม่มีค่าที่ยืนยัน";
  }

  function PrintableVehiclePresentationEvidence({ row, dimension }) {
    const detail = row.reviewDetails?.[dimension] || {};
    return <div className="ops-presentation-vehicle-images">
      <PrintableVehicleReportImage src={row.plateImage} label="ภาพป้ายทะเบียนจาก API" />
      <PrintableVehicleReportImage src={row.lprImage} label="ภาพจากกล้อง LPR" />
      <PrintableVehicleReportImage src={row.overviewImage} label="ภาพรถจาก API" />
      {detail.evidenceAttachment
        ? <PrintableAttachment attachment={detail.evidenceAttachment} label={dimension === "plate" ? "หลักฐานเพิ่มเติมด้านทะเบียน" : "หลักฐานเพิ่มเติมด้านประเภทรถ"} />
        : <span className="ops-presentation-vehicle-no-extra-evidence">ไม่มีรูปแนบเพิ่มเติม</span>}
    </div>;
  }

  function PrintableVehiclePresentationSample({ row, dimension }) {
    const status = dimension === "plate" ? row.reviewStatus : row.classificationReviewStatus;
    const apiValue = dimension === "plate" ? row.plateNumber : row.vehicleClassLabel;
    const apiLabel = dimension === "plate" ? "ทะเบียนจาก API" : "ประเภทรถจาก API";
    const confirmedLabel = dimension === "plate" ? "ทะเบียนที่ยืนยัน" : "ประเภทที่ยืนยัน";
    const apiValueLabel = isUsableVehiclePresentationValue(apiValue) ? apiValue : "—";
    return <tr data-presentation-vehicle-sample={dimension} data-vehicle-review-status={status}>
      <td><span className={`ops-presentation-vehicle-status tone-${status}`}>{vehiclePrintStatusLabel(status)}</span><small>{row.occurredAt ? formatDateTime(row.occurredAt) : "ไม่พบเวลา"}</small><small>{row.lane || "ไม่ระบุ Lane"}</small></td>
      <td><span>{apiLabel}</span><strong>{apiValueLabel}</strong></td>
      <td><span>{confirmedLabel}</span><strong>{getVehiclePresentationConfirmedValue(row, dimension)}</strong></td>
      <td><PrintableVehiclePresentationEvidence row={row} dimension={dimension} /></td>
    </tr>;
  }

  function PrintableVehiclePresentationMetrics({ summary, threshold }) {
    const metrics = [
      { label: "ความถูกต้อง", value: summary?.accuracy === null || summary?.accuracy === undefined ? "—" : `${summary.accuracyDisplay || summary.accuracy}%`, detail: `เกณฑ์ ≥ ${threshold}%`, emphasis: true },
      { label: "ถูกต้อง", value: summary?.correct || 0 },
      { label: "ไม่ถูกต้อง", value: summary?.incorrect || 0 },
      { label: "ตรวจไม่ได้", value: summary?.unableToVerify || 0 },
      { label: "รอตรวจ", value: summary?.pending || 0 },
    ];
    return <div className="ops-presentation-vehicle-metrics" aria-label="สรุปผลทดสอบ">
      {metrics.map((metric) => <div className={metric.emphasis ? "is-emphasis" : ""} key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong>{metric.detail && <small>{metric.detail}</small>}</div>)}
    </div>;
  }

  function PrintableVehiclePresentationSlide({ scopeReport, dimension, metadata, companyId = "ntr", position, total }) {
    const company = getReportCompany(companyId);
    const summary = scopeReport.summary?.dimensions?.[dimension];
    const samples = getVehiclePresentationSampleRows(scopeReport, dimension);
    const criteria = scopeReport.criteria || {};
    const stationName = scopeReport.sourceStation?.name || metadata.stationName || REPORT_TEXT.placeholder.station;
    const stationCode = scopeReport.sourceStation?.id || metadata.stationCode || REPORT_TEXT.placeholder.missing;
    const dimensionTitle = dimension === "plate" ? "ผลทดสอบการอ่านป้ายทะเบียน" : "ผลทดสอบการคัดแยกประเภทรถ";
    const criteriaStart = criteria.startAt ? formatDateTime(criteria.startAt) : "—";
    const criteriaEnd = criteria.endAt ? formatDateTime(criteria.endAt) : "—";
    const sampleDescription = "ตัวอย่างอย่างละหนึ่งรายการ: ผ่าน ผิด และตรวจไม่ได้ (ตามผลที่มี)";
    return <section className={`ops-presentation-item-slide ops-presentation-vehicle-slide company-slide-${company.id}`.trim()} data-presentation-vehicle-dimension={dimension} data-presentation-vehicle-scope={scopeReport.scope || "all"} data-presentation-vehicle-sample-count={samples.length} aria-label={`${dimensionTitle} · ${scopeReport.scopeLabel || "ผลรวม"}`}>
      <header className="ops-presentation-reference-header">
        <div className="ops-presentation-reference-title"><img className="company-slide-logo" data-company-asset src={`/report/companies/${company.logo}`} alt={`${company.name} logo`} /><div><span>ผลทดสอบ API · {company.name}</span><strong>{stationName}</strong></div></div>
        <div className="ops-presentation-reference-context"><span>รหัสสถานี</span><strong>{stationCode}</strong></div>
        <div className="ops-presentation-reference-context"><span>ขอบเขตทดสอบ</span><strong>{scopeReport.scopeLabel || "ผลรวม"}</strong><small>{scopeReport.scopeTimeLabel || ""}</small></div>
        <div className="ops-presentation-reference-status"><Icon name="search" size="small" /><strong>{summary?.total || 0} คัน</strong></div>
      </header>
      <header className="ops-presentation-item-heading ops-presentation-vehicle-heading"><div><p className="ops-eyebrow">{position} / {total} · {criteriaStart} ถึง {criteriaEnd}</p><h2>{dimensionTitle}</h2></div></header>
      <PrintableVehiclePresentationMetrics summary={summary} threshold={scopeReport.thresholds?.[dimension] || (dimension === "plate" ? 80 : 90)} />
      <section className="ops-presentation-vehicle-samples" aria-label={`ตัวอย่างผลทดสอบ ${dimensionTitle}`}>
        <div className="ops-presentation-vehicle-samples-heading"><h3>ตารางตัวอย่างข้อมูลทดสอบ</h3><span>{sampleDescription}</span></div>
        <div className="ops-presentation-vehicle-table-wrap"><table className="ops-presentation-vehicle-table"><thead><tr><th>ผล / วันเวลา / เลน</th><th>{dimension === "plate" ? "ป้ายทะเบียนจาก API" : "ประเภทรถจาก API"}</th><th>{dimension === "plate" ? "ป้ายทะเบียนที่ยืนยัน" : "ประเภทที่ยืนยัน"}</th><th>ภาพจาก API และหลักฐานแนบ</th></tr></thead><tbody>
          {samples.map((row) => <PrintableVehiclePresentationSample key={row.id} row={row} dimension={dimension} />)}
          {!samples.length && <tr className="ops-presentation-vehicle-empty"><td colSpan="4">ไม่มีตัวอย่างผลที่บันทึกไว้ · ตรวจยอดรวมและรายการรอตรวจในสรุปด้านบน</td></tr>}
        </tbody></table></div>
      </section>
      <footer className="ops-presentation-slide-footnote">รายงานจากข้อมูลรอบตรวจ · {scopeReport.scopeTimeLabel || scopeReport.scopeLabel || "ผลรวม"} · {summary?.pending || 0} คันรอตรวจ</footer>
    </section>;
  }

  function PrintableReport({ round, state = null, preview = false, mode = "standard", companyId = "ntr", reportCoverMeta = null, draft = false }) {
    const printableCoverMeta = draft && !reportCoverMeta?.reportTitle
      ? { ...(reportCoverMeta || {}), reportTitle: "ฉบับร่างรายงานตรวจสถานี" }
      : reportCoverMeta;
    const model = buildReportTemplateModel(round, state, printableCoverMeta);
    const company = getReportCompany(companyId);
    const reportThemeStyle = {
      '--company-ink': company.theme.ink,
      '--company-heading': company.theme.heading || company.theme.ink,
      '--company-accent': company.theme.accent,
      '--company-paper': company.theme.paper,
      '--company-line': company.theme.line,
      '--company-accent-soft': company.theme.accentSoft,
    };
    const isPresentation = mode === "presentation";
    const usesCleaningPages = !isPresentation && round?.snapshot?.checklistPolicyVersion === "station-item-controls-v9";
    const reportVariantId = isPresentation ? REPORT_TEXT.document.presentationTemplateId : model.templateId;
    const correction = model.correction;
    const reportDocument = REPORT_TEXT.document;
    const detailRuns = [];
    model.orderedItems.forEach((item, index) => {
      const section = item.presentationSection || { code: item.sectionCode || "", title: item.sourceSectionTitle || "" };
      const cleaning = usesCleaningPages && (item.isEquipmentCleaning || item.isAreaCleaning);
      const previous = detailRuns[detailRuns.length - 1];
      if (previous && previous.section.code === section.code && previous.cleaning === cleaning) previous.items.push(item);
      else detailRuns.push({ key: `${section.code}-${index}`, section, cleaning, items: [item] });
    });
    const reportRevisionMarker = round.basedOnRoundId
      ? `ฉบับแก้ไขครั้งที่ ${round.revisionNumber || 1}`
      : correction
        ? `มีการแก้ไขย้อนหลัง ${correction.count} ครั้ง`
        : "";
    const vehicleReport = model.vehicleSearch;
    const vehiclePresentationSlides = getVehiclePresentationSlides(vehicleReport);
    const hasPresentationSlides = model.orderedItems.length > 0 || vehiclePresentationSlides.length > 0;
    return <section className={`ops-print-report company-report-${company.id} company-report-variant-${company.coverVariant} ${preview ? "is-report-preview" : ""} ${draft ? "is-draft" : ""}`.trim()} style={reportThemeStyle} data-company={company.id} data-company-variant={company.coverVariant} data-report-template={model.templateId} data-report-variant={reportVariantId} data-report-design="field-audit-v3" data-report-mode={isPresentation ? "presentation" : "standard"} data-report-draft={draft ? "true" : "false"} aria-label={`${isPresentation ? REPORT_TEXT.aria.presentation : REPORT_TEXT.aria.standard} ${company.name}${draft ? " ฉบับร่าง" : ""}`}>
      {!isPresentation && <CompanyReportCover model={model} companyId={companyId} draft={draft} />}
      {!isPresentation && <div className="company-report-document-details">
        <div className="ops-print-cover-content">
      {reportRevisionMarker && <p className="ops-print-revision-marker">{reportRevisionMarker}</p>}
       <PrintableVehicleReport vehicleReport={vehicleReport} metadata={model.metadata} />
        </div>
      </div>}
      {isPresentation && <PrintablePresentationPage className={`is-cover${hasPresentationSlides ? "" : " is-last"}`}><CompanyReportCover model={model} companyId={companyId} draft={draft} presentation /></PrintablePresentationPage>}
       {preview && vehicleReport && <VehicleEvidenceReadiness />}
      {isPresentation ? <PrintablePresentationSlides model={model} vehicleSlides={vehiclePresentationSlides} companyId={company.id} /> : <>
        <div className={`ops-print-section-list${model.orderedItems.length ? "" : " is-empty"}`}>
          {detailRuns.map((run) => run.cleaning
            ? run.items.map((item) => <PrintableCleaningChecklistItem key={item.id} item={item} section={run.section} />)
            : <section className={`ops-print-section${run.items.length <= 6 ? " is-compact" : ""}`} key={run.key} data-report-section={run.section.code}>
              <div className="ops-print-section-title"><span>{run.section.code}</span><div><h3>{run.section.title}</h3><p>{run.items.length} {REPORT_TEXT.table.itemCount}</p></div><strong>{REPORT_TEXT.table.enabled}</strong></div>
              <div className="ops-print-table-wrap"><table className="ops-print-items-table"><caption className="sr-only">{REPORT_TEXT.table.description}หมวด {run.section.title}</caption><colgroup><col className="ops-print-col-number" /><col className="ops-print-col-description" /><col className="ops-print-col-status" /><col className="ops-print-col-details" /><col className="ops-print-col-evidence" /></colgroup><thead><tr><th scope="col">{REPORT_TEXT.table.number}</th><th scope="col">{REPORT_TEXT.table.description}</th><th scope="col">{REPORT_TEXT.table.status}</th><th scope="col">{REPORT_TEXT.table.details}</th><th scope="col">{REPORT_TEXT.table.evidence}</th></tr></thead><tbody>{run.items.map((item) => <PrintableChecklistItem key={item.id} item={item} />)}</tbody></table></div>
            </section>)}
           </div>
           {!model.orderedItems.length && <EmptyState icon="info" title={REPORT_TEXT.placeholder.noActiveItems}>{reportDocument.noActiveItemsDetail}</EmptyState>}
          <PrintableEvidenceGallery model={model} omitCleaning={usesCleaningPages} />
       </>}
      <AcDcLegacyArchive archive={round.acDcSplitArchive} print renderEvidence={(item, value) => <div className="ops-print-evidence-gallery">{(item.evidenceSlots || []).map(slot => { const evidence = value.evidence?.[slot.id] || {}; return <div key={slot.id}><p>{slot.displayLabel || slot.label}{evidence.value ? ` · ${evidence.value}` : ""}</p>{evidence.note && <p>{evidence.note}</p>}{evidence.attachment && <PrintableAttachment attachment={evidence.attachment} label={slot.displayLabel || slot.label} />}</div>; })}{value.attachment && <PrintableAttachment attachment={value.attachment} label={item.label} />}</div>} />
      <footer className="ops-print-footer"><span>{REPORT_TEXT.presentation.snapshotFooter}</span><span>{reportVariantId} · {isPresentation ? reportDocument.modePresentation : reportDocument.modeA4}</span></footer>
     </section>;
  }

  return memo(PrintableReport);
}
