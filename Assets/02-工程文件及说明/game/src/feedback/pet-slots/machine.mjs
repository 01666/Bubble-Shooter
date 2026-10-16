import { drawPrizeBurst } from '../arcade/prize-burst.mjs';
import { PET_SLOT_LAYOUT, petLeverPoint } from './layout.mjs';
import { REWARDS, CYAN, clamp, caption, panel, icon } from './art.mjs';

export function drawMachine(c) {
  const spin = this.spin,
    result = this.result;
  const elapsed = spin?.elapsed ?? 2.6,
    duration = spin?.duration ?? 2.6;
  const final =
    spin?.rewardType ??
    result?.rewardType ??
    this.snapshot.petSlots?.lastResult?.rewardType ??
    'tickets';
  const chain = this.snapshot.petSlots ?? {};
  const charge = spin ? (chain.queuedCharge ?? 0) % 3 : (chain.charge ?? 0);
  c.save();
  // Companion and machine share one grounded bronze platform.
  c.fillStyle = '#052039';
  c.strokeStyle = '#d7b66c';
  c.lineWidth = 3;
  c.beginPath();
  c.ellipse(178, 1515, 151, 12, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  const m = PET_SLOT_LAYOUT.machine;
  const remaining = chain.chainRemaining ?? 0;
  if (remaining > 0 || chain.deadlineShotId) {
    caption(
      c,
      `${spin ? '下一轮' : '连消'} ${charge}/3 · 再消${3 - charge}次`,
      245,
      1304,
      20,
      '#ffe6a4',
    );
    caption(
      c,
      chain.deadlineShotId ? '命中即可续连' : remaining.toFixed(1) + ' 秒',
      245,
      1330,
      27,
      remaining <= 2 ? '#ffbd6f' : '#acfbec',
    );
    c.fillStyle = '#153c55';
    c.fillRect(183, 1338, 124, 5);
    c.fillStyle = remaining <= 2 ? '#ffb153' : '#8dfff0';
    c.fillRect(183, 1338, 124 * Math.max(0, Math.min(1, remaining / (chain.chainWindow ?? 6))), 5);
  } else {
    caption(c, '6秒内连续消除', 245, 1314, 18, '#d3f4ff');
    caption(c, '满3连摇奖 · 必有奖', 245, 1337, 17, '#ffe6a4');
  }
  if (this.chainNotice) caption(c, this.chainNotice.text, 245, 1284, 18, '#ffcf91');
  panel(c, m.x, m.y, m.width, m.height, 18);
  caption(c, '幸运摇奖', 245, 1376, 22);
  for (let reel = 0; reel < 3; reel++) {
    const x = 182 + reel * 43,
      y = 1392,
      w = 38,
      h = 67;
    const stop = duration - 0.72 + reel * 0.24,
      stopped = !spin || elapsed >= stop;
    c.save();
    c.beginPath();
    c.roundRect(x, y, w, h, 10);
    c.clip();
    const bed = c.createLinearGradient(x, y, x, y + h);
    bed.addColorStop(0, '#020e1a');
    bed.addColorStop(0.5, '#286c7e');
    bed.addColorStop(1, '#030c16');
    c.fillStyle = bed;
    c.fillRect(x, y, w, h);
    if (stopped || this.reduced) icon(c, stopped ? final : REWARDS[reel], x + w / 2, y + h / 2, 16);
    else {
      const q = clamp(elapsed / stop),
        progress = (18 + reel * 6 + REWARDS.indexOf(final)) * q * q * (3 - 2 * q);
      for (let row = -1; row <= 1; row++)
        icon(
          c,
          REWARDS[(((Math.floor(progress) + row) % 6) + 6) % 6],
          x + w / 2,
          y + h / 2 + (row - (progress % 1)) * 53,
          16,
        );
    }
    c.restore();
    c.strokeStyle = spin && stopped ? '#fff5bf' : '#b2d0be';
    c.lineWidth = 2.5;
    c.beginPath();
    c.roundRect(x, y, w, h, 10);
    c.stroke();
  }
  for (let i = 0; i < 3; i++) {
    const lit = i < charge;
    c.fillStyle = lit ? '#a9ffff' : '#22445a';
    c.shadowColor = CYAN;
    c.shadowBlur = lit && !this.reduced ? 13 : 0;
    c.beginPath();
    c.arc(223 + i * 24, 1480, 6, 0, Math.PI * 2);
    c.fill();
  }
  c.shadowBlur = 0;
  caption(c, spin ? '摇奖中 · 可继续发射' : '连消 ' + charge + '/3', 245, 1501, 15, '#d4eafa');
  const handle = petLeverPoint(spin?.elapsed ?? 0, this.reduced),
    pivot = PET_SLOT_LAYOUT.leverPivot;
  c.strokeStyle = '#d2a15b';
  c.lineWidth = 7;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(pivot.x, pivot.y);
  c.lineTo(handle.x, handle.y);
  c.stroke();
  c.fillStyle = CYAN;
  c.shadowColor = CYAN;
  c.shadowBlur = this.reduced ? 0 : 8;
  c.beginPath();
  c.arc(handle.x, handle.y, 8, 0, Math.PI * 2);
  c.fill();
  c.shadowBlur = 0;
  c.restore();
  if (result && !this.priorityBusy) {
    const n = result.count ?? 0;
    const title =
      final === 'tickets'
        ? '彩票 +' + (result.actualTicketDelta ?? n) + '张'
        : final === 'ammo'
          ? '赠送 +' + (result.actualAmmoDelta ?? n) + '球'
          : final === 'specials'
            ? '炸弹 +' + (result.added?.length ?? n) + '颗'
            : final === 'lightning'
              ? '连锁闪电！'
              : final === 'fullClear'
                ? '全屏大消除！'
                : '双彩助攻！';
    const detail = result.fallbackReason?.startsWith('live')
      ? '盘面已变化 · 特别奖励兑换为彩票'
      : ['lightning', 'fullClear'].includes(final)
        ? '消除 ' +
          (result.removed?.length ?? n) +
          '颗 · 获得 ' +
          result.actualTicketDelta +
          '张彩票'
        : final === 'dual'
          ? '下一发获得双彩助攻'
          : '萌宠幸运机 · 每摇必有奖';
    drawPrizeBurst(c, {
      title,
      detail,
      age: result.age,
      life: result.life,
      reduced: this.reduced,
      y: 1000,
      size: 68,
      intensity: final === 'fullClear' ? 1.6 : 1.1,
    });
  }
}
