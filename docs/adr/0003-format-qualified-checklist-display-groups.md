# ADR 0003: Format-qualified Checklist display groups

สถานะ: ยอมรับ

## Context

SC และ IMPS ใช้หมวดงานที่มีความหมายใกล้กัน แต่เป็นคนละ Format การใช้เลข
ต่อเนื่องร่วมกันทำให้รายการ IMPS เริ่มที่ 07 และทำให้เลขในหน้าเพิ่มสถานี
สะท้อนลำดับ Catalog เดิมมากกว่าลำดับ BOQ ที่ผู้ปฏิบัติงานใช้จริง

## Decision

- ให้แต่ละ Format เริ่มหมวดแสดงผลที่ `01` และจบที่ `06`
- ใช้รหัสเต็ม `SC-01` ถึง `SC-06` และ `IMPS-01` ถึง `IMPS-06` เป็น
  presentation group ID
- ใช้ `.01` สำหรับ Equipment และ `.02` สำหรับ Systems & Software ภายใน
  กลุ่มเดียวกัน
- ให้ `displayNumber` เป็นเลขท้องถิ่น เช่น `01.02` ได้เฉพาะบริบทที่ระบุ
  Format อยู่แล้ว ส่วน Report, accessible label และข้อมูลข้าม component ใช้
  `SC-01.02` หรือ `IMPS-01.02`
- เก็บ `sourceCode` และ TOR code เดิมแยกจาก presentation code เช่น `2.1`,
  `3.1`, `5.1` และ `1.1.12`
- เรียงกลุ่มและ System ในหน้าเพิ่มสถานีตาม BOQ/display order ไม่ใช้ลำดับ
  `CANONICAL_STATION_ITEMS` เป็นลำดับหน้าจอโดยตรง

## SC mapping

| Group ID | Display group |
| --- | --- |
| `SC-01` | WIM High Speed |
| `SC-02` | VMS for High Speed |
| `SC-03` | 3D Truck Dimension Measurement |
| `SC-04` | Low Speed WIM |
| `SC-05` | VMS for Low Speed |
| `SC-06` | Central Systems |

## IMPS mapping

| Group ID | Display group |
| --- | --- |
| `IMPS-01` | Image Processing |
| `IMPS-02` | WIM |
| `IMPS-03` | 3D Truck Dimension Measurement |
| `IMPS-04` | LPR |
| `IMPS-05` | CCTV |
| `IMPS-06` | Data Systems |

## Compatibility and consequences

- `boq-system-groups-v2` ใช้กับ Draft, Profile ใหม่ และ Snapshot รอบตรวจใหม่
- Snapshot ที่ระบุ `boq-system-groups-v1` ใช้เลขเดิมต่อไป และไม่ถูก rewrite
- ไม่เปลี่ยน Item ID, Evidence Slot ID, TOR/source code, Asset ID หรือ
  Snapshot history
- WIM Sorting System ยังคงเป็น System record ที่ผูก Parent/Lane แยกตามของจริง
- Report ใช้ presentation group ID ก่อน แล้วจึง fallback ไปยัง source section code
  สำหรับ Report รุ่นเก่า
