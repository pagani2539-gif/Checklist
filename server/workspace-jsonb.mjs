// Compile already validated workspace changes to parameterized JSONB updates.
// IDs become array positions under the same row lock used to validate the save.
export function buildJsonbMutation(column, current, operations, parameters, finalDocument) {
  if (!/^[a-z_]+$/.test(column)) throw Error('Invalid JSONB column');
  let expression = column;
  let stage = structuredClone(current);
  const bind = value => { parameters.push(value); return `$${parameters.length}`; };
  if (finalDocument !== undefined) {
    const read = (root,path) => path.reduce((value,part) => typeof part === 'string' ? value?.[part] : value?.find(entry=>entry?.id===part.id),root);
    const groups = new Map();
    for (const op of operations) {
      if (op.type==='check') continue;
      const row = op.path.findLastIndex(part=>typeof part==='object');
      const item = op.path.indexOf('inspectionItems');
      const length = item >= 0 && op.path.length > item + 1 ? item + 2 : row >= 0 && (op.path.includes('rows') || op.path.includes('sourceRows')) ? row + 1 : 0;
      if (!length) continue;
      const path = op.path.slice(0,length); const key = JSON.stringify(path);
      const group = groups.get(key) || { path, operations: [] }; group.operations.push(op); groups.set(key,group);
    }
    const combined = new Map();
    const omitted = new Set();
    for (const group of groups.values()) if (group.operations.length > 1 && read(current,group.path) !== undefined) {
      const value = read(finalDocument,group.path);
      combined.set(group.operations[0],{type:value===undefined?'remove':'set',path:group.path,value});
      group.operations.slice(1).forEach(op=>omitted.add(op));
    }
    operations = operations.filter(op=>!omitted.has(op)).map(op=>combined.get(op)||op);
  }
  for (const op of operations) {
    if (op.type === 'check') continue;
    if (!op.path.length) { stage = op.type === 'remove' ? null : structuredClone(op.value); expression = `${bind(JSON.stringify(stage))}::jsonb`; continue; }
    let parent = stage;
    const path = [];
    for (const part of op.path.slice(0,-1)) {
      const key = typeof part === 'string' ? part : parent.findIndex(value => value?.id === part.id);
      path.push(String(key)); parent = parent[key];
    }
    const last = op.path.at(-1);
    let key = typeof last === 'string' ? last : parent.findIndex(value => value?.id === last.id);
    const insert = typeof last !== 'string' && key < 0 && op.type !== 'remove';
    if (insert) { key = parent.findIndex(value => value?.id === op.beforeId); if (key < 0) key = parent.length; }
    path.push(String(key));
    if (op.type === 'remove') { expression = `(${expression} #- ${bind(path)}::text[])`; if (Array.isArray(parent)) { if (key >= 0) parent.splice(key,1); } else delete parent[key]; continue; }
    let value = op.type === 'touch' && parent[key] > op.value ? parent[key] : op.value;
    if (op.type === 'order') { const map = new Map(parent[key].map(value => [value.id,value])); value = op.value.map(id => map.get(id)); }
    expression = `${insert ? 'jsonb_insert' : 'jsonb_set'}(${expression},${bind(path)}::text[],${bind(JSON.stringify(value))}::jsonb,${insert ? 'false' : 'true'})`;
    if (insert) parent.splice(key,0,structuredClone(value)); else parent[key] = structuredClone(value);
  }
  return expression;
}
