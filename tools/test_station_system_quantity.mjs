import assert from "node:assert/strict";
import fs from "node:fs";
import { normalizeStationProfile } from "../src/domain/master-checklist.js";
import { adjustStationSystemQuantity, getStationSystemQuantity } from "../src/domain/station-system-quantity.js";
import { buildStationRelationshipTree } from "../src/domain/station-relationship-tree.js";

const systems = [
  { id: "high-lpr", canonicalItemId: "lpr-control", scope: "High Speed", quantity: 1 },
  { id: "low-lpr", canonicalItemId: "lpr-control", scope: "Low Speed", quantity: 3 },
  { id: "wim-lane-1", canonicalItemId: "wim-sorting", scope: "High Speed", quantity: 1 },
];

const increased = adjustStationSystemQuantity(systems, "high-lpr", 1);
assert.equal(increased.find((system) => system.id === "high-lpr")?.quantity, 2);
assert.equal(increased.find((system) => system.id === "low-lpr")?.quantity, 3, "changing High Speed must not alter Low Speed");
assert.equal(systems[0].quantity, 1, "quantity updates must not mutate the current draft array");

const decreased = adjustStationSystemQuantity(increased, "high-lpr", -1);
assert.equal(decreased.find((system) => system.id === "high-lpr")?.quantity, 1);
const zero = adjustStationSystemQuantity([{ id: "system-zero", quantity: 0 }], "system-zero", -1);
assert.equal(zero[0].quantity, 0, "system quantity must not become negative");
assert.equal(adjustStationSystemQuantity(systems, "wim-lane-1", 1), systems, "WIM Sorting quantity is one per Lane and must use the Lane add flow");
assert.equal(adjustStationSystemQuantity(systems, "missing", 1), systems, "unknown records must not create new systems implicitly");
assert.equal(getStationSystemQuantity({ id: "legacy-system" }), 1, "legacy Systems without an explicit quantity remain one unit");
assert.equal(getStationSystemQuantity({ id: "zero-system", quantity: 0 }), 0);
const saved = normalizeStationProfile({
  id: "station-system-quantity",
  stationFormat: "SC",
  stationCode: "SC-TEST",
  stationName: "สถานีทดสอบจำนวน System",
  stationSystems: [{ id: "high-lpr", canonicalItemId: "lpr-control", systemId: "lpr-control", scope: "High Speed", quantity: 4, checklistMapping: ["3.1"] }],
  lanes: [],
  equipment: [],
});
assert.equal(saved.stationSystems[0].quantity, 4, "the installed System quantity must survive station profile normalization");
const repeatedSystemProfile = normalizeStationProfile({
  id: "station-system-instances",
  stationFormat: "SC",
  stationCode: "SC-INSTANCES",
  stationName: "สถานีทดสอบ System แยกรายการ",
  stationSystems: [
    { id: "high-lpr-1", canonicalItemId: "lpr-control", systemId: "lpr-control", scope: "High Speed", quantity: 1, checklistMapping: ["3.1"] },
    { id: "high-lpr-2", canonicalItemId: "lpr-control", systemId: "lpr-control", scope: "High Speed", quantity: 1, checklistMapping: ["3.1"] },
  ],
  lanes: [],
  equipment: [],
});
assert.deepEqual(repeatedSystemProfile.stationSystems.map((system) => system.id), ["high-lpr-1", "high-lpr-2"], "same canonical System and Scope must remain two distinct records after profile normalization");

const page = fs.readFileSync(new URL("../src/app/pages/ContextualStationPage.jsx", import.meta.url), "utf8");
const start = page.indexOf("const renderWorkSpecSystem = ({");
const end = page.indexOf("const renderWorkSpecEquipment =", start);
const renderer = page.slice(start, end);
assert.match(renderer, /installed\.map\(\(system\) => \{/, "each installed System record must render as its own row");
assert.match(renderer, /System #\$\{[^}]+\}/, "same-scope System instances must have distinct row labels");
assert.doesNotMatch(renderer, /ops-work-spec-system-quantity/, "a System instance must not expose a quantity stepper");
assert.match(renderer, /เพิ่ม System รายการใหม่/, "the Work Spec action must say that it creates a new System record");
assert.doesNotMatch(renderer, /definition\.id === WIM_ID \|\| installed\.length === 0/, "System add must not disappear after the first unit");
assert.doesNotMatch(page, /changeWorkSpecSystemQuantity/, "New Station must not change an installed System row's quantity");
assert.match(page, /stationSystems:\s*\[\.\.\.current\.stationSystems,\s*systemRecord\(/, "each non-WIM System add must append a new System record");
assert.match(page, /const workSpecSystemCountForGroup[\s\S]*?\(category\.systems \|\| \[\]\)\.length/, "Work Spec system totals must count instance rows rather than stored quantity");
assert.match(renderer, /definition\.id === WIM_ID[\s\S]*?เพิ่ม WIM Lane/, "WIM Sorting must remain addable by adding another Lane");

const editorStart = page.indexOf("const renderInlineRelationshipEditor = (record, kind, contextScope = \"\")");
const editorEnd = page.indexOf("const renderLaneEditor =", editorStart);
const inlineEditor = page.slice(editorStart, editorEnd);
assert.match(inlineEditor, /formatScopeChoices\.filter\(\(scope\) => String\(scope\) === String\(contextScope\)\)/, "the selected Work Spec must constrain edit Scope");
assert.match(inlineEditor, /String\(system\.scope \|\| \"\"\) === parentScope/, "WIM parent choices must stay inside the selected Scope");
assert.match(inlineEditor, /wimParentOptions=\{wimParentOptions\}/, "the inline editor must receive WIM parent choices");
assert.match(inlineEditor, /cabinetOptions=\{cabinetOptions\}/, "the inline editor must receive Cabinet choices");
assert.match(inlineEditor, /contextScope=\{contextScope\}/, "the inline editor must receive Work Spec Scope choices");
const saveRecordStart = page.indexOf("const saveRelationshipRecord =");
const deleteRecordStart = page.indexOf("const deleteRelationshipRecord =", saveRecordStart);
const saveRecord = page.slice(saveRecordStart, deleteRecordStart);
assert.doesNotMatch(saveRecord, /มี System ชนิดเดียวกันใน Scope นี้อยู่แล้ว/, "separate System instances may share a Scope");

const relationshipOptions = (format, groupId) => buildStationRelationshipTree({
  stationFormat: format,
  systems: [],
  equipment: [],
  includeEmptyGroups: true,
  includeCatalogOptions: true,
}).find((group) => group.groupId === groupId)?.categories.flatMap((category) => category.systemOptions || []) || [];
assert.ok(relationshipOptions("SC", "SC-01").some((option) => option.canonicalItemId === "wim-high-data-control" && option.scope === "High Speed"), "SC High Speed must retain its own WIM Data/Control System options");
assert.ok(relationshipOptions("SC", "SC-04").some((option) => option.canonicalItemId === "wim-low-data-control" && option.scope === "Low Speed"), "SC Low Speed must retain its own WIM Data/Control System options");
assert.ok(relationshipOptions("SC", "SC-02").some((option) => option.canonicalItemId === "vms-control" && option.scope === "High Speed"), "SC High Speed must retain VMS in its own Scope");
assert.ok(relationshipOptions("SC", "SC-05").some((option) => option.canonicalItemId === "vms-control" && option.scope === "Low Speed"), "SC Low Speed must retain VMS in its own Scope");
assert.ok(relationshipOptions("IMPS", "IMPS-01").some((option) => option.canonicalItemId === "image-processing-management" && option.scope === "Image Processing"), "IMPS must retain its Image Processing System");
assert.ok(relationshipOptions("IMPS", "IMPS-04").some((option) => option.canonicalItemId === "lpr-control" && option.scope === "ImPS"), "IMPS LPR must stay separate from its 3D LPR System");
assert.ok(relationshipOptions("IMPS", "IMPS-03").some((option) => option.canonicalItemId === "lpr-control" && option.scope === "3D"), "IMPS 3D LPR must remain in the 3D Scope");
assert.equal(relationshipOptions("IMPS", "IMPS-02").some((option) => option.canonicalItemId.startsWith("wim-high-") || option.canonicalItemId.startsWith("wim-low-")), false, "SC High/Low WIM Data Systems must not leak into IMPS");
assert.equal(relationshipOptions("IMPS", "IMPS-05").some((option) => option.canonicalItemId === "vms-control"), false, "SC-only VMS must not leak into IMPS");

const addRecordStart = page.indexOf("const addRelationshipRecord =");
const selectRecordStart = page.indexOf("const selectRelationshipRecord =", addRecordStart);
const addRecord = page.slice(addRecordStart, selectRecordStart);
assert.match(addRecord, /category\.systemOptions\.some\([\s\S]*?candidate\.scope[\s\S]*?scope/, "adding a repeated category such as WIM must resolve the group by the selected Scope");
assert.match(addRecord, /addSystemInstanceForScope\(definition, scope\)/, "adding System through any Work Spec must create a new row even when one already exists");
assert.match(addRecord, /addAssetWithSystemOwner\(scopedItem,\s*scope,\s*owner,\s*ownerSystem\?\.id/, "adding catalog equipment from a Work Spec must bind it to the owner for that exact category and Scope");
assert.doesNotMatch(addRecord, /ensureSystemForScope\(owner, scope\);\s*changeAssetQuantity\(scopedItem, count \+ 1\)/, "ensuring an owner and adding its Asset separately must not leave an unbound Asset");
const equipmentVariantsStart = page.indexOf("const referenceGroupedVariants =");
const equipmentVariantsEnd = page.indexOf("const referenceGroupAssetCount =", equipmentVariantsStart);
const equipmentVariants = page.slice(equipmentVariantsStart, equipmentVariantsEnd);
assert.match(equipmentVariants, /item\.parentId[\s\S]*?item\.parentAssetId/, "catalog variants for separate System or Cabinet owners must keep distinct identity");
const wimLaneStart = page.indexOf("const renderWorkSpecWimLane =");
const wimLaneEnd = page.indexOf("const renderWorkSpecWimScope =", wimLaneStart);
const wimLaneRenderer = page.slice(wimLaneStart, wimLaneEnd);
assert.match(wimLaneRenderer, /referenceItemAssets\(\{\s*\.\.\.item,\s*parentId:\s*parent\.id/, "each Lane must count WIM Assets under that Lane's own parent System");
const selectRecordEnd = page.indexOf("const saveRelationshipRecord =", selectRecordStart);
const selectRecord = page.slice(selectRecordStart, selectRecordEnd);
assert.match(selectRecord, /category\.systems\.some\(\(system\) => system\.id === record\.id\)/, "editing a System must return to its actual group even when category IDs repeat");
assert.match(selectRecord, /category\.assets\.some\(\(asset\) => asset\.id === record\.id\)/, "editing an Asset must return to its actual group even when category IDs repeat");

const assetEditor = fs.readFileSync(new URL("../src/app/StationRelationshipInlineEditor.jsx", import.meta.url), "utf8");
assert.match(assetEditor, /WIM Sorting System \(ระบบแม่\)/, "WIM Sensor/Loop must offer a named parent-system selector");
assert.match(assetEditor, /laneId: parent\?\.laneId[\s\S]*?scope: parent\?\.scope/, "the selected parent must supply Lane and Scope");
assert.match(assetEditor, /disabled=\{!canSave\}/, "a WIM child cannot be saved before a valid parent is selected");

const workSpecCss = fs.readFileSync(new URL("../src/styles/redesign.css", import.meta.url), "utf8");
assert.match(workSpecCss, /\.ops-work-spec-installed-list\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;[^}]*width:\s*auto;[^}]*max-width:\s*none;[^}]*min-width:\s*0;/, "installed System rows must span the selected Work Spec card without a stale fixed width");
assert.match(workSpecCss, /\.ops-station-new-equipment-layout \.ops-station-equipment-main\s*\{[^}]*container:\s*station-work-spec\s*\/\s*inline-size;/, "WIM layout must respond to the available Work Spec panel width");
assert.match(workSpecCss, /@container station-work-spec \(max-width:\s*720px\)[\s\S]*?\.ops-wim-work-spec-lane-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/, "WIM Lanes must stack based on panel width rather than overall viewport width");
assert.match(workSpecCss, /\.ops-station-group-search\s*\{[^}]*min-height:\s*46px;/, "group search must meet the shared touch target size");
assert.match(workSpecCss, /\.ops-work-spec-add\s*\{[^}]*min-height:\s*46px;/, "Work Spec add actions must meet the shared touch target size");

const updateRelationshipGroupSearchStart = page.indexOf("const updateRelationshipGroupSearch =");
const updateRelationshipGroupSearchEnd = page.indexOf("const addWorkSpecEquipment =", updateRelationshipGroupSearchStart);
const updateRelationshipGroupSearch = page.slice(updateRelationshipGroupSearchStart, updateRelationshipGroupSearchEnd);
assert.match(updateRelationshipGroupSearch, /setSystemSearch\(value\)/, "search must filter the group rail");
assert.doesNotMatch(updateRelationshipGroupSearch, /setRelationshipGroup\(/, "typing a search must not unexpectedly switch the Work Spec group");
assert.match(page, /relationshipGroupCountLabel\(group, true\)/, "group rail must make clear that empty categories can still be added");
assert.match(page, /className="ops-station-group-list"[\s\S]*?visibleRelationshipGroups\.map\(\(group\) => \{[\s\S]*?return <button type="button" key=\{group\.groupId\}/, "group rail must render filtered relationship groups as selectable buttons");
const changeFormatStart = page.indexOf("const changeFormat = async");
const changeFormatEnd = page.indexOf("const toggleReferenceGroup =", changeFormatStart);
assert.match(page.slice(changeFormatStart, changeFormatEnd), /setSystemSearch\(""\)/, "changing SC/IMPS format must clear a filter that could hide the new format's groups");

console.log("station System instance rows and SC/IMPS Work Spec mappings passed");
