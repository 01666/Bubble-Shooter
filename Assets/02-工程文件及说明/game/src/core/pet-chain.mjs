export const PET_CHAIN_SECONDS = 6;

export function initializePetChain(s) {
  const a = s.petSlots;
  a.chainGrace ??= 0;
  if (a.chainVersion === 1) return;
  a.chainVersion = 1;
  a.chainWindow = PET_CHAIN_SECONDS;
  a.chainRemaining =
    (a.state === 'charging' ? a.charge : a.queuedCharge % 3) > 0 ? PET_CHAIN_SECONDS : 0;
  a.deadlineShotId = null;
}

export function endPetChain(s, emit, reason, causeId = null) {
  const a = s.petSlots;
  const before = a.state === 'spinning' ? a.queuedCharge % 3 : a.charge;
  if (a.state === 'spinning') a.queuedCharge -= before;
  else a.charge = 0;
  a.chainRemaining = 0;
  a.chainGrace = 0;
  a.deadlineShotId = null;
  const previousTier = s.combo.tier,
    streak = s.combo.streak;
  s.combo.streak = 0;
  s.combo.tier = 0;
  if (before || streak) {
    emit('petChainEnded', { reason, lostCharge: before, threshold: 3, remaining: 0 }, causeId);
  }
  if (streak) {
    emit(
      'comboChanged',
      { shotId: causeId, streak: 0, tier: 0, previousTier, ended: true, reason },
      causeId,
    );
  }
}

export function tickPetChain(s, dt, emit) {
  const a = s.petSlots;
  if (a.mode !== 'slots') return;
  // A ceiling transition is imposed by the machine, so it cannot consume the player's window.
  if (s.content.flow?.pending) return;
  if (a.chainGrace > 0) {
    a.chainGrace = Math.max(0, a.chainGrace - dt);
    return;
  }
  if (a.deadlineShotId) {
    if (!s.projectile) endPetChain(s, emit, 'timeout');
    return;
  }
  if (a.chainRemaining <= 0) return;
  a.chainRemaining = Math.max(0, a.chainRemaining - dt);
  if (a.chainRemaining > 0) return;
  // A shot already launched in time gets to land before its chain eligibility is decided.
  if (s.projectile?.mode === 'paid') a.deadlineShotId = s.projectile.shotId;
  else endPetChain(s, emit, 'timeout');
}

export function renewPetChain(s) {
  s.petSlots.chainRemaining = PET_CHAIN_SECONDS;
  s.petSlots.deadlineShotId = null;
}

export function validatePetChain(s) {
  const a = s.petSlots;
  if (
    a.chainVersion !== 1 ||
    a.chainWindow !== PET_CHAIN_SECONDS ||
    !Number.isFinite(a.chainRemaining) ||
    a.chainRemaining < 0 ||
    a.chainRemaining > PET_CHAIN_SECONDS ||
    !Number.isFinite(a.chainGrace) ||
    a.chainGrace < 0 ||
    a.chainGrace > 0.55 ||
    (a.deadlineShotId !== null && typeof a.deadlineShotId !== 'string')
  )
    throw Error('Invalid pet chain timer');
}
