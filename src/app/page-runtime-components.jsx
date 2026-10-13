import { getPendingChecklistItems } from "../domain/master-checklist.js";
import { collectAnnotationAttachmentIds } from "../domain/image-annotation.js";
import { AppIcon as Icon } from "./icon-system.jsx";
import { Button } from "./controls/ActionControls.jsx";
import CustomSelect from "./CustomSelect.jsx";
import { ThaiDatePicker } from "./date-picker.jsx";
import { getChecklistDisplayText } from "./checklist-queue-state.js";
import { getActivePhysicalEquipment, getEquipmentDisplayLabel, getRoundSummary, STATUS_OPTIONS } from "../domain/master-checklist.js";
import { evidenceAttachmentIds } from "../domain/evidence-checklist.js";
import { sortEquipmentForDisplay } from "../domain/ordering.js";
import { getContractContextForRound } from "../domain/contracts.js";
import { getCorrectionSummary } from "../domain/correction.js";
import { attachmentIdsForState } from "../domain/storage.js";
import { vehicleEvidenceAttachmentIds } from "../domain/vehicle-evidence-images.js";
import { formatBangkokDateTime } from "../domain/date-time.js";
import { formatDate, shortId } from "./page-runtime-shell.js";

export { formatDate, roundFor, shortId } from "./page-runtime-shell.js";

export const STATUS_LABELS = Object.fromEntries(STATUS_OPTIONS.map((option) => [option.value, option.label]));

export const STATUS_META = Object.freeze({
  pending: { icon: "info", tone: "pending", label: "ยังไม่ได้ตรวจ", action: "stay" },
  normal: { icon: "check", tone: "normal", label: "ปกติ", action: "advance" },
  damaged: { icon: "alert", tone: "damaged", label: "ชำรุด", action: "follow-up" },
  waiting: { icon: "refresh", tone: "waiting", label: "อยู่ระหว่างรอเปลี่ยนทดแทน", action: "follow-up" },
  "not-installed": { icon: "archive", tone: "not-installed", label: "ไม่ได้ติดตั้ง", action: "follow-up" },
  na: { icon: "close", tone: "na", label: "ไม่เกี่ยวข้อง", action: "advance" },
});

export function getStatusDisplayLabel(value, fallback = "") {
  return STATUS_META[value]?.label || STATUS_LABELS[value] || fallback || value;
}

export function formatDateTime(value) {
  return formatBangkokDateTime(value);
}

export function attachmentIdsForRound(round) {
  return [...collectAnnotationAttachmentIds(round), ...vehicleEvidenceAttachmentIds(round?.vehicleEvidenceArchive), ...attachmentIdsForState({ inspectionRounds: [round] }), ...evidenceAttachmentIds(round), ...Object.values(round?.inspectionItems || {}).map((item) => item?.attachment?.id).filter(Boolean)];
}

export function attachmentIdsForRecord(record) {
  return [
    ...attachmentIdsForRound(record),
    ...collectAnnotationAttachmentIds(record?.items),
    ...Object.values(record?.items || {}).map((item) => item?.attachment?.id).filter(Boolean),
  ];
}

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export function profileFor(state, stationId) {
  return state.stationProfiles.find((profile) => profile.id === stationId) || state.stationProfiles[0] || null;
}

export function recordStationId(record) {
  const snapshot = record?.snapshot || record?.stationSnapshot || record?.inspectionSnapshot;
  return record?.stationId || snapshot?.stationId || null;
}

export function belongsToStation(record, stationId) {
  return recordStationId(record) === stationId;
}

export function vehicleApiHref(round, contextKey, { history = false, systemKey = "" } = {}) {
  const base = history ? "#/history" : "#/inspections";
  const query = new URLSearchParams({ ...(systemKey ? { system: systemKey } : {}), ...(round?.isSystemDemo ? { demoSystems: "1", demoFormat: round.snapshot.stationFormat } : {}) });
  return `${base}/${encodeURIComponent(round?.id || "")}/vehicle-api/${encodeURIComponent(contextKey || "plate")}${query.size ? `?${query}` : ""}`;
}

export function statusClass(status) {
  return `status-${status || "pending"}`;
}

export function StatusBadge({ status = "pending", children }) {
  const statusIcon = STATUS_META[status]?.icon || {
    draft: "clipboard",
    inactive: "archive",
    archived: "archive",
    closed: "archive",
  }[status] || "info";
  return <span className={`ops-status ${statusClass(status)}`}><Icon name={statusIcon} size="small" /><span>{children || getStatusDisplayLabel(status)}</span></span>;
}

export function StationSelect({ profiles, value, onChange, label = "สถานีที่กำลังดู", includeInactive = false }) {
  const availableProfiles = (Array.isArray(profiles) ? profiles : []).filter((profile) => includeInactive || profile.active !== false);
  const selectedValue = availableProfiles.some((profile) => profile.id === value)
    ? value
    : availableProfiles[0]?.id || "";
  return <label className="ops-field ops-field-select"><span>{label}</span><CustomSelect value={selectedValue} onChange={(event) => onChange(event.target.value)} disabled={!availableProfiles.length} aria-label={label} label={label}>{availableProfiles.length ? availableProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.stationCode} · {profile.stationName}{profile.active === false ? " · ปิดใช้งาน" : ""}</option>) : <option value="">ยังไม่มีสถานีที่ใช้งาน</option>}</CustomSelect></label>;
}

export function StationSummary({ profile }) {
  const active = sortEquipmentForDisplay(getActivePhysicalEquipment(profile?.equipment), profile?.lanes);
  const grouped = [...new Set(active.map((equipment) => getEquipmentDisplayLabel(equipment)))];
  return <div className="station-summary"><span className="station-summary-mark"><Icon name="building" /></span><div><p className="ops-station-code">{profile?.stationCode || "ยังไม่มีสถานี"}</p><h3>{profile?.stationName || "สร้างสถานีเพื่อเริ่มต้น"}</h3><span>{active.length} อุปกรณ์ใช้งาน · {grouped.slice(0, 4).join(", ") || "ยังไม่มีอุปกรณ์"}</span></div></div>;
}

export function RoundCard({ state, round, onDelete }) {
  const profile = profileFor(state, round.stationId);
  const summary = getRoundSummary(round);
  const correction = getCorrectionSummary(round);
  const contractContext = getContractContextForRound(round, state);
  const closed = round.status === "closed";
  const stationCode = closed ? round.snapshot?.stationCode : (profile?.stationCode || round.snapshot?.stationCode);
  return <article className="ops-round-card"><div className="ops-round-copy"><div className="ops-round-meta"><span className="ops-round-code">{stationCode} · รอบการตรวจ {shortId(round.id)}</span><StatusBadge status={closed ? "closed" : "draft"}>{closed ? "ปิดรอบการตรวจแล้ว" : "อยู่ระหว่างกรอกข้อมูล"}</StatusBadge></div><h3>{round.meta.projectName || round.snapshot?.stationName}</h3><p className="ops-round-contract-context">{contractContext ? `${contractContext.contractNo || "สัญญา"} · งวด ${contractContext.reportSequence || contractContext.workPackageNo || "—"} · ${contractContext.regionNames?.join(" · ") || "ไม่ระบุภาค"}` : "ยังไม่ผูกสัญญา · ตรวจหน้างาน"}</p><p>วันที่ตรวจ {round.meta.inspectionDate ? formatDate(round.meta.inspectionDate) : formatDate(round.createdAt)} · อุปกรณ์จริงในข้อมูลประจำรอบ {round.snapshot?.equipment?.length || 0} รายการ{round.revisionNumber ? ` · ฉบับแก้ไขครั้งที่ ${round.revisionNumber}` : correction.count ? ` · แก้ไขย้อนหลัง ${correction.count} ครั้ง` : ""}</p></div><div className="ops-round-progress"><strong>{summary.progress}%</strong><span>ตรวจแล้ว {summary.done}/{summary.total} รายการ</span>{!closed && summary.pending > 0 && <div className="ops-round-pending"><span>ยังไม่ได้เลือกผลตรวจ {summary.pending} รายการ</span><Button href={`#/inspections/${encodeURIComponent(round.id)}?itemId=${encodeURIComponent(getPendingChecklistItems(round)[0]?.id || "")}`} variant="secondary" icon="arrow">ไปตรวจรายการที่เหลือ</Button></div>}<span>หลักฐานครบ {summary.evidenceComplete}/{summary.evidenceTotal} ช่อง</span></div><div className="ops-round-actions"><Button href={closed ? `#/history/${encodeURIComponent(round.id)}` : `#/inspections/${encodeURIComponent(round.id)}`} variant="secondary" icon="arrow">{closed ? "เปิดประวัติ" : "เปิดรายการตรวจ"}</Button>{closed ? <><Button href={`#/history/${encodeURIComponent(round.id)}/revise`} variant="ghost" icon="edit">จัดทำฉบับแก้ไข</Button>{onDelete && <Button onClick={() => onDelete(round)} variant="danger-ghost" icon="delete" className="ops-round-delete">ลบประวัติ</Button>}</> : onDelete && <Button onClick={() => onDelete(round)} variant="danger-ghost" icon="delete" className="ops-round-delete">ลบรอบการตรวจ</Button>}</div></article>;
}

export function ReportMetadataFields({ meta, onChange }) {
  return <>
    <label className="ops-field"><span>เลขที่เอกสาร</span><input value={meta?.documentNo || ""} onChange={(event) => onChange("documentNo", event.target.value)} placeholder="เช่น MA-2026-001" /></label>
    <label className="ops-field"><span>ผู้จัดทำรายงาน</span><input value={meta?.preparedBy || ""} onChange={(event) => onChange("preparedBy", event.target.value)} placeholder="ชื่อผู้จัดทำรายงาน" /></label>
    <label className="ops-field"><span>ผู้มีอำนาจลงนาม</span><input value={meta?.approvedBy || ""} onChange={(event) => onChange("approvedBy", event.target.value)} placeholder="ชื่อผู้มีอำนาจลงนาม (ถ้ามี)" /></label>
    <label className="ops-field"><span>วันที่ลงนาม</span><ThaiDatePicker value={meta?.approvalDate || ""} label="วันที่ลงนาม" onChange={(nextValue) => onChange("approvalDate", nextValue)} /></label>
    <p className="ops-field-helper ops-field-wide"><strong>ข้อมูลลงนามรายงาน:</strong> ข้อมูลส่วนนี้ใช้ประกอบการลงนามในรายงานเท่านั้น ไม่ใช่ขั้นตอนการอนุมัติของระบบ</p>
  </>;
}

export function getChecklistScopeMeta(item) {
  if (item?.vehicleReviewSystemKey) {
    const label = { 'sc-hs': 'HS', 'sc-ls': 'LS', imps: 'IMPS' }[item.vehicleReviewSystemKey] || item.vehicleReviewSystemKey;
    return { label: `ตรวจระดับระบบ · ${label}`, className: 'is-system' };
  }
  if (item?.assetId) {
    const assetName = getChecklistDisplayText(item.assetName || getEquipmentDisplayLabel({ type: item.equipmentType }) || "อุปกรณ์").trim();
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
