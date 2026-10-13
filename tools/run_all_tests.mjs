import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  discoverTestFiles,
  FEATURE_SUITE_NAMES,
  ISOLATED_POSTGRES_TEST_FILES,
  selectTestFiles,
} from "./test-suite-config.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(args) {
  const remaining = [...args];
  const listOnly = remaining[0] === "--list";
  if (listOnly) remaining.shift();

  if (remaining.length === 0 || remaining[0] === "--all") {
    if (remaining.length > 1) throw new Error("Usage: run_all_tests.mjs [--list] [--all | --quick | --feature <name>]");
    return { tier: "all", listOnly };
  }
  if (remaining[0] === "--quick" && remaining.length === 1) return { tier: "quick", listOnly };
  if (remaining[0] === "--feature" && remaining.length === 2) {
    return { tier: "feature", feature: remaining[1], listOnly };
  }
  throw new Error(`Usage: run_all_tests.mjs [--list] [--all | --quick | --feature <${FEATURE_SUITE_NAMES.join("|")}>]`);
}

async function main() {
  const { tier, feature, listOnly } = parseArgs(process.argv.slice(2));
  const allTestFiles = discoverTestFiles(path.join(root, "tools"));
  const selectedTestFiles = selectTestFiles(allTestFiles, { tier, feature });
  const isolatedPostgresUrl = process.env.CHECKLIST_POSTGRES_TEST_DATABASE_URL;
  const skippedForDatabase = tier !== "quick" && !isolatedPostgresUrl
    ? selectedTestFiles.filter((file) => ISOLATED_POSTGRES_TEST_FILES.includes(file.replaceAll("\\", "/")))
    : [];
  const skippedSet = new Set(skippedForDatabase);
  const testFiles = selectedTestFiles.filter((file) => !skippedSet.has(file));
  const suiteName = tier === "feature" ? `test:feature:${feature}` : `test:${tier}`;

  if (listOnly) {
    console.log(`${suiteName} selected=${selectedTestFiles.length} runnable=${testFiles.length} isolatedPostgresSkipped=${skippedForDatabase.length}`);
    for (const file of selectedTestFiles) {
      const state = skippedSet.has(file) ? " [requires CHECKLIST_POSTGRES_TEST_DATABASE_URL]" : "";
      console.log(`${file.replaceAll("\\", "/")}${state}`);
    }
    return;
  }

  for (const file of skippedForDatabase) {
    console.log(`SKIP ${file.replaceAll("\\", "/")} (set CHECKLIST_POSTGRES_TEST_DATABASE_URL to run against an isolated test database)`);
  }

  let pdfRenderDir = "";
  function run(file) {
    return new Promise((resolve) => {
      const env = { ...process.env };
      if (file.replaceAll("\\", "/") === "tools/pdf/test_evidence_catalog.mjs" && !env.PDF_CATALOG_RENDER_DIR) {
        pdfRenderDir ||= fs.mkdtempSync(path.join(os.tmpdir(), "checklist-pdf-catalog-"));
        env.PDF_CATALOG_RENDER_DIR = pdfRenderDir;
      }
      const child = spawn(process.execPath, [path.join(root, file)], { cwd: root, env, stdio: "inherit" });
      child.once("close", (code, signal) => resolve({ file, code: code ?? 1, signal }));
    });
  }

  const failures = [];
  for (const file of testFiles) {
    const result = await run(file);
    if (result.code !== 0) failures.push(result);
  }

  if (pdfRenderDir) fs.rmSync(pdfRenderDir, { recursive: true, force: true });

  const summary = tier === "feature" ? `test:feature:${feature}` : `test:${tier}`;
  console.log(`${summary} selected=${selectedTestFiles.length} run=${testFiles.length} skipped=${skippedForDatabase.length} failed=${failures.length}`);
  if (failures.length) {
    for (const failure of failures) console.error(`FAIL ${failure.file} exit=${failure.code}${failure.signal ? ` signal=${failure.signal}` : ""}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
