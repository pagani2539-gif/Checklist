---
name: Checklist Operations Design System
description: Thai-first white daytime and black nighttime operations UI for station inspection, evidence capture, progress, and historical reports.
version: 2.5
lastReviewed: 2026-10-06
---

# Checklist Operations Design System

## Design direction

Use white canvas, cards, and navigation in light mode. Use a black canvas with distinct charcoal cards and navigation in dark mode. Primary actions invert: black with white text in light mode, white with black text in dark mode. Links and focus are monochrome. Preserve green, amber, and red for their operational meanings, with readable text in both modes. Avoid decorative colored backgrounds on dense work surfaces. Do not copy logos, proprietary fonts, imagery, or brand identity.

Users choose light, dark, or system through sun, moon, and desktop icons. Remember this device preference separately from inspection data; do not schedule changes by time of day. Dark screen overrides live in `src/styles/dark-theme.css`; `tools/build_dark_theme_surfaces.mjs` adapts legacy literal colors and preserves light document previews during prebuild. Images retain their original colors. Report documents and print/PDF keep white backgrounds and company-specific styling.

The interface is for field operations. Prioritize fast scanning, clear status, large touch targets, readable Thai text, and evidence completeness over decorative effects.

## Color roles

Use the existing CSS tokens in `src/styles/tokens.css` as the runtime source of truth. If an older design note or screen-specific style conflicts with these values, update the note/style instead of introducing a second global token set:

| Role | Token | Light | Dark | Use |
| --- | --- | --- | --- | --- |
| Page | --ops-paper | #ffffff | #080808 | Application canvas |
| Card | --ops-card | #ffffff | #171717 | Panels, forms, dialogs |
| Neutral surface | --ops-color-neutral-surface | #f8fafc | #222222 | Secondary work areas |
| Primary text | --ops-ink | #171717 | #f5f5f5 | Headings and content |
| Secondary text | --ops-ink-soft | #525252 | #cccccc | Descriptions and labels |
| Action | --ops-color-primary | #171717 | #f5f5f5 | Primary buttons with opposite text |
| Link | --ops-color-link | #171717 | #f5f5f5 | Underlined links |
| Navigation | --ops-color-navigation | #ffffff | #111111 | Desktop and mobile navigation |
| Navigation text | --ops-color-navigation-foreground | #171717 | #f5f5f5 | Labels; active items invert |
| Success | --ops-success | #15803d | #86efac | Normal, complete, saved |
| Warning | --ops-warning | #a16207 | #fcd34d | Waiting, incomplete, attention |
| Danger | --ops-danger | #b91c1c | #fca5a5 | Damaged, incorrect, destructive |
| Border | --ops-line | #d4d4d4 | #454545 | Separate controls and panels |

Legacy --ops-blue variables resolve to the shared action tokens. Report documents keep their own established palette, independent of screen mode. Do not recolor image pixels, company covers, or exported documents.

Rules:

- Keep light surfaces white; use black and charcoal surfaces in dark mode.
- Use monochrome actions, links, focus, and progress.
- Keep amber for warnings and attention; do not use it as a general second primary CTA.
- Status colors must remain semantic and must be paired with text, not color alone.
- Never reduce contrast to make the interface look lighter.

## Typography

- Use `Noto Sans Thai` from the bundled local font as the primary family.
- Use the existing `--ops-font-sans` and `--ops-font-mono` tokens.
- Use one role-based scale on every screen: page title `24–32px/700`, section heading `20–22px/600`, card title `14–18px/600`, body `15–16px/400`, field/action label `14px/500–600`, metadata `12–13px/400–500`, and short status/helper text `11–12px/400–600`.
- The runtime size tokens are `--ops-type-page-*`, `--ops-type-section`, `--ops-type-heading-*`, `--ops-type-title`, `--ops-type-label`, `--ops-type-body-*`, `--ops-type-meta`, `--ops-type-caption*`, and `--ops-type-micro`. Generic `xs`, `sm`, `md`, and table sizes resolve to these role tokens. Keep micro text for short secondary details; use body or caption sizes for instructions and operational values.
- Use only the shared weight roles `400` regular, `500` medium, `600` semibold, `700` bold, and `800` extra bold. Reserve `800` for short status labels or compact numeric emphasis; do not use intermediate weights such as `650`, `750`, or `850`.
- Preserve larger values for page titles and prominent metrics, and preserve fixed print sizing inside report templates.
- Keep body text at a comfortable reading size and line height for Thai field users.
- Use weight and spacing for hierarchy; avoid all-caps English styling for Thai labels.
- Use monospace only for station codes, asset IDs, serial numbers, and technical values.

## Layout principles

- Keep a fixed navigation rail matching the current light or dark mode, with the same vocabulary in the mobile bottom rail. With the desktop rail expanded, center route content using its page-specific width (1180px by default; wider operational workspaces may differ).
- With the desktop rail compact, the outer page and top bar must fill the available main area with 24px side gutters. This rule overrides route-specific outer max-widths; keep readable limits on nested forms and fixed-size report documents.
- Use a 24px section rhythm and 10–18px component radii.
- Use mode-appropriate cards with thin borders and restrained shadows.
- Keep sections distinct through spacing, surface tone, and headings. Use inverse monochrome emphasis for actionable or selected content.
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
At 1280px and wider, inspection and Vehicle API work keep their desktop panel
layouts. From 320px through 1279px, interactive pages use one content column
and the document owns vertical scrolling; inspection, evidence, Vehicle API,
and report details remain in the page flow. These screen rules do not change
fixed print or PDF layouts.

- Overview: station context first, then latest round, progress, and follow-up work.
- Stations and assets: directory → station profile → add asset → grouped BOQ register → station Checklist configuration.
- Inspection rounds: filterable work queue, compact progress signal, one clear action per row.
- Checklist: persistent BOQ navigation on desktop; from 320px through 1279px, show the queue, result, and evidence in one vertical flow with no content tabs.
- History and reports: read-only Snapshot context, revision action separated from destructive actions, print output remains data-first.
- Create flows: use stepper + summary + explicit final commit; keep drafts transient and show warnings before confirmation.

### Station relationship tree

Station creation, Equipment Register and active Checklist use one installation-point order from `station-workpoint-layout.js`. Each installation point fixes its Scope; creation and registry then show `System → Equipment` beneath that point. IMPS orders `Image Processing → WIM → LPR for ImPS → CCTV for ImPS → 3D Dimension → LPR for 3D → Data/Control for ImPS`. SC retains separate High Speed, Low Speed and Central points; unsupported empty categories stay hidden except in template view, while installed historical records stay visible. Equipment uses its saved `parentSystemId` first. When it is missing, Catalog ownership and Scope may place it under a System for display only if exactly one matching System exists; ambiguous and unresolved records stay under “ยังไม่ผูก System”. This display-only inference does not write relationships into station data.

WIM Control and WIM Electronics appear as parent Systems when real records exist. WIM Sensor and Loop remain tied to their WIM System and Lane. LPR has a separate System record for each Scope, with cameras under the System in that Scope. The station-creation page uses the same category and Scope order, and keeps Systems and Equipment as nested Work Spec choices while the user builds the draft. Adding beneath a System uses that exact parent. Generic addition requires a parent choice; electronics children require a saved Cabinet belonging to the selected System. Scope is inherited from the parent rather than chosen again. An ambiguous or invalid explicit parent must not fall back to the first System. Existing missing relationships are not silently saved. The active Checklist uses the same installation-point order while preserving item IDs and previous/next navigation order without adding Scope/System levels to the queue.

BOQ/TOR codes remain source references and do not replace technical identity. The `.01 Equipment` and `.02 Systems & Software` suffixes remain Checklist/Report presentation codes defined by ADR 0003. They are not relationship-tree levels. No schema, API, ID, stored parent relationship, or historical Snapshot data is changed by this presentation update. See the [SC/IMPS item map](.scratch/sc-imps-grouping-audit/map.md) for the per-Scope mapping.

## Component styling

### Buttons

- Primary: inverse monochrome background and text, one dominant action per area.
- Secondary: white fill with a quiet border.
- Ghost/link: transparent with mode-aware text; use sparingly.
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
| `981–1279px` | 240px desktop rail by default, or 88px when compact | All page content uses one main column and the document owns vertical scrolling; workspaces do not switch to tabs |
| `781–980px` | Mode-aware four-item bottom navigation | One main content column and document scrolling; desktop collapse control is hidden |
| `561–780px` | Mode-aware four-item bottom navigation | One main content column and document scrolling |
| `320–560px` | Mode-aware four-item bottom navigation | One main content column and document scrolling; narrow controls may wrap |
| `<320px` | Not a supported target | The application declares a 320px minimum body width |

Rules:

- The layout must remain usable at narrow mobile widths without horizontal scrolling.
- Keep the existing navigation forms and breakpoints; the mobile bottom rail keeps its safe-area offset and does not become a content tab bar.
- From 320px through 1279px, stack primary panels, forms, lists, and workspaces in one column and use the document as the single vertical scroll area. Keep status, save state, results, evidence, and actions visible in that flow.
- Keep multi-column task workspaces and card grids for viewports at 1280px and wider.
- When the desktop rail is compact, apply the shared 24px gutter to outer page and top-bar containers after route-specific width rules; do not stretch nested forms or fixed-size report documents.
- Stack form controls when labels or evidence previews would become cramped.
- On-screen report previews must fit the viewport and scroll with the document; fixed print and PDF page sizing stays unchanged.
- Keep primary actions visible and reachable on touch devices.
- Verify Thai wrapping, button labels, tables, status pills, and attachment previews at mobile widths.

## Shared layout contract

หน้าที่มีพื้นที่ทำงานหลายส่วนต้องใช้โครงสร้างเดียวกัน: หัวบริบทอยู่ด้านบน, แถบพื้นที่ทำงานอยู่ถัดลงมา, หัวแผงมีระยะบนเท่ากัน และเนื้อหาเป็นส่วนที่เลื่อนได้ของแผงนั้นเอง. ปุ่มเลื่อนไปยังรายการต้องอยู่ใน flow ของแผงและต้องไม่ทับสถานะ, หลักฐาน หรือฟอร์มที่อยู่ด้านบน.

- ใช้ระยะกลาง `8 / 12 / 16 / 24px` และให้ปุ่มคำสั่งสำคัญสูงอย่างน้อย `44px`.
- ที่ความกว้าง `320–1279px` ให้เรียงพื้นที่ทำงานหลักเป็นคอลัมน์เดียวและเลื่อนทั้งหน้า โดยแสดงคิว ผลตรวจ หลักฐาน สถานะการบันทึก และปุ่มทำงานในลำดับเดียวกัน; ไม่สลับเนื้อหาไปมาในแท็บ.
- ที่ความกว้าง `320–600px` ต้องแสดงบริบทหมวดและเลขรายการแบบย่อเสมอ และต้องมีพื้นที่เลื่อนสำหรับรายการผลตรวจทั้งหมด.
- ต้องกันพื้นที่ของ Mobile bottom navigation และ safe area โดยไม่ใช้การซ่อนส่วนที่ผู้ใช้ต้องกรอก.
- หน้ารายงานที่เปิดดูบนจอต้องพอดีกับความกว้างและเลื่อนตามหน้า; ขนาดหน้าพิมพ์และ PDF คงเดิม.
- การเปลี่ยน Layout ต้องไม่เปลี่ยน item ID, status, evidence, API payload หรือ Snapshot/history.

## Accessibility and field use

- Preserve visible focus indicators and keyboard access.
- Do not communicate important meaning by color alone.
- Use descriptive labels and helpful error text in Thai.
- Maintain readable contrast on white panels and the mode-aware navigation rail.
- Prefer explicit confirmation for closing a round or other irreversible actions.

## Product and data guardrails

- Visual redesigns must not change technical IDs, status values, field types, source order, asset mappings, or Snapshot behavior.
- Historical rounds and reports must remain visually readable and must continue to use their stored Snapshot data.
- Do not silently recreate deleted or inactive stations/assets.
- Treat attachments and evidence as user data; do not replace or remove them as part of a visual change.

## Do

- Build calm, high-contrast monochrome screens with white panels and clear primary actions.
- Use the existing tokens before introducing a new color.
- Test the actual Thai content and long station/asset names.
- Keep the interface consistent across overview, stations/assets, inspection rounds, and history/print.
- Use a single visual language for System assets, Custom assets, inactive states, Snapshot locks, and destructive confirmations.

## Do not

- Do not clone a brand website or paste its logo, proprietary font, or imagery.
- Do not use large marketing hero sections in task-heavy inspection screens.
- Do not use full-page gradients, glassmorphism, or decorative animation. Keep highlights neutral.
- Do not replace functional status colors with a single neutral style.
- Do not call a local visual check production or field/UAT evidence.

## Agent prompt guide

When changing the UI, read this file and `src/styles/tokens.css` first. Preserve the existing data model and Snapshot/history behavior. Use Thai-first labels, white light-mode surfaces, black/charcoal dark-mode surfaces, inverse monochrome actions, semantic status colors, and responsive layouts. Keep company-specific report colors and all PDF/print styling separate from the app theme. Before finishing, check desktop and mobile wrapping, keyboard focus, contrast, status/evidence clarity, and the distinction between transient draft, current Station Profile, and immutable Snapshot.

Use existing @tabler/icons-react SVG icons. Familiar actions may use icon-only buttons with accessible Thai names and tooltips, at least 44px targets. Keep text with navigation, status, evidence, saving, deleting, closing rounds, and reports.
