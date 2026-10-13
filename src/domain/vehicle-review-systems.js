import { createVehicleSearchConfig } from './vehicle-search-config.js';
import { getRoundVehicleSearchConfig, getRoundVehicleConnectionSnapshot } from './round-vehicle-connection.js';
import { normalizeWorkpointScope } from './station-workpoint-layout.js';
import { createVehicleReviewState, normalizeVehicleReviewState, getVehicleReviewContext, updateVehicleReviewRow, getVehicleReviewDetail, normalizeVehicleSearchCriteria } from './vehicle-search.js';

export const VEHICLE_REVIEW_SYSTEMS_VERSION = 'vehicle-review-systems-v1';
export const AUTOMATIC_SOFTWARE_TESTS_VERSION = 'automatic-software-tests-v1';
export const SOFTWARE_TEST_SYSTEM_IDS = Object.freeze(['wim-high-data-control', 'wim-high-reporting', 'wim-high-display', 'wim-low-data-control', 'wim-low-reporting', 'wim-low-display']);
export const VEHICLE_REVIEW_SYSTEMS = Object.freeze([
  { key: 'sc-hs', label: 'HS', scope: 'High Speed', format: 'SC', apiProfile: 'legacy-v1' },
  { key: 'sc-ls', label: 'LS', scope: 'Low Speed', format: 'SC', apiProfile: 'legacy-v1' },
  { key: 'imps', label: 'IMPS', scope: 'ImPS', format: 'IMPS', apiProfile: 'imps-v2' },
]);

export function getVehicleSystemLabel(system) {
  const key = typeof system === 'string' ? system : system?.key;
  return VEHICLE_REVIEW_SYSTEMS.find(entry => entry.key === key)?.label || system?.label || key || '';
}

// Registered records and the central workpoint map determine installed systems.
// Addresses and lane numbers never determine the system kind.
export function getInstalledVehicleSystems(profile = {}) {
  return getVehicleSystemInstallation(profile).systems;
}

export function getVehicleSystemInstallation(profile = {}) {
  const format = String(profile.stationFormat || 'SC').toUpperCase();
  const records = (profile.stationSystems || []).filter(record => record.active !== false && Number(record.quantity ?? 1) > 0
    && (record.canonicalItemId === 'wim-sorting' || record.id === 'wim-sorting'));
  const errors = [];
  const installed = new Map();
  for (const record of records) {
    const lane = (profile.lanes || []).find(lane => lane.id === record.laneId && lane.active !== false);
    const scope = normalizeWorkpointScope(record.scope);
    const system = VEHICLE_REVIEW_SYSTEMS.find(system => system.format === format && normalizeWorkpointScope(system.scope) === scope);
    const laneScope = normalizeWorkpointScope(lane?.scope);
    if (!lane || !system || (laneScope && laneScope !== scope)) {
      errors.push({ systemId: record.id, message: `WIM ${record.instanceNo || record.id}: ตรวจขอบเขตและ Lane ที่ใช้งานก่อนเริ่มรอบ` });
      continue;
    }
    if (!installed.has(system.key)) installed.set(system.key, { ...system, systemIds: [], laneIds: [] });
    const entry = installed.get(system.key);
    entry.systemIds.push(record.id);
    if (!entry.laneIds.includes(lane.id)) entry.laneIds.push(lane.id);
  }
  return { systems: VEHICLE_REVIEW_SYSTEMS.filter(system => installed.has(system.key)).map(system => installed.get(system.key)), errors };
}

export function getVehicleSystemConfig(profile, system, installed = getInstalledVehicleSystems(profile)) {
  const saved = profile?.vehicleSearchConfig?.systems?.[system.key];
  const legacy = installed.length === 1 ? profile?.vehicleSearchConfig : null;
  const source = saved || legacy || {};
  return { ...createVehicleSearchConfig({ ...source, apiProfile: system.apiProfile,
    ...(system.key === 'imps' ? { connectionMode: 'proxy' } : {}) }, ''), systemKey: system.key };
}

export function snapshotVehicleSystems(profile) {
  const installed = getInstalledVehicleSystems(profile);
  return installed.map(system => ({ ...system, config: getVehicleSystemConfig(profile, system, installed) }));
}

export function isSystemVehicleRound(round) { return round?.snapshot?.vehicleReviewSystemsVersion === VEHICLE_REVIEW_SYSTEMS_VERSION; }

export function normalizeSystemVehicleSearch(value, snapshot, criteria = {}) {
  return { systemsVersion: VEHICLE_REVIEW_SYSTEMS_VERSION, systems: Object.fromEntries((snapshot.vehicleReviewSystems || []).map(system => [system.key,
    Object.fromEntries(['plate', 'classification'].map(context => {
      const source = value?.systems?.[system.key]?.[context];
      const state = normalizeVehicleReviewState(source?.scopes ? source : createVehicleReviewState(criteria), criteria,
        { ...system.config, stationProfileId: snapshot.stationId, systemKey: system.key, roundId: value?.roundId || "" });
      for (const [scopeKey, scope] of Object.entries(state.scopes)) scope.rows = scope.rows.map(row => ({ ...row, systemKey: system.key, vehicleReviewContext: context, vehicleReviewScope: scopeKey }));
      return [context, { ...state, independentContext: context }];
    }))])) };
}

export function getSystemVehicleSearch(round, systemKey, context = 'plate') {
  if (!isSystemVehicleRound(round)) return round?.vehicleSearch;
  const system = round.snapshot.vehicleReviewSystems.find(system => system.key === systemKey);
  const source = round.vehicleSearch?.systems?.[systemKey]?.[context];
  const criteria = { dateFrom: round.meta?.inspectionDate, dateTo: round.meta?.inspectionDate };
  const state = normalizeVehicleReviewState(source?.scopes ? source : createVehicleReviewState(criteria), criteria,
    { ...getRoundVehicleSearchConfig(round, systemKey), stationProfileId: round.stationId, systemKey, roundId: round.id });
  for (const [scopeKey, scope] of Object.entries(state.scopes)) {
    const tagRow = row => ({ ...row, systemKey, vehicleReviewContext: context, vehicleReviewScope: scopeKey });
    scope.rows = scope.rows.map(tagRow);
    if (Array.isArray(scope.sourceRows)) scope.sourceRows = scope.sourceRows.map(tagRow);
  }
  return { ...state, independentContext: context };
}

export function setSystemVehicleSearch(round, systemKey, context, value) {
  if (!isSystemVehicleRound(round)) return { ...round, vehicleSearch: value };
  if (!round.snapshot.vehicleReviewSystems.some(system => system.key === systemKey) || !['plate', 'classification'].includes(context)) throw new Error('ไม่พบงานตรวจของระบบนี้');
  const connectionSnapshot = getRoundVehicleConnectionSnapshot(round);
  const vehicleSearch = normalizeSystemVehicleSearch(round.vehicleSearch, connectionSnapshot);
  const config = getRoundVehicleSearchConfig(round, systemKey);
  vehicleSearch.systems[systemKey][context] = { ...normalizeVehicleReviewState(value, {}, { ...config, stationProfileId: round.stationId, systemKey }), independentContext: context };
  return { ...round, vehicleSearch: normalizeSystemVehicleSearch(vehicleSearch, connectionSnapshot) };
}

export function projectVehicleRound(round, systemKey, context = 'plate') {
  if (!isSystemVehicleRound(round)) return round;
  const system = round.snapshot.vehicleReviewSystems.find(entry => entry.key === systemKey);
  if (!system) return null;
  return { ...round, vehicleSearch: getSystemVehicleSearch(round, systemKey, context), snapshot: { ...round.snapshot,
    vehicleSearchConfig: getRoundVehicleSearchConfig(round, systemKey), vehicleReviewSystemKey: system.key, vehicleReviewSystemLabel: getVehicleSystemLabel(system),
    vehicleReviewContext: context } };
}

export function expandVehicleReviewItems(items, snapshot) {
  if (snapshot?.vehicleReviewSystemsVersion !== VEHICLE_REVIEW_SYSTEMS_VERSION) return items;
  return items.flatMap(item => {
    const context = getVehicleReviewContext(item);
    if (!context) return [item];
    return (snapshot.vehicleReviewSystems || []).map(system => ({ ...item,
      id: `${item.id}::review-system::${system.key}`, vehicleReviewContext: context.key,
      vehicleReviewSystemKey: system.key, scope: system.scope,
      ...(snapshot.automaticSoftwareTestsVersion === AUTOMATIC_SOFTWARE_TESTS_VERSION ? { applicable: true, checklistDisabled: false, automaticVehicleTest: true } : {}),
      label: `${context.key === 'plate' ? 'ตรวจป้ายทะเบียน' : 'ตรวจการคัดแยกประเภทรถ'} · ${getVehicleSystemLabel(system)}` }));
  });
}

export function updateSystemVehicleRowReview(round, { systemKey, context, scopeKey, rowId, reviewStatus, detailPatch = {}, expectedScope, expectedRow }) {
  if (round?.status === 'closed') throw new Error('รอบตรวจนี้ปิดแล้ว');
  if (!isSystemVehicleRound(round) || !round.snapshot.vehicleReviewSystems.some(system => system.key === systemKey)
    || !['plate', 'classification'].includes(context) || !['day', 'night'].includes(scopeKey)) throw new Error('ไม่พบงานตรวจของระบบนี้');
  const system = round.vehicleSearch?.systems?.[systemKey];
  const dataset = system?.[context];
  const scope = dataset?.scopes?.[scopeKey];
  const row = scope?.rows?.find(row => row.id === rowId);
  if (!row) throw new Error('ไม่พบรถในชุดตรวจนี้');
  const statusKey = context === 'plate' ? 'reviewStatus' : 'classificationReviewStatus';
  if (!expectedScope || !expectedRow || scope.fetchedAt !== expectedScope.fetchedAt
    || JSON.stringify(normalizeVehicleSearchCriteria(scope.criteria)) !== JSON.stringify(normalizeVehicleSearchCriteria(expectedScope.criteria))
    || (scope.sample?.lockedAt || null) !== (expectedScope.sample?.lockedAt || null)
    || (row[statusKey] || 'pending') !== (expectedRow[statusKey] || 'pending')
    || JSON.stringify(getVehicleReviewDetail(row, context)) !== JSON.stringify(getVehicleReviewDetail(expectedRow, context))) {
    throw new Error('ข้อมูลรถหรือชุดตรวจเปลี่ยนแล้ว กรุณาตรวจข้อมูลล่าสุดก่อนบันทึก');
  }
  const updatedRow = updateVehicleReviewRow(row, context, reviewStatus, detailPatch);
  if (updatedRow === row) throw new Error('ผลตรวจไม่ถูกต้อง');
  return { ...round, vehicleSearch: { ...round.vehicleSearch, systems: { ...round.vehicleSearch.systems,
    [systemKey]: { ...system, [context]: { ...dataset, scopes: { ...dataset.scopes,
      [scopeKey]: { ...scope, rows: scope.rows.map(current => current.id === rowId ? updatedRow : current) },
    } } },
  } } };
}

export function expandSoftwareTestItems(items, snapshot) {
  if (snapshot?.automaticSoftwareTestsVersion !== AUTOMATIC_SOFTWARE_TESTS_VERSION) return items;
  return items.flatMap(item => {
    const record = snapshot.stationSystems?.find(system => system.id === item.systemRecordId);
    if (SOFTWARE_TEST_SYSTEM_IDS.includes(record?.canonicalItemId || record?.id)) return [];
    if (item.assetId || item.systemRecordId || !/^6\.1\.(display|report-print|vehicle-search|report-page|central-connection|history-months|save-config)$/.test(item.id)) return [item];
    return (snapshot.vehicleReviewSystems || []).map(system => ({ ...item,
      id: `${item.id}::software-system::${system.key}`, sourceItemId: item.id,
      softwareTestSystemKey: system.key, vehicleReviewSystemKey: system.key, automaticSoftwareTest: true,
      scope: system.scope, label: `${item.label} · ${getVehicleSystemLabel(system)}`, legacyIds: [], legacyControlIds: [],
      checklistDisabled: false, applicable: true,
      evidenceSlots: (item.evidenceSlots || []).map(slot => ({ ...slot, id: `${slot.id}::software-system::${system.key}`,
        photoRequired: slot.fieldType === 'photo' || slot.photoRequired,
        documentRequired: slot.fieldType === 'document', valueRequired: item.id === '6.1.history-months',
        displayLabel: `${slot.displayLabel || slot.sourceLabel || item.label} · ${getVehicleSystemLabel(system)}` })) }));
  });
}
