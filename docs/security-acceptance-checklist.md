# Security Acceptance Checklist — Public Readiness Review วันที่ 23 กันยายน 2569

สถานะเอกสารนี้เป็น `NO-GO` จนกว่า Owner/Security จะกรอกหลักฐานจริงจาก environment ที่จะเปิด Public

ตรวจเดิมก่อนเพิ่ม Local Accounts ณ 23 กันยายน 2569: `npm.cmd run test:all` ผ่าน 53 scripts. หลังเพิ่ม Local Accounts รันซ้ำบน PostgreSQL ชั่วคราวแยกแล้ว: 54 scripts ผ่าน, 0 ล้มเหลว; `release/public` ผ่าน artifact smoke. Regression suite ใช้ฐานทดสอบชั่วคราว; ส่วนฐานตาม `.env` ถูกสำรองแยกก่อน migration และ local Admin bootstrap ตามบันทึกด้านล่าง

เครื่องนี้ถูกตั้ง `.env` สำหรับ local run แล้ว: `CHECKLIST_AUTH_MODE=local`, station scope และ Secure cookie เปิด, bind `127.0.0.1`, ใช้ `release/public` และ filesystem attachments; ไม่ได้ตั้ง OIDC หรือเปิด port ภายนอก. สำรองฐาน PostgreSQL ก่อน bootstrap ที่ `backups/2026-09-23T06-24-08-472Z`. สร้าง Local Admin `admin` แล้ว; login API ผ่านและบังคับเปลี่ยนรหัสครั้งแรก. นี่เป็น local setup เท่านั้น: ยังไม่มี production target, HTTPS/reverse proxy, S3/MinIO หรือข้อมูลอนุมัติสำหรับ live Vehicle API smoke จึงยังห้าม deploy เปิด Public

ก่อนเริ่ม Local Admin bootstrap ตรวจฐานที่กำหนดใน `.env` แบบอ่านอย่างเดียวพบ `schema_migrations` version `1`; หลัง bootstrap ตรวจซ้ำพบ versions `1, 2` และ active admin 1 บัญชี. backup ถูกสร้างก่อน migration; ยังไม่มี backup/restore drill

| Gate | Evidence ที่ต้องมี | Status |
|---|---|---|
| Central source of truth | server mode, PostgreSQL/object storage, no browser-only write | PostgreSQL server API smoke PASS on isolated local cluster; S3 backend still requires integration with MinIO/S3 |
| Schema migration | `schema_migrations` + migration smoke | PASS on isolated test cluster and configured local PostgreSQL (`1, 2`); backup taken before migration |
| Immutable close/Snapshot | attempted mutation returns 409; revision creates new id | PASS in PostgreSQL/server API smoke; UI flow required |
| Individual login | Local admin bootstrap, managed users, password/session review | PASS in isolated PostgreSQL integration and local bootstrap/login; forced password change verified; production bootstrap and Owner/Security review remain required |
| Server authorization | 401/403 per role; Viewer is limited to assigned stations and Inspector can inspect all stations | RECHECK REQUIRED after the Inspector scope change; live role/UAT required |
| HTTPS/reverse proxy | external scan shows only 443; Node port private | NO-GO until external network test |
| Vehicle proxy authentication/scope | Search and image require read role; Inspector can target any configured station and Viewer is limited to assigned stations | RECHECK REQUIRED after the Inspector scope change; real-role/UAT pending |
| Vehicle SSRF/data boundary | Station Profile target resolution, client `baseUrl` ignored, two-station POST/pagination/image smoke | PASS in local proxy tests; NO-GO until two real stations pass read-only smoke |
| File upload security | MIME/magic/size/random name/download ACL | PASS in API smoke with filesystem backend; S3 backend and real role test required |
| Backup/restore | daily backup + isolated restore drill | Scripted; NO-GO until drill evidence |
| Logging/secrets | auth/authz/data/upload/error logs, no token/password/session ID | Partial code; log review required |
| Fresh artifact | source build hash and deployment manifest | PASS for local `release/public` artifact: 16 files, SHA-256 verified; production deployment required |
| Regression | full test suite including Local Accounts and `test_video_purge` | PASS — 54 scripts, 0 failures on isolated PostgreSQL; S3/MinIO and Vehicle API production smoke remain required |

บัญชี Local ไม่มี external MFA และยังไม่ได้รับ Security/Owner acceptance สำหรับ Public; การตัดสินใจใช้บัญชี Local บันทึกใน [ADR 0005](adr/0005-local-managed-accounts.md). ต้อง review password/account lifecycle และ bootstrap procedure ก่อนเปิด Public

ห้ามรับรอง Public หากแถวใดเป็น NO-GO หรือมี cross-station access, regression, backup/restore failure หรือ secret leakage
