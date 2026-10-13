import "../../styles/vehicle-report.css";
import "../../styles/report-page-rules.css";
import "../../styles/printable-report-route.css";
import CustomSelect from "../CustomSelect.jsx";
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildReportTemplateModel } from '../../domain/report-template.js';
import { buildVehicleSnapshotEvidencePages } from '../../domain/vehicle-snapshot-evidence.js';
import { VehicleEvidenceReadiness, VehicleSnapshotEvidencePage } from './VehicleSnapshotEvidence.jsx';
import { Button } from '../controls/ActionControls.jsx';
import { PageHeader } from '../PagePrimitives.jsx';
import { VehicleAnalyticsPanel } from './VehicleAnalyticsPanel.jsx';
import { waitForVehicleAnalyticsLayout } from './vehicle-analytics-ready.js';

export function VehicleTestReport({ round, state, context, scope, backHref }) {
  const [mode, setMode] = useState('standard');
  const [busy, setBusy] = useState(false);
  const [includeDetails, setIncludeDetails] = useState(false);
  const [message, setMessage] = useState('');
  const reportRef = useRef(null);
  const model = useMemo(() => buildReportTemplateModel(round, state), [round, state]);
  const pages = useMemo(() => buildVehicleSnapshotEvidencePages(model.vehicleSearch, { context, scope, includeDetails, evidencePageSize: mode === "standard" ? 8 : 10, problemPageSize: mode === "standard" ? 6 : 5 }).map(page => ({ ...page, systemKey: page.systemKey || round.snapshot?.vehicleReviewSystemKey, systemLabel: page.systemLabel || round.snapshot?.vehicleReviewSystemLabel })), [model, context, scope, includeDetails, mode, round.snapshot?.vehicleReviewSystemKey, round.snapshot?.vehicleReviewSystemLabel]);
  const cleanName = value => String(value || "").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").trim();
  const reportName = ["รายงาน", model.metadata?.stationName || round.snapshot?.stationName || "สถานี", round.snapshot?.vehicleReviewSystemLabel, context === "plate" ? "ป้ายทะเบียน" : "ประเภทรถ", scope === "day" ? "กลางวัน" : scope === "night" ? "กลางคืน" : "ทุกช่วง", round.meta?.inspectionDate, mode === "presentation" ? "16x9" : "A4", round.status === "closed" ? "ฉบับปิดรอบ" : "ฉบับร่าง"].filter(Boolean).map(cleanName).join("_");
  useEffect(() => {
    let previousTitle;
    const before = () => { previousTitle = document.title; document.title = reportName; };
    const after = () => { if (previousTitle !== undefined) { document.title = previousTitle; previousTitle = undefined; } };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => { window.removeEventListener("beforeprint", before); window.removeEventListener("afterprint", after); after(); };
  }, [reportName]);
  const exportPdf = async () => {
    setBusy(true);
    try {
      const { downloadSnapshotEvidencePdf } = await import('./snapshot-evidence-pdf.js');
      const count = await downloadSnapshotEvidencePdf(reportRef.current, { fileName: `${reportName}.pdf`, onProgress: setMessage });
      setMessage(`ดาวน์โหลดรายงานชุดทดสอบ ${count} หน้าแล้ว`);
    } catch (error) { setMessage(error.message || 'สร้าง PDF ไม่สำเร็จ'); }
    finally { setBusy(false); }
  };
  const base = `#/${round.status === 'closed' ? 'history' : 'inspections'}/${encodeURIComponent(round.id)}/vehicle-api-report/${context}`;
  return <section className="ops-page vehicle-test-report-page">
    <style>{`@media print { @page { size: ${mode === 'presentation' ? '320mm 180mm' : 'A4 portrait'}; margin: ${mode === 'presentation' ? '0' : '12mm'}; } }`}</style>
    <div className="no-print">
      <PageHeader title={`${round.snapshot?.vehicleReviewSystemLabel ? `${round.snapshot.vehicleReviewSystemLabel} · ` : ""}รายงานชุดทดสอบ${context === 'plate' ? 'ป้ายทะเบียน' : 'คัดแยกประเภทรถ'}`} description="สรุปผลและหลักฐานรถทุกรายการในชุดที่เลือก" />
      <div className="ops-vehicle-report-actions">
        {context === 'plate' && <label>ช่วงทดสอบ <CustomSelect aria-label="ช่วงทดสอบในรายงาน" value={scope} disabled={busy} onChange={event => { window.location.hash = `${base}?${new URLSearchParams({ ...(round.snapshot?.vehicleReviewSystemKey ? { system: round.snapshot.vehicleReviewSystemKey } : {}), scope: event.target.value })}`; }}><option value="all">กลางวันและกลางคืน</option><option value="day">กลางวัน</option><option value="night">กลางคืน</option></CustomSelect></label>}
        <label>รูปแบบ <CustomSelect aria-label="รูปแบบรายงานชุดทดสอบ" value={mode} disabled={busy} onChange={event => setMode(event.target.value)}><option value="standard">A4 · ตารางหลักฐาน</option><option value="presentation">16:9 · พรีเซนต์</option></CustomSelect></label>
        <label><input type="checkbox" checked={includeDetails} disabled={busy} onChange={event => setIncludeDetails(event.target.checked)} /> รวมหน้าขยายรายการผิด / ไม่สามารถตรวจสอบได้</label>
        <Button onClick={exportPdf} variant="primary" disabled={busy || !pages.length} icon="download">{busy ? 'กำลังสร้าง PDF…' : 'ดาวน์โหลด PDF ชุดทดสอบ'}</Button>
        <Button onClick={async () => { try { await waitForVehicleAnalyticsLayout(reportRef.current); window.print(); } catch (error) { setMessage(error.message); } }} disabled={busy || !pages.length} icon="document">พิมพ์ชุดทดสอบ</Button>
        <Button href={backHref} disabled={busy} variant="secondary">กลับหน้าตรวจ</Button>
      </div>
      <p role="status">{message || (round.status === 'closed' ? 'รายงานจากผลตรวจที่บันทึกไว้เมื่อปิดรอบ' : 'รายงานร่าง · ยังแก้ไขผลตรวจได้')}</p>
    </div>
    <div className="vehicle-report-screen-overview no-print">
      <h2>ภาพรวมผลตรวจและสรุปปัญหา</h2>
      {pages.filter(page => ['summary', 'reasons'].includes(page.kind)).map(page => <VehicleSnapshotEvidencePage key={`screen-${page.key}`} page={page} metadata={model.metadata} />)}
    </div>
    <VehicleAnalyticsPanel key={`${context}-${scope}-${round.id}-${round.snapshot?.vehicleReviewSystemKey || "legacy"}`} pages={pages} metadata={model.metadata} roundId={round.id} />
    <div className="vehicle-test-report-preview"><div ref={reportRef} className="ops-print-report" data-report-mode={mode} data-report-draft={round.status !== 'closed' ? 'true' : 'false'}>
      <div className="no-print"><VehicleEvidenceReadiness key={`${context}-${scope}-${mode}`} /></div>
      {pages.map(page => <VehicleSnapshotEvidencePage key={page.key} page={page} metadata={model.metadata} presentation={mode === 'presentation'} />)}
    </div></div>
  </section>;
}
