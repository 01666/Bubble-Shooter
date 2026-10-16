import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newLedger,
  validateLedger,
  earn,
  prepare,
  sent,
  confirm,
  pendingTickets,
  uncertain,
} from '../../src/core/ledger.mjs';
test('reward and confirmation IDs are idempotent and totals reconcile', () => {
  const l = newLedger();
  earn(l, 'reward', 3);
  assert.equal(earn(l, 'reward', 3), false);
  assert.throws(() => earn(l, 'reward', 4), /Conflicting/);
  const b = prepare(l);
  assert.equal(pendingTickets(l), 3);
  assert.equal(prepare(l), null);
  assert.throws(
    () => confirm(l, { batchId: b.id, evidenceId: 'early', observedTotal: 1 }),
    /Unsent/,
  );
  sent(l, b.id);
  assert.equal(pendingTickets(l), 3);
  assert.equal(confirm(l, { batchId: b.id, evidenceId: 'ok', observedTotal: 1 }), 1);
  assert.equal(confirm(l, { batchId: b.id, evidenceId: 'ok', observedTotal: 1 }), 0);
  assert.equal(confirm(l, { batchId: b.id, evidenceId: 'late-old', observedTotal: 0 }), 0);
  assert.equal(pendingTickets(l), 2);
  validateLedger(l);
});
test('uncertainty retains obligations and does not prepare a second command', () => {
  const l = newLedger();
  earn(l, 'r', 5);
  const b = prepare(l);
  sent(l, b.id);
  uncertain(l, b.id);
  assert.equal(pendingTickets(l), 5);
  assert.equal(prepare(l), null);
  assert.throws(
    () => confirm(l, { batchId: b.id, evidenceId: 'too-many', observedTotal: 2 }),
    /Invalid/,
  );
  assert.equal(pendingTickets(l), 5);
  validateLedger(l);
});
test('malformed accounting and unsafe ticket counts are rejected', () => {
  const l = newLedger();
  assert.throws(() => earn(l, 'r', Number.MAX_SAFE_INTEGER + 1), /Invalid/);
  earn(l, 'r', 1);
  l.confirmed = 2;
  assert.throws(() => validateLedger(l), /invariant/);
});
