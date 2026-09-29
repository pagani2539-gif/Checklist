# 08: Extract Vehicle API review UI

Type: refactor
Status: resolved
Blocked by: none

## Problem

The Inspection and Vehicle API review pages depend on a large set of Vehicle Review presentation functions declared in `App.jsx`, so the composition file owns UI details for a domain workflow.

## Plan

- Move the Vehicle Review panels and their local presentation helpers to `src/app/vehicle-review/ReviewPanels.jsx`.
- Keep the existing component props, markup, CSS classes, and page-registry contract.
- Remove `VehicleSearchPanel` only after confirming it has no repository call sites.
- Keep evidence-field components injected as a small UI interface; import Vehicle Review domain functions directly from their owning modules.

## Verification

- Add a focused source contract for the module exports, page-registry wiring, and preserved callbacks.
- Run focused vehicle UI checks, the full suite, and the production build.
- Review the Checklist and Vehicle API routes without invoking persistence actions.

## Answer

- Resolved a render failure exposed by the authenticated Vehicle demo route: `ThaiDateTimePicker` was referenced inside the extracted review panels but was not passed into the module factory. Added it to the factory interface and PAGE_RUNTIME wiring.
- Added an AST contract that rejects unresolved non-browser references in the panel module. It failed before the fix with `ThaiDateTimePicker` and passed after the fix.
- Focused Vehicle tests, the full 63-script suite, and the production build passed. Read-only authenticated browser review now shows the demo checklist, Thai date-time pickers, vehicle queue, API evidence, and review controls. The demo remains explicitly non-persistent.
