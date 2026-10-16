import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
for (const version of process.argv.slice(2).length
  ? process.argv.slice(2)
  : [JSON.parse(fs.readFileSync(path.join(workspace, 'game/package.json'), 'utf8')).version]) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw Error('Invalid version');
  const root = path.join(workspace, 'output/releases/v' + version);
  const source = path.join(root, 'source');
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, 'manifest.json'), 'utf8').replace(/^\uFEFF/, ''),
  );
  if (manifest.version !== version) throw Error('Manifest version mismatch');
  for (const item of manifest.files) {
    const target = path.resolve(source, item.path);
    if (!target.startsWith(source + path.sep)) throw Error('Manifest outside release');
    const data = fs.readFileSync(target);
    const hash = createHash('sha256').update(data).digest('hex');
    if (data.length !== item.bytes || hash !== item.sha256)
      throw Error('Release changed: ' + item.path);
  }
  if (!fs.existsSync(path.join(root, 'bubble-arcade-v' + version + '.zip')))
    throw Error('Missing ZIP');
  console.log(`v${version}: ${manifest.files.length} file hashes verified; ZIP present`);
}
