# Company report cover QA — 2026-09-08

Implemented three live HTML covers using the approved NTR, LTP and IS8 reference artwork photo regions and original supplied logos. Report data comes from the existing report model. Company selection is ephemeral component state, not stored in a round or Snapshot.

## Verified locally

- Vite production build passed (existing bundle-size warning remains).
- Report-template model smoke test passed: 13 sections / 109 items.
- History edit test passed with Snapshot stability.
- `node tools/test_report_companies.mjs` passed: company IDs, fallback, live evidence count, no invented notes, status/tone priority and no round mutation.
- In-app browser at port 5188, demo round `round-mtmeabs2-x7ng1`: selected NTR, LTP and IS8 and inspected rendered screenshots. Each displays its distinct approved six-axle truck and scenery without a control cabinet or cut-off vehicle. Evidence remains 38 / 126 across selections.
- Corrected long report heading overlap seen during first NTR screenshot. Rechecked NTR afterward.
- Standard A4 preview renders the company cover and retains document-control metadata, signing metadata, summary and scope below it. Presentation preview retains existing evidence slides after the cover.

## Boundaries / remaining checks

- Layout is implemented in HTML, not a flattened report screenshot. Fonts, icons and live long fields differ from raster mockups; not certified pixel-identical. Long fields clamp visually with full text in title attributes; detailed report retains source information.
- A4 uses the landscape cover scaled within the portrait page, not a new portrait design.
- Actual exported PDF pagination and physical printer output have not been verified in this pass. Browser screen preview is not proof of blank-page-free printing.
- WIM pictures are illustrative approved artwork, not installation drawings or evidence. No claim that rendered sensor geometry is dimensionally certified.
- No production deployment or field/UAT validation performed.
