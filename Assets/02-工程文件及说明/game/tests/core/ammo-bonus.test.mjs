import test from 'node:test';
import assert from 'node:assert/strict';
import { EndlessGame, MemoryStore } from '../../src/core/index.mjs';
import { clearAmmoBonus, grantAmmoBonus } from '../../src/core/ammo-bonus.mjs';
import { finish } from '../helpers/strategies.mjs';

test('clear bonus uses 7/8/9/10+ -> 2/3/4/5, counts IDs once and does not duplicate rewards', () => {
  assert.deepEqual([0, 6, 7, 8, 9, 10, 40].map(clearAmmoBonus), [0, 0, 2, 3, 4, 5, 5]);
  const g = new EndlessGame(),
    events = [];
  g.tx((s, emit) => {
    const balls = Array.from({ length: 7 }, (_, i) => ({ id: 'bonus-' + i }));
    grantAmmoBonus(s, 'unit-shot', balls, balls.slice(0, 2), emit);
    grantAmmoBonus(s, 'unit-shot', balls, [], emit);
  });
  assert.equal(g.s.paidAmmo, 2);
  assert.equal(g.s.ammoBonus.total, 2);
  assert.equal(new EndlessGame({ store: new MemoryStore(g.exportState()) }).s.paidAmmo, 2);
});

test('actual seven-ball clear grants two usable balls, persists in-flight and emits once', () => {
  let g = new EndlessGame({
      config: { densityEnabled: false, assistEnabled: false, conductiveEnabled: false },
    }),
    s = g.exportState();
  s.board = Array.from({ length: 6 }, (_, c) => ({
    id: 'clear-' + c,
    r: 0,
    c,
    color: 0,
    source: 'system',
    ...g.pos(0, c),
  }));
  s.content.reserve = [];
  s.content.credit = 0;
  s.content.initialSystemCount = 6;
  s.stage.targetIds = [];
  s.stage.collectedIds = [];
  s.loadedColor = s.nextColor = 0;
  s.bombPlan = 0;
  g = new EndlessGame({ config: g.config, store: new MemoryStore(s) });
  const events = [];
  g.onEvent = (e) => events.push(e);
  g.coin({ receiptId: 'real-clear' });
  g.setAim(0);
  g.fire();
  g = new EndlessGame({
    config: g.config,
    store: new MemoryStore(g.exportState()),
    onEvent: (e) => events.push(e),
  });
  finish(g);
  const reward = events.find((e) => e.type === 'ammoBonusEarned');
  assert.ok(reward);
  assert.equal(reward.payload.count, 2);
  assert.equal(reward.payload.clearedCount, 7);
  assert.equal(g.s.paidAmmo, 11);
  assert.equal(g.s.ammoBonus.total, 2);
  const restored = new EndlessGame({ config: g.config, store: new MemoryStore(g.exportState()) });
  assert.deepEqual(restored.s.ammoBonus, g.s.ammoBonus);
  assert.equal(events.filter((e) => e.type === 'ammoBonusEarned').length, 1);
});

test('legacy save gets zero bonus credit and free trial cannot earn gifted balls', () => {
  const g = new EndlessGame(),
    saved = g.exportState();
  delete saved.ammoBonus;
  const h = new EndlessGame({ store: new MemoryStore(saved) });
  assert.equal(h.s.ammoBonus.total, 0);
  h.fire();
  finish(h);
  assert.equal(h.s.paidAmmo, 0);
  assert.equal(h.s.ammoBonus.total, 0);
});
