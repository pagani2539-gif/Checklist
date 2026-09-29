# Refactor Phase 1 Baseline

วันที่ตรวจ: 2026-09-21 (Asia/Bangkok)

## ผลตรวจ

- `node tools/run_all_tests.mjs`: PASS — 42 scripts, failed 0
- `npm.cmd run build`: environment failure ก่อนเริ่ม build — Vite ไม่สามารถเขียน `node_modules/.vite-temp/vite.config.js.timestamp-*.mjs` และคืนค่า `EPERM`
- PostgreSQL integration: ยัง skip หากไม่มี `CHECKLIST_POSTGRES_TEST_DATABASE_URL`

## ขอบเขต baseline

- Runtime หลักยังเป็น React/Vite ผ่าน `src/main.jsx`
- Server mode ใช้ `/api/v1/state` เป็น compatibility endpoint
- ข้อมูล public เป้าหมายคือ PostgreSQL/MinIO; SQLite ใช้ local/pilot adapter
- Phase นี้แก้เฉพาะ station-scoped write และ regression test สองสถานี

## Phase 1 verification

- `node tools/test_state_scope.mjs`: PASS
- `node tools/test_oidc_flow.mjs`: PASS — scoped write preserves the other station, closed round and global catalog; unassigned write is rejected
- `node tools/test_server_api.mjs`: PASS
- `node tools/run_all_tests.mjs`: PASS — 42 scripts, failed 0 (same result confirmed after the fallback build)
- Vite fallback build with `--configLoader runner` and an external output directory: PASS; bundle-size warning remains non-blocking
