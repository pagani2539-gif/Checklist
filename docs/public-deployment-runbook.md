# Public Deployment Runbook (Windows Server)

เอกสารนี้เป็น runbook สำหรับ Public Readiness Review วันที่ 23 ไม่ใช่คำสั่งเปิดระบบจนกว่าจะผ่าน Go/No-Go ทุกข้อ

## ก่อน deploy

1. ตรวจ source ล่าสุดและ artifact provenance แล้ว build ใหม่; ถ้า checkout มี Git ให้ตรวจ `git diff` เพิ่มเติม แต่ checkout ปัจจุบันไม่มี `.git` จึงต้องเก็บ source path, test output, build output และ hash/manifest แทน ห้ามคัดลอก `dist` เก่า
2. ตั้งค่า `.env` จาก `deploy/.env.local-auth.example` สำหรับบัญชีภายใน PostgreSQL; เก็บ database/S3 credential ใน Windows Credential Manager หรือ secret store ขององค์กร
3. ตั้ง `VITE_STORAGE_MODE=server`, `CHECKLIST_STORAGE_BACKEND=postgres`, `CHECKLIST_DIST_DIR` ให้ชี้ไปยัง artifact ใหม่, `CHECKLIST_AUTH_MODE=local`, `CHECKLIST_ENFORCE_STATION_SCOPE=true`, `CHECKLIST_COOKIE_SECURE=true`
4. กำหนด `CHECKLIST_DATABASE_URL` สำหรับ PostgreSQL และ `CHECKLIST_ATTACHMENT_BACKEND=s3` พร้อม `CHECKLIST_S3_*`; ให้ credential อยู่ใน secret store ขององค์กร
5. กำหนด `VEHICLE_SEARCH_ALLOWED_ORIGINS` เป็น allowlist ของ origin ที่ server-side Vehicle API proxy เชื่อมต่อได้ และกำหนด `VEHICLE_SEARCH_PROXY_ALLOWED_ORIGINS` เป็น origin ของ external proxy ที่ browser ต้องเรียกโดยตรง; ตั้ง `VEHICLE_SEARCH_ENFORCE_STATION_TARGET=true` และ build frontend ด้วย `VITE_VEHICLE_PROXY_ENFORCE_STATION_TARGET=true`. Public/local auth จะบังคับ target ตาม Station Profile และ session/role/station assignment สำหรับทั้ง search และ image; server ไม่เชื่อ `baseUrl` จาก client
6. รัน backup ก่อน deploy และเก็บ artifact/build hash คู่กับ backup manifest

ก่อนเปิด service ครั้งแรก ให้สร้างผู้ดูแลสูงสุดจาก Terminal บนเครื่อง server เพียงครั้งเดียว:

```powershell
npm.cmd run admin:bootstrap-default
```

คำสั่งนี้ใช้ได้เฉพาะฐานข้อมูลที่ยังไม่มี Local User; จะสร้าง username `admin` พร้อมรหัสสุ่มที่คัดลอกลง clipboard และบังคับเปลี่ยนรหัสใน login แรก. ล้าง clipboard หลังใช้. หากต้องการกำหนด credential เอง ให้ใช้ `npm.cmd run admin:bootstrap` ซึ่งรับรหัสผ่านแบบซ่อนจากหน้าจอ. หลัง login ผู้ดูแลสร้างบัญชีผู้ปฏิบัติงาน กำหนด role/สถานี และออกรหัสผ่านชั่วคราวให้แต่ละคน. ไม่เปิด endpoint สมัครบัญชีเอง

สำหรับ on-prem ที่ใช้ Docker ให้เริ่ม PostgreSQL และ MinIO จาก `deploy/docker-compose.postgres.yml` แล้วสร้าง `.env` ของ deployment แยกจาก `.env.example`; ห้ามใช้ค่า credential ตัวอย่างใน production

## Start/stop/restart

```powershell
node --env-file=.env server.mjs
```

ก่อน start ให้ตรวจ build และ regression จาก source checkout เดียวกัน:

```powershell
node tools/run_all_tests.mjs
$env:VITE_VEHICLE_PROXY_ENFORCE_STATION_TARGET = 'true'
node node_modules/vite/bin/vite.js build --configLoader runner --outDir .\release\public
Remove-Item Env:VITE_VEHICLE_PROXY_ENFORCE_STATION_TARGET
```

จากนั้นตั้ง `CHECKLIST_DIST_DIR` เป็น path ของ artifact ที่ deploy จริง ห้ามใช้ `dist` เก่าที่ไม่ทราบ provenance

ใช้ Windows Service Manager, NSSM หรือ Scheduled Task ที่มี service account สำหรับ production; ห้ามรันด้วย user ที่มีสิทธิ์ admin เกินจำเป็น

ตรวจหลัง start:

```powershell
Invoke-WebRequest https://checklist.example.com/health
Invoke-WebRequest https://checklist.example.com/ready
```

`/ready` ไม่ได้ตรวจการเชื่อมต่อ Vehicle API จริง ให้ทำ smoke test แยกจากเครื่องใน network ที่เข้าถึง upstream ได้ โดยใช้ Checklist account ที่มีสิทธิ์เข้าถึงสถานีเป้าหมาย (`inspector` เข้าถึงได้ทุกสถานี; role อื่นต้องได้รับมอบหมายสถานีนั้น). สำหรับ local accounts ตั้ง `CHECKLIST_VEHICLE_TEST_USERNAME` และ `CHECKLIST_VEHICLE_TEST_PASSWORD` ใน process จาก secret store; script login ผ่าน HTTPS, ใช้ session cookie ในหน่วยความจำ และไม่พิมพ์ secret. OIDC profile ทางเลือกใช้ `CHECKLIST_VEHICLE_TEST_BEARER`. ตั้งค่าเพิ่ม `CHECKLIST_API_BASE_URL`, `CHECKLIST_VEHICLE_TEST_STATION_ID`, `CHECKLIST_VEHICLE_TEST_START`, `CHECKLIST_VEHICLE_TEST_END`. เวลาเริ่ม/จบต้องเป็น `YYYY-MM-DDTHH:mm:ss+07:00` และช่วงไม่เกิน 60 นาที; ผลรายงานเฉพาะจำนวน, field coverage และสถานะรูป โดยไม่แสดงทะเบียนหรือเก็บ state ใน Checklist.

```powershell
npm.cmd run smoke:vehicle-api:readonly
```

คำสั่งนี้ยิง Direct ไปยัง upstream จาก network สถานี และยิง Proxy ผ่าน Checklist server ด้วยช่วงเวลา/Station Profile เดียวกัน. ให้ใช้ช่วงที่ทราบว่ามีข้อมูล; ถ้ามากกว่า 5 หน้า ให้ลดช่วงเวลาแล้วรันใหม่. ห้ามใส่ username/password/session cookie/token ใน command line, `.env`, log หรือไฟล์รายงาน. ผู้ใช้ Public ใช้ server Proxy เท่านั้น; Direct smoke เป็นการตรวจของ operator.

## Reverse proxy/network

- Public เปิดเฉพาะ TCP 443 ไป reverse proxy
- Node ฟัง `127.0.0.1` หรือ private interface เท่านั้น
- reverse proxy จัดการ certificate, HSTS, request body limit และ access log
- firewall ปฏิเสธ inbound ไป port Node จาก external network
- ไม่ expose PostgreSQL, MinIO, `data/`, `backups/`, `.env` หรือ source files ผ่าน static server

## Rollback

1. หยุด Node service
2. เก็บ logs และ manifest ของ artifact ที่มีปัญหา
3. restore artifact ก่อนหน้าโดยไม่ลบ database
4. ถ้า schema migration เปลี่ยนแล้ว ให้ทำ restore drill ใน database/object bucket แยกก่อน และใช้ backup ที่ compatible
5. start service แล้วตรวจ `/health`, `/ready`, login และอ่าน Snapshot/History

## Go/No-Go

ให้ Security/Owner ลงชื่อใน `docs/security-acceptance-checklist.md` เท่านั้น ระบบจึงจะเปลี่ยนจาก Readiness Review เป็น Public production
