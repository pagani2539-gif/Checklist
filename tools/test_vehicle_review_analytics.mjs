import assert from "node:assert/strict";
import { buildVehicleReviewAnalytics } from "../src/domain/vehicle-review-analytics.js";
import { getConfirmedVehicleField } from "../src/domain/vehicle-review-confirmation.js";
import { buildVehicleSnapshotEvidencePages } from "../src/domain/vehicle-snapshot-evidence.js";

const make = (id, status, province, detail = {}, extra = {}) => ({
  row: { id, reviewStatus: status, province, plateNumber: "กข 1234", lane: "1", occurredAt: "2026-10-10T10:00", ...extra }, detail, reasonLabel: "เหตุผลทดสอบ",
});
const entries = [
  make("correct", "correct", "กรุงเทพมหานคร"),
  make("full", "incorrect", "กรุงเทพมหานคร", { confirmedProvince: "ชลบุรี", confirmedPlateNumber: "กข 5678" }),
  make("old-province", "incorrect", "กรุงเทพมหานคร", { correctionTarget: "province", correctedValue: "ชลบุรี" }),
  make("old-number", "incorrect", "ระยอง", { correctionTarget: "plate-number", correctedValue: "กข 5678" }),
  make("partial-province", "unable-to-verify", "กรุงเทพมหานคร", { verificationScope: "number-unverified", correctedValue: "ชลบุรี" }),
  make("partial-number", "unable-to-verify", "ระยอง", { verificationScope: "province-unverified", confirmedProvince: "ชลบุรี", correctedValue: "กข 5678" }),
  make("pending", "pending", "ระยอง", { confirmedProvince: "ชลบุรี" }),
  make("both", "unable-to-verify", null, { verificationScope: "both-unverified", confirmedProvince: "ชลบุรี" }),
  make("missing", "incorrect", null, { confirmedProvince: "ชลบุรี" }),
  make("same", "incorrect", "ระยอง", { confirmedProvince: "ระยอง" }),
];
const before = JSON.stringify(entries);
const results = buildVehicleReviewAnalytics(entries, "plate");
const get = key => results.find(section => section.key === key);
for (const section of results.filter(section => !section.pairs)) {
  assert.equal(section.rows.reduce((sum, row) => sum + row.count, 0), 10);
  assert.ok(section.rows.every(row => row.correct + row.incorrect + row.unableToVerify + row.pending === row.count));
}
assert.equal(get("confirmed").rows.find(row => row.label === "ชลบุรี").count, 4);
assert.equal(get("confirmed").rows.find(row => row.label === "ชลบุรี").incorrect, 3, "corrections preserve original wrong status");
assert.equal(get("confirmed").rows.find(row => row.label === "ยังไม่มีข้อมูลยืนยัน").count, 4);
assert.equal(get("pairs").rows.length, 2);
assert.equal(get("pairs").rows[0].count, 2);
assert.equal(get("pairs").rows[0].share, 20, "pair percentage uses whole sample");
assert.equal(get("pairs").rows[1].from, "ไม่ระบุจากระบบ");
assert.equal(get("api").rows[0].rank, 1);
assert.equal(get("api").rows[1].rank, 1, "equal counts share rank");
assert.equal(get("api").rows[2].rank, 3);
assert.equal(JSON.stringify(entries), before, "derivation is immutable");
assert.equal(getConfirmedVehicleField(entries[5].row, entries[5].detail, "unable-to-verify", "province"), "");
assert.equal(getConfirmedVehicleField(entries[3].row, entries[3].detail, "incorrect", "province"), "");

const boundary = ["2026-10-09T22:59:00Z", "2026-10-09T23:00:00Z", "2026-10-10T10:59:00Z", "2026-10-10T11:00:00Z", "2026-10-10T06:00:00", "bad", null];
const timed = buildVehicleReviewAnalytics(boundary.map((time, index) => make(String(index), "pending", null, {}, { occurredAt: time, lane: index === 6 ? null : "1" })), "plate");
assert.deepEqual(timed.find(section => section.key === "hours").rows.map(row => row.label), ["05:00–05:59", "06:00–06:59", "17:00–17:59", "18:00–18:59", "ไม่พบเวลา"]);
assert.deepEqual(timed.find(section => section.key === "periods").rows.map(row => row.count), [3, 2, 2]);

const classEntries = [
  make("c1", "pending", null, {}, { classificationReviewStatus: "correct", vehicleClassLabel: "รถ 6 ล้อ (15 ตัน)" }),
  make("c2", "pending", null, { correctedValue: "รถ 10 ล้อ (25 ตัน)" }, { classificationReviewStatus: "incorrect", vehicleClassLabel: "รถ 6 ล้อ (15 ตัน)" }),
  make("c3", "pending", null, { correctedValue: "รถ 10 ล้อ (25 ตัน)" }, { classificationReviewStatus: "unable-to-verify", vehicleClassLabel: "รถ 6 ล้อ (15 ตัน)" }),
];
const classes = buildVehicleReviewAnalytics(classEntries, "classification");
assert.equal(classes.find(section => section.key === "pairs").rows[0].count, 1);
assert.equal(classes.find(section => section.key === "confirmed").rows.find(row => row.label === "ยังไม่มีข้อมูลยืนยัน").count, 1);
assert.ok(!classes.some(section => section.key === "periods"), "day-only classification does not repeat the existing day summary");
const agreed = buildVehicleReviewAnalytics([make("one", "correct", "ชลบุรี")], "plate");
assert.equal(agreed.filter(section => section.basis).length, 1, "identical source and confirmed values share one table");
assert.equal(agreed.find(section => section.basis).basis, "both");
const swapped = buildVehicleReviewAnalytics([make("one", "incorrect", "ชลบุรี", { confirmedProvince: "ระยอง" }), make("two", "incorrect", "ระยอง", { confirmedProvince: "ชลบุรี" })], "plate");
assert.equal(swapped.filter(section => section.basis).length, 2, "matching totals alone cannot merge different per-record truth");

const source = {
  rows: entries.map(entry => ({ ...entry.row, reviewDetails: { plate: entry.detail } })),
  excludedRows: [{ id: "excluded", province: "ห้ามนับ" }],
};
source.rows.push({ ...source.rows[0], id: "night", occurredAt: "2026-10-10T22:00", province: "เชียงใหม่" });
const sourceBefore = JSON.stringify(source);
for (const [scope, total] of [["day", 10], ["night", 1], ["all", 11]]) {
  const pages = buildVehicleSnapshotEvidencePages(source, { context: "plate", scope });
  const analytics = pages.filter(page => page.kind === 'analytics');
  assert.ok(analytics.every(page => page.analytics.total === (scope === 'all' && page.period.key === 'day' ? 10 : scope === 'all' && page.period.key === 'night' ? 1 : total)));
  for (const page of analytics) {
    assert.ok(page.analytics.title.includes(page.period.label), 'plate detail retains its period label');
    if (page.analytics.basis) {
      assert.equal(page.analytics.rows.reduce((sum, row) => sum + row.count, 0), page.analytics.total);
       assert.ok(page.analytics.rows.every(row => row.entries.every(entry => (entry.row.id === 'night' ? 'night' : 'day') === page.period.key)));
    }
  }
  if (scope === 'all') {
    assert.deepEqual([...new Set(analytics.filter(page => page.analytics.basis).map(page => page.period.key))], ['day', 'night']);
    assert.ok(analytics.every(page => page.period.key !== 'all'), 'all-period detail rows are not pooled');
  }
  assert.equal(new Set(pages.map(page => page.key)).size, pages.length);
}
const classificationReportPages = buildVehicleSnapshotEvidencePages({
  rows: classEntries.map(entry => ({ ...entry.row, reviewDetails: { classification: entry.detail } })),
  supportsClassification: true,
  outcome: { status: "passed" },
}, { context: "classification" });
assert.ok(classificationReportPages.every(page => page.period.key === "day"), "classification data remains daytime scoped internally");
for (const page of classificationReportPages.filter(page => page.kind === "analytics")) {
  assert.ok(!page.title.includes("กลางวัน"), "classification report titles omit the daytime label");
  assert.equal(page.analytics.periodLabel, "", "classification table captions omit the daytime label");
}
const manyRows = Array.from({ length: 19 }, (_, index) => ({ ...source.rows[0], id: `many-${index}`, province: `จังหวัด ${index}` }));
const paged = buildVehicleSnapshotEvidencePages({ rows: manyRows }, { context: "plate", scope: "day" }).filter(page => page.kind === "analytics" && page.analytics.key === "agreed");
assert.deepEqual(paged.map(page => page.analytics.rows.length), [19]);
const systems = buildVehicleSnapshotEvidencePages({ systems: [{ key: "hs", label: "HS", contexts: { plate: source } }, { key: "ls", label: "LS", contexts: { plate: { rows: [source.rows[0]] } } }] }, { context: "plate", scope: "day" });
assert.equal(systems.find(page => page.kind === "analytics" && page.systemKey === "hs").analytics.total, 10);
assert.equal(systems.find(page => page.kind === "analytics" && page.systemKey === "ls").analytics.total, 1);
assert.equal(new Set(systems.map(page => page.key)).size, systems.length);
const classificationPages = buildVehicleSnapshotEvidencePages({ rows: [...classEntries.map(entry => ({ ...entry.row, reviewDetails: { classification: entry.detail } })), { ...classEntries[0].row, id: "night-class", occurredAt: "2026-10-10T22:00" }], supportsClassification: true }, { context: "classification" });
assert.ok(classificationPages.filter(page => page.kind === "analytics").every(page => page.total === 3));
const empty = buildVehicleSnapshotEvidencePages({ rows: [] }, { context: "plate", scope: "day" }).filter(page => page.kind === "analytics");
assert.equal(empty.length, 6);
assert.ok(empty.every(page => page.analytics.total === 0 && page.analytics.rows.length === 0));
assert.equal(JSON.stringify(source), sourceBefore);
const scored = buildVehicleSnapshotEvidencePages({ rows: [source.rows[0]], sourceCount: 2, eligibleCount: 1, excludedCount: 1, sampleEligibilityPolicyVersion: "plate-evidence-v2", excludedRows: [{ id: "excluded", occurredAt: "2026-10-10T10:00", province: "ห้ามนับ" }] }, { context: "plate", scope: "day" });
assert.ok(scored.filter(page => page.kind === "analytics").every(page => page.analytics.total === 1));
assert.ok(scored.filter(page => page.kind === "analytics").every(page => !page.analytics.rows.some(row => row.label === "ห้ามนับ")));
console.log("PASS vehicle analytics: totals, truth/legacy/partial, ranks, pairs, Thai boundaries, scope/system isolation, empty sets, pagination and immutability");
