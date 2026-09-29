# 07: Extract shared page primitives

Type: refactor
Status: resolved
Blocked by: none

## Problem

The global application composition file also owned four presentation-only page primitives consumed by multiple routed pages and an unused summary-card implementation.

## Plan

- Move PageHeader, Breadcrumb, EmptyState, and ProgressBar into one shared page-primitives module.
- Remove the unused SummaryCards implementation after confirming there are no call sites.
- Preserve HTML structure, CSS classes, IDs, labels, accessibility attributes, and conditional content.
- Keep App responsible for passing the same primitive implementations through the existing page registry interface.

## Verification

- Add a contract test for exports, markup semantics, and page-registry injection.
- Run the full test suite and production build.
- Verify the current desktop routes remain rendered after HMR.

## Answer

- Moved `PageHeader`, `Breadcrumb`, `EmptyState`, and `ProgressBar` to `src/app/PagePrimitives.jsx`; `App.jsx` continues to inject the same implementations through the page registry.
- Removed `SummaryCards` after confirming it had no current imports or call sites.
- Verified the contract with `node tools/test_shared_page_primitives.mjs` and the full suite: 62 scripts passed, 0 failures. PostgreSQL/OIDC/server API/local-auth integration scripts were skipped because no isolated test database was configured.
- `npm.cmd run build` passed. Existing warnings remain for `NODE_ENV` in `.env` and the minified JavaScript bundle exceeding 500 kB.
- Read-only In-app Browser review confirmed Dashboard, Stations, Inspections, and History still render after the extraction; no close, delete, or persistence action was triggered.
