import assert from "node:assert/strict";
import fs from "node:fs";

const redesignCss = fs.readFileSync("src/styles/redesign.css", "utf8");
const workspaceCss = fs.readFileSync("src/styles/workspace-layout.css", "utf8");
const appText = fs.readFileSync("src/app/App.jsx", "utf8") + "\n" + fs.readFileSync("src/app/ChecklistWorkspaceParts.jsx", "utf8");

assert.match(appText, /className="ops-task-queue-item-meta"/, "queue rows should keep the status icon in a dedicated meta rail");
assert.match(appText, /className="ops-task-queue-item-copy"/, "queue rows should keep readable item copy in a separate content rail");
assert.match(appText, /getChecklistQueueItemBlocks/, "the Checklist queue should share its visible inspection and cleaning order with navigation");
assert.match(appText, /getChecklistPageQueueGroups\(sections, stationFormat, round\?\.snapshot\)/, "Checklist queue should use the shared format-specific installation-point hierarchy and Snapshot context");
assert.match(appText, /getChecklistQueueGroups\(sections, stationFormat\)/, "other queue views should retain the Snapshot-format grouping");
assert.match(appText, /className="ops-task-queue-group-toggle"/, "parent groups should have an explicit expand/collapse control");
assert.match(appText, /group\.categoryDescription : groupKindLabel/, "Checklist workpoints should show their shared Thai secondary name beneath the English title");
const checklistQueueSource = appText.slice(appText.indexOf("function ChecklistTaskQueue("));
assert.match(checklistQueueSource, /const sectionProgress = getChecklistItemsProgress\(sourceItems, round\)/, "subcategory progress should share the round's in-scope status policy");
assert.match(checklistQueueSource, /getSectionEvidenceStats\(\{ \.\.\.section, items: sourceItems \}, round\)/, "subcategory evidence progress should use the current round evidence state");
const sectionProgressMarkup = checklistQueueSource.match(/<span className="ops-task-queue-section-progress"[\s\S]*?<\/span>\s*<\/span>/)?.[0] || "";
assert.ok(sectionProgressMarkup.includes("ops-task-queue-section-progress-label\">ตรวจ")
  && sectionProgressMarkup.includes("{itemCount}/{sectionProgress.total} รายการ")
  && sectionProgressMarkup.includes("ops-task-queue-section-progress-label\">หลักฐาน")
  && sectionProgressMarkup.includes("${evidence.complete}/${evidence.total} ช่อง"), "each subcategory should render both inspection and evidence totals");
assert.ok(/\{evidence\.total \? `\$\{evidence\.complete\}\/\$\{evidence\.total\} ช่อง` : "ไม่มีช่อง"\}/.test(sectionProgressMarkup), "subcategory evidence progress should show a clear empty-state label when no evidence slots exist");
const hiddenSectionProgress = /\.checklist-page:not\(\.is-report-previewing\):not\(\.is-vehicle-review\) \.ops-task-queue-section-progress\s*\{\s*display:\s*none;\s*\}/;
assert.ok(!hiddenSectionProgress.test(workspaceCss), "responsive Checklist styles must not hide subcategory progress");
assert.match(workspaceCss, /@media screen and \(max-width: 900px\)[\s\S]*?\.ops-task-queue-section-progress\s*\{[^}]*display:\s*grid;[^}]*flex:\s*1 0 100%;[^}]*min-width:\s*0;/, "compact layouts should give subcategory progress a full-width row without allowing overflow");
assert.match(workspaceCss, /@media screen and \(max-width: 700px\)[\s\S]*?\.ops-task-queue-section-toggle\s*\{[^}]*grid-template-areas:\s*"code chevron"\s*"copy copy"\s*"progress progress";/, "the narrow subcategory row should reserve a full-width line for both progress counters");
assert.match(workspaceCss, /@media screen and \(max-width: 700px\)[\s\S]*?\.ops-task-queue-section-copy\s*\{\s*display:\s*grid;\s*min-width:\s*0;\s*grid-area:\s*copy;/, "narrow subcategory names should occupy the full row without being clipped into a narrow column");
assert.match(workspaceCss, /@media screen and \(max-width: 980px\)[\s\S]*?\.ops-task-queue-wrap > \.ops-compact-queue\s*\{\s*display:\s*none;\s*\}[\s\S]*?\.ops-task-queue-wrap > \.ops-task-queue\s*\{\s*display:\s*grid;\s*\}/, "compact screens should retain the subcategory queue so its progress remains available");
assert.match(checklistQueueSource, /getChecklistQueueItemBlocks\(equipmentGroup\.items\)/, "equipment rows should be split into visible inspection and cleaning blocks");
assert.match(checklistQueueSource, /className="ops-task-queue-cleaning-divider" role="heading" aria-level=\{5\}/, "cleaning rows should begin under a clearly labeled, accessible divider");
assert.match(checklistQueueSource, /งานทำความสะอาด<\/strong><span>\{block\.items\.length\} รายการ<\/span>/, "the cleaning divider should show its item count");
const queueScrollEffect = checklistQueueSource.match(/useEffect\(\(\) => \{\s*if \(!selected[^)]*\) return undefined;[\s\S]*?return \(\) => window\.cancelAnimationFrame\(frame\);\s*\}, \[[^\]]*\]\);/);
assert.ok(queueScrollEffect, "Checklist should keep an effect that follows the selected task");
assert.match(queueScrollEffect[0], /getElementById\(`task-queue-item-\$\{domSafeId\(currentItemId\)\}`\)/, "next-item navigation should scroll the selected checklist row into view");
assert.match(queueScrollEffect[0], /\[currentItemId, expandedEquipmentGroups, expandedGroups, expandedSections, queueGroups, selected\]/, "selected-row scrolling should retry after its group, section, and equipment list expand");
assert.match(queueScrollEffect[0], /target\.closest\("\.ops-task-queue"\)/, "selected-row scrolling should stay inside the checklist queue");
assert.match(queueScrollEffect[0], /queue\.scrollTo\(/, "the queue should scroll directly without moving the whole page");
assert.doesNotMatch(queueScrollEffect[0], /scrollIntoView/, "queue navigation should not scroll outer page containers");
assert.match(appText, /className="ops-task-queue-equipment-label"[^>]*aria-expanded=\{isEquipmentExpanded\}/, "equipment labels should expose their expand/collapse state");
assert.match(appText, /expandedEquipmentGroups/, "equipment checklist rows should be expandable under their equipment label");
assert.match(appText, /toggleEquipmentGroup\(section, equipmentGroup\)/, "equipment labels should toggle their own checklist rows");
assert.match(appText, /className="ops-task-queue-equipment-items"/, "checklist rows should render inside their selected equipment group");
assert.match(appText, /className="ops-task-queue-section-code">\{section\.queueDisplayCode \|\| section\.code\}/, "queue should visibly show the format-qualified child group code");
assert.match(appText, /ชุดระบบ \$\{group\.format\}/, "queue parent label should distinguish a station-system group from an equipment category");
assert.match(appText, /ops-coverage-groups/, "coverage summaries should list the same format-qualified groups and child codes");
assert.match(appText, /<strong>จำนวนรายการตรวจตามชุดระบบ \{format\}<\/strong>/, "coverage group row counts should identify the station format");
assert.match(appText, /aria-current=\{isGroupActive \? "page" : undefined\}/, "the active parent group should expose its current state");
assert.match(appText, /aria-current=\{isSectionActive \? "page" : undefined\}/, "the active checklist section should expose its current state");
assert.doesNotMatch(appText, /className="ops-task-queue-item-number"/, "queue rows must not show presentation/page numbers");
assert.match(appText, /aria-label=\{hierarchy === "station-categories" \? "เลือกอุปกรณ์หรือระบบ" : "เลือกอุปกรณ์"\}/, "compact responsive queue should expose the equipment/system selector in the Checklist hierarchy");
assert.match(
  redesignCss,
  /\.checklist-page \.ops-task-queue-item\s*\{[^}]*grid-template-columns:\s*24px\s+minmax\(0,\s*1fr\)\s+auto/s,
  "queue meta rail must reserve only the status icon before the item title starts",
);
assert.doesNotMatch(
  redesignCss,
  /\.checklist-page \.ops-task-queue-item\s*\{[^}]*grid-template-columns:\s*minmax\(96px,\s*max-content\)/s,
  "queue rows must not reserve a wide rail for removed presentation numbers",
);
assert.match(
  workspaceCss,
  /\.checklist-page[^\{]*\.ops-task-queue-item\s*\{[^}]*grid-template-columns:\s*24px\s+minmax\(0,\s*1fr\)\s+auto/s,
  "workspace cascade must keep only the status icon rail after presentation numbers are removed",
);
assert.match(
  workspaceCss,
  /\.checklist-page \.ops-task-queue-section-code\s*\{[^}]*display:\s*inline-flex/s,
  "checklist display-group codes should be visible in the rendered queue",
);
assert.match(
  workspaceCss,
  /\.checklist-page \.ops-task-queue-group-sections\s*\{/s,
  "queue should contain child sections inside each readable parent group",
);
assert.match(workspaceCss, /\.checklist-page \.ops-task-queue-equipment-label\s*\{[^}]*cursor:\s*pointer/s, "workspace CSS should make expandable equipment labels look interactive");
assert.match(workspaceCss, /\.checklist-page \.ops-task-queue-equipment-group\.is-expanded \.ops-task-queue-equipment-chevron \.ops-icon\s*\{/s, "workspace CSS should show which equipment checklist is open");
assert.match(workspaceCss, /\.checklist-page \.ops-task-queue-equipment-group\.is-active\s*> \.ops-task-queue-equipment-label\s*\{/s, "workspace CSS should make the active equipment label visible");
assert.match(workspaceCss, /\.checklist-page \.ops-task-queue-equipment-items\s*\{/s, "workspace CSS should contain nested equipment checklist rows");
assert.match(workspaceCss, /\.checklist-page \.ops-task-queue-cleaning-divider\s*\{[^}]*border-top:[^;]+;[^}]*border-left:[^;]+;/s, "the cleaning block should have a visible divider and category marker");

console.log("checklist queue layout regression contract passed");
