# Checklist Central API Contract

สถานะสัญญา: local account API เพิ่มเมื่อ 23 กันยายน 2569; PostgreSQL local-auth integration ต้องรันใน environment ที่ตั้งค่า test database URL

Base path: `/api/v1` · JSON ใช้ UTF-8 · ทุก response มี `X-Request-Id`

## Runtime endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | none | process health; ไม่ตรวจ dependency |
| GET | `/ready` | none | process/database/attachment readiness; `vehicleApi` เป็น `null` หากไม่มีผลตรวจจริง และไม่ probe upstream เอง ถ้า `REQUIRE_VEHICLE_API_READY=true` ต้องส่งผล `vehicleReady: true` เข้ามาจึงผ่าน readiness |
| GET | `/api/v1/auth/config` | none | auth mode/configuration (ไม่มี secret) |
| POST | `/api/v1/auth/login` | local username/password | สร้าง Secure HttpOnly session; login failure ถูก rate limit |
| GET | `/api/v1/auth/me` | authenticated หรือ development-only no-login | current user/role/station scope; local account ระบุสถานะบังคับเปลี่ยนรหัส |
| POST | `/api/v1/auth/password` | authenticated local account | ตรวจรหัสปัจจุบัน เปลี่ยนรหัส และออก session ใหม่ |
| POST | `/api/v1/auth/exchange` | OIDC bearer | แลก bearer เป็น Secure HttpOnly session cookie |
| POST | `/api/v1/auth/logout` | authenticated | revoke current session |
| GET/POST | `/api/v1/admin/users` | admin | list/create local accounts; create กำหนด role/station และ temporary password |
| PATCH | `/api/v1/admin/users/:id` | admin | เปลี่ยนข้อมูล role/station, reset password, activate/suspend |
| GET | `/api/v1/state` | authenticated หรือ development-only no-login | อ่าน state ที่ถูก scope ตาม station assignment; response มี `authMode` |
| PUT | `/api/v1/state` | admin/manager/inspector | เขียน state ด้วย `expectedVersion`; scoped user จะ merge เฉพาะ station ที่ได้รับอนุญาต และ conflict เป็น `409` |
| GET | `/api/v1/stations` | authenticated | station projection |
| GET | `/api/v1/stations/:id` | authenticated | one Station Profile |
| GET | `/api/v1/stations/:id/assets|systems|lanes` | authenticated | station topology projections |
| GET | `/api/v1/rounds` | authenticated | round projection |
| GET | `/api/v1/rounds/:id` | authenticated | one Inspection Round |
| GET | `/api/v1/rounds/:id/snapshot|evidence|report` | authenticated | immutable Snapshot, evidence values, report projection |
| GET | `/api/v1/history` | authenticated | closed rounds/history |
| GET | `/api/v1/audit` | admin | audit entries |
| PUT | `/api/v1/attachments/:id` | write roles | upload binary ที่ allowlist MIME/content/ขนาด |
| GET/HEAD | `/api/v1/attachments/:id` | authenticated | download file ผ่าน access-controlled API |
| DELETE | `/api/v1/attachments/:id` | write roles | ลบ metadata/file และบันทึก audit |

## Vehicle API proxy

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/vehicle/search` | authenticated read role; station-scoped when enabled | ค้นข้อมูลจาก Vehicle API ที่ server resolve จาก Station Profile |
| GET/HEAD | `/api/vehicle/image` | authenticated read role; station-scoped when enabled | โหลดภาพจาก Vehicle API ผ่าน allowlisted Station Profile target |

ทั้งสองเส้นทางต้องส่ง `stationId` เมื่อเปิด `VEHICLE_SEARCH_ENFORCE_STATION_TARGET=true`; image ส่งผ่าน query string ส่วน search ส่งใน JSON body. Public/local auth จะเปิด target enforcement เสมอ และ server ไม่เชื่อ `baseUrl` ที่ client ส่งมา. `admin`/`station-manager` อ่านได้ทุกสถานี; `inspector`/`viewer` ต้องมี local account station assignment ตรงกับ Station Profile. Direct access ไป upstream อยู่นอก Checklist API และไม่ใช่เส้นทางของผู้ใช้ Public.

Unauthenticated request ตอบ `401`, role ที่ไม่ได้รับสิทธิ์หรือ station claim ไม่ตรงตอบ `403`, และคำขอที่ขาด/ไม่รู้จัก Station Profile ตอบ `400`.

## State write

```json
{
  "state": { "version": 14, "stationProfiles": [], "inspectionRounds": [] },
  "expectedVersion": 3,
  "reason": "close-round"
}
```

`409` หมายถึง version conflict หรือพยายามแก้ closed round/Snapshot เดิม ข้อมูลต้อง reload แล้วสร้าง revision ใหม่แทนการ overwrite

เมื่อเปิด `CHECKLIST_ENFORCE_STATION_SCOPE=true` ผู้ใช้บทบาท `station-manager` และ `admin` เป็นผู้จัดการส่วนกลาง จึงเห็น topology ของ Contract/WorkPackage/Region และทุกสถานี ส่วนผู้ใช้บทบาท `inspector` ที่มี station claim จะเขียนได้เฉพาะ `stationProfiles`, `inspectionRounds`, `inspectionHistory`, `inspectionWorkspaces`, `contractStationAssignments` และ `contractWorkReports` ของสถานีใน claim เท่านั้น และจะเห็นเฉพาะสัญญาที่มีสถานีใน scope; ข้อมูลสถานีอื่นและ global catalog จะถูกเก็บไว้โดย server ผู้ใช้ที่ไม่มี station claim จะอ่านได้เฉพาะ state ว่างและไม่มีสิทธิ์เขียน

## Attachment contract

ส่ง body เป็น binary พร้อม `Content-Type`, `X-Filename` และใน scoped mode ต้องมี `X-Station-Id` ชื่อไฟล์ UTF-8 ให้ percent-encode แล้วส่ง `X-Filename-Encoding: percent-encoded-utf8`; server ยังรับ `X-Filename` แบบเดิมที่ไม่มี header ระบุ encoding เพื่อรองรับ client เก่า การตอบกลับใช้ `filename*` สำหรับชื่อ UTF-8 และชื่อ ASCII สำรอง ไฟล์ที่รับใน implementation นี้คือ JPEG, PNG, WebP, PDF, MP4, WebM และ text ไม่เกิน 20 MiB; server ตรวจ magic bytes และเก็บด้วย random filename ที่ไม่อิงชื่อจาก client

## Authentication

Deployment ที่เลือกใช้บัญชีภายในตั้ง `CHECKLIST_AUTH_MODE=local`. Admin คนแรกสร้างจาก Terminal ด้วย `npm.cmd run admin:bootstrap` ซึ่งปฏิเสธเมื่อมีบัญชีแล้ว; ไม่มี public self-registration. Admin สร้างบัญชีได้จากหน้า `#/admin/users` และกำหนดรหัสชั่วคราว. ระบบเก็บ password hash ด้วย scrypt/per-user salt, บังคับเปลี่ยนรหัสแรกเข้า, ระงับบัญชีแทนการลบ และไม่แสดง password hash ใน API. Session token เป็น opaque random value โดย database เก็บ hash เท่านั้น. Cookie ใช้ `Secure; HttpOnly; SameSite=Lax`.

OIDC ยังคงเป็นทางเลือกเมื่อองค์กรต้องการ identity provider; ไม่จำเป็นต้องติดตั้ง Docker สำหรับ local account. Public/Production ต้องเปิด station scope และ Secure cookie. `CHECKLIST_AUTH_MODE=disabled` สงวนไว้สำหรับ development; startup ปฏิเสธเมื่อ `NODE_ENV=production` หรือ `CHECKLIST_PUBLIC_MODE=true`.

`CHECKLIST_AUTH_MODE=disabled` สงวนไว้เฉพาะ development ที่ไม่เปิด Public; ทุก request จะเป็นผู้ใช้กลาง `local-admin` และ audit ระบุตัวคนจริงไม่ได้. Startup ปฏิเสธ mode นี้เมื่อ `NODE_ENV=production` หรือ `CHECKLIST_PUBLIC_MODE=true` และห้ามใช้กับข้อมูล Production

## Storage configuration

Server ใช้ `CHECKLIST_DATABASE_URL` และสร้าง normalized projections ใน PostgreSQL; ค่า `CHECKLIST_STORAGE_BACKEND` ถ้าระบุต้องเป็น `postgres` เท่านั้น

`CHECKLIST_ATTACHMENT_BACKEND=s3` ใช้ MinIO/S3-compatible ตาม `CHECKLIST_S3_*` และให้ API เป็นผู้ควบคุมสิทธิ์ upload/download; `filesystem` ยังคงใช้ได้ใน local/pilot
