import { getInstalledVehicleSystems, getVehicleSystemConfig } from "../domain/vehicle-review-systems.js";
import { AppIcon as Icon } from "./icon-system.jsx";
import { useEffect, useRef, useState } from "react";
import { createVehicleSearchConfig, parseVehicleSearchUrl, VEHICLE_SEARCH_CONNECTION_STATUS, VEHICLE_SEARCH_PURPOSE, testVehicleSearchConnection, VEHICLE_API_PROFILE_OPTIONS, VEHICLE_CONNECTION_MODES } from "../domain/vehicle-search.js";
import { formatDateTime, StatusBadge } from "./page-runtime-components.jsx";



export const VEHICLE_CONNECTION_STATUS_META = Object.freeze({
  [VEHICLE_SEARCH_CONNECTION_STATUS.NOT_CONFIGURED]: { label: "ยังไม่ได้ตั้งค่า", tone: "waiting" },
  [VEHICLE_SEARCH_CONNECTION_STATUS.UNTESTED]: { label: "ตั้งค่าแล้ว ยังไม่ได้ทดสอบ", tone: "waiting" },
  [VEHICLE_SEARCH_CONNECTION_STATUS.CONNECTED]: { label: "เชื่อมต่อได้", tone: "normal" },
  [VEHICLE_SEARCH_CONNECTION_STATUS.FAILED]: { label: "เชื่อมต่อไม่ได้", tone: "damaged" },
});

export function VehicleSearchConfigPanel({ value, profile, ...props }) {
  const systems = profile ? getInstalledVehicleSystems(profile) : [];
  if (!profile) return <VehicleSearchConfigLeaf value={value} {...props} />;
  const saveSystemConfig = (system, config) => props.onChange({ ...value, systems: { ...value?.systems, [system.key]: { ...config, apiProfile: system.apiProfile, ...(system.key === "imps" ? { connectionMode: "proxy" } : {}) } } });
  if (!systems.length) {
    const pendingSystems = String(profile.stationFormat || "").toUpperCase() === "IMPS"
      ? [{ key: "imps", label: "IMPS", apiProfile: "imps-v2" }]
      : [
          { key: "sc-hs", label: "SC · High Speed (HS)", apiProfile: "legacy-v1" },
          { key: "sc-ls", label: "SC · Low Speed (LS)", apiProfile: "legacy-v1" },
        ];
    return <div>{pendingSystems.map(system => <section key={system.key}><h3>{system.label}</h3><VehicleSearchConfigLeaf {...props} systemKey={system.key} value={getVehicleSystemConfig(profile, system, [system])} onChange={config => saveSystemConfig(system, config)} /></section>)}</div>;
  }
  return <div>{systems.map(system => <section key={system.key}><h3>{system.label}</h3><VehicleSearchConfigLeaf {...props} systemKey={system.key} value={getVehicleSystemConfig(profile, system, systems)} onChange={config => saveSystemConfig(system, config)} /></section>)}</div>;
}

export function VehicleSearchConfigLeaf({ value, systemKey = "", stationId = "new", disabled = false, onChange, notify }) {
  const normalizedConfig = createVehicleSearchConfig(value, "");
  const [fullUrlDraft, setFullUrlDraft] = useState(() => String(normalizedConfig.searchUrl || (normalizedConfig.connectionMode === VEHICLE_CONNECTION_MODES.PROXY ? "" : normalizedConfig.baseUrl || "")));
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [stationTestNote, setStationTestNote] = useState("");
  const abortRef = useRef(null);
  const status = VEHICLE_CONNECTION_STATUS_META[normalizedConfig.connectionStatus] || VEHICLE_CONNECTION_STATUS_META[VEHICLE_SEARCH_CONNECTION_STATUS.NOT_CONFIGURED];
  const parsedDraft = parseVehicleSearchUrl(fullUrlDraft, { fallbackBaseUrl: "" });
  const summaryMode = systemKey === "imps" ? VEHICLE_CONNECTION_MODES.PROXY : parsedDraft.valid ? parsedDraft.mode : normalizedConfig.connectionMode;
  const summaryProfile = systemKey ? systemKey === "imps" ? "imps-v2" : "legacy-v1" : parsedDraft.valid ? parsedDraft.apiProfile : normalizedConfig.apiProfile;
  const summaryStationHost = parsedDraft.valid ? parsedDraft.stationHost : normalizedConfig.stationHost;
  const summaryStationPort = parsedDraft.valid ? parsedDraft.stationPort : normalizedConfig.stationPort;
  const summaryProxyHost = parsedDraft.valid ? parsedDraft.proxyHost : normalizedConfig.proxyHost;
  const summaryProxyPort = parsedDraft.valid ? parsedDraft.proxyPort : normalizedConfig.proxyPort;
  const summaryStationId = stationTestNote || normalizedConfig.stationId || "จะอ่านจาก API หลังทดสอบ";

  useEffect(() => {
    setFullUrlDraft(String(normalizedConfig.searchUrl || (normalizedConfig.connectionMode === VEHICLE_CONNECTION_MODES.PROXY ? "" : normalizedConfig.baseUrl || "")));
    setError("");
    setStationTestNote("");
  }, [stationId]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const handleTest = async () => {
    const parsed = parseVehicleSearchUrl(fullUrlDraft, { fallbackBaseUrl: "" });
    if (!parsed.valid) {
      setError(parsed.error || "URL ของ Vehicle API ไม่ถูกต้อง");
      setStationTestNote("");
      return;
    }
    const draftConfig = createVehicleSearchConfig({ baseUrl: parsed.sourceUrl, apiProfile: systemKey ? systemKey === "imps" ? "imps-v2" : "legacy-v1" : parsed.apiProfile, ...(systemKey === "imps" ? { connectionMode: "proxy" } : {}), stationId: null, stationName: null }, "");
    if (systemKey === "imps" && !draftConfig.searchUrl) { setError("IMPS ต้องตั้งค่า URL ผ่าน proxy"); return; }
    if (!draftConfig.baseUrl) {
      setError("URL ของ Vehicle API ไม่มีปลายทางสถานีที่ใช้งานได้");
      setStationTestNote("");
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setTesting(true);
    setError("");
    setStationTestNote("");
    onChange?.({ ...draftConfig, connectionStatus: VEHICLE_SEARCH_CONNECTION_STATUS.UNTESTED, lastTestedAt: null, stationId: null, stationName: null });
    try {
      const result = await testVehicleSearchConnection(draftConfig.baseUrl, { apiProfile: draftConfig.apiProfile, searchUrl: draftConfig.searchUrl, signal: controller.signal, stationProfileId: stationId, systemKey, transport: draftConfig.apiProfile === "imps-v2" ? "proxy" : "direct-first" });
      const apiStationId = result.sourceStation?.id || null;
      const apiStationName = result.sourceStation?.name || null;
      onChange?.({ ...draftConfig, stationId: apiStationId, stationName: apiStationName, connectionStatus: VEHICLE_SEARCH_CONNECTION_STATUS.CONNECTED, lastTestedAt: result.testedAt });
      setStationTestNote(apiStationId ? `stationID จาก API: ${apiStationId}${apiStationName ? ` · ${apiStationName}` : ""}` : "API ไม่ส่ง stationID แต่เชื่อมต่อสำเร็จ");
      notify?.("ทดสอบ API ป้ายทะเบียนสำเร็จ");
    } catch (testError) {
      if (testError?.name === "AbortError") return;
      onChange?.({ ...draftConfig, stationId: null, stationName: null, connectionStatus: VEHICLE_SEARCH_CONNECTION_STATUS.FAILED, lastTestedAt: new Date().toISOString() });
      setError(testError?.message || "ทดสอบการเชื่อมต่อ API ไม่สำเร็จ");
      notify?.(testError?.message || "ทดสอบการเชื่อมต่อ API ไม่สำเร็จ");
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setTesting(false);
      }
    }
  };

  const connectionModeLabel = summaryMode === VEHICLE_CONNECTION_MODES.PROXY ? "Proxy" : "Direct";
  const apiProfileLabel = VEHICLE_API_PROFILE_OPTIONS.find((option) => option.value === summaryProfile)?.label || summaryProfile;

  return <section className="ops-vehicle-config-panel" aria-labelledby={`vehicle-config-title-${stationId}-${systemKey}`}>
    <div className="ops-vehicle-config-heading"><div><p className="ops-eyebrow">VEHICLE API</p><h4 id={`vehicle-config-title-${stationId}-${systemKey}`}>การเชื่อมต่อข้อมูลป้ายทะเบียน</h4><span>ตั้งค่าปลายทางของสถานีนี้เพื่อใช้ดึงผลอ่านและภาพป้ายทะเบียน</span></div><StatusBadge status={status.tone}>{status.label}</StatusBadge></div>
    <div className="ops-vehicle-config-primary">
      <label className="ops-field ops-field-wide" htmlFor={`vehicle-api-full-url-${stationId}-${systemKey}`}><span>วาง URL เต็มของ Vehicle API</span><input id={`vehicle-api-full-url-${stationId}-${systemKey}`} type="url" value={fullUrlDraft} disabled={disabled || testing} onChange={(event) => { setFullUrlDraft(event.target.value); setError(""); setStationTestNote(""); }} placeholder={systemKey === "imps" ? "เช่น http://proxy-host:port/api?target=http://station-host:port/api/v2/vehicles/search" : "เช่น http://proxy-host:port/api?target=http://station-host:port/api/vehicle/search"} autoComplete="url" spellCheck="false" /><small className="ops-field-helper">{systemKey === "imps" ? "IMPS ใช้ Proxy และปลายทาง API v2 ที่ลงท้าย /api/v2/vehicles/search" : "คัดลอก URL จากผู้สร้างสถานีมาวาง ระบบจะแยก Direct/Proxy, IP/Port และรูปแบบ API แล้วทดสอบให้ในปุ่มเดียว"}</small>{error && <small className="ops-field-error" role="alert">{error}</small>}</label>
      <div className="ops-vehicle-config-primary-actions"><button type="button" className="ops-button ops-button-primary ops-vehicle-config-test" onClick={handleTest} disabled={disabled || testing || !String(fullUrlDraft || "").trim()}>{testing ? "กำลังทดสอบ..." : "วาง URL แล้วทดสอบ"}</button></div>
      <div className="ops-vehicle-config-summary" role="status"><span>การเชื่อมต่อ <strong>{connectionModeLabel}</strong></span><span>API <strong>{apiProfileLabel}</strong></span><span>สถานีจาก URL <strong>{summaryStationHost || "ยังไม่ระบุ"}{summaryStationPort ? `:${summaryStationPort}` : ""}</strong></span>{summaryMode === VEHICLE_CONNECTION_MODES.PROXY && <span>Proxy จาก URL <strong>{summaryProxyHost ? `${summaryProxyHost}${summaryProxyPort ? `:${summaryProxyPort}` : ""}` : "ยังไม่ระบุ"}</strong></span>}<span>stationID <strong>{summaryStationId}</strong></span></div>
    </div>
    <div className="ops-vehicle-config-purpose" role="note"><Icon name="info" size="small" /><div><strong>ใช้สำหรับ</strong><span>{VEHICLE_SEARCH_PURPOSE} · ไม่รวมในตัวนับ Checklist หรือ Evidence</span></div></div>
    {normalizedConfig.lastTestedAt && <small className="ops-vehicle-config-tested">ทดสอบล่าสุด {formatDateTime(normalizedConfig.lastTestedAt)}{normalizedConfig.stationName ? ` · ${normalizedConfig.stationName}` : ""}</small>}
    {error && <div className="ops-vehicle-search-error" role="alert"><Icon name="alert" size="small" /><span>{error}</span></div>}
  </section>;
}
