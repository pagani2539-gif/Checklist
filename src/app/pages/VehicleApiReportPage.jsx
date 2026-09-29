import { useEffect, useMemo, useState } from "react";
import { buildVehicleApiReportModel } from "../../domain/vehicle-report.js";
import {
  getVehicleReviewDetail,
  isVehicleReviewScopeState,
  VEHICLE_REVIEW_CORRECTION_TARGET_OPTIONS,
} from "../../domain/vehicle-search.js";
import { formatBangkokDateTime } from "../../domain/date-time.js";
import { AppIcon as Icon } from "../icon-system.jsx";
import { Button } from "../controls/ActionControls.jsx";
import { EmptyState, PageHeader } from "../PagePrimitives.jsx";

const REPORT_STATUSES = [
  { key: "correct", label: "ถูก", tone: "correct" },
  { key: "incorrect", label: "ผิด", tone: "incorrect" },
  { key: "unable-to-verify", label: "ตรวจไม่ได้", tone: "unable" },
  { key: "pending", label: "รอตรวจ", tone: "pending" },
];

const CONTEXTS = [
  { key: "plate", label: "ป้ายทะเบียน" },
  { key: "classification", label: "คัดประเภทรถ" },
];

function displayDateTime(value) {
  return value ? formatBangkokDateTime(value) : "—";
}

function getExampleValue(example, contextKey) {
  const row = example?.row;
  if (!row) return "ไม่มีข้อมูลตัวอย่าง";
  if (contextKey === "plate") return row.plateNumber || "ไม่พบผลอ่านป้าย";
  return row.vehicleClassLabel || "ไม่พบผลคัดประเภทรถ";
}

function getExampleDetail(example, contextKey) {
  if (!example?.row) return null;
  const row = example.row;
  const detail = getVehicleReviewDetail(row, contextKey);
  const correctedValue = detail.correctedValue;
  const correctionTargetLabel = VEHICLE_REVIEW_CORRECTION_TARGET_OPTIONS[contextKey]
    ?.find((option) => option.value === detail.correctionTarget)?.label || "";
  const confirmedLabel = example.status === "correct"
    ? "ผู้ตรวจเทียบกับภาพแล้วว่าถูก"
    : example.status === "incorrect"
      ? `${correctionTargetLabel ? `${correctionTargetLabel} · ` : ""}${correctedValue || "ยังไม่มีค่าที่ยืนยัน"}`
      : "ยังไม่มีค่าที่ยืนยัน";
  return {
    apiValue: getExampleValue(example, contextKey),
    confirmedLabel,
    reasonLabel: example.reasonLabel || "ไม่ระบุสาเหตุ",
    note: detail.note || "",
    occurredAt: displayDateTime(row.occurredAt),
    lane: row.lane || "ไม่ระบุ Lane",
    plateNumber: row.plateNumber || "ไม่พบทะเบียน",
  };
}

function maskedValue(value) {
  return value ? "ทะเบียนถูกซ่อน" : "ไม่พบทะเบียน";
}

function privacyValue(example, contextKey, privacyMode) {
  if (contextKey !== "plate" || privacyMode === "full") return getExampleValue(example, contextKey);
  return maskedValue(example?.row?.plateNumber);
}

function getSelectedExamples(model, selectedIds) {
  return model.examples.map((example) => {
    const options = model.exampleOptions[example.status] || [];
    return options.find((option) => option.row?.id === selectedIds[example.status]) || example;
  });
}

function barWidth(value, maximum) {
  return `${maximum > 0 ? (value / maximum) * 100 : 0}%`;
}

async function imageAsDataUrl(source) {
  if (!source) return "";
  const response = await fetch(source, { credentials: "same-origin" });
  if (!response.ok) throw new Error("โหลดภาพหลักฐานไม่สำเร็จ");
  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) throw new Error("ไฟล์หลักฐานไม่ใช่ภาพ");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("อ่านภาพหลักฐานไม่สำเร็จ"));
    reader.readAsDataURL(blob);
  });
}

function addPptxText(slide, text, x, y, w, h, options = {}) {
  slide.addText(String(text ?? ""), {
    x, y, w, h,
    fontFace: "Aptos",
    fontSize: 14,
    color: "18324B",
    margin: 0,
    breakLine: false,
    valign: "mid",
    fit: "shrink",
    ...options,
  });
}

function addPptxRect(slide, pptx, x, y, w, h, color, lineColor = color) {
  slide.addShape(pptx.ShapeType.rect, {
    x, y, w, h,
    fill: { color },
    line: { color: lineColor, transparency: 100 },
  });
}

function addPptxSectionTitle(slide, title, subtitle = "") {
  addPptxText(slide, title, 0.55, 0.32, 11.8, 0.44, { fontSize: 23, bold: true, color: "17324D" });
  if (subtitle) addPptxText(slide, subtitle, 0.57, 0.78, 11.5, 0.34, { fontSize: 10, color: "61758A" });
}

async function exportVehicleApiPowerPoint(model, examples, contextKey, privacyMode) {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Checklist Operations Hub";
  pptx.subject = "รายงานผลตรวจ Vehicle API";
  pptx.title = `รายงานผลตรวจ ${model.context.label}`;
  pptx.company = "Checklist Operations Hub";
  pptx.lang = "th-TH";
  pptx.theme = {
    headFontFace: "Aptos",
    bodyFontFace: "Aptos",
    lang: "th-TH",
  };

  const summary = model.summary;
  const statusCounts = REPORT_STATUSES.map((status) => ({ ...status, value: summary[status.key === "unable-to-verify" ? "unableToVerify" : status.key] || 0 }));
  const maxStatus = Math.max(summary.total, 1);
  const reasonRows = model.reasons;
  const outcomeReasons = model.outcome.reasons || [];
  const stationLine = `${model.metadata.stationCode} · ${model.metadata.stationName}`;
  const dateLine = `${displayDateTime(model.metadata.criteria?.startAt)} ถึง ${displayDateTime(model.metadata.criteria?.endAt)}`;
  const titleLine = `${model.context.label} · ${model.scope.label}`;

  // Slide 1: result and denominator are visible together.
  {
    const slide = pptx.addSlide();
    slide.background = { color: "F3F7FC" };
    addPptxSectionTitle(slide, "สรุปผลตรวจ Vehicle API", `${titleLine} · ${stationLine}`);
    addPptxText(slide, dateLine, 0.58, 1.12, 11.6, 0.24, { fontSize: 9, color: "61758A" });
    addPptxText(slide, `ดึงข้อมูลจาก API ล่าสุด: ${displayDateTime(model.metadata.fetchedAt)}`, 0.58, 1.38, 11.6, 0.22, { fontSize: 9, color: "61758A" });
    const cards = [
      { label: "รถทั้งหมด", value: `${summary.total} คัน`, color: "2563EB" },
      { label: "ความถูกต้อง", value: summary.accuracy === null ? "—" : `${summary.accuracy}%`, detail: summary.accuracy === null ? "ยังไม่มีรายการที่ตัดสิน" : `จาก ${summary.reviewed} คันที่ตัดสิน`, color: "157C45" },
      { label: "บันทึกผลแล้ว", value: `${summary.recorded}/${summary.total}`, detail: summary.completionPercent === null ? "ยังไม่มีข้อมูลรถ" : `${summary.completionPercent}% ของข้อมูล`, color: "475569" },
      { label: "ผลรอบ", value: model.outcome.label, color: model.outcome.status === "passed" ? "157C45" : model.outcome.status === "failed" ? "B42318" : "B45309" },
    ];
    cards.forEach((card, index) => {
      const x = 0.6 + index * 3.08;
      addPptxRect(slide, pptx, x, 1.68, 2.82, 1.1, "FFFFFF", "DCE5EF");
      addPptxText(slide, card.label, x + 0.15, 1.83, 2.5, 0.22, { fontSize: 10, color: "61758A" });
      addPptxText(slide, card.value, x + 0.15, 2.09, 2.5, 0.34, { fontSize: card.value.length > 15 ? 15 : 21, bold: true, color: card.color });
      if (card.detail) addPptxText(slide, card.detail, x + 0.15, 2.45, 2.5, 0.19, { fontSize: 8, color: "61758A" });
    });
    addPptxText(slide, "จำนวนแยกตามผลตรวจ", 0.65, 3.08, 4, 0.3, { fontSize: 15, bold: true });
    statusCounts.forEach((status, index) => {
      const y = 3.52 + index * 0.52;
      const color = { correct: "15803D", incorrect: "B42318", unable: "D97706", pending: "64748B" }[status.tone];
      addPptxText(slide, status.label, 0.68, y, 1.65, 0.24, { fontSize: 11, bold: true });
      addPptxText(slide, `${status.value} คัน`, 10.45, y, 1.4, 0.24, { fontSize: 11, bold: true, align: "right" });
      addPptxRect(slide, pptx, 2.45, y + 0.04, 7.7, 0.16, "E4EAF1");
      if (status.value) addPptxRect(slide, pptx, 2.45, y + 0.04, 7.7 * status.value / maxStatus, 0.16, color);
    });
    const methodLine = `${model.metadata.reviewMethod} · ข้อมูล ณ ${displayDateTime(model.metadata.generatedAt)}`;
    addPptxText(slide, methodLine, 0.65, 6.05, 11.4, 0.3, { fontSize: 9, color: "61758A" });
    addPptxText(slide, outcomeReasons.map((reason) => reason.label).join(" · ") || "", 0.65, 6.38, 11.4, 0.45, { fontSize: 9, color: "8A4B08", valign: "top" });
  }

  // Slide 2: one selectable, real case per review outcome.
  {
    const slide = pptx.addSlide();
    slide.background = { color: "F3F7FC" };
    addPptxSectionTitle(slide, "ตัวอย่างประกอบผลตรวจ", privacyMode === "full" ? "แสดงข้อมูลและภาพหลักฐานเต็ม" : "ซ่อนข้อมูลทะเบียนและเว้นภาพรถในไฟล์ส่งออก");
    for (let index = 0; index < examples.length; index += 1) {
      const example = examples[index];
      const x = 0.55 + index * 4.15;
      const width = 3.95;
      const color = ["15803D", "B42318", "D97706"][index];
      addPptxRect(slide, pptx, x, 1.35, width, 5.6, "FFFFFF", "DCE5EF");
      addPptxText(slide, example.title, x + 0.2, 1.55, width - 0.4, 0.36, { fontSize: 18, bold: true, color });
      if (!example.row) {
        addPptxText(slide, "ยังไม่มีตัวอย่างผลนี้", x + 0.2, 2.15, width - 0.4, 0.4, { fontSize: 12, color: "61758A" });
        continue;
      }
      const detail = getExampleDetail(example, contextKey);
      const value = privacyValue(example, contextKey, privacyMode);
      addPptxText(slide, contextKey === "plate" ? "ผลจาก API" : "ประเภทจาก API", x + 0.2, 2.12, width - 0.4, 0.25, { fontSize: 9, color: "61758A" });
      addPptxText(slide, value, x + 0.2, 2.42, width - 0.4, 0.34, { fontSize: 16, bold: true });
      addPptxText(slide, contextKey === "plate" ? "ผลที่ผู้ตรวจยืนยัน" : "ผลคัดแยกที่ยืนยัน", x + 0.2, 2.86, width - 0.4, 0.23, { fontSize: 9, color: "61758A" });
      addPptxText(slide, privacyMode === "masked" && contextKey === "plate" ? "ซ่อนข้อมูลทะเบียน" : detail.confirmedLabel, x + 0.2, 3.13, width - 0.4, 0.43, { fontSize: 12, bold: true });
      addPptxText(slide, `สาเหตุ: ${example.status === "correct" ? "—" : detail.reasonLabel}`, x + 0.2, 3.65, width - 0.4, 0.4, { fontSize: 10, valign: "top" });
      addPptxText(slide, `${detail.occurredAt} · ${detail.lane}`, x + 0.2, 4.1, width - 0.4, 0.3, { fontSize: 8, color: "61758A" });
      const imageY = contextKey === "classification" && privacyMode === "full" ? 4.78 : 4.52;
      const imageHeight = 6.57 - imageY;
      if (contextKey === "classification" && privacyMode === "full") {
        addPptxText(slide, `ทะเบียน: ${detail.plateNumber}`, x + 0.2, 4.4, width - 0.4, 0.24, { fontSize: 9, color: "61758A" });
      }
      if (privacyMode === "full" && example.imageUrl) {
        try {
          const data = await imageAsDataUrl(example.imageUrl);
          slide.addImage({ data, x: x + 0.2, y: imageY, w: width - 0.4, h: imageHeight, sizing: { type: "contain", w: width - 0.4, h: imageHeight } });
        } catch {
          addPptxText(slide, "โหลดภาพหลักฐานไม่สำเร็จ", x + 0.2, imageY + 0.4, width - 0.4, 0.3, { fontSize: 9, color: "8A4B08" });
        }
      } else if (privacyMode === "masked") {
        addPptxText(slide, "ภาพหลักฐานเต็มยังดูได้ในระบบ", x + 0.2, 4.95, width - 0.4, 0.32, { fontSize: 9, color: "61758A" });
      } else {
        addPptxText(slide, "ไม่มีภาพหลักฐานจาก API", x + 0.2, 4.95, width - 0.4, 0.32, { fontSize: 9, color: "61758A" });
      }
    }
  }

  // Slide 3: causes and limits are kept separate from accuracy.
  {
    const slide = pptx.addSlide();
    slide.background = { color: "F3F7FC" };
    addPptxSectionTitle(slide, "สาเหตุและข้อจำกัด", `${model.outcome.label} · ตรวจไม่ได้และรอตรวจไม่นับเป็นถูกหรือผิด`);
    const maximum = Math.max(...reasonRows.map((reason) => reason.count), 1);
    const rowStep = Math.min(0.5, 4.2 / Math.max(reasonRows.length, 1));
    if (!reasonRows.length) {
      addPptxText(slide, "ยังไม่มีสาเหตุที่บันทึก", 0.65, 1.55, 8, 0.35, { fontSize: 12, color: "61758A" });
    }
    reasonRows.forEach((reason, index) => {
      const y = 1.45 + index * rowStep;
      const label = `${reason.status === "incorrect" ? "ผลผิด" : "ตรวจไม่ได้"} · ${reason.label}`;
      const color = reason.status === "incorrect" ? "B42318" : "D97706";
      addPptxText(slide, label, 0.65, y, 5.3, Math.max(0.2, rowStep - 0.03), { fontSize: reasonRows.length > 10 ? 8 : 10 });
      addPptxText(slide, `${reason.count}`, 10.8, y, 0.75, Math.max(0.2, rowStep - 0.03), { fontSize: reasonRows.length > 10 ? 8 : 10, bold: true, align: "right" });
      addPptxRect(slide, pptx, 6.0, y + 0.04, 4.5, 0.1, "E4EAF1");
      addPptxRect(slide, pptx, 6.0, y + 0.04, 4.5 * reason.count / maximum, 0.1, color);
    });
    const noteY = Math.min(6.15, 1.55 + Math.max(reasonRows.length, 1) * rowStep);
    const sampleNote = !model.contextSupported
      ? "Snapshot นี้ไม่มีข้อมูลตรวจประเภทรถ"
      : model.outcome.sampleQualified
        ? "จำนวนหรือเวลาตัวอย่างครบ"
        : "ยังไม่ครบ 6 ชั่วโมงหรือ 100 คัน";
    addPptxText(slide, `เกณฑ์จำนวนตัวอย่าง: ${sampleNote}`, 0.65, noteY, 11.4, 0.3, { fontSize: 10, bold: true, color: "8A4B08" });
    addPptxText(slide, "ความถูกต้องคำนวณจากรายการที่ผู้ตรวจตัดสินว่าถูกหรือผิดเท่านั้น", 0.65, noteY + 0.35, 11.4, 0.3, { fontSize: 9, color: "61758A" });
  }

  const safeId = String(model.roundId || "round").replace(/[^a-z0-9_-]/gi, "-");
  await pptx.writeFile({ fileName: `vehicle-api-report-${safeId}-${model.context.key}.pptx` });
}

export function createVehicleApiReportPage() {
  return function VehicleApiReportPage({ state, route }) {
    const round = state?.inspectionRounds?.find((item) => item.id === route.id) || null;
    const contextKey = CONTEXTS.some((context) => context.key === route.context) ? route.context : "plate";
    const scopeKey = route.query?.scope || "all";
    const isHistoryRoute = route.name === "historyVehicleApiReport";
    const isReadOnly = isHistoryRoute || round?.status === "closed";
    const model = useMemo(() => round ? buildVehicleApiReportModel(round, { context: contextKey, scope: scopeKey }) : null, [round, contextKey, scopeKey]);
    const [privacyMode, setPrivacyMode] = useState("masked");
    const [selectedIds, setSelectedIds] = useState({ correct: "", incorrect: "", "unable-to-verify": "" });
    const [exporting, setExporting] = useState(false);
    const [exportError, setExportError] = useState("");

    useEffect(() => {
      if (!model) return;
      setSelectedIds(Object.fromEntries(model.examples.map((example) => [example.status, example.row?.id || ""])));
    }, [model?.roundId, model?.context.key, model?.scope.key]);

    if (!round) {
      return <section className="ops-page ops-vehicle-report-page"><PageHeader eyebrow="NOT FOUND" title="ไม่พบรอบการตรวจ" /><section className="ops-panel"><EmptyState icon="alert" title="เปิดรายงานไม่ได้">ลิงก์นี้อาจถูกลบ หรือไม่มีข้อมูลรอบการตรวจในรายการนี้</EmptyState></section></section>;
    }

    const selectedExamples = getSelectedExamples(model, selectedIds);
    const isScoped = isVehicleReviewScopeState(round.vehicleSearch);
    const parentBase = isReadOnly ? "history" : "inspections";
    const reviewHref = `#/${parentBase}/${encodeURIComponent(round.id)}/vehicle-api/${encodeURIComponent(contextKey)}${scopeKey !== "all" ? `?scope=${encodeURIComponent(scopeKey)}` : ""}`;
    const statusMaximum = Math.max(model.summary.total, 1);
    const metadata = model.metadata;
    const reportModeLabel = isReadOnly ? "ผลจาก Snapshot · อ่านอย่างเดียว" : "รายงานร่าง · ข้อมูลเปลี่ยนได้ระหว่างตรวจ";

    const onExportPowerPoint = async () => {
      setExportError("");
      setExporting(true);
      try {
        await exportVehicleApiPowerPoint(model, selectedExamples, contextKey, privacyMode);
      } catch (error) {
        setExportError(error?.message || "สร้างไฟล์ PowerPoint ไม่สำเร็จ");
      } finally {
        setExporting(false);
      }
    };

    return <section className={`ops-page ops-vehicle-report-page${privacyMode === "masked" ? " is-export-masked" : ""}`}>
      <PageHeader eyebrow={model.context.checklistNumber} title={`รายงานผล ${model.context.label}`} description="สรุปผลจากข้อมูลในรอบการตรวจที่เลือก" actions={<div className="ops-vehicle-report-actions no-print"><label className="ops-vehicle-report-privacy"><span>ข้อมูลในไฟล์ส่งออก</span><select value={privacyMode} onChange={(event) => setPrivacyMode(event.target.value)} aria-label="การแสดงข้อมูลทะเบียนในไฟล์ส่งออก"><option value="masked">ซ่อนทะเบียนและภาพรถ</option><option value="full">แสดงทะเบียนและภาพเต็ม</option></select></label><Button onClick={() => window.print()} icon="document">บันทึกเป็น PDF</Button><Button onClick={onExportPowerPoint} variant="primary" icon="download" disabled={exporting}>{exporting ? "กำลังสร้างไฟล์..." : "ส่งออก PowerPoint"}</Button></div>} />
      <nav className="ops-vehicle-report-tabs no-print" aria-label="เลือกประเภทรายงาน">
        {CONTEXTS.map((context) => <a key={context.key} className={contextKey === context.key ? "is-active" : ""} href={`#/${parentBase}/${encodeURIComponent(round.id)}/vehicle-api-report/${context.key}${scopeKey !== "all" ? `?scope=${encodeURIComponent(scopeKey)}` : ""}`} aria-current={contextKey === context.key ? "page" : undefined}>{context.label}</a>)}
        {isScoped && <label><span>ช่วงข้อมูล</span><select aria-label="เลือกช่วงข้อมูล" value={scopeKey} onChange={(event) => { const nextScope = event.target.value; window.location.hash = `#/${parentBase}/${encodeURIComponent(round.id)}/vehicle-api-report/${contextKey}${nextScope !== "all" ? `?scope=${encodeURIComponent(nextScope)}` : ""}`; }}><option value="all">กลางวันและกลางคืน</option><option value="day">กลางวัน</option><option value="night">กลางคืน</option></select></label>}
        <Button href={reviewHref} variant="secondary" icon="arrow">กลับหน้าตรวจ</Button>
      </nav>

      <div className={`ops-vehicle-report-state is-${model.outcome.status}`} role="status"><span>{reportModeLabel}</span><strong>{model.outcome.label}</strong><small>ข้อมูล ณ {displayDateTime(metadata.generatedAt)}</small></div>
      {exportError && <div className="ops-vehicle-report-error no-print" role="alert"><Icon name="alert" />{exportError}</div>}

      <section className="ops-vehicle-report-section ops-vehicle-report-overview" aria-labelledby="vehicle-report-overview-title">
        <header><div><p className="ops-eyebrow">OVERVIEW</p><h2 id="vehicle-report-overview-title">ภาพรวมผลตรวจ</h2><p>{model.context.label} · {model.scope.label}{model.scope.timeLabel ? ` (${model.scope.timeLabel})` : ""}</p></div><span className="ops-vehicle-report-method">{metadata.reviewMethod}</span></header>
        <div className="ops-vehicle-report-metrics">
          <article><span>รถทั้งหมด</span><strong>{model.summary.total}</strong><small>คันในชุดข้อมูลนี้</small></article>
          <article className="tone-accuracy"><span>ความถูกต้อง</span><strong>{model.summary.accuracy === null ? "—" : `${model.summary.accuracy}%`}</strong><small>{model.summary.accuracy === null ? "ยังไม่มีรายการที่ตัดสินถูกหรือผิด" : `ถูก ${model.summary.correct} จาก ${model.summary.reviewed} คันที่ตัดสิน`}</small></article>
          <article><span>บันทึกผลแล้ว</span><strong>{model.summary.recorded}/{model.summary.total}</strong><small>{model.summary.completionPercent === null ? "ยังไม่มีข้อมูลรถ" : `${model.summary.completionPercent}% ของข้อมูล`}</small></article>
          <article className="tone-outcome"><span>ผลรอบ</span><strong>{model.outcome.label}</strong><small>{!model.contextSupported ? "Snapshot นี้ไม่มีผลตรวจบริบทนี้" : model.outcome.sampleQualified ? "จำนวนหรือเวลาตัวอย่างครบ" : "ต้องครบ 6 ชั่วโมงหรือ 100 คัน"}</small></article>
        </div>

        <div className="ops-vehicle-report-charts">
          <section className="ops-vehicle-report-chart" aria-label="กราฟจำนวนผลตรวจ">
            <h3>จำนวนรถแยกตามผล</h3>
            {REPORT_STATUSES.map((status) => {
              const value = model.summary[status.key === "unable-to-verify" ? "unableToVerify" : status.key] || 0;
              return <div className={`ops-vehicle-report-bar tone-${status.tone}`} key={status.key}><div><span>{status.label}</span><strong>{value} คัน</strong></div><div className="ops-vehicle-report-track" role="img" aria-label={`${status.label} ${value} คัน`}><span style={{ width: barWidth(value, statusMaximum), minWidth: value > 0 ? 2 : 0 }} /></div></div>;
            })}
            <p className="ops-vehicle-report-chart-note">ตรวจไม่ได้และรอตรวจไม่ถูกนับเป็นผลถูกหรือผิด</p>
          </section>
          <section className="ops-vehicle-report-chart ops-vehicle-report-reasons" aria-label="กราฟสาเหตุผลผิดและตรวจไม่ได้">
            <h3>สาเหตุที่บันทึก</h3>
            {model.reasons.length ? model.reasons.map((reason) => <div className={`ops-vehicle-report-bar tone-${reason.status === "incorrect" ? "incorrect" : "unable"}`} key={`${reason.status}:${reason.reasonCode}`}><div><span>{reason.status === "incorrect" ? "ผลผิด" : "ตรวจไม่ได้"} · {reason.label}</span><strong>{reason.count} รายการ</strong></div><div className="ops-vehicle-report-track" role="img" aria-label={`${reason.label} ${reason.count} รายการ`}><span style={{ width: barWidth(reason.count, Math.max(...model.reasons.map((item) => item.count), 1)), minWidth: reason.count > 0 ? 2 : 0 }} /></div></div>) : <p className="ops-vehicle-report-empty-note">ยังไม่มีสาเหตุที่บันทึกไว้</p>}
          </section>
        </div>
      </section>

      <section className="ops-vehicle-report-section ops-vehicle-report-examples" aria-labelledby="vehicle-report-examples-title">
        <header><div><p className="ops-eyebrow">CASE EXAMPLES</p><h2 id="vehicle-report-examples-title">ตัวอย่างประกอบผลตรวจ</h2><p>เลือกตัวอย่างจากรถที่บันทึกผลไว้ เพื่อแนบในเอกสารนำเสนอ</p></div></header>
        <div className="ops-vehicle-report-example-grid">
          {selectedExamples.map((example) => {
            const options = model.exampleOptions[example.status] || [];
            const detail = getExampleDetail(example, contextKey);
            return <article className={`ops-vehicle-report-example tone-${example.status === "correct" ? "correct" : example.status === "incorrect" ? "incorrect" : "unable"}`} key={example.status}>
              <header><div><span>ตัวอย่าง</span><h3>{example.title}</h3></div>{options.length > 1 && <label className="no-print"><span>เลือกรายการ</span><select aria-label={`เลือกตัวอย่าง${example.title}`} value={example.row?.id || ""} onChange={(event) => setSelectedIds((current) => ({ ...current, [example.status]: event.target.value }))}>{options.map((option) => <option key={option.row.id} value={option.row.id}>{displayDateTime(option.row.occurredAt)} · {contextKey === "plate" ? option.row.plateNumber || "ไม่พบทะเบียน" : option.row.vehicleClassLabel || "ไม่ระบุประเภท"}</option>)}</select></label>}</header>
              {example.row && detail ? <>
                <dl><div><dt>{contextKey === "plate" ? "ผลจาก API" : "ประเภทจาก API"}</dt><dd>{privacyValue(example, contextKey, privacyMode)}</dd></div><div><dt>{example.status === "incorrect" ? "ค่าที่ผู้ตรวจยืนยัน" : "ผลเทียบภาพ"}</dt><dd>{privacyMode === "masked" && contextKey === "plate" ? "ซ่อนข้อมูลทะเบียน" : detail.confirmedLabel}</dd></div>{example.status !== "correct" && <div><dt>สาเหตุ</dt><dd>{detail.reasonLabel}</dd></div>}<div><dt>เวลา · Lane</dt><dd>{detail.occurredAt} · {detail.lane}</dd></div>{privacyMode === "full" && contextKey === "classification" && <div><dt>ทะเบียน</dt><dd>{detail.plateNumber}</dd></div>}{privacyMode === "full" && detail.note && <div><dt>หมายเหตุ</dt><dd>{detail.note}</dd></div>}</dl>
                {privacyMode === "full" && example.imageUrl ? <figure><img src={example.imageUrl} alt={`ภาพหลักฐานตัวอย่าง${example.title}`} loading="lazy" onError={(event) => { event.currentTarget.hidden = true; event.currentTarget.parentElement.dataset.imageError = "true"; }} /><figcaption>ภาพจาก API · {contextKey === "plate" ? "ภาพป้ายทะเบียน" : "ภาพรถ"}</figcaption></figure> : <p className="ops-vehicle-report-image-hidden">{privacyMode === "masked" ? "ซ่อนภาพที่อาจแสดงทะเบียนในไฟล์ส่งออก" : "ไม่มีภาพจาก API สำหรับตัวอย่างนี้"}</p>}
              </> : <div className="ops-vehicle-report-no-example"><strong>ยังไม่มีตัวอย่างผลนี้</strong><span>จะเพิ่มตัวอย่างเมื่อมีรถที่บันทึกผลเป็น “{example.title}”</span></div>}
            </article>;
          })}
        </div>
      </section>

      <section className="ops-vehicle-report-section ops-vehicle-report-provenance" aria-labelledby="vehicle-report-provenance-title">
        <header><div><p className="ops-eyebrow">SOURCE & LIMITS</p><h2 id="vehicle-report-provenance-title">แหล่งข้อมูลและข้อจำกัด</h2></div></header>
        <dl><div><dt>สถานี</dt><dd>{metadata.stationCode} · {metadata.stationName}</dd></div><div><dt>ช่วงเวลา API</dt><dd>{displayDateTime(metadata.criteria?.startAt)} ถึง {displayDateTime(metadata.criteria?.endAt)}</dd></div><div><dt>ดึงข้อมูลล่าสุด</dt><dd>{displayDateTime(metadata.fetchedAt)}</dd></div><div><dt>จำนวนตัวอย่าง</dt><dd>{model.summary.total} คัน · แสดง {metadata.rowCount} รายการ</dd></div><div><dt>วิธีประเมิน</dt><dd>{metadata.reviewMethod}</dd></div><div><dt>เกณฑ์ความถูกต้อง</dt><dd>{model.summary.threshold === null ? "ไม่มีเกณฑ์เฉพาะ" : `ตั้งแต่ ${model.summary.threshold}% ของรายการที่ตัดสินถูกหรือผิด`}</dd></div></dl>
        {model.outcome.reasons?.length > 0 && <div className="ops-vehicle-report-limit-note"><strong>ข้อที่ยังทำให้สรุปผลรอบไม่ได้</strong><ul>{model.outcome.reasons.map((reason, index) => <li key={`${reason.code}-${index}`}>{reason.label}</li>)}</ul></div>}
        <p className="ops-vehicle-report-footnote">ความถูกต้องมาจากผลที่ผู้ตรวจเทียบกับภาพ รายการ “ตรวจไม่ได้” และ “รอตรวจ” แสดงแยกต่างหากและไม่รวมในเปอร์เซ็นต์</p>
      </section>
      <footer className="ops-vehicle-report-footer">รายงานผล Vehicle API · {model.context.label} · {model.scope.label} · ข้อมูล ณ {displayDateTime(metadata.generatedAt)}</footer>
    </section>;
  };
}
