# UX รองรับหลายภาค หลายสัญญา หลายสถานี

สถานะ: implemented

## Context hierarchy

`Station Profile → Inspection Round → Snapshot` เป็นทางเริ่มตรวจหลัก ใช้สถานีที่พร้อมและวันที่ตรวจ โดยไม่ต้องเลือกสัญญาหรืองวดก่อน

`Region → Contract → WorkPackage → ContractStationAssignment` เป็นข้อมูลเสริมที่เชื่อมกับรอบภายหลังได้ ความสัมพันธ์ต้องตรงกับสถานีของรอบ และบันทึกเป็นประวัติแบบเพิ่มใหม่เพื่อใช้ค้นหา/จัดกลุ่มเท่านั้น

สัญญาหนึ่งฉบับมีได้หลายภาค และ assignment เป็นความสัมพันธ์ตามช่วงเวลาที่เก็บสถานะเดิมไว้เมื่อสถานีย้ายสัญญา

## Report boundary

- `Contract Work Report`: หน้าปกงานตามสัญญา/งวด/สถานี แยกจากรายงานตรวจสถานี
- `Station Inspection Report`: อ้างถึงรอบและ Snapshot เดิม; ระหว่างตรวจพิมพ์ฉบับร่างจากข้อมูลปัจจุบันได้โดยไม่ปิดรอบหรือบันทึกเป็นรายงานฉบับสมบูรณ์ หลังปิดรอบผู้ใช้จึงกรอกหน้าปกแยกใน `stationInspectionReports` และเลขสัญญาบนปกไม่ดึงจาก Contract ที่เชื่อม
- การเชื่อม Contract/WorkPackage ภายหลังใช้ค้นหาและจัดกลุ่มเท่านั้น ห้ามเปลี่ยน Snapshot, ผลตรวจ, หลักฐาน หรือหน้าปก
- การย้ายข้อมูลเดิมคงรอบและ Snapshot เดิม พร้อมนำค่าหน้าปกเดิมมาเป็นค่าเริ่มต้นของรายงาน
- การสร้างรายงานแต่ละครั้งเพิ่ม revision ใหม่ ไม่เขียนทับฉบับก่อน

## Implemented routes

- `#/contracts` redirects to `#/dashboard`; the contract hub page was removed
- `#/contracts/new`
- `#/contracts/:contractId`
- `#/contracts/:contractId/work-packages/:workPackageId`
- `#/contracts/:contractId/work-packages/:workPackageId/reports/new`

## Verification

- `node tools/test_station_inspection_reports.mjs`
- `node tools/test_quick_inspection_flow.mjs`
- `npm run test:contracts`
- `node tools/test_state_scope.mjs`
- `npm run test:navigation-router`
- `npm run test:report-template`
- `npm run build`
- Browser smoke: create multi-region contract → work package → station assignment → contract cover → refresh/deep link

หมายเหตุ: `npm run test:all` ยังมี failure เดิมจาก `test_contextual_station_names.mjs` และ `test_station_tor_ui.mjs` ซึ่งไม่แตะต้องในงานนี้; contract/domain/state-scope tests ผ่าน

## Comments

- 2026-09-24: ตามคำขอผู้ใช้ เอาหน้าศูนย์สัญญาและเมนูออก โดยคงหน้าสร้าง/รายละเอียดสัญญา งวดงาน รายงาน และข้อมูลสัญญาที่ใช้อยู่ใน workflow ตรวจและรายงาน
- 2026-09-29: ปรับการเริ่ม Inspection Round ให้ใช้สถานีและวันที่ตรวจเท่านั้น; สัญญา/งวดเป็นการเชื่อมทางเลือกหลังเริ่มตรวจ และหน้าปกรายงานตรวจสถานีแยกเก็บหลังปิดรอบ
- 2026-09-29: เพิ่มการพิมพ์ฉบับร่างระหว่างตรวจ โดยไม่ต้องปิดรอบ ไม่ตรวจเงื่อนไขหน้าปกฉบับสมบูรณ์ และไม่สร้าง revision ในประวัติรายงาน
