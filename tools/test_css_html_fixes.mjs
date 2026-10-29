import assert from 'node:assert/strict';
import { getDatePopoverPosition } from '../src/app/date-picker-position.js';
import { skipToMainContent } from '../src/app/navigation.js';

// Includes the observed 320x600 failure, edges, scrolled-out anchors and landscape.
let cases = 0;
for (const width of [320, 390, 768, 1280, 1440]) {
  for (const height of [240, 320, 600, 900]) {
    for (const top of [-100, 0, 12, height / 2 - 24, 276.2, height - 58, height + 100]) {
      for (const left of [-20, 12, width - 30]) {
        const result = getDatePopoverPosition({ left, top, bottom: top + 58 }, width, height);
        const h = Number.parseFloat(result.maxHeight);
        const y = result.top === 'auto' ? height - Number.parseFloat(result.bottom) - h : Number.parseFloat(result.top);
        const x = Number.parseFloat(result.left);
        assert.ok(y >= 8 - 1e-8 && y + h <= height - 8 + 1e-8, JSON.stringify({ width, height, top, result }));
        assert.ok(x >= 8 && x + Number.parseFloat(result.width) <= width - 8);
        assert.ok(h >= 0 && h <= 560);
        cases++;
      }
    }
  }
}
const previousDocument = globalThis.document;
let prevented = false;
const actions = [];
try {
  globalThis.document = { getElementById: id => {
    assert.equal(id, 'main-content');
    return { focus: options => actions.push(['focus', options]), scrollIntoView: options => actions.push(['scroll', options]) };
  } };
  skipToMainContent({ preventDefault: () => { prevented = true; } });
  assert.ok(prevented, 'native hash navigation must be prevented');
  assert.deepEqual(actions, [['focus', { preventScroll: true }], ['scroll', { block: 'start' }]]);
  globalThis.document = { getElementById: () => null };
  assert.doesNotThrow(() => skipToMainContent({ preventDefault() {} }));
} finally {
  if (previousDocument === undefined) delete globalThis.document;
  else globalThis.document = previousDocument;
}
console.log(`CSS/HTML fixes: ${cases} bounded calendar positions and skip-link focus behavior passed`);
