import test from 'node:test';
import assert from 'node:assert/strict';
import { PetSlotFeedback } from '../../src/feedback/pet-slots/index.mjs';
const snapshot = (changes = {}) => ({ petSlots: { charge: 2, threshold: 3, state: 'charging', ...changes }, combo: { streak: 2, tier: 1 } });
const event = (type, payload, eventId = type) => ({ type, payload, eventId });
const start = event('petSlotStarted', { spinId: 's1', rewardType: 'ammo', label: '赠送泡泡', count: 4, duration: 2.6 });
const resolved = event('petSlotResolved', { spinId: 's1', rewardType: 'ammo', count: 4, actualAmmoDelta: 4, removed: [], added: [] });
test('pet slots uses committed outcome once and never mutates gameplay snapshot', () => {
  const calls = [], room = [];
  const f = new PetSlotFeedback({ audio: { playCue: (...args) => calls.push(args) }, room: { consume: (events) => room.push(events) } });
  const s = snapshot(); const before = JSON.stringify(s);
  f.restore(s); f.consume([start, start], s); assert.equal(calls.length, 1); assert.equal(f.active, true);
  f.consume([resolved, resolved], s); assert.equal(calls.length, 2); assert.equal(room.length, 1);
  assert.equal(JSON.stringify(s), before); assert.equal(f.result.actualAmmoDelta, 4);
  // The semantic spin id deduplicates even if a transport supplies a different event id.
  f.consume([{ ...resolved, eventId: 'duplicate-new-id' }], s); assert.equal(calls.length, 2);
});
test('pause freezes result lifetime; reduced motion still presents reward', () => {
  const f = new PetSlotFeedback(); f.restore(snapshot()); f.consume([resolved]);
  for (let i = 0; i < 30; i++) f.update(0.1, snapshot(), { paused: true, reduced: true });
  assert.equal(f.result.age, 0); assert.equal(f.active, true); assert.equal(f.reduced, true);
  for (let i = 0; i < 18; i++) f.update(0.1, snapshot(), { reduced: true });
  assert.equal(f.active, false); assert.equal(f.effects.length, 0);
});
test('restore continues authoritative countdown silently, never replays completed reward', () => {
  const calls = [];
  const f = new PetSlotFeedback({ audio: { playCue: (name) => calls.push(name) } });
  const p = { ...start.payload };
  const s = snapshot({ state: 'spinning', spinId: 's1', remaining: 0.8, pending: p });
  f.restore(s); assert.ok(Math.abs(f.spin.elapsed - 1.8) < 1e-9);
  f.consume([start], s); f.update(0.1, s); assert.equal(calls.length, 0);
  f.consume([resolved], snapshot()); assert.equal(calls.length, 1);
  f.restore(snapshot({ lastResult: resolved.payload })); f.consume([resolved]);
  assert.equal(calls.length, 1); assert.equal(f.active, false);
});
test('electric geometry and special reveal only use committed actual balls', () => {
  const f = new PetSlotFeedback({ mapPoint: (b) => ({ x: b.x * 10, y: b.y * 10 }) });
  f.restore(snapshot());
  f.consume([event('petSlotResolved', { spinId: 'electric', rewardType: 'lightning', removed: [{ id: 'a', x: 1, y: 2 }], electricPaths: [{ fromId: 'a', toId: 'b', from: { x: 1, y: 2 }, to: { x: 3, y: 4 } }] })]);
  assert.deepEqual(f.effects[0].paths[0].map(({ x, y }) => [x, y]), [[10, 20], [30, 40]]);
  f.consume([event('petSlotResolved', { spinId: 'special', rewardType: 'specials', added: [{ id: 'new', x: 2, y: 3 }] }, 'special')]);
  assert.deepEqual(f.effects[1].added[0], { x: 20, y: 30, id: 'new' });
});
test('combo is a compact secondary HUD, slot activity alone suppresses external notices', () => {
  const calls = []; const f = new PetSlotFeedback({ audio: { playCue: (n) => calls.push(n) } });
  f.restore(snapshot()); f.consume([event('comboChanged', { shotId: 'a', streak: 4, tier: 3, previousTier: 2 })]);
  assert.equal(f.active, false); assert.equal(calls[0], 'target_3');
  f.consume([start]); assert.equal(f.active, true);
  const pose = f.petPose({ head: 0, right: 0 }); assert.equal(pose.right, 0.7);
  f.dispose(); assert.equal(f.active, false); f.consume([resolved]); assert.equal(f.active, false);
});
test('all rewards and reduced variants draw without relying on audio or canvas assets', () => {
  const gradient = { addColorStop() {} }, texts = [];
  const c = new Proxy({ createLinearGradient: () => gradient, createRadialGradient: () => gradient,
    measureText: (text) => ({ width: text.length * 24 }),
    fillText: (text) => texts.push(text) }, { get(target, key) { return key in target ? target[key] : () => {}; }, set(target, key, value) { target[key] = value; return true; } });
  for (const rewardType of ['tickets', 'lightning', 'specials', 'ammo', 'dual', 'fullClear']) {
    const f = new PetSlotFeedback(); f.restore(snapshot());
    f.consume([event('petSlotResolved', { ...resolved.payload, rewardType, spinId: rewardType })]);
    f.update(0.05, snapshot(), { reduced: true }); f.draw(c, snapshot());
  }
  assert.ok(texts.includes('赠送 +4球'));
  assert.ok(texts.includes('下一发获得双彩助攻'));
});
