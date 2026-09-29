import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

const [registrySource, appSource, reportSource, checklistSource] = await Promise.all([
  read("src/app/icon-system.jsx"),
  read("src/app/App.jsx"),
  read("src/app/CompanyReportCover.jsx"),
  read("src/domain/master-checklist.js"),
]);

const registryNames = new Set(
  [...registrySource.matchAll(/^\s*(?:"([\w-]+)"|([\w-]+)):\s*Icon[A-Za-z0-9]+,/gm)].map((match) => match[1] || match[2]),
);

const requiredNames = [
  "alert", "archive", "arrow", "building", "broom", "calendar", "camera", "check", "checklist",
  "clipboard", "close", "delete", "display", "dots", "edit", "equipment", "evidence",
  "info", "lane", "list", "pin", "plus", "print", "refresh", "save", "search", "server",
  "settings", "system", "tag", "video",
];

for (const name of requiredNames) {
  assert.ok(registryNames.has(name), `icon registry is missing required name: ${name}`);
}

for (const match of registrySource.matchAll(/^\s+[A-Za-z0-9_.-]+:\s+"([\w-]+)",?$/gm)) {
  if (match[1].startsWith("ops-icon-")) continue;
  assert.ok(registryNames.has(match[1]), `icon mapping references an unregistered name: ${match[1]}`);
}

for (const source of [appSource, reportSource]) {
  for (const match of source.matchAll(/(?:name|icon)="([\w-]+)"/g)) {
    assert.ok(registryNames.has(match[1]), `source references an unregistered icon: ${match[1]}`);
  }
}

assert.match(registrySource, /const SC_CATEGORY_ICON_NAMES/);
assert.match(registrySource, /const SC_TYPE_ICON_NAMES/);
assert.match(registrySource, /lane: IconRoad,/);
assert.match(registrySource, /loop: IconLink,/);
assert.match(registrySource, /circuit: IconCircuitAmmeter,/);
assert.match(registrySource, /SC_TYPE_ICON_NAMES\[name\].*\|\| "equipment"/s);
assert.match(registrySource, /export function getEquipmentIconName/);
assert.match(registrySource, /const REPORT_SECTION_ICON_NAMES/);
assert.match(registrySource, /const REPORT_STATUS_ICON_NAMES/);
assert.doesNotMatch(appSource, /@tabler\/icons-react/);
assert.doesNotMatch(reportSource, /@tabler\/icons-react/);
assert.doesNotMatch(appSource, /<svg\b/);
assert.doesNotMatch(reportSource, /<svg\b/);

const equipmentTypesBlock = checklistSource.match(/export const EQUIPMENT_TYPES = \[([\s\S]*?)\n\];/);
assert.ok(equipmentTypesBlock, "could not find EQUIPMENT_TYPES");
const equipmentTypes = [...equipmentTypesBlock[1].matchAll(/value: "([A-Z_]+)"/g)].map((match) => match[1]);
const mappedEquipmentTypes = new Set([...registrySource.matchAll(/^\s+([A-Z_]+):\s+"[\w-]+",?$/gm)].map((match) => match[1]));
for (const type of equipmentTypes) {
  assert.ok(mappedEquipmentTypes.has(type), `equipment type is missing an icon mapping: ${type}`);
}

for (const expression of ["item.type", "equipment.type", "type.value"]) {
  assert.match(appSource, new RegExp(`getEquipmentIconName\\(${expression.replace(".", "\\.")}\\)`));
}

console.log(`Icon system check passed (${registryNames.size} registered names).`);
