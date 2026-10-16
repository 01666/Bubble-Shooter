// All durations/cooldowns are seconds. No reward calculation lives here.
export const MIX = {
  bpm: 136,
  bars: 16,
  master: 0.72,
  bgm: 0.52,
  sfx: 0.72,
  voice: 0.7,
  maxSfx: 6,
  voiceGap: 6,
  duckImpact: 0.46,
  duckVoice: 0.28,
};
export const VOICE_LINES = {
  target_received: '目标收到啦',
  nice_clear: '消得漂亮',
  dispenser_fault: '出票待检查，彩票保留',
  free_swap: '免费换球，投币赢票',
  explosion: '引爆啦！',
  big_drop: '哇！掉下来一大片！',
  one_target_left: '还差一个目标！',
  new_bubbles: '新泡泡来啦！',
  stage_bonus: '阶段完成！奖励到啦！',
  maintenance: '整理一下，马上继续！',
};
export const CUES = {
  ammo_bonus: { priority: 9, cooldown: 0, gain: 0.8, duck: 0.35 },
  score_tick: { priority: 6, cooldown: 0, gain: 0.48 },
  fire: { priority: 3, cooldown: 0.065, gain: 0.62 },
  bounce: { priority: 1, cooldown: 0.08, gain: 0.38 },
  attach: { priority: 2, cooldown: 0.1, gain: 0.52 },
  clear: { priority: 4, cooldown: 0.18, gain: 0.65 },
  explosion: { priority: 8, cooldown: 0.35, gain: 0.86, duck: 0.85 },
  chain: { priority: 7, cooldown: 0.14, gain: 0.58, duck: 0.55 },
  drop: { priority: 6, cooldown: 0.5, gain: 0.68, duck: 0.7 },
  target_1: { priority: 5, cooldown: 0.25, gain: 0.58 },
  target_2: { priority: 5, cooldown: 0.25, gain: 0.63 },
  target_3: { priority: 6, cooldown: 0.25, gain: 0.68 },
  stage_complete: { priority: 9, cooldown: 2.5, gain: 0.72, duck: 1.3 },
  stage_reward: { priority: 8, cooldown: 2.5, gain: 0.66, duck: 0.9 },
  earned: { priority: 2, cooldown: 1, gain: 0.25 },
  refill: { priority: 3, cooldown: 2, gain: 0.48 },
  reposition: { priority: 2, cooldown: 1, gain: 0.38 },
  coin: { priority: 5, cooldown: 0.25, gain: 0.62 },
  confirmed: { priority: 0, cooldown: 1.5, gain: 0.16 },
  maintenance: { priority: 3, cooldown: 4, gain: 0.45 },
  free_swap: { priority: 1, cooldown: 0.25, gain: 0.36 },
};
// Dispatch at committed-event receipt. Offsets describe audio staging only.
export function mapEvent(e) {
  const p = e.payload || {},
    out = [],
    cue = (name, delay = 0, extra = {}) => out.push({ name, delay, ...extra });
  switch (e.type) {
    case 'ammoBonusEarned':
      cue('ammo_bonus');
      break;
    case 'coinCredited':
      cue('coin');
      break;
    case 'shotAccepted':
      cue('fire', 0, { gain: p.mode === 'free' ? 0.55 : 1 });
      if (p.mode === 'free') cue('free_swap', 0.1);
      break;
    case 'bounce':
    case 'freeShotDeflected':
      cue('bounce');
      break;
    case 'explosionResolved':
      cue('explosion');
      for (let i = 1; i < Math.min(4, p.triggers?.length || 0); i++)
        cue('chain', 0.18 + i * 0.16, { rate: 1 + i * 0.085 });
      break;
    case 'paidShotResolved':
      if (p.attached) cue('attach');
      if (p.direct?.length) cue('clear', 0.07);
      if (p.dropped?.length) cue('drop', 0.16, { gain: p.dropped.length >= 6 ? 1 : 0.6 });
      break;
    case 'targetsCollected':
      cue('target_' + Math.min(3, Math.max(1, p.progress || 1)), 0.12);
      break;
    case 'stageBonusEarned':
      cue('stage_complete', 0.36);
      cue('stage_reward', 1.08);
      break;
    case 'ticketsEarned':
      if (!String(p.rewardId || '').startsWith('stage-')) cue('earned', 0.24);
      break;
    case 'boardRefilled':
      cue('refill', 0.2);
      break;
    case 'boardRepositioned':
      cue('reposition', 0.2);
      break;
    case 'boardMaintained':
      cue('maintenance');
      break;
    case 'dispenseConfirmed':
      if (p.delta > 0) cue('confirmed');
      break;
  }
  return out;
}
