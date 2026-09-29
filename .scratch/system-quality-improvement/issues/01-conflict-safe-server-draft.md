# 01: Conflict-safe server draft recovery

Type: stability
Status: resolved
Blocked by: none

## Problem

When `PUT /api/v1/state` returns HTTP 409, `saveServerState` currently does not retain the just-edited client state. The UI asks the user to reload, which can discard edits that existed only in memory. Pending offline drafts also retry automatically after a version conflict.

## Plan

- Store the failed state locally with a `conflict` marker and the original expected version.
- Do not retry a marked conflict draft automatically or use it as the authoritative app state on startup.
- Keep the server copy active and show a persistent, actionable conflict notice.
- Let the operator download the saved JSON before explicitly returning to server state and clearing the local conflict draft.
- Add request timeouts; a timed out write remains a normal offline draft because its server outcome may be unknown.

## Constraints and risk

- Never automatically replay a stale full-state document against the current server version.
- Keep `/api/v1/state` payload and server version semantics unchanged.
- A downloaded draft may require manual reconciliation when the same record changed on both sides; this tranche does not invent domain-specific merge rules.

## Verification

- Unit-level mock verifies a 409 preserves the submitted draft and tags it as conflicted.
- Verify a conflicted draft is skipped by startup/online auto-sync and remains until explicit operator action.
- Verify API 409 payload/contract and core regression suite.

## Comments

- 2026-09-24: Approved for implementation as part of the system quality improvement plan.

## Answer

- `src/domain/server-storage.js` now preserves submitted state on 409 with `status: "conflict"`, distinguishes offline drafts, checks whether local persistence succeeded, and bounds state/attachment requests with 20/60 second timeouts.
- `src/app/useServerWorkspaceSync.js` does not replay marked conflicts on startup or an `online` event. It keeps the server state authoritative when available, retains later edits in the local conflict draft, and exposes export plus confirmed return-to-server actions.
- `src/app/App.jsx` presents a persistent Thai conflict banner; the discard/reload action remains disabled until the JSON draft is downloaded.
- Verification: `tools/test_server_storage_conflict.mjs`, `tools/test_server_conflict_recovery_contract.mjs`, `tools/run_all_tests.mjs` (59 scripts, 0 failures), and `npm.cmd run build` passed. PostgreSQL-backed integrations were skipped because no isolated test database was configured.
