import assert from 'node:assert/strict';
import { createUiDemoRound } from '../src/domain/demo-fixture.js';
import { buildReportTemplateModel, getReportCoverReadiness, normalizeReportCoverMeta } from '../src/domain/report-template.js';
import { REPORT_COMPANIES, REPORT_COPY, REPORT_COVER_SECTION_META, REPORT_COVER_STANDARD, getCompanyContractorMatch, getReportCompany, getCompanyCoverData, getReportCoverSections } from '../src/domain/report-companies.js';
const round = createUiDemoRound();
const original = JSON.stringify(round);
const model = buildReportTemplateModel(round);
const data = getCompanyCoverData(model);
assert.deepEqual(REPORT_COMPANIES.map(c => c.id), ['ntr', 'ltp', 'is8']);
assert.equal(getReportCompany('is8').name, 'iSMART');
assert.equal('logoCaption' in getReportCompany('is8'), false);
assert.equal(getReportCompany('unknown').id, 'ntr');
assert.equal(Object.keys(REPORT_COVER_SECTION_META).length, 14);
assert.deepEqual(REPORT_COVER_STANDARD.canvas, { width: 1672, height: 1188 });
assert.equal(REPORT_COVER_STANDARD.aspectRatio, '1672 / 1188');
assert.equal(REPORT_COVER_STANDARD.maxMastheadTitleLines, 2);
assert.ok(REPORT_COMPANIES.every((company) => Array.isArray(company.cover.sectionList)));
assert.ok(REPORT_COMPANIES.every((company) => !company.cover.facts && !company.cover.signatures && !company.cover.footer));
const sharedCoverGeometry = JSON.stringify(REPORT_COMPANIES[0].cover);
assert.ok(REPORT_COMPANIES.every((company) => JSON.stringify(company.cover) === sharedCoverGeometry), 'all companies must use one cover geometry');
for (const company of REPORT_COMPANIES) {
  for (const zone of REPORT_COVER_STANDARD.requiredZones) {
    const [x, y, width, height] = company.cover[zone];
    assert.ok(x >= 0 && y >= 0 && width > 0 && height > 0, `${company.id} ${zone} must be a positive cover zone`);
    assert.ok(x + width <= REPORT_COVER_STANDARD.canvas.width, `${company.id} ${zone} must stay inside cover width`);
    assert.ok(y + height <= REPORT_COVER_STANDARD.canvas.height, `${company.id} ${zone} must stay inside cover height`);
  }
  const title = company.cover.sectionTitle;
  const photo = company.cover.photo;
  const horizontalOverlap = title[0] < photo[0] + photo[2] && title[0] + title[2] > photo[0];
  if (horizontalOverlap) assert.ok(title[1] + title[3] <= photo[1], `${company.id} section title must not overlap the photo`);
}
const coverSections = getReportCoverSections({ sections: model.sections.map((section) => ({ ...section, title: `แก้ชื่อ ${section.code}` })) });
assert.equal(coverSections.length, model.sections.length);
assert.ok(coverSections.some((section) => section.code === 'SC-01.01'));
assert.equal(coverSections.find((section) => section.code === 'SC-01.01')?.title, 'WIM High Speed - Equipment');
assert.equal(coverSections.find((section) => section.code === 'SC-01.01')?.icon, 'sensor');
const legacyCover = getReportCoverSections({ sections: [{ code: '2.1', title: 'ชื่อที่แก้เอง' }] });
assert.equal(legacyCover[0]?.title, REPORT_COVER_SECTION_META['2.1'].title);
assert.equal(legacyCover[0]?.icon, 'sensor');
assert.equal(REPORT_COPY.systemTitle, 'Weigh-In-Motion (WIM) · ระบบชั่งน้ำหนักรถขณะเคลื่อนที่');
assert.equal(REPORT_COPY.report.document.presentationTemplateId, 'checklist-report-16x9-presentation-v1');
assert.deepEqual([
  REPORT_COPY.report.table.number,
  REPORT_COPY.report.table.description,
  REPORT_COPY.report.table.status,
  REPORT_COPY.report.table.details,
  REPORT_COPY.report.table.evidence,
], ['ลำดับ', 'รายการตรวจสอบ', 'สถานะ', 'รายละเอียด/หมายเหตุ', 'หลักฐานภาพ']);
assert.equal(getCompanyContractorMatch('ntr', 'NTR Engineer Co., Ltd.').status, 'match');
assert.equal(getCompanyContractorMatch('ltp', 'LTP Engineering').status, 'match');
assert.equal(getCompanyContractorMatch('is8', 'iSMART').status, 'match');
assert.equal(getCompanyContractorMatch('ntr', 'LTP Engineering').status, 'mismatch');
assert.equal(getCompanyContractorMatch('ntr', '').status, 'unknown');
assert.equal(data.evidence, `${model.summary.evidenceComplete} / ${model.summary.evidenceTotal} ช่อง`);
assert.equal(data.details, 'ไม่ได้ระบุรายละเอียด');
assert.equal(data.reportTitle, '', 'a blank manual cover stays blank instead of using project metadata');
assert.equal(data.project, '', 'project name on a cover comes from the report cover only');
const linkedMetadataOnlyModel = buildReportTemplateModel({ ...round, meta: { ...round.meta, projectName: 'โครงการจากสัญญา', contractNo: 'สัญญาจากการเชื่อม' } });
assert.equal(linkedMetadataOnlyModel.metadata.projectName, '', 'round metadata must not fill the report cover project');
assert.equal(linkedMetadataOnlyModel.metadata.contractNo, '', 'linked contract metadata must not fill the report cover number');
const titledModel = buildReportTemplateModel({ ...round, meta: { ...round.meta, reportCover: { reportTitle: 'รายงานหน้าปกทดสอบ', projectName: 'โครงการทดสอบ', contractNo: 'สัญญา 01/2569' } } });
assert.equal(getCompanyCoverData(titledModel).reportTitle, 'รายงานหน้าปกทดสอบ');
assert.equal(JSON.stringify(round), original, 'Cover must not mutate round or Snapshot');
assert.equal(getReportCoverReadiness(round).ready, false, 'normal covers require explicit cover metadata');
const completeCover = normalizeReportCoverMeta({
  reportTitle: 'รายงานผลการตรวจสอบสถานี',
  projectName: 'โครงการทดสอบ',
  contractNo: 'สัญญา 01/2569',
  contractDate: '2026-01-02',
  contractStartDate: '2026-01-03',
  contractEndDate: '2026-12-31',
});
assert.equal(getReportCoverReadiness({ ...round, meta: { ...round.meta, reportCover: completeCover } }).ready, true);
const quickModel = buildReportTemplateModel({ ...round, meta: { ...round.meta, inspectionMode: 'quick_field', reportCover: { reportTitle: 'รายงานงานเฉพาะกิจ', projectName: 'งานเฉพาะกิจ' } } });
assert.equal(quickModel.reportCover.isQuickField, true);
assert.equal(quickModel.reportCover.ready, true);
assert.deepEqual(quickModel.reportCover.missingFields, []);
for (const [summary,status,tone] of [
  [{total:0,issues:0,pending:0},REPORT_COPY.status.empty,'pending'],
  [{total:2,issues:1,pending:1},REPORT_COPY.status.issue,'issue'],
  [{total:2,issues:0,pending:1},REPORT_COPY.status.pending,'pending'],
  [{total:2,issues:0,pending:0},REPORT_COPY.status.normal,'normal'],
]) {
  const result = getCompanyCoverData({...model,summary:{...model.summary,...summary}});
  assert.equal(result.status,status); assert.equal(result.tone,tone);
}
console.log('Company covers: brands, live evidence, missing notes, status priority and Snapshot isolation passed');
