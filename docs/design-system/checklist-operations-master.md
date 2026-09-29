# Checklist Operations Hub — Design System Master

สถานะ: อนุมัติสำหรับ active React/Vite UI
เอกสารฉบับนี้เป็นสรุปการใช้งานภาษาไทยของระบบปัจจุบัน และทบทวนล่าสุดเมื่อ 2026-09-26

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

Field Operations Light: พื้นที่ทำงานสีขาว/เทาอ่อนสำหรับช่างหน้างาน อ่านง่ายกลางแจ้งและพิมพ์รายงานได้สะอาด ใช้ deep ink เป็นข้อความ, Electric Blue เป็น action หลัก และใช้สีเขียว/amber/red ตามความหมายของสถานะ ไม่มี visual effect ที่แย่งความสนใจจากสถานะตรวจ

## Tokens

| Token | Value | ใช้กับ |
|---|---|---|
| `--ops-ink` | `#152238` | heading, primary text |
| `--ops-ink-soft` | `#30415A` | secondary text |
| `--ops-muted` | `#63738A` | supporting text |
| `--ops-navy` | `#FFFFFF` | white desktop rail และ mobile navigation |
| `--ops-sidebar-active` | `#EFF6FF` | active navigation surface |
| `--ops-sidebar-surface` | `#F8FAFC` | sidebar status surface |
| `--ops-sidebar-border` | `#E5EAF1` | sidebar divider |
| `--ops-sidebar-accent` | `#2563EB` | active navigation indicator และ brand mark |
| `--ops-sidebar-accent-hover` | `#1D4ED8` | accent hover |
| `--ops-sidebar-muted` | `#63738A` | ข้อความและไอคอนรองบน sidebar |
| `--ops-sidebar-success` | `#0F9F80` | storage/saved status |
| `--ops-blue` | `#2563EB` | primary action และ link |
| `--ops-blue-hover` | `#1D4ED8` | hover/pressed action |
| `--ops-focus` | `#2563EB` | focus ring ที่มองเห็นได้ |
| `--ops-warning` | `#B45309` | warning/attention |
| `--ops-success` | `#047857` | ปกติ/บันทึกสำเร็จ |
| `--ops-danger` | `#B91C1C` | ชำรุด/ทำลายข้อมูล |
| `--ops-paper` | `#F7F9FC` | page background |
| `--ops-card` | `#FFFFFF` | surface |
| `--ops-line` | `#E5EAF1` | border/divider |
| `--ops-line-strong` | `#CCD5E1` | emphasized border |

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
- Station Structure และ Equipment Register ใช้ relationship tree กลางเดียวกัน: Station Group → หมวดความสัมพันธ์ → `.01 Equipment` / `.02 Systems & Software`; BOQ/TOR เป็นข้อมูลอ้างอิงรอง และไม่เปลี่ยน Item ID หรือ Snapshot เดิม
- server mode ต้องตรวจ station scope, 401/403, immutable close และ attachment access ก่อน Public deployment
