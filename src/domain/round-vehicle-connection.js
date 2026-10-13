import { createVehicleSearchConfig } from './vehicle-search-config.js';

// A connection adopted during an open round is separate from its opening Snapshot.
export function getRoundVehicleSearchConfig(round, systemKey = round?.snapshot?.vehicleReviewSystemKey || '') {
  const saved = systemKey
    ? round?.snapshot?.vehicleReviewSystems?.find(system => system.key === systemKey)?.config
    : round?.snapshot?.vehicleSearchConfig;
  const adopted = round?.vehicleConnectionUpdates?.[systemKey || 'legacy']?.config;
  return createVehicleSearchConfig({ ...(adopted || saved || {}), ...(systemKey ? { systemKey } : {}), roundId: round?.id }, '');
}

export function hasVehicleConnectionData(value) {
  if (!value || typeof value !== 'object') return false;
  if (value.fetchedAt || value.sample?.lockedAt || value.rows?.length || value.sourceRows?.length) return true;
  return Object.values(value).some(entry => entry && typeof entry === 'object' && hasVehicleConnectionData(entry));
}

export function getRoundVehicleConnectionSnapshot(round) {
  const snapshot = round?.snapshot || {};
  if (!round?.vehicleConnectionUpdates) return snapshot;
  return { ...snapshot, vehicleSearchConfig: getRoundVehicleSearchConfig(round, ''),
    ...(Array.isArray(snapshot.vehicleReviewSystems) ? { vehicleReviewSystems: snapshot.vehicleReviewSystems.map(system =>
      ({ ...system, config: getRoundVehicleSearchConfig(round, system.key) })) } : {}),
  };
}

export function adoptRoundVehicleConnection(round, config, { systemKey = '', at = new Date().toISOString(), userLabel = '' } = {}) {
  if (!round || round.status !== 'draft') throw new Error('รับค่า API ได้เฉพาะรอบที่ยังเปิดอยู่');
  const systems = round.snapshot?.vehicleReviewSystems;
  if (Array.isArray(systems) && !systems.some(system => system.key === systemKey)) throw new Error('ไม่พบระบบที่เลือกในรอบนี้');
  if (!Array.isArray(systems) && systemKey) throw new Error('ไม่พบระบบที่เลือกในรอบนี้');
  const dataset = systemKey ? round.vehicleSearch?.systems?.[systemKey] : round.vehicleSearch;
  if (hasVehicleConnectionData(dataset)) throw new Error('ระบบนี้มีชุดข้อมูลรถแล้ว จึงเปลี่ยนค่าเชื่อมต่อไม่ได้');
  const normalized = createVehicleSearchConfig(config, '');
  if (!normalized.baseUrl || (normalized.apiProfile === 'imps-v2' && !normalized.searchUrl)) throw new Error('ยังไม่ได้ตั้งค่า API ในทะเบียนสถานีให้ครบ');
  const previous = getRoundVehicleSearchConfig(round, systemKey);
  const key = systemKey || 'legacy';
  const prior = round.vehicleConnectionUpdates?.[key];
  return { ...round, updatedAt: at, vehicleConnectionUpdates: { ...round.vehicleConnectionUpdates,
    [key]: { config: normalized, adoptedAt: at, adoptedByLabel: userLabel,
      history: [...(prior?.history || []), { at, userLabel, previous, config: normalized }] },
  } };
}
