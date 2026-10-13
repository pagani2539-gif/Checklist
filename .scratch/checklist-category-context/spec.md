# Checklist category context recovery

Status: resolved

## Problem

Checklist records with a recognized BOQ/Checklist section code can still appear under `Legacy / Unmapped`. The code identifies the equipment main category, but a workpoint may require an additional scope such as High Speed, Low Speed, 3D, ImPS, or Central. When a record has no scope and no reliable asset/system relationship from which to derive one, `resolveChecklistWorkpoint()` returns no workpoint. `getChecklistPageQueueGroups()` currently sends all such records to the same unmapped bucket. This hides known category context and can show the same subcategory twice: once with scoped records and again as a bare code under `Legacy / Unmapped`.

## Goal

Keep every recognized source category visible even when its installation scope cannot be resolved. Use `Legacy / Unmapped` only for records whose source category itself is unknown or unsupported. Never guess a scope from a similar name or a neighboring record.

## Plan

1. Keep the category lookup and workpoint lookup as separate decisions. A recognized source code establishes its main category even when `resolveChecklistWorkpoint()` cannot choose a scope.
2. Resolve scope only from direct item scope or an explicit Snapshot relationship. For Assets, follow the saved parent/equipment relationship as appropriate; for Systems, use the linked saved System record. For WIM Sensor/Loop, the parent WIM system's Lane and scope take precedence over stale child values.
3. Put records with a known category but unknown scope in a clearly named group using that category's label, retaining their original BOQ/Checklist subcategory and equipment/system identity. Show that the scope is unresolved so the inspector can spot the missing data.
4. Keep records whose source code has no known category in `Legacy / Unmapped`, at the end of the queue.
5. Keep queue display order and Previous/Next order derived from the same grouped item sequence. Ensure every source item appears exactly once.
6. Preserve Snapshot, inspection status, evidence, and historical round data. This change affects checklist presentation only; do not backfill or rewrite saved inspection data as part of grouping.

## Acceptance criteria

- A mapped code such as `2.2`, `3.1`, `5.1`, or `6.1` does not become `Legacy / Unmapped` solely because it lacks a resolvable scope.
- Its category and subcategory names remain visible, and its unresolved scope is stated plainly.
- An Asset with a saved scope or parent relationship appears under the matching workpoint. A linked WIM child follows its parent system and Lane.
- Truly unknown section codes remain at the end under `Legacy / Unmapped`.
- No item is lost or duplicated; totals for status and evidence remain unchanged.
- Queue order and Previous/Next order agree for SC and IMPS layouts.
- Existing and closed rounds continue to read from their saved Snapshot without edits.

## Current evidence and progress

- The live round at port 5220 originally showed 96 records under `Legacy / Unmapped` despite linked Assets having a High Speed scope.
- Reading saved Snapshot Asset/System relationships reduced the unmapped group to 14. The remaining LPR and Data/Control items had no direct item scope, even though the BOQ presentation rules already placed them in `SC-01` and `SC-06`.
- The queue now uses the same BOQ grouping rules to resolve that context: the LPR items appear under `LPR for HS`, and the nine Data/Control items appear under `Data/Control Central`.
- A current-round area-cleaning row with a recognized source category and a linked Asset follows that Asset's resolved workpoint. For example, the cabinet-area row for `CAB-HS-01` uses category `2.3` and appears under `WIM HS`; `isAreaCleaning` no longer sends it to the standalone `Cleaning` group first. Historical `6.2`/`6.3` cleaning rows remain in `Cleaning`.
- On the same live round, `Legacy / Unmapped` is gone. The queue still contains 110 items, the header remains 24/108 inspected and 22/141 evidence slots complete, and no Snapshot data was edited.
- Queue grouping, BOQ group fallback, Snapshot scope inheritance, separate cleaning presentation, source-code title fallback, and queue/pager order were updated in `src/app/checklist-queue-state.js`, `src/domain/boq-checklist-groups.js`, `src/app/App.jsx`, and `src/app/pages/ChecklistPage.jsx`.

## Completion

The known-category/unresolved-scope branch remains a safe fallback for future records that have no valid workpoint relationship or BOQ grouping. The same round was rebuilt into `release/public`, reloaded from port 5220, and visually checked. No `Legacy / Unmapped` group appears for this round.

The cabinet-area cleaning regression now verifies the current category context, the queue and pager grouping, and keeps historical cleaning sections separate. The current client bundle was rebuilt into `release/public` and served successfully from port 5220; the authenticated station view still requires a signed-in browser session for visual verification.
