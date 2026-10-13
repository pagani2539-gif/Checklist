import CustomSelect from "../CustomSelect.jsx";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatThaiDateTimeInput } from "../../domain/date-time.js";

export default function VehicleTestReplacementDialog({ targetLabel, oldCriteria, oldCount, oldDecided, initialLimit, fixedLimit = false, onReplace, onClose, DateTimePicker, serverSaveError = null, serverWritable = true }) {
  const dialogRef = useRef(null);
  const [criteria, setCriteria] = useState({ ...oldCriteria });
  const [limit, setLimit] = useState(fixedLimit || initialLimit !== 0 ? 100 : 0);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const busyRef = useRef(false);
  busyRef.current = busy;
  useEffect(() => {
    const previousFocus = document.activeElement;
    const app = document.getElementById("root");
    const previousInert = app?.inert;
    if (app) app.inert = true;
    dialogRef.current.querySelector("button")?.focus();
    const handleKey = event => {
      if (document.querySelector(".ops-date-time-popover, .ops-custom-select-menu")) return;
      if (event.key === "Escape") { event.preventDefault(); if (!busyRef.current) onClose(); }
      if (event.key !== "Tab") return;
      const controls = [...dialogRef.current.querySelectorAll("button:not(:disabled), input:not(:disabled), select:not(:disabled)")];
      if (!controls.length) { event.preventDefault(); return; }
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("keydown", handleKey); if (app) app.inert = previousInert; previousFocus?.focus?.(); };
  }, []);
  const changeCriteria = (key, value) => { setCriteria(current => ({ ...current, [key]: value })); setError(""); };
  const submit = async event => {
    event.preventDefault();
    if (!confirmed || busy) return;
    setBusy(true);
    setError("");
    try { await onReplace({ criteria, limit }); onClose(); }
    catch (failure) { setError(failure.message || "เปลี่ยนชุดไม่สำเร็จ ชุดเดิมยังอยู่"); }
    finally { setBusy(false); }
  };
  return createPortal(<div className="ops-dialog-layer"><section ref={dialogRef} role="dialog" aria-modal="true" className="ops-vehicle-replacement-dialog" aria-labelledby="vehicle-replacement-title">
    <form onSubmit={submit}>
      <h2 id="vehicle-replacement-title">เปลี่ยนชุดทดสอบ · {targetLabel}</h2>
      <p>ชุดเดิม {oldCount} คัน · บันทึกผลแล้ว {oldDecided} คัน</p>
      <p className="ops-vehicle-replacement-old-period">{formatThaiDateTimeInput(oldCriteria.startAt)} ถึง {formatThaiDateTimeInput(oldCriteria.endAt)}</p>
      <div className="ops-vehicle-replacement-fields">
        <label className="ops-field"><span>วันและเวลาเริ่มชุดใหม่ (เวลาไทย)</span><DateTimePicker value={criteria.startAt} label="วันและเวลาเริ่มชุดใหม่" disabled={busy} onChange={value => changeCriteria("startAt", value)} /></label>
        <label className="ops-field"><span>วันและเวลาสิ้นสุดชุดใหม่ (เวลาไทย)</span><DateTimePicker value={criteria.endAt} label="วันและเวลาสิ้นสุดชุดใหม่" disabled={busy} onChange={value => changeCriteria("endAt", value)} /></label>
        <label className="ops-field"><span>จำนวนรถในชุดใหม่</span><CustomSelect value={limit} disabled={busy || fixedLimit} onChange={event => setLimit(Number(event.target.value))}><option value={100}>{fixedLimit ? "เป้าหมาย 100 คัน (ใช้เท่าที่มี)" : "สุ่มกระจาย 100 คัน"}</option>{!fixedLimit && <option value={0}>ใช้รถทุกคัน</option>}</CustomSelect></label>
      </div>
      <p className="ops-vehicle-replacement-warning">ผลตรวจ สาเหตุ และหมายเหตุของชุด{targetLabel}เดิมจะถูกแทนที่ ต้องตรวจชุดใหม่อีกครั้ง ชุดอื่นยังอยู่เดิม</p>
      <label className="ops-vehicle-replacement-confirm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} /><span>ยืนยันแทนชุด{targetLabel}เดิม โดยไม่เก็บเป็นชุดย้อนหลัง</span></label>
      <p>ระบบจะเปลี่ยนชุดเมื่อดึงข้อมูลใหม่ พบรถ และบันทึกสำเร็จเท่านั้น</p>
      {error && <p role="alert" className="ops-vehicle-replacement-error">{error}</p>}
      {serverSaveError && <p role="alert" className="ops-vehicle-replacement-error">สาเหตุที่บันทึกล่าสุดไม่สำเร็จ: {serverSaveError.message}{serverSaveError.detail && <small>รายละเอียดจากระบบ: {serverSaveError.detail}</small>}{serverSaveError.requestId && <small>รหัสติดตาม: {serverSaveError.requestId}</small>}</p>}
      {!serverWritable && <p role="status" className="ops-vehicle-replacement-error">ยังบันทึกไม่ได้ กรุณาปิดหน้าต่างนี้แล้วกด “โหลดข้อมูลล่าสุด” ก่อนลองอีกครั้ง</p>}
      <footer><button type="button" className="ops-button ops-button-secondary" disabled={busy} onClick={onClose}>ยกเลิก</button><button type="submit" className="ops-button ops-button-primary" disabled={!confirmed || busy || !serverWritable}>{busy ? "กำลังดึงและบันทึกชุดใหม่…" : "ดึงข้อมูลและแทนชุดเดิม"}</button></footer>
    </form>
  </section></div>, document.body);
}
