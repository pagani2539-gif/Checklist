import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { EVIDENCE_CHECKLIST_SECTIONS } from "../../src/domain/master-checklist.js";

const root = resolve(fileURLToPath(import.meta.url), "..", "..", "..");
const manifestPath = resolve(root, "output", "pdf", "attachment-manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const manifestItems = manifest.items || [];
const catalogSections = new Map(EVIDENCE_CHECKLIST_SECTIONS.map((section) => [section.code, section]));
const renderDir = resolve(process.env.PDF_CATALOG_RENDER_DIR || resolve(root, "tmp", "pdf-catalog-render-check"));
mkdirSync(renderDir, { recursive: true });

assert.equal(manifest.attachmentStatus?.status, "complete");
assert.equal(manifest.attachmentStatus?.matchedItems, 13);
assert.equal(manifestItems.length, 13);
assert.deepEqual(new Set(manifestItems.map((item) => item.code)), new Set(catalogSections.keys()));

for (const manifestItem of manifestItems) {
  const section = catalogSections.get(manifestItem.code);
  assert.ok(section, `catalog is missing ${manifestItem.code}`);
  assert.equal(section.items.every((item) => item.sourceFile === manifestItem.sourceFile), true, `${manifestItem.code} source file mismatch`);

  const pdfPath = resolve(root, "output", "pdf", manifestItem.packageFile);
  assert.ok(existsSync(pdfPath), `missing packaged PDF ${manifestItem.packageFile}`);
  const pdfInfo = spawnSync("pdfinfo", [pdfPath], { encoding: "utf8" });
  assert.equal(pdfInfo.status, 0, `pdfinfo failed for ${manifestItem.packageFile}: ${pdfInfo.stderr || pdfInfo.error?.message || "unknown error"}`);
  const pages = Number(pdfInfo.stdout.match(/^Pages:\s+(\d+)/m)?.[1] || 0);
  assert.ok(pages > 0, `${manifestItem.packageFile} has no pages`);

  const outputPrefix = resolve(renderDir, manifestItem.code.replaceAll(".", "-"));
  const render = spawnSync("pdftoppm", ["-r", "50", "-png", "-f", "1", "-l", String(pages), pdfPath, outputPrefix], { encoding: "utf8" });
  assert.equal(render.status, 0, `pdftoppm failed for ${manifestItem.packageFile}: ${render.stderr || render.error?.message || "unknown error"}`);
  assert.ok(readdirSync(renderDir).some((name) => name.startsWith(`${manifestItem.code.replaceAll(".", "-")}-`) && name.endsWith(".png")), `render missing for ${manifestItem.code}`);
}

console.log("evidence catalog smoke passed", JSON.stringify({ sections: catalogSections.size, renderedPdfs: manifestItems.length, renderDir }));
