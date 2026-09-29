# 02: Balanced field shared UI tokens

Type: ui
Status: resolved
Blocked by: none

## Problem

Global page headings and shared controls have multiple competing declarations and use repeated raw typography values.

## Plan

- Add semantic type, weight, spacing, and common control tokens to `src/styles/tokens.css`.
- Use them for base body copy, page headings, buttons, field labels, panel/section headings, and helper text.
- Keep report/print styles and dense workflow-specific controls scoped as documented exceptions.

## Constraints and risk

- Preserve route layout and all domain behavior.
- Check that larger field labels do not cause unintended mobile wrapping or overflow.
- Keep screen colors and status meaning unchanged in this first token adoption.

## Verification

- Static CSS contract check for token use and a single global page heading base rule.
- Build and browser screenshot comparison on the available login/unauthenticated route; authenticated workflow coverage remains separate if credentials are unavailable.

## Comments

- 2026-09-24: User approved the Balanced field direction.

## Answer

- Added semantic typography, weight, line-height, spacing, color-role, and control-size tokens in `src/styles/tokens.css`.
- Applied tokens to body copy, page and combined headings, shared buttons, field labels, panel/section headings, breadcrumbs, and helper text. Removed duplicate global page-heading size declarations; custom workflow and print rules remain scoped.
- Fixed a mobile Checklist header defect found during screenshot review: the page title now spans the header and round actions share the full row at 600px and below. Added a responsive contract assertion to `tools/test_single_viewport_workspace.mjs`.
- Verified with `tools/test_ui_foundation_tokens.mjs`, `tools/test_single_viewport_workspace.mjs`, and read-only In-app Browser screenshots of authenticated Dashboard, Stations, Inspections, History, and demo Checklist at 390px. The document remained within the 390px viewport.
- Full application typography/color adoption remains follow-up work; this ticket resolves the shared-foundation slice only.
