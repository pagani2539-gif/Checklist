import crypto from "node:crypto";
import { promisify } from "node:util";

const COOKIE_NAME = "checklist_session";
const DEFAULT_SESSION_SECONDS = 8 * 60 * 60;
const ROLE_SET = new Set(["admin", "station-manager", "inspector", "viewer"]);
const GLOBAL_STATION_ROLES = new Set(["admin", "station-manager", "inspector"]);
const scryptAsync = promisify(crypto.scrypt);
const PASSWORD_HASH_BYTES = 64;
const DUMMY_LOCAL_PASSWORD_HASH = `scrypt$16384$8$1$${Buffer.from("checklist-dummy-salt").toString("base64url")}$${crypto.scryptSync("invalid-local-account-password", "checklist-dummy-salt", PASSWORD_HASH_BYTES, { N: 16384, r: 8, p: 1 }).toString("base64url")}`;

export async function hashLocalPassword(password) {
  const value = String(password || "");
  if (value.length < 8 || value.length > 256) throw Object.assign(new Error("รหัสผ่านต้องมีความยาว 8–256 ตัวอักษร"), { statusCode: 400 });
  const salt = crypto.randomBytes(16);
  const digest = await scryptAsync(value, salt, PASSWORD_HASH_BYTES, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString("base64url")}$${Buffer.from(digest).toString("base64url")}`;
}

async function verifyLocalPassword(password, encoded) {
  const [algorithm, nValue, rValue, pValue, saltValue, digestValue] = String(encoded || "").split("$");
  if (algorithm !== "scrypt" || !saltValue || !digestValue) return false;
  try {
    const expected = base64urlDecode(digestValue);
    const actual = Buffer.from(await scryptAsync(String(password || ""), base64urlDecode(saltValue), expected.length, { N: Number(nValue), r: Number(rValue), p: Number(pValue) }));
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function base64urlDecode(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="), "base64");
}

function parseCookie(header = "") {
  return Object.fromEntries(String(header).split(";").map((part) => part.trim().split("=")).filter(([key, value]) => key && value));
}

function cookieHeader(token, { secure = true, maxAge = DEFAULT_SESSION_SECONDS } = {}) {
  const parts = [`${COOKIE_NAME}=${token || ""}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAge}`];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

function normaliseRole(value) {
  const role = String(value || "").trim().toLowerCase();
  return ROLE_SET.has(role) ? role : "viewer";
}

function roleFromClaims(claims, clientId) {
  const roles = [
    ...(Array.isArray(claims?.roles) ? claims.roles : []),
    ...(Array.isArray(claims?.realm_access?.roles) ? claims.realm_access.roles : []),
    ...(Array.isArray(claims?.resource_access?.[clientId]?.roles) ? claims.resource_access[clientId].roles : []),
  ];
  return ["admin", "station-manager", "inspector", "viewer"].find((role) => roles.includes(role)) || "viewer";
}

function stationIdsFromClaims(claims) {
  const values = claims?.station_ids || claims?.stationIds || claims?.stations || [];
  return Array.isArray(values) ? values.map(String).filter(Boolean) : [];
}

async function verifyJwt(token, config, { expectedNonce = "", audienceOverride = "" } = {}) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("Invalid bearer token");
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = JSON.parse(base64urlDecode(encodedHeader).toString("utf8"));
  const claims = JSON.parse(base64urlDecode(encodedPayload).toString("utf8"));
  if (header.alg !== "RS256" || !header.kid) throw new Error("Unsupported bearer token");
  if (!config.jwksUrl) throw new Error("OIDC_JWKS_URL is not configured");
  const response = await fetch(config.jwksUrl, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("OIDC JWKS request failed");
  const keys = (await response.json())?.keys || [];
  const jwk = keys.find((key) => key.kid === header.kid && key.kty === "RSA");
  if (!jwk) throw new Error("Signing key not found");
  const key = await crypto.webcrypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.webcrypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64urlDecode(encodedSignature),
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
  );
  if (!valid) throw new Error("Invalid bearer token signature");
  const now = Math.floor(Date.now() / 1000);
  if (claims.exp && Number(claims.exp) <= now) throw new Error("Bearer token expired");
  if (config.issuer && claims.iss !== config.issuer) throw new Error("Bearer token issuer mismatch");
  if (expectedNonce && claims.nonce !== expectedNonce) throw new Error("OIDC nonce mismatch");
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  const expectedAudience = audienceOverride || config.audience;
  if (expectedAudience && !audience.includes(expectedAudience)) throw new Error("Bearer token audience mismatch");
  return {
    id: String(claims.sub || claims.preferred_username || "oidc-user"),
    displayName: String(claims.name || claims.preferred_username || claims.email || claims.sub || "OIDC user"),
    role: roleFromClaims(claims, config.clientId),
    stationIds: stationIdsFromClaims(claims),
    claims,
  };
}

export function createAuth({ store, env = process.env } = {}) {
  const mode = String(env.CHECKLIST_AUTH_MODE || "disabled").trim().toLowerCase();
  const isProduction = String(env.NODE_ENV || "").toLowerCase() === "production" || ["oidc", "local"].includes(mode);
  const secureCookie = env.CHECKLIST_COOKIE_SECURE !== "false" && isProduction;
  const sessionSeconds = Math.max(300, Number(env.CHECKLIST_SESSION_SECONDS || DEFAULT_SESSION_SECONDS));
  const config = {
    mode,
    issuer: String(env.OIDC_ISSUER || "").replace(/\/$/, ""),
    jwksUrl: String(env.OIDC_JWKS_URL || ""),
    audience: String(env.OIDC_AUDIENCE || ""),
    clientId: String(env.OIDC_CLIENT_ID || ""),
    authorizationEndpoint: String(env.OIDC_AUTHORIZATION_ENDPOINT || ""),
    tokenEndpoint: String(env.OIDC_TOKEN_ENDPOINT || ""),
    redirectUri: String(env.OIDC_REDIRECT_URI || ""),
    clientSecret: String(env.OIDC_CLIENT_SECRET || ""),
  };
  const pendingAuthorizations = new Map();

  async function setSessionCookie(user) {
    const token = crypto.randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + sessionSeconds * 1000).toISOString();
    await store.createSession({ token, userId: user.id, displayName: user.displayName, role: normaliseRole(user.role), stationIds: user.stationIds || [], expiresAt });
    return { header: cookieHeader(token, { secure: secureCookie, maxAge: sessionSeconds }), expiresAt };
  }

  function beginLogin() {
    if (mode !== "oidc" || !config.authorizationEndpoint || !config.clientId || !config.redirectUri) throw Object.assign(new Error("OIDC login is not configured"), { statusCode: 503 });
    const state = crypto.randomBytes(24).toString("base64url");
    const verifier = crypto.randomBytes(48).toString("base64url");
    const nonce = crypto.randomBytes(24).toString("base64url");
    const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
    pendingAuthorizations.set(state, { verifier, nonce, createdAt: Date.now() });
    const url = new URL(config.authorizationEndpoint);
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", config.redirectUri);
    url.searchParams.set("scope", "openid profile email");
    url.searchParams.set("state", state);
    url.searchParams.set("nonce", nonce);
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");
    return url.toString();
  }

  async function completeLogin(callbackUrl) {
    const url = new URL(callbackUrl, "http://localhost");
    const state = url.searchParams.get("state");
    const code = url.searchParams.get("code");
    const pending = pendingAuthorizations.get(state);
    pendingAuthorizations.delete(state);
    if (!pending || Date.now() - pending.createdAt > 10 * 60 * 1000 || !code) throw Object.assign(new Error("OIDC callback state is invalid or expired"), { statusCode: 401 });
    if (!config.tokenEndpoint) throw Object.assign(new Error("OIDC_TOKEN_ENDPOINT is not configured"), { statusCode: 503 });
    const form = new URLSearchParams({ grant_type: "authorization_code", client_id: config.clientId, code, redirect_uri: config.redirectUri, code_verifier: pending.verifier });
    if (config.clientSecret) form.set("client_secret", config.clientSecret);
    const tokenResponse = await fetch(config.tokenEndpoint, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: form });
    const tokenPayload = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok) throw Object.assign(new Error("OIDC token exchange failed"), { statusCode: 401 });
    const useIdToken = Boolean(tokenPayload.id_token);
    const user = await verifyJwt(useIdToken ? tokenPayload.id_token : tokenPayload.access_token, config, { expectedNonce: pending.nonce, audienceOverride: useIdToken ? config.clientId : config.audience });
    return { user, session: await setSessionCookie(user) };
  }

  async function authenticate(request) {
    if (mode === "disabled") return { id: "local-admin", displayName: "Local development", role: "admin", stationIds: [] };
    const cookies = parseCookie(request.headers.cookie || "");
    const session = await store.getSession(cookies[COOKIE_NAME]);
    if (session) {
      if (mode !== "local") return session;
      const account = await store.getLocalUserById(session.id);
      if (!account?.active) {
        const error = new Error("Authentication required");
        error.statusCode = 401;
        throw error;
      }
      return { id: account.id, username: account.username, displayName: account.displayName, role: account.role, stationIds: account.stationIds, mustChangePassword: account.mustChangePassword };
    }
    const authorization = String(request.headers.authorization || "");
    if (authorization.startsWith("Bearer ")) {
      if (mode !== "oidc") throw new Error("Bearer authentication is disabled");
      return verifyJwt(authorization.slice(7), config);
    }
    const error = new Error("Authentication required");
    error.statusCode = 401;
    throw error;
  }

  async function loginLocal(username, password) {
    if (mode !== "local") throw Object.assign(new Error("Local login is not enabled"), { statusCode: 404 });
    const normalizedUsername = String(username || "").trim().toLowerCase();
    const account = await store.getLocalUserByUsername(normalizedUsername);
    const passwordOk = await verifyLocalPassword(password, account?.passwordHash || DUMMY_LOCAL_PASSWORD_HASH);
    if (!account?.active || !passwordOk) throw Object.assign(new Error("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"), { statusCode: 401 });
    const user = { id: account.id, username: account.username, displayName: account.displayName, role: account.role, stationIds: account.stationIds, mustChangePassword: account.mustChangePassword };
    return { user, session: await setSessionCookie(user) };
  }

  function requireRole(user, roles) {
    const allowed = Array.isArray(roles) ? roles : [roles];
    if (!allowed.includes(user?.role)) {
      const error = new Error("Forbidden");
      error.statusCode = 403;
      throw error;
    }
  }

  function isStationAllowed(user, stationId) {
    if (!stationId) return false;
    if (GLOBAL_STATION_ROLES.has(user?.role)) return true;
    return Array.isArray(user?.stationIds) && user.stationIds.includes(String(stationId));
  }

  return {
    mode,
    config,
    authenticate,
    requireRole,
    isStationAllowed,
    setSessionCookie,
    clearSessionCookie: () => cookieHeader("", { secure: secureCookie, maxAge: 0 }),
    async revokeRequestSession(request, user) {
      const cookies = parseCookie(request.headers.cookie || "");
      await store.revokeSession(cookies[COOKIE_NAME], user);
    },
    oidcConfig() {
      return {
        mode,
        issuer: config.issuer,
        clientId: config.clientId,
        authorizationEndpoint: config.authorizationEndpoint,
        loginEndpoint: "/api/v1/auth/login",
        scopes: "openid profile email",
      };
    },
    localLogin: loginLocal,
    hashPassword: hashLocalPassword,
    async createLocalUser({ username, displayName, role, stationIds = [], password, actor, mustChangePassword = true } = {}) {
      if (mode !== "local") throw Object.assign(new Error("Local accounts are not enabled"), { statusCode: 404 });
      const normalizedUsername = String(username || "").trim().toLowerCase();
      if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(normalizedUsername)) throw Object.assign(new Error("ชื่อผู้ใช้ต้องเป็น a-z, 0-9, จุด, ขีดกลาง หรือขีดล่าง และยาว 3–64 ตัว"), { statusCode: 400 });
      const name = String(displayName || "").trim();
      if (!name || name.length > 120) throw Object.assign(new Error("กรุณาระบุชื่อผู้ใช้ ไม่เกิน 120 ตัวอักษร"), { statusCode: 400 });
      const normalizedUserRole = normaliseRole(role);
      if (!ROLE_SET.has(String(role || "").trim().toLowerCase())) throw Object.assign(new Error("Role ไม่ถูกต้อง"), { statusCode: 400 });
      const ids = GLOBAL_STATION_ROLES.has(normalizedUserRole)
        ? []
        : [...new Set((Array.isArray(stationIds) ? stationIds : []).map((value) => String(value).trim()).filter(Boolean))];
      if (!GLOBAL_STATION_ROLES.has(normalizedUserRole) && ids.length === 0) throw Object.assign(new Error("ผู้ใช้ที่มีสิทธิ์เฉพาะสถานีต้องมีสถานีอย่างน้อยหนึ่งสถานี"), { statusCode: 400 });
      const passwordHash = await hashLocalPassword(password);
      return store.createLocalUser({ id: crypto.randomUUID(), username: normalizedUsername, displayName: name, role: normalizedUserRole, stationIds: ids, passwordHash, mustChangePassword, createdBy: actor?.id || null });
    },
    async updateLocalUser(id, patch, actor) {
      if (mode !== "local") throw Object.assign(new Error("Local accounts are not enabled"), { statusCode: 404 });
      const next = { ...patch };
      if (next.displayName !== undefined) {
        next.displayName = String(next.displayName || "").trim();
        if (!next.displayName || next.displayName.length > 120) throw Object.assign(new Error("กรุณาระบุชื่อผู้ใช้ ไม่เกิน 120 ตัวอักษร"), { statusCode: 400 });
      }
      if (next.role !== undefined && !ROLE_SET.has(String(next.role || "").trim().toLowerCase())) throw Object.assign(new Error("Role ไม่ถูกต้อง"), { statusCode: 400 });
      if (next.role !== undefined && GLOBAL_STATION_ROLES.has(next.role)) next.stationIds = [];
      if (next.stationIds !== undefined) {
        if (!Array.isArray(next.stationIds)) throw Object.assign(new Error("stationIds ต้องเป็นรายการสถานี"), { statusCode: 400 });
        next.stationIds = [...new Set(next.stationIds.map((value) => String(value).trim()).filter(Boolean))];
        if (!GLOBAL_STATION_ROLES.has(next.role) && next.stationIds.length === 0) throw Object.assign(new Error("ผู้ใช้ที่มีสิทธิ์เฉพาะสถานีต้องมีสถานีอย่างน้อยหนึ่งสถานี"), { statusCode: 400 });
      }
      if (next.password !== undefined) {
        next.passwordHash = await hashLocalPassword(next.password);
        next.mustChangePassword = true;
        delete next.password;
      }
      return store.updateLocalUser(id, next, actor);
    },
    async changeLocalPassword(user, currentPassword, nextPassword) {
      if (mode !== "local") throw Object.assign(new Error("Local accounts are not enabled"), { statusCode: 404 });
      const account = await store.getLocalUserByUsername(user?.username);
      if (!account?.active || account.id !== user?.id || !(await verifyLocalPassword(currentPassword, account.passwordHash))) {
        throw Object.assign(new Error("รหัสผ่านปัจจุบันไม่ถูกต้อง"), { statusCode: 400 });
      }
      const updated = await store.updateLocalPassword(account.id, await hashLocalPassword(nextPassword), user);
      const session = await setSessionCookie(updated);
      return { user: updated, session };
    },
    beginLogin,
    completeLogin,
  };
}
