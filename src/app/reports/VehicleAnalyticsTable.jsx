import { getVehicleClassIllustration } from "../../domain/vehicle-class-illustrations.js";

export function VehicleAnalyticsTable({ section, onOpen }) {
  const statusLabel = { correct: "ถูกต้อง", incorrect: "ไม่ถูกต้อง", "unable-to-verify": "ไม่สามารถตรวจสอบได้", pending: "รอตรวจสอบ" };
  const count = (row, field, status) => onOpen && row[field] > 0
    ? <button type="button" className="vehicle-analytics-count" aria-label={`ดูหลักฐาน ${row.label} · ${statusLabel[status] || "ทั้งหมด"} ${row[field]} รายการ`} onClick={() => onOpen(row, status)}>{row[field]}</button>
    : row[field];
  return <div className="vehicle-analytics-table-wrap"><table className="vehicle-analytics-table">
    <caption>{section.periodLabel && `${section.periodLabel} · `}ชุดนี้มี {section.total} รายการ · “% ของชุด” เทียบกับยอดนี้{!section.pairs && " · “% ไม่ถูกต้องในกลุ่ม” เทียบกับจำนวนในแถวนั้น"}{section.dimension === "plate" && !section.pairs && " · ผลผิดอาจผิดเลขทะเบียนหรือจังหวัด"}{section.basis === "confirmed" && " · การแก้ไขข้อมูลไม่เปลี่ยนผลตรวจเดิม"}{section.basis === "both" && " · ใช้ตารางเดียวเพราะค่าตรงกันทุกรายการ"}{section.key === "hours" && " · รวมชั่วโมงเดียวกันของทุกวันในชุด"}{section.basis === "confirmed" && " · ยังไม่มีข้อมูลยืนยัน รวมรอตรวจสอบ ไม่สามารถตรวจสอบได้ และข้อมูลยืนยันที่ขาด"}</caption>
    <thead><tr>{section.ranked && <th>อันดับ</th>}<th>{section.pairs ? "ข้อมูลจากระบบ → ข้อมูลที่ผู้ตรวจสอบยืนยัน" : section.key === "hours" ? "ชั่วโมง" : section.key === "lanes" ? "ช่องทาง" : section.key === "periods" ? "ช่วงเวลา" : section.dimension === "plate" ? "จังหวัด" : "ประเภทรถ"}</th><th>จำนวน</th><th>% ของชุด</th>{!section.pairs && <><th>ถูกต้อง</th><th>ไม่ถูกต้อง</th><th>ไม่สามารถตรวจสอบได้</th><th>รอตรวจสอบ</th><th>% ไม่ถูกต้องในกลุ่ม</th></>}</tr></thead>
    <tbody>{!section.rows.length && <tr><td colSpan={section.pairs ? 4 : section.ranked ? 9 : 8}>{section.pairs && section.total ? "ไม่พบคู่ที่ระบบระบุผิดและมีค่าใหม่ยืนยันแล้ว" : "ยังไม่มีข้อมูลในชุดนี้"}</td></tr>}{section.rows.map(row => {
      const illustration = section.dimension === "classification" && section.basis ? getVehicleClassIllustration(row.label) : null;
      return <tr key={row.label}>{section.ranked && <td>{row.rank}</td>}<th scope="row">{illustration && <img className="vehicle-analytics-thumbnail" src={illustration.image} alt="" />}{row.label}</th><td>{count(row, "count")}</td><td>{row.share.toFixed(2)}%</td>{!section.pairs && <><td>{count(row, "correct", "correct")}</td><td>{count(row, "incorrect", "incorrect")}</td><td>{count(row, "unableToVerify", "unable-to-verify")}</td><td>{count(row, "pending", "pending")}</td><td>{row.errorRate.toFixed(2)}%</td></>}</tr>;
    })}</tbody>
  </table></div>;
}
