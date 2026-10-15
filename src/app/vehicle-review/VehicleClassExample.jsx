import { getVehicleClassIllustration } from "../../domain/vehicle-class-illustrations.js";
import { getConfirmedVehicleClass } from "../../domain/vehicle-class-comparison.js";
import "../../styles/vehicle-class-example.css";

export function VehicleClassExample({ label, title = "ประเภทรถจากระบบ", compact = false, axleCount }) {
  const illustration = getVehicleClassIllustration(label);
  return <div className={`vehicle-class-example${compact ? " is-compact" : ""}`}>
    {illustration && <figure><div className="vehicle-class-example-illustration"><img src={illustration.image} alt="" decoding="async" /></div></figure>}
    <div>{title && <small>{title}</small>}<strong>{label || "ไม่พบประเภทรถ"}</strong>{axleCount !== null && axleCount !== undefined && <small>จำนวนเพลาจากระบบ: {axleCount} เพลา</small>}{!illustration && <small>ไม่มีภาพตัวอย่างตรงกับประเภทนี้</small>}</div>
  </div>;
}

export function VehicleClassComparison({ originalLabel, status, correctedValue, compact = false, hideOriginal = false }) {
  const confirmed = getConfirmedVehicleClass(originalLabel, status, correctedValue);
  return <div className="vehicle-class-comparison">
    {!hideOriginal && <VehicleClassExample label={originalLabel} compact={compact} />}
    {status === "correct" ? <p className="vehicle-class-confirmation-status">ผู้ตรวจสอบยืนยันว่าถูกต้อง · บันทึกแล้ว</p> : confirmed ? <VehicleClassExample label={confirmed} title="ผู้ตรวจสอบยืนยัน · ผลที่บันทึกแล้ว" compact={compact} /> : <p className="vehicle-class-confirmation-status">ผู้ตรวจสอบยืนยัน: {status === "pending" ? "รอตรวจสอบ" : status === "unable-to-verify" ? "ไม่สามารถตรวจสอบได้ · ยังยืนยันประเภทรถไม่ได้" : "ยังไม่มีประเภทรถที่ยืนยัน"}</p>}
  </div>;
}
