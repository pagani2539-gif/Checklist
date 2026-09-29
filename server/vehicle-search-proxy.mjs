import { getVehicleApiAdapter, normalizeVehicleSearchBaseUrl, VEHICLE_API_PROFILES } from "../src/domain/vehicle-search.js";
import net from "node:net";

const MAX_BODY_BYTES = 128 * 1024;
const REQUEST_TIMEOUT_MS = 15000;
const SAFE_IMAGE_PATH = /^(?:crop|lpr|overview)\/[A-Za-z0-9][A-Za-z0-9._~!$&'()*+,;=@%/-]*$/;
const VEHICLE_READ_ROLES = ["admin", "station-manager", "inspector", "viewer"];
const GLOBAL_STATION_ROLES = new Set(["admin", "station-manager", "inspector"]);
const rateBuckets = new Map();

function accessError(message, statusCode) {
  return Object.assign(new Error(message), { statusCode });
}

async function authorizeVehicleRequest(request, stationId, options) {
  const auth = options.auth;
  if (!auth || typeof auth.authenticate !== "function" || typeof auth.requireRole !== "function") {
    throw accessError("Vehicle API access control is unavailable", 503);
  }

  const user = await auth.authenticate(request);
  auth.requireRole(user, VEHICLE_READ_ROLES);

  if ((options.enforceStationScope || options.enforceStationTarget) && !stationId) {
    throw accessError("Station Profile is required", 400);
  }

  if (options.enforceStationScope && stationId && !GLOBAL_STATION_ROLES.has(user?.role)) {
    const stationIds = Array.isArray(user?.stationIds) ? user.stationIds.map(String) : [];
    if (!stationIds.includes(String(stationId))) {
      throw accessError("Station access is not allowed", 403);
    }
  }

  return user;
}

function isRateLimited(request) {
  const key = String(request.socket?.remoteAddress || "unknown");
  const current = rateBuckets.get(key) || { startedAt: Date.now(), count: 0 };
  if (Date.now() - current.startedAt >= 60_000) {
    current.startedAt = Date.now();
    current.count = 0;
  }
  current.count += 1;
  rateBuckets.set(key, current);
  return current.count > 60;
}
function normalizeAllowedOrigins(value) {
  return new Set(
    String(value || "")
      .split(",")
      .map((origin) => normalizeVehicleSearchBaseUrl(origin))
      .filter(Boolean),
  );
}

function getDefaultAllowedOrigins() {
  const targets = getConfiguredStationTargets();
  return new Set([
    ...normalizeAllowedOrigins(process.env.VEHICLE_SEARCH_ALLOWED_ORIGINS || process.env.VEHICLE_SEARCH_DEFAULT_BASE_URL || ""),
    ...normalizeAllowedOrigins(Object.values(targets).join(",")),
  ]);
}

function getConfiguredStationTargets() {
  try {
    const parsed = JSON.parse(process.env.VEHICLE_SEARCH_STATION_TARGETS || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function isPrivateHost(hostname) {
  const host = String(hostname || "").toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
  if (["localhost", "localhost.localdomain", "0.0.0.0", "::", "::1"].includes(host) || host.endsWith(".localhost")) return true;
  const address = net.isIP(host);
  if (address === 4) {
    const [a, b] = host.split(".").map(Number);
    return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
  }
  if (address === 6) return host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe8") || host.startsWith("fe9") || host.startsWith("fea") || host.startsWith("feb");
  return false;
}

function writeJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-cache" });
  response.end(JSON.stringify(body));
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      size += Buffer.byteLength(chunk);
      if (size > MAX_BODY_BYTES) {
        const error = new Error("Request body is too large");
        error.statusCode = 413;
        reject(error);
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(chunks.join("")));
    request.on("error", reject);
  });
}

function parseBaseUrl(value, allowedOrigins, { allowPrivate = true } = {}) {
  const baseUrl = normalizeVehicleSearchBaseUrl(value);
  if (!baseUrl) throw new Error("Base URL ของ API ป้ายทะเบียนไม่ถูกต้อง");
  if (!allowedOrigins.has(baseUrl)) throw new Error("ปลายทาง API นี้ไม่อยู่ใน allowlist ของเซิร์ฟเวอร์");
  const parsed = new URL(baseUrl);
  if (!allowPrivate && isPrivateHost(parsed.hostname)) throw new Error("ไม่อนุญาตปลายทาง private/loopback สำหรับ proxy นี้");
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error("scheme หรือ URL ของ API ไม่ปลอดภัย");
  return baseUrl;
}

async function resolveStationTarget(source, allowedOrigins, options) {
  if (!options.enforceStationTarget) return parseBaseUrl(source?.baseUrl, allowedOrigins, { allowPrivate: true });
  const stationId = String(source?.stationId || "").trim();
  const configured = await options.resolveStationTarget?.(stationId) || options.stationTargets[stationId];
  if (!stationId || !configured) throw new Error("ต้องระบุ Station Profile ที่มีปลายทาง Vehicle API ใน allowlist");
  return parseBaseUrl(configured, allowedOrigins, { allowPrivate: true });
}

async function proxyVehicleSearch(request, response, allowedOrigins, options) {
  if (request.method !== "POST") {
    writeJson(response, 405, { message: "Method Not Allowed" });
    return;
  }
  let source;
  try {
    const raw = await readRequestBody(request);
    source = raw.trim() ? JSON.parse(raw) : null;
  } catch (error) {
    writeJson(response, error.statusCode || 400, { message: error.statusCode === 413 ? "Request body is too large" : "อ่าน request body ไม่สำเร็จ" });
    return;
  }
  try {
    await authorizeVehicleRequest(request, source?.stationId, options);
  } catch (error) {
    writeJson(response, error.statusCode || 401, { message: error.statusCode === 403 ? "Station access is not allowed" : error.statusCode === 400 ? "Station Profile is required" : error.statusCode === 503 ? "Vehicle API access control is unavailable" : "Authentication required" });
    return;
  }
  let baseUrl;
  const apiProfile = source?.apiProfile === VEHICLE_API_PROFILES.IMPS_V2 ? VEHICLE_API_PROFILES.IMPS_V2 : VEHICLE_API_PROFILES.LEGACY_V1;
  const payload = source?.payload;
  try {
    baseUrl = await resolveStationTarget(source, allowedOrigins, options);
  } catch (error) {
    writeJson(response, 400, { message: error.message });
    return;
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    writeJson(response, 400, { message: "ไม่พบข้อมูลเงื่อนไขค้นหาป้ายทะเบียน" });
    return;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const upstream = await fetch(new URL(getVehicleApiAdapter(apiProfile).searchPath, `${baseUrl}/`), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const upstreamBody = await upstream.text();
    response.writeHead(upstream.status, {
      "Content-Type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
      "Cache-Control": "no-cache",
    });
    response.end(upstreamBody);
  } catch (error) {
    writeJson(response, 502, { message: error?.name === "AbortError" ? "API ค้นหาป้ายทะเบียนใช้เวลานานเกินกำหนด" : "เชื่อมต่อ API ค้นหาป้ายทะเบียนไม่สำเร็จ" });
  } finally {
    clearTimeout(timeout);
  }
}

async function proxyVehicleImage(request, response, requestUrl, allowedOrigins, options) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD", "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ message: "Method Not Allowed" }));
    return;
  }
  const parsedRequestUrl = new URL(requestUrl || "/", "http://localhost");
  const imagePath = parsedRequestUrl.searchParams.get("path") || "";
  const baseUrlValue = parsedRequestUrl.searchParams.get("baseUrl") || "";
  const stationId = parsedRequestUrl.searchParams.get("stationId") || "";
  const apiProfile = parsedRequestUrl.searchParams.get("apiProfile") === VEHICLE_API_PROFILES.IMPS_V2 ? VEHICLE_API_PROFILES.IMPS_V2 : VEHICLE_API_PROFILES.LEGACY_V1;
  let baseUrl;
  try {
    await authorizeVehicleRequest(request, stationId, options);
    baseUrl = options.enforceStationTarget
      ? await resolveStationTarget({ stationId }, allowedOrigins, options)
      : parseBaseUrl(baseUrlValue, allowedOrigins, { allowPrivate: true });
  } catch (error) {
    const statusCode = error.statusCode || 400;
    const message = statusCode === 401 ? "Authentication required"
      : statusCode === 403 ? "Station access is not allowed"
        : statusCode === 400 && !stationId && (options.enforceStationScope || options.enforceStationTarget) ? "Station Profile is required"
          : statusCode === 503 ? "Vehicle API access control is unavailable"
            : error.message;
    writeJson(response, statusCode, { message });
    return;
  }
  if (!SAFE_IMAGE_PATH.test(imagePath) || imagePath.split("/").includes("..")) {
    writeJson(response, 400, { message: "ไม่ระบุเส้นทางภาพจาก Vehicle API ที่ถูกต้อง" });
    return;
  }
  const upstreamUrl = new URL(getVehicleApiAdapter(apiProfile).imagePath, `${baseUrl}/`);
  upstreamUrl.searchParams.set("path", imagePath);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers: { Accept: request.headers.accept || "image/*" },
      signal: controller.signal,
    });
    const imageBody = request.method === "HEAD" ? null : Buffer.from(await upstream.arrayBuffer());
    response.writeHead(upstream.status, {
      "Content-Type": upstream.headers.get("content-type") || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    response.end(imageBody);
  } catch (error) {
    writeJson(response, 502, { message: error?.name === "AbortError" ? "ภาพจาก Vehicle API ใช้เวลานานเกินกำหนด" : "เชื่อมต่อภาพจาก Vehicle API ไม่สำเร็จ" });
  } finally {
    clearTimeout(timeout);
  }
}

export function handleVehicleSearchProxyRequest(request, response, options = {}) {
  const allowedOrigins = options.allowedOrigins instanceof Set
    ? options.allowedOrigins
    : getDefaultAllowedOrigins();
  const requestUrl = request.url || "/";
  const enforceStationScope = options.enforceStationScope ?? process.env.CHECKLIST_ENFORCE_STATION_SCOPE === "true";
  const enforceStationTarget = options.enforceStationTarget
    ?? (process.env.VEHICLE_SEARCH_ENFORCE_STATION_TARGET === "true" || enforceStationScope || options.auth?.mode === "oidc");
  const proxyOptions = {
    auth: options.auth,
    enforceStationScope,
    enforceStationTarget,
    stationTargets: options.stationTargets || getConfiguredStationTargets(),
    resolveStationTarget: options.resolveStationTarget,
  };
  const requestPath = new URL(requestUrl, "http://localhost").pathname;
  if ((requestPath === "/api/vehicle/search" || requestPath === "/api/vehicle/image") && isRateLimited(request)) {
    response.setHeader("Retry-After", "60");
    writeJson(response, 429, { message: "Too many requests" });
    return true;
  }
  if (requestPath === "/api/vehicle/search") {
    void proxyVehicleSearch(request, response, allowedOrigins, proxyOptions);
    return true;
  }
  if (requestPath === "/api/vehicle/image") {
    void proxyVehicleImage(request, response, requestUrl, allowedOrigins, proxyOptions);
    return true;
  }
  return false;
}
