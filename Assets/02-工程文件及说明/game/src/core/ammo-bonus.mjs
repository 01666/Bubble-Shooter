export function initializeAmmoBonus(s) {
  s.ammoBonus ??= { total: 0, rewards: {} };
}
export function clearAmmoBonus(count) {
  return count >= 7 ? Math.min(5, count - 5) : 0;
}
export function grantAmmoBonus(s, shotId, direct, dropped, emit) {
  const count = new Set([...direct, ...dropped].map((b) => b.id)).size;
  const amount = clearAmmoBonus(count);
  if (!amount) return 0;
  const rewardId = shotId + ':ammo';
  if (Object.hasOwn(s.ammoBonus.rewards, rewardId)) return 0;
  if (
    !Number.isSafeInteger(s.paidAmmo + amount) ||
    !Number.isSafeInteger(s.ammoBonus.total + amount)
  )
    throw Error('Ammo bonus overflow');
  Object.defineProperty(s.ammoBonus.rewards, rewardId, {
    value: { count: amount, cleared: count },
    enumerable: true,
  });
  s.ammoBonus.total += amount;
  s.paidAmmo += amount;
  emit(
    'ammoBonusEarned',
    { shotId, rewardId, count: amount, clearedCount: count, ammoAfter: s.paidAmmo },
    shotId,
  );
  return amount;
}
export function grantSlotAmmo(s, spinId, amount) {
  const rewardId = spinId + ':ammo';
  if (Object.hasOwn(s.ammoBonus.rewards, rewardId)) return 0;
  if (
    !Number.isSafeInteger(amount) ||
    amount < 3 ||
    amount > 5 ||
    !Number.isSafeInteger(s.paidAmmo + amount) ||
    !Number.isSafeInteger(s.ammoBonus.total + amount)
  )
    throw Error('Slot ammo overflow');
  s.ammoBonus.rewards[rewardId] = { count: amount, source: 'petSlots' };
  s.ammoBonus.total += amount;
  s.paidAmmo += amount;
  return amount;
}
export function validateAmmoBonus(s) {
  const b = s.ammoBonus;
  if (
    !b ||
    !Number.isSafeInteger(b.total) ||
    b.total < 0 ||
    !b.rewards ||
    typeof b.rewards !== 'object' ||
    Array.isArray(b.rewards)
  )
    throw Error('Invalid ammo bonus ledger');
  let sum = 0;
  for (const r of Object.values(b.rewards)) {
    if (
      !Number.isSafeInteger(r.count) ||
      r.count < 2 ||
      r.count > 5 ||
      (r.source === 'petSlots'
        ? r.count < 3
        : !Number.isSafeInteger(r.cleared) ||
          r.cleared < 7 ||
          clearAmmoBonus(r.cleared) !== r.count)
    )
      throw Error('Invalid ammo bonus reward');
    sum += r.count;
  }
  if (!Number.isSafeInteger(sum) || sum !== b.total) throw Error('Ammo bonus conservation failed');
}
