import assert from "node:assert/strict";
import {
  filterCatalogItemsByBoqGroup,
  getBoqScopeForGroup,
} from "../src/domain/boq-checklist-groups.js";
import { getCanonicalItemsForFormat } from "../src/domain/canonical-station-catalog.js";
import { makeEquipment, normalizeEquipment } from "../src/domain/master-checklist.js";

const canonicalItems = getCanonicalItemsForFormat("SC");
const catalog = [
  { id: "wim-switching-dc", type: "WIM_SWITCHING_DC", categoryCode: "2.3", active: true },
  { id: "lpr-camera", type: "LPR_CAMERA", categoryCode: "3.2", active: true },
  { id: "dimension-scanner", type: "LASER_SCANNER", categoryCode: "1.1.5", active: true },
];

assert.equal(getBoqScopeForGroup("SC", "04"), "Low Speed");
assert.equal(getBoqScopeForGroup("SC", "SC-01"), "High Speed");
assert.equal(getBoqScopeForGroup("IMPS", "IMPS-01"), "Image Processing");
assert.equal(getBoqScopeForGroup("IMPS", "02"), "ImPS");
assert.deepEqual(
  filterCatalogItemsByBoqGroup(catalog, canonicalItems, { stationFormat: "SC", groupCode: "04" }).map((item) => item.id),
  ["wim-switching-dc", "lpr-camera"],
  "opening SC Low Speed must show its WIM and Low Speed LPR entries but hide other groups",
);
assert.deepEqual(
  filterCatalogItemsByBoqGroup(catalog, canonicalItems, { stationFormat: "SC", groupCode: "03" }).map((item) => item.id),
  ["lpr-camera", "dimension-scanner"],
  "opening SC 3D must show 3D-capable equipment and hide types without a 3D scope",
);

const scopedAsset = makeEquipment("FIXED_CAMERA", 1, {
  id: "context-linked-camera",
  parentSystemId: "image-processing-system",
  scope: "Image Processing",
});
assert.equal(scopedAsset.parentSystemId, "image-processing-system", "catalog additions retain the selected parent System");
assert.equal(normalizeEquipment(scopedAsset).parentSystemId, "image-processing-system", "parent System identity survives state normalization");

console.log("PASS: add-panel catalog follows the selected BOQ group and its derived Scope.");
