export function initializeCombo(s) {
  s.combo ??= { streak: 0, tier: 0, lastShotId: null };
}
export function recordCombo(s, shotId, attached, direct, emit) {
  if (!attached || s.combo.lastShotId === shotId) return;
  const before = s.combo.tier,
    prior = s.combo.streak;
  s.combo.streak = direct.length ? prior + 1 : 0;
  s.combo.tier = Math.min(3, Math.max(0, s.combo.streak - 1));
  s.combo.lastShotId = shotId;
  emit(
    'comboChanged',
    {
      shotId,
      streak: s.combo.streak,
      tier: s.combo.tier,
      previousTier: before,
      ended: !direct.length && prior > 0,
    },
    shotId,
  );
}
export function validateCombo(s) {
  const c = s.combo;
  if (
    !c ||
    !Number.isSafeInteger(c.streak) ||
    c.streak < 0 ||
    c.tier !== Math.min(3, Math.max(0, c.streak - 1)) ||
    (c.lastShotId !== null && typeof c.lastShotId !== 'string')
  )
    throw Error('Invalid combo');
}
