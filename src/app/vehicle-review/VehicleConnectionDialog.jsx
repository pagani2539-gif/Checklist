import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export default function VehicleConnectionDialog({ current, latest, readOnly, changed, hasData, ready, writable, busy, adopted, stationHref, onAdopt, onClose }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const root = document.getElementById("root");
    const previousInert = root?.inert;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (root) root.inert = true;
    dialogRef.current.querySelector("button")?.focus();
    const handleKey = event => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key !== "Tab") return;
      const controls = [...dialogRef.current.querySelectorAll("button:not(:disabled), a[href]")];
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      if (root) root.inert = previousInert;
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [onClose]);
  const url = config => config?.searchUrl || config?.baseUrl || "ยังไม่มี API";
  return createPortal(<div className="ops-dialog-layer">
    <section ref={dialogRef} className="ops-vehicle-connection-dialog" role="dialog" aria-modal="true" aria-labelledby="vehicle-connection-title">
      <header><h2 id="vehicle-connection-title">การเชื่อมต่อ API</h2><button type="button" className="ops-button ops-button-secondary" onClick={onClose}>ปิด</button></header>
      <dl><dt>API ของรอบนี้</dt><dd>{url(current)}</dd><dt>API ล่าสุดในทะเบียนสถานี</dt><dd>{url(latest)}</dd></dl>
      {readOnly ? <p role="status">รอบปิดแล้ว · เปิดดูได้อย่างเดียว</p>
        : hasData ? <p role="status">ระบบนี้มีชุดข้อมูลรถแล้ว จึงเปลี่ยนค่าเชื่อมต่อไม่ได้ เพื่อรักษาแหล่งข้อมูลและหลักฐานเดิม</p>
          : !ready ? <p>ตั้งค่า API ของระบบนี้ในทะเบียนสถานีก่อน แล้วกลับมารับค่าในรอบนี้ <a href={stationHref}>เปิดทะเบียนสถานี</a></p>
            : !changed && <p role="status">ค่าเชื่อมต่อตรงกับทะเบียนสถานีแล้ว</p>}
      {adopted && <p>รับค่า API สำหรับรอบนี้แล้ว · สำเนาข้อมูลตอนเปิดรอบยังอยู่เดิม</p>}
      {!writable && !readOnly && <p role="status">ยังบันทึกไม่ได้ กรุณาโหลดข้อมูลล่าสุดก่อนรับค่าใหม่</p>}
      <footer>{!readOnly && changed && !hasData && <button type="button" className="ops-button ops-button-primary" disabled={busy || !writable} onClick={onAdopt}>รับค่า API จากทะเบียนสถานี</button>}<button type="button" className="ops-button ops-button-secondary" onClick={onClose}>กลับหน้าตรวจ</button></footer>
    </section>
  </div>, document.body);
}
