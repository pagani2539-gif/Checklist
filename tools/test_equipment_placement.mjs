import assert from "node:assert/strict";
import {
  getCanonicalEquipmentCategoryCode,
  getBoqAddCategory,
  resolveEquipmentPlacement,
} from "../src/domain/boq-checklist-groups.js";
import { getCanonicalItemsForFormat } from "../src/domain/canonical-station-catalog.js";
import { WIM_ELECTRONICS_OUTPUT_VOLTAGES } from "../src/domain/wim-electronics.js";
import { createSnapshot, normalizeSnapshot } from "../src/domain/master-checklist.js";

const scopeFor = (item, format) => {
  if (item.id.startsWith("dimension-")) return "3D";
  if (format === "IMPS") return item.allowedScopes.includes("ImPS") ? "ImPS" : null;
  if (["data-management", "station-display"].includes(item.id)) return item.allowedScopes.includes("Central") ? "Central" : null;
  return item.allowedScopes.includes("High Speed") ? "High Speed" : item.allowedScopes[0] || null;
};

for (const format of ["SC", "IMPS"]) {
  for (const item of getCanonicalItemsForFormat(format)) {
    const placement = resolveEquipmentPlacement({
      stationFormat: format,
      kind: item.kind,
      type: item.equipmentType,
      canonicalItemId: item.id,
      categoryCode: item.checklistMapping[0],
      scope: scopeFor(item, format),
    });
    assert.equal(placement.kind, item.kind, `${format} ${item.id} keeps Asset/System kind`);
    assert.ok(placement.categoryCode, `${format} ${item.id} has a canonical BOQ category`);
    assert.ok(placement.code, `${format} ${item.id} has a presentation code`);
    assert.equal(placement.code.endsWith(item.kind === "system" ? ".02" : ".01"), true, `${format} ${item.id} uses .01/.02 correctly`);
  }
}

const wimElectronicsAssets = getCanonicalItemsForFormat("SC")
  .filter((item) => item.kind === "asset" && item.checklistMapping.includes("2.3"));
assert.deepEqual(wimElectronicsAssets.map((item) => item.id), [
  "wim-electronics",
  "wim-ac-dc-power-supply",
  "wim-network-equipment",
  "wim-controller",
  "wim-phase-protection",
  "wim-sub-breaker",
  "wim-switching-dc",
  "wim-transformer-24vac",
]);
assert.deepEqual(WIM_ELECTRONICS_OUTPUT_VOLTAGES, [12, 24, 48]);

assert.equal(getCanonicalEquipmentCategoryCode({ type: "WIM_SWITCHING_DC", categoryCode: "7.1" }), "2.3");
assert.deepEqual(
  getBoqAddCategory({ stationFormat: "SC", type: "WIM_SWITCHING_DC", categoryCode: "7.1", scope: "Low Speed" }),
  {
    code: "SC-04.01",
    displayNumber: "04.01",
    groupId: "SC-04",
    groupCode: "04",
    title: "Low Speed WIM - Equipment",
    sourceCode: "2.3",
  },
);
assert.equal(
  resolveEquipmentPlacement({ stationFormat: "SC", kind: "system", canonicalItemId: "wim-electronics-system", categoryCode: "2.1", scope: "High Speed" }).code,
  "SC-01.02",
);
assert.equal(
  resolveEquipmentPlacement({ stationFormat: "IMPS", kind: "system", canonicalItemId: "wim-electronics-system", categoryCode: "2.1", scope: "ImPS" }).code,
  "IMPS-02.02",
);
assert.equal(
  resolveEquipmentPlacement({ stationFormat: "IMPS", type: "LPR_CAMERA", categoryCode: "3.2", scope: "3D" }).code,
  "IMPS-03.01",
);
assert.equal(
  resolveEquipmentPlacement({ stationFormat: "IMPS", type: "FIXED_CAMERA", categoryCode: "4.1", scope: "Image Processing" }).code,
  "IMPS-01.01",
);
assert.equal(getCanonicalItemsForFormat("IMPS").some((item) => item.category === "VMS"), false);
assert.equal(getCanonicalItemsForFormat("SC").some((item) => item.id === "ptz-camera"), true);

const currentProfile = {
  id: "profile-current",
  stationFormat: "SC",
  stationTemplateId: "SC",
  stationCode: "SC-LEGACY-MAP",
  stationName: "Legacy Mapping Station",
  province: "ระนอง",
  direction: "unspecified",
  stationSystems: [],
  lanes: [],
  equipment: [{ id: "legacy-swdc", type: "WIM_SWITCHING_DC", categoryCode: "7.1", assetNo: "SWDC-01", active: true }],
  checklistConfig: {},
};
const newSnapshot = createSnapshot(currentProfile);
assert.equal(newSnapshot.equipment[0].categoryCode, "2.3", "new Snapshot uses canonical WIM Electronics category");
const historicalSnapshot = normalizeSnapshot({
  id: "snapshot-history",
  stationFormat: "SC",
  stationCode: "SC-HISTORY",
  stationName: "Historical Station",
  equipment: [{ id: "historical-swdc", type: "WIM_SWITCHING_DC", categoryCode: "7.1", assetNo: "SWDC-OLD", active: true }],
}, currentProfile);
assert.equal(historicalSnapshot.equipment[0].categoryCode, "7.1", "historical Snapshot keeps its stored category code");

console.log("equipment placement resolver and SC/IMPS catalog mapping passed");
