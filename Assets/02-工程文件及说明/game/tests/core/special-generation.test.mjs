import test from 'node:test';
import assert from 'node:assert/strict';
import { EndlessGame, MemoryStore } from '../../src/core/index.mjs';
import { tickFlow } from '../../src/core/endless-flow.mjs';

test('initial stars and bomb are dispersed and saved attributes never reroll', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const g = new EndlessGame({ seed });
    const specials = g.s.board.filter((b) => ['target', 'bomb'].includes(b.kind));
    assert.equal(specials.length, 4);
    for (let i = 0; i < specials.length; i++)
      for (let j = 0; j < i; j++)
        assert.ok(Math.hypot(specials[i].x-specials[j].x, specials[i].y-specials[j].y)/g.config.spacing >= 2.5);
    assert.deepEqual(new EndlessGame({store:new MemoryStore(g.exportState())}).s.board, g.s.board);
  }
});

test('each incoming full row carries specials in its committed event without changing inventory or old balls', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const g = new EndlessGame({seed});
    g.tx((s, emit) => {
      const before = structuredClone(s.board);
      const budget = s.content.credit + s.content.reserve.length + s.board.length;
      s.content.flow.pending = { rows:1, delay:0, shotId:'wave-test', cause:'pressureWave' };
      const events=[];
      assert.ok(tickFlow(g, s, 0.1, (type,payload)=>events.push({type,payload})));
      const added=events.find(e=>e.type==='boardRefilled').payload.added;
      assert.equal(added.length, g.config.cols);
      const specials=added.filter(b=>b.kind);
      assert.ok(specials.length>=1 && specials.length<=2);
      assert.equal(s.content.credit+s.content.reserve.length+s.board.length,budget);
      for (const b of before) {
        const after=s.board.find(n=>n.id===b.id);
        assert.equal(after.kind,b.kind);
        assert.equal(after.color,b.color);
        assert.equal(after.r,b.r+1);
      }
      assert.deepEqual(s.ledger,g.s.ledger);
    });
  }
});
