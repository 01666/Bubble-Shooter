import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MechanismDirector } from '../../src/feedback/mechanisms/director.mjs';
import { CoreMechanismBridge, assistColors } from '../../src/feedback/mechanisms/core-bridge.mjs';
import { fixture, hitEvents } from '../../dev/mechanisms/mock-fixtures.mjs';
import {
  createMechanismFeedback,
  sceneOrbModels,
} from '../../src/feedback/mechanisms/integration.mjs';

test('live transfer is covered once and original visibility returns next frame and on downgrade', () => {
  const mesh = () => ({
    enabled: true,
    disposed: false,
    metadata: { diameter: 80 },
    scaling: { x: 0.75 },
    computeWorldMatrix() {},
    getAbsolutePosition() {
      return { x: 420, y: -1380 };
    },
    isEnabled() {
      return this.enabled;
    },
    setEnabled(v) {
      this.enabled = v;
    },
    isDisposed() {
      return this.disposed;
    },
  });
  const transfer = mesh(),
    loaded = mesh(),
    projectile = mesh();
  loaded.enabled = false;
  const feedback = createMechanismFeedback(),
    s = { projectile: { assist: { primaryColor: 1, secondaryColor: 2 } } };
  const models = sceneOrbModels({ loadTransfer: { mesh: transfer }, loaded, projectile }, s);
  assert.equal(models.loadedMesh, transfer);
  assert.equal(models.loaded.radius, 30);
  assert.equal(models.loaded.y, 1380);
  feedback.applyOrbVisibility(models, { loaded: true, projectile: true });
  assert.equal(transfer.enabled, false);
  assert.equal(projectile.enabled, false);
  feedback.restoreOrbVisibility();
  assert.equal(transfer.enabled, true);
  assert.equal(projectile.enabled, true);
  assert.equal(loaded.enabled, false);
  feedback.applyOrbVisibility(models, { loaded: true, projectile: true });
  feedback.setEnabled(false);
  assert.equal(transfer.enabled, true);
  assert.equal(projectile.enabled, true);
  feedback.dispose();
});

test('actual 200-shot core fixture adapts v1 groups and networks without inventing cells or edges', () => {
  const f = JSON.parse(
    fs.readFileSync(new URL('../fixtures/mechanics-events.json', import.meta.url), 'utf8'),
  );
  const d = new MechanismDirector(),
    bridge = new CoreMechanismBridge(d);
  bridge.restore(f.initial);
  let dual = 0,
    networks = 0;
  let snapshot = f.initial;
  for (const result of f.events.filter((e) => e.type === 'paidShotResolved')) {
    const id = result.payload.shotId,
      events = f.events.filter((e) => e.payload?.shotId === id || e.causeId === id);
    snapshot = f.checkpoints.find((c) => `shot-${c.shot}` === id)?.snapshot ?? snapshot;
    const packets = bridge.consume(events, snapshot),
      resolve = result;
    for (const p of packets.filter((p) => p.kind === 'resolve')) {
      const ids = new Set(resolve.payload.direct.map((b) => b.id));
      for (const g of p.colorGroups) for (const b of g.cells) assert.ok(ids.has(b.id), b.id);
      assert.deepEqual(p.electric.removedIds, resolve.payload.electricIds ?? []);
      const actual = events.find((e) => e.type === 'networkPropagated');
      if (actual) {
        networks++;
        assert.equal(p.electric.steps.length, actual.payload.steps.length);
      }
      if (events.some((e) => e.type === 'dualMatchResolved')) dual++;
    }
    for (let i = 0; i < 21; i++) d.update(0.1);
  }
  assert.equal(dual, f.eventCounts.dualMatchResolved);
  assert.equal(networks, f.eventCounts.networkPropagated);
  assert.equal(bridge.stats().pending, 0);
  assert.deepEqual(bridge.stats().warnings, []);
});

test('v1 adapter claims matched and conducting cells once, leaving drops for the original effects', () => {
  const d = new MechanismDirector(),
    b = new CoreMechanismBridge(d),
    s = fixture();
  b.restore(s);
  const hit = hitEvents(s, 'combined', 10),
    removed = new Set([...hit.direct, ...hit.dropped].map((n) => n.id));
  const next = {
    ...s,
    board: s.board.filter((n) => !removed.has(n.id)),
    network: { nodes: [], edges: [] },
  };
  b.consume(hit.events, next);
  const e = d.effects.find((e) => e.kind === 'resolve');
  assert.equal(e.pops.length, 3);
  assert.equal(e.steps.length, 2);
  assert.equal(d.claimedIds.size, hit.direct.length);
  assert.equal(
    e.groups.flatMap((g) => g.cells).some((n) => n.id === s.network.nodes[0].id),
    false,
  );
  const count = d.effects.length;
  b.consume(hit.events, next);
  assert.equal(d.effects.length, count);
  assert.equal(b.stats().warnings.length, 0);
  const clock = d.clock;
  d.update(0.1, { paused: true });
  assert.equal(d.clock, clock);
});
test('single color, failure and dropped nodes never invent another successful color or electricity', () => {
  for (const mode of ['one', 'miss', 'dropped']) {
    const d = new MechanismDirector(),
      b = new CoreMechanismBridge(d),
      s = fixture();
    b.restore(s);
    b.consume(hitEvents(s, mode, 20).events, s);
    const e = d.effects.find((e) => e.kind === 'resolve');
    if (mode === 'one') {
      assert.deepEqual(
        e.groups.map((g) => g.color),
        [1],
      );
      assert.equal(e.pops.length, 0);
      assert.equal(e.steps.length, 0);
    } else assert.equal(e, undefined);
  }
  assert.deepEqual(assistColors({ primaryColor: 1, secondaryColor: 1 }), [1]);
  assert.deepEqual(assistColors({ primaryColor: 2, secondaryColor: null }), [2]);
});
test('restored readiness is static; chest priority defers new ready cue and pose', () => {
  const cues = [],
    d = new MechanismDirector({ onCue: (c) => cues.push(c) }),
    b = new CoreMechanismBridge(d),
    s = fixture();
  s.assist.state = 'ready';
  s.assist.charge = 3;
  b.restore(s);
  d.update(0.1);
  assert.equal(cues.length, 0);
  b.consume([{ eventId: 'event-30', type: 'assistReady', payload: { interfaceVersion: 1 } }], s);
  for (let i = 0; i < 12; i++) d.update(0.1, { priorityBusy: true });
  assert.equal(cues.length, 0);
  assert.deepEqual(d.petPose({ head: 0.1 }), { head: 0.1 });
  d.update(0.1, { priorityBusy: false });
  assert.equal(cues.filter((c) => c.name === 'assist-ready').length, 1);
  d.update(0.1);
  assert.equal(cues.length, 1);
});
test('long repeated feeds are bounded, effects recycle, impacts are capped, restore fences old events', () => {
  const cues = [],
    d = new MechanismDirector({ onCue: (c) => cues.push(c) }),
    b = new CoreMechanismBridge(d),
    s = fixture();
  b.restore(s);
  for (let i = 1; i < 3000; i++) {
    d.consume([
      {
        id: `id-${i}`,
        kind: 'resolve',
        colorGroups: [{ color: 1, cells: [{ id: `ball-${i}`, x: 20, y: 20 }] }],
      },
    ]);
    d.update(0.01, { reduced: true });
  }
  assert.ok(d.stats().effects <= 32);
  assert.ok(d.stats().seen <= 2048);
  assert.ok(d.stats().retired <= 512);
  for (let i = 0; i < 25; i++) d.update(0.1);
  assert.equal(d.stats().effects, 0);
  assert.ok(cues.filter((c) => c.name === 'mechanism-impact').length < 150);
  b.restore(s, { eventSequence: 5000 });
  d.consume([{ id: 'event-4000', sequence: 4000, kind: 'ready' }]);
  assert.equal(d.stats().effects, 0);
  d.dispose();
  assert.equal(d.stats().retired, 0);
});
