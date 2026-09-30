import { useEffect, useRef, useState } from "react";
import { conflictPathKey, formatConflictPath, getConflictPathValue } from "../domain/state-merge.js";

function previewValue(result) {
  if (!result?.exists) return "ไม่มีค่านี้ในฉบับนี้ (อาจเป็นการลบรายการ)";
  if (typeof result.value === "string") return result.value || "ค่าว่าง";
  if (result.value == null || typeof result.value !== "object") return String(result.value);
  const serialized = JSON.stringify(result.value, null, 2);
  return serialized.length > 1800 ? `${serialized.slice(0, 1800)}\n…` : serialized;
}

export default function ServerConflictResolver({ conflict, onDownload, onResolve, onDiscard }) {
  const [choices, setChoices] = useState({});
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef(null);
  const merge = conflict?.merge;
  const paths = Array.isArray(merge?.paths) ? merge.paths : [];

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const keepFocusInside = (event) => {
    if (event.key !== "Tab") return;
    const focusable = [...(dialogRef.current?.querySelectorAll("button:not(:disabled), input:not(:disabled)") || [])];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const resolve = async () => {
    setSaving(true);
    try {
      await onResolve(choices);
    } finally {
      setSaving(false);
    }
  };

  return <div className="ops-server-conflict-overlay">
    <section ref={dialogRef} tabIndex={-1} onKeyDown={keepFocusInside} className="ops-server-conflict-dialog" role="dialog" aria-modal="true" aria-labelledby="ops-server-conflict-title" aria-describedby="ops-server-conflict-description">
      <header className="ops-server-conflict-dialog-heading">
        <p className="ops-eyebrow">ตรวจรายการที่แก้ชนกัน</p>
        <h2 id="ops-server-conflict-title">รวม draft กับข้อมูลส่วนกลาง</h2>
        <p id="ops-server-conflict-description">ระบบรวมรายการที่แก้คนละจุดให้แล้ว เหลือ {paths.length} จุดที่ค่าใน draft และส่วนกลางต่างกัน เลือกค่าที่ต้องการเก็บในแต่ละจุดก่อนบันทึก</p>
      </header>

      <div className="ops-server-conflict-list">
        {paths.map((entry) => {
          const key = conflictPathKey(entry.path);
          const selected = choices[key] || "central";
          const centralValue = getConflictPathValue(merge.candidateState, entry.path);
          const draftValue = getConflictPathValue(conflict.draftState, entry.path);
          return <fieldset className="ops-server-conflict-item" key={key}>
            <legend>{formatConflictPath(entry.path)}</legend>
            <label className={`ops-server-conflict-choice ${selected === "central" ? "is-selected" : ""}`}>
              <input type="radio" name={key} checked={selected === "central"} onChange={() => setChoices((current) => ({ ...current, [key]: "central" }))} />
              <span><strong>ใช้ค่าจากส่วนกลาง</strong><pre>{previewValue(centralValue)}</pre></span>
            </label>
            <label className={`ops-server-conflict-choice ${selected === "draft" ? "is-selected" : ""}`}>
              <input type="radio" name={key} checked={selected === "draft"} onChange={() => setChoices((current) => ({ ...current, [key]: "draft" }))} />
              <span><strong>ใช้ค่าจาก draft นี้</strong><pre>{previewValue(draftValue)}</pre></span>
            </label>
          </fieldset>;
        })}
      </div>

      <footer className="ops-server-conflict-dialog-actions">
        <button type="button" className="ops-button ops-button-secondary" onClick={onDownload} disabled={saving}>ดาวน์โหลด draft</button>
        <button type="button" className="ops-button ops-button-danger" onClick={onDiscard} disabled={saving || !conflict.downloaded}>ทิ้ง draft และโหลดส่วนกลาง</button>
        <button type="button" className="ops-button ops-button-primary" onClick={resolve} disabled={saving}>{saving ? "กำลังรวมข้อมูล…" : "บันทึกการรวมข้อมูล"}</button>
      </footer>
    </section>
  </div>;
}
