const { spawnSync } = require('node:child_process'),
  path = require('node:path'),
  fs = require('node:fs');
const version = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'),
).version;
const out = path.resolve(__dirname, '../../output/verification/v' + version);
fs.mkdirSync(out, { recursive: true });
for (const file of [
  'integration.cjs',
  'loader.cjs',
  'treasure.cjs',
  'board-motion.cjs',
  'upgrade.cjs',
  'density.cjs',
  'lightning.cjs',
  'rhythm.cjs',
  'opportunity-burst.cjs',
  'ammo-bonus.cjs',
]) {
  const result = spawnSync(
    process.execPath,
    [path.resolve(__dirname, '../tests/browser/' + file)],
    { cwd: path.resolve(__dirname, '..'), stdio: 'inherit', windowsHide: true },
  );
  if (result.status !== 0) process.exit(result.status || 1);
}
