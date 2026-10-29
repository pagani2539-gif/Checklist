import assert from 'node:assert/strict';
import { waitForVehicleReportReady } from '../src/app/reports/vehicle-analytics-ready.js';

const originalDocument = globalThis.document;
globalThis.document = { fonts: { ready: Promise.resolve() } };
const report = querySelector => ({ isConnected: true, querySelector });
try {
  await assert.rejects(waitForVehicleReportReady(null), /ยังไม่มีตัวอย่าง/);
  await waitForVehicleReportReady(report(() => null));
  await assert.rejects(waitForVehicleReportReady(report(selector => selector.includes('missing') ? {} : null)), /ภาพบางไฟล์/);
  await assert.rejects(waitForVehicleReportReady(report(selector => selector.includes('error') ? { textContent: 'row too tall' } : null)), /row too tall/);
  let pendingLayout = true;
  let pendingImages = true;
  let progress = 0;
  const loadingReport = report(selector => {
    if (selector.includes('pending') && pendingLayout) { pendingLayout = false; return {}; }
    if (selector.includes('loading') && !selector.includes('missing') && pendingImages) { pendingImages = false; return {}; }
    return null;
  });
  await waitForVehicleReportReady(loadingReport, () => progress++);
  assert.equal(progress, 1, 'wait for both layout and images before allowing export/print');
  const detached = report(selector => {
    if (selector.includes('loading')) { detached.isConnected = false; return {}; }
    return null;
  });
  await assert.rejects(waitForVehicleReportReady(detached), /รายงานเปลี่ยน/);
  const navigated = report(() => { navigated.isConnected = false; return null; });
  await assert.rejects(waitForVehicleReportReady(navigated), /รายงานเปลี่ยน/);
} finally { globalThis.document = originalDocument; }
console.log('PASS report readiness: layout, fonts, images, missing files and detached document');
