import assert from "node:assert/strict";
import { createUiDemoRound } from "../src/domain/demo-fixture.js";
import {
  createDefaultStationProfile,
  createInspectionRound,
  getInspectionProgressModel,
  getItemsForSnapshot,
} from "../src/domain/master-checklist.js";
import { isVehicleApiReviewItem } from "../src/domain/vehicle-search.js";

const profile = createDefaultStationProfile();
const sourceRound = createInspectionRound(profile, { projectName: "Progress model test" });
const round = {
  ...sourceRound,
  snapshot: {
    ...sourceRound.snapshot,
    equipment: [],
    lanes: [],
    checklistConfig: {
      ...(sourceRound.snapshot.checklistConfig || {}),
      disabledTemplateIds: [],
    },
  },
};

const model = getInspectionProgressModel(round);
const applicableItems = model.items.filter((item) => item.applicable !== false && !isVehicleApiReviewItem(item, round.snapshot));

assert.equal(model.applicableItems.length, applicableItems.length, "the progress model exposes the same applicable item scope");
assert.equal(model.total, applicableItems.length, "progress uses applicable items as its denominator");
assert.equal(model.coverage.equipmentCount >= model.coverage.coveredEquipmentCount, true);
assert.equal(model.items.every((item) => item.applicable !== false), true, "the fixture contains only applicable items");

const demoModel = getInspectionProgressModel(createUiDemoRound());
assert.equal(demoModel.total, 107, "the demo round keeps its applicable denominator");
assert.equal(demoModel.items.length > demoModel.total, true, "excluded checklist items stay outside the progress denominator");

console.log("inspection progress model passed", JSON.stringify({
  allItems: model.items.length,
  applicableItems: model.total,
  demoExcluded: demoModel.items.length - demoModel.total,
  equipment: `${model.coverage.coveredEquipmentCount}/${model.coverage.equipmentCount}`,
}));
