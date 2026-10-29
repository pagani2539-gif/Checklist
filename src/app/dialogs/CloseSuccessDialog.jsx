import { useEffect, useRef } from "react";
import { Button } from "../controls/ActionControls.jsx";
import { AppIcon as Icon } from "../icon-system.jsx";

export function CloseSuccessDialog({ onClose }) {
  const acknowledgeRef = useRef(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const frame = window.requestAnimationFrame(() => acknowledgeRef.current?.focus());
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
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [onClose]);

  return <div className="ops-dialog-layer" role="presentation">
    <section className="ops-dialog ops-close-success-dialog" role="dialog" aria-modal="true" aria-labelledby="close-success-dialog-title" aria-describedby="close-success-dialog-description">
      <div className="ops-dialog-icon"><Icon name="check" /></div>
      <div className="ops-dialog-content">
        <p className="ops-eyebrow">บันทึกรอบการตรวจแล้ว</p>
        <h2 id="close-success-dialog-title">ปิดรอบการตรวจสำเร็จ</h2>
        <p id="close-success-dialog-description">บันทึกรอบนี้ไว้ในประวัติแล้ว</p>
      </div>
      <div className="ops-dialog-actions">
        <Button buttonRef={acknowledgeRef} onClick={onClose} variant="primary">รับทราบ</Button>
      </div>
    </section>
  </div>;
}
