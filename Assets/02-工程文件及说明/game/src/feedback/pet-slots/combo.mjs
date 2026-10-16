import { drawPrizeBurst } from '../arcade/prize-burst.mjs';
import { CYAN, clamp, caption } from './art.mjs';

export function drawCombo(c, s) {
  const streak = s.combo?.streak ?? 0;
  if (streak < 2) return;
  const tier = Math.min(3, s.combo?.tier ?? Math.min(3, streak - 1));
  const names = ['', '连续消除', '强力连消', '狂热连消'];
  if (this.comboFlash > 0) {
    drawPrizeBurst(c, {
      title: ['', 'NICE!', 'WOW!', 'AWESOME!'][tier] || 'NICE!',
      detail: `${names[tier]} · ${streak}连`,
      age: 0.65 - this.comboFlash,
      life: 0.65,
      reduced: this.reduced,
      y: 1030,
      size: 70,
      intensity: 0.6 + tier * 0.3,
    });
    return;
  }
  const grow = this.reduced ? 1 : 1 + Math.sin(clamp(this.comboFlash / 0.65) * Math.PI) * 0.07;
  c.save();
  c.translate(450, 1110);
  c.scale(grow, grow);
  caption(c, `${names[tier] || names[1]} · ${streak}连`, 0, 0, 46, tier >= 3 ? '#ffe097' : CYAN);
  c.restore();
}
