import { useEffect, useState } from "react";
import { AppIcon } from "./icon-system.jsx";

export default function ThemePreference() {
  const [preference, setPreference] = useState(() => window.checklistTheme?.getPreference() || "system");
  useEffect(() => {
    const update = () => setPreference(window.checklistTheme?.getPreference() || "system");
    window.addEventListener("checklist-theme-change", update);
    return () => window.removeEventListener("checklist-theme-change", update);
  }, []);
  return <div className="ops-theme-preference" role="group" aria-label="สีหน้าจอ">
    <div className="ops-theme-options">
      {[["light", "สว่าง", "sun"], ["dark", "มืด", "moon"], ["system", "ตามเครื่อง", "display"]].map(([value, label, icon]) =>
        <button key={value} type="button" aria-label={label} aria-pressed={preference === value} onClick={() => window.checklistTheme?.setPreference(value)}>
          <AppIcon name={icon} />
          <span className="ops-theme-tooltip" aria-hidden="true">{label}</span>
        </button>)}
    </div>
  </div>;
}
