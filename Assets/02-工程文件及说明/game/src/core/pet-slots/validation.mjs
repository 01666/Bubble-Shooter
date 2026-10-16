import { validatePetChain } from '../pet-chain.mjs';
import { SLOT_DURATION, SLOT_REWARDS } from './rewards.mjs';
export function validatePetSlots(s) {
  validatePetChain(s);
  const a = s.petSlots;
  if (
    !a ||
    !['slots', 'legacy'].includes(a.mode) ||
    !['charging', 'spinning'].includes(a.state) ||
    !Number.isSafeInteger(a.sequence) ||
    a.sequence < 0 ||
    !Number.isSafeInteger(a.rng) ||
    a.rng < 0 ||
    a.rng > 0xffffffff ||
    a.threshold !== 3 ||
    !Number.isSafeInteger(a.charge) ||
    a.charge < 0 ||
    a.charge > 3 ||
    !Number.isFinite(a.remaining) ||
    a.remaining < 0 ||
    a.remaining > SLOT_DURATION
  )
    throw Error('Invalid pet slots');
  if (!Number.isSafeInteger(a.queuedCharge) || a.queuedCharge < 0)
    throw Error('Invalid queued pet charge');
  if (a.state === 'spinning') {
    const p = a.pending;
    if (
      a.charge !== 3 ||
      !p ||
      p.spinId !== a.spinId ||
      a.spinId !== 'pet-spin-' + a.sequence ||
      !SLOT_REWARDS.some((r) => r.type === p.rewardType) ||
      !Number.isSafeInteger(p.count) ||
      p.count < 1
    )
      throw Error('Invalid pending pet spin');
    if (p.rewardType === 'tickets' && (p.count < 8 || p.count > 16))
      throw Error('Invalid slot ticket count');
    if (p.rewardType === 'ammo' && (p.count < 3 || p.count > 5))
      throw Error('Invalid slot ammo count');
    if (
      p.rewardType === 'specials' &&
      (p.count < 2 || p.count > 5 || !p.targetIds || p.targetIds.length !== p.count)
    )
      throw Error('Invalid slot special count');
    if (
      ['lightning', 'fullClear'].includes(p.rewardType) &&
      (!p.targetIds || p.targetIds.length !== p.count)
    )
      throw Error('Invalid slot removal count');
    if (
      p.rewardType === 'lightning' &&
      (p.count < 2 || p.count > 7 || !p.electricPaths || p.electricPaths.length !== p.count - 1)
    )
      throw Error('Invalid slot lightning path');
    if (p.rewardType === 'dual' && (p.count !== 1 || !s.config.colors.includes(p.secondaryColor)))
      throw Error('Invalid slot dual award');
    if (
      p.effectSeed !== undefined &&
      (!Number.isSafeInteger(p.effectSeed) || p.effectSeed < 0 || p.effectSeed > 0xffffffff)
    )
      throw Error('Invalid effect seed');
    if (
      p.targetIds &&
      (new Set(p.targetIds).size !== p.targetIds.length ||
        p.targetIds.some((id) => typeof id !== 'string' || !id))
    )
      throw Error('Invalid persisted pet targets');
  } else if (a.pending !== null || a.remaining !== 0 || a.charge >= 3)
    throw Error('Invalid charging pet');
}
