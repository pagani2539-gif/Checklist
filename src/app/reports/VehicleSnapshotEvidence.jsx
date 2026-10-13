import "../../styles/vehicle-snapshot-evidence.css";
import { VehicleClassComparison } from "../vehicle-review/VehicleClassExample.jsx";
import { VehicleHexSummary, VehicleReportGeometry } from './VehicleHexSummary.jsx';
import { useEffect, useRef, useState } from "react";
import { loadSnapshotImage, retrySnapshotImage, VEHICLE_EVIDENCE_RENDITION_MAX_LONG_EDGE } from "../../domain/vehicle-evidence-images.js";
import { getStoredAttachment } from "../../domain/attachments.js";
import { formatBangkokDateTime } from "../../domain/date-time.js";
import { buildVehicleSnapshotEvidencePages, getPlateEvidenceComparison } from "../../domain/vehicle-snapshot-evidence.js";
import { registerPrintableImageSource } from "./print-image-optimizer.js";
import { VehicleAnalyticsTable } from "./VehicleAnalyticsTable.jsx";
import "../../styles/vehicle-analytics.css";
import { VehicleAnalyticsPagination } from './VehicleAnalyticsPagination.jsx';

function SnapshotImage({ src, label, attachment }) {
  const failedRef = useRef(false);
  const [retry, setRetry] = useState(0);
  const [failed, setFailed] = useState(false);
  const [preview, setPreview] = useState("");
  const [ready, setReady] = useState(false);
  const [printPrepared, setPrintPrepared] = useState(false);
  useEffect(() => {
    const reload = () => { if (!failedRef.current) return; if (src) retrySnapshotImage(src); setRetry(value => value + 1); };
    window.addEventListener("checklist:retry-report-attachments", reload);
    return () => window.removeEventListener("checklist:retry-report-attachments", reload);
  }, [src]);
  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";
    let unregisterPrintSource = () => {};
    failedRef.current = false;
    setFailed(false);
    setReady(false);
    setPreview("");
    setPrintPrepared(false);
    if (src || attachment?.id) (async () => {
      const variants = [attachment?.renditions?.webp, attachment]
        .filter((entry, index, all) => entry?.id && all.findIndex(other => other?.id === entry.id) === index);
      for (const variant of variants) {
        try {
          const blob = await getStoredAttachment(variant.id);
          if (blob) return { blob, prepared: variant === attachment?.renditions?.webp || attachment?.type === "image/webp" && Math.max(Number(attachment.width) || 0, Number(attachment.height) || 0) > 0 && Math.max(Number(attachment.width) || 0, Number(attachment.height) || 0) <= VEHICLE_EVIDENCE_RENDITION_MAX_LONG_EDGE };
        } catch { /* Try the preserved original next. */ }
      }
      if (src) return { blob: await loadSnapshotImage(src), prepared: false };
      throw new Error("ไม่พบสำเนาภาพหลักฐาน");
    })().then(({ blob, prepared }) => {
      if (!blob) throw new Error("ไม่พบสำเนาภาพหลักฐาน");
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      unregisterPrintSource = registerPrintableImageSource(objectUrl, blob);
      setPrintPrepared(prepared);
      setPreview(objectUrl);
    }).catch(() => { if (!cancelled) { failedRef.current = true; setFailed(true); } });
    return () => { cancelled = true; if (objectUrl) { unregisterPrintSource(); URL.revokeObjectURL(objectUrl); } };
  }, [src, attachment?.id, attachment?.renditions?.webp?.id, retry]);
  return <figure className="snapshot-evidence-image" data-print-attachment={(!src && !attachment?.id) || ready ? "ready" : failed ? "missing" : "loading"}>{!src && !attachment?.id ? <span>ระบบไม่มีภาพต้นทาง</span> : failed ? <span>โหลดภาพไม่สำเร็จ</span> : preview ? <img src={preview} alt={label} data-print-image="true" data-print-prepared={printPrepared ? "true" : undefined} onLoad={() => setReady(true)} onError={() => { failedRef.current = true; setFailed(true); }} /> : <span>กำลังโหลดหลักฐาน…</span>}<figcaption>{label}</figcaption></figure>;
}

export function EvidenceImages({ row, dimension }) {
  return <div className="snapshot-evidence-images">{dimension === "plate" ? <><SnapshotImage src={row.plateImage} attachment={row.apiEvidenceImages?.plateImage} label="ภาพป้ายทะเบียน" /><SnapshotImage src={row.lprImage} attachment={row.apiEvidenceImages?.lprImage} label="ภาพกล้อง LPR" /></> : <SnapshotImage src={row.overviewImage} attachment={row.apiEvidenceImages?.overviewImage} label="ภาพรถ" />}</div>;
}

export function PlateComparison({ entry, status }) {
  return <table className="snapshot-plate-comparison"><thead><tr><th>ข้อมูล</th><th>ข้อมูลจากระบบ</th><th>ข้อมูลที่ผู้ตรวจสอบยืนยัน</th></tr></thead><tbody>{getPlateEvidenceComparison(entry,status).map(field => <tr key={field.key} className={field.different ? "is-different" : ""}><th>{field.label}</th><td>{field.value || "ไม่พบข้อมูล"}</td><td>{field.confirmed}</td></tr>)}</tbody></table>;
}

export function VehicleEvidenceReadiness() {
  const ref = useRef(null);
  const [counts, setCounts] = useState({ total: 0, ready: 0, loading: 0, failed: 0, absent: 0, fieldPhotos: 0 });
  useEffect(() => {
    const report = ref.current?.closest(".ops-print-report");
    if (!report) return;
    const read = () => {
      const images = [...report.querySelectorAll(".snapshot-evidence-image")];
      const next = { fieldPhotos: report.querySelectorAll(".ops-print-attachment img").length, total: images.length, ready: images.filter(el => el.querySelector("img")?.naturalWidth > 0).length, loading: images.filter(el => el.dataset.printAttachment === "loading").length, failed: images.filter(el => el.dataset.printAttachment === "missing").length, absent: images.filter(el => el.textContent.includes("ระบบไม่มีภาพต้นทาง")).length };
      setCounts(current => JSON.stringify(current) === JSON.stringify(next) ? current : next);
    };
    const observer = new MutationObserver(read);
    observer.observe(report, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-print-attachment"] });
    read();
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className="snapshot-image-readiness" role="status">ภาพหลักฐานจากระบบ โหลดแล้ว {counts.ready}/{counts.total - counts.absent} ภาพ · รอโหลด {counts.loading} · โหลดไม่สำเร็จ {counts.failed} · ระบบไม่มีภาพต้นทาง {counts.absent} ช่อง · ภาพหน้างาน: {counts.fieldPhotos ? `${counts.fieldPhotos} ภาพในรายงาน` : "ยังไม่มีไฟล์ภาพแนบในรอบนี้"}{counts.failed > 0 && <button type="button" className="ops-button ops-button-secondary" onClick={() => window.dispatchEvent(new CustomEvent("checklist:retry-report-attachments"))}>ลองโหลดภาพที่ไม่สำเร็จ</button>}</div>;
}

export function VehicleSnapshotEvidencePage(props) {
  if (props.page.kind === 'analytics') return <VehicleAnalyticsPagination page={props.page} presentation={props.presentation} renderPage={page => props.wrapPage ? props.wrapPage(<VehicleSnapshotEvidencePageContent {...props} page={page} />, page.page === page.pageCount) : <VehicleSnapshotEvidencePageContent {...props} page={page} />} />;
  const content = <VehicleSnapshotEvidencePageContent {...props} />;
  return props.wrapPage ? props.wrapPage(content, true) : content;
}

function VehicleSnapshotEvidencePageContent({ page, metadata = {}, presentation = false, renderAttachment }) {
  const date = value => value ? formatBangkokDateTime(value) : "ไม่พบเวลา";
  return <section className={`snapshot-vehicle-page is-${page.kind} is-${page.dimension}${presentation ? " is-presentation" : ""}`} data-snapshot-vehicle-kind={page.kind} data-snapshot-period={page.period.key} data-snapshot-result={page.group?.key} data-snapshot-reason={page.group?.reasonKey} data-snapshot-analytics={page.analytics?.key}>
    <VehicleReportGeometry /><header className="snapshot-vehicle-heading"><div><span>{metadata.stationName || "หลักฐานจากรอบตรวจ"}{page.dimension === "classification" ? "" : ` · ${page.period.label}`}</span><h2>{page.systemLabel ? `${page.systemLabel} · ` : ""}{page.title}</h2></div><div><strong>{page.kind === "analytics" ? "สรุปข้อมูลชุดตรวจ" : page.kind === "summary" ? "สรุปผลตรวจ" : page.kind === "reasons" ? "สรุปสาเหตุและจำนวน" : page.kind === "excluded" ? "ภาคผนวก · แยกจากคะแนน" : page.group?.label}</strong>{page.kind !== "analytics" && page.group && <span>{page.group.reasonLabel || ""} · {page.group.entries.length} รายการในกลุ่มนี้</span>}{page.kind !== "summary" && <small>{page.kind === "analytics" ? "อันดับและผลตรวจแยกกลุ่ม" : page.kind === "reasons" ? "สาเหตุที่ผู้ตรวจบันทึก" : page.kind === "detail" ? "ขยายหลักฐาน" : page.kind === "excluded" ? `ข้อมูลต้นทาง ${page.sourceCount} · พร้อมคิดคะแนน ${page.eligibleCount} · คัดออก ${page.excludedCount}` : "หลักฐานครบทุกรายการ"} · หน้า {page.page}/{page.pageCount}</small>}</div></header>
    {page.kind === "analytics" ? <VehicleAnalyticsTable section={page.analytics} /> : page.kind === "summary" ? <><VehicleHexSummary page={page} />{!page.total && <p className="snapshot-vehicle-empty">{page.dimension === "classification" ? "ยังไม่มีข้อมูลรถในชุดนี้" : `ยังไม่มีข้อมูลรถในช่วง${page.period.label}`} · ไม่สร้างข้อมูลเพิ่มเติม</p>}</> : page.kind === "reasons" ? <div className="snapshot-reason-summary"><p>จำนวนแยกตามผลตรวจและสาเหตุ · ร้อยละเทียบกับรถทั้งหมด {page.total} รายการในช่วงนี้ · แต่ละรายการนับหนึ่งครั้งในหัวข้อที่ตรวจ</p><table><thead><tr><th>ผลตรวจ</th><th>สาเหตุ / ส่วนที่มีปัญหา</th><th>จำนวนรายการ</th><th>ร้อยละ</th></tr></thead><tbody>{!page.reasonGroups.length && <tr><td colSpan="4">{!page.total ? "ยังไม่มีข้อมูลรถในชุดนี้" : page.groups.find(group => group.key === "pending")?.entries.length ? `ยังไม่มีสาเหตุปัญหาที่บันทึก · รอตรวจสอบ ${page.groups.find(group => group.key === "pending").entries.length} รายการจากทั้งหมด ${page.total} รายการ` : "บันทึกผลแล้ว · ไม่พบรายการผิดหรือไม่สามารถตรวจสอบได้ในชุดนี้"}</td></tr>}{page.reasonGroups.map(group => <tr key={`${group.key}-${group.reasonKey}`}><td>{group.label}</td><td>{group.reasonLabel}</td><td>{group.entries.length}</td><td>{(group.entries.length / page.total * 100).toFixed(2)}%</td></tr>)}</tbody></table><p>รายละเอียดรถ ภาพ ค่าที่ผู้ตรวจสอบยืนยัน และหมายเหตุ อยู่ในหน้าหลักฐานที่แยกตามกลุ่มและสาเหตุถัดไป</p></div> : page.kind === "excluded" ? <table className="snapshot-vehicle-table snapshot-excluded-vehicle-table"><thead><tr><th>รถ / เวลา</th><th>ภาพจากต้นทาง</th><th>ข้อมูลจากระบบ</th><th>เหตุผลและผู้บันทึก</th></tr></thead><tbody>{page.entries.map(entry => { const row = entry.row; const decision = row.sampleEligibility || {}; return <tr key={row.id}><td><strong>#{entry.sequence} · {row.plateNumber || "ไม่พบทะเบียน"}</strong><span className="snapshot-plate-province">{row.province || "ไม่พบจังหวัดจากระบบ"}</span><small>{date(row.occurredAt)} · {row.lane || "—"}</small><small>รหัส {row.id}</small></td><td><EvidenceImages row={row} dimension="plate" /></td><td><small>เลขทะเบียน: {row.plateNumber || "ไม่มีค่าจากระบบ"}</small><small>จังหวัด: {row.province || "ไม่มีจังหวัดจากระบบ"}</small></td><td><strong>{row.exclusionReasonLabel || decision.reasonCode || "ไม่ระบุเหตุผล"}</strong>{decision.note && <small>{decision.note}</small>}<small>ผู้บันทึก: {decision.reviewedByName || "ไม่ระบุ"}</small><small>เวลา: {date(decision.reviewedAt)}</small></td></tr>; })}</tbody></table> : presentation || page.kind === "detail" ? <div className="snapshot-vehicle-card-grid">{page.entries.map(entry => <article key={entry.row.id}>
      <header><strong>#{entry.sequence} · {entry.row.plateNumber || "ไม่พบทะเบียน"}</strong>{page.dimension === "plate" && <span className="snapshot-plate-province">{entry.row.province || "ไม่พบจังหวัดจากระบบ"}</span>}<small>{date(entry.row.occurredAt)} · {entry.row.lane || "ไม่ระบุช่องจราจร"}</small></header>
      <EvidenceImages row={entry.row} dimension={page.dimension} />
      {page.dimension === "plate" ? <><PlateComparison entry={entry} status={page.group.key} /><p className="snapshot-card-reason">{page.group.key === "correct" ? "ผลตรวจ: ถูกต้อง" : page.group.key === "pending" ? "รอตรวจสอบ" : entry.reasonLabel}</p></> : <><VehicleClassComparison originalLabel={entry.row.vehicleClassLabel} status={page.group.key} correctedValue={entry.detail.correctedValue} compact /><p>เหตุผล: {entry.reasonLabel || "—"}</p></>}
      {entry.detail.note && <p className="snapshot-vehicle-note">{entry.detail.note}</p>}
      {page.kind === "detail" && entry.detail.evidenceAttachment && renderAttachment?.(entry.detail.evidenceAttachment)}
      <small className="snapshot-vehicle-row-id">รหัส {entry.row.id}</small>
    </article>)}</div> : <table className="snapshot-vehicle-table"><thead><tr><th>ลำดับ / รถ / เวลา</th><th>ภาพหลักฐาน</th><th>ข้อมูลจากระบบ / ข้อมูลที่ผู้ตรวจสอบยืนยัน</th><th>เหตุผล</th></tr></thead><tbody>{page.entries.map(entry => <tr key={entry.row.id}>
      <td><strong>#{entry.sequence} · {entry.row.plateNumber || "ไม่พบทะเบียน"}</strong>{page.dimension === "plate" && <span className="snapshot-plate-province">{entry.row.province || "ไม่พบจังหวัดจากระบบ"}</span>}<small>{date(entry.row.occurredAt)} · {entry.row.lane || "—"}</small><small>{entry.row.id}</small></td>
      <td><EvidenceImages row={entry.row} dimension={page.dimension} /></td>
      <td>{page.dimension === "plate" ? <PlateComparison entry={entry} status={page.group.key} /> : <VehicleClassComparison originalLabel={entry.row.vehicleClassLabel} status={page.group.key} correctedValue={entry.detail.correctedValue} compact />}</td>
      <td>{page.group.key === "correct" ? "ตรวจสอบแล้ว: ถูกต้อง" : page.group.key === "pending" ? "รอตรวจสอบ" : entry.reasonLabel}{entry.detail.note && <small>{entry.detail.note}</small>}{entry.detail.evidenceAttachment && renderAttachment?.(entry.detail.evidenceAttachment)}</td>
    </tr>)}</tbody></table>}
    <footer className="snapshot-vehicle-footnote">รอบตรวจ {metadata.documentNo || metadata.roundId || "ไม่ระบุ"} · วันที่ตรวจ {metadata.inspectionDate || "ไม่ระบุ"} · {["summary", "reasons", "analytics"].includes(page.kind) ? `ชุดตรวจ ${page.total} รายการ` : `${page.entries.length} รายการในหน้านี้`}</footer>
  </section>;
}

export function VehicleSnapshotEvidenceReport({ report, metadata, renderAttachment }) {
  return <div className="snapshot-vehicle-report">{buildVehicleSnapshotEvidencePages(report).map(page => <VehicleSnapshotEvidencePage key={page.key} page={page} metadata={metadata} renderAttachment={renderAttachment} />)}</div>;
}
