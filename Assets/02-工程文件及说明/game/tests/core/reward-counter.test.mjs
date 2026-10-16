import test from 'node:test';
import assert from 'node:assert/strict';
import { RewardCounter } from '../../src/feedback/effects-ui/reward-counter.mjs';

test('counter waits for each landing even when the dispenser has already confirmed tickets', () => {
  const c = new RewardCounter();
  c.observe({ earned: 10, confirmed: 10, pending: 0 }, 0);
  c.observe({ earned: 13, confirmed: 12, pending: 1 }, 0.8);
  assert.equal(c.value, 0);
  c.arrive(1.2);
  assert.equal(c.value, 1);
  c.observe({ earned: 13, confirmed: 13, pending: 0 }, 1.3);
  assert.equal(c.value, 1);
  c.arrive(1.4);
  c.arrive(1.5);
  assert.equal(c.value, 3);
  c.observe({ earned: 13, confirmed: 13, pending: 0 }, 1.7);
  assert.equal(c.value, 3);
  for (const t of [1.81, 1.9, 2]) c.observe({ earned: 13, confirmed: 13, pending: 0 }, t);
  assert.equal(c.value, 0);
  c.arrive(3);
  assert.equal(c.value, 0);
});

test('restore shows existing pending balance without replaying awards; jammed tickets remain', () => {
  const c = new RewardCounter();
  c.observe({ earned: 30, confirmed: 22, pending: 8 }, 0);
  assert.equal(c.value, 8);
  c.observe({ earned: 32, confirmed: 22, pending: 10 }, 1);
  c.arrive(2);
  c.arrive(2.1);
  c.observe({ earned: 32, confirmed: 22, pending: 10 }, 20);
  assert.equal(c.value, 10);
});
