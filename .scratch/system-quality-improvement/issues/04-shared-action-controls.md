# 04: Extract shared action controls

Type: refactor
Status: resolved
Blocked by: none

## Problem

`App.jsx` defines the shared Button renderer and a confirmation dialog with focus management, keyboard trapping, and optional typed confirmation. This mixes application composition with reusable interaction behavior.

## Plan

- Move the Button and ConfirmDialog implementations behind a focused controls module.
- Preserve prop names, classes, dialog copy, focus behavior, required-code behavior, and resolve values.
- Keep `App.jsx` responsible for composing controls and supplying its existing request state.

## Verification

- Add a module contract check for imports/exports and the focus/keyboard/confirmation behavior.
- Run the full regression suite and production build.
- Confirm no route, request, persisted-state, or Snapshot changes are involved.

## Answer

- Moved `Button` and `ConfirmDialog` into `src/app/controls/ActionControls.jsx` and imported them from `App.jsx`; call-site props, CSS classes, typed confirmation, Escape handling, Tab trapping, and focus restoration were preserved.
- `tools/test_action_controls_module.mjs`, all 61 scripts in `tools/run_all_tests.mjs`, and `npm.cmd run build` passed. PostgreSQL-backed integration cases were skipped without an isolated test database.
