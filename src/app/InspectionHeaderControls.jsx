import { useEffect, useRef, useState } from "react";
import { AppIcon } from "./icon-system.jsx";
import { canNavigateBackInApp, canNavigateForwardInApp, navigateBack, navigateForward } from "./navigation.js";

export function InspectionNavigation() {
  return <nav className="ops-inspection-navigation" aria-label="ประวัติการเปิดหน้า">
    <button type="button" className="ops-button ops-button-secondary ops-navigation-icon" aria-label="ย้อนกลับ" title="ย้อนกลับ" onClick={() => navigateBack()} disabled={!canNavigateBackInApp()}><AppIcon name="arrow-left" /></button>
    <button type="button" className="ops-button ops-button-secondary ops-navigation-icon" aria-label="เดินหน้า" title="เดินหน้า" onClick={navigateForward} disabled={!canNavigateForwardInApp()}><AppIcon name="arrow-right" /></button>
  </nav>;
}

export function InspectionAccountMenu({ user, refreshServerState, saveFailed }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = event => { if (!menuRef.current?.contains(event.target)) setOpen(false); };
    const onKeyDown = event => {
      if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);
  return <div className="ops-inspection-account-controls">
    {saveFailed && <button type="button" className="ops-button ops-button-secondary" onClick={refreshServerState}>โหลดข้อมูลล่าสุด</button>}
    {user && <div ref={menuRef} className="ops-inspection-account" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
      <button ref={triggerRef} type="button" className="ops-button ops-button-secondary" aria-expanded={open} aria-controls="inspection-account-panel" onClick={() => setOpen(value => !value)}>บัญชี ▾</button>
      {open && <div id="inspection-account-panel" className="ops-inspection-account-panel">
        <strong>{user.displayName}</strong>
        <button type="button" className="ops-button ops-button-secondary" onClick={async () => {
          const response = await fetch("/api/v1/auth/logout", { method: "POST", credentials: "include" });
          if (response.ok) window.location.reload();
        }}>ออกจากระบบ</button>
      </div>}
    </div>}
  </div>;
}
