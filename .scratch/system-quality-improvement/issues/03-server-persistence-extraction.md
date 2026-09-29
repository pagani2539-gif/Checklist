# 03: Extract server persistence lifecycle

Type: refactor
Status: resolved
Blocked by: 01

## Problem

`src/app/App.jsx` combines route/page assembly with server authentication, state loading, offline draft synchronization, version tracking, and attachment purge effects.

## Plan

- Extract only the server persistence lifecycle into a focused React hook under `src/app/`.
- Keep `App.jsx` responsible for composing the returned state, authentication surface, notifications, and page routes.
- Preserve current server API requests, reason labels, authentication behavior, and local-storage mode.

## Risk

Effect ordering and stale closures can affect autosave, pending offline state, attachment cleanup, and login transitions.

## Verification

- Run targeted persistence/server API tests and the full existing test suite.
- Exercise local and server storage startup plus 401, offline, timeout, and 409 paths with mocked or isolated test data.

## Comments

- 2026-09-24: Defer this extraction until issue 01 behavior is fixed and covered so the code move does not obscure correctness changes.

## Answer

- Extracted auth/session bootstrap, server state load/save, version tracking, offline draft replay, conflict recovery, and local draft export into `src/app/useServerWorkspaceSync.js`.
- `App.jsx` now composes the hook with local persistence and the rendered conflict banner; API routes and payload shape remain unchanged.
- Removed unused `LegacyNewStationPage`, `StationProfileOption2`, `LegacyNewInspectionPage`, the unused `createNewStationPage` import, and the now-unreferenced `src/app/pages/NewStationPage.jsx`. Repository-wide source searches found no remaining runtime references; the component map was updated.
- Verification: production build and all 59 scripts passed after extraction and cleanup. PostgreSQL-backed integrations were skipped because no isolated test database was configured.
