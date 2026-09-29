# Station checklist controls — Local/Test verification

## Behavior

- New rounds use `station-item-controls-v9` with the lane/asset template. Section `3.1` is the software/system workspace: Lane-level LPR ↔ WIM reading and search checks are generated only for lanes whose operational scope has an active LPR Control System; system checks appear for installed LPR Systems. Section `3.2` is the hardware workspace: physical LPR camera checks by Asset No. (overview, model/Serial, voltage and cleaning). The per-camera `3.2` reading/search rows are no longer generated for new rounds.
- Current WIM Electronics rows are generated from the active Asset Register. A cabinet produces cabinet overview/electrical/incoming/current checks; registered Switching DC outputs produce one row per declared voltage (12/24/48VDC); controllers produce identity and Cal Factor checks; Phase Protection, Sub Breaker and Transformer produce their own output checks. Unregistered child equipment does not create phantom rows.
- New rounds add one room-area cleaning control under WIM Control System (`2.2`), one surrounding-area control per active WIM cabinet under WIM Electronics (`2.3`), and one three-stage cleaning control per active cleanable Asset. Computer, cabinet, camera, NVR, database server and VMS cleaning rows stay under their equipment category; there is no separate cleaning category. Each control requires before, during and after photos.
- Checklist rows show the Thai label `ทำความสะอาดอุปกรณ์` and collapsed equipment/category headers show how many cleaning controls they contain, so operators can find the rows without moving them into a separate category. The stored Snapshot labels and report history stay unchanged.
- For the audited set of 11 active cleaning targets, one room and one cabinet area create 13 controls and 39 required photo slots. Adding or removing an active target changes its Asset-bound control; inactive equipment receives no new control. WIM Sensors, Loops and cabinet child devices do not get separate cleaning controls.
- Existing `station-item-controls-v1` through `station-item-controls-v8` Snapshots retain their policy-specific rows, evidence identities and catalog shape. In particular, v7 retains its earlier Lane-level LPR checks, and v8 does not gain cleaning rows. Snapshots without a checklist policy keep their historical Snapshot generator and evidence identities.
- `getStationChecklistItems(snapshot, { includeDisabled: true })` supplies the station switches. The default excludes disabled rows; creation, progress, evidence and reports use this same list.
- Lane, installed System, physical Asset and station-level rows are labeled by source in the station settings and Checklist. Station-level controls such as the intentional section `6.1` remain available without being presented as installed equipment.
- Physical equipment excludes inactive records, legacy Lane records and system-only rows. Each asset receives its own complete recipe. Equipment with no specialized recipe receives a general condition check under its category (or the general reporting section when its category is not in the evidence template).
- Controls use recipe + asset ID, or lane ID, never the displayed position. Cleaning evidence IDs stay tied to the Asset; area controls use their own stable IDs and do not count as a second equipment cleaning recipe.
- `disabledItemIds` stores per-item controls. `legacyResolved` freezes legacy position-based off settings into stable IDs on station normalization or first edit/creation. The original `disabledTemplateIds` remain for compatibility. No equipment records, existing rounds or attachments are deleted.
- Creation rejects an empty enabled checklist. An asset with all checks disabled stays in the station register and the UI explains why it has no form rows.

## Automated verification (current)

Run `npm.cmd run test:station-checklist-controls` for every switch, per-Asset cleaning controls, inactive equipment, reorder/add/remove stability, empty-round rejection, preview/report/count agreement, persistence and frozen snapshots. Run `node tools/test_equipment_cleaning.mjs` for the 11-target acceptance set, all 39 photo slots, category placement and the legacy cleaning gate.

The positional evidence, cleaning, report, lifecycle, copy and video-migration regression suites use the explicit `tools/legacy_round_fixture.mjs` fixture. They retain the original assertions for pre-policy rounds. Station creation and item-library tests exercise the new creation behavior.

For the v9 installed-scope and cleaning policy, also verify the standard report print layout: each cleaning control gets its own A4 page with equipment category, Asset No., position and three photo columns. Existing v8/open and historical rounds must remain on their saved item set. PostgreSQL integration still depends on `CHECKLIST_POSTGRES_TEST_DATABASE_URL`.

## v9 cleaning report preview verification (2026-09-30)

- `tools/cleaning-report-preview.html` renders an isolated synthetic round with 13 cleaning pages for 11 Assets and 2 area controls; all 39 sample images loaded.
- Cleaning pages retain the source category code and name (`2.2`, `2.3`, `3.2`, `4.1`, `4.2`, `7.1`) within the format-qualified Checklist presentation groups.
- The standard print rules and automated assertions confirm a page break per cleaning item and a three-column photo layout. This verifies the browser report structure, not a physical printer or field/UAT run.

## Historical browser verification (2026-09-05)

Tested on isolated origin `http://127.0.0.1:5187`, not the operational browser's stored station data:

- This is an older browser run, before the v9 cleaning layout; its counts are historical and do not describe the new policy.
- Current isolated default-station baseline: 21 physical devices, 97 checklist items and 128 evidence slots (including 14 per-asset cleaning items, 2 area-cleaning items and 2 NVR operational items).
- Disabled a general item, camera LPR-02 serial-number item and LPR-02 cleaning. Reload preserved 3 disabled switches. Preview and created round both showed 114 checks and 134 evidence slots; the camera-one controls remained present.
- Clicked every remaining switch off. The station showed zero enabled checks and listed equipment with no enabled checks. The new-round page displayed “ไม่มีรายการตรวจที่เปิดใช้งาน” and disabled creation.
- Reopened the earlier draft after disabling all station checks: it still contained 114 checks.
- Browser console: no errors/warnings; observed viewport and document width both 792 px (no horizontal overflow).

No field/UAT, physical camera or physical printing verification is claimed. Test-only station settings and one draft remain on the isolated test origin; operational data was not manually changed.
