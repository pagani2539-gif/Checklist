import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
function inspect(dir) {
 for (const entry of readdirSync(dir,{withFileTypes:true})) {
  const path=join(dir,entry.name);
  if(entry.isDirectory()) inspect(path);
  else if(path.endsWith('.jsx')) assert.doesNotMatch(readFileSync(path,'utf8'), /<select\b|<datalist\b/, `${path}: use the shared CustomSelect`);
 }
}
inspect('src/app');
const masterSelect = readFileSync('src/app/MasterSelect.jsx', 'utf8');
const masterSelectStyles = readFileSync('src/styles/master-select.css', 'utf8');
assert.match(masterSelect, /import ["']\.\.\/styles\/master-select\.css["']/,
 'MasterSelect must load its own styles on every route');
assert.match(masterSelectStyles, /\.master-select-menu\s*\{[^}]*position\s*:\s*absolute[^}]*max-height\s*:\s*300px[^}]*overflow\s*:\s*auto/i,
 'Searchable dropdown options must stay inside a bounded overlay');
assert.match(masterSelectStyles, /\.master-select-option\s*\{[^}]*width\s*:\s*100%[^}]*display\s*:\s*flex/i,
 'Searchable dropdown choices must remain a vertical list');
console.log('PASS app dropdowns use shared components and MasterSelect owns its bounded menu styles');
