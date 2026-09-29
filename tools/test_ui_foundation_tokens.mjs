import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const tokens = read("src/styles/tokens.css");
const foundation = read("src/styles/foundation.css");
const redesign = read("src/styles/redesign.css");
const workspaceLayout = read("src/styles/workspace-layout.css");

for (const token of [
  "--ops-type-caption",
  "--ops-type-caption-sm",
  "--ops-type-micro",
  "--ops-type-meta",
  "--ops-type-label",
  "--ops-type-body-compact",
  "--ops-type-body",
  "--ops-type-section",
  "--ops-type-heading-md",
  "--ops-type-page-sm",
  "--ops-type-page-lg",
  "--ops-weight-regular",
  "--ops-weight-medium",
  "--ops-weight-semibold",
  "--ops-weight-bold",
  "--ops-space-1",
  "--ops-space-7",
  "--ops-color-primary",
  "--ops-color-primary-hover",
  "--ops-color-white",
  "--ops-color-success",
  "--ops-color-warning",
  "--ops-color-error",
  "--ops-color-error-soft",
  "--ops-color-primary-border",
  "--ops-color-success-border",
  "--ops-color-warning-border",
  "--ops-color-warning-strong",
  "--ops-color-danger-border",
  "--ops-color-neutral-surface",
  "--ops-color-closed-surface",
  "--ops-color-warning-surface",
  "--ops-color-attention",
  "--ops-color-attention-border",
  "--ops-color-attention-surface",
]) assert.ok(tokens.includes(token), `missing design token ${token}`);

for (const [token, value] of Object.entries({
  "--ops-color-white": "#ffffff",
  "--ops-color-primary-hover": "#1d4ed8",
  "--ops-color-error-soft": "var(--ops-danger-soft)",
})) assert.ok(tokens.includes(`${token}: ${value};`), `${token} should preserve the existing palette value ${value}`);

for (const [token, value] of Object.entries({
  "--ops-type-micro": "10px",
  "--ops-type-caption-sm": "11px",
  "--ops-type-caption": "12px",
  "--ops-type-meta": "13px",
  "--ops-type-label": "14px",
  "--ops-type-body-compact": "15px",
  "--ops-type-body": "16px",
  "--ops-type-heading-sm": "18px",
  "--ops-type-section": "20px",
  "--ops-type-heading-md": "22px",
  "--ops-type-page-sm": "24px",
  "--ops-type-page-lg": "32px",
})) assert.ok(tokens.includes(`${token}: ${value};`), `${token} should preserve the existing ${value} type size`);

const tokenizedScreenFontSizes = new Set(Object.values({
  micro: "10px", captionSm: "11px", caption: "12px", meta: "13px", label: "14px", bodyCompact: "15px",
  body: "16px", headingSm: "18px", section: "20px", headingMd: "22px", pageSm: "24px", pageLg: "32px",
}));
for (const [file, source] of [["foundation.css", foundation], ["redesign.css", redesign], ["workspace-layout.css", workspaceLayout]]) {
  postcss.parse(source, { from: file }).walkDecls("font-size", (decl) => {
    assert.ok(!tokenizedScreenFontSizes.has(decl.value.trim()), `${file} should use a type token for ${decl.value}`);
  });
}

const tokenizedPaletteColors = new Set([
  "#fff", "#ffffff", "#f8fafc", "#bfdbfe", "#dbeafe", "#fed7aa", "#eff6ff", "#bbf7d0", "#fff7ed",
  "#fecaca", "#c2410c", "#b91c1c", "#b45309", "#fef2f2", "#fde68a", "#fffbeb", "#ecfdf5", "#a16207",
  "#1d4ed8", "#047857", "#f7f9fc",
]);
for (const [file, source] of [["foundation.css", foundation], ["redesign.css", redesign], ["workspace-layout.css", workspaceLayout]]) {
  postcss.parse(source, { from: file }).walkDecls((decl) => {
    assert.ok(!tokenizedPaletteColors.has(decl.value.trim().toLowerCase()), `${file} should use a semantic color token for ${decl.value}`);
  });
}

const statusColorValues = new Map([
  ["--ops-color-primary-border", "#bfdbfe"],
  ["--ops-color-success-border", "#bbf7d0"],
  ["--ops-color-warning-border", "#fed7aa"],
  ["--ops-color-warning-strong", "#c2410c"],
  ["--ops-color-danger-border", "#fecaca"],
  ["--ops-color-neutral-surface", "#f8fafc"],
  ["--ops-color-closed-surface", "#eef2f7"],
  ["--ops-color-warning-surface", "#fff7ed"],
  ["--ops-color-attention", "#a16207"],
  ["--ops-color-attention-border", "#fde68a"],
  ["--ops-color-attention-surface", "#fffbeb"],
]);
for (const [token, value] of statusColorValues) {
  assert.ok(tokens.includes(`${token}: ${value};`), `${token} should preserve the existing status color ${value}`);
}

assert.match(foundation, /body\s*\{[^}]*font-size:\s*var\(--ops-type-body\)/s, "body typography should use the body token");
assert.match(foundation, /\.ops-button\s*\{[^}]*font-size:\s*var\(--ops-type-label\)/s, "shared buttons should use the label token");
assert.match(foundation, /\.ops-field > span\s*\{[^}]*font-size:\s*var\(--ops-type-label\)[^}]*font-weight:\s*var\(--ops-weight-medium\)/s, "shared field labels should use semantic type and weight tokens");
assert.match(foundation, /\.ops-panel-heading h3\s*\{[^}]*font-size:\s*var\(--ops-type-section\)/s, "panel headings should use the section token");
assert.match(foundation, /\.ops-status\s*\{[^}]*font-size:\s*var\(--ops-type-caption\)[^}]*font-weight:\s*var\(--ops-weight-semibold\)/s, "status badges should use the caption type and standard semibold weight");
for (const selector of ["status-normal", "status-damaged", "status-waiting", "status-pending", "status-closed", "status-complete", "status-no-image", "status-missing", "status-not-installed"]) {
  const rule = foundation.match(new RegExp(`\\.${selector}[^\\{]*\\{([^}]+)\\}`));
  assert.ok(rule && /var\(--ops-color-[a-z-]+\)/.test(rule[1]), `${selector} should use a semantic color token`);
}
assert.equal((foundation.match(/^\.ops-page-header h1\s*\{[^}]*font-size:/gm) || []).length, 0, "foundation should not override the page heading size");
assert.match(redesign, /\.ops-page-header h1, \.combined-header h1\s*\{[^}]*font-size:\s*clamp\(var\(--ops-type-page-sm\),[^}]*font-weight:\s*var\(--ops-weight-bold\)/s, "the screen page heading rule should use the shared type scale");
console.log("test_ui_foundation_tokens: pass");
