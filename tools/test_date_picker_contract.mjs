import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const appRoot = new URL("../src/app/", import.meta.url);
const pageRoot = new URL("pages/", appRoot);
const appSource = readFileSync(new URL("App.jsx", appRoot), "utf8");
const pageSource = readdirSync(pageRoot)
  .filter((fileName) => fileName.endsWith(".jsx"))
  .map((fileName) => readFileSync(new URL(fileName, pageRoot), "utf8"))
  .join("\n");
const activeUiSource = `${appSource}\n${pageSource}`;

assert.doesNotMatch(activeUiSource, /type=["']date["']/, "active UI must not fall back to the browser-native date picker");
const datePickerSource = readFileSync(new URL("date-picker.jsx", appRoot), "utf8");
assert.match(datePickerSource, /export function ThaiDatePicker\s*\(/, "date-only fields must use the shared ThaiDatePicker module");
assert.match(datePickerSource, /export function ThaiDateTimePicker\s*\(/, "date-time fields must keep the shared ThaiDateTimePicker module");
assert.match(datePickerSource, /className=\"ops-date-time-popover\"/, "date and date-time fields must share the portal popover implementation");
assert.match(datePickerSource, /mode === \"date\"/, "the shared implementation must keep a date-only path");

console.log("date picker contract tests passed");
