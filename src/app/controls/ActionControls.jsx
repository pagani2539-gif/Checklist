import { useEffect, useRef, useState } from "react";
import { AppIcon as Icon } from "../icon-system.jsx";

export function Button({ href, children, variant = "secondary", icon, type = "button", onClick, disabled = false, className = "", buttonRef }) {
  const classes = `ops-button ops-button-${variant} ${className}`;
  if (href) return <a className={classes} href={href}>{icon && <Icon name={icon} />}{children}</a>;
  return <button ref={buttonRef} className={classes} type={type} onClick={onClick} disabled={disabled}>{icon && <Icon name={icon} />}{children}</button>;
}

export function ConfirmDialog({ request, onResolve }) {
  const [confirmationValue, setConfirmationValue] = useState("");
  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!request) return undefined;
    const previousFocus = document.activeElement;
    setConfirmationValue("");
    const focusFrame = window.requestAnimationFrame(() => {
      (request.requiredCode ? inputRef.current : cancelRef.current)?.focus();
    });
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onResolve(false);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll("button:not([disabled]), input:not([disabled])")];
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
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", onKeyDown);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [request, onResolve]);

  if (!request) return null;
  const requiredCode = String(request.requiredCode || "").trim();
  const canConfirm = !requiredCode || confirmationValue.trim() === requiredCode;
  const hasMismatch = Boolean(confirmationValue.trim()) && !canConfirm;

  return <div className="ops-dialog-layer" role="presentation">
    <section ref={dialogRef} className="ops-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description">
      <div className="ops-dialog-icon"><Icon name="alert" /></div>
      <div className="ops-dialog-content">
        <p className="ops-eyebrow">ยืนยันการดำเนินการ</p>
        <h2 id="confirm-dialog-title">{request.title}</h2>
        <p id="confirm-dialog-description">{request.description}</p>
        {request.details?.length ? <dl className="ops-dialog-details">{request.details.map((detail) => <div key={detail.label}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}</dl> : null}
        {requiredCode && <label className="ops-field ops-dialog-code-field"><span>{request.inputLabel || "พิมพ์รหัสสถานีเพื่อยืนยัน"}</span><input ref={inputRef} value={confirmationValue} onChange={(event) => setConfirmationValue(event.target.value)} autoComplete="off" spellCheck="false" aria-invalid={hasMismatch} aria-describedby={hasMismatch ? "confirm-dialog-error" : "confirm-dialog-hint"} placeholder={requiredCode} /></label>}
        {requiredCode && <span id="confirm-dialog-hint" className="ops-dialog-hint">พิมพ์ {requiredCode} ให้ตรงกับรหัสด้านบน</span>}
        {hasMismatch && <span id="confirm-dialog-error" className="ops-dialog-error" role="alert">{request.inputMismatchText || "ข้อมูลยืนยันยังไม่ตรง กรุณาตรวจสอบอีกครั้ง"}</span>}
      </div>
      <div className="ops-dialog-actions"><Button buttonRef={cancelRef} onClick={() => onResolve(false)} variant="secondary">ยกเลิก</Button><Button onClick={() => onResolve(true)} variant={request.confirmVariant || "danger"} icon={request.confirmIcon || "delete"} disabled={!canConfirm}>{request.confirmLabel || "ยืนยันลบ"}</Button></div>
    </section>
  </div>;
}
