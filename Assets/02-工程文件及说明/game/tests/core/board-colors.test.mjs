import test from 'node:test';
import assert from 'node:assert/strict';
import { EndlessGame, MemoryStore } from '../../src/core/index.mjs';
import { neighbors } from '../../src/core/geometry.mjs';
import { pickBoardColor } from '../../src/core/board-colors.mjs';
import { tickFlow } from '../../src/core/endless-flow.mjs';

function groups(g) {
  const cells = new Map(g.s.board.map((b) => [`${b.r},${b.c}`, b]));
  const seen = new Set(),
    sizes = [];
  for (const b of g.s.board) {
    if (seen.has(b.id)) continue;
    const queue = [b];
    let size = 0;
    for (let i = 0; i < queue.length; i++) {
      const n = queue[i];
      if (seen.has(n.id)) continue;
      seen.add(n.id);
      size++;
      for (const [r, c] of neighbors(n.r, n.c, g.s.parity, g.config.cols)) {
        const next = cells.get(`${r},${c}`);
        if (next?.color === b.color && !seen.has(next.id)) queue.push(next);
      }
    }
    sizes.push(size);
  }
  return sizes;
}
test('500 seeded boards preserve useful pairs and triples without generated large color islands', () => {
  let useful = 0;
  for (let seed = 1; seed <= 500; seed++) {
    const g = new EndlessGame({ seed });
    const sizes = groups(g);
    assert.ok(Math.max(...sizes) <= 6, `seed ${seed}`);
    assert.equal(new Set(g.s.board.map((b) => b.color)).size, g.config.colors.length);
    useful += sizes.filter((n) => n >= 2 && n <= 3).length;
    if (seed === 73) {
      assert.deepEqual(g.exportState(), new EndlessGame({ seed }).exportState());
      assert.deepEqual(
        new EndlessGame({ store: new MemoryStore(g.exportState()) }).s.board,
        g.s.board,
      );
    }
  }
  assert.ok(useful / 500 > 6);
});
test('new ceiling waves check shifted neighbors with their new parity', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const g = new EndlessGame({ seed });
    g.tx((s, emit) => {
      s.content.flow.pending = { shotId: 'color-test', cause: 'recoveryWave', rows: 3, delay: 0 };
      tickFlow(g, s, 0.25, emit);
    });
    assert.ok(Math.max(...groups(g)) <= 6, `wave seed ${seed}`);
  }
});
test('crowded fallback terminates and never recolors existing balls', () => {
  const g = new EndlessGame({ seed: 12 }),
    s = g.s;
  const before = structuredClone(s.board);
  const color = pickBoardColor(g, s, s.board, 9, 4);
  assert.ok(g.config.colors.includes(color));
  assert.deepEqual(s.board, before);
});
