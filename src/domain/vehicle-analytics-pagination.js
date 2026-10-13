/** Greedy packing of measured row heights, preserving order and every row. */
export function packVehicleAnalyticsRows(heights, availableHeight) {
  if (!(availableHeight > 0)) throw new Error('จัดหน้าตารางไม่ได้: ไม่มีพื้นที่สำหรับรายการ');
  const chunks = [];
  let start = 0, used = 0;
  heights.forEach((height, index) => {
    if (!Number.isFinite(height) || height <= 0 || height > availableHeight) throw new Error('จัดหน้าตารางไม่ได้: รายการหนึ่งสูงเกินพื้นที่ของหน้า');
    if (used + height > availableHeight) { chunks.push([start, index]); start = index; used = 0; }
    used += height;
  });
  chunks.push([start, heights.length]);
  return chunks;
}
