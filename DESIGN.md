---
name: Checklist Operations Design System
description: Thai-first, white-clean operations UI for station inspection, asset checklists, evidence capture, progress, and historical reports.
version: 2.1
lastReviewed: 2026-09-26
---

# Checklist Operations Design System

## Design direction

Use a white-canvas operations workspace: white navigation rail, mist-gray page canvas, deep ink typography, and calm blue actions. The visual direction borrows the clarity of professional hardware/service interfaces and the hierarchy of enterprise operations tools, but this is a project-specific design system and must not copy logos, proprietary fonts, imagery, or brand identity.

The interface is for field operations. Prioritize fast scanning, clear status, large touch targets, readable Thai text, and evidence completeness over decorative effects.

## Color roles

Use the existing CSS tokens in `src/styles/tokens.css` as the runtime source of truth. If an older design note or screen-specific style conflicts with these values, update the note/style instead of introducing a second global token set:

| Role | Token | Value | Use |
| --- | --- | --- | --- |
| Page background | `--ops-paper` | `#f7f9fc` | Main application canvas |
| Card surface | `--ops-card` | `#ffffff` | Panels, cards, forms, dialogs |
| Primary text | `--ops-ink` | `#152238` | Headings and readable content |
| Secondary text | `--ops-ink-soft` / `--ops-muted` | `#30415a` / `#63738a` | Supporting descriptions and labels |
| Primary action | `--ops-blue` | `#2563eb` | Main CTA, links, active progress action |
| Primary hover | `--ops-blue-hover` | `#1d4ed8` | Hover and pressed emphasis |
| Navigation surface | `--ops-navy` | `#ffffff` | White desktop rail and mobile nav |
| Navigation accent | `--ops-sidebar-accent` | `#2563eb` | Active rail, focus, and brand mark |
| Local-first status | `--ops-sidebar-success` | `#0f9f80` | Saved/local status indicator |
| Success | `--ops-success` | `#047857` | Complete, normal, saved |
| Warning | `--ops-warning` | `#b45309` | Waiting, incomplete, attention |
| Danger | `--ops-danger` | `#b91c1c` | Missing, damaged, destructive action |
| Borders | `--ops-line` / `--ops-line-strong` | `#e5eaf1` / `#ccd5e1` | Quiet separation and focus context |

Rules:

- Keep most of the page white or near-white.
- Reserve blue for actions, links, focus, and meaningful progress—not decoration.
- Keep amber for warnings and attention; do not use it as a general second primary CTA.
- Status colors must remain semantic and must be paired with text, not color alone.
- Never reduce contrast to make the interface look lighter.

## Typography

- Use `Noto Sans Thai` from the bundled local font as the primary family.
- Use the existing `--ops-font-sans` and `--ops-font-mono` tokens.
- Keep body text at a comfortable reading size and line height for Thai field users.
- Use weight and spacing for hierarchy; avoid all-caps English styling for Thai labels.
- Use monospace only for station codes, asset IDs, serial numbers, and technical values.

## Layout principles

- Keep a fixed white desktop navigation rail and a centered content area; use the same navigation vocabulary in the mobile bottom rail.
- Use an 1180px content max-width, 24px section rhythm, and 10–18px component radii.
- Use white cards on a very light page canvas with thin borders and restrained shadows.
- Keep sections visually distinct through spacing, surface tone, and headings—not heavy gradients.
- Put the primary action at the end of the task flow and make it obvious.
- Keep forms and evidence controls close to the item they describe.
- Use a 46–48px touch target for buttons, inputs, selects, and important controls.
- For dense evidence/checklist views, prefer clear row alignment and scanning over oversized hero elements.

## Information architecture and page patterns

Screen layout is selected by route through `data-page-layout` and styled in
`src/styles/workspace-layout.css`. Each workflow now has its own route contract:
dashboard, station directory/setup/workspace, round queue/setup, inspection,
vehicle review, history library/detail, and revision setup. Checklist items also
expose `data-checklist-context` for condition, measurement, asset, system/service,
evidence, vehicle, bypass, and issue work while history adds read-only mode.
Inspection work remains a bounded viewport. API review reserves more width for the vehicle image and result;
at widths below 1280px or heights below 761px the Vehicle workbench owns one
vertical scroll, removes nested column scrolling, and keeps the vehicle image at
a usable 16:9 size. Wide short screens use a queue column beside stacked image
and review panels. These rules apply to screen output only.

- Overview: station context first, then latest round, progress, and follow-up work.
- Stations and assets: directory → station profile → add asset → grouped BOQ register → station Checklist configuration.
- Inspection rounds: filterable work queue, compact progress signal, one clear action per row.
- Checklist: persistent BOQ navigation on desktop, compact selector on mobile, one item card with value/status/note/evidence in task order.
- History and reports: read-only Snapshot context, revision action separated from destructive actions, print output remains data-first.
- Create flows: use stepper + summary + explicit final commit; keep drafts transient and show warnings before confirmation.

### Station relationship tree

Station Structure and Equipment Register use one relationship tree for both SC and IMPS:
`station group → relationship category → .01 Equipment / .02 Systems & Software`.
BOQ/TOR codes stay visible as source references beside each record; they do not define the visual parent or replace the technical identity. System rows describe the installed system, while Asset rows describe the physical equipment linked to that system. Empty categories are shown only in template view, and inactive records are shown only when the inactive filter is selected. This presentation layer does not rewrite item IDs or historical Snapshot data.

The relationship view does not render duplicate legacy `WIM Control System` or `WIM Electronics System` rows. Their physical children remain under `.01 Equipment`; the catalog and stored records remain available for source compatibility and historical reads.

## Component styling

### Buttons

- Primary: blue fill, white text, one dominant action per area.
- Secondary: white fill with a quiet border.
- Ghost/link: transparent with blue text; use sparingly.
- Danger: red only for destructive or irreversible actions and require clear confirmation.
- Keep the existing radius and focus-ring tokens.

### Cards and panels

- Use white surfaces, a thin border, and a soft shadow.
- Keep card headers concise and align actions consistently.
- Do not hide required evidence, status, or validation messages behind hover-only behavior.
- Prefer one primary panel per task, with nested sections separated by spacing and quiet surface shifts.
- Use compact count tiles for metrics; do not turn every number into a large dashboard card.

### Status and evidence

- Always display a text label with a status color.
- Make incomplete, missing, not-installed, and not-applicable states distinguishable.
- Show evidence requirements before the upload control and show the current evidence state after it.
- Preserve the difference between an empty value, missing evidence, not applicable, and not installed.

## Responsive behavior

The responsive contract is based on CSS viewport width. Desktop content becomes fluid when the navigation rail is compact so wide screens do not create a large centered blank area. Mobile keeps the same route vocabulary in a bottom navigation and never relies on the desktop collapse control.

| CSS viewport | Navigation | Workspace behavior |
| --- | --- | --- |
| `1280px+` | 240px desktop rail, or 88px compact rail | Checklist can show category, result, and evidence columns; compact mode uses the available content width with a 24px gutter |
| `981–1279px` | Desktop rail remains available | Checklist switches to full-width workspace tabs before its columns become cramped |
| `781–980px` | White four-item bottom navigation | Main content is full width with touch-safe gutters; desktop collapse control is hidden |
| `561–780px` | White four-item bottom navigation | Forms, queues, and dense panels progressively stack or reduce columns |
| `320–560px` | White four-item bottom navigation | Narrow controls and report menus use one-column or bottom-sheet layouts |
| `<320px` | Not a supported target | The application declares a 320px minimum body width |

Rules:

- The layout must remain usable at narrow mobile widths without horizontal scrolling.
- Collapse the desktop rail into a white bottom navigation with a safe-area offset; preserve task order.
- Collapse navigation and multi-column panels progressively; preserve task order.
- Stack form controls when labels or evidence previews would become cramped.
- Keep primary actions visible and reachable on touch devices.
- Verify Thai wrapping, button labels, tables, status pills, and attachment previews at mobile widths.

## Shared layout contract

หน้าที่มีพื้นที่ทำงานหลายส่วนต้องใช้โครงสร้างเดียวกัน: หัวบริบทอยู่ด้านบน, แถบพื้นที่ทำงานอยู่ถัดลงมา, หัวแผงมีระยะบนเท่ากัน และเนื้อหาเป็นส่วนที่เลื่อนได้ของแผงนั้นเอง. ปุ่มเลื่อนไปยังรายการต้องอยู่ใน flow ของแผงและต้องไม่ทับสถานะ, หลักฐาน หรือฟอร์มที่อยู่ด้านบน.

- ใช้ระยะกลาง `8 / 12 / 16 / 24px` และให้ปุ่มคำสั่งสำคัญสูงอย่างน้อย `44px`.
- ที่ความกว้างไม่เกิน `1279px` ให้เปลี่ยนจากหลายคอลัมน์เป็น Workspace tabs ก่อนที่หัวแผงหรือปุ่มจะถูกบีบ.
- ที่ความกว้าง `320–600px` ต้องแสดงบริบทหมวดและเลขรายการแบบย่อเสมอ และต้องมีพื้นที่เลื่อนสำหรับรายการผลตรวจทั้งหมด.
- ต้องกันพื้นที่ของ Mobile bottom navigation และ safe area โดยไม่ใช้การซ่อนส่วนที่ผู้ใช้ต้องกรอก.
- การเปลี่ยน Layout ต้องไม่เปลี่ยน item ID, status, evidence, API payload หรือ Snapshot/history.

## Accessibility and field use

- Preserve visible focus indicators and keyboard access.
- Do not communicate important meaning by color alone.
- Use descriptive labels and helpful error text in Thai.
- Maintain readable contrast on white surfaces and the white navigation rail.
- Prefer explicit confirmation for closing a round or other irreversible actions.

## Product and data guardrails

- Visual redesigns must not change technical IDs, status values, field types, source order, asset mappings, or Snapshot behavior.
- Historical rounds and reports must remain visually readable and must continue to use their stored Snapshot data.
- Do not silently recreate deleted or inactive stations/assets.
- Treat attachments and evidence as user data; do not replace or remove them as part of a visual change.

## Do

- Build calm, white, high-contrast screens with clear blue actions.
- Use the existing tokens before introducing a new color.
- Test the actual Thai content and long station/asset names.
- Keep the interface consistent across overview, stations/assets, inspection rounds, and history/print.
- Use a single visual language for System assets, Custom assets, inactive states, Snapshot locks, and destructive confirmations.

## Do not

- Do not clone a brand website or paste its logo, proprietary font, or imagery.
- Do not use large marketing hero sections in task-heavy inspection screens.
- Do not add gradients, glassmorphism, or decorative animation without a task benefit.
- Do not replace functional status colors with a single neutral style.
- Do not call a local visual check production or field/UAT evidence.

## Agent prompt guide

When changing the UI, read this file and `src/styles/tokens.css` first. Preserve the existing data model and Snapshot/history behavior. Use Thai-first labels, white cards, blue primary actions, a white navigation rail, semantic status colors, and responsive layouts. Before finishing, check desktop and mobile wrapping, keyboard focus, contrast, status/evidence clarity, and the distinction between transient draft, current Station Profile, and immutable Snapshot.
