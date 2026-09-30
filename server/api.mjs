import crypto from "node:crypto";
import path from "node:path";
import { assertContractTopology, assertReferenceDataWriteAllowed, assertStateWithinStationScope, assertStationScopeForWrite, getScopedStationIds, scopeStateToStations } from "./state-scope.mjs";

const MAX_JSON_BYTES = 16 * 1024 * 1024;
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const READ_ROLES = ["admin", "station-manager", "inspector", "viewer"];
const WRITE_ROLES = ["admin", "station-manager", "inspector"];
const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf", "video/mp4", "video/webm", "text/plain"]);

function requestId(request) {
  return String(request.headers["x-request-id"] || crypto.randomUUID());
}

function securityHeaders() {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'self'; frame-ancestors 'none'; base-uri 'self'",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  };
}

function sendJson(response, status, body, extra = {}) {
  response.writeHead(status, { ...securityHeaders(), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra });
  response.end(JSON.stringify(body));
}

function sendError(response, status, message, requestIdValue) {
  sendJson(response, status, { message, requestId: requestIdValue });
}

function readBody(request, maxBytes) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      size += Buffer.byteLength(chunk);
      if (size > maxBytes) {
        const error = new Error("Request body is too large");
        error.statusCode = 413;
        reject(error);
        request.destroy();
        return;
      }
      chunks.push(Buffer.from(chunk));
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

async function readJson(request) {
  const body = await readBody(request, MAX_JSON_BYTES);
  if (!body.length) return {};
  try {
    return JSON.parse(body.toString("utf8"));
  } catch {
    const error = new Error("Invalid JSON payload");
    error.statusCode = 400;
    throw error;
  }
}

function filenameExtension(contentType) {
  return { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "application/pdf": ".pdf", "video/mp4": ".mp4", "video/webm": ".webm", "text/plain": ".txt" }[contentType] || ".bin";
}

function safeOriginalName(value) {
  const normalized = path.basename(String(value || "attachment")).replace(/[^A-Za-z0-9ก-๙._() -]/g, "_").slice(0, 160);
  return normalized || "attachment";
}

function originalNameFromRequest(request) {
  const value = request.headers["x-filename"] || "attachment";
  if (String(request.headers["x-filename-encoding"] || "").toLowerCase() !== "percent-encoded-utf8") {
    return safeOriginalName(value);
  }
  try {
    return safeOriginalName(decodeURIComponent(String(value)));
  } catch {
    return safeOriginalName("attachment");
  }
}

function contentDispositionFilename(value) {
  const name = safeOriginalName(value);
  const fallback = name.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(name).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  return `inline; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

function matchesMagic(buffer, contentType) {
  if (contentType === "image/jpeg") return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (contentType === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (contentType === "image/webp") return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  if (contentType === "application/pdf") return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  if (contentType === "video/mp4") return buffer.subarray(4, 8).toString("ascii") === "ftyp";
  if (contentType === "video/webm") return buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  if (contentType === "text/plain") return !buffer.includes(0);
  return false;
}

function stationIdFromBody(body) {
  return body?.stationId || body?.station?.id || body?.snapshot?.stationId || null;
}

function roundIdFromBody(body) {
  return body?.roundId || body?.id || null;
}

function containsAttachment(value, attachmentId, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  if (String(value?.attachment?.id || "") === String(attachmentId)) return true;
  if (Array.isArray(value)) return value.some((entry) => containsAttachment(entry, attachmentId, seen));
  return Object.values(value).some((entry) => containsAttachment(entry, attachmentId, seen));
}

export function createApi({ store, auth, attachmentStore, vehicleReady = null, enforceStationScope = false } = {}) {
  if (!attachmentStore) throw new Error("attachmentStore is required");
  const rateBuckets = new Map();
  const loginFailures = new Map();

  function rateLimited(request) {
    const key = String(request.socket?.remoteAddress || "unknown");
    const current = rateBuckets.get(key) || { startedAt: Date.now(), count: 0 };
    if (Date.now() - current.startedAt >= 60_000) {
      current.startedAt = Date.now();
      current.count = 0;
    }
    current.count += 1;
    rateBuckets.set(key, current);
    return current.count > 120;
  }

  async function withUser(request, response, handler, roles = READ_ROLES) {
    const id = requestId(request);
    let user;
    try {
      user = await auth.authenticate(request);
      auth.requireRole(user, roles);
      const pathname = new URL(request.url || "/", "http://localhost").pathname;
      if (user.mustChangePassword && !["/api/v1/auth/me", "/api/v1/auth/logout", "/api/v1/auth/password"].includes(pathname)) {
        sendJson(response, 403, { message: "กรุณาเปลี่ยนรหัสผ่านก่อนใช้งานระบบ", code: "PASSWORD_CHANGE_REQUIRED", requestId: id });
        return true;
      }
      await handler(user, id);
      return true;
    } catch (error) {
      const status = error.statusCode || (error.message === "Forbidden" ? 403 : 500);
      await store.audit(status === 403 ? "authorization.failure" : "authentication.failure", user, "http", request.url, { status }, id);
      if (status >= 500) console.error(JSON.stringify({ event: "api.error", requestId: id, path: request.url, message: error?.message || "unknown" }));
      if (status === 409 && user && error.mergeCandidate && Array.isArray(error.mergeConflicts)) {
        try {
          sendJson(response, status, {
            message: error.message || "State version conflict; resolve overlapping fields before saving",
            requestId: id,
            conflict: {
              currentVersion: error.currentVersion,
              candidateState: await scopeState(user, error.mergeCandidate),
              paths: error.mergeConflicts,
            },
          });
          return true;
        } catch {
          // Fall through to the generic conflict response if safe scoping fails.
        }
      }
      sendError(response, status, status === 401 ? "Authentication required" : status >= 500 ? "Internal server error" : error.message || "Request failed", id);
      return true;
    }
  }

  async function scopeState(user, state) {
    return scopeStateToStations(state, await scopedStationIds(user, state));
  }

  function assertResourceScope(user, stationId) {
    if (enforceStationScope && !auth.isStationAllowed(user, stationId)) {
      const error = new Error("Station access is not allowed");
      error.statusCode = 403;
      throw error;
    }
  }

  async function scopedStationIds(user, state = null) {
    let source = state;
    if (enforceStationScope && user?.role === "inspector" && !source) {
      source = (await store.getState()).state || {};
    }
    const allStationIds = Array.isArray(source?.stationProfiles)
      ? source.stationProfiles.map((station) => String(station?.id || "")).filter(Boolean)
      : [];
    return getScopedStationIds({ enforceStationScope, user, allStationIds });
  }

  async function validateKnownStationIds(stationIds) {
    const current = await store.getState();
    const known = new Set((Array.isArray(current?.state?.stationProfiles) ? current.state.stationProfiles : []).map((station) => String(station?.id || "")).filter(Boolean));
    const missing = stationIds.filter((stationId) => !known.has(String(stationId)));
    if (missing.length) throw Object.assign(new Error("มี Station Profile ที่ไม่รู้จักในรายการสิทธิ์"), { statusCode: 400 });
  }

  function assertStateScope(state, stationIds) {
    assertStateWithinStationScope(state, stationIds);
  }

  async function attachmentStationIds(attachmentId) {
    const state = (await store.getState()).state || {};
    const ids = new Set();
    ["inspectionRounds", "inspectionHistory", "inspectionWorkspaces"].forEach((key) => {
      (Array.isArray(state[key]) ? state[key] : []).forEach((record) => {
        if (containsAttachment(record, attachmentId)) {
          const stationId = record?.stationId || record?.snapshot?.stationId || record?.stationSnapshot?.stationId;
          if (stationId) ids.add(String(stationId));
        }
      });
    });
    return [...ids];
  }

  async function assertAttachmentScope(user, metadata) {
    if (!enforceStationScope || user.role === "admin") return;
    const stationIds = [...new Set([metadata?.stationId, ...(await attachmentStationIds(metadata?.id))].filter(Boolean).map(String))];
    if (!stationIds.length || stationIds.some((stationId) => !auth.isStationAllowed(user, stationId))) {
      const error = new Error("Attachment access is not allowed");
      error.statusCode = 403;
      throw error;
    }
  }

  async function handle(request, response) {
    const parsed = new URL(request.url || "/", "http://localhost");
    const pathname = parsed.pathname;
    if (!pathname.startsWith("/api/v1/") && pathname !== "/health" && pathname !== "/ready") return false;
    const id = requestId(request);
    response.setHeader("X-Request-Id", id);
    if (pathname.startsWith("/api/") && rateLimited(request)) {
      sendJson(response, 429, { message: "Too many requests", requestId: id }, { "Retry-After": "60" });
      return true;
    }

    if (pathname === "/health") {
      sendJson(response, 200, { status: "ok", service: "checklist-api", pid: process.pid, time: new Date().toISOString() });
      return true;
    }
    if (pathname === "/ready") {
      const databaseReady = await store.isReady();
      const attachmentsReady = await attachmentStore.isReady();
      const vehicleApiRequired = String(process.env.REQUIRE_VEHICLE_API_READY || "").toLowerCase() === "true";
      const vehicleApiReady = typeof vehicleReady === "boolean" ? vehicleReady : null;
      const ready = databaseReady && attachmentsReady && (!vehicleApiRequired || vehicleApiReady === true);
      sendJson(response, ready ? 200 : 503, { status: ready ? "ready" : "not-ready", database: databaseReady, attachments: attachmentsReady, attachmentBackend: attachmentStore.kind, vehicleApi: vehicleApiReady });
      return true;
    }
    if (pathname === "/api/v1/auth/config" && request.method === "GET") {
      sendJson(response, 200, { ...auth.oidcConfig(), hasLocalUsers: auth.mode === "local" ? (await store.countLocalUsers()) > 0 : undefined });
      return true;
    }
    if (pathname === "/api/v1/auth/login" && request.method === "POST") {
      const ip = String(request.socket?.remoteAddress || "unknown");
      const attempt = loginFailures.get(ip);
      if (attempt && attempt.lockedUntil > Date.now()) {
        sendError(response, 429, "เข้าสู่ระบบไม่สำเร็จหลายครั้ง กรุณารอสักครู่", id);
        return true;
      }
      try {
        const body = await readJson(request);
        const result = await auth.localLogin(body.username, body.password);
        loginFailures.delete(ip);
        await store.audit("auth.login.success", result.user, "session", result.user.id, { method: "local" }, id);
        sendJson(response, 200, { user: result.user, expiresAt: result.session.expiresAt }, { "Set-Cookie": result.session.header });
      } catch (error) {
        const current = loginFailures.get(ip) || { count: 0, windowStart: Date.now(), lockedUntil: 0 };
        if (Date.now() - current.windowStart > 15 * 60 * 1000) { current.count = 0; current.windowStart = Date.now(); }
        current.count += 1;
        if (current.count >= 8) current.lockedUntil = Date.now() + 15 * 60 * 1000;
        loginFailures.set(ip, current);
        await store.audit("auth.login.failure", null, "session", null, { method: "local", status: error.statusCode || 401 }, id);
        sendError(response, error.statusCode === 400 ? 400 : error.statusCode === 404 ? 404 : error.statusCode === 429 ? 429 : 401, error.statusCode === 400 ? error.message : "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", id);
      }
      return true;
    }
    if (pathname === "/api/v1/auth/login" && request.method === "GET") {
      try {
        response.writeHead(302, { ...securityHeaders(), Location: auth.beginLogin(), "Cache-Control": "no-store" });
        response.end();
      } catch (error) {
        sendError(response, error.statusCode || 503, error.message || "OIDC login is not configured", id);
      }
      return true;
    }
    if (pathname === "/api/v1/auth/callback" && request.method === "GET") {
      try {
        const result = await auth.completeLogin(request.url || "/");
        await store.audit("auth.login.success", result.user, "session", result.user.id, null, id);
        response.writeHead(302, { ...securityHeaders(), Location: "/", "Set-Cookie": result.session.header, "Cache-Control": "no-store" });
        response.end();
      } catch (error) {
        await store.audit("auth.login.failure", null, "session", null, { message: error.message }, id);
        sendError(response, error.statusCode || 401, "Authentication failed", id);
      }
      return true;
    }
    if (pathname === "/api/v1/auth/me" && request.method === "GET") {
      return withUser(request, response, async (user) => { sendJson(response, 200, { user }); }, READ_ROLES);
    }
    if (pathname === "/api/v1/auth/password" && request.method === "POST") {
      try {
        const user = await auth.authenticate(request);
        const body = await readJson(request);
        const result = await auth.changeLocalPassword(user, body.currentPassword, body.newPassword);
        await store.audit("auth.password.change", user, "user", user.id, null, id);
        sendJson(response, 200, { user: result.user, expiresAt: result.session.expiresAt }, { "Set-Cookie": result.session.header });
      } catch (error) {
        await store.audit("auth.password.change.failure", null, "user", null, { status: error.statusCode || 500 }, id);
        sendError(response, error.statusCode || 400, error.statusCode >= 500 ? "ไม่สามารถเปลี่ยนรหัสผ่านได้" : error.message, id);
      }
      return true;
    }
    if (pathname === "/api/v1/auth/exchange" && request.method === "POST") {
      try {
        const user = await auth.authenticate(request);
        if (auth.mode !== "oidc" || !request.headers.authorization?.startsWith("Bearer ")) throw Object.assign(new Error("OIDC bearer token is required"), { statusCode: 401 });
        const session = await auth.setSessionCookie(user);
        await store.audit("auth.login.success", user, "session", user.id, null, id);
        sendJson(response, 200, { user, expiresAt: session.expiresAt }, { "Set-Cookie": session.header });
      } catch (error) {
        await store.audit("auth.login.failure", null, "session", null, { message: error.message }, id);
        sendError(response, error.statusCode || 401, "Authentication failed", id);
      }
      return true;
    }
    if (pathname === "/api/v1/auth/logout" && request.method === "POST") {
      return withUser(request, response, async (user) => {
        await auth.revokeRequestSession(request, user);
        sendJson(response, 200, { ok: true }, { "Set-Cookie": auth.clearSessionCookie() });
      });
    }
    if (pathname === "/api/v1/admin/users" && request.method === "GET") {
      return withUser(request, response, async () => {
        sendJson(response, 200, { users: await store.listLocalUsers() });
      }, ["admin"]);
    }
    if (pathname === "/api/v1/admin/users" && request.method === "POST") {
      return withUser(request, response, async (user, requestIdValue) => {
        const body = await readJson(request);
        if (Array.isArray(body.stationIds)) await validateKnownStationIds([...new Set(body.stationIds.map(String))]);
        const created = await auth.createLocalUser({ ...body, actor: user, mustChangePassword: true });
        await store.audit("admin.user.create", user, "user", created.id, { role: created.role, stationCount: created.stationIds.length }, requestIdValue);
        sendJson(response, 201, { user: created });
      }, ["admin"]);
    }
    const adminUserMatch = pathname.match(/^\/api\/v1\/admin\/users\/([^/]+)$/);
    if (adminUserMatch && request.method === "PATCH") {
      return withUser(request, response, async (user, requestIdValue) => {
        const targetId = decodeURIComponent(adminUserMatch[1]);
        if (targetId === user.id) throw Object.assign(new Error("ไม่สามารถแก้ไขหรือระงับบัญชีที่กำลังใช้งานอยู่จากเมนูนี้"), { statusCode: 400 });
        const body = await readJson(request);
        const patch = {};
        for (const key of ["displayName", "role", "stationIds", "active", "password"]) {
          if (Object.hasOwn(body, key)) patch[key] = body[key];
        }
        if (Object.hasOwn(patch, "active") && typeof patch.active !== "boolean") throw Object.assign(new Error("active ต้องเป็น true หรือ false"), { statusCode: 400 });
        if (Array.isArray(patch.stationIds)) await validateKnownStationIds([...new Set(patch.stationIds.map(String))]);
        const updated = await auth.updateLocalUser(targetId, patch, user);
        await store.audit("admin.user.update", user, "user", updated.id, { role: updated.role, active: updated.active, stationCount: updated.stationIds.length, passwordReset: Object.hasOwn(patch, "password") }, requestIdValue);
        sendJson(response, 200, { user: updated });
      }, ["admin"]);
    }
    if (pathname === "/api/v1/state" && request.method === "GET") {
      return withUser(request, response, async (user) => {
        const current = await store.getState();
        sendJson(response, 200, { state: await scopeState(user, current.state || {}), version: current.version, updatedAt: current.updatedAt, authMode: auth.mode });
      });
    }
    if (pathname === "/api/v1/state" && request.method === "PUT") {
      return withUser(request, response, async (user, requestIdValue) => {
        const body = await readJson(request);
        const nextState = body.state || body;
        const current = await store.getState();
        const stationIds = await scopedStationIds(user, current.state || {});
        assertStationScopeForWrite(stationIds);
        assertReferenceDataWriteAllowed(current.state || {}, nextState, user);
        assertContractTopology(nextState);
        assertStateScope(nextState, stationIds);
        const result = await store.saveState(nextState, { expectedVersion: body.expectedVersion, stationIds, actor: user, reason: body.reason || "state-update", requestId: requestIdValue });
        sendJson(response, 200, {
          version: result.version,
          updatedAt: result.updatedAt,
          ...(result.mergedConcurrentState ? { state: await scopeState(user, result.state), mergedConcurrentState: true } : {}),
        });
      }, WRITE_ROLES);
    }
    if (pathname === "/api/v1/stations" && request.method === "GET") {
      return withUser(request, response, async (user) => {
        const stations = await store.listStations(await scopedStationIds(user));
        sendJson(response, 200, { stations: stations.filter((station) => !enforceStationScope || auth.isStationAllowed(user, station?.id)) });
      });
    }
    if (pathname === "/api/v1/rounds" && request.method === "GET") {
      return withUser(request, response, async (user) => {
        const rounds = await store.listRounds(await scopedStationIds(user));
        sendJson(response, 200, { rounds: rounds.filter((round) => !enforceStationScope || auth.isStationAllowed(user, round?.stationId)) });
      });
    }
    const resourceParts = pathname.split("/").filter(Boolean);
    if (request.method === "GET" && resourceParts[0] === "api" && resourceParts[1] === "v1") {
      if (resourceParts[2] === "stations" && resourceParts[3]) {
        return withUser(request, response, async (user) => {
          const station = (await store.listStations(await scopedStationIds(user))).find((entry) => String(entry?.id) === resourceParts[3]);
          if (!station) { sendError(response, 404, "Station not found", id); return; }
          assertResourceScope(user, station.id);
          const suffix = resourceParts[4] || "";
          if (suffix === "assets" || suffix === "systems" || suffix === "lanes") {
            const key = suffix === "assets" ? "equipment" : suffix === "systems" ? "stationSystems" : "lanes";
            sendJson(response, 200, { stationId: station.id, [suffix]: Array.isArray(station[key]) ? station[key] : [] });
            return;
          }
          sendJson(response, 200, { station });
        });
      }
      if (resourceParts[2] === "rounds" && resourceParts[3]) {
        return withUser(request, response, async (user) => {
          const round = (await store.listRounds(await scopedStationIds(user))).find((entry) => String(entry?.id) === resourceParts[3]);
          if (!round) { sendError(response, 404, "Inspection round not found", id); return; }
          assertResourceScope(user, round.stationId);
          const suffix = resourceParts[4] || "";
          if (suffix === "snapshot") sendJson(response, 200, { roundId: round.id, snapshot: round.snapshot || null });
          else if (suffix === "evidence") sendJson(response, 200, { roundId: round.id, evidence: round.inspectionItems || {} });
          else if (suffix === "report") sendJson(response, 200, { roundId: round.id, report: { stationId: round.stationId, status: round.status, meta: round.meta, snapshot: round.snapshot, inspectionItems: round.inspectionItems, vehicleSearch: round.vehicleSearch } });
          else sendJson(response, 200, { round });
        });
      }
      if (resourceParts[2] === "history") {
        return withUser(request, response, async (user) => {
          const rounds = (await store.listRounds(await scopedStationIds(user))).filter((round) => round.status === "closed" && (!enforceStationScope || auth.isStationAllowed(user, round.stationId)));
          sendJson(response, 200, { history: rounds });
        });
      }
    }
    if (pathname === "/api/v1/audit" && request.method === "GET") {
      return withUser(request, response, async (user) => { sendJson(response, 200, { entries: await store.listAudit(parsed.searchParams.get("limit")) }); }, ["admin"]);
    }
    if (pathname.startsWith("/api/v1/attachments")) {
      const attachmentId = pathname.split("/")[4] || "";
      if (!attachmentId || !/^[A-Za-z0-9._-]{8,160}$/.test(attachmentId)) {
        sendError(response, 400, "Invalid attachment id", id);
        return true;
      }
      if (request.method === "GET" || request.method === "HEAD") {
        return withUser(request, response, async (user) => {
          const metadata = await store.getAttachment(attachmentId);
          if (!metadata) { sendError(response, 404, "Attachment not found", id); return; }
          await assertAttachmentScope(user, metadata);
          let body;
          try { body = await attachmentStore.get(metadata.storageName); } catch { sendError(response, 404, "Attachment not found", id); return; }
          await store.audit("attachment.download", user, "attachment", attachmentId, null, id);
          response.writeHead(200, { ...securityHeaders(), "Content-Type": metadata.contentType, "Content-Length": body.length, "Content-Disposition": contentDispositionFilename(metadata.originalName), "Cache-Control": "private, no-store" });
          if (request.method === "HEAD") response.end(); else response.end(body);
        });
      }
      if (request.method === "PUT" || request.method === "POST") {
        return withUser(request, response, async (user, requestIdValue) => {
          const contentType = String(request.headers["content-type"] || "").split(";")[0].toLowerCase();
          const stationId = String(request.headers["x-station-id"] || "").trim();
          if (enforceStationScope && !stationId) throw Object.assign(new Error("X-Station-Id is required for scoped upload"), { statusCode: 400 });
          assertResourceScope(user, stationId);
          const declaredLength = Number(request.headers["content-length"] || 0);
          if (!ALLOWED_CONTENT_TYPES.has(contentType)) throw Object.assign(new Error("Unsupported file type"), { statusCode: 400 });
          if (declaredLength > MAX_ATTACHMENT_BYTES) throw Object.assign(new Error("File is too large"), { statusCode: 413 });
          const body = await readBody(request, MAX_ATTACHMENT_BYTES);
          if (!body.length || body.length > MAX_ATTACHMENT_BYTES || !matchesMagic(body, contentType)) throw Object.assign(new Error("File content does not match its declared type"), { statusCode: 400 });
          const storageName = `${crypto.randomUUID()}${filenameExtension(contentType)}`;
          await attachmentStore.put(storageName, body, { contentType });
          let metadata;
          try {
            metadata = await store.addAttachment({ id: attachmentId, storageName, originalName: originalNameFromRequest(request), contentType, size: body.length, sha256: crypto.createHash("sha256").update(body).digest("hex"), stationId: stationId || null, createdBy: user.id, createdAt: new Date().toISOString() });
          } catch (error) {
            await attachmentStore.delete(storageName);
            throw error;
          }
          await store.audit("attachment.upload", user, "attachment", attachmentId, { size: body.length, contentType }, requestIdValue);
          sendJson(response, 201, { attachment: metadata });
        }, WRITE_ROLES);
      }
      if (request.method === "DELETE") {
        return withUser(request, response, async (user) => {
          const metadata = await store.getAttachment(attachmentId);
          if (!metadata) { sendJson(response, 204, null); return; }
          auth.requireRole(user, WRITE_ROLES);
          await assertAttachmentScope(user, metadata);
          await store.deleteAttachment(attachmentId, user);
          await attachmentStore.delete(metadata.storageName);
          sendJson(response, 204, null);
        });
      }
      sendError(response, 405, "Method Not Allowed", id);
      return true;
    }
    sendError(response, 404, "Not found", id);
    return true;
  }

  return { handle };
}
