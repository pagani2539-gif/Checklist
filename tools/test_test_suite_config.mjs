import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  discoverTestFiles,
  FEATURE_SUITE_NAMES,
  ISOLATED_POSTGRES_TEST_FILES,
  QUICK_TEST_FILES,
  selectTestFiles,
} from "./test-suite-config.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const all = discoverTestFiles(path.join(root, "tools"));
const normalizedAll = all.map((file) => file.replaceAll("\\", "/"));

assert.ok(all.length > 100, "full suite should discover the repository's test files");
assert.equal(new Set(normalizedAll).size, all.length, "full suite should not run a test file twice");
assert.deepEqual(selectTestFiles(all), all, "default tier should preserve the complete suite");

const quick = selectTestFiles(all, { tier: "quick" }).map((file) => file.replaceAll("\\", "/"));
assert.deepEqual(quick, [...QUICK_TEST_FILES]);
assert.equal(new Set(quick).size, quick.length, "quick suite should not contain duplicate files");
assert.ok(!quick.some((file) => /test_(?:postgres_store|server_api|attachment_migration|station_attachment_migration|oidc_flow|z_local_auth|api_rate_limits)\.mjs$/.test(file)), "quick suite must not start database or network integration tests");
assert.ok(ISOLATED_POSTGRES_TEST_FILES.includes("tools/test_postgres_store.mjs"));
assert.ok(ISOLATED_POSTGRES_TEST_FILES.includes("tools/test_workspace_operation_store.mjs"));
assert.ok(ISOLATED_POSTGRES_TEST_FILES.includes("tools/test_z_local_auth.mjs"));
assert.ok(!ISOLATED_POSTGRES_TEST_FILES.includes("tools/test_round_vehicle_connection.mjs"), "mixed domain/integration files should still run without PostgreSQL");

const expectedExamples = {
  vehicle: "tools/test_vehicle_search.mjs",
  checklist: "tools/test_checklist_completion.mjs",
  station: "tools/test_station_relationship_tree.mjs",
  server: "tools/test_workspace_operations.mjs",
  reports: "tools/pdf/test_report_template_model.mjs",
  ui: "tools/test_page_runtime_contract.mjs",
};
assert.deepEqual(Object.keys(expectedExamples), [...FEATURE_SUITE_NAMES]);
for (const [feature, example] of Object.entries(expectedExamples)) {
  const selected = selectTestFiles(all, { tier: "feature", feature }).map((file) => file.replaceAll("\\", "/"));
  assert.ok(selected.length > 0, `${feature} feature suite should not be empty`);
  assert.ok(selected.includes(example), `${feature} feature suite should include ${example}`);
  assert.ok(selected.every((file) => normalizedAll.includes(file)), `${feature} suite must only select discovered test files`);
}

assert.throws(() => selectTestFiles(all, { tier: "feature", feature: "unknown" }), /Unknown feature suite/);
assert.throws(() => selectTestFiles(all, { tier: "unknown" }), /Unknown test tier/);
console.log(`test suite tiers: PASS (full=${all.length}, quick=${quick.length}, features=${FEATURE_SUITE_NAMES.join(",")})`);
