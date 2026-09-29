import assert from "node:assert/strict";
import fs from "node:fs";
import { getCanonicalItemsForFormat } from "../src/domain/canonical-station-catalog.js";
import { getNextEquipmentIndex, makeEquipmentFromCatalogItem } from "../src/domain/master-checklist.js";
import { isWimElectronicsSubEquipmentType } from "../src/domain/wim-electronics.js";
import { addStationAssetWithOwner } from "../src/domain/station-asset-add.js";

let generatedId = 0;
const createId = (kind) => `${kind}-${++generatedId}`;
const createSystemRecord = (definition, makeId, extra = {}) => ({
  id: makeId("system"),
  canonicalItemId: definition.id,
  systemId: definition.id,
  scope: extra.scope,
  active: true,
});
const dependencies = {
  createId,
  createSystemRecord,
  makeEquipmentFromCatalogItem,
  getNextEquipmentIndex,
};
const lprOwner = { id: "lpr-control", nameEn: "LPR Control", checklistMapping: ["3.1"] };
const highLpr = { id: "lpr-high", canonicalItemId: "lpr-control", scope: "High Speed", active: true };
const lowLpr = { id: "lpr-low", canonicalItemId: "lpr-control", scope: "Low Speed", active: true };
const lprDraft = { stationSystems: [highLpr, lowLpr], equipment: [] };
const lprItem = { id: "catalog-lpr", type: "LPR_CAMERA", prefix: "LPR", categoryCode: "3.2", variantScope: "High Speed" };

const linkedLprDraft = addStationAssetWithOwner(lprDraft, {
  catalogItem: lprItem,
  scope: "High Speed",
  ownerDefinition: lprOwner,
}, dependencies);
assert.equal(linkedLprDraft.equipment[0].parentSystemId, "lpr-high", "LPR Camera must link to the LPR System in its exact Scope");
assert.equal(linkedLprDraft.equipment[0].scope, "High Speed", "LPR Camera must keep its Work Spec Scope");
assert.equal(linkedLprDraft.equipment[0].assetNo, "LPR-HS-01", "the new-station path must number the Asset in its selected Scope");
assert.equal(linkedLprDraft.stationSystems.length, 2, "adding equipment must reuse an existing owner System");
assert.equal(lprDraft.equipment.length, 0, "adding an Asset must not mutate the previous draft");

const cctvOwner = { id: "cctv-system", nameEn: "CCTV System", checklistMapping: ["4.1"] };
const cctvDraft = addStationAssetWithOwner({ stationSystems: [], equipment: [] }, {
  catalogItem: { id: "catalog-ptz", type: "PTZ_CAMERA", prefix: "PTZ", categoryCode: "4.1" },
  scope: "High Speed",
  ownerDefinition: cctvOwner,
}, dependencies);
assert.equal(cctvDraft.stationSystems.length, 1, "adding CCTV equipment must create its missing owner System");
assert.equal(cctvDraft.equipment[0].parentSystemId, cctvDraft.stationSystems[0].id, "the new Asset and owner System must be linked in one draft update");
assert.equal(cctvDraft.equipment[0].scope, "High Speed", "the new owner and Asset must use the selected Scope");
assert.equal(cctvDraft.equipment[0].assetNo, "PTZ-HS-01", "new owner-bound Assets must include the selected Scope code");

const imageOwner = { id: "image-processing-management", nameEn: "Image Processing System", checklistMapping: ["5.1"] };
const cctvHighOwner = { id: "cctv-high", canonicalItemId: "cctv-system", scope: "High Speed", active: true };
const imageOwnerRecord = { id: "image-processing-parent", canonicalItemId: imageOwner.id, scope: "Image Processing", active: true };
const fixedCameraDraft = addStationAssetWithOwner({ stationSystems: [cctvHighOwner, imageOwnerRecord], equipment: [] }, {
  catalogItem: { id: "catalog-fixed", type: "FIXED_CAMERA", prefix: "CAM", categoryCode: "4.1" },
  scope: "Image Processing",
  ownerDefinition: imageOwner,
  parentSystemId: imageOwnerRecord.id,
}, dependencies);
assert.equal(fixedCameraDraft.equipment[0].parentSystemId, imageOwnerRecord.id, "multi-owner camera additions must use the owner selected by category and Scope");

const cabinetId = "wim-cabinet-1";
const electronicsSystem = { id: "wim-electronics-1", canonicalItemId: "wim-electronics-system", scope: "High Speed", active: true };
const electronicsDraft = addStationAssetWithOwner({ stationSystems: [electronicsSystem], equipment: [] }, {
  catalogItem: { id: "catalog-controller", type: "WIM_CONTROLLER", prefix: "WIM-CTRL", categoryCode: "2.3" },
  scope: "High Speed",
  ownerDefinition: { id: "wim-electronics-system" },
  parentSystemId: electronicsSystem.id,
  parentAssetId: cabinetId,
}, dependencies);
assert.equal(electronicsDraft.equipment[0].parentSystemId, electronicsSystem.id, "WIM Electronics equipment must keep its System owner");
assert.equal(electronicsDraft.equipment[0].parentAssetId, cabinetId, "WIM Electronics equipment must keep its Cabinet owner");

const checkedOwnerPairs = new Set();
for (const format of ["SC", "IMPS"]) {
  const definitions = getCanonicalItemsForFormat(format);
  const systemsById = new Map(definitions.filter((entry) => entry.kind === "system").map((entry) => [entry.id, entry]));
  for (const definition of definitions.filter((entry) => entry.kind === "asset" && !entry.legacyOnly && !["WIM_SENSOR", "WIM_LOOP"].includes(entry.equipmentType))) {
    for (const ownerId of definition.systemIds || []) {
      const ownerDefinition = systemsById.get(ownerId);
      if (!ownerDefinition) continue;
      const scope = (definition.allowedScopes || []).find((candidate) => (ownerDefinition.allowedScopes || []).includes(candidate));
      if (!scope) continue;
      const type = definition.equipmentType;
      const catalogItem = { id: `${format}-${definition.id}`, type, prefix: type, categoryCode: definition.checklistMapping?.[0] || "2.1" };
      const ownerAssetDraft = addStationAssetWithOwner({ stationSystems: [], equipment: [] }, {
        catalogItem,
        scope,
        ownerDefinition,
        parentAssetId: isWimElectronicsSubEquipmentType(type) ? "cabinet-test" : null,
      }, dependencies);
      assert.equal(ownerAssetDraft.stationSystems.length, 1, `${format} ${type} must create one owner System`);
      assert.equal(ownerAssetDraft.equipment[0].parentSystemId, ownerAssetDraft.stationSystems[0].id, `${format} ${type} must link its Asset to the owner System`);
      assert.equal(ownerAssetDraft.equipment[0].scope, scope, `${format} ${type} must keep the selected Scope`);
      checkedOwnerPairs.add(`${format}:${type}:${ownerId}`);
    }
  }
}
assert.ok(checkedOwnerPairs.size > 0, "the SC and IMPS catalog must expose system-owned equipment to verify");

const page = fs.readFileSync(new URL("../src/app/pages/ContextualStationPage.jsx", import.meta.url), "utf8");
const addRecordStart = page.indexOf("const addRelationshipRecord =");
const addRecordEnd = page.indexOf("const selectRelationshipRecord =", addRecordStart);
const addRecord = page.slice(addRecordStart, addRecordEnd);
assert.match(addRecord, /addAssetWithSystemOwner\(scopedItem,\s*scope,\s*owner,\s*ownerSystem\?\.id/, "Work Spec add must use the shared owner-aware Asset action");
assert.match(addRecord, /relationshipCategoryForCatalogItem\([\s\S]*?=== categoryId/, "the owner System must be selected from the active equipment category");
assert.match(addRecord, /ownerSystem = owner && draft\.stationSystems\.find\([\s\S]*?scope[\s\S]*?option\.parentId/, "the owner System must match the selected Scope and explicit System instance");
assert.match(page, /const addAssetWithSystemOwner = \(item, scope, ownerDefinition, parentSystemId = null, parentAssetId = null\)/, "the page must centralize all one-click catalog Asset additions");
const catalogAddStart = page.indexOf("const handleRelationshipCatalogAdd =");
const catalogAddEnd = page.indexOf("const renderWimAssetCard =", catalogAddStart);
const catalogAdd = page.slice(catalogAddStart, catalogAddEnd);
assert.match(catalogAdd, /addAssetWithSystemOwner\(scopedItem,\s*scope,\s*owner/, "the catalog add path must use the same owner-aware Asset action");
const workSpecAddStart = page.indexOf("const addWorkSpecEquipment =");
const workSpecAddEnd = page.indexOf("const addWorkSpecSystem =", workSpecAddStart);
const workSpecAdd = page.slice(workSpecAddStart, workSpecAddEnd);
assert.match(workSpecAdd, /parentId:\s*item\.parentId/, "Work Spec Asset options must preserve the selected System owner");
assert.match(workSpecAdd, /parentAssetId:\s*item\.parentAssetId/, "Work Spec Asset options must preserve the selected Cabinet owner");

const variantsStart = page.indexOf("const referenceGroupedVariants =");
const variantsEnd = page.indexOf("const referenceGroupAssetCount =", variantsStart);
const variants = page.slice(variantsStart, variantsEnd);
assert.match(variants, /item\.parentId[\s\S]*?item\.parentAssetId/, "separate System and Cabinet variants must keep unique row identity");
assert.match(page, /const rowKey = `\$\{category\.code\}-\$\{item\.id\}-\$\{item\.variantScope \|\| "default"\}-\$\{item\.parentId \|\| "no-system"\}-\$\{item\.parentAssetId \|\| "no-asset-parent"\}`/, "display rows must not collide for different System or Cabinet owners");

const wimLaneStart = page.indexOf("const renderWorkSpecWimLane =");
const wimLaneEnd = page.indexOf("const renderWorkSpecWimScope =", wimLaneStart);
const wimLane = page.slice(wimLaneStart, wimLaneEnd);
assert.match(wimLane, /referenceItemAssets\(\{\s*\.\.\.item,\s*parentId:\s*parent\.id/, "WIM counts must be recalculated against the current Lane parent");
assert.match(wimLane, /parent\?\.id \|\| "no-parent"/, "WIM row identity must remain distinct for each Lane parent");

console.log("station Asset addition owner binding and WIM Lane scoping passed");
