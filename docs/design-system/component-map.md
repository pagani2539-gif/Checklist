# Checklist Operations Hub — Component Map

## Shell

- `AppShell`: desktop sidebar / mobile bottom navigation
- `PageHeader`: eyebrow, heading, description, one primary CTA
- `SaveStatus`: autosave state ที่ไม่ขโมย focus
- `Breadcrumb`: ใช้ในหน้ารองและ detail

## React Bits candidates

- `Sidebar`: primary navigation structure
- `Accordion`: project metadata และ equipment details
- `Stepper`: ขั้นตอนสร้างข้อมูล ณ วันที่เริ่มรอบการตรวจ (Snapshot) ใหม่
- `Counter`: summary numbers โดยต้องมี static fallback
- `Animated List`: issue list แบบ subtle เท่านั้น

## Domain components

- `StationSelector`
- `ContextualStationPage` / `StationWizardStepper`
- `StationDetailPage`
- `EquipmentTable` / `EquipmentCard`
- `InspectionRoundCard`
- `SnapshotPreview`
- `ChecklistItem`
- `ChecklistTaskQueue` / `ChecklistEvidenceDrawer` (sticky desktop / drawer-select mobile)
- `CloseReadinessPanel` (blockers, follow-ups, focus recovery)
- `RevisionPage` / `RevisionBanner`
- `StationDirectory` / `StationDetailPage`
- `StatusBadge`
- `ReadOnlyField`
- `ConfirmDialog`
- `EmptyState`
- `VehicleFocusReviewPanel` / `VehicleSearchReviewPanelLegacy`
- `Icon` / `AppIcon` ผ่าน shared icon registry

## Contract context

- `ContractContextBar`: แสดงบริบท Contract/Work Package ของหน้าปัจจุบันหรือรอบตรวจ
- `ContractContextSelect`: เลือก Contract → Work Package → สถานีที่ได้รับมอบหมายก่อนเริ่มรอบ
- `createNewContractPage`, `createContractDetailPage`, `createWorkPackagePage` ใน `ContractsPage.jsx`
- `createContractAgreementCoverPage`, `createContractReportPage` และ `createReferenceDataPage` สำหรับหน้าปกสัญญา รายงานงานตามสัญญา และ Master Data คู่สัญญา

ทุก component ต้องรับข้อมูลผ่าน props และไม่อ่าน `stationProfiles` สดในส่วนที่แสดง Snapshot ของรอบตรวจ

## Flow contracts

- `getCloseReadiness(round)` เป็น domain helper เดียวสำหรับวิเคราะห์รายการค้างก่อนปิดรอบ; UI ต้องแสดงคำเตือนและให้ผู้ใช้ยืนยันปิดได้ แม้ยังมีรายการค้าง
- ประวัติแสดงรอบที่ปิดแล้วแบบอ่านอย่างเดียว; การแก้ใช้ `createRevisionRound` และเก็บ `basedOnRoundId`, `revisionNumber`, `revisionReason`, `revisionCreatedAt`, `revisionCreatedByLabel`
- Station ที่มีรอบอ้างอิงใช้ `active: false` (ปิดใช้งาน/เก็บถาวร) แทนการลบข้อมูล
- การสร้างสถานีใหม่ใช้ `ContextualStationPage` ผ่าน route `newStation`; factory หน้าเก่าที่ไม่อยู่ใน runtime ถูกนำออกแล้ว
- Vehicle API review แยก route ตามบริบทป้ายทะเบียน/การคัดแยกประเภทรถ และประวัติอ่านจาก Snapshot เดิม
