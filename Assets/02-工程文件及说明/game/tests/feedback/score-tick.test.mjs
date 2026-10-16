import test from 'node:test';
import assert from 'node:assert/strict';
import { ArcadeAudio } from '../../src/feedback/audio/audio.mjs';
import { createScoreTick } from '../../src/feedback/audio/score-tick.mjs';

test('score ping has finite bounded PCM with silent edges and short duration', () => {
  for (const sampleRate of [22050, 48000]) {
    const buffer = createScoreTick({
      sampleRate,
      createBuffer: (_, n) => {
        const pcm = new Float32Array(n);
        return { getChannelData: () => pcm };
      },
    });
    const pcm = buffer.getChannelData(0);
    assert.ok(pcm.length / sampleRate < 0.09);
    assert.ok(pcm.every((n) => Number.isFinite(n) && Math.abs(n) <= 1));
    assert.equal(pcm[0], 0);
    assert.ok(Math.abs(pcm.at(-1)) < 0.001);
    assert.ok(pcm.some((n) => Math.abs(n) > 0.3));
  }
});
test('score channel survives six high-priority effects, stays bounded and obeys lifecycle', () => {
  const audio = new ArcadeAudio({ bindLifecycle: false });
  let started = 0;
  audio.context = {
    currentTime: 1,
    state: 'running',
    createBufferSource: () => ({
      playbackRate: {},
      connect() {},
      disconnect() {},
      start() {
        started++;
      },
      stop() {},
    }),
    createGain: () => ({ gain: {}, connect() {}, disconnect() {} }),
  };
  audio.sfx = {};
  audio.buffers.set('score_tick', {});
  for (let i = 0; i < 6; i++)
    audio.active.add({ name: 'stage_complete', priority: 9, at: 0, source: { stop() {} } });
  for (let i = 0; i < 20; i++) {
    audio.context.currentTime += 0.075;
    assert.equal(audio.scoreTick(), true);
    assert.ok(audio.active.size <= 8);
  }
  assert.equal(started, 20);
  for (const field of ['enabled', 'focused']) {
    audio[field] = false;
    assert.equal(audio.scoreTick(), false);
    audio[field] = true;
  }
  audio.paused = true;
  assert.equal(audio.scoreTick(), false);
  assert.equal(started, 20);
});
