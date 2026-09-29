import fs from "node:fs";

const appRoot = new URL("../src/app/", import.meta.url);
const pageRoot = new URL("pages/", appRoot);
const sharedFiles = ["vehicle-review/ReviewPanels.jsx", "reports/PrintableReport.jsx"];

export function readPageSource(fileName) {
  return fs.readFileSync(new URL(fileName, pageRoot), "utf8");
}

export function readSharedSource(fileName) {
  return fs.readFileSync(new URL(fileName, appRoot), "utf8");
}

export function readAppSource() {
  const pageSources = fs.readdirSync(pageRoot)
    .filter((fileName) => fileName.endsWith(".jsx"))
    .sort()
    .map((fileName) => readPageSource(fileName));
  const sharedSources = sharedFiles.map(readSharedSource);
  return [fs.readFileSync(new URL("App.jsx", appRoot), "utf8"), ...sharedSources, ...pageSources].join("\n");
}
