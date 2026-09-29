import assert from "node:assert/strict";
import fs from "node:fs";

const checklistPage = fs.readFileSync("src/app/pages/ChecklistPage.jsx", "utf8");

assert.match(
  checklistPage,
  /!isQuickFieldRound\s*&&\s*!isDemoRound\s*&&\s*<section className="ops-panel ops-round-context-panel"/s,
  "demo checklist rounds must not render the obsolete no-contract work-context panel",
);

console.log("demo checklist context regression contract passed");
