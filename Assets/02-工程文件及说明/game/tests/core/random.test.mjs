import assert from 'node:assert/strict';
import { EndlessGame, MemoryStore } from '../../src/core/index.mjs';
const layouts = new Set();
for (let seed = 1; seed <= 50; seed++) {
  const store = new MemoryStore(),
    g = new EndlessGame({ seed, store });
  assert.equal(g.snapshot().board.length, 72);
  assert.equal(g.detached(g.s).length, 0);
  g.validate(g.s);
  layouts.add(JSON.stringify(g.snapshot().board.map((b) => [b.r, b.c, b.color])));
  const state = g.exportState(),
    restored = new EndlessGame({ seed: seed + 1000, store });
  assert.deepEqual(restored.exportState(), state);
  const same = new EndlessGame({ seed });
  assert.deepEqual(same.snapshot().board, g.snapshot().board);
}
assert.ok(layouts.size > 35);
console.log('50个种子均有72个连通球；同种子可重放，刷新恢复不重抽；不同布局 ' + layouts.size);
