import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const walk = (d) =>
  fs
    .readdirSync(d, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
let checked = 0;
for (const folder of ['src', 'dev', 'tests', 'tools'])
  for (const file of walk(path.join(root, folder))) {
    if (!/\.(?:mjs|cjs)$/.test(file)) continue;
    const result = spawnSync(process.execPath, ['--check', file], {
      encoding: 'utf8',
      windowsHide: true,
    });
    if (result.status !== 0) throw Error(result.stderr);
    checked++;
    const source = fs.readFileSync(file, 'utf8');
    if (folder === 'src') {
      if (/gameplay-v\d|demo-v\d|implementation\//.test(source))
        throw Error('Historical dependency in ' + file);
      if (/from\s*['"][^'"]*(?:\/dev\/|\/tests\/)/.test(source))
        throw Error('Runtime imports development code in ' + file);
    }
    {
      for (const match of source.matchAll(
        /(?:from\s*|import\s*\(?\s*|require\s*\(\s*)['"](\.[^'"]+)['"]/g,
      )) {
        if (!fs.existsSync(path.resolve(path.dirname(file), match[1])))
          throw Error('Missing import ' + file + ' -> ' + match[1]);
      }
    }
  }
for (const file of [
  'index.html',
  'style.css',
  'vendor/babylon/babylon.js',
  'assets/fonts/ArcadeDisplay.ttf',
  'assets/images/orbs-refined.png',
])
  if (!fs.existsSync(path.join(root, file))) throw Error('Missing ' + file);
console.log(
  'Syntax and relative imports checked: ' +
    checked +
    ' modules; canonical runtime has no historical dependency.',
);
