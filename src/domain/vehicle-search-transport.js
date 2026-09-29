import { getVehicleApiAdapter, VEHICLE_API_PROFILES } from "./vehicle-api-profiles.js";
import {
  isOriginEndpoint,
  normalizeVehicleSearchBaseUrl,
  normalizeVehicleSearchEndpoint,
  VEHICLE_SEARCH_DEFAULT_BASE_URL,
  VEHICLE_SEARCH_ENFORCE_STATION_TARGET,
} from "./vehicle-search-config.js";
import { vehicleRecordsFromPayload } from "./vehicle-search-response.js";

function text(value) {
  return String(value ?? "").trim();
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function buildVehicleSearchDirectEndpoint(baseUrl, apiProfile, searchUrl = "") {
  const normalizedSearchUrl = normalizeVehicleSearchEndpoint(searchUrl);
  if (normalizedSearchUrl && !isOriginEndpoint(normalizedSearchUrl)) return normalizedSearchUrl;
  const normalizedBaseUrl = normalizeVehicleSearchBaseUrl(baseUrl);
  return normalizedBaseUrl ? `${normalizedBaseUrl}${getVehicleApiAdapter(apiProfile).searchPath}` : "";
}

export class VehicleSearchError extends Error {
  constructor(message, { status = 0, cause = null } = {}) {
    super(message);
    this.name = "VehicleSearchError";
    this.status = status;
    this.cause = cause;
  }
}
  
  export function createVehicleSearchTransport({
    buildVehicleSearchPayload,
    normalizeVehicleSearchCriteria,
    normalizeVehicleSearchRows,
    defaultPage,
    defaultPageSize,
    defaultEndpoint,
  }) {
  async function responseJson(response) {
    const raw = await response.text();
    if (!raw.trim()) return {};
    try {
      return JSON.parse(raw);
    } catch (error) {
      throw new VehicleSearchError("API ตอบกลับไม่ใช่ JSON", { status: response.status, cause: error });
    }
  }
  
  async function requestVehicleSearch(fetchImpl, {
    baseUrl,
    apiProfile = VEHICLE_API_PROFILES.LEGACY_V1,
    searchUrl = "",
    endpoint,
    payload,
    signal,
    transport = "proxy",
    stationTargetId = "",
  }) {
    const normalizedBaseUrl = normalizeVehicleSearchBaseUrl(baseUrl);
    const directEndpoint = buildVehicleSearchDirectEndpoint(normalizedBaseUrl, apiProfile, searchUrl);
    const proxyBody = apiProfile === VEHICLE_API_PROFILES.LEGACY_V1
      ? { baseUrl: normalizedBaseUrl, ...(stationTargetId ? { stationId: stationTargetId } : {}), payload }
      : { baseUrl: normalizedBaseUrl, ...(stationTargetId ? { stationId: stationTargetId } : {}), apiProfile, payload };
    const candidates = transport === "direct-first"
      ? [
        { endpoint: directEndpoint, body: payload, mode: "direct" },
        { endpoint, body: proxyBody, mode: "proxy" },
      ]
      : [{ endpoint, body: proxyBody, mode: "proxy" }];
    let lastError;
    for (const candidate of candidates) {
      try {
        const response = await fetchImpl(candidate.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(candidate.body),
          signal,
        });
        return { response, mode: candidate.mode };
      } catch (error) {
        if (error?.name === "AbortError") throw error;
        lastError = error;
      }
    }
    throw lastError || new Error("Vehicle search request failed");
  }
  
  async function searchVehicles(criteria, {
    fetchImpl = globalThis.fetch,
    endpoint = defaultEndpoint,
    baseUrl,
    searchUrl = "",
    apiProfile = VEHICLE_API_PROFILES.LEGACY_V1,
    resultPath,
    plateKeys,
    expectedStationId,
    expectedStationName,
    stationProfileId,
    signal,
    transport = "proxy",
  } = {}) {
    if (typeof fetchImpl !== "function") throw new VehicleSearchError("เบราว์เซอร์นี้ไม่รองรับการเรียก API");
    const normalizedCriteria = normalizeVehicleSearchCriteria(criteria);
    const normalizedBaseUrl = normalizeVehicleSearchBaseUrl(baseUrl);
    const normalizedSearchUrl = normalizeVehicleSearchEndpoint(searchUrl);
    if (!normalizedBaseUrl) throw new VehicleSearchError("ยังไม่ได้ตั้งค่า Base URL ของ API ป้ายทะเบียนประจำสถานี");
    const allRows = [];
    let pagination = { totalItems: 0, totalPages: 0, pageSize: defaultPageSize };
    let sourceStation = null;
    let page = defaultPage;
    do {
      let response;
      let responseMode = "proxy";
      try {
        const result = await requestVehicleSearch(fetchImpl, { baseUrl: normalizedBaseUrl, apiProfile, searchUrl: normalizedSearchUrl, endpoint, payload: buildVehicleSearchPayload(normalizedCriteria, { page, apiProfile }), signal, transport: VEHICLE_SEARCH_ENFORCE_STATION_TARGET ? "proxy" : transport, stationTargetId: stationProfileId || expectedStationId });
        response = result.response;
        responseMode = result.mode;
      } catch (error) {
        if (error?.name === "AbortError") throw error;
        throw new VehicleSearchError(`เชื่อมต่อ API ค้นหาป้ายทะเบียนไม่สำเร็จ (หน้า ${page})`, { cause: error });
      }
      const payload = await responseJson(response);
      if (!response.ok) throw new VehicleSearchError(text(payload?.message || payload?.error) || `API ตอบกลับสถานะ ${response.status}`, { status: response.status });
      const recordCount = vehicleRecordsFromPayload(payload, resultPath).length;
      const rows = normalizeVehicleSearchRows(payload, { resultPath, plateKeys, baseUrl: normalizedBaseUrl, apiProfile, directImages: responseMode === "direct" && !normalizedSearchUrl, searchUrl: normalizedSearchUrl, stationProfileId });
      if (recordCount > 0 && rows.length === 0) throw new VehicleSearchError("API ไม่พบฟิลด์ป้ายทะเบียนในผลลัพธ์", { status: response.status });
      allRows.push(...rows);
      rows.forEach((row) => {
        const station = row.stationId || row.stationName ? { id: row.stationId, name: row.stationName } : null;
        if (!station) return;
        if (!sourceStation) sourceStation = station;
        else if ((station.id && sourceStation.id && station.id !== sourceStation.id) || (station.name && sourceStation.name && station.name !== sourceStation.name)) {
          throw new VehicleSearchError("API ตอบข้อมูลปะปนจากมากกว่าหนึ่งสถานี");
        }
        if (expectedStationId && station.id && text(expectedStationId) !== station.id) throw new VehicleSearchError(`API ตอบกลับ stationID ${station.id} ไม่ตรงกับสถานีที่ตั้งค่าไว้ ${expectedStationId}`);
        if (expectedStationName && station.name && text(expectedStationName) !== station.name) throw new VehicleSearchError("API ตอบกลับชื่อสถานีไม่ตรงกับสถานีที่ตั้งค่าไว้");
      });
      const apiPagination = payload?.pagination || {};
      const totalItems = numberOrNull(apiPagination.totalItems ?? apiPagination.totalRecords ?? payload?.totalItems ?? payload?.totalRecords);
      const totalPages = numberOrNull(apiPagination.totalPages ?? payload?.totalPages);
      const pageSizeValue = numberOrNull(apiPagination.pageSize ?? payload?.pageSize);
      pagination = { totalItems: totalItems === null ? allRows.length : totalItems, totalPages: totalPages === null ? (rows.length ? page : 1) : totalPages, pageSize: pageSizeValue || defaultPageSize };
      page += 1;
    } while (page <= pagination.totalPages);
    return {
      criteria: normalizedCriteria,
      apiProfile,
      fetchedAt: new Date().toISOString(),
      pagination,
      sourceStation,
      rows: allRows,
    };
  }
  
  async function testVehicleSearchConnection(baseUrl, {
    fetchImpl = globalThis.fetch,
    endpoint = defaultEndpoint,
    searchUrl = "",
    apiProfile = VEHICLE_API_PROFILES.LEGACY_V1,
    signal,
    date = new Date().toISOString().slice(0, 10),
    stationProfileId = "",
    transport = "proxy",
  } = {}) {
    if (typeof fetchImpl !== "function") throw new VehicleSearchError("เบราว์เซอร์นี้ไม่รองรับการเรียก API");
    const normalizedBaseUrl = normalizeVehicleSearchBaseUrl(baseUrl);
    const normalizedSearchUrl = normalizeVehicleSearchEndpoint(searchUrl);
    if (!normalizedBaseUrl) throw new VehicleSearchError("กรุณาระบุ Base URL ของ API ป้ายทะเบียนให้ถูกต้อง");
    let response;
    try {
      response = (await requestVehicleSearch(fetchImpl, {
        baseUrl: normalizedBaseUrl,
        apiProfile,
        searchUrl: normalizedSearchUrl,
        endpoint,
        payload: buildVehicleSearchPayload({ dateFrom: date, dateTo: date }, { apiProfile }),
        signal,
        transport,
        stationTargetId: stationProfileId,
      })).response;
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      throw new VehicleSearchError("เชื่อมต่อ API ค้นหาป้ายทะเบียนไม่สำเร็จ", { cause: error });
    }
    const payload = await responseJson(response);
    if (!response.ok) {
      const message = text(payload?.message || payload?.error) || `API ตอบกลับสถานะ ${response.status}`;
      throw new VehicleSearchError(message, { status: response.status });
    }
    const firstRow = normalizeVehicleSearchRows(payload, { baseUrl: normalizedBaseUrl, apiProfile, directImages: !normalizedSearchUrl || isOriginEndpoint(normalizedSearchUrl) })[0];
    return {
      status: response.status,
      testedAt: new Date().toISOString(),
      sourceStation: firstRow ? { id: firstRow.stationId, name: firstRow.stationName } : null,
    };
  }
  
  return { searchVehicles, testVehicleSearchConnection };
}
