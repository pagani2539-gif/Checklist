# Format-qualified SC/IMPS display groups

Type: feature
Status: resolved
Blocked by: 06

## Request

จัดลำดับหมวด SC และ IMPS ใหม่ให้เริ่มที่ `01` แยกตาม Format ใช้ลำดับ BOQ ใน
หน้าเพิ่มสถานี และรักษา Source/TOR/Item/Evidence/Snapshot identity เดิม

## Answer

เพิ่ม `boq-system-groups-v2` โดยใช้ `SC-01` ถึง `SC-06` และ `IMPS-01` ถึง
`IMPS-06` พร้อม `.01` Equipment และ `.02` Systems & Software แก้การเรียง
System ในหน้า New Station ให้ใช้ BOQ order รวม WIM Sorting ไว้ในตำแหน่ง WIM
ที่มีบริบท แก้ direct mapping ของ Asset ที่เคยพึ่ง fallback และเพิ่ม Report
cover lookup สำหรับรหัส format-qualified

Snapshot v1 ยังคงใช้รหัสเดิม ขณะที่ Draft/Profile ใหม่และ Snapshot รอบใหม่ใช้
v2 โดยไม่เปลี่ยน Item ID, Evidence Slot ID, TOR/source code, Asset ID หรือ
WIM Parent/Lane relationship

## Verification

- `node tools/test_boq_display_v2.mjs`
- `node tools/test_boq_checklist_groups.mjs`
- `node tools/test_station_creation.mjs`
- `node tools/test_report_companies.mjs`
