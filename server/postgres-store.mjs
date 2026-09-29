import crypto from "node:crypto";
import { Pool } from "pg";
import { mergeScopedState } from "./state-scope.mjs";

export const POSTGRES_STORE_SCHEMA_VERSION = 2;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (!value || typeof value !== "object") return JSON.stringify(value);
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
}

function closedRoundMap(state) {
  const rounds = Array.isArray(state?.inspectionRounds) ? state.inspectionRounds : [];
  return new Map(rounds.filter((round) => round?.status === "closed" && round.id).map((round) => [String(round.id), round]));
}

function assertClosedRoundsImmutable(previous, next) {
  const oldRounds = closedRoundMap(previous);
  const nextRounds = closedRoundMap(next);
  const tombstones = new Set(asArray(next?.deletedRoundIds).map(String));
  const allNextRoundIds = new Set(asArray(next?.inspectionRounds).map((round) => String(round?.id || "")).filter(Boolean));
  for (const id of tombstones) {
    if (allNextRoundIds.has(id)) {
      const error = new Error(`Deleted inspection round ${id} cannot be restored`);
      error.code = "DELETED_ROUND_RESTORED";
      error.statusCode = 409;
      throw error;
    }
  }
  for (const [id, oldRound] of oldRounds) {
    const replacement = nextRounds.get(id);
    if (!replacement && tombstones.has(id)) continue;
    if (!replacement || stableJson(oldRound) !== stableJson(replacement)) {
      const error = new Error(`Closed inspection round ${id} is immutable; create a revision instead`);
      error.code = "IMMUTABLE_ROUND";
      error.statusCode = 409;
      throw error;
    }
  }
}

function json(value) {
  return value == null ? null : JSON.stringify(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

const STATION_SCOPED_COLLECTIONS = ["stationProfiles", "inspectionRounds", "inspectionHistory", "inspectionWorkspaces", "contractStationAssignments", "contractWorkReports"];
const CLIENT_ONLY_KEYS = new Set(["ui", "activeRoundId", "activeStationId", "items", "inspectionSnapshot", "meta", "lastSaved"]);

function recordScopeKey(collection, record) {
  if (collection === "stationProfiles") return String(record?.id || "");
  return String(record?.stationId || record?.snapshot?.stationId || record?.stationSnapshot?.stationId || "");
}

function groupCollection(collection, value) {
  const groups = new Map();
  for (const record of asArray(value)) {
    const key = recordScopeKey(collection, record);
    if (!key) continue;
    const records = groups.get(key) || [];
    records.push(record);
    groups.set(key, records);
  }
  return groups;
}

function changedScopeKeys(collection, base, candidate) {
  const baseGroups = groupCollection(collection, base);
  const candidateGroups = groupCollection(collection, candidate);
  const keys = new Set([...baseGroups.keys(), ...candidateGroups.keys()]);
  return new Set([...keys].filter((key) => stableJson(baseGroups.get(key) || []) !== stableJson(candidateGroups.get(key) || [])));
}

function mergeDisjointStationStates(base, current, incoming) {
  if (!base || !current || !incoming) return null;
  const merged = { ...current };
  merged.deletedRoundIds = [...new Set([...asArray(current.deletedRoundIds).map(String), ...asArray(incoming.deletedRoundIds).map(String)])];
  for (const collection of STATION_SCOPED_COLLECTIONS) {
    const incomingChanges = changedScopeKeys(collection, base[collection], incoming[collection]);
    const currentChanges = changedScopeKeys(collection, base[collection], current[collection]);
    if ([...incomingChanges].some((key) => currentChanges.has(key))) return null;
    const incomingGroups = groupCollection(collection, incoming[collection]);
    const changedValues = [];
    const emittedKeys = new Set();
    for (const record of asArray(current[collection])) {
      const key = recordScopeKey(collection, record);
      if (!incomingChanges.has(key)) {
        changedValues.push(record);
        continue;
      }
      if (!emittedKeys.has(key)) {
        changedValues.push(...(incomingGroups.get(key) || []));
        emittedKeys.add(key);
      }
    }
    for (const key of incomingChanges) {
      if (!emittedKeys.has(key)) changedValues.push(...(incomingGroups.get(key) || []));
    }
    merged[collection] = changedValues;
  }
  const keys = new Set([...Object.keys(base), ...Object.keys(current), ...Object.keys(incoming)]);
  for (const key of keys) {
    if (STATION_SCOPED_COLLECTIONS.includes(key) || CLIENT_ONLY_KEYS.has(key) || key === "version") continue;
    if (key === "deletedRoundIds") {
      continue;
    }
    if (key === "inspectionRoundContextLinks" || key === "stationInspectionReports") {
      const deletedRoundIds = new Set(asArray(merged.deletedRoundIds).map(String));
      merged[key] = asArray(current[key]).filter((record) => !deletedRoundIds.has(String(record?.roundId || "")));
      continue;
    }
    const baseValue = stableJson(base[key] ?? null);
    const incomingValue = stableJson(incoming[key] ?? null);
    const currentValue = stableJson(current[key] ?? null);
    if (incomingValue !== baseValue) {
      if (currentValue !== baseValue) return null;
      merged[key] = incoming[key];
    }
  }
  return merged;
}

function dateValue(value) {
  return value ? new Date(value) : null;
}

export class PostgresChecklistStore {
  constructor({ connectionString = process.env.CHECKLIST_DATABASE_URL, max = Number(process.env.CHECKLIST_PG_POOL_MAX || 10), ssl = String(process.env.CHECKLIST_PG_SSL || "false").toLowerCase() === "true" } = {}) {
    if (!connectionString) throw new Error("CHECKLIST_DATABASE_URL is required for PostgreSQL storage");
    this.connectionString = connectionString;
    this.pool = new Pool({ connectionString, max, ...(ssl ? { ssl: { rejectUnauthorized: false } } : {}) });
    this.ready = this.migrate();
  }

  async migrate() {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
        CREATE TABLE IF NOT EXISTS app_state (id TEXT PRIMARY KEY, version BIGINT NOT NULL, payload JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL, updated_by TEXT);
        CREATE TABLE IF NOT EXISTS state_revisions (id BIGSERIAL PRIMARY KEY, state_version BIGINT NOT NULL, payload JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL, created_by TEXT, reason TEXT);
        CREATE TABLE IF NOT EXISTS stations (id TEXT PRIMARY KEY, station_code TEXT, station_name TEXT, station_format TEXT, active BOOLEAN NOT NULL DEFAULT TRUE, data JSONB NOT NULL DEFAULT '{}'::jsonb, updated_at TIMESTAMPTZ NOT NULL, updated_by TEXT);
        CREATE TABLE IF NOT EXISTS lanes (id TEXT PRIMARY KEY, station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE, lane_no INTEGER, data JSONB NOT NULL DEFAULT '{}'::jsonb);
        CREATE TABLE IF NOT EXISTS assets (id TEXT PRIMARY KEY, station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE, asset_type TEXT, active BOOLEAN NOT NULL DEFAULT TRUE, data JSONB NOT NULL DEFAULT '{}'::jsonb);
        CREATE TABLE IF NOT EXISTS systems (id TEXT PRIMARY KEY, station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE, system_type TEXT, active BOOLEAN NOT NULL DEFAULT TRUE, data JSONB NOT NULL DEFAULT '{}'::jsonb);
        CREATE TABLE IF NOT EXISTS station_tor_items (station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE, item_id TEXT NOT NULL, data JSONB NOT NULL DEFAULT '{}'::jsonb, PRIMARY KEY (station_id, item_id));
        CREATE TABLE IF NOT EXISTS inspection_rounds (id TEXT PRIMARY KEY, station_id TEXT NOT NULL, status TEXT NOT NULL, version BIGINT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ, closed_at TIMESTAMPTZ, based_on_round_id TEXT, revision_number INTEGER NOT NULL DEFAULT 0, snapshot_schema_version TEXT, template_version TEXT, snapshot JSONB, inspection_items JSONB, vehicle_search JSONB, meta JSONB, data JSONB NOT NULL DEFAULT '{}'::jsonb);
        CREATE INDEX IF NOT EXISTS idx_inspection_rounds_station_status ON inspection_rounds(station_id, status, updated_at DESC);
        CREATE TABLE IF NOT EXISTS inspection_round_revisions (round_id TEXT NOT NULL, revision_number INTEGER NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), data JSONB NOT NULL, PRIMARY KEY (round_id, revision_number));
        CREATE TABLE IF NOT EXISTS inspection_evidence (round_id TEXT NOT NULL REFERENCES inspection_rounds(id) ON DELETE CASCADE, item_id TEXT NOT NULL, station_id TEXT NOT NULL, status TEXT, data JSONB NOT NULL DEFAULT '{}'::jsonb, PRIMARY KEY (round_id, item_id));
        CREATE INDEX IF NOT EXISTS idx_inspection_evidence_station ON inspection_evidence(station_id, round_id);
        CREATE TABLE IF NOT EXISTS attachments (id TEXT PRIMARY KEY, storage_name TEXT NOT NULL UNIQUE, original_name TEXT NOT NULL, content_type TEXT NOT NULL, size BIGINT NOT NULL, sha256 TEXT NOT NULL, station_id TEXT, created_at TIMESTAMPTZ NOT NULL, created_by TEXT, deleted_at TIMESTAMPTZ, deleted_by TEXT);
        CREATE INDEX IF NOT EXISTS idx_attachments_station ON attachments(station_id, created_at DESC);
        CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, display_name TEXT, role TEXT NOT NULL, station_ids JSONB NOT NULL DEFAULT '[]'::jsonb, created_at TIMESTAMPTZ NOT NULL, expires_at TIMESTAMPTZ NOT NULL, revoked_at TIMESTAMPTZ);
        CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
        CREATE TABLE IF NOT EXISTS local_users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL, station_ids JSONB NOT NULL DEFAULT '[]'::jsonb, active BOOLEAN NOT NULL DEFAULT TRUE, must_change_password BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL, created_by TEXT, updated_at TIMESTAMPTZ NOT NULL, updated_by TEXT);
        CREATE INDEX IF NOT EXISTS idx_local_users_active ON local_users(active, username);
        CREATE TABLE IF NOT EXISTS audit_log (id BIGSERIAL PRIMARY KEY, event_type TEXT NOT NULL, actor_id TEXT, actor_role TEXT, resource_type TEXT, resource_id TEXT, request_id TEXT, details JSONB, created_at TIMESTAMPTZ NOT NULL);
        CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at DESC);
      `);
      await client.query("INSERT INTO schema_migrations(version) VALUES ($1) ON CONFLICT (version) DO NOTHING", [POSTGRES_STORE_SCHEMA_VERSION]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getState() {
    await this.ready;
    const { rows } = await this.pool.query("SELECT version, payload, updated_at, updated_by FROM app_state WHERE id = 'global'");
    const row = rows[0];
    if (!row) return { state: null, version: 0, updatedAt: null, updatedBy: null };
    return { state: row.payload, version: Number(row.version) || 0, updatedAt: row.updated_at, updatedBy: row.updated_by };
  }

  async saveState(state, { expectedVersion, stationIds, actor, reason = "state-update", requestId } = {}) {
    if (!state || typeof state !== "object" || Array.isArray(state)) {
      const error = new Error("State payload must be an object");
      error.statusCode = 400;
      throw error;
    }
    await this.ready;
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query("SELECT version, payload, updated_at, updated_by FROM app_state WHERE id = 'global' FOR UPDATE");
      const currentRow = rows[0];
      const current = { state: currentRow?.payload || null, version: Number(currentRow?.version || 0), updatedAt: currentRow?.updated_at || null, updatedBy: currentRow?.updated_by || null };
      let nextState = state;
      if (expectedVersion != null && Number(expectedVersion) !== current.version) {
        const baseResult = await client.query("SELECT payload FROM state_revisions WHERE state_version = $1", [Number(expectedVersion)]);
        const baseState = baseResult.rows[0]?.payload;
        const scopedIncoming = Array.isArray(stationIds) ? mergeScopedState(baseState, state, stationIds) : state;
        nextState = mergeDisjointStationStates(baseState, current.state, scopedIncoming);
        if (!nextState) {
          const error = new Error("State version conflict; reload before saving");
          error.statusCode = 409;
          error.currentVersion = current.version;
          throw error;
        }
      } else if (Array.isArray(stationIds)) {
        nextState = mergeScopedState(current.state, state, stationIds);
      }
      if (current.state) assertClosedRoundsImmutable(current.state, nextState);
      const nextVersion = current.version + 1;
      const updatedAt = new Date().toISOString();
      const actorId = actor?.id || null;
      await client.query(`INSERT INTO app_state(id, version, payload, updated_at, updated_by) VALUES ('global', $1, $2::jsonb, $3, $4)
        ON CONFLICT(id) DO UPDATE SET version=EXCLUDED.version, payload=EXCLUDED.payload, updated_at=EXCLUDED.updated_at, updated_by=EXCLUDED.updated_by`, [nextVersion, json(nextState), updatedAt, actorId]);
      await client.query("INSERT INTO state_revisions(state_version, payload, created_at, created_by, reason) VALUES ($1, $2::jsonb, $3, $4, $5)", [nextVersion, json(nextState), updatedAt, actorId, reason]);
      await this.syncProjections(client, nextState, { updatedAt, actorId });
      const oldRounds = new Map(asArray(current.state?.inspectionRounds).map((round) => [String(round?.id || ""), round]));
      const nextRoundIds = new Set(asArray(nextState.inspectionRounds).map((round) => String(round?.id || "")));
      const deletedRoundIds = new Set(asArray(nextState.deletedRoundIds).map(String));
      for (const [id, oldRound] of oldRounds) {
        if (oldRound?.status === "closed" && !nextRoundIds.has(id) && deletedRoundIds.has(id)) {
          await this.auditWithClient(client, "round.delete", actor, "inspection-round", id, {
            stationId: oldRound.stationId || oldRound.snapshot?.stationId || null,
            stationCode: oldRound.snapshot?.stationCode || null,
            revisionNumber: Number(oldRound.revisionNumber || 0),
          }, requestId);
        }
      }
      for (const round of asArray(nextState.inspectionRounds)) {
        const previous = oldRounds.get(String(round?.id || ""));
        if (round?.status === "closed" && previous?.status !== "closed") await this.auditWithClient(client, "round.close", actor, "inspection-round", round.id, { stationId: round.stationId }, requestId);
        if (round?.basedOnRoundId && Number(round?.revisionNumber || 0) > Number(previous?.revisionNumber || 0)) await this.auditWithClient(client, "round.revision", actor, "inspection-round", round.id, { basedOnRoundId: round.basedOnRoundId, stationId: round.stationId }, requestId);
      }
      await this.auditWithClient(client, "state.update", actor, "state", "global", { version: nextVersion, reason }, requestId);
      await client.query("COMMIT");
      return { state: clone(nextState), version: nextVersion, updatedAt, updatedBy: actorId };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async syncProjections(client, state, { updatedAt, actorId }) {
    const profiles = asArray(state.stationProfiles);
    await client.query("DELETE FROM station_tor_items; DELETE FROM lanes; DELETE FROM assets; DELETE FROM systems; DELETE FROM stations;");
    for (const profile of profiles) {
      const stationId = String(profile?.id || "");
      if (!stationId) continue;
      await client.query("INSERT INTO stations(id, station_code, station_name, station_format, active, data, updated_at, updated_by) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)", [stationId, profile.stationCode || null, profile.stationName || null, profile.stationFormat || null, profile.active !== false, json(profile), updatedAt, actorId]);
      for (const lane of asArray(profile.lanes)) await client.query("INSERT INTO lanes(id, station_id, lane_no, data) VALUES ($1,$2,$3,$4::jsonb)", [String(lane?.id || `${stationId}:lane:${lane?.laneNo || 0}`), stationId, Number(lane?.laneNo || 0), json(lane)]);
      for (const asset of asArray(profile.equipment)) await client.query("INSERT INTO assets(id, station_id, asset_type, active, data) VALUES ($1,$2,$3,$4,$5::jsonb)", [String(asset?.id || crypto.randomUUID()), stationId, asset?.type || asset?.canonicalItemId || null, asset?.active !== false, json(asset)]);
      for (const system of asArray(profile.stationSystems)) await client.query("INSERT INTO systems(id, station_id, system_type, active, data) VALUES ($1,$2,$3,$4,$5::jsonb)", [String(system?.id || crypto.randomUUID()), stationId, system?.systemId || system?.canonicalItemId || system?.type || null, system?.active !== false, json(system)]);
      for (const [index, item] of asArray(profile.torItems).entries()) await client.query("INSERT INTO station_tor_items(station_id, item_id, data) VALUES ($1,$2,$3::jsonb)", [stationId, String(item?.id || `${stationId}:tor:${index + 1}`), json(item)]);
    }

    const rounds = asArray(state.inspectionRounds);
    await client.query("DELETE FROM inspection_evidence; DELETE FROM inspection_round_revisions; DELETE FROM inspection_rounds;");
    for (const round of rounds) {
      const roundId = String(round?.id || crypto.randomUUID());
      const stationId = String(round?.stationId || round?.snapshot?.stationId || "");
      const revisionNumber = Number(round?.revisionNumber || 0);
      const snapshotSchemaVersion = round?.snapshot?.schemaVersion || round?.snapshot?.snapshotSchemaVersion || null;
      await client.query(`INSERT INTO inspection_rounds(id, station_id, status, version, created_at, updated_at, closed_at, based_on_round_id, revision_number, snapshot_schema_version, template_version, snapshot, inspection_items, vehicle_search, meta, data)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb)`, [roundId, stationId, round?.status || "draft", Number(round?.version || 0), dateValue(round?.createdAt), dateValue(round?.updatedAt), dateValue(round?.closedAt), round?.basedOnRoundId || null, revisionNumber, snapshotSchemaVersion, round?.templateVersion || round?.snapshot?.templateVersion || null, json(round?.snapshot || null), json(round?.inspectionItems || {}), json(round?.vehicleSearch || null), json(round?.meta || null), json(round)]);
      await client.query("INSERT INTO inspection_round_revisions(round_id, revision_number, created_at, data) VALUES ($1,$2,$3,$4::jsonb)", [roundId, revisionNumber, dateValue(round?.updatedAt) || updatedAt, json(round)]);
      for (const [itemId, item] of Object.entries(round?.inspectionItems || {})) await client.query("INSERT INTO inspection_evidence(round_id, item_id, station_id, status, data) VALUES ($1,$2,$3,$4,$5::jsonb)", [roundId, itemId, stationId, item?.status || null, json(item)]);
    }
  }

  async listStations(stationIds = null) {
    await this.ready;
    if (Array.isArray(stationIds) && stationIds.length === 0) return [];
    const { rows } = await this.pool.query(Array.isArray(stationIds) ? "SELECT data FROM stations WHERE id = ANY($1::text[]) ORDER BY station_name NULLS LAST, id" : "SELECT data FROM stations ORDER BY station_name NULLS LAST, id", Array.isArray(stationIds) ? [stationIds.map(String)] : []);
    return rows.map((row) => row.data);
  }

  async listRounds(stationIds = null) {
    await this.ready;
    if (Array.isArray(stationIds) && stationIds.length === 0) return [];
    const { rows } = await this.pool.query(Array.isArray(stationIds) ? "SELECT data FROM inspection_rounds WHERE station_id = ANY($1::text[]) ORDER BY updated_at DESC NULLS LAST, id" : "SELECT data FROM inspection_rounds ORDER BY updated_at DESC NULLS LAST, id", Array.isArray(stationIds) ? [stationIds.map(String)] : []);
    return rows.map((row) => row.data);
  }

  async createSession({ token, userId, displayName, role, stationIds = [], expiresAt }) {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await this.ready;
    await this.pool.query("INSERT INTO sessions(token_hash, user_id, display_name, role, station_ids, created_at, expires_at) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)", [tokenHash, userId, displayName || userId, role, json(stationIds), new Date().toISOString(), expiresAt]);
  }

  mapLocalUser(row, { includePasswordHash = false } = {}) {
    if (!row) return null;
    return {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      role: row.role,
      stationIds: row.station_ids || [],
      active: row.active,
      mustChangePassword: row.must_change_password,
      ...(includePasswordHash ? { passwordHash: row.password_hash } : {}),
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
    };
  }

  async countLocalUsers() {
    await this.ready;
    const { rows } = await this.pool.query("SELECT COUNT(*)::int AS count FROM local_users");
    return rows[0]?.count || 0;
  }

  async listLocalUsers() {
    await this.ready;
    const { rows } = await this.pool.query("SELECT id, username, display_name, role, station_ids, active, must_change_password, created_at, created_by, updated_at, updated_by FROM local_users ORDER BY username");
    return rows.map((row) => this.mapLocalUser(row));
  }

  async getLocalUserByUsername(username) {
    await this.ready;
    const { rows } = await this.pool.query("SELECT * FROM local_users WHERE username = $1", [String(username || "").trim().toLowerCase()]);
    return this.mapLocalUser(rows[0], { includePasswordHash: true });
  }

  async getLocalUserById(id) {
    await this.ready;
    const { rows } = await this.pool.query("SELECT id, username, display_name, role, station_ids, active, must_change_password, created_at, created_by, updated_at, updated_by FROM local_users WHERE id = $1", [String(id)]);
    return this.mapLocalUser(rows[0]);
  }

  async createLocalUser(user, { firstAdminOnly = false } = {}) {
    await this.ready;
    if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(String(user.username || ""))) {
      const error = new Error("Username must be 3-64 lowercase letters, digits, dot, dash, or underscore");
      error.statusCode = 400;
      throw error;
    }
    if (!String(user.displayName || "").trim() || String(user.displayName).length > 120) {
      const error = new Error("Display name is required and must not exceed 120 characters");
      error.statusCode = 400;
      throw error;
    }
    if (!["admin", "station-manager", "inspector", "viewer"].includes(user.role)) {
      const error = new Error("Invalid local user role");
      error.statusCode = 400;
      throw error;
    }
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext('checklist-local-users-bootstrap'))");
      const { rows: counts } = await client.query("SELECT COUNT(*)::int AS count FROM local_users");
      if (firstAdminOnly && counts[0].count !== 0) {
        const error = new Error("Local accounts already exist; bootstrap is closed");
        error.code = "BOOTSTRAP_CLOSED";
        error.statusCode = 409;
        throw error;
      }
      if (firstAdminOnly && user.role !== "admin") {
        const error = new Error("Bootstrap account must use the admin role");
        error.statusCode = 400;
        throw error;
      }
      const now = new Date().toISOString();
      const { rows } = await client.query(`INSERT INTO local_users(id, username, display_name, password_hash, role, station_ids, active, must_change_password, created_at, created_by, updated_at, updated_by)
        VALUES ($1,$2,$3,$4,$5,$6::jsonb,TRUE,$7,$8,$9,$8,$9)
        RETURNING id, username, display_name, role, station_ids, active, must_change_password, created_at, created_by, updated_at, updated_by`,
      [user.id, user.username, user.displayName, user.passwordHash, user.role, json(user.stationIds || []), user.mustChangePassword !== false, now, user.createdBy || null]);
      await client.query("COMMIT");
      return this.mapLocalUser(rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      if (error?.code === "23505") {
        error.statusCode = 409;
        error.message = "Username already exists";
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async updateLocalUser(id, patch, actor) {
    await this.ready;
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext('checklist-local-users-admin-policy'))");
      const { rows: existingRows } = await client.query("SELECT * FROM local_users WHERE id = $1 FOR UPDATE", [String(id)]);
      const existing = existingRows[0];
      if (!existing) {
        const error = new Error("User not found");
        error.statusCode = 404;
        throw error;
      }
      const nextActive = patch.active === undefined ? existing.active : Boolean(patch.active);
      const nextRole = patch.role === undefined ? existing.role : patch.role;
      if (existing.active && existing.role === "admin" && (!nextActive || nextRole !== "admin")) {
        const { rows: adminRows } = await client.query("SELECT COUNT(*)::int AS count FROM local_users WHERE active = TRUE AND role = 'admin'");
        if (adminRows[0].count <= 1) {
          const error = new Error("Cannot remove or demote the last active admin");
          error.code = "LAST_ADMIN";
          error.statusCode = 409;
          throw error;
        }
      }
      const now = new Date().toISOString();
      const { rows } = await client.query(`UPDATE local_users SET
        display_name = COALESCE($2, display_name),
        role = COALESCE($3, role),
        station_ids = COALESCE($4::jsonb, station_ids),
        active = COALESCE($5, active),
        password_hash = COALESCE($6, password_hash),
        must_change_password = COALESCE($7, must_change_password),
        updated_at = $8, updated_by = $9
        WHERE id = $1
        RETURNING id, username, display_name, role, station_ids, active, must_change_password, created_at, created_by, updated_at, updated_by`,
      [String(id), patch.displayName ?? null, patch.role ?? null, patch.stationIds === undefined ? null : json(patch.stationIds), patch.active ?? null, patch.passwordHash ?? null, patch.mustChangePassword ?? null, now, actor?.id || null]);
      if (patch.passwordHash || !nextActive) await client.query("UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL", [String(id)]);
      await client.query("COMMIT");
      return this.mapLocalUser(rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async updateLocalPassword(id, passwordHash, actor) {
    await this.ready;
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const now = new Date().toISOString();
      const { rows } = await client.query("UPDATE local_users SET password_hash = $2, must_change_password = FALSE, updated_at = $3, updated_by = $4 WHERE id = $1 AND active = TRUE RETURNING id, username, display_name, role, station_ids, active, must_change_password, created_at, created_by, updated_at, updated_by", [String(id), passwordHash, now, actor?.id || null]);
      if (!rows[0]) {
        const error = new Error("Active user not found");
        error.statusCode = 404;
        throw error;
      }
      await client.query("UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL", [String(id)]);
      await client.query("COMMIT");
      return this.mapLocalUser(rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getSession(token) {
    if (!token) return null;
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await this.ready;
    const { rows } = await this.pool.query("SELECT user_id, display_name, role, station_ids, expires_at, revoked_at FROM sessions WHERE token_hash = $1", [tokenHash]);
    const row = rows[0];
    if (!row || row.revoked_at || new Date(row.expires_at).getTime() <= Date.now()) return null;
    return { id: row.user_id, displayName: row.display_name, role: row.role, stationIds: row.station_ids || [], expiresAt: row.expires_at };
  }

  async revokeSession(token, actor) {
    if (!token) return;
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await this.ready;
    await this.pool.query("UPDATE sessions SET revoked_at = NOW() WHERE token_hash = $1", [tokenHash]);
    await this.audit("auth.logout", actor, "session", tokenHash.slice(0, 12), null);
  }

  async addAttachment(metadata) {
    await this.ready;
    const { rows } = await this.pool.query(`INSERT INTO attachments(id, storage_name, original_name, content_type, size, sha256, station_id, created_at, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT(id) DO UPDATE SET original_name=EXCLUDED.original_name, content_type=EXCLUDED.content_type, size=EXCLUDED.size, sha256=EXCLUDED.sha256, station_id=EXCLUDED.station_id, deleted_at=NULL, deleted_by=NULL
      RETURNING *`, [metadata.id, metadata.storageName, metadata.originalName, metadata.contentType, metadata.size, metadata.sha256, metadata.stationId || null, metadata.createdAt || new Date().toISOString(), metadata.createdBy || null]);
    return this.mapAttachment(rows[0]);
  }

  async getAttachment(id) {
    await this.ready;
    const { rows } = await this.pool.query("SELECT * FROM attachments WHERE id = $1 AND deleted_at IS NULL", [String(id)]);
    return rows[0] ? this.mapAttachment(rows[0]) : null;
  }

  async deleteAttachment(id, actor) {
    await this.ready;
    await this.pool.query("UPDATE attachments SET deleted_at = NOW(), deleted_by = $1 WHERE id = $2 AND deleted_at IS NULL", [actor?.id || null, String(id)]);
    await this.audit("attachment.delete", actor, "attachment", String(id), null);
  }

  mapAttachment(row) {
    return { ...row, storageName: row.storage_name, originalName: row.original_name, contentType: row.content_type, stationId: row.station_id, createdAt: row.created_at, createdBy: row.created_by };
  }

  async auditWithClient(client, eventType, actor, resourceType, resourceId, details = null, requestId = null) {
    await client.query("INSERT INTO audit_log(event_type, actor_id, actor_role, resource_type, resource_id, request_id, details, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)", [eventType, actor?.id || null, actor?.role || null, resourceType || null, resourceId || null, requestId || null, json(details), new Date().toISOString()]);
  }

  async audit(eventType, actor, resourceType, resourceId, details = null, requestId = null) {
    await this.ready;
    await this.pool.query("INSERT INTO audit_log(event_type, actor_id, actor_role, resource_type, resource_id, request_id, details, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)", [eventType, actor?.id || null, actor?.role || null, resourceType || null, resourceId || null, requestId || null, json(details), new Date().toISOString()]);
  }

  async listAudit(limit = 100) {
    await this.ready;
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 1000);
    const { rows } = await this.pool.query("SELECT * FROM audit_log ORDER BY id DESC LIMIT $1", [safeLimit]);
    return rows;
  }

  async isReady() {
    try {
      await this.ready;
      await this.pool.query("SELECT 1 AS ok");
      return true;
    } catch {
      return false;
    }
  }

  async close() {
    await this.pool.end();
  }
}

export async function createPostgresStore(options = {}) {
  const store = new PostgresChecklistStore(options);
  await store.ready;
  return store;
}
