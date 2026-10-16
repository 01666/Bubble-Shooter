import test from 'node:test';
import assert from 'node:assert/strict';
import { EndlessGame, MemoryStore } from '../../src/core/index.mjs';
import { advanceFlow, tickFlow } from '../../src/core/endless-flow.mjs';
import { finish, seeded } from '../helpers/strategies.mjs';

test('legacy board migrates without filling holes, rerolling or changing balances', () => {
  const old = new EndlessGame({ config: { densityEnabled: false }, seed: 17 });
  old.coin({ receiptId: 'old-credit' });
  const saved = old.exportState();
  for (const key of ['densityEnabled', 'densityTarget', 'densityBaseRows', 'densityPeakRows'])
    delete saved.config[key];
  const g = new EndlessGame({ store: new MemoryStore(saved) });
  assert.deepEqual(g.s.board, saved.board);
  assert.deepEqual(g.s.ledger, saved.ledger);
  assert.equal(g.s.paidAmmo, 10);
  assert.equal(g.s.content.credit, 87);
  assert.deepEqual(
    new EndlessGame({ store: new MemoryStore(g.exportState()) }).exportState(),
    g.exportState(),
  );
});

test('clear leaves holes; miss pressure inserts only top rows, preserving geometry and surviving colors', () => {
  const g = new EndlessGame({ seed: 11 }),
    events = [];
  g.coin({ receiptId: 'one' });
  g.onEvent = (e) => events.push(e);
  const move = g
    .opportunities()
    .sort((a, b) => b.direct.length + b.dropped.length - a.direct.length - a.dropped.length)[0];
  assert.ok(move.direct.length);
  const before = g.s.board.length;
  g.setAim(move.angle);
  g.fire();
  finish(g);
  const result = events.find((e) => e.type === 'paidShotResolved').payload;
  assert.equal(events.filter((e) => e.type === 'boardRefilled').length, 0);
  assert.equal(g.s.board.length, before + 1 - result.directCount - result.dropCount);
  g.tx((s, emit) => {
    s.content.flow.grace = 0;
    s.content.flow.pressure = s.content.flow.threshold - 1;
    advanceFlow(g, s, emit, 'high-board-fixture', { directCount: 0 });
    assert.equal(
      s.content.flow.pending,
      null,
      'eight-row board pauses pressure instead of being pushed deeper',
    );
    const lower = s.board.filter((b) => b.r >= 7);
    s.board = s.board.filter((b) => b.r < 7);
    s.content.reserve.push(...lower);
    const existing = structuredClone(s.board),
      parity = s.parity;
    advanceFlow(g, s, emit, 'wave-fixture', { directCount: 0 });
    assert.equal(s.parity, parity, 'the incoming wave waits for the visual breathing window');
    assert.ok(s.content.flow.pending);
    tickFlow(g, s, 0.3, emit);
    assert.equal(s.parity, parity);
    tickFlow(g, s, 1, emit);
    assert.equal(s.parity, parity ^ 1);
    for (const b of existing) {
      const n = s.board.find((n) => n.id === b.id);
      assert.equal(n.r, b.r + 1);
      assert.equal(n.c, b.c);
      assert.equal(n.x, b.x);
      assert.ok(Math.abs(n.y - b.y + g.config.rowHeight) < 1e-10);
      assert.equal(n.color, b.color);
    }
  });
  const refill = events.find((e) => e.type === 'boardRefilled').payload;
  assert.equal(refill.cause, 'pressureWave');
  assert.ok(refill.added.every((b) => b.r === 0));
  assert.equal(refill.added.length, 9);
});

test('large clear grants a breathing shot and delayed entry; free shots and refresh freeze wave progress', () => {
  const g = new EndlessGame({ seed: 33 });
  g.tx((s, emit) => {
    s.content.flow.pressure = 3;
    advanceFlow(g, s, emit, 'large-clear', { directCount: 4, dropCount: 10 });
    assert.equal(s.content.flow.grace, 1);
    const waves = s.content.flow.waves;
    advanceFlow(g, s, emit, 'breath-one', { directCount: 0 });
    assert.equal(s.content.flow.waves, waves);
  });
  const before = g.exportState();
  g.fire();
  finish(g);
  assert.deepEqual(g.s.board, before.board);
  assert.deepEqual(g.s.content.flow, before.content.flow);
  assert.deepEqual(
    new EndlessGame({ store: new MemoryStore(g.exportState()) }).s.content.flow,
    before.content.flow,
  );
});

test('clear-focused and random 150-shot histories conserve inventory, rewards and top-only waves', () => {
  for (const mode of ['clear', 'random']) {
    const g = new EndlessGame({ seed: 17 }),
      rng = seeded(4),
      events = [],
      counts = [];
    g.onEvent = (e) => events.push(e);
    for (let i = 0; i < 150; i++) {
      if (!g.s.paidAmmo) g.coin({ receiptId: 'coin-' + i });
      const best = g
        .opportunities()
        .sort((a, b) => b.direct.length + b.dropped.length - a.direct.length - a.dropped.length)[0];
      g.setAim(mode === 'random' ? (rng() * 2 - 1) * g.config.maxAim : (best?.angle ?? 0));
      g.fire();
      finish(g);
      g.validate(g.s);
      assert.equal(g.detached(g.s).length, 0);
      assert.ok(g.s.board.every((b) => b.y - g.config.radius > g.config.dangerY));
      counts.push(g.s.board.length);
    }
    const waves = events.filter((e) => e.type === 'boardRefilled');
    if (mode === 'clear') assert.ok(waves.length);
    assert.ok(
      waves.every((e) => e.payload.added.length <= 9 && e.payload.added.every((b) => b.r === 0)),
    );
    assert.ok(new Set(counts).size > 15);
    const shots = events.filter((e) => e.type === 'paidShotResolved');
    assert.equal(
      shots.reduce((n, e) => n + e.payload.earnedDelta, 0) + events.filter(e => e.type === 'petSlotResolved').reduce((n,e) => n + e.payload.actualTicketDelta, 0),
      g.s.ledger.earned,
    );
    assert.ok(
      events.filter((e) => e.type === 'boardMaintained').every((e) => e.payload.gain === 0),
    );
  }
});

test('delayed waves survive refresh, prevent firing through a moving layout and commit once without tickets', () => {
  const original = new EndlessGame({ seed: 77 });
  original.coin({ receiptId: 'paid' });
  original.tx((s) => {
    s.content.flow.pending = { shotId: 'paid-wave', cause: 'recoveryWave', rows: 2, delay: 0.7 };
  });
  const ammo = original.s.paidAmmo,
    ledger = structuredClone(original.s.ledger);
  assert.equal(original.fire(), false);
  assert.equal(original.s.paidAmmo, ammo);
  original.advance(0.25);
  const durable = original.exportState(),
    events = [];
  const g = new EndlessGame({ store: new MemoryStore(durable), onEvent: (e) => events.push(e) });
  assert.deepEqual(g.s.board, durable.board);
  g.advance(0.25);
  assert.ok(g.s.content.flow.pending);
  g.advance(0.25);
  assert.equal(g.s.content.flow.pending, null);
  assert.equal(events.filter((e) => e.type === 'boardRefilled').length, 2);
  assert.deepEqual(g.s.ledger, ledger);
  for (let i = 0; i < 8; i++) g.advance(0.25);
  assert.equal(events.filter((e) => e.type === 'boardRefilled').length, 2);
  g.validate(g.s);
});
