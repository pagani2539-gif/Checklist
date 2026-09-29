# ADR 0004: Central Persistence for Public Readiness

สถานะ: Accepted — PostgreSQL เป็น persistence backend เดียวของ server/public architecture

## Context

Checklist เดิมเป็น local-first MVP: state อยู่ใน `localStorage` และไฟล์แนบอยู่ใน IndexedDB ของ browser แต่ละเครื่อง จึงไม่เหมาะกับหลายสถานี หลายผู้ใช้ การตรวจสอบสิทธิ์ หรือการกู้คืนข้อมูลส่วนกลาง

## Decision

- ใช้ PostgreSQL เป็น central persistence และ server storage backend เดียวสำหรับทุก environment ที่รันผ่าน API โดยตั้ง `CHECKLIST_DATABASE_URL`
- ใช้ `server/` เป็น API boundary และไม่ให้ browser ติดต่อ PostgreSQL หรือ object storage โดยตรง
- ใช้ schema แบบ hybrid: ตาราง normalized สำหรับ Station Profile, Lane, Asset, System, Station TOR, Inspection Round และ Evidence; เก็บ Snapshot ปิดรอบเป็น immutable JSONB พร้อม schema/template version
- ปิดรอบและ Snapshot เดิมต้องไม่ถูกแก้ไข ถ้าต้องแก้ให้สร้าง revision/round ใหม่
- ใช้ MinIO/S3-compatible เป็นค่าเป้าหมายของไฟล์หลักฐาน; PostgreSQL เก็บ metadata, hash, MIME, owner, station scope และสถานะการลบ
- ใช้ `app_state`/`state_revisions` เป็น compatibility state-document seam ระหว่าง migration โดย projection tables ต้องสอดคล้องกับ state ล่าสุด
- ใช้ optimistic version ระดับ state/round, audit log และ station scope ทุก query ที่เข้าถึงข้อมูลสถานี
- release ใหม่เริ่ม PostgreSQL ฐานใหม่; import ข้อมูลเดิมผ่าน `tools/import_postgres_state.mjs` หลังตรวจสอบและสร้าง manifest เท่านั้น ห้าม import browser storage อัตโนมัติ
- `VITE_STORAGE_MODE=server` ทำให้ client โหลด/บันทึกผ่าน API และเก็บ offline draft ใน IndexedDB เพื่อ sync ภายหลัง; `VITE_STORAGE_MODE=local` ยังสงวนไว้สำหรับ local-first browser mode แต่ไม่ใช่ server persistence
- backup production ใช้ `tools/backup_postgres.mjs` โดยตั้งเป้า RPO 1 ชั่วโมง / RTO 4 ชั่วโมง และต้องเก็บสำเนาไว้นอกเครื่อง production

## Consequences

ได้ persistence กลางที่ query ข้ามสถานีได้, backup/restore, object storage และ concurrency guard โดยยังรักษา domain shape/Snapshot เดิมผ่าน state-document seam ระหว่าง migration ระบบเริ่มจากองค์กรเดียวหลายสถานี ยังไม่ทำ HA, read replica, Redis หรือ multi-tenant isolation จนกว่าจะมี workload และ requirement รองรับ ต้องเปิด `CHECKLIST_ENFORCE_STATION_SCOPE=true` และผ่านการทดสอบ station claims/authorization ก่อนรับรอง Public

## Rejected alternatives

- localStorage/IndexedDB เป็น source of truth: ใช้ไม่ได้กับ multi-user และ restore กลาง
- SQLite เป็น server storage backend: ถูกตัดออกเพื่อลด source of truth และ migration path ที่ซ้ำซ้อน ระบบ server ต้องใช้ PostgreSQL เท่านั้น
- import browser data อัตโนมัติ: เสี่ยงนำข้อมูลทดลอง/ข้อมูลคนละสถานีปะปน จึงให้เริ่มฐานข้อมูลใหม่
