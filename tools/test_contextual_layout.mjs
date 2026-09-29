import assert from "node:assert/strict";
import fs from "node:fs";
import { getChecklistWorkContext } from "../src/domain/checklist-context.js";
import { buildStationRelationshipTree } from "../src/domain/station-relationship-tree.js";
import { readAppSource } from "./source-bundle.mjs";

assert.equal(getChecklistWorkContext({}, {}).key, "condition");
assert.equal(getChecklistWorkContext({ inputType: "number" }, {}).key, "measurement");
assert.equal(getChecklistWorkContext({ assetId: "asset-1", inputType: "number" }, {}).key, "asset");
assert.equal(getChecklistWorkContext({ kind: "system", inputType: "none" }, {}).key, "system-service");
assert.equal(getChecklistWorkContext({ systemId: "wim", inputType: "none" }, {}).key, "system-service");
assert.equal(getChecklistWorkContext({ evidenceSlots: [{ id: "one" }, { id: "two" }] }, {}).key, "evidence");
assert.equal(getChecklistWorkContext({}, { status: "damaged" }).key, "issue");
assert.equal(getChecklistWorkContext({}, { status: "waiting" }).key, "issue");
assert.equal(getChecklistWorkContext({}, { status: "na" }).key, "bypass");
assert.equal(getChecklistWorkContext({}, { status: "not-installed" }).key, "bypass");
assert.equal(getChecklistWorkContext({}, {}, { vehicleReview: true }).key, "vehicle");

const emptyStationGroups = buildStationRelationshipTree({ stationFormat: "SC", includeEmptyGroups: true });
assert.equal(emptyStationGroups.length, 6, "the SC station setup should expose all six status groups");
assert.ok(emptyStationGroups.every((group) => !group.hasData), "empty SC groups should all report no selected records");
const assetOnlyGroup = buildStationRelationshipTree({
  stationFormat: "SC",
  systems: [],
  equipment: [{ id: "qa-lpr-camera", type: "LPR_CAMERA", categoryCode: "3.2", scope: "High Speed", active: true }],
  includeEmptyGroups: true,
}).find((group) => group.groupId === "SC-01");
assert.equal(assetOnlyGroup?.systemCount, 0, "the asset-only fixture should not depend on a System");
assert.equal(assetOnlyGroup?.assetCount, 1);
assert.equal(assetOnlyGroup?.hasData, true, "an Asset without a System should mark its category as selected");

const appSource = readAppSource();
const css = fs.readFileSync(new URL("../src/styles/workspace-layout.css", import.meta.url), "utf8");
const contextualSource = fs.readFileSync(new URL("../src/app/pages/ContextualStationPage.jsx", import.meta.url), "utf8");
const inlineEditorSource = fs.readFileSync(new URL("../src/app/StationRelationshipInlineEditor.jsx", import.meta.url), "utf8");
const relationshipRegisterSource = fs.readFileSync(new URL("../src/app/StationRelationshipRegister.jsx", import.meta.url), "utf8");
const redesignCss = fs.readFileSync(new URL("../src/styles/redesign.css", import.meta.url), "utf8");
for (const layout of ["dashboard", "station-directory", "station-workspace", "station-setup", "round-queue", "round-setup", "inspection-workspace", "vehicle-review", "history-library", "history-detail", "history-vehicle-review", "revision-setup"]) {
  assert.ok(appSource.includes(`\"${layout}\"`), `route layout ${layout} should be declared`);
}
assert.match(appSource, /data-checklist-context=\{currentChecklistContext\.key\}/);
assert.match(appSource, /data-checklist-mode=\{readOnly \? "history" : "active"\}/);
assert.match(css, /data-checklist-context="measurement"/);
assert.match(css, /data-checklist-context="evidence"/);
assert.match(css, /data-checklist-context="issue"/);
assert.match(appSource, /รายการตรวจในหมวดย่อยนี้/);
assert.match(appSource, /<h3 id="checklist-current-item-heading" tabIndex="-1">ข้อมูลรายการตรวจ<\/h3>/);
assert.match(appSource, /<h3 id="evidence-drawer-title">หลักฐานประกอบ<\/h3>/);
assert.match(appSource, /ops-current-item-facts/);
assert.match(css, /grid-template-columns:\s*300px\s+minmax\(440px,\s*1fr\)\s+390px/);
assert.match(css, /> \.ops-taskflow-layout > \.ops-evidence-drawer\s*\{[\s\S]*?grid-column:\s*2/);
assert.match(css, /> \.ops-taskflow-layout > \.ops-taskflow-main\s*\{[\s\S]*?grid-column:\s*3/);
assert.match(css, /\.ops-status-choice-grid\.ops-status-single-choice\s*\{\s*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
assert.match(appSource, /ops-checklist-strip-title/);
assert.match(appSource, /ops-checklist-round-actions/);
assert.doesNotMatch(appSource, /ops-checklist-command-menu/);
assert.match(appSource, /contextAssetTypes = useMemo/, "contextual add panels must derive Asset types from the selected operation group");
assert.match(appSource, /!initialBoqGroupCode && contextGroup \? contextAssetTypes\.has\(item\.type\) : true/, "contextual add panels must constrain equipment to the selected group when the add flow is group-scoped");
assert.doesNotMatch(appSource, /!contextGroup \|\| item\.kind === "custom"/, "Custom items must stay outside the contextual group panel");
assert.match(appSource, /openAddPanel\(selectedGroup\?\.id \|\| null, ""\)/, "station profile should use one contextual add action with a type switch");
const step2Start = contextualSource.indexOf('{step === 2 && <section className="ops-station-equipment-workspace');
const step3Start = contextualSource.indexOf('{step === 3 && <section', step2Start);
const stationSetupMarkup = contextualSource.slice(step2Start, step3Start);
assert.doesNotMatch(stationSetupMarkup, /StationRelationshipRegister/, "station setup should not duplicate the station profile relationship tree");
assert.match(stationSetupMarkup, /ops-station-group-list/, "station setup should provide a BOQ group navigation rail");
assert.match(stationSetupMarkup, /aria-current=\{isCurrentGroup \? "location" : undefined\}/, "the current BOQ group should expose its location accessibly");
assert.match(stationSetupMarkup, /aria-controls="station-work-spec-panel"/, "selecting a category should target the central Work Spec panel");
assert.match(stationSetupMarkup, /ops-station-work-spec-panel/, "the center panel should display Work Spec rows for the selected category");
assert.match(contextualSource, /const activeWorkSpecSections = \(\(\) => \{/, "the center Work Spec list should be derived from the selected BOQ category");
assert.doesNotMatch(stationSetupMarkup, /เปิดทุกกลุ่ม|ยุบทุกกลุ่ม/, "station setup should show one selected group instead of expanding all groups");
assert.match(stationSetupMarkup, /const hasItems = group\.hasData/, "category selection status should derive from real installed System and Asset records");
assert.match(stationSetupMarkup, /hasItems \? "is-selected" : "is-empty"/, "category selection status should be independent from the currently open category");
assert.match(stationSetupMarkup, /hasItems \? "เลือกแล้ว" : "ยังไม่เลือก"/, "every category should have a visible text status");
assert.doesNotMatch(stationSetupMarkup, /ops-station-group-mobile-select/, "small screens should keep the full status list visible instead of hiding categories in a dropdown");
assert.match(redesignCss, /\.ops-station-group-state\.is-selected\s*\{[^}]*var\(--ops-success-soft\)[^}]*var\(--ops-success\)/, "selected categories should use the shared green success colors");
assert.match(redesignCss, /\.ops-station-group-state\.is-empty\s*\{[^}]*var\(--ops-color-neutral-surface\)[^}]*#526174/, "empty categories should use high-contrast neutral colors");
assert.match(redesignCss, /@media screen and \(max-width: 980px\)\s*\{[\s\S]*?\.ops-station-group-list\s*\{\s*grid-template-columns:/, "small screens should keep all category statuses in a compact responsive list");
assert.match(stationSetupMarkup, /ค้นหาชื่ออังกฤษหรือไทย/, "the group rail should offer bilingual search");
assert.match(contextualSource, /relationshipGroupSearchText/, "search should include group, category, installed record, and catalog names");
assert.match(contextualSource, /addWorkSpecEquipment = \(item\) => \{/, "asset options in Work Spec should use the relationship-aware add flow");
assert.match(contextualSource, /addWorkSpecSystem = \(\{ card, definition \}\) => \{/, "System Work Spec options should use the relationship-aware add flow");
assert.match(contextualSource, /renderInlineRelationshipEditor\(asset, "asset", scope\)/, "editing an installed Asset should expand in its Work Spec row with the selected Scope");
assert.match(contextualSource, /relationshipGroupSecondaryLabel\(activeRelationshipGroup\)/, "the selected group heading should include its contextual Thai name");
assert.match(contextualSource, /name\.secondary\}/, "Work Spec item names should display Thai as the secondary label");
assert.match(relationshipRegisterSource, /option\.nameTh && option\.nameTh !== option\.nameEn/, "available System and Equipment choices should display English then Thai names");
assert.doesNotMatch(stationSetupMarkup, /ops-station-system-rail|ops-station-system-search|ops-wim-catalog-list|renderRelationshipMap\(\)/, "the old duplicate catalog rail and WIM map should not remain in station setup");
assert.doesNotMatch(stationSetupMarkup, /ติดตั้งจริง.{0,30}แม่แบบ|แม่แบบ.{0,30}ติดตั้งจริง/, "station setup should not require switching to a template view");
assert.match(contextualSource, /onClick=\{\(\) => deleteRelationshipRecord\(asset, "asset"\)\}/, "Asset rows should expose their delete action directly");
assert.match(contextualSource, /ยังไม่มี WIM Sorting System ใน Lane นี้/, "deleting the WIM parent should leave an explicit empty-state label instead of looking like the System is still installed");
assert.match(contextualSource, /aria-label=\{`ลบ Lane \$\{laneNo\}`\}[\s\S]*?deleteLaneFromRegister\(lane\.id\)/, "each WIM Lane should expose a direct delete action with its existing confirmation behavior");
assert.match(contextualSource, /ลบ WIM Sorting System #/, "successful WIM parent deletion should provide visible status feedback");
assert.match(contextualSource, /equipment: current\.equipment\.filter\(\(asset\) => asset\.laneId !== laneId && !parents\.has\(asset\.parentSystemId\)\)/, "removing a Lane should also remove WIM equipment still linked by Lane when its Parent binding is missing");
assert.match(contextualSource, /hiddenWorkSpecSystemIds = new Set\(\["wim-control", "wim-electronics-system"\]\)/, "the agreed duplicate WIM software System rows should stay hidden in Work Spec");
assert.match(contextualSource, /StationRelationshipInlineEditor/, "station setup should render the inline editor component");
assert.match(inlineEditorSource, /บันทึก|บันทึกการแก้ไข/);
assert.match(inlineEditorSource, /ยกเลิก/);
assert.match(relationshipRegisterSource, /disabled=\{!canAdd\}/);
assert.match(relationshipRegisterSource, /เพิ่ม Lane และ WIM Sorting System ใน Scope นี้ก่อน/);
assert.match(appSource, /นำ Asset .* ออกจากร่าง/, "removing entered Asset data must use the existing confirmation path");
assert.match(contextualSource, /categoryCodesForReferenceGroup/, "BOQ category expansion must be derived from the selected group");
assert.match(contextualSource, /setExpandedBoqCategories\(categoryCodesForReferenceGroup\(/, "changing format/group must open the selected group's real categories");
assert.match(redesignCss, /\.ops-reference-group > summary[\s\S]*?grid-template-columns:\s*22px 84px minmax\(72px,\s*auto\) minmax\(0,\s*1fr\) auto/, "BOQ group header must allocate five explicit columns");
assert.match(redesignCss, /\.ops-reference-category > summary[\s\S]*?grid-template-columns:\s*22px 34px minmax\(46px,\s*auto\) minmax\(0,\s*1fr\) auto/, "BOQ category header must allocate five explicit columns");
assert.match(redesignCss, /grid-template-areas:\s*"code name quantity asset-label asset-inputs menu"/, "BOQ equipment rows must declare responsive areas");
assert.match(redesignCss, /\.ops-reference-system-row\s*\{[^}]*grid-template-columns:\s*54px 28px minmax\(0,\s*1fr\) auto/, "System rows must keep an independent four-column layout");
assert.match(redesignCss, /\.ops-wim-other-workspace \.ops-reference-equipment-row > \.ops-reference-item-code\s*\{\s*grid-area:\s*code/, "Equipment grid areas must be scoped to equipment rows");
assert.doesNotMatch(redesignCss, /\.ops-wim-other-workspace \.ops-reference-item-code\s*\{\s*grid-area:\s*code/, "Equipment grid areas must not leak into System rows");
assert.match(redesignCss, /\.ops-wim-other-workspace\s*\{[^}]*container-type:\s*inline-size/, "BOQ rows must respond to the actual table width");
assert.match(redesignCss, /\.ops-reference-item-name strong[^}]*white-space:\s*normal/, "equipment names must wrap instead of being clipped");
assert.match(redesignCss, /\.ops-station-new-equipment-layout\s*\{[^}]*display:\s*grid/, "new station should use the approved two-column category-to-Work-Spec layout");
assert.match(redesignCss, /\.ops-work-spec-equipment-heading\s*\{[^}]*grid-template-columns:/, "Work Spec rows should keep labels and actions in stable columns");

console.log("contextual layout contract passed");
