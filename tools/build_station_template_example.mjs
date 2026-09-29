import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "file:///C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const outputDir = process.argv[2];
if (!outputDir) throw new Error("Output directory is required");

const rows = [];
const add = (templateId, format, station, direction, group, item, qty, unit, recordKind, proposedType, recommendation, note = "") => {
  rows.push([templateId, format, station, direction, group, item, qty, unit, recordKind, proposedType, recommendation, note]);
};

const scRanong = [
  ["WIM FOR HI SPEED", "WIM SORTING SYSTEM FOR SPOT CHECK (๒ set/lane)", 2, "ระบบ", "รายการอ้างอิงระบบ", "WIM_SORTING", "เก็บอ้างอิงและตรวจจำนวนอุปกรณ์จริง", "ข้อความ set/lane ต้องยืนยันกับแบบติดตั้ง"],
  ["WIM FOR HI SPEED", "WIM ELECTRONICS FOR SPOT CHECK", 1, "ระบบ", "รายการอ้างอิงระบบ", "WIM_ELECTRONICS", "เก็บอ้างอิงและจับคู่ตู้ควบคุมจริง"],
  ["WIM FOR HI SPEED", "WIM CONTROL SYSTEM FOR SPOT CHECK", 1, "ระบบ", "รายการอ้างอิงระบบ", "WIM_CONTROL", "เก็บอ้างอิงและจับคู่เครื่องควบคุมจริง"],
  ["LPR", "License Plate Recognition Control System", 1, "ระบบ", "ระบบซอฟต์แวร์", "LPR_CONTROL", "เก็บเป็น System เดียวและเชื่อมกับ LPR Camera ทุก Scope ที่ติดตั้ง", "ไม่สร้าง Asset ซ้ำ"],
  ["LPR", "LPR CAMERA", 2, "ชุด", "อุปกรณ์จริง", "LPR_CAMERA", "สร้าง Asset ตั้งต้น"],
  ["CCTV FOR HI SPEED", "กล้องโทรทัศน์วงจรปิดชนิดเครือข่าย แบบปรับมุมมองแบบที่ ๒", 1, "ชุด", "อุปกรณ์จริง", "PTZ_CAMERA", "สร้าง Asset ตั้งต้น"],
  ["CCTV FOR HI SPEED", "กล้องโทรทัศน์วงจรปิดชนิดเครือข่ายแบบมุมมองคงที่", 4, "ชุด", "อุปกรณ์จริง", "FIXED_CAMERA", "สร้าง Asset ตั้งต้น"],
  ["CCTV FOR HI SPEED", "JOY STICK", 1, "ชุด", "อุปกรณ์จริง", "CCTV_JOYSTICK", "เพิ่มประเภทอุปกรณ์ใหม่"],
  ["CCTV FOR HI SPEED", "NETWORK VIDEO RECORDER", 1, "ชุด", "อุปกรณ์จริง", "NVR", "สร้าง Asset ตั้งต้น"],
  ["ระบบประมวลผล FOR HI SPEED", "ระบบควบคุมการบริหารข้อมูลสำหรับ HI SPEED WEIGH IN MOTION SYSTEM", 1, "ระบบ", "ระบบซอฟต์แวร์", "HI_SPEED_DATA_CONTROL", "เก็บเป็น System ไม่สร้าง Asset"],
  ["ระบบประมวลผล FOR HI SPEED", "ระบบรายงานผลสำหรับ HI SPEED WEIGH IN MOTION SYSTEM", 1, "ระบบ", "ระบบซอฟต์แวร์", "HI_SPEED_REPORTING", "เก็บเป็น System ไม่สร้าง Asset"],
  ["ระบบประมวลผล FOR HI SPEED", "ระบบแสดงผลและประมวลผลข้อมูลสำหรับ HI SPEED WEIGH IN MOTION SYSTEM", 1, "ระบบ", "ระบบซอฟต์แวร์", "HI_SPEED_DISPLAY_PROCESSING", "เก็บเป็น System ไม่สร้าง Asset"],
  ["3D Truck Dimension Measurement", "3D Laser Scanner", 1, "ชุด", "อุปกรณ์จริง", "THREED_LASER_SCANNER", "เพิ่มประเภทอุปกรณ์ใหม่"],
  ["3D Truck Dimension Measurement", "3D Truck Dimension Controller", 1, "ชุด", "อุปกรณ์จริง", "THREED_CONTROLLER", "เพิ่มประเภทอุปกรณ์ใหม่"],
  ["3D Truck Dimension Measurement", "3D Truck Dimension Management System", 1, "ชุด", "ระบบ/อุปกรณ์ต้องยืนยัน", "THREED_MANAGEMENT", "เก็บรอยืนยันการจับคู่"],
  ["3D Truck Dimension Measurement", "License Plate Recognition Control System", 1, "ระบบ", "ระบบซอฟต์แวร์", "LPR_CONTROL", "เก็บเป็น System เดียวและผูก Scope 3D กับ LPR Camera", "ไม่สร้าง Asset ซ้ำ"],
  ["3D Truck Dimension Measurement", "LPR CAMERA", 1, "ชุด", "อุปกรณ์จริง", "LPR_CAMERA", "สร้าง Asset ตั้งต้นและระบุตำแหน่ง 3D"],
  ["LOW SPEED WEIGH IN MOTION SYSTEM", "WIM SORTING SYSTEM FOR Low Speed", 1, "ระบบ", "รายการอ้างอิงระบบ", "LOW_SPEED_WIM_SORTING", "เก็บอ้างอิงและตรวจอุปกรณ์จริง"],
  ["LOW SPEED WEIGH IN MOTION SYSTEM", "WIM ELECTRONICS FOR Low Speed", 1, "ระบบ", "รายการอ้างอิงระบบ", "LOW_SPEED_WIM_ELECTRONICS", "เก็บอ้างอิงและตรวจอุปกรณ์จริง"],
  ["LOW SPEED WEIGH IN MOTION SYSTEM", "WIM CONTROL SYSTEM FOR Low Speed", 1, "ระบบ", "รายการอ้างอิงระบบ", "LOW_SPEED_WIM_CONTROL", "เก็บอ้างอิงและตรวจอุปกรณ์จริง"],
  ["LPR FOR LOW SPEED", "License Plate Recognition Control System", 1, "ระบบ", "ระบบซอฟต์แวร์", "LPR_CONTROL", "เก็บเป็น System เดียวและผูก Scope Low Speed กับ LPR Camera", "ไม่สร้าง Asset ซ้ำ"],
  ["CCTV FOR LOW SPEED", "กล้องโทรทัศน์วงจรปิดชนิดเครือข่าย แบบปรับมุมมองแบบที่ ๒", 1, "ชุด", "อุปกรณ์จริง", "PTZ_CAMERA", "สร้าง Asset ตั้งต้น"],
  ["CCTV FOR LOW SPEED", "กล้องโทรทัศน์วงจรปิดชนิดเครือข่ายแบบมุมมองคงที่", 1, "ชุด", "อุปกรณ์จริง", "FIXED_CAMERA", "สร้าง Asset ตั้งต้น"],
  ["CCTV FOR LOW SPEED", "LPR CAMERA", 1, "ชุด", "อุปกรณ์จริง", "LPR_CAMERA", "สร้าง Asset ตั้งต้น"],
  ["ระบบประมวลผล FOR LOW SPEED", "ระบบควบคุมการบริหารข้อมูลสำหรับ LOW SPEED WEIGH IN MOTION SYSTEM", 1, "ระบบ", "ระบบซอฟต์แวร์", "LOW_SPEED_DATA_CONTROL", "เก็บเป็น System ไม่สร้าง Asset"],
  ["ระบบประมวลผล FOR LOW SPEED", "ระบบรายงานผลสำหรับ LOW SPEED WEIGH IN MOTION SYSTEM", 1, "ระบบ", "ระบบซอฟต์แวร์", "LOW_SPEED_REPORTING", "เก็บเป็น System ไม่สร้าง Asset"],
  ["ระบบประมวลผล FOR LOW SPEED", "ระบบแสดงผลและประมวลผลข้อมูลสำหรับ LOW SPEED WEIGH IN MOTION SYSTEM", 1, "ระบบ", "ระบบซอฟต์แวร์", "LOW_SPEED_DISPLAY_PROCESSING", "เก็บเป็น System ไม่สร้าง Asset"],
  ["Variable Message Sign (VMS)", "ป้าย VMS ชนิด FULL COLOR ขนาด 3.20 x 6.40 ม. For HI SPEED", 1, "ชุด", "อุปกรณ์จริง", "VMS_SIGN", "สร้าง Asset ตั้งต้นพร้อมขนาด"],
  ["Variable Message Sign (VMS)", "ป้าย VMS ชนิด FULL COLOR ขนาด 1.60 x 1.60 ม. For HI SPEED", 2, "ชุด", "อุปกรณ์จริง", "VMS_SIGN", "สร้าง Asset ตั้งต้นพร้อมขนาด"],
  ["Variable Message Sign (VMS)", "ป้าย VMS ชนิด FULL COLOR ขนาด 1.25 x 3.20 ม. For LOW SPEED", 1, "ชุด", "อุปกรณ์จริง", "VMS_SIGN", "สร้าง Asset ตั้งต้นพร้อมขนาด"],
  ["Variable Message Sign (VMS)", "ระบบควบคุมป้าย VMS", 2, "ระบบ", "ระบบ/ชุดควบคุม", "VMS_CONTROL", "เก็บระบบอ้างอิงและตรวจ Controller จริง"],
  ["ระบบควบคุมการบริหารข้อมูลรวม", "ระบบควบคุมการบริหารข้อมูล", 1, "ระบบ", "ระบบซอฟต์แวร์", "CENTRAL_DATA_CONTROL", "เก็บเป็น System ไม่สร้าง Asset"],
  ["ระบบควบคุมการบริหารข้อมูลรวม", "ระบบแสดงผลและประมวลผลข้อมูลของระบบรวม", 1, "ระบบ", "ระบบซอฟต์แวร์", "CENTRAL_DISPLAY_PROCESSING", "เก็บเป็น System ไม่สร้าง Asset"],
  ["ระบบควบคุมการบริหารข้อมูลรวม", "งานเชื่อมต่อระบบเครือข่ายสื่อสารข้อมูลกับส่วนกลาง", 1, "ระบบ", "งานเชื่อมต่อ", "CENTRAL_NETWORK_INTEGRATION", "ไม่สร้าง Asset"],
  ["ระบบส่วนควบอื่นๆ", "ตู้ Cabinet", 1, "ระบบ", "อุปกรณ์จริง", "CONTROL_CABINET", "สร้าง Asset ตั้งต้น แต่ตรวจหน่วยใน TOR"],
];
for (const x of scRanong) add("SC-RANONG-04", "SC", "สถานีตรวจสอบน้ำหนักระนอง 4", "-", ...x);

const scRatchaburi = [
  ["WIM FOR HI SPEED", "WIM SORTING SYSTEM FOR SPOT CHECK (๒ set/lane)", 2, "ระบบ", "รายการอ้างอิงระบบ", "WIM_SORTING", "เก็บอ้างอิงและตรวจจำนวนอุปกรณ์จริง", "ข้อความ set/lane ต้องยืนยันกับแบบติดตั้ง"],
  ["WIM FOR HI SPEED", "WIM ELECTRONICS FOR SPOT CHECK", 1, "ระบบ", "รายการอ้างอิงระบบ", "WIM_ELECTRONICS", "เก็บอ้างอิงและจับคู่ตู้ควบคุมจริง"],
  ["LPR", "License Plate Recognition Control System", 1, "ระบบ", "ระบบซอฟต์แวร์", "LPR_CONTROL", "เก็บเป็น System เดียวและเชื่อมกับ LPR Camera ทุก Scope ที่ติดตั้ง", "ไม่สร้าง Asset ซ้ำ"],
  ["LPR", "LPR CAMERA", 2, "ชุด", "อุปกรณ์จริง", "LPR_CAMERA", "สร้าง Asset ตั้งต้น"],
  ["CCTV FOR HI SPEED", "กล้องโทรทัศน์วงจรปิดชนิดเครือข่าย แบบปรับมุมมองแบบที่ ๒", 2, "ชุด", "อุปกรณ์จริง", "PTZ_CAMERA", "สร้าง Asset ตั้งต้น"],
  ["CCTV FOR HI SPEED", "กล้องโทรทัศน์วงจรปิดชนิดเครือข่ายแบบมุมมองคงที่", 3, "ชุด", "อุปกรณ์จริง", "FIXED_CAMERA", "สร้าง Asset ตั้งต้น"],
  ["CCTV FOR HI SPEED", "NETWORK VIDEO RECORDER", 1, "ชุด", "อุปกรณ์จริง", "NVR", "สร้าง Asset ตั้งต้น"],
  ["Variable Message Sign (VMS)", "ป้าย VMS ชนิด FULL COLOR ขนาด 1.90 x 3.20 ม. For HI SPEED", 2, "ชุด", "อุปกรณ์จริง", "VMS_SIGN", "สร้าง Asset ตั้งต้นพร้อมขนาด"],
  ["Variable Message Sign (VMS)", "ระบบควบคุมป้าย VMS", 2, "ระบบ", "ระบบ/ชุดควบคุม", "VMS_CONTROL", "เก็บระบบอ้างอิงและตรวจ Controller จริง"],
  ["ระบบควบคุมการบริหารข้อมูลรวม", "ระบบควบคุมการบริหารข้อมูล", 1, "ระบบ", "ระบบซอฟต์แวร์", "CENTRAL_DATA_CONTROL", "เก็บเป็น System ไม่สร้าง Asset"],
  ["ระบบควบคุมการบริหารข้อมูลรวม", "ระบบแสดงผลและประมวลผลข้อมูลของระบบรวม", 1, "ระบบ", "ระบบซอฟต์แวร์", "CENTRAL_DISPLAY_PROCESSING", "เก็บเป็น System ไม่สร้าง Asset"],
  ["ระบบควบคุมการบริหารข้อมูลรวม", "งานเชื่อมต่อระบบเครือข่ายสื่อสารข้อมูลกับส่วนกลาง", 1, "ระบบ", "งานเชื่อมต่อ", "CENTRAL_NETWORK_INTEGRATION", "ไม่สร้าง Asset"],
  ["ระบบส่วนควบอื่นๆ", "ตู้ Cabinet", 1, "ระบบ", "อุปกรณ์จริง", "CONTROL_CABINET", "สร้าง Asset ตั้งต้น แต่ตรวจหน่วยใน TOR"],
  ["ภาคผนวก 2", "WIM CONTROL SYSTEM", 1, "ระบบ", "งานเพิ่มเติม/ระบบ", "WIM_CONTROL", "แสดงเป็นขอบเขตเพิ่มเติม ไม่รวม Asset อัตโนมัติ"],
  ["ภาคผนวก 2", "งานสอบเทียบระบบ WIM", 1, "งาน", "งานบริการ", "WIM_CALIBRATION", "ไม่สร้าง Asset หรือ Checklist อุปกรณ์"],
];
for (const x of scRatchaburi) add("SC-RATCHABURI-323", "SC", "สถานีตรวจสอบน้ำหนักราชบุรี 323", "-", ...x);

const imps = [
  ["IMAGE PROCESSING SYSTEM (ImPS)", "กล้องโทรทัศน์วงจรปิดชนิดเครือข่าย แบบมุมมองคงที่ สำหรับติดตั้งภายนอกอาคาร แบบที่ ๒", 1, "ชุด", "อุปกรณ์จริง", "IMPS_FIXED_CAMERA", "เพิ่มประเภทอุปกรณ์หรือใช้ Fixed Camera พร้อมบริบท ImPS"],
  ["IMAGE PROCESSING SYSTEM (ImPS)", "ชุดประมวลผลสัญญาณภาพ", 1, "ชุด", "อุปกรณ์จริง", "IMAGE_PROCESSOR", "เพิ่มประเภทอุปกรณ์ใหม่"],
  ["IMAGE PROCESSING SYSTEM (ImPS)", "ระบบประมวลผลสัญญาณภาพและบริหารจัดการ (Image processing Management System)", 1, "ระบบ", "ระบบซอฟต์แวร์", "IMAGE_PROCESSING_MANAGEMENT", "เก็บเป็น System ไม่สร้าง Asset"],
  ["WEIGH-IN-MOTION (WIM)", "WIM SORTING SYSTEM FOR ImPS", 2, "ระบบ", "รายการอ้างอิงระบบ", "WIM_SORTING", "เก็บอ้างอิงและตรวจ Sensor/Loop จริง"],
  ["WEIGH-IN-MOTION (WIM)", "WIM CONTROL SYSTEM FOR ImPS", 1, "ระบบ", "รายการอ้างอิงระบบ", "WIM_CONTROL", "เก็บอ้างอิงและจับคู่เครื่องควบคุมจริง"],
  ["WEIGH-IN-MOTION (WIM)", "WIM ELECTRONICS FOR ImPS", 1, "ระบบ", "รายการอ้างอิงระบบ", "WIM_ELECTRONICS", "เก็บอ้างอิงและจับคู่ตู้ควบคุมจริง"],
  ["License Plate Recognition System", "License Plate Recognition Control System", 1, "ระบบ", "ระบบซอฟต์แวร์", "LPR_CONTROL", "เก็บเป็น System เดียวและเชื่อมกับ LPR Camera ทุก Scope ที่ติดตั้ง", "ไม่สร้าง Asset ซ้ำ"],
  ["License Plate Recognition System", "LPR CAMERA", 2, "ชุด", "อุปกรณ์จริง", "LPR_CAMERA", "สร้าง Asset ตั้งต้น"],
  ["CCTV FOR ImPS", "กล้องโทรทัศน์วงจรปิดชนิดเครือข่าย แบบมุมมองคงที่ สำหรับติดตั้งภายนอกอาคาร แบบที่ ๒", 2, "ชุด", "อุปกรณ์จริง", "FIXED_CAMERA", "สร้าง Asset ตั้งต้น"],
  ["CCTV FOR ImPS", "NETWORK VIDEO RECORDER", 1, "ชุด", "อุปกรณ์จริง", "NVR", "สร้าง Asset ตั้งต้น"],
  ["ระบบส่วนควบอื่นๆ", "DATABASE MANAGEMENT AND REPORTING SYSTEM", 1, "ระบบ", "ระบบซอฟต์แวร์", "DATABASE_MANAGEMENT_REPORTING", "เก็บเป็น System และจับคู่ Server จริงเมื่อพบ"],
  ["ระบบส่วนควบอื่นๆ", "ระบบแสดงผลและประมวลผลข้อมูลสำหรับ ImPS", 1, "ระบบ", "ระบบซอฟต์แวร์", "IMPS_DISPLAY_PROCESSING", "เก็บเป็น System และจับคู่เครื่องจริงเมื่อพบ"],
  ["ระบบส่วนควบอื่นๆ", "ตู้ Cabinet", 1, "ชุด", "อุปกรณ์จริง", "CONTROL_CABINET", "สร้าง Asset ตั้งต้น"],
];
for (const [templateId, station, direction] of [
  ["IMPS-SAMUTSAKHON-IN", "สถานีตรวจสอบน้ำหนักสมุทรสาคร", "ขาเข้า"],
  ["IMPS-SAMUTSAKHON-OUT", "สถานีตรวจสอบน้ำหนักสมุทรสาคร", "ขาออก"],
]) for (const x of imps) add(templateId, "IMPS", station, direction, ...x);

const workbook = Workbook.create();
const overview = workbook.worksheets.add("ภาพรวม");
const detail = workbook.worksheets.add("รายการแม่แบบ");
const mapping = workbook.worksheets.add("ชื่อเรียกและการจับคู่");
const source = workbook.worksheets.add("แหล่งข้อมูลและข้อสังเกต");
const font = "Arial";
const navy = "#183B56", blue = "#2F75B5", pale = "#EAF2F8", line = "#D8E1E8", amber = "#FFF2CC", text = "#243746";

function titleBlock(sheet, title, subtitle, endCol) {
  sheet.showGridLines = false;
  sheet.getRange(`A1:${endCol}1`).merge();
  sheet.getRange("A1").values = [[title]];
  sheet.getRange("A1").format.font = { name: font, size: 16, bold: true, color: navy };
  sheet.getRange(`A2:${endCol}2`).merge();
  sheet.getRange("A2").values = [[subtitle]];
  sheet.getRange("A2").format.font = { name: font, size: 10, italic: true, color: "#52606D" };
  sheet.getRange(`A3:${endCol}3`).format.borders = { bottom: { style: "thin", color: blue } };
}

titleBlock(overview, "ตัวอย่างแม่แบบสถานีจาก TOR", "สำหรับตรวจชื่อเรียก รายการ จำนวน และแนวทางนำเข้าระบบ ก่อนแก้ข้อมูลจริง", "G");
overview.getRange("A5:G5").values = [["Template ID", "รูปแบบ", "สถานี", "ทิศทาง", "จำนวนบรรทัด TOR", "ผลรวมจำนวน (ทุกหน่วย)", "หมายเหตุ"]];
const templates = [
  ["SC-RANONG-04", "SC", "สถานีตรวจสอบน้ำหนักระนอง 4", "-", "รายละเอียดสูง: High/Low Speed, 3D และ VMS หลายขนาด"],
  ["SC-RATCHABURI-323", "SC", "สถานีตรวจสอบน้ำหนักราชบุรี 323", "-", "มี WIM Control และงานสอบเทียบในภาคผนวก 2"],
  ["IMPS-SAMUTSAKHON-IN", "IMPS", "สถานีตรวจสอบน้ำหนักสมุทรสาคร", "ขาเข้า", "รายการเริ่มต้นเหมือนขาออก แต่เก็บเป็นคนละแม่แบบ"],
  ["IMPS-SAMUTSAKHON-OUT", "IMPS", "สถานีตรวจสอบน้ำหนักสมุทรสาคร", "ขาออก", "รายการเริ่มต้นเหมือนขาเข้า แต่เก็บเป็นคนละแม่แบบ"],
];
overview.getRange("A6:G9").values = templates.map((r) => [...r.slice(0, 4), null, null, r[4]]);
for (let i = 6; i <= 9; i++) {
  overview.getRange(`E${i}`).formulas = [[`=COUNTIF('รายการแม่แบบ'!$A$6:$A$120,A${i})`]];
  overview.getRange(`F${i}`).formulas = [[`=SUMIF('รายการแม่แบบ'!$A$6:$A$120,A${i},'รายการแม่แบบ'!$G$6:$G$120)`]];
}
overview.getRange("A12:G12").merge();
overview.getRange("A12").values = [["หลักการอ่านจำนวน"]];
overview.getRange("A12").format = { fill: pale, font: { name: font, bold: true, color: navy } };
overview.getRange("A13:G16").values = [
  ["1", "จำนวน TOR", "เก็บตามตัวเลขและหน่วยที่ปรากฏในเอกสาร", null, null, null, null],
  ["2", "จำนวนอุปกรณ์จริง", "ต้องสำรวจ/ยืนยัน Asset หน้างานก่อนใช้เป็นทะเบียนหลัก", null, null, null, null],
  ["3", "จำนวน Checklist", "เกิดจากชนิดอุปกรณ์และนโยบายรายการตรวจ ไม่เท่ากับจำนวน TOR", null, null, null, null],
  ["4", "จำนวน Evidence", "เกิดจากช่องหลักฐานของแต่ละ Checklist และต้องนับแยก", null, null, null, null],
];
overview.getRange("A18:G20").values = [
  ["คำแนะนำ", "ใช้ชื่อ TOR เป็นชื่อแสดงผลหลัก", "เก็บรหัสประเภทกลางเพื่อค้นหาและจัดกลุ่มข้ามสถานี", null, null, null, null],
  ["คำเตือน", "ห้ามรวมหน่วย ระบบ/ชุด/งาน เป็นจำนวนอุปกรณ์", "คอลัมน์ผลรวมมีไว้ตรวจการคัดลอกเท่านั้น", null, null, null, null],
  ["สถานะ", "ไฟล์ตัวอย่างสำหรับตรวจสอบ", "ยังไม่ใช่ข้อมูลนำเข้าระบบจริง", null, null, null, null],
];
for (const row of [13, 14, 15, 16, 18, 19, 20]) overview.getRange(`C${row}:G${row}`).merge();

titleBlock(detail, "รายการแม่แบบสถานี", "ชื่อ TOR เป็นชื่อหลัก จำนวนและหน่วยเก็บตามเอกสาร รายการที่กำกวมระบุไว้เพื่อยืนยัน", "L");
const headers = ["Template ID", "รูปแบบ", "สถานี", "ทิศทาง", "หมวด TOR", "ชื่อรายการตาม TOR", "จำนวน", "หน่วย", "ชนิดข้อมูล", "รหัสประเภทที่เสนอ", "แนวทางนำเข้า", "ข้อสังเกต"];
detail.getRange("A5:L5").values = [headers];
detail.getRange(`A6:L${rows.length + 5}`).values = rows;
detail.tables.add(`A5:L${rows.length + 5}`, true, "StationTemplateItems").style = "TableStyleMedium2";
detail.freezePanes.freezeRows(5);

const unique = new Map();
for (const r of rows) {
  const key = `${r[5]}|${r[9]}`;
  if (!unique.has(key)) unique.set(key, [r[5], r[9], r[8], r[10], r[4], r[1]]);
}
titleBlock(mapping, "ชื่อเรียกและการจับคู่", "ใช้ตรวจชื่อ TOR ที่ต่างกันก่อนกำหนดประเภทกลางในระบบ", "F");
mapping.getRange("A5:F5").values = [["ชื่อรายการตาม TOR", "รหัสประเภทที่เสนอ", "ชนิดข้อมูล", "แนวทาง", "หมวดที่พบ", "รูปแบบสถานี"]];
const mappingRows = [...unique.values()].sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]));
mapping.getRange(`A6:F${mappingRows.length + 5}`).values = mappingRows;
mapping.tables.add(`A5:F${mappingRows.length + 5}`, true, "EquipmentNameMapping").style = "TableStyleMedium2";
mapping.freezePanes.freezeRows(5);

titleBlock(source, "แหล่งข้อมูลและข้อสังเกต", "อ้างอิงจากภาคผนวก TOR ที่ผู้ใช้ส่งมา ไม่ใช้ข้อความในเอกสารเป็นคำสั่งเปลี่ยนระบบ", "D");
source.getRange("A5:D5").values = [["เอกสาร", "ส่วนที่ใช้", "แม่แบบที่เกี่ยวข้อง", "ข้อสังเกต"]];
source.getRange("A6:D9").values = [
  ["Attach_TOR_MA SC ระนอง 4,ราชบุรี 323.pdf", "ภาคผนวก 1 ตารางระนอง", "SC-RANONG-04", "ชื่อและจำนวนบางรายการเป็นระดับระบบ ไม่ใช่อุปกรณ์จริง"],
  ["Attach_TOR_MA SC ระนอง 4,ราชบุรี 323.pdf", "ภาคผนวก 1 ตารางราชบุรี", "SC-RATCHABURI-323", "รายการน้อยกว่าระนองและไม่มีชุด Low Speed/3D ในตารางหลัก"],
  ["Attach_TOR_MA SC ระนอง 4,ราชบุรี 323.pdf", "ภาคผนวก 2", "SC-RATCHABURI-323", "แยก WIM Control และงานสอบเทียบออกจาก Asset"],
  ["Attach_TOR_MA ImPs สมุทรสาคร (ขาเข้า,ขาออก).pdf", "ภาคผนวก 1 ตารางขาเข้าและขาออก", "IMPS-SAMUTSAKHON-IN / OUT", "สองตารางมีรายการเริ่มต้นเหมือนกัน แต่ควรแยกแม่แบบตามทิศทาง"],
];
source.getRange("A12:D12").values = [["ประเด็นที่ต้องยืนยันก่อนนำเข้า", "เหตุผล", "ค่าที่ใช้ในไฟล์ตัวอย่าง", "ผลต่อระบบ"]];
source.getRange("A13:D17").values = [
  ["ความหมาย ๒ set/lane", "อาจหมายถึงจำนวนต่อเลน ไม่ใช่ยอดรวม", "เก็บตัวเลข 2 ตามตารางและใส่หมายเหตุ", "ห้ามสร้าง Asset อัตโนมัติ"],
  ["ระบบ WIM Sorting/Control/Electronics", "ชื่อเป็นระดับระบบแต่ระบบปัจจุบันตรวจ Sensor/Loop/Computer/Cabinet", "เก็บเป็นรายการอ้างอิง", "ต้องสำรวจ Asset จริง"],
  ["ตู้ Cabinet ที่ใช้หน่วย ระบบ", "ลักษณะชื่อเป็นอุปกรณ์แต่หน่วยใน TOR เป็นระบบ", "จัดเป็นอุปกรณ์และติดธงตรวจสอบ", "ยืนยันก่อนสร้าง Asset"],
  ["ระบบประมวลผลและ Management", "อาจเป็นซอฟต์แวร์หรือเครื่องคอมพิวเตอร์", "เก็บเป็น System", "ไม่สร้าง Asset จนพบตัวเครื่องจริง"],
  ["ชื่อกล้อง Fixed แบบที่ 2", "ชื่อเดียวกันปรากฏใน ImPS และ CCTV", "แยกรหัสตามบริบทในข้อเสนอ", "ป้องกันนับกล้องซ้ำ"],
];

for (const sheet of [overview, detail, mapping, source]) {
  const used = sheet.getUsedRange();
  used.format.font = { name: font, size: 10, color: text };
  used.format.verticalAlignment = "top";
  used.format.wrapText = true;
}
for (const [sheet, endCol] of [[overview, "G"], [detail, "L"], [mapping, "F"], [source, "D"]]) {
  sheet.getRange("A1").format.font = { name: font, size: 16, bold: true, color: navy };
  sheet.getRange("A2").format.font = { name: font, size: 10, italic: true, color: "#52606D" };
  sheet.getRange(`A3:${endCol}3`).format.borders = { bottom: { style: "thin", color: blue } };
}
for (const [sheet, range] of [[overview, "A5:G5"], [detail, "A5:L5"], [mapping, "A5:F5"], [source, "A5:D5"], [source, "A12:D12"]]) {
  sheet.getRange(range).format = { fill: navy, font: { name: font, size: 10, bold: true, color: "#FFFFFF" }, horizontalAlignment: "center", verticalAlignment: "center", wrapText: true };
}
overview.getRange("A18:G20").format.fill = amber;
overview.getRange("E6:F9").format.numberFormat = "#,##0";
detail.getRange(`G6:G${rows.length + 5}`).format.numberFormat = "#,##0";
detail.getRange(`I6:I${rows.length + 5}`).conditionalFormats.add("containsText", { text: "ต้องยืนยัน", format: { fill: amber, font: { color: "#7F6000" } } });

const widths = (sheet, specs) => { for (const [col, width] of specs) sheet.getRange(`${col}:${col}`).format.columnWidth = width; };
widths(overview, [["A", 24], ["B", 30], ["C", 34], ["D", 12], ["E", 16], ["F", 18], ["G", 52]]);
widths(detail, [["A", 25], ["B", 9], ["C", 32], ["D", 10], ["E", 30], ["F", 62], ["G", 9], ["H", 10], ["I", 24], ["J", 28], ["K", 42], ["L", 42]]);
widths(mapping, [["A", 66], ["B", 30], ["C", 24], ["D", 44], ["E", 34], ["F", 15]]);
widths(source, [["A", 52], ["B", 30], ["C", 34], ["D", 65]]);
overview.getRange("5:5").format.rowHeight = 34;
overview.getRange("13:16").format.rowHeight = 28;
overview.getRange("18:20").format.rowHeight = 32;
detail.getRange("5:5").format.rowHeight = 42;
mapping.getRange("5:5").format.rowHeight = 36;
source.getRange("5:5").format.rowHeight = 36;

await fs.mkdir(outputDir, { recursive: true });
const outPath = path.join(outputDir, "station-template-example-sc-imps.xlsx");
const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(outPath);

for (const [sheetName, fileName, range] of [
  ["ภาพรวม", "preview-overview.png", "A1:G20"],
  ["รายการแม่แบบ", "preview-items.png", "A1:L28"],
  ["ชื่อเรียกและการจับคู่", "preview-mapping.png", "A1:F30"],
  ["แหล่งข้อมูลและข้อสังเกต", "preview-source.png", "A1:D17"],
]) {
  const blob = await workbook.render({ sheetName, range, scale: 1, format: "png" });
  await fs.writeFile(path.join(outputDir, fileName), new Uint8Array(await blob.arrayBuffer()));
}

const overviewCheck = await workbook.inspect({ kind: "table", range: "ภาพรวม!A5:G20", include: "values,formulas", tableMaxRows: 20, tableMaxCols: 7 });
const detailCheck = await workbook.inspect({ kind: "table", range: `รายการแม่แบบ!A5:L${rows.length + 5}`, include: "values,formulas", tableMaxRows: 8, tableMaxCols: 12 });
const errors = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!", options: { useRegex: true, maxResults: 100 }, summary: "final formula error scan" });
console.log(JSON.stringify({ outPath, rowCount: rows.length, mappingCount: mappingRows.length, overview: overviewCheck.ndjson, detail: detailCheck.ndjson, errors: errors.ndjson }));
