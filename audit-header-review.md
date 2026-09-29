# Header audit — active inspection round

## Audit scope

- Surface: active inspection round header and the content above the checklist workspace.
- Capture: local Vite app at `#/inspections/round-mtmeabs2-x7ng1`, Codex In-app Browser, `1296x768` CSS pixels.
- Evidence: screenshot captured in this audit run plus the user-provided header reference image.
- Goal: let an operator identify the round, understand progress, and start the next action without scrolling through repeated context.

## Step 1 — Open the inspection round

### Strengths

- The round title is visually dominant and easy to find.
- Status progress and evidence progress are separated, which supports the checklist data model.
- Save state is visible and reassuring.
- Print and close-round actions are available without entering the checklist.
- The readiness banner explains why the round cannot close yet.

### UX risks

- **P1 — Above-the-fold area is too tall.** At the audit viewport, the context header measured about `177px`, the metadata disclosure `59px`, the readiness banner `56px`, and the filter area `105px`. The checklist workspace begins after roughly `377px` of setup content, before the operator reaches the first item.
- **P1 — Repeated information.** The page repeats `ข้อมูลประจำรอบการตรวจ` in the main heading and the metadata disclosure. The automatic-save state also appears in the header and again in the disclosure row.
- **P1 — Action hierarchy weakens when width narrows.** The menu, print, and close actions wrap into separate rows. The close action is the most consequential action, but its relationship to the other actions is not clear when they split.
- **P2 — The header mixes languages.** `ACTIVE INSPECTION ROUND` / `DEMO UI FIXTURE` compete with an otherwise Thai-first surface.
- **P2 — Secondary metadata takes a full line.** Station code, snapshot date, and equipment count are useful but currently consume a full line in the primary header.

### Accessibility risks

- The repeated heading and save-state text may create unnecessary repetition for screen-reader users.
- Muted supporting text and small progress labels should be checked for contrast at the actual token values; this cannot be confirmed from the screenshot alone.
- At tablet widths, keyboard focus order should be checked after action wrapping so the close action remains reachable before the long checklist content.

## Recommendation — compressed header v2

Use one compact header row with three zones:

1. **Identity:** `กำลังตรวจ · รอบที่ 9`, the round title, and one metadata line: `รายงาน... · 5 ก.ย. 2569 · SC-323`.
2. **Progress:** `55/115 รายการ` and `หลักฐานครบ 37/133 ช่อง` in one compact progress block.
3. **Actions:** `[เมนู] [พิมพ์] [ปิดรอบ]` kept together; close remains the blue primary action.

Then keep the editable round details as a shorter disclosure row. Remove its duplicated title and save state, leaving only `แก้ข้อมูลหัวรอบและข้อมูลลงนาม` plus one save-state indicator. Keep the readiness banner, but reduce its vertical padding and preserve the explanatory message.

This should bring the first checklist workspace into view roughly `100–140px` earlier without removing any information or changing Snapshot/history behavior.

## Evidence limits

- This is a visual and structural review; no code was changed.
- Contrast, screen-reader verbosity, keyboard tab order after responsive wrapping, and real touch ergonomics need interaction testing rather than screenshot-only judgment.

## Verdict

The header contains the right information and good trust signals, but it is carrying too much context before the work area. The highest-value fix is to remove repeated title/save-state rows and keep identity, progress, and actions in one compact responsive header.

## Implementation update

- Changed `src/app/App.jsx` to use a shorter Thai-first eyebrow/title, combine project/date/station into one line, keep Snapshot equipment context screen-reader available, and remove the duplicate save-state indicator from the editable-details row.
- Changed `src/styles/redesign.css` to keep progress and actions in one compact desktop header, keep action buttons side by side, tighten the details/readiness/filter rhythm, and preserve the existing tablet stacking rules.
- Verification: desktop `1440px` and tablet `1024px`/`768px` had no horizontal overflow. At `1440px`, the header measured about `105px` and the checklist workspace began around `417px`; before the compact pass the same workspace began around `500px`.
- `npm.cmd run build`: passed.
- `npm.cmd run test:ui-demo-fixture`: passed.
- `npm.cmd run test:flow-redesign`: passed.
- `npm.cmd run test:copy-consistency`: passed.
- Browser console: no error or warning entries observed.
