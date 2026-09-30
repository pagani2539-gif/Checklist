# 01: Merge non-overlapping workspace drafts

Type: feature
Status: ready-for-human
Blocked by: none

## Problem

When a browser saves a workspace based on an older state version, the server attempts to merge it with the current PostgreSQL state. The previous merge stopped when two edits touched the same station, even if they changed different records or fields. The client then preserved the draft and stopped syncing until someone resolved it manually.

## Implementation

- Compare the saved base, current server state, and incoming draft recursively.
- Merge disjoint object fields and records in arrays keyed by `id` automatically. Continue to union round deletion tombstones and filter related report links.
- Keep the optimistic version guard. If both sides changed the same field, return the server candidate state and conflict paths without committing the draft.
- Show a conflict resolver with the current server value and draft value for each overlapping path. Keep non-overlapping draft changes in the candidate, then save the user's choices against the latest version.
- Return the authoritative merged state after an automatic merge so the client does not continue from an outdated workspace snapshot.
- On startup, retry older conflict drafts against their recorded base version. Safe drafts merge automatically; overlapping changes are upgraded to the new resolver.
- Preserve the existing download-and-discard recovery for older conflict drafts and conflicts that cannot be safely described.

## Acceptance

- Concurrent changes to separate records or fields merge without dropping either side.
- Conflicting edits to the same field remain protected and can be resolved by choosing the server or draft value per field.
- A further server update during resolution causes a fresh merge attempt or updated conflict list; it never silently overwrites data.
- Station-scoped users receive only their scoped candidate state.

## Verification

- `node --check server/postgres-store.mjs` passed.
- `node --check server/api.mjs` passed.
- `node --check src/domain/state-merge.js` passed.
- `npm run build` passed (Vite reported the existing large-chunk advisory).
- PM2 `checklist` restarted and reported `online`.
- Automated tests and a browser conflict-recovery smoke test were not run. Confirm with two sessions that disjoint edits merge, then create one same-field conflict and verify both choices save correctly.
