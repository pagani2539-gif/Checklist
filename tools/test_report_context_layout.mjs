import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createUiDemoRound } from '../src/domain/demo-fixture.js';
import { buildReportTemplateModel, getPresentationEvidenceCaption } from '../src/domain/report-template.js';
import { REPORT_COPY, getReportCompany } from '../src/domain/report-companies.js';

const folder = new URL('../.scratch/report-context-layout/', import.meta.url);
await fs.mkdir(folder, { recursive: true });
const bundle = new URL('renderer.mjs', folder);
await build({ stdin: { contents: `export { createPrintableReportComponent } from './src/app/reports/PrintableReport.jsx'; export { default as CompanyReportCover } from './src/app/CompanyReportCover.jsx'; export { AppIcon } from './src/app/icon-system.jsx';`, resolveDir: process.cwd() }, outfile: bundle.pathname.replace(/^\/(\w:)/, '$1'), bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', packages: 'external', loader: { '.css': 'empty' }, define: { 'import.meta.env.DEV': 'false' } });
const { createPrintableReportComponent, CompanyReportCover, AppIcon } = await import(bundle.href);
const round = createUiDemoRound();
const before = JSON.stringify(round);
const base = buildReportTemplateModel(round);
const entry = (id, label, stage) => ({ id, displayLabel: label, sourceLabel: 'INTERNAL PDF SOURCE', status: 'pending', statusLabel: 'ยังไม่มีหลักฐาน', photoRequired: true, cleaningStage: stage });
const station = { id: 'station', templateId: '1.1.traffic-cone-light', label: 'ตรวจความพร้อมของกรวยจราจรและป้ายไฟที่ติดตั้ง', sectionCode: '1.1', status: 'normal', statusLabel: 'ปกติ', value: '', helper: 'HELPER MUST NOT PRINT', note: '', evidenceSlots: [entry('station-photo', 'ภาพกรวยจราจรและป้ายไฟ')] };
const scanner = { ...station, id: 'scanner', templateId: 'scan-test', label: '3D Laser Scanner · ตรวจสอบผลการสแกนวัตถุ', assetId: 'scanner-asset', assetType: 'LASER_SCANNER', assetName: '3D Laser Scanner', assetNo: '3D-LS-3D-01', sectionCode: '1.1.5', scope: '3D', laneNo: '1', value: 0, unit: 'mm', note: 'ผลตรวจที่ผู้ตรวจบันทึก', evidenceSlots: [entry('scan-photo', 'ผลการสแกน')] };
const cleaning = { ...scanner, id: 'cleaning', label: 'ทำความสะอาดอุปกรณ์ · 3D Laser Scanner', value: '', note: '', isEquipmentCleaning: true, evidenceSlots: ['ก่อน', 'ระหว่าง', 'หลัง'].map((stage, i) => entry(`clean-${i}`, `${stage}ทำความสะอาด`, stage)) };
const system = { ...station, id: 'lpr', templateId: '3.1.test', sectionCode: '3.1', label: 'LPR Control System · ทดสอบการอ่านป้ายทะเบียนสำหรับระบบ 3D', systemRecordId: 'lpr-3d', systemLabel: 'LPR Control System', scope: '3D', laneNo: '1' };
let currentModel;
const Report = createPrintableReportComponent({ EmptyState: () => null, Icon: AppIcon, REPORT_COPY, REPORT_TEXT: REPORT_COPY.report, STATUS_META: { normal: { icon: 'check' }, pending: { icon: 'clock' } }, StatusBadge: ({ children }) => React.createElement('span', null, children), VEHICLE_REVIEW_CORRECTION_TARGET_OPTIONS: [], VEHICLE_REVIEW_REASON_OPTIONS: [], CompanyReportCover, buildReportTemplateModel: () => currentModel, formatDate: () => 'DATE MUST NOT PRINT', formatDateTime: () => '', getPresentationEvidenceCaption, getReportCompany, getStoredAttachment: async () => null, shortId: id => id || 'round-test', statusClass: status => `is-${status}` });
for (const companyId of ['ntr', 'ltp', 'is8']) {
  const panels = [];
  for (const item of [station, scanner, cleaning, system]) {
    const section = { code: item.sectionCode, title: item.sectionCode === '1.1' ? 'การแสดงความพร้อม' : '3D Dimension', items: [item] };
    currentModel = { ...base, sections: [section], orderedItems: [{ ...item, presentationSection: section }], vehicleSearch: null, metadata: { ...base.metadata, roundId: 'round-context-test', inspectionDate: '2026-10-07' } };
    const html = renderToStaticMarkup(React.createElement(Report, { round, mode: 'presentation', preview: true, companyId }));
    const standardHtml = renderToStaticMarkup(React.createElement(Report, { round, mode: 'standard', preview: true, companyId }));
    assert.ok(standardHtml.includes('company-cover'), 'A4 retains the company report cover');
    assert.ok(!standardHtml.includes('class="ops-print-header"'), 'A4 must not render the redundant field-form header after the company cover');
    assert.ok(!standardHtml.includes('แบบฟอร์มตรวจหน้างาน'), 'A4 has no legacy field-form title');
    assert.ok(!standardHtml.includes('ops-print-meta-grid') && !standardHtml.includes('ops-print-summary-strip'), 'A4 must not repeat cover metadata and summary below the cover');
    assert.ok(!standardHtml.includes('ops-print-cover-overview'), 'A4 must not repeat the section overview below the company cover');
    assert.ok(standardHtml.includes('data-print-item-id='), 'A4 retains the inspection detail rows');
    const slide = html.slice(html.indexOf('data-print-presentation-item-id'));
    assert.ok(!slide.includes('DATE MUST NOT PRINT'));
    assert.ok(!slide.includes('HELPER MUST NOT PRINT'));
    assert.ok(!slide.includes('INTERNAL PDF SOURCE'));
    assert.ok(!slide.includes('ยังไม่ระบุ'));
    assert.ok(slide.includes('หน้า 1 / 1'));
    assert.ok(!html.includes('round-context-test'), 'internal round code must not appear in the report');
    assert.ok(!slide.includes('รอบการตรวจ'));
    assert.ok(html.includes(getReportCompany(companyId).theme.accent));
    assert.ok(!html.includes('data-icon-missing'));
    if (item === station) { assert.ok(!slide.includes('>อุปกรณ์<')); assert.ok(!slide.includes('>Serial<')); }
    if (item === scanner) { assert.ok(slide.includes('0 mm')); assert.ok(slide.includes('data-icon-name="scan"')); assert.ok(slide.includes(scanner.note)); }
    if (item === cleaning) { assert.equal((slide.match(/data-presentation-evidence-id=/g) || []).length, 3); assert.ok(slide.includes('data-icon-name="broom"')); }
    panels.push(html);
  }
  const css = (await fs.readdir('release/public/assets')).find(name => name.endsWith('.css'));
  await fs.writeFile(new URL(`${companyId}.html`, folder), `<!doctype html><html lang="th"><meta charset="utf-8"><link rel="stylesheet" href="/assets/${css}"><body style="margin:0;background:white"><main class="checklist-page">${panels.join('')}</main></body></html>`);
}
assert.equal(JSON.stringify(round), before);
console.log('Report context layout: 4 contexts x 3 companies, icons, date removal, zero value, missing evidence and Snapshot preservation passed');
