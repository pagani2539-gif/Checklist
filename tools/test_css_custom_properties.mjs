import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stylesRoot = path.join(root, "src", "styles");
const definitions = new Map();
const references = [];

function walk(directory, onFile) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file, onFile);
    else onFile(file);
  }
}

function addDefinition(name, file) {
  if (!definitions.has(name)) definitions.set(name, file);
}

function scanVarFunctions(value, file, line) {
  let searchFrom = 0;
  while (searchFrom < value.length) {
    const start = value.toLowerCase().indexOf("var(", searchFrom);
    if (start < 0) return;

    let depth = 1;
    let quote = "";
    let escaped = false;
    let end = start + 4;
    for (; end < value.length && depth > 0; end += 1) {
      const character = value[end];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === "\\") {
        escaped = true;
        continue;
      }
      if (quote) {
        if (character === quote) quote = "";
        continue;
      }
      if (character === "\"" || character === "'") {
        quote = character;
        continue;
      }
      if (character === "(") depth += 1;
      else if (character === ")") depth -= 1;
    }
    if (depth !== 0) return;

    const body = value.slice(start + 4, end - 1);
    let nestedDepth = 0;
    quote = "";
    escaped = false;
    let comma = -1;
    for (let index = 0; index < body.length; index += 1) {
      const character = body[index];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === "\\") {
        escaped = true;
        continue;
      }
      if (quote) {
        if (character === quote) quote = "";
        continue;
      }
      if (character === "\"" || character === "'") {
        quote = character;
        continue;
      }
      if (character === "(") nestedDepth += 1;
      else if (character === ")") nestedDepth -= 1;
      else if (character === "," && nestedDepth === 0) {
        comma = index;
        break;
      }
    }

    const name = (comma < 0 ? body : body.slice(0, comma)).trim();
    if (/^--[\w-]+$/.test(name)) references.push({ name, file, line, hasFallback: comma >= 0 });
    if (comma >= 0) scanVarFunctions(body.slice(comma + 1), file, line);
    searchFrom = end;
  }
}

walk(stylesRoot, (file) => {
  if (!file.endsWith(".css")) return;
  const source = fs.readFileSync(file, "utf8");
  const stylesheet = postcss.parse(source, { from: file });
  stylesheet.walkDecls((declaration) => {
    if (/^--[\w-]+$/.test(declaration.prop)) addDefinition(declaration.prop, file);
    scanVarFunctions(declaration.value, file, declaration.source?.start?.line ?? 1);
  });
});

walk(path.join(root, "src"), (file) => {
  if (!/\.(?:js|jsx|ts|tsx)$/.test(file)) return;
  const source = fs.readFileSync(file, "utf8");
  const inlineDefinitions = /["'](--[\w-]+)["']\s*:/g;
  for (const match of source.matchAll(inlineDefinitions)) addDefinition(match[1], file);
});

const missing = new Map();
for (const reference of references) {
  if (reference.hasFallback || definitions.has(reference.name)) continue;
  if (!missing.has(reference.name)) missing.set(reference.name, []);
  missing.get(reference.name).push(reference);
}

assert.equal(
  missing.size,
  0,
  `CSS custom properties referenced without a definition or fallback:\n${[...missing]
    .map(([name, locations]) => `- ${name}: ${locations.map(({ file, line }) => `${path.relative(root, file)}:${line}`).join(", ")}`)
    .join("\n")}`,
);

console.log(`test_css_custom_properties: pass (${definitions.size} defined custom properties, ${references.length} references)`);
