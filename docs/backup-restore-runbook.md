# Backup / Restore Runbook

สถานะ: runbook สำหรับ PostgreSQL/S3; server persistence ใช้ PostgreSQL เท่านั้น

## Backup

รันก่อน deploy และตั้ง schedule ให้ถี่พอสำหรับ RPO 1 ชั่วโมง:

```powershell
node tools/backup_postgres.mjs
```

คำสั่งสร้าง `checklist.dump`, object/file backup และ `manifest.json` โดยแยกฐานข้อมูลจากไฟล์หลักฐานและบันทึก backend/count ที่ใช้ในรอบนั้น

กำหนดเป้าหมาย: RPO ไม่เกิน 1 ชั่วโมง และ RTO ไม่เกิน 4 ชั่วโมง เก็บ backup อย่างน้อยหนึ่งชุดไว้นอกเครื่อง production และจำกัด ACL ให้เฉพาะ operator ที่ได้รับอนุญาต

## PostgreSQL restore drill

นำ `checklist.dump` กลับเข้า PostgreSQL database ที่แยกจาก production ด้วย `pg_restore` แล้วนำ object/file backup กลับเข้า bucket หรือ attachment directory ที่แยกกัน จากนั้นตั้ง `CHECKLIST_DATABASE_URL`/`CHECKLIST_S3_*` ไปยัง restore target และตรวจ `/ready`, station isolation, Snapshot, evidence และ report

การ restore ต้องทำใน PostgreSQL database และ object bucket/attachment directory ที่แยกจาก production เสมอ ห้าม restore ทับ production ในการทดสอบ:

```powershell
createdb -h <host> -U <user> checklist_restore
pg_restore --exit-on-error --dbname "$env:CHECKLIST_DATABASE_URL" <backup-dir>\checklist.dump
```

ตรวจ schema/state version, จำนวน station/round, `/health`/`/ready`, login, station isolation, Snapshot, evidence, download หลักฐาน และ report

## Evidence ที่ต้องเก็บ

- timestamp เริ่ม/จบ backup และ restore
- backup manifest/hash
- ขนาด database/object backup และ attachment count/bytes
- ผล `/health`/`/ready`
- ผู้ทดสอบและผลของ core flow
- RPO/RTO ที่ทำได้จริง
