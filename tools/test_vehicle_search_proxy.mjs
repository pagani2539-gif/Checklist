import assert from "node:assert/strict";
import http from "node:http";
import { handleVehicleSearchProxyRequest } from "../server/vehicle-search-proxy.mjs";
import { normalizeVehicleSearchBaseUrl, testVehicleSearchConnection } from "../src/domain/vehicle-search.js";

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve(server.address().port);
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

const upstreamRequests = [];
const testUsers = {
  admin: { id: "admin-user", role: "admin", stationIds: [] },
  "station-a": { id: "station-a-inspector", role: "inspector", stationIds: ["station-a"] },
  "station-b": { id: "station-b-inspector", role: "inspector", stationIds: ["station-b"] },
  "station-a-viewer": { id: "station-a-viewer", role: "viewer", stationIds: ["station-a"] },
  "unscoped-viewer": { id: "unscoped-viewer", role: "viewer", stationIds: [] },
  contractor: { id: "contractor", role: "contractor", stationIds: ["station-a"] },
};
const testAuth = {
  mode: "test",
  async authenticate(request) {
    const token = String(request.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!testUsers[token]) throw Object.assign(new Error("Authentication required"), { statusCode: 401 });
    return testUsers[token];
  },
  requireRole(user, roles) {
    if (!roles.includes(user?.role)) throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  },
};
const authHeaders = (token = "admin") => ({ Authorization: `Bearer ${token}` });

const upstream = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url || "/", "http://localhost");
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  upstreamRequests.push({ method: request.method, pathname: requestUrl.pathname, search: requestUrl.search, body: Buffer.concat(chunks).toString("utf8") });

  if (request.method === "POST" && requestUrl.pathname === "/api/vehicle/search") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ data: [{ plateNumber: "ทดสอบ-1234" }] }));
    return;
  }
  if (request.method === "GET" && requestUrl.pathname === "/api/vehicle/image") {
    response.writeHead(200, { "Content-Type": "image/jpeg" });
    response.end(Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    return;
  }
  if (request.method === "POST" && requestUrl.pathname === "/api/v2/vehicles/search") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ status: "success", pagination: { currentPage: 1, totalPages: 1, totalRecords: 1 }, data: [{ id: 99, stationID: 6, lane: 1, stamp: "2026-09-08T00:00:00+07:00", plate: { license_plate: "ทดสอบ-v2" } }] }));
    return;
  }
  if (request.method === "GET" && requestUrl.pathname === "/api/v2/vehicles/image") {
    response.writeHead(200, { "Content-Type": "image/png" });
    response.end(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    return;
  }
  response.writeHead(404);
  response.end();
});

const upstreamPort = await listen(upstream);
const baseUrl = `http://127.0.0.1:${upstreamPort}`;
const proxyRequests = [];
const secondUpstream = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url || "/", "http://localhost");
  const targetValue = requestUrl.searchParams.get("target") || "";
  let targetUrl;
  try { targetUrl = new URL(targetValue); } catch { targetUrl = null; }
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  proxyRequests.push({ method: request.method, pathname: requestUrl.pathname, target: targetValue, body: Buffer.concat(chunks).toString("utf8") });
  if (request.method === "POST" && requestUrl.pathname === "/api" && targetUrl?.pathname === "/api/vehicle/search") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ data: [{ plateNumber: "สถานี-b" }] }));
    return;
  }
  if (request.method === "GET" && requestUrl.pathname === "/api" && targetUrl?.pathname === "/api/vehicle/image") {
    response.writeHead(200, { "Content-Type": "image/jpeg" });
    response.end(Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    return;
  }
  response.writeHead(404);
  response.end();
});
const secondUpstreamPort = await listen(secondUpstream);
const proxyTargetBaseUrl = "http://192.168.145.90:3005";
const proxySearchUrl = `http://127.0.0.1:${secondUpstreamPort}/api?target=${proxyTargetBaseUrl}/api/vehicle/search`;
const proxy = http.createServer((request, response) => handleVehicleSearchProxyRequest(request, response, {
  auth: testAuth,
  enforceStationTarget: false,
  allowedOrigins: new Set([normalizeVehicleSearchBaseUrl(baseUrl)]),
}));
const proxyPort = await listen(proxy);
const proxyUrl = `http://127.0.0.1:${proxyPort}`;
const targetProxy = http.createServer((request, response) => handleVehicleSearchProxyRequest(request, response, {
  auth: testAuth,
  enforceStationScope: true,
  allowedOrigins: new Set([normalizeVehicleSearchBaseUrl(baseUrl)]),
  enforceStationTarget: true,
  stationTargets: { "station-a": baseUrl },
}));
const targetProxyPort = await listen(targetProxy);
const targetProxyUrl = `http://127.0.0.1:${targetProxyPort}`;
const persistedTargetProxy = http.createServer((request, response) => handleVehicleSearchProxyRequest(request, response, {
  auth: testAuth,
  enforceStationScope: true,
  allowedOrigins: new Set([normalizeVehicleSearchBaseUrl(baseUrl)]),
  enforceStationTarget: true,
  stationTargets: { "station-persisted": "http://127.0.0.1:9" },
  resolveStationTarget: async (stationId) => stationId === "station-persisted" ? baseUrl : "",
}));
const persistedTargetProxyPort = await listen(persistedTargetProxy);
const persistedTargetProxyUrl = `http://127.0.0.1:${persistedTargetProxyPort}`;
const dynamicProfileTargets = {
  "station-a": baseUrl,
  "station-b": { baseUrl: proxyTargetBaseUrl, connectionMode: "proxy", searchUrl: proxySearchUrl },
};
const dynamicTargetProxy = http.createServer((request, response) => handleVehicleSearchProxyRequest(request, response, {
  auth: testAuth,
  enforceStationScope: true,
  enforceStationTarget: true,
  allowedOrigins: new Set(),
  resolveStationTarget: async (stationId) => dynamicProfileTargets[stationId] || "",
}));
const dynamicTargetProxyPort = await listen(dynamicTargetProxy);
const dynamicTargetProxyUrl = `http://127.0.0.1:${dynamicTargetProxyPort}`;

try {
  const searchResponse = await fetch(`${proxyUrl}/api/vehicle/search`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ baseUrl, payload: { startDate: "2026-09-08T00:00:00+07:00", endDate: "2026-09-08T23:59:59+07:00", pageSize: 50, page: 1 } }),
  });
  assert.equal(searchResponse.status, 200);
  assert.deepEqual(await searchResponse.json(), { data: [{ plateNumber: "ทดสอบ-1234" }] });
  assert.deepEqual(JSON.parse(upstreamRequests.at(-1).body), { startDate: "2026-09-08T00:00:00+07:00", endDate: "2026-09-08T23:59:59+07:00", pageSize: 50, page: 1 });

  const imageResponse = await fetch(`${proxyUrl}/api/vehicle/image?baseUrl=${encodeURIComponent(baseUrl)}&path=${encodeURIComponent("crop/test.jpg")}`, { headers: authHeaders() });
  assert.equal(imageResponse.status, 200);
  assert.equal(imageResponse.headers.get("content-type"), "image/jpeg");
  assert.deepEqual([...new Uint8Array(await imageResponse.arrayBuffer())], [0xff, 0xd8, 0xff, 0xd9]);
  assert.equal(upstreamRequests.at(-1).search, "?path=crop%2Ftest.jpg");

  const overviewResponse = await fetch(`${proxyUrl}/api/vehicle/image?baseUrl=${encodeURIComponent(baseUrl)}&path=${encodeURIComponent("overview/2026/09/08/vehicle_1.jpg")}`, { headers: authHeaders() });
  assert.equal(overviewResponse.status, 200);
  assert.equal(overviewResponse.headers.get("content-type"), "image/jpeg");
  assert.equal(upstreamRequests.at(-1).search, "?path=overview%2F2026%2F09%2F08%2Fvehicle_1.jpg");

  const v2SearchResponse = await fetch(`${proxyUrl}/api/vehicle/search`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ baseUrl, apiProfile: "imps-v2", payload: { startDateTime: "2026-09-08T00:00:00+07:00", endDateTime: "2026-09-08T23:59:59+07:00", pageSize: 200, page: 1 } }),
  });
  assert.equal(v2SearchResponse.status, 200);
  assert.equal((await v2SearchResponse.json()).data[0].plate.license_plate, "ทดสอบ-v2");
  assert.equal(upstreamRequests.at(-1).pathname, "/api/v2/vehicles/search");
  assert.deepEqual(JSON.parse(upstreamRequests.at(-1).body), { startDateTime: "2026-09-08T00:00:00+07:00", endDateTime: "2026-09-08T23:59:59+07:00", pageSize: 200, page: 1 });

  const v2ImageResponse = await fetch(`${proxyUrl}/api/vehicle/image?baseUrl=${encodeURIComponent(baseUrl)}&apiProfile=imps-v2&path=${encodeURIComponent("lpr/test.png")}`, { headers: authHeaders() });
  assert.equal(v2ImageResponse.status, 200);
  assert.equal(v2ImageResponse.headers.get("content-type"), "image/png");
  assert.equal(upstreamRequests.at(-1).pathname, "/api/v2/vehicles/image");
  assert.equal(upstreamRequests.at(-1).search, "?path=lpr%2Ftest.png");

  const rejectedOriginResponse = await fetch(`${proxyUrl}/api/vehicle/search`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ baseUrl: "http://127.0.0.1:9", payload: {} }),
  });
  assert.equal(rejectedOriginResponse.status, 400);
  assert.match(await rejectedOriginResponse.text(), /allowlist/);

  const rejectedImageResponse = await fetch(`${proxyUrl}/api/vehicle/image?baseUrl=${encodeURIComponent(baseUrl)}&path=${encodeURIComponent("crop/../secret.jpg")}`, { headers: authHeaders() });
  assert.equal(rejectedImageResponse.status, 400);
  assert.match(await rejectedImageResponse.text(), /เส้นทางภาพ/);

  const rejectedOverviewResponse = await fetch(`${proxyUrl}/api/vehicle/image?baseUrl=${encodeURIComponent(baseUrl)}&path=${encodeURIComponent("overview/../secret.jpg")}`, { headers: authHeaders() });
  assert.equal(rejectedOverviewResponse.status, 400);

  const stationTargetResponse = await fetch(`${targetProxyUrl}/api/vehicle/search`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ stationId: "station-a", baseUrl: "http://127.0.0.1:9", payload: { page: 1 } }),
  });
  assert.equal(stationTargetResponse.status, 200);
  const unknownStationResponse = await fetch(`${targetProxyUrl}/api/vehicle/search`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ stationId: "station-b", baseUrl, payload: { page: 1 } }),
  });
  assert.equal(unknownStationResponse.status, 400);

  const persistedStationTargetResponse = await fetch(`${persistedTargetProxyUrl}/api/vehicle/search`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ stationId: "station-persisted", baseUrl: "http://127.0.0.1:9", payload: { page: 1 } }),
  });
  assert.equal(persistedStationTargetResponse.status, 200, "the proxy should resolve a saved station target instead of trusting the client URL");

  for (const [stationId, expectedPlate] of [["station-a", "ทดสอบ-1234"], ["station-b", "สถานี-b"]]) {
    const dynamicTargetResponse = await fetch(`${dynamicTargetProxyUrl}/api/vehicle/search`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ stationId, baseUrl: "http://127.0.0.1:9", payload: { page: 1 } }),
    });
    assert.equal(dynamicTargetResponse.status, 200, `${stationId} should use its saved Station Profile target without an environment allowlist`);
    assert.equal((await dynamicTargetResponse.json()).data[0].plateNumber, expectedPlate);
  }
  const dynamicImageResponse = await fetch(`${dynamicTargetProxyUrl}/api/vehicle/image?stationId=station-b&path=crop/station-b.jpg`, { headers: authHeaders() });
  assert.equal(dynamicImageResponse.status, 200, "images should use the saved Station Profile target without an environment allowlist");
  assert.equal(new URL(proxyRequests.at(-1).target).pathname, "/api/vehicle/image");
  assert.equal(new URL(proxyRequests.at(-1).target).searchParams.get("path"), "crop/station-b.jpg");
  assert.deepEqual(JSON.parse(proxyRequests.find((entry) => entry.method === "POST").body), { page: 1 }, "the external proxy should receive the Vehicle API payload, not app routing metadata");

  const draftConnectionTest = await testVehicleSearchConnection(baseUrl, {
    fetchImpl: (endpoint, options) => fetch(new URL(endpoint, dynamicTargetProxyUrl), {
      ...options,
      headers: { ...options.headers, ...authHeaders() },
    }),
    stationProfileId: "new-station-draft",
    transport: "proxy",
  });
  assert.equal(draftConnectionTest.status, 200, "an authorized profile editor should be able to test the unsaved URL through the proxy");
  const draftProxyConnectionTest = await testVehicleSearchConnection(proxyTargetBaseUrl, {
    fetchImpl: (endpoint, options) => fetch(new URL(endpoint, dynamicTargetProxyUrl), {
      ...options,
      headers: { ...options.headers, ...authHeaders() },
    }),
    searchUrl: proxySearchUrl,
    stationProfileId: "new-proxy-station-draft",
    transport: "proxy",
  });
  assert.equal(draftProxyConnectionTest.status, 200, "an authorized profile editor should be able to test an unsaved Proxy URL through the app proxy");
  const deniedDraftConnectionTest = await fetch(`${dynamicTargetProxyUrl}/api/vehicle/search`, {
    method: "POST",
    headers: { ...authHeaders("station-a-viewer"), "Content-Type": "application/json" },
    body: JSON.stringify({ stationId: "station-a", baseUrl, connectionTest: true, payload: { page: 1 } }),
  });
  assert.equal(deniedDraftConnectionTest.status, 403, "a station viewer must not test an unpersisted Vehicle API target");

  const beforeRejectedRequests = upstreamRequests.length;
  const unauthenticatedSearchResponse = await fetch(`${targetProxyUrl}/api/vehicle/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stationId: "station-a", baseUrl, payload: { page: 1 } }),
  });
  assert.equal(unauthenticatedSearchResponse.status, 401);
  const unauthenticatedImageResponse = await fetch(`${targetProxyUrl}/api/vehicle/image?stationId=station-a&path=crop/test.jpg`);
  assert.equal(unauthenticatedImageResponse.status, 401);
  const deniedRoleResponse = await fetch(`${targetProxyUrl}/api/vehicle/search`, {
    method: "POST",
    headers: { ...authHeaders("contractor"), "Content-Type": "application/json" },
    body: JSON.stringify({ stationId: "station-a", baseUrl, payload: { page: 1 } }),
  });
  assert.equal(deniedRoleResponse.status, 403);

  const crossStationSearchResponse = await fetch(`${targetProxyUrl}/api/vehicle/search`, {
    method: "POST",
    headers: { ...authHeaders("station-b"), "Content-Type": "application/json" },
    body: JSON.stringify({ stationId: "station-a", baseUrl, payload: { page: 1 } }),
  });
  assert.equal(crossStationSearchResponse.status, 200);
  const crossStationImageResponse = await fetch(`${targetProxyUrl}/api/vehicle/image?stationId=station-a&path=crop/test.jpg`, { headers: authHeaders("station-b") });
  assert.equal(crossStationImageResponse.status, 200);

  const unscopedSearchResponse = await fetch(`${targetProxyUrl}/api/vehicle/search`, {
    method: "POST",
    headers: { ...authHeaders("unscoped-viewer"), "Content-Type": "application/json" },
    body: JSON.stringify({ stationId: "station-a", baseUrl, payload: { page: 1 } }),
  });
  assert.equal(unscopedSearchResponse.status, 403);
  const missingStationImageResponse = await fetch(`${targetProxyUrl}/api/vehicle/image?path=crop/test.jpg`, { headers: authHeaders() });
  assert.equal(missingStationImageResponse.status, 400);
  assert.equal(upstreamRequests.length, beforeRejectedRequests + 2, "rejected auth/scope requests must not reach the upstream API; Inspector may access another station");

  console.log(JSON.stringify({ searchStatus: searchResponse.status, imageStatus: imageResponse.status, dynamicStationTargets: 2, draftConnectionTests: 2, authzCases: 7, upstreamRequests: upstreamRequests.length }));
} finally {
  await close(proxy);
  await close(targetProxy);
  await close(persistedTargetProxy);
  await close(dynamicTargetProxy);
  await close(upstream);
  await close(secondUpstream);
}
