function databaseIdentity(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.hostname.toLowerCase()}:${url.port || "5432"}${url.pathname}`.toLowerCase();
  } catch {
    return String(value).trim().toLowerCase();
  }
}

export function assertIsolatedTestDatabaseUrl(connectionString, {
  variableName = "CHECKLIST_POSTGRES_TEST_DATABASE_URL",
  productionConnectionString = process.env.CHECKLIST_DATABASE_URL,
} = {}) {
  if (!connectionString) throw new Error(`${variableName} is required for this PostgreSQL test`);
  if (productionConnectionString && databaseIdentity(connectionString) === databaseIdentity(productionConnectionString)) {
    throw new Error(`${variableName} cannot point to the CHECKLIST_DATABASE_URL database`);
  }
  return connectionString;
}
