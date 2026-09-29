import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("../src/app/App.jsx", import.meta.url), "utf8");
const controls = readFileSync(new URL("../src/app/controls/ActionControls.jsx", import.meta.url), "utf8");

assert.match(appSource, /import \{ Button, ConfirmDialog \} from "\.\/controls\/ActionControls\.jsx"/, "App should compose the shared controls through their module interface");
assert.doesNotMatch(appSource, /function (?:Button|ConfirmDialog)\s*\(/, "shared action controls should not remain duplicated in App");
assert.match(appSource, /PAGE_RUNTIME\.[\s\S]*\bButton\b/, "page factories should keep receiving the shared Button");
assert.match(controls, /export function Button\(/, "the shared button should retain a named export");
assert.match(controls, /export function ConfirmDialog\(/, "the dialog should retain a named export");
assert.match(controls, /className=\{classes\}/, "button variants should keep their existing CSS classes");
assert.match(controls, /request\.requiredCode[\s\S]*confirmationValue\.trim\(\) === requiredCode/, "typed confirmation should remain enforced");
assert.match(controls, /event\.key === "Escape"[\s\S]*onResolve\(false\)/, "Escape should continue cancelling the dialog");
assert.match(controls, /event\.key !== "Tab"/, "Tab should be handled within the dialog");
assert.ok(controls.includes("first.focus();") && controls.includes("last.focus();"), "Tab should wrap focus in both directions");
assert.match(controls, /previousFocus instanceof HTMLElement[\s\S]*previousFocus\.focus\(\)/, "closing the dialog should restore the previous focus");
assert.match(controls, /onResolve\(true\)/, "confirmation should continue resolving true");
console.log("test_action_controls_module: pass");
