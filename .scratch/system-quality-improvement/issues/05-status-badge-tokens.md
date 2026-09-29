# 05: Centralize status badge roles

Type: ui
Status: resolved
Blocked by: none

## Problem

The shared status badge uses an 11px, 800-weight label and status classes repeat border and surface colors directly in `foundation.css`.

## Plan

- Use the approved caption type token and a standard 600 weight for the common badge label.
- Add semantic status border/surface/text tokens that preserve the current rendered colors.
- Keep domain status names and their meanings unchanged.

## Verification

- Add token-contract assertions for the badge type and color roles.
- Run the full regression suite and production build.
- Inspect authenticated representative screens at the available mobile viewport.

## Answer

- Common status badges use the caption type token and semibold weight. Status colors use semantic border/surface/text aliases with values matching the prior palette.
- On 2026-09-25, the authenticated Station Directory was reviewed read-only at a measured 390 CSS-pixel viewport. The visible `ใช้งาน` and `ต้องแก้ไข` badges fit their content and card, and document width equaled its scroll width; no horizontal overflow was present. No station data was changed.
- `node tools/run_all_tests.mjs`: 65 scripts total, 0 failed; 5 PostgreSQL-dependent integrations were skipped because no isolated test database was configured. `npm.cmd run build` passed with the existing `.env NODE_ENV` and large JavaScript chunk warnings.
