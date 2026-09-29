import { useEffect, useRef } from "react";
import { Button } from "../controls/ActionControls.jsx";
import { AppIcon as Icon } from "../icon-system.jsx";
import { domSafeId } from "../dom-safe-id.js";

export function CloseReadinessDialog({ blockers = [], issues = [], sections = [], allowConfirm = false, onNavigate, onClose, onConfirm }) {
  const cancelRef = useRef(null);
  const photoBlockers = blockers.filter((entry) => entry.type === "evidence-photo");
  const dialogTitle = !allowConfirm
    ? "ยังปิดรอบการตรวจไม่ได้"
    : blockers.length
      ? "ปิดรอบพร้อมข้อมูลค้างได้"
      : "ปิดรอบพร้อมรายการติดตามได้";
  const dialogDescription = !allowConfirm
    ? "มีเงื่อนไขที่ยังปิดรอบไม่ได้ กรุณาแก้เงื่อนไขเหล่านี้ตามรายการด้านล่างก่อนยืนยันปิดรอบ"
    : photoBlockers.length
      ? `ยังมีข้อมูลตรวจหรือหลักฐานค้าง ${blockers.length} รายการ รวมรูปที่ขาด ${photoBlockers.length} ช่อง สามารถยืนยันปิดรอบได้ และประวัติจะเก็บสถานะที่ขาดไว้ตามจริง`
      : blockers.length
        ? "ผลตรวจ หลักฐาน หรือข้อมูลจาก Vehicle API บางส่วนยังไม่ครบ สามารถยืนยันปิดรอบได้ โดยระบบจะเก็บสถานะที่กรอกไว้ตามจริงในประวัติ"
        : "พบรายการที่ต้องติดตาม สามารถยืนยันปิดรอบได้ และรายการติดตามจะแสดงในประวัติและรายงาน";
  const findSection = (entry) => sections.find((section) => section.items.some((item) => item.id === entry.itemId))
    || sections.find((section) => section.code === entry.sectionCode);
  const findItem = (entry) => findSection(entry)?.items.find((item) => item.id === entry.itemId);
  const findSlot = (entry, item) => item?.evidenceSlots?.find((slot) => slot.id === entry.slotId);
  const groups = [];
  const groupMap = new Map();
  [...blockers.map((entry) => ({ entry, kind: "blocker" })), ...issues.map((entry) => ({ entry, kind: "issue" }))].forEach((record) => {
    const section = findSection(record.entry);
    const key = section?.code || record.entry.sectionCode || "other";
    let group = groupMap.get(key);
    if (!group) {
      group = { code: section?.code || record.entry.sectionCode || "—", title: section?.title || "รายการอื่น ๆ", records: [] };
      groupMap.set(key, group);
      groups.push(group);
    }
    group.records.push(record);
  });

  useEffect(() => {
    const previousFocus = document.activeElement;
    const frame = window.requestAnimationFrame(() => cancelRef.current?.focus());
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [onClose]);

  return <div className="ops-dialog-layer" role="presentation">
    <section className="ops-dialog ops-close-readiness-dialog" role="dialog" aria-modal="true" aria-labelledby="close-readiness-dialog-title" aria-describedby="close-readiness-dialog-description">
      <div className="ops-dialog-icon"><Icon name="alert" /></div>
      <div className="ops-dialog-content">
        <p className="ops-eyebrow">ตรวจความพร้อมก่อนปิดรอบ</p>
        <h2 id="close-readiness-dialog-title">{dialogTitle}</h2>
        <p id="close-readiness-dialog-description">{dialogDescription}</p>
        <div className="ops-close-readiness-summary" role="status">
          {blockers.length > 0 && <strong>{allowConfirm ? `ข้อมูลยังไม่ครบ ${blockers.length} รายการ` : "ยังมีเงื่อนไขที่ต้องแก้ก่อนปิด"}</strong>}
          {issues.length > 0 && <span>รายการติดตาม {issues.length} รายการ</span>}
        </div>
        <div className="ops-close-readiness-groups">
          {groups.map((group) => <section className="ops-close-readiness-group" key={group.code} aria-labelledby={`close-readiness-group-${domSafeId(group.code)}`}>
            <header><div><strong id={`close-readiness-group-${domSafeId(group.code)}`}>หมวด {group.code}</strong><span>{group.title}</span></div><em>{group.records.length} รายการ</em></header>
            <div className="ops-close-readiness-items">
              {group.records.map(({ entry, kind }) => {
                const item = findItem(entry);
                const slot = findSlot(entry, item);
                const itemLabel = item?.assetNo && !String(item.label || "").includes(item.assetNo)
                  ? `${item.assetNo} · ${item.label}`
                  : item?.label || entry.label;
                return <button type="button" className="ops-close-readiness-item" key={entry.id} onClick={() => onNavigate(entry)}>
                  <span className="ops-close-readiness-item-icon"><Icon name={kind === "issue" ? "alert" : entry.type === "evidence-photo" ? "camera" : "info"} size="small" /></span>
                  <span className="ops-close-readiness-item-copy"><strong>{itemLabel}</strong><small>{slot?.displayLabel ? `${slot.displayLabel} · ` : ""}{entry.message}</small></span>
                  <span className="ops-close-readiness-item-action">ไปแก้ <Icon name="arrow" size="small" /></span>
                </button>;
              })}
            </div>
          </section>)}
        </div>
      </div>
      <div className="ops-dialog-actions">
        <Button buttonRef={cancelRef} onClick={onClose} variant="secondary">{allowConfirm ? "ยกเลิก" : "ปิดรายการ"}</Button>
        {allowConfirm && <Button onClick={onConfirm} variant="primary" icon="archive">ยืนยันปิดรอบการตรวจ</Button>}
      </div>
    </section>
  </div>;
}
