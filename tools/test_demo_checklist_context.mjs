import assert from "node:assert/strict";
import fs from "node:fs";

const checklistPage = fs.readFileSync("src/app/pages/ChecklistPage.jsx", "utf8");

assert.match(
  checklistPage,
  /\{isDemoRound\s*&&\s*<div className="ops-demo-banner"/s,
  "demo rounds must display the current non-persisting fixture notice",
);
assert.doesNotMatch(checklistPage, /ops-round-context-panel/, "the retired round context panel must not return");

console.log("demo checklist context regression contract passed");
