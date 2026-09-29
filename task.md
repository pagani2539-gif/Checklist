# Checklist task tracker (historical implementation log)

อัปเดตล่าสุดของรายการเดิม: 4 กันยายน 2569

## สถานะปัจจุบันของ repository

ข้อมูลด้านล่างเป็น implementation log ตามวันที่เดิม จึงเก็บ checkbox และผลทดสอบเก่าไว้เพื่อ traceability ไม่ใช่รายการงานปัจจุบันทั้งหมด ให้ยึด [`docs/document-status.md`](docs/document-status.md), `README.md` และ `docs/` เป็น source ปัจจุบัน

- Runtime มีทั้ง local-first mode และ server mode ผ่าน `/api/v1/state`; server mode ใช้ PostgreSQL เป็น central persistence ตาม ADR 0004 ส่วน local-first ใช้ browser storage ของเครื่องนั้น
- OIDC, station scope, attachment API, backup/restore และ Vehicle proxy มี code/test seam แล้ว แต่ real deployment, PostgreSQL integration, real OIDC tenant, external network, restore drill และ field/UAT ยังไม่ผ่านการรับรอง Public
- การตรวจล่าสุดวันที่ 21 กันยายน 2569: `node tools/run_all_tests.mjs` ผ่าน 42/42; PostgreSQL integration ถูก skip หากไม่มี `CHECKLIST_POSTGRES_TEST_DATABASE_URL`; fallback Vite build ผ่านและมีเพียง bundle-size warning

## งานแปลงแบบตัวอย่างที่ 1 เป็นรายงานพิมพ์จริง (4 กันยายน 2569)

### งานที่เพิ่งทำเสร็จ

- [x] ถอดตัวเลือกสไตล์ 3 แบบและ state/localStorage ที่เกี่ยวข้องออกจาก flow รายงาน
- [x] ปรับ `PrintableReport` เป็นแบบ modern blue A4 แนวตั้งตามแบบตัวอย่างที่ 1
- [x] แสดงข้อมูลสถานี/โครงการแบบสองคอลัมน์, summary strip, ตาราง BOQ, gallery หลักฐาน และช่องลงนาม 3 ฝ่าย
- [x] แสดง evidence slots ทุกช่องจาก `ReportTemplateModel` รวมถึงกรณีหนึ่งรายการมีหลายช่อง และโหลดไฟล์จริงจาก IndexedDB
- [x] คง `REPORT_TEMPLATE_ID`, Snapshot, status, ID, source order, attachment และประวัติเดิมโดยไม่เปลี่ยน schema

### ผลตรวจ Local/Test และ Browser ที่พิสูจน์แล้ว

- [x] `npm.cmd run build`
- [x] `npm.cmd run test:report-template`
- [x] `npm.cmd run test:history-edit`
- [x] `npm.cmd run test:flow-redesign`
- [x] Browser check ทั้งรอบฉบับร่างและประวัติที่ปิดแล้วด้วย synthetic QA round
- [x] Print-media check และ screenshot comparison กับภาพต้นแบบแบบที่ 1 บันทึกใน `design-qa.md`

### งานที่ยังค้าง / ยังไม่พิสูจน์

- [ ] ผู้ใช้ตรวจ Print Preview และพิมพ์จริงกับกระดาษ/เครื่องพิมพ์เป้าหมาย
- [ ] งานนี้ใช้ภาพดีไซน์เป็นต้นแบบ ไม่ใช่การเชื่อมต่อหรือแก้ไขไฟล์ในบัญชี Canva ภายนอก

## หลักเกณฑ์อ่านสถานะปัจจุบันและบันทึกเดิม

- สถานะปัจจุบันของแม่แบบคือ `checklist-master-v5-system-mapped`; `checklist-master-v4-asset-mapped` เป็นแม่แบบเดิม และ `checklist-master-v3-boq-evidence` เป็นแม่แบบประวัติเดิม
- ตัวเลขที่ใช้ใน implementation ปัจจุบันคือ การตั้งค่ารายการตรวจประจำสถานี 13 หมวด / 44 รายการ และรายการหลักฐานกลาง 13 หมวด / 123 รายการตรวจ / 170 ช่องหลักฐาน
- ตัวเลข `45`, `185`, `126` และ `43` ที่ปรากฏในหัวข้อหรือผลทดสอบก่อนหน้าเป็น **บันทึกเดิม (Legacy — ไม่ใช่ตัวเลขปัจจุบัน)** และคงไว้เพื่อการตรวจสอบย้อนหลังเท่านั้น
- คำอธิบายหรือผลทดสอบที่ระบุว่า `legacy`/`Legacy` เป็นหลักฐานของรุ่นเดิม ไม่ใช่ข้อกำหนดหรือค่าที่ใช้กับรอบการตรวจใหม่

## ขอบเขตที่ยืนยันจากคำขอ

- สร้างเว็บ Checklist สำหรับตรวจสภาพอุปกรณ์ตามไฟล์ `Checklist ตัวอย่างเอกสาร.pdf`
- แต่ละรายการกรอกค่าตัวเลขได้
- เลือกสถานะจาก dropdown เช่น `ปกติ`, `ชำรุด`, `อยู่ระหว่างรอเปลี่ยนทดแทน`
- เน้น MVP ที่ใช้งานง่ายและเปิดทดสอบได้ก่อน

## งานที่เพิ่งทำเสร็จ

- [x] อ่าน PDF อ้างอิงครบ 14 หน้าและสรุปสารบัญ BOQ 13 หมวด
- [x] แยกข้อมูลอ้างอิงใน PDF ออกจากคำสั่งพัฒนาของผู้ใช้
- [x] กำหนด MVP แบบ local-first ไม่ใช้ฐานข้อมูลและไม่ต้อง login
- [x] สร้างแบบจำลองข้อมูลรายการตรวจ, สถานะ, ค่าตัวเลข และหมายเหตุ

## งาน Mapping 3 ชั้น BOQ / Checklist / Asset ที่เพิ่งทำเสร็จ

- [x] แยก `BOQ_SYSTEMS` และ `systemId` ตามลำดับ WIM → LPR → CCTV → ระบบส่วนควบ พร้อมเก็บ `sourceLabel`/`sourceRefs` แยกจากชื่อแสดงผล
- [x] ปรับชื่อแสดงผลสำคัญเป็น `WIM Electronics System for IMPS`, `Network Video Recorder (NVR)` และ `Variable Message Sign (VMS)` โดยไม่เปลี่ยนป้ายอ้างอิงต้นฉบับ
- [x] แยก `stationSystems`, `lanes` และ `equipment` ใน Station Profile/Snapshot; Lane topology ไม่มี Asset No. และ Serial Number
- [x] ถอน standalone ImPS ออกจาก `EQUIPMENT_TYPES`, `ITEM_LIBRARY_CATEGORIES`, `BOQ_SYSTEMS`, Present systems และ mapping โดยไม่นำ `ช่องจราจร` เข้า Item Library
- [x] ให้ร่างสถานีใหม่สร้างเฉพาะ Asset ที่ Present เหลืออยู่: Computer 1, Cabinet 1, LPR camera 3, CCTV fixed camera 3, NVR 1 และ Database Server 1; Sensor/Loop และ Lane ให้เพิ่มตามหน้างาน
- [x] เพิ่ม `checklist-master-v5-system-mapped`; `3.1` ของรอบใหม่ผูก Lane topology ตามจำนวนจริง และคง v3/v4 สำหรับ Snapshot เดิม
- [x] เพิ่ม regression test สถานีไม่มี Lane, Lane 2/4 ช่อง, Asset overflow, ชื่อแสดงผล/sourceLabel และ fixed-seed quantity
- [x] ผ่าน `npm.cmd run test:item-library`, `npm.cmd run test:station-creation`, `npm.cmd run test:evidence-checklist`, `npm.cmd run test:evidence-catalog`
- [x] เพิ่ม state migration รุ่น 14 สำหรับลบ standalone ImPS จาก Station Profile, catalog, draft/open/closed round, Snapshot, history, workspace และ legacy aliases ก่อน normalize; ลบไฟล์แนบที่เหลือเฉพาะ ImPS และทำซ้ำได้อย่างปลอดภัย

ขอบเขตการยืนยัน: ผลทดสอบและ build เป็น Local/Test เท่านั้น ยังไม่ใช่หลักฐาน Field/UAT/Production; ยังต้องตรวจบน browser เครื่องจริงและยืนยัน topology/จำนวนอุปกรณ์กับหน้างานก่อนใช้งานจริง

## งานแยก Checklist copy จาก technical template ที่เพิ่งทำเสร็จ

- [x] เพิ่ม `CHECKLIST_COPY_OVERRIDES` เป็นจุดแก้ชื่อหมวด ชื่อรายการ หน่วย และ helper จาก Master กลาง
- [x] แยก `displayLabel` ออกจาก `sourceLabel` ของ PDF และเก็บ copy revision ใน Snapshot
- [x] เปลี่ยน Asset applicability ให้ใช้ stable template ID metadata แทนการ parse จากข้อความที่แก้ได้
- [x] ให้หน้าตรวจและรายงานใช้ข้อความจาก Snapshot เพื่อไม่ให้รอบเดิมเปลี่ยนตาม Master ใหม่
- [x] รองรับ legacy v3 snapshot ที่ยังไม่มี `checklistCopy` ด้วย frozen legacy copy ระหว่าง migration
- [x] เพิ่ม regression test การเปลี่ยนข้อความ/หน่วย/helper โดยตรวจ item count, Asset mapping, source label และ Snapshot isolation
- [x] ผ่าน `npm.cmd run test:evidence-checklist`, `npm.cmd run test:station-creation`, `npm.cmd run test:report-template`, `npm.cmd run test:evidence-catalog`

## งานปรับถ้อยคำราชการและแก้ความหมายที่ขัดแย้ง (ปัจจุบัน)

- [x] ปรับชื่อหมวด ชื่อรายการ หน่วย และคำอธิบายเป็นภาษาไทยเชิงราชการ โดยคงศัพท์เทคนิคที่จำเป็นไว้ในวงเล็บ
- [x] แยกคำสำหรับรายการตรวจ, หลักฐาน, ข้อมูลประจำรอบการตรวจ และข้อมูลลงนามรายงาน พร้อมแก้ความหมายของ 3.1/3.2 และงานทำความสะอาดให้ไม่ซ้ำกัน
- [x] ระบุ v5 เป็นแม่แบบปัจจุบัน, v4 เป็นแม่แบบเดิม และ v3 เป็นแม่แบบประวัติเดิม พร้อมยืนยันจำนวนปัจจุบัน 44/170
- [x] คงรหัสภายใน, item ID, slot ID, status, sourceLabel, Asset mapping และ Snapshot เดิม
- [x] เพิ่ม `test:copy-consistency` ตรวจถ้อยคำ สถานะ จำนวน รหัส การจับคู่ sourceLabel, Snapshot isolation และป้าย legacy
- [x] ผ่าน regression tests และ `npm.cmd run build`
- [ ] ประเด็นนอกขอบเขตงานถ้อยคำ: ออกแบบการแก้รหัสช่องหลักฐานของรายการ 3.1 ที่สร้างซ้ำตาม Lane ในรอบใหม่ เนื่องจากต้องกำหนด migration/ความเข้ากันได้ของรหัสทางเทคนิคก่อน จึงยังไม่แก้ในรอบนี้
- [ ] ผู้ใช้ตรวจรอบใหม่และประวัติเดิมหลังแก้ Master copy บน browser เครื่องจริง

## งานที่เพิ่งทำเสร็จเพิ่มเติม

- [x] สร้างหน้าเว็บ Checklist แบบ responsive สำหรับมือถือและคอมพิวเตอร์
- [x] เพิ่มการบันทึกอัตโนมัติใน browser localStorage
- [x] เพิ่มสรุปจำนวนรายการ, รายการมีปัญหา และเปอร์เซ็นต์ความคืบหน้า
- [x] เพิ่ม local Node server ที่ `http://127.0.0.1:4173`
- [x] ทดสอบกรอก metadata, ค่าตัวเลข, สถานะ และหมายเหตุผ่าน browser
- [x] ทดสอบโหลดข้อมูลตัวอย่าง, กรองสถานะ และ reload แล้วข้อมูลยังอยู่
- [x] ตรวจ responsive ที่ viewport 390px และไม่พบ browser console error

## งาน redesign ที่เพิ่งทำเสร็จ

- [x] ปรับ UI เป็น Operations Swiss แบบ Thai-first และ mobile-first โดยคง flow MVP เดิม
- [x] ปรับ shell, job header, summary cards, BOQ navigation และรายการตรวจสำหรับ Desktop/Mobile
- [x] เปลี่ยน glyph icon เดิมเป็น inline SVG และเพิ่ม semantic labels, focus-visible, progressbar และ aria-live result count
- [x] เพิ่ม native details สำหรับยุบข้อมูลโครงการบนมือถือ พร้อม touch target ขั้นต่ำ 44px และ inputmode สำหรับค่าตัวเลข
- [x] เพิ่ม pressed/hover/save feedback, empty state, reduced-motion และ print layout ใหม่
- [x] คง `localStorage` key `checklist-mvp-v1` และตรวจว่าข้อมูลเดิมเปิดต่อได้
- [x] ผ่าน `node --check app.js` และ `node --check server.mjs`
- [x] ตรวจ HTTP 200 สำหรับ `/`, `index.html`, `styles.css` และ `app.js`
- [x] Browser smoke test ที่ viewport 375, 768, 1024 และ 1440px ไม่พบ horizontal overflow หรือ console error
- [x] Browser interaction test: 45 รายการ, ค้นหา 5 รายการ, กรองชำรุด 2 รายการ, แก้ไข/บันทึก/reload/คืนข้อมูลตัวอย่างสำเร็จ

## งาน Station-aware ที่เพิ่งทำเสร็จ

- [x] เปลี่ยนโครงสร้างจากรายการตายตัวเป็น `MASTER_CHECKLIST_SECTIONS` + Station Profile + Inspection Snapshot
- [x] เพิ่มหน้าเลือก/สร้างสถานี และแก้ไขรหัส ชื่อ ตำแหน่ง Serial Number และสถานะใช้งานของอุปกรณ์
- [x] สร้างรายการตรวจซ้ำตามอุปกรณ์จริง และแสดง `ไม่เกี่ยวข้อง` สำหรับอุปกรณ์ที่ไม่มีในสถานี
- [x] แยก workspace การตรวจต่อสถานีใน localStorage พร้อมเก็บ Snapshot/รายการเก่าใน `inspectionHistory`
- [x] แก้การสลับสถานีให้โหลด workspace ของสถานีนั้นกลับมา ไม่ใช้ Snapshot ของสถานีอื่นปนกัน
- [x] คง key `checklist-mvp-v1` และ migrate state เดิมที่มี `meta/items` โดยไม่ทิ้งค่าที่กรอกไว้
- [x] ทดสอบสถานี LPR 2 ตัวได้ 27 รายการ และสถานี LPR 3 ตัวได้ 28 รายการ
- [x] ทดสอบสลับสถานีแล้วค่าตรวจไม่ปนกัน และปิดใช้งานอุปกรณ์แล้ว Snapshot ใหม่คำนวณจำนวนลดลง
- [x] ทดสอบสถานีไม่มี VMS: รายการ `ไม่เกี่ยวข้อง` ถูก disable และไม่รวมใน Progress
- [x] ตรวจ responsive ที่ viewport 375, 768, 1024 และ 1440px หลังเพิ่ม Station Profile ไม่พบ horizontal overflow
- [x] ตรวจ browser console หลัง flow station-aware ไม่พบ error

## งานที่รอการทดสอบโดยผู้ใช้

- [ ] ทดลองกรอกข้อมูลตามสถานีจริงและยืนยันว่าชื่อรายการ/หน่วยวัดตรงกับหน้างาน
- [ ] ทดลองสร้างอย่างน้อย 2 สถานีที่มีจำนวนอุปกรณ์ต่างกัน และยืนยันชื่อ/ตำแหน่ง/Serial Number กับหน้างาน
- [ ] ทดสอบการแนบภาพหลักฐานจริงกับผู้ใช้หน้างานและยืนยันขนาด/ขั้นตอนที่เหมาะสม

## งานจัดหมวดอุปกรณ์รายตัวตาม BOQ ที่เพิ่งทำเสร็จ

- [x] จัดรายละเอียด Asset เป็นหมวด BOQ หลักและประเภทย่อย โดยไม่เปลี่ยน `profile.equipment` หรือ Snapshot
- [x] ตรวจ mapping 2.1 = WIM Sensor/Loop, 4.1 = Fixed/PTZ และ 7.1 = VMS ทั้ง 3 ประเภท
- [x] ซ่อนหมวดที่ไม่มี Asset และคงอุปกรณ์ปิดใช้งานไว้ในหมวดเดิมพร้อมสถานะ
- [x] รวม mapping ประเภทอุปกรณ์กลับไปยังหมวด BOQ กลางสำหรับรายการเพิ่มเติมจาก Asset จริง
- [x] เพิ่ม unit test การเรียงหมวด, การซ่อนหมวดว่าง, inactive asset และการไม่ mutate ข้อมูลต้นทาง
- [x] ผ่าน `npm.cmd run test:station-creation`, `npm.cmd run test:evidence-checklist`, `npm.cmd run test:evidence-catalog`, `npm.cmd run test:report-template` และ `npm.cmd run build`
- [x] ปรับส่วนปรับจำนวนเป็น `หมวด BOQ → ประเภทย่อย → +/-` โดยแสดงครบ 9 หมวด Asset-capable แม้สถานีว่าง และไม่แสดง 1.1/6.1/6.2/6.3 ใน Asset Register
- [x] Browser smoke บน origin แยก: สถานีว่างเห็นลำดับ 2.1 → 7.1, เพิ่ม Asset หลายประเภท, ตรวจกลุ่ม 2.1/4.1/7.1, inactive asset, เปิดหน้าใหม่แล้วข้อมูลยังอยู่ และไม่พบ horizontal overflow ที่ 1280px

## งานจัดหมวดอุปกรณ์ที่รอการยืนยันจากผู้ใช้

- [ ] ผู้ใช้ตรวจหัวหมวด BOQ และชื่อประเภทย่อยกับทะเบียนสถานีจริง
- [x] ยืนยันให้ลำดับ Asset ภายในประเภทย่อยคงตามลำดับเดิมในทะเบียน ไม่เรียงใหม่ตาม Asset No.

## งานที่ยังค้าง / ยังไม่อยู่ใน MVP

- [ ] Backend และฐานข้อมูลหลายผู้ใช้
- [ ] Login, สิทธิ์ผู้ตรวจ และ audit log แบบ server-side
- [x] แนบภาพหลักฐานต่อ Checklist item แบบ local-only ด้วย IndexedDB และ metadata ใน localStorage
- [ ] Offline sync ข้ามอุปกรณ์
- [ ] สร้างรายงาน PDF ตาม layout ต้นฉบับแบบเต็ม โดยแสดงเฉพาะอุปกรณ์จาก Inspection Snapshot
- [ ] ยืนยันหน่วยวัดและเกณฑ์ผ่านของตัวเลขแต่ละอุปกรณ์กับผู้ใช้งานหน้างาน

## หลักฐานและขอบเขตการยืนยัน

- PDF อ้างอิงมีข้อมูลโครงการ, สถานี, ผู้รับจ้าง, ผู้ตรวจสอบ และหมวด BOQ พร้อมช่องภาพ/หมายเหตุ
- PDF ไม่ได้กำหนดชื่อสถานะ dropdown หรือหน่วยวัดตัวเลขอย่างเป็นทางการ จึงใช้ค่ากลางที่แก้ไขได้ใน MVP
- การบันทึกใน MVP เป็นข้อมูลใน browser เครื่องนั้นเท่านั้น ยังไม่ถือเป็นข้อมูล production หรือข้อมูลภาคสนามจริง

## งานแยกหน้าการทำงานตามขั้นตอนที่เพิ่งทำเสร็จ

- [x] เปลี่ยนจากหน้าเดียวเป็น Hash Route ใน `index.html` เดิม โดยมี Dashboard, Stations, Inspection Rounds, Checklist และ History
- [x] เพิ่ม `inspectionRounds` เป็นข้อมูลหลัก พร้อม migration จาก `inspectionWorkspaces`, `inspectionHistory` และข้อมูลเดิม `inspectionSnapshot/items/meta`
- [x] แยก Checklist ให้เปิดด้วย `roundId` เท่านั้น และเก็บค่าตรวจแยกตามรอบ/สถานี
- [x] เพิ่ม flow สร้างรอบใหม่แบบ explicit, สร้าง Snapshot และปิดรอบเป็น Read-only
- [x] เพิ่มหน้า Stations สำหรับสร้าง/แก้ไขสถานีและอุปกรณ์ พร้อมลบได้เฉพาะอุปกรณ์ที่ยังไม่ถูกอ้างอิง และใช้ปิดใช้งานสำหรับ Snapshot เดิม
- [x] เพิ่มหน้า History/รายละเอียดประวัติและปุ่มพิมพ์ โดยไม่แสดง control สำหรับแก้ไข
- [x] เพิ่ม desktop sidebar และ mobile bottom navigation 4 เมนู พร้อม active state, focus target, safe-area และ print rules
- [x] ผ่าน `node --check app.js`, `node --check server.mjs` และ HTTP 200 ของหน้า/asset หลัก
- [x] Browser smoke test: เปิด route โดยตรง, active navigation, data isolation รอบ A/B, ปิดรอบ, Read-only history และไม่มี console error
- [x] Browser responsive test ที่ 375, 768, 1024 และ 1440px ไม่พบ horizontal overflow; mobile nav เป็น fixed bottom และ main มีพื้นที่กันบัง

## งานแยกหน้าที่รอการยืนยัน/ทำต่อ

- [ ] ผู้ใช้ทดสอบ flow จริงตั้งแต่สร้างสถานี → สร้างรอบ → ปิดรอบ → พิมพ์ และยืนยันภาษากับขั้นตอนหน้างาน
- [ ] ทดสอบ migration กับข้อมูล `checklist-mvp-v1` ของผู้ใช้จริงเพิ่มเติมก่อนประกาศใช้งาน
- [ ] ตรวจ layout การพิมพ์กับกระดาษ/เครื่องพิมพ์จริง และทำ PDF generator แบบเต็มในเฟสถัดไป
- [ ] Backend, multi-user, authentication และ offline sync ยังอยู่นอก MVP

## งาน React / UI-UX redesign ที่เพิ่งทำเสร็จ

- [x] อ่านและประยุกต์แนวทาง `ui-ux-pro-max` กับบริบทช่างหน้างาน: Operations Swiss, Thai-first, mobile-first, light theme และ touch target ขั้นต่ำ 44px
- [x] บันทึก design system, route map และ component map ไว้ใน `docs/design-system/`
- [x] เพิ่ม React/Vite foundation และ local dependency เฉพาะโปรเจกต์ โดยไม่เพิ่ม backend, login หรือ external font/image
- [x] เพิ่ม master checklist adapter ที่คง 13 หมวด 45 template items และสร้างรายการ dynamic ตาม Station Profile / Snapshot
- [x] เพิ่ม storage/migration adapter ที่คง key `checklist-mvp-v1` และรองรับ alias เดิม `items`, `inspectionSnapshot`, `inspectionHistory`, `inspectionWorkspaces`
- [x] ย้ายหน้าเว็บหลักเป็น React: ภาพรวม, สถานีและอุปกรณ์, รอบตรวจ, สร้างรอบตรวจ, ตรวจ Checklist และประวัติ/พิมพ์
- [x] คง data boundary: แก้ Station Profile ไม่เปลี่ยน Snapshot เก่า และรอบที่ปิดแล้วเปิดได้แบบ Read-only เท่านั้น
- [x] เพิ่ม UI primitives ตามรูปแบบ React Bits ที่เหมาะกับบริบท: Stepper, progress, status badge, empty state, responsive navigation และ feedback toast โดยไม่เดา Pro registry slug หรือใช้ license ที่ไม่ได้ให้มา
- [x] cut over `index.html` ให้ build React เป็น entry point และปรับ `server.mjs` ให้เสิร์ฟ `dist/index.html` พร้อม asset จาก build
- [x] ผ่าน `npm.cmd run build`, `node --check app.js` และ `node --check server.mjs`
- [x] ทดสอบ production build: route หลัก, สร้าง Snapshot, แสดง 13 หมวด/45 template items, กรอกค่า/สถานะ/หมายเหตุ, autosave, ปิดรอบ, history Read-only และ print action
- [x] ทดสอบ responsive ที่ 375, 768, 1024 และ 1440px บน Dashboard และตรวจ Checklist ที่ 375px ไม่พบ horizontal overflow หรือ console error
- [x] ตรวจ migration compatibility แบบมีหลักฐาน: item เดิม `sensor-1` ถูก map ไป dynamic Snapshot item โดยค่าตัวเลข/สถานะ/หมายเหตุไม่หาย

## งาน React / UI-UX ที่รอการยืนยันจากผู้ใช้

- [ ] ทดสอบบนเครื่องผู้ใช้ด้วยข้อมูล `checklist-mvp-v1` จริง และยืนยันว่าข้อมูลเดิมทุก field แสดงครบหลังเปิด React build
- [ ] สร้างอย่างน้อย 2 สถานีที่จำนวน LPR, Sensor, Lane และ VMS ต่างกัน แล้วตรวจว่า Snapshot/Progress/PDF ไม่ปนกัน
- [ ] พิมพ์จากเครื่องพิมพ์จริงที่กระดาษเป้าหมาย และยืนยันว่ารายการ/หัวกระดาษ/จำนวนหน้าเหมาะกับหน้างาน
- [ ] ยืนยันคำเรียกอุปกรณ์ หน่วยวัด และเกณฑ์ผ่านตัวเลขกับผู้ตรวจหน้างาน
- [ ] หากต้องการใช้ React Bits Pro/Application UI จริง ต้องให้ registry/license ที่ได้รับอนุญาตก่อนติดตั้งเพิ่ม

## งานที่ยังไม่อยู่ใน React MVP

- [ ] PDF generator แบบเต็มที่จัดหน้าเฉพาะอุปกรณ์ใน Snapshot
- [ ] backend, multi-user, authentication, audit log และ offline sync ข้ามอุปกรณ์

## งาน Station Profile +/− และ Checklist Configuration ที่เพิ่งทำเสร็จ

- [x] เพิ่ม `checklistConfig.disabledTemplateIds` ใน Station Profile และ Snapshot โดยค่าเริ่มต้นเปิดใช้ทั้ง 45 รายการ
- [x] เพิ่ม Quantity Control `− / +` ครบทุกประเภทอุปกรณ์ พร้อมสร้าง Asset No. ลำดับถัดไปและตำแหน่งเริ่มต้น `ระบุตำแหน่ง`
- [x] เพิ่มกติกาลดจำนวน: ลบได้เมื่อยังไม่เคยอยู่ใน Snapshot และเปลี่ยนเป็น `active: false` เมื่อมีประวัติอ้างอิงแล้ว พร้อม Confirmation
- [x] แสดงจำนวนอุปกรณ์ active/inactive และยังแก้ Asset No., ตำแหน่ง และ Serial Number รายตัวได้
- [x] เพิ่ม Checklist Configuration แบบ Accordion ครบ 13 หมวด/45 รายการ ปิดเฉพาะรายการต่อสถานีได้ และแสดงผลว่าไม่รวมในความคืบหน้า
- [x] รองรับรายการ repeatable แบบรายลำดับ เช่น ปิด `SENSOR #2` แล้ว `SENSOR #1` และ `#3` ยังตรวจได้
- [x] รองรับอุปกรณ์เกินแม่แบบ เช่น LPR #4/#5 โดยสืบทอดกติกาของลำดับสุดท้าย
- [x] เพิ่ม Preview รายการของรอบใหม่ทั้งจำนวนอุปกรณ์ รายการใช้ตรวจจริง และรายการไม่เกี่ยวข้อง/ปิด
- [x] Snapshot รอบใหม่คัดลอก equipment และ checklist config; การแก้ Station Profile ไม่เปลี่ยนรอบเก่า
- [x] Migration โปรไฟล์/สแนปช็อตเดิมที่ไม่มี `checklistConfig` ใช้ค่าเปิดทั้งหมด และคง key `checklist-mvp-v1` กับ alias เดิม
- [x] ผ่าน unit smoke test: 45 รายการเริ่มต้น, toggle SENSOR #2, overflow LPR #4/#5, snapshot isolation และ migration default
- [x] ผ่าน browser smoke test: Station UI, Confirmation ปุ่ม `−`, Preview และไม่มี console error หลัง reload

## งาน Station Wizard สร้างสถานีใหม่ที่เพิ่งทำเสร็จ

- [x] เพิ่ม route `#/stations/new` เป็น Wizard 4 ขั้น: ข้อมูลสถานี → ทะเบียนอุปกรณ์ → ตั้งค่า Checklist → ตรวจสอบและยืนยัน
- [x] เปลี่ยนปุ่ม `สร้างสถานี` ให้เปิด draft ชั่วคราว และยังไม่เพิ่ม Station Profile จนกดยืนยันขั้นสุดท้าย
- [x] เพิ่ม validation รหัส/ชื่อสถานี, รหัสสถานีซ้ำ และ Asset No. ซ้ำ พร้อม error ใกล้ field และ focus ไปยังรายการแรกที่ผิด
- [x] เพิ่ม quantity/detail editor ของ Asset ใน draft ครบทุกประเภทจาก `EQUIPMENT_TYPES` พร้อมรองรับ Asset No. เกินแม่แบบ
- [x] เพิ่ม review preview จำนวน Asset, Checklist และรายการใช้ตรวจจริง/ไม่เกี่ยวข้อง ก่อน commit โดยไม่สร้าง Inspection/Snapshot อัตโนมัติ
- [x] เพิ่ม domain helper และ regression test สำหรับ draft, validation, route และการ normalize ตอน commit
- [x] ผ่าน browser smoke ที่ 375/768/1280px, cancel/discard, สร้างสถานี และกดสร้าง Snapshot แยกภายหลัง โดยไม่มี console error
- [x] ปรับ UX ขั้นเลือกอุปกรณ์ให้ใช้การค้นหาและปุ่ม `เพิ่ม` เป็นหลัก ตัด drag-and-drop และพับหมวดที่ไม่มี Asset เพื่อลดภาระการเลื่อน/การจำหมวด BOQ
- [x] พับข้อมูล Present MA และรายละเอียดตำแหน่ง/Serial ไว้เป็น progressive disclosure โดยคง Asset No. เป็นข้อมูลหลักที่เห็นทันที
- [x] ซ่อนการตั้งค่า Checklist ขั้นสูงไว้หลังปุ่ม `ปรับรายการตรวจเพิ่มเติม` และแก้ข้อความจำนวนรายการให้ใช้ค่าจาก master จริง
- [x] แก้การกดยกเลิกจากร่างใหม่ที่ยังไม่แก้ไขไม่ให้เตือนทิ้งข้อมูลจาก Asset ตั้งต้นอัตโนมัติ

## งาน Station Wizard ที่รอการทดสอบ/ยืนยันจากผู้ใช้

- [ ] ผู้ใช้ทดลอง Wizard ด้วยรหัส/ชื่อ/Asset จริง และยืนยันว่าคำเรียกหมวด BOQ กับตำแหน่งติดตั้งเหมาะกับหน้างาน
- [ ] ผู้ใช้ยืนยันว่าการสร้างสถานีโดยไม่มี Asset เป็น warning ที่ยอมรับได้ตามขั้นตอนปฏิบัติงานจริง
- [x] ตรวจ horizontal overflow ที่ viewport 375, 768, 1024 และ 1440px ไม่พบ overflow

## งาน Station Profile +/− ที่รอการยืนยันจากผู้ใช้

- [ ] ทดสอบเพิ่ม/ลดจำนวนอุปกรณ์ของสถานีจริง และยืนยันลำดับ Asset No. กับหน้างาน
- [ ] ทดสอบปิดรายการ Checklist ที่ไม่เกี่ยวข้อง เช่น SENSOR #2 แล้วสร้างรอบใหม่เพื่อยืนยัน Progress จริง
- [ ] ยืนยันว่ารายการ Master ทั้ง 45 รายการและกติกาการสืบทอดเมื่อมีอุปกรณ์เกินแม่แบบตรงกับการตรวจจริง

## งานลบรอบตรวจที่เพิ่งทำเสร็จ (legacy, superseded 3 กันยายน 2569)

- [x] เพิ่มปุ่ม `ลบรอบตรวจ` ในหน้า Inspection List สำหรับรอบ draft
- [x] เพิ่มปุ่ม `ลบประวัติ` ในหน้า History สำหรับรอบ closed
- [x] เพิ่ม Confirmation แยกข้อความ draft/closed และใช้ touch target ขั้นต่ำ 44px
- [x] ลบรอบออกจาก `inspectionRounds`, compatibility aliases และบันทึก `deletedRoundIds` เพื่อไม่ให้ migration ดึงกลับหลัง reload
- [x] ถ้าลบ active round ระบบเลือก active round สำรองและอัปเดต alias เดิมอย่างปลอดภัย
- [x] Browser smoke test: ยกเลิก confirmation แล้วยังเห็นรอบ, ยืนยันแล้วการ์ดหาย และ reload แล้วไม่กลับมา
- [x] Browser smoke test: รอบปิดแสดงปุ่ม `ลบประวัติ` และ Confirmation แจ้งการลบ Checklist/Snapshot/รายงาน
- [x] ตรวจ browser console หลัง flow ลบไม่พบ error และตรวจ mobile action layout ที่ 375px ไม่พบ horizontal overflow

## งานลบรอบตรวจที่รอการยืนยันจากผู้ใช้

- [ ] ผู้ใช้ยืนยันว่าการลบประวัติถาวรใน localStorage ตรงตามนโยบายใช้งานจริง

> สถานะปัจจุบันตาม Flow ใหม่: รอบ draft ลบได้เมื่อยืนยันเท่านั้น; รอบปิดแล้วเป็น Read-only และห้ามลบ รายการลบประวัติด้านบนเป็นบันทึก legacy ของ flow เดิม

## งานลบสถานีและข้อมูลที่เกี่ยวข้องที่เพิ่งทำเสร็จ (legacy, superseded 3 กันยายน 2569)

- [x] เพิ่มปุ่ม `ลบสถานีนี้` ในหน้า Stations พร้อมสรุปจำนวนอุปกรณ์ รอบตรวจ Snapshot และ Checklist Config ก่อนลบ
- [x] เพิ่ม Confirmation Dialog แบบเข้าถึงได้ ต้องพิมพ์รหัสสถานีให้ตรง รองรับ Escape, focus trap, keyboard focus และ touch target ขั้นต่ำ 44px
- [x] ลบสถานีพร้อมรอบ draft/closed, Snapshot, อุปกรณ์, Checklist Config และ legacy aliases ที่อ้างอิงสถานีนั้นเท่านั้น
- [x] เพิ่ม `deletedStationIds` และ state version 7 เพื่อป้องกัน migration ดึงสถานีหรือข้อมูลที่ลบแล้วกลับมา
- [x] รองรับการลบสถานีสุดท้ายโดยคง `stationProfiles: []` หลัง Reload และยังสร้างสถานีใหม่ได้
- [x] ปรับ Confirmation ของการลด/ลบอุปกรณ์, ล้างค่ารอบ, ปิดรอบ และลบรอบตรวจให้ใช้ dialog เดียวกัน
- [x] ปรับ layout dialog และ action ลบให้รองรับมือถือโดยไม่เกิด horizontal overflow

## งานลบสถานีที่รอการยืนยันจากผู้ใช้

- [ ] ผู้ใช้ยืนยันว่าการลบสถานีแบบถาวรพร้อมประวัติทั้งหมดตรงตามนโยบายใช้งานจริง

> สถานะปัจจุบันตาม Flow ใหม่: สถานีที่มีประวัติหรือ Snapshot ใช้ `ปิดใช้งาน/เก็บถาวร` แทนการลบถาวร ข้อมูลงานลบสถานีด้านบนเป็นบันทึก legacy ของ flow เดิม

## งานปรับสีและ UI/UX Field Operations Light ที่เพิ่งทำเสร็จ

- [x] ปรับ semantic color tokens เป็น Light field palette: Navy shell, Electric Blue action, Orange accent และสีสถานะที่อ่านได้บนพื้นขาว
- [x] แก้ typography inheritance ที่ทำให้ body และ heading ตกเป็น Times New Roman ให้ใช้ system Thai sans-serif ตาม design system
- [x] ลดหัวข้อซ้ำใน App Shell โดยให้ Page Header เป็น heading หลัก และเปลี่ยน Topbar เป็น contextual header ที่กระชับ
- [x] เพิ่ม Skip to Content, visible focus token และ `aria-live` ให้สถานะการบันทึก
- [x] ปรับ Status Badge ให้แสดง icon และข้อความร่วมกับสีสำหรับปกติ/ชำรุด/รอเปลี่ยน/ยังไม่ตรวจ/ปิดรอบ/ไม่เกี่ยวข้อง
- [x] รักษา Desktop Sidebar, Mobile Bottom Navigation, safe-area และเพิ่ม label mobile เป็น 11px พร้อมไม่ให้ Toast ถูกเมนูบัง
- [x] รักษา touch target ขั้นต่ำ 44px รวมปุ่ม `+ / −`, ปุ่มหลัก และ filter select บน viewport เล็กสุด
- [x] อัปเดต `docs/design-system/checklist-operations-master.md` ให้บันทึกทิศทาง Field Operations Light และกติกา accessibility ใหม่
- [x] ผ่าน `npm.cmd run build`, `node --check app.js` และ `node --check server.mjs`
- [x] Browser smoke test ที่ 375, 768, 1024 และ 1440px ไม่พบ horizontal overflow หรือ console error
- [x] ตรวจทุก route หลัก, active navigation, `aria-current`, Skip link, h1 หลัก และ computed font หลัง reload

## งานปรับสี Sidebar ตามชุดสีที่ผู้ใช้ยืนยัน ที่เพิ่งทำเสร็จ

- [x] ปรับ Sidebar เป็น Midnight Navy + Amber + Teal โดยแยก token ของ Sidebar ออกจาก warning ที่ใช้บนพื้นขาว
- [x] ปรับ Active navigation เป็น `#182943`, accent เป็น `#F59E0B`, ข้อความรองเป็น `#A8B3C4` และการ์ดสถานะเป็น `#111B2E`
- [x] ปรับ Mobile Bottom Navigation, เส้นแบ่ง และ browser theme color ให้ใช้ชุดสีเดียวกัน
- [x] อัปเดต `docs/design-system/checklist-operations-master.md` ให้บันทึก Sidebar tokens ชุดใหม่
- [x] ผ่าน `npm.cmd run build` หลังปรับสี
- [x] ตรวจ render ที่ viewport 1280x720 และไม่พบ console error

## งานปรับสีและ UI/UX ที่รอการยืนยันจากผู้ใช้

- [ ] ผู้ใช้ตรวจสีและลำดับข้อมูลบน Chrome เครื่องจริง โดยเฉพาะการอ่านกลางแจ้ง
- [ ] ผู้ใช้ทดลอง flow สร้างสถานี → สร้างรอบ → กรอก Checklist → ปิดรอบ → พิมพ์รายงาน
- [ ] ตรวจการพิมพ์กับกระดาษ/เครื่องพิมพ์จริง และยืนยันน้ำหนักสี/ขนาดตัวอักษรที่เหมาะกับหน้างาน
- [ ] ยืนยันคำเรียกอุปกรณ์ หน่วยวัด และเกณฑ์ผ่านตัวเลขกับผู้ตรวจหน้างาน

## งานภาพแนบราย Checklist ที่เพิ่งทำเสร็จ

- [x] เพิ่ม metadata `attachment` แบบ backward-compatible ให้ทุก inspection item โดยไม่เปลี่ยน state version หรือทำให้ค่าตัวเลข/สถานะ/หมายเหตุเดิมหาย
- [x] เพิ่ม IndexedDB store `checklist-attachments-v1` สำหรับเก็บ Blob ภาพจริง และเก็บเฉพาะ metadata ใน `checklist-mvp-v1`
- [x] เพิ่มปุ่ม `แนบภาพ`, `เปลี่ยนภาพ` และ Preview พร้อมชื่อไฟล์/ขนาด; รองรับกล้องมือถือด้วย `capture="environment"`
- [x] จำกัดไฟล์ภาพเท่านั้นและขนาดไม่เกิน 10 MB; กรณีไม่ผ่านจะแจ้งเตือนโดยไม่แก้ข้อมูลรายการตรวจ
- [x] รายการ `ไม่เกี่ยวข้อง` แสดงว่าไม่ต้องแนบภาพ และรอบปิด/ประวัติแสดงภาพแบบอ่านอย่างเดียว
- [x] เพิ่ม Confirmation ก่อนลบภาพ และรักษาค่าตัวเลข สถานะ และหมายเหตุไว้เหมือนเดิม
- [x] ลบ Blob เก่าหลังเปลี่ยนภาพ และ cleanup ภาพของรอบเมื่อรีเซ็ต ลบรอบ หรือลบสถานี
- [x] เพิ่มภาพย่อใน print layout โดยซ่อนปุ่มควบคุมและไม่สร้างพื้นที่ว่างสำหรับรายการที่ไม่มีภาพ
- [x] เพิ่มคำศัพท์ `ภาพแนบหลักฐาน`, `Image metadata` และ `local-only attachment` ใน glossary

## งานภาพแนบที่รอการทดสอบ/ยืนยัน

- [ ] ทดสอบแนบภาพจริงจากกล้องมือถือและไฟล์ Desktop แล้วตรวจ Preview หลัง Reload
- [ ] ทดสอบเปลี่ยน/ลบภาพ และยืนยันว่าไฟล์เก่าถูก cleanup โดยไม่กระทบค่าตรวจ
- [ ] ทดสอบภาพของสถานี/รอบ A และ B ไม่ปะปนกัน และรอบ Closed แก้ไขหรือลบภาพไม่ได้
- [ ] ทดสอบไฟล์ไม่ใช่ภาพและไฟล์เกิน 10 MB ผ่าน Chrome เครื่องจริง
- [ ] ตรวจ print preview กับภาพหลายรายการและยืนยันการแบ่งหน้ากับกระดาษ/เครื่องพิมพ์จริง

## งานตรวจและ normalize ไฟล์แนบ BOQ ที่เพิ่งทำเสร็จ

- [x] ตรวจ mapping รายการในลิสกับไฟล์แนบครบ 13/13 รายการ
- [x] สร้างแพ็กเกจเอกสารที่ `output/pdf` โดย normalize `1.pdf` เป็น `1.1.pdf` และคงต้นฉบับบน Desktop
- [x] แก้เฉพาะหัวกระดาษในสำเนา `6.1.pdf` จาก `5.1` เป็น `6.1` และตรวจข้อความหลังแก้
- [x] เพิ่ม `docs/attachment-audit.md` และ `output/pdf/attachment-manifest.json` เพื่อแยกสถานะเอกสารแนบออกจากสถานะหลักฐานการตรวจ
- [x] เพิ่มคำศัพท์สถานะเอกสารแนบและหลักฐานการตรวจใน `docs/glossary.md`
- [x] Render และตรวจความสมบูรณ์ของ PDF ในแพ็กเกจหลังแก้ไข

## งานไฟล์แนบ BOQ ที่รอการยืนยันจากผู้ใช้

- [ ] ผู้รับผิดชอบหน้างานยืนยันช่อง `ขาด`, `ไม่ได้ติดตั้ง`, `ไม่มีรูปภาพ` และ `Server สน.` ตามสถานะจริง

## งานปรับรายงานพิมพ์ตาม BOQ ที่เปิดใช้งาน ที่เพิ่งทำเสร็จ

- [x] เพิ่มกติกา `getPrintableSectionsForSnapshot` ให้ใช้ Snapshot ของรอบเป็นแหล่งข้อมูลเดียว และเลือกเฉพาะรายการ `applicable` ที่เปิดใช้งานจริง
- [x] เพิ่ม print-only report ที่รวมทุกหมวดที่ยังมีรายการใช้งาน พร้อมตัดรายการไม่เกี่ยวข้อง/ปิดใช้งานออกจากรายงาน
- [x] คงหน้าจอ Read-only เดิมไว้สำหรับดูทีละหมวด และซ่อนเฉพาะส่วนหน้าจอเมื่อเข้าสู่ print media
- [x] ผ่าน `npm.cmd run build`, `node --check app.js` และ `node --check server.mjs`
- [x] Browser smoke test บน origin แยก: ปิด BOQ 2 รายการแล้วรายงานเหลือ 43 รายการ, ไม่แสดง `SENSOR #2` และ `วิดีโอทดสอบรถวิ่งผ่าน`, และไม่เปลี่ยนตาม Station Profile ที่แก้ภายหลัง
- [x] Unit smoke test กรณีปิดทั้งหมวด 7.1: หมวดดังกล่าวถูกตัดออก เหลือ 12 หมวด/41 รายการ
- [x] ปรับภาพแนบใน print media ให้คงสัดส่วน เห็นภาพเต็ม ไม่ครอป และไม่แก้ Blob ต้นฉบับใน IndexedDB
- [x] Print attachment smoke test บน origin แยกด้วยภาพแนวนอน 1600×900, แนวตั้ง 900×1600 และภาพยาว 700×2200; ภาพโหลดครบและสถานะพร้อมพิมพ์

## งานรายงานพิมพ์ที่รอการยืนยันจากผู้ใช้

- [ ] ผู้ใช้ตรวจ Print Preview/เครื่องพิมพ์จริง และยืนยันจำนวนหน้า การแบ่งหมวด หัวกระดาษ และภาพแนบกับกระดาษเป้าหมาย

## งานแก้ปุ่มพิมพ์ให้ใช้เทมเพลตจริงที่เพิ่งทำเสร็จ

- [x] เปลี่ยน print-only renderer จาก `ChecklistItem` แบบมี control เป็นรายการ static ตาม `ReportTemplateModel`
- [x] ซ่อนหน้าอ่านข้อมูลและ control ทั้งหมดเมื่อเข้า print media เหลือเฉพาะหัวรายงาน metadata summary หมวด BOQ และรายการตรวจ
- [x] ขยายภาพหลักฐานเป็น full-row A4 กว้างสูงสุด 170mm สูง 78mm แบบ contain/no-crop และแสดงข้อความเมื่อ Blob หาย
- [x] รอให้ภาพจาก IndexedDB โหลดเสร็จก่อนเรียก `window.print()` เพื่อไม่ให้ภาพหายหรือกลายเป็นพื้นที่ว่าง
- [x] ตรวจ origin แยกหลังแก้: print report มี 13 หมวด/45 รายการ, ไม่มี input/select/textarea ใน renderer และไม่พบ console error
- [x] ผ่าน `npm.cmd run build` และ `npm.cmd run test:report-template`

## งานปรับ Checklist ให้ตรง PDF แนบทุกช่องที่เพิ่งทำเสร็จ

- [x] เพิ่ม Evidence Catalog กลางรุ่น `checklist-master-v3-boq-evidence` ครบ 13 หมวดจาก PDF แนบ
- [x] แยกรายการตรวจกับ Evidence Slot และมี source file, source label, source order, field type และ required ทุกช่อง
- [x] ตรวจและล็อก Catalog รวม 185 รายการ/ช่องหลักฐาน: 1.1=6, 2.1=21, 2.2=6, 2.3=29, 3.1=9, 3.2=22, 4.1=31, 4.2=9, 5.1=9, 6.1=10, 6.2=12, 6.3=12, 7.1=9
- [x] คงช่อง BOQ ทั้ง 185 ช่องไว้ใน Snapshot ที่ไม่มี policy ทำความสะอาดใหม่; ช่อง Asset-dependent ที่ไม่มี Asset active เป็น `ไม่เกี่ยวข้อง` และไม่รวมใน Progress ส่วนหมวดระดับสถานี 1.1/6.1/6.2/6.3 ยังตรวจได้ตามปกติ
- [x] เพิ่มสถานะหลักฐาน `ยังไม่ระบุ`, `มีหลักฐาน/ข้อมูลครบ`, `ไม่มีรูปภาพ`, `ขาด`, `ไม่ได้ติดตั้ง`, `Server สน.`, `ไม่เกี่ยวข้อง` และนับสถานะไม่ครบแยกจากสถานะอุปกรณ์
- [x] รอบใหม่เริ่มทุกช่องเป็น `pending`; สถานะที่พบใน PDF เก็บเป็น `sourceObservedStatus` เพื่อ audit เท่านั้น ไม่เติมลงรอบใหม่
- [x] Migration รอบ draft เดิมเติม Evidence Slot ใหม่โดยคง value/status/note/attachment เดิม และผูกภาพเดิมเข้าช่องแรกที่เข้ากันได้
- [x] รอบ closed เดิมยังใช้ template/version เดิมแบบ Read-only และ Snapshot ไม่เปลี่ยนตาม Station Profile ภายหลัง
- [x] เปลี่ยน Station Checklist Configuration ให้ตั้งค่าจาก Catalog 185 ช่องจริง พร้อมรองรับ alias จากรายการ legacy ที่มีอยู่
- [x] เพิ่มหน้าจอ Evidence Slot ซ้อนใต้รายการตรวจ: ประเภท, สถานะ, หมายเหตุ, แนบภาพ/วิดีโอ/เอกสาร และ Preview แยกต่อช่อง
- [x] เพิ่มตัวกรองสถานะหลักฐานและสรุปจำนวน `หลักฐานครบ` / `หลักฐานไม่ครบ` ระดับรอบและระดับหมวด
- [x] ปิดรอบได้หลังยืนยันคำเตือน โดยเตือนรายการตรวจที่ค้างและ Evidence Slot ที่ยังไม่ครบแยกกัน
- [x] รายงาน/Print แสดงทุก Evidence Slot ของรายการที่เปิดใช้งาน พร้อมป้าย `ไม่มีรูปภาพ`, `ขาด`, `ไม่ได้ติดตั้ง`, `Server สน.` แทนพื้นที่ว่าง
- [x] ขยาย cleanup attachment ให้ค้นทั้ง attachment เดิมและ attachment ใน Evidence Slot โดยลบ ID ซ้ำเพียงครั้งเดียว
- [x] เพิ่ม `test:evidence-checklist`, `test:evidence-catalog` และตรวจ manifest/package PDF พร้อม render PDF ทั้ง 13 ไฟล์
- [x] ผ่าน `npm.cmd run build`, `npm.cmd run test:evidence-checklist`, `npm.cmd run test:evidence-catalog` และ `npm.cmd run test:report-template`

## งานทดสอบการสร้างสถานีใหม่และการโหลดหมวด BOQ ที่เพิ่งทำเสร็จ

- [x] แยกหน่วยนับชัดเจน: Asset จริงใน Station Profile, แม่แบบ Configuration 13 หมวด/45 รายการ และ Evidence Catalog 13 หมวด/185 ช่อง
- [x] เพิ่ม `npm.cmd run test:station-creation` ตรวจสถานีใหม่เริ่ม 0 ทุกประเภท, การเพิ่ม/ลดเฉพาะประเภท, Asset No. prefix, mapping หมวด และ Snapshot isolation
- [x] ยืนยัน Preview กับ Snapshot ของ legacy v3 ใช้ `checklist-master-v3-boq-evidence` เดียวกัน และเก็บ Evidence Catalog เดิมเมื่อไม่มี policy ทำความสะอาดใหม่
- [x] ใช้กติกา Asset-dependent: สถานีว่างมี 40 ช่องระดับสถานีที่ต้องตรวจจริง และ 145 ช่อง `ไม่เกี่ยวข้อง` ที่ไม่รวมใน Progress/ยอดหลักฐาน
- [x] Browser smoke บน `http://127.0.0.1:5181` ซึ่งเป็น origin แยก: สถานีใหม่เริ่ม 0, เพิ่มครบ 13 ประเภทได้ prefix ถูก, ลด WIM Sensor ไม่เปลี่ยนอีก 12 ประเภท, Preview 12 Asset/126 ใช้ตรวจ/59 ไม่เกี่ยวข้อง และหลังสร้าง Snapshot ได้ 126 รายการ/126 ช่องหลักฐานตรงกัน
- [x] ตรวจ Browser console ไม่พบ error/warning และตรวจ PDF ด้วย `pdfinfo`/`pdftoppm` ครบ 13 ไฟล์ พร้อมดูภาพ render ตัวอย่าง 2.1, 4.1 และ 7.1

หมายเหตุ: งานชุดนี้ supersede การนับ 45 รายการของ template เดิมสำหรับรอบใหม่แล้ว; ตัวเลข 45/43 ที่อยู่ในบันทึกงานก่อนหน้าเป็นหลักฐานของรุ่น legacy และยังคงอ่านได้สำหรับประวัติเดิม

## งาน Evidence Catalog ที่รอการยืนยันจากผู้ใช้

- [ ] ผู้รับผิดชอบหน้างานยืนยันชื่อช่อง/ลำดับ/หน่วยวัดของทั้ง 13 PDF กับแบบฟอร์มที่ใช้งานจริง
- [ ] ผู้ใช้ทดลองตั้งสถานีที่มี Asset แต่ระบุหน้างานว่า `ไม่ได้ติดตั้ง` แล้วตรวจสถานะและยอดหลักฐาน
- [ ] ผู้ใช้ทดลองกรอก `ไม่มีรูปภาพ`, `ขาด` และ `Server สน.` แล้วตรวจตัวเลขในหน้า Checklist และรายงาน
- [ ] ผู้ใช้ตรวจ Print Preview/เครื่องพิมพ์จริงกับจำนวนช่องหลักฐานและการแบ่งหน้ากระดาษ

## งานสร้าง PDF Template แยกจากระบบที่เพิ่งทำเสร็จ

- [x] เพิ่ม `ReportTemplateModel` กลางจาก Inspection Snapshot โดยไม่อ่าน Station Profile ปัจจุบัน และตัดรายการ `applicable === false`
- [x] เพิ่ม manifest `checklist-report-a4-portrait-v1` ระบุ field, section/item repeater, image slot แบบ full-row, contain และ no-crop
- [x] เพิ่ม generator แยกใน `tools/pdf` และสร้าง `output/pdf/checklist-report-template.pdf` ขนาด A4 แนวตั้ง 5 หน้า
- [x] เพิ่มตัวอย่าง layout ที่ตรวจภาพแนวนอน ภาพแนวตั้ง รายการไม่มีภาพ และการแบ่งหน้าโดยไม่ทับซ้อน
- [x] เพิ่ม smoke test ของ model และ PDF verifier ตรวจ static PDF, marker ของภาพ, BOQ และ manifest
- [ ] นำ `ReportTemplateModel` ไปเชื่อมกับ live PDF renderer ที่ดึง Blob จาก IndexedDB หรือ export package
- [ ] สร้าง PowerPoint renderer จาก model กลางในเฟสถัดไป

## งาน MVP แก้ข้อความ Checklist จากหน้าเว็บที่เพิ่งทำเสร็จ

- [x] เพิ่มแผง `ข้อความ Checklist กลาง` ในหน้า `สถานีและอุปกรณ์` โดยไม่เพิ่มหน้า Admin/Login/Backend
- [x] เพิ่มตัวแก้ข้อความแยก 2 กลุ่ม: ตรวจจริง 13 หมวด/185 รายการ และแม่แบบสถานี 13 หมวด/45 รายการ
- [x] แก้ชื่อหมวด ชื่อรายการ หน่วย และคำอธิบาย พร้อมค้นหาและคืนค่าเริ่มต้น
- [x] บันทึก copy กลางอัตโนมัติใน localStorage ของ browser และส่ง copy ล่าสุดเข้า Snapshot รอบใหม่
- [x] คง Snapshot เก่า/draft เดิม, technical IDs, sourceLabel, จำนวนรายการ และ Asset mapping
- [x] เพิ่ม migration state version 8 และ regression tests ของ copy ทั้งสองชั้น
- [x] ผ่าน build และ smoke tests ของ Checklist, Station creation, Evidence Catalog และ Report Template

## งาน MVP แก้ข้อความที่รอการยืนยันจากผู้ใช้

- [ ] ผู้ใช้ทดลองแก้ข้อความจากหน้า `สถานีและอุปกรณ์` แล้วสร้างรอบใหม่เพื่อตรวจข้อความบนหน้า Checklist และรายงาน
- [ ] ผู้ใช้ยืนยันว่าข้อความที่แก้ใน browser เครื่องหนึ่งไม่จำเป็นต้องแชร์ไปเครื่องอื่นในเฟส MVP

## งาน Redesign UX ฟอร์มตรวจหน้างาน (2 กันยายน 2569)

### งานที่เพิ่งทำเสร็จ

- [x] ปรับ `ChecklistItem` เป็นการ์ดทีละรายการ โดยตัด status badge ที่ซ้ำกับ control ออก
- [x] เพิ่ม `fieldset` สถานะหลัก 4 ตัวเลือก และย้าย `ไม่ได้ติดตั้ง` / `ไม่เกี่ยวข้อง` ไปไว้ในสถานะเพิ่มเติม โดยคงค่า technical status เดิม
- [x] ซ่อนหมายเหตุหลัง `+ เพิ่มหมายเหตุ` และเปิดอัตโนมัติเมื่อเลือก `ชำรุด` หรือ `กำลังรอเปลี่ยน`
- [x] เปลี่ยน Evidence Slot เป็น disclosure ปิดเริ่มต้น แสดงจำนวนครบ/ทั้งหมด ป้าย `จำเป็น` และปุ่ม `ถ่ายภาพ / แนบไฟล์`
- [x] คงสถานะหลักฐานเดิมทั้งหมด, การอัปโหลดที่เปลี่ยนเป็น `complete`, Preview และ delete confirmation เดิม
- [x] ปรับตัวกรองให้ค้นหาเห็นตลอดเวลา และยุบ status/evidence filter ไว้ใน `ตัวกรองเพิ่มเติม`
- [x] เพิ่ม `ก่อนหน้า` / `ถัดไป` สำหรับผลลัพธ์ที่กรอง พร้อมเลื่อนข้ามหมวดและย้าย focus ไปหัวข้อรายการ
- [x] คง sticky หมวดบน desktop, one-column/mobile layout, 44px touch target, visible focus, `aria-expanded`, `aria-describedby`, `aria-live` และ reduced-motion
- [x] ไม่เปลี่ยน public API, schema, localStorage key, attachment model หรือ Snapshot/history isolation
- [x] ตรวจ active draft บน browser: เลือก `ชำรุด` เปิดหมายเหตุอัตโนมัติ, เปิด Evidence disclosure และกด `ถัดไป` ย้าย focus ไปข้อถัดไปสำเร็จ
- [x] ลบรอบทดสอบที่สร้างขึ้นเองหลังตรวจเสร็จ ข้อมูลเดิมจึงไม่ถูกทิ้งค้างไว้
- [x] ผ่าน `npm.cmd run build`, `npm.cmd run test:report-template`, `npm.cmd run test:evidence-checklist`, `npm.cmd run test:evidence-catalog` และ `npm.cmd run test:station-creation`

### งานที่ยังค้าง / ยังต้องยืนยัน

- [ ] ตรวจ viewport 375, 768, 1024 และ 1440px แบบเป็นชุด พร้อมยืนยัน no horizontal overflow ใน environment ของผู้ใช้
- [ ] ทดสอบแนบภาพ/วิดีโอ/เอกสารจริง, เปลี่ยนไฟล์, ลบไฟล์, Preview และ autosave บนอุปกรณ์หน้างานจริง
- [ ] ทดสอบรอบ active draft, สถานะ `ไม่มีรูปภาพ` / `ขาด` / `ไม่ได้ติดตั้ง` / `Server สน.` / `ไม่เกี่ยวข้อง` และตรวจยอดในรายงานกับผู้ใช้หน้างาน
- [ ] ตรวจ keyboard tab order และ screen reader บนอุปกรณ์/บราวเซอร์ที่ใช้งานจริง รวมถึง zoom/reflow และ sticky navigation ไม่บัง focus
- [ ] ยืนยัน read-only round และรายงานเดิมหลัง UAT ว่า Snapshot/history ไม่เปลี่ยนข้อมูลเก่า

## งานแก้ไขย้อนหลังรอบที่ปิดแล้ว (legacy, 2 กันยายน 2569)

> หมายเหตุ: รายการนี้เป็นหลักฐานของ flow เดิมและ helper สำหรับ migration เท่านั้น; UI ปัจจุบัน supersede ด้วย `สร้างฉบับแก้ไข` ที่ clone เป็นรอบใหม่และไม่เขียนทับประวัติ

### งานที่เพิ่งทำเสร็จ

- [x] เพิ่ม `correctionHistory` และ migration state version 8 → 9 โดยรอบเก่ายังเปิดอ่านได้
- [x] เพิ่ม helper สำหรับ clone working copy, ตรวจความเปลี่ยนแปลง, ตรวจเหตุผล 1–500 ตัวอักษร และ append correction log
- [x] เพิ่ม route `#/history/:roundId?edit=1` พร้อมโหมด `แก้ไขย้อนหลัง`, `ยกเลิกการแก้ไข` และ `บันทึกการแก้ไขและปิดรอบ`
- [x] อนุญาตแก้ผลตรวจ ค่า สถานะ หมายเหตุ หลักฐานแนบ และข้อมูลหัวรอบ โดยล็อก Snapshot ชื่อ/รหัสสถานี และรายการอุปกรณ์เดิม
- [x] คง `closedAt` เดิม แยก `updatedAt`/`editedAt` และแสดงจำนวนครั้ง เวลา เหตุผลล่าสุด และป้ายแก้ย้อนหลังในประวัติ/รายงาน
- [x] ไม่สร้าง correction log เมื่อไม่มีการเปลี่ยนข้อมูล และรองรับการแก้หลายครั้งในรอบเดิม
- [x] เพิ่ม staging attachment ใน IndexedDB: ไฟล์ใหม่ทิ้งเมื่อยกเลิก และไฟล์เดิมลบหลัง commit สำเร็จ
- [x] ซิงก์ compatibility aliases หลังบันทึก เพื่อไม่ให้ client รุ่นเก่าเห็นประวัติที่ล้าสมัย
- [x] ผ่าน unit smoke `test:history-edit` และชุดเดิมทั้งหมด รวมถึง build
- [x] Browser smoke: ปิดรอบ → เปิดโหมดแก้ไข → แก้สถานะ/ข้อมูลหัวรอบ → ตรวจเหตุผลบังคับ → บันทึก → เห็น correction metadata

### งานที่ยังค้าง / ยังต้องยืนยัน

- [ ] ผู้ใช้ยืนยัน policy ว่าค่าก่อนแก้ถูกเขียนทับและกู้คืนไม่ได้ตามขอบเขต Local-first MVP
- [ ] ทดสอบไฟล์แนบจริงครบกรณีเพิ่ม/ลบ/เปลี่ยน/ยกเลิก/commit บนอุปกรณ์หน้างานจริง
- [ ] ตรวจ responsive/accessibility ที่ 375, 768, 1024 และ 1440px บน browser/device ที่ใช้งานจริง
- [ ] ยืนยัน UAT เรื่อง Snapshot, สถานี และรายการอุปกรณ์เดิมยังเป็น Read-only และไม่มี server-side audit log ในเฟสนี้

## งาน implement Flow ใหม่ Checklist MVP (3 กันยายน 2569)

### งานที่เพิ่งทำเสร็จ

- [x] อัปเดต route map/component map/ADR ให้ล็อกขอบเขตเครื่องเดียว ไม่มี Backend/Auth/Reviewer/Approval และแยกทะเบียนสถานีออกจากข้อความ Checklist กลาง
- [x] เพิ่ม route `#/stations/:stationId`, `#/settings/checklist-copy` และ `#/history/:roundId/revise` พร้อม primary-route mapping; ลิงก์ legacy `?edit=1` redirect ไป Revision flow
- [x] ปรับ `#/stations` เป็น Station Directory และเปลี่ยนสถานีที่มีประวัติจาก hard-delete เป็น `active: false` ปิดใช้งาน/เปิดใช้งาน โดยคงรอบและไฟล์เดิม
- [x] ปรับ `#/inspections` ให้แสดงเฉพาะ draft และทำ `#/inspections/new` เป็น Wizard 3 ขั้น metadata → Snapshot → ยืนยันสร้าง draft
- [x] ปรับหน้า Checklist ให้แสดงทีละรายการ มีหมวด desktop/mobile picker, sticky pager และย้าย `ล้างค่ารอบนี้` ไปเมนูรอง
- [x] เพิ่ม domain helper `getCloseReadiness(round)` และ UI close-readiness summary: `ยังไม่ระบุ`/`ไม่มีรูปภาพ`/`ขาด` แสดงเป็นรายการค้างพร้อมคำเตือนก่อนปิด, `ไม่ได้ติดตั้ง`/`Server สน.` ต้องมีหมายเหตุ, `ชำรุด`/`กำลังรอเปลี่ยน` เป็น follow-up
- [x] เพิ่ม `createRevisionRound` และหน้า Revision ที่ clone Snapshot/ผลตรวจไป draft ใหม่ เก็บเหตุผล/metadata และไม่แก้รอบเดิม; History ไม่ส่งปุ่มลบหรือ overwrite
- [x] ป้องกันการลบไฟล์หลักฐานที่ Revision อ้างอิงร่วมกับรอบต้นฉบับ และคง cleanup เฉพาะไฟล์ใหม่ของ draft
- [x] เพิ่ม CSS สำหรับ close gate, revision banner, station directory, mobile navigation และ touch target/focus states; numeric field ใช้ `inputmode="numeric"`
- [x] เพิ่ม `test:flow-redesign` ครอบคลุม route, close-readiness, revision immutability และ migration version 12; อัปเดต regression tests เดิมเป็น version 12

### ผลตรวจ Local/Test ที่พิสูจน์แล้ว

- [x] `npm.cmd run build`
- [x] `npm.cmd run test:flow-redesign`
- [x] `npm.cmd run test:station-creation`
- [x] `npm.cmd run test:history-edit` (legacy helper compatibility)
- [x] `npm.cmd run test:evidence-checklist`, `test:evidence-catalog`, `test:report-template`
- [x] Browser smoke ก่อนเปลี่ยนเป็น evidence template v4: ปิดรอบที่ยังมีข้อมูลค้างผ่านคำเตือน, เปิด History แบบ Read-only, บังคับเหตุผลสร้าง Revision และปิดฉบับแก้ไขได้โดยไม่เขียนทับรอบต้นฉบับ

### งานที่ยังค้าง / ยังไม่พิสูจน์

- [ ] Browser smoke แบบครบทุก routeหลัง migration รวม browser back/deep link/legacy redirect ในข้อมูลของผู้ใช้
- [ ] ตรวจ viewport 375, 768, 1024, 1440px และ no horizontal overflow/sticky footer ไม่บัง focus บนอุปกรณ์จริง
- [ ] ทดสอบ attachment ของ Revision: Preview/Reload/เปลี่ยน/ลบ/Reset โดยยืนยันว่ารอบต้นฉบับยังเปิดไฟล์ได้
- [ ] ผู้ใช้หน้างานยืนยัน close policy ของทุกสถานะและข้อความ Checklist กลางกับเอกสารจริง
- [ ] Field/UAT, real-device, deployment, security, multi-user/backend และ Production proof ยังอยู่นอกหลักฐาน Local/Test ของเฟสนี้

## งาน Redesign Flow เลือกอุปกรณ์แบบ Guided Rail (4 กันยายน 2569)

### งานที่เพิ่งทำเสร็จ

- [x] เปลี่ยน Step 2 ของ Wizard สร้างสถานีเป็น 4 ขั้นย่อย: เลือกหมวด BOQ → เลือกชนิดและจำนวน → กรอกรายละเอียด Asset → ตรวจสอบอุปกรณ์
- [x] เพิ่ม `Equipment Selection Summary` แบบ sticky บน desktop และ compact sticky ด้านล่างบน mobile โดยนับเฉพาะ Asset ที่ `active !== false`
- [x] แยกตัวเลข `อุปกรณ์จริงในร่าง`, `หมวดที่มีอุปกรณ์`, `ข้อมูลยังไม่ครบ` และ `Lane topology` ให้เห็นพร้อมกัน โดยระบุชัดว่า Lane ไม่ใช่ Asset และไม่นับ Checklist/evidence รวมกับ Asset
- [x] เพิ่มการเพิ่ม/ลดจำนวนแบบทันที พร้อม accessible label ภาษาไทยและ `aria-live` ประกาศผลหลังเพิ่ม/ลด
- [x] คง handler/state/validation เดิมของ draft และไม่เปลี่ยน route, API, schema, technical ID, `catalogItemId`, mapping, Snapshot หรือ history
- [x] Step 3 แสดง `อิงจาก Asset จริง` และ Step 4 แยกกลุ่ม Station, Asset, Lane, Checklist, incomplete data และ Custom Asset mapping warning
- [x] ปรับ visual ให้ตรง visual direction 1: vertical Guided Rail บน desktop, summary rail ด้านขวา, summary แบบ bottom bar บน mobile และ responsive stack ที่ 1024px
- [x] อัปเดต `design-qa.md` พร้อม comparison history และผล `final result: passed`

### ผลตรวจ Local/Test และ Browser ที่พิสูจน์แล้ว

- [x] `npm.cmd run test:station-creation` ผ่าน: empty station active assets 0, applicable 15, not-applicable 85
- [x] `npm.cmd run test:item-library` ผ่าน: system items 12, categories 8, custom snapshot asset และ migration
- [x] `npm.cmd run test:imps-purge` ผ่าน: ลบ standalone ImPS จากข้อมูลปัจจุบัน/ประวัติและตรวจ idempotence; คง WIM `for IMPS` source label
- [x] `npm.cmd run test:flow-redesign` ผ่าน
- [x] `npm.cmd run test:station-lifecycle` ผ่าน: Custom asset, Snapshot reference และ attachment lifecycle
- [x] `npm.cmd run build` ผ่าน; เหลือเพียงคำเตือน bundle เดิมว่า chunk หลักเกิน 500 kB
- [x] Browser Local/Test ตรวจเพิ่ม/ลดซ้ำ, เปลี่ยนหมวดโดยรายการเดิมไม่หาย, duplicate Asset No. พร้อม focus ไป error แรก, mobile `aria-live`, Lane ไม่ถูกรวมใน Asset count และ Step 3/4 summary
- [x] Responsive computed check ที่ 375, 768, 1024 และ 1440px ไม่พบ horizontal overflow; Noto Sans Thai โหลดสำเร็จ

### งานที่ยังค้าง / ยังไม่พิสูจน์

- [ ] ผู้ใช้หน้างานยืนยันลำดับข้อมูล, ถ้อยคำ และขนาดบนอุปกรณ์จริง
- [ ] Keyboard/screen reader แบบ field/UAT, touch จริง, real data, deployment, security, multi-user/backend และ Production proof ยังอยู่นอกหลักฐาน Local/Test

## งานปรับ UX การตรวจ Checklist และสถานะด้วยไอคอน (3 กันยายน 2569)

### งานที่เพิ่งทำเสร็จ

- [x] เพิ่ม Quick Status summary ที่แสดงไอคอน สี จำนวน และสถานะตรวจแล้ว พร้อมกดกรองรายการตามสถานะได้ทันที
- [x] แสดงตัวเลือกสถานะรายการทั้ง 6 ค่าเป็นปุ่มแบบ icon-first ในชุดเดียว ลดการเปิดเมนูและช่วยให้แยกสถานะได้จากภาพ
- [x] เพิ่มตัวเลือกสถานะหลักฐานแบบ icon-first และฟิลเตอร์ `ยังไม่ครบ` สำหรับไล่เก็บหลักฐานค้าง
- [x] เพิ่ม smart auto-next: เลือก `ปกติ`/`ไม่เกี่ยวข้อง` จะไปข้อถัดไปเมื่อไม่มีหลักฐานจำเป็นค้าง; ถ้ามีจะเปิดและโฟกัสหลักฐานที่ต้องตรวจ
- [x] เมื่อเลือก `ชำรุด`/`กำลังรอเปลี่ยน`/`ไม่ได้ติดตั้ง` ระบบเปิดและโฟกัสช่องหมายเหตุให้กรอกเหตุผลต่อทันที
- [x] ปรับ responsive layout ให้ Checklist และสถานะหลักฐานใช้พื้นที่เต็มบนหน้าจอแท็บเล็ต ลดการบีบคอลัมน์และคงความกว้างกรอกที่อ่านง่าย
- [x] ปรับคำบน UI ให้เป็นภาษากลางของผลตรวจ (`ผ่าน / ปกติ`, `พบปัญหา`, `รอแก้ไข`) และขยายคำสถานะหลักฐาน (`หลักฐานครบ`, `หลักฐานขาด`, `อยู่ที่ Server สถานี`) โดยไม่เปลี่ยนค่า status/id หรือข้อความอ้างอิงในรายงาน
- [x] ตรวจคำในปุ่มเลือก, Quick Status, ตัวกรอง และ legend ให้ใช้ชุดคำเดียวกัน เพื่อไม่ให้คำเรียกสถานะแตกต่างกันในหน้าเดียว

### ผลตรวจ Local/Test และ Browser ที่พิสูจน์แล้ว

- [x] `npm.cmd run build`
- [x] `npm.cmd run test:flow-redesign`
- [x] `npm.cmd run test:evidence-checklist`
- [x] `npm.cmd run test:evidence-catalog`
- [ ] `npm.cmd run test:report-template` — มี assertion เดิมเรื่อง legacy report template คาด 42 รายการ แต่ fixture ปัจจุบันได้ 43 รายการ (`43 !== 42`); ไม่ได้แตะ report/domain ในงาน UI นี้
- [x] Browser Local/Test: เลือก `ชำรุด` แล้วโฟกัส `หมายเหตุ`; เลือก `ปกติ` แล้วเปิดและโฟกัสหลักฐานที่จำเป็น; กรองสถานะ `ชำรุด` เหลือรายการตรงเป้าหมาย
- [x] Browser Local/Test: viewport 807px ไม่พบ horizontal overflow และแถบสรุป/ชุดปุ่มสถานะอ่านและกดได้ชัดเจน

### งานที่ยังค้าง / ยังไม่พิสูจน์

- [ ] Visual QA แบบครบทุก route ที่ viewport 375, 768, 1024 และ 1440px บนเครื่องจริง
- [ ] ผู้ใช้หน้างานยืนยันความเข้าใจไอคอน สี และลำดับ auto-next บนอุปกรณ์จริง
- [ ] Field/UAT, real-device, deployment, security, multi-user/backend และ Production proof ยังอยู่นอกหลักฐาน Local/Test ของงานนี้

## งานปรับ Checklist ทำความสะอาดอุปกรณ์ต่อ Asset (3 กันยายน 2569)

### งานที่เพิ่งทำเสร็จ

- [x] เพิ่ม `CLEANING_POLICY_VERSION`, `CLEANING_TARGET_TYPES`, `CLEANING_STAGE_DEFINITIONS`, `buildCleaningEvidenceItems(snapshot)` และ `isCleaningEvidenceComplete(slot, evidence)` ใน domain evidence
- [x] ให้ Snapshot รอบใหม่ใช้ `equipment-cleaning-v1` และสร้างรายการทำความสะอาด 1 รายการต่อ Asset ที่ active สำหรับ Computer, ตู้ควบคุม, LPR, Fixed/PTZ, NVR และ Database Server
- [x] บังคับ Evidence Slot ต่อ Asset เรียง `before` → `during` → `after` โดยแต่ละช่วงเป็นภาพ 1 ไฟล์ เปลี่ยน/ลบได้ และใช้ Asset ID, Asset No., ตำแหน่ง และ Serial Number จาก Snapshot
- [x] ตัดช่องทำความสะอาดแบบรวม/ซ้ำ รวมถึงห้องควบคุม รอบตู้ และ VMS ออกจากเป้าหมายของ policy ใหม่ โดยไม่แก้ catalog/ข้อมูลของ Snapshot เดิมที่ไม่มี policy
- [x] รวมกติกา attachment จริงเข้ากับ Evidence Summary, section stats, close-readiness และปุ่มปิดรอบ; สถานะ `complete` อย่างเดียวไม่ผ่าน และ `Server สน.`/`ไม่ได้ติดตั้ง` ไม่ข้ามการบังคับภาพ
- [x] เพิ่ม metadata cleaning stage/Asset ใน report model และให้รายงานแสดงชื่อ Asset พร้อมภาพทั้ง 3 ช่วง
- [x] เพิ่ม `test:equipment-cleaning` ครอบคลุม Asset เป้าหมาย, inactive/out-of-scope, ลำดับช่อง, old v3 compatibility, close gate, remove photo และ report model
- [x] ผ่าน regression tests ที่เกี่ยวข้องและปรับ storage migration เป็น version 12 แบบ additive

### ผลตรวจ Local/Test ที่พิสูจน์แล้ว

- [x] Default sample: 11 Asset เป้าหมาย และ 33 ช่องภาพทำความสะอาดบังคับ
- [x] `npm.cmd run test:equipment-cleaning`
- [x] `npm.cmd run test:evidence-checklist`
- [x] `npm.cmd run test:station-creation`
- [x] `npm.cmd run test:flow-redesign`
- [x] `npm.cmd run test:history-edit`
- [x] `npm.cmd run test:report-template`
- [x] `npm.cmd run test:evidence-catalog`
- [x] `npm.cmd run build` และ browser smoke ของ policy บน evidence template v4: Snapshot Preview แสดง 157 ช่อง catalog / 125 รายการใช้ตรวจจริง, PC-01 แสดง Before → During → After, close gate บล็อกเมื่อไม่มีภาพ, mobile 375px ไม่มี horizontal overflow, console errors = 0

### งานที่ยังค้าง / ยังไม่พิสูจน์

- [ ] ตรวจ browser smoke แบบแนบไฟล์ภาพจริงครบทุก Asset เป้าหมาย แล้วเปิดทุก Asset ยืนยัน upload/replace/remove ภาพก่อน–ระหว่าง–หลังบน desktop และ mobile
- [ ] ตรวจ print media/report จริงว่าภาพทั้งสามช่วงโหลดจาก IndexedDB ครบและไม่ล้นหน้ากระดาษ
- [ ] ผู้ใช้หน้างานยืนยันว่า scope Asset และคำอธิบายภาพตรงกับเอกสาร/วิธีปฏิบัติจริง
- [ ] Field/UAT, real-device, deployment, security, multi-user/backend และ Production proof ยังอยู่นอกหลักฐาน Local/Test ของเฟสนี้

## งานแก้ Mapping และชื่ออุปกรณ์/รายการซ้ำ (3 กันยายน 2569)

### งานที่เพิ่งทำเสร็จ

- [x] เพิ่ม `checklist-master-v4-asset-mapped` สำหรับรอบใหม่ และคง `checklist-master-v3-boq-evidence` สำหรับ Snapshot/ประวัติเดิม
- [x] แก้ 2.1 Sensor ให้ใช้ลำดับ WIM Sensor ที่ active ในทะเบียนแบบ global: Asset ตัวที่ 1–12 ผูกกับ `SENSOR #1–#12` คนละ `assetId` และ Asset เกิน 12 ต่อเป็น `SENSOR #13` เป็นต้น
- [x] รอบใหม่ไม่สร้างช่องวัด Sensor ที่ไม่มี Asset จริง และไม่สร้าง `additional-asset` สำหรับ Sensor 1–12; รอบเก่าคง mapping วน Sensor 1–3 และช่อง PDF เดิม
- [x] แก้ 3.2 LPR Lane ให้ Lane 1/2/3 ผูกกับ `LPR-01/LPR-02/LPR-03` ตามลำดับ Asset
- [x] แยก `displayLabel` ของรายการที่ข้อความซ้ำในหมวดเดียวกัน โดยคง `sourceLabel`, source order, item ID และ slot ID เดิม เช่น AC/DC, Network, LPR cleaning, Database cleaning และ VMS cleaning
- [x] เพิ่ม migration ของ global Checklist copy เฉพาะ label/slot ที่ยังเป็นค่า default เดิม และไม่เขียนทับชื่อที่ผู้ใช้แก้เอง; ไม่ reset หรือลบ LocalStorage และไม่แก้ per-round Snapshot copy
- [x] ตรวจ duplicate แยกเป็น label / item ID / evidence slot ID: template ปัจจุบันไม่พบ ID หรือ slot ID ซ้ำ และไม่พบ display label ซ้ำภายในหมวด

### ผลตรวจ Local/Test ที่พิสูจน์แล้ว

- [x] Sensor จำนวน 0, 3, 12 และ 13: ได้รายการตามจำนวน Asset จริง, Asset ID ไม่ซ้ำ, Sensor #13 เป็นรายการต่อจากลำดับ 12
- [x] รอบใหม่ default: 2.1 มี Sensor จริง 3 รายการและไม่มีช่อง Sensor ว่าง; รอบที่มี 12 Sensor ได้ 12 รายการโดยไม่มี Sensor `additional-asset`
- [x] LPR Lane 1–3 ผูก Asset คนละตัวตามทะเบียน
- [x] Snapshot legacy v3 คง mapping/label/catalog แบบเดิม และการ migrate draft v2 ไป v4 ยังทำงาน
- [x] ผ่าน `npm.cmd run test:evidence-checklist`, `test:evidence-catalog`, `test:station-creation`, `test:equipment-cleaning`, `test:history-edit`, `test:report-template`, `test:flow-redesign` และ `npm.cmd run build`

### งานที่ยังค้าง / ยังไม่พิสูจน์

- [ ] Browser smoke รอบใหม่บนข้อมูลจริงของผู้ใช้: ยืนยันจำนวน Sensor, Asset No., ตำแหน่ง และ Serial Number ในหน้า 2.1/3.2 หลัง migration
- [ ] ผู้ใช้หน้างานยืนยันชื่อ display label ที่แยกเพิ่มและยืนยันว่า source label จาก PDF ยังใช้เป็นหลักฐานอ้างอิงได้
- [ ] Field/UAT, real-device, deployment, security, multi-user/backend และ Production proof ยังอยู่นอกหลักฐาน Local/Test ของงานนี้

## งานคลังไอเทมกลางสำหรับสร้างสถานี (3 กันยายน 2569)

### งานที่เพิ่งทำเสร็จ

- [x] เพิ่ม `itemCatalog` แบบ Local-first พร้อม migration additive จาก state version 11 เป็น 12 และ seed system catalog จาก `EQUIPMENT_TYPES`/mapping เดิม โดยใช้เฉพาะ 9 หมวด BOQ ที่รองรับ Asset
- [x] เพิ่มหน้า `#/settings/item-library` สำหรับค้นหา/กรองตามหมวด เพิ่ม Custom Item และซ่อน/แสดงรายการ โดยล็อก `categoryCode` และป้องกันการแก้ system type/mapping
- [x] แยกแม่แบบ catalog ออกจาก Asset instance: เพิ่มซ้ำได้คนละ Asset `id` แต่ใช้ `catalogItemId` เดียวกัน พร้อมคงกติกา Asset No., ตำแหน่งติดตั้ง และ Serial Number
- [x] เปลี่ยน Wizard สร้างสถานีใหม่เป็น Item Composer: desktop ลากลง drop zone ตามหมวด, ทุกไอเทมมีปุ่ม “เพิ่มเข้าสถานี” สำหรับ mobile/keyboard, และ drop ผิดหมวดไม่ถูกเพิ่ม
- [x] Custom Asset ถูกเก็บใน Station Profile/Snapshot พร้อมคำเตือนว่า “ยังไม่มีรายการตรวจผูก” และไม่สร้าง Checklist/Evidence mapping
- [x] คง Snapshot/history เดิมโดย migration ไม่ rewrite Snapshot ของรอบปิด; เพิ่ม regression assertion สำหรับ historical Snapshot immutability

### ผลตรวจ Local/Test และ Browser ที่พิสูจน์แล้ว

- [x] `npm.cmd run test:item-library` ครอบคลุม system 13 รายการ, 9 หมวด, Custom, เพิ่มซ้ำ, locked category, ซ่อนรายการ, Snapshot และ no Checklist mapping
- [x] ผ่าน `test:history-edit`, `test:equipment-cleaning`, `test:station-creation`, `test:flow-redesign`, `test:evidence-checklist`, `test:evidence-catalog`, `test:report-template` และ `npm.cmd run build`
- [x] Browser smoke ใน isolated local origin: เพิ่ม Custom, เพิ่ม system/Custom Asset ใน Wizard, เพิ่มซ้ำ, validation Asset No. ซ้ำ, แสดงคำเตือน Custom ใน Step 4, ยกเลิก Wizard แบบมีข้อมูลค้าง และซ่อน/แสดงไอเทม
- [x] ตรวจ responsive width 375/768/1024/1440px แล้วไม่พบ horizontal overflow; browser screenshot ตรวจภาพรวมหน้า Item Library

### งานที่ยังค้าง / ยังไม่พิสูจน์

- [ ] ทดสอบ drag/drop ด้วยเมาส์จริงบนเครื่องหน้างานเพิ่มเติม รวม touch/keyboard จริงและ focus หลัง drop
- [ ] ผู้ใช้หน้างานยืนยันชื่อ Custom, หมวด BOQ, Prefix และ policy การซ่อนไอเทมกับข้อมูลจริง
- [ ] Field/UAT, real-device, deployment, security, multi-user/backend และ Production proof ยังอยู่นอกหลักฐาน Local/Test ของงานนี้

## งาน Design System / UIUX v2 ทั้งระบบ (3 กันยายน 2569)

### งานที่เพิ่งทำเสร็จ

- [x] ปรับ `DESIGN.md` เป็น version 2.0 และกำหนด Information Architecture/รูปแบบหน้าจอสำหรับ Overview, Stations, Assets, Inspection, History และ Create flows
- [x] เปลี่ยน visual language เป็น White Canvas: rail/navigation สีขาว, mist-gray canvas, deep ink typography, blue action และ semantic status colors
- [x] ปรับ tokens ใน `src/styles/tokens.css` ให้เป็น source of truth ชุดใหม่สำหรับสี, border, focus ring, radius, shadow และ motion
- [x] ปรับ `src/styles/foundation.css` ทั้งระบบให้ใช้ spacing, card, button, input, status, checklist, evidence, dialog, toast และ responsive rules ชุดเดียวกัน
- [x] รักษา Thai-first typography, touch target, keyboard focus, Snapshot/history isolation และ data model เดิม

### ผลตรวจ Local/Test และ Browser ที่พิสูจน์แล้ว

- [x] `npm.cmd run test:station-creation`
- [x] `npm.cmd run test:flow-redesign`
- [x] `npm.cmd run test:station-lifecycle`
- [x] `npm.cmd run build`
- [x] Browser screenshot หลังเปลี่ยน v2: white navigation rail, white panels, blue CTA และ Noto Sans Thai ถูกโหลด
- [x] ตรวจ computed styles และ horizontal overflow ที่ viewport 1280px: `horizontalOverflow: false`
- [x] ตรวจภาพจริงของ Dashboard, Stations, New Station, Inspections, Checklist Workspace, History, Item Library และ Station Detail; ทุกหน้าสืบทอด visual language v2 และ route หลักไม่พบ horizontal overflow ที่ 1280px
- [x] รัน regression เพิ่มเติมหลัง v2: `test:item-library`, `test:evidence-checklist`, `test:evidence-catalog`, `test:report-template`, `test:equipment-cleaning` และ `test:history-edit`

### งานที่ยังค้าง / ยังไม่พิสูจน์

- [ ] Visual QA แบบครบทุก route ที่ viewport 375, 768, 1024 และ 1440px บนเครื่องจริง
- [ ] ผู้ใช้หน้างานยืนยันลำดับข้อมูล, ขนาดตัวอักษร และความชัดเจนของสถานะ/หลักฐานบนอุปกรณ์จริง
- [ ] Field/UAT, real-device, deployment, security, multi-user/backend และ Production proof ยังอยู่นอกหลักฐาน Local/Test ของงานนี้

## งาน Flow สร้าง/เพิ่ม/ลบสถานีและอุปกรณ์ (3 กันยายน 2569)

### งานที่เพิ่งทำเสร็จ

- [x] คง Wizard 4 ขั้นแบบ transient draft: ข้อมูลสถานี → ทะเบียน Asset → ตั้งค่า Checklist → Review/ยืนยัน โดยไม่สร้าง Inspection/Snapshot ตอนสร้างสถานี
- [x] เพิ่ม `getNextEquipmentIndex` และ `validateEquipmentDraft` สำหรับ Asset No. ที่จำเป็นและไม่ซ้ำ โดยนับเลขถัดไปข้าม System/Custom ที่ใช้ Prefix เดียวกัน
- [x] เพิ่มการเพิ่ม Asset จากคลังกลางในหน้ารายละเอียดสถานี พร้อมแสดง System/Custom, BOQ category และข้อความ `Custom · ยังไม่มี Checklist mapping`
- [x] เพิ่ม `buildStationDeletionImpact` และ `purgeStationFromState` สำหรับลบ Station Profile, rounds, history, workspaces, Snapshot aliases และ current-round state เฉพาะ station ID เป้าหมาย
- [x] เพิ่มการลบสถานีถาวรแยกจากปิดใช้งาน: Confirmation 2 ชั้น, พิมพ์รหัสสถานีแบบตรงตัว และลบ IndexedDB attachments เฉพาะไฟล์ที่ไม่มีสถานีอื่นใช้งาน
- [x] หากลบไฟล์แนบไม่สำเร็จ ระบบหยุดก่อน purge metadata; `itemCatalog` และข้อมูลสถานีอื่นคงอยู่; สถานีสุดท้ายไม่สร้าง Demo กลับมา และรหัสเดิมใช้ซ้ำได้หลัง purge
- [x] เพิ่ม `test:station-lifecycle` ครอบคลุม Custom mapping, inactive Snapshot, Snapshot isolation, deletion impact, shared attachment, purge, global catalog และ no-Demo migration

### ผลตรวจ Local/Test และ Browser ที่พิสูจน์แล้ว

- [x] `npm.cmd run test:station-creation`
- [x] `npm.cmd run test:flow-redesign`
- [x] `npm.cmd run test:station-lifecycle`
- [x] `npm.cmd run test:item-library`
- [x] `npm.cmd run build`
- [x] Browser Local/Test: Wizard Step 2 แสดงข้อมูลร่าง, หน้ารายละเอียดมี `เพิ่มอุปกรณ์`, Dialog แสดงผลกระทบ และรหัสผิดทำให้ปุ่มลบ disabled; ไม่ได้ยืนยันลบข้อมูลจริง

### งานที่ยังค้าง / ยังไม่พิสูจน์

- [ ] ผู้ใช้ยืนยันนโยบายลบถาวรและทดลอง attachment failure/retry บนข้อมูลสังเคราะห์ของเครื่องจริง
- [ ] Field/UAT, real-device, deployment, security, backup/recovery, multi-user/backend และ Production proof ยังอยู่นอกหลักฐาน Local/Test ของเฟสนี้

## งานปรับ navigation rail ล่าสุด (3 กันยายน 2569)

### งานที่เพิ่งทำเสร็จ

- [x] ลบกล่องสถานะ `Local-first MVP / ข้อมูลอยู่ใน browser เครื่องนี้` ออกจาก navigation rail ตาม visual feedback
- [x] ลบ CSS ของกล่องดังกล่าวที่ไม่ถูกใช้งานแล้ว โดยไม่เปลี่ยน navigation, data, flow หรือสถานะการบันทึก

### ผลตรวจ

- [x] `npm.cmd run build` ผ่านหลังลบ markup/CSS
- [x] Browser Local/Test ยืนยัน `footerCount: 0`, ไม่พบข้อความ `Local-first MVP` และไม่มี horizontal overflow ที่ viewport 1280px

## งานลบหัวข้อที่ต้องแนบวิดีโอ (3 กันยายน 2569)

### งานที่เพิ่งทำเสร็จ

- [x] ลบหัวข้อวิดีโอหลัก 15 ช่องจาก Evidence Catalog ปัจจุบัน เหลือ 170 ช่อง และลบ `vms-video` จาก Master Checklist เหลือ 44 รายการ
- [x] เพิ่ม state migration version 13 สำหรับ rounds, Draft/Closed history, workspaces, Snapshot, Evidence/Checklist copy, `inspectionItems` และ compatibility aliases
- [x] เพิ่มแผน purge ที่รายงานจำนวนรอบ/หัวข้อ/ช่อง/ไฟล์ก่อนดำเนินการ และบล็อกการใช้งานผ่าน dialog จนกว่าจะสร้าง Local Backup สำเร็จ
- [x] Backup รวม localStorage JSON และ Blob จริงจาก IndexedDB; ถ้าไฟล์อ้างอิงหายหรืออ่านไม่ได้จะไม่เริ่มลบ
- [x] ลบ Blob เฉพาะไฟล์ที่ไม่ถูกอ้างอิงหลัง purge; ไฟล์ที่ใช้ร่วมกับช่องเอกสาร ภาพ และหมายเหตุอื่นยังคงอยู่ และ PDF ที่ export ไว้ในโฟลเดอร์ไม่ได้ถูกลบ
- [x] คงความสามารถรับวิดีโอในช่อง `document` ตามเดิม โดยถอดเฉพาะช่องที่มี `fieldType: "video"`
- [x] เพิ่ม `test:video-purge` ครอบคลุม Draft, Closed history, aliases, shared attachment, no-video output และ idempotent migration

### ผลตรวจ Local/Test ที่พิสูจน์แล้ว

- [x] `npm.cmd run test:evidence-checklist`
- [x] `npm.cmd run test:evidence-catalog`
- [x] `npm.cmd run test:report-template`
- [x] `npm.cmd run test:video-purge`
- [x] `npm.cmd run build`

### งานที่ยังค้าง / ยังไม่พิสูจน์

- [ ] ทดสอบ flow ดาวน์โหลด Backup และการลบ Blob จริงด้วย IndexedDB บน browser/device ที่ใช้งานจริง รวมกรณี Backup ถูกขัดจังหวะ
- [ ] ตรวจ recovery โดยนำ Backup กลับเข้าเครื่องทดสอบ และยืนยันว่าข้อมูลก่อน purge กลับมาได้ตามนโยบาย
- [ ] Field/UAT, real-device, deployment, security, multi-user/backend และ Production proof ยังอยู่นอกหลักฐาน Local/Test ของงานนี้
