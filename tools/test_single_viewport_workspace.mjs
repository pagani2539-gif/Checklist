import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readAppSource } from "./source-bundle.mjs";

const appSource = readAppSource();
const redesignCss = readFileSync(new URL("../src/styles/redesign.css", import.meta.url), "utf8");
const foundationCss = readFileSync(new URL("../src/styles/foundation.css", import.meta.url), "utf8");
const workspaceLayoutCss = readFileSync(new URL("../src/styles/workspace-layout.css", import.meta.url), "utf8");
const designDoc = readFileSync(new URL("../DESIGN.md", import.meta.url), "utf8");

assert.match(appSource, /SIDEBAR_SHORT_LABELS/, "desktop compact navigation should provide short labels");
assert.match(appSource, /aria-label=\{sidebarCollapsed \? "ขยายเมนู" : "ย่อเมนู"\}/, "sidebar toggle should announce its current action");
assert.match(appSource, /title=\{item\.label\}/, "compact navigation links should retain their full hover label");
assert.doesNotMatch(appSource, /ops-sidebar-reveal/, "collapsed navigation should not render a floating reveal button");

assert.match(foundationCss, /\.ops-shell\.is-sidebar-collapsed \.ops-sidebar \{ width: 88px;/, "collapsed desktop navigation should remain visible as an 88px rail");
assert.match(foundationCss, /\.ops-shell\.is-sidebar-collapsed \.ops-main \{ width: calc\(100% - 88px\); margin-left: 88px;/, "main content should reserve space for the compact rail");
assert.match(foundationCss, /\.ops-shell\.is-sidebar-collapsed \.ops-nav-label-short \{ display: block; \}/, "compact navigation should show short labels");
assert.match(foundationCss, /@media \(max-width: 980px\) \{\s+\.ops-shell \{ --ops-shell-sidebar-width: 0px; --ops-main-inline-gutter: 14px; \}\s+\.ops-sidebar-toggle \{ display: none; \}/, "mobile bottom navigation should keep the toggle hidden within the mobile shell rules");
assert.match(foundationCss, /\.ops-shell\.is-sidebar-collapsed \.ops-main \{[^}]*padding-inline: 24px;/s, "compact desktop content should keep a small gutter beside the rail");
assert.match(foundationCss, /\.ops-shell\.is-sidebar-collapsed \.ops-page, \.ops-shell\.is-sidebar-collapsed \.ops-topbar \{[^}]*max-width: none;[^}]*margin-left: 0;[^}]*margin-right: 0;/s, "compact desktop pages should use the available width instead of centering at 1440px");
assert.match(foundationCss, /@media \(max-width: 980px\) \{[\s\S]*\.ops-sidebar \{ inset: auto 0 0; width: 100%;[\s\S]*\.ops-main \{ width: 100%; margin-left: 0;/, "mobile navigation should become a full-width bottom bar");
assert.match(redesignCss, /@media screen and \(max-width: 600px\) \{[\s\S]*\.ops-compact-queue \{ grid-template-columns: minmax\(0,1fr\);/, "narrow mobile queue should collapse to one column");
assert.match(designDoc, /\| `1280px\+` \|/, "design system should document the wide desktop breakpoint");
assert.match(designDoc, /\| `981–1279px` \|/, "design system should document the tablet desktop breakpoint");
assert.match(designDoc, /\| `781–980px` \|/, "design system should document the mobile navigation breakpoint");
assert.match(designDoc, /\| `320–560px` \|/, "design system should document the narrow mobile breakpoint");

assert.match(appSource, /role="tablist" aria-label="พื้นที่ทำงานรอบการตรวจ"/, "workspace should expose a labelled tab list");
assert.match(appSource, /aria-selected=\{workspacePanel === "queue"\}/, "tabs should expose their selected state");
assert.match(appSource, /handleWorkspaceTabKeyDown/, "workspace tabs should support arrow, Home, and End keys");
assert.doesNotMatch(appSource, /<details className="ops-checklist-command-menu">/, "round actions should not be hidden behind a redundant expanding command panel");
assert.match(workspaceLayoutCss, /\.ops-report-menu:not\(\[open\]\) > \.ops-report-menu-panel \{ display: none; \}/, "closed report details must not leave the report editor visible");
assert.match(workspaceLayoutCss, /@media screen and \(min-width: 601px\)[\s\S]*?\.checklist-page:not\(\.is-report-previewing\):not\(\.is-vehicle-review\):not\(\.is-vehicle-decision-dock\) > \.ops-checklist-context-header > \.ops-checklist-round-actions:has\(\.ops-report-menu\[open\]\)\s*\{[^}]*grid-area:\s*auto;[^}]*grid-column:\s*1\s*\/\s*-1;/, "an open report menu should move below the checklist header instead of staying in the narrow actions grid cell");
assert.match(workspaceLayoutCss, /\.ops-checklist-round-actions:has\(\.ops-report-menu\[open\]\) > \.ops-page-actions\s*\{[^}]*min-width:\s*0;[^}]*flex-wrap:\s*wrap;/, "open report actions should wrap within the expanded header width");
assert.match(workspaceLayoutCss, /@media screen and \(max-width: 600px\)[\s\S]*\.checklist-page:not\(\.is-report-previewing\) > \.ops-checklist-context-header \{\s*grid-template-columns: minmax\(0, 1fr\);/, "narrow Checklist header should give its title a full-width row");
assert.match(workspaceLayoutCss, /\.checklist-page:not\(\.is-report-previewing\) > \.ops-checklist-context-header > \.ops-checklist-round-actions \{\s*grid-column: 1;\s*width: 100%;\s*min-width: 0;/, "narrow Checklist action group should use the full header width");
assert.match(appSource, /setWorkspacePanel\(currentIsVehicleReview \? "result" : "evidence"\); setPendingFocusItemId\(itemId\)/, "selecting a queue item should open evidence first, while vehicle review stays in its result workspace");
assert.match(appSource, /ops-task-queue-heading-summary/, "queue heading should use a non-card summary strip");
assert.doesNotMatch(appSource, /ops-task-queue-heading-side/, "queue heading should not place the status card beside the title");
assert.doesNotMatch(appSource, /<strong>\{item\.assetNo \|\| item\.id\.split/, "queue items should not expose internal English asset ids");

const resultPanelIndex = appSource.indexOf('id="workspace-panel-result"');
const evidencePanelIndex = appSource.indexOf('panelId="workspace-panel-evidence"');
assert.ok(resultPanelIndex > -1 && evidencePanelIndex > resultPanelIndex, "evidence must be a direct workspace column after the result panel");

assert.match(redesignCss, /\.ops-shell:has\(\.checklist-page:not\(\.is-report-previewing\)\)\s*\{[^}]*height:\s*100dvh/s, "checklist shell should use the dynamic viewport height");
assert.match(redesignCss, /\.ops-taskflow-layout\s*\{[^}]*grid-template-columns:\s*minmax\(260px, 280px\)\s+minmax\(440px, 1fr\)\s+minmax\(320px, 380px\)/s, "desktop workspace should use three bounded columns");
assert.match(redesignCss, /> \.ops-taskflow-layout > \.ops-task-queue-panel\s*\{[^}]*overflow:\s*hidden/s, "queue panel should contain its own scrolling region");
assert.match(redesignCss, /> \.ops-taskflow-layout > \.ops-taskflow-main\s*\{[^}]*overflow:\s*hidden/s, "result panel should not grow the document");
assert.match(redesignCss, /> \.ops-taskflow-layout > \.ops-evidence-drawer\s*\{[^}]*overflow-y:\s*auto/s, "evidence panel should scroll internally");
assert.match(redesignCss, /\.ops-evidence-drawer \.ops-attachment-dropzone\s*\{[^}]*min-height:\s*132px/s, "evidence dropzone should stay compact");
assert.match(redesignCss, /@media screen and \(max-width:\s*1279px\)[\s\S]*grid-template-areas:\s*"tabs"\s*"panel"/, "narrow workspaces should switch to full-width tabs");
assert.match(redesignCss, /\.ops-task-queue-status-metric\s*\{[^}]*font-size:\s*var\(--ops-type-xs\)/s, "queue status metric should use the shared type scale");
assert.match(redesignCss, /\.ops-task-queue-legend\s*\{[^}]*flex-wrap:\s*nowrap/s, "queue status legend should remain on one row");
assert.match(redesignCss, /\.ops-task-queue-section-toggle\s*\{[^}]*align-items:\s*start;[^}]*text-align:\s*start/s, "category cards should share a left reading edge");
assert.match(redesignCss, /\.ops-task-queue-section-copy\s*\{[^}]*justify-items:\s*start/s, "subcategory copy should align from the left");
assert.match(redesignCss, /\.ops-task-queue-item\s*\{[^}]*grid-template-columns:\s*24px\s+minmax\(0,\s*1fr\)\s+auto;[^}]*grid-template-areas:\s*"meta copy alert"/s, "item rows should reserve only the status icon rail");
assert.match(redesignCss, /> \.ops-taskflow-layout > \.ops-task-queue-panel \.ops-task-queue-item\s*\{[^}]*grid-template-columns:\s*24px\s+minmax\(0,\s*1fr\)\s+auto;[^}]*grid-template-areas:\s*"meta copy alert"/s, "legacy item selector should use the compact status rail");
assert.match(redesignCss, /\.ops-task-queue-item-copy\s*\{[^}]*justify-items:\s*start;[^}]*text-align:\s*start/s, "item copy should align from the shared left edge");
assert.match(redesignCss, /@media screen and \(max-width:\s*420px\)[\s\S]*\.ops-status-group legend\s*\{[^}]*display:\s*grid;[^}]*justify-items:\s*start;[^}]*gap:\s*2px/s, "narrow status headings should keep the helper text on its own readable line");
assert.match(redesignCss, /@media screen and \(max-width: 600px\)[\s\S]*\.sc-unified-table \{ min-width: 0; \}/, "station register table should stay inside the mobile viewport");

console.log("single viewport workspace contract tests passed");
