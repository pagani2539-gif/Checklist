import assert from "node:assert/strict";
import { createUiDemoRound, UI_DEMO_FIXTURE_VERSION, UI_DEMO_ROUND_ID } from "../src/domain/demo-fixture.js";
import { buildInspectionSections, getRoundSummary } from "../src/domain/master-checklist.js";

const round = createUiDemoRound();
const summary = getRoundSummary(round);
const sections = buildInspectionSections(round.snapshot, round.templateVersion);

assert.equal(round.id, UI_DEMO_ROUND_ID);
assert.equal(round.fixtureVersion, UI_DEMO_FIXTURE_VERSION);
assert.equal(round.isDemoFixture, true);
assert.equal(summary.done, 48);
assert.equal(summary.total, 107);
assert.equal(summary.progress, 45);
assert.equal(summary.evidenceComplete, 38);
assert.equal(summary.evidenceTotal, 135);
assert.equal(sections.length, 13);

console.log(JSON.stringify({
  fixture: round.fixtureVersion,
  roundId: round.id,
  sections: sections.length,
  progress: `${summary.done}/${summary.total}`,
  evidence: `${summary.evidenceComplete}/${summary.evidenceTotal}`,
}));
