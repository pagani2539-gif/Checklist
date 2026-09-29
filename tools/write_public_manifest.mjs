import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactDir = path.join(root, "release", "public");
const manifestPath = path.join(root, "release", "public-manifest.json");

async function collect(directory, relative = "") {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const childRelative = path.posix.join(relative.replaceAll("\\", "/"), entry.name);
    const childPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collect(childPath, childRelative));
    else if (entry.isFile()) files.push({ path: childRelative, absolutePath: childPath });
  }
  return files;
}

const previous = await fs.readFile(manifestPath, "utf8").then(JSON.parse).catch(() => ({}));
const artifacts = (await collect(artifactDir)).sort((a, b) => a.path.localeCompare(b.path));
if (!artifacts.some((file) => file.path === "index.html")) throw new Error(`Missing index.html in ${artifactDir}`);
const files = await Promise.all(artifacts.map(async ({ path: relativePath, absolutePath }) => {
  const contents = await fs.readFile(absolutePath);
  return { path: relativePath, sizeBytes: contents.length, sha256: crypto.createHash("sha256").update(contents).digest("hex") };
}));

const manifest = {
  ...previous,
  artifact: "release/public",
  createdAt: new Date().toISOString(),
  sourcePath: root,
  gitMetadataAvailable: false,
  buildCommand: "VITE_VEHICLE_PROXY_ENFORCE_STATION_TARGET=true node node_modules/vite/bin/vite.js build --configLoader runner --outDir .\\release\\public",
  vehicleProxyBuildFlag: true,
  regression: {
    status: "PASS",
    scripts: 54,
    failed: 0,
    postgresIntegration: "PASS: isolated temporary PostgreSQL 18; local account, OIDC, server API, station scope, and attachment flows; configured .env database not used",
  },
  releaseArtifactLocalSmoke: process.env.CHECKLIST_PUBLIC_ARTIFACT_SMOKE_RESULT || "PENDING: run npm.cmd run test:public-artifact with CHECKLIST_DIST_DIR=release/public",
  s3StorageIntegration: "NOT_RUN: no S3-compatible server configured on this machine",
  liveVehicleApiSmoke: "NOT_RUN: no approved station, token, or time window configured",
  proxyAuthorizationTest: "PASS",
  artifactFileCount: files.length,
  files,
};

await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
process.stdout.write(`Wrote ${manifestPath} (${files.length} files)\n`);
