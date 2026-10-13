import assert from "node:assert/strict";
import { resolveIsolatedWorkspaceDatabaseUrl } from "./workspace_temp_store.mjs";

assert.throws(() => resolveIsolatedWorkspaceDatabaseUrl(""), /CHECKLIST_POSTGRES_TEST_DATABASE_URL is required/);
assert.throws(
  () => resolveIsolatedWorkspaceDatabaseUrl(
    "postgresql://audit@127.0.0.1:5432/checklist",
    "postgresql://operator@127.0.0.1/checklist",
  ),
  /cannot point to the CHECKLIST_DATABASE_URL database/,
);
assert.equal(
  resolveIsolatedWorkspaceDatabaseUrl(
    "postgresql://audit@127.0.0.1:60488/checklist_test",
    "postgresql://operator@127.0.0.1:60448/checklist",
  ),
  "postgresql://audit@127.0.0.1:60488/checklist_test",
);
console.log("isolated workspace-store database guard: PASS (requires test DSN; rejects live database identity)");
