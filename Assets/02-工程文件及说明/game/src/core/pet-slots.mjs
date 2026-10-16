// Stable public entry point: state orchestration only. Reward planning, live targeting,
// settlement and validation have separate owners; callers keep the same API.
import { SLOT_DURATION } from './pet-slots/rewards.mjs';
import { startPetSlot } from './pet-slots/plan.mjs';
import { liveReward } from './pet-slots/live-targets.mjs';
import { settleSlotReward } from './pet-slots/settlement.mjs';
import { initializePetChain, renewPetChain, endPetChain } from './pet-chain.mjs';
export { SLOT_DURATION, SLOT_REWARDS } from './pet-slots/rewards.mjs';
export { startPetSlot } from './pet-slots/plan.mjs';
export { validatePetSlots } from './pet-slots/validation.mjs';
const copy = (v) => structuredClone(v);
export function initializePetSlots(g, s) {
  if (s.petSlots) {
    s.petSlots.queuedCharge ??= 0;
    if (!s.petSlots.concurrentVersion) {
      if (s.petSlots.state === 'spinning') s.cooldown = Math.min(s.cooldown, g.config.cooldown);
      s.petSlots.concurrentVersion = 1;
    }
    initializePetChain(s);
    return;
  }
  const charge =
    s.assist.state === 'charging' && g.petSlotsEnabled ? Math.min(2, s.assist.charge) : 0;
  s.petSlots = {
    queuedCharge: 0,
    concurrentVersion: 1,
    mode: g.petSlotsEnabled ? 'slots' : 'legacy',
    charge,
    threshold: 3,
    state: 'charging',
    sequence: 0,
    spinId: null,
    remaining: 0,
    pending: null,
    lastResult: null,
    lastChargedShotId: null,
    rng: (s.rng ^ 0x8bc4a617) >>> 0,
  };
  if (g.petSlotsEnabled && s.assist.state === 'charging') s.assist.charge = 0;
  initializePetChain(s);
}
export function petSlotsView(s) {
  return copy(s.petSlots);
}
export function chargePet(g, s, p, attached, direct, emit) {
  const a = s.petSlots;
  if (
    a.mode !== 'slots' ||
    p.mode !== 'paid' ||
    !g.config.assistEnabled ||
    !attached ||
    a.lastChargedShotId === p.shotId
  )
    return;
  if (!direct.length) {
    endPetChain(s, emit, 'miss', p.shotId);
    a.lastChargedShotId = p.shotId;
    return;
  }
  renewPetChain(s);
  if (a.state === 'spinning') {
    a.queuedCharge++;
    a.lastChargedShotId = p.shotId;
    emit('petChargeQueued', { shotId: p.shotId, queued: a.queuedCharge, threshold: 3 }, p.shotId);
    return;
  }
  const before = a.charge;
  a.charge++;
  a.lastChargedShotId = p.shotId;
  emit(
    'petChargeChanged',
    {
      shotId: p.shotId,
      before,
      after: a.charge,
      threshold: 3,
      sourcePoints: direct.map((b) => ({ id: b.id, x: b.x, y: b.y })),
    },
    p.shotId,
  );
  if (a.charge === 3) startPetSlot(g, s, emit, p.shotId);
}
export function tickPetSlot(g, s, dt, emit) {
  const a = s.petSlots;
  if (a.state !== 'spinning') return false;
  a.remaining = Math.max(0, a.remaining - dt);
  if (a.remaining > 1e-9 || s.projectile) return true;
  const p = liveReward(g, s, a.pending),
    beforeTickets = s.ledger.earned,
    beforeAmmo = s.paidAmmo;
  const { removed, dropped, added } = settleSlotReward(g, s, p, emit);
  const result = {
    ...copy(p),
    actualTicketDelta: s.ledger.earned - beforeTickets,
    actualAmmoDelta: s.paidAmmo - beforeAmmo,
    removed: copy([...removed, ...dropped]),
    direct: copy(removed),
    dropped: copy(dropped),
    added,
    electricPaths: copy(p.electricPaths ?? []),
  };
  const carry = a.queuedCharge;
  Object.assign(a, {
    state: 'charging',
    charge: Math.min(2, carry),
    queuedCharge: Math.max(0, carry - 2),
    remaining: 0,
    pending: null,
    lastResult: result,
  });
  emit('petSlotResolved', result, p.spinId);
  emit(
    'petChargeChanged',
    {
      shotId: p.spinId,
      before: 3,
      after: a.charge,
      threshold: 3,
      sourcePoints: [],
      reason: 'resolved',
    },
    p.spinId,
  );
  if (carry >= 3) {
    a.queuedCharge = carry - 3;
    startPetSlot(g, s, emit, p.spinId);
  }
  s.cooldown = Math.max(g.config.cooldown, s.content.flow?.pending?.delay ?? 0);
  return true;
}
