import assert from "node:assert/strict";
import {
  buildStationRelationshipTree,
  getRelationshipCategoryForAsset,
  getRelationshipCategoryForSystem,
  getRelationshipPathForRecord,
  getStationRelationshipSystemCount,
} from "../src/domain/station-relationship-tree.js";
import { CENTRAL_EQUIPMENT_MAIN_CATEGORIES } from "../src/domain/equipment-names.js";

const system = (id, canonicalItemId, scope = "", extra = {}) => ({ id, canonicalItemId, scope, quantity: 1, active: true, sourceRefs: [], ...extra });
const asset = (id, type, scope = "", extra = {}) => ({ id, type, scope, active: true, assetNo: `${id}-NO`, sourceRefs: [], ...extra });
const category = (tree, id) => tree.find((entry) => entry.categories?.some((item) => item.id === id))?.categories[0];
const scopesFor = (tree, id) => tree.flatMap((entry) => entry.categories?.find((item) => item.id === id)?.scopes || []);
const scope = (tree, categoryId, label) => tree.flatMap((entry) => entry.categories?.filter((item) => item.id === categoryId).flatMap((item) => item.scopes) || []).find((entry) => entry.scope === label);
const parent = (scopeNode, canonicalItemId) => scopeNode?.systems.find((entry) => entry.record.canonicalItemId === canonicalItemId);
const childIds = (systemNode) => (systemNode?.equipment || []).map((entry) => entry.record.id);

const scSystems = [
  system("wim-1", "wim-sorting", "High Speed", { laneId: "lane-high", instanceNo: 1 }),
  system("wim-control-1", "wim-control", "High Speed"),
  system("wim-electronics-1", "wim-electronics-system", "High Speed"),
  system("wim-data-high", "wim-high-data-control", "High Speed"),
  system("wim-report-high", "wim-high-reporting", "High Speed"),
  system("wim-display-high", "wim-high-display", "High Speed"),
  system("wim-data-low", "wim-low-data-control", "Low Speed"),
  system("wim-report-low", "wim-low-reporting", "Low Speed"),
  system("wim-display-low", "wim-low-display", "Low Speed"),
  system("lpr-high", "lpr-control", "High Speed"),
  system("lpr-low", "lpr-control", "Low Speed"),
  system("lpr-3d", "lpr-control", "3D"),
  system("cctv-high", "cctv-system", "High Speed"),
  system("vms-low", "vms-control", "Low Speed"),
  system("dimension", "dimension-management", "3D"),
  system("database", "data-management", "Central"),
  system("display", "station-display", "Central"),
];
const scEquipment = [
  asset("sensor", "WIM_SENSOR", "High Speed", { laneId: "lane-high" }),
  asset("loop", "WIM_LOOP", "High Speed", { laneId: "lane-high" }),
  asset("computer", "CONTROL_COMPUTER", "High Speed"),
  asset("cabinet", "CONTROL_CABINET", "High Speed"),
  asset("switching", "WIM_SWITCHING_DC", "High Speed"),
  asset("lpr-camera-high", "LPR_CAMERA", "High Speed"),
  asset("lpr-camera-low", "LPR_CAMERA", "Low Speed"),
  asset("lpr-camera-3d", "LPR_CAMERA", "3D"),
  asset("fixed", "FIXED_CAMERA", "High Speed"),
  asset("ptz", "PTZ_CAMERA", "High Speed"),
  asset("nvr", "NVR", "High Speed"),
  asset("vms-sign", "VMS_SIGN", "Low Speed"),
  asset("scanner", "LASER_SCANNER", "3D"),
  asset("controller", "DIMENSION_CONTROLLER", "3D"),
  asset("db-server", "DATABASE_SERVER", "Central"),
  asset("display-equipment", "IMPS_DISPLAY_PROCESSING", "Central"),
];

const scTree = buildStationRelationshipTree({ stationFormat: "SC", systems: scSystems, equipment: scEquipment });
assert.deepEqual(scTree.map((entry) => entry.groupId), ["sc-wim-hs", "sc-lpr-hs", "sc-cctv-hs", "sc-3d", "sc-lpr-3d", "sc-lpr-ls", "sc-vms-ls", "sc-data-control-hs", "sc-data-control-ls", "sc-data-control-central"], "installed SC groups follow the agreed installation-point order and omit empty points");
assert.equal(getRelationshipCategoryForSystem({ canonicalItemId: "wim-low-reporting" }), "data-control", "WIM High/Low data systems share the Data/Control main category");
assert.equal(getRelationshipCategoryForAsset({ type: "LPR_CAMERA", scope: "3D" }), "lpr", "LPR cameras remain in LPR regardless of their operational scope");

const scWimHigh = scope(scTree, "wim", "High Speed");
assert.deepEqual(scopesFor(scTree, "wim").map((entry) => entry.scope), ["High Speed"], "SC WIM only shows installed WIM points; Low Speed Data/Control remains separate");
assert.deepEqual(scopesFor(scTree, "lpr").map((entry) => entry.scope), ["High Speed", "3D", "Low Speed"], "SC LPR workpoints follow the agreed installation order with separate Scope/System records");
assert.deepEqual(scopesFor(scTree, "data-control").map((entry) => entry.scope), ["High Speed", "Low Speed", "Central"], "SC Data/Control HS, LS and Central remain separate points in order");
assert.deepEqual(childIds(parent(scWimHigh, "wim-sorting")), ["sensor", "loop"], "WIM Sensor and Loop remain under the WIM System and Lane parent");
assert.equal(parent(scWimHigh, "wim-control")?.record.id, "wim-control-1", "a real WIM Control parent System is visible");
assert.deepEqual(childIds(parent(scWimHigh, "wim-control")), ["computer"], "WIM Control Computer is nested under its saved or uniquely inferred parent");
assert.equal(parent(scWimHigh, "wim-electronics-system")?.record.id, "wim-electronics-1", "a real WIM Electronics parent System is visible");
assert.deepEqual(childIds(parent(scWimHigh, "wim-electronics-system")), ["cabinet", "switching"], "WIM electronics are nested under their parent System");
assert.equal(parent(scWimHigh, "wim-sorting").equipment[0].association, "catalog-scope-inferred", "missing parent links use display-only Catalog and Scope matching");
assert.equal(Object.hasOwn(scEquipment[0], "parentSystemId"), false, "display-only matching never writes a parent id to the original asset");

assert.deepEqual(childIds(parent(scope(scTree, "lpr", "High Speed"), "lpr-control")), ["lpr-camera-high"], "High Speed LPR camera is under its own Scope System");
assert.deepEqual(childIds(parent(scope(scTree, "lpr", "Low Speed"), "lpr-control")), ["lpr-camera-low"], "Low Speed LPR camera is under a distinct Scope System");
assert.deepEqual(childIds(parent(scope(scTree, "lpr", "3D"), "lpr-control")), ["lpr-camera-3d"], "3D LPR camera is under a distinct Scope System");
assert.deepEqual(scope(scTree, "data-control", "Low Speed").systems.map((entry) => entry.record.canonicalItemId), ["wim-low-data-control", "wim-low-reporting", "wim-low-display"], "all Low Speed WIM Data/Control Systems are grouped under the agreed main category and Scope");
assert.deepEqual(childIds(parent(scope(scTree, "3d", "3D"), "dimension-management")), ["scanner", "controller"], "3D Equipment nests beneath its management System");
assert.deepEqual(childIds(parent(scope(scTree, "data-control", "Central"), "data-management")), ["db-server"], "Central database equipment nests beneath its System");
assert.equal(getRelationshipPathForRecord({ stationFormat: "SC", systems: scSystems, equipment: scEquipment, kind: "asset", recordId: "lpr-camera-low" }), "LPR · Low Speed", "record paths no longer use SC/IMPS .01/.02 as relationship categories");

const scLayout = buildStationRelationshipTree({ stationFormat: "SC", includeEmptyGroups: true, includeCatalogOptions: true });
assert.deepEqual(scLayout.map((entry) => entry.groupId), ["sc-wim-hs", "sc-lpr-hs", "sc-cctv-hs", "sc-3d", "sc-lpr-3d", "sc-vms-hs", "sc-wim-ls", "sc-lpr-ls", "sc-cctv-ls", "sc-vms-ls", "sc-data-control-central"], "the SC creation template shows current addable points in the agreed order");
assert.deepEqual(scope(scLayout, "data-control", "Low Speed")?.systemOptions.map((item) => item.canonicalItemId) || [], [], "retired High/Low WIM Data/Control Systems stay out of new station choices");
assert.equal(scope(scLayout, "wim", "High Speed").systemOptions.find((item) => item.canonicalItemId === "wim-control")?.virtualOwner, true, "WIM Control appears as the parent choice for its equipment without creating an installed record");
assert.equal(scope(scLayout, "lpr", "3D").equipmentOptions[0]?.scope, "3D", "SC LPR options preserve the 3D Scope");

const noParentTree = buildStationRelationshipTree({
  stationFormat: "SC",
  systems: [system("lpr-a", "lpr-control", "High Speed"), system("lpr-b", "lpr-control", "High Speed")],
  equipment: [asset("ambiguous-camera", "LPR_CAMERA", "High Speed"), asset("stale-camera", "LPR_CAMERA", "High Speed", { parentSystemId: "removed-system" })],
});
const noParentScope = scope(noParentTree, "lpr", "High Speed");
assert.deepEqual(noParentScope.unlinkedAssets.map((entry) => entry.record.id), ["ambiguous-camera", "stale-camera"], "ambiguous and unresolved saved parents remain visible under 'ยังไม่ผูก System'");
assert.equal(noParentScope.unlinkedAssets[0].association, "unlinked", "ambiguous Catalog ownership is not guessed");
assert.equal(noParentScope.unlinkedAssets[1].association, "missing-stored-parent", "a stale saved link is surfaced rather than silently replaced");

const storedParentTree = buildStationRelationshipTree({
  stationFormat: "SC",
  systems: [system("stored-high-parent", "lpr-control", "High Speed")],
  equipment: [asset("stored-parent-camera", "LPR_CAMERA", "Low Speed", { parentSystemId: "stored-high-parent" })],
});
assert.deepEqual(childIds(parent(scope(storedParentTree, "lpr", "High Speed"), "lpr-control")), ["stored-parent-camera"], "a saved parent link wins even when the asset's old Scope label differs");
assert.equal(Object.hasOwn(storedParentTree[0].scopes[0].systems[0].equipment[0].record, "parentSystemId"), true, "the stored relationship remains unchanged in the rendered tree");

const impsSystems = [
  system("imps-wim", "wim-sorting", "ImPS", { laneId: "imps-lane", instanceNo: 1 }),
  system("imps-wim-control", "wim-control", "ImPS"),
  system("imps-wim-electronics", "wim-electronics-system", "ImPS"),
  system("imps-lpr", "lpr-control", "ImPS"),
  system("imps-lpr-3d", "lpr-control", "3D"),
  system("imps-cctv", "cctv-system", "ImPS"),
  system("imps-dimension", "dimension-management", "3D"),
  system("imps-image", "image-processing-management", "Image Processing"),
  system("imps-data", "data-management", "ImPS"),
  system("imps-display", "station-display", "ImPS"),
  system("imps-vms-old", "vms-control", "ImPS"),
];
const impsEquipment = [
  asset("imps-sensor", "WIM_SENSOR", "ImPS", { laneId: "imps-lane" }),
  asset("imps-lpr-camera", "LPR_CAMERA", "ImPS"),
  asset("imps-lpr-3d-camera", "LPR_CAMERA", "3D"),
  asset("imps-fixed-camera", "FIXED_CAMERA", "ImPS"),
  asset("imps-image-camera", "FIXED_CAMERA", "Image Processing"),
  asset("imps-image-processor", "IMAGE_PROCESSOR", "Image Processing"),
  asset("imps-scanner", "LASER_SCANNER", "3D"),
  asset("imps-db", "DATABASE_SERVER", "ImPS"),
  asset("imps-display-equipment", "IMPS_DISPLAY_PROCESSING", "ImPS"),
];
const impsTree = buildStationRelationshipTree({ stationFormat: "IMPS", systems: impsSystems, equipment: impsEquipment });
assert.deepEqual(impsTree.map((entry) => entry.groupId), ["imps-image-processing", "imps-wim", "imps-lpr", "imps-cctv", "imps-3d", "imps-lpr-3d", "imps-data-control", "legacy-vms-imps"], "IMPS uses the agreed point order and preserves historical out-of-layout VMS at the end");
assert.deepEqual(scopesFor(impsTree, "lpr").map((entry) => entry.scope), ["ImPS", "3D"], "IMPS LPR keeps separate ImPS and 3D workpoints");
assert.deepEqual(scopesFor(impsTree, "data-control").map((entry) => entry.scope), ["ImPS"], "IMPS Data/Control uses the agreed ImPS Scope");
assert.deepEqual(childIds(parent(scope(impsTree, "wim", "ImPS"), "wim-sorting")), ["imps-sensor"], "IMPS WIM Sensor stays under its parent");
assert.deepEqual(childIds(parent(scope(impsTree, "lpr", "ImPS"), "lpr-control")), ["imps-lpr-camera"], "IMPS LPR camera has a separate ImPS System record");
assert.deepEqual(childIds(parent(scope(impsTree, "lpr", "3D"), "lpr-control")), ["imps-lpr-3d-camera"], "IMPS 3D LPR remains a separate Scope");
assert.deepEqual(childIds(parent(scope(impsTree, "image-processing", "Image Processing"), "image-processing-management")), ["imps-image-camera", "imps-image-processor"], "Image Processing camera and processor nest under their System");
assert.deepEqual(childIds(parent(scope(impsTree, "data-control", "ImPS"), "data-management")), ["imps-db"], "IMPS Database equipment nests under Data/Control System");
assert.equal(category(impsTree, "vms")?.scopes[0]?.systems[0]?.record.id, "imps-vms-old", "an installed historical item remains visible after the current workpoints");

const impsLayout = buildStationRelationshipTree({ stationFormat: "IMPS", includeEmptyGroups: true, includeCatalogOptions: true });
assert.deepEqual(impsLayout.map((entry) => entry.groupId), ["imps-image-processing", "imps-wim", "imps-lpr", "imps-cctv", "imps-3d", "imps-lpr-3d", "imps-data-control"], "IMPS creation shows addable workpoints in the agreed order");
assert.deepEqual(scope(impsLayout, "lpr", "ImPS").systemOptions.map((item) => item.canonicalItemId), ["lpr-control"], "IMPS LPR scope has a separate System template");
assert.deepEqual(scope(impsLayout, "lpr", "3D").equipmentOptions.map((item) => item.equipmentType), ["LPR_CAMERA"], "IMPS 3D LPR camera remains available only in the 3D Scope");
assert.equal(scope(impsLayout, "image-processing", "Image Processing").systemOptions[0]?.canonicalItemId, "image-processing-management", "IMPS Image Processing System uses the agreed Scope name");

const emptySc = buildStationRelationshipTree({ stationFormat: "SC", includeEmptyGroups: true, includeCatalogOptions: true });
assert.deepEqual(emptySc.map((entry) => entry.groupId), ["sc-wim-hs", "sc-lpr-hs", "sc-cctv-hs", "sc-3d", "sc-lpr-3d", "sc-vms-hs", "sc-wim-ls", "sc-lpr-ls", "sc-cctv-ls", "sc-vms-ls", "sc-data-control-central"], "empty SC layout shows addable workpoints and hides unsupported categories");
assert.equal(getStationRelationshipSystemCount({ stationFormat: "SC", systems: scSystems }), scSystems.length, "all installed SC Systems are counted including WIM Control and Electronics parents");
assert.deepEqual(CENTRAL_EQUIPMENT_MAIN_CATEGORIES.map((entry) => entry.id), ["wim", "lpr", "cctv", "3d", "image-processing", "vms", "data-control", "station-infrastructure"], "the Checklist and equipment tree share the same canonical eight-category order");

console.log("station relationship tree mapping passed", { scCategories: scTree.length, impsCategories: impsTree.length, scOptions: emptySc.length });
