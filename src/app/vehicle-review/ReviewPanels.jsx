import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppIcon as Icon } from "../icon-system.jsx";
import { domSafeId } from "../dom-safe-id.js";
import { formatBangkokDateTime as formatDateTime, formatThaiDateTimeInput } from "../../domain/date-time.js";
import { isEvidenceSlotComplete } from "../../domain/evidence-checklist.js";
import { isEvidenceBypassItemStatus } from "../../domain/inspection-status.js";
import {
  VEHICLE_API_REVIEW_VERSION,
  VEHICLE_REVIEW_CORRECTION_TARGET_OPTIONS,
  VEHICLE_REVIEW_REASON_OPTIONS,
  VEHICLE_REVIEW_SCOPE_OPTIONS,
  VEHICLE_REVIEW_SCOPE_VERSION,
  VEHICLE_REVIEW_STATUS_OPTIONS,
  VEHICLE_REVIEW_THRESHOLDS,
  buildVehicleSearchDirectImageUrl,
  createVehicleSearchConfig,
  filterVehicleSearchRowsByTimeRange,
  getNextPendingVehicleId,
  getVehicleQueueGroups,
  getVehicleReviewContextByKey,
  getVehicleReviewDetail,
  getVehicleReviewDimensions,
  getVehicleReviewNavigation,
  getVehicleReviewOutcome,
  getVehicleReviewRows,
  getVehicleReviewScopeForTimestamp,
  getVehicleReviewScopeState,
  getVehicleReviewState,
  getVehicleSearchReviewSummary,
  isVehicleApiReviewItem,
  isVehicleReviewScopeState,
  normalizeVehicleSearchCriteria,
  normalizeVehicleSearchState,
  searchVehicles,
  setVehicleSearchEmptyResultAcknowledged,
  updateVehicleSearchDimensionReview,
  updateVehicleSearchReview,
  updateVehicleSearchScope,
} from "../../domain/vehicle-search.js";

export function createVehicleReviewComponents({ AttachmentField, EvidenceField, StatusBadge, ThaiDateTimePicker }) {
  function isVehicleCriteriaDirty(currentCriteria, fetchedCriteria) {
    const current = normalizeVehicleSearchCriteria(currentCriteria);
    const fetched = normalizeVehicleSearchCriteria(fetchedCriteria);
    return current.startAt !== fetched.startAt || current.endAt !== fetched.endAt;
  }

  function parseBangkokWallMinute(value) {
    const source = String(value || "").trim();
    const match = source.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match) return Number.NaN;
    const [, year, month, day, hour, minute] = match;
    const wallDate = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
    if (!Number.isFinite(wallDate)) return Number.NaN;
    if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(source)) return wallDate;
    const instant = new Date(source);
    if (!Number.isFinite(instant.getTime())) return Number.NaN;
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(instant);
    const part = (type) => Number(parts.find((entry) => entry.type === type)?.value);
    return Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"));
  }

  function getVehicleSearchScopesForCriteria(criteria) {
    const normalized = normalizeVehicleSearchCriteria(criteria);
    const start = parseBangkokWallMinute(normalized.startAt);
    const end = parseBangkokWallMinute(normalized.endAt);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];
    const scopeKey = getVehicleReviewScopeForTimestamp(normalized.startAt);
    if (!scopeKey) return [];
    const startDay = Math.floor(start / 86400000) * 86400000;
    const startMinuteOfDay = (start - startDay) / 60000;
    const shiftEnd = scopeKey === "day"
      ? startDay + 18 * 60 * 60000
      : startDay + (startMinuteOfDay >= 18 * 60 ? 30 * 60 : 6 * 60) * 60000;
    return end >= shiftEnd ? ["day", "night"] : [scopeKey];
  }

  const VEHICLE_REVIEW_DIMENSION_UI = Object.freeze([
    { key: "plate", statusKey: "reviewStatus", label: "ป้ายทะเบียน", correctLabel: "อ่านถูกต้อง", incorrectLabel: "อ่านไม่ถูกต้อง" },
    { key: "classification", statusKey: "classificationReviewStatus", label: "การคัดประเภท", correctLabel: "คัดประเภทถูกต้อง", incorrectLabel: "คัดประเภทไม่ถูกต้อง" },
  ]);

  function getVehicleReviewUnresolvedUnit(activeDimensions) {
    return activeDimensions.length > 1 ? "จุดตรวจ" : "คัน";
  }

  function getVehicleReviewStatusLabel(reviewState, summary, contextKey, outcome = null) {
    if (outcome?.status === "passed") return "ผ่านเกณฑ์";
    if (outcome?.status === "failed") return "ไม่ผ่านเกณฑ์";
    if (outcome?.status === "incomplete" && summary.total && !summary.unresolvedChecks) return "ยังไม่ครบเกณฑ์";
    if (reviewState?.key === "reviewing" && contextKey === "plate") return `ข้อมูล API พร้อมตรวจ · คงเหลือ ${summary.unresolvedChecks} คัน`;
    return reviewState?.label || "";
  }

  function getVehicleReviewStatusTone(reviewState, criteriaDirty, outcome = null) {
    if (criteriaDirty) return "waiting";
    if (outcome?.status === "failed") return "damaged";
    if (outcome?.status === "passed") return "normal";
    if (reviewState?.key === "reviewing") return "pending";
    return reviewState?.tone || "pending";
  }

  function VehicleReviewImage({ src, alt, emptyLabel, className, onOpen, actionLabel = "ดูรูปเต็ม", loading = "lazy" }) {
    const [imageAttempt, setImageAttempt] = useState(null);
    const activeAttempt = imageAttempt?.source === src
      ? imageAttempt
      : { source: src, displaySrc: src, failed: false };

    const handleImageError = (event) => {
      const image = event.currentTarget;
      const failedUrl = activeAttempt.displaySrc || "";
      if (image.getAttribute("src") !== failedUrl) return;
      const isImpsV2 = /[?&]apiProfile=imps-v2(?:&|$)/.test(failedUrl);
      const directUrl = isImpsV2 ? "" : buildVehicleSearchDirectImageUrl(failedUrl);
      if (directUrl && directUrl !== image.src) {
        setImageAttempt({ source: src, displaySrc: directUrl, failed: false });
        return;
      }
      setImageAttempt({ source: src, displaySrc: failedUrl, failed: true });
    };

    const hasImage = Boolean(src) && !activeAttempt.failed;
    const content = <>
      {hasImage ? <span className="ops-vehicle-review-image-media"><img key={`${src}::${activeAttempt.displaySrc}`} src={activeAttempt.displaySrc} alt={alt} loading={loading} onError={handleImageError} /></span> : null}
      <span className="ops-vehicle-review-image-empty" hidden={hasImage}>{emptyLabel}</span>
      {hasImage && onOpen && <span className="ops-vehicle-review-image-action">{actionLabel}</span>}
    </>;
    if (hasImage && onOpen) return <button type="button" className={`${className} is-clickable`} aria-label={actionLabel} onClick={onOpen}>{content}</button>;
    return <div className={className}>{content}</div>;
  }

  function VehicleReviewDimensionActions({ row, dimension, readOnly, onReview, onEvidenceChange, onEvidenceRemove }) {
    const status = row[dimension.statusKey] || "pending";
    const detail = getVehicleReviewDetail(row, dimension.key);
    const correctionTargetOptions = VEHICLE_REVIEW_CORRECTION_TARGET_OPTIONS[dimension.key] || [];
    const reasonOptions = VEHICLE_REVIEW_REASON_OPTIONS[dimension.key] || [];
    const [formStatus, setFormStatus] = useState(["incorrect", "unable-to-verify"].includes(status) ? status : "");
    const [correctedValue, setCorrectedValue] = useState(detail.correctedValue || "");
    const [correctionTarget, setCorrectionTarget] = useState(detail.correctionTarget || "");
    const [reasonCode, setReasonCode] = useState(detail.reasonCode || "");
    const [note, setNote] = useState(detail.note || "");
    const [noteOpen, setNoteOpen] = useState(Boolean(detail.note));
    const [error, setError] = useState("");
    const [uploading, setUploading] = useState(false);
    const hasApiEvidence = dimension.key === "plate" ? Boolean(row.plateImage || row.lprImage) : Boolean(row.overviewImage);
    const activeFormStatus = formStatus || (["incorrect", "unable-to-verify"].includes(status) ? status : "");
    const selectedStatus = formStatus || status;
    const selectedStatusLabel = VEHICLE_REVIEW_STATUS_OPTIONS.find((option) => option.value === selectedStatus)?.label || "";
    const hasUnpersistedStatus = Boolean(formStatus && formStatus !== status);
    const requiresEvidence = !hasApiEvidence && !detail.evidenceAttachment;
    useEffect(() => {
      setFormStatus(["incorrect", "unable-to-verify"].includes(status) ? status : "");
      setCorrectedValue(detail.correctedValue || "");
      setCorrectionTarget(detail.correctionTarget || "");
      setReasonCode(detail.reasonCode || "");
      setNote(detail.note || "");
      setNoteOpen(Boolean(detail.note));
      setError("");
    }, [row.id, dimension.key, status, detail.correctedValue, detail.correctionTarget, detail.reasonCode, detail.note, detail.evidenceAttachment?.id]);

    const chooseStatus = (nextStatus) => {
      if (readOnly) return;
      setError("");
      if (nextStatus === "correct") {
        setFormStatus("");
        setCorrectedValue("");
        setCorrectionTarget("");
        onReview(row.id, dimension.key, nextStatus, { correctedValue: null, correctionTarget: null, reasonCode: null, note: "" });
        return;
      }
      if (nextStatus === "unable-to-verify" || (nextStatus === "incorrect" && activeFormStatus === "unable-to-verify")) {
        setCorrectedValue("");
        setCorrectionTarget("");
      }
      setFormStatus(nextStatus);
    };

    const chooseReason = (nextReasonCode) => {
      setReasonCode(nextReasonCode);
      setError("");
    };

    const chooseCorrectionTarget = (nextTarget) => {
      if (correctionTarget !== nextTarget) setCorrectedValue("");
      setCorrectionTarget(nextTarget);
      setError("");
    };

    const saveDecision = () => {
      if (!activeFormStatus) return;
      if (activeFormStatus === "incorrect" && dimension.key === "plate" && !correctionTarget) {
        setError("กรุณาเลือกส่วนที่อ่านผิด");
        return;
      }
      if (!reasonCode) {
        setError("กรุณาเลือกสาเหตุ");
        return;
      }
      if (activeFormStatus === "incorrect" && !String(correctedValue).trim()) {
        setError("กรุณาระบุค่าที่ตรวจยืนยันแล้ว");
        return;
      }
      if (requiresEvidence) {
        setError("กรณีไม่มีภาพจาก API ต้องแนบหลักฐานก่อนบันทึก");
        return;
      }
      setError("");
      onReview(row.id, dimension.key, activeFormStatus, { correctedValue: String(correctedValue || "").trim() || null, correctionTarget: activeFormStatus === "incorrect" && dimension.key === "plate" ? correctionTarget || null : null, reasonCode, note: String(note || "").trim() });
    };

    const uploadEvidence = async (file) => {
      if (!file || !onEvidenceChange) return;
      setUploading(true);
      setError("");
      try {
        await onEvidenceChange(row.id, dimension.key, file);
      } catch (uploadError) {
        setError(uploadError?.message || "แนบหลักฐานไม่สำเร็จ");
      } finally {
        setUploading(false);
      }
    };

    const correctionValueLabel = activeFormStatus !== "incorrect"
      ? "รายละเอียดที่ยืนยันได้"
      : dimension.key === "plate"
        ? correctionTarget === "plate-number" ? "เลขทะเบียนที่ถูกต้อง" : correctionTarget === "province" ? "ชื่อจังหวัดที่ถูกต้อง" : "ค่าที่ตรวจยืนยันแล้ว"
        : "ค่าที่ตรวจยืนยันแล้ว";
    const correctionValuePlaceholder = activeFormStatus !== "incorrect"
      ? dimension.key === "plate" ? "ระบุรายละเอียดที่ยืนยันได้" : "เช่น รถบรรทุก 10 ล้อ"
      : dimension.key === "plate"
        ? correctionTarget === "plate-number" ? "เช่น 71-1381" : correctionTarget === "province" ? "เช่น กาญจนบุรี" : "เลือกส่วนที่อ่านผิดก่อน"
        : "เช่น รถบรรทุก 10 ล้อ";

    return <div className="ops-vehicle-review-dimension" data-vehicle-review-kind={dimension.key}>
      <div className="ops-vehicle-review-dimension-heading"><strong>{dimension.label}</strong><small>{selectedStatusLabel}{hasUnpersistedStatus ? " · ยังไม่บันทึก" : ""}</small></div>
      <div className="ops-vehicle-review-actions" role="group" aria-label={`ตรวจ${dimension.label} ${row.plateNumber}`}>
        <button type="button" className={selectedStatus === "correct" ? "is-selected is-correct" : ""} aria-pressed={selectedStatus === "correct"} disabled={readOnly} onClick={() => chooseStatus("correct")}>{dimension.correctLabel}</button>
        <button type="button" className={selectedStatus === "incorrect" ? "is-selected is-incorrect" : ""} aria-pressed={selectedStatus === "incorrect"} disabled={readOnly} onClick={() => chooseStatus("incorrect")}>{dimension.incorrectLabel}</button>
        <button type="button" className={selectedStatus === "unable-to-verify" ? "is-selected is-unable-to-verify" : ""} aria-pressed={selectedStatus === "unable-to-verify"} disabled={readOnly} onClick={() => chooseStatus("unable-to-verify")}>ตรวจไม่ได้</button>
      </div>
      {activeFormStatus && <div className="ops-vehicle-review-correction">
        <div className="ops-vehicle-review-correction-fields">
          <div className="ops-vehicle-review-correction-value">
            {activeFormStatus === "incorrect" && dimension.key === "plate" && <div className="ops-field ops-vehicle-review-target-picker">
              <span>ส่วนที่อ่านผิด <em>(จำเป็น)</em></span>
              <div className="ops-vehicle-review-target-options" role="group" aria-label="เลือกส่วนของป้ายทะเบียนที่อ่านผิด">
                {correctionTargetOptions.map((option) => <button key={option.value} type="button" className={`ops-vehicle-review-reason-option ops-vehicle-review-target-option${correctionTarget === option.value ? " is-selected" : ""}`} aria-pressed={correctionTarget === option.value} disabled={readOnly} onClick={() => chooseCorrectionTarget(option.value)}>{option.buttonLabel}</button>)}
              </div>
            </div>}
            <label className="ops-field"><span>{correctionValueLabel}</span><input value={correctedValue} disabled={readOnly || (dimension.key === "plate" && activeFormStatus === "incorrect" && !correctionTarget)} onChange={(event) => setCorrectedValue(event.target.value)} placeholder={correctionValuePlaceholder} /></label>
          </div>
          <div className="ops-field ops-vehicle-review-reason-picker">
            <span>สาเหตุ <em>(จำเป็น)</em></span>
            <div className="ops-vehicle-review-reason-options" role="group" aria-label={`เลือกสาเหตุสำหรับ${dimension.label}`}>
              {reasonOptions.map((option) => <button key={option.value} type="button" className={`ops-vehicle-review-reason-option${reasonCode === option.value ? " is-selected" : ""}`} aria-pressed={reasonCode === option.value} disabled={readOnly} onClick={() => chooseReason(option.value)}>{option.label}</button>)}
            </div>
          </div>
        </div>
        <details className="ops-vehicle-review-correction-note" open={noteOpen} onToggle={(event) => setNoteOpen(event.currentTarget.open)}>
          <summary>{String(note || "").trim() ? "หมายเหตุเพิ่มเติม · มีข้อความ" : "เพิ่มหมายเหตุ (ไม่บังคับ)"}</summary>
          <label className="ops-field"><span>หมายเหตุ</span><textarea rows="2" value={note} disabled={readOnly} onChange={(event) => setNote(event.target.value)} placeholder="ระบุรายละเอียดเพิ่มเติม" /></label>
        </details>
        <div className="ops-vehicle-review-evidence-control"><div><strong>หลักฐาน</strong><small>{hasApiEvidence ? "มีภาพจาก API แล้ว" : detail.evidenceAttachment ? `แนบแล้ว · ${detail.evidenceAttachment.name}` : "ไม่มีภาพจาก API ต้องแนบเพิ่ม"}</small></div>{detail.evidenceAttachment && !readOnly && <button type="button" className="ops-button ops-button-ghost" onClick={() => onEvidenceRemove?.(row.id, dimension.key, detail.evidenceAttachment)}>นำหลักฐานออก</button>}{!readOnly && <label className="ops-button ops-button-secondary"><input type="file" accept="image/*,.pdf" hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; uploadEvidence(file); }} />{uploading ? "กำลังแนบ..." : "แนบหลักฐานเพิ่ม"}</label>}</div>
        {error && <small className="ops-vehicle-review-correction-error" role="alert">{error}</small>}
        <button type="button" className="ops-button ops-button-primary" disabled={readOnly || uploading} onClick={saveDecision}>บันทึกผล{activeFormStatus === "incorrect" ? "ที่แก้ไข" : "ตรวจไม่ได้"}</button>
      </div>}
    </div>;
  }

  function VehicleImageLightbox({ media, onClose, onNavigate, canNavigatePrevious = true, canNavigateNext = true }) {
    const closeRef = useRef(null);
    const [zoom, setZoom] = useState(1);
    const [imageAttempt, setImageAttempt] = useState(null);
    const activeAttempt = imageAttempt?.source === media?.src
      ? imageAttempt
      : { source: media?.src, displaySrc: media?.src, failed: false };
    useEffect(() => {
      if (!media) return undefined;
      setZoom(1);
      const previous = document.activeElement;
      const handleKeyDown = (event) => {
        if (event.key === "Escape") onClose();
        if (event.key === "ArrowLeft") onNavigate?.("previous");
        if (event.key === "ArrowRight") onNavigate?.("next");
        if (event.key === "Tab") {
          const focusable = [...document.querySelectorAll(".ops-vehicle-lightbox button:not([disabled])")].filter(Boolean);
          if (!focusable.length) return;
          const currentIndex = focusable.indexOf(document.activeElement);
          const nextIndex = event.shiftKey
            ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1)
            : (currentIndex + 1) % focusable.length;
          event.preventDefault();
          focusable[nextIndex]?.focus();
        }
      };
      document.addEventListener("keydown", handleKeyDown);
      window.requestAnimationFrame(() => closeRef.current?.focus());
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        previous?.focus?.({ preventScroll: true });
      };
    }, [media, onClose, onNavigate]);
    if (!media) return null;
    const handleImageError = (event) => {
      const image = event.currentTarget;
      const failedUrl = activeAttempt.displaySrc || "";
      if (image.getAttribute("src") !== failedUrl) return;
      const isImpsV2 = /[?&]apiProfile=imps-v2(?:&|$)/.test(failedUrl);
      const directUrl = isImpsV2 ? "" : buildVehicleSearchDirectImageUrl(failedUrl);
      if (directUrl && directUrl !== image.src) {
        setImageAttempt({ source: media.src, displaySrc: directUrl, failed: false });
        return;
      }
      setImageAttempt({ source: media.src, displaySrc: failedUrl, failed: true });
    };
    return <div className="ops-vehicle-lightbox" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="ops-vehicle-lightbox-dialog" role="dialog" aria-modal="true" aria-labelledby="vehicle-lightbox-title">
        <header className="ops-vehicle-lightbox-header">
          <div><p className="ops-eyebrow">ดูรูปเต็ม</p><h2 id="vehicle-lightbox-title">{media.label}</h2><span>{media.plateNumber} · {media.occurredAt ? formatDateTime(media.occurredAt) : "ไม่พบเวลา"}</span></div>
          <button ref={closeRef} type="button" className="ops-icon-button" aria-label="ปิดรูปเต็ม" onClick={onClose}><Icon name="close" /></button>
        </header>
        <div className="ops-vehicle-lightbox-stage">
          {!activeAttempt.failed && <img key={`${media.src}::${activeAttempt.displaySrc}`} src={activeAttempt.displaySrc} alt={media.alt} style={{ transform: `scale(${zoom})` }} onError={handleImageError} />}
          <span hidden={!activeAttempt.failed}>ไม่พบภาพจาก API</span>
        </div>
        <footer className="ops-vehicle-lightbox-footer">
          <div className="ops-vehicle-lightbox-zoom" role="group" aria-label="เครื่องมือซูมภาพ"><button type="button" className="ops-button ops-button-secondary" onClick={() => setZoom((current) => Math.max(1, Number((current - .25).toFixed(2))))} disabled={zoom <= 1}>−</button><span>{Math.round(zoom * 100)}%</span><button type="button" className="ops-button ops-button-secondary" onClick={() => setZoom((current) => Math.min(3, Number((current + .25).toFixed(2))))} disabled={zoom >= 3}>+</button><button type="button" className="ops-button ops-button-ghost" onClick={() => setZoom(1)}>พอดีจอ</button></div>
          <div className="ops-vehicle-lightbox-nav"><button type="button" className="ops-button ops-button-secondary" onClick={() => onNavigate?.("previous")} disabled={!onNavigate || !canNavigatePrevious}>ก่อนหน้า</button><button type="button" className="ops-button ops-button-secondary" onClick={() => onNavigate?.("next")} disabled={!onNavigate || !canNavigateNext}>ถัดไป</button></div>
        </footer>
      </section>
    </div>;
  }

  function VehicleSearchReviewPanelLegacy({ round, value, readOnly, onChange, notify, focusRowId, focusReviewKind, onFocusComplete, contextKey = "" }) {
    const vehicleSearchConfig = createVehicleSearchConfig(round?.snapshot?.vehicleSearchConfig, "");
    const vehicleSearchBaseUrl = vehicleSearchConfig.baseUrl;
    const reviewVersion = round?.snapshot?.vehicleReviewVersion;
    const context = getVehicleReviewContextByKey(contextKey);
    const activeDimensionKeys = getVehicleReviewDimensions(reviewVersion, context?.key).map((dimension) => dimension.key);
    const activeDimensions = VEHICLE_REVIEW_DIMENSION_UI.filter((dimension) => activeDimensionKeys.includes(dimension.key));
    const isPlateContext = context?.key === "plate";
    const fallbackCriteria = useMemo(() => ({
      startAt: round?.meta?.inspectionDate ? `${round.meta.inspectionDate}T00:00` : "",
      endAt: round?.meta?.inspectionDate ? `${round.meta.inspectionDate}T23:59` : "",
    }), [round?.id]);
    const [criteria, setCriteria] = useState(() => normalizeVehicleSearchState(value, fallbackCriteria, { baseUrl: vehicleSearchBaseUrl, apiProfile: vehicleSearchConfig.apiProfile }).criteria);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [activeGroupKey, setActiveGroupKey] = useState("");
    const abortRef = useRef(null);
    const searchState = normalizeVehicleSearchState(value, fallbackCriteria, { baseUrl: vehicleSearchBaseUrl, apiProfile: vehicleSearchConfig.apiProfile, searchUrl: vehicleSearchConfig.searchUrl, stationProfileId: round?.stationId || round?.snapshot?.stationId });
    const criteriaDirty = Boolean(searchState.fetchedAt) && isVehicleCriteriaDirty(criteria, searchState.criteria);
    const summary = getVehicleSearchReviewSummary(searchState, { reviewVersion, context: context?.key });
    const groups = getVehicleQueueGroups(searchState, { reviewVersion, context: context?.key });
    const activeGroup = groups.find((group) => group.key === activeGroupKey) || groups[0] || null;
    const reviewState = getVehicleReviewState(searchState, { reviewVersion, context: context?.key });
    const unresolvedUnit = getVehicleReviewUnresolvedUnit(activeDimensions);
    const reviewStatusLabel = getVehicleReviewStatusLabel(reviewState, summary, context?.key);

    useEffect(() => {
      setCriteria(normalizeVehicleSearchState(value, fallbackCriteria, { baseUrl: vehicleSearchBaseUrl, apiProfile: vehicleSearchConfig.apiProfile }).criteria);
      setError("");
    }, [round?.id, vehicleSearchBaseUrl, context?.key]);

    useEffect(() => {
      if (groups.length && !groups.some((group) => group.key === activeGroupKey)) setActiveGroupKey(groups[0].key);
    }, [activeGroupKey, groups]);

    useEffect(() => () => abortRef.current?.abort(), []);

    useEffect(() => {
      if (!focusRowId) return undefined;
      const frame = window.requestAnimationFrame(() => {
        const target = [...document.querySelectorAll("[data-vehicle-review-row]")]
          .find((node) => node.getAttribute("data-vehicle-review-row") === focusRowId);
        if (!target) return;
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        const dimension = focusReviewKind ? target.querySelector(`[data-vehicle-review-kind="${focusReviewKind}"]`) : null;
        (dimension?.querySelector("button") || target.querySelector("button"))?.focus({ preventScroll: true });
        onFocusComplete?.();
      });
      return () => window.cancelAnimationFrame(frame);
    }, [focusRowId, focusReviewKind, searchState.rows.length, onFocusComplete]);

    const updateCriteria = (key, nextValue) => setCriteria((current) => ({ ...current, [key]: nextValue }));
    const handleSearch = async () => {
      if (!vehicleSearchBaseUrl) {
        setError("สถานีนี้ยังไม่ได้ตั้งค่า Base URL ของ Vehicle API กรุณาไปที่ ทะเบียนสถานี > ข้อมูลทั่วไป");
        return;
      }
      const stationProfileId = round?.stationId || round?.snapshot?.stationId;
      if (!stationProfileId) {
        setError("รอบนี้ไม่มีรหัสโปรไฟล์สถานี จึงส่งคำขอไปยัง Vehicle API ไม่ได้");
        return;
      }
      if (!criteria.startAt || !criteria.endAt) {
        setError("กรุณาระบุวันและเวลาเริ่ม–สิ้นสุดก่อนดึงข้อมูล");
        return;
      }
      if (criteria.endAt <= criteria.startAt) {
        setError("เวลาสิ้นสุดต้องหลังเวลาเริ่มอย่างน้อย 1 นาที");
        return;
      }
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError("");
      try {
        const result = await searchVehicles(criteria, { signal: controller.signal, baseUrl: vehicleSearchBaseUrl, searchUrl: vehicleSearchConfig.searchUrl, apiProfile: vehicleSearchConfig.apiProfile, expectedStationId: vehicleSearchConfig.stationId, expectedStationName: vehicleSearchConfig.stationName, stationProfileId, transport: "direct-first" });
        onChange(result);
        notify?.(result.rows.length ? `ดึงข้อมูลรถครบ ${result.rows.length} รายการ จาก ${result.pagination.totalPages} หน้า` : "ค้นหาเสร็จแล้ว แต่ไม่พบข้อมูลรถในช่วงเวลา");
      } catch (searchError) {
        if (searchError?.name === "AbortError") return;
        const message = searchError?.message || "ดึงข้อมูลรถจาก API ไม่สำเร็จ";
        setError(message);
        notify?.(message);
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          setLoading(false);
        }
      }
    };

    const review = (rowId, dimension, reviewStatus) => onChange(updateVehicleSearchDimensionReview(searchState, rowId, dimension, reviewStatus));
    const weight = (value) => value === null || value === undefined ? "—" : `${Number(value).toLocaleString("th-TH")} กก.`;
    const axleDetail = (axle, index) => `เพลา ${axle.number ?? index + 1} · น้ำหนัก ${weight(axle.weight)} · ซ้าย ${weight(axle.weightLeft)} · ขวา ${weight(axle.weightRight)}`;

    const panelTitle = context?.key === "classification" ? "ตรวจผลการคัดแยกประเภทรถ" : context?.key === "plate" ? "ตรวจผลการจำแนกป้ายทะเบียน" : "ตรวจข้อมูลรถจาก API";
    const panelDescription = context?.key === "classification"
      ? "ตรวจประเภทรถ จำนวน/รายละเอียดเพลา และน้ำหนักเทียบกับภาพรถจาก API"
      : context?.key === "plate"
        ? "ตรวจเลขทะเบียนเทียบกับภาพป้ายทะเบียนจาก API"
        : "เลือกช่วงเวลา ดึงรถทุกคัน แล้วตรวจผลจาก API แยกตามบริบท";
    const activeDimensionSummary = summary.dimensions?.[context?.key] || summary;
    const activeThreshold = VEHICLE_REVIEW_THRESHOLDS[context?.key];
    return <section className={`ops-vehicle-search-panel is-context-${context?.key || "all"}`} data-vehicle-search-panel aria-labelledby={`vehicle-search-title-${context?.key || "all"}`}>
      <div className="ops-vehicle-search-heading">
        <div><p className="ops-eyebrow">{context?.checklistNumber || "VEHICLE API"}</p><h3 id={`vehicle-search-title-${context?.key || "all"}`}>{panelTitle}</h3><span>{panelDescription}</span></div>
        {searchState.fetchedAt && <small className="ops-vehicle-search-fetched">{reviewStatusLabel} · ดึงข้อมูลล่าสุด {formatDateTime(searchState.fetchedAt)}</small>}
      </div>
      {!vehicleSearchBaseUrl && <div className="ops-vehicle-search-config-warning" role="status"><Icon name="alert" size="small" /><span>ยังไม่ได้ตั้งค่า Vehicle API ประจำสถานี จึงยังดึงข้อมูลไม่ได้ · ไปตั้งค่าที่ “ทะเบียนสถานี”</span></div>}
      <div className="ops-vehicle-search-criteria">
        <label className="ops-field"><span>วันและเวลาเริ่ม <em>(เวลาไทย · จำเป็น)</em></span><ThaiDateTimePicker value={criteria.startAt} label="วันและเวลาเริ่ม" disabled={readOnly || loading} onChange={(nextValue) => updateCriteria("startAt", nextValue)} /></label>
        <label className="ops-field"><span>วันและเวลาสิ้นสุด <em>(เวลาไทย · จำเป็น)</em></span><ThaiDateTimePicker value={criteria.endAt} label="วันและเวลาสิ้นสุด" disabled={readOnly || loading} onChange={(nextValue) => updateCriteria("endAt", nextValue)} /></label>
        <div className="ops-vehicle-source"><strong>{round?.snapshot?.stationCode || "สถานีในรอบ"}</strong><span>{vehicleSearchConfig.stationName || "ตรวจสถานีจาก API ก่อนใช้ข้อมูล"}</span></div>
        {!readOnly && <button type="button" className="ops-button ops-button-primary ops-vehicle-search-submit" onClick={handleSearch} disabled={loading || !vehicleSearchBaseUrl}>{loading ? "กำลังดึงข้อมูล..." : "ดึงข้อมูลรถจาก API"}</button>}
      </div>
      {error && <div className="ops-vehicle-search-error" role="alert"><Icon name="alert" size="small" /><span>{error}</span></div>}
      {!criteriaDirty && <div className="ops-vehicle-search-metrics" aria-label="สรุปผลตรวจข้อมูลรถจาก API">
        {activeDimensions.map((dimension) => {
          const dimensionSummary = summary.dimensions[dimension.key];
          return <div key={dimension.key} className={`ops-vehicle-search-metric-dimension is-${dimension.key}`}><span>{dimension.label}</span><strong>{dimensionSummary.reviewed}/{dimensionSummary.total}</strong><small>ตรวจแล้ว · ถูก {dimensionSummary.correct} · ผิด {dimensionSummary.incorrect} · ค้าง {dimensionSummary.pending}</small></div>;
        })}
         <div className="is-pending"><span>{activeDimensions.length > 1 ? "จุดตรวจค้างรวม" : "คันค้าง"}</span><strong>{summary.unresolvedChecks}</strong><small>{unresolvedUnit} · ยังไม่ตรวจ {summary.pendingChecks} · ตรวจไม่ได้ {summary.unableToVerifyChecks}</small></div>
      </div>}
      {searchState.fetchedAt && !criteriaDirty && <div className="ops-vehicle-search-provenance" role="status"><span>ช่วงเวลา {formatThaiDateTimeInput(searchState.criteria.startAt) || "ยังไม่ระบุ"} ถึง {formatThaiDateTimeInput(searchState.criteria.endAt) || "ยังไม่ระบุ"}</span><span>สถานีตอบกลับ {searchState.sourceStation?.id || vehicleSearchConfig.stationId || "—"} · {searchState.sourceStation?.name || vehicleSearchConfig.stationName || "—"}</span><span>{searchState.pagination.totalPages || 0} หน้า · {searchState.pagination.totalItems || 0} คัน</span></div>}
      {criteriaDirty ? <div className="ops-vehicle-search-empty is-stale"><Icon name="refresh" /><strong>ต้องดึงข้อมูลรถใหม่</strong><span>ผลตรวจเดิมถูกพักไว้ เพราะช่วงเวลาที่เลือกเปลี่ยนจากครั้งล่าสุด</span></div> : !searchState.fetchedAt ? <div className="ops-vehicle-search-empty"><Icon name="search" /><strong>ยังไม่ได้ดึงข้อมูลรถ</strong><span>เลือกวันและเวลา แล้วกด “ดึงข้อมูลรถจาก API”</span></div> : !searchState.rows.length ? <div className="ops-vehicle-search-empty"><Icon name="info" /><strong>ไม่พบข้อมูลรถ</strong><span>API ตอบสำเร็จและไม่พบรถในช่วงเวลา จึงถือว่าเป็นผลตรวจที่ถูกต้อง</span></div> : <>
          <div className="ops-vehicle-queue-groups" aria-label="คิวตรวจข้อมูลรถตามประเภทรถและ Lane">{groups.map((group) => <button type="button" key={group.key} className={activeGroup?.key === group.key ? "is-active" : ""} onClick={() => setActiveGroupKey(group.key)}><strong>{group.label}</strong><span>{group.lane || "ไม่ระบุ Lane"} · {group.total} คัน</span><small>ค้าง {group.unresolvedChecks} {unresolvedUnit}</small></button>)}</div>
         {activeGroup && <section className="ops-vehicle-review-group"><div className="ops-vehicle-review-group-heading"><div><p className="ops-eyebrow">{activeGroup.lane || "ไม่ระบุ Lane"}</p><h4>{activeGroup.label}</h4><span>{activeDimensions.map((dimension) => `${dimension.label} ${activeGroup[`${dimension.key === "axles" ? "axle" : dimension.key}Reviewed`] || 0}/${activeGroup.total}`).join(" · ")}</span></div><strong>ค้าง {activeGroup.unresolvedChecks} จุด</strong></div>
          <div className="ops-vehicle-review-card-list">{activeGroup.rows.map((row) => <article data-vehicle-review-row={row.id} key={row.id} className="ops-vehicle-review-card">
            <div className="ops-vehicle-review-images">{isPlateContext ? <VehicleReviewImage className="ops-vehicle-plate-image" src={row.plateImage} alt={`ภาพป้ายทะเบียน ${row.plateNumber}`} emptyLabel="ไม่พบภาพ Crop" /> : <VehicleReviewImage className="ops-vehicle-overview-image" src={row.overviewImage} alt={`ภาพรถ Overview ${row.plateNumber}`} emptyLabel="ไม่พบภาพ Overview" />}</div>
             <div className="ops-vehicle-review-card-copy"><strong className="ops-code">{row.plateNumber}</strong><span>{row.province || "ไม่พบจังหวัด"} · {row.occurredAt ? formatDateTime(row.occurredAt) : "ไม่พบเวลา"}</span><div className="ops-vehicle-review-facts">{isPlateContext ? <span><b>ผลอ่านป้าย</b> {row.plateNumber} · {row.province || "ไม่พบจังหวัด"}</span> : <><span><b>ประเภท</b> {row.vehicleClassLabel || "ไม่ระบุ"}</span>{row.vehicleDescription && <span><b>รายละเอียด</b> {row.vehicleDescription}</span>}<span><b>เพลา</b> {row.axleCount ?? "—"} เพลา · <b>น้ำหนักรวม</b> {weight(row.grossWeight)} · <b>สูงสุดที่อนุญาต</b> {weight(row.grossWeightLimit)} · <b>ซ้าย/ขวา</b> {weight(row.leftWeight)} / {weight(row.rightWeight)}</span>{row.speed !== null && <span><b>การเคลื่อนที่</b> {row.speed} กม./ชม. · ความยาว {row.length ?? "—"} · ESAL {row.esal ?? "—"}</span>}{row.isOverweight !== null && <span><b>Overload</b> {row.isOverweight ? "ใช่" : "ไม่ใช่"}{row.overweightPercentage !== null ? ` · ${row.overweightPercentage}%` : ""}</span>}</>}</div>{(row.integrityWarnings?.length || row.errorFlags?.length || row.warningFlags?.length) ? <div className="ops-vehicle-integrity-warnings" role="note"><strong>คำเตือนช่วยตรวจ</strong>{row.integrityWarnings?.map((entry) => <span key={`${row.id}-${entry.code}`}>{entry.message}</span>)}</div> : null}{!isPlateContext && row.axles.length > 0 && <div className="ops-vehicle-axle-details"><strong>รายละเอียดเพลา</strong><ul>{row.axles.map((axle, index) => <li key={`${row.id}-axle-${index}`}>{axleDetail(axle, index)}</li>)}</ul></div>}{!isPlateContext && row.axlesAfterAllowance.length > 0 && <div className="ops-vehicle-axle-details"><strong>หลังหักค่าผ่อนผัน</strong><ul>{row.axlesAfterAllowance.map((axle, index) => <li key={`${row.id}-allowance-${index}`}>เพลา {axle.number ?? index + 1} · น้ำหนัก {weight(axle.axleWeight)} · allowance {axle.allowance ?? "—"}</li>)}</ul></div>}</div>
            <div className="ops-vehicle-review-dimension-list">{activeDimensions.map((dimension) => <VehicleReviewDimensionActions key={dimension.key} row={row} dimension={dimension} readOnly={readOnly} onReview={review} />)}</div>
          </article>)}</div>
        </section>}
      </>}
    </section>;
  }

  /**
   * Shared focused vehicle-review workspace used by the Checklist shell and the
   * deep-link route. Selection is deliberately local UI state; vehicle rows and
   * review decisions remain in the round's vehicleSearch payload.
   */
  function VehicleFocusReviewPanel({ round, value, readOnly, onChange, notify, focusRowId, focusReviewKind, onFocusComplete, contextKey = "", onReviewStatusChange, evidenceItem = null, evidenceItemValue = null, onEvidenceChange, onEvidenceAttachmentChange, onEvidenceAttachmentRemove, onVehicleReviewEvidenceAttachmentChange, onVehicleReviewEvidenceAttachmentRemove, scopeKey = "day", allowLiveSearch = true }) {
    const vehicleSearchConfig = createVehicleSearchConfig(round?.snapshot?.vehicleSearchConfig, "");
    const vehicleSearchBaseUrl = vehicleSearchConfig.baseUrl;
    const reviewVersion = round?.snapshot?.vehicleReviewVersion;
    const context = getVehicleReviewContextByKey(contextKey);
    const isPlateContext = context?.key === "plate";
    const isApiOnlyReview = reviewVersion === VEHICLE_API_REVIEW_VERSION
      && Boolean(evidenceItem)
      && isVehicleApiReviewItem(evidenceItem, round?.snapshot);
    const apiProofLabel = isPlateContext
      ? "ภาพจากกล้อง LPR ภาพ Crop และผลอ่านป้ายจาก API"
      : "ภาพรถ ประเภทรถ และน้ำหนักรวมจาก API";
    const evidenceSlots = Array.isArray(evidenceItem?.evidenceSlots) ? evidenceItem.evidenceSlots : [];
    const evidenceState = evidenceItemValue || { status: evidenceItem?.applicable === false ? "na" : "pending", evidence: {}, attachment: null };
    const evidenceBypassed = evidenceItem?.applicable === false || isEvidenceBypassItemStatus(evidenceState.status || "pending");
    const evidenceComplete = evidenceBypassed ? 0 : evidenceSlots.filter((slot) => isEvidenceSlotComplete(slot, evidenceState.evidence?.[slot.id])).length;
    const activeDimensions = VEHICLE_REVIEW_DIMENSION_UI.filter((dimension) => getVehicleReviewDimensions(reviewVersion, context?.key).some(({ key }) => key === dimension.key));
    const isScopedReview = round?.snapshot?.vehicleReviewScopeVersion === VEHICLE_REVIEW_SCOPE_VERSION && isVehicleReviewScopeState(value);
    const fallbackCriteria = useMemo(() => ({
      startAt: round?.meta?.inspectionDate ? `${round.meta.inspectionDate}T00:00` : "",
      endAt: round?.meta?.inspectionDate ? `${round.meta.inspectionDate}T23:59` : "",
    }), [round?.id, round?.meta?.inspectionDate]);
    const inferredScopeKey = (() => {
      const initialValue = getVehicleReviewScopeState(value, "day", fallbackCriteria, { baseUrl: vehicleSearchBaseUrl, apiProfile: vehicleSearchConfig.apiProfile });
      const initialCriteria = normalizeVehicleSearchState(initialValue, fallbackCriteria, { baseUrl: vehicleSearchBaseUrl, apiProfile: vehicleSearchConfig.apiProfile }).criteria;
      return getVehicleReviewScopeForTimestamp(initialCriteria.startAt) || "day";
    })();
    const [activeScopeKey, setActiveScopeKey] = useState(() => scopeKey === "night" || scopeKey === "day" ? scopeKey : inferredScopeKey);
    const scopeValue = isScopedReview ? getVehicleReviewScopeState(value, activeScopeKey, fallbackCriteria, { baseUrl: vehicleSearchBaseUrl, apiProfile: vehicleSearchConfig.apiProfile }) : value;
    const criteriaValue = isScopedReview && !scopeKey && !scopeValue.fetchedAt
      ? getVehicleReviewScopeState(value, "day", fallbackCriteria, { baseUrl: vehicleSearchBaseUrl, apiProfile: vehicleSearchConfig.apiProfile })
      : scopeValue;
    const [criteria, setCriteria] = useState(() => normalizeVehicleSearchState(criteriaValue, fallbackCriteria, { baseUrl: vehicleSearchBaseUrl, apiProfile: vehicleSearchConfig.apiProfile }).criteria);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [selectedRowId, setSelectedRowId] = useState("");
    const [queueQuery, setQueueQuery] = useState("");
    const [queuePage, setQueuePage] = useState(0);
    const [lightbox, setLightbox] = useState(null);
    const [responsivePanel, setResponsivePanel] = useState("evidence");
    const abortRef = useRef(null);
    const searchState = normalizeVehicleSearchState(scopeValue, fallbackCriteria, { baseUrl: vehicleSearchBaseUrl, apiProfile: vehicleSearchConfig.apiProfile, searchUrl: vehicleSearchConfig.searchUrl, stationProfileId: round?.stationId || round?.snapshot?.stationId });
    const criteriaDirty = Boolean(searchState.fetchedAt) && isVehicleCriteriaDirty(criteria, searchState.criteria);
    const summary = getVehicleSearchReviewSummary(searchState, { reviewVersion, context: context?.key });
    const outcome = getVehicleReviewOutcome(searchState, { reviewVersion, context: context?.key });
    const activeDimensionSummary = summary.dimensions?.[context?.key] || summary;
    const activeThreshold = VEHICLE_REVIEW_THRESHOLDS[context?.key];
    const orderedRows = getVehicleReviewRows(searchState);
    const selectedRow = orderedRows.find((row) => row.id === selectedRowId) || orderedRows[0] || null;
    const selectedRowIndex = selectedRow ? orderedRows.findIndex((row) => row.id === selectedRow.id) : -1;
    const queuePageSize = 10;
    const normalizedQueueQuery = queueQuery.trim().toLocaleLowerCase("th-TH");
    const queueRows = normalizedQueueQuery
      ? orderedRows.filter((row) => [row.plateNumber, row.province, row.lane, row.vehicleClassLabel, row.occurredAt ? formatDateTime(row.occurredAt) : ""]
        .some((value) => String(value || "").toLocaleLowerCase("th-TH").includes(normalizedQueueQuery)))
      : orderedRows;
    const queuePageCount = Math.max(1, Math.ceil(queueRows.length / queuePageSize));
    const visibleQueueRows = queueRows.slice(queuePage * queuePageSize, (queuePage + 1) * queuePageSize);
    const queuePageNumbers = [...new Set([0, 1, 2, 3, 4, queuePage - 1, queuePage, queuePage + 1, queuePageCount - 1])]
      .filter((page) => page >= 0 && page < queuePageCount)
      .sort((left, right) => left - right);
    const reviewState = getVehicleReviewState(searchState, { reviewVersion, context: context?.key });
    const unresolvedUnit = getVehicleReviewUnresolvedUnit(activeDimensions);
    const reviewStatusLabel = getVehicleReviewStatusLabel(reviewState, summary, context?.key, outcome);
    const reviewStatusTone = getVehicleReviewStatusTone(reviewState, criteriaDirty, outcome);
    useEffect(() => {
      if (!isApiOnlyReview) return;
      onReviewStatusChange?.(searchState.fetchedAt
        ? { tone: reviewStatusTone, label: criteriaDirty ? "เปลี่ยนช่วงเวลาแล้ว · ต้องดึงข้อมูลใหม่" : reviewStatusLabel }
        : null);
    }, [criteriaDirty, isApiOnlyReview, onReviewStatusChange, reviewStatusLabel, reviewStatusTone, searchState.fetchedAt]);
    const isPendingRow = (row) => activeDimensions.some((dimension) => ["pending", "unable-to-verify"].includes(row?.[dimension.statusKey]));

    const commitSearchState = useCallback((nextState) => {
      if (isScopedReview) {
        onChange?.(updateVehicleSearchScope(value, activeScopeKey, nextState, { baseUrl: vehicleSearchBaseUrl, apiProfile: vehicleSearchConfig.apiProfile }));
        return;
      }
      onChange?.(nextState);
    }, [activeScopeKey, isScopedReview, onChange, value, vehicleSearchBaseUrl, vehicleSearchConfig.apiProfile]);

    useEffect(() => {
      const nextScopeKey = scopeKey === "night" || scopeKey === "day"
        ? scopeKey
        : (() => {
          const dayState = getVehicleReviewScopeState(value, "day", fallbackCriteria, { baseUrl: vehicleSearchBaseUrl, apiProfile: vehicleSearchConfig.apiProfile });
          const dayCriteria = normalizeVehicleSearchState(dayState, fallbackCriteria, { baseUrl: vehicleSearchBaseUrl, apiProfile: vehicleSearchConfig.apiProfile }).criteria;
          return getVehicleReviewScopeForTimestamp(dayCriteria.startAt) || "day";
        })();
      setActiveScopeKey(nextScopeKey);
      const targetValue = isScopedReview
        ? getVehicleReviewScopeState(value, nextScopeKey, fallbackCriteria, { baseUrl: vehicleSearchBaseUrl, apiProfile: vehicleSearchConfig.apiProfile })
        : value;
      const dayValue = isScopedReview
        ? getVehicleReviewScopeState(value, "day", fallbackCriteria, { baseUrl: vehicleSearchBaseUrl, apiProfile: vehicleSearchConfig.apiProfile })
        : value;
      const nextValue = !scopeKey && !targetValue.fetchedAt && dayValue.fetchedAt ? dayValue : targetValue;
      setCriteria(normalizeVehicleSearchState(nextValue, fallbackCriteria, { baseUrl: vehicleSearchBaseUrl, apiProfile: vehicleSearchConfig.apiProfile }).criteria);
      setError("");
    }, [round?.id, scopeKey]);

    useEffect(() => {
      setCriteria(normalizeVehicleSearchState(criteriaValue, fallbackCriteria, { baseUrl: vehicleSearchBaseUrl, apiProfile: vehicleSearchConfig.apiProfile }).criteria);
      setError("");
    }, [vehicleSearchBaseUrl, vehicleSearchConfig.apiProfile, context?.key, scopeKey, value]);

    useEffect(() => {
      setResponsivePanel("evidence");
    }, [context?.key]);

    useEffect(() => {
      setQueuePage((current) => Math.min(current, queuePageCount - 1));
    }, [queuePageCount]);

    useEffect(() => {
      if (!orderedRows.length) {
        setSelectedRowId("");
        return;
      }
      if (!orderedRows.some((row) => row.id === selectedRowId)) {
        setSelectedRowId(getNextPendingVehicleId(searchState, { context: context?.key }) || orderedRows[0].id);
      }
    }, [orderedRows, selectedRowId, searchState.fetchedAt, context?.key]);

    useEffect(() => () => abortRef.current?.abort(), []);

    useEffect(() => {
      if (!focusRowId) return undefined;
      const target = orderedRows.find((row) => row.id === focusRowId);
      if (!target) return undefined;
      setSelectedRowId(target.id);
      setQueueQuery("");
      setQueuePage(Math.floor(Math.max(0, orderedRows.findIndex((row) => row.id === target.id)) / queuePageSize));
      const frame = window.requestAnimationFrame(() => {
        const selector = `[data-vehicle-review-focus="${domSafeId(target.id)}"]`;
        const rowNode = document.querySelector(selector);
        const dimension = focusReviewKind ? rowNode?.querySelector(`[data-vehicle-review-kind="${focusReviewKind}"]`) : null;
        (dimension?.querySelector("button") || rowNode?.querySelector("button"))?.focus({ preventScroll: true });
        onFocusComplete?.();
      });
      return () => window.cancelAnimationFrame(frame);
    }, [focusRowId, focusReviewKind, orderedRows, onFocusComplete]);

    const updateCriteria = (key, nextValue) => setCriteria((current) => ({ ...current, [key]: nextValue }));
    const handleSearch = async () => {
      if (!allowLiveSearch) {
        setError("หน้าตัวอย่างใช้ข้อมูลจำลอง จึงดึงข้อมูลจากสถานีจริงไม่ได้ · เปิดรอบตรวจจริงเพื่อค้นหา");
        return;
      }
      if (!vehicleSearchBaseUrl) {
        setError("สถานีนี้ยังไม่ได้ตั้งค่า Base URL ของ Vehicle API กรุณาไปที่ ทะเบียนสถานี > ข้อมูลทั่วไป");
        return;
      }
      const stationProfileId = round?.stationId || round?.snapshot?.stationId;
      if (!stationProfileId) {
        setError("รอบนี้ไม่มีรหัสโปรไฟล์สถานี จึงส่งคำขอไปยัง Vehicle API ไม่ได้");
        return;
      }
      if (!criteria.startAt || !criteria.endAt) {
        setError("กรุณาระบุวันและเวลาเริ่ม–สิ้นสุดก่อนดึงข้อมูล");
        return;
      }
      if (criteria.endAt <= criteria.startAt) {
        setError("เวลาสิ้นสุดต้องหลังเวลาเริ่มอย่างน้อย 1 นาที");
        return;
      }
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError("");
      try {
        const result = await searchVehicles(criteria, { signal: controller.signal, baseUrl: vehicleSearchBaseUrl, searchUrl: vehicleSearchConfig.searchUrl, apiProfile: vehicleSearchConfig.apiProfile, expectedStationId: vehicleSearchConfig.stationId, expectedStationName: vehicleSearchConfig.stationName, stationProfileId, transport: "direct-first" });
        const matchingRows = filterVehicleSearchRowsByTimeRange(result.rows, criteria);
        if (!isScopedReview) {
          commitSearchState({ ...result, rows: matchingRows, emptyResultAcknowledgedAt: null });
          notify?.(matchingRows.length ? `ดึงข้อมูลรถตามช่วงที่เลือกครบ ${matchingRows.length} รายการ จาก ${result.pagination.totalPages} หน้า` : "ค้นหาเสร็จแล้ว แต่ไม่พบข้อมูลรถในช่วงเวลาที่เลือก");
          return;
        }

        const rowsByScope = { day: [], night: [] };
        for (const row of matchingRows) {
          const rowScope = getVehicleReviewScopeForTimestamp(row?.occurredAt || row?.eventAt || row?.stamp) || activeScopeKey;
          rowsByScope[rowScope].push(row);
        }
        const scopesToSave = getVehicleSearchScopesForCriteria(criteria);
        let nextVehicleSearch = value;
        for (const scopeKeyToSave of scopesToSave) {
          const scopeRows = rowsByScope[scopeKeyToSave];
          nextVehicleSearch = updateVehicleSearchScope(nextVehicleSearch, scopeKeyToSave, {
            ...result,
            criteria,
            rows: scopeRows,
            pagination: { ...result.pagination, totalItems: scopeRows.length },
            scopeKey: scopeKeyToSave,
            emptyResultAcknowledgedAt: null,
          }, { baseUrl: vehicleSearchBaseUrl, apiProfile: vehicleSearchConfig.apiProfile });
        }
        onChange?.(nextVehicleSearch);
        const otherScopeKey = activeScopeKey === "day" ? "night" : "day";
        if (!rowsByScope[activeScopeKey].length && rowsByScope[otherScopeKey].length) setActiveScopeKey(otherScopeKey);
        notify?.(matchingRows.length
          ? `ดึงข้อมูลตามช่วงที่เลือก ${matchingRows.length} คัน · กลางวัน ${rowsByScope.day.length} · กลางคืน ${rowsByScope.night.length} คัน`
          : "ค้นหาเสร็จแล้ว แต่ไม่พบข้อมูลรถในช่วงเวลาที่เลือก");
      } catch (searchError) {
        if (searchError?.name === "AbortError") return;
        const message = searchError?.message || "ดึงข้อมูลรถจาก API ไม่สำเร็จ";
        setError(message);
        notify?.(message);
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          setLoading(false);
        }
      }
    };

    const selectRow = (row) => {
      if (!row) return;
      setSelectedRowId(row.id);
      const targetQueueIndex = queueRows.findIndex((queueRow) => queueRow.id === row.id);
      if (targetQueueIndex >= 0) {
        setQueuePage(Math.floor(targetQueueIndex / queuePageSize));
      } else {
        setQueueQuery("");
        setQueuePage(Math.floor(Math.max(0, orderedRows.findIndex((entry) => entry.id === row.id)) / queuePageSize));
      }
    };
    const navigateRow = (direction) => selectRow(getVehicleReviewNavigation(searchState, { rowId: selectedRow?.id, direction }));
    const goToPending = () => selectRow(orderedRows.find((row) => row.id === getNextPendingVehicleId(searchState, { rowId: selectedRow?.id, context: context?.key })));
    const review = (rowId, dimension, reviewStatus, detailPatch = {}) => commitSearchState(updateVehicleSearchDimensionReview(searchState, rowId, dimension, reviewStatus, detailPatch));
    const acknowledgeEmptyResult = () => {
      if (!isScopedReview || searchState.rows.length || !searchState.fetchedAt) return;
      commitSearchState(setVehicleSearchEmptyResultAcknowledged(searchState, true));
      notify?.(`ยืนยันแล้วว่าไม่พบรถช่วง${VEHICLE_REVIEW_SCOPE_OPTIONS.find((scope) => scope.key === activeScopeKey)?.label || "เวลานี้"}`);
    };
    const weight = (entry) => entry === null || entry === undefined ? "—" : `${Number(entry).toLocaleString("th-TH")} กก.`;
    const displayApiNumber = (entry, maximumFractionDigits = 2) => entry === null || entry === undefined ? "—" : Number(entry).toLocaleString("th-TH", { maximumFractionDigits });
    const axleDetail = (axle, index) => `เพลา ${axle.number ?? index + 1} · น้ำหนัก ${weight(axle.weight)} · ซ้าย ${weight(axle.weightLeft)} · ขวา ${weight(axle.weightRight)}`;
    const hasClassificationApiExtras = [
      selectedRow?.grossWeightLimit,
      selectedRow?.leftWeight,
      selectedRow?.rightWeight,
      selectedRow?.speed,
      selectedRow?.length,
      selectedRow?.esal,
      selectedRow?.isOverweight,
      selectedRow?.overweightPercentage,
    ].some((value) => value !== null && value !== undefined);
    const openMedia = (row, mediaKey, label, src) => {
      if (!src) return;
      setLightbox({ rowId: row.id, mediaKey, label, src, alt: `${label} ${row.plateNumber}`, plateNumber: row.plateNumber, occurredAt: row.occurredAt });
    };
    const navigateMedia = (direction) => {
      if (!lightbox) return;
      let nextRow = getVehicleReviewNavigation(searchState, { rowId: lightbox.rowId, direction });
      while (nextRow) {
        const nextSrc = lightbox.mediaKey === "plate" ? nextRow.plateImage : lightbox.mediaKey === "lpr" ? nextRow.lprImage : nextRow.overviewImage;
        if (nextSrc) {
          setLightbox({ ...lightbox, rowId: nextRow.id, src: nextSrc, alt: `${lightbox.label} ${nextRow.plateNumber}`, plateNumber: nextRow.plateNumber, occurredAt: nextRow.occurredAt });
          return;
        }
        nextRow = getVehicleReviewNavigation(searchState, { rowId: nextRow.id, direction });
      }
    };
    const canNavigateMedia = (direction) => {
      if (!lightbox) return false;
      let nextRow = getVehicleReviewNavigation(searchState, { rowId: lightbox.rowId, direction });
      while (nextRow) {
        if (lightbox.mediaKey === "plate" ? nextRow.plateImage : lightbox.mediaKey === "lpr" ? nextRow.lprImage : nextRow.overviewImage) return true;
        nextRow = getVehicleReviewNavigation(searchState, { rowId: nextRow.id, direction });
      }
      return false;
    };
    const panelTitle = context?.key === "classification" ? "ตรวจผลการคัดแยกประเภทรถ" : context?.key === "plate" ? "ตรวจผลการอ่านป้ายทะเบียน" : "ตรวจข้อมูลรถจาก API";
    const panelDescription = context?.key === "classification"
      ? "ตรวจประเภทรถเทียบกับภาพรถจาก API โดยใช้น้ำหนักรวมเป็นข้อมูลประกอบแบบอ่านอย่างเดียว"
      : context?.key === "plate"
        ? "ตรวจเลขทะเบียนเทียบกับภาพป้ายทะเบียนจาก API"
        : "เลือกช่วงเวลา ดึงรถทุกคัน แล้วตรวจผลจาก API แยกตามบริบท";

    return <section className={`ops-vehicle-focus-panel is-context-${context?.key || "all"}`} data-vehicle-search-panel data-vehicle-evidence-mode={isApiOnlyReview ? "api" : "attachment"} data-vehicle-scope={isScopedReview ? activeScopeKey : "all"} data-responsive-panel={responsivePanel} aria-labelledby={`vehicle-focus-title-${context?.key || "all"}`}>
      <div className="ops-vehicle-focus-heading"><div><p className="ops-eyebrow">{context?.checklistNumber || "VEHICLE API"}</p><h3 id={`vehicle-focus-title-${context?.key || "all"}`}>{panelTitle}</h3><span>{panelDescription}</span></div>{searchState.fetchedAt && <StatusBadge status={reviewStatusTone}>{criteriaDirty ? "เปลี่ยนช่วงเวลาแล้ว · ต้องดึงข้อมูลใหม่" : reviewStatusLabel}</StatusBadge>}</div>
      {!vehicleSearchBaseUrl && <div className="ops-vehicle-search-config-warning" role="status"><Icon name="alert" size="small" /><span>ยังไม่ได้ตั้งค่า Vehicle API ประจำสถานี จึงยังดึงข้อมูลไม่ได้ · ไปตั้งค่าที่ “ทะเบียนสถานี”</span></div>}
      {!allowLiveSearch && <div className="ops-vehicle-demo-search-note" role="status"><Icon name="info" size="small" /><span>หน้านี้ใช้ข้อมูลจำลองและไม่เชื่อมต่อ Vehicle API จริง · เปิดรอบตรวจจากรายการรอบเพื่อดึงข้อมูลสถานี</span></div>}
      <div className="ops-vehicle-focus-criteria">
        <label className="ops-field"><span>วันและเวลาเริ่ม <em>(เวลาไทย · จำเป็น)</em></span><ThaiDateTimePicker value={criteria.startAt} label="วันและเวลาเริ่ม" disabled={readOnly || loading} onChange={(nextValue) => updateCriteria("startAt", nextValue)} /></label>
        <label className="ops-field"><span>วันและเวลาสิ้นสุด <em>(เวลาไทย · จำเป็น)</em></span><ThaiDateTimePicker value={criteria.endAt} label="วันและเวลาสิ้นสุด" disabled={readOnly || loading} onChange={(nextValue) => updateCriteria("endAt", nextValue)} /></label>
        <div className="ops-vehicle-source"><strong>{round?.snapshot?.stationCode || "สถานีในรอบ"}</strong><span>{vehicleSearchConfig.stationName || "ตรวจสถานีจาก API ก่อนใช้ข้อมูล"}</span></div>
        {!readOnly && <button type="button" className="ops-button ops-button-primary" onClick={handleSearch} disabled={loading || !vehicleSearchBaseUrl || !allowLiveSearch}>{loading ? "กำลังดึงข้อมูล..." : "ดึงข้อมูลรถจาก API"}</button>}
      </div>
      {error && <div className="ops-vehicle-search-error" role="alert"><Icon name="alert" size="small" /><span>{error}</span></div>}
      {criteriaDirty && searchState.fetchedAt && <div className="ops-vehicle-search-stale" role="status"><Icon name="refresh" size="small" /><span>ช่วงเวลาที่เลือกไม่ตรงกับผล API ชุดล่าสุด ({formatDateTime(searchState.fetchedAt)}) ระบบพักผลเดิมไว้จนกว่าจะกด “ดึงข้อมูลรถจาก API” ใหม่</span></div>}
      {!criteriaDirty && (context?.key === "classification" ? (
        <div className="ops-vehicle-search-metrics is-classification-summary" aria-label="สรุปผลคัดแยกประเภทรถ">
          <div><span>รถทั้งหมด</span><strong>{summary.total}</strong><small>คัน</small></div>
          <div className="is-pending"><span>รอตรวจ</span><strong>{summary.unresolvedChecks}</strong><small>คัน · ตรวจแล้ว {summary.reviewed}</small></div>
          <div><span>ผลตรวจ</span><strong>{summary.correct} ถูก · {summary.incorrect} ผิด</strong><small>ความถูกต้อง {activeDimensionSummary.accuracy === null ? "—" : `${activeDimensionSummary.accuracy}%`}</small></div>
          <div className={`is-review-outcome is-${outcome.status}`}><span>ผลตามเกณฑ์</span><strong>{outcome.label}</strong><small>{outcome.sampleQualified ? "ครบเงื่อนไขจำนวน/เวลา" : "ต้องครบ 6 ชม. หรือ 100 คัน"}{activeThreshold ? ` · เกณฑ์ ≥ ${activeThreshold}%` : ""}</small>{outcome.reasons.length > 0 && <details className="ops-vehicle-outcome-reasons"><summary>ดูเหตุผล ({outcome.reasons.length})</summary><ul>{outcome.reasons.map((reason, index) => <li key={`${reason.code || "reason"}-${index}`}>{reason.label}</li>)}</ul></details>}</div>
        </div>
      ) : (
        <div className="ops-vehicle-search-metrics" aria-label="สรุปผลตรวจข้อมูลรถจาก API">
          <div><span>ทั้งหมด</span><strong>{summary.total}</strong><small>คัน</small></div>
          <div><span>ตรวจแล้ว</span><strong>{summary.reviewed}</strong><small>คัน</small></div>
          <div className="is-correct"><span>ถูก</span><strong>{summary.correct}</strong><small>คัน</small></div>
          <div className="is-incorrect"><span>ผิด</span><strong>{summary.incorrect}</strong><small>คัน</small></div>
          <div className="is-pending"><span>{activeDimensions.length > 1 ? "จุดตรวจค้างรวม" : "คันค้าง"}</span><strong>{summary.unresolvedChecks}</strong><small>{unresolvedUnit}</small></div>
          <div><span>ความถูกต้อง</span><strong>{activeDimensionSummary.accuracy === null ? "—" : `${activeDimensionSummary.accuracy}%`}</strong><small>{activeThreshold ? `เกณฑ์ ≥ ${activeThreshold}%` : "จากรถทั้งหมด"}</small></div>
          <div className={`is-review-outcome is-${outcome.status}`}><span>ผลตามเกณฑ์</span><strong>{outcome.label}</strong><small>{outcome.sampleQualified ? "ผ่านเงื่อนไขจำนวน/เวลา" : "ต้องครบ 6 ชม. หรือ 100 คัน"}</small>{outcome.reasons.length > 0 && <details className="ops-vehicle-outcome-reasons"><summary>รายละเอียด ({outcome.reasons.length})</summary><ul>{outcome.reasons.map((reason, index) => <li key={`${reason.code || "reason"}-${index}`}>{reason.label}</li>)}</ul></details>}</div>
        </div>
      ))}
        {searchState.fetchedAt && !criteriaDirty && <div className="ops-vehicle-search-provenance" role="status">{context?.key === "classification" ? <><span>สถานี API {searchState.sourceStation?.id || vehicleSearchConfig.stationId || "—"} · {searchState.sourceStation?.name || vehicleSearchConfig.stationName || "—"}</span><span>ข้อมูลรถ {searchState.pagination.totalItems || summary.total} คัน</span></> : <><span>ช่วงเวลา {formatThaiDateTimeInput(searchState.criteria.startAt) || "ยังไม่ระบุ"} ถึง {formatThaiDateTimeInput(searchState.criteria.endAt) || "ยังไม่ระบุ"}</span><span>สถานีตอบกลับ {searchState.sourceStation?.id || vehicleSearchConfig.stationId || "—"} · {searchState.sourceStation?.name || vehicleSearchConfig.stationName || "—"}</span><span>{searchState.pagination.totalPages || 0} หน้า · {searchState.pagination.totalItems || 0} คัน</span></>}</div>}
      {searchState.fetchedAt && !criteriaDirty && <div className="ops-vehicle-responsive-tabs" role="tablist" aria-label="มุมมองพื้นที่ตรวจ Vehicle API">
        {[['queue', 'คิวรถ'], ['evidence', 'ภาพหลักฐาน'], ['decision', 'ผลตรวจ']].map(([key, label]) => <button type="button" role="tab" key={key} aria-selected={responsivePanel === key} className={responsivePanel === key ? "is-active" : ""} onClick={() => setResponsivePanel(key)}>{label}</button>)}
      </div>}
      {criteriaDirty ? <div className="ops-vehicle-search-empty is-stale"><Icon name="refresh" /><strong>ต้องดึงข้อมูลรถใหม่</strong><span>ผลตรวจเดิมถูกพักไว้ เพราะช่วงเวลาที่เลือกเปลี่ยนจากครั้งล่าสุด</span></div> : !searchState.fetchedAt ? <div className="ops-vehicle-search-empty"><Icon name="search" /><strong>ยังไม่ได้ดึงข้อมูลรถ</strong><span>เลือกวันและเวลา แล้วกด “ดึงข้อมูลรถจาก API”</span></div> : !searchState.rows.length ? <div className="ops-vehicle-search-empty"><Icon name="info" /><strong>ไม่พบข้อมูลรถ</strong><span>{isScopedReview ? "API ตอบสำเร็จแล้ว แต่ผลว่างยังไม่ถือว่าเสร็จ ต้องยืนยันว่าไม่มีรถในช่วงเวลานี้" : "API ตอบสำเร็จและไม่พบรถในช่วงเวลา จึงถือว่าเป็นผลตรวจที่ถูกต้อง"}</span>{isScopedReview && !readOnly && !searchState.emptyResultAcknowledgedAt && <button type="button" className="ops-button ops-button-secondary" onClick={acknowledgeEmptyResult}>ยืนยันว่าไม่มีรถช่วงนี้</button>}{isScopedReview && searchState.emptyResultAcknowledgedAt && <small>ยืนยันผลแล้ว {formatDateTime(searchState.emptyResultAcknowledgedAt)}</small>}</div> : <div className="ops-vehicle-focus-layout">
        <aside className="ops-vehicle-focus-queue" data-dock-panel="queue" aria-label="คิวตรวจรถ">
          <div className="ops-vehicle-focus-queue-heading"><div><p className="ops-eyebrow">QUEUE</p><h4>คิวรถ</h4></div><strong>{queueRows.length} คัน</strong></div>
          <label className="ops-vehicle-queue-search"><span>ค้นหาทะเบียน {isPlateContext ? "จังหวัด" : "ประเภทรถ"} หรือ Lane</span><input type="search" value={queueQuery} onChange={(event) => { setQueueQuery(event.target.value); setQueuePage(0); }} placeholder="เช่น 68-3159 หรือ TH1" aria-label={`ค้นหาทะเบียน ${isPlateContext ? "จังหวัด" : "ประเภทรถ"} หรือ Lane`} /></label>
          {visibleQueueRows.length ? <div className="ops-vehicle-focus-row-list" aria-label="รายการรถในคิว">{visibleQueueRows.map((row) => <button type="button" key={row.id} className={selectedRow?.id === row.id ? "is-active" : ""} aria-current={selectedRow?.id === row.id ? "true" : undefined} onClick={() => selectRow(row)}><span>{row.plateNumber || "ไม่พบทะเบียน"}</span><small>{isPlateContext ? (row.province || "ไม่พบจังหวัด") : (row.vehicleClassLabel || "ไม่ระบุประเภทรถ")} · {row.occurredAt ? formatDateTime(row.occurredAt) : "ไม่พบเวลา"}</small><b>{row.lane || "ไม่ระบุ Lane"}</b><em className={isPendingRow(row) ? "is-pending" : "is-done"}>{isPendingRow(row) ? "รอตรวจ" : "ตรวจแล้ว"}</em></button>)}</div> : <div className="ops-vehicle-queue-empty">ไม่พบรายการที่ตรงกับคำค้น</div>}
          <nav className="ops-vehicle-queue-pagination" aria-label="แบ่งหน้าคิวรถ"><button type="button" className="ops-button ops-button-ghost" onClick={() => setQueuePage((page) => Math.max(0, page - 1))} disabled={queuePage <= 0} aria-label="หน้าก่อนหน้า">‹</button><div>{queuePageNumbers.map((page, index) => <span key={page} className="ops-vehicle-queue-page-item">{index > 0 && page - queuePageNumbers[index - 1] > 1 && <span aria-hidden="true">…</span>}<button type="button" className={queuePage === page ? "is-active" : ""} aria-current={queuePage === page ? "page" : undefined} onClick={() => setQueuePage(page)} aria-label={`หน้า ${page + 1}`}>{page + 1}</button></span>)}</div><button type="button" className="ops-button ops-button-ghost" onClick={() => setQueuePage((page) => Math.min(queuePageCount - 1, page + 1))} disabled={queuePage >= queuePageCount - 1} aria-label="หน้าถัดไป">›</button><small>แสดง {queueRows.length ? queuePage * queuePageSize + 1 : 0}–{Math.min((queuePage + 1) * queuePageSize, queueRows.length)} จาก {queueRows.length} รายการ</small></nav>
        </aside>
        {selectedRow && <>
          <main className="ops-vehicle-focus-main" data-dock-panel="evidence" data-vehicle-review-focus={domSafeId(selectedRow.id)}>
            <div className="ops-vehicle-focus-main-heading"><div><p className="ops-eyebrow">{isPlateContext ? "ตรวจเลขทะเบียน" : "ตรวจประเภทรถ"} · {selectedRow.lane || "ไม่ระบุ Lane"}</p><h4>ข้อมูลรถที่เลือก</h4><span>{isPlateContext ? (selectedRow.occurredAt ? formatDateTime(selectedRow.occurredAt) : "ไม่พบเวลา") : `${selectedRow.plateNumber || "ไม่พบทะเบียน"} · ${selectedRow.province || "ไม่พบจังหวัด"} · ${selectedRow.occurredAt ? formatDateTime(selectedRow.occurredAt) : "ไม่พบเวลา"}`}</span></div><div className="ops-vehicle-focus-main-tools"><strong>คันที่ {selectedRowIndex + 1} จาก {orderedRows.length}</strong></div></div>
            <section className={`ops-vehicle-focus-evidence-stack${isPlateContext ? "" : " is-classification"}`} aria-label={isPlateContext ? "หลักฐานภาพป้ายทะเบียน" : "หลักฐานภาพรถและผลคัดแยก"}>
              {isPlateContext
                ? <>
                  <div className="ops-vehicle-focus-section-heading"><h5>ภาพ LPR และภาพป้ายทะเบียน Crop</h5><span>ภาพจาก API · แตะภาพเพื่อขยาย</span></div>
                  <div className="ops-vehicle-focus-images is-plate-pair">
                    <div className="ops-vehicle-image-comparison"><strong>ภาพจากกล้อง LPR</strong><VehicleReviewImage className="ops-vehicle-focus-image is-lpr" src={selectedRow.lprImage} alt={`ภาพจากกล้อง LPR ${selectedRow.plateNumber}`} emptyLabel="ไม่พบภาพ LPR จาก API" onOpen={() => openMedia(selectedRow, "lpr", "ภาพจากกล้อง LPR", selectedRow.lprImage)} actionLabel="ดูภาพ LPR เต็ม" loading="eager" /></div>
                    <div className="ops-vehicle-image-comparison is-plate-crop"><strong>ภาพป้ายทะเบียน (Crop)</strong><VehicleReviewImage className="ops-vehicle-focus-image is-plate" src={selectedRow.plateImage} alt={`ภาพป้ายทะเบียน Crop ${selectedRow.plateNumber}`} emptyLabel="ไม่พบภาพป้าย Crop จาก API" onOpen={() => openMedia(selectedRow, "plate", "ภาพป้ายทะเบียน (Crop)", selectedRow.plateImage)} actionLabel="ดูภาพป้ายเต็ม" loading="eager" /><section className="ops-vehicle-focus-plate-summary is-near-crop" aria-label="ผลอ่านป้ายทะเบียนจาก API"><div><span>เลขทะเบียนจาก API</span><strong>{selectedRow.plateNumber || "ไม่พบทะเบียน"}</strong></div><div><span>จังหวัด</span><strong>{selectedRow.province || "ไม่พบจังหวัด"}</strong></div></section></div>
                  </div>
                  <dl className="ops-vehicle-focus-facts is-plate-facts"><div><dt>วันและเวลาผ่านสถานี</dt><dd>{selectedRow.occurredAt ? formatDateTime(selectedRow.occurredAt) : "ไม่พบเวลา"}</dd></div><div><dt>ช่องทาง (Lane)</dt><dd>{selectedRow.lane || "ไม่ระบุ Lane"}</dd></div><div><dt>สถานีตรวจสอบ</dt><dd>{selectedRow.stationName || vehicleSearchConfig.stationName || "ไม่ระบุสถานี"}</dd></div></dl>
                </>
                : <>
                  <section className="ops-vehicle-classification-summary" aria-labelledby="vehicle-classification-summary-title">
                    <div className="ops-vehicle-focus-section-heading"><h5 id="vehicle-classification-summary-title">ผลคัดแยกประเภทรถ (จาก AI)</h5><span>ข้อมูลจาก API · อ่านอย่างเดียว</span></div>
                    <div className="ops-vehicle-classification-metrics">
                      <div><span>ประเภทรถ</span><strong>{selectedRow.vehicleClassLabel || "ไม่ระบุประเภทรถ"}</strong></div>
                      {selectedRow.axleCount !== null && selectedRow.axleCount !== undefined && <div><span>จำนวนเพลา</span><strong>{selectedRow.axleCount} เพลา</strong></div>}
                      {selectedRow.grossWeight !== null && selectedRow.grossWeight !== undefined && <div><span>น้ำหนักรวม</span><strong>{weight(selectedRow.grossWeight)}</strong></div>}
                    </div>
                  </section>
                  <dl className="ops-vehicle-focus-facts is-classification-facts">
                    <div><dt>เลขทะเบียน</dt><dd>{selectedRow.plateNumber || "ไม่พบทะเบียน"} · {selectedRow.province || "ไม่พบจังหวัด"}</dd></div>
                    <div><dt>วันและเวลา</dt><dd>{selectedRow.occurredAt ? formatDateTime(selectedRow.occurredAt) : "ไม่พบเวลา"}</dd></div>
                    <div><dt>ช่องทาง (Lane)</dt><dd>{selectedRow.lane || "ไม่ระบุ Lane"}</dd></div>
                    <div><dt>สถานีตรวจสอบ</dt><dd>{selectedRow.stationName || vehicleSearchConfig.stationName || "ไม่ระบุสถานี"}</dd></div>
                    {selectedRow.vehicleDescription && <div><dt>รายละเอียดประเภทรถ</dt><dd>{selectedRow.vehicleDescription}</dd></div>}
                  </dl>
                  <div className="ops-vehicle-focus-section-heading"><h5>ภาพหลักฐาน (ภาพรถ)</h5><span>Overview จาก API</span></div>
                  <div className="ops-vehicle-focus-images is-overview-only is-classification">
                    <VehicleReviewImage className="ops-vehicle-focus-image is-overview" src={selectedRow.overviewImage} alt={`ภาพรถ ${selectedRow.plateNumber}`} emptyLabel="ไม่พบภาพรถ Overview" onOpen={() => openMedia(selectedRow, "overview", "ภาพรถ (Overview)", selectedRow.overviewImage)} actionLabel="ดูภาพรถเต็ม" loading="eager" />
                  </div>
                  {selectedRow.axles?.length > 0 ? <details className="ops-vehicle-axle-details is-primary-axle-details" open>
                    <summary>รายละเอียดน้ำหนักรายเพลา ({selectedRow.axles.length} เพลา)</summary>
                    <ul>{selectedRow.axles.map((axle, index) => <li key={selectedRow.id + "-axle-" + index}>{axleDetail(axle, index)}</li>)}</ul>
                  </details> : <p className="ops-vehicle-axle-empty" role="status">API ไม่ส่งรายละเอียดน้ำหนักรายเพลา</p>}
                  {selectedRow.axlesAfterAllowance?.length > 0 && <details className="ops-vehicle-axle-details is-primary-axle-details" open>
                    <summary>น้ำหนักรายเพลาหลังหักค่าผ่อนผัน</summary>
                    <ul>{selectedRow.axlesAfterAllowance.map((axle, index) => <li key={selectedRow.id + "-allowance-" + index}>เพลา {axle.number ?? index + 1} · น้ำหนัก {weight(axle.axleWeight)} · allowance {axle.allowance ?? "—"}</li>)}</ul>
                  </details>}
                  {hasClassificationApiExtras && <details className="ops-vehicle-axle-details ops-vehicle-api-extra-details">
                    <summary>ข้อมูลเสริมจาก API</summary>
                    <dl className="ops-vehicle-focus-facts is-classification-facts">
                      {selectedRow.grossWeightLimit !== null && selectedRow.grossWeightLimit !== undefined && <div><dt>น้ำหนักสูงสุดที่อนุญาต</dt><dd>{weight(selectedRow.grossWeightLimit)}</dd></div>}
                      {(selectedRow.leftWeight !== null && selectedRow.leftWeight !== undefined) || (selectedRow.rightWeight !== null && selectedRow.rightWeight !== undefined) ? <div><dt>น้ำหนักซ้าย / ขวา</dt><dd>{weight(selectedRow.leftWeight)} / {weight(selectedRow.rightWeight)}</dd></div> : null}
                      {selectedRow.speed !== null && selectedRow.speed !== undefined && <div><dt>ความเร็ว</dt><dd>{displayApiNumber(selectedRow.speed, 1)} กม./ชม.</dd></div>}
                      {selectedRow.length !== null && selectedRow.length !== undefined && <div><dt>ความยาวจาก API</dt><dd>{displayApiNumber(selectedRow.length, 0)}</dd></div>}
                      {selectedRow.esal !== null && selectedRow.esal !== undefined && <div><dt>ESAL</dt><dd>{displayApiNumber(selectedRow.esal, 3)}</dd></div>}
                      {selectedRow.isOverweight !== null && selectedRow.isOverweight !== undefined && <div><dt>น้ำหนักเกิน</dt><dd>{selectedRow.isOverweight ? "ใช่" : "ไม่ใช่"}{selectedRow.overweightPercentage !== null && selectedRow.overweightPercentage !== undefined ? " · " + displayApiNumber(selectedRow.overweightPercentage, 1) + "%" : ""}</dd></div>}
                    </dl>
                  </details>}
                </>}
            </section>
            <section className="ops-vehicle-focus-inspector" data-dock-panel="decision" aria-label="ผลตรวจรถคันปัจจุบัน"><div className="ops-vehicle-focus-inspector-heading"><div><p className="ops-eyebrow">ผลการตรวจสอบ</p><h4>{isPlateContext ? "ตรวจผลการอ่านป้ายทะเบียน" : "ตรวจผลการคัดแยกประเภทรถ"}</h4></div></div><div className="ops-vehicle-review-dimension-list">{activeDimensions.map((dimension) => <VehicleReviewDimensionActions key={dimension.key} row={selectedRow} dimension={dimension} readOnly={readOnly} onReview={review} onEvidenceChange={(rowId, dimensionKey, file) => onVehicleReviewEvidenceAttachmentChange?.(activeScopeKey, rowId, dimensionKey, file)} onEvidenceRemove={(rowId, dimensionKey, attachment) => onVehicleReviewEvidenceAttachmentRemove?.(activeScopeKey, rowId, dimensionKey, attachment)} />)}</div>{isApiOnlyReview && <details className="ops-vehicle-api-proof"><summary className="ops-vehicle-api-proof-heading"><Icon name="check" size="small" /><span><strong>หลักฐานการตรวจจาก API</strong><small>{apiProofLabel}</small></span></summary><div className="ops-vehicle-api-proof-details"><small>ช่วงเวลา {formatThaiDateTimeInput(searchState.criteria.startAt) || "ยังไม่ระบุ"} ถึง {formatThaiDateTimeInput(searchState.criteria.endAt) || "ยังไม่ระบุ"}</small><small>{searchState.fetchedAt ? `ดึงข้อมูล ${formatDateTime(searchState.fetchedAt)}` : "ยังไม่มีผลจาก API"} · {searchState.sourceStation?.name || vehicleSearchConfig.stationName || "ยังไม่ระบุสถานีต้นทาง"}</small></div></details>}{evidenceItem && !isApiOnlyReview && <section className="ops-vehicle-review-evidence" aria-labelledby="vehicle-review-evidence-title"><div className="ops-vehicle-review-evidence-heading"><div><p className="ops-eyebrow">DOCUMENT / EVIDENCE</p><h4 id="vehicle-review-evidence-title">หลักฐานประกอบ</h4></div><span>{evidenceBypassed ? "ไม่ต้องใช้หลักฐาน" : evidenceSlots.length ? `ครบ ${evidenceComplete}/${evidenceSlots.length} ช่อง` : "หลักฐานเสริม"}</span></div>{evidenceBypassed ? <div className="ops-evidence-drawer-disabled"><Icon name="info" size="small" /><span>รายการนี้ไม่ต้องแนบหลักฐาน</span></div> : evidenceSlots.length ? evidenceSlots.map((slot) => <EvidenceField key={slot.id} item={evidenceItem} slot={slot} value={evidenceState.evidence?.[slot.id]} readOnly={readOnly} disabled={false} onChange={(slotId, patch) => onChange?.({ evidence: { ...(evidenceState.evidence || {}), [slotId]: { ...(evidenceState.evidence?.[slotId] || {}), ...patch } } })} onAttachmentChange={(slotDefinition, file) => onEvidenceAttachmentChange?.(slotDefinition, file)} onAttachmentRemove={(slotDefinition, attachment, label) => onEvidenceAttachmentRemove?.(slotDefinition, attachment, label)} />) : <AttachmentField item={evidenceItem} attachment={evidenceState.attachment} readOnly={readOnly} disabled={false} onChange={(file) => onEvidenceAttachmentChange?.(null, file)} onRemove={() => onEvidenceAttachmentRemove?.(null, evidenceState.attachment, evidenceItem.label)} />}</section>}<div className="ops-vehicle-focus-navigation"><button type="button" className="ops-button ops-button-secondary" onClick={() => navigateRow("previous")} disabled={selectedRowIndex <= 0}>ก่อนหน้า</button><button type="button" className="ops-button ops-button-primary" onClick={() => navigateRow("next")} disabled={selectedRowIndex < 0 || selectedRowIndex >= orderedRows.length - 1}>ถัดไป</button><button type="button" className="ops-button ops-button-ghost" onClick={goToPending} disabled={!summary.unresolvedChecks}>ไปคันค้างถัดไป</button></div></section>
          </main>
        </>}
      </div>}
      {lightbox && <VehicleImageLightbox media={lightbox} onClose={() => setLightbox(null)} onNavigate={navigateMedia} canNavigatePrevious={canNavigateMedia("previous")} canNavigateNext={canNavigateMedia("next")} />}
    </section>;
  }

  return { VehicleFocusReviewPanel, VehicleSearchReviewPanelLegacy };
}
