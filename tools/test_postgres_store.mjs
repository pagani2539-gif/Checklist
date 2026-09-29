import assert from "node:assert/strict";
import { createPostgresStore } from "../server/postgres-store.mjs";

const connectionString = process.env.CHECKLIST_POSTGRES_TEST_DATABASE_URL;
if (!connectionString) {
  console.log("test_postgres_store: skipped (set CHECKLIST_POSTGRES_TEST_DATABASE_URL for integration coverage)");
  process.exit(0);
}

const store = await createPostgresStore({ connectionString });
try {
  const initial = await store.getState();
  const runId = Date.now().toString(36);
  const stationAId = `postgres-test-a-${runId}`;
  const stationBId = `postgres-test-b-${runId}`;
  const roundId = `postgres-test-round-${runId}`;
  const initialState = initial.state || {};
  const state = {
    ...initialState,
    version: 14,
    stationProfiles: [
      ...(initialState.stationProfiles || []).filter((station) => ![stationAId, stationBId].includes(station.id)),
      { id: stationAId, stationCode: "PG-A", stationName: "Postgres A", stationFormat: "SC", stationSystems: [], lanes: [], equipment: [], torItems: [] },
      { id: stationBId, stationCode: "PG-B", stationName: "Postgres B", stationFormat: "IMPS", stationSystems: [], lanes: [], equipment: [], torItems: [] },
    ],
    inspectionRounds: [
      ...(initialState.inspectionRounds || []),
      { id: roundId, stationId: stationAId, status: "draft", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), snapshot: { id: `postgres-test-snapshot-${runId}`, stationId: stationAId, snapshotSchemaVersion: "1" }, inspectionItems: { item1: { status: "pending" } } },
    ],
    inspectionHistory: initialState.inspectionHistory || [],
    inspectionWorkspaces: initialState.inspectionWorkspaces || [],
  };
  const created = await store.saveState(state, { expectedVersion: initial.version, actor: { id: "test", role: "admin" }, reason: "postgres-integration-test" });
  assert.deepEqual(new Set((await store.listStations()).filter((station) => [stationAId, stationBId].includes(station.id)).map((station) => station.id)), new Set([stationAId, stationBId]));
  assert.equal((await store.listRounds()).find((round) => round.id === roundId)?.stationId, stationAId);
  const roundAId = `${roundId}-a`;
  const roundBId = `${roundId}-b`;
  const writerA = { ...state, inspectionRounds: [...state.inspectionRounds, { id: roundAId, stationId: stationAId, status: "draft", snapshot: { stationId: stationAId }, inspectionItems: {} }] };
  const writerB = { ...state, inspectionRounds: [...state.inspectionRounds, { id: roundBId, stationId: stationBId, status: "draft", snapshot: { stationId: stationBId }, inspectionItems: {} }] };
  const afterA = await store.saveState(writerA, { expectedVersion: created.version, actor: { id: "writer-a", role: "inspector" }, reason: "station-a-save" });
  const afterB = await store.saveState(writerB, { expectedVersion: created.version, actor: { id: "writer-b", role: "inspector" }, reason: "station-b-save" });
  assert.equal(afterB.version, afterA.version + 1, "disjoint station writes should merge without a global conflict");
  const roundIds = new Set((await store.listRounds()).map((round) => round.id));
  assert.deepEqual(new Set([roundId, roundAId, roundBId].map((id) => roundIds.has(id))), new Set([true]));
  const merged = afterB.state;
  const closed = { ...merged, inspectionRounds: merged.inspectionRounds.map((round) => round.id === roundId ? { ...round, status: "closed", closedAt: new Date().toISOString() } : round) };
  const closedResult = await store.saveState(closed, { expectedVersion: afterB.version, actor: { id: "test", role: "admin" }, reason: "close" });
  await assert.rejects(() => store.saveState({ ...closed, inspectionRounds: closed.inspectionRounds.map((round) => round.id === roundId ? { ...round, inspectionItems: { item1: { status: "fail" } } } : round) }, { expectedVersion: closedResult.version, actor: { id: "test", role: "admin" } }), (error) => error.statusCode === 409 && error.code === "IMMUTABLE_ROUND");
  console.log("test_postgres_store: pass");
} finally {
  await store.close();
}
