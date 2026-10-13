# Reduce save latency for focused vehicle decisions

Type: implementation
Status: ready-for-human

## Observed behavior

Before the fix, 100 browser save-and-next runs on an isolated copy with real Vehicle API images had P50 2,975 ms, P95 3,486 ms, and max 6,406 ms. Lowering only the fetch priority did not help (P95 3,520 ms). The page started storing evidence while the next car's visible images were still loading.

The narrow-read persistence prototype did not help (P95 3,622 ms), so no new database persistence design was introduced.

## Resolution and verification (12 October 2569)

- The review callback now identifies the next row. Evidence archival waits until that row's required images are ready and there has been no save for 4 seconds, then batches the queued rows for the same system/context.
- Focused vehicle result saves do not merge pending image metadata into their write. Image metadata is written after the evidence batch completes and the save queue is idle.
- Two 100-run browser tests passed on the isolated PostgreSQL copy with actual Vehicle API images through the proxy. P95 to next car/images was 1,260 ms and 1,261 ms; maxima were 1,364 ms and 1,435 ms. The repeat's final block was faster than its first block.
- Both runs saved 100 results and archived all context images. Across each run, 400 image requests returned HTTP 200 and 400 files were uploaded. Browser errors and image request failures were zero.
- The 5220 production fingerprint was identical before and after: same state SHA-256, 38,632 attachment rows, 7,711 revision rows, and max state version 7,711.
- `npm.cmd run test:all` passed 149/149 on an isolated PostgreSQL test database. Normal build passed; the HTML and referenced JavaScript/CSS served on 5220 match `release/public`, and `/health` and `/ready` are healthy.

Detailed timings and limits are in [the deferred-archive speed report](../save-speed-deferred-archive-2026-10-12.md).

## Acceptance criteria

- [x] Keep the public API payload contract and persisted IDs compatible.
- [x] Preserve authorization, version checks, operation receipt and replay, conflict rejection, audit events, projections, revision reconstruction, Snapshot data, and closed-round immutability.
- [x] Test against an isolated PostgreSQL copy with real API image reads; no closed or production round was written during these benchmarks.
- [x] Two 100-run browser tests keep P95 from click to the next row's required images at or below 1,500 ms, with no progressive increase in the repeat.
- [x] Save every result and context-required image with no browser errors; production state hash, attachment count, revisions, and max version stay unchanged.
- [x] Relevant conflict/replay/history tests, normal build, served artifacts, `/health`, and `/ready` pass.

## Constraints and next investigation

Implementation and copy-data acceptance are complete. A human still needs to confirm timing on the station's hardware/network, including a realistic pause and resume while the queued image batch is running. Keep this task `ready-for-human` until that field check is recorded.
