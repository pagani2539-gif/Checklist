import assert from "node:assert/strict";
import { createEmptyChecklistState, normalizeServerChecklistState } from "../src/domain/storage.js";

const empty = normalizeServerChecklistState({});
const expectedEmpty = createEmptyChecklistState();
assert.deepEqual(empty.stationProfiles, expectedEmpty.stationProfiles);
assert.deepEqual(empty.inspectionRounds, expectedEmpty.inspectionRounds);
assert.ok(Array.isArray(empty.itemCatalog));
assert.ok(empty.itemCatalog.length > 0);

const partial = normalizeServerChecklistState({ stationProfiles: [], inspectionRounds: [] });
assert.deepEqual(partial.stationProfiles, []);
assert.deepEqual(partial.inspectionRounds, []);
assert.ok(Array.isArray(partial.checklistCopy?.sections));
assert.ok(Array.isArray(partial.masterChecklistCopy?.sections));

console.log("server state bootstrap normalization passed", JSON.stringify({
  itemCatalog: empty.itemCatalog.length,
  checklistSections: empty.checklistCopy.sections.length,
  masterSections: empty.masterChecklistCopy.sections.length,
}));
