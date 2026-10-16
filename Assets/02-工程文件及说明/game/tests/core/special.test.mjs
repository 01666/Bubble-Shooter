import test from 'node:test';
import assert from 'node:assert/strict';
import { EndlessGame, MemoryStore, SimulatedDispenser } from '../../src/core/index.mjs';
import { finish, seeded } from '../helpers/strategies.mjs';
import { expandExplosion } from '../../src/core/special.mjs';
import { protectedPathIds } from '../../src/core/protection.mjs';
function fixture(cells) {
  const g = new EndlessGame(),
    s = g.exportState();
  s.board = cells.map(([r, c, color, kind], i) => ({
    id: 'f' + i,
    source: 'system',
    r,
    c,
    color,
    kind,
    stageId: kind === 'target' ? 1 : undefined,
    ...g.pos(r, c),
  }));
  s.content.reserve = [];
  s.content.credit = 0;
  s.content.initialSystemCount = s.board.length;
  // This fixture replaces the entire inventory, including the development network.
  s.network.id = null;
  s.stage = {
    id: 1,
    targetIds: s.board.filter((b) => b.kind === 'target').map((b) => b.id),
    collectedIds: [],
    award: 8,
  };
  return new EndlessGame({ store: new MemoryStore(s) });
}
test('explosion crosses colors and chained bombs trigger once, preserving distinct ids', () => {
  const g = fixture([
    [0, 3, 0, 'bomb'],
    [0, 4, 2, 'bomb'],
    [0, 5, 3],
    [1, 3, 4],
    [1, 4, 1],
  ]);
  const x = expandExplosion(g, g.s, [g.s.board[0]]);
  assert.equal(x.triggers.length, 2);
  assert.equal(x.direct.length, 5);
  assert.equal(new Set(x.direct.map((b) => b.id)).size, 5);
});
test('three targets complete one fixed bonus, ordinary award counted independently and restore cannot duplicate', () => {
  const g = fixture([
    [0, 3, 0, 'target'],
    [0, 4, 0, 'target'],
    [0, 5, 0, 'target'],
  ]);
  g.coin({ receiptId: 'c' });
  assert.equal(g.snapshot().stage.award, 8, 'public treasure prize matches persisted award');
  g.s.loadedColor = 0;
  g.fire();
  g.tx((s, emit) => g.settle(s, s.board[1], emit));
  assert.equal(g.s.ledger.rewards['stage-1'].count, 8);
  assert.equal(g.s.ledger.earned, 12);
  assert.equal(g.s.stage.id, 2);
  const h = new EndlessGame({ store: new MemoryStore(g.exportState()) });
  h.advance(0.25);
  assert.equal(h.s.ledger.earned, 12);
  assert.equal(h.s.stage.id, 2);
  assert.equal(h.snapshot().stage.award, g.snapshot().stage.award);
});
test('bomb merely dropping does not activate its neighborhood', () => {
  const g = fixture([
      [0, 4, 0],
      [1, 4, 0],
      [2, 4, 2, 'bomb'],
      [3, 4, 3],
    ]),
    events = [];
  g.onEvent = (e) => events.push(e);
  g.coin({ receiptId: 'c' });
  g.s.loadedColor = 0;
  g.fire();
  g.tx((s, emit) => g.settle(s, s.board[1], emit));
  assert.equal(events.filter((e) => e.type === 'explosionResolved').length, 0);
  assert.ok(
    events
      .find((e) => e.type === 'paidShotResolved')
      .payload.dropped.some((b) => b.kind === 'bomb'),
  );
});
test('free play freezes targets, fixed bonus, board, payout and preview even during coin', () => {
  const g = new EndlessGame(),
    before = g.exportState();
  for (let i = 0; i < 5; i++) {
    g.fire();
    finish(g);
  }
  assert.deepEqual(g.s.stage, before.stage);
  assert.deepEqual(g.s.board, before.board);
  assert.equal(g.s.ledger.earned, 0);
  assert.equal(g.s.nextColor, before.nextColor);
  g.fire();
  g.coin({ receiptId: 'coin' });
  assert.equal(g.s.projectile.mode, 'free');
  finish(g);
  assert.equal(g.s.paidAmmo, 10);
});
test('preview chosen after settlement belongs to visible colors; in-flight draw stays locked', () => {
  const g = new EndlessGame();
  g.coin({ receiptId: 'c' });
  const next = g.s.nextColor;
  g.fire();
  assert.equal(g.s.nextColor, next);
  assert.equal(g.snapshot().loading, true);
  finish(g);
  assert.ok(g.s.board.some((b) => b.color === g.s.nextColor));
  assert.equal(g.snapshot().loading, false);
});
test('recent paving keeps its actual top support path, old paving expires', () => {
  const g = fixture([
    [0, 4, 0],
    [1, 4, 2],
    [2, 4, 3],
    [3, 4, 1],
  ]);
  g.s.paidShots = 10;
  const b = g.s.board[3];
  b.source = 'player';
  b.bornShot = 9;
  assert.equal(protectedPathIds(g, g.s).size, 4);
  b.bornShot = 3;
  assert.equal(protectedPathIds(g, g.s).size, 0);
});
test('legacy random long history restores special identity, obligations and paid credits', () => {
  let g = new EndlessGame({petSlotsEnabled:false}),
    rng = seeded(122);
  g.coin({ receiptId: 'bulk', coins: 100 });
  for (let i = 0; i < 500; i++) {
    g.setAim((rng() * 2 - 1) * g.config.maxAim);
    g.fire();
    finish(g);
    if (i % 25 === 0) {
      const state = g.exportState();
      g = new EndlessGame({ store: new MemoryStore(state) });
      assert.deepEqual(g.exportState(), state);
    }
    assert.ok(
      g.s.content.reserve.filter((b) => b.kind === 'bomb').length +
        g.s.board.filter((b) => b.kind === 'bomb').length <=
        2,
    );
    assert.ok(g.s.ledger.earned >= g.s.ledger.confirmed);
  }
  assert.equal(g.s.paidAmmo, 500 + g.s.refundedShots + g.s.ammoBonus.total);
  const d = new SimulatedDispenser();
  for (let j = 0; j < 4; j++) d.tick(g, 0.25);
  assert.equal(g.s.ledger.confirmed, 4);
});
