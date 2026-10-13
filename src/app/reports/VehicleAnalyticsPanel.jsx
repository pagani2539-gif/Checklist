import { useEffect, useMemo, useRef, useState } from "react";
import { VehicleAnalyticsTable } from "./VehicleAnalyticsTable.jsx";
import { EvidenceImages, PlateComparison } from "./VehicleSnapshotEvidence.jsx";
import { VehicleClassComparison } from "../vehicle-review/VehicleClassExample.jsx";
import { AppIcon } from "../icon-system.jsx";
import { formatBangkokDateTime } from "../../domain/date-time.js";
import "../../styles/vehicle-analytics.css";

const statusLabel = { correct: "ถูกต้อง", incorrect: "ไม่ถูกต้อง", "unable-to-verify": "ไม่สามารถตรวจสอบได้", pending: "รอตรวจสอบ" };

function AnalyticsSection({ section, onOpen }) {
  const [expanded, setExpanded] = useState(false);
  const visible = section.ranked && !expanded ? section.rows.slice(0, 10) : section.rows;
  const classRanking = section.dimension === "classification" && ["api", "confirmed", "agreed"].includes(section.key);
  const classPairs = section.dimension === "classification" && section.pairs;
  const sectionClass = ["vehicle-analytics-section", classRanking && "is-class-ranking", section.key === "agreed" && "is-class-agreed", classPairs && "is-class-pairs"].filter(Boolean).join(" ");
  return <section className={sectionClass}><h3>{section.title}</h3><VehicleAnalyticsTable section={{ ...section, rows: visible }} onOpen={onOpen} />{section.ranked && section.rows.length > 10 && <button type="button" className="ops-button ops-button-secondary" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? "แสดง 10 อันดับแรก" : `ดูทั้งหมด ${section.rows.length} กลุ่ม`}</button>}</section>;
}

export function VehicleAnalyticsPanel({ pages, metadata, roundId }) {
  const [selection, setSelection] = useState(null);
  const [offset, setOffset] = useState(0);
  const dialog = useRef(null);
  const scopes = useMemo(() => {
    const grouped = new Map();
    for (const page of pages.filter(page => page.kind === "analytics")) {
      const scopeKey = `${page.systemKey || "legacy"}-${page.dimension}-${page.period.key}`;
      const scope = grouped.get(scopeKey) || { key: scopeKey, systemKey: page.systemKey || "legacy", systemLabel: page.systemLabel, dimension: page.dimension, period: page.period, total: page.total, sections: new Map() };
      const section = scope.sections.get(page.analytics.key) || { ...page.analytics, id: `${scopeKey}-${page.analytics.key}`, rows: [] };
      section.rows.push(...page.analytics.rows);
      scope.sections.set(page.analytics.key, section);
      grouped.set(scopeKey, scope);
    }
    return [...grouped.values()].map(scope => ({ ...scope, sections: [...scope.sections.values()] }));
  }, [pages]);
  useEffect(() => {
    if (selection) dialog.current?.showModal();
    else if (dialog.current?.open) dialog.current.close();
  }, [selection]);
  const open = (section, row, status) => {
    setOffset(0);
    setSelection({ section, label: row.label, entries: row.entries.filter(entry => !status || entry.status === status) });
  };
  return <div className="vehicle-analytics-panel no-print">
    <h2>สรุปข้อมูลชุดตรวจแบบละเอียด</h2>
    <p>{metadata?.stationName || "สถานี"} · รอบ {metadata?.documentNo || roundId} · วันที่ตรวจ {metadata?.inspectionDate || "ไม่ระบุ"}</p>
    <p>สรุปเฉพาะรายการในชุดตรวจ รถคันเดิมผ่านหลายครั้งอาจนับหลายรายการ กดจำนวนเพื่อดูรถและภาพหลักฐาน บนมือถือเลื่อนตารางซ้าย–ขวาได้</p>
    {scopes.map(scope => <section key={scope.key} className={`vehicle-analytics-scope${scope.dimension === "classification" ? " is-classification" : ""}`}>
      <header className="vehicle-analytics-scope-heading">
        {scope.dimension === "classification" && <AppIcon name="truck" size="small" aria-hidden="true" />}
        <p>{scope.systemLabel || "ระบบที่เลือก"} · {scope.dimension === "plate" ? "ป้ายทะเบียน" : "คัดแยกประเภทรถ"}{scope.dimension === "plate" ? ` · ${scope.period.label}` : ""} · {scope.total} รายการ</p>
      </header>
      <div className={`vehicle-analytics-sections${scope.dimension === "classification" ? " is-classification" : ""}`}>
        {scope.sections.map(section => <AnalyticsSection key={section.id} section={section} onOpen={(row, status) => open(section, row, status)} />)}
      </div>
    </section>)}
    <dialog ref={dialog} className="vehicle-analytics-dialog" aria-labelledby="vehicle-analytics-dialog-title" onClose={() => setSelection(null)}>
      {selection && <><header><h2 id="vehicle-analytics-dialog-title">หลักฐาน · {selection.label}</h2><button type="button" className="ops-button ops-button-secondary" onClick={() => dialog.current.close()}>ปิด</button></header><p>{selection.section.systemLabel || "ระบบที่เลือก"} · {selection.section.periodLabel ? `${selection.section.periodLabel} · ` : ""}{selection.entries.length} รายการ</p>
      <div className="vehicle-analytics-evidence">{selection.entries.slice(offset, offset + 10).map((entry, index) => <article key={`${entry.row.id}-${offset + index}`}><h3>{entry.row.plateNumber || "ไม่พบทะเบียน"} · {statusLabel[entry.status]}</h3><p>{formatBangkokDateTime(entry.row.occurredAt)} · ช่องทาง {entry.row.lane || "ไม่ระบุ"}</p><EvidenceImages row={entry.row} dimension={selection.section.dimension} />{selection.section.dimension === "plate" ? <PlateComparison entry={entry} status={entry.status} /> : <VehicleClassComparison originalLabel={entry.row.vehicleClassLabel} status={entry.status} correctedValue={entry.detail.correctedValue} />}<p>เหตุผล: {entry.reasonLabel || "ไม่ระบุ"}</p>{entry.detail.note && <p>หมายเหตุ: {entry.detail.note}</p>}<small>รหัสรายการ {entry.row.id}</small></article>)}</div>
      <nav aria-label="หน้ารายการหลักฐาน"><button type="button" className="ops-button ops-button-secondary" disabled={offset === 0} onClick={() => setOffset(value => value - 10)}>ก่อนหน้า</button><span>{offset + 1}–{Math.min(offset + 10, selection.entries.length)} / {selection.entries.length}</span><button type="button" className="ops-button ops-button-secondary" disabled={offset + 10 >= selection.entries.length} onClick={() => setOffset(value => value + 10)}>ถัดไป</button></nav></>}
    </dialog>
  </div>;
}
