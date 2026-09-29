# Public Release Readiness — 23 September

สถานะ: `ready-for-human` / Readiness Review เท่านั้น  
ตรวจ source/test ล่าสุด: 23 กันยายน 2569

## สิทธิ์ผู้ตรวจที่ปรับภายหลัง

ณ 29 กันยายน 2569 บัญชี `inspector` เข้าถึงทุกสถานีปัจจุบันและสถานีที่เพิ่มภายหลังได้โดยไม่ต้องผูก station assignment รายบัญชี ส่วน `viewer` ยังจำกัดตามสถานีที่กำหนด ผลทดสอบในเอกสารนี้ทำก่อนการปรับสิทธิ์ จึงยังไม่ยืนยันพฤติกรรมใหม่; ต้องทดสอบ role และ Vehicle API scope ซ้ำก่อนใช้เป็นหลักฐาน readiness.

## Implemented in repository

- PostgreSQL เป็น server persistence กลาง; MinIO/S3-compatible เป็นเป้าหมายของ attachment storage
- PostgreSQL-backed local accounts: terminal-only first-admin bootstrap, scrypt password hashes, Secure HttpOnly sessions, forced first password change, admin-managed roles/station assignments, suspension/session revocation
- The selected runtime uses Local Accounts and does not configure or call OIDC; the adapter remains available only for a future deployment that explicitly chooses it. Login needs no Docker
- `POST /api/vehicle/search` และ `GET/HEAD /api/vehicle/image` ต้องผ่าน read role; เมื่อเปิด station scope ผู้ใช้ทั่วไปต้องมี station claim ตรงกับ Station Profile
- Public/local-auth บังคับ resolve Vehicle API target จาก Station Profile; ไม่เชื่อ `baseUrl` จาก client และ fail startup ถ้าไม่ได้เปิด station scope หรือปิด Secure cookie
- `tools/smoke_vehicle_api_readonly.mjs` เทียบ Direct/Proxy แบบอ่านอย่างเดียว จำกัดช่วงค้นไม่เกิน 60 นาที/5 หน้า และส่งออกเฉพาะสถานะ, จำนวน และ field coverage
- Windows deployment, PostgreSQL/MinIO, backup/restore และ reverse proxy runbooks

## Verification on 23 September 2569

- `npm.cmd run test:vehicle-search-proxy`: PASS — search/image auth, role, station scope, target spoofing และไม่ส่ง request ที่ถูกปฏิเสธไป upstream
- `node tools/run_all_tests.mjs`: PASS — 54 scripts, 0 failures, including production-mode Local Accounts, OIDC compatibility, station authorization, and `test_video_purge`, on an isolated temporary PostgreSQL cluster
- Local admin UI browser smoke: PASS — login, admin navigation, user creation, station assignment, and forced first-password-change status rendered successfully against a separate synthetic test database
- Local machine config: `.env` is set to `NODE_ENV=production`, local accounts, station scope, Secure cookies, loopback-only host, PostgreSQL, local filesystem attachments, and `release/public`; PostgreSQL backup completed before first-admin bootstrap. Default `admin` was created, login returned 200 with forced password change, and the Secure HttpOnly session was verified
- `npm.cmd run test:public-artifact` โดยตั้ง `CHECKLIST_DIST_DIR=release/public`: PASS — serve artifact จริงใน local server และตรวจ CSP/route/login fail-closed
- Fresh Vite build ที่ `release/public`: PASS โดยตั้ง `VITE_VEHICLE_PROXY_ENFORCE_STATION_TARGET=true`; มี warning bundle JavaScript เกิน 500 kB
- Artifact manifest และ SHA-256 รายไฟล์: `release/public-manifest.json`
- Local Vehicle API proxy regression: PASS — search 200, image 200, authorization cases 7; no real upstream records were fetched
- Live production Direct/Proxy smoke และ production server ยังไม่ได้รัน: environment นี้ไม่มี production token, station target และช่วงข้อมูลที่อนุมัติ

## Still required before Public Go

- Provision/review the first Local Admin on the actual production target and have Owner/Security review the local password lifecycle; external MFA is not provided by local accounts
- ทดสอบ S3 attachment backend กับ MinIO/S3 จริง; local suite ยังทดสอบ filesystem backend
- ทดสอบ `release/public` ผ่าน production host/reverse proxy; local smoke ยังไม่ทดสอบ HTTPS/reverse proxy จริง
- ทดสอบสองสถานีจริง รวม role/station isolation, Direct/Proxy POST, pagination และ image fetch แบบอ่านอย่างเดียว
- ตรวจ HTTPS/reverse proxy/firewall ให้ภายนอกเห็นเฉพาะ port 443 และทดสอบ upload/download ตาม role
- ตั้ง backup นอกเครื่องและทำ isolated restore drill พร้อมบันทึก RPO/RTO
- ตรวจ logs/secrets และขอ Owner/Security sign-off ใน `docs/security-acceptance-checklist.md`
