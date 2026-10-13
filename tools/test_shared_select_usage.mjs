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
console.log('PASS app dropdowns use shared components; no native select or datalist');
