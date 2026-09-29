import { getVehicleApiAdapter, isVehicleApiProfile, VEHICLE_API_PROFILES } from "./vehicle-api-profiles.js";

const BUILD_ENV = import.meta.env || {};
export const VEHICLE_SEARCH_ENFORCE_STATION_TARGET = String(BUILD_ENV.VITE_VEHICLE_PROXY_ENFORCE_STATION_TARGET || "false").trim().toLowerCase() === "true";

export const VEHICLE_SEARCH_DEFAULT_BASE_URL = String(BUILD_ENV.VITE_VEHICLE_SEARCH_BASE_URL || "").trim();
export const VEHICLE_SEARCH_DEFAULT_PROXY_BASE_URL = String(BUILD_ENV.VITE_VEHICLE_SEARCH_PROXY_BASE_URL || "").trim();

export const VEHICLE_SEARCH_CONNECTION_STATUS = Object.freeze({
  NOT_CONFIGURED: "not-configured",
  UNTESTED: "untested",
  CONNECTED: "connected",
  FAILED: "failed",
});

export const VEHICLE_CONNECTION_MODES = Object.freeze({
  DIRECT: "direct",
  PROXY: "proxy",
});

const VEHICLE_SEARCH_CONNECTION_STATUS_VALUES = new Set(Object.values(VEHICLE_SEARCH_CONNECTION_STATUS));
const VEHICLE_CONNECTION_MODE_VALUES = new Set(Object.values(VEHICLE_CONNECTION_MODES));

function text(value) {
  return String(value ?? "").trim();
}

export function normalizeVehicleSearchBaseUrl(value) {
  const raw = text(value).replace(/\/+$/, "");
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash || (parsed.pathname && parsed.pathname !== "/")) return "";
    return parsed.origin;
  } catch {
    return "";
  }
}

export function normalizeVehicleSearchEndpoint(value) {
  const raw = text(value);
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.hash) return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

export function normalizeVehicleSearchHost(value) {
  const raw = text(value).replace(/^\[|\]$/g, "");
  if (!raw || raw.includes("/") || raw.includes("?") || raw.includes("#") || raw.includes("@") || raw.includes("://")) return "";
  try {
    const parsed = new URL(`http://${raw}`);
    if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) return "";
    return parsed.hostname.replace(/^\[|\]$/g, "");
  } catch {
    return "";
  }
}

export function normalizeVehicleSearchPort(value, fallback = null) {
  const raw = text(value);
  if (!raw) return fallback === null || fallback === undefined ? null : normalizeVehicleSearchPort(fallback);
  if (!/^\d{1,5}$/.test(raw)) return null;
  const port = Number(raw);
  return port >= 1 && port <= 65535 ? port : null;
}

export function isOriginEndpoint(value) {
  const normalized = normalizeVehicleSearchEndpoint(value);
  if (!normalized) return false;
  try {
    const parsed = new URL(normalized);
    return parsed.pathname === "/" && !parsed.search;
  } catch {
    return false;
  }
}

function defaultPortForProtocol(protocol = "http:") {
  return protocol === "https:" ? 443 : 80;
}

function parseVehicleSearchOrigin(value) {
  const normalized = normalizeVehicleSearchEndpoint(value);
  if (!normalized) return null;
  try {
    const parsed = new URL(normalized);
    return {
      protocol: parsed.protocol,
      host: parsed.hostname.replace(/^\[|\]$/g, ""),
      port: normalizeVehicleSearchPort(parsed.port, defaultPortForProtocol(parsed.protocol)),
      origin: normalizeVehicleSearchBaseUrl(parsed.origin),
    };
  } catch {
    return null;
  }
}

function endpointTargetOrigin(value) {
  const normalized = normalizeVehicleSearchEndpoint(value);
  if (!normalized) return null;
  try {
    const parsed = new URL(normalized);
    const target = parsed.searchParams.get("target");
    return target ? parseVehicleSearchOrigin(target) : null;
  } catch {
    return null;
  }
}

function endpointPath(value) {
  const normalized = normalizeVehicleSearchEndpoint(value);
  if (!normalized) return "";
  try {
    const parsed = new URL(normalized);
    const target = parsed.searchParams.get("target");
    return target ? new URL(target).pathname : parsed.pathname;
  } catch {
    return "";
  }
}

function inferVehicleApiProfile(value) {
  return endpointPath(value).startsWith("/api/v2/vehicles/")
    ? VEHICLE_API_PROFILES.IMPS_V2
    : VEHICLE_API_PROFILES.LEGACY_V1;
}

function originFromParts({ protocol = "http:", host = "", port = null } = {}) {
  const normalizedHost = normalizeVehicleSearchHost(host);
  const normalizedPort = normalizeVehicleSearchPort(port);
  if (!normalizedHost || !normalizedPort) return "";
  const displayHost = normalizedHost.includes(":") && !normalizedHost.startsWith("[") ? `[${normalizedHost}]` : normalizedHost;
  return normalizeVehicleSearchBaseUrl(`${protocol}//${displayHost}:${normalizedPort}`);
}

function hasVehicleSearchConnectionFields(source) {
  return ["connectionMode", "stationProtocol", "stationHost", "stationPort", "proxyProtocol", "proxyHost", "proxyPort"]
    .some((key) => Object.prototype.hasOwnProperty.call(source, key));
}

function deriveVehicleSearchDefaultPort(fallbackBaseUrl) {
  const configured = normalizeVehicleSearchPort(BUILD_ENV.VITE_VEHICLE_SEARCH_DEFAULT_PORT);
  if (configured) return configured;
  const parsed = parseVehicleSearchOrigin(fallbackBaseUrl || VEHICLE_SEARCH_DEFAULT_BASE_URL);
  return parsed?.port || 3005;
}

export function buildVehicleSearchConnection(value = {}, { fallbackBaseUrl = VEHICLE_SEARCH_DEFAULT_BASE_URL } = {}) {
  const source = value && typeof value === "object" ? value : {};
  const hasExplicitBaseUrl = Object.prototype.hasOwnProperty.call(source, "baseUrl");
  const rawBaseUrl = hasExplicitBaseUrl ? source.baseUrl : fallbackBaseUrl;
  const rawSearchUrl = Object.prototype.hasOwnProperty.call(source, "searchUrl") ? source.searchUrl : "";
  const legacyEndpoint = normalizeVehicleSearchEndpoint(rawSearchUrl || rawBaseUrl);
  const targetOrigin = endpointTargetOrigin(legacyEndpoint);
  const endpointOrigin = parseVehicleSearchOrigin(legacyEndpoint);
  const fallbackOrigin = parseVehicleSearchOrigin(fallbackBaseUrl || VEHICLE_SEARCH_DEFAULT_BASE_URL);
  const mode = VEHICLE_CONNECTION_MODE_VALUES.has(source.connectionMode)
    ? source.connectionMode
    : targetOrigin
      ? VEHICLE_CONNECTION_MODES.PROXY
      : VEHICLE_CONNECTION_MODES.DIRECT;
  const hasStructuredFields = hasVehicleSearchConnectionFields(source);
  const apiProfile = isVehicleApiProfile(source.apiProfile) ? source.apiProfile : inferVehicleApiProfile(legacyEndpoint);
  const stationOrigin = targetOrigin || parseVehicleSearchOrigin(rawBaseUrl) || fallbackOrigin;
  const stationProtocol = text(source.stationProtocol) === "https:" || text(source.stationProtocol) === "https" ? "https:" : stationOrigin?.protocol || "http:";
  const stationHost = normalizeVehicleSearchHost(source.stationHost) || stationOrigin?.host || "";
  const stationPort = normalizeVehicleSearchPort(source.stationPort, stationOrigin?.port || deriveVehicleSearchDefaultPort(fallbackBaseUrl));
  const stationBaseUrl = originFromParts({ protocol: stationProtocol, host: stationHost, port: stationPort });
  const proxyDefaultOrigin = parseVehicleSearchOrigin(VEHICLE_SEARCH_DEFAULT_PROXY_BASE_URL);
  const legacyProxyOrigin = targetOrigin ? endpointOrigin : null;
  const proxyProtocol = text(source.proxyProtocol) === "https:" || text(source.proxyProtocol) === "https" ? "https:" : legacyProxyOrigin?.protocol || proxyDefaultOrigin?.protocol || "http:";
  const proxyHost = normalizeVehicleSearchHost(source.proxyHost) || legacyProxyOrigin?.host || proxyDefaultOrigin?.host || "";
  const proxyPort = normalizeVehicleSearchPort(source.proxyPort, legacyProxyOrigin?.port || proxyDefaultOrigin?.port || null);
  const proxyBaseUrl = originFromParts({ protocol: proxyProtocol, host: proxyHost, port: proxyPort });
  const directSearchUrl = stationBaseUrl ? `${stationBaseUrl}${getVehicleApiAdapter(apiProfile).searchPath}` : "";
  const generatedSearchUrl = mode === VEHICLE_CONNECTION_MODES.PROXY && proxyBaseUrl && stationBaseUrl
    ? `${proxyBaseUrl}/api?target=${stationBaseUrl}${getVehicleApiAdapter(apiProfile).searchPath}`
    : "";
  const legacySearchUrl = legacyEndpoint && !isOriginEndpoint(legacyEndpoint) ? legacyEndpoint : "";
  const searchUrl = hasStructuredFields
    ? (mode === VEHICLE_CONNECTION_MODES.PROXY ? generatedSearchUrl : directSearchUrl)
    : legacySearchUrl;
  const ready = Boolean(stationBaseUrl) && (mode !== VEHICLE_CONNECTION_MODES.PROXY || Boolean(searchUrl));
  return {
    mode,
    apiProfile,
    stationProtocol,
    stationHost,
    stationPort,
    proxyProtocol,
    proxyHost,
    proxyPort,
    baseUrl: stationBaseUrl,
    searchUrl,
    ready,
    error: !stationHost
      ? "กรุณาระบุ IP หรือ Host ของสถานี"
      : !stationPort
        ? "Port ของสถานีต้องอยู่ระหว่าง 1 ถึง 65535"
        : mode === VEHICLE_CONNECTION_MODES.PROXY && !proxyBaseUrl
          ? "กรุณาระบุ IP และ Port ของ Proxy"
          : "",
  };
}

export function parseVehicleSearchUrl(value, { fallbackBaseUrl = "" } = {}) {
  const raw = text(value);
  if (!raw) return { valid: false, error: "กรุณาวาง URL ของ Vehicle API" };
  const normalized = normalizeVehicleSearchEndpoint(raw);
  if (!normalized) return { valid: false, error: "รูปแบบ URL ไม่ถูกต้อง ต้องขึ้นต้นด้วย http:// หรือ https://" };
  const connection = buildVehicleSearchConnection({ baseUrl: normalized }, { fallbackBaseUrl });
  return { ...connection, sourceUrl: normalized, valid: connection.ready };
}

export function createVehicleSearchConfig(value = {}, fallbackBaseUrl = VEHICLE_SEARCH_DEFAULT_BASE_URL) {
  const source = value && typeof value === "object" ? value : {};
  const connection = buildVehicleSearchConnection(source, { fallbackBaseUrl });
  const rawStatus = text(source.connectionStatus);
  const connectionStatus = !connection.ready
    ? VEHICLE_SEARCH_CONNECTION_STATUS.NOT_CONFIGURED
    : VEHICLE_SEARCH_CONNECTION_STATUS_VALUES.has(rawStatus) && rawStatus !== VEHICLE_SEARCH_CONNECTION_STATUS.NOT_CONFIGURED
      ? rawStatus
      : VEHICLE_SEARCH_CONNECTION_STATUS.UNTESTED;
  const config = {
    baseUrl: connection.baseUrl,
    apiProfile: connection.apiProfile,
    connectionMode: connection.mode,
    stationProtocol: connection.stationProtocol,
    stationHost: connection.stationHost || null,
    stationPort: connection.stationPort,
    proxyProtocol: connection.proxyProtocol,
    proxyHost: connection.proxyHost || null,
    proxyPort: connection.proxyPort,
    connectionStatus,
    lastTestedAt: text(source.lastTestedAt) || null,
    stationId: text(source.stationId) || null,
    stationName: text(source.stationName) || null,
  };
  if (connection.searchUrl) config.searchUrl = connection.searchUrl;
  return config;
}
