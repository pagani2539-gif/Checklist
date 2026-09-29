# Roadmap สถาปัตยกรรมและ Tech Stack หลัง MVP

สถานะ: roadmap ที่ปรับให้ตรงกับ repository ณ 24 กันยายน 2569 — **ไม่ใช่ ADR**; ส่วนที่เป็น server/API มี implementation baseline แล้ว แต่ยังไม่ใช่หลักฐาน Public production

## วัตถุประสงค์

เอกสารนี้อธิบายเส้นทางจาก Checklist MVP ปัจจุบันไปสู่ระบบที่รองรับหลายสถานี หลายผู้ใช้ และการทำงานหน้างานที่อินเทอร์เน็ตขาดเป็นช่วง ๆ ได้อย่างปลอดภัย

เอกสารนี้ไม่เปลี่ยนขอบเขตหรือการตัดสินใจของ MVP ใน [README](../../README.md), [ADR 0001](../adr/0001-checklist-mvp.md) หรือคำศัพท์โดเมนใน [CONTEXT](../../CONTEXT.md) หากมีความขัดแย้ง ให้เอกสารเหล่านั้นเป็นแหล่งอ้างอิงของพฤติกรรมปัจจุบัน

## สถานะปัจจุบัน: Local-first MVP + server-ready transition

สิ่งต่อไปนี้คือสิ่งที่มีอยู่จริงใน repository ปัจจุบัน:

- Frontend เป็น React/Vite และทำงานแบบ static web application
- Local mode เก็บ state หลักและ metadata ใน `localStorage` ของ browser เครื่องนั้น; ไฟล์แนบเก็บใน IndexedDB ภายในเครื่อง
- Server mode ใช้ `/api/v1/state` และ API ไฟล์แนบ โดย server ใช้ PostgreSQL และ filesystem/S3-compatible attachment store; เมื่อ API ขัดข้อง client เก็บ pending state ชั่วคราวใน IndexedDB
- มี Station Profile, Asset, System, Lane และรอบตรวจที่สร้าง Snapshot ณ เวลาเริ่มรอบ
- มี Contract, Work Package และ Contract Station Assignment; การสร้างรอบตรวจเลือกบริบทสัญญา/งวด/สถานีร่วมกัน และ Contract Work Report แยกจากรายงานตรวจสถานี
- Snapshot ของรอบเดิมไม่เปลี่ยนตาม Station Profile หรือข้อความมาตรฐานที่แก้ภายหลัง; รอบที่ปิดแล้วอ่านอย่างเดียว และการแก้ไขต้องสร้าง revision ใหม่
- Evidence และรายการตรวจสร้างตาม Asset/Lane ที่มีจริง พร้อมกติกา close readiness
- Vehicle search เรียก API ของสถานีโดยตรงก่อน และใช้ same-origin proxy ที่ allowlist ไว้เป็นทางสำรอง
- มี Node HTTP server, API boundary, storage adapters, PostgreSQL-backed local accounts, role/station-scope และ audit/backup seams แล้ว แต่ยังไม่มีการยืนยัน real deployment, multi-user UAT, production restore drill หรือ offline operation queue แบบเต็มรูปแบบ

ข้อมูลลงนามในรายงานของ MVP เป็นข้อมูลแสดงผลในรายงานเท่านั้น ไม่ใช่ตัวตนผู้ใช้หรือการอนุมัติของระบบ

## หลักการของสถาปัตยกรรมเป้าหมาย

ข้อเสนอหลัง MVP คือ **offline-first PWA ที่มีระบบกลางแบบ modular monolith** ไม่ใช่ microservices ในระยะแรก

```text
PWA บน browser
  ├─ พื้นที่ทำงานและคิวซิงก์ใน IndexedDB
  ├─ ใช้งาน checklist และหลักฐานเมื่อเน็ตขาดได้
  └─ ซิงก์กับ API กลางเมื่อเชื่อมต่อได้
          │
          ├─ Auth / Role / Audit
          ├─ Station, Asset, Lane และ Inspection APIs
          ├─ PostgreSQL: ข้อมูลปัจจุบันและประวัติ
          ├─ MinIO: รูปและไฟล์แนบ
          └─ Background jobs: retry, report และ cleanup
```

ฐานข้อมูลกลางเป็นแหล่งข้อมูลที่เชื่อถือได้หลังซิงก์สำเร็จ แต่ browser ยังคงเก็บงานค้างและไฟล์ชั่วคราวเพื่อให้การตรวจภาคสนามไม่สะดุด

## Tech Stack ที่เสนอหลัง MVP

| ชั้นระบบ | เทคโนโลยีที่เสนอ | บทบาทและเหตุผล | สถานะปัจจุบัน |
| --- | --- | --- | --- |
| Web application | React + TypeScript + Vite | รักษาฐาน React/Vite เดิม, เพิ่ม type safety ให้ Snapshot, status และ payload ที่ซับซ้อน | React/Vite มีแล้ว; TypeScript ยังเป็นแผน |
| Server state และ validation | TanStack Query + Zod | จัดการ cache/retry ของ API และตรวจ payload ด้วย schema ที่ใช้ซ้ำได้ | แผนหลัง MVP |
| Offline-first | PWA + IndexedDB ผ่าน Dexie + sync queue | เก็บ draft, operation queue และ Blob ของไฟล์ เพื่อทำงานต่อเมื่อสัญญาณขาด | IndexedDB มีเฉพาะ local attachment; PWA/sync queue ยังไม่มี |
| Backend API | Node built-in HTTP + REST `/api/v1` | เป็น implementation boundary ปัจจุบันของ server mode; NestJS/Fastify ยังเป็นทางเลือกในอนาคต ไม่ใช่ dependency ที่ใช้อยู่ | มีแล้วใน `server.mjs` และ `server/`; ต้องผ่าน deployment verification |
| Database | PostgreSQL | เป็น central persistence และ server storage backend เดียวของระบบหลายสถานี | adapter/migration มีแล้ว; integration ต้องใช้ `CHECKLIST_POSTGRES_TEST_DATABASE_URL` หรือ environment จริง |
| Object storage | MinIO/S3-compatible พร้อม filesystem adapter | API คุม upload/download และ metadata; filesystem เหมาะกับ local/pilot | มีแล้ว; production bucket/ACL/restore drill ยังต้องยืนยัน |
| Identity และ RBAC | PostgreSQL local accounts; optional OIDC | Admin bootstrap จาก terminal, session cookie, role และ station assignment; OIDC authentication flow รองรับเมื่อมี provider | Local Accounts เป็นรูปแบบที่เลือกใช้ตาม ADR 0005; OIDC มี implementation แต่ยังไม่ยืนยันกับ tenant จริง. Production account provisioning, password policy review, HTTPS และ Owner/Security acceptance ยัง pending |
| งานเบื้องหลัง | Redis + BullMQ | รองรับ retry upload, สร้างรายงาน และ cleanup โดยไม่ทำให้ API หลักช้า | เพิ่มเมื่อมี workload จริง |
| Deployment | Docker Compose + Nginx | ติดตั้ง on-prem เป็นชุดเดียวและมี HTTPS/reverse proxy; เหมาะก่อนมีความต้องการ high availability | แผนหลัง MVP |
| Quality | Node smoke/regression scripts + browser/route checks | ป้องกัน regression ของ domain, API, Snapshot, station scope, PDF และ responsive contracts | [รายงาน 24 ก.ย.](../../output/playwright/runtime-plan/test-report.md) บันทึก 56 scripts ผ่าน แต่ [contract-context spec](../../.scratch/contract-context/spec.md) ระบุ failure ใน `test_contextual_station_names.mjs` และ `test_station_tor_ui.mjs`; aggregate status ยังต้องกระทบยอด. Browser report ไม่ใช่หลักฐาน PostgreSQL integration หรือ field/UAT |

รายการที่ระบุว่า `มีแล้ว` หรือ `implementation` คือสิ่งที่มีใน repository ปัจจุบัน; รายการที่ระบุว่า `แผน` หรือ `ยังไม่มี` เป็นข้อเสนอสำหรับหลัง MVP และยังไม่ใช่ dependency ที่เพิ่มแล้ว

## สิ่งที่ยังไม่เลือกในระยะแรก

| ทางเลือก | เหตุผลที่ยังไม่เลือก |
| --- | --- |
| Microservices | โดเมนยังเป็นระบบเดียว; เพิ่มความยากด้าน deploy, tracing และการดูแลโดยไม่มีประโยชน์ชัดเจนในระยะแรก |
| Kubernetes | Docker Compose เพียงพอสำหรับ on-prem ระยะแรก; Kubernetes ใช้เมื่อมี high availability, หลาย environment หรือการขยายระบบที่พิสูจน์แล้ว |
| GraphQL | Workflow มี command และ resource ชัดเจน เช่น create round, close round, upload evidence และ sync; REST อ่านง่ายและทำ retry/role guard ได้ตรงกว่า |
| Cloud-only services | โจทย์ตั้งต้นต้องควบคุมข้อมูลและการติดตั้งภายในองค์กรหรือศูนย์ข้อมูลในไทย จึงใช้ PostgreSQL/MinIO/Keycloak ที่ self-host ได้ |
| ย้ายไป framework frontend ใหม่ | React/Vite ปัจจุบันรองรับงานได้ดี; การเปลี่ยน framework ไม่ได้แก้ปัญหา multi-user, sync หรือ data authority |

## Roadmap หลัง MVP

### ระยะที่ 1: ปิดสัญญาข้อมูลของ MVP

- ระบุเจ้าของข้อมูลเพียงหนึ่งเดียวของ Canonical Item, Station TOR Item และ Item Library ก่อนออกแบบ schema กลาง
- ยืนยันว่า Snapshot, closed round, evidence metadata และ correction history ต้องคงย้อนหลังได้โดยไม่ถูกเขียนทับ
- ระบุข้อมูล legacy ที่ต้อง import จาก `localStorage` และ IndexedDB พร้อมวิธีตรวจยอด Station, Round และ Attachment หลังย้าย
- แก้หรือแยก legacy UI/test ที่ไม่ตรงกับ active flow เพื่อให้ contract ของ MVP อ่านได้ชัดเจน

### ระยะที่ 2: ระบบกลางและความปลอดภัย — baseline implemented, readiness pending

- [x] สร้าง Node API boundary สำหรับ Station, Asset, Inspection, Evidence, Report, User และ Audit พร้อม compatibility state endpoint
- [x] เพิ่ม PostgreSQL store, filesystem/S3 attachment adapter, local-managed account session และ station-scope guard ใน codebase
- [x] เพิ่ม immutable close/Snapshot guard, backup/restore scripts, readiness endpoints และ security acceptance checklist
- [ ] ยืนยัน PostgreSQL/S3 integration, managed admin/users/roles, reverse proxy, external network isolation และ isolated restore drill ก่อน Public Go

### ระยะที่ 3: Offline sync และ rollout หลายสถานี

- เพิ่ม PWA shell, IndexedDB workspace และ operation queue ที่ retry ได้
- กำหนด sync operation ให้มี `operationId` และ entity version เพื่อรับมือ request ซ้ำและ conflict
- ห้าม sync เขียนทับ Snapshot หรือ closed round; conflict ของ Station Profile ปัจจุบันต้องแสดงให้ผู้ใช้ตัดสินใจ
- ทำ migration/import wizard สำหรับข้อมูลเดิม และตรวจสอบยอดข้อมูลก่อนยืนยัน cutover
- ทดสอบกับสถานีนำร่องก่อน rollout หลายสถานี

## Decision Gates ก่อนเริ่มย้ายระบบ

ADR 0004 รับรองทิศทาง central persistence แล้ว; gates ต่อไปนี้ต้องตอบและเก็บหลักฐานก่อน Public Go หรือก่อนขยายไป multi-station production:

1. TOR Catalog, Canonical Catalog และ Item Library จะมีเจ้าของข้อมูลและกติกาการเชื่อมโยงอย่างไร
2. ข้อมูลใดเป็น mutable current state และข้อมูลใดเป็น immutable historical snapshot
3. จะ import ข้อมูลจาก browser เดิมของผู้ใช้รายใดบ้าง และไฟล์ IndexedDB จะย้ายอย่างไร
4. บทบาทผู้ใช้, ขอบเขตสถานี และความหมายของการอนุมัติในระบบจริงคืออะไร
5. ความถี่ backup, ระยะเวลาเก็บรักษา และขั้นตอน restore ที่ยอมรับได้คืออะไร
6. สถานีใดเป็น pilot และเกณฑ์ผ่านก่อน rollout คืออะไร

## ขอบเขตของเอกสารนี้

- เอกสารนี้ไม่รับรองว่า Public deployment เสร็จแล้ว และไม่แทนที่ `docs/public-deployment-runbook.md` หรือ security sign-off
- ส่วน API, database schema และ environment variable ที่ระบุว่า current ต้องอ่านคู่กับ `docs/api-contract.md` และ `.env.example`; ส่วน sync operation เต็มรูปแบบยังเป็นแนวทางอนาคต
- การเปลี่ยนสถาปัตยกรรมหลัง MVP ต้องมี ADR แยกเมื่อเลือกเทคโนโลยีและขอบเขต implementation ที่แน่นอนแล้ว

## เอกสารอ้างอิง

- [README: ขอบเขตและวิธีใช้ MVP](../../README.md)
- [ADR 0001: Local-first Checklist MVP](../adr/0001-checklist-mvp.md)
- [CONTEXT: คำศัพท์และขอบเขตโดเมน](../../CONTEXT.md)
