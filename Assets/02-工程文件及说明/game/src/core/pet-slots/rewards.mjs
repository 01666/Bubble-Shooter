export const SLOT_DURATION = 2.6;
export const SLOT_REWARDS = [
  { type: 'tickets', weight: 30, label: '彩票奖励' },
  { type: 'lightning', weight: 20, label: '连锁闪电' },
  { type: 'specials', weight: 20, label: '特殊泡泡' },
  { type: 'ammo', weight: 20, label: '赠送泡泡' },
  { type: 'dual', weight: 8, label: '双彩助攻' },
  { type: 'fullClear', weight: 2, label: '全屏消除' },
];
export function random(s) {
  s.petSlots.rng = (Math.imul(s.petSlots.rng, 1664525) + 1013904223) >>> 0;
  return s.petSlots.rng / 4294967296;
}

export function fallback(p, reason) {
  return {
    spinId: p.spinId,
    rewardType: 'tickets',
    label: '彩票奖励',
    count: 12,
    duration: SLOT_DURATION,
    fallbackFrom: p.rewardType,
    fallbackReason: reason,
  };
}
