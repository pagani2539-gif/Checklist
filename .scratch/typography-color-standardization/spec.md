# Typography and Color Standardization

Status: resolved

## Purpose

กำหนดทิศทาง Balanced field สำหรับรวมขนาดตัวอักษร น้ำหนัก และสีของหน้าจอ Checklist ให้ใช้บทบาทและ token กลางร่วมกัน อ่านภาษาไทยได้ชัดในงานภาคสนาม และลดค่าที่กำหนดซ้ำตาม selector

ผู้ใช้อนุมัติทิศทางและการเริ่มทำแบบ incremental เมื่อ 2026-09-24 งาน tranche แรกอยู่ใน `.scratch/system-quality-improvement/` ส่วนการไล่ token ให้ครบทุก workflow ยังเป็นงานติดตาม

## Current source of truth

- [`DESIGN.md`](../../DESIGN.md) กำหนดทิศทาง UI และระบุให้ใช้ runtime color tokens
- [`src/styles/tokens.css`](../../src/styles/tokens.css) ประกาศฟอนต์ ขนาดตัวอักษร สี และค่า visual กลาง
- `src/main.jsx` โหลด `tokens.css`, `foundation.css`, `redesign.css`, `workspace-layout.css`, `presentation-cover.css`, `contracts.css` และ `contract-agreement-print.css`
- รายงานและงานพิมพ์มีสีตามแบรนด์และขนาดเฉพาะสื่อ ควรพิจารณาแยกจากหน้าจอปฏิบัติงาน

## Audit evidence baseline (2026-09-24)

นับจาก `foundation.css`, `redesign.css`, `workspace-layout.css` และ `contracts.css` โดยไม่รวมกฎพิมพ์และ selector `.ops-print*`:

- มี `font-size` 971 declarations และ 71 รูปแบบค่าที่ไม่ซ้ำ มีเพียง 11 declarations ที่อ้าง `--ops-type-*`
- พบค่าน้ำหนักตัวอักษรที่ใช้งาน 9 ค่า: `400`, `500`, `600`, `650`, `700`, `750`, `800`, `850`, `900`
- พบสี hex/rgb ที่กำหนดตรงในกฎหน้าจอ 359 ค่า ซึ่งรวมทั้งสีสถานะและสีเฉพาะ feature
- `.ops-page-header h1` ถูกกำหนดซ้ำเป็น `clamp(28px, 3vw, 38px)` และ `clamp(30px, 3vw, 40px)`
- หน้าล็อกอินใช้พื้นหลัง `#f4f7fb` ขณะที่ token พื้นหลังแอปคือ `--ops-paper: #f7f9fc`; หากตั้งใจให้ต่าง ควรมี token ตามบทบาทของหน้านั้น

ภาพจาก audit: [Dashboard](../../output/design-audit-typography-2026-09-24/01-dashboard.png) และ [ทะเบียนสถานี](../../output/design-audit-typography-2026-09-24/02-stations.png)

## Proposed direction: Balanced field

หน่วยตัวอักษรของเว็บเป็น `px` หรือ `rem` ไม่ใช่ `pt` ให้ใช้ Noto Sans Thai จาก `--ops-font-sans` และใช้ line-height ให้เหมาะกับข้อความไทย

| บทบาท | ขนาดที่เสนอ | น้ำหนักที่เสนอ | หมายเหตุ |
| --- | ---: | ---: | --- |
| Metadata / คำอธิบายสั้น | 12px | 400 หรือ 500 | ใช้กับข้อมูลรอง ไม่ใช้กับข้อความสำคัญเพียงอย่างเดียว |
| Label / ปุ่ม | 14px | 500 หรือ 600 | คุมปุ่มที่อยู่ระดับเดียวกันให้มีขนาดและน้ำหนักเดียวกัน |
| Body | 16px | 400 | คง baseline ปัจจุบันและ line-height `1.55` |
| หัวข้อส่วน | 20px | 600 | line-height ประมาณ `1.25` ถึง `1.35` |
| หัวข้อหน้า | 24px บนมือถือ, 30px บนจอใหญ่ | 700 | ใช้กฎ responsive ชุดเดียว |
| ตารางข้อมูลหนาแน่น | 11–12px | 400 หรือ 500 | เป็นข้อยกเว้นเฉพาะรายการรอง และไม่ต่ำกว่า 11px |

ให้จำกัดน้ำหนักมาตรฐานไว้ที่ `400`, `500`, `600`, `700`; เลิกใช้ค่าแทรก `650`, `750`, `850` ใน UI ทั่วไป

## Proposed color roles

คงสีสถานะตามความหมาย และใช้สี foreground กลางชุดเดียวตามบทบาท:

| บทบาท | ค่าเสนอ |
| --- | --- |
| Page background | `--ops-paper: #f7f9fc` |
| Surface | `--ops-card: #ffffff` |
| Primary text | `--ops-ink: #152238` |
| Secondary text | `--ops-ink-soft: #30415a` |
| Muted text | `--ops-muted: #63738a` |
| Border | `--ops-line: #e5eaf1` |
| Primary action | `--ops-blue: #2563eb` |
| Success / Warning / Danger | `#047857` / `#b45309` / `#b91c1c` |

พิจารณาให้ข้อความปกติใช้ `--ops-ink` แทนการสลับกับ `--ops-text-black: #000000` และแปลงค่าสีซ้ำใน component styles เป็น semantic tokens เท่าที่มีบทบาทเดียวกัน ห้ามลบความหมายสีสถานะหรือใช้สีเป็นสัญญาณเพียงอย่างเดียว

## Approved implementation sequence

1. เพิ่ม semantic typography tokens สำหรับ caption, label, body, section heading และ page heading พร้อม weight tokens
2. รวมกฎ `.ops-page-header h1` ให้เหลือแหล่งกำหนดเดียว และกำหนด responsive size ชัดเจน
3. ย้าย shared controls และ page primitives ไปใช้ tokens ก่อน ได้แก่ ปุ่ม, field labels, panel headings, status badges และ metadata
4. ทยอยปรับ stylesheet ราย workflow; คงขนาดเฉพาะของตารางไว้เมื่อจำเป็น และแยก report/print/brand-specific styles
5. ตรวจภาพ Desktop และ Mobile ด้วยข้อความภาษาไทยจริง รวมถึง contrast, focus, status และการตัดบรรทัด โดยไม่เปลี่ยน routes, data model, status IDs หรือ Snapshot/history

## Alternatives

- **Compact workspace:** ใช้ขนาดเล็กลงสำหรับข้อมูลหนาแน่น แต่เสี่ยงทำให้ metadata ภาษาไทยอ่านยาก
- **High legibility:** เพิ่มขนาดตัวอักษรทั้งระบบ อ่านง่ายขึ้น แต่ทำให้รายการ ฟอร์ม และตารางยาวขึ้น
- **Balanced field (ข้อเสนอหลัก):** รักษาเนื้อหาพื้นฐาน 16px ใช้ 12px สำหรับข้อมูลรอง และกำหนดหัวข้อ/ปุ่มด้วย semantic roles

## Acceptance criteria for continued rollout

- Shared page headings, labels, buttons, body text, and metadata use named tokens rather than unrelated raw values.
- Shared heading rules have one base definition; responsive overrides are intentional and scoped.
- Standard UI weights use only `400/500/600/700`; exceptions are documented at the component.
- Neutral and action colors come from role tokens; semantic status colors remain distinct and paired with text.
- Representative Dashboard, Stations, Inspection, Checklist, and History screens remain readable on desktop and mobile, with no unintended horizontal overflow.
- No Snapshot/history data, routes, or business behavior changes as part of this visual work.

## Comments

- 2026-09-24: User approved the Balanced field direction and the incremental implementation plan. Begin with semantic tokens and shared foundation controls; keep workflow-specific sizes scoped as documented exceptions.
- 2026-09-24: Shared foundation token slice implemented, including responsive Checklist header correction found in authenticated mobile screenshot QA. Full workflow-by-workflow adoption remains tracked as follow-up.
