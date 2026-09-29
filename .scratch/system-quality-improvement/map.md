# System quality improvement

Status: ready-for-human

## Goal

Implement the approved incremental quality plan for Checklist Operations Hub while preserving current routes, API contracts, persisted data, status IDs, evidence behavior, and Inspection Snapshot/history semantics.

## Current tranche

1. Preserve unsaved browser state when a central state write returns HTTP 409; do not retry conflicted state automatically. Give the operator an explicit way to export the draft and return to the latest server state.
2. Add bounded timeouts for state API requests and treat an interrupted write as an offline draft.
3. Apply the approved Balanced field tokens to shared typography and controls, consolidate the global page heading rule, and keep workflow-specific exceptions local.
4. Extract the server persistence lifecycle from `App.jsx` into a focused hook after its behavior is covered.

## Completed first tranche

- Saved 409 drafts are marked as conflicts, are not auto-replayed, remain downloadable, and can be discarded only after export and confirmation.
- State and attachment API requests have explicit timeouts; interrupted state writes are retained as offline drafts.
- Shared typography and controls use the approved Balanced field tokens; workflow-specific sizing remains scoped.
- Server authentication, state bootstrap, draft sync, conflict recovery, and version tracking now live in `src/app/useServerWorkspaceSync.js`.
- Removed only repository-unreferenced legacy page implementations and updated the component map.
- Mobile Checklist screenshot QA exposed a squeezed header; the title now gets a full row and the round actions use full-width touch targets at 600px and below.
- `node tools/run_all_tests.mjs`: 59 scripts passed, 0 failures; database-dependent integration scripts were skipped after clearing DB environment variables. `npm.cmd run build`: passed.
- Read-only authenticated mobile review at 390px covered Dashboard, Stations, Inspections, History, and the demo Checklist; no document overflow remained after the header fix.

## Completed second increment

- Moved the shared `Button` and keyboard/focus-managed `ConfirmDialog` from `App.jsx` into `src/app/controls/ActionControls.jsx`, preserving props and behavior.
- Moved Checklist close-readiness grouping, evidence context, focus handling, and navigation into `src/app/dialogs/CloseReadinessDialog.jsx`; shared `domSafeId` now lives in `src/app/dom-safe-id.js`.
- Status badges use the caption type and semibold weight. Status border/surface colors now use semantic tokens whose values match the previous colors.
- Read-only desktop review covered Dashboard, Stations, Inspections, and History. No close, delete, or persistence action was triggered.
- `node tools/run_all_tests.mjs`: 61 scripts passed, 0 failures. `npm.cmd run build`: passed. Database-dependent integration scripts were skipped because no isolated test database was configured.

## Completed third increment

- Resolved [issue 07](issues/07-shared-page-primitives.md): moved the used page-shell primitives `PageHeader`, `Breadcrumb`, `EmptyState`, and `ProgressBar` to `src/app/PagePrimitives.jsx`; kept the existing page-registry injection contract.
- Removed the unused `SummaryCards` implementation after confirming it had no current references.
- Verified Dashboard, Stations, Inspections, and History in a read-only authenticated browser session after HMR; no write or delete action was triggered.
- `node tools/run_all_tests.mjs`: 62 scripts passed, 0 failures. `npm.cmd run build`: passed. PostgreSQL/OIDC/server API/local-auth integration scripts were skipped because no isolated test database was configured. Existing build warnings remain for `NODE_ENV` in `.env` and a minified JavaScript chunk above 500 kB.

## Completed fourth increment

- Resolved [issue 08](issues/08-vehicle-review-module.md): extracted Vehicle Review panels and local presentation helpers into `src/app/vehicle-review/ReviewPanels.jsx`, keeping the page-registry and evidence callbacks intact.
- Authenticated browser review caught a blank Vehicle demo route. The extracted module referenced `ThaiDateTimePicker` without receiving it from `PAGE_RUNTIME`; the component is now passed through the factory.
- Added a module-scope AST contract for unresolved references. It failed before the fix on `ThaiDateTimePicker` and passed after the fix.
- Rechecked the authenticated demo route read-only: Thai date/time controls, vehicle queue, API evidence, and review actions render. The demo fixture remains non-persistent.
- Focused Vehicle checks passed; `node tools/run_all_tests.mjs`: 63 scripts passed, 0 failures. Database-backed integration scripts were skipped without isolated PostgreSQL test databases. `npm.cmd run build`: passed with the existing `.env NODE_ENV` and large-chunk warnings.

## Completed fifth increment

- Resolved [issue 05](issues/05-status-badge-tokens.md): the authenticated Station Directory was checked read-only at a measured 390 CSS-pixel viewport. Visible status badges fit their content and card, and the document had no horizontal overflow.
- Resolved [issue 09](issues/09-screen-design-tokens.md): migrated 936 repeated font-size declarations and 331 exact palette declarations to semantic tokens across shared screen styles while preserving rendered values.
- `node tools/run_all_tests.mjs`: 65 scripts total, 0 failures; 5 PostgreSQL-dependent integrations skipped without an isolated test database. `npm.cmd run build`: passed with the existing `.env NODE_ENV` and large-chunk warnings. No station data was edited during the mobile review.

## Completed sixth increment

- Resolved [issue 10](issues/10-printable-report-module.md): moved the 538-line printable report cluster to `src/app/reports/PrintableReport.jsx` and kept the current page-registry injection contract.
- An authenticated, non-persistent demo report preview rendered its cover, checklist summary, vehicle evidence tables, report sections, and signatures. The report fixture was not saved as a real round.
- Full suite (65 scripts, 0 failures, 5 database-dependent skips) and production build passed.

## Completed seventh increment

- Resolved [issue 11](issues/11-narrow-page-runtime.md): added a 16-factory runtime manifest; each route factory now receives only the values it declares. The AST contract and authenticated read-only route smoke passed.
- Full suite passed: 65 scripts total, 0 failures, 5 database-dependent skips; the production build passed.

## Completed eighth increment

- Resolved [issue 12](issues/12-vehicle-search-domain-modules.md): separated Vehicle API profile adapters, station connection configuration, response-envelope parsing, and direct/Proxy transport into focused modules while retaining the existing `vehicle-search.js` import surface.
- Focused Vehicle tests passed. Full suite passed: 65 scripts total, 0 failures, 5 database-dependent skips; the production build passed. No API payload, route, station target rule, stored review, or Snapshot contract changed.

## Follow-up

- Continue App composition cleanup only along cohesive module seams; `App.jsx` has been reduced from the earlier 3,720-line baseline to 2,324 lines, and a larger state-orchestration rewrite still needs its own contract and review.
- Continue semantic token adoption for remaining workflow-specific values only when a matching shared role is clear; report-container sizing and intentionally local exceptions remain scoped.
- Keep Public Go blocked on the outstanding production infrastructure and owner/security checks listed in `.scratch/public-release-readiness-2026-09-23.md`.

## Issues

- [01: Conflict-safe server draft recovery](issues/01-conflict-safe-server-draft.md)
- [02: Balanced field shared UI tokens](issues/02-balanced-field-tokens.md)
- [03: Extract server persistence lifecycle](issues/03-server-persistence-extraction.md)
- [04: Extract shared action controls](issues/04-shared-action-controls.md)
- [05: Centralize status badge roles](issues/05-status-badge-tokens.md)
- [06: Extract inspection close-readiness dialog](issues/06-close-readiness-dialog.md)
- [07: Extract shared page primitives](issues/07-shared-page-primitives.md)
- [08: Extract Vehicle API review UI](issues/08-vehicle-review-module.md)
- [09: Adopt screen typography and palette tokens](issues/09-screen-design-tokens.md)
- [10: Extract printable report presentation module](issues/10-printable-report-module.md)
- [11: Narrow routed page runtime interfaces](issues/11-narrow-page-runtime.md)
- [12: Separate Vehicle search domain modules](issues/12-vehicle-search-domain-modules.md)

## Comments

- 2026-09-24: User approved the previously presented audit and implementation plan. The first verifiable tranche and read-only authenticated mobile coverage are complete; desktop workflow QA, full typography adoption, and Public Go infrastructure remain follow-up work.
- 2026-09-24: User asked to continue. This increment extracted shared action controls, the inspection close-readiness dialog, and semantic tokens for the common status badge; Public Go gates remain human/environment work.
- 2026-09-24: Second increment implemented and verified; narrow mobile review of the new badge typography remains open.
- 2026-09-24: Continue the composition cleanup by consolidating four used page-shell primitives and removing the unused summary-card implementation after a source-reference check.
- 2026-09-24: Third increment resolved. Page primitives and unused summary-card cleanup are complete; full suite/build and read-only desktop route review passed. Status-badge mobile wrapping and the broader follow-up items remain open.
- 2026-09-24: Fourth increment resolved. Vehicle Review panels now live in their own module. Browser QA found and fixed a missing ThaiDateTimePicker dependency before closing the issue; full suite/build and authenticated demo-route review passed.
- 2026-09-25: Fifth increment resolved. Narrow-mobile status badges were verified at 390 CSS pixels and shared screen token migration was completed; full suite/build passed.
- 2026-09-25: Sixth increment resolved. Printable report presentation and its contract checks were extracted; authenticated demo preview, full suite, and build passed.
- 2026-09-25: Seventh increment resolved. Route factories receive narrow runtime projections; static AST checks and authenticated read-only route smoke passed.
- 2026-09-25: Eighth increment resolved. Vehicle API profiles, station configuration, response parsing, and transport were split behind the existing facade; focused Vehicle checks passed.
- 2026-09-25: All agent-executable tickets 01-12 are resolved and the repository code tranche is verified. Human/environment gates remain before Public Go: isolated PostgreSQL integration coverage, production deployment checks, and Owner/Security sign-off. Further App/CSS cleanup is non-blocking follow-up work, not a gate for this completed code tranche.
