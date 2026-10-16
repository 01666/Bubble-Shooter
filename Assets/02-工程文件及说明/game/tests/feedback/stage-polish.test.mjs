import test from 'node:test';
import assert from 'node:assert/strict';
import { LivingRoom } from '../../src/feedback/environment/background.mjs';
import { RewardVoice } from '../../src/feedback/rewards/reward-voice.mjs';
import { ProgressBridge } from '../../src/feedback/rewards/progress-bridge.mjs';
import { stablePhase } from '../../src/feedback/orbs/orb-material.mjs';
function audioFixture() {
  const sources = [],
    context = {
      state: 'running',
      currentTime: 0,
      output: 0,
      getOutputTimestamp() {
        return { contextTime: this.output };
      },
      createBufferSource() {
        const s = {
          connect() {},
          disconnect() {},
          start(t) {
            this.startAt = t;
          },
          stop() {
            this.onended?.();
          },
        };
        sources.push(s);
        return s;
      },
    };
  return { context, voice: {}, enabled: true, duck() {}, sources };
}
test('caption waits for actual output clock, not business receipt or scheduled audio creation', () => {
  const audio = audioFixture(),
    shown = [],
    v = new RewardVoice(audio, { onText: (c) => shown.push(c) });
  v.buffers.set('chest', { duration: 1 });
  v.offer({ id: 'event-1', kind: 'chest', label: '宝箱加奖 +8张彩票' });
  v.update(0.01);
  assert.equal(shown.length, 0);
  audio.context.currentTime = 0.1;
  audio.context.output = 0.02;
  v.update(0.01);
  assert.equal(shown.length, 0);
  audio.context.output = 0.05;
  v.update(0.01);
  assert.equal(shown.length, 1);
  assert.equal(shown[0].audioStart, 0.04);
  assert.equal(shown[0].mode, 'audio');
  v.dispose();
  assert.equal(audio.voiceSource, null);
});
test('muting/failure retain exact captions; paused scheduled clips never replay', async () => {
  const audio = audioFixture(),
    shown = [],
    v = new RewardVoice(audio, { onText: (c) => shown.push(c) });
  v.muted = true;
  v.offer({ id: 'event-1', kind: 'success', label: '获得 3张彩票' });
  v.update(0.1);
  assert.equal(shown[0].label, '获得 3张彩票');
  v.muted = false;
  await v.load({
    legacy: true,
    fetcher: async () => {
      throw Error('missing file');
    },
  });
  assert.ok(v.errors.length > 0);
  v.offer({ id: 'event-2', kind: 'low', label: '最后两球 · 特殊泡泡登场' });
  v.update(0.1);
  assert.equal(shown.at(-1).mode, 'text-only');
  v.buffers.set('chest', { duration: 1 });
  v.offer({ id: 'event-3', kind: 'chest', label: '宝箱加奖 +8张彩票' });
  v.update(0.1);
  v.setTransport({ paused: true });
  v.setTransport({ paused: false });
  audio.context.output = 1;
  v.update(0.1);
  assert.equal(shown.length, 2);
});
test('one shot merges to chest, real appeared is required, reward units are not counted twice', () => {
  const audio = audioFixture(),
    shown = [],
    v = new RewardVoice(audio, { onText: (c) => shown.push(c) }),
    room = new LivingRoom(),
    bridge = new ProgressBridge({ room, voice: v });
  const events = [
    {
      eventId: 'event-1',
      type: 'paidShotResolved',
      payload: { shotId: 's1', gain: 5, bonus: 8, dropped: [] },
    },
    { eventId: 'event-2', type: 'stageBonusEarned', payload: { shotId: 's1', count: 8 } },
    { eventId: 'event-3', type: 'ticketsEarned', payload: { shotId: 's1', count: 13 } },
    { eventId: 'event-4', type: 'dispenseConfirmed', payload: { delta: 1 } },
  ];
  bridge.consume(events, {});
  bridge.consume(events, {});
  v.update(0.1);
  assert.equal(shown.length, 1);
  assert.equal(shown[0].label, '宝箱加奖 +8张彩票');
  assert.equal(shown[0].sub, '本发获得 13张彩票');
  bridge.consume(
    [{ eventId: 'event-5', type: 'lowOpportunityQualified', payload: { remainingAmmo: 2 } }],
    {},
  );
  v.update(0.1);
  assert.equal(shown.length, 1);
  bridge.consume(
    [
      {
        eventId: 'event-6',
        type: 'lowOpportunityAppeared',
        payload: {
          interfaceVersion: 2,
          opportunityId: 'low-1',
          shotId: 's2',
          remainingAmmo: 2,
          ball: { id: 'b', x: 1, y: 1 },
        },
      },
    ],
    {},
  );
  v.update(0.1);
  assert.equal(
    shown.at(-1).kind,
    'chest',
    'appearance itself must not advertise a last-ball reward',
  );
  assert.equal(bridge.targets.length, 1);
  bridge.consume(
    [
      {
        eventId: 'event-7',
        type: 'paidShotResolved',
        payload: { shotId: 's3', remainingAmmo: 2, gain: 0, dropped: [] },
      },
    ],
    {},
  );
  v.update(0.1);
  assert.equal(shown.at(-1).kind, 'low');
  assert.equal(shown.at(-1).label, '还剩两球了');
});
test('bounded environment pulses freeze, clear on restore and stable phases differ by ID', () => {
  const room = new LivingRoom();
  for (let i = 0; i < 3000; i++) room.consume([{ eventId: 'e' + i, type: 'networkActivated' }], {});
  assert.ok(room.pulses.length <= 8);
  assert.ok(room.seen.size <= 2048);
  room.update(0.1, { paused: true });
  assert.equal(room.time, 0);
  for (let i = 0; i < 30; i++) room.update(0.1);
  assert.equal(room.pulses.length, 0);
  room.restore({ assist: { charge: 3 } });
  assert.equal(room.charge, 3);
  assert.equal(stablePhase('a'), stablePhase('a'));
  assert.notEqual(stablePhase('a'), stablePhase('b'));
});
