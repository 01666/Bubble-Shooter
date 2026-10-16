import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { EndlessGame, MemoryStore, SimulatedDispenser } from '../src/core/index.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseline = path.resolve(
  process.argv[2] || path.join(root, '../output/refactor-baseline/v1.7.3/game'),
);
const before = await import(pathToFileURL(path.join(baseline, 'src/core/index.mjs')));
const walk = (d) =>
  fs
    .readdirSync(d, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
let assets = 0;
for (const dir of ['assets', 'vendor'])
  for (const f of walk(path.join(baseline, dir))) {
    const rel = path.relative(baseline, f);
    const hash = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    assert.equal(hash(path.join(root, rel)), hash(f), rel);
    assets++;
  }
let commands = 0,
  shots = 0;
for (const densityEnabled of [true, false])
  for (const seed of [17, 73, 817, 20261010]) {
    const logs = [[], []],
      stores = [new before.MemoryStore(), new MemoryStore()];
    let games = [
      new before.EndlessGame({
        seed,
        config: { densityEnabled },
        store: stores[0],
        onEvent: (e) => logs[0].push(e),
      }),
      new EndlessGame({
        seed,
        config: { densityEnabled },
        store: stores[1],
        onEvent: (e) => logs[1].push(e),
      }),
    ];
    const devices = [new before.SimulatedDispenser(), new SimulatedDispenser()];
    function compare() {
      assert.deepEqual(
        games[1].exportState(),
        games[0].exportState(),
        `state seed ${seed} shot ${shots}`,
      );
      assert.deepEqual(logs[1], logs[0], `events seed ${seed}`);
      commands++;
    }
    compare();
    for (let i = 0; i < 60; i++) {
      for (const g of games) if (!g.s.paidAmmo) g.coin({ receiptId: `comparison-${i}` });
      const angle =
        i % 3 === 0
          ? Math.sin(i * 1.731) * 1.1
          : (games[0]
              .opportunities()
              .sort(
                (a, b) => b.direct.length + b.dropped.length - a.direct.length - a.dropped.length,
              )[0]?.angle ?? 0);
      for (const g of games) {
        g.setAim(angle);
        g.fire();
      }
      compare();
      let frames = 0;
      while (games[0].s.projectile || games[0].s.cooldown > 0 || games[0].s.content.flow?.pending) {
        assert.ok(frames++ < 250, 'bounded settle');
        for (let n = 0; n < 2; n++) {
          games[n].advance(0.05);
          devices[n].tick(games[n], 0.05);
        }
        compare();
      }
      shots++;
      if (i % 10 === 7) {
        games = [
          new before.EndlessGame({
            config: { densityEnabled },
            store: stores[0],
            onEvent: (e) => logs[0].push(e),
          }),
          new EndlessGame({
            config: { densityEnabled },
            store: stores[1],
            onEvent: (e) => logs[1].push(e),
          }),
        ];
        compare();
      }
      if (i % 10 === 9) {
        if (games[0].s.paidAmmo === 0) {
          for (const g of games) g.fire();
          while (games[0].s.projectile) {
            for (const g of games) g.advance(0.05);
            compare();
          }
        }
      }
      logs[0].length = logs[1].length = 0;
    }
  }
const report = {
  baseline: JSON.parse(fs.readFileSync(path.join(baseline, 'package.json'), 'utf8')).version,
  candidate: JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version,
  shots,
  comparedStatesAndEventBatches: commands,
  unchangedAssetFiles: assets,
  passed: true,
};
const out = path.resolve(root, '../output/verification/v' + report.candidate);
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'core-equivalence.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
