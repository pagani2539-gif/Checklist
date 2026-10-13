import { Fragment, useEffect, useMemo, useState } from "react";
import { STATUS_OPTIONS, getChecklistItemsProgress } from "../domain/master-checklist.js";
import { canUseNotInstalled } from "../domain/checklist-completion.js";
import { isEvidenceSlotComplete } from "../domain/evidence-checklist.js";
import { isEvidenceBypassItemStatus } from "../domain/inspection-status.js";
import { getChecklistDisplayText, getChecklistPageQueueGroups, getChecklistQueueGroups, getChecklistQueueItemBlocks, getChecklistQueueItemLabel, getChecklistQueueSectionLabel, getChecklistQueueToggle, getCleaningQueueItemCount } from "./checklist-queue-state.js";
import { AppIcon as Icon } from "./icon-system.jsx";
import { domSafeId } from "./dom-safe-id.js";
import CustomSelect from "./CustomSelect.jsx";
import { EmptyState } from "./PagePrimitives.jsx";
import { AttachmentField, EvidenceField } from "./AttachmentFields.jsx";

function statusClass(status) {
  return "status-" + (status || "pending");
}

export function createChecklistWorkspaceParts(runtime) {
  const { getChecklistScopeMeta, getCentralSystemNameForRecord, getEquipmentDisplayLabel, getSectionEvidenceStats, getVehicleReviewContext, getVehicleReviewState, isVehicleApiReviewItem, isWimElectronicsSubEquipmentType, STATUS_META } = runtime;
  const STATUS_LABELS = Object.fromEntries(STATUS_OPTIONS.map((option) => [option.value, option.label]));
  const getStatusDisplayLabel = (value, fallback = "") => STATUS_META[value]?.label || STATUS_LABELS[value] || fallback || value;

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

  function StatusChoiceGroup({ item, value, readOnly, disabled, onChange }) {
    const statusHelpId = `check-status-${domSafeId(item.id)}-help`;
    const describedBy = disabled ? `check-item-${domSafeId(item.id)}-not-applicable` : statusHelpId;
    const statusHint = STATUS_RESULT_HINTS[value] || STATUS_RESULT_HINTS.pending;
    const renderOption = (option) => {
      const label = getStatusDisplayLabel(option.value, option.label);
      const stationWork = !canUseNotInstalled(item);
      const choiceLabel = stationWork && option.value === "damaged" ? "พบปัญหา" : stationWork && option.value === "waiting" ? "รอดำเนินการ" : STATUS_CHOICE_LABELS[option.value] || label;
      const choiceDescription = stationWork && option.value === "normal" ? "ตรวจแล้ว พร้อมปฏิบัติงาน" : stationWork && option.value === "waiting" ? "ยังไม่พร้อม ต้องติดตามการดำเนินการ" : STATUS_CHOICE_DESCRIPTIONS[option.value];
      return <label className={`ops-status-choice status-${option.value}`} key={option.value} title={choiceLabel}>
        <input className="ops-choice-input" type="radio" name={`check-status-${domSafeId(item.id)}`} value={option.value} checked={value === option.value} disabled={readOnly || disabled} aria-label={choiceLabel} aria-describedby={describedBy} onChange={() => onChange(option.value)} />
        <span className="ops-status-choice-body"><span className="ops-status-choice-icon" aria-hidden="true">{value === option.value && <Icon name="check" />}</span><span className="ops-status-choice-copy"><span className="ops-status-choice-label">{choiceLabel}</span>{choiceDescription && <small className="ops-status-choice-description">{choiceDescription}</small>}</span></span>
      </label>;
    };
    return <fieldset className="ops-status-group" disabled={readOnly || disabled} aria-describedby={describedBy}>
      <legend><span>ผลตรวจสภาพ</span><small id={statusHelpId}>{disabled ? "รายการนี้ถูกกำหนดให้ไม่เกี่ยวข้องกับสถานี" : "เลือกเพียง 1 ข้อ"}</small></legend>
      <div className="ops-status-choice-grid ops-status-single-choice">{STATUS_CHOICE_ORDER.filter(key => readOnly || key !== "not-installed" || canUseNotInstalled(item)).map((key) => STATUS_OPTIONS.find((option) => option.value === key)).filter(Boolean).map(renderOption)}</div>
      {!disabled && <div className={`ops-status-result-hint status-${statusHint.tone}`} role="status" aria-live="polite"><Icon name="info" /><span><strong>{statusHint.title}</strong><small>{statusHint.message}</small></span></div>}
    </fieldset>;
  }

  function EvidenceDisclosure({ item, itemValue, readOnly, disabled, onChange, onAttachmentChange, onAttachmentAnnotation, onAttachmentRemove, focusSlotId, onFocusComplete }) {
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
      {open && <div className="ops-evidence-list" id={disclosureId}>{slots.map((slot) => <EvidenceField key={slot.id} item={item} slot={slot} value={itemValue.evidence?.[slot.id]} readOnly={readOnly} disabled={disabled} onChange={(slotId, patch) => onChange({ evidence: { ...(itemValue.evidence || {}), [slotId]: { ...(itemValue.evidence?.[slotId] || {}), ...patch } } })} onAttachmentChange={(slotDefinition, file) => onAttachmentChange(item.id, slotDefinition.id, file, slotDefinition.fieldType)} onAttachmentAnnotation={(slotId, marks) => onAttachmentAnnotation(item.id, slotId, marks)} onAttachmentRemove={(slotDefinition, attachment, label) => onAttachmentRemove(item.id, slotDefinition.id, attachment, label)} />)}</div>}
    </section>;
  }

  function ChecklistItem({ item, value, readOnly, onChange, onAttachmentChange, onAttachmentAnnotation, onAttachmentRemove, focusEvidenceId, onFocusEvidenceComplete, onStatusChange, hideEvidence = false, focusLayout = false, apiReview = false, vehicleSearch, vehicleReviewVersion, onOpenApiReview }) {
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
      const reviewState = getVehicleReviewState(vehicleSearch, { reviewVersion: vehicleReviewVersion, context: vehicleContext?.key, systemKey: item.vehicleReviewSystemKey });
      const openLabel = vehicleContext?.key === "classification" ? "เริ่มตรวจคัดแยกประเภทรถในหน้านี้" : "เริ่มตรวจป้ายทะเบียนในหน้านี้";
      return <article id={`check-item-${domSafeId(item.id)}`} className={`ops-check-item ops-vehicle-api-item is-${reviewState.key} ${hideEvidence ? "ops-check-item-focus" : ""}`} aria-labelledby={headingId}>
        <div className={`ops-check-item-heading ${focusLayout ? "ops-check-item-heading-a11y-only" : ""}`}><span className="ops-item-index">API</span><div><span className="ops-item-scope is-station">ตรวจระดับสถานี</span><h4 id={headingId} tabIndex="-1">{displayItemLabel}</h4><p>{item.helper}</p></div></div>
        <div className={`ops-vehicle-api-status tone-${reviewState.tone}`} role="status"><Icon name={reviewState.tone === "normal" ? "check" : reviewState.tone === "waiting" ? "refresh" : "search"} /><div><strong>{reviewState.label}</strong><span>{reviewState.summary.total ? `ทั้งหมด ${reviewState.summary.total} คัน · ตรวจแล้ว ${reviewState.summary.reviewed} คัน` : "ใช้ช่วงวันและเวลาเพื่อดึงข้อมูลจาก API สถานีจริง"}</span></div>{!readOnly && <button type="button" className="ops-button ops-button-primary" onClick={onOpenApiReview}>{openLabel}</button>}</div>
      </article>;
    }
    return <article id={`check-item-${domSafeId(item.id)}`} className={`ops-check-item ${notApplicable ? "is-na" : ""} ${statusClass(itemValue.status)} ${hideEvidence ? "ops-check-item-focus" : ""}`} aria-labelledby={headingId}>
      <div className={`ops-check-item-heading ${focusLayout ? "ops-check-item-heading-a11y-only" : ""}`}><span className="ops-item-index">{item.assetNo || (canUseNotInstalled(item) ? item.id.split(".").slice(-1)[0] : "งานระดับสถานี")}</span><div><span className={`ops-item-scope ${scopeMeta.className}`}>{scopeMeta.label}</span><h4 id={headingId} tabIndex="-1">{displayItemLabel}</h4>{item.checklistDisabled && <span className="ops-item-config-note"><Icon name="close" />ปิดจากการตั้งค่าสถานี</span>}{item.isAdditional && <span className="ops-item-config-note"><Icon name="info" />รายการเพิ่มเติมจากอุปกรณ์จริง</span>}<p>{canUseNotInstalled(item) ? item.helper : "ตรวจและแนบหลักฐานให้ตรงกับงานในหัวข้อนี้"}</p>{(item.assetNo || item.location || item.serialNo) && <span className="ops-asset-line"><Icon name="tag" /><span className="ops-code">{item.assetNo || "ไม่มีรหัส"}</span>{item.location ? ` · ${item.location}` : ""}{item.serialNo ? <> · S/N <span className="ops-code">{item.serialNo}</span></> : ""}</span>}</div></div>
      {notApplicable && <p className="ops-na-explanation" id={`check-item-${domSafeId(item.id)}-not-applicable`}><Icon name="info" /><span>รายการนี้ไม่เกี่ยวข้องกับสถานี จึงไม่ต้องกรอกผลตรวจหรือแนบหลักฐาน</span></p>}
      <div className="ops-check-fields">
        {item.inputType !== "none" && <label className="ops-field ops-value-field" htmlFor={`check-value-${domSafeId(item.id)}`}><span>{valueLabel} <em>({item.unit || "ข้อมูล"})</em></span><input id={`check-value-${domSafeId(item.id)}`} type={valueType} step={valueType === "number" ? "any" : undefined} inputMode={valueType === "number" ? "numeric" : undefined} value={itemValue.value ?? ""} disabled={readOnly || notApplicable} onChange={(event) => onChange(item.id, { value: event.target.value })} placeholder="—" /></label>}
        <StatusChoiceGroup item={item} value={itemValue.status} readOnly={readOnly} disabled={notApplicable} onChange={(nextStatus) => { if (onStatusChange) onStatusChange(item, nextStatus, itemValue); else onChange(item.id, { status: nextStatus }); }} />
      </div>
      {(!readOnly || itemValue.note) && <label className="ops-field ops-result-note"><span>หมายเหตุผลตรวจ{isEvidenceBypassItemStatus(itemValue.status) ? " · ไม่บังคับ" : ""}</span><textarea aria-label="หมายเหตุผลตรวจ" rows="2" value={itemValue.note || ""} disabled={readOnly || notApplicable} onChange={event => onChange(item.id, { note: event.target.value })} placeholder={isEvidenceBypassItemStatus(itemValue.status) ? "บันทึกเพิ่มเติม (ถ้ามี)" : "รายละเอียดของผลตรวจหรือปัญหาที่พบ"} /></label>}
      {!hideEvidence && (isEvidence ? <EvidenceDisclosure item={item} itemValue={itemValue} readOnly={readOnly} disabled={notApplicable} focusSlotId={focusEvidenceId} onFocusComplete={onFocusEvidenceComplete} onChange={(patch) => onChange(item.id, patch)} onAttachmentChange={onAttachmentChange} onAttachmentAnnotation={onAttachmentAnnotation} onAttachmentRemove={onAttachmentRemove} /> : <AttachmentField item={item} attachment={itemValue.attachment} readOnly={readOnly} disabled={notApplicable} onChange={(file) => onAttachmentChange(item.id, file)} onAnnotationChange={marks => onAttachmentAnnotation(item.id, null, marks)} onRemove={() => onAttachmentRemove(item.id, itemValue.attachment, item.label)} />)}
    </article>;
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
      const systemName = getCentralSystemNameForRecord(system)?.nameEn || getChecklistDisplayText(group.items?.[0]?.label || "ระบบที่ติดตั้ง");
      const scope = String(group.items?.[0]?.scope || "").trim();
      const laneId = system?.laneId || group.items?.find((item) => item.laneId)?.laneId;
      const lane = (round?.snapshot?.lanes || []).find((entry) => entry.id === laneId);
      const laneNo = lane?.laneNo ?? system?.laneNo ?? group.items?.find((item) => item.laneNo != null)?.laneNo;
      return [systemName, scope, laneNo != null && String(laneNo).trim() ? `Lane ${laneNo}` : ""].filter(Boolean).join(" · ");
    }
    if (group.kind === "station") {
      if (group.items?.every((item) => item.isAreaCleaning)) return "งานทำความสะอาดพื้นที่";
      const laneIds = [...new Set((group.items || []).map((item) => item.laneId).filter(Boolean))];
      const lane = laneIds.length === 1 ? (round?.snapshot?.lanes || []).find((entry) => entry.id === laneIds[0]) : null;
      return lane ? `งานช่องทาง · Lane ${lane.laneNo}` : "งานระดับสถานี";
    }
    const asset = group.assetId ? (round?.snapshot?.equipment || []).find((entry) => entry.id === group.assetId) : null;
    const type = asset?.type || group.types[0] || "";
    const equipmentLabel = type ? getEquipmentDisplayLabel(asset || { type }) : "";
    if (group.scope === "asset") return [equipmentLabel, group.assetNo || asset?.assetNo].filter(Boolean).join(" · ") || "อุปกรณ์จริง";
    if (group.scope === "equipment-type") return `${equipmentLabel || "อุปกรณ์"} · รายการระดับระบบ`;
    return "งานระดับสถานี / ระบบกลาง";
  }

  function ChecklistTaskQueue({ sections, hierarchy = "format", selected, currentItemId, round, summary, coverage, onSelect, readOnly }) {
    const stationFormat = round?.snapshot?.stationFormat || "SC";
    const queueGroups = useMemo(() => hierarchy === "station-categories"
      ? getChecklistPageQueueGroups(sections, stationFormat, round?.snapshot)
      : getChecklistQueueGroups(sections, stationFormat), [hierarchy, sections, stationFormat, round?.snapshot]);
    const queueSectionKey = (section) => section.queueKey || (section.queueSourceSectionCode ? `${section.queueSourceSectionCode}::${section.code}` : section.code);
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
        const visibleTop = queueBounds.top + queue.clientTop;
        const visibleBottom = visibleTop + queue.clientHeight;
        // Keep visible rows still; reveal only the edge outside the queue viewport.
        if (targetBounds.top >= visibleTop && targetBounds.bottom <= visibleBottom) return;
        const delta = targetBounds.height > queue.clientHeight || targetBounds.top < visibleTop
          ? targetBounds.top - visibleTop
          : targetBounds.bottom - visibleBottom;
        queue.scrollTo({ top: Math.max(0, queue.scrollTop + delta), behavior: reducedMotion ? "auto" : "smooth" });
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
      const asset = (round?.snapshot?.equipment || []).find(asset => asset.id === equipmentGroup.assetId);
      if ((asset?.type === "CONTROL_CABINET" || isWimElectronicsSubEquipmentType(asset?.type)) && equipmentGroup.items[0]) onSelect(sourceSectionCode(section), equipmentGroup.items[0].id);
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
      const vehicleReview = apiReview ? getVehicleReviewState(round.vehicleSearch, { reviewVersion: round.snapshot?.vehicleReviewVersion, context: vehicleContext?.key, systemKey: item.vehicleReviewSystemKey }) : null;
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
        <span className="ops-task-queue-item-copy"><em className={`ops-task-queue-item-scope ${scopeMeta.className}`}>{scopeMeta.label}</em><span title={getChecklistQueueItemLabel(item)}>{getChecklistQueueItemLabel(item)}</span><small>ผลตรวจ {apiReview ? vehicleReview.label : getStatusDisplayLabel(status)}</small>{evidenceLabel && !apiReview && <small className={evidenceIncomplete && !apiReview ? "is-incomplete" : "is-complete"}>{evidenceLabel}</small>}</span>
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
          const groupProgress = getChecklistItemsProgress(groupItems, round);
          const groupItemCount = groupProgress.done;
          const groupEvidence = getSectionEvidenceStats({ items: groupItems }, round);
          const groupStatusProgress = groupProgress.progress;
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
            <span className="ops-task-queue-group-copy"><strong>{group.title}</strong><small>{hierarchy === "station-categories" && group.categoryDescription ? group.categoryDescription : groupKindLabel}</small>{groupCleaningCount > 0 && <small>ทำความสะอาด {groupCleaningCount} รายการ</small>}</span>
              <span className="ops-task-queue-group-progress" aria-label={`กลุ่ม ${group.title} บันทึกสถานะ ${groupItemCount} จาก ${groupProgress.total} รายการ`}>
                <span className="ops-task-queue-group-progress-row"><span>ตรวจ</span><span className="ops-task-queue-group-meter" aria-hidden="true"><span style={{ width: `${groupStatusProgress}%` }} /></span><strong>{groupItemCount}/{groupProgress.total} รายการ</strong></span>
                <span className={`ops-task-queue-group-progress-row ${groupEvidence.total === 0 ? "is-empty" : groupEvidence.complete === groupEvidence.total ? "is-complete" : "is-incomplete"}`}><span>หลักฐาน</span><span className="ops-task-queue-group-meter" aria-hidden="true"><span style={{ width: `${groupEvidenceProgress}%` }} /></span><strong>{groupEvidence.total ? `${groupEvidence.complete}/${groupEvidence.total} ช่อง` : "ไม่มีช่อง"}</strong></span>
              </span>
            </button>
            {isGroupExpanded && <div className="ops-task-queue-group-sections">
            {group.sections.map((section) => {
          const sectionKey = queueSectionKey(section);
          const isExpanded = expandedSections.has(sectionKey);
          const sourceItems = section.sourceItems || section.items;
          const sectionCleaningCount = getCleaningQueueItemCount(sourceItems);
          const sectionProgress = getChecklistItemsProgress(sourceItems, round);
          const itemCount = sectionProgress.done;
          const evidence = getSectionEvidenceStats({ ...section, items: sourceItems }, round);
          const evidenceLabel = formatEvidenceCount(evidence.complete, evidence.total);
          const filteredLabel = section.excludedItemCount ? ` · ซ่อน ${section.excludedItemCount} รายการที่ไม่รวมความคืบหน้า` : "";
          const sectionMeta = getChecklistSectionMeta(section);
          const statusProgress = sectionProgress.progress;
          const evidenceProgress = evidence.total ? Math.round((evidence.complete / evidence.total) * 100) : 0;
          const evidenceTone = evidence.total === 0 ? "is-empty" : evidence.complete === evidence.total ? "is-complete" : "is-incomplete";
          const equipmentGroups = queueEquipmentGroups(section);
          const isSectionActive = sourceItems.some((item) => item.id === currentItemId);
          return <div className={`ops-task-queue-section ${isExpanded ? "is-expanded" : ""}`} id={`task-queue-section-${domSafeId(sectionKey)}`} key={sectionKey}>
            <button type="button" className={`ops-task-queue-section-toggle ${isSectionActive ? "is-active" : ""}`} aria-expanded={isExpanded} aria-current={isSectionActive ? "page" : undefined} onClick={() => toggleSection(section)}>
              <span className="ops-task-queue-chevron" aria-hidden="true"><Icon name="arrow" size="small" /></span>
              <span className="ops-task-queue-section-code">{section.queueDisplayCode || section.code}</span>
               <span className="ops-task-queue-section-copy"><strong>{section.title}</strong><small>{group.kind === "format-system" ? "ชุดตรวจย่อย" : "หมวดย่อย"}{sectionMeta ? ` · ${sectionMeta.label}` : ""}{filteredLabel}</small>{sectionCleaningCount > 0 && <small>ทำความสะอาด {sectionCleaningCount} รายการ</small>}</span>
              <span className="ops-task-queue-section-progress" aria-label={`รายการตรวจบันทึกสถานะ ${itemCount} จาก ${sectionProgress.total} รายการ · ${evidenceLabel}`}>
                <span className="ops-task-queue-section-progress-row">
                  <span className="ops-task-queue-section-progress-label">ตรวจ</span>
                  <span className="ops-task-queue-section-meter" aria-hidden="true"><span style={{ width: `${statusProgress}%` }} /></span>
                  <strong>{itemCount}/{sectionProgress.total} รายการ</strong>
                </span>
                <span className={`ops-task-queue-section-progress-row ${evidenceTone}`}>
                  <span className="ops-task-queue-section-progress-label">หลักฐาน</span>
                  <span className="ops-task-queue-section-meter" aria-hidden="true"><span style={{ width: `${evidenceProgress}%` }} /></span>
                  <strong>{evidence.total ? `${evidence.complete}/${evidence.total} ช่อง` : "ไม่มีช่อง"}</strong>
                </span>
              </span>
            </button>
            {isExpanded && <div className="ops-task-queue-items"><div className="ops-task-queue-items-heading">รายการตรวจในหมวดย่อยนี้</div>
              <div className="ops-task-queue-equipment-groups" aria-label={hierarchy === "station-categories" ? "อุปกรณ์และระบบในหมวดย่อยนี้" : "อุปกรณ์ในหมวดย่อยนี้"}>
                {equipmentGroups.map((equipmentGroup) => {
                  const isEquipmentActive = equipmentGroup.items.some((item) => item.id === currentItemId);
                  const equipmentProgress = getChecklistItemsProgress(equipmentGroup.items, round);
                  const equipmentItemCount = equipmentProgress.done;
                  const equipmentEvidence = getSectionEvidenceStats({ items: equipmentGroup.items }, round);
                  const equipmentCleaningCount = getCleaningQueueItemCount(equipmentGroup.items);
                  const equipmentEvidenceLabel = formatEvidenceCount(equipmentEvidence.complete, equipmentEvidence.total);
                  const equipmentStatusProgress = equipmentProgress.progress;
                  const equipmentEvidenceProgress = equipmentEvidence.total ? Math.round((equipmentEvidence.complete / equipmentEvidence.total) * 100) : 0;
                  const equipmentEvidenceTone = equipmentEvidence.total === 0 ? "is-empty" : equipmentEvidence.complete === equipmentEvidence.total ? "is-complete" : "is-incomplete";
                  const equipmentItemBlocks = getChecklistQueueItemBlocks(equipmentGroup.items);
                  const equipmentLabel = getChecklistQueueEquipmentLabel(equipmentGroup, round);
                  const equipmentAsset = equipmentGroup.assetId ? (round?.snapshot?.equipment || []).find((asset) => asset.id === equipmentGroup.assetId) : null;
                  const equipmentCode = equipmentGroup.scope === "asset" ? String(equipmentGroup.assetNo || equipmentAsset?.assetNo || "").trim() : "";
                  const equipmentName = equipmentCode && equipmentLabel.endsWith(` · ${equipmentCode}`) ? equipmentLabel.slice(0, -(` · ${equipmentCode}`).length) : equipmentLabel;
                  const equipmentKey = `${sectionKey}::${equipmentGroup.id}`;
                  const isEquipmentExpanded = expandedEquipmentGroups.has(equipmentKey);
                  const equipmentKindLabel = hierarchy === "station-categories"
                    ? equipmentGroup.kind === "system" ? "ระบบ" : equipmentGroup.kind === "station" ? "งานสถานี / Lane" : "อุปกรณ์"
                    : "อุปกรณ์";
                  return <div className={`ops-task-queue-equipment-group ${isEquipmentActive ? "is-active" : ""} ${isEquipmentExpanded ? "is-expanded" : ""}`} key={equipmentKey}>
                    <button type="button" className="ops-task-queue-equipment-label" aria-label={`${equipmentKindLabel} ${equipmentLabel}`} aria-expanded={isEquipmentExpanded} onClick={() => toggleEquipmentGroup(section, equipmentGroup)}>
                      <span className="ops-task-queue-equipment-chevron" aria-hidden="true"><Icon name="arrow" size="small" /></span>
                      <span className="ops-task-queue-equipment-copy"><strong>{equipmentName}</strong>{equipmentCode && <small className="ops-task-queue-equipment-code">{equipmentCode}</small>}<small>{equipmentKindLabel}</small>{equipmentCleaningCount > 0 && <small>ทำความสะอาด {equipmentCleaningCount} รายการ</small>}</span>
                      <span className="ops-task-queue-equipment-progress" aria-label={`${equipmentLabel} บันทึกสถานะ ${equipmentItemCount} จาก ${equipmentProgress.total} รายการ · ${equipmentEvidenceLabel}`}>
                        <span className="ops-task-queue-equipment-progress-row"><span>ตรวจ</span><span className="ops-task-queue-equipment-meter" aria-hidden="true"><span style={{ width: `${equipmentStatusProgress}%` }} /></span><strong>{equipmentItemCount}/{equipmentProgress.total} รายการ</strong></span>
                        <span className={`ops-task-queue-equipment-progress-row ${equipmentEvidenceTone}`}><span>หลักฐาน</span><span className="ops-task-queue-equipment-meter" aria-hidden="true"><span style={{ width: `${equipmentEvidenceProgress}%` }} /></span><strong>{equipmentEvidence.total ? `${equipmentEvidence.complete}/${equipmentEvidence.total} ช่อง` : "ไม่มีช่อง"}</strong></span>
                      </span>
                    </button>
                    {isEquipmentExpanded && <div className="ops-task-queue-equipment-items">
                      {equipmentItemBlocks.map((block) => <Fragment key={`${equipmentKey}::${block.kind}`}>
                        {block.kind === "cleaning" && <div className="ops-task-queue-cleaning-divider" role="heading" aria-level={5}>
                          <strong>งานทำความสะอาด</strong><span>{block.items.length} รายการ</span>
                        </div>}
                        {block.items.map((item) => renderQueueItem(section, item))}
                      </Fragment>)}
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

  function ChecklistEvidenceDrawer({ item, itemValue, readOnly, onChange, onAttachmentChange, onAttachmentAnnotation, onAttachmentRemove, allowClipboardPaste = false, focusSlotId, onFocusComplete, round, vehicleSearch, onVehicleSearchChange, notify, focusVehicleRowId, focusVehicleReviewKind, onFocusVehicleRowComplete, panelId = "", labelledBy = "", hidden = false }) {
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
    const evidenceLabel = evidenceBypassed ? "ไม่ต้องตรวจหลักฐาน" : slots.length ? `ข้อมูลหลักฐาน ${complete}/${slots.length} ช่อง · ตรวจไฟล์ด้านล่าง` : "หลักฐานเสริม";
    const isCleaningItem = item.isEquipmentCleaning === true || item.isAreaCleaning === true;
    const updateEvidence = (slotId, patch) => onChange({ evidence: { ...(value.evidence || {}), [slotId]: { ...(value.evidence?.[slotId] || {}), ...patch } } });

    return <aside className={`ops-evidence-drawer ${evidenceBypassed ? "is-disabled" : ""}`} id={panelId || undefined} role={panelId ? "tabpanel" : undefined} aria-labelledby={labelledBy || "evidence-drawer-title"} tabIndex={panelId ? 0 : undefined} hidden={hidden} aria-hidden={hidden ? "true" : undefined}>
      <div className="ops-evidence-drawer-heading">
        <div><h3 id="evidence-drawer-title">หลักฐานประกอบ</h3></div>
        <span className="ops-evidence-drawer-status" role="status" aria-live="polite"><Icon name="info" size="small" />{evidenceLabel}</span>
      </div>
      <div className={`ops-evidence-drawer-item ${isCleaningItem ? "is-cleaning" : ""}`}><div><strong>{getChecklistQueueItemLabel(item)}</strong><small>{item.helper || "หลักฐานประกอบรายการตรวจ"}</small></div></div>
      {getChecklistSectionMeta(item)?.drawerNote && <div className={`ops-checklist-split-note is-${item.sectionCode}`} role="note"><Icon name="info" size="small" /><span>{getChecklistSectionMeta(item).drawerNote}</span></div>}
      {evidenceBypassed ? <div className="ops-evidence-drawer-disabled"><Icon name="info" /><span>เลือกสถานะ “{evidenceBypassLabel}” จึงไม่ต้องตรวจหรือแนบหลักฐาน รายการนี้จะไม่แสดงในรายงาน</span></div> : slots.length ? <div className="ops-evidence-drawer-slots">{slots.map((slot) => <EvidenceField key={slot.id} item={item} slot={slot} value={value.evidence?.[slot.id]} readOnly={readOnly} disabled={false} allowClipboardPaste={allowClipboardPaste} onChange={updateEvidence} onAttachmentChange={(slotDefinition, file) => onAttachmentChange(item.id, slotDefinition.id, file, slotDefinition.fieldType)} onAttachmentAnnotation={(slotId, marks) => onAttachmentAnnotation(item.id, slotId, marks)} onAttachmentRemove={(slotDefinition, attachment, label) => onAttachmentRemove(item.id, slotDefinition.id, attachment, label)} />)}</div> : <AttachmentField item={item} attachment={value.attachment} readOnly={readOnly} disabled={false} allowClipboardPaste={allowClipboardPaste} onChange={(file) => onAttachmentChange(item.id, file)} onAnnotationChange={marks => onAttachmentAnnotation(item.id, null, marks)} onRemove={() => onAttachmentRemove(item.id, value.attachment, item.label)} />}
       {!readOnly && !evidenceBypassed && <div className="ops-evidence-drawer-help"><Icon name="info" size="small" /><span>เลือกแถวรายการก่อน แล้วลากรูปลงในพื้นที่อัปโหลด หรือกดเลือกจากเครื่อง{allowClipboardPaste ? " หรือคลิกปุ่มวางรูปแล้วกด Ctrl+V" : ""}</span></div>}
    </aside>;
  }

  function ChecklistPager({ currentIndex, total, onPrevious, onNext }) {
    const hasItems = total > 0;
    return <nav className="ops-item-pager" aria-label="เลื่อนไปยังรายการตรวจ">
      <div className="ops-item-pager-position">
        <span className="ops-item-position" aria-live="polite">รายการตรวจที่ {hasItems ? currentIndex + 1 : 0} จาก {total} ในรายการที่แสดง</span>
      </div>
      <div className="ops-item-pager-actions">
        <button type="button" className="ops-button ops-button-secondary" onClick={onPrevious} disabled={!hasItems || currentIndex <= 0}><Icon name="arrow" />ก่อนหน้า</button>
        <button type="button" className="ops-button ops-button-primary" onClick={onNext} disabled={!hasItems || currentIndex >= total - 1}>ถัดไป<Icon name="arrow" /></button>
      </div>
    </nav>;
  }

  return { ChecklistEvidenceDrawer, ChecklistItem, ChecklistPager, ChecklistTaskQueue };
}
