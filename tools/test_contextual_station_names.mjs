import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getCanonicalItemsForFormat } from "../src/domain/canonical-station-catalog.js";
import { createStationDraft, ITEM_LIBRARY_CATEGORIES, STATION_ASSET_CATEGORIES, normalizeItemCatalog } from "../src/domain/master-checklist.js";
import { CENTRAL_CHECKLIST_SECTION_ENTRIES, getCentralChecklistSectionName, getCentralNameByKey, getCentralSystemCategoryName } from "../src/domain/equipment-names.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contextualSource = fs.readFileSync(path.join(root, "src/app/pages/ContextualStationPage.jsx"), "utf8");
const registerSource = fs.readFileSync(path.join(root, "src/app/StationRelationshipRegister.jsx"), "utf8");
const inlineEditorSource = fs.readFileSync(path.join(root, "src/app/StationRelationshipInlineEditor.jsx"), "utf8");
const step2Start = contextualSource.indexOf('{step === 2 && <section className="ops-station-equipment-workspace');
const step3Start = contextualSource.indexOf('{step === 3 && <section', step2Start);
const stationSetupMarkup = contextualSource.slice(step2Start, step3Start);

assert.match(contextualSource, /primary: english \|\| thai/, "contextual labels must resolve English as the primary name");
assert.match(contextualSource, /<strong>\{name\.primary\}<\/strong>/, "contextual cards must render the primary name first");
assert.match(contextualSource, /Category \{category\.code/, "contextual cards must show the category name and code");
assert.match(contextualSource, /formatDefinition\.description/, "the station format selector must explain the selected format");
assert.match(contextualSource, /preferredScopeForFormat/, "new System and Asset records must receive a format-specific scope");
assert.match(contextualSource, /STEP_LABELS = \["ข้อมูลสถานี", "ระบบและอุปกรณ์", "ตรวจสอบและบันทึก"\]/, "the new-station flow must expose the combined system and equipment stage");
assert.doesNotMatch(stationSetupMarkup, /StationRelationshipRegister/, "the new-station flow should show Work Spec instead of repeating the saved station relationship tree");
assert.match(stationSetupMarkup, /WORK SPEC/, "the selected station category must have a clear Work Spec heading");
assert.match(stationSetupMarkup, /ops-station-group-list/, "station setup must list the six BOQ groups in a selectable rail");
assert.match(stationSetupMarkup, /ops-station-work-spec-panel/, "the center panel must show Work Spec rows for the selected category");
assert.match(contextualSource, /RELATIONSHIP_GROUP_NAME_TH/, "the layout must provide contextual Thai secondary names for SC and IMPS groups");
assert.match(stationSetupMarkup, /relationshipGroupSecondaryLabel\(activeRelationshipGroup\)/, "the selected group heading must show English primary and Thai secondary names");
assert.match(registerSource, /getAssetSecondaryLabel/, "installed Equipment rows must show an English name and a Thai secondary name");
assert.match(registerSource, /getSystemSecondaryLabel/, "installed System rows must show an English name and a Thai secondary name");
assert.match(registerSource, /alwaysExpanded = false/, "the new station should keep its selected group open while shared Profile behavior stays configurable");
assert.match(contextualSource, /renderInlineRelationshipEditor\(asset, "asset", scope\)/, "editing should open inside the selected Work Spec equipment row with its Scope");
assert.doesNotMatch(stationSetupMarkup, /ops-station-system-rail|ops-wim-catalog-list|renderRelationshipMap\(\)|ops-wim-explain-panel/, "the setup workspace should not duplicate the relationship tree in side panels");
assert.match(contextualSource, /parentSystemId/, "the new-station relationship tree must preserve parentSystemId binding");
assert.match(contextualSource, /moveWimParent/, "the new-station data model must support moving a WIM parent between lanes");
assert.match(contextualSource, /onAddLane=\{addLaneForGroup\}|addWorkSpecSystem/, "WIM Lane creation should remain available through its Work Spec System action");
assert.match(contextualSource, /const WIM_PRIMARY_SYSTEM_IDS = new Set\(\[WIM_ID\]\)/, "WIM Sorting must be the only current primary system for nested WIM assets");
assert.doesNotMatch(contextualSource, /RETIRED_WIM_SYSTEM_IDS/, "current station wizard must expose the restored WIM System rows");
assert.match(contextualSource, /includeCatalogOptions: true/, "the shared station tree must expose available types without creating Assets");
assert.match(contextualSource, /const relationshipTree = buildStationRelationshipTree/, "SC and IMPS must use the shared relationship tree");
assert.match(contextualSource, /เพิ่ม Lane ที่มี WIM อย่างน้อยหนึ่งช่องก่อนเพิ่ม Sensor หรือ Loop/, "WIM children must remain gated by a real Lane and parent system");
assert.match(contextualSource, /Output ของ Switching DC/, "Switching DC outputs must be captured while adding the asset");
assert.match(contextualSource, /ops-readiness-panel/, "the final station step must show a visible readiness panel");
assert.match(contextualSource, /ops-readiness-blocker-list/, "the final station step must list blocking reasons");
assert.match(contextualSource, /ops-readiness-warnings/, "non-blocking station warnings must remain separate");
assert.match(contextualSource, /resolveIssue\(issue\)/, "readiness issues must provide a direct fix action");
assert.match(contextualSource, /WIM_SWITCHING_DC_OUTPUT_REQUIRED: "แรงดัน Output ของ Switching DC"/, "Switching DC blockers must explain the required output selection");
assert.match(contextualSource, /blockingIssues\.length \? `ยังมี \$\{blockingIssues\.length\} รายการต้องแก้` : "พร้อมสร้างสถานี"/, "the wizard action summary must reflect readiness state");
assert.match(registerSource, /sc-lane-register/, "WIM Lane topology must be shown within the WIM category");
assert.match(registerSource, /แก้ไข Lane/);
assert.match(registerSource, /ลบ Lane/);
assert.match(inlineEditorSource, /<span>Lane<\/span>/);
assert.match(contextualSource, /selectedScopesForCatalogItem/, "catalog variants must resolve from the selected System scopes");
assert.match(contextualSource, /draft\.stationFormat === "IMPS" \? \["ImPS", "3D"\] : \["High Speed", "Low Speed", "3D"\]/, "LPR equipment variants must follow the available scopes of each station format");
assert.match(contextualSource, /addWimLane = \(scopeOverride = \"\"\)/, "WIM Lane creation must accept an explicit scope");
assert.match(contextualSource, /removeWimScope/, "WIM removal must be isolated to the selected scope");
assert.match(contextualSource, /toggleSystem\(item, card\.scope \|\| \"\"\)/, "reference System cards must toggle by canonical item and scope");
assert.doesNotMatch(contextualSource, /step === 5/, "the contextual Wizard must not expose an extra flow state");
assert.doesNotMatch(contextualSource, /ops-reference-special|รายการ Custom \/ อุปกรณ์เพิ่มเติม/, "the unused Custom secondary section must be removed from the new-station workspace");

for (const format of ["SC", "IMPS"]) {
  const draft = createStationDraft(format);
  assert.equal(draft.stationSystems.length, 0, `${format} draft must not preselect System cards`);
  const systems = getCanonicalItemsForFormat(format).filter((item) => item.kind === "system");
  for (const system of systems) {
    const central = getCentralNameByKey(system.id);
    assert.ok(central, `${system.id} must resolve through the central name catalog`);
    assert.equal(system.nameTh, central.nameTh, `${system.id} Thai label must use the central name`);
    assert.equal(system.nameEn, central.nameEn, `${system.id} English label must use the central name`);
    const category = getCentralSystemCategoryName(system);
    assert.ok(category?.code && category.nameTh, `${system.id} must resolve a BOQ category name`);
  }
}

// The contextual equipment step must not lose a category merely because the
// selected System has no Asset row yet. When every supported System is
// selected, every mapped physical category for that station format must have
// a catalog-backed canonical Asset type available to render.
const canonicalCatalog = normalizeItemCatalog([], { includeWimElectronics: true });
for (const format of ["SC", "IMPS"]) {
  const canonical = getCanonicalItemsForFormat(format);
  const systems = canonical.filter((item) => item.kind === "system");
  const selectedCategories = new Set(systems.map((item) => item.category));
  const selectedSystemIds = new Set(systems.map((item) => item.id));
  const scoped = canonicalCatalog.filter((item) => canonical.some((entry) => (
    entry.kind === "asset"
      && entry.equipmentType === item.type
      && selectedCategories.has(entry.category)
      && (entry.category !== "WIM"
        || selectedSystemIds.has("wim-sorting"))
  )));
  const categoryCodes = new Set(scoped.map((item) => item.categoryCode));
  const expectedCodes = format === "SC"
    ? ["1.1.5", "2.1", "2.2", "2.3", "3.2", "4.1", "4.2", "5.1", "5.2", "7.1"]
    : ["2.1", "2.2", "2.3", "3.2", "4.1", "4.2", "5.1", "5.2"];
  for (const code of expectedCodes) assert.ok(categoryCodes.has(code), `${format} must expose category ${code} when all Systems are selected`);
}

// A shared high-level catalog family must not make sibling systems leak each
// other's Asset categories. Ownership is explicit on each canonical Asset.
const scCanonical = getCanonicalItemsForFormat("SC");
const scAssetCategoryCodesForSystem = (systemId) => [...new Set(scCanonical
  .filter((entry) => entry.kind === "asset" && entry.systemIds?.includes(systemId))
  .flatMap((entry) => entry.checklistMapping || []))];
assert.deepEqual(scAssetCategoryCodesForSystem("wim-control"), ["2.2"], "WIM Control must own only category 2.2 Assets");
assert.deepEqual(scAssetCategoryCodesForSystem("wim-electronics-system"), ["2.3"], "WIM Electronics must own only category 2.3 Assets");
assert.deepEqual(scAssetCategoryCodesForSystem("data-management"), ["5.1"], "Database must own only category 5.1 Assets");
assert.deepEqual(scAssetCategoryCodesForSystem("station-display"), ["5.2"], "Display must own only category 5.2 Assets");
assert.deepEqual(scAssetCategoryCodesForSystem("cctv-system"), ["4.1", "4.2"], "CCTV must own both documented categories");
assert.deepEqual(scAssetCategoryCodesForSystem("dimension-management"), ["1.1.5"], "3D Dimension must own only its scanner/controller equipment");
assert.deepEqual(scAssetCategoryCodesForSystem("lpr-control").sort(), ["3.2"], "LPR Control System must own LPR Camera for High/Low Speed and 3D scopes");

const scIds = new Set(getCanonicalItemsForFormat("SC").map((item) => item.id));
const impsIds = new Set(getCanonicalItemsForFormat("IMPS").map((item) => item.id));
for (const id of ["wim-control", "wim-electronics-system", "lpr-control", "dimension-management"]) {
  assert.ok(scIds.has(id) && impsIds.has(id), `${id} must be available to both SC and IMPS`);
}
assert.ok(scIds.has("dimension-management") && scIds.has("vms-control"), "SC must expose 3D and VMS systems");
for (const id of ["dimension-scanner", "dimension-controller", "dimension-management", "lpr-camera"]) {
  assert.ok(scIds.has(id) && impsIds.has(id), `${id} must be available to both SC and IMPS`);
}
for (const id of ["dimension-scanner", "dimension-controller", "dimension-management"]) {
  const item = getCanonicalItemsForFormat("IMPS").find((entry) => entry.id === id);
  assert.deepEqual(item?.allowedScopes, ["3D"], `${id} must be assigned only to the 3D operational scope`);
}
const imageProcessingSystem = getCanonicalItemsForFormat("IMPS").find((entry) => entry.id === "image-processing-management");
const fixedCamera = getCanonicalItemsForFormat("IMPS").find((entry) => entry.id === "fixed-camera");
const imageProcessor = getCanonicalItemsForFormat("IMPS").find((entry) => entry.id === "image-processor");
assert.ok(imageProcessingSystem?.allowedScopes.includes("Image Processing"), "Image Processing System must expose its operational scope");
assert.ok(fixedCamera?.allowedScopes.includes("Image Processing"), "Fixed CCTV Camera must be assignable to Image Processing");
assert.ok(imageProcessor?.allowedScopes.includes("Image Processing"), "new Image Processor Assets must share their System scope");
assert.ok(imageProcessor?.allowedScopes.includes("ImPS"), "legacy Image Processor scope must remain supported");
assert.equal(impsIds.has("vms-control"), false, "IMPS must not expose SC-only VMS systems");
const vmsSign = getCanonicalItemsForFormat("SC").find((item) => item.id === "vms-sign");
assert.deepEqual(vmsSign?.scopeVariants, ["High Speed", "Low Speed"], "SC VMS Sign must render High/Low scope variants without dimensions");
assert.equal(getCanonicalItemsForFormat("IMPS").some((item) => item.category === "VMS"), false, "IMPS must not expose VMS catalog items");
assert.ok(scIds.has("cctv-system") && impsIds.has("cctv-system"), "both formats must expose the CCTV system card");
const cctv = getCanonicalItemsForFormat("SC").find((item) => item.id === "cctv-system");
assert.deepEqual(cctv?.checklistMapping, ["4.1", "4.2"], "CCTV system must retain both documented BOQ categories");
assert.deepEqual(STATION_ASSET_CATEGORIES.map((category) => category.code), [
  "1.1.5", "1.1.12", "1.1.11", "2.1", "2.2", "2.3", "3.1", "3.2", "4.1", "4.2", "5.1", "5.2", "7.1",
], "station Asset categories must retain the canonical BOQ order");

for (const category of ITEM_LIBRARY_CATEGORIES) {
  const central = getCentralChecklistSectionName(category.code);
  if (central) assert.ok(central.nameTh, `${category.code} must have a central section name`);
}
const documentedChecklistCodes = ["1.1", "2.1", "2.2", "2.3", "3.1", "3.2", "4.1", "4.2", "5.1", "6.1", "6.2", "6.3", "7.1"];
const documentedBoqNames = {
  "1.1": "การแสดงความพร้อม",
  "2.1": "WIM SORTING SYSTEM (SENSOR)",
  "2.2": "WIM CONTROL SYSTEM FOR IMPS",
  "2.3": "WIM Electronics System for IMPS",
  "3.1": "ระบบควบคุมการอ่านป้ายทะเบียน",
  "3.2": "LPR Camera",
  "4.1": "CCTV Camera",
  "4.2": "Network Video Recorder (NVR)",
  "5.1": "Database Management and Reporting System",
  "6.1": "Database Management and Reporting System (software)",
  "6.2": "ทำความสะอาดห้องควบคุม",
  "6.3": "ทำความสะอาดตู้ควบคุม",
  "7.1": "Variable Message Sign (VMS)",
};
assert.equal(documentedChecklistCodes.length, 13, "the source PDFs define 13 checklist categories");
assert.ok(documentedChecklistCodes.every((code) => getCentralChecklistSectionName(code)?.nameTh), "every documented checklist category must have a BOQ name");
for (const [code, name] of Object.entries(documentedBoqNames)) assert.equal(getCentralChecklistSectionName(code)?.nameTh, name, `${code} must retain the BOQ category name`);
assert.ok(CENTRAL_CHECKLIST_SECTION_ENTRIES.every((section) => section.code && section.nameTh), "every central checklist/system category must have a name");

const dimensionCategory = getCentralSystemCategoryName({ canonicalItemId: "dimension-management", category: "3D Dimension" });
assert.deepEqual(dimensionCategory, {
  code: "1.1.5",
  nameTh: "ระบบวัดมิติรถบรรทุก",
  nameEn: "3D Truck Dimension Measurement",
}, "3D system must not borrow the Database 5.1 category name");

console.log("contextual station central names passed");
