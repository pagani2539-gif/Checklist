# 01: ยืนยันจำนวน Asset ปัจจุบันใน Item Library

Type: test-maintenance
Status: needs-triage
Priority: medium
Blocked by: none

## ปัญหา

`tools/test_item_library.mjs` คาดหวัง `createSystemItemCatalog()` 18 รายการ
แต่รอบล่าสุดได้ 17 รายการ การตรวจ Source พบ `EQUIPMENT_TYPES` 19 นิยาม
มี 2 นิยามเป็น `legacyOnly` (`LPR_CONTROL_SYSTEM`, `CABINET`) จึงเหลือ
นิยามปัจจุบัน 17 รายการ

## ทำซ้ำ

1. รัน `node tools/test_item_library.mjs`
2. ตรวจ assertion บรรทัด 24 และผล `createSystemItemCatalog().length`

## ผลที่คาด

จำนวนในชุดทดสอบต้องตรงกับ Asset ปัจจุบันที่อนุญาตให้เลือก และตรวจชื่อ/ประเภท
ทุกตัวกับแหล่งข้อมูลมาตรฐาน

## ผลที่พบ

การทดสอบล้มเหลวที่ 18 เทียบกับ 17 ยังต้องให้เจ้าของข้อมูลยืนยันว่าเป็นจำนวน
ที่คาดหวังเก่าหรือมี Asset ปัจจุบันขาดจาก catalog

## หลักฐาน

- `tools/test_item_library.mjs`
- `src/domain/master-checklist.js` (`EQUIPMENT_TYPES`, `createSystemItemCatalog`)
- `src/domain/canonical-station-catalog.js`
