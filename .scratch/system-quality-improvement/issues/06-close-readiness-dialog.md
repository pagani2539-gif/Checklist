# 06: Extract inspection close-readiness dialog

Type: refactor
Status: resolved
Blocked by: 04

## Problem

`App.jsx` contains the inspection close-readiness view, grouping blockers and follow-up items by checklist section, mapping entries back to evidence slots, and managing dialog focus.

## Plan

- Move the dialog into a focused inspection UI module.
- Move the pure DOM ID sanitizer to a shared app utility so both the dialog and existing Checklist controls keep stable IDs.
- Preserve dialog props, grouping order, labels, navigation callback, confirmation gate, and focus behavior.

## Verification

- Add source-contract coverage for grouping, blocker navigation, gated confirmation, and focus restoration.
- Run the full regression suite and production build.
- Check rendered desktop review screens after HMR; do not trigger close, delete, or state mutation actions.

## Answer

- Moved `CloseReadinessDialog` to `src/app/dialogs/CloseReadinessDialog.jsx`; moved the pure sanitizer into `src/app/dom-safe-id.js` and imported it from both modules. Dialog props and close-readiness behavior are unchanged.
- `tools/test_close_readiness_dialog_module.mjs`, all 61 scripts in `tools/run_all_tests.mjs`, and `npm.cmd run build` passed. Authenticated desktop routes remained rendered after HMR; no close or data mutation action was triggered.
