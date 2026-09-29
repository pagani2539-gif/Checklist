import { isEvidenceBypassItemStatus } from "./inspection-status.js";

export const CHECKLIST_WORK_CONTEXTS = Object.freeze({
  condition: Object.freeze({ key: "condition", label: "ตรวจสภาพทั่วไป", hint: "บันทึกสภาพ เลือกผลตรวจ และเพิ่มรายละเอียดเมื่อพบประเด็น", icon: "clipboard" }),
  measurement: Object.freeze({ key: "measurement", label: "ตรวจค่าตัวเลข", hint: "บันทึกค่าที่ตรวจวัดและหน่วยก่อนสรุปผลตรวจ", icon: "chart" }),
  asset: Object.freeze({ key: "asset", label: "ตรวจอุปกรณ์รายตัว", hint: "ยืนยัน Asset No. ตำแหน่ง และ Serial No. ก่อนบันทึกผล", icon: "equipment" }),
  "system-service": Object.freeze({ key: "system-service", label: "ตรวจระบบหรือบริการ", hint: "ตรวจตามขอบเขตการทำงานของระบบหรือบริการในสถานี", icon: "settings" }),
  evidence: Object.freeze({ key: "evidence", label: "งานที่เน้นหลักฐาน", hint: "ตรวจความครบถ้วนของภาพ เอกสาร หรือวิดีโอที่กำหนด", icon: "camera" }),
  vehicle: Object.freeze({ key: "vehicle", label: "ตรวจข้อมูล Vehicle API", hint: "ตรวจรถทีละคันโดยแยกป้ายทะเบียน ประเภทรถ เพลา และน้ำหนัก", icon: "search" }),
  bypass: Object.freeze({ key: "bypass", label: "ข้ามการตรวจตามสถานะ", hint: "รายการนี้ไม่ต้องกรอกผลหรือแนบหลักฐานตามสถานะที่เลือก", icon: "info" }),
  issue: Object.freeze({ key: "issue", label: "รายการที่ต้องติดตาม", hint: "ระบุอาการ หลักฐาน และรายละเอียดสำหรับการติดตาม", icon: "alert" }),
});

export function getChecklistWorkContext(item, value, options = {}) {
  const status = value?.status || (item?.applicable === false ? "na" : "pending");
  if (options.vehicleReview) return CHECKLIST_WORK_CONTEXTS.vehicle;
  if (item?.applicable === false || isEvidenceBypassItemStatus(status)) return CHECKLIST_WORK_CONTEXTS.bypass;
  if (["damaged", "waiting"].includes(status)) return CHECKLIST_WORK_CONTEXTS.issue;

  const kind = String(item?.kind || item?.sourceKind || item?.domainKind || "").toLowerCase();
  if (["system", "service"].includes(kind) || (item?.systemId && !item?.assetId && !item?.laneId)) return CHECKLIST_WORK_CONTEXTS["system-service"];
  if (item?.assetId || item?.assetNo || item?.serialNo) return CHECKLIST_WORK_CONTEXTS.asset;
  if (item?.inputType && item.inputType !== "none") return CHECKLIST_WORK_CONTEXTS.measurement;
  if ((item?.evidenceSlots || []).length > 1 || item?.evidenceFirst === true) return CHECKLIST_WORK_CONTEXTS.evidence;
  return CHECKLIST_WORK_CONTEXTS.condition;
}
