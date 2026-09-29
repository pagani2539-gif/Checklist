import { createPostgresStore } from "./postgres-store.mjs";

export async function createConfiguredStore(options = {}) {
  const backend = String(options.backend || process.env.CHECKLIST_STORAGE_BACKEND || "postgres").trim().toLowerCase();
  if (backend !== "postgres" && backend !== "postgresql") throw new Error(`Unsupported checklist storage backend: ${backend}; PostgreSQL is required`);
  const connectionString = options.connectionString || process.env.CHECKLIST_DATABASE_URL;
  if (!connectionString) throw new Error("CHECKLIST_DATABASE_URL is required for PostgreSQL storage");
  return createPostgresStore({ connectionString, max: options.max });
}
