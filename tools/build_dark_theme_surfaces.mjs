import fs from 'node:fs';
import postcss from 'postcss';
const files = ['foundation','redesign','workspace-layout','station-profile-route','vehicle-review-route','vehicle-review-entry','printable-report-route','contracts','master-select','vehicle-sample-eligibility','plum-theme','vehicle-review-workspace','vehicle-photo-review','vehicle-snapshot-evidence'];
const protectedSelector = ':not(:where(.ops-print-report, .ops-print-report *, .contract-agreement-cover, .contract-agreement-cover *, .ops-vehicle-report, .ops-vehicle-report *, [data-print-document], [data-print-document] *))';
const palette = {
  '#6b7f99':'var(--ops-muted-soft)', '#51637d':'var(--ops-ink-soft)',
  '#506984':'var(--ops-muted-soft)',
  '#b33d3d':'var(--ops-danger)', '#95600b':'var(--ops-warning)', '#8a5a00':'var(--ops-warning)',
  '#fff':'var(--ops-card)', '#ffffff':'var(--ops-card)',
  '#0f172a':'var(--ops-ink)', '#10243b':'var(--ops-ink)', '#16324f':'var(--ops-ink)', '#1e293b':'var(--ops-ink)', '#334155':'var(--ops-ink-soft)', '#475569':'var(--ops-ink-soft)', '#64748b':'var(--ops-muted-soft)',
  '#991b1b':'var(--ops-danger)', '#7f1d1d':'var(--ops-danger)', '#b45309':'var(--ops-warning)', '#92400e':'var(--ops-warning)', '#9a3412':'var(--ops-warning)', '#c2410c':'var(--ops-warning)', '#166534':'var(--ops-success)', '#065f46':'var(--ops-success)', '#1d4ed8':'var(--ops-color-link)', '#1e40af':'var(--ops-color-link)', '#b91c1c':'var(--ops-danger)', '#a52d2d':'var(--ops-danger)', '#79530e':'var(--ops-warning)', '#805500':'var(--ops-warning)', '#9a5b00':'var(--ops-warning)', '#15803d':'var(--ops-success)',
};
function replacement(hex, property) {
  hex = hex.toLowerCase();
  if (['#fff','#ffffff'].includes(hex) && property === 'color') return hex;
  if (palette[hex]) return property === "color" || ["#fff", "#ffffff"].includes(hex) ? palette[hex] : hex;
  if (hex.length !== 7) return hex;
  const [r,g,b] = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16));
  if (property === "color" || Math.min(r,g,b) < 175) return hex;
  const isBorder = property.startsWith('border');
  if (r > g + 7 && Math.abs(g-b) < 10) return isBorder ? 'var(--ops-color-danger-border)' : 'var(--ops-danger-soft)';
  if (r > g + 12 && r > b + 18) return isBorder ? 'var(--ops-color-warning-border)' : 'var(--ops-warning-soft)';
  if (r > b + 12 && g > b + 8) return isBorder ? 'var(--ops-color-attention-border)' : 'var(--ops-warning-soft)';
  if (g > r + 6 && g > b + 3) return isBorder ? 'var(--ops-color-success-border)' : 'var(--ops-success-soft)';
  return isBorder ? 'var(--ops-line)' : 'var(--ops-color-neutral-surface)';
}
const output = postcss.root();
for (const file of files) {
  const input = postcss.parse(fs.readFileSync(`src/styles/${file}.css`,'utf8'));
  const extract = (container, target) => {
    for (const node of container.nodes || []) {
      if (node.type === 'atrule' && ['media','supports','container'].includes(node.name)) {
        if (node.name === 'media' && /print/.test(node.params)) continue;
        const copy = node.clone({nodes:[]}); extract(node,copy); if (copy.nodes.length) target.append(copy);
      } else if (node.type === 'rule') {
        if (/print|company-report|agreement-cover|vehicle-report|::|:root/.test(node.selector)) continue;
        const declarations = [];
        for (const declaration of node.nodes || []) {
          if (declaration.type !== 'decl' || !/^(background|color$|border)/.test(declaration.prop)) continue;
          const baseValue = declaration.prop.startsWith("background") ? declaration.value.replaceAll("var(--ops-color-white)", "var(--ops-card)").replace(/\bwhite\b/g, "var(--ops-card)") : declaration.value;
          const readableValue = declaration.prop === 'color'
            ? baseValue.replace(/var\(--ops-(?:color-primary(?:-hover)?|blue(?:-hover)?)\)/g, 'var(--ops-color-link)')
            : baseValue;
          const hoverOnly = node.selector.includes(':hover') && node.selector.split(',').every(selector => /:hover|:focus/.test(selector)) && !/is-selected|is-active|aria-selected|aria-pressed/.test(node.selector);
          const value = readableValue.replace(/#[a-f\d]{3,8}\b/gi, hex => {
            const adapted = replacement(hex, declaration.prop);
            if (!hoverOnly) return adapted;
            if (adapted === 'var(--ops-line)') return 'var(--ops-interaction-border)';
            if (adapted === 'var(--ops-color-neutral-surface)') return 'var(--ops-interaction-hover)';
            return adapted;
          });
          if (value !== declaration.value) declarations.push(declaration.clone({value}));
        }
        if (declarations.length) target.append(postcss.rule({selector:`:root[data-theme="dark"] :is(${node.selector})${protectedSelector}`,nodes:declarations}));
      }
    }
  };
  extract(input,output);
}
fs.writeFileSync('src/styles/dark-theme-surfaces.css','/* Legacy literal colors adapted for dark screens. Regenerate with tools/build_dark_theme_surfaces.mjs. */\n@media screen {\n'+output.toString()+'\n}\n');
const light = fs.readFileSync('src/styles/tokens.css','utf8').replace(':root {', ':root[data-theme] :is(.ops-print-report, .contract-agreement-cover, .ops-vehicle-report, [data-print-document]) {');
const documentTokens = light.replace('color-scheme: light;', 'color-scheme: light;\n  background-color: #ffffff;\n  color: #0f172a;');
fs.writeFileSync('src/styles/dark-theme-documents.css','/* Light tokens for report previews; generated with tools/build_dark_theme_surfaces.mjs. */\n@media screen {\n'+documentTokens+'\n}\n');

const accents = postcss.root();
function neutralAccent(value, property) {
  return value.replace(/#[a-f\d]{6}\b/gi, hex => {
    const [r,g,b] = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16));
    if (!(b > r + 15 && b >= g && g > r) && !(g > r + 40 && b > r + 40)) return hex;
    if (property === 'color') return 'var(--ops-color-link)';
    if (/border|outline/.test(property)) return 'var(--ops-color-primary-border)';
    if (/shadow/.test(property)) return 'var(--ops-color-primary-shadow)';
    if (Math.min(r,g,b) > 170) return 'var(--ops-color-primary-soft)';
    if (Math.max(r,g,b) < 130) return 'var(--ops-card)';
    return 'var(--ops-color-primary)';
  }).replace(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([.\d]+))?\s*\)/g, (original,r,g,b,alpha) => {
    if (!(Number(b)>Number(r)+25 && Number(b)>=Number(g))) return original;
    return `rgba(127, 127, 127, ${alpha || 1})`;
  });
}
for (const file of files) {
 const input = postcss.parse(fs.readFileSync(`src/styles/${file}.css`, 'utf8'));
 const extract = (container,target) => {
  for (const node of container.nodes || []) {
   if(node.type === 'atrule' && ['media','supports','container'].includes(node.name)) {
    if(node.name === 'media' && /print/.test(node.params)) continue;
    const copy=node.clone({nodes:[]}); extract(node,copy); if(copy.nodes.length) target.append(copy);
   } else if(node.type === 'rule' && !/print|company-report|agreement-cover|vehicle-report|::|:root/.test(node.selector)) {
    const declarations=[];
    for(const decl of node.nodes || []) {
     if(decl.type !== 'decl' || !/^(background|color$|border|outline|box-shadow)/.test(decl.prop)) continue;
     const value=neutralAccent(decl.value,decl.prop);
     if(value !== decl.value) declarations.push(decl.clone({value}));
    }
    if(declarations.length) target.append(postcss.rule({selector:`:root[data-theme] :is(${node.selector})${protectedSelector}`,nodes:declarations}));
   }
  }
 };
 extract(input,accents);
}
fs.writeFileSync('src/styles/monochrome-accents.css','/* Screen accents generated by tools/build_dark_theme_surfaces.mjs. */\n@media screen {\n'+accents.toString()+'\n}\n');
