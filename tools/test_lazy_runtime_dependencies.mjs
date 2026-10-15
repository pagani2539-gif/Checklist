import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { parse } from "@babel/parser";
import * as traverseModule from "@babel/traverse";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const traverse = traverseModule.default.default || traverseModule.default;
const directory = path.join(root, "src/app/page-runtimes");
const files = (await fs.readdir(directory)).filter(name => name.endsWith(".runtime.js")).sort();
await fs.mkdir(path.join(root, ".scratch"), { recursive: true });
const temporary = await fs.mkdtemp(path.join(root, ".scratch/runtime-dependencies-"));
try {
  const output = path.join(temporary, "runtime.mjs");
  await build({
    stdin: {
      contents: [
        ...files.map((name, index) => `export { createRuntime as runtime${index} } from ${JSON.stringify(path.join(directory, name))};`),
        'export { createElement } from "react";',
        'export { renderToStaticMarkup } from "react-dom/server";',
        'export { createPageRuntime, PAGE_RUNTIME_KEYS } from "./src/app/page-runtime.js";',
      ].join("\n"),
      resolveDir: root,
    },
    outfile: output,
    bundle: true,
    platform: "node",
    packages: "external",
    format: "esm",
    jsx: "automatic",
    loader: { ".css": "empty" },
    plugins: [{
      name: "check-factory-runtime-dependencies",
      setup(builder) {
        builder.onLoad({ filter: /src[\\/]app[\\/].*\.[jt]sx?$/ }, async ({ path: filename }) => {
          const source = await fs.readFile(filename, "utf8");
          const ast = parse(source, { sourceType: "module", plugins: ["jsx"] });
          const edits = [];
          traverse(ast, {
            VariableDeclarator(nodePath) {
              const node = nodePath.node;
              if (node.init?.type !== "Identifier" || node.init.name !== "runtime" || node.id.type !== "ObjectPattern") return;
              const keys = node.id.properties.filter(property => property.type === "ObjectProperty").map(property => property.key.name || property.key.value);
              const context = path.relative(root, filename);
              edits.push({ start: node.init.start, end: node.init.end, text: `(() => { for (const key of ${JSON.stringify(keys)}) { if (runtime[key] === undefined) throw new Error(${JSON.stringify(context + ": missing runtime dependency ")} + key); } return runtime; })()` });
            },
          });
          let contents = source;
          for (const edit of edits.sort((a, b) => b.start - a.start)) contents = contents.slice(0, edit.start) + edit.text + contents.slice(edit.end);
          return { contents, loader: filename.endsWith(".jsx") ? "jsx" : "js" };
        });
      },
    }],
  });
  const runtimes = await import(pathToFileURL(output).href);
  const failures = [];
  for (const [index, file] of files.entries()) {
    try {
      const runtime = runtimes[`runtime${index}`]();
      const key = file.replace(".runtime.js", "").replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      assert.ok(runtimes.PAGE_RUNTIME_KEYS[key], `${file}: route manifest must exist`);
      runtimes.createPageRuntime(runtime, runtimes.PAGE_RUNTIME_KEYS[key]);
    }
    catch (error) { failures.push(`${file}: ${error.message}`); }
  }
  assert.deepEqual(failures, [], failures.join("\n"));
  const checklist = runtimes[`runtime${files.indexOf("checklist.runtime.js")}`]();
  const round = checklist.createUiDemoRound();
  const sections = checklist.buildInspectionSections(round.snapshot, round.templateVersion);
  let renders = 0;
  for (const section of sections) {
    for (const hierarchy of ["format", "station-categories"]) {
      for (const readOnly of [false, true]) {
        const props = { sections, selected: section.code, currentItemId: section.items[0]?.id, round, summary: checklist.getRoundSummary(round), hierarchy, readOnly, onSelect() {} };
        const html = runtimes.renderToStaticMarkup(runtimes.createElement(checklist.ChecklistTaskQueue, props));
        assert.match(html, /ops-task-queue/);
        renders++;
      }
    }
  }
  assert.ok(sections.some(section => section.items.some(item => item.assetId)), "fixture must include physical equipment to exercise the reported label crash");
  console.log(`test_lazy_runtime_dependencies: pass (${files.length} route runtimes, nested factory dependencies, ${renders} queue renders for open/history and both hierarchies)`);
} finally {
  assert.equal(path.dirname(temporary), path.join(root, ".scratch"));
  assert.ok(path.basename(temporary).startsWith("runtime-dependencies-"));
  await fs.rm(temporary, { recursive: true, force: true });
}
