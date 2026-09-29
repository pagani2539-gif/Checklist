# Document Status — Checklist Operations Hub

สถานะสรุป: 25 กันยายน 2569 (Asia/Bangkok)

เอกสารนี้เป็นจุดเริ่มต้นสำหรับอ่านเอกสารของโปรเจกต์ เมื่อเอกสารหลายฉบับพูดถึงคนละช่วงเวลา ให้ยึด source of truth ตามลำดับนี้:

1. โค้ดที่ runtime ใช้จริงใน `src/main.jsx` → `src/app/App.jsx`, `src/app/router.js`, `src/domain/` และ `server.mjs`/`server/`
2. `CONTEXT.md` และ ADR ที่ยอมรับแล้วใน `docs/adr/`
3. เอกสาร operational ปัจจุบันใน `README.md` และ `docs/`
4. `.scratch/` สำหรับ spec, issue และ readiness evidence ของแต่ละ effort
5. ไฟล์ที่มีคำว่า `audit`, `qa`, วันที่ หรืออยู่ใต้ `output/` เป็นหลักฐานย้อนหลัง ไม่ใช่คำสั่งหรือค่าปัจจุบันโดยอัตโนมัติ

## สถานะ runtime ปัจจุบัน

- Frontend ใช้ React/Vite และ custom hash router; route หลักคือ Dashboard, Stations, Inspections และ History พร้อมเส้นทางสร้าง/ดู Contract, Work Package และ Contract Work Report (`#/contracts` เปลี่ยนไป Dashboard) รอบใหม่ที่ผูกสัญญาเลือก Contract, Work Package และสถานีจากบริบทเดียวกัน ส่วน Contract Work Report แยกจาก Station Inspection Report
- `VITE_STORAGE_MODE=local` ใช้ localStorage/IndexedDB แบบ local-first
- `VITE_STORAGE_MODE=server` โหลด/บันทึก state ผ่าน `/api/v1/state` และเก็บ draft ที่ส่งไม่สำเร็จไว้ชั่วคราวใน IndexedDB เพื่อ sync ภายหลัง
- Server ใช้ PostgreSQL เป็น persistence backend เดียว; attachment เลือก filesystem หรือ S3-compatible
- Local Accounts เป็นรูปแบบที่เลือกใช้สำหรับ on-prem deployment ปัจจุบันตาม ADR 0005; ผู้ดูแลสูงสุดสร้างผู้ใช้และกำหนด role/station. OIDC authentication flow มี implementation และเลือกใช้ได้เมื่อตั้งค่า identity provider แต่ไม่ใช่รูปแบบ deployment ที่เลือกและยังไม่มีผลยืนยันกับ tenant จริง. Station scope, immutable closed round, audit, backup/restore และ Vehicle proxy มี implementation/test seam แล้ว; การเปิด Public ยังต้องผ่าน production environment, multi-user/UAT, external network, restore drill และ Owner/Security sign-off
- Domain invariant ที่ห้ามเปลี่ยน: Station Profile ปัจจุบันไม่เขียนทับ Snapshot/History เดิม, WIM Sensor/Loop สืบทอด parent system/Lane, และ BOQ display code ไม่แทน Item/Snapshot identity
- ตรวจผังความสัมพันธ์ SC/IMPS ใน Station Profile แล้ว: System และ Asset อยู่ใต้หมวดเดียวกัน แยก `.01 Equipment` กับ `.02 Systems & Software`; ตรวจจอ 1440px และ 390px แล้วไม่เกิด horizontal overflow

## Verification ล่าสุด

- 25 กันยายน 2569: ปรับ Shared Layout Contract ใน `DESIGN.md` และ `docs/design-system/checklist-operations-master.md`; ตรวจหน้า Checklist จริงที่ 320, 375, 390, 768, 1024 และ 1440px แล้วไม่พบ horizontal overflow. หน้าจอแคบเลื่อนรายการผลตรวจได้, Pager อยู่ใน flow และ Tab panel ที่ไม่ได้เลือกถูกซ่อนด้วย `hidden`/`aria-hidden`.
- 25 กันยายน 2569: `npm.cmd run build` ผ่านหลังการปรับ Layout และ Responsive. มีคำเตือน chunk ใหญ่จาก Vite และคำเตือน `NODE_ENV` ใน `.env` ตามเดิม แต่ไม่ทำให้ build ล้มเหลว.
- รายงาน browser วันที่ 24 กันยายน ([test-report.md](../output/playwright/runtime-plan/test-report.md)) บันทึก domain baseline 56 scripts ผ่าน, build ผ่าน และ browser flow/responsive checks ผ่านใน Vite Development + Local Storage
- สถานะ aggregate test ปัจจุบันยังไม่ยืนยันว่าผ่านทั้งหมด: รายงานข้างต้นระบุ 56 scripts ผ่าน แต่ [contract-context spec](../.scratch/contract-context/spec.md) ระบุ failure ใน `test_contextual_station_names.mjs` และ `test_station_tor_ui.mjs`; ต้องกระทบยอดด้วยผลรันหลังการเปลี่ยนแปลงล่าสุดก่อนรายงานเป็น green
- PostgreSQL integration: PASS — state store, Local Accounts/OIDC station-scope authorization, server API และ attachment persistence ทำงานบน isolated PostgreSQL cluster ตามหลักฐาน 23 กันยายน; browser report วันที่ 24 กันยายนใช้ Local Storage จึงไม่ใช่การทดสอบ Server/Public ล่าสุด
- Build PASS ถูกบันทึกใน browser report วันที่ 24 กันยายน; ผลนี้ผูกกับ source state ณ เวลารายงาน ไม่ใช่การยืนยัน build หลังการเปลี่ยนแปลงทั้งหมดในวันเดียวกัน
- โปรเจกต์นี้ยังไม่มี `.git`; ห้ามอ้าง `git diff` หรือ commit history เป็นหลักฐาน ให้ใช้ source, test output, artifact path และ manifest/checksum แทน

## เอกสารที่ควรอ่านสำหรับงานปัจจุบัน

| เรื่อง | เอกสารหลัก |
| --- | --- |
| โดเมนและคำศัพท์ | [`CONTEXT.md`](../CONTEXT.md), [`docs/glossary.md`](glossary.md) |
| สัญญาและบริบทสร้างรอบ | [`.scratch/contract-context/spec.md`](../.scratch/contract-context/spec.md), [`docs/design-system/route-map.md`](design-system/route-map.md) |
| สถาปัตยกรรมและ persistence | [`docs/adr/0004-central-persistence.md`](adr/0004-central-persistence.md), [`docs/api-contract.md`](api-contract.md), [`docs/architecture/tech-stack-roadmap.md`](architecture/tech-stack-roadmap.md) |
| Station/TOR/BOQ/WIM | [`docs/adr/0002-wim-system-instance-per-lane.md`](adr/0002-wim-system-instance-per-lane.md), [`docs/adr/0003-format-qualified-checklist-display-groups.md`](adr/0003-format-qualified-checklist-display-groups.md), [`docs/boq-checklist-mapping.md`](boq-checklist-mapping.md), [`docs/station-checklist-controls.md`](station-checklist-controls.md) |
| Route/UI | [`docs/design-system/route-map.md`](design-system/route-map.md), [`docs/design-system/component-map.md`](design-system/component-map.md), [`docs/design-system/checklist-operations-master.md`](design-system/checklist-operations-master.md) |
| Public readiness | [`docs/public-deployment-runbook.md`](public-deployment-runbook.md), [`docs/backup-restore-runbook.md`](backup-restore-runbook.md), [`docs/security-acceptance-checklist.md`](security-acceptance-checklist.md), [`.scratch/public-release-readiness-2026-09-23.md`](../.scratch/public-release-readiness-2026-09-23.md), [ADR 0005](adr/0005-local-managed-accounts.md) |

## วิธีอ่านเอกสารย้อนหลัง

รายงานอย่าง `audit-header-review.md`, `design-qa.md`, `docs/attachment-audit.md` และ `docs/checklist-document-alignment-2026-09-15.md` เก็บผลตรวจ ณ วันที่ระบุ จึงควรรักษาตัวเลข/ภาพ/ข้อสังเกตเดิมไว้เพื่อ traceability หากต้องการค่าปัจจุบันให้เทียบกับ source และ verification ด้านบน ไม่ควรนำผล browser หรือจำนวนรายการจากรายงานเก่ามาปนกับ current runtime โดยไม่ระบุวันที่
