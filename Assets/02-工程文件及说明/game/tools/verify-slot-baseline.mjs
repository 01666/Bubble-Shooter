import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { EndlessGame, MemoryStore } from '../src/core/index.mjs';
import { startPetSlot } from '../src/core/pet-slots.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseline = path.resolve(
  process.argv[2] || path.join(root, '../output/refactor-baseline/v1.7.3/game'),
);
const before = await import(pathToFileURL(path.join(baseline, 'src/core/index.mjs')));
const beforeSlots = await import(pathToFileURL(path.join(baseline, 'src/core/pet-slots.mjs')));
const types = ['tickets', 'ammo', 'specials', 'lightning', 'dual', 'fullClear'];
const reports = [];
let comparisons = 0;
for (const type of types) {
  let seed;
  for (seed = 1; seed < 1000; seed++) {
    const fixture = new EndlessGame({ seed });
    fixture.tx((s, emit) => startPetSlot(fixture, s, emit, 'probe'));
    if (fixture.s.petSlots.pending.rewardType === type) break;
  }
  assert.ok(seed < 1000);
  const logs = [[], []];
  let games = [
    new before.EndlessGame({ seed, onEvent: (e) => logs[0].push(e) }),
    new EndlessGame({ seed, onEvent: (e) => logs[1].push(e) }),
  ];
  const compare = () => {
    assert.deepEqual(games[1].exportState(), games[0].exportState(), type + ' state');
    assert.deepEqual(logs[1], logs[0], type + ' events');
    comparisons++;
  };
  for (let n = 0; n < 2; n++) {
    const g = games[n];
    g.coin({ receiptId: 'slot-equivalence', coins: 3 });
    g.tx((s, emit) => (n ? startPetSlot : beforeSlots.startPetSlot)(g, s, emit, 'equivalence'));
  }
  compare();
  // Mutate the real board through a paid shot while the reels are still spinning.
  const move = games[0].opportunities().sort((a, b) => b.direct.length - a.direct.length)[0];
  for (const g of games) {
    g.setAim(move.angle);
    g.fire();
  }
  compare();
  for (let frame = 0; frame < 100; frame++) {
    for (const g of games) g.advance(0.05);
    compare();
    if (frame === 5) {
      games = [
        new before.EndlessGame({
          store: new before.MemoryStore(games[0].exportState()),
          onEvent: (e) => logs[0].push(e),
        }),
        new EndlessGame({
          store: new MemoryStore(games[1].exportState()),
          onEvent: (e) => logs[1].push(e),
        }),
      ];
      compare();
    }
  }
  assert.ok(games[1].s.petSlots.lastResult);
  reports.push({
    type,
    seed,
    result: games[1].s.petSlots.lastResult.rewardType,
    reloadInFlight: true,
  });
}
const out = path.join(root, '../output/verification/v1.8.0');
fs.mkdirSync(out, { recursive: true });
const report = { comparisons, scenarios: reports, passed: true };
fs.writeFileSync(path.join(out, 'slot-equivalence.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
