import { AppIcon } from "./icon-system.jsx";

export default function SaveStatus({ label, icon = "save", className = "" }) {
  return <span className={`${className} ops-save-status-icon`} role="status" aria-live="polite" tabIndex={0} aria-label={label}>
    <AppIcon name={icon} size="small" />
    <span className="sr-only">{label}</span>
    <span className="ops-save-status-tooltip" aria-hidden="true">{label}</span>
  </span>;
}
