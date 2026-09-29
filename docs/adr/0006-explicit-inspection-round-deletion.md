# ADR 0006: Explicit deletion of inspection rounds

Status: Accepted

## Context

Closed inspection rounds are immutable so their Snapshot and results cannot be overwritten. Users also need to remove an incorrectly created or duplicated round from the current history and report lists.

## Decision

- Keep closed rounds read-only while they exist. A closed round can be removed only through an explicit delete action with confirmation of its displayed round code.
- Record deleted round IDs as tombstones so older clients cannot bring a deleted round back into the current state.
- Remove the selected round's station report and inspection context links from the current state. Keep other rounds and separately issued contract work reports intact.
- Delete evidence files only when no remaining current-state record refers to them.
- On the PostgreSQL server, record a `round.delete` audit event. Historical state revisions and backups remain governed by the existing retention policy.

## Consequences

The current history no longer shows the deleted round, while closed rounds that remain in the system are still immutable. Server state revisions and backups may retain earlier copies for recovery and audit; deleting from the application does not erase those retained copies.
