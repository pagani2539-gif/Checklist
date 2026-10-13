import { adoptRoundVehicleConnection } from '../src/domain/round-vehicle-connection.js';
import { createVehicleSearchConfig } from '../src/domain/vehicle-search-config.js';
import { getInstalledVehicleSystems, getVehicleSystemConfig } from '../src/domain/vehicle-review-systems.js';

const same = (left, right) => JSON.stringify(left || {}) === JSON.stringify(right || {});
export function assertRoundVehicleConnectionUpdates(current, next, user) {
  for (const round of next.inspectionRounds || []) {
    const before = current.inspectionRounds?.find(entry => entry.id === round.id);
    if (same(before?.vehicleConnectionUpdates, round.vehicleConnectionUpdates)) continue;
    const fail = () => { throw Object.assign(new Error('ค่า API ของรอบเปลี่ยนแล้ว กรุณาโหลดข้อมูลล่าสุดและรับค่าจากทะเบียนสถานีอีกครั้ง'), { statusCode: 409 }); };
    if (!before) {
      const source = current.inspectionRounds?.find(entry => entry.id === round.basedOnRoundId && entry.status === 'closed');
      if (source && same(source.vehicleConnectionUpdates, round.vehicleConnectionUpdates)) continue;
      fail();
    }
    if (!same(before.snapshot, round.snapshot) || !same(before.vehicleSearch, round.vehicleSearch) || before.status !== 'draft' || round.status !== 'draft') fail();
    const profile = current.stationProfiles?.find(entry => entry.id === before.stationId);
    if (!profile) fail();
    const installed = getInstalledVehicleSystems(profile);
    let expected = before;
    for (const key of new Set([...Object.keys(before.vehicleConnectionUpdates || {}), ...Object.keys(round.vehicleConnectionUpdates || {})])) {
      const incoming = round.vehicleConnectionUpdates?.[key];
      if (same(before.vehicleConnectionUpdates?.[key], incoming)) continue;
      if (!incoming || !Number.isFinite(Date.parse(incoming.adoptedAt))) fail();
      const system = installed.find(entry => entry.key === key);
      if (key !== 'legacy' && !system) fail();
      const config = system ? getVehicleSystemConfig(profile, system, installed) : createVehicleSearchConfig(profile.vehicleSearchConfig, '');
      try {
        expected = adoptRoundVehicleConnection(expected, config, { systemKey: key === 'legacy' ? '' : key, at: incoming.adoptedAt,
          userLabel: user?.displayName || user?.name || user?.username || '' });
      } catch (error) { throw Object.assign(error, { statusCode: 409 }); }
    }
    if (!same(expected.vehicleConnectionUpdates, round.vehicleConnectionUpdates)) fail();
  }
}
