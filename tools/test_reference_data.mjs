import assert from "node:assert/strict";
import { migrateChecklistState } from "../src/domain/storage.js";
import { assignmentOverlaps, hasDuplicateContractNumber, normalizeContractWorkspaceState, validateWorkPackageDraft } from "../src/domain/contracts.js";
import { filterReferenceOptions, mergeLegacyReferenceValues, normalizeReferenceData, provinceOptionFor } from "../src/domain/reference-data.js";
import { assertReferenceDataWriteAllowed } from "../server/state-scope.mjs";

const legacy = migrateChecklistState({
  stationProfiles: [{ id: "station-1", stationCode: "ST-01", stationName: "สถานีเดิม", province: "สมุทรสาคร" }],
  contracts: [{ id: "contract-1", contractNo: "A-01", title: "งานเดิม", contractor: "บริษัทเดิม", agency: "หน่วยงานเดิม" }],
  regions: [],
});
assert.equal(legacy.referenceData.provinces.length, 77);
assert.equal(legacy.stationProfiles[0].provinceId, "province-54");
assert.equal(provinceOptionFor("กทม.", legacy.referenceData).name, "กรุงเทพมหานคร");
assert.ok(legacy.referenceData.contractors.some((entry) => entry.name === "บริษัทเดิม"));
assert.ok(legacy.referenceData.agencies.some((entry) => entry.name === "หน่วยงานเดิม"));
assert.deepEqual(migrateChecklistState(legacy).referenceData, legacy.referenceData, "migration must be idempotent");

const refs = mergeLegacyReferenceValues(normalizeReferenceData({ contractors: [{ id: "c1", name: "บริษัท เดียวกัน", aliases: ["บริษัทเดียวกัน"] }] }), ["บริษัทเดียวกัน", "บริษัทใหม่"], "contractor");
assert.equal(refs.contractors.filter((entry) => entry.name === "บริษัท เดียวกัน").length, 1, "aliases must prevent duplicate master records");
assert.ok(refs.contractors.some((entry) => entry.name === "บริษัทใหม่"));
assert.equal(filterReferenceOptions(refs.contractors, "ใหม่").length, 1);

const duplicateAgencyData = normalizeReferenceData({ agencies: [
  { id: "agency-existing", name: "กรมทางหลวง" },
  { id: "agency-duplicate", name: "กรมทางหลวง" },
] });
assert.deepEqual(duplicateAgencyData.agencies.filter((entry) => entry.name === "กรมทางหลวง").map((entry) => entry.id), ["agency-existing"], "duplicate agency names must collapse while preserving the first ID");
const duplicateAgencyState = normalizeContractWorkspaceState({
  referenceData: { agencies: [{ id: "agency-existing", name: "กรมทางหลวง" }, { id: "agency-duplicate", name: "กรมทางหลวง" }], contractors: [] },
  contracts: [{ id: "contract-duplicate-agency", agencyId: "agency-duplicate", agency: "กรมทางหลวง", title: "งานเดิม" }],
});
assert.equal(duplicateAgencyState.referenceData.agencies.length, 1, "normalized workspace state must remove persisted duplicate agencies");
assert.equal(duplicateAgencyState.contracts[0].agencyId, "agency-existing", "contracts using a duplicate agency ID must be remapped to the preserved ID");

assert.equal(hasDuplicateContractNumber([{ id: "closed", contractNo: " สคน.e-12/2568 " }], "สคน.e-12/2568"), true);
assert.equal(validateWorkPackageDraft({ packageNo: "9", periodStart: "2025-02-01", periodEnd: "2025-01-31" }, { id: "c", startDate: "2025-01-01", endDate: "2025-12-31" }, []).valid, false);
assert.equal(assignmentOverlaps({ stationId: "s", effectiveFrom: "2025-01-01", effectiveTo: "2025-01-31", status: "active" }, { stationId: "s", effectiveFrom: "2025-01-15", effectiveTo: "2025-02-01", status: "active" }), true);

const current = { referenceData: legacy.referenceData };
assert.throws(() => assertReferenceDataWriteAllowed(current, { referenceData: { ...legacy.referenceData, contractors: [] } }, { role: "inspector" }), /Only managers/);
assert.doesNotThrow(() => assertReferenceDataWriteAllowed(current, { referenceData: { ...legacy.referenceData, contractors: [] } }, { role: "station-manager" }));
const normalized = normalizeContractWorkspaceState(legacy);
assert.equal(normalized.contracts[0].contractorId, legacy.referenceData.contractors.find((entry) => entry.name === "บริษัทเดิม").id);
console.log("reference data tests passed");
