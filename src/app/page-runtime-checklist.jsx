import { AppIcon as Icon } from "./icon-system.jsx";
import { getChecklistQueueGroups } from "./checklist-queue-state.js";
import { getEquipmentDisplayLabel } from "../domain/master-checklist.js";
import { EVIDENCE_STATUS_OPTIONS, isEvidenceSlotComplete, shouldIncludeEvidenceSlotInSummary } from "../domain/evidence-checklist.js";
import { isEvidenceBypassItemStatus } from "../domain/inspection-status.js";
import { isVehicleApiReviewItem } from "../domain/vehicle-search.js";



export function Stepper({ current = 1 }) {
  return <ol className="ops-stepper" aria-label="ขั้นตอนสร้างรอบการตรวจ"><li className={current >= 1 ? "is-current" : ""}><span>1</span><div><strong>เลือกสถานี</strong><small>ยืนยันทะเบียน</small></div></li><li className={current >= 2 ? "is-current" : ""}><span>2</span><div><strong>สร้างข้อมูลประจำรอบ</strong><small>บันทึกอุปกรณ์ในรอบการตรวจ</small></div></li><li className={current >= 3 ? "is-current" : ""}><span>3</span><div><strong>เริ่มตรวจ</strong><small>กรอกผลหน้างาน</small></div></li></ol>;
}

export function getSectionEvidenceStats(section, round) {
  const values = round?.inspectionItems || {};
  const slots = section.items
    .filter((item) => item.applicable !== false && !isVehicleApiReviewItem(item, round?.snapshot) && !isEvidenceBypassItemStatus(values[item.id]?.status))
    .flatMap((item) => (item.evidenceSlots || [])
      .filter((slot) => shouldIncludeEvidenceSlotInSummary(slot, round))
      .map((slot) => ({ item, slot })));
  const statusCounts = Object.fromEntries(EVIDENCE_STATUS_OPTIONS.map((option) => [option.value, 0]));
  slots.forEach(({ item, slot }) => { const status = values[item.id]?.evidence?.[slot.id]?.status || "pending"; statusCounts[status] = (statusCounts[status] || 0) + 1; });
  const complete = slots.filter(({ item, slot }) => isEvidenceSlotComplete(slot, values[item.id]?.evidence?.[slot.id])).length;
  return { total: slots.length, complete, pending: statusCounts.pending || 0, incomplete: slots.length - complete, statusCounts };
}

export function ChecklistCoverageSummary({ coverage, onSelectAsset, displaySections = [], stationFormat = "SC" }) {
  if (!coverage) return null;
  const hasWarning = coverage.missingEquipmentCount > 0 || coverage.genericEquipmentCount > 0 || coverage.orphanAssetItemCount > 0;
  const format = String(stationFormat || "SC").toUpperCase() === "IMPS" ? "IMPS" : "SC";
  const displayGroups = getChecklistQueueGroups(displaySections, format)
    .map((group) => ({
      ...group,
      sections: group.sections.map((section) => ({
        ...section,
        applicableItemCount: section.items.filter((item) => item.applicable !== false && item.checklistDisabled !== true).length,
      })).filter((section) => section.applicableItemCount > 0),
    }))
    .filter((group) => group.sections.length > 0);
  const renderEquipmentList = (equipment) => <ul className="ops-coverage-asset-list">{equipment.map((asset) => <li key={asset.id}>{onSelectAsset
    ? <button type="button" onClick={() => onSelectAsset(asset)}>{[asset.assetNo || "ไม่มี Asset No.", getEquipmentDisplayLabel(asset)].filter(Boolean).join(" · ")}</button>
    : <span>{[asset.assetNo || "ไม่มี Asset No.", getEquipmentDisplayLabel(asset)].filter(Boolean).join(" · ")}</span>}</li>)}</ul>;
  return <div className={`ops-coverage-summary ${hasWarning ? "is-warning" : "is-complete"}`} role={hasWarning ? "status" : undefined}>
    <Icon name={hasWarning ? "alert" : "check"} />
    <div>
      <strong>{hasWarning ? "ควรตรวจสอบความครบถ้วน" : "อุปกรณ์มีรายการตรวจครบ"}</strong>
      <span>มีรายการตรวจเฉพาะอุปกรณ์ {coverage.coveredEquipmentCount}/{coverage.equipmentCount} ตัว · งานระดับสถานี {coverage.stationItemCount} รายการ · งานระดับ Lane {coverage.laneItemCount} รายการ</span>
      {coverage.missingEquipmentCount > 0 && <><span>อุปกรณ์เหล่านี้ยังไม่มี Checklist เฉพาะ ตรวจความสัมพันธ์กับระบบแม่หรือ Cabinet ก่อนสร้างรอบใหม่</span>{renderEquipmentList(coverage.missingEquipment)}</>}
      {coverage.genericEquipmentCount > 0 && <><span>อุปกรณ์กำหนดเองที่มีเพียงรายการทั่วไป ยังไม่มีรายการตรวจเฉพาะด้าน</span>{renderEquipmentList(coverage.genericEquipment)}</>}
      {coverage.orphanAssetItemCount > 0 && <span>พบรายการตรวจที่ไม่ตรงกับอุปกรณ์ในทะเบียน {coverage.orphanAssetItemCount} รายการ</span>}
      {displayGroups.length > 0 && <div className="ops-coverage-groups" aria-label={`จำนวนรายการตรวจแยกตามกลุ่ม ${format}`}>
        <strong>จำนวนรายการตรวจตามชุดระบบ {format}</strong>
        <ul>{displayGroups.map((group) => <li key={group.id}><span>{group.title}</span><small>{group.sections.map((section) => `${section.queueDisplayCode || section.code} · ${section.title} ${section.applicableItemCount} รายการ`).join(" · ")}</small></li>)}</ul>
      </div>}
    </div>
  </div>;
}
