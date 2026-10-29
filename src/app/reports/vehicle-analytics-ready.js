export async function waitForVehicleAnalyticsLayout(report = document) {
  const deadline = Date.now() + 30000;
  while (report.querySelector('[data-analytics-layout="pending"]')) {
    if (Date.now() > deadline) throw new Error('จัดหน้าตารางยังไม่เสร็จ กรุณาลองใหม่');
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  const error = report.querySelector('[data-analytics-layout="error"]');
  if (error) throw new Error(error.textContent);
}

export async function waitForVehicleReportReady(report, onProgress = () => {}) {
  if (!report?.isConnected) throw new Error('ยังไม่มีตัวอย่างรายงาน');
  await document.fonts.ready;
  await waitForVehicleAnalyticsLayout(report);
  const deadline = Date.now() + 180000;
  while (report.querySelector('.snapshot-evidence-image[data-print-attachment="loading"]') && Date.now() < deadline) {
    if (!report.isConnected) throw new Error('รายงานเปลี่ยน กรุณาลองใหม่');
    onProgress('กำลังรอภาพหลักฐานโหลดครบ…');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (report.querySelector('.snapshot-evidence-image[data-print-attachment="loading"], .snapshot-evidence-image[data-print-attachment="missing"]')) throw new Error('ภาพบางไฟล์ยังโหลดไม่ครบ กรุณาลองโหลดภาพอีกครั้ง');
  if (!report.isConnected) throw new Error('รายงานเปลี่ยน กรุณาลองใหม่');
}
