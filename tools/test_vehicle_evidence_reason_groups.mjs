import assert from 'node:assert/strict';
import { buildVehicleSnapshotEvidencePages } from '../src/domain/vehicle-snapshot-evidence.js';

const row = (id, status, reasonCode, extra = {}) => ({ id, occurredAt: '2026-10-01T09:00', plateImage: `${id}.png`, reviewStatus: status, reviewDetails: { plate: { reasonCode, ...extra } } });
const report = { rows: [
  ...Array.from({ length: 11 }, (_, index) => row(`blur-${index}`, 'incorrect', 'blurred-image', { correctionTarget: 'plate-number', correctedValue: '1234' })),
  row('province', 'incorrect', 'blurred-image', { correctionTarget: 'province', correctedValue: 'กรุงเทพมหานคร' }),
  row('ocr', 'incorrect', 'ocr-error'),
  row('unable', 'unable-to-verify', 'blurred-image', { verificationScope: 'both-unverified' }),
  row('legacy', 'unable-to-verify', null),
  row('correct', 'correct', null),
  row('pending', 'pending', null),
  { ...row('night', 'incorrect', 'ocr-error'), occurredAt: '2026-10-01T22:00' },
] };
const original = structuredClone(report);
for (const status of ['pending', 'correct']) {
  const emptyProblems = buildVehicleSnapshotEvidencePages({ rows: [row(status, status, null)] }, { context: 'plate', scope: 'day' });
  assert.equal(emptyProblems.filter(page => page.kind === 'reasons').length, 1, 'reason summary must remain visible without recorded problems');
  assert.deepEqual(emptyProblems.find(page => page.kind === 'reasons').reasonGroups, []);
}
const pages = buildVehicleSnapshotEvidencePages(report, { context: 'plate' });
const summaries = pages.filter(page => page.kind === 'reasons');
assert.equal(summaries.flatMap(page => page.reasonGroups).reduce((sum, group) => sum + group.entries.length, 0), 16);
assert.equal(summaries.find(page => page.period.key === 'day').reasonGroups.length, 5);
for (const page of pages.filter(page => ['evidence', 'detail'].includes(page.kind))) {
  assert.ok(page.entries.every(entry => entry.row.reviewStatus === page.group.key));
  if (page.group.reasonKey) {
    assert.equal(new Set(page.entries.map(entry => JSON.stringify([entry.detail.reasonCode || 'missing-reason', entry.detail.correctionTarget || '', entry.detail.verificationScope || '']))).size, 1);
  }
  assert.ok(page.entries.every(entry => page.group.entries.includes(entry)));
}
const blurPages = pages.filter(page => page.kind === 'evidence' && page.group.entries.some(entry => entry.row.id === 'blur-0'));
assert.deepEqual(blurPages.map(page => page.entries.length), [10, 1]);
assert.ok(summaries.flatMap(page => page.reasonGroups).some(group => group.reasonLabel.includes('ยังไม่ระบุเหตุผล')));
assert.equal(new Set(pages.map(page => page.key)).size, pages.length);
assert.deepEqual(report, original);
console.log('PASS: counts, cause/target separation, period separation, pagination, missing reasons, unique keys and immutable results');
