import { downloadSnapshotEvidencePdf } from '../../src/app/reports/snapshot-evidence-pdf.js';
const result = document.querySelector('#result');
const report = document.querySelector('#report');
const violations = [];
document.addEventListener('securitypolicyviolation', event => violations.push(event.violatedDirective + ': ' + event.blockedURI.split('/')[0]));
const canvas = document.createElement('canvas');
canvas.width = 64; canvas.height = 32;
const context = canvas.getContext('2d');
context.fillStyle = '#1688ff'; context.fillRect(0, 0, 64, 32);
context.fillStyle = '#fff'; context.fillRect(8, 8, 24, 16);
const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
const image = new Image();
image.src = URL.createObjectURL(blob);
image.className = 'snapshot-evidence-image';
image.dataset.printAttachment = 'loaded';
for (let index = 0; index < 3; index++) {
  const page = document.createElement('section');
  page.className = 'snapshot-vehicle-page';
  page.style.cssText = 'width:640px;height:360px;background:white;color:black';
  page.textContent = `Evidence page ${index + 1}`;
  if (index === 2) page.append(image);
  report.append(page);
}
await image.decode();
document.querySelector('#run').onclick = async () => {
  const original = image.getAttribute('src');
  violations.length = 0;
  result.textContent = 'Running';
  try {
    const pages = await downloadSnapshotEvidencePdf(report, { fileName: 'snapshot-pdf-csp-regression.pdf' });
    if (pages !== 3 || violations.length || image.getAttribute('src') !== original || !image.complete || !image.naturalWidth) throw new Error('Export, CSP or original evidence invariant failed');
    result.textContent = `PASS ${report.dataset.reportMode}: 3 pages; original image preserved; zero CSP violations`;
    report.dataset.reportMode = report.dataset.reportMode === 'presentation' ? 'standard' : 'presentation';
  } catch (error) { result.textContent = `FAIL: ${error.message}\n${violations.join('\n')}`; }
};
