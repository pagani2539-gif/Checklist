import assert from 'node:assert/strict';
import { buildVehicleSnapshotEvidencePages } from '../src/domain/vehicle-snapshot-evidence.js';
const statuses = ['correct', 'incorrect', 'unable-to-verify', 'pending'];
const rows = ['09', '22', null].flatMap(hour => statuses.map((status, index) => ({
  id: `${hour}-${index}`, occurredAt: hour ? `2026-10-10T${hour}:00:00+07:00` : null,
  reviewStatus: status, classificationReviewStatus: status, province: 'จังหวัดเดิม', vehicleClassLabel: 'ประเภทเดิม',
  reviewDetails: { plate: { confirmedProvince: 'จังหวัดใหม่', correctionTarget: 'province', reasonCode: 'province-read-error' }, classification: { correctedValue: 'ประเภทใหม่', reasonCode: 'class-error-unknown' } },
})));
const report = { rows, supportsClassification: true };
const original = structuredClone(report);
const stage = page => page.kind === 'summary' ? 0 : page.kind === 'reasons' ? 1 : page.kind === 'analytics' ? ({ pairs: 2, lanes: 4, periods: 5, hours: 6 }[page.analytics.key] ?? 3) : page.kind === 'excluded' ? 8 : 7;
const verify = pages => {
  assert.ok(pages.length);
  assert.equal(new Set(pages.map(page => page.key)).size, pages.length);
  assert.ok(pages.every((page, index) => !index || stage(pages[index - 1]) <= stage(page)));
  const analytics = pages.filter(page => page.kind === 'analytics');
  assert.ok(analytics.every(page => page.period.key !== 'all'), 'detailed analytics keep each period separate');
  for (const page of analytics) {
    assert.equal(page.analytics.total, page.total);
    const entries = page.analytics.rows.flatMap(row => row.entries || []);
    if (page.dimension === 'plate') {
      const periodFor = entry => {
        if (!entry.row.occurredAt) return 'unknown';
        const hour = Number(entry.row.occurredAt.slice(11, 13));
        return hour >= 6 && hour < 18 ? 'day' : 'night';
      };
      assert.ok(entries.every(entry => periodFor(entry) === page.period.key), `${page.analytics.key} analytics stay within ${page.period.key}`);
    }
    if (page.dimension === 'classification') assert.equal(page.period.key, 'day', 'classification remains a single daytime report scope');
  }
  for (const dimension of ['plate', 'classification']) {
    const evidence = pages.filter(page => page.kind === 'evidence' && page.dimension === dimension);
    const order = { incorrect: 0, 'unable-to-verify': 1, pending: 2, correct: 3 };
    assert.ok(evidence.every((page, index) => !index || order[evidence[index - 1].group.key] <= order[page.group.key]));
    const summaryRows = pages.filter(page => page.kind === 'summary' && page.dimension === dimension).flatMap(page => (page.periods || [page]).flatMap(period => period.groups.flatMap(group => group.entries.map(entry => entry.row.id))));
    const evidenceRows = evidence.flatMap(page => page.entries.map(entry => entry.row.id));
    assert.deepEqual([...evidenceRows].sort(), [...summaryRows].sort());
    assert.equal(new Set(evidenceRows).size, evidenceRows.length);
  }
};
for (const context of [null, 'plate', 'classification']) for (const scope of ['all', 'day', 'night']) {
  const pages = buildVehicleSnapshotEvidencePages(report, { context, scope });
  verify(pages);
  if (context) assert.ok(pages.every(page => page.dimension === context));
}
const systems = { systems: ['hs', 'imps'].map(key => ({ key, label: key.toUpperCase(), contexts: { plate: { ...report, independentContext: 'plate' }, classification: { ...report, independentContext: 'classification' } } })) };
const combined = buildVehicleSnapshotEvidencePages(systems);
for (const key of ['hs', 'imps']) verify(combined.filter(page => page.systemKey === key));
assert.deepEqual([...new Set(combined.map(page => page.systemKey))], ['hs', 'imps']);
verify(buildVehicleSnapshotEvidencePages({ rows: [], supportsClassification: true }));
assert.deepEqual(report, original);
console.log('PASS report order and period isolation: overview, reasons, pairs, groups, lanes/time, evidence; scopes, systems, unknown/empty, every record once and immutable data');
