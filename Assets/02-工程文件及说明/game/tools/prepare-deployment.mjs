// Build a public-only site from an immutable release. Never deploy the working tree.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version)) throw Error('Expected release version');
const release = path.join(workspace, 'output/releases/v' + version);
const source = path.join(release, 'source/game');
const manifest = JSON.parse(
  fs.readFileSync(path.join(release, 'manifest.json'), 'utf8').replace(/^\uFEFF/, ''),
);
for (const item of manifest.files) {
  if (!item.path.startsWith('game/')) continue;
  const file = path.resolve(release, 'source', item.path);
  if (!file.startsWith(source + path.sep)) throw Error('Invalid manifest path');
  if (createHash('sha256').update(fs.readFileSync(file)).digest('hex') !== item.sha256)
    throw Error('Release modified: ' + item.path);
}
const destination = path.join(workspace, 'output/deployment/v' + version + '-http/site');
if (fs.existsSync(destination)) throw Error('Deployment already exists; refusing overwrite');
fs.mkdirSync(destination, { recursive: true });
for (const name of ['index.html', 'style.css', 'src', 'assets', 'vendor'])
  fs.cpSync(path.join(source, name), path.join(destination, name), { recursive: true });
const compat = `// UUID compatibility for public-IP HTTP; does not change game rules.
if (globalThis.crypto && typeof crypto.randomUUID !== 'function') {
  Object.defineProperty(crypto, 'randomUUID', { configurable: true, value() {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
    const h = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
  }});
}
`;
fs.writeFileSync(path.join(destination, 'src/client/http-compat.js'), compat);
const html = path.join(destination, 'index.html');
fs.writeFileSync(
  html,
  fs
    .readFileSync(html, 'utf8')
    .replace(
      '<script src="vendor/babylon/babylon.js">',
      '<script src="/src/client/http-compat.js"></script>\n    <script src="vendor/babylon/babylon.js">',
    )
    .replace(
      '<script src="/vendor/babylon/babylon.js">',
      '<script src="/src/client/http-compat.js"></script>\n    <script src="/vendor/babylon/babylon.js">',
    ),
);
if (!fs.readFileSync(html, 'utf8').includes('http-compat.js'))
  throw Error('Compatibility entry missing');
fs.writeFileSync(
  path.join(destination, 'deployment.json'),
  JSON.stringify(
    {
      version,
      deployment: 'public-ip-http',
      equivalentTo: '1.7.3',
      previousPublicVersion: '1.6.1',
      builtAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);
const walk = (folder) =>
  fs
    .readdirSync(folder, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory() ? walk(path.join(folder, e.name)) : [path.join(folder, e.name)],
    );
const hashes = walk(destination).map((file) => ({
  path: path.relative(destination, file).replaceAll('\\', '/'),
  sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
}));
fs.writeFileSync(
  path.join(destination, 'deployment-sha256.txt'),
  hashes.map((f) => f.sha256 + '  ' + f.path).join('\n') + '\n',
);
console.log(JSON.stringify({ version, publicFiles: hashes.length, destination }));
