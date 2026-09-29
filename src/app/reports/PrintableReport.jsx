import { useEffect, useRef, useState } from "react";

export function createPrintableReportComponent(runtime) {
  const {
    EmptyState, Icon, REPORT_COPY, REPORT_TEXT, STATUS_META, StatusBadge, VEHICLE_REVIEW_CORRECTION_TARGET_OPTIONS, VEHICLE_REVIEW_REASON_OPTIONS,
    CompanyReportCover, buildReportTemplateModel, formatDate, formatDateTime, getPresentationEvidenceCaption,
    getReportCompany, getStoredAttachment, shortId, statusClass,
  } = runtime;

  function PrintableAttachment({ attachment, label }) {
    const [previewUrl, setPreviewUrl] = useState("");
    const [loadError, setLoadError] = useState(false);
    const [mediaReady, setMediaReady] = useState(false);
    const objectUrlRef = useRef("");

    useEffect(() => {
      let cancelled = false;
      setPreviewUrl("");
      setLoadError(false);
      setMediaReady(false);
      if (!attachment?.id) return undefined;
      const attachmentType = String(attachment.type || "");
      const isMedia = attachmentType.startsWith("image/") || attachmentType.startsWith("video/");
      getStoredAttachment(attachment.id).then((blob) => {
        if (cancelled) return;
        if (!blob) {
          setLoadError(true);
          return;
        }
        const nextUrl = URL.createObjectURL(blob);
        objectUrlRef.current = nextUrl;
        setPreviewUrl(nextUrl);
        if (!isMedia) setMediaReady(true);
      }).catch(() => {
        if (!cancelled) setLoadError(true);
      });
      return () => {
        cancelled = true;
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
          objectUrlRef.current = "";
        }
      };
    }, [attachment?.id]);

    if (!attachment) return null;
    const isVideo = String(attachment.type || "").startsWith("video/");
    const isImage = String(attachment.type || "").startsWith("image/");
    const state = loadError ? "missing" : previewUrl && mediaReady ? "ready" : "loading";
    return <figure className={`ops-print-attachment ${loadError ? "is-missing" : ""}`} data-print-attachment={state}>
      <div className="ops-print-attachment-image-wrap">
        {previewUrl && !loadError && isVideo ? <video src={previewUrl} controls preload="metadata" onLoadedData={() => setMediaReady(true)} onError={() => setLoadError(true)} aria-label={`${REPORT_TEXT.attachment.videoAlt} ${label}`} /> : previewUrl && !loadError && isImage ? <img src={previewUrl} alt={`${REPORT_TEXT.attachment.imageAlt} ${label}`} data-print-image="true" onLoad={() => setMediaReady(true)} onError={() => setLoadError(true)} /> : <span className="ops-print-attachment-warning">{loadError ? REPORT_TEXT.attachment.missingFile : attachment.type === "application/pdf" ? REPORT_TEXT.attachment.documentFile : REPORT_TEXT.attachment.attachedFile}</span>}
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
        {entry.sourceLabel && entry.sourceLabel !== entryLabel && <small>{REPORT_TEXT.attachment.pdfReference} {entry.sourceLabel}</small>}
        {entry.note && <p>{entry.note}</p>}
        {entry.attachment ? <PrintableAttachment attachment={entry.attachment} label={entryLabel} /> : <span className="ops-print-evidence-empty">{REPORT_TEXT.placeholder.noEvidenceFile}</span>}
      </div>;
    })}</div>;
  }

  function PrintableChecklistItem({ item }) {
    return <tr className={`ops-print-item ${statusClass(item.status)}`} data-print-item-id={item.id}>
      <td className="ops-print-item-number"><span>{String(item.index || "-").padStart(2, "0")}</span></td>
      <td className="ops-print-item-description"><h4>{item.label}</h4>{(item.assetNo || item.location || item.serialNo || item.laneNo) && <p>{[item.assetNo, item.laneNo && `${REPORT_TEXT.table.lanePrefix} ${item.laneNo}`, item.location, item.serialNo && `${REPORT_TEXT.table.serialPrefix} ${item.serialNo}`].filter(Boolean).join(" · ")}</p>}{item.relationshipPath && <small className="ops-print-relationship-path">{item.relationshipPath}</small>}</td>
      <td className="ops-print-item-status"><StatusBadge status={item.status}>{item.statusLabel}</StatusBadge></td>
      <td className="ops-print-item-details"><strong>{getPrintableItemValue(item)}</strong>{item.note && <p><b>{REPORT_TEXT.table.note}</b> {item.note}</p>}{item.helper && <small>{item.helper}</small>}</td>
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
      <h2 className="ops-print-cleaning-title">ทำความสะอาด {cleaningName}</h2>
      <dl className="ops-print-cleaning-facts">
        <div><dt>อุปกรณ์</dt><dd>{cleaningName}</dd></div>
        <div><dt>Asset No.</dt><dd>{item.assetNo || "—"}</dd></div>
        <div><dt>ตำแหน่ง</dt><dd>{item.location || "—"}</dd></div>
      </dl>
      {item.helper && <p className="ops-print-cleaning-helper">{item.helper}</p>}
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

  function PrintableSummaryStrip({ summary }) {
    const metrics = [
      { label: REPORT_TEXT.summary.progress, value: `${summary.progress}%`, detail: `${summary.done} จาก ${summary.total} รายการ · ค้าง ${summary.pending}`, icon: "check", tone: "complete" },
      { label: REPORT_TEXT.summary.checked, value: summary.done, detail: REPORT_TEXT.summary.checkedDetail, icon: "clipboard", tone: "normal" },
      { label: REPORT_TEXT.summary.followUp, value: summary.issues, detail: summary.issues ? REPORT_TEXT.summary.followUpDetail : REPORT_TEXT.summary.noFollowUp, icon: "alert", tone: summary.issues ? "waiting" : "normal" },
      { label: REPORT_TEXT.summary.evidenceComplete, value: summary.evidenceComplete, detail: `จาก ${summary.evidenceTotal} ช่อง · ไม่ครบ ${summary.evidenceIncomplete}`, icon: "camera", tone: summary.evidenceIncomplete ? "waiting" : "complete" },
    ];
    return <section className="ops-print-summary-strip" aria-label={REPORT_TEXT.summary.aria}>{metrics.map((metric) => <div className={`ops-print-summary-metric tone-${metric.tone}`} key={metric.label}>
      <span className="ops-print-summary-icon"><Icon name={metric.icon} size="small" /></span>
      <div><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.detail}</small></div>
    </div>)}</section>;
  }

  const PRINT_SECTION_ICON_BY_CODE = Object.freeze({
    "1.1": "equipment",
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

  const REPORT_BLUEPRINT_BACKGROUND = "/report/blueprint-paper-bg.png";

  function PrintableSectionOverview({ sections }) {
    if (!sections.length) return null;
    const itemCount = sections.reduce((total, section) => total + (Array.isArray(section.items) ? section.items.length : 0), 0);
    return <section className="ops-print-cover-overview" aria-label={REPORT_TEXT.table.scopeTitle}>
      <div className="ops-print-cover-overview-heading">
        <div><p>{REPORT_TEXT.table.scopeEyebrow}</p><h2>{REPORT_TEXT.table.scopeTitle}</h2></div>
        <strong>{sections.length} หมวด · {itemCount} รายการ</strong>
      </div>
      <div className="ops-print-cover-overview-grid">
        {sections.map((section) => {
          const itemCountForSection = Array.isArray(section.items) ? section.items.length : 0;
          const iconName = PRINT_SECTION_ICON_BY_CODE[section.code] || "list";
          return <div className="ops-print-cover-overview-item" data-section-code={section.code} data-context-icon={iconName} key={section.code}>
          <span className="ops-print-cover-overview-icon" aria-hidden="true"><Icon name={iconName} size="small" /></span>
          <span className="ops-print-cover-overview-code">{section.code}</span>
          <div><strong>{section.title}</strong></div>
          <small>{itemCountForSection} {REPORT_TEXT.table.itemCount}</small>
        </div>;
        })}
      </div>
    </section>;
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
        <div><strong>{label}</strong>{entry.sourceLabel && entry.sourceLabel !== label && <small>{REPORT_TEXT.attachment.pdfReference} {entry.sourceLabel}</small>}</div>
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
    const stationLabel = metadata.stationName || metadata.stationCode || REPORT_TEXT.placeholder.station;
    const assetDetails = [item.laneNo && `${REPORT_TEXT.table.lanePrefix} ${item.laneNo}`, item.location].filter(Boolean).join(" · ") || REPORT_TEXT.placeholder.equipment;
    const serialDetails = item.note || item.helper || REPORT_TEXT.placeholder.note;
    return [
      { label: REPORT_TEXT.presentation.result, value: item.statusLabel, description: `${REPORT_TEXT.presentation.station} ${stationLabel}`, icon: STATUS_META[item.status]?.icon || "info" },
      { label: REPORT_TEXT.presentation.itemDetails, value: getPrintableItemValue(item), description: item.helper || REPORT_TEXT.presentation.recordedValue, icon: "clipboard" },
      { label: REPORT_TEXT.presentation.equipmentLane, value: item.assetNo || REPORT_TEXT.placeholder.missing, description: assetDetails, icon: "equipment" },
      { label: REPORT_TEXT.presentation.serialNote, value: item.serialNo || REPORT_TEXT.placeholder.missing, description: serialDetails, icon: "info" },
      { label: REPORT_TEXT.presentation.evidenceSummary, value: `${evidenceComplete} / ${evidenceTotal} ช่อง`, description: evidenceTotal > evidenceComplete ? REPORT_TEXT.presentation.evidenceIncomplete : REPORT_TEXT.presentation.evidenceComplete, icon: evidenceTotal > evidenceComplete ? "alert" : "check", emphasis: true },
    ];
  }

  function getPresentationCoverEvidence(model) {
    const attached = [];
    const fallback = [];
    model.sections.forEach((section) => section.items.forEach((item) => {
      const printableEntries = getPrintableEvidenceEntries(item);
      if (printableEntries.length) {
        printableEntries.forEach((entry) => {
          const candidate = { section, item, entry };
          if (entry.attachment) attached.push(candidate);
          else fallback.push(candidate);
        });
        return;
      }
      const [placeholder] = getPresentationEvidenceEntries(item);
      fallback.push({ section, item, entry: placeholder });
    }));
    return [...attached, ...fallback].slice(0, 3);
  }

  function CoverIcon({ name, size = "normal" }) {
    return <Icon name={name} size={size} />;
  }

  function PrintablePresentationCover({ model }) {
    const { metadata, summary, sections } = model;
    const coverEvidence = getPresentationCoverEvidence(model);
    const overallStatus = summary.issues > 0 ? REPORT_COPY.status.issue : summary.pending > 0 ? REPORT_COPY.status.presentationPending : REPORT_COPY.status.presentationComplete;
    const overallStatusIcon = summary.issues > 0 ? "alert" : summary.pending > 0 ? "info" : "check";
    const overallStatusTone = summary.issues > 0 ? "damaged" : summary.pending > 0 ? "pending" : "normal";
    const summaryCells = [
      { label: REPORT_TEXT.presentation.progress, value: `${summary.progress}%`, detail: `${summary.done} จาก ${summary.total} รายการ`, icon: "clipboard" },
      { label: REPORT_TEXT.presentation.checkedItems, value: `${summary.done} / ${summary.total}`, detail: REPORT_TEXT.presentation.progressDetail, icon: "check" },
      { label: REPORT_TEXT.presentation.evidenceRecorded, value: summary.evidenceComplete, detail: `จาก ${summary.evidenceTotal} ช่อง`, icon: "photo" },
      { label: REPORT_TEXT.presentation.categoryCount, value: sections.length, detail: REPORT_TEXT.presentation.categoryDetail, icon: "grid" },
    ];
    return <section className="ops-presentation-cover-v2" aria-label={REPORT_TEXT.aria.cover}>
      <img className="ops-presentation-cover-v2-background" src={REPORT_BLUEPRINT_BACKGROUND} alt="" aria-hidden="true" />
      <div className="ops-presentation-cover-v2-content">
        <header className="ops-presentation-cover-v2-header">
          <div className="ops-presentation-cover-v2-title">
            <p>{REPORT_TEXT.presentation.brandEyebrow}</p>
            <h1>{REPORT_TEXT.presentation.title}</h1>
            <span>{REPORT_TEXT.presentation.subtitle}</span>
          </div>
          <div className="ops-presentation-cover-v2-context">
            <div className="ops-cover-context-field"><CoverIcon name="pin" /><div><span>{REPORT_TEXT.presentation.station}</span><strong>{metadata.stationCode || REPORT_TEXT.placeholder.missing}</strong><small>{metadata.stationName || REPORT_TEXT.placeholder.station}</small></div></div>
            <div className="ops-cover-context-field"><CoverIcon name="calendar" /><div><span>{REPORT_TEXT.presentation.inspectionDate}</span><strong>{metadata.inspectionDate ? formatDate(metadata.inspectionDate) : REPORT_TEXT.placeholder.missing}</strong></div></div>
            <div className={`ops-presentation-cover-v2-status ${statusClass(overallStatusTone)}`}><span>{REPORT_TEXT.presentation.inspectionStatus}</span><strong className="ops-cover-status-pill"><CoverIcon name={overallStatusIcon} />{overallStatus}</strong></div>
          </div>
        </header>
        <div className="ops-presentation-cover-v2-evidence-grid">
          {coverEvidence.map(({ entry, item }, index) => {
            const label = entry.displayLabel || entry.sourceLabel || item.label;
            const caption = getPresentationEvidenceCaption(entry, item.helper || REPORT_TEXT.presentation.evidenceCaption);
            return <article className={`ops-presentation-cover-v2-evidence-card ${entry.attachment ? "has-attachment" : "is-missing"}`.trim()} key={`${item.id}-${entry.id || index}`}>
              <header><span>{index + 1}</span><strong>{label}</strong></header>
              <div className="ops-presentation-cover-v2-evidence-media">
                {entry.attachment ? <PrintableAttachment attachment={entry.attachment} label={label} /> : <div className="ops-presentation-cover-v2-placeholder"><CoverIcon name="camera" size="small" /><strong>{REPORT_TEXT.placeholder.noEvidenceFile}</strong><small>{entry.statusLabel || REPORT_TEXT.placeholder.evidenceStatus}</small></div>}
              </div>
              <p>{caption}</p>
              {index < coverEvidence.length - 1 && <span className="ops-presentation-cover-v2-arrow" aria-hidden="true"><CoverIcon name="arrow" size="small" /></span>}
            </article>;
          })}
        </div>
        <section className="ops-presentation-cover-v2-summary" aria-label={REPORT_TEXT.aria.summary}>
          {summaryCells.map((cell) => <div className="ops-presentation-cover-v2-summary-cell" key={cell.label}>
            <span className="ops-presentation-cover-v2-summary-icon"><CoverIcon name={cell.icon} size="small" /></span>
            <div><span>{cell.label}</span><strong>{cell.value}</strong><small>{cell.detail}</small></div>
          </div>)}
        </section>
        <section className="ops-presentation-cover-v2-scope" aria-label={REPORT_TEXT.aria.scope}>
          <div className="ops-presentation-cover-v2-scope-heading"><span className="ops-presentation-cover-v2-scope-icon"><CoverIcon name="target" size="small" /></span><strong>{REPORT_TEXT.presentation.scopeTitle}</strong></div>
          <div className="ops-presentation-cover-v2-scope-items">{sections.slice(0, 6).map((section) => <span key={section.code}><CoverIcon name="check" size="small" />{section.title}</span>)}{sections.length > 6 && <span className="is-more">+{sections.length - 6} {REPORT_TEXT.presentation.moreCategories}</span>}</div>
        </section>
      </div>
    </section>;
  }

  function PrintablePresentationPage({ children, className = "" }) {
    return <div className={`ops-presentation-print-page ${className}`.trim()}>{children}</div>;
  }

  function PrintablePresentationItemSlide({ section, item, position, total, evidenceEntries, allEvidenceEntries, metadata, continuation = false, companyId = "ntr" }) {
    const itemDetails = [
      item.assetNo && `${REPORT_TEXT.presentation.assetNo} ${item.assetNo}`,
      item.laneNo && `${REPORT_TEXT.table.lanePrefix} ${item.laneNo}`,
      item.location,
      item.serialNo && `${REPORT_TEXT.table.serialPrefix} ${item.serialNo}`,
    ].filter(Boolean);
    const stationLabel = metadata.stationName || metadata.stationCode || REPORT_TEXT.placeholder.station;
    const inspectionDateLabel = metadata.inspectionDate ? formatDate(metadata.inspectionDate) : REPORT_TEXT.placeholder.date;
    const evidenceComplete = allEvidenceEntries.filter(isPrintableEvidenceComplete).length;
    const evidenceTotal = allEvidenceEntries.length;
    const summaryCells = getPresentationSummaryCells({ item, metadata, evidenceComplete, evidenceTotal });
    const company = getReportCompany(companyId);
    return <section className={`ops-presentation-item-slide company-slide-${company.id} slots-${Math.min(evidenceEntries.length, 4)}${continuation ? " is-continuation" : ""}`.trim()} data-print-presentation-item-id={item.id} data-print-presentation-position={position} data-presentation-continuation={continuation ? "true" : "false"} aria-label={`${REPORT_TEXT.presentation.itemPrefix}ตรวจ ${item.label}`}>
      <header className="ops-presentation-reference-header">
        <div className="ops-presentation-reference-title"><img className="company-slide-logo" data-company-asset src={`/report/companies/${company.logo}`} alt={`${company.name} logo`} /><div><span>{REPORT_TEXT.presentation.reportByStation} · {company.name}</span><strong>{section.title}</strong></div></div>
        <div className="ops-presentation-reference-context"><span>{REPORT_TEXT.presentation.referenceStation}</span><strong>{stationLabel}</strong></div>
        <div className="ops-presentation-reference-context"><span>{REPORT_TEXT.presentation.referenceDate}</span><strong>{inspectionDateLabel}</strong></div>
        <div className={`ops-presentation-reference-status ${statusClass(item.status)}`}><Icon name={STATUS_META[item.status]?.icon || "info"} size="small" /><strong>{item.statusLabel}</strong></div>
      </header>
      <header className="ops-presentation-item-heading">
        <div><p className="ops-eyebrow">{section.code} · {REPORT_TEXT.presentation.itemPrefix} {position} / {total}{continuation ? ` · ${REPORT_TEXT.presentation.continuation}` : ""}</p><h2>{item.label}</h2>{itemDetails.length > 0 && <p>{itemDetails.join(" · ")}</p>}</div>
      </header>
      <div className="ops-presentation-evidence-grid">
        {evidenceEntries.map((entry, index) => <PrintablePresentationEvidenceCard key={entry.id} entry={entry} item={item} index={index} total={evidenceEntries.length} />)}
      </div>
      <div className="ops-presentation-summary-band" aria-label={REPORT_TEXT.presentation.summary}>
        {summaryCells.map((cell) => <div className={`ops-presentation-summary-cell${cell.emphasis ? " is-emphasis" : ""}`.trim()} key={cell.label}><span className="ops-presentation-summary-icon"><Icon name={cell.icon} size="small" /></span><div><span>{cell.label}</span><strong>{cell.value}</strong><small>{cell.description}</small></div></div>)}
      </div>
      <footer className="ops-presentation-slide-footnote">{item.note ? `${REPORT_TEXT.presentation.note} ${item.note}` : item.helper || REPORT_TEXT.presentation.snapshotFooter}</footer>
    </section>;
  }

  function PrintablePresentationSlides({ model, vehicleSlides = [], companyId = "ntr" }) {
    const slideItems = model.sections.flatMap((section) => section.items.flatMap((item) => {
      const allEvidenceEntries = getPresentationEvidenceEntries(item);
      return chunkPresentationEvidence(allEvidenceEntries).map((evidenceEntries, index) => ({ section, item, evidenceEntries, allEvidenceEntries, continuation: index > 0 }));
    }));
    const totalSlides = slideItems.length + vehicleSlides.length;
    if (!totalSlides) return <div className="ops-presentation-empty"><EmptyState icon="info" title={REPORT_TEXT.placeholder.noActiveItems}>{REPORT_TEXT.presentation.noActiveItemsDetail}</EmptyState></div>;
    return <div className={`ops-presentation-slide-list company-slides-${companyId}`} data-presentation-slide-count={totalSlides} data-presentation-vehicle-slide-count={vehicleSlides.length}>
      {slideItems.map((slide, index) => <PrintablePresentationPage className={`company-slide-page company-${companyId}${index === totalSlides - 1 ? " is-last" : ""}`} key={`checklist-${slide.item.id}-${index}`}><PrintablePresentationItemSlide {...slide} metadata={model.metadata} companyId={companyId} position={index + 1} total={totalSlides} /></PrintablePresentationPage>)}
      {vehicleSlides.map((slide, index) => {
        const position = slideItems.length + index + 1;
        return <PrintablePresentationPage className={`company-slide-page company-${companyId}${position === totalSlides ? " is-last" : ""}`} key={`vehicle-${slide.scopeReport.scope || "all"}-${slide.dimension}`}><PrintableVehiclePresentationSlide {...slide} metadata={model.metadata} companyId={companyId} position={position} total={totalSlides} /></PrintablePresentationPage>;
      })}
    </div>;
  }

  function buildPrintableGalleryItems(model, { omitCleaning = false } = {}) {
    const items = [];
    const seen = new Set();
    model.sections.forEach((section) => section.items.forEach((item) => {
      if (omitCleaning && (item.isEquipmentCleaning || item.isAreaCleaning)) return;
      getPrintableEvidenceEntries(item).forEach((entry) => {
        const attachment = entry.attachment;
        const type = String(attachment?.type || "");
        if (!attachment?.id || (!type.startsWith("image/") && !type.startsWith("video/")) || seen.has(attachment.id)) return;
        seen.add(attachment.id);
        items.push({ attachment, label: entry.displayLabel || entry.sourceLabel || item.label });
      });
    }));
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
      <div className="ops-print-vehicle-chart-accuracy"><span>ความถูกต้อง · ถูก {summary.correct}/{summary.reviewed} คันที่ตัดสิน</span><strong>{summary.accuracy === null ? "—" : `${summary.accuracy}%`}</strong><div className="ops-print-vehicle-threshold-track"><span style={{ width: `${Math.min(100, Math.max(0, summary.accuracy || 0))}%` }} /><i style={{ left: `${threshold}%` }} aria-hidden="true" /></div><small>บันทึกผลแล้ว {summary.decided}/{summary.total} คัน · รอตรวจ {summary.pending} คัน</small></div>
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
    return <figure className="ops-print-vehicle-evidence-image"><img src={src} alt={label} onError={() => setFailed(true)} /><figcaption>{label}</figcaption></figure>;
  }

  function PrintableVehicleEvidenceRow({ row }) {
    const plateDetail = row.reviewDetails?.plate || {};
    const classificationDetail = row.reviewDetails?.classification || {};
    const plateCorrectionTarget = vehicleCorrectionTargetLabel("plate", plateDetail.correctionTarget);
    return <article className="ops-print-vehicle-evidence-row">
      <header><strong>{row.plateNumber || "ไม่พบทะเบียน"}</strong><span>{row.occurredAt ? formatDateTime(row.occurredAt) : "ไม่พบเวลา"} · {row.lane || "ไม่ระบุ Lane"}</span></header>
      <dl><div><dt>ทะเบียนจาก API</dt><dd>{row.plateNumber || "—"} · {vehiclePrintStatusLabel(row.reviewStatus)}</dd></div><div><dt>ทะเบียนที่ยืนยัน</dt><dd>{plateDetail.correctedValue ? `${plateCorrectionTarget ? `${plateCorrectionTarget} · ` : ""}${plateDetail.correctedValue}` : "เหมือนค่า API / ไม่มีการแก้"}</dd></div><div><dt>ประเภทรถจาก API</dt><dd>{row.vehicleClassLabel || "—"} · {vehiclePrintStatusLabel(row.classificationReviewStatus)}</dd></div><div><dt>ประเภทที่ยืนยัน</dt><dd>{classificationDetail.correctedValue || "เหมือนค่า API / ไม่มีการแก้"}</dd></div><div><dt>น้ำหนักรวม</dt><dd>{formatVehiclePrintWeight(row.grossWeight)}</dd></div></dl>
      {(plateDetail.reasonCode || classificationDetail.reasonCode || plateDetail.note || classificationDetail.note) && <div className="ops-print-vehicle-evidence-reason"><strong>เหตุผล/หมายเหตุ</strong><span>{[vehicleReviewReasonLabel("plate", plateDetail.reasonCode), vehicleReviewReasonLabel("classification", classificationDetail.reasonCode), plateDetail.note, classificationDetail.note].filter(Boolean).join(" · ")}</span></div>}
      <div className="ops-print-vehicle-evidence-images"><PrintableVehicleReportImage src={row.plateImage} label="ภาพป้ายทะเบียนจาก API" /><PrintableVehicleReportImage src={row.overviewImage} label="ภาพรถจาก API" />{plateDetail.evidenceAttachment && <PrintableAttachment attachment={plateDetail.evidenceAttachment} label="หลักฐานเพิ่มเติมด้านทะเบียน" />}{classificationDetail.evidenceAttachment && <PrintableAttachment attachment={classificationDetail.evidenceAttachment} label="หลักฐานเพิ่มเติมด้านประเภทรถ" />}</div>
    </article>;
  }

  function PrintableVehicleReport({ vehicleReport }) {
    if (!vehicleReport) return null;
    const scopeReports = vehicleReport.scoped ? vehicleReport.scopes : [vehicleReport];
    return <section className="ops-print-vehicle-summary"><div><p className="ops-eyebrow">ผลตรวจจาก API สถานี</p><h3>ผลตรวจข้อมูลรถจาก API</h3><span>{vehicleReport.scoped ? "แยกผลตรวจตามช่วงกลางวันและกลางคืน" : `${vehicleReport.criteria?.startAt || "—"} ถึง ${vehicleReport.criteria?.endAt || "—"}`}</span></div>{scopeReports.map((scopeReport) => {
      const plateSummary = scopeReport.summary?.dimensions?.plate;
      const classificationSummary = scopeReport.summary?.dimensions?.classification;
      const issues = scopeReport.issues || [];
      return <section className="ops-print-vehicle-scope" key={scopeReport.scope || "all"}>
        <div className="ops-print-vehicle-scope-heading"><strong>{scopeReport.scopeLabel || "ผลรวม"}</strong>{scopeReport.scopeTimeLabel && <span>{scopeReport.scopeTimeLabel}</span>}<small>{scopeReport.criteria?.startAt || "—"} ถึง {scopeReport.criteria?.endAt || "—"} · {scopeReport.sourceStation?.id || "—"} · {scopeReport.sourceStation?.name || "—"} · {scopeReport.pagination?.totalPages || 0} หน้า · {scopeReport.pagination?.totalItems || 0} คัน</small></div>
        <div className="ops-print-vehicle-outcome"><strong>ผลรอบทดสอบ: {scopeReport.outcome?.label || "ยังไม่สรุป"}</strong><span>{scopeReport.outcome?.sampleBasis === "count" ? "ผ่านเงื่อนไขจำนวนรถ 100 คัน" : scopeReport.outcome?.sampleBasis === "duration" ? "ผ่านเงื่อนไขระยะเวลา 6 ชั่วโมง" : "ยังไม่ผ่านเงื่อนไขจำนวน/เวลา"}</span>{scopeReport.outcome?.reasons?.length > 0 && <small>{scopeReport.outcome.reasons.map((reason) => reason.label).join(" · ")}</small>}</div>
        <div className="ops-print-vehicle-charts"><PrintableVehicleChart title="ผลการอ่านป้ายทะเบียน" summary={plateSummary} threshold={scopeReport.thresholds?.plate || 80} /><PrintableVehicleChart title="ผลการคัดแยกประเภทรถ" summary={classificationSummary} threshold={scopeReport.thresholds?.classification || 90} /><PrintableVehicleReasonChart issues={issues} /></div>
        <section className="ops-print-vehicle-detail-section"><h4>ตารางรายละเอียดรถทุกคัน</h4><div className="ops-print-vehicle-table-wrap"><table className="ops-print-vehicle-table"><thead><tr><th>ลำดับ/รหัส</th><th>วันเวลา · เลน</th><th>ทะเบียน / ผลตรวจ</th><th>ประเภทรถ / ผลตรวจ</th><th>น้ำหนักรวม</th><th>หลักฐาน</th></tr></thead><tbody>{(scopeReport.rows || []).map((row, index) => <tr key={row.id}><td><strong>{index + 1}</strong><small>{row.id}</small></td><td>{row.occurredAt ? formatDateTime(row.occurredAt) : "—"}<small>{row.lane || "—"}</small></td><td><strong>{row.plateNumber || "—"}</strong><small>{vehiclePrintStatusLabel(row.reviewStatus)}{row.reviewDetails?.plate?.correctionTarget ? ` · ${vehicleCorrectionTargetLabel("plate", row.reviewDetails.plate.correctionTarget)}: ${row.reviewDetails.plate.correctedValue || "—"}` : row.reviewDetails?.plate?.correctedValue ? ` · ยืนยัน ${row.reviewDetails.plate.correctedValue}` : ""}</small></td><td><strong>{row.vehicleClassLabel || "—"}</strong><small>{vehiclePrintStatusLabel(row.classificationReviewStatus)}{row.reviewDetails?.classification?.correctedValue ? ` · ยืนยัน ${row.reviewDetails.classification.correctedValue}` : ""}</small></td><td>{formatVehiclePrintWeight(row.grossWeight)}</td><td>{row.plateImage || row.overviewImage || row.reviewDetails?.plate?.evidenceAttachment || row.reviewDetails?.classification?.evidenceAttachment ? "มีหลักฐาน" : "ไม่มีภาพ"}</td></tr>)}</tbody></table></div></section>
        <section className="ops-print-vehicle-issues"><strong>รายการผิดหรืออ่านไม่ได้ ({issues.length})</strong>{issues.length ? <ul>{issues.map((issue) => <li key={`${scopeReport.scope || "all"}-${issue.id}`}><b>{issue.plateNumber || issue.rowId}</b> · {issue.dimensionLabel} · {issue.statusLabel}{issue.correctionTargetLabel ? ` · ส่วนที่ผิด: ${issue.correctionTargetLabel}` : ""}{issue.reasonLabel ? ` · ${issue.reasonLabel}` : ""}{issue.note ? ` · ${issue.note}` : ""}</li>)}</ul> : <span>ไม่พบรายการผิดหรืออ่านไม่ได้</span>}</section>
        <section className="ops-print-vehicle-evidence-appendix"><div className="ops-print-vehicle-evidence-heading"><h4>ภาคผนวกภาพหลักฐานรายคัน</h4><span>{(scopeReport.rows || []).length} คัน</span></div>{(scopeReport.rows || []).map((row) => <PrintableVehicleEvidenceRow key={`evidence-${row.id}`} row={row} />)}</section>
      </section>;
    })}</section>;
  }

  function getVehiclePresentationSlides(vehicleReport) {
    if (!vehicleReport) return [];
    const scopeReports = vehicleReport.scoped ? vehicleReport.scopes : [vehicleReport];
    return scopeReports.flatMap((scopeReport) => [
      { scopeReport, dimension: "plate" },
      ...(scopeReport.supportsClassification ? [{ scopeReport, dimension: "classification" }] : []),
    ]);
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
      { label: "ความถูกต้อง", value: summary?.accuracy === null || summary?.accuracy === undefined ? "—" : `${summary.accuracy}%`, detail: `เกณฑ์ ≥ ${threshold}%`, emphasis: true },
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
    const metadata = model.metadata;
    const reportCover = model.reportCover || {};
    const correction = model.correction;
    const reportDocument = REPORT_TEXT.document;
    const missingReportValue = REPORT_TEXT.placeholder.missing;
    const reportValue = (value) => value || missingReportValue;
    const reportControlFields = [
      [reportDocument.controlLabels.documentNo, reportValue(metadata.documentNo)],
      [reportDocument.controlLabels.round, metadata.roundId ? shortId(metadata.roundId) : missingReportValue],
      [reportDocument.controlLabels.inspectionDate, metadata.inspectionDate ? formatDate(metadata.inspectionDate) : missingReportValue],
      [reportDocument.controlLabels.stationCode, reportValue(metadata.stationCode)],
      [reportDocument.controlLabels.createdAt, metadata.createdAt ? formatDate(metadata.createdAt) : missingReportValue],
    ];
    const metadataFields = [
      [reportDocument.metadataLabels.project, reportValue(metadata.projectName)],
      [reportDocument.metadataLabels.station, reportValue(metadata.stationName)],
      ...(!reportCover.isQuickField ? [
        [reportDocument.metadataLabels.contractNo, reportValue(metadata.contractNo)],
        ["ภาค/พื้นที่", reportValue(Array.isArray(metadata.regionNames) ? metadata.regionNames.join(" · ") : metadata.regionNames)],
      ] : []),
      [reportDocument.metadataLabels.closedAt, metadata.closedAt ? formatDateTime(metadata.closedAt) : missingReportValue],
    ];
    const reportProjectContext = [metadata.projectName, metadata.stationName].filter(Boolean).join(" · ") || missingReportValue;
    const reportRevisionMarker = round.basedOnRoundId
      ? `ฉบับแก้ไขครั้งที่ ${round.revisionNumber || 1} · อ้างอิงรอบ ${shortId(round.basedOnRoundId)}`
      : correction
        ? `มีการแก้ไขย้อนหลัง ${correction.count} ครั้ง`
        : "";
    const vehicleReport = model.vehicleSearch;
    const vehiclePresentationSlides = getVehiclePresentationSlides(vehicleReport);
    const hasPresentationSlides = model.sections.some((section) => section.items.length > 0) || vehiclePresentationSlides.length > 0;
    return <section className={`ops-print-report company-report-${company.id} company-report-variant-${company.coverVariant} ${preview ? "is-report-preview" : ""} ${draft ? "is-draft" : ""}`.trim()} style={reportThemeStyle} data-company={company.id} data-company-variant={company.coverVariant} data-report-template={model.templateId} data-report-variant={reportVariantId} data-report-design="field-audit-v3" data-report-mode={isPresentation ? "presentation" : "standard"} data-report-draft={draft ? "true" : "false"} aria-label={`${isPresentation ? REPORT_TEXT.aria.presentation : REPORT_TEXT.aria.standard} ${company.name}${draft ? " ฉบับร่าง" : ""}`}>
      {isPresentation && <style data-report-print-layout="presentation">{"@media print { @page { size: 16in 9in; margin: 0; } }"}</style>}
      {!isPresentation && <CompanyReportCover model={model} companyId={companyId} draft={draft} />}
      {!isPresentation && <div className="company-report-document-details">
        <div className="ops-print-cover-content">
      <header className="ops-print-header">
        <div className="ops-print-header-main">
          <div className="ops-print-header-identity">
            <p className="ops-print-report-kicker">{reportDocument.kicker}</p>
            <h1>{reportDocument.title}</h1>
            <p className="ops-print-project-context">{reportProjectContext}</p>
            {reportRevisionMarker && <p className="ops-print-revision-marker">{reportRevisionMarker}</p>}
          </div>
          <div className="ops-print-title-lockup">
            <span className="ops-print-brand-mark"><Icon name="clipboard" /></span>
             <div><p className="ops-print-brand-eyebrow">{reportDocument.brandEyebrow}</p><h2>{reportDocument.formTitle}</h2><p>{reportDocument.formCodePrefix} · {reportVariantId}</p></div>
          </div>
        </div>
        <dl className="ops-print-control-box">{reportControlFields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      </header>
      <dl className="ops-print-meta-grid">{metadataFields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <PrintableSummaryStrip summary={model.summary} />
       <PrintableVehicleReport vehicleReport={vehicleReport} />
      <PrintableSectionOverview sections={model.sections} />
        </div>
      </div>}
      {isPresentation && <PrintablePresentationPage className={`is-cover${hasPresentationSlides ? "" : " is-last"}`}><CompanyReportCover model={model} companyId={companyId} draft={draft} presentation /></PrintablePresentationPage>}
       {isPresentation ? <PrintablePresentationSlides model={model} vehicleSlides={vehiclePresentationSlides} companyId={company.id} /> : <>
        <div className={`ops-print-section-list${model.sections.length ? "" : " is-empty"}`}>
          {model.sections.map((section) => {
            const cleaningItems = usesCleaningPages
              ? section.items.filter((item) => item.isEquipmentCleaning || item.isAreaCleaning)
              : [];
            const tableItems = usesCleaningPages
              ? section.items.filter((item) => !item.isEquipmentCleaning && !item.isAreaCleaning)
              : section.items;
            return <section className={`ops-print-section${section.items.length <= 6 ? " is-compact" : ""}`} key={section.code} data-report-section={section.code}>
              {(!usesCleaningPages || tableItems.length > 0 || cleaningItems.length === 0) && <>
                <div className="ops-print-section-title"><span>{section.code}</span><div><h3>{section.title}</h3><p>{section.items.length} {REPORT_TEXT.table.itemCount}</p></div><strong>{REPORT_TEXT.table.enabled}</strong></div>
                <div className="ops-print-table-wrap"><table className="ops-print-items-table"><caption className="sr-only">{REPORT_TEXT.table.description}หมวด {section.title}</caption><colgroup><col className="ops-print-col-number" /><col className="ops-print-col-description" /><col className="ops-print-col-status" /><col className="ops-print-col-details" /><col className="ops-print-col-evidence" /></colgroup><thead><tr><th scope="col">{REPORT_TEXT.table.number}</th><th scope="col">{REPORT_TEXT.table.description}</th><th scope="col">{REPORT_TEXT.table.status}</th><th scope="col">{REPORT_TEXT.table.details}</th><th scope="col">{REPORT_TEXT.table.evidence}</th></tr></thead><tbody>{tableItems.map((item) => <PrintableChecklistItem key={item.id} item={item} />)}</tbody></table></div>
              </>}
              {cleaningItems.map((item) => <PrintableCleaningChecklistItem key={item.id} item={item} section={section} />)}
            </section>;
          })}
           </div>
           {!model.sections.length && <EmptyState icon="info" title={REPORT_TEXT.placeholder.noActiveItems}>{reportDocument.noActiveItemsDetail}</EmptyState>}
          <PrintableEvidenceGallery model={model} omitCleaning={usesCleaningPages} />
       </>}
      <footer className="ops-print-footer"><span>{REPORT_TEXT.presentation.snapshotFooter}</span><span>{reportVariantId} · {isPresentation ? reportDocument.modePresentation : reportDocument.modeA4}</span></footer>
     </section>;
  }

  return PrintableReport;
}
