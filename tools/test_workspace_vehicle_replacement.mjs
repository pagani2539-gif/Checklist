import assert from 'node:assert/strict';
import { buildWorkspaceOperations, applyWorkspaceOperations } from '../src/domain/workspace-operations.js';

const rows = generation => Array.from({ length: 102 }, (_, index) => ({
  id: `vehicle-${index}`,
  ...Object.fromEntries(Array.from({ length: 55 }, (_, field) => [`field-${field}`, `${generation}-${field}`])),
  reviewStatus: generation === 'old' ? 'correct' : 'pending',
}));
const dataset = generation => ({ fetchedAt: generation, criteria: { startAt: generation }, rows: rows(generation), sourceRows: rows(generation) });
const original = { inspectionRounds: [{ id: 'round', status: 'draft', vehicleSearch: { systems: { 'sc-hs': { plate: { scopes: { day: dataset('day'), night: dataset('old') } }, classification: dataset('class') } } } }] };
const next = structuredClone(original);
next.inspectionRounds[0].vehicleSearch.systems['sc-hs'].plate.scopes.night = dataset('new');
const operations = buildWorkspaceOperations(original, next);
console.log(`Replacement operation count: ${operations.length}`);
assert.deepEqual(applyWorkspaceOperations(original, operations), next, 'a 102-car replacement must be accepted and preserve other datasets');
assert.ok(operations.length < 10, 'replacement should save one dataset without expanding all fields');
const concurrent = structuredClone(original);
concurrent.inspectionRounds[0].vehicleSearch.systems['sc-hs'].plate.scopes.night.rows[0].reviewStatus = 'incorrect';
assert.throws(() => applyWorkspaceOperations(concurrent, operations), /conflict|changed/i, 'replacement must reject concurrent changes to its own dataset');
const otherScope = structuredClone(original);
otherScope.inspectionRounds[0].vehicleSearch.systems['sc-hs'].plate.scopes.day.rows[0].reviewStatus = 'incorrect';
assert.equal(applyWorkspaceOperations(otherScope, operations).inspectionRounds[0].vehicleSearch.systems['sc-hs'].plate.scopes.day.rows[0].reviewStatus, 'incorrect');
console.log('Large vehicle replacement, dataset isolation and concurrent-change protection passed');
