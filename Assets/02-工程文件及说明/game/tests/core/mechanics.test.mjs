import test from 'node:test';
import assert from 'node:assert/strict';
import { EndlessGame, MemoryStore, SimulatedDispenser } from '../../src/core/index.mjs';
import { outcome } from '../../src/core/geometry.mjs';
import { networkView, updateNetwork, expandMechanisms } from '../../src/core/mechanics.mjs';
import { evolve } from '../../src/core/board-policy.mjs';
import { earn } from '../../src/core/ledger.mjs';
import { finish, seeded } from '../helpers/strategies.mjs';

function fixture(cells, config = {}) {
  const g = new EndlessGame({ petSlotsEnabled: false, config }),
    s = g.exportState();
  s.board = cells.map(([r, c, color, kind], i) => ({
    id: `f${i}`,
    r,
    c,
    color,
    source: 'system',
    ...(kind ? { kind } : {}),
    ...(kind === 'target' ? { stageId: 1 } : {}),
    ...(kind === 'conductor' ? { networkId: 'network-1' } : {}),
    ...g.pos(r, c),
  }));
  s.content.reserve = [];
  s.content.credit = 0;
  s.content.initialSystemCount = cells.length;
  s.network.sequence = 1;
  s.network.id = cells.some((b) => b[3] === 'conductor') ? 'network-1' : null;
  s.network.nextEligibleRefill = 999;
  s.stage = {
    id: 1,
    award: 8,
    targetIds: s.board.filter((b) => b.kind === 'target').map((b) => b.id),
    collectedIds: [],
  };
  return new EndlessGame({ petSlotsEnabled: false, config: g.config, store: new MemoryStore(s) });
}
function arm(g, secondaryColor) {
  g.tx((s) =>
    Object.assign(s.assist, {
      charge: g.config.assistThreshold,
      state: 'ready',
      boostId: `assist-${++s.assist.sequence}`,
      secondaryColor,
    }),
  );
}
function shootAt(g, color, r, c, hit = null) {
  g.tx((s) => {
    s.loadedColor = color;
  });
  assert.equal(g.fire(), true);
  g.tx((s, emit) => {
    Object.assign(s.projectile, g.pos(r, c));
    g.settle(s, hit, emit);
  });
  g.advance(0.25);
}
function paid(g) {
  g.coin({ receiptId: 'credit', coins: 10 });
}

test('dual matching requires independent triples, union counts projectile once, identical/null colors once', () => {
  const g = fixture([
    [0, 2, 0],
    [0, 3, 0],
    [0, 5, 1],
    [0, 6, 1],
  ]);
  const cell = { r: 0, c: 4, ...g.pos(0, 4) };
  for (const [secondary, count] of [
    [1, 5],
    [0, 3],
    [null, 3],
    [2, 3],
  ]) {
    const result = outcome(g.s.board, 0, g.config, cell, 0, secondary);
    assert.equal(result.direct.length, count);
    assert.equal(new Set(result.direct.map((b) => b.id)).size, count);
  }
  const small = fixture([
    [0, 3, 0],
    [0, 5, 1],
  ]);
  const result = outcome(small.s.board, 0, small.config, cell, 0, 1);
  assert.equal(result.direct.length, 0, 'one old ball of each color cannot combine into a triple');
  assert.equal(result.board.at(-1).color, 0);
  assert.equal(result.board.at(-1).kind, undefined);
});

test('ordinary success adds one, a miss retains charge, free play and refill never add charge', () => {
  const g = fixture([
    [0, 2, 0],
    [0, 3, 0],
    [0, 5, 1],
    [0, 6, 1],
  ]);
  paid(g);
  const events = [];
  g.onEvent = (e) => events.push(e);
  shootAt(g, 0, 0, 4);
  assert.equal(g.s.assist.charge, 1);
  shootAt(g, 4, 0, 8);
  assert.equal(g.s.assist.charge, 1);
  assert.equal(events.filter((e) => e.type === 'assistChargeChanged').length, 1);
});

test('third ordinary success fixes a separate-stream secondary; ready survives snapshot restore', () => {
  const g = fixture([
    [0, 2, 0],
    [0, 3, 0],
    [0, 5, 1],
    [0, 6, 1],
  ]);
  paid(g);
  g.tx((s) => {
    s.assist.charge = 2;
  });
  const bonusRng = g.s.bonusRng;
  shootAt(g, 0, 0, 4);
  assert.equal(g.s.assist.state, 'ready');
  assert.equal(g.s.assist.charge, 3);
  assert.notEqual(g.s.assist.secondaryColor, g.s.loadedColor);
  assert.equal(g.s.bonusRng, bonusRng);
  const h = new EndlessGame({ petSlotsEnabled: false, store: new MemoryStore(g.exportState()) });
  assert.deepEqual(h.snapshot().assist, g.snapshot().assist);
});

test('single-color qualification is explicit null; same-color partner does not get redrawn', () => {
  const g = fixture(
    [
      [0, 2, 0],
      [0, 3, 0],
      [0, 8, 0],
    ],
    { densityEnabled: false },
  );
  paid(g);
  g.tx((s) => {
    s.assist.charge = 2;
    s.nextColor = 0;
    s.content.reserve.push(...s.board.slice(2));
    s.board = s.board.slice(0, 2);
  });
  // Reserve retains the only residual system inventory; no refill draws a new color.
  shootAt(g, 0, 0, 4);
  assert.equal(g.s.assist.secondaryColor, null);
  const rng = g.s.assistRng;
  shootAt(g, 0, 0, 7);
  assert.equal(g.s.assist.charge, 0);
  assert.equal(g.s.assistRng, rng);
});

test('dual paid settlement consumes once, preserves physical trace and does not self-charge', () => {
  const g = fixture([
    [0, 2, 0],
    [0, 3, 0],
    [0, 5, 1],
    [0, 6, 1],
  ]);
  paid(g);
  arm(g, 1);
  g.tx((s) => {
    s.loadedColor = 0;
  });
  const trace = g.trace(0),
    events = [];
  g.onEvent = (e) => events.push(e);
  assert.equal(g.fire(), true);
  assert.deepEqual(g.trace(0).points, trace.points);
  const inFlight = new EndlessGame({ petSlotsEnabled: false, store: new MemoryStore(g.exportState()) });
  assert.equal(inFlight.s.projectile.assist.secondaryColor, 1);
  inFlight.onEvent = (e) => events.push(e);
  inFlight.tx((s, emit) => {
    Object.assign(s.projectile, inFlight.pos(0, 4));
    inFlight.settle(s, null, emit);
  });
  assert.equal(inFlight.s.ledger.rewards['shot-1:basic'].count, 5);
  assert.equal(inFlight.s.assist.charge, 0);
  assert.equal(events.filter((e) => e.type === 'assistConsumed').length, 1);
  assert.equal(events.filter((e) => e.type === 'assistChargeChanged').length, 0);
});

test('failed dual attachment leaves a plain primary player ball and earns nothing', () => {
  const g = fixture([
    [0, 3, 0],
    [0, 5, 1],
  ]);
  paid(g);
  arm(g, 1);
  shootAt(g, 0, 0, 4);
  const b = g.s.board.find((b) => b.source === 'player');
  assert.equal(b.color, 0);
  assert.equal(b.kind, undefined);
  assert.equal(g.s.ledger.earned, 0);
  assert.equal(g.s.assist.charge, 0);
});

test('bomb/electric mutual propagation closes once, collecting three stars and keeping base/bonus distinct', () => {
  const g = fixture([
    [0, 2, 0],
    [0, 3, 0, 'conductor'],
    [0, 4, 2, 'conductor'],
    [0, 5, 3, 'bomb'],
    [0, 6, 4, 'conductor'],
    [1, 5, 1, 'bomb'],
    [1, 6, 2, 'target'],
    [2, 5, 3, 'target'],
    [2, 6, 4, 'target'],
  ]);
  paid(g);
  const events = [];
  g.onEvent = (e) => events.push(e);
  shootAt(g, 0, 0, 1);
  const resolved = events.find((e) => e.type === 'paidShotResolved').payload;
  assert.equal(resolved.direct.length, 10);
  assert.equal(resolved.electricIds.length, 8);
  assert.equal(new Set(resolved.electricIds).size, 8);
  assert.equal(resolved.bonus, 8);
  assert.equal(g.s.ledger.earned, 18);
  assert.equal(events.find((e) => e.type === 'explosionResolved').payload.triggers.length, 2);
  assert.equal(events.find((e) => e.type === 'networkPropagated').payload.bombContacts.length, 2);
  assert.equal(new Set([...resolved.direct, ...resolved.dropped].map((b) => b.id)).size, 10);
  assert.equal(g.s.assist.charge, 1, 'large chain is one success, not many');
  assert.equal(
    events.filter((e) => e.type === 'networkCreated').length,
    0,
    'no immediate replacement',
  );
  const h = new EndlessGame({ petSlotsEnabled: false, store: new MemoryStore(g.exportState()) });
  assert.equal(h.s.ledger.earned, 18);
});

test('conductor only dropping does not propagate and its network ends without a new one', () => {
  const g = fixture([
    [0, 4, 0],
    [1, 4, 0],
    [2, 4, 2, 'conductor'],
    [3, 4, 3, 'conductor'],
  ]);
  paid(g);
  const events = [];
  g.onEvent = (e) => events.push(e);
  shootAt(g, 0, 0, 3);
  assert.equal(events.filter((e) => e.type === 'networkActivated').length, 0);
  assert.equal(events.filter((e) => e.type === 'networkEnded').length, 1);
  assert.equal(events.find((e) => e.type === 'paidShotResolved').payload.dropped.length, 2);
});

test('free color selection, idle, coin during free flight and last paid ball preserve public qualification', () => {
  let g = new EndlessGame({ petSlotsEnabled: false });
  arm(g, 1);
  const saved = g.exportState();
  for (let i = 0; i < 5; i++) {
    g.fire();
    finish(g);
  }
  assert.deepEqual(g.s.assist, saved.assist);
  assert.deepEqual(g.s.network, saved.network);
  assert.deepEqual(g.s.board, saved.board);
  assert.equal(g.s.assistRng, saved.assistRng);
  g.fire();
  g.coin({ receiptId: 'during-free' });
  assert.equal(g.s.projectile.assist, undefined);
  finish(g);
  g = new EndlessGame({ petSlotsEnabled: false, store: new MemoryStore(g.exportState()) });
  assert.equal(g.s.assist.state, 'ready');
  // A real one-ball purchased credit covers the last paid ball while balance becomes zero.
  g = new EndlessGame({ petSlotsEnabled: false, config: { ballsPerCoin: 1 } });
  arm(g, 1);
  g.coin({ receiptId: 'one' });
  g.fire();
  assert.equal(g.s.paidAmmo, 0);
  assert.ok(g.s.projectile.assist);
  finish(g);
  assert.equal(g.s.assist.state, 'charging');
});

test('blocked dual refunds identical qualification once across in-flight and settled recovery', () => {
  const temp = new EndlessGame({ petSlotsEnabled: false }),
    cells = [[1, 4, 0], ...temp.neighbors(1, 4).map(([r, c]) => [r, c, 0])];
  let g = fixture(cells);
  paid(g);
  arm(g, 2);
  const before = g.s.paidAmmo,
    boostId = g.s.assist.boostId;
  g.fire();
  g = new EndlessGame({ petSlotsEnabled: false, store: new MemoryStore(g.exportState()) });
  g.tx((s, emit) =>
    g.settle(
      s,
      s.board.find((b) => b.r === 1 && b.c === 4),
      emit,
    ),
  );
  assert.equal(g.s.paidAmmo, before);
  assert.equal(g.s.refundedShots, 1);
  assert.equal(g.s.assist.boostId, boostId);
  assert.equal(g.s.assist.secondaryColor, 2);
  assert.equal(g.s.assist.state, 'ready');
  g = new EndlessGame({ petSlotsEnabled: false, store: new MemoryStore(g.exportState()) });
  finish(g);
  assert.equal(g.s.refundedShots, 1);
  assert.equal(g.s.paidAmmo, before);
});

test('maintenance moves nodes without reward, edges reflect visible adjacency; no free network top-up', () => {
  const g = fixture([
    [0, 0, 0, 'conductor'],
    [0, 1, 1, 'conductor'],
    [0, 2, 2, 'conductor'],
  ]);
  g.tx((s, emit) => {
    const before = networkView(g, s);
    s.content.reserve.push(s.board.pop());
    updateNetwork(g, s, emit, 'maintenance-fixture', before, s.content.refills);
  });
  assert.equal(g.snapshot().network.nodes.length, 2);
  assert.equal(g.snapshot().network.edges.length, 1);
  assert.equal(g.snapshot().network.reserveNodeIds.length, 1);
  g.tx((s, emit) => {
    const before = networkView(g, s),
      refills = s.content.refills;
    evolve(g, s, emit, 'maintenance-fixture', false);
    updateNetwork(g, s, emit, 'maintenance-fixture', before, refills);
  });
  assert.equal(
    g.snapshot().network.nodes.length,
    2,
    'reserve waits for a full top wave instead of filling a hole',
  );
  assert.equal(g.snapshot().network.reserveNodeIds.length, 1);
  assert.equal(g.s.ledger.earned, 0);
  assert.equal(g.s.assist.charge, 0);
});

test('network creation requires real refill and cooldown, never coin or loading', () => {
  const g = fixture([
    [0, 0, 0],
    [0, 1, 1],
    [0, 2, 2],
  ]);
  const before = g.snapshot().network;
  g.s.network.nextEligibleRefill = 1;
  g.tx((s, emit) => updateNetwork(g, s, emit, 'no-refill', before, 0));
  assert.equal(g.s.network.id, null);
  g.tx((s, emit) => {
    s.content.refills = 1;
    updateNetwork(g, s, emit, 'actual-refill', before, 0);
  });
  assert.equal(g.snapshot().network.nodes.length, 3);
  assert.equal(g.s.network.nextEligibleRefill, 4);
  const h = new EndlessGame({ petSlotsEnabled: false, store: new MemoryStore(g.exportState()) });
  assert.deepEqual(h.snapshot().network, g.snapshot().network);
});

test('1.2 legacy saves upgrade additively including paid flight, pending and uncertain device evidence', () => {
  const g = new EndlessGame({ petSlotsEnabled: false, config: { assistEnabled: false, conductiveEnabled: false } });
  g.tx((s) => earn(s.ledger, 'legacy-earned', 7));
  const batch = g.prepareDispense();
  g.sendDispense(batch.id);
  g.coin({ receiptId: 'legacy' });
  g.fire();
  const saved = g.exportState();
  for (const k of ['mechanicsVersion', 'assist', 'network', 'assistRng']) delete saved[k];
  for (const k of [
    'assistEnabled',
    'assistThreshold',
    'conductiveEnabled',
    'conductiveMaxNodes',
    'conductiveRefillGap',
    'conductivePaidGap',
  ])
    delete saved.config[k];
  const h = new EndlessGame({ petSlotsEnabled: false, store: new MemoryStore(saved) });
  for (const k of [
    'board',
    'content',
    'stage',
    'receipts',
    'projectile',
    'paidAmmo',
    'rng',
    'bonusRng',
  ])
    assert.deepEqual(h.s[k], saved[k], k);
  assert.equal(h.s.ledger.earned, 7);
  assert.equal(h.s.ledger.confirmed, 0);
  assert.equal(h.s.ledger.batches[0].status, 'uncertain');
  assert.equal(h.prepareDispense(), null);
  assert.equal(h.s.assist.charge, 0);
  assert.equal(h.s.network.id, null);
  finish(h);
  assert.ok(h.s.ledger.earned >= h.s.ledger.confirmed);
});

test('transaction failure cannot consume qualification or publish uncommitted assistance', () => {
  const initial = new EndlessGame({ petSlotsEnabled: false });
  arm(initial, 2);
  paid(initial);
  const durable = initial.exportState(),
    delivered = [];
  const store = new MemoryStore(durable),
    g = new EndlessGame({ petSlotsEnabled: false, store, onEvent: (e) => delivered.push(e) });
  store.save = () => {
    throw Error('disk failure');
  };
  assert.throws(() => g.fire(), /disk failure/);
  assert.deepEqual(g.exportState(), durable);
  assert.equal(delivered.length, 0);
  assert.throws(() => g.fire(), /Storage fault/);
  const restored = new EndlessGame({ petSlotsEnabled: false, store: new MemoryStore(durable) });
  restored.fire();
  assert.equal(restored.s.projectile.assist.boostId, durable.assist.boostId);
});

test('bomb first activates a conductive seed, then remote connected node ignites a second bomb', () => {
  const g = fixture([
    [0, 2, 0],
    [0, 3, 0, 'bomb'],
    [0, 4, 2, 'conductor'],
    [0, 5, 3, 'conductor'],
    [0, 6, 1, 'bomb'],
    [1, 6, 4, 'conductor'],
  ]);
  const expanded = expandMechanisms(g, g.s, [g.s.board[0], g.s.board[1]]);
  assert.equal(expanded.triggers.length, 2);
  assert.equal(expanded.electric.activatedNodes.length, 3);
  assert.equal(expanded.electric.seeds[0].id, 'f2');
  assert.equal(expanded.electric.bombContacts[0].toId, 'f4');
  assert.equal(new Set(expanded.direct.map((b) => b.id)).size, expanded.direct.length);
});

test('ready qualification can become one color through free selection, with partner and random stream locked', () => {
  const g = new EndlessGame({ petSlotsEnabled: false });
  arm(g, 1);
  const random = g.s.assistRng;
  while (g.s.loadedColor !== 1) {
    g.fire();
    finish(g);
  }
  const chosen = g.s.loadedColor,
    events = [];
  g.onEvent = (e) => events.push(e);
  g.coin({ receiptId: 'selected' });
  g.fire();
  assert.equal(g.s.projectile.assist.primaryColor, chosen);
  assert.equal(g.s.projectile.assist.secondaryColor, chosen);
  finish(g);
  assert.equal(events.find((e) => e.type === 'dualMatchResolved').payload.groups.length, 1);
  assert.equal(g.s.assistRng, random);
});

test('actual trajectory settlement matches shared dual/bomb/electric opportunity projection', () => {
  const g = new EndlessGame({ petSlotsEnabled: false, seed: 11 });
  paid(g);
  arm(g, 1);
  const moves = g
    .opportunities()
    .sort(
      (a, b) => b.direct.length + 2 * b.dropped.length - a.direct.length - 2 * a.dropped.length,
    );
  const expected = moves[0],
    events = [];
  g.onEvent = (e) => events.push(e);
  g.setAim(expected.angle);
  g.fire();
  finish(g);
  const result = events.find((e) => e.type === 'paidShotResolved').payload;
  assert.equal(result.direct.length, expected.direct.length);
  assert.equal(result.dropped.length, expected.dropped.length);
  assert.equal(result.attached.r, expected.cell.r);
  assert.equal(result.attached.c, expected.cell.c);
});

test('cross-color bridges cannot traverse an opposite color and electric edges never cross empty gaps', () => {
  const g = fixture([
    [0, 2, 0],
    [0, 3, 1],
    [0, 5, 0],
    [0, 6, 1],
  ]);
  const result = outcome(g.s.board, 0, g.config, { r: 0, c: 4, ...g.pos(0, 4) }, 0, 1);
  assert.equal(result.direct.length, 0);
  const split = fixture([
    [0, 0, 0, 'conductor'],
    [0, 1, 4],
    [0, 2, 1, 'conductor'],
    [0, 3, 2, 'conductor'],
  ]);
  assert.equal(split.snapshot().network.edges.length, 1);
  const expanded = expandMechanisms(split, split.s, [split.s.board[0]]);
  assert.deepEqual(
    expanded.direct.map((b) => b.id),
    ['f0', 'f1', 'f2', 'f3'],
  );
  assert.equal(expanded.electric.activatedNodes.length, 3);
  assert.ok(
    expanded.electric.steps.every((e) => {
      const a = split.s.board.find((b) => b.id === e.fromId);
      const b = split.s.board.find((b) => b.id === e.toId);
      return split.neighbors(a.r, a.c).some(([r, c]) => r === b.r && c === b.c);
    }),
  );
  const gap = fixture([
    [0, 0, 0, 'conductor'],
    [0, 2, 1, 'conductor'],
    [0, 3, 2, 'conductor'],
  ]);
  assert.equal(expandMechanisms(gap, gap.s, [gap.s.board[0]]).direct.length, 1);
});

test('1000 mixed history preserves qualification, bounded network, colors, tickets and in-flight reloads', () => {
  let g = new EndlessGame({ petSlotsEnabled: false, seed: 202611 }),
    rng = seeded(77),
    events = [];
  const device = new SimulatedDispenser();
  g.onEvent = (e) => events.push(e);
  g.coin({ receiptId: 'history', coins: 110 });
  for (let i = 0; i < 1000; i++) {
    const moves = g.opportunities();
    const angle =
      i % 3
        ? (moves.sort(
            (a, b) =>
              b.direct.length + 2 * b.dropped.length - (a.direct.length + 2 * a.dropped.length),
          )[0]?.angle ?? 0)
        : (rng() * 2 - 1) * g.config.maxAim;
    g.setAim(angle);
    g.fire();
    if (i % 53 === 0) {
      g = new EndlessGame({ petSlotsEnabled: false, store: new MemoryStore(g.exportState()) });
      g.onEvent = (e) => events.push(e);
    }
    finish(g);
    device.tick(g, 0.25);
    g.validate(g.s);
    assert.ok(g.snapshot().network.nodes.length + g.snapshot().network.reserveNodeIds.length <= 3);
  }
  assert.equal(g.s.paidAmmo, 100 + g.s.refundedShots + g.s.ammoBonus.total);
  assert.ok(events.some((e) => e.type === 'assistReady'));
  assert.ok(events.some((e) => e.type === 'networkPropagated'));
  assert.ok(g.s.ledger.earned >= g.s.ledger.confirmed);
});
