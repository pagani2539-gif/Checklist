import assert from "node:assert/strict";
import { prepareVehicleReviewDatasets, getVehicleClassificationDataset, normalizeVehicleReviewState, getVehicleReviewOutcome } from "../src/domain/vehicle-search.js";
import { buildVehicleSnapshotEvidencePages, getPlateEvidenceComparison } from "../src/domain/vehicle-snapshot-evidence.js";
import { archiveVehicleEvidence, normalizeVehicleEvidenceImage } from "../src/domain/vehicle-evidence-images.js";
import { createDefaultStationProfile, createInspectionRound, normalizeRound } from "../src/domain/master-checklist.js";
import fs from 'node:fs/promises';
import { FilesystemAttachmentStore } from '../server/attachment-store.mjs';
import { buildReportTemplateModel } from '../src/domain/report-template.js';
import { VEHICLE_API_REVIEW_VERSION } from '../src/domain/vehicle-search.js';
import { VEHICLE_SAMPLE_ELIGIBILITY_POLICY_VERSION } from '../src/domain/vehicle-sample-eligibility.js';

const legacy = { fetchedAt: "2026-10-01T04:00:00Z", criteria: { startAt: "2026-10-01T09:00", endAt: "2026-10-01T10:00" }, rows: [{ id: "one", occurredAt: "2026-10-01T09:01", plateNumber: "50-4989", province: "กรุงเทพมหานคร", reviewStatus: "correct", classificationReviewStatus: "pending" }] };
const datasets = prepareVehicleReviewDatasets(legacy);
assert.equal(datasets.scopes.day.rows[0].reviewStatus, "correct");
assert.equal(datasets.scopes.day.rows[0].province, "กรุงเทพมหานคร");
assert.equal(datasets.scopes.night.rows.length, 0);
assert.equal(getVehicleClassificationDataset(datasets).rows.length, 1);
assert.equal(normalizeVehicleReviewState(datasets).classification.rows[0].id, "one");
assert.equal(getVehicleReviewOutcome(datasets, { context: "classification" }).scopes, undefined);
const pages = buildVehicleSnapshotEvidencePages({ rows: legacy.rows, supportsClassification: true });
assert.equal(pages.filter(page => page.dimension === "classification" && page.period.key === "night").length, 0);
assert.equal(pages[0].periods.find(page => page.period.key === 'night').total, 0);
assert.equal(buildVehicleSnapshotEvidencePages({ rows: legacy.rows }, { context: 'plate', scope: 'night' })[0].total, 0);

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV9sAAAAASUVORK5CYII=", "base64");
assert.equal((await normalizeVehicleEvidenceImage(new Blob([png], { type: "application/octet-stream" }))).type, "image/png");
await assert.rejects(normalizeVehicleEvidenceImage(new Blob(["upstream error"], { type: "text/html" })));
let requests = 0;
let saves = 0;
globalThis.fetch = async () => { requests++; return new Response(png, { headers: { "content-type": "application/octet-stream" } }); };
const round = { id: 'round-fixture', stationId: "fixture", vehicleSearch: { rows: [{ id: "one", plateImage: "https://fixture/image", lprImage: "https://fixture/image" }, { id: "two", overviewImage: "https://fixture/image" }] } };
const archive = await archiveVehicleEvidence(round, { save: async (id, file, options) => { saves++; assert.equal(file.type, "image/png"); assert.equal(options.stationId, "fixture"); assert.equal(options.roundId, 'round-fixture'); assert.equal(options.kind, 'vehicle-api/originals'); }, createId: () => "fixture-image" });
assert.equal(requests, 1);
assert.equal(saves, 1);
assert.equal(archive.one.plateImage.id, archive.two.overviewImage.id);
const profile = createDefaultStationProfile();
const inspection = createInspectionRound(profile, { inspectionDate: "2026-10-01" });
delete inspection.snapshot.vehicleReviewSystemsVersion;
delete inspection.snapshot.vehicleReviewSystems;
inspection.snapshot.vehicleReviewScopeVersion = null;
assert.equal(normalizeRound({ ...inspection, vehicleEvidenceArchive: archive }, [profile]).vehicleEvidenceArchive.one.plateImage.id, "fixture-image");
const evidenceRoot = new URL(`../.scratch/vehicle-snapshot-evidence/archive-check-${Date.now()}/`, import.meta.url);
const { fileURLToPath } = await import('node:url');
const evidenceStore = new FilesystemAttachmentStore({ root: fileURLToPath(evidenceRoot) });
let imageIndex = 0;
const archiveRound = { ...inspection, vehicleSearch: { fetchedAt: '2026-10-01T04:00:00Z', rows: [{ ...legacy.rows[0], plateImage: 'https://fixture/persisted-image' }] } };
const persistedArchive = await archiveVehicleEvidence(archiveRound, { createId: () => `proof-image-${++imageIndex}`, save: async (id, file) => evidenceStore.put(id, Buffer.from(await file.arrayBuffer())) });
const closedRound = { ...archiveRound, status: 'closed', closedAt: '2026-10-02T12:00:00Z', vehicleEvidenceArchive: persistedArchive };
await fs.writeFile(new URL('closed-round.json', evidenceRoot), JSON.stringify(closedRound));
const reopened = JSON.parse(await fs.readFile(new URL('closed-round.json', evidenceRoot), 'utf8'));
globalThis.fetch = async () => { throw new Error('station API unavailable after closure'); };
const report = buildReportTemplateModel(reopened);
const metadata = report.vehicleSearch.rows[0].apiEvidenceImages.plateImage;
assert.deepEqual(await evidenceStore.get(metadata.id), png, 'archived image must survive reopening without station API');

const plateSourceRows = [
  { id: 'scored-car', occurredAt: '2026-10-01T10:00:00+07:00', plateNumber: '70-7076', province: 'กาญจนบุรี', plateImage: 'https://fixture/plate.jpg', lprImage: 'https://fixture/lpr.jpg', reviewStatus: 'correct', sampleEligibility: { status: 'eligible', reviewedByName: 'ผู้ตรวจ', reviewedAt: '2026-10-02T13:00:00Z' } },
  { id: 'excluded-car', occurredAt: '2026-10-01T11:00:00+07:00', plateNumber: 'ไม่พบผลอ่านป้าย', province: null, sampleEligibility: { status: 'excluded', reasonCode: 'no-image', note: 'API ไม่ส่งภาพ', reviewedByName: 'ผู้ตรวจ', reviewedAt: '2026-10-02T13:01:00Z' } },
];
const eligibilityRound = {
  ...inspection,
  snapshot: { ...inspection.snapshot, vehicleReviewVersion: VEHICLE_API_REVIEW_VERSION, vehicleReviewScopeVersion: null },
  vehicleSearch: {
    fetchedAt: '2026-10-02T12:00:00Z',
    sampleEligibilityPolicyVersion: VEHICLE_SAMPLE_ELIGIBILITY_POLICY_VERSION,
    sourceRows: plateSourceRows,
    rows: [plateSourceRows[0]],
    sample: { version: 'vehicle-sample-v2', eligibilityPolicyVersion: VEHICLE_SAMPLE_ELIGIBILITY_POLICY_VERSION, method: 'time-stratified-v1', limit: 100, seed: 'fixed', lockedAt: '2026-10-02T14:00:00Z', sourceCount: 2, eligibleCount: 1, excludedCount: 1, selectedIds: ['scored-car'] },
  },
};
const eligibilityModel = buildReportTemplateModel(eligibilityRound);
assert.equal(eligibilityModel.vehicleSearch.sourceCount, 2);
assert.equal(eligibilityModel.vehicleSearch.eligibleCount, 1);
assert.equal(eligibilityModel.vehicleSearch.excludedCount, 1);
assert.equal(eligibilityModel.vehicleSearch.rows.length, 1, 'only the locked score row feeds the report denominator');
assert.equal(eligibilityModel.vehicleSearch.excludedRows[0].sampleEligibility.reviewedByName, 'ผู้ตรวจ');
const eligibilityPages = buildVehicleSnapshotEvidencePages(eligibilityModel.vehicleSearch, { context: 'plate', scope: 'day' });
const appendix = eligibilityPages.find(page => page.kind === 'excluded');
assert.equal(appendix.entries.length, 1);
assert.equal(appendix.entries[0].row.exclusionReasonLabel, 'ไม่มีภาพจากต้นทาง');
assert.equal(appendix.sourceCount, 2);
const preLockModel = buildReportTemplateModel({ ...eligibilityRound, vehicleSearch: { ...eligibilityRound.vehicleSearch, rows: plateSourceRows, sample: null } });
assert.equal(preLockModel.vehicleSearch.rows.length, 0, 'pre-lock plate source rows do not appear as scored report rows');
assert.equal(preLockModel.vehicleSearch.summary.total, 0);
assert.equal(preLockModel.vehicleSearch.excludedRows.length, 1);
console.log("PASS: Snapshot datasets, legacy reviews, plate province, image MIME, archive deduplication and persistence");
let attempts=0;
const waits=[];
const ids=[];
const resumed=await archiveVehicleEvidence({...round,vehicleEvidenceArchive:{one:{plateImage:archive.one.plateImage}}},{save:async()=>assert.fail('existing source should be reused'),createId:()=>assert.fail('existing source should keep id')});
assert.equal(resumed.two.overviewImage.id,archive.one.plateImage.id);
globalThis.fetch=async()=>new Response(png,{headers:{'content-type':'image/png'}});
await archiveVehicleEvidence({stationId:'fixture',vehicleSearch:{rows:[{id:'retry',plateImage:'https://fixture/retry'}]}},{createId:()=> 'retry-id',wait:async ms=>waits.push(ms),save:async id=>{ids.push(id);if(attempts++===0)throw Object.assign(new Error('Too many requests'),{status:429,retryAfterMs:7000});}});
assert.deepEqual(waits,[7000]);
assert.deepEqual(ids,['retry-id','retry-id']);
console.log('PASS archive upload Retry-After, same-id retry and checkpoint reuse');
const compare=getPlateEvidenceComparison({row:{plateNumber:'70-7076',province:'กาญจนบุรี'},detail:{correctionTarget:'plate-number',correctedValue:'70-7078'}},'incorrect');
assert.equal(compare[0].confirmed,'70-7078');
assert.equal(compare[0].different,true);
assert.equal(compare[1].confirmed,'ยังไม่ยืนยัน');
const fullTruth = getPlateEvidenceComparison({ row: { plateNumber: 'ไม่พบผลอ่านป้าย', province: null }, detail: { correctionTarget: 'plate-number', confirmedPlateNumber: '70-7078', confirmedProvince: 'กาญจนบุรี' } }, 'incorrect');
assert.equal(fullTruth[0].confirmed, '70-7078');
assert.equal(fullTruth[0].different, true);
assert.equal(fullTruth[1].confirmed, 'กาญจนบุรี');
assert.equal(fullTruth[1].different, true);
console.log('PASS report comparison stores full plate and province truth for missing API values');
