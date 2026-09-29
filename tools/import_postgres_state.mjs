import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { createPostgresStore } from "../server/postgres-store.mjs";
import { attachmentIdsForState } from "../src/domain/storage.js";

const sourcePath = path.resolve(process.argv[2] || "");
if (!sourcePath) throw new Error("Usage: node tools/import_postgres_state.mjs <verified-state.json>");

const raw = await fs.readFile(sourcePath, "utf8");
const state = JSON.parse(raw);
if (!state || typeof state !== "object" || Array.isArray(state)) throw new Error("State export must be a JSON object");

const stationIds = (Array.isArray(state.stationProfiles) ? state.stationProfiles : []).map((station) => String(station?.id || "")).filter(Boolean);
if (new Set(stationIds).size !== stationIds.length) throw new Error("State export contains duplicate station ids");
const stationSet = new Set(stationIds);
for (const round of Array.isArray(state.inspectionRounds) ? state.inspectionRounds : []) {
  if (!round?.id || !round?.stationId || !stationSet.has(String(round.stationId))) throw new Error(`Round ${round?.id || "unknown"} references a missing station`);
  if (round.status === "closed" && !round.snapshot) throw new Error(`Closed round ${round.id} has no Snapshot`);
}

const store = await createPostgresStore();
try {
  const current = await store.getState();
  if (current.version && String(process.env.CHECKLIST_IMPORT_ALLOW_EXISTING).toLowerCase() !== "true") {
    throw new Error(`PostgreSQL already contains state version ${current.version}; set CHECKLIST_IMPORT_ALLOW_EXISTING=true only after an explicit cutover review`);
  }
  const result = await store.saveState(state, {
    expectedVersion: current.version,
    actor: { id: "verified-import", role: "admin" },
    reason: "verified-state-import",
    requestId: crypto.randomUUID(),
  });
  const manifest = {
    importedAt: result.updatedAt,
    sourcePath,
    sourceSha256: crypto.createHash("sha256").update(raw).digest("hex"),
    stateVersion: result.version,
    stationCount: stationIds.length,
    roundCount: Array.isArray(state.inspectionRounds) ? state.inspectionRounds.length : 0,
    closedRoundCount: Array.isArray(state.inspectionRounds) ? state.inspectionRounds.filter((round) => round?.status === "closed").length : 0,
    attachmentIds: attachmentIdsForState(state),
  };
  const manifestPath = process.env.CHECKLIST_IMPORT_MANIFEST
    ? path.resolve(process.env.CHECKLIST_IMPORT_MANIFEST)
    : `${sourcePath}.import-manifest.json`;
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ ok: true, manifestPath, ...manifest }));
} finally {
  await store.close();
}
