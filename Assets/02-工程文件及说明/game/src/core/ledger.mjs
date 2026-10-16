export function newLedger() {
  return { earned: 0, confirmed: 0, rewards: {}, batches: [], evidence: {}, sequence: 0 };
}
export const pendingTickets = (l) => l.earned - l.confirmed;
export function validateLedger(l) {
  for (const n of [l.earned, l.confirmed, l.sequence])
    if (!Number.isSafeInteger(n) || n < 0) throw new Error('Invalid ledger totals');
  const earned = Object.values(l.rewards).reduce((sum, r) => sum + r.count, 0);
  const confirmed = l.batches.reduce((sum, b) => sum + b.confirmed, 0);
  if (earned !== l.earned || confirmed !== l.confirmed || pendingTickets(l) < 0)
    throw new Error('Ledger invariant failed');
  const ids = new Set();
  for (const b of l.batches) {
    if (
      ids.has(b.id) ||
      !Number.isSafeInteger(b.requested) ||
      b.requested <= 0 ||
      !Number.isSafeInteger(b.confirmed) ||
      b.confirmed < 0 ||
      b.confirmed > b.requested ||
      !['prepared', 'inFlight', 'uncertain', 'confirmed'].includes(b.status)
    )
      throw new Error('Invalid batch');
    if (
      (b.status === 'confirmed') !== (b.confirmed === b.requested) ||
      (b.status === 'prepared' && b.confirmed !== 0)
    )
      throw new Error('Invalid batch status');
    ids.add(b.id);
  }
  const reserved = l.batches.reduce((n, b) => n + b.requested - b.confirmed, 0);
  if (reserved > pendingTickets(l) || l.batches.filter((b) => b.status !== 'confirmed').length > 1)
    throw new Error('Invalid reservation');
  for (const r of Object.values(l.rewards))
    if (!Number.isSafeInteger(r.count) || r.count <= 0) throw new Error('Invalid reward');
}
export function earn(l, rewardId, count) {
  if (!rewardId || !Number.isSafeInteger(count) || count < 0) throw new Error('Invalid reward');
  const old = Object.hasOwn(l.rewards, rewardId) ? l.rewards[rewardId] : null;
  if (old) {
    if (old.count !== count) throw new Error('Conflicting reward');
    return false;
  }
  if (!count) return false;
  if (!Number.isSafeInteger(l.earned + count)) throw new Error('Ticket overflow');
  Object.defineProperty(l.rewards, rewardId, {
    value: { count },
    enumerable: true,
    writable: true,
    configurable: true,
  });
  l.earned += count;
  return true;
}
export function prepare(l) {
  if (l.batches.some((b) => b.status !== 'confirmed') || !pendingTickets(l)) return null;
  const b = { id: `batch-${++l.sequence}`, requested: 1, confirmed: 0, status: 'prepared' };
  l.batches.push(b);
  return structuredClone(b);
}
function batch(l, id) {
  const b = l.batches.find((b) => b.id === id);
  if (!b) throw new Error('Unknown batch');
  return b;
}
export function sent(l, id) {
  const b = batch(l, id);
  if (b.status !== 'prepared') throw new Error('Batch is not prepared');
  b.status = 'inFlight';
}
export function uncertain(l, id) {
  const b = batch(l, id);
  if (b.status === 'confirmed') return false;
  b.status = 'uncertain';
  return true;
}
export function confirm(l, { batchId, evidenceId, observedTotal }) {
  if (typeof evidenceId !== 'string' || !evidenceId) throw new Error('Missing evidence ID');
  const b = batch(l, batchId);
  if (!Number.isSafeInteger(observedTotal) || observedTotal < 0 || observedTotal > b.requested)
    throw new Error('Invalid physical total');
  const old = Object.hasOwn(l.evidence, evidenceId) ? l.evidence[evidenceId] : null;
  if (old) {
    if (old.batchId !== batchId || old.observedTotal !== observedTotal)
      throw new Error('Conflicting evidence');
    return 0;
  }
  if (b.status === 'prepared') throw new Error('Unsent batch cannot confirm');
  Object.defineProperty(l.evidence, evidenceId, {
    value: { batchId, observedTotal },
    enumerable: true,
    writable: true,
    configurable: true,
  });
  const delta = Math.max(0, observedTotal - b.confirmed);
  b.confirmed += delta;
  l.confirmed += delta;
  if (b.confirmed === b.requested) b.status = 'confirmed';
  return delta;
}
