# Station checklist controls — Local/Test verification

## Behavior

- New rounds save `checklistWordingVersion: checklist-context-wording-v1`. Task headings describe the work (`ตรวจ…`, `วัด…`, `ทดสอบ…`, `ทำความสะอาด…`); evidence labels describe the required photo or document separately. Camera overview wording identifies the actual camera type. Repeated tasks use the registered Asset No., Scope and Lane rather than `#1` or `ลำดับที่ … จาก …`. Location is a fallback when no Asset No./Lane identifies the target; missing identity/position is stated explicitly. Source/PDF text and item/slot IDs are unchanged.
- Saved Snapshots without that wording marker retain their existing task/evidence labels, including open drafts. New wording is frozen in the new round's copy and evidence catalog, and the marker survives normalization/storage. Checklist navigation says `รายการตรวจที่ … จาก … ในรายการที่แสดง` using the same ordered items as the task queue. Editing a task label no longer overwrites its evidence label. Run `node tools/test_checklist_context_wording.mjs` for wording, scope, identity, structural compatibility and draft/history reload checks.

- New rounds use `station-item-controls-v11` with the lane/asset template. Section `3.1` is the software/system workspace: Lane-level LPR ↔ WIM reading and search checks are generated only for the exact Lane IDs linked by active LPR Systems, not every Lane sharing their Scope; system checks appear for installed LPR Systems. Each LPR System is one per Lane. Section `3.2` is the hardware workspace: physical LPR camera checks stay bound to each camera Asset No. (overview, model/Serial, voltage and cleaning). The per-camera `3.2` reading/search rows are no longer generated for new rounds. In section `4.2`, new rounds replace the standalone HDD photo row with one per-NVR disk-health/fault-count check; playback and retention remain separate. Existing v10 Snapshots retain their prior row set.
- Current WIM Electronics rows are generated from the active Asset Register. A cabinet produces cabinet overview/electrical/incoming/current checks; registered Switching DC outputs produce one row per declared voltage (12/24/48VDC); controllers produce identity and Cal Factor checks; Phase Protection, Sub Breaker and Transformer produce their own output checks. Unregistered child equipment does not create phantom rows.
- New rounds omit LAN-label checks for WIM control computers, NVRs and database servers. The source generator remains available for v9 Snapshots, which retain those rows. NVR inspection research is documented in `docs/nvr-inspection-standard.md`; its additional recommendations are not part of v10 yet.
- New rounds add one room-area cleaning control under WIM Control System (`2.2`), one surrounding-area control per active WIM cabinet under WIM Electronics (`2.3`), and one three-stage cleaning control per active cleanable Asset. Computer, cabinet, camera, NVR, database server and VMS cleaning rows stay under their equipment category; there is no separate cleaning category. Each control requires before, during and after photos.
- Checklist rows show the Thai label `ทำความสะอาดอุปกรณ์` and collapsed equipment/category headers show how many cleaning controls they contain, so operators can find the rows without moving them into a separate category. The stored Snapshot labels and report history stay unchanged.
- For the audited set of 11 active cleaning targets, one room and one cabinet area create 13 controls and 39 required photo slots. Adding or removing an active target changes its Asset-bound control; inactive equipment receives no new control. WIM Sensors, Loops and cabinet child devices do not get separate cleaning controls.
- Existing `station-item-controls-v1` through `station-item-controls-v9` Snapshots retain their policy-specific rows, evidence identities and catalog shape. In particular, v7 retains its earlier Lane-level LPR checks, v8 does not gain cleaning rows, and v9 retains the LAN-label checks. Snapshots without a checklist policy keep their historical Snapshot generator and evidence identities.
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

## Automatic program suites for new rounds (2026-10-04)

New Snapshots marked `automatic-software-tests-v1` derive seven section 6.1 program tasks and two vehicle API tasks per installed WIM scope. Active WIM Sorting Systems must link to active Lanes with a matching scope. Multiple Lanes in one scope share one program suite. SC uses independent HS and LS suites; IMPS uses only its own suite. Missing or offline endpoints leave tasks pending. Invalid relationships block creation.

Program installation choices and per-item switches are removed from station setup. Historical manual program records remain readable. Automatic tasks ignore old disable switches; other equipment controls retain them. Preview and creation use `createSnapshot` and the same item generator. Photos, documents and history-month values are required in their respective program tasks.

The policy marker is retained only when explicitly stored. Existing rounds keep their saved generators, IDs, evidence and vehicle results; no migration or fan-out of results is performed. Connection settings and system/Lane identities are frozen in new Snapshots. Test with `node tools/test_automatic_software_tests.mjs` and `node tools/test_vehicle_review_systems.mjs`.
