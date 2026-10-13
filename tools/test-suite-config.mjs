import fs from "node:fs";
import path from "node:path";

export const QUICK_TEST_FILES = Object.freeze([
  "tools/test_checklist_completion.mjs",
  "tools/test_runtime_checklist_labels.mjs",
  "tools/test_station_relationship_tree.mjs",
  "tools/test_vehicle_review_progress.mjs",
  "tools/test_vehicle_evidence_context_storage.mjs",
  "tools/test_workspace_operations.mjs",
  "tools/test_server_conflict_recovery_contract.mjs",
  "tools/test_copy_consistency.mjs",
  "tools/test_page_runtime_contract.mjs",
  "tools/test_workspace_temp_store_isolation.mjs",
]);

const FEATURE_MATCHERS = Object.freeze({
  vehicle: /(?:^|\/)test_(?:vehicle_[^/]+|round_vehicle_connection|plate_legacy_count|lpr_(?:layout|scope_names)|automatic_software_tests)\.mjs$/i,
  checklist: /(?:^|\/)test_(?:checklist_[^/]+|boq_[^/]+|evidence_[^/]+|inspection_progress_model|progress_policy|pending_checklist_results|runtime_checklist_labels|item_library|ordering|copy_consistency|quick_inspection_flow|equipment_cleaning|equipment_subcategories)\.mjs$/i,
  station: /(?:^|\/)test_(?:station_[^/]+|wim_[^/]+|ac_dc_split|equipment_[^/]+|electronics_device_pages|lpr_(?:layout|scope_names)|automatic_software_tests|system_location_heading)\.mjs$/i,
  server: /(?:^|\/)test_(?:server_[^/]+|workspace_[^/]+|attachment_[^/]+|postgres_store|z_local_auth|no_login_auth|oidc_flow|api_[^/]+|state_scope|backup_retention|conflict_round_deletion|imps_purge|video_purge)\.mjs$/i,
  reports: /(?:^|\/)(?:pdf\/test_[^/]+|test_(?:report_[^/]+|print_[^/]+|printable_report_module|snapshot_[^/]+|station_inspection_reports|vehicle_snapshot_[^/]+|vehicle_report_[^/]+))\.mjs$/i,
  ui: /(?:^|\/)test_(?:contextual_layout|single_viewport_workspace|shared_(?:select_usage|page_primitives)|action_controls_module|icon_system|navigation_router|page_runtime_contract|ui_foundation_tokens|station_tor_ui|lpr_layout|checklist_(?:queue|pager)_layout)\.mjs$/i,
});

export const FEATURE_SUITE_NAMES = Object.freeze(Object.keys(FEATURE_MATCHERS));

export const ISOLATED_POSTGRES_TEST_FILES = Object.freeze([
  "tools/test_attachment_migration.mjs",
  "tools/test_plate_legacy_count.mjs",
  "tools/test_oidc_flow.mjs",
  "tools/test_postgres_store.mjs",
  "tools/test_public_artifact.mjs",
  "tools/test_server_api.mjs",
  "tools/test_workspace_operation_api.mjs",
  "tools/test_vehicle_focused_api.mjs",
  "tools/test_workspace_operation_store.mjs",
  "tools/test_z_local_auth.mjs",
]);

function normalize(file) {
  return file.replaceAll("\\", "/");
}

export function discoverTestFiles(toolsDirectory, rootToolsDirectory = toolsDirectory) {
  return fs.readdirSync(toolsDirectory, { withFileTypes: true })
    .flatMap((entry) => {
      const absolute = path.join(toolsDirectory, entry.name);
      if (entry.isDirectory()) return discoverTestFiles(absolute, rootToolsDirectory);
      return entry.name.startsWith("test_") && entry.name.endsWith(".mjs")
        ? [path.relative(path.dirname(rootToolsDirectory), absolute)]
        : [];
    })
    .sort((left, right) => left.localeCompare(right));
}

export function selectTestFiles(testFiles, { tier = "all", feature = "" } = {}) {
  const sorted = [...testFiles].sort((left, right) => left.localeCompare(right));
  if (tier === "all") return sorted;

  const normalized = sorted.map((file) => ({ file, name: normalize(file) }));
  if (tier === "quick") {
    const available = new Set(normalized.map(({ name }) => name));
    const missing = QUICK_TEST_FILES.filter((file) => !available.has(file));
    if (missing.length) throw new Error(`Quick suite refers to missing test files: ${missing.join(", ")}`);
    return QUICK_TEST_FILES.map((file) => normalized.find((entry) => entry.name === file).file);
  }

  if (tier === "feature") {
    const matcher = FEATURE_MATCHERS[feature];
    if (!matcher) throw new Error(`Unknown feature suite "${feature}". Choose: ${FEATURE_SUITE_NAMES.join(", ")}`);
    const selected = normalized.filter(({ name }) => matcher.test(name)).map(({ file }) => file);
    if (!selected.length) throw new Error(`Feature suite "${feature}" matched no test files`);
    return selected;
  }

  throw new Error(`Unknown test tier "${tier}". Choose: all, quick, or feature`);
}
