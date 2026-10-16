import { drawPrizeBurst } from '../arcade/prize-burst.mjs';
export class RewardWords {
  constructor() {
    this.clock = 0;
    this.active = null;
  }
  show(cue) {
    this.active = { ...cue, at: this.clock };
  }
  update(dt, { paused = false, reduced = false } = {}) {
    this.reduced = reduced;
    if (!paused) this.clock += Math.min(0.1, Math.max(0, dt));
    if (this.active && this.clock - this.active.at > 2.3) this.active = null;
  }
  clear() {
    this.active = null;
  }
  draw(c) {
    if (!this.active) return;
    const cue = this.active,
      age = this.clock - cue.at;
    drawPrizeBurst(c, {
      title: cue.label,
      detail: cue.sub ?? '',
      age,
      life: 2.3,
      reduced: this.reduced,
      y: 1030,
      size: ['low', 'network'].includes(cue.kind) ? 36 : 60,
      intensity: ['low', 'network'].includes(cue.kind) ? 0.35 : 1.1,
    });
  }
}
