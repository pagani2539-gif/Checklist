# 12: Separate Vehicle API profiles, configuration, response parsing, and transport

Type: refactor
Status: resolved
Blocked by: none

## Problem

`src/domain/vehicle-search.js` mixed API profile adapters, station/Proxy configuration normalization, response-envelope discovery, and direct/proxy request execution with the Vehicle review domain.

## Plan

- Move cohesive profile, configuration, response parsing, and request transport logic into focused modules.
- Preserve the existing exports from `vehicle-search.js` so application and integration callers retain their import path.
- Keep fetch injection, pagination, station identity validation, proxy enforcement, and error behavior stable.

## Answer

- Added `vehicle-api-profiles.js`, `vehicle-search-config.js`, `vehicle-search-response.js`, and `vehicle-search-transport.js` for the four cohesive responsibilities. `vehicle-search.js` remains the compatibility facade and retains its existing public imports.
- The transport module receives its domain functions through one internal factory seam, so it does not import back from the compatibility facade.
- Focused Vehicle search/configuration, proxy, review, day/night, and inline-workspace checks passed. `node tools/run_all_tests.mjs`: 65 scripts total, 0 failed; 5 PostgreSQL-dependent integrations were skipped without an isolated test database. The build passed. API payloads, endpoint paths, station validation, result IDs, and stored review/Snapshot data were not changed.
