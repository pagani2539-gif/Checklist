import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function findTests(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return findTests(absolute);
    return entry.name.startsWith("test_") && entry.name.endsWith(".mjs") ? [path.relative(root, absolute)] : [];
  });
}

const testFiles = findTests(path.join(root, "tools"))
  .sort((left, right) => left.localeCompare(right));

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

console.log(`test:all total=${testFiles.length} failed=${failures.length}`);
if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure.file} exit=${failure.code}${failure.signal ? ` signal=${failure.signal}` : ""}`);
  process.exitCode = 1;
}
