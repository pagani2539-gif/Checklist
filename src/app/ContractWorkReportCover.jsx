import { AppIcon as Icon } from "./icon-system.jsx";
import "../styles/contracts.css";

function displayDate(value) {
  if (!value) return "ยังไม่ระบุวันที่";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

export default function ContractWorkReportCover({ model }) {
  const context = model?.context || {};
  return <section className="contract-work-cover" aria-label="หน้าปก Contract Work Report">
    <div className="contract-work-cover-logos"><div className="contract-work-logo-placeholder">{model?.reportCompanyId && ["ntr", "ltp", "is8"].includes(model.reportCompanyId) ? <img src={`/report/companies/${model.reportCompanyId}-logo.${model.reportCompanyId === "ntr" ? "jpg" : "png"}`} alt="" /> : "กรมทางหลวง"}</div><div className="contract-work-logo-placeholder is-right">{model?.agency || "หน่วยงานเจ้าของงาน"}</div></div>
    <div className="contract-work-cover-body"><p className="contract-work-cover-eyebrow">รายงานผลการปฏิบัติงาน</p><h1>ครั้งที่ {context.reportSequence || context.workPackageNo || "—"}</h1><div className="contract-work-cover-rule" /><p className="contract-work-cover-project">{context.projectName || "ยังไม่ระบุชื่อโครงการ"}</p><p className="contract-work-cover-station">{context.stationName || "รายงานภาพรวมสัญญา"}{context.province ? ` จังหวัด${context.province}` : ""}</p><p className="contract-work-cover-contract">สัญญาเลขที่ <strong>{context.contractNo || "ยังไม่ระบุ"}</strong> ลงวันที่ {displayDate(context.contractDate)}</p><div className="contract-work-cover-facts"><div><span>ภาค/พื้นที่</span><strong>{(context.regionNames || []).join(" · ") || "ยังไม่ระบุ"}</strong></div><div><span>งวดงาน</span><strong>{context.workPackageTitle || context.workPackageNo || "ยังไม่ระบุ"}</strong></div><div><span>ช่วงรายงาน</span><strong>{[context.periodStart, context.periodEnd].filter(Boolean).join(" – ") || "ยังไม่ระบุ"}</strong></div><div><span>ผู้รับจ้าง</span><strong>{context.contractor || "ยังไม่ระบุ"}</strong></div></div></div><footer className="contract-work-cover-footer"><Icon name="archive" /><span>Contract Work Report · ข้อมูลหน้าปกยึดตามบริบทสัญญาและงวดที่เลือก</span></footer>
  </section>;
}
