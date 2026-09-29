import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../src/app/App.jsx", import.meta.url), "utf8");
const primitives = readFileSync(new URL("../src/app/PagePrimitives.jsx", import.meta.url), "utf8");

for (const name of ["PageHeader", "Breadcrumb", "EmptyState", "ProgressBar"]) {
  assert.match(primitives, new RegExp(`export function ${name}\\(`), `${name} should be exported from the page-primitives module`);
  assert.match(app, new RegExp(`import \\{[^}]*\\b${name}\\b[^}]*\\} from "\\.\\/PagePrimitives\\.jsx"`), `${name} should be imported by App`);
  assert.match(app, new RegExp(`const PAGE_RUNTIME = \\{[\\s\\S]*?\\b${name}\\b`), `${name} should be passed through the existing page registry interface`);
  assert.doesNotMatch(app, new RegExp(`function ${name}\\s*\\(`), `${name} should not be duplicated in App`);
}

assert.match(primitives, /className="ops-page-header"[\s\S]*id="page-heading" tabIndex="-1"/, "page heading should keep its focus target and style hooks");
assert.match(primitives, /<nav className="ops-breadcrumb" aria-label="เส้นทางหน้าปัจจุบัน"[\s\S]*aria-hidden="true"/, "breadcrumb should keep its accessible navigation label and hidden separators");
assert.match(primitives, /className="ops-empty"[\s\S]*<Icon name=\{icon\}/, "empty state should retain its shared icon and style hooks");
assert.match(primitives, /role="progressbar" aria-label=\{label\} aria-valuemin="0" aria-valuemax="100" aria-valuenow=\{value\}/, "progress should preserve accessible value metadata");
assert.doesNotMatch(primitives, /SummaryCards/, "unreferenced summary-card code should not be carried into the shared module");
console.log("test_shared_page_primitives: pass");
