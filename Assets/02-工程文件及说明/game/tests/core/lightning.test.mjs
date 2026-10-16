import test from 'node:test';
import assert from 'node:assert/strict';
import { EndlessGame } from '../../src/core/index.mjs';
import { expandMechanisms } from '../../src/core/mechanics.mjs';

test('lightning randomly chooses 3–6 extra adjacent balls of any color, is replayable and cannot cross empty gaps', () => {
  const g = new EndlessGame({ seed: 31 }),
    signatures = new Set(),
    counts = new Set();
  for (let run = 0; run < 30; run++) {
    const s = { parity: 0, board: [] };
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 9; c++)
        s.board.push({
          id: `run-${run}-${r}-${c}`,
          source: 'system',
          r,
          c,
          color: (c + r) % 5,
          ...(r === 2 && c === 4 ? { kind: 'conductor', networkId: 'network-1' } : {}),
          ...g.pos(r, c, 0),
        });
    const before = structuredClone(s),
      root = s.board.find((b) => b.kind === 'conductor');
    const expanded = expandMechanisms(g, s, [root]);
    assert.deepEqual(s, before, 'sampling never mutates the board or a random stream');
    assert.deepEqual(expandMechanisms(g, s, [root]), expanded);
    assert.ok(expanded.direct.length >= 4 && expanded.direct.length <= 7);
    assert.ok(expanded.direct.some((b) => b.color !== root.color && !b.kind));
    assert.equal(
      new Set(expanded.electric.struckBalls.map((b) => b.id)).size,
      expanded.electric.struckBalls.length,
    );
    for (const edge of expanded.electric.steps) {
      const from = s.board.find((b) => b.id === edge.fromId),
        to = s.board.find((b) => b.id === edge.toId);
      assert.ok(g.neighbors(from.r, from.c, 0).some(([r, c]) => r === to.r && c === to.c));
      assert.deepEqual(edge.from, { x: from.x, y: from.y });
      assert.deepEqual(edge.to, { x: to.x, y: to.y });
    }
    signatures.add(
      expanded.electric.steps.map((e) => e.toId.split('-').slice(-2).join(',')).join('|'),
    );
    counts.add(expanded.direct.length - 1);
  }
  assert.ok(signatures.size > 15);
  assert.deepEqual([...counts].sort(), [3, 4, 5, 6]);
});
