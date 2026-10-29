import assert from 'node:assert/strict';
import fs from 'node:fs';
import postcss from 'postcss';

const css = fs.readFileSync(new URL('../src/styles/vehicle-test-print.css', import.meta.url), 'utf8');
const root = postcss.parse(css);
root.walkRules(rule => {
  let parent = rule.parent;
  while (parent && !(parent.type === 'atrule' && parent.name === 'media' && parent.params === 'print')) parent = parent.parent;
  assert.ok(parent, 'Vehicle print overrides must not change screen/PDF export styles');
  assert.ok(rule.selector.includes('.vehicle-test-report-page'), 'Print overrides must not change Checklist presentations');
});
assert.match(fs.readFileSync(new URL('../src/app/reports/VehicleTestReport.jsx', import.meta.url), 'utf8'), /import "\.\.\/\.\.\/styles\/vehicle-test-print\.css";/);

// Optional result from the browser CSS cascade probe. This checks physical
// geometry rather than a particular selector or the chosen named-page name.
if (process.argv[2]) {
  const geometry = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const dimensions = geometry.pageSize.split(/\s+/).map(value => {
    const [, amount, unit] = value.match(/^(\d+(?:\.\d+)?)(mm|in)$/) || [];
    assert.ok(amount && unit, `Unsupported paper dimension: ${value}`);
    return Number(amount) * (unit === 'in' ? 96 : 96 / 25.4);
  });
  assert.ok(Math.abs(geometry.contentWidth - dimensions[0]) < 1, 'Content must fill the named paper width');
  assert.ok(Math.abs(geometry.reportWidth - geometry.contentWidth) < 1, 'Report and content widths must agree');
  assert.deepEqual(geometry.pageMargins, ['0px', '0px'], 'Screen page gaps must not enter print layout');
  assert.ok(geometry.contentHeight < dimensions[1] && geometry.contentHeight > dimensions[1] - 2, 'Printed page needs a sub-2px rounding buffer');
  console.log('PASS browser-derived print geometry: paper/content width, zero page gaps, rounding buffer');
}
console.log('PASS vehicle print route ownership and isolation from screen/Checklist styles; native print pagination checked separately');
