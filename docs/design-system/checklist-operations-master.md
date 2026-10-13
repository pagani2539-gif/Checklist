# Checklist Operations Hub — Design System Master

สถานะ: อนุมัติสำหรับ active React/Vite UI
เอกสารฉบับนี้เป็นสรุปการใช้งานภาษาไทยของระบบปัจจุบัน และทบทวนล่าสุดเมื่อ 2026-10-04

## แหล่งอ้างอิงหลัก

- `DESIGN.md` เป็นกติกาด้าน visual direction, layout, accessibility และ product guardrails
- `src/styles/tokens.css` เป็น runtime source of truth ของ design tokens
- `src/main.jsx` เป็น active style import chain ของ React/Vite UI
- หากเอกสารหรือ CSS เฉพาะหน้าขัดกับสองไฟล์แรก ให้ยึด `DESIGN.md` และ `tokens.css` แล้วแก้จุดที่ขัดแย้ง ไม่สร้าง global token ชุดใหม่

## Product context

- ผู้ใช้หลัก: ช่าง/ผู้ตรวจสอบภาคสนาม
- บริบท: มือถือ มือเดียว แสงกลางแจ้ง ต้องกรอกเร็วและกลับมาตรวจต่อได้
- ข้อมูล: local mode จัดเก็บภายในเครื่อง; server mode ใช้ API และ station scope. รอบตรวจที่ผูกสัญญาเลือก Contract, Work Package และสถานีจากบริบทเดียวกัน; Snapshot ของรอบเดิมต้องไม่เปลี่ยน และหน้าปก Contract Work Report แยกจากรายงานตรวจสถานี
- เป้าหมาย UX: แยกหน้าตาม workflow ให้รู้ว่าหน้านี้มีหน้าที่อะไร และไม่ให้ข้อมูลข้ามสถานี/รอบ

## Visual direction

Checklist Sky Blue: พื้นที่ทำงานสีขาวอมฟ้า การ์ดสีขาว แถบนำทางน้ำเงินเข้ม และไล่เฉดฟ้าขาวเฉพาะปุ่มหลัก เมนูที่เลือก แผงสรุป และแถบหัวหน้าที่ติดขอบจอ เพื่อให้ได้อารมณ์ตามภาพอ้างอิงและยังอ่านงานภาคสนามง่าย ใช้สีเขียว/amber/red ตามความหมายของสถานะ ส่วนสีและแม่แบบรายงานของแต่ละบริษัทรวมถึง PDF และงานพิมพ์คงเดิม

## Tokens

| Token | Value | ใช้กับ |
|---|---|---|
| `--ops-ink` / `--ops-color-text-primary` | `#263840` | ข้อความหลัก |
| `--ops-ink-soft` | `#405761` | ข้อความรอง |
| `--ops-muted` | `#637982` | ข้อความประกอบ |
| `--ops-paper` / `--ops-color-background` | `#F8FCFE` | พื้นหน้าแอป |
| `--ops-card` | `#FFFFFF` | การ์ดและแผง |
| `--ops-color-primary` | `#087EA4` | ปุ่มหลัก ลิงก์ และความคืบหน้า |
| `--ops-color-primary-hover` | `#075F7E` | hover/pressed และขอบโฟกัส |
| `--ops-color-primary-soft` | `#EDFFFF` | พื้นเลือกและจุดเน้นอ่อน |
| `--ops-color-primary-gradient` | `#087EA4 → #075F7E` | ปุ่มหลักและเมนูที่เลือก |
| `--ops-color-highlight-gradient` | `#FFFFFF → #F2FFFF → #D6FFFF` | แผงสรุปและจุดเน้นอ่อน |
| `--ops-color-cyan-accent` | `#00FFFF` | เส้นเน้นของรายการที่เลือกและขอบล่างปุ่มหลัก |
| `--ops-color-navigation` | `#16465C` | พื้นแถบเมนู |
| `--ops-color-navigation-active` | `#087EA4` | รายการเมนูที่เลือก |
| `--ops-color-navigation-foreground` | `#FFFFFF` | ข้อความและไอคอนบนแถบเมนู |
| `--ops-color-border` | `#D7E4E9` | เส้นแบ่งและขอบ |
| `--ops-focus-ring` | `rgba(8, 126, 164, 0.24)` | วงโฟกัสแป้นพิมพ์ |
| `--ops-blue*` | alias ของ token ฟ้าน้ำเงิน | รองรับสไตล์เดิม |
| `--ops-success` | `#047857` | สำเร็จ/ปกติ |
| `--ops-warning` | `#B45309` | รอตรวจ/ต้องติดตาม |
| `--ops-danger` | `#B91C1C` | เสียหาย/ลบข้อมูล |

`.ops-print-report` คงชุดสีน้ำเงินและสีกลางของรายงานไว้เพื่อรักษาแบรนด์บริษัท, PDF และงานพิมพ์
ใช้ `#00FFFF` เฉพาะเส้นเน้นขนาดเล็ก และใช้สีที่เจือจางลงในพื้นไล่เฉด เพื่อคงความอ่านง่ายของข้อความและปุ่ม

ใช้ bundled local `Noto Sans Thai` เป็น font หลักทั้งไทย/อังกฤษ และใช้ `ui-monospace` เฉพาะรหัสสถานี/รหัสรอบ/Asset No./Serial Number เพื่อให้หน้าตาเหมือนกันทุกเครื่องโดยไม่พึ่ง runtime external font

## Interaction rules

- ปุ่ม/field แตะได้อย่างน้อย 44px และมีช่องว่างระหว่าง target อย่างน้อย 8px
- ทุกสถานะต้องมีข้อความหรือ icon ร่วมกับสี
- ทุก input มี visible label และ helper/error อยู่ใกล้ field
- autosave ต้องไม่แย่ง focus และต้องแสดง feedback แบบ polite
- destructive action ต้องมี confirmation และทางกู้คืน/คำอธิบาย
- route change ต้องย้าย focus ไป main content และ back ต้องไม่ reset filter/input ที่ยังอยู่ใน workflow
- animation ใช้เฉพาะ transition 150–250ms, ห้าม block input และปิด/ลดเมื่อ `prefers-reduced-motion`
- สถานะต้องมีข้อความและ icon ร่วมกับสี ไม่ใช้สีอย่างเดียว
- touch target สำคัญต้องมีขนาดอย่างน้อย 44px และเว้นระยะอย่างน้อย 8px
- ห้ามพึ่ง runtime external font/image; ใช้ local Noto Sans Thai และ inline SVG ในระบบ

## React Bits adoption

ใช้ CSS variants และ source ที่อยู่ใน repository เป็นหลัก ปัจจุบัน reusable React primitives อยู่ใน `src/app/App.jsx` เช่น `Button`, `PageHeader`, `StatusBadge`, `ConfirmDialog`, `CustomSelect`, `ChecklistItem` และ `EmptyState`; รายการ `Sidebar`, `Accordion`, `Stepper`, `Counter` และ `Animated List` เป็น candidates เท่านั้น ไม่ใช่ dependency บังคับ ไม่ใช้ background, cursor, 3D หรือ text effect

## Shared layout contract

ทุกหน้าที่ใช้พื้นที่ทำงานแบบหลายแผงต้องใช้ลำดับเดียวกัน: บริบทของงานอยู่ด้านบน, Workspace tabs อยู่ก่อนเนื้อหาในจอแคบ, หัวแผงใช้ระยะบนและเส้นแบ่งชุดเดียวกัน, และเฉพาะ body ของแผงเป็นพื้นที่เลื่อน. ห้ามใช้ Pager หรือ Bottom Navigation บังข้อมูลที่ผู้ใช้ต้องเลือกหรือกรอก.

| ส่วน | มาตรฐานกลาง |
|---|---|
| ระยะ | `8 / 12 / 16 / 24px` ตามระดับความสัมพันธ์ |
| ปุ่มและช่องกรอก | สูงอย่างน้อย `44–48px`; ระยะห่างระหว่าง target อย่างน้อย `8px` |
| หัวบริบท | Desktop เรียงชื่อ, หมวด, รายการ, ความคืบหน้า และคำสั่งในแถวเดียว; ช่วง `601–1279px` ใช้สองแถวที่ยังเห็นกลุ่มคำสั่งชัด; มือถือแสดงหมวดและรายการแบบย่อ |
| หัวแผง | เริ่มที่แนวบนเดียวกัน; เลขรายการใช้เป็นข้อความประกอบหัว ไม่สร้างหัวแผงอีกระดับโดยไม่จำเป็น |
| Pager | อยู่ใน flow ของแผง, ไม่ทับ status/evidence, และมีพื้นที่ปลอดภัยก่อน Mobile bottom navigation |
| พื้นที่เลื่อน | ให้รายการตรวจและหลักฐานเลื่อนภายใน body ของแผงเมื่อความสูงไม่พอ; ห้ามตัดด้วย `overflow: hidden` หากยังมีรายการที่ผู้ใช้ต้องทำ |
| Responsive QA | ตรวจที่ `320, 375, 390, 768, 1024, 1440px`; ต้องไม่มี horizontal overflow และต้องเข้าถึงทุกสถานะด้วยคีย์บอร์ด |

การแก้เฉพาะหน้าอาจแตกต่างได้เฉพาะ Vehicle API review ที่มี workbench ของตัวเอง แต่ต้องรักษากติกา touch target, focus, safe area, และข้อมูล Snapshot/history เดิม.

## Quality gates

- viewport 375, 768, 1024, 1440px
- keyboard/focus/screen reader labels
- no horizontal overflow
- สถานะ, อ่านอย่างเดียว, disabled และ empty state แยกความหมายชัด
- print ซ่อน navigation/filter/control
- localStorage migration และ Snapshot isolation ต้องผ่านก่อน cutover
- หน้าสร้างสถานี ทะเบียนอุปกรณ์ และหน้า Checklist ใช้ลำดับจุดติดตั้งจาก `station-workpoint-layout.js`; IMPS วาง LPR for 3D ถัดจาก 3D Dimension. จุดติดตั้งกำหนด Scope ให้อัตโนมัติ ส่วนหน้าสร้างสถานีและทะเบียนแสดง System → Equipment; เพิ่มใต้ System ใช้แม่ตัวที่กด และอุปกรณ์ Electronics ใช้ Cabinet ที่ผูก System นั้น. ทางเพิ่มทั่วไปต้องเลือกความสัมพันธ์แม่ก่อน โดยไม่เลือก Scope ซ้ำ; รายการเก่าที่ไม่มี System แม่หรือจับคู่ได้ไม่ชัดยังแสดงใน “ยังไม่ผูก System”
- หน้าสร้างสถานีใช้ลำดับหมวดและ Scope เดียวกัน ส่วนหน้า Checklist ใช้ลำดับหมวดหลักเดียวกัน แต่คงคิวตรวจ รหัส Checklist และการเลื่อนไปข้อถัดไปตามกติกาเดิม; ไม่เพิ่มชั้น Scope/System ในคิว
- ดู[ผัง SC/IMPS รายข้อ](../../.scratch/sc-imps-grouping-audit/map.md) สำหรับลำดับและตำแหน่งของแต่ละรายการ
- รหัส .01 Equipment และ .02 Systems & Software ยังคงเป็นรหัสแสดงผล Checklist/Report ตาม ADR 0003 ไม่ใช่ชั้นของ relationship tree; BOQ/TOR เป็นข้อมูลอ้างอิงรอง และห้ามเปลี่ยน Item ID หรือ Snapshot เดิม
- server mode ต้องตรวจ station scope, 401/403, immutable close และ attachment access ก่อน Public deployment
