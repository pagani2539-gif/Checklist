Status: ready-for-agent

## Problem Statement

ชื่อ หมวด ปริมาณ และหน่วยของอุปกรณ์ในระบบยังอิงรายการ Present MA แบบย่อ ทำให้ SC ระนองซึ่งมี High Speed, Low Speed, 3D, VMS และระบบส่วนกลางไม่ครบ และคำว่า `ชุด`/`ระบบ` อาจถูกนับปนกับ Asset จริง

## Solution

สร้างบัญชีรายการมาตรฐานกลางหนึ่งชุด แล้วจัดชุดรายการ TOR เริ่มต้นแยกสำหรับ SC และ IMPS โดยเก็บชื่อแสดงผล ชื่อต้นฉบับ หมวด ขอบเขต ชนิดรายการ ปริมาณ และหน่วยอย่างอิสระจากทะเบียน Asset จริง หน้า Station Profile แสดงจำนวน TOR เทียบจำนวนติดตั้งจริง และ Snapshot เดิมไม่ถูกเขียนทับ

## User Stories

1. As an ผู้ดูแลระบบ, I want a stable canonical item code, so that TOR names with different wording map to one meaning.
2. As an ผู้ดูแลระบบ, I want separate SC and IMPS TOR sets, so that each station starts with the right scope without creating more station-template types.
3. As an ผู้ดูแลสถานี, I want to see the original TOR wording, so that I can trace every entry back to the source document.
4. As an ผู้ดูแลสถานี, I want TOR quantity and unit shown together, so that `2 ระบบ` is not mistaken for two physical devices.
5. As an ผู้ดูแลสถานี, I want Asset, System, and Service separated, so that only physical equipment enters the asset register.
6. As an ผู้ดูแลสถานี, I want High Speed, Low Speed, ImPS, Central, and Station-wide scopes, so that context does not create duplicate equipment types.
7. As an ผู้ตรวจ, I want the current Station Profile to drive new rounds, so that inspections match installed equipment.
8. As an ผู้ตรวจสอบย้อนหลัง, I want old Snapshots unchanged, so that historical reports remain reproducible.
9. As an ผู้บริหาร, I want separate totals for TOR lines, TOR units, installed Assets, Systems, and Services, so that completion is not represented by one misleading denominator.

## Implementation Decisions

- Keep exactly two Station Templates: `SC` and `IMPS`, both defaulting to two lanes with four Sensors and two Loops per lane.
- Add a canonical catalog with stable IDs and Thai display names; preserve English/original TOR names as source metadata.
- Model every Station TOR Item with category, operational scope, kind (`asset`, `system`, `service`), quantity, unit, and optional Asset mapping.
- Seed SC with the 33 reviewed Ranong TOR lines and IMPS with the 13 reviewed Samut Sakhon TOR lines.
- Treat TOR totals as references. Do not automatically convert mixed `ชุด` and `ระบบ` quantities into Asset counts.
- Station Profile may adjust actual quantities and applicability without changing the shared canonical catalog.
- New rounds copy the current profile and TOR references into their Snapshot; normalization of legacy profiles is additive and old Snapshots remain unchanged.

## Testing Decisions

- Test through the public domain seam that creates/normalizes Station Draft, Station Profile, and Snapshot.
- Test the visible UI seam for station creation and TOR-versus-installed summaries.
- Use fixed expected literals from the reviewed TOR: SC 33 lines with 22 `ชุด` and 19 `ระบบ`; IMPS 13 lines with 10 `ชุด` and 7 `ระบบ`.
- Reuse station-creation, Item Library, copy-consistency, ordering, and report tests; avoid assertions against private helper structure.

## Out of Scope

- Rewriting existing inspection Snapshots or attachments.
- Treating every TOR system or service as a serial-numbered Asset.
- Adding station-template types beyond SC and IMPS.
- Field/UAT validation of actual installed quantities.

## Further Notes

The TOR tables are documentary references. Actual installed quantities remain Station Profile data and require field confirmation.
