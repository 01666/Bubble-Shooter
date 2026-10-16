import test from 'node:test';
import assert from 'node:assert/strict';
import { EndlessGame, MemoryStore } from '../../src/core/index.mjs';
import { settleLowOpportunity, opportunityBurstCount } from '../../src/core/low-opportunity.mjs';

function pendingFixture(seed, appearanceAmmo) {
  const g = new EndlessGame({ seed });
  g.coin({ receiptId: 'placement-fixture' });
  g.tx((s) => {
    s.paidAmmo = 2;
    s.paidShots = 8;
    Object.assign(s.lowOpportunity, {
      usedSlots: 1,
      sequence: 1,
      episodeActive: true,
      episodeQualified: true,
      nextEligibleConsumed: 18,
      pending: {
        opportunityId: 'low-opportunity-1',
        requestedShotId: 'fixture-8',
        status: 'pending',
        specialType: 'bomb',
        remainingAtQualification: 2,
        remainingAmmo: 2,
        ballId: null,
        reason: null,
        placementSeed: seed,
        appearanceAmmo,
      },
    });
  });
  return g;
}

test('count draw uses exactly 20/20/30/30 percent buckets and correct boundaries', () => {
  const counts = { 2: 0, 3: 0, 4: 0, 5: 0 };
  for (let i = 0; i < 1000; i++) counts[opportunityBurstCount((i + 0.5) / 1000)]++;
  assert.deepEqual(counts, { 2: 300, 3: 300, 4: 200, 5: 200 });
  assert.equal(opportunityBurstCount(0.2), 4);
  assert.equal(opportunityBurstCount(0.4), 3);
  assert.equal(opportunityBurstCount(0.7), 2);
});

test('a five-ball request is never truncated and ignores the legacy bomb cap', () => {
  const g = pendingFixture(17, 2),
    events = [];
  g.onEvent = (e) => events.push(e);
  g.tx((s) => {
    s.lowOpportunity.pending.requestedCount = 5;
    const ordinary = s.board.filter((b) => !b.kind);
    for (const b of ordinary.slice(4)) b.kind = 'bomb';
  });
  g.tx((s, emit) => settleLowOpportunity(g, s, s.board[0], emit, 'needs-five'));
  assert.equal(events.filter((e) => e.type === 'lowOpportunityAppeared').length, 0);
  assert.equal(g.s.lowOpportunity.pending.reason, 'insufficientTargets');
  assert.equal(g.s.lowOpportunity.pending.requestedCount, 5);
  g.tx((s, emit) => {
    delete s.board.find((b) => b.kind === 'bomb').kind;
    settleLowOpportunity(g, s, s.board[0], emit, 'five-available');
  });
  assert.equal(events.filter((e) => e.type === 'lowOpportunityAppeared').length, 5);
  assert.ok(g.s.board.filter((b) => b.kind === 'bomb').length > 12);
});

test('five-ball groups prefer spatially separate sites on a full board', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const g = pendingFixture(seed, 2);
    g.tx((s, emit) => {
      s.lowOpportunity.pending.requestedCount = 5;
      settleLowOpportunity(g, s, s.board[0], emit, 'spread');
    });
    const targets = g.snapshot().lowOpportunity.targets;
    assert.equal(targets.length, 5);
    for (let i = 0; i < targets.length; i++)
      for (let j = 0; j < i; j++) {
        assert.ok(
          Math.hypot(targets[i].x - targets[j].x, targets[i].y - targets[j].y) / g.config.spacing >=
            2.5,
          `seed ${seed}`,
        );
      }
  }
});

test('2–5 count requests persist through reload and appear once without inventory or ticket creation', () => {
  for (const count of [2, 3, 4, 5]) {
    let g = pendingFixture(19, 1);
    g.tx((s) => {
      s.lowOpportunity.pending.requestedCount = count;
    });
    const saved = g.exportState(),
      events = [];
    g = new EndlessGame({ store: new MemoryStore(saved), onEvent: (e) => events.push(e) });
    assert.equal(g.s.lowOpportunity.pending.requestedCount, count);
    g.tx((s, emit) => {
      s.paidShots++;
      s.paidAmmo--;
      settleLowOpportunity(g, s, s.board[0], emit, 'quantity-test');
    });
    assert.equal(g.snapshot().lowOpportunity.targets.length, count);
    assert.equal(events.filter((e) => e.type === 'lowOpportunityAppeared').length, count);
    assert.ok(
      events.every((e) => e.payload.burstCount === count && e.payload.requestedCount === count),
    );
    assert.equal(g.s.board.length, saved.board.length);
    assert.deepEqual(g.s.ledger, saved.ledger);
    const restored = new EndlessGame({ store: new MemoryStore(g.exportState()) });
    assert.equal(restored.snapshot().lowOpportunity.targets.length, count);
  }
});

test('one-ammo schedule is durable and cannot appear at two, on idle or twice', () => {
  let g = pendingFixture(17, 1);
  const events = [];
  g.onEvent = (e) => events.push(e);
  g.tx((s, emit) => settleLowOpportunity(g, s, s.board[0], emit, 'fixture-8'));
  assert.equal(events.length, 0);
  const saved = g.exportState();
  g = new EndlessGame({ store: new MemoryStore(saved), onEvent: (e) => events.push(e) });
  assert.deepEqual(g.exportState(), saved);
  g.advance(20);
  assert.equal(events.length, 0);
  g.tx((s, emit) => {
    s.paidShots++;
    s.paidAmmo--;
    settleLowOpportunity(g, s, s.board[0], emit, 'fixture-9');
  });
  assert.equal(events.filter((e) => e.type === 'lowOpportunityAppeared').length, 2);
  assert.ok(
    events
      .filter((e) => e.type === 'lowOpportunityAppeared')
      .every((e) => e.payload.remainingAmmo === 1),
  );
  g.tx((s, emit) => settleLowOpportunity(g, s, s.board[0], emit, 'repeat'));
  assert.equal(events.filter((e) => e.type === 'lowOpportunityAppeared').length, 2);
});

test('weighted placement favors middle/upper rows, varies positions and preserves inventory and colors', () => {
  const positions = new Set();
  let upper = 0,
    total = 0;
  for (let seed = 1; seed <= 80; seed++) {
    const g = pendingFixture(seed, 2),
      before = g.exportState();
    g.tx((s, emit) => settleLowOpportunity(g, s, s.board[0], emit, 'fixture-8'));
    const targets = g.snapshot().lowOpportunity.targets;
    assert.equal(targets.length, 2);
    for (const b of targets) {
      const old = before.board.find((n) => n.id === b.id);
      assert.deepEqual([b.r, b.c, b.color, b.x, b.y], [old.r, old.c, old.color, old.x, old.y]);
      total++;
      if (b.r <= 4) upper++;
      positions.add(`${b.r},${b.c}`);
    }
    assert.equal(g.s.board.length, before.board.length);
    assert.deepEqual(g.s.ledger, before.ledger);
    assert.equal(g.s.rng, before.rng);
    assert.equal(g.s.loadedColor, before.loadedColor);
    assert.equal(g.s.nextColor, before.nextColor);
  }
  assert.ok(upper / total > 0.7);
  assert.ok(positions.size > 20);
});
