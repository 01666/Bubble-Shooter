// Visual copies of earned tickets. Never modifies the ledger or simulates a receipt.
export const REWARD_TIMING = Object.freeze({
  upperFlight: 0.95,
  landingPause: 0.12,
  lowerFlight: 0.8,
});
export class RewardFlights {
  constructor(onArrival) {
    this.onArrival = onArrival;
    this.clear();
  }
  clear() {
    this.queue = [];
    this.flights = [];
    this.pops = [];
    this.seen = new Set();
    this.nextAt = 0;
    this.units = 0;
    this.arrivals = 0;
  }
  add(id, count, sources, at) {
    if (this.seen.has(id) || !Number.isSafeInteger(count) || count <= 0 || !sources.length) return;
    this.seen.add(id);
    if (this.seen.size > 2048) this.seen.delete(this.seen.values().next().value);
    this.queue.push({ id, count, index: 0, sources, at });
  }
  update(clock) {
    let budget = 4;
    while (this.queue.length && budget-- > 0) {
      const burst = this.queue[0];
      const at = Math.max(burst.at, this.nextAt);
      if (clock < at) break;
      const source = burst.sources[burst.index % burst.sources.length];
      this.flights.push({ source, at, unit: this.units++ });
      burst.index++;
      this.nextAt = at + 0.075;
      if (burst.index >= burst.count) this.queue.shift();
    }
    for (const f of this.flights) {
      if (!f.arrived && clock >= f.at + REWARD_TIMING.upperFlight + REWARD_TIMING.landingPause) {
        f.arrived = true;
        this.arrivals++;
        this.pops.push({ at: clock, unit: f.unit });
        this.onArrival();
      }
    }
    this.flights = this.flights.filter(
      (f) => clock < f.at + REWARD_TIMING.upperFlight + REWARD_TIMING.landingPause + 0.15,
    );
    this.pops = this.pops.filter((p) => clock < p.at + 0.46);
  }
  ticket(c, x, y, angle, alpha, scale = 1) {
    c.save();
    c.translate(x, y);
    c.rotate(angle);
    c.scale(scale, scale);
    c.globalAlpha = alpha;
    c.shadowColor = '#ffcf65';
    c.shadowBlur = 12;
    const gold = c.createLinearGradient(0, -15, 0, 15);
    gold.addColorStop(0, '#fff7d8');
    gold.addColorStop(1, '#ffc96a');
    c.fillStyle = gold;
    c.strokeStyle = '#ae7631';
    c.lineWidth = 2;
    c.beginPath();
    c.roundRect(-25, -15, 50, 30, 4);
    c.fill();
    c.stroke();
    c.shadowBlur = 0;
    c.setLineDash([2, 3]);
    for (const x of [-17, 17]) {
      c.beginPath();
      c.moveTo(x, -13);
      c.lineTo(x, 13);
      c.stroke();
    }
    c.setLineDash([]);
    c.font = 'bold 16px sans-serif';
    c.textAlign = 'center';
    c.fillStyle = '#9d6425';
    c.fillText('★', 0, 6);
    c.restore();
  }
  draw(c, clock, reduced, text) {
    if (!reduced)
      for (const f of this.flights) {
        for (const [route, to, duration] of [
          [0, { x: 754, y: 70 }, REWARD_TIMING.upperFlight],
          [1, { x: 740, y: 135 }, REWARD_TIMING.lowerFlight],
        ]) {
          const k = Math.max(0, Math.min(1, (clock - f.at) / duration));
          if (k >= 1) {
            if (route === 0 && clock < f.at + duration + REWARD_TIMING.landingPause) {
              const settle = (clock - f.at - duration) / REWARD_TIMING.landingPause;
              this.ticket(c, to.x, to.y, 0, 1 - settle * 0.35, 0.92 - settle * 0.4);
            }
            if (route === 1) {
              const fade = Math.max(0, 1 - (clock - f.at - 0.8) / 0.15);
              c.save();
              c.globalAlpha = fade;
              c.strokeStyle = '#fff0b4';
              c.lineWidth = 3;
              c.beginPath();
              c.arc(to.x, to.y, 12 + (1 - fade) * 18, 0, Math.PI * 2);
              c.stroke();
              c.restore();
            }
            continue;
          }
          const e = k * k * (3 - 2 * k),
            bend = Math.sin(k * Math.PI);
          const x = f.source.x + (to.x - f.source.x) * e + bend * (route ? 75 : -90);
          const y = f.source.y + (to.y - f.source.y) * e - bend * 75;
          c.save();
          c.strokeStyle = '#ffd983';
          c.globalAlpha = 0.35 * Math.sin(k * Math.PI);
          c.lineWidth = 3;
          c.beginPath();
          c.moveTo(x - 15, y + 15);
          c.lineTo(x, y);
          c.stroke();
          c.restore();
          this.ticket(c, x, y, Math.sin(k * 5 + f.unit) * 0.2, 1, 1.1 - k * 0.18);
        }
      }
    for (const p of this.pops) {
      const k = (clock - p.at) / 0.46;
      c.save();
      c.globalAlpha = 1 - k;
      const x = 838 + (p.unit % 2) * 12,
        y = 155 - (reduced ? 0 : k * 50);
      c.fillStyle = '#082548e8';
      c.strokeStyle = '#ffe4a0';
      c.lineWidth = 2;
      c.beginPath();
      c.roundRect(x - 29, y - 34, 58, 42, 10);
      c.fill();
      c.stroke();
      text('+1', x, y, 38, '#fff5b8');
      c.restore();
    }
  }
  stats() {
    return {
      queued: this.queue.reduce((n, b) => n + b.count - b.index, 0),
      units: this.units,
      arrivals: this.arrivals,
      flying: this.flights.length,
      pops: this.pops.length,
    };
  }
}
