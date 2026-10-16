import test from 'node:test';
import assert from 'node:assert/strict';
import { EndlessGame, MemoryStore, SimulatedDispenser } from '../../src/core/index.mjs';
import { finish } from '../helpers/strategies.mjs';
import { settleLowOpportunity } from '../../src/core/low-opportunity.mjs';
import { earn } from '../../src/core/ledger.mjs';

function fixture({
  config = {},
  cells = [
    [0, 2, 0],
    [0, 3, 0],
  ],
  targets = [
    [0, 7, 2],
    [0, 8, 3],
    [1, 8, 1],
  ],
} = {}) {
  const g = new EndlessGame({
      config: {
        lowOpportunityBombLimit: 4,
        ballsPerCoin: 3,
        assistEnabled: false,
        conductiveEnabled: false,
        densityEnabled: false,
        ...config,
      },
    }),
    s = g.exportState();
  const all = [...cells, ...targets.map((b) => [...b, 'target'])];
  s.board = all.map(([r, c, color, kind], i) => ({
    id: `lo-fixture-${i}`,
    source: 'system',
    r,
    c,
    color,
    ...(kind ? { kind } : {}),
    ...(kind === 'target' ? { stageId: 1 } : {}),
    ...g.pos(r, c),
  }));
  for (const b of s.board) if (b.kind === 'conductor') b.networkId = 'network-1';
  s.stage = {
    id: 1,
    collectedIds: [],
    targetIds: s.board.filter((b) => b.kind === 'target').map((b) => b.id),
    award: 8,
  };
  s.content.reserve = [];
  s.content.initialSystemCount = s.board.length;
  s.content.credit = 0;
  s.network.sequence = 1;
  s.network.id = s.board.some((b) => b.kind === 'conductor') ? 'network-1' : null;
  s.bombPlan = 0;
  s.lowOpportunity.cadenceSeed = 1; // This fixture explicitly exercises the two-ammo branch.
  s.loadedColor = 4;
  s.nextColor = 0;
  return new EndlessGame({ config: g.config, store: new MemoryStore(s) });
}
function shootAt(g, color = 4, c = 0) {
  g.tx((s) => {
    s.loadedColor = color;
  });
  g.fire();
  g.tx((s, emit) => {
    Object.assign(s.projectile, g.pos(0, c));
    g.settle(s, null, emit);
  });
  g.advance(0.25);
}
function collect(g) {
  const events = [];
  g.onEvent = (e) => events.push(e);
  return events;
}
function actualShots(g, n) {
  const start = g.s.paidShots - g.s.refundedShots;
  let attempts = 0;
  while (g.s.paidShots - g.s.refundedShots - start < n && attempts++ < n + 50) {
    const miss = g.opportunities().find((m) => !m.direct.length);
    g.setAim(miss?.angle ?? 0);
    g.fire();
    finish(g);
  }
  assert.equal(g.s.paidShots - g.s.refundedShots - start, n);
}

test('default tenth-credit entitlement applies at 2, never repeats at 1 or on idle/refreshed state', () => {
  let g = new EndlessGame({ seed: 11 }),
    events = collect(g);
  g.coin({ receiptId: 'ten' });
  actualShots(g, 7);
  assert.equal(g.s.lowOpportunity.usedSlots, 0);
  actualShots(g, 1);
  assert.equal(g.s.paidAmmo, 2);
  assert.equal(g.s.lowOpportunity.usedSlots, 1);
  assert.equal(events.filter((e) => e.type === 'lowOpportunityQualified').length, 1);
  const state = g.exportState();
  g = new EndlessGame({ store: new MemoryStore(state) });
  assert.deepEqual(g.exportState(), state);
  events = collect(g);
  g.advance(10);
  g.setAim(0);
  assert.equal(g.s.lowOpportunity.sequence, 1);
  actualShots(g, 1);
  assert.equal(g.s.paidAmmo, 1);
  assert.equal(g.s.lowOpportunity.sequence, 1);
  assert.equal(events.filter((e) => e.type === 'lowOpportunityQualified').length, 0);
});

test('appearance marks a genuinely reachable ordinary system ball, preserves ID/color/count and creates no tickets', () => {
  const g = fixture(),
    events = collect(g),
    before = g.exportState();
  g.coin({ receiptId: 'three' });
  shootAt(g);
  const e = events.find((e) => e.type === 'lowOpportunityAppeared');
  assert.ok(e);
  const old = before.board.find((b) => b.id === e.payload.ballId);
  assert.equal(old.color, e.payload.ball.color);
  assert.equal(e.payload.ball.source, 'system');
  assert.equal(e.payload.specialType, 'bomb');
  assert.equal(e.payload.remainingAmmo, 2);
  assert.equal(g.s.board.length, before.board.length + 1, 'only actual paid player ball was added');
  assert.equal(g.s.ledger.earned, 0);
  assert.equal(g.s.stage.award, 8);
  assert.ok(g.opportunities().some((m) => m.direct.some((b) => b.id === old.id)));
  assert.equal(g.s.assist.charge, 0);
  g.validate(g.s);
});

test('a qualified request cannot be duplicated by repeated settlement checks in one low episode', () => {
  const g = fixture();
  g.coin({ receiptId: 'three' });
  shootAt(g);
  const sequence = g.s.lowOpportunity.sequence,
    events = collect(g);
  g.tx((s, emit) => {
    for (let i = 0; i < 10; i++) settleLowOpportunity(g, s, s.board[0], emit, 'repeat');
  });
  assert.equal(g.s.lowOpportunity.sequence, sequence);
  assert.equal(events.length, 0);
});

test('qualification delayed by consumption interval can legitimately enter at 1 without a duplicate at 2', () => {
  const g = new EndlessGame({ seed: 77, config: { ballsPerCoin: 1 } }),
    events = collect(g);
  g.coin({ receiptId: 'first', coins: 12 });
  actualShots(g, 10);
  assert.equal(g.s.paidAmmo, 2);
  assert.equal(g.s.lowOpportunity.usedSlots, 1);
  g.coin({ receiptId: 'small1' });
  actualShots(g, 2);
  assert.equal(g.s.paidAmmo, 1);
  assert.equal(g.s.lowOpportunity.usedSlots, 1);
  g.coin({ receiptId: 'small2' });
  actualShots(g, 1);
  assert.equal(g.s.paidAmmo, 1);
  assert.equal(g.s.lowOpportunity.usedSlots, 2);
  assert.equal(
    events.filter((e) => e.type === 'lowOpportunityQualified').at(-1).payload.remainingAmmo,
    1,
  );
});

test('one-credit configuration uses a three-purchased-ball minimum and resists threshold topping', () => {
  const g = fixture({ config: { ballsPerCoin: 1 } }),
    events = collect(g);
  g.coin({ receiptId: 'a' });
  g.coin({ receiptId: 'b' });
  assert.equal(g.s.lowOpportunity.usedSlots, 0);
  g.coin({ receiptId: 'c' });
  shootAt(g);
  assert.equal(g.s.paidAmmo, 2);
  assert.equal(g.s.lowOpportunity.usedSlots, 1);
  g.coin({ receiptId: 'd' });
  shootAt(g, 4, 1);
  assert.equal(
    g.s.lowOpportunity.usedSlots,
    1,
    'one extra purchased/consumed ball is insufficient',
  );
  assert.equal(events.filter((e) => e.type === 'lowOpportunityQualified').length, 1);
});

test('batch credit does not bank consumption windows for rapid repeated low episodes', () => {
  const g = new EndlessGame({ config: { ballsPerCoin: 1 }, seed: 11 });
  g.coin({ receiptId: 'bulk', coins: 12 });
  actualShots(g, 10);
  assert.equal(g.s.paidAmmo, 2);
  assert.equal(g.s.lowOpportunity.usedSlots, 1);
  assert.equal(g.s.lowOpportunity.nextEligibleConsumed, 13);
  g.coin({ receiptId: 'small1' });
  actualShots(g, 1);
  g.coin({ receiptId: 'small2' });
  actualShots(g, 1);
  assert.equal(g.s.lowOpportunity.usedSlots, 1);
});

test('free trials including in-flight coin and pure dispenser/idle operations never qualify', () => {
  const g = fixture(),
    events = collect(g),
    before = g.exportState();
  for (let i = 0; i < 5; i++) {
    g.fire();
    finish(g);
  }
  assert.deepEqual(g.s.lowOpportunity, before.lowOpportunity);
  g.fire();
  g.coin({ receiptId: 'during-free' });
  finish(g);
  new SimulatedDispenser().tick(g, 1);
  g.advance(60);
  assert.equal(g.s.lowOpportunity.sequence, 0);
  assert.equal(events.filter((e) => e.type.startsWith('lowOpportunity')).length, 0);
});

test('pending absence is explained once, expires at zero and retains spent application quota', () => {
  const g = fixture({ cells: [] }),
    events = collect(g);
  g.coin({ receiptId: 'three' });
  shootAt(g);
  assert.equal(g.s.lowOpportunity.pending.status, 'deferred');
  assert.equal(events.filter((e) => e.type === 'lowOpportunityDeferred').length, 1);
  shootAt(g, 4, 1);
  assert.equal(events.filter((e) => e.type === 'lowOpportunityDeferred').length, 1);
  shootAt(g, 4, 2);
  assert.equal(g.s.paidAmmo, 0);
  assert.equal(g.s.lowOpportunity.pending, null);
  assert.equal(g.s.lowOpportunity.last.reason, 'noPaidShots');
  assert.equal(g.s.lowOpportunity.usedSlots, 1);
  assert.equal(events.filter((e) => e.type === 'lowOpportunityAppeared').length, 0);
});

test('last ball exposes a public later-color bonus without changing current or preview colors', () => {
  const g = fixture({ config: { ballsPerCoin: 1 } });
  g.coin({ receiptId: 'two', coins: 2 });
  g.tx((s) => {
    s.nextColor = 4;
  });
  shootAt(g);
  assert.equal(g.s.lowOpportunity.usedSlots, 0);
  g.coin({ receiptId: 'third' });
  g.tx((s) => {
    s.nextColor = 4;
    s.rng = 2000;
  });
  shootAt(g, 4, 1);
  assert.equal(g.s.paidAmmo, 1);
  assert.equal(g.s.loadedColor, 4);
  assert.equal(g.s.nextColor, 0);
  assert.equal(g.s.lowOpportunity.pending, null);
  assert.equal(g.s.lowOpportunity.last.access, 'publicColor');
  assert.equal(g.snapshot().lowOpportunity.targets.length, 2);
  assert.equal(g.s.lowOpportunity.usedSlots, 1);
});

test('the old bomb limit no longer blocks a complete new batch', () => {
  const g = fixture({
      cells: [
        [0, 2, 0, 'bomb'],
        [0, 3, 0, 'bomb'],
        [0, 0, 4, 'bomb'],
        [0, 1, 4, 'bomb'],
        [0, 5, 1],
        [0, 6, 1],
      ],
    }),
    events = collect(g);
  g.coin({ receiptId: 'three' });
  shootAt(g);
  assert.equal(g.s.lowOpportunity.pending, null);
  assert.equal(events.filter((e) => e.type === 'lowOpportunityAppeared').length, 2);
  assert.ok(
    [...g.s.board, ...g.s.content.reserve].filter((b) => b.kind === 'bomb').length >
      g.config.lowOpportunityBombLimit,
  );
});

test('failed atomic save publishes no qualification or marker, and durable in-flight recovery applies once', () => {
  const first = fixture();
  first.coin({ receiptId: 'three' });
  first.fire();
  const store = new MemoryStore(first.exportState()),
    events = [],
    g = new EndlessGame({ config: first.config, store, onEvent: (e) => events.push(e) });
  const durable = store.load();
  store.save = () => {
    throw Error('opportunity save failed');
  };
  assert.throws(
    () =>
      g.tx((s, emit) => {
        Object.assign(s.projectile, g.pos(0, 0));
        g.settle(s, null, emit);
      }),
    /opportunity save failed/,
  );
  assert.equal(events.length, 0);
  assert.deepEqual(g.exportState(), durable);
  const h = new EndlessGame({
    config: first.config,
    store: new MemoryStore(durable),
    onEvent: (e) => events.push(e),
  });
  h.tx((s, emit) => {
    Object.assign(s.projectile, h.pos(0, 0));
    h.settle(s, null, emit);
  });
  assert.equal(events.filter((e) => e.type === 'lowOpportunityAppeared').length, 2);
  assert.equal(h.s.lowOpportunity.usedSlots, 1);
});

test('deferred requests close on top-up without erasing already appeared public targets', () => {
  const missing = fixture({ cells: [] }),
    events = collect(missing);
  missing.coin({ receiptId: 'three' });
  shootAt(missing);
  const id = missing.s.lowOpportunity.pending.opportunityId;
  missing.coin({ receiptId: 'more' });
  assert.equal(missing.s.lowOpportunity.pending, null);
  assert.equal(
    events.find((e) => e.type === 'lowOpportunityFinished').payload.reason,
    'replenished',
  );
  assert.equal(missing.s.lowOpportunity.last.opportunityId, id);
  const g = fixture();
  g.coin({ receiptId: 'three' });
  shootAt(g);
  const target = g.snapshot().lowOpportunity.targets[0];
  g.coin({ receiptId: 'more' });
  assert.equal(g.snapshot().lowOpportunity.targets[0].id, target.id);
});

test('no ordinary targets defers without a bomb limit; player construction remains intact while support may gain an attribute', () => {
  const g = fixture({
      cells: [
        [0, 2, 0, 'bomb'],
        [0, 3, 0, 'bomb'],
        [0, 5, 1, 'bomb'],
        [0, 6, 1, 'bomb'],
      ],
    }),
    events = collect(g);
  g.coin({ receiptId: 'three' });
  shootAt(g);
  assert.equal(g.s.lowOpportunity.pending.reason, 'noUsableTarget');
  assert.equal(events.filter((e) => e.type === 'lowOpportunityAppeared').length, 0);
  const ordinary = fixture();
  ordinary.coin({ receiptId: 'three' });
  // Recent player construction protects the support pair; identity and color are untouched.
  ordinary.tx((s) => {
    s.board.push({
      id: 'protected-player',
      source: 'player',
      bornShot: 1,
      r: 1,
      c: 2,
      color: 4,
      ...ordinary.pos(1, 2),
    });
  });
  shootAt(ordinary);
  assert.ok(ordinary.snapshot().lowOpportunity.targets.some((b) => b.id === 'lo-fixture-0'));
  assert.ok(ordinary.s.board.some((b) => b.id === 'protected-player' && b.source === 'player'));
});

test('invalid landing refunds once and cannot qualify or retry a pending opportunity', () => {
  const temp = new EndlessGame(),
    cells = [[1, 4, 0], ...temp.neighbors(1, 4).map(([r, c]) => [r, c, 0])];
  let g = fixture({ cells });
  g.coin({ receiptId: 'three' });
  const events = collect(g),
    before = g.s.paidAmmo;
  g.fire();
  g = new EndlessGame({ config: g.config, store: new MemoryStore(g.exportState()) });
  g.onEvent = (e) => events.push(e);
  g.tx((s, emit) =>
    g.settle(
      s,
      s.board.find((b) => b.r === 1 && b.c === 4),
      emit,
    ),
  );
  assert.equal(g.s.paidAmmo, before);
  assert.equal(g.s.refundedShots, 1);
  assert.equal(g.s.lowOpportunity.usedSlots, 0);
  assert.equal(events.filter((e) => e.type.startsWith('lowOpportunity')).length, 0);
  g = new EndlessGame({ config: g.config, store: new MemoryStore(g.exportState()) });
  finish(g);
  assert.equal(g.s.refundedShots, 1);
  assert.equal(g.s.lowOpportunity.usedSlots, 0);
});

test('refunding a paid shot leaves a pre-existing deferred request unchanged through recovery', () => {
  const temp = new EndlessGame(),
    cells = [
      [1, 4, 0, 'bomb'],
      ...temp.neighbors(1, 4).map(([r, c], i) => [r, c, 0, ...(i < 3 ? ['bomb'] : [])]),
    ];
  let g = fixture({ cells });
  g.tx((s) => {
    s.lowOpportunity.cadenceSeed = 17;
  });
  g.coin({ receiptId: 'three' });
  shootAt(g);
  assert.equal(g.s.lowOpportunity.pending.reason, 'insufficientTargets');
  const before = structuredClone(g.s.lowOpportunity),
    events = collect(g);
  g.fire();
  g.tx((s, emit) =>
    g.settle(
      s,
      s.board.find((b) => b.r === 1 && b.c === 4),
      emit,
    ),
  );
  assert.deepEqual(g.s.lowOpportunity, before);
  assert.equal(events.filter((e) => e.type.startsWith('lowOpportunity')).length, 0);
  g = new EndlessGame({ config: g.config, store: new MemoryStore(g.exportState()) });
  assert.deepEqual(g.s.lowOpportunity, before);
});

test('deterministic application neither advances nor introduces any random stream', () => {
  const enabled = fixture(),
    disabled = fixture({ config: { lowOpportunityEnabled: false } });
  for (const g of [enabled, disabled]) {
    g.coin({ receiptId: 'three' });
    shootAt(g);
  }
  assert.equal(enabled.snapshot().lowOpportunity.targets.length, 2);
  assert.equal(disabled.snapshot().lowOpportunity.targets.length, 0);
  for (const key of ['rng', 'bonusRng', 'assistRng'])
    assert.equal(enabled.s[key], disabled.s[key], key);
});

test('in-flight refresh into threshold produces two persistent targets and no replay on settled refresh', () => {
  let g = fixture();
  g.coin({ receiptId: 'three' });
  g.fire();
  g = new EndlessGame({ config: g.config, store: new MemoryStore(g.exportState()) });
  const events = collect(g);
  g.tx((s, emit) => {
    Object.assign(s.projectile, g.pos(0, 0));
    g.settle(s, null, emit);
  });
  assert.equal(events.filter((e) => e.type === 'lowOpportunityQualified').length, 1);
  const saved = g.exportState();
  const h = new EndlessGame({
    config: g.config,
    store: new MemoryStore(saved),
    onEvent: (e) => events.push(e),
  });
  assert.deepEqual(h.s.lowOpportunity, saved.lowOpportunity);
  assert.deepEqual(h.snapshot().lowOpportunity.targets, g.snapshot().lowOpportunity.targets);
  assert.equal(events.filter((e) => e.type === 'lowOpportunityAppeared').length, 2);
});

test('public marked target can be maintained in reserve without harvest, tickets, extra qualification or ID change', () => {
  const g = fixture();
  g.coin({ receiptId: 'three' });
  shootAt(g);
  const target = g.snapshot().lowOpportunity.targets[0],
    count = g.s.lowOpportunity.usedSlots,
    events = collect(g);
  g.tx((s) => {
    const b = s.board.find((b) => b.id === target.id);
    s.board = s.board.filter((b) => b.id !== target.id);
    s.content.reserve.push(b);
  });
  assert.equal(
    g.snapshot().lowOpportunity.targets.find((b) => b.id === target.id).location,
    'reserve',
  );
  const h = new EndlessGame({ config: g.config, store: new MemoryStore(g.exportState()) });
  assert.equal(h.snapshot().lowOpportunity.targets[0].lowOpportunityId, target.lowOpportunityId);
  assert.equal(h.s.lowOpportunity.usedSlots, count);
  assert.equal(h.s.ledger.earned, 0);
  assert.equal(events.length, 0);
});

test('actual harvest feeds existing explosion and ticket rules once and exposes accurate award/voice fields', () => {
  const g = fixture(),
    events = collect(g);
  g.coin({ receiptId: 'three' });
  shootAt(g);
  const target = g.snapshot().lowOpportunity.targets[0],
    moves = g.opportunities().filter((m) => m.direct.some((b) => b.id === target.id));
  const before = g.s.ledger.earned;
  g.setAim(moves[0].angle);
  g.fire();
  finish(g);
  const resolved = events.filter((e) => e.type === 'paidShotResolved').at(-1).payload;
  assert.equal(resolved.earnedDelta, g.s.ledger.earned - before);
  assert.equal(resolved.directCount, resolved.direct.length);
  assert.equal(resolved.dropCount, resolved.dropped.length);
  assert.ok(resolved.lowOpportunityIds.includes(target.lowOpportunityId));
  assert.equal(
    events.filter((e) => e.type === 'lowOpportunityFinished' && e.payload.status === 'consumed')
      .length,
    2,
  );
  assert.ok(events.some((e) => e.type === 'explosionResolved' && e.payload.triggerCount >= 1));
  const h = new EndlessGame({ config: g.config, store: new MemoryStore(g.exportState()) });
  assert.equal(h.s.ledger.earned, g.s.ledger.earned);
});

test('legacy extension preserves existing credit/debt/assist/network and grants no historical consumption catch-up', () => {
  const g = new EndlessGame();
  g.coin({ receiptId: 'ten' });
  actualShots(g, 3);
  const saved = g.exportState();
  delete saved.lowOpportunity;
  delete saved.config.lowOpportunityEnabled;
  const h = new EndlessGame({ store: new MemoryStore(saved) });
  for (const key of [
    'board',
    'content',
    'ledger',
    'paidAmmo',
    'assist',
    'network',
    'rng',
    'bonusRng',
    'assistRng',
  ])
    assert.deepEqual(h.s[key], saved[key]);
  assert.equal(h.snapshot().lowOpportunity.consumed, 0);
  assert.equal(h.s.lowOpportunity.sequence, 0);
});

test('last paid ball cannot create a target after ammo has reached zero', () => {
  const g = fixture(),
    events = collect(g);
  g.coin({ receiptId: 'three' });
  shootAt(g);
  shootAt(g, 4, 1);
  shootAt(g, 4, 4);
  assert.equal(g.s.paidAmmo, 0);
  assert.equal(events.filter((e) => e.type === 'lowOpportunityQualified').length, 1);
  assert.ok(
    events
      .filter((e) => e.type === 'lowOpportunityAppeared')
      .every((e) => [1, 2].includes(e.payload.remainingAmmo)),
  );
});

test('opportunity ball in dual/electric/bomb cross-result is never counted twice', () => {
  const g = fixture({
      config: { assistEnabled: true, conductiveEnabled: true },
      cells: [
        [0, 3, 0],
        [0, 2, 0],
        [0, 4, 2, 'conductor'],
        [0, 5, 3, 'conductor'],
        [0, 6, 4, 'bomb'],
        [1, 4, 2],
      ],
      targets: [
        [0, 7, 2],
        [1, 6, 3],
        [2, 6, 1],
      ],
    }),
    events = collect(g);
  g.coin({ receiptId: 'three' });
  shootAt(g);
  assert.equal(events.filter((e) => e.type === 'lowOpportunityAppeared').length, 2);
  g.tx((s) =>
    Object.assign(s.assist, {
      charge: 3,
      state: 'ready',
      sequence: 1,
      boostId: 'assist-1',
      secondaryColor: 2,
    }),
  );
  const move = g
    .opportunities()
    .filter((m) => m.groups.filter((a) => a.matched).length === 2)
    .sort((a, b) => b.direct.length + b.dropped.length - a.direct.length - a.dropped.length)[0];
  assert.ok(move, 'fixture provides a real two-color route');
  const before = g.s.ledger.earned;
  g.setAim(move.angle);
  g.fire();
  finish(g);
  const result = events.filter((e) => e.type === 'paidShotResolved').at(-1).payload;
  assert.equal(result.explosionCount, 3);
  assert.equal(result.electricCount, 10);
  assert.equal(new Set(result.electricIds).size, result.electricCount);
  assert.equal(result.bonus, 8);
  assert.equal(result.earnedDelta, result.gain + 8);
  assert.equal(g.s.ledger.earned - before, result.earnedDelta);
  assert.equal(
    new Set([...result.direct, ...result.dropped].map((b) => b.id)).size,
    result.directCount + result.dropCount,
  );
  assert.equal(
    events.filter((e) => e.type === 'lowOpportunityFinished' && e.payload.status === 'consumed')
      .length,
    2,
  );
  assert.equal(events.filter((e) => e.type === 'targetsCollected').at(-1).payload.progress, 3);
  assert.equal(g.s.assist.charge, 0);
});

test('already credited stage never emits a fake new box award or inflates actual shot ticket feedback', () => {
  const g = fixture({
      cells: [],
      targets: [
        [0, 2, 0],
        [0, 3, 0],
        [0, 4, 0],
      ],
    }),
    events = collect(g);
  g.tx((s) => earn(s.ledger, 'stage-1', 8));
  g.coin({ receiptId: 'three' });
  const before = g.s.ledger.earned;
  shootAt(g, 0, 1);
  const result = events.find((e) => e.type === 'paidShotResolved').payload;
  assert.equal(result.bonus, 0);
  assert.equal(result.earnedDelta, g.s.ledger.earned - before);
  assert.equal(result.earnedDelta, result.gain);
  assert.equal(events.filter((e) => e.type === 'stageBonusEarned').length, 0);
  assert.equal(g.s.ledger.rewards['stage-1'].count, 8);
});
