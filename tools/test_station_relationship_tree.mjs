import assert from "node:assert/strict";
import { buildStationRelationshipTree, getRelationshipPathForRecord, getStationRelationshipSystemCount } from "../src/domain/station-relationship-tree.js";
import { getBoqAddCategory } from "../src/domain/boq-checklist-groups.js";
import { getWorkSpecEquipmentOwnerVariants } from "../src/domain/work-spec-equipment.js";

const system = (id, canonicalItemId, scope = "") => ({ id, canonicalItemId, scope, quantity: 1, active: true, sourceRefs: [] });
const asset = (id, type, scope = "") => ({ id, type, scope, active: true, assetNo: `${id}-NO`, sourceRefs: [] });

for (const format of ["SC", "IMPS"]) {
  const scope = format === "IMPS" ? "ImPS" : "Low Speed";
  const ownerVariants = getWorkSpecEquipmentOwnerVariants({ type: "CONTROL_COMPUTER" }, scope, ["wim-control"], []);
  const cabinetVariants = getWorkSpecEquipmentOwnerVariants({ type: "CONTROL_CABINET" }, scope, ["wim-electronics-system"], []);

  assert.deepEqual(ownerVariants.map((item) => item.variantScope), [scope], `${format} Work Spec should offer Control Computer and create its hidden owner on add`);
  assert.deepEqual(cabinetVariants.map((item) => item.variantScope), [scope], `${format} Work Spec should offer Electronics Cabinet and create its hidden owner on add`);
  assert.deepEqual(getWorkSpecEquipmentOwnerVariants({ type: "LPR_CAMERA" }, scope, ["lpr-control"], []), [], "visible System owners should remain required before offering their equipment");
  assert.equal(getBoqAddCategory({ stationFormat: format, type: "CONTROL_COMPUTER", categoryCode: "2.2", scope }).groupId, format === "IMPS" ? "IMPS-02" : "SC-04");
}

const scSystems = [
  system("wim-1", "wim-sorting", "High Speed"),
  system("wim-control-1", "wim-control", "High Speed"),
  system("wim-electronics-1", "wim-electronics-system", "High Speed"),
  system("wim-data-high", "wim-high-data-control", "High Speed"),
  system("wim-display-high", "wim-high-display", "High Speed"),
  system("wim-data-low", "wim-low-data-control", "Low Speed"),
  system("wim-display-low", "wim-low-display", "Low Speed"),
  system("lpr-high", "lpr-control", "High Speed"),
  system("lpr-3d", "lpr-control", "3D"),
  system("cctv-high", "cctv-system", "High Speed"),
  system("vms-low", "vms-control", "Low Speed"),
  system("dimension", "dimension-management", "3D"),
  system("database", "data-management", "Central"),
  system("display", "station-display", "Central"),
];
const scEquipment = [
  asset("sensor", "WIM_SENSOR", "High Speed"),
  asset("loop", "WIM_LOOP", "High Speed"),
  asset("computer", "CONTROL_COMPUTER", "High Speed"),
  asset("cabinet", "CONTROL_CABINET", "High Speed"),
  asset("switching", "WIM_SWITCHING_DC", "High Speed"),
  asset("lpr-camera", "LPR_CAMERA", "3D"),
  asset("fixed", "FIXED_CAMERA", "High Speed"),
  asset("ptz", "PTZ_CAMERA", "High Speed"),
  asset("nvr", "NVR", "High Speed"),
  asset("vms-sign", "VMS_SIGN", "Low Speed"),
  asset("vms-light", "VMS_LIGHT_SENSOR", "Low Speed"),
  asset("vms-display", "VMS_DISPLAY", "Low Speed"),
  asset("scanner", "LASER_SCANNER", "3D"),
  asset("controller", "DIMENSION_CONTROLLER", "3D"),
  asset("db-server", "DATABASE_SERVER", "Central"),
  asset("display-equipment", "IMPS_DISPLAY_PROCESSING", "Central"),
];

const scTree = buildStationRelationshipTree({ stationFormat: "SC", systems: scSystems, equipment: scEquipment });
const scGroup = (code) => scTree.find((entry) => entry.code === code);
const scCategory = (code, id) => scGroup(code)?.categories.find((entry) => entry.id === id);

assert.equal(scCategory("01", "wim-sorting")?.assets.length, 2, "SC High Speed WIM assets stay under WIM Sorting");
assert.equal(scCategory("01", "wim-control")?.assets.length, 1, "SC WIM Control Computer stays under WIM Control");
assert.equal(scCategory("01", "wim-electronics")?.assets.length, 2, "SC electronics assets stay under WIM Electronics");
assert.equal(scCategory("03", "3d")?.assets.length, 2, "SC 3D owns scanner and controller");
assert.equal(scCategory("03", "lpr")?.assets.length, 1, "SC 3D LPR camera stays in the LPR category of SC-03");
assert.equal(scCategory("04", "wim-data-control")?.systems.length, 2, "SC Low Speed data systems stay out of High Speed");
assert.equal(scCategory("01", "wim-data-control")?.systems.some((entry) => entry.canonicalItemId === "wim-high-display"), true, "SC High Speed WIM display processing stays under WIM Data/Control");
assert.equal(scCategory("04", "wim-data-control")?.systems.some((entry) => entry.canonicalItemId === "wim-low-display"), true, "SC Low Speed WIM display processing stays under WIM Data/Control");
assert.equal(scCategory("06", "display-processing")?.systems.some((entry) => ["wim-high-display", "wim-low-display"].includes(entry.canonicalItemId)), false, "WIM High/Low display systems do not leak into Central Display/Data Processing");
assert.equal(scCategory("05", "vms")?.assets.length, 3, "SC Low Speed VMS keeps all three physical items");
assert.equal(scCategory("06", "data")?.assets.length, 1, "SC Database Server stays in Central Systems");
assert.equal(scTree.flatMap((group) => group.categories.flatMap((category) => category.systems)).some((entry) => entry.canonicalItemId === "wim-control"), false, "legacy WIM Control System row is hidden from the relationship tree");
assert.equal(scTree.flatMap((group) => group.categories.flatMap((category) => category.systems)).some((entry) => entry.canonicalItemId === "wim-electronics-system"), false, "legacy WIM Electronics System row is hidden from the relationship tree");
assert.equal(getStationRelationshipSystemCount({ stationFormat: "SC", systems: scSystems }), scSystems.length - 2, "station System summary excludes the two hidden legacy rows so its count matches the visible relationship tree");
assert.equal(getRelationshipPathForRecord({ stationFormat: "SC", systems: scSystems, equipment: scEquipment, kind: "asset", recordId: "lpr-camera" }), "SC-03.01 · LPR");
const scInstalledWimOnly = buildStationRelationshipTree({ stationFormat: "SC", systems: [system("sc-wim-only", "wim-sorting", "High Speed")] });
assert.deepEqual(scInstalledWimOnly.map((group) => group.groupId), ["SC-01"], "the installed view hides unselected SC groups and keeps the station format in the group name");

const impsTree = buildStationRelationshipTree({
  stationFormat: "IMPS",
  systems: [system("imps-image", "image-processing-management", "Image Processing"), system("imps-wim", "wim-sorting", "ImPS"), system("imps-lpr", "lpr-control", "3D"), system("imps-cctv", "cctv-system", "ImPS"), system("imps-db", "data-management", "ImPS")],
  equipment: [asset("imps-processor", "IMAGE_PROCESSOR", "Image Processing"), asset("imps-sensor", "WIM_SENSOR", "ImPS"), asset("imps-lpr-camera", "LPR_CAMERA", "3D"), asset("imps-ptz", "PTZ_CAMERA", "ImPS"), asset("imps-db-server", "DATABASE_SERVER", "ImPS")],
});
assert.equal(impsTree.find((group) => group.code === "01")?.categories.find((category) => category.id === "image-processing")?.assets.length, 1, "IMPS Image Processing owns Image Processor");
assert.equal(impsTree.find((group) => group.code === "03")?.categories.find((category) => category.id === "lpr")?.assets.length, 1, "IMPS 3D LPR stays in IMPS-03");
assert.equal(impsTree.find((group) => group.code === "05")?.categories.find((category) => category.id === "cctv")?.assets.length, 1, "IMPS CCTV stays in IMPS-05");
assert.equal(impsTree.find((group) => group.code === "06")?.categories.find((category) => category.id === "data")?.assets.length, 1, "IMPS Database stays in IMPS-06");
const impsInstalledImageOnly = buildStationRelationshipTree({ stationFormat: "IMPS", systems: [system("imps-image-only", "image-processing-management", "Image Processing")] });
assert.deepEqual(impsInstalledImageOnly.map((group) => group.groupId), ["IMPS-01"], "the installed view uses the selected IMPS format and hides empty groups");

const scWithOutOfFormatRecords = buildStationRelationshipTree({
  stationFormat: "SC",
  systems: scSystems,
  equipment: [...scEquipment, asset("sc-image-processor", "IMAGE_PROCESSOR", "Image Processing"), asset("sc-unknown", "UNKNOWN", "")],
});
const scUnmapped = scWithOutOfFormatRecords.find((group) => group.groupId === "unmapped");
assert.equal(scUnmapped?.assetCount, 2, "out-of-format and uncategorized SC Assets remain visible in a dedicated group");
assert.deepEqual(scUnmapped?.categories[0]?.assets.map((entry) => entry.id), ["sc-image-processor", "sc-unknown"]);
assert.equal(getRelationshipPathForRecord({ stationFormat: "SC", systems: scSystems, equipment: [...scEquipment, asset("sc-image-processor", "IMAGE_PROCESSOR", "Image Processing")], kind: "asset", recordId: "sc-image-processor" }), "นอกแบบ / ยังไม่จัดหมวด");

const impsWithOutOfFormatVms = buildStationRelationshipTree({
  stationFormat: "IMPS",
  systems: [],
  equipment: [asset("imps-out-of-format-vms", "VMS_SIGN", "High Speed")],
});
assert.equal(impsWithOutOfFormatVms.find((group) => group.groupId === "unmapped")?.assetCount, 1, "out-of-format IMPS Assets remain visible instead of disappearing");

const scLayout = buildStationRelationshipTree({ stationFormat: "SC", includeEmptyGroups: true, includeCatalogOptions: true });
assert.equal(scLayout.length, 6, "SC full layout keeps all six station groups visible before installation");
assert.equal(scLayout.find((group) => group.code === "01")?.categories.find((category) => category.id === "wim-sorting")?.equipmentOptions.map((item) => item.equipmentType).join(","), "WIM_SENSOR,WIM_LOOP", "SC High Speed exposes WIM Sensor and Loop as addable equipment choices");
assert.equal(scLayout.find((group) => group.code === "04")?.categories.find((category) => category.id === "wim-sorting")?.equipmentOptions.map((item) => item.equipmentType).join(","), "WIM_SENSOR,WIM_LOOP", "SC Low Speed exposes the same WIM equipment choices");
assert.deepEqual(scLayout.find((group) => group.code === "04")?.categories.find((category) => category.id === "wim-data-control")?.systemOptions.map((item) => item.canonicalItemId), ["wim-low-data-control", "wim-low-reporting", "wim-low-display"], "SC Low Speed shows all three WIM Data/Control systems in the correct category");
assert.equal(scLayout.find((group) => group.code === "03")?.categories.find((category) => category.id === "lpr")?.equipmentOptions[0]?.scope, "3D", "SC 3D LPR option stays scoped to 3D");
assert.equal(scLayout.find((group) => group.code === "02")?.categories.find((category) => category.id === "vms")?.equipmentOptions.some((item) => item.equipmentType === "VMS_SIGN"), true, "SC High Speed VMS sign is available in the VMS category");
assert.equal(scLayout.find((group) => group.code === "05")?.categories.find((category) => category.id === "vms")?.equipmentOptions.some((item) => item.equipmentType === "VMS_SIGN"), true, "SC Low Speed VMS sign is available in the VMS category");
assert.equal(scLayout.find((group) => group.code === "06")?.categories.find((category) => category.id === "data")?.equipmentOptions[0]?.scope, "Central", "SC Central Database Server does not get duplicate Speed-scope options");
assert.equal(scLayout.find((group) => group.code === "01")?.categories.find((category) => category.id === "wim-electronics")?.equipmentOptions.some((item) => item.equipmentType === "WIM_AC_DC_POWER_SUPPLY"), true, "SC WIM Electronics uses the same add options in creation and profile views");
assert.equal(scLayout.flatMap((group) => group.categories.flatMap((category) => category.systemOptions)).some((item) => ["wim-control", "wim-electronics-system"].includes(item.canonicalItemId)), false, "Hidden WIM Control/Electronics System rows stay out of the new layout choices");

const impsLayout = buildStationRelationshipTree({ stationFormat: "IMPS", includeEmptyGroups: true, includeCatalogOptions: true });
assert.equal(impsLayout.length, 6, "IMPS full layout keeps all six station groups visible before installation");
assert.equal(impsLayout.find((group) => group.code === "03")?.categories.find((category) => category.id === "3d")?.equipmentOptions.map((item) => item.equipmentType).join(","), "LASER_SCANNER,DIMENSION_CONTROLLER", "IMPS 3D exposes scanner and controller choices");
assert.equal(impsLayout.find((group) => group.code === "03")?.categories.find((category) => category.id === "lpr")?.equipmentOptions.some((item) => item.scope === "3D"), true, "IMPS 3D LPR camera remains a separate scoped choice");
assert.equal(impsLayout.find((group) => group.code === "01")?.categories.find((category) => category.id === "image-processing")?.systemOptions.map((item) => item.canonicalItemId).join(","), "image-processing-management", "IMPS Image Processing presents one correctly scoped System choice");
assert.equal(impsLayout.find((group) => group.code === "05")?.categories.find((category) => category.id === "cctv")?.equipmentOptions.some((item) => item.equipmentType === "JOYSTICK"), false, "Camera Joystick remains unavailable in IMPS");

console.log("station relationship tree mapping passed", { scGroups: scTree.length, impsGroups: impsTree.length });
