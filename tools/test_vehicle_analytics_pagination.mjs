import assert from 'node:assert/strict';
import { packVehicleAnalyticsRows } from '../src/domain/vehicle-analytics-pagination.js';
for (const count of [1, 6, 7, 13, 50]) {
  const heights = Array.from({ length: count }, (_, index) => index % 3 ? 30 : 70);
  const chunks = packVehicleAnalyticsRows(heights, 300);
  assert.deepEqual(chunks.flatMap(([start, end]) => heights.slice(start, end)), heights);
  chunks.forEach(([start, end], index) => {
    const used = heights.slice(start, end).reduce((sum, height) => sum + height, 0);
    assert.ok(used <= 300);
    if (index < chunks.length - 1) assert.ok(used + heights[end] > 300);
  });
}
assert.deepEqual(packVehicleAnalyticsRows(Array(13).fill(20), 300), [[0, 13]]);
assert.deepEqual(packVehicleAnalyticsRows([100, 200, 1], 300), [[0, 2], [2, 3]]);
assert.deepEqual(packVehicleAnalyticsRows([], 300), [[0, 0]]);
assert.throws(() => packVehicleAnalyticsRows([301], 300), /จัดหน้าตารางไม่ได้/);
assert.throws(() => packVehicleAnalyticsRows([1], 0), /จัดหน้าตารางไม่ได้/);
console.log('PASS measured row packing: variable heights, full pages, all rows once, oversized row blocked');
