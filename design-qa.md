# New station WIM relationship-map design QA

- source visual truth: `C:/Users/HP/AppData/Local/Temp/codex-clipboard-3848543d-81c7-428b-a4eb-41d96f71fa31.png`
- implementation screenshot: `E:/Checklist/output/playwright/new-station-wim-relationship-map-final.png`
- primary route: `http://127.0.0.1:4173/#/stations/new`
- source pixels: `1487 x 1058`
- implementation screenshot pixels: `2974 x 2117` (full-page capture)
- implementation CSS viewport: `2974 x 2116`
- implementation device scale factor: `0.5` in the headed Playwright capture
- density normalization: comparison was made by layout regions and proportions because the source is a cropped reference at a different viewport; implementation responsive rules were also checked in the in-app browser at a narrow viewport
- state: Step 2, WIM Electronics System selected, six BOQ groups visible, nested `2.3 WIM Electronics System for IMPS` child equipment visible, WIM map/unbound panel, and fixed action bar visible

## Comparison evidence

The source reference and the implementation capture were reviewed side by side. The implementation preserves the approved composition: System Catalog on the left, WIM Relationship Map in the center, relationship rules on the right, Lane → WIM Parent → Sensor/Loop nesting, unbound records, semantic icons, and the bottom action bar. The header and wizard remain the application's existing station-creation context, while the center workspace follows the reference's map treatment.

The catalog pass also verified that all six SC BOQ groups are available (`SC-01` through `SC-06`). The top WIM catalog now contains only primary WIM systems plus Sensor/Loop; WIM Electronics child assets are rendered under the selected parent system's `2.3` category instead of being flattened into the primary catalog.

Focused live evidence was captured on `#/stations/new` with the actual workflow: add Lane, add WIM Parent, add Sensor, add a second Lane and Parent, add Loop, open Parent actions, attempt a move to an occupied Lane, move to an available Lane, move back, and remove the empty Lane. The final live state showed two valid Lane/Parent relationships and no unbound records.

## Required fidelity surfaces

- Fonts and typography: Thai-first hierarchy, compact English eyebrow labels, clear system/equipment titles, and readable supporting copy are preserved through the active redesign tokens.
- Spacing and layout rhythm: three-column desktop workspace, Lane cards, nested Parent/child cards, right-side rules, and fixed footer actions match the reference hierarchy; tablet/mobile collapse rules keep the workspace usable without horizontal page overflow.
- Colors and visual tokens: blue marks Lane/System structure, green marks usable assets, orange distinguishes Loop, and fallback icons stay inside the registered AppIcon system.
- Icon fidelity: Catalog, Relationship Map, BOQ/equipment rows, unbound state, and explanatory legend use `AppIcon` names resolved through `src/app/icon-system.jsx`; icon-only controls have accessible labels.
- Copy and app content: station, Lane, Asset, parentSystemId, and BOQ values come from active application data. Reference-only counts and names were not hard-coded into persistence or APIs.

## Responsive and interaction evidence

- The in-app browser was used to verify the narrow responsive state and the live map interactions.
- The desktop Playwright capture reported `scrollWidth: 1536`, equal to the viewport width, with no horizontal document overflow.
- The live browser console returned no error or warning entries during the interaction pass.
- Duplicate Parent prevention is visible when a target Lane already contains a WIM Parent; the occupied target is disabled.
- The category regression pass confirms that selecting a WIM High Speed group exposes its nested BOQ categories, and selecting WIM Electronics exposes Cabinet, AC/DC, Network, Controller, protection, breaker, Switching DC, and Transformer rows under `2.3`.
- Existing data semantics remain intact: child records update `parentSystemId` and `laneId` together, and unbound records remain visible instead of being silently dropped.

## Findings

No actionable P0, P1, or P2 visual or interaction findings remain. The reference screenshot contains a richer seeded example with more child cards; the implementation intentionally renders the actual draft counts while supporting the same multi-Lane and multi-child structure.

## Iteration history

- Implemented the relationship-map renderer and WIM-specific actions in `ContextualStationPage.jsx`.
- Added contextual icon mappings and `link` registration in `icon-system.jsx`.
- Added workspace-only styling and responsive breakpoints in `redesign.css`.
- Restored hidden SC-01/SC-04 group entries by filtering only primary WIM systems from the secondary catalog, and stopped flattening WIM Electronics child assets into the primary catalog.
- Re-captured the desktop state after exercising two Lanes, two Parents, Sensor/Loop children, and BOQ fallback content.
- Removed the unused `รายการ Custom / อุปกรณ์เพิ่มเติม` disclosure from the Step 2 workspace, including its renderer data path, workspace CSS, and stale regression assertion; the underlying catalog/domain definition remains unchanged for existing data compatibility.

final result: passed
