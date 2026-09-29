import { AppIcon as Icon } from "./icon-system.jsx";

export function PageHeader({ eyebrow, title, description, actions, children }) {
  return <div className="ops-page-header"><div><p className="ops-eyebrow">{eyebrow}</p><h1 id="page-heading" tabIndex="-1">{title}</h1>{description && <p className="ops-page-description">{description}</p>}</div>{actions || children}</div>;
}

export function Breadcrumb({ items }) {
  return <nav className="ops-breadcrumb" aria-label="เส้นทางหน้าปัจจุบัน">{items.map((item, index) => <span key={`${item.label}-${index}`}>{index > 0 && <span aria-hidden="true">/</span>}{item.href ? <a className={item.mono ? "ops-code" : undefined} href={item.href}>{item.label}</a> : <strong className={item.mono ? "ops-code" : undefined}>{item.label}</strong>}</span>)}</nav>;
}

export function EmptyState({ icon = "info", title, children, action }) {
  return <div className="ops-empty"><span className="ops-empty-icon"><Icon name={icon} /></span><strong>{title}</strong>{children && <span>{children}</span>}{action}</div>;
}

export function ProgressBar({ value, label = "ความคืบหน้า" }) {
  return <div className="ops-progress-wrap"><div className="ops-progress-label"><span>{label}</span><strong>{value}%</strong></div><div className="ops-progress-track" role="progressbar" aria-label={label} aria-valuemin="0" aria-valuemax="100" aria-valuenow={value}><span style={{ width: `${value}%` }} /></div></div>;
}
