import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';
import { PostgresChecklistStore } from '../server/postgres-store.mjs';
import { applyWorkspaceOperations } from '../src/domain/workspace-operations.js';
import { addThreeDCleaningToOpenRound } from '../src/domain/three-d-cleaning.js';
import { getItemsForSnapshot, getPrintableSectionsForSnapshot } from '../src/domain/master-checklist.js';
import { getChecklistPageNavigationItems } from '../src/domain/checklist-queue-state.js';
import { buildReportTemplateModel } from '../src/domain/report-template.js';

const roundId = process.argv[2];
assert.ok(roundId, 'Specify the exact open round id');
const apply = process.argv.includes('--apply');
const pool = new pg.Pool({ connectionString: process.env.CHECKLIST_DATABASE_URL });
const store = Object.create(PostgresChecklistStore.prototype);
store.pool = pool;
store.ready = Promise.resolve();
try {
  const { state, version } = await store.getState();
  const original = state.inspectionRounds.find(round => round.id === roundId);
  assert.ok(original, 'Round not found');
  const { round: updated, items } = addThreeDCleaningToOpenRound(original);
  assert.ok(items.length, 'No eligible 3D cleaning items');
  for (const [id, value] of Object.entries(original.inspectionItems || {})) assert.deepEqual(updated.inspectionItems[id], value);
  const expectedSnapshot = { ...updated.snapshot, evidenceCatalog: original.snapshot.evidenceCatalog };
  if (!original.snapshot.threeDCleaningVersion) delete expectedSnapshot.threeDCleaningVersion;
  assert.deepEqual(expectedSnapshot, original.snapshot);
  const newIds = items.filter(item => !original.inspectionItems?.[item.id]).map(item => item.id);
  const addedSlots = updated.snapshot.evidenceCatalog.length - (original.snapshot.evidenceCatalog || []).length;
  const summary = { roundId, station: original.snapshot.stationName, baseVersion: version, newItems: newIds.length, addedSlots,
    equipment: items.map(item => ({ assetNo: item.assetNo, id: item.id })) };
  if (!apply || JSON.stringify(original) === JSON.stringify(updated)) {
    console.log(JSON.stringify({ ...summary, saved: false, mode: apply ? 'already-upgraded' : 'plan' }, null, 2));
  } else {
    const folder = path.resolve('.scratch/3d-cleaning-upgrade');
    fs.mkdirSync(folder, { recursive: true });
    const backup = path.join(folder, `${roundId}-${Date.now()}-before.json`);
    fs.writeFileSync(backup, JSON.stringify({ version, round: original }, null, 2), { flag: 'wx' });
    const operations = [{ type: 'set', path: ['inspectionRounds', { id: roundId }], exists: true, before: original, value: updated }];
    const result = await store.saveOperations({ operationId: crypto.randomUUID(), operations }, {
      actor: { id: 'codex-maintenance', role: 'admin' }, reason: 'user-requested-add-3d-cleaning-to-open-round',
      prepareOperation: (current, ops) => applyWorkspaceOperations(current, ops),
    });
    const verified = await store.getState();
    const currentRound = verified.state.inspectionRounds.find(round => round.id === roundId);
    assert.deepEqual(currentRound, JSON.parse(JSON.stringify(updated)));
    const originalItemIds = new Set(getItemsForSnapshot(original.snapshot).map(item => item.id));
    const currentItems = getItemsForSnapshot(currentRound.snapshot);
    assert.ok([...originalItemIds].every(id => currentItems.some(item => item.id === id)));
    const queue = getChecklistPageNavigationItems(getPrintableSectionsForSnapshot(currentRound.snapshot), currentRound.snapshot.stationFormat, currentRound.snapshot);
    const report = buildReportTemplateModel(currentRound);
    for (const item of items) {
      assert.ok(queue.some(entry => entry.id === item.id));
      assert.ok(report.sections.flatMap(section => section.items).some(entry => entry.id === item.id));
      assert.equal(currentRound.inspectionItems[item.id].status, original.inspectionItems?.[item.id]?.status || 'pending');
    }
    const projection = await pool.query('SELECT data FROM inspection_rounds WHERE id=$1', [roundId]);
    assert.deepEqual(projection.rows[0].data, currentRound);
    const otherRoundsUnchanged = state.inspectionRounds.filter(round => round.id !== roundId)
      .every(round => JSON.stringify(round) === JSON.stringify(verified.state.inspectionRounds.find(other => other.id === round.id)));
    console.log(JSON.stringify({ ...summary, saved: true, version: result.version, backup,
      oldResultsPreserved: true, queueVerified: true, reportVerified: true, projectionVerified: true, otherRoundsUnchanged }, null, 2));
  }
} finally { await pool.end(); }
