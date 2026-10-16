import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const walk = (d) =>
  fs
    .readdirSync(d, { withFileTypes: true })
    .flatMap((e) =>
      e.name === 'node_modules' || e.name === '.git'
        ? []
        : e.isDirectory()
          ? walk(path.join(d, e.name))
          : [path.join(d, e.name)],
    );
const rel = (f) => path.relative(root, f).replaceAll('\\', '/');
const inventory = walk(path.join(root, 'game')).map((f) => ({
  path: rel(f),
  bytes: fs.statSync(f).size,
}));
const modules = inventory
  .filter((f) => f.path.startsWith('game/src/') && f.path.endsWith('.mjs'))
  .map((f) => {
    const absolute = path.join(root, f.path),
      source = fs.readFileSync(absolute, 'utf8');
    const imports = [...source.matchAll(/(?:from\s*|import\s*\(?\s*)['"](\.[^'"]+)['"]/g)].map(
      (m) => rel(path.resolve(path.dirname(absolute), m[1])),
    );
    return { ...f, lines: source.split('\n').length, imports };
  });
const graph = new Map(modules.map((m) => [m.path, m.imports]));
const reachable = new Set();
function visit(f) {
  if (reachable.has(f)) return;
  reachable.add(f);
  for (const dep of graph.get(f) || []) visit(dep);
}
visit('game/src/client/app.mjs');
const forbidden = modules.filter((m) => m.imports.some((f) => !f.startsWith('game/src/')));
if (forbidden.length)
  throw Error('Runtime imports non-runtime files: ' + JSON.stringify(forbidden));
const areas = ['game', 'docs', 'archive', 'output'].map((area) => {
  const files = walk(path.join(root, area));
  return { area, files: files.length, bytes: files.reduce((n, f) => n + fs.statSync(f).size, 0) };
});
const report = {
  version: JSON.parse(fs.readFileSync(path.join(root, 'game/package.json'), 'utf8')).version,
  generatedUtc: new Date().toISOString(),
  areas,
  activeFiles: inventory,
  runtimeModules: modules,
  reachableRuntimeModules: modules.filter((m) => reachable.has(m.path)).length,
  unreachableRuntimeModules: modules.filter((m) => !reachable.has(m.path)).map((m) => m.path),
  runtimeBoundaryPassed: true,
};
fs.writeFileSync(
  path.join(root, 'docs/' + report.version + '-project-inventory.json'),
  JSON.stringify(report, null, 2) + '\n',
);
console.log(
  JSON.stringify({
    areas,
    runtimeModules: modules.length,
    unreachable: report.unreachableRuntimeModules,
    boundaryPassed: true,
  }),
);
