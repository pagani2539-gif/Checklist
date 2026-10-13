import "../../styles/vehicle-sample-eligibility.css";
import "../../styles/vehicle-review-workspace.css";
import "../../styles/vehicle-photo-review.css";
import "../../styles/vehicle-compact-header.css";
import "../../styles/vehicle-review-route.css";
import { MasterSelect } from "../MasterSelect.jsx";
import { getRoundVehicleSearchConfig } from "../../domain/round-vehicle-connection.js";
import { PROVINCE_OPTIONS } from "../../domain/reference-data.js";
import { VehicleClassExample, VehicleClassComparison } from "./VehicleClassExample.jsx";
import CustomSelect from "../CustomSelect.jsx";
import VehicleClassSelect from "./VehicleClassSelect.jsx";
import { VEHICLE_CLASS_OPTIONS } from "../../domain/vehicle-class-options.js";
import { deleteVehicleReviewRows, getVehicleDeletionDataset } from "../../domain/vehicle-row-deletion.js";
import { getVehicleRowProgress, getVehicleRecordedProgress, isVehicleDecisionDirty, getVehiclePersistenceResult, persistVehicleReviewChange, continueAfterVehicleDecisionSave } from "../../domain/vehicle-review-progress.js";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AppIcon as Icon } from "../icon-system.jsx";
import { domSafeId } from "../dom-safe-id.js";
import { formatBangkokDateTime as formatDateTime, formatThaiDateTimeInput } from "../../domain/date-time.js";
import { isEvidenceSlotComplete } from "../../domain/evidence-checklist.js";
import { isEvidenceBypassItemStatus } from "../../domain/inspection-status.js";
import { selectVehicleTestSample } from "../../domain/vehicle-sampling.js";
import { replaceVehicleTestDataset, validateVehicleTestReplacement } from "../../domain/vehicle-test-replacement.js";
import { getVehicleSampleEligibilitySummary, updateVehicleSampleEligibility, VEHICLE_SAMPLE_ELIGIBILITY_OPTIONS, VEHICLE_SAMPLE_ELIGIBILITY_POLICY_VERSION } from "../../domain/vehicle-sample-eligibility.js";
import VehicleRowDeleteDialog from "./VehicleRowDeleteDialog.jsx";
import VehicleTestReplacementDialog from "./VehicleTestReplacementDialog.jsx";

const provinceChoices = PROVINCE_OPTIONS
  .map(option => ({ ...option, id: option.name, code: "" }))
  .sort((left, right) => left.name.localeCompare(right.name, "th"));
function ProvinceSelect({ value, onChange, disabled, label = "จังหวัดที่ยืนยันจากภาพ" }) {
  const options = value && !provinceChoices.some(option => option.id === value) ? [...provinceChoices, { id: value, name: `${value} (ข้อมูลเดิม)`, code: "" }] : provinceChoices;
  return <MasterSelect kind="province" options={options} value={value} onChange={onChange} disabled={disabled} label={label} placeholder="เลือกจังหวัด · พิมพ์ค้นหาได้" emptyText="ไม่พบจังหวัดที่ค้นหา" />;
}
const vehicleDecisionDrafts = new Map();

function VehiclePeriodTabs({ children, context = "plate" }) {
  const label = context === "classification" ? "คัดแยกประเภทรถ" : "ป้ายทะเบียน";
  return <section className="ops-vehicle-period-selector" aria-label={`เลือกช่วงทดสอบ${label}`}><strong>ชุดทดสอบ{label} · {context === "classification" ? "เฉพาะกลางวัน" : "เลือกช่วงทดสอบ"}</strong><div className="ops-vehicle-period-tabs" role="group" aria-label={`ชุดทดสอบ${label}${context === "classification" ? "กลางวัน" : "กลางวันและกลางคืน"}`}>{children}</div></section>;
}

import {
  VEHICLE_API_REVIEW_VERSION,
  VEHICLE_REVIEW_CORRECTION_TARGET_OPTIONS,
  VEHICLE_REVIEW_REASON_OPTIONS,
  VEHICLE_PLATE_VERIFICATION_OPTIONS,
  VEHICLE_REVIEW_SCOPE_OPTIONS,
  VEHICLE_REVIEW_STATUS_OPTIONS,
  VEHICLE_REVIEW_THRESHOLDS,
  buildVehicleSearchDirectImageUrl,
  prepareVehicleReviewDatasets,
  getVehicleClassificationDataset,
  getDaytimeVehicleClassificationDataset,
  filterVehicleSearchRowsByTimeRange,
  getNextPendingVehicleId,
  getNextPendingVehicleAfterDecision,
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
  updateVehicleSearchDimensionReview, updateVehicleReviewRow,
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
    return end > shiftEnd ? ["day", "night"] : [scopeKey];
  }

  const VEHICLE_REVIEW_DIMENSION_UI = Object.freeze([
    { key: "plate", statusKey: "reviewStatus", label: "ป้ายทะเบียน", correctLabel: "อ่านถูกต้อง", incorrectLabel: "อ่านไม่ถูกต้อง" },
    { key: "classification", statusKey: "classificationReviewStatus", label: "การคัดประเภท", correctLabel: "คัดประเภทถูกต้อง", incorrectLabel: "คัดประเภทไม่ถูกต้อง" },
  ]);

  function getVehicleReviewUnresolvedUnit(activeDimensions) {
    return activeDimensions.length > 1 ? "จุดตรวจ" : "คัน";
  }

  function getVehicleReviewStatusLabel(reviewState, summary, contextKey, outcome = null) {
    const dimension = summary.dimensions?.[contextKey] || summary;
    const accuracy = dimension.accuracyExact ?? dimension.accuracy;
    const percent = accuracy == null ? "—" : `${Number(Number(accuracy).toFixed(2))}%`;
    const threshold = VEHICLE_REVIEW_THRESHOLDS[contextKey];
    let resultLabel = outcome?.label || reviewState?.label || "ยังไม่ครบเกณฑ์";
    if (outcome?.status === "incomplete") {
      const reasons = outcome.reasons || [];
      const completeness = summary.pendingChecks ? `ยังไม่บันทึก ${summary.pendingChecks} คัน`
        : reasons.some(reason => reason.code === "sample-threshold") ? "จำนวนรถหรือช่วงเวลายังไม่ครบ"
        : reasons.some(reason => reason.code === "sample-not-locked") ? "ยังไม่ล็อกชุดคะแนน"
        : reasons.some(reason => reason.code === "insufficient-eligible-data") ? "ข้อมูลพร้อมคิดคะแนนยังไม่ครบ 100 คัน"
        : "เงื่อนไขชุดทดสอบยังไม่ครบ";
      resultLabel = `${summary.total > 0 && summary.pendingChecks === 0 ? "บันทึกผลครบแล้ว · " : ""}${accuracy != null && threshold != null ? accuracy >= threshold ? "ความถูกต้องผ่าน" : "ความถูกต้องต่ำกว่าเกณฑ์" : "ยังไม่มีคะแนน"} · ${completeness}`;
    }
    return `ความถูกต้อง${summary.pendingChecks ? "ชั่วคราว" : ""} ${percent} · ${resultLabel}`;
  }

  function getVehicleReviewStatusTone(reviewState, criteriaDirty, outcome) {
    if (criteriaDirty) return "waiting";
    if (outcome?.status === "passed") return "normal";
    if (outcome?.status === "failed") return "damaged";
    return "waiting";
  }

  function useVehicleReviewImage(src) {
    const [imageAttempt, setImageAttempt] = useState(null);
    const [retryCount, setRetryCount] = useState(0);
    const currentSource = useRef(src);
    currentSource.current = src;
    useEffect(() => {
      setImageAttempt(null);
      setRetryCount(0);
    }, [src]);
    const activeAttempt = imageAttempt?.source === src
      ? imageAttempt
      : { source: src, displaySrc: src, failed: false };
    // Retry only changes the local proxy URL. Remote/signed image references stay intact.
    const displaySrc = retryCount && activeAttempt.displaySrc?.startsWith("/api/vehicle/image?")
      ? `${activeAttempt.displaySrc}&_retry=${retryCount}`
      : activeAttempt.displaySrc;
    const handleImageError = (event) => {
      const image = event.currentTarget;
      const failedUrl = activeAttempt.displaySrc || "";
      if (currentSource.current !== src || image.getAttribute("src") !== displaySrc) return;
      const isImpsV2 = /[?&]apiProfile=imps-v2(?:&|$)/.test(failedUrl);
      const directUrl = isImpsV2 ? "" : buildVehicleSearchDirectImageUrl(failedUrl);
      if (directUrl && directUrl !== image.src) {
        setImageAttempt({ source: src, displaySrc: directUrl, failed: false });
        return;
      }
      setImageAttempt({ source: src, displaySrc: failedUrl, failed: true });
    };
    const retryImage = () => {
      setRetryCount((count) => count + 1);
      setImageAttempt({ source: src, displaySrc: src, failed: false });
    };
    return { failed: activeAttempt.failed, displaySrc, imageKey: `${src}::${displaySrc}::${retryCount}`, handleImageError, retryImage };
  }

  function VehicleReviewImage({ src, alt, emptyLabel, className, onOpen, onImageLoad, onImageFailure, actionLabel = "ดูรูปเต็ม", loading = "lazy" }) {
    const { failed, displaySrc, imageKey, handleImageError, retryImage } = useVehicleReviewImage(src);
    const hasImage = Boolean(src) && !failed;
    useEffect(() => { if (failed) onImageFailure?.(src); }, [failed, onImageFailure, src]);
    const content = <>
      {hasImage ? <span className="ops-vehicle-review-image-media"><img key={imageKey} src={displaySrc} alt={alt} loading={loading} onLoad={() => onImageLoad?.(src)} onError={handleImageError} /></span> : null}
      <span className="ops-vehicle-review-image-empty" hidden={hasImage}>{src && failed ? "โหลดภาพไม่สำเร็จ" : emptyLabel}</span>
      {src && failed && <button type="button" className="ops-button ops-button-secondary" onClick={retryImage}>โหลดภาพอีกครั้ง</button>}
      {hasImage && onOpen && <span className="ops-vehicle-review-image-action">{actionLabel}</span>}
    </>;
    if (hasImage && onOpen) return <button type="button" className={`${className} is-clickable`} aria-label={actionLabel} onClick={onOpen}>{content}</button>;
    return <div className={className}>{content}</div>;
  }

  function VehicleReviewDimensionActions({ row, dimension, readOnly, onReview, onSavedNext, canSaveNext = true, draftContext = "", requireFullPlateTruth = false, hideOriginalClass = false, classOptions = VEHICLE_CLASS_OPTIONS }) {
    const status = row[dimension.statusKey] || "pending";
    const detail = getVehicleReviewDetail(row, dimension.key);
    const cacheKey = `${draftContext}:${row.id}:${dimension.key}`;
    const restoredDraft = useRef(readOnly ? null : vehicleDecisionDrafts.get(cacheKey));
    const correctionTargetOptions = VEHICLE_REVIEW_CORRECTION_TARGET_OPTIONS[dimension.key] || [];
    const reasonOptions = (VEHICLE_REVIEW_REASON_OPTIONS[dimension.key] || []).filter(option => !option.legacy || option.value === detail.reasonCode);
    const [formStatus, setFormStatus] = useState(restoredDraft.current?.status || (["incorrect", "unable-to-verify"].includes(status) ? status : ""));
    const [correctedValue, setCorrectedValue] = useState(restoredDraft.current?.correctedValue ?? detail.correctedValue ?? "");
    const [confirmedPlateNumber, setConfirmedPlateNumber] = useState(restoredDraft.current?.confirmedPlateNumber ?? detail.confirmedPlateNumber ?? "");
    const [confirmedProvince, setConfirmedProvince] = useState(restoredDraft.current?.confirmedProvince ?? detail.confirmedProvince ?? "");
    const [correctionTarget, setCorrectionTarget] = useState(restoredDraft.current?.correctionTarget ?? detail.correctionTarget ?? "");
    const [reasonCode, setReasonCode] = useState(restoredDraft.current?.reasonCode ?? detail.reasonCode ?? "");
    const [verificationScope, setVerificationScope] = useState(restoredDraft.current?.verificationScope ?? detail.verificationScope ?? "");
    const [note, setNote] = useState(restoredDraft.current?.note ?? detail.note ?? "");
    const [noteOpen, setNoteOpen] = useState(Boolean(detail.note));
    const [decisionOpen, setDecisionOpen] = useState(false);
    const [largeEvidence, setLargeEvidence] = useState(false);
    const decisionDialogRef = useRef(null);
    useEffect(() => { if (!decisionOpen) return; const previous = document.activeElement; const overflow = document.body.style.overflow; document.body.style.overflow = "hidden"; decisionDialogRef.current?.focus(); return () => { document.body.style.overflow = overflow; previous?.focus?.(); }; }, [decisionOpen]);
    const [error, setError] = useState("");
    const activeFormStatus = ["incorrect", "unable-to-verify"].includes(formStatus || status) ? formStatus || status : "";
    const selectedStatus = formStatus || status;
    const selectedStatusLabel = selectedStatus === "correct" ? dimension.correctLabel : selectedStatus === "incorrect" ? dimension.incorrectLabel : VEHICLE_REVIEW_STATUS_OPTIONS.find((option) => option.value === selectedStatus)?.label || "";
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState(restoredDraft.current ? "คืนค่าที่ยังไม่บันทึกจากครั้งก่อนแล้ว · กรุณาตรวจและบันทึก" : "");
    const retainedDraft = useRef(Boolean(restoredDraft.current?.failed));
    const correctionInputRef = useRef(null);
    const errorId = `vehicle-review-error-${domSafeId(row.id)}-${dimension.key}`;

    const hasUnpersistedStatus = !readOnly && (retainedDraft.current || isVehicleDecisionDirty(status, detail, {
      status: selectedStatus, correctedValue, confirmedPlateNumber, confirmedProvince, correctionTarget, verificationScope, reasonCode, note,
    }));
    useEffect(() => {
      if (readOnly) return;
      if (hasUnpersistedStatus) {
        vehicleDecisionDrafts.set(cacheKey, { status: selectedStatus, correctedValue, confirmedPlateNumber, confirmedProvince, correctionTarget, verificationScope, reasonCode, note, failed: retainedDraft.current });
      } else vehicleDecisionDrafts.delete(cacheKey);
    }, [cacheKey, hasUnpersistedStatus, selectedStatus, correctedValue, confirmedPlateNumber, confirmedProvince, correctionTarget, verificationScope, reasonCode, note, readOnly, saving]);
    useEffect(() => {
      if (readOnly || (!hasUnpersistedStatus && !saving)) return;
      const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
      const guard = (event) => {
        const target = event.target.closest?.('a[href], .ops-vehicle-focus-row-list button, .ops-vehicle-focus-navigation button, .ops-vehicle-period-tabs button, .ops-vehicle-replace-test-button, .ops-shell-back');
        if (!target || target.disabled) return;
        if (saving || !window.confirm("มีผลที่ยังไม่บันทึก ต้องการทิ้งค่าที่แก้และเปลี่ยนหน้าหรือไม่? กดยกเลิกเพื่อกลับไปบันทึก")) {
          event.preventDefault(); event.stopImmediatePropagation();
        } else vehicleDecisionDrafts.delete(cacheKey);
      };
      window.addEventListener("beforeunload", warn);
      document.addEventListener("click", guard, true);
      return () => { window.removeEventListener("beforeunload", warn); document.removeEventListener("click", guard, true); };
    }, [hasUnpersistedStatus, saving, readOnly, cacheKey]);
    useEffect(() => {
      if (retainedDraft.current || restoredDraft.current) return;
      setFormStatus(["incorrect", "unable-to-verify"].includes(status) ? status : "");
      setCorrectedValue(detail.correctedValue || "");
      setConfirmedPlateNumber(detail.confirmedPlateNumber || "");
      setConfirmedProvince(detail.confirmedProvince || "");
      setCorrectionTarget(detail.correctionTarget || "");
      setReasonCode(detail.reasonCode || "");
      setVerificationScope(detail.verificationScope || "");
      setNote(detail.note || "");
      setNoteOpen(Boolean(detail.note));
      setError("");
    }, [row.id, dimension.key, status, detail.correctedValue, detail.confirmedPlateNumber, detail.confirmedProvince, detail.correctionTarget, detail.reasonCode, detail.verificationScope, detail.note, detail.evidenceAttachment?.id, saving]);

    const persistDecision = async (nextStatus, patch) => {
      if (saving || readOnly) return;
      retainedDraft.current = true;
      setSaving(true);
      setError("");
      setSaveMessage("กำลังบันทึก…");
      try {
        const result = getVehiclePersistenceResult(await onReview(row.id, dimension.key, nextStatus, patch));
        retainedDraft.current = !result.success;
        setSaveMessage(result.label);
        if (!result.success) setError(result.label);
        else {
          setDecisionOpen(false);
          restoredDraft.current = null;
          vehicleDecisionDrafts.delete(cacheKey);
          setFormStatus(["incorrect", "unable-to-verify"].includes(nextStatus) ? nextStatus : "");
          setCorrectedValue(patch.correctedValue || ""); setConfirmedPlateNumber(patch.confirmedPlateNumber || ""); setConfirmedProvince(patch.confirmedProvince || ""); setCorrectionTarget(patch.correctionTarget || "");
          setVerificationScope(patch.verificationScope || ""); setReasonCode(patch.reasonCode || ""); setNote(patch.note || "");
        }
        return result;
      } catch {
        setError("บันทึกไม่สำเร็จ · เก็บค่าที่กรอกไว้แล้ว กรุณาลองอีกครั้ง");
        setSaveMessage("");
      } finally { setSaving(false); }
    };
    const chooseStatus = (nextStatus) => {
      if (readOnly || saving) return;
      setError("");
      if (nextStatus === "correct") {
        setFormStatus("correct");
        setCorrectedValue(""); setConfirmedPlateNumber(""); setConfirmedProvince(""); setCorrectionTarget(""); setVerificationScope(""); setReasonCode(""); setNote("");
        void persistDecision(nextStatus, { correctedValue: null, confirmedPlateNumber: null, confirmedProvince: null, correctionTarget: null, verificationScope: null, reasonCode: null, note: "" });
        return;
      }
      if (nextStatus === "unable-to-verify" || (nextStatus === "incorrect" && activeFormStatus === "unable-to-verify")) {
        setCorrectedValue("");
        setCorrectionTarget("");
      }
      setFormStatus(nextStatus);
      setLargeEvidence(false);
      setDecisionOpen(true);
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

    const saveDecision = (advance = false) => {
      if (!activeFormStatus || saving) return;
      if (activeFormStatus === "unable-to-verify" && dimension.key === "plate" && !verificationScope) {
        setError("กรุณาเลือกส่วนที่ยืนยันได้จากภาพ");
        return;
      }
      if (activeFormStatus === "unable-to-verify" && dimension.key === "plate" && verificationScope !== "both-unverified" && !String(correctedValue).trim()) {
        setError(verificationScope === "province-unverified" ? "กรุณากรอกเลขทะเบียนที่ยืนยันได้" : "กรุณาเลือกจังหวัดที่ยืนยันได้");
        correctionInputRef.current?.focus();
        return;
      }
      if (activeFormStatus === "incorrect" && dimension.key === "plate" && !correctionTarget) {
        setError("กรุณาเลือกส่วนที่อ่านผิด");
        return;
      }
      if (activeFormStatus === "incorrect" && dimension.key === "plate" && requireFullPlateTruth && (!String(confirmedPlateNumber).trim() || !String(confirmedProvince).trim())) {
        setError("กรุณาบันทึกทั้งเลขทะเบียนจริงและจังหวัดจริงจากภาพ");
        correctionInputRef.current?.focus();
        return;
      }
      if (!reasonCode) {
        setError("กรุณาเลือกสาเหตุ");
        return;
      }
      if (activeFormStatus === "incorrect" && !(dimension.key === "plate" && requireFullPlateTruth) && !String(correctedValue).trim()) {
        setError("กรุณาระบุค่าที่ตรวจยืนยันแล้ว");
        correctionInputRef.current?.focus();
        return;
      }
      if (["other-classification", "other-plate"].includes(reasonCode) && !String(note || "").trim()) {
        setNoteOpen(true);
        setError("กรุณาระบุหมายเหตุสำหรับสาเหตุอื่น");
        return;
      }
      setError("");
      const confirmedNumber = String(confirmedPlateNumber || "").trim();
      const confirmedProvinceValue = String(confirmedProvince || "").trim();
      const actualForTarget = correctionTarget === "province" ? confirmedProvinceValue : confirmedNumber;
      void continueAfterVehicleDecisionSave(() => persistDecision(activeFormStatus, { correctedValue: dimension.key === "plate" && requireFullPlateTruth && activeFormStatus === "incorrect" ? actualForTarget : String(correctedValue || "").trim() || null, confirmedPlateNumber: dimension.key === "plate" && requireFullPlateTruth && activeFormStatus === "incorrect" ? confirmedNumber : null, confirmedProvince: dimension.key === "plate" && requireFullPlateTruth && activeFormStatus === "incorrect" ? confirmedProvinceValue : null, correctionTarget: activeFormStatus === "incorrect" && dimension.key === "plate" ? correctionTarget || null : null, verificationScope: activeFormStatus === "unable-to-verify" && dimension.key === "plate" ? verificationScope : null, reasonCode, note: String(note || "").trim() }), advance ? () => onSavedNext?.({ rowId: row.id, dimension: dimension.key, reviewStatus: activeFormStatus }) : undefined);
    };

    const correctionValueLabel = activeFormStatus !== "incorrect"
      ? dimension.key === "plate" && verificationScope === "province-unverified" ? "เลขทะเบียนที่ยืนยันได้" : dimension.key === "plate" && verificationScope === "number-unverified" ? "จังหวัดที่ยืนยันได้" : "รายละเอียดเพิ่มเติม (ไม่บังคับ)"
      : dimension.key === "plate"
        ? correctionTarget === "plate-number" ? "เลขทะเบียนที่ถูกต้อง" : correctionTarget === "province" ? "ชื่อจังหวัดที่ถูกต้อง" : "ค่าที่ตรวจยืนยันแล้ว"
        : "ค่าที่ตรวจยืนยันแล้ว";
    const correctionValuePlaceholder = activeFormStatus !== "incorrect"
      ? dimension.key === "plate" ? "ระบุรายละเอียดที่ยืนยันได้" : "เช่น รถบรรทุก 10 ล้อ"
      : dimension.key === "plate"
        ? correctionTarget === "plate-number" ? "เช่น 71-1381" : correctionTarget === "province" ? "เช่น กาญจนบุรี" : "เลือกส่วนที่อ่านผิดก่อน"
        : "เช่น รถบรรทุก 10 ล้อ";

    return <div className="ops-vehicle-review-dimension" data-vehicle-review-kind={dimension.key} tabIndex={-1} data-review-unsaved={hasUnpersistedStatus || undefined} aria-busy={saving}>
      <small className="ops-vehicle-decision-save-status" role="status" aria-live="polite">{saving ? "กำลังบันทึก…" : hasUnpersistedStatus ? "มีผลที่ยังไม่บันทึก · กดบันทึกเพื่อยืนยัน" : ["plate", "classification"].includes(dimension.key) && !error && status !== "pending" ? "✓ บันทึกแล้ว · " + selectedStatusLabel + (readOnly ? " · อ่านอย่างเดียว" : "") : saveMessage || (readOnly ? "ผลตรวจที่บันทึกไว้ · อ่านอย่างเดียว" : status === "pending" ? "ยังไม่ได้บันทึกผลคันนี้" : "บันทึกผลคันนี้แล้ว")}</small>
      <fieldset disabled={readOnly || saving} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <div className="ops-vehicle-review-dimension-heading"><strong>{["plate", "classification"].includes(dimension.key) && <Icon name="checklist" size="small" />}{dimension.label}</strong>{!["plate", "classification"].includes(dimension.key) && <small>{selectedStatusLabel}{hasUnpersistedStatus ? " · มีการแก้ไขที่ยังไม่บันทึก" : ""}</small>}      {decisionOpen && createPortal(<div className="ops-vehicle-decision-modal-backdrop"><section ref={decisionDialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={"vehicle-decision-title-" + domSafeId(row.id) + dimension.key} className="ops-vehicle-decision-modal" onKeyDown={event => {
        if (event.key === "Escape" && !saving) { event.stopPropagation(); setDecisionOpen(false); }
        if (event.key === "Tab") { const nodes = [...event.currentTarget.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]')].filter(node => node.getClientRects().length); const first = nodes[0]; const last = nodes[nodes.length - 1]; if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === event.currentTarget)) { event.preventDefault(); first?.focus(); } }
      }}><header><div><h3 id={"vehicle-decision-title-" + domSafeId(row.id) + dimension.key}>{dimension.label} · {activeFormStatus === "incorrect" ? "ไม่ถูกต้อง" : "ตรวจไม่ได้"}</h3><small>{row.plateNumber} · {row.lane} · {row.occurredAt ? formatDateTime(row.occurredAt) : "ไม่พบเวลา"}</small></div><button type="button" disabled={saving} onClick={() => setDecisionOpen(false)} aria-label="ปิดหน้าต่างกรอกผลตรวจ"><Icon name="close" /></button></header><div className={"ops-vehicle-decision-modal-content" + (largeEvidence ? " is-large-evidence" : "")}><aside className="ops-vehicle-decision-modal-evidence"><strong>ภาพหลักฐาน · กดภาพเพื่อขยายหรือย่อ</strong>{(dimension.key === "plate" ? [{src:row.lprImage,label:"ภาพจากกล้อง LPR"},{src:row.plateImage,label:"ภาพป้ายทะเบียน"}] : [{src:row.overviewImage,label:"ภาพรถ"}]).map(media => <div key={media.label}><span>{media.label}</span>{media.src ? <button type="button" onClick={() => setLargeEvidence(value => !value)} aria-label={largeEvidence ? "ย่อ" + media.label : "ขยาย" + media.label}><img src={media.src} alt={media.label + " " + row.plateNumber} /></button> : <p>ไม่พบ{media.label}</p>}</div>)}{dimension.key === "plate" ? <p>ผลเดิมจากระบบ: {row.plateNumber + " · " + (row.province || "ไม่พบจังหวัด")}</p> : <VehicleClassExample label={row.vehicleClassLabel} axleCount={row.axleCount} />} {largeEvidence && <button type="button" onClick={() => setLargeEvidence(false)}>กลับไปกรอกผลตรวจ</button>}</aside><fieldset className="ops-vehicle-decision-modal-fields" disabled={saving || readOnly}>{activeFormStatus && <div className="ops-vehicle-review-correction">
        {dimension.key === "plate" && <p className="ops-vehicle-form-steps">{activeFormStatus === "incorrect" ? "1 เลือกส่วนที่อ่านผิด → 2 กรอกค่าจริง → 3 เลือกสาเหตุ → 4 บันทึก" : "1 ระบุส่วนที่ยืนยันได้ → 2 กรอกข้อมูลที่ยืนยันได้ → 3 เลือกสาเหตุ → 4 บันทึก"}</p>}
        <div className="ops-vehicle-review-correction-fields">
          <div className="ops-vehicle-review-correction-value">
            {activeFormStatus === "unable-to-verify" && dimension.key === "plate" && <div className="ops-field">
              <span>ส่วนที่ยืนยันได้จากภาพ <em>(จำเป็น)</em></span>
              <div className="ops-vehicle-review-verification-options" role="group" aria-label="ส่วนที่ยืนยันได้จากภาพ">
                {VEHICLE_PLATE_VERIFICATION_OPTIONS.map((option) => <button key={option.value} type="button" className={`ops-vehicle-review-reason-option${verificationScope === option.value ? " is-selected" : ""}`} aria-pressed={verificationScope === option.value} disabled={readOnly} onClick={() => { if (verificationScope !== option.value) setCorrectedValue(""); setVerificationScope(option.value); setError(""); }}>{option.value === "province-unverified" ? "ยืนยันได้เฉพาะเลขทะเบียน" : option.value === "number-unverified" ? "ยืนยันได้เฉพาะจังหวัด" : "ยืนยันไม่ได้ทั้งคู่"}</button>)}
              </div>
            </div>}
            {activeFormStatus === "incorrect" && dimension.key === "plate" && <div className="ops-field ops-vehicle-review-target-picker">
              <span>ส่วนที่อ่านผิด <em>(จำเป็น)</em></span>
              <div className="ops-vehicle-review-target-options" role="group" aria-label="เลือกส่วนของป้ายทะเบียนที่อ่านผิด">
                {correctionTargetOptions.map((option) => <button key={option.value} type="button" className={`ops-vehicle-review-reason-option ops-vehicle-review-target-option${correctionTarget === option.value ? " is-selected" : ""}`} aria-pressed={correctionTarget === option.value} disabled={readOnly} onClick={() => chooseCorrectionTarget(option.value)}>{option.buttonLabel}</button>)}
              </div>
            </div>}
            {activeFormStatus === "incorrect" && dimension.key === "plate" && requireFullPlateTruth ? <><label className="ops-field"><span>เลขทะเบียนจริงจากภาพ <em>(จำเป็น)</em></span><input ref={correctionInputRef} aria-invalid={Boolean(error && !String(confirmedPlateNumber).trim())} aria-describedby={error ? errorId : undefined} value={confirmedPlateNumber} onChange={(event) => setConfirmedPlateNumber(event.target.value)} placeholder="กรอกเลขทะเบียนที่เห็นในภาพ" /></label><label className="ops-field"><span>จังหวัดจริงจากภาพ <em>(จำเป็น)</em></span><ProvinceSelect value={confirmedProvince} onChange={(event) => setConfirmedProvince(event.target.value)} disabled={readOnly || saving} /></label></> : <label className="ops-field"><span>{["plate", "classification"].includes(dimension.key) && <Icon name="edit" size="small" />}{correctionValueLabel}</span>{dimension.key === "classification" ? <VehicleClassSelect label="ประเภทรถที่ตรวจยืนยันแล้ว" value={correctedValue} disabled={readOnly || saving} aria-invalid={Boolean(error && !String(correctedValue).trim())} aria-describedby={error ? errorId : undefined} onChange={(event) => setCorrectedValue(event.target.value)}><option value="">เลือกประเภทรถ</option>{correctedValue && !classOptions.includes(correctedValue) && <option value={correctedValue}>{correctedValue} (ข้อมูลเดิม)</option>}{classOptions.map(label => <option key={label} value={label}>{label}</option>)}</VehicleClassSelect> : dimension.key === "plate" && (activeFormStatus === "incorrect" && correctionTarget === "province" || activeFormStatus === "unable-to-verify" && verificationScope === "number-unverified") ? <ProvinceSelect value={correctedValue} onChange={(event) => setCorrectedValue(event.target.value)} disabled={readOnly || saving} /> : <input ref={correctionInputRef} aria-invalid={Boolean(error && !String(correctedValue).trim() && /กรุณา(กรอก|ระบุค่า)/.test(error))} aria-describedby={error ? errorId : undefined} value={correctedValue} disabled={readOnly || (dimension.key === "plate" && activeFormStatus === "incorrect" && !correctionTarget)} onChange={(event) => setCorrectedValue(event.target.value)} placeholder={correctionValuePlaceholder} />}</label>}
          </div>
          <div className="ops-field ops-vehicle-review-reason-picker">
            <span>{["plate", "classification"].includes(dimension.key) && <Icon name="alert" size="small" />}สาเหตุหลัก <em>(เลือกหนึ่งข้อ)</em></span>
            <div className="ops-vehicle-review-reason-options" role="group" aria-label={`เลือกสาเหตุสำหรับ${dimension.label}`}>
              {reasonCode && !reasonOptions.some((option) => option.value === reasonCode) && <button type="button" className="ops-vehicle-review-reason-option is-selected" aria-pressed="true" disabled={readOnly}>{reasonCode} (ข้อมูลเดิม)</button>}
              {reasonOptions.map((option) => <button key={option.value} type="button" className={`ops-vehicle-review-reason-option${reasonCode === option.value ? " is-selected" : ""}`} aria-pressed={reasonCode === option.value} disabled={readOnly} onClick={() => chooseReason(option.value)}>{["plate", "classification"].includes(dimension.key) && <Icon name={{ "unclear-image": "camera", "vehicle-obscured": "truck", "axles-not-visible": "eye", "class-mismatch": "alert", "missing-image": "photo", "api-missing-class": "database", "vehicle-out-of-frame": "photo", "lane-straddling": "lane", "lifted-axle": "truck", "wrong-vehicle-image": "photo", "missing-class-data": "database", "class-code-mapping": "database", "other-classification": "edit", "blurred-image": "camera", "dark-image": "camera", "glare-image": "camera", "plate-obscured": "eye", "dirty-or-damaged": "alert", "out-of-frame": "photo", "missing-plate-image": "photo", "wrong-plate-image": "photo", "api-missing-plate": "database", "api-missing-province": "database", "plate-number-read-error": "scan", "province-read-error": "scan", "other-plate": "edit" }[option.value] || "alert"} size="small" />}{option.label}</button>)}
            </div>
          </div>
        </div>
        <div className="ops-vehicle-review-correction-note">
          <button type="button" className="ops-vehicle-note-toggle" aria-expanded={noteOpen} onClick={() => setNoteOpen(open => !open)}>{["plate", "classification"].includes(dimension.key) && <Icon name="edit" size="small" />}{noteOpen ? "พับหมายเหตุ" : String(note || "").trim() ? "เปิดหมายเหตุ · มีข้อความ" : ["other-classification", "other-plate"].includes(reasonCode) ? "เพิ่มหมายเหตุ (จำเป็น)" : "เพิ่มหมายเหตุ (ไม่บังคับ)"}</button>
          {noteOpen && <label className="ops-field"><span>{["plate", "classification"].includes(dimension.key) && <Icon name="edit" size="small" />}หมายเหตุ</span><textarea rows="2" value={note} disabled={readOnly} onChange={(event) => setNote(event.target.value)} placeholder="ระบุรายละเอียดเพิ่มเติม" /></label>}
        </div>
        {error && <small id={errorId} className="ops-vehicle-review-correction-error" role="alert">{error}</small>}

      </div>}
      </fieldset></div><footer><button type="button" className="ops-button ops-button-secondary" disabled={saving} onClick={() => setDecisionOpen(false)}>ยกเลิก · เก็บค่าที่กรอกไว้</button>{activeFormStatus && !readOnly && <div className="ops-vehicle-decision-footer">
        {error && <small className="ops-vehicle-review-correction-error" role="alert">{error}</small>}
        {onSavedNext && <button type="button" className="ops-button ops-button-primary" disabled={saving || !canSaveNext} onClick={() => saveDecision(true)}>{["plate", "classification"].includes(dimension.key) && <Icon name="save" size="small" />}{saving ? "กำลังบันทึก…" : "บันทึกและไปต่อ"}</button>}
        <button type="button" className={onSavedNext ? "ops-button ops-button-secondary" : "ops-button ops-button-primary"} disabled={saving} onClick={() => saveDecision()}>{["plate", "classification"].includes(dimension.key) && <Icon name="save" size="small" />}{saving ? "กำลังบันทึก…" : "บันทึก"}</button>
      </div>}
    </footer></section></div>, document.body)}
</div>
      <div className="ops-vehicle-review-actions" role="group" aria-label={`ตรวจ${dimension.label} ${row.plateNumber}`}>
        <button type="button" className={selectedStatus === "correct" ? "is-selected is-correct" : ""} aria-pressed={selectedStatus === "correct"} disabled={readOnly} onClick={() => chooseStatus("correct")}>{["plate", "classification"].includes(dimension.key) && <Icon name="check" size="small" />}{["plate", "classification"].includes(dimension.key) ? "ถูกต้อง" : dimension.correctLabel}</button>
        <button type="button" className={selectedStatus === "incorrect" ? "is-selected is-incorrect" : ""} aria-pressed={selectedStatus === "incorrect"} disabled={readOnly} onClick={() => chooseStatus("incorrect")}>{["plate", "classification"].includes(dimension.key) && <Icon name="close" size="small" />}{["plate", "classification"].includes(dimension.key) ? "ไม่ถูกต้อง" : dimension.incorrectLabel}</button>
        <button type="button" className={selectedStatus === "unable-to-verify" ? "is-selected is-unable-to-verify" : ""} aria-pressed={selectedStatus === "unable-to-verify"} disabled={readOnly} onClick={() => chooseStatus("unable-to-verify")}>{["plate", "classification"].includes(dimension.key) && <Icon name="alert" size="small" />}ตรวจไม่ได้</button>
      </div>
      {["plate", "classification"].includes(dimension.key) && !readOnly && status === "pending" && !activeFormStatus && <small className="ops-vehicle-save-hint">เลือก “ถูกต้อง” เพื่อบันทึกทันที</small>}
      {!activeFormStatus && error && <small role="alert">{error} · กดผลตรวจอีกครั้งเพื่อลองบันทึก</small>}
      </fieldset>
      {dimension.key === "classification" && status !== "pending" && <VehicleClassComparison originalLabel={row.vehicleClassLabel} status={status} correctedValue={detail.correctedValue} hideOriginal={hideOriginalClass} />}
      {readOnly && activeFormStatus && <button type="button" className="ops-button ops-button-secondary" onClick={() => setDecisionOpen(true)}>ดูรายละเอียดผลตรวจ</button>}
      </div>;
  }

  function VehicleImageLightbox({ media, onClose, onNavigate, canNavigatePrevious = true, canNavigateNext = true }) {
    const closeRef = useRef(null);
    const [zoom, setZoom] = useState(1);
    const [fullScreen, setFullScreen] = useState(false);
    const [naturalSize, setNaturalSize] = useState(null);
    const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
    const stageRef = useRef(null);
    const isPlate = media?.mediaKey === "plate";
    useEffect(() => {
      setNaturalSize(null);
      setFullScreen(false);
    }, [media?.src]);
    useEffect(() => {
      const stage = stageRef.current;
      if (!stage) return undefined;
      const measure = () => setStageSize({ width: Math.max(1, stage.clientWidth - 40), height: Math.max(1, stage.clientHeight - 40) });
      const observer = new ResizeObserver(measure);
      observer.observe(stage);
      measure();
      return () => observer.disconnect();
    }, [Boolean(media)]);
    const fitScale = naturalSize && stageSize.width
      ? Math.min(stageSize.width / naturalSize.width, stageSize.height / naturalSize.height, isPlate ? 420 / naturalSize.width : 1)
      : 1;
    const imageScale = fitScale * zoom;
    const { failed, displaySrc, imageKey, handleImageError, retryImage } = useVehicleReviewImage(media?.src);
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
    return <div className="ops-vehicle-lightbox" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={`ops-vehicle-lightbox-dialog${isPlate ? " is-plate" : ""}${fullScreen ? " is-fullscreen" : ""}`} role="dialog" aria-modal="true" aria-labelledby="vehicle-lightbox-title">
        <header className="ops-vehicle-lightbox-header">
          <div><p className="ops-eyebrow">ดูรูปเต็ม</p><h2 id="vehicle-lightbox-title">{media.label}</h2><span>{media.plateNumber} · {media.occurredAt ? formatDateTime(media.occurredAt) : "ไม่พบเวลา"}</span></div>
          <button ref={closeRef} type="button" className="ops-icon-button" aria-label="ปิดรูปเต็ม" onClick={onClose}><Icon name="close" /></button>
        </header>
        <div ref={stageRef} className="ops-vehicle-lightbox-stage">
          {!failed && <img key={imageKey} src={displaySrc} alt={media.alt} style={naturalSize ? { width: naturalSize.width * imageScale, height: naturalSize.height * imageScale } : undefined} onLoad={(event) => setNaturalSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} onError={handleImageError} />}
          {failed && <div role="status"><p>โหลดภาพไม่สำเร็จ</p><button type="button" className="ops-button ops-button-secondary" onClick={retryImage}>โหลดภาพอีกครั้ง</button></div>}
        </div>
        <footer className="ops-vehicle-lightbox-footer">
          <div className="ops-vehicle-lightbox-zoom" role="group" aria-label="เครื่องมือซูมภาพ">
            <button type="button" className="ops-button ops-button-secondary" aria-label="ย่อภาพ" onClick={() => setZoom((current) => Math.max(.25, Number((current - .25).toFixed(2))))} disabled={zoom <= .25}>−</button>
            <span>{Math.round(imageScale * 100)}%</span>
            <button type="button" className="ops-button ops-button-secondary" aria-label="ขยายภาพ" onClick={() => setZoom((current) => Math.min(6, Number((current + .25).toFixed(2))))} disabled={zoom >= 6}>+</button>
            <button type="button" className="ops-button ops-button-ghost" onClick={() => setZoom(1)}>พอดีกรอบ</button>
            <button type="button" className="ops-button ops-button-ghost" disabled={!naturalSize} onClick={() => setZoom(1 / fitScale)}>ขนาดจริง</button>
            <button type="button" className="ops-button ops-button-ghost" aria-pressed={fullScreen} onClick={() => setFullScreen((current) => !current)}>{fullScreen ? "กลับกรอบปกติ" : "เต็มจอ"}</button>
          </div>
          <div className="ops-vehicle-lightbox-nav"><button type="button" className="ops-button ops-button-secondary" onClick={() => onNavigate?.("previous")} disabled={!onNavigate || !canNavigatePrevious}>ก่อนหน้า</button><button type="button" className="ops-button ops-button-secondary" onClick={() => onNavigate?.("next")} disabled={!onNavigate || !canNavigateNext}>ถัดไป</button></div>
        </footer>
      </section>
    </div>;
  }

  function VehicleSearchReviewPanelLegacy({ round, value, readOnly, onChange, onEvidenceRowSaved, notify, focusRowId, focusReviewKind, onFocusComplete, contextKey = "" }) {
    const vehicleSearchConfig = getRoundVehicleSearchConfig(round);
    const vehicleSearchBaseUrl = vehicleSearchConfig.baseUrl;
    const connectionReady = Boolean(vehicleSearchBaseUrl && (vehicleSearchConfig.apiProfile !== "imps-v2" || vehicleSearchConfig.searchUrl));
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
    const storedSearchState = normalizeVehicleSearchState(value, fallbackCriteria, { baseUrl: vehicleSearchBaseUrl, apiProfile: vehicleSearchConfig.apiProfile, searchUrl: vehicleSearchConfig.searchUrl, stationProfileId: round?.stationId || round?.snapshot?.stationId, systemKey: vehicleSearchConfig.systemKey, roundId: vehicleSearchConfig.roundId });
    const searchState = context?.key === "classification" ? getDaytimeVehicleClassificationDataset(storedSearchState) : storedSearchState;
    const commitLegacySearchState = next => onChange(context?.key === "classification" ? { ...next, rows: [...next.rows, ...storedSearchState.rows.filter(row => getVehicleReviewScopeForTimestamp(row.occurredAt) === "night" && !next.rows.some(current => current.id === row.id))] } : next);
    const criteriaDirty = Boolean(searchState.fetchedAt) && isVehicleCriteriaDirty(criteria, searchState.criteria);
    const summary = getVehicleSearchReviewSummary(searchState, { reviewVersion, context: context?.key });
    const outcome = getVehicleReviewOutcome(searchState, { reviewVersion, context: context?.key });
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
        if (context?.key === "classification") validateVehicleTestReplacement({ context: "plate", scopeKey: "day", criteria, limit: 0 });
        const result = await searchVehicles(criteria, { signal: controller.signal, baseUrl: vehicleSearchBaseUrl, searchUrl: vehicleSearchConfig.searchUrl, apiProfile: vehicleSearchConfig.apiProfile, expectedStationId: vehicleSearchConfig.stationId, expectedStationName: vehicleSearchConfig.stationName, stationProfileId, systemKey: vehicleSearchConfig.systemKey, roundId: vehicleSearchConfig.roundId, transport: vehicleSearchConfig.apiProfile === "imps-v2" ? "proxy" : "direct-first" });
        commitLegacySearchState(context?.key === "classification" ? getDaytimeVehicleClassificationDataset(result) : result);
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

    const review = async (rowId, dimension, reviewStatus, detailPatch = {}) => {
      const row = searchState.rows.find(entry => entry.id === rowId);
      const nextState = updateVehicleSearchDimensionReview(searchState, rowId, dimension, reviewStatus, detailPatch);
      try {
        const persistence = await persistVehicleReviewChange(commitLegacySearchState, nextState);
        const savedContext = context?.key === "classification" ? "classification" : "plate";
        const savedScope = getVehicleReviewScopeForTimestamp(row?.occurredAt) || "day";
        try { void Promise.resolve(onEvidenceRowSaved?.({ rowId, context: savedContext, scopeKey: savedScope })).catch(() => {}); } catch { /* Evidence archival must not change the saved decision result. */ }
        return persistence;
      } catch (saveError) {
        setError(saveError?.message || "บันทึกผลตรวจไม่สำเร็จ");
        return null;
      }
    };
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
    const isEvidenceScore = context?.key === "plate" && searchState.sampleEligibilityPolicyVersion === VEHICLE_SAMPLE_ELIGIBILITY_POLICY_VERSION;
    return <section className={`ops-vehicle-search-panel is-context-${context?.key || "all"}`} data-vehicle-search-panel aria-labelledby={`vehicle-search-title-${context?.key || "all"}`}>
      <div className="ops-vehicle-search-heading">
        <div><p className="ops-eyebrow">{context?.checklistNumber || "VEHICLE API"}</p><h3 id={`vehicle-search-title-${context?.key || "all"}`}>{panelTitle}</h3><span>{panelDescription}</span></div>
        {searchState.fetchedAt && <small className="ops-vehicle-search-fetched">{reviewStatusLabel} · ดึงข้อมูลล่าสุด {formatDateTime(searchState.fetchedAt)}</small>}
      </div>
      {!connectionReady && <div className="ops-vehicle-search-config-warning" role="status"><Icon name="alert" size="small" /><span>{readOnly ? "รอบนี้ไม่ได้บันทึกการเชื่อมต่อข้อมูลรถไว้ การแก้ทะเบียนสถานีจะไม่เปลี่ยนประวัตินี้" : "ยังไม่ได้ตั้งค่าการเชื่อมต่อข้อมูลรถประจำสถานี · ไปตั้งค่าที่ทะเบียนสถานี"}</span></div>}
      <div className="ops-vehicle-search-criteria">
        <label className="ops-field"><span>วันและเวลาเริ่ม <em>(เวลาไทย · จำเป็น)</em></span><ThaiDateTimePicker value={criteria.startAt} label="วันและเวลาเริ่ม" disabled={readOnly || loading} onChange={(nextValue) => updateCriteria("startAt", nextValue)} /></label>
        <label className="ops-field"><span>วันและเวลาสิ้นสุด <em>(เวลาไทย · จำเป็น)</em></span><ThaiDateTimePicker value={criteria.endAt} label="วันและเวลาสิ้นสุด" disabled={readOnly || loading} onChange={(nextValue) => updateCriteria("endAt", nextValue)} /></label>
        <div className="ops-vehicle-source"><strong>{round?.snapshot?.stationCode || "สถานีในรอบ"}</strong><span>{vehicleSearchConfig.stationName || "ตรวจสถานีจาก API ก่อนใช้ข้อมูล"}</span></div>
        {!readOnly && <button type="button" className="ops-button ops-button-primary ops-vehicle-search-submit" onClick={handleSearch} disabled={loading || !vehicleSearchBaseUrl}>{loading ? "กำลังดึงข้อมูล..." : "ดึงข้อมูลรถจาก API"}</button>}
      {searchState.fetchedAt && !criteriaDirty && <section className="ops-vehicle-session-outcome" aria-label="เงื่อนไขชุดทดสอบ"><strong>เงื่อนไขชุดทดสอบ</strong><p>{outcome.sampleQualified ? "ครบเงื่อนไขจำนวนข้อมูล" : outcome.dataSufficient === false ? "ข้อมูลพร้อมคิดคะแนนยังไม่ครบ 100 คัน" : outcome.sampleLocked === false ? "ต้องคัดข้อมูลต้นทางและล็อกชุดคะแนนก่อน" : "ต้องครบ 6 ชั่วโมงหรือ 100 คัน"}</p>{outcome.reasons.filter(reason => reason.code !== "unable-to-verify").length > 0 && <ul>{outcome.reasons.filter(reason => reason.code !== "unable-to-verify").map((reason, index) => <li key={`${reason.code}-${index}`}>{reason.label}</li>)}</ul>}<p>ตรวจยืนยันไม่ได้เป็นผลที่บันทึกแล้ว ระบบยังสรุปว่าข้อมูลนั้นถูกหรือผิดไม่ได้</p></section>}
      </div>
      {error && <div className="ops-vehicle-search-error" role="alert"><Icon name="alert" size="small" /><span>{error}</span></div>}
      {!criteriaDirty && <div className="ops-vehicle-search-metrics" aria-label="สรุปผลตรวจข้อมูลรถจาก API">
        {activeDimensions.map((dimension) => {
          const dimensionSummary = summary.dimensions[dimension.key];
          return <div key={dimension.key} className={`ops-vehicle-search-metric-dimension is-${dimension.key}`}><span>{dimension.label}</span><strong>{dimensionSummary.reviewed}/{dimensionSummary.total}</strong><small>ตรวจแล้ว · ถูก {dimensionSummary.correct} · ผิด {dimensionSummary.incorrect} · ค้าง {dimensionSummary.pending}</small></div>;
        })}
         <div className="is-pending"><span>{activeDimensions.length > 1 ? "จุดตรวจค้างรวม" : "คันค้าง"}</span><strong>{summary.pendingChecks}</strong><small>{unresolvedUnit} · ยังไม่ตรวจ {summary.pendingChecks} · ตรวจไม่ได้ {summary.unableToVerifyChecks}</small></div>
      </div>}
      {searchState.fetchedAt && !criteriaDirty && <div className="ops-vehicle-search-provenance" role="status"><span>ช่วงเวลา {formatThaiDateTimeInput(searchState.criteria.startAt) || "ยังไม่ระบุ"} ถึง {formatThaiDateTimeInput(searchState.criteria.endAt) || "ยังไม่ระบุ"}</span><span>สถานีตอบกลับ {searchState.sourceStation?.id || vehicleSearchConfig.stationId || "—"} · {searchState.sourceStation?.name || vehicleSearchConfig.stationName || "—"}</span><span>{searchState.pagination.totalPages || 0} หน้า · {searchState.pagination.totalItems || 0} คัน</span></div>}
      {criteriaDirty ? <div className="ops-vehicle-search-empty is-stale"><Icon name="refresh" /><strong>ต้องดึงข้อมูลรถใหม่</strong><span>ผลตรวจเดิมถูกพักไว้ เพราะช่วงเวลาที่เลือกเปลี่ยนจากครั้งล่าสุด</span></div> : !searchState.fetchedAt ? <div className="ops-vehicle-search-empty"><Icon name="search" /><strong>ยังไม่ได้ดึงข้อมูลรถ</strong><span>{readOnly ? "รอบนี้ไม่มีข้อมูลรถที่บันทึกไว้ · ประวัติเป็นข้อมูลอ่านอย่างเดียว" : "เลือกวันและเวลา แล้วกด “ดึงข้อมูลรถจาก API”"}</span></div> : !searchState.rows.length ? <div className="ops-vehicle-search-empty"><Icon name="info" /><strong>ไม่พบข้อมูลรถ</strong><span>API ตอบสำเร็จและไม่พบรถในช่วงเวลา จึงถือว่าเป็นผลตรวจที่ถูกต้อง</span></div> : <>
          <div className="ops-vehicle-queue-groups" aria-label="คิวตรวจข้อมูลรถตามประเภทรถและ Lane">{groups.map((group) => <button type="button" key={group.key} className={activeGroup?.key === group.key ? "is-active" : ""} onClick={() => setActiveGroupKey(group.key)}><strong>{group.label}</strong><span>{group.lane || "ไม่ระบุ Lane"} · {group.total} คัน</span><small>ยังไม่บันทึก {group.pendingChecks} {unresolvedUnit}</small></button>)}</div>
         {activeGroup && <section className="ops-vehicle-review-group"><div className="ops-vehicle-review-group-heading"><div><p className="ops-eyebrow">{activeGroup.lane || "ไม่ระบุ Lane"}</p><h4>{activeGroup.label}</h4><span>{activeDimensions.map((dimension) => `${dimension.label} ${activeGroup[`${dimension.key === "axles" ? "axle" : dimension.key}Reviewed`] || 0}/${activeGroup.total}`).join(" · ")}</span></div><strong>ยังไม่บันทึก {activeGroup.pendingChecks} จุด</strong></div>
          <div className="ops-vehicle-review-card-list">{activeGroup.rows.map((row) => <article data-vehicle-review-row={row.id} key={row.id} className="ops-vehicle-review-card">
            <div className="ops-vehicle-review-images">{isPlateContext ? <VehicleReviewImage className="ops-vehicle-plate-image" src={row.plateImage} alt={`ภาพป้ายทะเบียน ${row.plateNumber}`} emptyLabel="ไม่พบภาพ Crop" /> : <VehicleReviewImage className="ops-vehicle-overview-image" src={row.overviewImage} alt={`ภาพรถ Overview ${row.plateNumber}`} emptyLabel="ไม่พบภาพ Overview" />}</div>
             <div className="ops-vehicle-review-card-copy"><strong className="ops-code">{row.plateNumber}</strong><span>{row.province || "ไม่พบจังหวัด"} · {row.occurredAt ? formatDateTime(row.occurredAt) : "ไม่พบเวลา"}</span><div className="ops-vehicle-review-facts">{isPlateContext ? <span><b>ผลอ่านป้าย</b> {row.plateNumber} · {row.province || "ไม่พบจังหวัด"}</span> : <><span><b>ประเภท</b> {row.vehicleClassLabel || "ไม่ระบุ"}</span>{row.vehicleDescription && <span><b>รายละเอียด</b> {row.vehicleDescription}</span>}<span><b>เพลา</b> {row.axleCount ?? "—"} เพลา · <b>น้ำหนักรวม</b> {weight(row.grossWeight)} · <b>สูงสุดที่อนุญาต</b> {weight(row.grossWeightLimit)} · <b>ซ้าย/ขวา</b> {weight(row.leftWeight)} / {weight(row.rightWeight)}</span>{row.speed !== null && <span><b>การเคลื่อนที่</b> {row.speed} กม./ชม. · ความยาว {row.length ?? "—"} · ESAL {row.esal ?? "—"}</span>}{row.isOverweight !== null && <span><b>Overload</b> {row.isOverweight ? "ใช่" : "ไม่ใช่"}{row.overweightPercentage !== null ? ` · ${row.overweightPercentage}%` : ""}</span>}</>}</div>{(row.integrityWarnings?.length || row.errorFlags?.length || row.warningFlags?.length) ? <div className="ops-vehicle-integrity-warnings" role="note"><strong>คำเตือนช่วยตรวจ</strong>{row.integrityWarnings?.map((entry) => <span key={`${row.id}-${entry.code}`}>{entry.message}</span>)}</div> : null}{!isPlateContext && row.axles.length > 0 && <div className="ops-vehicle-axle-details"><strong>รายละเอียดเพลา</strong><ul>{row.axles.map((axle, index) => <li key={`${row.id}-axle-${index}`}>{axleDetail(axle, index)}</li>)}</ul></div>}{!isPlateContext && row.axlesAfterAllowance.length > 0 && <div className="ops-vehicle-axle-details"><strong>หลังหักค่าผ่อนผัน</strong><ul>{row.axlesAfterAllowance.map((axle, index) => <li key={`${row.id}-allowance-${index}`}>เพลา {axle.number ?? index + 1} · น้ำหนัก {weight(axle.axleWeight)} · allowance {axle.allowance ?? "—"}</li>)}</ul></div>}</div>
            <div className="ops-vehicle-review-dimension-list">{activeDimensions.map((dimension) => <VehicleReviewDimensionActions key={`${row.id}:${dimension.key}`} row={row} dimension={dimension} readOnly={readOnly} onReview={review} draftContext={round?.id} />)}</div>
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
  function VehicleSampleEligibilityTriage({ rows, visibleRows, page, pageCount, selectedRow, summary, readOnly, reason, setReason, note, setNote, onSelect, onDecide, onPage, onOpenImage, sampleSettings }) {
    const [readyImageSources, setReadyImageSources] = useState([]);
    const reasonLabel = code => VEHICLE_SAMPLE_ELIGIBILITY_OPTIONS.find(option => option.value === code)?.label || code || "—";
    const eligibility = selectedRow?.sampleEligibility;
    const decisionImages = [selectedRow?.plateImage, selectedRow?.lprImage, selectedRow?.overviewImage].filter(Boolean);
    const hasVisibleEvidence = decisionImages.some(source => readyImageSources.includes(source));
    useEffect(() => { setReadyImageSources([]); }, [selectedRow?.id]);
    const markImageReady = source => setReadyImageSources(current => current.includes(source) ? current : [...current, source]);
    const markImageFailed = source => setReadyImageSources(current => current.filter(entry => entry !== source));
    return <div className="ops-vehicle-eligibility-layout ops-vehicle-focus-layout" data-vehicle-workspace="plate" aria-label="คัดความพร้อมข้อมูลสำหรับชุดคะแนน">
        <aside className="ops-vehicle-eligibility-queue ops-vehicle-focus-queue" data-dock-panel="queue" aria-label="คิวข้อมูลต้นทาง">
          <strong>ข้อมูลต้นทางทั้งหมด · {rows.length} คัน</strong>
          {visibleRows.length ? <div className="ops-vehicle-eligibility-row-list ops-vehicle-focus-row-list">{visibleRows.map(row => {
            const state = row.sampleEligibility?.status || "pending";
            const label = state === "eligible" ? "พร้อมคิดคะแนน" : state === "excluded" ? `คัดออก · ${reasonLabel(row.sampleEligibility?.reasonCode)}` : "ยังไม่คัด";
            return <button type="button" key={row.id} className={selectedRow?.id === row.id ? "is-active" : ""} aria-current={selectedRow?.id === row.id ? "true" : undefined} onClick={() => onSelect(row)}><strong>{row.plateNumber || "ไม่พบเลขจาก API"} · {row.province || "ไม่พบจังหวัดจาก API"}</strong><span>{row.occurredAt ? formatDateTime(row.occurredAt) : "ไม่พบเวลา"} · {row.lane || "ไม่ระบุ Lane"}</span><em className={`is-${state}`}>{label}</em></button>;
          })}</div> : <p>ไม่พบรายการ</p>}
          <nav className="ops-vehicle-eligibility-pagination" aria-label="แบ่งหน้าข้อมูลต้นทาง"><button type="button" className="ops-button ops-button-secondary" onClick={() => onPage(Math.max(0, page - 1))} disabled={page <= 0}>ก่อนหน้า</button><span>หน้า {page + 1} / {pageCount}</span><button type="button" className="ops-button ops-button-secondary" onClick={() => onPage(Math.min(pageCount - 1, page + 1))} disabled={page >= pageCount - 1}>ถัดไป</button></nav>
        </aside>
        {selectedRow && <main className="ops-vehicle-eligibility-detail ops-vehicle-focus-main" data-dock-panel="evidence"><header className="ops-vehicle-focus-main-heading"><div><p className="ops-eyebrow">รายการ {rows.findIndex(row => row.id === selectedRow.id) + 1} จาก {rows.length}</p><h5>{selectedRow.plateNumber || "ไม่พบเลขทะเบียนจาก API"} · {selectedRow.province || "ไม่พบจังหวัดจาก API"}</h5><span>{selectedRow.occurredAt ? formatDateTime(selectedRow.occurredAt) : "ไม่พบเวลา"} · {selectedRow.lane || "ไม่ระบุ Lane"}</span></div>{eligibility?.status !== "pending" && <strong className={`is-${eligibility.status}`}>{eligibility.status === "eligible" ? "พร้อมคิดคะแนน" : `คัดออก · ${reasonLabel(eligibility.reasonCode)}`}</strong>}</header>
          <div className="ops-vehicle-focus-evidence-stack"><section className="ops-vehicle-eligibility-images ops-vehicle-focus-images is-plate-pair" aria-label="ตรวจภาพจริงก่อนจัดเข้าชุดคะแนน"><div className="ops-vehicle-image-comparison"><strong>ภาพจากกล้อง LPR</strong><VehicleReviewImage className="ops-vehicle-focus-image is-lpr" src={selectedRow.lprImage} alt={`ภาพจากกล้อง LPR ${selectedRow.id}`} emptyLabel="ไม่พบภาพ LPR จากต้นทาง" onImageLoad={markImageReady} onImageFailure={markImageFailed} onOpen={() => onOpenImage?.(selectedRow, "lpr", "ภาพจากกล้อง LPR", selectedRow.lprImage)} actionLabel="ดูภาพ LPR เต็ม" loading="eager" /></div><div className="ops-vehicle-image-comparison is-plate-crop"><strong>ภาพป้ายทะเบียน Crop</strong><VehicleReviewImage className="ops-vehicle-focus-image is-plate" src={selectedRow.plateImage} alt={`ภาพป้ายทะเบียน ${selectedRow.id}`} emptyLabel="ไม่พบภาพป้ายจากต้นทาง" onImageLoad={markImageReady} onImageFailure={markImageFailed} onOpen={() => onOpenImage?.(selectedRow, "plate", "ภาพป้ายทะเบียน", selectedRow.plateImage)} actionLabel="ดูภาพป้ายเต็ม" loading="eager" /></div><div><strong>ภาพรถ Overview</strong><VehicleReviewImage className="ops-vehicle-focus-image is-overview" src={selectedRow.overviewImage} alt={`ภาพรถ Overview ${selectedRow.id}`} emptyLabel="ไม่พบภาพรถ Overview จากต้นทาง" onImageLoad={markImageReady} onImageFailure={markImageFailed} onOpen={() => onOpenImage?.(selectedRow, "overview", "ภาพรถ Overview", selectedRow.overviewImage)} actionLabel="ดูภาพรถเต็ม" loading="eager" /></div></section>
          <dl className="ops-vehicle-eligibility-api-values"><div><dt>เลขทะเบียนจาก API</dt><dd>{selectedRow.plateNumber || "ไม่พบค่าจาก API"}</dd></div><div><dt>จังหวัดจาก API</dt><dd>{selectedRow.province || "ไม่พบค่าจาก API"}</dd></div><div><dt>รหัสรายการต้นทาง</dt><dd>{selectedRow.id}</dd></div></dl>
          </div>
        <aside className="ops-vehicle-eligibility-inspector ops-vehicle-focus-inspector" data-dock-panel="inspector" aria-label="ผลคัดความพร้อมข้อมูล"><h4>คัดภาพก่อนสร้างชุดคะแนน</h4>
          <p className="ops-vehicle-eligibility-guidance">เลือก “พร้อมคิดคะแนน” เมื่อภาพยืนยันทั้งเลขทะเบียนและจังหวัดได้ครบ แม้ API จะขาดหรืออ่านผิด · ถ้ายืนยันไม่ได้ ให้คัดออกเพื่อไม่ให้นับในคะแนน</p>
          {!readOnly && <div className="ops-vehicle-eligibility-actions"><label className="ops-field"><span>เหตุผลที่คัดออก</span><CustomSelect value={reason} onChange={event => setReason(event.target.value)}><option value="">เลือกเหตุผลเมื่อคัดออก</option>{VEHICLE_SAMPLE_ELIGIBILITY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</CustomSelect></label><label className="ops-field"><span>หมายเหตุเพิ่มเติม (ไม่บังคับ)</span><textarea rows="2" value={note} onChange={event => setNote(event.target.value)} placeholder="ระบุรายละเอียดประกอบการคัดเลือก" /></label><small role="status">{hasVisibleEvidence ? "เปิดภาพจากต้นทางได้แล้ว · โปรดตรวจให้เห็นทั้งเลขทะเบียนและจังหวัดก่อนเลือกพร้อมคิดคะแนน" : decisionImages.length ? "ต้องรอให้ภาพอย่างน้อยหนึ่งภาพเปิดได้ · หากทุกภาพเปิดไม่ได้ ให้คัดออกพร้อมเหตุผล" : "ไม่มีภาพจากต้นทาง · รายการนี้คัดออกจากคะแนน"}</small><div><button type="button" className="ops-button ops-button-primary" disabled={!hasVisibleEvidence} onClick={() => onDecide("eligible")}>พร้อมคิดคะแนน</button><button type="button" className="ops-button ops-button-secondary" disabled={!reason} onClick={() => onDecide("excluded")}>คัดออกและบันทึกเหตุผล</button></div></div>}
          <div className="ops-vehicle-eligibility-sample-controls">{sampleSettings}</div>
          {eligibility?.reviewedAt && <small className="ops-vehicle-eligibility-audit">ผู้บันทึก {eligibility.reviewedByName || "ไม่ระบุ"} · {formatDateTime(eligibility.reviewedAt)}{eligibility?.note ? ` · ${eligibility.note}` : ""}</small>}
        </aside>
        </main>}
    </div>;
  }

  function VehicleFocusReviewPanel({ round, value, readOnly, onChange, notify, currentUser = null, focusRowId, focusReviewKind, onFocusComplete, contextKey = "", onReviewStatusChange, evidenceItem = null, evidenceItemValue = null, onEvidenceChange, onEvidenceAttachmentChange, onEvidenceAttachmentRemove, scopeKey = "day", onScopeChange, allowLiveSearch = true, workbenchActions = null, serverSaveError = null, serverWritable = true, onRowReview, onEvidenceRowSaved }) {
    const vehicleSearchConfig = useMemo(() => getRoundVehicleSearchConfig(round), [round?.snapshot, round?.vehicleConnectionUpdates, round?.id]);
    const vehicleSearchBaseUrl = vehicleSearchConfig.baseUrl;
    const connectionReady = Boolean(vehicleSearchBaseUrl && (vehicleSearchConfig.apiProfile !== "imps-v2" || vehicleSearchConfig.searchUrl));
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
    const reviewDatasets = useMemo(() => prepareVehicleReviewDatasets(value, { startAt: `${round?.meta?.inspectionDate || ""}T06:00` }, { baseUrl: vehicleSearchBaseUrl, apiProfile: vehicleSearchConfig.apiProfile }), [value, round?.meta?.inspectionDate, vehicleSearchBaseUrl, vehicleSearchConfig.apiProfile]);
    const isScopedReview = context?.key === "plate" || Boolean(value?.independentContext);
    const isDayOnlyReview = context?.key === "classification";
    const fallbackCriteria = useMemo(() => ({
      startAt: round?.meta?.inspectionDate ? `${round.meta.inspectionDate}T00:00` : "",
      endAt: round?.meta?.inspectionDate ? `${round.meta.inspectionDate}T23:59` : "",
    }), [round?.id, round?.meta?.inspectionDate]);
    const inferredScopeKey = useMemo(() => {
      const initialValue = getVehicleReviewScopeState(reviewDatasets, "day", fallbackCriteria, { baseUrl: vehicleSearchBaseUrl, apiProfile: vehicleSearchConfig.apiProfile });
      const initialCriteria = normalizeVehicleSearchState(initialValue, fallbackCriteria, { baseUrl: vehicleSearchBaseUrl, apiProfile: vehicleSearchConfig.apiProfile }).criteria;
      return getVehicleReviewScopeForTimestamp(initialCriteria.startAt) || "day";
    }, [reviewDatasets, fallbackCriteria, vehicleSearchBaseUrl, vehicleSearchConfig.apiProfile]);
    const [activeScopeKey, setActiveScopeKey] = useState(() => isDayOnlyReview ? "day" : scopeKey === "night" || scopeKey === "day" ? scopeKey : inferredScopeKey);
    const scopeValue = useMemo(() => isScopedReview ? getVehicleReviewScopeState(reviewDatasets, isDayOnlyReview ? "day" : activeScopeKey, fallbackCriteria, { baseUrl: vehicleSearchBaseUrl, apiProfile: vehicleSearchConfig.apiProfile }) : getDaytimeVehicleClassificationDataset(value, fallbackCriteria, { baseUrl: vehicleSearchBaseUrl, apiProfile: vehicleSearchConfig.apiProfile }), [isScopedReview, reviewDatasets, isDayOnlyReview, activeScopeKey, fallbackCriteria, vehicleSearchBaseUrl, vehicleSearchConfig.apiProfile, value]);
    const criteriaValue = scopeValue;
    const [sampleLimit, setSampleLimit] = useState(() => scopeValue.sample?.limit ?? 100);
    const [criteria, setCriteria] = useState(() => normalizeVehicleSearchState(criteriaValue, fallbackCriteria, { baseUrl: vehicleSearchBaseUrl, apiProfile: vehicleSearchConfig.apiProfile }).criteria);
    const [loading, setLoading] = useState(false);
    const [decisionSnapshot, setDecisionSnapshot] = useState(null);
    const [error, setError] = useState("");
    const [selectedRowId, setSelectedRowId] = useState("");
    const [queueQuery, setQueueQuery] = useState("");
    const [queueStatusFilter, setQueueStatusFilter] = useState("all");
    const [queuePage, setQueuePage] = useState(0);
    const [sessionOpen, setSessionOpen] = useState(false);
    const [vehicleDetailsOpen, setVehicleDetailsOpen] = useState(true);
    const [unverifiedListOpen, setUnverifiedListOpen] = useState(false);
    useEffect(() => { if (!unverifiedListOpen) return; const previous = document.activeElement; const overflow = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = overflow; previous?.focus?.(); }; }, [unverifiedListOpen]);
    const [queueOpen, setQueueOpen] = useState(() => window.matchMedia("(min-width: 1280px)").matches);
    useEffect(() => {
      const media = window.matchMedia("(min-width: 1280px)");
      const update = () => setQueueOpen(media.matches);
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }, []);
    const [eligibilityReason, setEligibilityReason] = useState("");
    const [eligibilityNote, setEligibilityNote] = useState("");
    const [lightbox, setLightbox] = useState(null);
    const [responsivePanel, setResponsivePanel] = useState("evidence");
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const deleteBusyRef = useRef(false);
    const [bulkMode, setBulkMode] = useState(false);
    const [bulkIds, setBulkIds] = useState([]);
    const requestDelete = (rows) => { const targets = Array.isArray(rows) ? rows : [rows]; setDeleteTarget({ row: targets[0], rows: targets, scopeKey: activeScopeKey, baseline: JSON.stringify(getVehicleDeletionDataset(latestValueRef.current, context?.key, activeScopeKey, fallbackCriteria, { baseUrl: vehicleSearchBaseUrl, apiProfile: vehicleSearchConfig.apiProfile, searchUrl: vehicleSearchConfig.searchUrl, stationProfileId: round?.stationId || round?.snapshot?.stationId, systemKey: vehicleSearchConfig.systemKey, roundId: vehicleSearchConfig.roundId })) }); };
    const [replacementOpen, setReplacementOpen] = useState(false);
    const latestValueRef = useRef(value);
    latestValueRef.current = value;
    const latestRoundRef = useRef(round);
    latestRoundRef.current = round;
    const abortRef = useRef(null);
    const searchState = useMemo(() => normalizeVehicleSearchState(decisionSnapshot?.scopeKey === activeScopeKey ? decisionSnapshot.state : scopeValue, fallbackCriteria, { baseUrl: vehicleSearchBaseUrl, apiProfile: vehicleSearchConfig.apiProfile, searchUrl: vehicleSearchConfig.searchUrl, stationProfileId: round?.stationId || round?.snapshot?.stationId, systemKey: vehicleSearchConfig.systemKey, roundId: vehicleSearchConfig.roundId }), [decisionSnapshot, activeScopeKey, scopeValue, fallbackCriteria, vehicleSearchBaseUrl, vehicleSearchConfig.apiProfile, vehicleSearchConfig.searchUrl, round?.stationId, round?.snapshot?.stationId, vehicleSearchConfig.systemKey, vehicleSearchConfig.roundId]);
    useEffect(() => { setBulkIds([]); setBulkMode(false); }, [activeScopeKey, context?.key, round?.id, searchState.fetchedAt]);
    useEffect(() => { setBulkIds(ids => ids.filter(id => searchState.rows.some(row => row.id === id))); }, [searchState.rows]);
    const isEvidenceScore = isPlateContext && searchState.sampleEligibilityPolicyVersion === VEHICLE_SAMPLE_ELIGIBILITY_POLICY_VERSION;
    const sampleLocked = Boolean(searchState.sample?.lockedAt) || (!isScopedReview && Boolean(searchState.fetchedAt));
    const sampleReviewStarted = searchState.sample?.version === "vehicle-sample-v2" && Boolean(searchState.sample.lockedAt) && searchState.rows.some((row) => row.reviewStatus && row.reviewStatus !== "pending");
    const isPlateEligibilityTriage = isPlateContext && Boolean(searchState.fetchedAt) && searchState.sampleEligibilityPolicyVersion === VEHICLE_SAMPLE_ELIGIBILITY_POLICY_VERSION && !sampleLocked && (searchState.sourceRows || searchState.rows).length > 0;
    useEffect(() => { setSampleLimit(searchState.sample?.limit ?? 100); }, [activeScopeKey, searchState.fetchedAt, searchState.sample?.limit]);
    const eligibilitySummary = useMemo(() => getVehicleSampleEligibilitySummary(searchState.sourceRows || searchState.rows), [searchState]);
    const sampleSourceRows = searchState.sourceRows || searchState.rows;
    const criteriaDirty = Boolean(searchState.fetchedAt) && isVehicleCriteriaDirty(criteria, searchState.criteria);
    const summary = useMemo(() => getVehicleSearchReviewSummary(searchState, { reviewVersion, context: context?.key }), [searchState, reviewVersion, context?.key]);
    const outcome = useMemo(() => getVehicleReviewOutcome(searchState, { reviewVersion, context: context?.key }), [searchState, reviewVersion, context?.key]);
    const activeDimensionSummary = summary.dimensions?.[context?.key] || summary;
    const activeThreshold = VEHICLE_REVIEW_THRESHOLDS[context?.key];
    const isPendingRow = (row) => activeDimensions.some((dimension) => row?.[dimension.statusKey] === "pending");
    const orderedRows = useMemo(() => getVehicleReviewRows(searchState), [searchState]);
    const selectedRow = orderedRows.find((row) => row.id === selectedRowId) || orderedRows[0] || null;
    useLayoutEffect(() => {
      if (!selectedRow) return;
      const details = document.querySelector(`[data-vehicle-review-focus="${domSafeId(selectedRow.id)}"] .ops-vehicle-classification-details`);
      if (details) details.scrollTop = 0;
    }, [selectedRow?.id]);
    const decisionSelectionRef = useRef(null);
    decisionSelectionRef.current = { rowId: selectedRow?.id, scopeKey: activeScopeKey };
    const selectedRowIndex = selectedRow ? orderedRows.findIndex((row) => row.id === selectedRow.id) : -1;
    const prefetchedImages = useRef(new Map());
    useEffect(() => {
      // Warm only the adjacent vehicle, with a small bounded set of image references.
      // This does not decide eligibility or mark any evidence as ready.
      const nextRow = orderedRows[selectedRowIndex + 1];
      const sources = nextRow ? (isPlateContext
        ? [nextRow.lprImage, nextRow.plateImage, ...(isPlateEligibilityTriage ? [nextRow.overviewImage] : [])]
        : [nextRow.overviewImage]).filter(Boolean) : [];
      const cache = prefetchedImages.current;
      for (const source of sources) {
        if (cache.has(source)) continue;
        const image = new Image();
        image.decoding = "async";
        image.fetchPriority = "low";
        image.src = source;
        cache.set(source, image);
      }
      while (cache.size > 6) cache.delete(cache.keys().next().value);
    }, [orderedRows, selectedRowIndex, isPlateContext, isPlateEligibilityTriage]);
    const queuePageSize = 10;
    const queueListRef = useRef(null);
    const normalizedQueueQuery = queueQuery.trim().toLocaleLowerCase("th-TH");
    const matchesQueueQuery = (row) => !normalizedQueueQuery || [row.plateNumber, row.province, row.lane, row.vehicleClassLabel, row.occurredAt ? formatDateTime(row.occurredAt) : ""]
      .some((value) => String(value || "").toLocaleLowerCase("th-TH").includes(normalizedQueueQuery));
    const matchesQueueStatus = (row, statusFilter = queueStatusFilter) => statusFilter === "all" || (statusFilter === "pending" ? isPendingRow(row) : !isPendingRow(row));
    const queueRows = orderedRows.filter((row) => matchesQueueStatus(row) && matchesQueueQuery(row));
    const recordedProgress = getVehicleRecordedProgress(orderedRows, activeDimensions);
    const queueStatusCounts = {
      all: orderedRows.length,
      pending: orderedRows.filter(isPendingRow).length,
      reviewed: orderedRows.filter((row) => !isPendingRow(row)).length,
    };
    const queuePageCount = Math.max(1, Math.ceil(queueRows.length / queuePageSize));
    const visibleQueueRows = queueRows.slice(queuePage * queuePageSize, (queuePage + 1) * queuePageSize);
    // Restore the selected vehicle's page on load or scope change; manual paging stays independent.
    useLayoutEffect(() => {
      const index = queueRows.findIndex((row) => row.id === selectedRow?.id);
      if (index >= 0) setQueuePage(Math.floor(index / queuePageSize));
    }, [selectedRow?.id, activeScopeKey, searchState.fetchedAt, queueRows.length]);
    useLayoutEffect(() => {
      const list = queueListRef.current;
      const selected = list?.querySelector('[aria-current="true"]');
      if (!selected || !list || list.scrollHeight <= list.clientHeight) return;
      const viewport = list.getBoundingClientRect();
      const item = selected.closest('.ops-vehicle-queue-row-actions').getBoundingClientRect();
      // Move only this scroll area, never the page or evidence pane.
      if (item.top < viewport.top) list.scrollTop += item.top - viewport.top;
      else if (item.bottom > viewport.bottom) list.scrollTop += item.bottom - viewport.bottom;
    }, [selectedRow?.id, queuePage, queueQuery, queueStatusFilter]);
    const eligibilityQueueRows = orderedRows.filter(matchesQueueQuery);
    const eligibilityPageCount = Math.max(1, Math.ceil(eligibilityQueueRows.length / queuePageSize));
    const visibleEligibilityRows = eligibilityQueueRows.slice(queuePage * queuePageSize, (queuePage + 1) * queuePageSize);
    const queuePageNumbers = [...new Set([0, 1, 2, 3, 4, queuePage - 1, queuePage, queuePage + 1, queuePageCount - 1])]
      .filter((page) => page >= 0 && page < queuePageCount)
      .sort((left, right) => left - right);
    const reviewState = useMemo(() => getVehicleReviewState(searchState, { reviewVersion, context: context?.key }), [searchState, reviewVersion, context?.key]);
    const periodStates = useMemo(() => Object.fromEntries(VEHICLE_REVIEW_SCOPE_OPTIONS.map(period => {
      const state = getVehicleReviewScopeState(reviewDatasets, period.key);
      return [period.key, { state, counts: getVehicleSearchReviewSummary(decisionSnapshot?.scopeKey === period.key ? decisionSnapshot.state : state, { context: context?.key }) }];
    })), [reviewDatasets, decisionSnapshot, context?.key]);
    const reviewStatusLabel = getVehicleReviewStatusLabel(reviewState, summary, context?.key, outcome);
    const reviewStatusTone = getVehicleReviewStatusTone(reviewState, criteriaDirty, outcome);
    useEffect(() => {
      if (!isApiOnlyReview) return;
      onReviewStatusChange?.(searchState.fetchedAt
        ? { tone: reviewStatusTone, label: criteriaDirty ? "เปลี่ยนช่วงเวลาแล้ว · ต้องดึงข้อมูลใหม่" : reviewStatusLabel }
        : null);
    }, [criteriaDirty, isApiOnlyReview, onReviewStatusChange, reviewStatusLabel, reviewStatusTone, searchState.fetchedAt]);
    const changeQueueStatusFilter = (nextFilter) => {
      setQueueStatusFilter(nextFilter);
      setQueuePage(0);
      const nextQueueRows = orderedRows.filter((row) => matchesQueueStatus(row, nextFilter) && matchesQueueQuery(row));
      if (nextQueueRows.length && !nextQueueRows.some((row) => row.id === selectedRowId)) {
        setSelectedRowId(nextQueueRows[0].id);
      }
    };

    const commitSearchState = useCallback((nextState) => {
      if (isScopedReview) {
        return onChange?.(updateVehicleSearchScope(reviewDatasets, activeScopeKey, nextState, { baseUrl: vehicleSearchBaseUrl, apiProfile: vehicleSearchConfig.apiProfile }));
      }
      const preservedNightRows = getVehicleClassificationDataset(value).rows.filter(row => getVehicleReviewScopeForTimestamp(row.occurredAt) === "night");
      const withHistory = { ...nextState, rows: [...nextState.rows, ...preservedNightRows.filter(row => !nextState.rows.some(next => next.id === row.id))] };
      return onChange?.(isVehicleReviewScopeState(value) ? { ...reviewDatasets, classification: withHistory } : withHistory);
    }, [activeScopeKey, isScopedReview, onChange, value, reviewDatasets, vehicleSearchBaseUrl, vehicleSearchConfig.apiProfile]);

    useEffect(() => {
      const nextScopeKey = isDayOnlyReview ? "day" : scopeKey === "night" || scopeKey === "day"
        ? scopeKey
        : (() => {
          const dayState = getVehicleReviewScopeState(reviewDatasets, "day", fallbackCriteria, { baseUrl: vehicleSearchBaseUrl, apiProfile: vehicleSearchConfig.apiProfile });
          const dayCriteria = normalizeVehicleSearchState(dayState, fallbackCriteria, { baseUrl: vehicleSearchBaseUrl, apiProfile: vehicleSearchConfig.apiProfile }).criteria;
          return getVehicleReviewScopeForTimestamp(dayCriteria.startAt) || "day";
        })();
      setActiveScopeKey(nextScopeKey);
      const targetValue = isScopedReview
        ? getVehicleReviewScopeState(reviewDatasets, nextScopeKey, fallbackCriteria, { baseUrl: vehicleSearchBaseUrl, apiProfile: vehicleSearchConfig.apiProfile })
        : scopeValue;
      const dayValue = isScopedReview
        ? getVehicleReviewScopeState(reviewDatasets, "day", fallbackCriteria, { baseUrl: vehicleSearchBaseUrl, apiProfile: vehicleSearchConfig.apiProfile })
        : value;
      const nextValue = targetValue;
      setCriteria(normalizeVehicleSearchState(nextValue, fallbackCriteria, { baseUrl: vehicleSearchBaseUrl, apiProfile: vehicleSearchConfig.apiProfile }).criteria);
      setError("");
    }, [round?.id, scopeKey]);

    useEffect(() => {
      setCriteria(normalizeVehicleSearchState(criteriaValue, fallbackCriteria, { baseUrl: vehicleSearchBaseUrl, apiProfile: vehicleSearchConfig.apiProfile }).criteria);
      setError("");
    // Projected/normalized datasets can be new objects on a status-only render.
    // Only an actual change to the stored range or dataset should reset edits.
    }, [round?.id, vehicleSearchBaseUrl, vehicleSearchConfig.apiProfile, context?.key, scopeKey, activeScopeKey, criteriaValue.criteria?.startAt, criteriaValue.criteria?.endAt, criteriaValue.fetchedAt]);

    useEffect(() => {
      setResponsivePanel("evidence");
    }, [context?.key]);

    useEffect(() => {
      setQueuePage((current) => Math.min(current, (isPlateEligibilityTriage ? eligibilityPageCount : queuePageCount) - 1));
    }, [queuePageCount, eligibilityPageCount, isPlateEligibilityTriage]);

    useEffect(() => {
      const eligibility = selectedRow?.sampleEligibility;
      setEligibilityReason(eligibility?.reasonCode || "");
      setEligibilityNote(eligibility?.note || "");
    }, [selectedRow?.id, selectedRow?.sampleEligibility?.status, selectedRow?.sampleEligibility?.reasonCode, selectedRow?.sampleEligibility?.note]);

    useEffect(() => {
      if (!orderedRows.length) {
        setSelectedRowId("");
        return;
      }
      if (!orderedRows.some((row) => row.id === selectedRowId)) {
        setSelectedRowId(getNextPendingVehicleId(searchState, { context: context?.key, includeUnableToVerify: false }) || orderedRows[0].id);
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
    const confirmDelete = async () => {
      if (!deleteTarget || deleteBusyRef.current) return;
      deleteBusyRef.current = true; setDeleting(true); setError("");
      try {
        if (readOnly || latestRoundRef.current?.status === "closed") throw new Error("รอบที่ปิดแล้วไม่สามารถลบรายการได้");
        const options = { baseUrl: vehicleSearchBaseUrl, apiProfile: vehicleSearchConfig.apiProfile, searchUrl: vehicleSearchConfig.searchUrl, stationProfileId: round?.stationId || round?.snapshot?.stationId, systemKey: vehicleSearchConfig.systemKey, roundId: vehicleSearchConfig.roundId };
        const current = getVehicleDeletionDataset(latestValueRef.current, context?.key, deleteTarget.scopeKey, fallbackCriteria, options);
        if (JSON.stringify(current) !== deleteTarget.baseline) throw new Error("ชุดตรวจเปลี่ยนระหว่างยืนยัน กรุณาปิดหน้าต่างแล้วลองใหม่");
        const nextValue = deleteVehicleReviewRows(latestValueRef.current, context?.key, deleteTarget.scopeKey, deleteTarget.rows.map(row => row.id), fallbackCriteria, options, { readOnly, roundStatus: latestRoundRef.current?.status });
        setDecisionSnapshot({ scopeKey: deleteTarget.scopeKey, state: current });
        await persistVehicleReviewChange(onChange, nextValue);
        const deletedRowIds = new Set(deleteTarget.rows.map(row => row.id));
        if (deletedRowIds.has(selectedRow?.id)) {
          const selectedIndex = Math.max(0, orderedRows.findIndex(row => row.id === selectedRow.id));
          const remainingRows = [
            ...orderedRows.slice(selectedIndex + 1),
            ...orderedRows.slice(0, selectedIndex + 1),
          ].filter(row => !deletedRowIds.has(row.id));
          const nextRow = remainingRows.find(isPendingRow) || remainingRows[0] || null;

          if (nextRow) {
            const nextIsPending = isPendingRow(nextRow);
            if (nextIsPending && queueStatusFilter === "reviewed") setQueueStatusFilter("pending");
            else if (!nextIsPending && queueStatusFilter === "pending") setQueueStatusFilter("all");
            if (!matchesQueueQuery(nextRow)) setQueueQuery("");
          }
          setSelectedRowId(nextRow?.id || "");
        }
        for (const row of deleteTarget.rows) for (const dimension of activeDimensions) vehicleDecisionDrafts.delete(`${round?.id}:${row.id}:${dimension.key}`);
        setBulkIds([]); setBulkMode(false);
        setDecisionSnapshot(null); setDeleteTarget(null);
        notify?.("ลบรายการจากชุดตรวจแล้ว · คะแนนคำนวณใหม่ตามรายการที่เหลือ");
      } catch (failure) { setError(failure.message || "ลบไม่สำเร็จ รายการเดิมยังอยู่"); }
      finally { setDecisionSnapshot(null); deleteBusyRef.current = false; setDeleting(false); }
    };

    const replaceTest = async ({ criteria: nextCriteria, limit }) => {
      if (readOnly || round?.status === "closed") throw new Error("รอบที่ปิดแล้วไม่สามารถเปลี่ยนชุดทดสอบได้");
      if (!allowLiveSearch) throw new Error("หน้าตัวอย่างใช้ข้อมูลจำลอง กรุณาเปลี่ยนชุดในรอบตรวจจริง");
      if (!vehicleSearchBaseUrl) throw new Error("สถานีนี้ยังไม่ได้ตั้งค่า Vehicle API");
      const stationProfileId = round?.stationId || round?.snapshot?.stationId;
      if (!stationProfileId) throw new Error("ไม่พบรหัสสถานีของรอบตรวจ");
      const request = { context: isScopedReview && context?.key === "classification" ? "plate" : context?.key, scopeKey: activeScopeKey, criteria: nextCriteria, limit: isEvidenceScore ? 100 : limit, roundStatus: round?.status };
      if (isDayOnlyReview) validateVehicleTestReplacement({ ...request, context: "plate", scopeKey: "day" });
      const normalizedCriteria = validateVehicleTestReplacement(request);
      const currentTarget = JSON.stringify(searchState);
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      try {
        const result = await searchVehicles(normalizedCriteria, { signal: controller.signal, baseUrl: vehicleSearchBaseUrl, searchUrl: vehicleSearchConfig.searchUrl, apiProfile: vehicleSearchConfig.apiProfile, expectedStationId: vehicleSearchConfig.stationId, expectedStationName: vehicleSearchConfig.stationName, stationProfileId, systemKey: vehicleSearchConfig.systemKey, roundId: vehicleSearchConfig.roundId, transport: vehicleSearchConfig.apiProfile === "imps-v2" ? "proxy" : "direct-first" });
        if (controller.signal.aborted) throw new Error("ยกเลิกการดึงข้อมูล ชุดเดิมยังอยู่");
        if (latestRoundRef.current?.status === "closed") throw new Error("รอบนี้ปิดแล้ว จึงยังไม่เปลี่ยนชุดทดสอบ");
        const options = { baseUrl: vehicleSearchBaseUrl, apiProfile: vehicleSearchConfig.apiProfile, searchUrl: vehicleSearchConfig.searchUrl, stationProfileId, systemKey: vehicleSearchConfig.systemKey, roundId: vehicleSearchConfig.roundId };
        const latestTarget = isScopedReview ? getVehicleReviewScopeState(latestValueRef.current, activeScopeKey, fallbackCriteria, options) : getVehicleClassificationDataset(latestValueRef.current, fallbackCriteria, options);
        if (JSON.stringify(normalizeVehicleSearchState(latestTarget, fallbackCriteria, options)) !== currentTarget) throw new Error("ชุดเดิมเปลี่ยนระหว่างดึงข้อมูล กรุณาตรวจข้อมูลแล้วเริ่มเปลี่ยนชุดอีกครั้ง");
        const nextValue = replaceVehicleTestDataset(latestValueRef.current, result, request, options);
        await persistVehicleReviewChange(onChange, nextValue);
        setCriteria(normalizedCriteria);
        setSampleLimit(limit);
        setSelectedRowId(""); setQueuePage(0); setQueueQuery(""); setQueueStatusFilter("all");
        setError("");
        notify?.(`เปลี่ยนชุดทดสอบ${isScopedReview ? activeScopeKey === "day" ? "ทะเบียนกลางวัน" : "ทะเบียนกลางคืน" : "คัดแยกประเภท"}แล้ว · เริ่มตรวจชุดใหม่`);
      } finally {
        if (abortRef.current === controller) { abortRef.current = null; setLoading(false); }
      }
    };
    const handleSearch = async () => {
      if (!connectionReady) { setError("ยังไม่ได้ตั้งค่าการเชื่อมต่อ"); return; }
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
        if (isDayOnlyReview) validateVehicleTestReplacement({ context: "plate", scopeKey: "day", criteria, limit: sampleLimit });
        const result = await searchVehicles(criteria, { signal: controller.signal, baseUrl: vehicleSearchBaseUrl, searchUrl: vehicleSearchConfig.searchUrl, apiProfile: vehicleSearchConfig.apiProfile, expectedStationId: vehicleSearchConfig.stationId, expectedStationName: vehicleSearchConfig.stationName, stationProfileId, systemKey: vehicleSearchConfig.systemKey, roundId: vehicleSearchConfig.roundId, transport: vehicleSearchConfig.apiProfile === "imps-v2" ? "proxy" : "direct-first" });
        const matchingRows = filterVehicleSearchRowsByTimeRange(result.rows, criteria).filter(row => !isDayOnlyReview || getVehicleReviewScopeForTimestamp(row.occurredAt) !== "night");
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
        const scopesToSave = isDayOnlyReview ? ["day"] : getVehicleSearchScopesForCriteria(criteria);
        let nextVehicleSearch = value?.independentContext ? reviewDatasets : { ...reviewDatasets, classification: getVehicleClassificationDataset(reviewDatasets, fallbackCriteria, { baseUrl: vehicleSearchBaseUrl, apiProfile: vehicleSearchConfig.apiProfile }) };
        for (const scopeKeyToSave of scopesToSave) {
          const scopeRows = rowsByScope[scopeKeyToSave];
          const sourceDataset = {
            ...result,
            criteria,
            rows: scopeRows,
            sourceRows: scopeRows,
            pagination: { ...result.pagination, totalItems: scopeRows.length },
            scopeKey: scopeKeyToSave,
            emptyResultAcknowledgedAt: null,
          };
          const nextScope = selectVehicleTestSample(sourceDataset, { limit: sampleLimit });
          nextVehicleSearch = updateVehicleSearchScope(nextVehicleSearch, scopeKeyToSave, nextScope, { baseUrl: vehicleSearchBaseUrl, apiProfile: vehicleSearchConfig.apiProfile });
        }
        onChange?.(nextVehicleSearch);
        const otherScopeKey = activeScopeKey === "day" ? "night" : "day";
        if (!isDayOnlyReview && !rowsByScope[activeScopeKey].length && rowsByScope[otherScopeKey].length) setActiveScopeKey(otherScopeKey);
        notify?.(matchingRows.length
          ? isDayOnlyReview ? `ดึงข้อมูลคัดแยกประเภทรถกลางวัน ${rowsByScope.day.length} คัน` : `ดึงข้อมูลตามช่วงที่เลือก ${matchingRows.length} คัน · กลางวัน ${rowsByScope.day.length} · กลางคืน ${rowsByScope.night.length} คัน`
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
      setDecisionSnapshot(null);
      setSelectedRowId(row.id);
      if (!window.matchMedia("(min-width: 1280px)").matches) setQueueOpen(false);
      const targetQueueIndex = queueRows.findIndex((queueRow) => queueRow.id === row.id);
      if (targetQueueIndex >= 0) {
        setQueuePage(Math.floor(targetQueueIndex / queuePageSize));
      } else {
        setQueueQuery("");
        setQueuePage(Math.floor(Math.max(0, orderedRows.findIndex((entry) => entry.id === row.id)) / queuePageSize));
      }
    };
    const navigateRow = (direction) => selectRow(orderedRows[selectedRowIndex + (direction === "previous" ? -1 : 1)]);
        const goToUnverified = (row, dimension) => {
      setUnverifiedListOpen(false);
      setQueueStatusFilter("all");
      setQueueQuery("");
      selectRow(row);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const panel = document.querySelector('[data-vehicle-review-focus="' + domSafeId(row.id) + '"] [data-vehicle-review-kind="' + dimension.key + '"]');
        panel?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        panel?.focus({ preventScroll: true });
      }));
    };
const goToPending = () => selectRow(orderedRows.find((row) => row.id === getNextPendingVehicleId(searchState, { rowId: selectedRow?.id, context: context?.key, includeUnableToVerify: false })));
    const review = async (rowId, dimension, reviewStatus, detailPatch = {}) => {
      const expectedRow = searchState.rows.find(row => row.id === rowId);
      const nextState = onRowReview
        ? { ...searchState, rows: searchState.rows.map(row => row.id === rowId ? updateVehicleReviewRow(row, dimension, reviewStatus, detailPatch) : row) }
        : updateVehicleSearchDimensionReview(searchState, rowId, dimension, reviewStatus, detailPatch);
      setDecisionSnapshot({ scopeKey: activeScopeKey, state: searchState });
      let persisted;
      try { persisted = await (onRowReview
        ? onRowReview({ rowId, dimension, scopeKey: activeScopeKey, reviewStatus, detailPatch, expectedRow,
          expectedScope: { fetchedAt: searchState.fetchedAt, criteria: searchState.criteria, sample: searchState.sample } })
        : commitSearchState(nextState)); } catch { persisted = null; }
      const persistence = getVehiclePersistenceResult(persisted);
      if (!persistence.success) return persisted;
      setDecisionSnapshot(null);
      // Advance only after every decision for this vehicle has been recorded.
      const reviewedRow = nextState.rows.find((row) => row.id === rowId);
      const stillSelected = decisionSelectionRef.current?.rowId === rowId && decisionSelectionRef.current?.scopeKey === activeScopeKey;
      const latestDataset = isScopedReview ? getVehicleReviewScopeState(latestValueRef.current,activeScopeKey) : getDaytimeVehicleClassificationDataset(latestValueRef.current);
      const advanceToNext = reviewStatus === "correct" && stillSelected && latestDataset.fetchedAt === searchState.fetchedAt && reviewedRow && activeDimensions.every((entry) => reviewedRow[entry.statusKey] !== "pending");
      const nextRow = advanceToNext ? getVehicleReviewNavigation(nextState, { rowId, direction: "next" }) : null;
      if (advanceToNext) {
        selectRow(nextRow);
      }
      try { void Promise.resolve(onEvidenceRowSaved?.({ rowId, context: dimension, scopeKey: activeScopeKey, deferUntilNextImages: Boolean(advanceToNext), nextRowId: nextRow?.id || "" })).catch(() => {}); } catch { /* Evidence archival must not change the saved decision result. */ }
      return persisted;
    };
    const decideEligibility = async (status) => {
      if (readOnly || !selectedRow) return;
      try {
        const nextState = updateVehicleSampleEligibility(searchState, selectedRow.id, status, {
          reasonCode: status === "excluded" ? eligibilityReason : null,
          note: eligibilityNote,
          reviewer: currentUser,
        });
        setDecisionSnapshot({ scopeKey: activeScopeKey, state: searchState });
        let persisted;
        try { persisted = await commitSearchState(nextState); } catch { persisted = null; }
        const persistence = getVehiclePersistenceResult(persisted);
        if (!persistence.success) {
          setError("บันทึกผลคัดข้อมูลไม่สำเร็จ · คงข้อมูลที่เลือกไว้ กรุณาลองอีกครั้ง");
          return;
        }
        setDecisionSnapshot(null);
        setError("");
        try { void Promise.resolve(onEvidenceRowSaved?.({ rowId: selectedRow.id, context: "plate", scopeKey: activeScopeKey })).catch(() => {}); } catch { /* Evidence archival must not change the saved eligibility result. */ }
        const nextRow = nextState.sourceRows.find((row) => row.sampleEligibility?.status === "pending");
        if (nextRow) selectRow(nextRow);
      } catch (eligibilityError) {
        setError(eligibilityError?.message || "บันทึกผลคัดข้อมูลไม่สำเร็จ");
      }
    };
    const acknowledgeEmptyResult = () => {
      if (!isScopedReview || searchState.rows.length || !searchState.fetchedAt) return;
      commitSearchState(setVehicleSearchEmptyResultAcknowledged(searchState, true));
      notify?.(`ยืนยันแล้วว่าไม่พบรถช่วง${VEHICLE_REVIEW_SCOPE_OPTIONS.find((scope) => scope.key === activeScopeKey)?.label || "เวลานี้"}`);
    };
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
      ? "ตรวจประเภทรถและจำนวนเพลาเทียบกับภาพรถจาก API"
      : context?.key === "plate"
        ? "ตรวจเลขทะเบียนเทียบกับภาพป้ายทะเบียนจาก API"
        : "เลือกช่วงเวลา ดึงรถทุกคัน แล้วตรวจผลจาก API แยกตามบริบท";

    const sampleSettings = ((isScopedReview || searchState.fetchedAt) && <div className="ops-vehicle-sample-settings" role="group" aria-label={isScopedReview ? "การเลือกชุดทดสอบป้ายทะเบียน" : "การเลือกชุดทดสอบคัดแยกประเภทรถ"}>
        <div className="ops-vehicle-source"><strong>{round?.snapshot?.stationCode || "สถานีในรอบ"}</strong><span>{vehicleSearchConfig.stationName || "ตรวจสถานีจาก API ก่อนใช้ข้อมูล"}</span></div>
        {sampleLocked ? <span role="status"><strong>ชุดทดสอบล็อกแล้ว · {searchState.rows.length} คัน</strong> จากข้อมูลต้นทาง {searchState.sample?.sourceCount || searchState.rows.length} คัน · {searchState.sample?.method === "manually-adjusted" ? "ชุดปรับแก้ด้วยการลบรายการ" : searchState.sample?.method === "all" || !searchState.sample ? "ใช้ทุกคัน" : "สุ่มกระจายตลอดช่วงเวลา"}</span> : <>
          {isEvidenceScore && searchState.fetchedAt && <div className="ops-vehicle-eligibility-counts" role="status"><strong>ข้อมูลต้นทาง {eligibilitySummary.total} คัน</strong><span>พร้อมคิดคะแนน {eligibilitySummary.eligible} คัน</span><span>คัดออก {eligibilitySummary.excluded} คัน</span><span>ยังไม่คัด {eligibilitySummary.pending} คัน</span></div>}
          <label>จำนวนรถในชุดทดสอบ <CustomSelect aria-label="จำนวนรถในชุดทดสอบ" value={isEvidenceScore ? 100 : sampleLimit} disabled={readOnly || loading || isEvidenceScore} onChange={event => setSampleLimit(Number(event.target.value))}><option value={100}>{isEvidenceScore ? "เป้าหมาย 100 คัน (ใช้เท่าที่มี)" : "สุ่มกระจาย 100 คัน"}</option>{!isEvidenceScore && <option value={0}>ใช้รถทุกคัน</option>}</CustomSelect></label>
          <small>{isEvidenceScore ? "คัดภาพทุกรายการก่อนล็อก · รถที่คัดออกจะแยกจากคะแนน · หากพร้อมคิดคะแนนไม่ถึง 100 คัน ผลจะเป็นข้อมูลไม่พอทดสอบ" : "รวมรถที่อ่านผิดและอ่านไม่ได้ · ล็อกชุดก่อนเริ่มตรวจ · หากมีไม่ถึง 100 ใช้ครบทุกคัน"}</small>
          {!readOnly && sampleSourceRows.length > 0 && <button type="button" className="ops-button ops-button-secondary" disabled={loading || (isEvidenceScore && eligibilitySummary.pending > 0) || (!isEvidenceScore && sampleLimit > 0 && searchState.rows.length > sampleLimit && searchState.rows.some(row => row.reviewStatus !== "pending"))} onClick={() => { try { const sampled = selectVehicleTestSample(searchState, { limit: isEvidenceScore ? 100 : sampleLimit, requireEligibility: isEvidenceScore }); const withClassification = value?.independentContext ? reviewDatasets : { ...reviewDatasets, classification: getVehicleClassificationDataset(reviewDatasets, fallbackCriteria) }; onChange?.(updateVehicleSearchScope(withClassification, activeScopeKey, sampled, { baseUrl: vehicleSearchBaseUrl, apiProfile: vehicleSearchConfig.apiProfile })); setSelectedRowId(""); setQueuePage(0); notify?.(`ล็อกชุดทดสอบ ${sampled.rows.length} คัน จากข้อมูลต้นทาง ${sampled.sample?.sourceCount || sampled.rows.length} คันแล้ว`); } catch (error) { setError(error.message); } }}>{isEvidenceScore ? "ล็อกชุดคะแนนจากข้อมูลที่พร้อม" : "เลือกและล็อกชุดทดสอบ"}</button>}
        </>}
      {searchState.fetchedAt && !readOnly && <button type="button" className="ops-button ops-button-secondary ops-vehicle-replace-test-button" disabled={loading || (isPlateContext && sampleReviewStarted)} title={isPlateContext && sampleReviewStarted ? "เริ่มตรวจชุดคะแนนแล้ว · ห้ามเปลี่ยนรายการ" : undefined} onClick={() => setReplacementOpen(true)}>{isPlateContext && sampleReviewStarted ? "เริ่มตรวจแล้ว · เปลี่ยนชุดไม่ได้" : "เปลี่ยนชุดทดสอบ"}</button>}</div>);
    return <section className={`ops-vehicle-focus-panel is-context-${context?.key || "all"}`} data-vehicle-search-panel data-photo-review="true" data-vehicle-evidence-mode={isApiOnlyReview ? "api" : "attachment"} data-vehicle-scope={isScopedReview ? activeScopeKey : "all"} data-responsive-panel={responsivePanel} aria-labelledby={`vehicle-focus-title-${context?.key || "all"}`}>
      {deleteTarget && <VehicleRowDeleteDialog row={deleteTarget.row} rows={deleteTarget.rows} pendingCount={deleteTarget.rows.filter(isPendingRow).length} busy={deleting} writable={serverWritable} error={error} onConfirm={confirmDelete} onClose={() => setDeleteTarget(null)} /> }
      {replacementOpen && <VehicleTestReplacementDialog targetLabel={isScopedReview ? `${isPlateContext ? "ทะเบียน" : "คัดแยกประเภท"}${activeScopeKey === "day" ? "กลางวัน" : "กลางคืน"}` : "คัดแยกประเภทรถ"} oldCriteria={searchState.criteria} oldCount={searchState.sample?.sourceCount ?? searchState.rows.length} oldDecided={queueStatusCounts.reviewed} initialLimit={searchState.sample?.limit ?? 0} fixedLimit={isEvidenceScore} onReplace={replaceTest} onClose={() => setReplacementOpen(false)} DateTimePicker={ThaiDateTimePicker} serverSaveError={serverSaveError} serverWritable={serverWritable} />}
      <div className="ops-vehicle-focus-heading"><div><p className="ops-eyebrow">{context?.checklistNumber || "VEHICLE API"}</p><h3 id={`vehicle-focus-title-${context?.key || "all"}`}>{panelTitle}</h3><span>{panelDescription}</span></div>{searchState.fetchedAt && <StatusBadge status={reviewStatusTone}>{criteriaDirty ? "เปลี่ยนช่วงเวลาแล้ว · ต้องดึงข้อมูลใหม่" : reviewStatusLabel}</StatusBadge>}</div>
      {!connectionReady && <div className="ops-vehicle-search-config-warning" role="status"><Icon name="alert" size="small" /><span>{readOnly ? "รอบนี้ไม่ได้บันทึกการเชื่อมต่อข้อมูลรถไว้ การแก้ทะเบียนสถานีจะไม่เปลี่ยนประวัตินี้" : "ยังไม่ได้ตั้งค่าการเชื่อมต่อข้อมูลรถประจำสถานี · ไปตั้งค่าที่ทะเบียนสถานี"}</span></div>}
      {!allowLiveSearch && <div className="ops-vehicle-demo-search-note" role="status"><Icon name="info" size="small" /><span>หน้านี้ใช้ข้อมูลจำลองและไม่เชื่อมต่อ Vehicle API จริง · เปิดรอบตรวจจากรายการรอบเพื่อดึงข้อมูลสถานี</span></div>}
      {workbenchActions && <div className="ops-vehicle-workbench-toolbar">{typeof workbenchActions === "function" ? workbenchActions(<button type="button" className="ops-button ops-button-secondary" aria-expanded={sessionOpen} aria-controls="vehicle-photo-session-details" onClick={() => setSessionOpen(open => !open)}>รายละเอียดชุดทดสอบ</button>) : workbenchActions}</div>}
      <div className="ops-vehicle-compact-session">
      {isScopedReview && <VehiclePeriodTabs context={context?.key}>{VEHICLE_REVIEW_SCOPE_OPTIONS.filter(period => !isDayOnlyReview || period.key === "day").map(period => {
        const { state, counts } = periodStates[period.key];
        return <button type="button" key={period.key} className={`ops-button ${activeScopeKey === period.key ? "ops-button-primary" : "ops-button-secondary"}`} aria-pressed={activeScopeKey === period.key} disabled={loading} onClick={() => { onScopeChange?.(period.key); setActiveScopeKey(period.key); setSelectedRowId(""); setQueuePage(0); setError(""); setCriteria(state.criteria); }}><strong>{period.label} · {period.timeLabel}</strong><span>{state.fetchedAt ? `${counts.total} คัน · บันทึกแล้ว ${counts.decided} · ค้าง ${counts.pending}` : "ยังไม่ได้ดึงข้อมูล"}</span></button>;
      })}</VehiclePeriodTabs>}

      {searchState.fetchedAt && <div className="ops-vehicle-photo-session-summary"><div><strong>{round?.snapshot?.stationCode || "สถานีในรอบ"} · {isPlateContext ? "ชุดป้ายทะเบียน" + (activeScopeKey === "night" ? "กลางคืน" : "กลางวัน") : "ชุดคัดแยกกลางวัน"}</strong><span>{formatThaiDateTimeInput(searchState.criteria.startAt)} ถึง {formatThaiDateTimeInput(searchState.criteria.endAt)} · {searchState.rows.length} คัน</span></div></div>}
      </div>
      <div id="vehicle-photo-session-details" className="ops-vehicle-test-controls" data-session-open={!searchState.fetchedAt || sessionOpen}>
      <div className="ops-vehicle-focus-criteria">
        <label className="ops-field"><span>วันและเวลาเริ่ม <em>(เวลาไทย · จำเป็น)</em></span><ThaiDateTimePicker value={criteria.startAt} label="วันและเวลาเริ่ม" disabled={readOnly || loading || sampleLocked} onChange={(nextValue) => updateCriteria("startAt", nextValue)} /></label>
        <label className="ops-field"><span>วันและเวลาสิ้นสุด <em>(เวลาไทย · จำเป็น)</em></span><ThaiDateTimePicker value={criteria.endAt} label="วันและเวลาสิ้นสุด" disabled={readOnly || loading || sampleLocked} onChange={(nextValue) => updateCriteria("endAt", nextValue)} /></label>

        {!isScopedReview && !searchState.fetchedAt && <div className="ops-vehicle-source"><strong>{round?.snapshot?.stationCode || "สถานีในรอบ"}</strong><span>{vehicleSearchConfig.stationName || "ตรวจสถานีจาก API ก่อนใช้ข้อมูล"}</span></div>}
        {!readOnly && !sampleLocked && !isPlateEligibilityTriage && <button type="button" className="ops-button ops-button-primary" onClick={handleSearch} disabled={loading || sampleLocked || !connectionReady || !allowLiveSearch}>{loading ? "กำลังดึงข้อมูล..." : sampleLocked ? "ชุดทดสอบล็อกแล้ว" : "ดึงข้อมูลรถจาก API"}</button>}
      </div>
      {isPlateEligibilityTriage ? <div className="ops-vehicle-sample-settings"><div className="ops-vehicle-source"><strong>{round?.snapshot?.stationCode || "สถานีในรอบ"}</strong><span>{vehicleSearchConfig.stationName}</span></div><span>ข้อมูลต้นทาง {eligibilitySummary.total} คัน · พร้อม {eligibilitySummary.eligible} · คัดออก {eligibilitySummary.excluded} · ยังไม่คัด {eligibilitySummary.pending}</span>{!readOnly && <button type="button" className="ops-button ops-button-secondary ops-vehicle-replace-test-button" disabled={loading} onClick={() => setReplacementOpen(true)}>เปลี่ยนชุดทดสอบ</button>}</div> : sampleSettings}
      <div className="ops-vehicle-score-details"><p>{activeThreshold ? `เกณฑ์ ≥ ${activeThreshold}%` : "คำนวณจากผลตรวจแล้ว"} · ถูก {activeDimensionSummary.correct} / ทั้งหมด {summary.total} คัน{recordedProgress.remainingRows > 0 ? " · ยังตรวจไม่ครบ" : ""}</p><p>{outcome.sampleQualified ? "ครบเงื่อนไขจำนวนข้อมูล" : outcome.dataSufficient === false ? "ข้อมูลไม่พอทดสอบ · ห้ามสรุปว่าผ่าน" : outcome.sampleLocked === false ? "ต้องคัดข้อมูลต้นทางและล็อกชุดคะแนนก่อน" : "ต้องครบ 6 ชม. หรือ 100 คัน"}</p></div>
        {searchState.fetchedAt && !criteriaDirty && <details className="ops-vehicle-search-provenance"><summary>ข้อมูลต้นทาง API</summary>{context?.key === "classification" ? <><span>สถานี API {searchState.sourceStation?.id || vehicleSearchConfig.stationId || "—"} · {searchState.sourceStation?.name || vehicleSearchConfig.stationName || "—"}</span><span>ข้อมูลรถ {searchState.pagination.totalItems || summary.total} คัน</span></> : <><span>ช่วงเวลา {formatThaiDateTimeInput(searchState.criteria.startAt) || "ยังไม่ระบุ"} ถึง {formatThaiDateTimeInput(searchState.criteria.endAt) || "ยังไม่ระบุ"}</span><span>สถานีตอบกลับ {searchState.sourceStation?.id || vehicleSearchConfig.stationId || "—"} · {searchState.sourceStation?.name || vehicleSearchConfig.stationName || "—"}</span><span>{searchState.pagination.totalPages || 0} หน้า · {searchState.pagination.totalItems || 0} คัน</span></>}</details>}
      </div>
      {error && <div className="ops-vehicle-search-error" role="alert"><Icon name="alert" size="small" /><span>{error}</span></div>}
      {criteriaDirty && searchState.fetchedAt && <div className="ops-vehicle-search-stale" role="status"><Icon name="refresh" size="small" /><span>ช่วงเวลาที่เลือกไม่ตรงกับผล API ชุดล่าสุด ({formatDateTime(searchState.fetchedAt)}) ระบบพักผลเดิมไว้จนกว่าจะกด “ดึงข้อมูลรถจาก API” ใหม่</span></div>}
      {!criteriaDirty && <div className="ops-vehicle-search-metrics" aria-label="สรุปผลตรวจข้อมูลรถจาก API">
        <div className="ops-vehicle-progress-metric">
          <span>บันทึกแล้ว</span>
          <strong>{recordedProgress.recordedRows}/{summary.total}</strong>
          <small>ค้าง {recordedProgress.remainingRows} คัน</small>
          <div className="ops-vehicle-progress-track" role="progressbar" aria-label="ความคืบหน้าการตรวจ" aria-valuemin="0" aria-valuemax="100" aria-valuenow={summary.total ? Math.round((recordedProgress.recordedRows / summary.total) * 100) : 0}>
            <span style={{ width: `${summary.total ? Math.min(100, Math.round((recordedProgress.recordedRows / summary.total) * 100)) : 0}%` }} />
          </div>

        </div>
        <div className="ops-vehicle-search-result-metric">
          <span>ผลตรวจ</span>
          <strong><em className="is-correct">ถูก {summary.correct}</em><i>·</i><em className="is-incorrect">ผิด {summary.incorrect}</em></strong>
          {summary.unableToVerifyChecks > 0 && <button type="button" className="ops-button ops-button-secondary ops-vehicle-unverified-summary-action" onClick={() => setUnverifiedListOpen(true)}>ตรวจยืนยันไม่ได้ ({summary.unableToVerifyChecks})</button>}
        </div>
        <div className="ops-vehicle-search-accuracy-metric">
          <span>{recordedProgress.remainingRows > 0 ? "ความถูกต้องชั่วคราว" : "ความถูกต้อง"}</span>
          <strong>{activeDimensionSummary.accuracy === null ? "—" : `${isEvidenceScore ? (activeDimensionSummary.accuracyExact ?? 0).toFixed(2) : Number((activeDimensionSummary.accuracyExact ?? activeDimensionSummary.accuracy).toFixed(2))}%`}</strong>
          <small>{activeThreshold ? `เกณฑ์ ≥ ${activeThreshold}%` : "จากผลตรวจแล้ว"}</small>
        </div>
        <div className={`is-review-outcome is-${outcome.status}`}>
          <span>ผลตามเกณฑ์</span>
          <strong>{outcome.status === "incomplete" && summary.total > 0 && recordedProgress.remainingRows === 0 ? "ชุดทดสอบยังไม่ครบเงื่อนไข" : outcome.label}</strong>
        </div>
      </div>}

      {searchState.fetchedAt && !criteriaDirty && <div className="ops-vehicle-responsive-tabs" role="tablist" aria-label="มุมมองพื้นที่ตรวจ Vehicle API">
        {[['queue', 'คิวรถ'], ['evidence', 'ภาพหลักฐาน'], ['decision', 'ผลตรวจ']].map(([key, label]) => <button type="button" role="tab" key={key} aria-selected={responsivePanel === key} className={responsivePanel === key ? "is-active" : ""} onClick={() => setResponsivePanel(key)}>{label}</button>)}
      </div>}
      {criteriaDirty ? <div className="ops-vehicle-search-empty is-stale"><Icon name="refresh" /><strong>ต้องดึงข้อมูลรถใหม่</strong><span>ผลตรวจเดิมถูกพักไว้ เพราะช่วงเวลาที่เลือกเปลี่ยนจากครั้งล่าสุด</span></div> : !searchState.fetchedAt ? <div className="ops-vehicle-search-empty"><Icon name="search" /><strong>ยังไม่ได้ดึงข้อมูลรถ</strong><span>{readOnly ? "รอบนี้ไม่มีข้อมูลรถที่บันทึกไว้ · ประวัติเป็นข้อมูลอ่านอย่างเดียว" : "เลือกวันและเวลา แล้วกด “ดึงข้อมูลรถจาก API”"}</span></div> : isPlateEligibilityTriage ? <VehicleSampleEligibilityTriage rows={orderedRows} visibleRows={visibleEligibilityRows} page={queuePage} pageCount={eligibilityPageCount} selectedRow={selectedRow} summary={eligibilitySummary} readOnly={readOnly} reason={eligibilityReason} setReason={setEligibilityReason} note={eligibilityNote} setNote={setEligibilityNote} onSelect={selectRow} onDecide={decideEligibility} onPage={setQueuePage} onOpenImage={openMedia} sampleSettings={sampleSettings} /> : !searchState.rows.length ? <div className="ops-vehicle-search-empty"><Icon name="info" /><strong>{searchState.sample?.adjustedAt ? "ไม่มีรายการเหลือในชุดตรวจ" : "ไม่พบข้อมูลรถ"}</strong><span>{searchState.sample?.adjustedAt ? "รายการถูกลบออกจากชุดตรวจ · ไม่สามารถสรุปว่าผ่าน" : isScopedReview ? "API ตอบสำเร็จแล้ว แต่ผลว่างยังไม่ถือว่าเสร็จ ต้องยืนยันว่าไม่มีรถในช่วงเวลานี้" : "API ตอบสำเร็จและไม่พบรถในช่วงเวลา จึงถือว่าเป็นผลตรวจที่ถูกต้อง"}</span>{isScopedReview && !searchState.sample?.adjustedAt && !readOnly && !searchState.emptyResultAcknowledgedAt && <button type="button" className="ops-button ops-button-secondary" onClick={acknowledgeEmptyResult}>ยืนยันว่าไม่มีรถช่วงนี้</button>}{isScopedReview && searchState.emptyResultAcknowledgedAt && <small>ยืนยันผลแล้ว {formatDateTime(searchState.emptyResultAcknowledgedAt)}</small>}</div> : <div className="ops-vehicle-focus-layout" data-vehicle-workspace={isPlateContext ? "plate" : "classification"}>
        <aside className="ops-vehicle-focus-queue" data-dock-panel="queue" aria-label="คิวตรวจรถ" data-vehicle-queue="review" data-queue-open={queueOpen}><button type="button" className="ops-button ops-button-secondary ops-vehicle-queue-toggle" aria-expanded={queueOpen} onClick={() => setQueueOpen(open => !open)}>คิวรถ · {queueRows.length} คัน · ค้าง {queueStatusCounts.pending} คัน</button>
          <div className="ops-vehicle-focus-queue-heading"><div><p className="ops-eyebrow">QUEUE</p><h4>คิวรถ</h4></div><strong>พบ {queueRows.length} จากทั้งหมด {orderedRows.length} คัน</strong></div>
          {summary.total > 0 && (summary.pendingChecks > 0 ? <button type="button" className="ops-button ops-button-secondary ops-vehicle-focus-pending-action" onClick={goToPending}><Icon name="list" size="small" />ตรวจคันค้างถัดไป</button> : <span className="ops-vehicle-recorded-status" role="status" aria-live="polite"><Icon name="check" size="small" />บันทึกผลครบทุกคัน</span>)}
          <label className="ops-vehicle-queue-search"><span>ค้นหาทะเบียน จังหวัด ประเภทรถ หรือ Lane</span><input type="search" value={queueQuery} onChange={(event) => { setQueueQuery(event.target.value); setQueuePage(0); }} placeholder="เช่น 68-3159 หรือ TH1" aria-label="ค้นหาทะเบียน จังหวัด ประเภทรถ หรือ Lane" /></label>
          <div className="ops-vehicle-queue-status-filter" role="group" aria-label="กรองคิวรถตามสถานะ">
            {[["all", "ทั้งหมด", queueStatusCounts.all], ["pending", "ค้างตรวจ", queueStatusCounts.pending], ["reviewed", "บันทึกผลแล้ว", queueStatusCounts.reviewed]].map(([status, label, count]) => <button type="button" key={status} className={queueStatusFilter === status ? "is-active" : ""} aria-pressed={queueStatusFilter === status} onClick={() => changeQueueStatusFilter(status)}><span>{label}</span><strong>{count}</strong></button>)}
          </div>
          {!readOnly && round?.status !== "closed" && <div className="vehicle-bulk-toolbar" data-selecting={bulkMode} role="group" aria-label="จัดการรายการรถ">
            <button type="button" className="vehicle-bulk-icon" title={bulkMode ? "ยกเลิกการเลือก" : "เลือกหลายรายการ"} aria-label={bulkMode ? "ยกเลิกการเลือก" : "เลือกหลายรายการ"} aria-pressed={bulkMode} disabled={loading || deleting || !serverWritable} onClick={() => { setBulkMode(mode => !mode); setBulkIds([]); }}><Icon name={bulkMode ? "close" : "checklist"} size="small" /><span className="vehicle-bulk-label">{bulkMode ? "ยกเลิกการเลือก" : "เลือกหลายรายการ"}</span></button>
            {bulkMode ? <><button type="button" className="vehicle-bulk-icon" title="เลือกทั้งหมดในหน้านี้" aria-label="เลือกทั้งหมดในหน้านี้" disabled={deleting || !visibleQueueRows.length} onClick={() => setBulkIds(ids => [...new Set([...ids, ...visibleQueueRows.map(row => row.id)])])}><Icon name="checklist" size="small" /></button><span className="vehicle-bulk-count" role="status">เลือก {bulkIds.length} คัน</span><button type="button" className="vehicle-bulk-icon is-danger" title="ลบที่เลือก" aria-label={`ลบที่เลือก ${bulkIds.length} คัน`} disabled={!bulkIds.length || deleting || !serverWritable} onClick={() => requestDelete(orderedRows.filter(row => bulkIds.includes(row.id)))}><Icon name="trash" size="small" /></button></> : null}
          </div>}

          {visibleQueueRows.length ? <div ref={queueListRef} className="ops-vehicle-focus-row-list" aria-label="รายการรถในคิว">{visibleQueueRows.map((row) => <div className="ops-vehicle-queue-row-actions" key={row.id}>{bulkMode && <input type="checkbox" aria-label={`เลือก ${row.plateNumber || row.id}`} checked={bulkIds.includes(row.id)} disabled={deleting} onChange={event => setBulkIds(ids => event.target.checked ? [...new Set([...ids, row.id])] : ids.filter(id => id !== row.id))} />}<button type="button" className={selectedRow?.id === row.id ? "is-active" : ""} aria-current={selectedRow?.id === row.id ? "true" : undefined} onClick={() => selectRow(row)}><span>{row.plateNumber || "ไม่พบทะเบียน"} · {row.province || "ไม่พบจังหวัด"}</span>{selectedRow?.id === row.id && <strong className="ops-vehicle-row-current-label">กำลังตรวจ</strong>}{!isPlateContext && <small>{row.vehicleClassLabel || "ไม่ระบุประเภทรถ"}</small>}<small>{row.occurredAt ? formatDateTime(row.occurredAt) : "ไม่พบเวลา"} · ช่องทาง {row.lane || "ไม่ระบุ"}</small><em className={isPendingRow(row) ? "is-pending" : "is-done"}>{getVehicleRowProgress(row, activeDimensions).label}{getVehicleRowProgress(row, activeDimensions).incorrect > 0 ? " · มีข้อมูลผิด" : ""}{getVehicleRowProgress(row, activeDimensions).unable > 0 ? " · ตรวจไม่ได้" : ""}</em></button>{!bulkMode && !readOnly && round?.status !== "closed" && <button type="button" className="ops-vehicle-row-delete" aria-label={`ลบรายการ ${row.plateNumber || row.id}`} title="ลบรายการจากชุดตรวจ" disabled={loading || deleting || !serverWritable} onClick={() => requestDelete(row)}><Icon name="trash" size="small" /></button>}</div>)}</div> : <div className="ops-vehicle-queue-empty">ไม่พบรายการที่ตรงกับคำค้น</div>}
          <nav className="ops-vehicle-queue-pagination" aria-label="แบ่งหน้าคิวรถ"><button type="button" className="ops-button ops-button-ghost" onClick={() => setQueuePage((page) => Math.max(0, page - 1))} disabled={queuePage <= 0} aria-label="หน้าก่อนหน้า">‹</button><div>{queuePageNumbers.map((page, index) => <span key={page} className="ops-vehicle-queue-page-item">{index > 0 && page - queuePageNumbers[index - 1] > 1 && <span aria-hidden="true">…</span>}<button type="button" className={queuePage === page ? "is-active" : ""} aria-current={queuePage === page ? "page" : undefined} onClick={() => setQueuePage(page)} aria-label={`หน้า ${page + 1}`}>{page + 1}</button></span>)}</div><button type="button" className="ops-button ops-button-ghost" onClick={() => setQueuePage((page) => Math.min(queuePageCount - 1, page + 1))} disabled={queuePage >= queuePageCount - 1} aria-label="หน้าถัดไป">›</button><small>แสดง {queueRows.length ? queuePage * queuePageSize + 1 : 0}–{Math.min((queuePage + 1) * queuePageSize, queueRows.length)} จาก {queueRows.length} รายการ</small></nav>
        </aside>
        {selectedRow && <>
          <main className="ops-vehicle-focus-main" data-dock-panel="evidence" data-vehicle-review-focus={domSafeId(selectedRow.id)}>
            <div className="ops-vehicle-focus-main-heading"><div><p className="ops-eyebrow">{isPlateContext ? "ตรวจเลขทะเบียน" : "ตรวจประเภทรถ"} · {selectedRow.lane || "ไม่ระบุ Lane"}</p><h4>ข้อมูลรถที่เลือก</h4><span>{isPlateContext ? (selectedRow.occurredAt ? formatDateTime(selectedRow.occurredAt) : "ไม่พบเวลา") : `${selectedRow.plateNumber || "ไม่พบทะเบียน"} · ${selectedRow.province || "ไม่พบจังหวัด"} · ${selectedRow.occurredAt ? formatDateTime(selectedRow.occurredAt) : "ไม่พบเวลา"}`}</span></div><div className="ops-vehicle-focus-main-tools"><strong>คันที่ {selectedRowIndex + 1} จาก {orderedRows.length}</strong></div></div>
            <section className={`ops-vehicle-focus-evidence-stack${isPlateContext ? "" : " is-classification"}`} aria-label={isPlateContext ? "หลักฐานภาพป้ายทะเบียน" : "หลักฐานภาพรถและผลคัดแยก"}>
              {isPlateContext
                ? <>
                  <div className="ops-vehicle-focus-images is-plate-pair">
                    <div className="ops-vehicle-image-comparison"><strong>ภาพจากกล้อง LPR</strong><VehicleReviewImage className="ops-vehicle-focus-image is-lpr" src={selectedRow.lprImage} alt={`ภาพจากกล้อง LPR ${selectedRow.plateNumber}`} emptyLabel="ไม่พบภาพ LPR จาก API" onOpen={() => openMedia(selectedRow, "lpr", "ภาพจากกล้อง LPR", selectedRow.lprImage)} actionLabel="ดูภาพ LPR เต็ม" loading="eager" /></div>
                    <div className="ops-vehicle-image-comparison is-plate-crop"><strong>ภาพป้ายทะเบียน (Crop)</strong><VehicleReviewImage className="ops-vehicle-focus-image is-plate" src={selectedRow.plateImage} alt={`ภาพป้ายทะเบียน Crop ${selectedRow.plateNumber}`} emptyLabel="ไม่พบภาพป้าย Crop จาก API" onOpen={() => openMedia(selectedRow, "plate", "ภาพป้ายทะเบียน (Crop)", selectedRow.plateImage)} actionLabel="ดูภาพป้ายเต็ม" loading="eager" /></div>
                  </div>

                </>
                : <>
                  <div className="ops-vehicle-focus-section-heading"><h5>ภาพหลักฐาน (ภาพรถ)</h5><span>Overview จาก API</span></div>
                  <div className="ops-vehicle-focus-images is-overview-only is-classification">
                    <VehicleReviewImage className="ops-vehicle-focus-image is-overview" src={selectedRow.overviewImage} alt={`ภาพรถ ${selectedRow.plateNumber}`} emptyLabel="ไม่พบภาพรถ Overview" onOpen={() => openMedia(selectedRow, "overview", "ภาพรถ (Overview)", selectedRow.overviewImage)} actionLabel="ดูภาพรถเต็ม" loading="eager" />
                  </div>

</>}
            </section>
            <section className="ops-vehicle-focus-inspector" data-dock-panel="decision" aria-label="ผลตรวจรถคันปัจจุบัน"><div className="ops-vehicle-focus-inspector-heading"><div><p className="ops-eyebrow">ผลการตรวจสอบ</p><h4>{isPlateContext ? "ตรวจผลการอ่านป้ายทะเบียน" : "ตรวจผลการคัดแยกประเภทรถ"}</h4></div></div>{isPlateContext && <div className="ops-vehicle-classification-details is-plate-details" data-details-open={vehicleDetailsOpen}><button type="button" className="ops-vehicle-details-toggle" aria-expanded={vehicleDetailsOpen} onClick={() => setVehicleDetailsOpen(open => !open)}><Icon name="info" size="small" /><span>รายละเอียดป้ายทะเบียน</span><Icon name={vehicleDetailsOpen ? "chevron-down" : "chevron-right"} size="small" /></button><section className="ops-vehicle-focus-plate-summary" aria-label="ผลอ่านป้ายทะเบียนจาก API"><div><span>เลขทะเบียนจาก API</span><strong>{selectedRow.plateNumber || "ไม่พบทะเบียน"}</strong></div><div><span>จังหวัด</span><strong>{selectedRow.province || "ไม่พบจังหวัด"}</strong></div></section>{vehicleDetailsOpen && <dl className="ops-vehicle-focus-facts"><div><dt><Icon name="lane" size="small" />ช่องทาง</dt><dd>{selectedRow.lane || "ไม่ระบุช่องทาง"}</dd></div><div><dt><Icon name="clock" size="small" />เวลา</dt><dd>{selectedRow.occurredAt ? formatDateTime(selectedRow.occurredAt) : "ไม่พบเวลา"}</dd></div></dl>}</div>}{!isPlateContext && <div className="ops-vehicle-classification-details" data-details-open={vehicleDetailsOpen}><button type="button" className="ops-vehicle-details-toggle" aria-expanded={vehicleDetailsOpen} onClick={() => setVehicleDetailsOpen(open => !open)}><Icon name="info" size="small" /><span>รายละเอียดรถ</span><Icon name={vehicleDetailsOpen ? "chevron-down" : "chevron-right"} size="small" /></button><section className="ops-vehicle-classification-summary" aria-labelledby="vehicle-classification-summary-title">
                    <div className="ops-vehicle-focus-section-heading"><h5 id="vehicle-classification-summary-title"><Icon name="scan" size="small" />ประเภทรถจากระบบ</h5></div>
                    <VehicleClassExample label={selectedRow.vehicleClassLabel} title="" axleCount={selectedRow.axleCount} />
                  </section>
                  {vehicleDetailsOpen && selectedRow.vehicleDescription && selectedRow.vehicleDescription !== selectedRow.vehicleClassLabel && <details className="vehicle-class-source-details"><summary>รายละเอียดเพิ่มเติมจากระบบ</summary><p>{selectedRow.vehicleDescription}</p></details>}{vehicleDetailsOpen && <dl className="ops-vehicle-focus-facts is-classification-facts"><div><dt><Icon name="lane" size="small" />ช่องทาง</dt><dd>{selectedRow.lane || "ไม่ระบุช่องทาง"}</dd></div><div><dt><Icon name="clock" size="small" />เวลา</dt><dd>{selectedRow.occurredAt ? formatDateTime(selectedRow.occurredAt) : "ไม่พบเวลา"}</dd></div><div><dt><Icon name="scan" size="small" />ทะเบียน / จังหวัด</dt><dd>{!selectedRow.plateNumber || selectedRow.plateNumber.startsWith("ไม่พบ") ? "ไม่พบข้อมูลทะเบียน" : [selectedRow.plateNumber, selectedRow.province && !selectedRow.province.startsWith("ไม่พบ") ? selectedRow.province : null].filter(Boolean).join(" · ")}</dd></div></dl>}</div>}<div className="ops-vehicle-review-dimension-list">{activeDimensions.map((dimension) => <VehicleReviewDimensionActions key={`${selectedRow.id}:${dimension.key}`} row={selectedRow} dimension={dimension} hideOriginalClass classOptions={VEHICLE_CLASS_OPTIONS} readOnly={readOnly} onReview={review} canSaveNext={summary.pendingChecks > 0 || selectedRowIndex < orderedRows.length - 1} onSavedNext={decision => selectRow(orderedRows.find(row => row.id === getNextPendingVehicleAfterDecision(searchState, { ...decision, context: context?.key })) || orderedRows[selectedRowIndex + 1])} requireFullPlateTruth={isEvidenceScore && dimension.key === "plate"} draftContext={`${round?.id}:${vehicleSearchConfig.systemKey || "legacy"}:${context?.key}:${activeScopeKey}`} />)}</div><div className="ops-vehicle-focus-inspector-body">{evidenceItem && !isApiOnlyReview && <section className="ops-vehicle-review-evidence" aria-labelledby="vehicle-review-evidence-title"><div className="ops-vehicle-review-evidence-heading"><div><p className="ops-eyebrow">DOCUMENT / EVIDENCE</p><h4 id="vehicle-review-evidence-title">หลักฐานประกอบ</h4></div><span>{evidenceBypassed ? "ไม่ต้องใช้หลักฐาน" : evidenceSlots.length ? `ครบ ${evidenceComplete}/${evidenceSlots.length} ช่อง` : "หลักฐานเสริม"}</span></div>{evidenceBypassed ? <div className="ops-evidence-drawer-disabled"><Icon name="info" size="small" /><span>รายการนี้ไม่ต้องแนบหลักฐาน</span></div> : evidenceSlots.length ? evidenceSlots.map((slot) => <EvidenceField key={slot.id} item={evidenceItem} slot={slot} value={evidenceState.evidence?.[slot.id]} readOnly={readOnly} disabled={false} onChange={(slotId, patch) => onChange?.({ evidence: { ...(evidenceState.evidence || {}), [slotId]: { ...(evidenceState.evidence?.[slotId] || {}), ...patch } } })} onAttachmentChange={(slotDefinition, file) => onEvidenceAttachmentChange?.(slotDefinition, file)} onAttachmentRemove={(slotDefinition, attachment, label) => onEvidenceAttachmentRemove?.(slotDefinition, attachment, label)} />) : <AttachmentField item={evidenceItem} attachment={evidenceState.attachment} readOnly={readOnly} disabled={false} onChange={(file) => onEvidenceAttachmentChange?.(null, file)} onRemove={() => onEvidenceAttachmentRemove?.(null, evidenceState.attachment, evidenceItem.label)} />}</section>}</div></section><nav className="ops-vehicle-focus-navigation" aria-label="เดินรถและไปงานตรวจถัดไป"><button type="button" className="ops-button ops-button-secondary" onClick={() => navigateRow("previous")} disabled={selectedRowIndex <= 0}><Icon name="arrow-left" size="small" />คันก่อนหน้า</button><button type="button" className="ops-button ops-button-primary" onClick={() => navigateRow("next")} disabled={selectedRowIndex < 0 || selectedRowIndex >= orderedRows.length - 1}><Icon name="arrow-right" size="small" />คันถัดไป</button></nav>
          </main>
        </>}
      </div>}
      {unverifiedListOpen && createPortal(<div className="ops-vehicle-decision-modal-backdrop"><section role="dialog" aria-modal="true" aria-label="รายการที่ตรวจยืนยันไม่ได้" className="ops-vehicle-decision-modal" onKeyDown={event => { if(event.key === "Escape") setUnverifiedListOpen(false); if(event.key === "Tab") { const nodes = [...event.currentTarget.querySelectorAll("button:not(:disabled)")]; const first=nodes[0], last=nodes[nodes.length-1]; if(event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if(!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } } }}><header><div><h3>บันทึกแล้ว · ตรวจไม่ได้ ({summary.unableToVerifyChecks})</h3><small>ตรวจเสร็จและบันทึกแล้ว · ไม่ใช่คิวค้างตรวจ</small></div><button autoFocus type="button" aria-label="ปิดรายการที่ตรวจยืนยันไม่ได้" onClick={() => setUnverifiedListOpen(false)}><Icon name="close" /></button></header><div className="ops-vehicle-unverified-modal-list"><div className="ops-vehicle-unverified-links">{orderedRows.flatMap(row => activeDimensions.filter(dimension => row[dimension.statusKey] === "unable-to-verify").map(dimension => <button type="button" key={row.id + ":" + dimension.key} className="ops-button ops-button-secondary" onClick={() => goToUnverified(row, dimension)}>{row.plateNumber || "ไม่พบทะเบียน"} · {row.lane || "ไม่ระบุช่องทาง"} · {row.occurredAt ? formatDateTime(row.occurredAt) : "ไม่พบเวลา"}<small>บันทึกแล้ว · {VEHICLE_REVIEW_REASON_OPTIONS[dimension.key]?.find(option => option.value === getVehicleReviewDetail(row, dimension.key).reasonCode)?.label || "ตรวจยืนยันไม่ได้"}</small><strong>{dimension.label} · ดูผลที่บันทึก →</strong></button>))}</div></div></section></div>,document.body)}
      {lightbox && <VehicleImageLightbox media={lightbox} onClose={() => setLightbox(null)} onNavigate={navigateMedia} canNavigatePrevious={canNavigateMedia("previous")} canNavigateNext={canNavigateMedia("next")} />}
    </section>;
  }

  return { VehicleFocusReviewPanel, VehicleSearchReviewPanelLegacy };
}
