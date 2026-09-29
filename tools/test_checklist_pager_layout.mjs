import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pageSource = readFileSync(new URL("../src/app/pages/ChecklistPage.jsx", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../src/app/App.jsx", import.meta.url), "utf8");
const redesignCss = readFileSync(new URL("../src/styles/redesign.css", import.meta.url), "utf8");
const foundationCss = readFileSync(new URL("../src/styles/foundation.css", import.meta.url), "utf8");
const workspaceCss = readFileSync(new URL("../src/styles/workspace-layout.css", import.meta.url), "utf8");

assert.match(pageSource, /getChecklistPageNavigationItems\(visibleSections\)/, "pager navigation should use the same sorted item order as the displayed station-category queue");
assert.doesNotMatch(pageSource, /visibleSections\.flatMap\(\(section\) => section\.items/, "pager navigation should not independently flatten raw source sections");

const resultPanel = pageSource.match(/<div className="ops-panel ops-items-panel ops-taskflow-main"[\s\S]*?ChecklistPager[\s\S]*?\n\s*<\/div>\s*\n\s*\{!currentIsVehicleReview/);
assert.ok(resultPanel, "checklist result panel should retain its result and pager controls");
assert.doesNotMatch(appSource, /ops-item-note-block|ops-item-note-toggle|หมายเหตุเพิ่มเติม/, "checklist item result layout should not render the removed additional-note block");
assert.doesNotMatch(pageSource, /pendingFocusNote|focusNote|onFocusNoteComplete/, "checklist navigation should not retain focus behavior for the removed note field");

assert.doesNotMatch(redesignCss, /\.ops-taskflow-main > \.ops-item-pager\s*\{[^}]*position:\s*sticky/s, "pager must not be sticky on the workspace parent");
assert.doesNotMatch(foundationCss, /\.ops-item-pager\s*\{[^}]*position:\s*sticky/s, "global pager rule must not overlay unrelated workspace content");
assert.match(workspaceCss, /\.checklist-page:not\(\.is-report-previewing\):not\(\.is-vehicle-review\) > \.ops-taskflow-layout > \.ops-taskflow-main\s*\{[^}]*overflow-x:\s*hidden;[^}]*overflow-y:\s*auto;[^}]*overscroll-behavior:\s*contain/s, "desktop result panel should own scrolling across its full width");
assert.match(workspaceCss, /\.checklist-page:not\(\.is-report-previewing\):not\(\.is-vehicle-review\) > \.ops-taskflow-layout > \.ops-taskflow-main > \.ops-check-section-list\s*\{[^}]*height:\s*auto;[^}]*flex:\s*0 0 auto;[^}]*overflow:\s*visible/s, "desktop result content should not create a second nested scroll area");
assert.match(workspaceCss, /\.checklist-page:not\(\.is-report-previewing\):not\(\.is-vehicle-review\) > \.ops-taskflow-layout > \.ops-taskflow-main > \.ops-item-pager\s*\{[^}]*position:\s*sticky;[^}]*bottom:\s*0;[^}]*margin-top:\s*auto/s, "desktop pager should stay at the bottom of the result scroll panel");
assert.match(workspaceCss, /\.ops-item-pager > \.ops-item-pager-actions \.ops-button\s*\{[^}]*min-height:\s*36px[^}]*padding:\s*4px 6px[^}]*font-size:\s*var\(--ops-type-caption-sm\)/s, "pager buttons should stay compact while using the shared caption token");

assert.match(redesignCss, /grid-template-areas:\s*"heading heading"\s*"evidence result"\s*"evidence pager"/s, "desktop workspace must reserve a dedicated pager row under the result column");
assert.match(workspaceCss, /\.checklist-page:not\(\.is-report-previewing\):not\(\.is-vehicle-review\) > \.ops-taskflow-layout > \.ops-taskflow-main > \.ops-check-section-list\s*\{[^}]*padding-bottom:\s*20px/s, "result content should keep breathing room above the pager");

console.log("checklist pager layout regression contract passed");
