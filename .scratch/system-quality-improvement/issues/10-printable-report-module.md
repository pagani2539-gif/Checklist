# 10: Extract printable report presentation module

Type: refactor
Status: resolved
Blocked by: none

## Problem

`App.jsx` owns the printable report components, vehicle report views, attachment previews, and presentation helpers alongside application composition.

## Plan

- Move the report presentation component cluster to `src/app/reports/PrintableReport.jsx` without changing its markup, class names, input props, or output model.
- Inject report and application helpers explicitly while keeping existing page-runtime consumption unchanged.
- Add a module contract for exports and unresolved dependencies.

## Verification

- Run report template, evidence catalog, company cover, and print-related tests.
- Run the full regression suite and production build.
- Review relevant report markup/CSS contracts without triggering external writes.

## Answer

- Extracted 538 lines of printable report presentation into `src/app/reports/PrintableReport.jsx`. Markup, class names, props, report data, Snapshot wording, and evidence behavior remain unchanged. The page registry injects the component through its existing runtime interface.
- Added the new module to the source bundle and added an AST contract for its factory dependencies.
- Report-template, evidence-catalog, company-cover, and full-suite checks passed; `node tools/run_all_tests.mjs`: 65 scripts total, 0 failed; 5 PostgreSQL-dependent integrations were skipped without an isolated test database. `npm.cmd run build` passed. An authenticated non-persistent demo report preview rendered its cover, sections, evidence tables, and signature area; no real round was saved.
