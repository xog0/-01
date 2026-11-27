// Builds dist/agency.html: one self-contained page for publishing as a
// claude.ai Artifact. Same source files as the local app; Three.js comes
// from jsDelivr instead of /vendor, and the modules are inlined in order.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');
const THREE_VERSION = JSON.parse(read('package.json')).dependencies.three;

const MODULES = ['prompt.js', 'finance.js', 'data.js', 'crm.js', 'approvals.js', 'performance.js', 'docs.js', 'hr.js', 'sales.js', 'calendar.js', 'people.js', 'scene.js', 'api.js', 'cloud.js', 'app.js'];
const code = MODULES.map((name) => {
  const src = read(`public/js/${name}`)
    .replace(/^import\s[^;]*?from\s+'\.\/[^']+';\n/gm, '') // local imports become shared scope (never spans statements)
    .replace(/^export (?=(const|function|class|async|let)\b)/gm, '');
  return `// ---- ${name}\n${src}`;
}).join('\n');

// Top-level names must stay unique once the modules share one scope.
const names = new Map();
for (const name of MODULES) {
  for (const m of read(`public/js/${name}`).matchAll(/^(?:export )?(?:async )?(?:const|let|function|class) (\w+)/gm)) {
    if (names.has(m[1])) throw new Error(`"${m[1]}" is declared in both ${names.get(m[1])} and ${name}`);
    names.set(m[1], name);
  }
}

for (const lib of ["from 'three'", "from 'three/addons/controls/OrbitControls.js'", "from 'three/addons/renderers/CSS2DRenderer.js'"]) {
  if (!code.includes(lib)) throw new Error(`build dropped the import ${lib}`);
}

const html = read('public/index.html');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script type="module"')).trim();
const css = read('public/styles.css').replaceAll('</style', '<\\/style');
const cdn = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}`;

const page = `<title>وكالة آفاق للتسويق</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap">
<style>
${css}
</style>
<script type="importmap">
{ "imports": { "three": "${cdn}/build/three.module.js", "three/addons/": "${cdn}/examples/jsm/" } }
</script>
<div dir="rtl" lang="ar">
${body}
</div>
<script type="module">
${code.replaceAll('</script', '<\\/script')}
</script>
`;

mkdirSync(path.join(root, 'dist'), { recursive: true });
writeFileSync(path.join(root, 'dist', 'agency.html'), page);
console.log(`dist/agency.html (${(page.length / 1024).toFixed(0)} KB)`);
