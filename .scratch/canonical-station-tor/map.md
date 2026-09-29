# Canonical Station TOR

Status: resolved

- 01 resolved — `CONTEXT.md` defines the shared station/TOR vocabulary.
- 02 resolved — Station Draft/Profile/Snapshot carry separate `torItems`.
- 03 resolved — IMPS baseline has 13 lines, 10 ชุด, 7 ระบบ.
- 04 resolved — SC Ranong baseline has 33 lines, 22 ชุด, 19 ระบบ.
- 05 resolved — creation and Station Profile UI show TOR versus installed equipment.
- 06 resolved — report model/print summary and legacy Snapshot regression are covered.
- 07 resolved — SC/IMPS format-qualified display groups, BOQ ordering, direct Asset mappings and v1 Snapshot compatibility are covered.

## Verification

Domain seam: `tools/test_station_tor_catalog.mjs`

UI seam: `tools/test_station_tor_ui.mjs` and Playwright browser inspection of the SC creation flow.
