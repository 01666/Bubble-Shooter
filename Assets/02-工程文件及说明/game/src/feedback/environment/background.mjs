const clamp = (v) => Math.max(0, Math.min(1, v));
export const QUALITY = Object.freeze({
  low: { particles: 12, fog: false, rays: 1 },
  medium: { particles: 28, fog: true, rays: 2 },
  high: { particles: 48, fog: true, rays: 3 },
});
// Transparent architecture accents: a far portal, mid-depth light and foreground dust.
// Draw after the room and before gameplay. Never moves the entire room bitmap.
export class LivingRoom {
  constructor({ quality = 'medium' } = {}) {
    this.quality = quality;
    this.time = 0;
    this.pulses = [];
    this.charge = 0;
    this.seen = new Set();
  }
  restore(s) {
    this.pulses = [];
    this.seen.clear();
    this.charge = s.assist?.charge ?? 0;
  }
  revealOpportunity(id) {
    const key = 'arrival:' + id;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    if (this.seen.size > 2048) this.seen.delete(this.seen.values().next().value);
    this.pulses.push({ kind: 'arrival', priority: 3, at: this.time, life: 1.1 });
    if (this.pulses.length > 8) this.pulses.shift();
  }
  consume(events, s) {
    this.charge = s.assist?.charge ?? this.charge;
    for (const e of events ?? []) {
      if (!e.eventId || this.seen.has(e.eventId)) continue;
      this.seen.add(e.eventId);
      if (this.seen.size > 2048) this.seen.delete(this.seen.values().next().value);
      const types = {
        assistChargeChanged: ['charge', 1],
        networkActivated: ['electric', 3],
        explosionResolved: ['blast', 3],
        targetsCollected: ['star', 2],
        stageBonusEarned: ['chest', 4],
      };
      if (types[e.type]) {
        const [kind, priority] = types[e.type];
        this.pulses.push({
          kind,
          priority,
          at: this.time,
          life: kind === 'chest' ? 2.5 : kind === 'blast' || kind === 'electric' ? 1.8 : 1.1,
        });
        if (this.pulses.length > 8) this.pulses.shift();
      }
    }
  }
  update(dt, { paused = false, reduced = false, quality = this.quality } = {}) {
    this.reduced = reduced;
    this.quality = QUALITY[quality] ? quality : 'low';
    if (!paused) this.time += Math.min(0.1, Math.max(0, dt));
    this.pulses = this.pulses.filter((p) => this.time - p.at < p.life);
  }
  draw(c, { aim = 0 } = {}) {
    const q = QUALITY[this.quality],
      t = this.reduced ? 0 : this.time,
      offset = this.reduced ? 0 : Math.max(-4, Math.min(4, aim * 3));
    const pulse = [...this.pulses].sort((a, b) => b.priority - a.priority)[0],
      power = pulse ? Math.sin(Math.PI * clamp((t - pulse.at) / pulse.life)) : 0;
    c.save();
    if (pulse && !this.reduced && ['blast', 'electric', 'chest', 'arrival'].includes(pulse.kind)) {
      const electric = pulse.kind === 'electric',
        elapsed = clamp((t - pulse.at) / pulse.life),
        radius = 180 + elapsed * 560;
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.translate(450, 1130);
      c.scale(1, 0.34);
      const glow = c.createRadialGradient(0, 0, 30, 0, 0, radius);
      glow.addColorStop(
        0,
        electric ? `rgba(56,183,255,${power * 0.55})` : `rgba(255,177,48,${power * 0.4})`,
      );
      glow.addColorStop(1, 'transparent');
      c.fillStyle = glow;
      c.fillRect(-radius, -radius, radius * 2, radius * 2);
      c.strokeStyle = electric ? '#9beaff' : '#ffe3a3';
      c.globalAlpha = power * 0.8;
      c.lineWidth = 12;
      c.shadowColor = c.strokeStyle;
      c.shadowBlur = 25;
      c.beginPath();
      c.arc(0, 0, radius, 0, Math.PI * 2);
      c.stroke();
      c.restore();
      for (let side = 0; side < 2; side++) {
        const x = side ? 825 : 75,
          g = c.createLinearGradient(x, 240, x, 1230);
        g.addColorStop(0, 'transparent');
        g.addColorStop(
          0.5,
          electric ? `rgba(60,196,255,${power * 0.5})` : `rgba(255,181,74,${power * 0.44})`,
        );
        g.addColorStop(1, 'transparent');
        c.fillStyle = g;
        c.fillRect(x - 34, 240, 68, 990);
      }
    }
    // Far arch receives the deepest, slowest response, behind the aiming corridor.
    c.strokeStyle = `rgba(117,180,220,${0.15 + Math.sin(t * 0.8) * 0.04 + power * 0.18})`;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(310 + offset, 1030);
    c.lineTo(310 + offset, 600);
    c.quadraticCurveTo(450 + offset, 380, 590 + offset, 600);
    c.lineTo(590 + offset, 1030);
    c.stroke();
    for (let i = 0; i < q.rays; i++) {
      const x = 230 + i * 220 + offset * 0.5 + Math.sin(t * 0.3 + i) * 35,
        alpha = 0.075 + (pulse?.kind === 'chest' ? 0.065 : 0.045) * power;
      const g = c.createLinearGradient(x, 600, x, 1300);
      g.addColorStop(0, `rgba(130,193,226,${alpha})`);
      g.addColorStop(1, 'transparent');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(x, 490);
      c.lineTo(x - 90, 1240);
      c.lineTo(x + 125, 1240);
      c.closePath();
      c.fill();
    }
    // Local fixtures, coherent with the blue upper ambience and warm lower lanterns.
    for (const [x, y, r] of [
      [112, 950, 120],
      [784, 950, 120],
      [450, 1050, 160],
    ]) {
      const g = c.createRadialGradient(x, y, 2, x, y, r);
      g.addColorStop(
        0,
        `rgba(245,191,90,${0.14 + Math.sin(t * 1.1 + x) * 0.04 + power * 0.12 + this.charge * 0.012})`,
      );
      g.addColorStop(1, 'transparent');
      c.fillStyle = g;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    if (q.fog && !this.reduced)
      for (let i = 0; i < 3; i++) {
        const y = 960 + i * 70 + Math.sin(t * 0.14 + i) * 10,
          x = 450 + Math.sin(t * 0.09 + i) * 28;
        const g = c.createRadialGradient(x, y, 0, x, y, 320);
        g.addColorStop(0, '#78b5da16');
        g.addColorStop(1, 'transparent');
        c.save();
        c.translate(x, y);
        c.scale(1, 0.13);
        c.fillStyle = g;
        c.translate(-x, -y);
        c.fillRect(x - 340, y - 340, 680, 680);
        c.restore();
      }
    // Architectural glyphs are environment art, never gameplay network connections.
    for (const side of [0, 1])
      for (let i = 0; i < 3; i++) {
        const x = side ? 827 : 73,
          y = 530 + i * 170;
        c.strokeStyle = `rgba(112,205,235,${0.18 + Math.sin(t * 1.5 - i) * 0.08 + (pulse?.kind === 'electric' ? power * 0.38 : 0)})`;
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(x - 9, y);
        c.lineTo(x, y - 17);
        c.lineTo(x + 9, y);
        c.lineTo(x, y + 17);
        c.closePath();
        c.stroke();
      }
    if (!this.reduced)
      for (let i = 0; i < q.particles; i++) {
        const near = i % 3 === 0,
          speed = near ? 28 : 12,
          x = 80 + ((i * 137.3 + Math.sin(t * 0.12 + i) * 12) % 740),
          y = 650 + ((((i * 79.7 - t * speed) % 660) + 660) % 660);
        c.globalAlpha = (near ? 0.42 : 0.24) * (1 + 0.3 * Math.sin(t * 0.7 + i));
        c.fillStyle = near ? '#efcd8c' : '#8fc4e0';
        c.beginPath();
        c.arc(x + offset * (near ? 1 : 0.3), y, near ? 3 : 1.5, 0, Math.PI * 2);
        c.fill();
      }
    c.restore();
  }
  stats() {
    return {
      time: this.time,
      pulses: this.pulses.length,
      seen: this.seen.size,
      quality: this.quality,
    };
  }
  dispose() {
    this.pulses = [];
    this.seen.clear();
  }
}
