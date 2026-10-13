import { lazy, Suspense, useEffect, useState } from "react";
import { AsyncModuleErrorBoundary } from "./page-registry.jsx";
import { AppIcon as Icon } from "./icon-system.jsx";
import { domSafeId } from "./dom-safe-id.js";
import { displayedImageAttachment } from "../domain/image-annotation.js";
import { isEvidenceSlotComplete } from "../domain/evidence-checklist.js";
import { getStoredAttachment } from "../domain/attachments.js";
import { getChecklistDisplayText } from "./checklist-queue-state.js";

const LazyImageAnnotationEditor = lazy(() => import("./ImageAnnotationEditor.jsx"));

function formatBytes(value) {
  const bytes = Number(value) || 0;
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function attachmentAccept(fieldType = "photo") {
  if (fieldType === "video") return "video/*";
  if (fieldType === "document") return "image/*,video/*,application/pdf,text/plain";
  return "image/*";
}

function AttachmentPicker({ id, label, accept, allowCamera = false, allowClipboardPaste = false, hasAttachment = false, variant = "default", dropLabel, dropHint, compactLabel, onFile }) {
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
  const showClipboardPaste = allowClipboardPaste && String(accept || "").includes("image/*");
  const handlePaste = (event) => {
    if (!showClipboardPaste) return;
    const clipboardItems = Array.from(event.clipboardData?.items || []);
    const clipboardImages = clipboardItems
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter((file) => file?.type?.startsWith("image/"));
    const imageFiles = clipboardImages.length
      ? clipboardImages
      : Array.from(event.clipboardData?.files || []).filter((file) => file?.type?.startsWith("image/"));
    const file = imageFiles[0];
    if (!file) {
      setSelectionNotice("ไม่พบรูปภาพในคลิปบอร์ด");
      return;
    }
    event.preventDefault();
    setSelectionNotice(imageFiles.length > 1 ? "วางได้ครั้งละ 1 รูป ระบบจะใช้รูปแรก" : "");
    onFile(file);
  };
  const clipboardPasteAction = showClipboardPaste ? <button type="button" className="ops-button ops-button-secondary ops-attachment-paste-action" onClick={() => setSelectionNotice("พร้อมแล้ว กด Ctrl+V เพื่อวางรูป")} onPaste={handlePaste} aria-label="คลิกปุ่มนี้ก่อน แล้วกด Ctrl+V เพื่อวางรูปจากคลิปบอร์ด">
    <Icon name="clipboard" size="small" /><span>วางรูปจากคลิปบอร์ด · Ctrl+V</span>
  </button> : null;
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
    {clipboardPasteAction}
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
        {clipboardPasteAction}
      </div>
      {allowCamera && <input id={cameraInputId} className="ops-attachment-input is-programmatic" type="file" accept="image/*" capture="environment" tabIndex="-1" aria-hidden="true" aria-label={`ถ่ายรูปใหม่สำหรับ${label}`} onChange={(event) => { pickFiles(event.target.files); event.target.value = ""; }} />}
    </> : allowCamera && <label className="ops-button ops-button-secondary ops-attachment-camera" htmlFor={cameraInputId}><Icon name="camera" /><span>ถ่ายรูปใหม่</span><input id={cameraInputId} className="ops-attachment-input" type="file" accept="image/*" capture="environment" aria-label={`ถ่ายรูปใหม่สำหรับ${label}`} onChange={(event) => { pickFiles(event.target.files); event.target.value = ""; }} /></label>}
    {!isWorkspace && clipboardPasteAction}
    {(isDragOver || selectionNotice) && <span className="ops-attachment-picker-status" role="status" aria-live="polite">{isDragOver ? "ปล่อยไฟล์ที่นี่" : selectionNotice}</span>}
  </div>;
}

function AttachmentPreview({ attachment, label, readOnly, onRemove, onAnnotationChange, statusText, statusComplete = false }) {
  const [editing, setEditing] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const displayed = showOriginal ? attachment : displayedImageAttachment(attachment);
  const [previewUrl, setPreviewUrl] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    setPreviewUrl("");
    setLoadError(false);
    if (!attachment?.id) return undefined;
    getStoredAttachment(displayed.id).then((blob) => {
      if (!blob) throw new Error("ไม่พบไฟล์ภาพ");
      objectUrl = URL.createObjectURL(blob);
      if (active) setPreviewUrl(objectUrl);
      else URL.revokeObjectURL(objectUrl);
    }).catch(() => { if (active) setLoadError(true); });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [displayed?.id, retryKey]);

  if (!attachment) return <span className="ops-attachment-empty">ยังไม่มีไฟล์แนบหลักฐาน</span>;
  const isVideo = String(attachment.type || "").startsWith("video/");
  const isImage = String(attachment.type || "").startsWith("image/");
  const isPdf = attachment.type === "application/pdf";
  return <div className="ops-attachment-preview">{editing && !readOnly && <AsyncModuleErrorBoundary title="เปิดเครื่องมือทำเครื่องหมายไม่ได้"><Suspense fallback={<div className="ops-empty-state" role="status"><span>กำลังเปิดเครื่องมือทำเครื่องหมาย…</span></div>}><LazyImageAnnotationEditor attachment={attachment} onClose={() => setEditing(false)} onSave={async marks => { await onAnnotationChange(marks); setShowOriginal(false); }} /></Suspense></AsyncModuleErrorBoundary>}<div className="ops-attachment-image-wrap">{previewUrl && !loadError && isVideo ? <video className="ops-attachment-video" src={previewUrl} controls preload="metadata" aria-label={`วิดีโอหลักฐาน ${label}`} onError={() => setLoadError(true)} /> : previewUrl && !loadError && isImage ? <img src={previewUrl} alt={`ภาพแนบ ${label}`} onError={() => setLoadError(true)} /> : <span className="ops-attachment-loading">{loadError ? "เปิดไฟล์หลักฐานไม่สำเร็จ" : isPdf ? "ไฟล์เอกสารแนบ" : "มีไฟล์หลักฐานแนบ"}</span>}</div><div className="ops-attachment-meta"><span>{attachment.name}{formatBytes(attachment.size) ? ` · ${formatBytes(attachment.size)}` : ""}</span><div className="ops-attachment-meta-actions">{statusText && <span className={`ops-attachment-status ${statusComplete && !loadError && previewUrl ? "is-complete" : ""}`} role="status"><Icon name={statusComplete && !loadError && previewUrl ? "check" : "info"} size="small" />{loadError ? "เปิดหลักฐานไม่ได้ · ต้องตรวจสอบไฟล์" : !previewUrl ? "กำลังตรวจไฟล์แนบ" : statusText}</span>}{loadError && <button type="button" className="ops-button ops-button-secondary" onClick={() => setRetryKey(key => key + 1)}>ลองเปิดไฟล์อีกครั้ง</button>}{!readOnly && <button type="button" className="ops-button ops-button-danger-ghost ops-attachment-remove" onClick={onRemove} aria-label={`ลบหลักฐานของ ${label}`}><Icon name="delete" size="small" />ลบหลักฐาน</button>}</div></div>{isImage && <div className="annotation-preview-actions">{!readOnly && onAnnotationChange && <button type="button" className="ops-button ops-button-secondary" onClick={() => setEditing(true)}>ทำเครื่องหมาย</button>}{attachment.imageAnnotation && <button type="button" className="ops-button ops-button-secondary" onClick={() => setShowOriginal(value => !value)}>{showOriginal ? "ดูภาพมีเครื่องหมาย" : "ดูภาพต้นฉบับ"}</button>}</div>}</div>;
}

function AttachmentField({ item, attachment, readOnly, disabled, onChange, onRemove, onAnnotationChange, allowClipboardPaste = false }) {
  return <div className={`ops-attachment-field ${disabled ? "is-disabled" : ""}`}><div className="ops-attachment-copy"><span>ไฟล์แนบหลักฐาน <em>{disabled ? "(ไม่เกี่ยวข้อง)" : "(ถ้ามี)"}</em></span><small>{disabled ? "รายการนี้ไม่ต้องแนบไฟล์หลักฐาน" : "แนบภาพถ่ายหรือไฟล์ของอุปกรณ์หรือจุดตรวจเพื่อใช้อ้างอิง"}</small></div>{!readOnly && !disabled && <AttachmentPicker id={`attachment-${item.id}`} label="รูปหลักฐาน" accept="image/*" allowCamera allowClipboardPaste={allowClipboardPaste} hasAttachment={Boolean(attachment)} onFile={onChange} />}<AttachmentPreview attachment={attachment} label={item.label} readOnly={readOnly || disabled} onRemove={onRemove} onAnnotationChange={onAnnotationChange} /></div>;
}

function EvidenceField({ item, slot, value, readOnly, disabled, onChange, onAttachmentChange, onAttachmentAnnotation, onAttachmentRemove, allowClipboardPaste = false }) {
  const state = value || { status: "pending", value: "", note: "", attachment: null };
  const slotLabel = getChecklistDisplayText(slot.displayLabel || slot.sourceLabel);
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
        {state.attachment ? <AttachmentPreview attachment={state.attachment} label={slotLabel} readOnly={readOnly || disabled} statusText={evidenceStateLabel} statusComplete={evidenceComplete} onAnnotationChange={marks => onAttachmentAnnotation?.(slot.id, marks)} onRemove={() => onAttachmentRemove(slot, state.attachment, slotLabel)} /> : <>
          <div className={`ops-evidence-auto-state ${evidenceComplete ? "is-complete" : "is-pending"}`} role="status" aria-live="polite">
            <span className="ops-evidence-auto-state-icon"><Icon name={evidenceComplete ? "check" : "info"} /></span>
            <span><strong>{evidenceStateLabel}</strong><small>{evidenceStateHint}</small></span>
          </div>
          <div className="ops-evidence-proof-empty"><Icon name="camera" /><strong>ยังไม่มีภาพหลักฐาน</strong><small>{evidenceStateHint}</small></div>
        </>}
      </div>
      {!readOnly && !disabled && <AttachmentPicker variant={hasAttachment ? "compact" : "workspace"} id={`evidence-attachment-${slot.id}`} label={typeLabel} accept={attachmentAccept(slot.fieldType)} allowCamera={slot.fieldType === "photo" || slot.fieldType === "document"} allowClipboardPaste={allowClipboardPaste && slot.fieldType === "photo"} hasAttachment={hasAttachment} compactLabel={slot.fieldType === "photo" ? "เปลี่ยนรูป" : "เปลี่ยนไฟล์"} dropLabel={slot.fieldType === "photo" ? "ลากรูปมาวางที่นี่" : "ลากไฟล์มาวางที่นี่"} dropHint="หรือคลิกเลือกจากเครื่อง" onFile={(file) => onAttachmentChange(slot, file)} />}
    </div>
    {!readOnly && !disabled && !showNote && <button type="button" className="ops-note-toggle ops-evidence-note-toggle" onClick={() => setShowNote(true)}>+ เพิ่มหมายเหตุหลักฐาน</button>}
    {showNote && <div className="ops-note-block ops-evidence-note-block"><label className="ops-field" htmlFor={`evidence-note-${slot.id}`}><span>หมายเหตุหลักฐาน</span><textarea id={`evidence-note-${slot.id}`} rows="2" value={state.note || ""} disabled={readOnly || disabled} aria-describedby={`evidence-note-help-${slot.id}`} onChange={(event) => onChange(slot.id, { note: event.target.value })} placeholder="ระบุรายละเอียดของช่องนี้" /></label><small id={`evidence-note-help-${slot.id}`}>บันทึกรายละเอียดที่ช่วยยืนยันหลักฐานของช่องนี้</small></div>}
  </div>;
}

export { AttachmentField, EvidenceField };
