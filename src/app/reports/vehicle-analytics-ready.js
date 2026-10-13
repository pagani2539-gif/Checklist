export async function waitForVehicleAnalyticsLayout(report = document) {
  const deadline = Date.now() + 30000;
  while (report.querySelector('[data-analytics-layout="pending"]')) {
    if (Date.now() > deadline) throw new Error('จัดหน้าตารางยังไม่เสร็จ กรุณาลองใหม่');
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  const error = report.querySelector('[data-analytics-layout="error"]');
  if (error) throw new Error(error.textContent);
}
