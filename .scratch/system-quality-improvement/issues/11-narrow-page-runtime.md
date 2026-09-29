# 11: Narrow routed page runtime interfaces

Type: refactor
Status: resolved
Blocked by: none

## Problem

Each routed page factory received the full shared runtime object, so a page could silently depend on values owned by unrelated routes.

## Plan

- Define the exact runtime keys required by each page factory.
- Filter the shared runtime at the route registry seam.
- Add a static contract that compares page factory destructuring with the manifest and checks missing dependencies.
- Render representative routes read-only after the change.

## Answer

- Added `src/app/page-runtime.js` with 16 factory-specific runtime interfaces and a checked `createPageRuntime()` projection. Route factories now receive only their declared names; the registry no longer passes the full `PAGE_RUNTIME` object.
- `tools/test_page_runtime_contract.mjs` verifies all 16 manifests against source destructuring, all registry uses, and missing-key failures.
- The authenticated browser smoke reviewed Dashboard, Stations, Inspections, History, new Inspection, new Station, Station Detail, Contract creation, Master Data, and Vehicle Review routes. All rendered without changing records. `node tools/run_all_tests.mjs`: 65 scripts total, 0 failed; 5 PostgreSQL-dependent integrations were skipped without an isolated test database. Production build passed.
