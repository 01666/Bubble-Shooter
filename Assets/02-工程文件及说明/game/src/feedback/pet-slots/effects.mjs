import { GOLD, CYAN, clamp } from './art.mjs';

export function drawEffects(c) {
  for (const e of this.effects) {
    const k = clamp(e.age / e.life),
      fade = Math.sin(Math.PI * k);
    c.save();
    c.globalAlpha = fade * 0.9;
    c.strokeStyle = e.type === 'lightning' ? CYAN : GOLD;
    c.lineWidth = 4;
    c.shadowColor = c.strokeStyle;
    c.shadowBlur = this.reduced ? 0 : 16;
    if (e.type === 'lightning')
      for (const path of e.paths) {
        for (let pass = 0; pass < (this.reduced ? 1 : 2); pass++) {
          c.strokeStyle = pass ? '#f1ffff' : '#39acff';
          c.lineWidth = pass ? 3 : 11;
          c.beginPath();
          c.moveTo(path[0].x, path[0].y);
          for (let i = 1; i < path.length; i++) {
            const a = path[i - 1],
              b = path[i];
            for (let j = 1; j <= 5; j++) {
              const f = j / 5,
                n = j === 5 || this.reduced ? 0 : Math.sin(i * 11 + j * 7 + e.age * 12) * 13;
              c.lineTo(a.x + (b.x - a.x) * f + n, a.y + (b.y - a.y) * f - n * 0.6);
            }
          }
          c.stroke();
        }
      }
    const points = e.type === 'specials' ? e.added : e.removed;
    for (const [i, p] of points.slice(0, this.quality === 'low' ? 24 : 96).entries()) {
      const delay = this.reduced ? 0 : (i % 7) * 0.025,
        q = clamp((e.age - delay) / (e.life - delay));
      c.beginPath();
      c.arc(p.x, p.y, this.reduced ? 43 : 25 + q * 65, 0, Math.PI * 2);
      c.stroke();
      if (!this.reduced) {
        c.fillStyle = c.strokeStyle;
        for (let j = 0; j < 4; j++) {
          const a = (j * Math.PI) / 2 + i * 0.7,
            r = 22 + q * 82;
          c.fillRect(p.x + Math.cos(a) * r - 2, p.y + Math.sin(a) * r - 2, 4, 4);
        }
      }
    }
    if (e.type === 'fullClear') {
      c.lineWidth = this.reduced ? 3 : 15;
      c.beginPath();
      c.ellipse(450, 710, 90 + k * 730, 70 + k * 800, 0, 0, Math.PI * 2);
      c.stroke();
    }
    c.restore();
  }
}
