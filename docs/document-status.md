# Document Status — Checklist Operations Hub

สถานะสรุป: 12 ตุลาคม 2569 (Asia/Bangkok)

เอกสารนี้เป็นจุดเริ่มต้นสำหรับอ่านเอกสารของโปรเจกต์ เมื่อเอกสารหลายฉบับพูดถึงคนละช่วงเวลา ให้ยึด source of truth ตามลำดับนี้:

1. โค้ดที่ runtime ใช้จริงใน `src/main.jsx` → `src/app/App.jsx`, `src/app/router.js`, `src/domain/` และ `server.mjs`/`server/`
2. `CONTEXT.md` และ ADR ที่ยอมรับแล้วใน `docs/adr/`
3. เอกสาร operational ปัจจุบันใน `README.md` และ `docs/`
4. `.scratch/` สำหรับ spec, issue และ readiness evidence ของแต่ละ effort
5. ไฟล์ที่มีคำว่า `audit`, `qa`, วันที่ หรืออยู่ใต้ `output/` เป็นหลักฐานย้อนหลัง ไม่ใช่คำสั่งหรือค่าปัจจุบันโดยอัตโนมัติ

## สถานะ runtime ปัจจุบัน

- Frontend ใช้ React/Vite และ custom hash router; route หลักคือ Stations, Inspections และ History พร้อมเส้นทางสร้าง/ดู Contract, Work Package และ Contract Work Report (`#/dashboard` และหน้า index ของ `#/contracts` เปลี่ยนไป `#/inspections`) รอบใหม่ที่ผูกสัญญาเลือก Contract, Work Package และสถานีจากบริบทเดียวกัน ส่วน Contract Work Report แยกจาก Station Inspection Report
- `VITE_STORAGE_MODE=local` ใช้ localStorage/IndexedDB แบบ local-first
- `VITE_STORAGE_MODE=server` โหลด/บันทึก state ผ่าน `/api/v1/state`; เมื่อบันทึกไม่สำเร็จ client จะยกเลิกการแก้ไขที่ยังไม่บันทึกและโหลดข้อมูลส่วนกลางล่าสุด โดยไม่เก็บหรือส่งซ้ำ browser draft หากโหลดข้อมูลไม่ได้จะระงับการเขียนจนกว่าจะโหลดได้
- Server ใช้ PostgreSQL เป็น persistence backend เดียว; attachment เลือก filesystem หรือ S3-compatible
- Local Accounts เป็นรูปแบบที่เลือกใช้สำหรับ on-prem deployment ปัจจุบันตาม ADR 0005; ผู้ดูแลสูงสุดสร้างผู้ใช้และกำหนด role/station. OIDC authentication flow มี implementation และเลือกใช้ได้เมื่อตั้งค่า identity provider แต่ไม่ใช่รูปแบบ deployment ที่เลือกและยังไม่มีผลยืนยันกับ tenant จริง. Station scope, immutable closed round, audit, backup/restore และ Vehicle proxy มี implementation/test seam แล้ว; การเปิด Public ยังต้องผ่าน production environment, multi-user/UAT, external network, restore drill และ Owner/Security sign-off
- Domain invariant ที่ห้ามเปลี่ยน: Station Profile ปัจจุบันไม่เขียนทับ Snapshot/History เดิม, WIM Sensor/Loop สืบทอด parent system/Lane, และ BOQ display code ไม่แทน Item/Snapshot identity
- ผังปัจจุบันทั้งสามหน้าใช้ลำดับจุดติดตั้ง SC/IMPS จาก `station-workpoint-layout.js`; IMPS วาง `LPR for 3D` ถัดจาก `3D Dimension`. จุดติดตั้งกำหนด Scope และแสดง System → Equipment. ทางเพิ่มใต้ System ใช้แม่ตัวที่กด; อุปกรณ์อิเล็กทรอนิกส์ต้องผูก Cabinet ใต้ System เดียวกัน. งานตรวจระดับสถานียังคงแยกต่างหาก และคิวก่อนหน้า/ถัดไปยังคงเดิม. ผลตรวจล่าสุด: [relationship-fix-2026-10-01.md](../.scratch/sc-imps-grouping-audit/relationship-fix-2026-10-01.md)
- หน้าตรวจจริงใช้ลำดับหมวดหลักเดียวกัน แต่คงคิวตรวจ รหัส Checklist ลำดับรายการ และการเลื่อนไปข้อถัดไปตามกติกาเดิม โดยไม่เพิ่ม Scope/System เป็นชั้นในคิว. รหัส .01/.02 เป็นรหัสแสดงผล Checklist/Report ไม่ใช่ชั้นของผังทะเบียน
- รายการเทียบรายข้อและ Scope อยู่ใน [SC/IMPS grouping map](../.scratch/sc-imps-grouping-audit/map.md); ตารางตรวจเดิมในไฟล์นั้นคงไว้เป็นหลักฐานก่อนปรับ

## Verification ล่าสุด

- 30 กันยายน 2569: ปรับผังหน้าสร้างสถานีและ Station Profile เป็น `หมวดหลัก → Scope → System → Equipment`; คงคิวตรวจ รหัส Checklist และลำดับข้อเดิม. ผ่าน `test_station_relationship_tree.mjs`, `test_station_creation.mjs`, `test_boq_display_v2.mjs`, `test_evidence_checklist.mjs`, `test_station_system_quantity.mjs`, `test_checklist_page_queue.mjs`, `test_checklist_queue_layout.mjs`, `test_station_asset_add_binding.mjs`, `test_contextual_layout.mjs` และ production build. ทดสอบเบราว์เซอร์ใน Vite local mode แบบแยกข้อมูล: หน้าสร้าง SC/IMPS ทั้งสถานีว่างและเพิ่ม LPR System/Camera, Station Profile SC/IMPS ที่มี LPR Camera และหน้าตรวจตัวอย่างที่ยังแสดง 1 จาก 107 รายการ; ไม่พบ console error ระหว่างตรวจ. การทดสอบนี้ไม่ใช่การยืนยันกับบัญชีหรือข้อมูลบน production
- รายงานเดิมเคยระบุว่า `test_boq_checklist_groups.mjs` ไม่ผ่าน เพราะคาดว่าไม่มี `isEquipmentCleaning`; ผลนั้นเป็นสถานะเก่าก่อนปรับ test/fixture ให้ตรงกับกติกาปัจจุบัน และถูกแทนที่ด้วยชุดเต็ม 12 ตุลาคมด้านล่าง
- 25 กันยายน 2569: ปรับ Shared Layout Contract ใน `DESIGN.md` และ `docs/design-system/checklist-operations-master.md`; ตรวจหน้า Checklist จริงที่ 320, 375, 390, 768, 1024 และ 1440px แล้วไม่พบ horizontal overflow. หน้าจอแคบเลื่อนรายการผลตรวจได้, Pager อยู่ใน flow และ Tab panel ที่ไม่ได้เลือกถูกซ่อนด้วย `hidden`/`aria-hidden`.
- 25 กันยายน 2569: `npm.cmd run build` ผ่านหลังการปรับ Layout และ Responsive. มีคำเตือน chunk ใหญ่จาก Vite และคำเตือน `NODE_ENV` ใน `.env` ตามเดิม แต่ไม่ทำให้ build ล้มเหลว.
- รายงาน browser วันที่ 24 กันยายน ([test-report.md](../output/playwright/runtime-plan/test-report.md)) บันทึก domain baseline 56 scripts ผ่าน, build ผ่าน และ browser flow/responsive checks ผ่านใน Vite Development + Local Storage
- 12 ตุลาคม 2569: ชุดทดสอบปัจจุบันมี 148 ไฟล์; ชุดเร็วผ่าน 10/10, ชุด Vehicle รัน 39 ไฟล์และข้าม PostgreSQL-only 1 ไฟล์เมื่อไม่ตั้งฐานทดสอบ, และชุดเต็มผ่าน 148/148 บนฐาน PostgreSQL แยก. รายละเอียดและ log อยู่ใน [คู่มือทดสอบ](testing.md) และ [ผลชุดเต็ม](../.scratch/test-suite-tiers/test-all-isolated-2026-10-12.log)
- Build และการตรวจ artifact ที่พอร์ต 5220 ผ่านตามบันทึก 12 ตุลาคมใน [`task.md`](../task.md); การแบ่งชุดทดสอบครั้งนี้แก้เฉพาะ runner, test safeguards และเอกสาร ไม่ได้เปลี่ยน frontend/server artifact
- รายงาน browser วันที่ 24 กันยายนและสถานะ test/build ก่อนหน้านั้นเป็นหลักฐานย้อนหลัง ไม่ใช่ผลล่าสุด
- โปรเจกต์มี Git repository ที่ `E:\Checklist`; ตรวจ working tree ก่อนแก้ไฟล์ และอย่าอ้างผลตรวจหรือ commit history ว่าแทน source/runtime ได้

## เอกสารที่ควรอ่านสำหรับงานปัจจุบัน

| เรื่อง | เอกสารหลัก |
| --- | --- |
| โดเมนและคำศัพท์ | [`CONTEXT.md`](../CONTEXT.md), [`docs/glossary.md`](glossary.md) |
| สัญญาและบริบทสร้างรอบ | [`.scratch/contract-context/spec.md`](../.scratch/contract-context/spec.md), [`docs/design-system/route-map.md`](design-system/route-map.md) |
| สถาปัตยกรรมและ persistence | [`docs/adr/0004-central-persistence.md`](adr/0004-central-persistence.md), [`docs/api-contract.md`](api-contract.md), [`docs/architecture/tech-stack-roadmap.md`](architecture/tech-stack-roadmap.md) |
| Station/TOR/BOQ/WIM | [`docs/adr/0002-wim-system-instance-per-lane.md`](adr/0002-wim-system-instance-per-lane.md), [`docs/adr/0003-format-qualified-checklist-display-groups.md`](adr/0003-format-qualified-checklist-display-groups.md), [`docs/boq-checklist-mapping.md`](boq-checklist-mapping.md), [`docs/station-checklist-controls.md`](station-checklist-controls.md) |
| SC/IMPS current-to-target grouping | [`.scratch/sc-imps-grouping-audit/map.md`](../.scratch/sc-imps-grouping-audit/map.md), [`DESIGN.md`](../DESIGN.md) |
| Route/UI | [`docs/design-system/route-map.md`](design-system/route-map.md), [`docs/design-system/component-map.md`](design-system/component-map.md), [`docs/design-system/checklist-operations-master.md`](design-system/checklist-operations-master.md) |
| Public readiness | [`docs/public-deployment-runbook.md`](public-deployment-runbook.md), [`docs/backup-restore-runbook.md`](backup-restore-runbook.md), [`docs/security-acceptance-checklist.md`](security-acceptance-checklist.md), [`.scratch/public-release-readiness-2026-09-23.md`](../.scratch/public-release-readiness-2026-09-23.md), [ADR 0005](adr/0005-local-managed-accounts.md) |

## วิธีอ่านเอกสารย้อนหลัง

รายงานอย่าง `audit-header-review.md`, `design-qa.md`, `docs/attachment-audit.md` และ `docs/checklist-document-alignment-2026-09-15.md` เก็บผลตรวจ ณ วันที่ระบุ จึงควรรักษาตัวเลข/ภาพ/ข้อสังเกตเดิมไว้เพื่อ traceability หากต้องการค่าปัจจุบันให้เทียบกับ source และ verification ด้านบน ไม่ควรนำผล browser หรือจำนวนรายการจากรายงานเก่ามาปนกับ current runtime โดยไม่ระบุวันที่
