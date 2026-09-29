# 02: ตรวจสัญญาทดสอบตัวเลือกกลุ่มในหน้าสร้างสถานี

Type: test-maintenance
Status: needs-triage
Priority: medium
Blocked by: none

## ปัญหา

`tools/test_station_system_quantity.mjs` คาดหวังว่ากลุ่มที่ค้นหาได้จะถูกวาดเป็น
`<option>` สำหรับมือถือ แต่ `ContextualStationPage.jsx` ปัจจุบันใช้ `nav`
ที่มีปุ่มกลุ่มเดียวกับแถบด้านข้าง ต้องยืนยันว่ารูปแบบนี้ใช้ง่ายบนจอมือถือจริง
ก่อนแก้ชุดทดสอบหรือเปลี่ยนส่วนติดต่อ

## ทำซ้ำ

1. รัน `node tools/test_station_system_quantity.mjs`
2. ดู assertion เรื่อง `visibleRelationshipGroups.map((group) => <option` ที่บรรทัด 132
3. เปิด `#/stations/new` ไปขั้นระบบและอุปกรณ์ แล้วค้นหา/เลือกกลุ่มที่ความกว้าง
   CSS 320, 375 และ 390 พิกเซล

## ผลที่คาด

ค้นหาและเลือกกลุ่มได้บนมือถือ รายการค้นหาตรงกับแถบหมวด ไม่มีปุ่ม/ชื่อหมวดถูกตัด
และผู้ใช้รู้ว่ากลุ่มใดกำลังเลือกอยู่

## ผลที่พบ

ข้อทดสอบแบบ Source ไม่ตรงกับ markup ปัจจุบัน การตรวจด้วย Playwright ที่ตั้ง CSS
viewport จริง 390 พิกเซลพบว่าค้นหา `CCTV` แล้วได้กลุ่ม SC-01/SC-04 และเลือก SC-04
แล้วหัวข้อ Work Spec เปลี่ยนเป็น SC-04 ตามที่เลือก

ทดสอบเพิ่มกับ IMPS ที่ 320/390 พิกเซล พบกลุ่ม IMPS-01 ถึง IMPS-06; เลือก IMPS-04
แล้วหัวข้อ Work Spec เปลี่ยนเป็น IMPS-04 LPR การเลือกกลุ่มทำงานได้ แต่ยังไม่ได้
ทดสอบกับข้อมูลสถานีที่บันทึกจริง

## หลักฐาน

- `tools/test_station_system_quantity.mjs`
- `src/app/pages/ContextualStationPage.jsx`
- `.scratch/ux-ui-real-use-2026-09/screenshots/station-new-step2-390.png`
- `.scratch/ux-ui-real-use-2026-09/screenshots/station-new-step2-imps-selected-390.png`
- `.scratch/ux-ui-real-use-2026-09/screenshots/README.md`

## Comments

- 29 ก.ย. 2569: ภาพชุดใหม่และการลองเลือก SC/IMPS ใช้ viewport ถูกต้องแล้ว ต้องให้เจ้าของทดสอบยืนยันว่าจะเปลี่ยน assertion จากชนิด element (`<option>`) ไปตรวจผลการค้นหาและการเลือกหมวดแทนหรือไม่
