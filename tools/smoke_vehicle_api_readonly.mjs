import {
  getVehicleApiAdapter,
  normalizeVehicleSearchBaseUrl,
  searchVehicles,
  VEHICLE_API_PROFILES,
} from "../src/domain/vehicle-search.js";

const PAGE_SIZE = 200;
const MAX_PAGES = 5;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const SAFE_IMAGE_PATH = /^(?:crop|lpr|overview)\/[A-Za-z0-9][A-Za-z0-9._~!$&'()*+,;=@%/-]*$/;
const REQUIRED_TEXT_FIELDS = ["plateNumber", "occurredAt", "stationId", "lane", "vehicleClassId"];
const OPTIONAL_FIELDS = [
  "province", "vehicleClassLabel", "vehicleDescription", "axleCount", "axles", "axlesAfterAllowance",
  "grossWeight", "grossWeightLimit", "leftWeight", "rightWeight", "speed", "length", "esal",
  "isOverweight", "overweightPercentage", "errorFlags", "warningFlags",
];

class SmokeFailure extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function fail(code) {
  throw new SmokeFailure(code);
}

function requiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) fail(`missing_${name.toLowerCase()}`);
  return value;
}

function parseDateRange() {
  const start = requiredEnv("CHECKLIST_VEHICLE_TEST_START");
  const end = requiredEnv("CHECKLIST_VEHICLE_TEST_END");
  const explicitBangkokOffset = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+07:00$/;
  if (!explicitBangkokOffset.test(start) || !explicitBangkokOffset.test(end)) fail("dates_must_include_bangkok_offset");
  const duration = Date.parse(end) - Date.parse(start);
  if (!Number.isFinite(duration) || duration <= 0 || duration > 60 * 60 * 1000) fail("date_range_must_be_1_to_60_minutes");
  return { startAt: start.slice(0, 16), endAt: end.slice(0, 16) };
}

function parseBaseUrl(value, code) {
  const normalized = normalizeVehicleSearchBaseUrl(value);
  if (!normalized) fail(code);
  return normalized;
}

function timeoutSignal() {
  return AbortSignal.timeout(20_000);
}

async function fetchJson(url, { token, method = "GET", body } = {}) {
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...checklistAuthHeaders(token),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: timeoutSignal(),
    });
  } catch {
    fail("checklist_or_vehicle_api_unreachable");
  }
  if (!response.ok) fail(`http_${response.status}`);
  try {
    return await response.json();
  } catch {
    fail("invalid_json_response");
  }
}

function checklistAuthHeaders(auth) {
  if (auth?.cookie) return { Cookie: auth.cookie };
  if (auth?.bearer) return { Authorization: `Bearer ${auth.bearer}` };
  return {};
}

async function checklistLogin(checklistBase) {
  const oidcBearer = String(process.env.CHECKLIST_VEHICLE_TEST_BEARER || "").trim();
  if (oidcBearer) return { bearer: oidcBearer };
  const username = requiredEnv("CHECKLIST_VEHICLE_TEST_USERNAME");
  const password = requiredEnv("CHECKLIST_VEHICLE_TEST_PASSWORD");
  let response;
  try {
    response = await fetch(new URL("/api/v1/auth/login", checklistBase), {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      signal: timeoutSignal(),
    });
  } catch {
    fail("checklist_login_unreachable");
  }
  if (!response.ok) fail(`checklist_login_http_${response.status}`);
  const cookie = String(response.headers.get("set-cookie") || "").split(";", 1)[0];
  if (!cookie.startsWith("checklist_session=")) fail("checklist_login_cookie_missing");
  return { cookie };
}

function numericOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function paginationFrom(payload) {
  const source = payload?.pagination || {};
  return {
    totalItems: numericOrNull(source.totalItems ?? source.totalRecords ?? payload?.totalItems ?? payload?.totalRecords),
    totalPages: numericOrNull(source.totalPages ?? payload?.totalPages),
    pageSize: numericOrNull(source.pageSize ?? payload?.pageSize),
  };
}

function captureFetch(actualFetch, trace, { mode, expectedUrl, stationId, apiProfile, token = null }) {
  return async (url, init = {}) => {
    const requestedUrl = String(url);
    if (requestedUrl !== expectedUrl) fail(`${mode}_unexpected_fallback`);
    const requestBody = JSON.parse(String(init.body || "{}"));
    const page = Number(requestBody.payload?.page ?? requestBody.page ?? 1);
    if (!Number.isInteger(page) || page < 1 || page > MAX_PAGES) fail("too_many_pages_for_readonly_smoke");

    const headers = new Headers(init.headers || {});
    for (const [name, value] of Object.entries(checklistAuthHeaders(token))) headers.set(name, value);
    let body = init.body;
    if (mode === "proxy") {
      body = JSON.stringify({
        ...requestBody,
        stationId,
        ...(apiProfile === VEHICLE_API_PROFILES.LEGACY_V1 ? {} : { apiProfile }),
      });
    }

    let response;
    try {
      response = await actualFetch(requestedUrl, { ...init, headers, body, signal: timeoutSignal() });
    } catch {
      fail(`${mode}_request_failed`);
    }
    let payload = null;
    try {
      payload = await response.clone().json();
    } catch {
      fail(`${mode}_invalid_json`);
    }
    trace.push({ page, status: response.status, ...paginationFrom(payload) });
    return response;
  };
}

function isMissing(value) {
  return value === null || value === undefined || value === "" || value === "ไม่พบผลอ่านป้าย" || value === "ไม่ระบุประเภทรถ";
}

function coverageFor(rows) {
  const counts = Object.fromEntries([...REQUIRED_TEXT_FIELDS, "axleCount", "grossWeight", "grossWeightLimit", "imageReference"].map((key) => [key, 0]));
  const optional = Object.fromEntries(OPTIONAL_FIELDS.map((key) => [key, 0]));
  let integrityWarningRows = 0;

  for (const row of rows) {
    for (const key of REQUIRED_TEXT_FIELDS) if (!isMissing(row[key])) counts[key] += 1;
    for (const key of ["axleCount", "grossWeight", "grossWeightLimit"]) if (row[key] !== null && row[key] !== undefined) counts[key] += 1;
    if (imagePath(row.plateImage) || imagePath(row.overviewImage)) counts.imageReference += 1;
    for (const key of OPTIONAL_FIELDS) {
      const value = row[key];
      if (Array.isArray(value) ? value.length > 0 : !isMissing(value)) optional[key] += 1;
    }
    if (Array.isArray(row.integrityWarnings) && row.integrityWarnings.length) integrityWarningRows += 1;
  }
  const percent = (count) => rows.length ? Math.round((count / rows.length) * 100) : 0;
  return {
    required: Object.fromEntries(Object.entries(counts).map(([key, count]) => [key, { count, percent: percent(count) }])),
    optional: Object.fromEntries(Object.entries(optional).map(([key, count]) => [key, { count, percent: percent(count) }])),
    integrityWarningRows,
  };
}

function rowSignature(row) {
  return JSON.stringify({
    stationId: row.stationId,
    stationName: row.stationName,
    vehicleId: row.vehicleId,
    occurredAt: row.occurredAt,
    lane: row.lane,
    vehicleClassId: row.vehicleClassId,
    vehicleClassLabel: row.vehicleClassLabel,
    vehicleDescription: row.vehicleDescription,
    vehicleClassDisplayId: row.vehicleClassDisplayId,
    axleCount: row.axleCount,
    axles: row.axles,
    axlesAfterAllowance: row.axlesAfterAllowance,
    grossWeight: row.grossWeight,
    grossWeightLimit: row.grossWeightLimit,
    leftWeight: row.leftWeight,
    rightWeight: row.rightWeight,
    speed: row.speed,
    length: row.length,
    esal: row.esal,
    isOverweight: row.isOverweight,
    overweightPercentage: row.overweightPercentage,
    errorFlags: row.errorFlags,
    warningFlags: row.warningFlags,
    plateNumber: row.plateNumber,
    province: row.province,
    plateImagePath: imagePath(row.plateImage),
    overviewImagePath: imagePath(row.overviewImage),
  });
}

function imagePath(value) {
  if (!value) return "";
  try {
    const parsed = new URL(value, process.env.CHECKLIST_API_BASE_URL);
    const path = parsed.searchParams.get("path") || "";
    return SAFE_IMAGE_PATH.test(path) && !path.split("/").includes("..") ? path : "";
  } catch {
    return "";
  }
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean).map(String))];
}

function validateSearchResult(mode, result, trace, expectedStationId) {
  const coverage = coverageFor(result.rows);
  const declaredItems = trace.find((entry) => entry.totalItems !== null)?.totalItems ?? null;
  const declaredPages = trace.find((entry) => entry.totalPages !== null)?.totalPages ?? null;
  const pageNumbers = trace.map((entry) => entry.page).sort((a, b) => a - b);
  const stationIds = uniqueValues(result.rows.map((row) => row.stationId));
  const duplicateSignatures = new Set();
  let duplicates = 0;
  for (const row of result.rows) {
    const key = JSON.stringify([row.stationId, row.occurredAt, row.lane, row.plateNumber]);
    if (duplicateSignatures.has(key)) duplicates += 1;
    duplicateSignatures.add(key);
  }
  const expectedPages = declaredPages ?? (declaredItems !== null ? Math.ceil(declaredItems / PAGE_SIZE) : null);
  const expectedPageNumbers = expectedPages === null ? [] : Array.from({ length: expectedPages }, (_, index) => index + 1);
  const mandatoryCoverage = Object.values(coverage.required).every((entry) => entry.percent === 100);
  const paginationComplete = declaredItems !== null && expectedPages !== null
    && declaredItems === result.rows.length
    && expectedPages === trace.length
    && JSON.stringify(pageNumbers) === JSON.stringify(expectedPageNumbers);
  const stationValid = stationIds.length === 1 && (!expectedStationId || stationIds[0] === String(expectedStationId));
  const ok = result.rows.length > 0 && mandatoryCoverage && paginationComplete && stationValid && duplicates === 0;
  return {
    mode,
    ok,
    recordCount: result.rows.length,
    requestedPages: trace.length,
    pagination: { totalItems: declaredItems, totalPages: expectedPages, complete: paginationComplete },
    stationCount: stationIds.length,
    stationMatchesExpected: stationValid,
    duplicateRecords: duplicates,
    requiredCoverage: coverage.required,
    optionalCoverage: coverage.optional,
    integrityWarningRows: coverage.integrityWarningRows,
  };
}

function imageSamples(rows, pageSize, totalPages) {
  const samples = [];
  for (let page = 0; page < totalPages; page += 1) {
    const pageRows = rows.slice(page * pageSize, (page + 1) * pageSize);
    for (const property of ["plateImage", "overviewImage"]) {
      const row = pageRows.find((candidate) => imagePath(candidate[property]));
      const path = row ? imagePath(row[property]) : "";
      if (path && !samples.some((sample) => sample.page === page + 1 && sample.path === path)) {
        samples.push({ page: page + 1, path });
      }
    }
  }
  return samples;
}

async function readImage(url, auth) {
  let response;
  try {
    response = await fetch(url, { headers: { ...checklistAuthHeaders(auth), Accept: "image/*" }, signal: timeoutSignal() });
  } catch {
    return { ok: false, status: 0, type: "", bytes: 0 };
  }
  const type = String(response.headers.get("content-type") || "").split(";")[0].toLowerCase();
  if (!response.ok || !type.startsWith("image/")) {
    await response.body?.cancel().catch(() => {});
    return { ok: false, status: response.status, type, bytes: 0 };
  }
  const declaredLength = numericOrNull(response.headers.get("content-length"));
  if (declaredLength !== null && declaredLength > MAX_IMAGE_BYTES) {
    await response.body?.cancel().catch(() => {});
    return { ok: false, status: response.status, type, bytes: declaredLength };
  }
  let bytes = 0;
  try {
    for await (const chunk of response.body || []) {
      bytes += chunk.byteLength;
      if (bytes > MAX_IMAGE_BYTES) {
        await response.body?.cancel().catch(() => {});
        return { ok: false, status: response.status, type, bytes };
      }
    }
  } catch {
    return { ok: false, status: response.status, type, bytes };
  }
  return { ok: bytes > 0, status: response.status, type, bytes };
}

async function main() {
  const checklistBase = parseBaseUrl(requiredEnv("CHECKLIST_API_BASE_URL"), "invalid_checklist_base_url");
  if (new URL(checklistBase).protocol !== "https:") fail("checklist_api_must_use_https");
  const auth = await checklistLogin(checklistBase);
  const stationProfileId = requiredEnv("CHECKLIST_VEHICLE_TEST_STATION_ID");
  const criteria = parseDateRange();
  const stationUrl = new URL(`/api/v1/stations/${encodeURIComponent(stationProfileId)}`, checklistBase).toString();
  const stationResponse = await fetchJson(stationUrl, { token: auth });
  const station = stationResponse.station;
  const config = station?.vehicleSearchConfig;
  if (!station || !config) fail("station_profile_or_vehicle_config_missing");
  const stationBaseUrl = parseBaseUrl(config.baseUrl, "station_vehicle_api_target_missing");
  const apiProfile = Object.values(VEHICLE_API_PROFILES).includes(config.apiProfile) ? config.apiProfile : VEHICLE_API_PROFILES.LEGACY_V1;
  const adapter = getVehicleApiAdapter(apiProfile);
  const apiProxyEndpoint = new URL("/api/vehicle/search", checklistBase).toString();
  const expectedApiStationId = String(config.stationId || "");
  const expectedApiStationName = String(config.stationName || "");

  const directTrace = [];
  const directEndpoint = new URL(adapter.searchPath, `${stationBaseUrl}/`).toString();
  const directFetch = captureFetch(fetch, directTrace, { mode: "direct", expectedUrl: directEndpoint, stationId: stationProfileId, apiProfile });
  let directResult;
  try {
    directResult = await searchVehicles(criteria, {
      baseUrl: stationBaseUrl,
      apiProfile,
      searchUrl: "",
      endpoint: apiProxyEndpoint,
      expectedStationId: expectedApiStationId,
      expectedStationName: expectedApiStationName,
      stationProfileId,
      transport: "direct-first",
      fetchImpl: directFetch,
    });
  } catch {
    fail("direct_search_failed_or_fell_back");
  }

  const proxyTrace = [];
  const proxyFetch = captureFetch(fetch, proxyTrace, { mode: "proxy", expectedUrl: apiProxyEndpoint, stationId: stationProfileId, apiProfile, token: auth });
  let proxyResult;
  try {
    proxyResult = await searchVehicles(criteria, {
      baseUrl: stationBaseUrl,
      apiProfile,
      searchUrl: "",
      endpoint: apiProxyEndpoint,
      expectedStationId: expectedApiStationId,
      expectedStationName: expectedApiStationName,
      stationProfileId,
      transport: "proxy",
      fetchImpl: proxyFetch,
    });
  } catch {
    fail("proxy_search_failed");
  }

  const directSummary = validateSearchResult("direct", directResult, directTrace, expectedApiStationId);
  const proxySummary = validateSearchResult("proxy", proxyResult, proxyTrace, expectedApiStationId);
  const directRows = directResult.rows.map(rowSignature).sort();
  const proxyRows = proxyResult.rows.map(rowSignature).sort();
  const dataMatches = JSON.stringify(directRows) === JSON.stringify(proxyRows);

  const totalPages = Math.max(directSummary.pagination.totalPages || 0, proxySummary.pagination.totalPages || 0);
  const pageSize = Math.min(directResult.pagination.pageSize || PAGE_SIZE, proxyResult.pagination.pageSize || PAGE_SIZE);
  const samples = imageSamples(directResult.rows, pageSize, totalPages);
  const imageResults = [];
  for (const sample of samples) {
    const directUrl = new URL(adapter.imagePath, `${stationBaseUrl}/`);
    directUrl.searchParams.set("path", sample.path);
    const proxyUrl = new URL("/api/vehicle/image", checklistBase);
    proxyUrl.searchParams.set("stationId", stationProfileId);
    proxyUrl.searchParams.set("apiProfile", apiProfile);
    proxyUrl.searchParams.set("path", sample.path);
    imageResults.push({
      direct: await readImage(directUrl.toString(), null),
      proxy: await readImage(proxyUrl.toString(), auth),
    });
  }

  const imagesPass = imageResults.length > 0 && imageResults.every((result) => result.direct.ok && result.proxy.ok);
  const ok = directSummary.ok && proxySummary.ok && dataMatches && imagesPass;
  return {
    status: ok ? "PASS" : "FAIL",
    apiProfile,
    modeResults: [directSummary, proxySummary],
    normalizedRecordsMatch: dataMatches,
    imageSamples: {
      checked: imageResults.length,
      directPassed: imageResults.filter((result) => result.direct.ok).length,
      proxyPassed: imageResults.filter((result) => result.proxy.ok).length,
      results: imageResults.map((result, index) => ({
        sample: index + 1,
        direct: { status: result.direct.status, contentType: result.direct.type, bytes: result.direct.bytes, ok: result.direct.ok },
        proxy: { status: result.proxy.status, contentType: result.proxy.type, bytes: result.proxy.bytes, ok: result.proxy.ok },
      })),
    },
    persistedChecklistWrites: 0,
  };
}

main()
  .then((result) => {
    console.log(JSON.stringify(result));
    if (result.status !== "PASS") process.exitCode = 1;
  })
  .catch((error) => {
    console.error(JSON.stringify({ status: "FAIL", reason: error instanceof SmokeFailure ? error.code : "unexpected_error", persistedChecklistWrites: 0 }));
    process.exitCode = 1;
  });
