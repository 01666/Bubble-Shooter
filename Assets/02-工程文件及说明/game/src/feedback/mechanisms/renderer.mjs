import {
  COLORS,
  clamp,
  validPoint,
  dualOrb,
  singleOrb,
  nodeRune,
  wire,
  ring,
  text,
} from './art.mjs';
export class MechanismRenderer {
  constructor(director, { atlas = null, enabled = true } = {}) {
    this.director = director;
    this.atlas = atlas;
    this.enabled = enabled;
  }
  draw(
    c,
    {
      nodePoint = (n) => n,
      alivePoints = [],
      collar = { x: 144, y: 1429 },
      loaded = null,
      projectile = null,
      priorityBusy = false,
    } = {},
  ) {
    const d = this.director;
    if (!this.enabled || !d.enabled) return { loaded: false, projectile: false };
    const s = d.snapshot,
      reduced = d.reduced;
    c.save();
    // Quiescent wires sit behind glyphs; real rendered coordinates track moving boards.
    const nodes = new Map(s.network.nodes.map((n) => [n.id, n]));
    for (const e of s.network.edges)
      wire(c, nodePoint(nodes.get(e.from)), nodePoint(nodes.get(e.to)));
    for (const n of nodes.values()) {
      const p = nodePoint(n);
      if (validPoint(p)) nodeRune(c, p, 40, reduced ? 0 : d.clock);
    }
    const hiddenIds = d.claimedIds;
    c.save();
    c.beginPath();
    c.rect(18, 119, 864, 970);
    c.clip();
    // Old bursts never cover freshly spawned balls, including unrelated nearby refills.
    for (const p of alivePoints.filter((p) => !hiddenIds.has(p.id) && validPoint(p))) {
      c.beginPath();
      c.rect(0, 0, 900, 1600);
      c.moveTo(p.x + 43, p.y);
      c.arc(p.x, p.y, 43, 0, Math.PI * 2);
      c.clip('evenodd');
    }
    for (const e of d.effects) if (e.kind === 'resolve') this.drawResolve(c, e, reduced);
    c.restore();
    for (const e of d.effects)
      if (e.kind === 'charge') {
        const k = clamp(e.age / 0.6),
          t = 1 - (1 - k) ** 3;
        const p = {
          x: e.from.x + (collar.x - e.from.x) * t + Math.sin(k * Math.PI) * 45,
          y: e.from.y + (collar.y - e.from.y) * t,
        };
        if (!reduced) {
          c.globalAlpha = 1 - k * 0.3;
          ring(c, p, 7, '#9cecfc', 3);
          ring(c, p, 3, '#fff0b4', 2);
        } else ring(c, collar, 21 + 6 * k, `rgba(162,233,255,${1 - k})`, 2);
      }
    c.globalAlpha = 1;
    // Compact three-gem collar. It replaces only the medallion visually.
    if (s.assist.enabled !== false && !this.petSlotEnabled) {
      c.fillStyle = '#112e52';
      c.strokeStyle = '#edc675';
      c.lineWidth = 2;
      c.beginPath();
      c.roundRect(collar.x - 29, collar.y - 10, 58, 20, 9);
      c.fill();
      c.stroke();
      for (let i = 0; i < 3; i++) {
        const x = collar.x + (i - 1) * 17,
          lit = i < s.assist.charge;
        c.fillStyle = lit ? '#92e9ff' : '#24405d';
        c.shadowColor = '#5ed6ff';
        c.shadowBlur = lit && !reduced ? 7 : 0;
        c.beginPath();
        c.moveTo(x, collar.y - 6);
        c.lineTo(x + 5, collar.y);
        c.lineTo(x, collar.y + 6);
        c.lineTo(x - 5, collar.y);
        c.closePath();
        c.fill();
      }
      c.shadowBlur = 0;
      if (!priorityBusy && !d.priorityBusy) {
        c.fillStyle = '#071c35df';
        c.strokeStyle = '#d5b978';
        c.beginPath();
        c.roundRect(49, 1230, 248, 76, 14);
        c.fill();
        c.stroke();
        text(c, `萌宠助攻 ${s.assist.ready ? 3 : s.assist.charge}/3`, 173, 1258, 24);
        text(c, '消除蓄能 · 满3格送双彩', 173, 1287, 19, '#c5e3f7');
      }
    }
    if (s.assist.ready && !priorityBusy && !d.priorityBusy) {
      c.fillStyle = '#071c35ec';
      c.strokeStyle = '#ddbc78';
      c.beginPath();
      c.roundRect(323, 1215, 254, 76, 16);
      c.fill();
      c.stroke();
      text(
        c,
        s.assist.colors.length === 2
          ? '下一发双彩'
          : s.assist.colors.length === 1
            ? '下一发单色助攻'
            : '助攻已就绪',
        450,
        1245,
        26,
      );
      text(c, '两种颜色分别参与三消', 450, 1273, 19, '#c5e3f7');
      for (let i = 0; i < s.assist.colors.length; i++) {
        c.fillStyle = COLORS[s.assist.colors[i]];
        c.beginPath();
        c.arc(337 + i * 226, 1239, 6, 0, Math.PI * 2);
        c.fill();
      }
    }
    if (s.network.nodes.length && !priorityBusy && !d.priorityBusy) {
      text(c, '遗迹导电网', 735, 1258, 24, '#bdf5ff');
      text(c, '消除导电球 · 闪电随机连击', 735, 1287, 19, '#c5e3f7');
    }
    const result = { loaded: false, projectile: false };
    // Host supplies the exact live mesh centre, scale and visibility, including loading.
    if (loaded?.visible && s.assist.ready)
      result.loaded = dualOrb(c, loaded, s.assist.colors, loaded.radius ?? 40, this.atlas);
    if (projectile?.visible)
      result.projectile = dualOrb(
        c,
        projectile,
        projectile.colors,
        projectile.radius ?? 40,
        this.atlas,
      );
    c.restore();
    return result;
  }
  drawResolve(c, e, reduced) {
    const age = e.age;
    if (validPoint(e.impact) && age < 0.35)
      for (const g of e.groups) {
        const target = g.cells.find((b) => Math.hypot(b.x - e.impact.x, b.y - e.impact.y) > 10);
        if (target) {
          c.save();
          c.globalAlpha = 1 - age / 0.35;
          c.strokeStyle = COLORS[g.color];
          c.lineWidth = reduced ? 2 : 4;
          c.beginPath();
          c.moveTo(e.impact.x, e.impact.y);
          c.lineTo(target.x, target.y);
          c.stroke();
          c.restore();
        }
      }
    for (let group = 0; group < e.groups.length; group++)
      for (const b of e.groups[group].cells) {
        const k = clamp((age - group * 0.035) / 0.48);
        if (k <= 0 || k >= 1) continue;
        c.save();
        c.globalAlpha = 1 - k;
        ring(c, b, 22 + k * (reduced ? 8 : 38), COLORS[e.groups[group].color], 3 * (1 - k) + 1);
        if (!reduced) this.shards(c, b, k, COLORS[e.groups[group].color], 5);
        c.restore();
      }
    const byId = new Map(e.nodes.map((n) => [n.id, n]));
    for (const id of e.roots)
      if (age < 0.35) {
        const p = byId.get(id);
        c.save();
        c.globalAlpha = 1 - age / 0.35;
        ring(c, p, 12 + age * 110, '#b2f0ff', 3);
        c.restore();
      }
    for (const step of e.steps) {
      const k = (age - step.delay) / 0.12;
      if (k < 0 || k > 5) continue;
      c.save();
      c.globalAlpha = k > 1 ? clamp(1 - (k - 1) / 4) : 1;
      wire(c, byId.get(step.from), byId.get(step.to), { active: 1, progress: clamp(k), reduced });
      if (!reduced) {
        const to = byId.get(step.to),
          reach = 35 + clamp(k) * 85;
        const gl = c.createRadialGradient(to.x, to.y, 0, to.x, to.y, reach);
        gl.addColorStop(0, '#dafaffaa');
        gl.addColorStop(0.3, '#32cfff44');
        gl.addColorStop(1, 'transparent');
        c.globalCompositeOperation = 'lighter';
        c.fillStyle = gl;
        c.fillRect(to.x - reach, to.y - reach, reach * 2, reach * 2);
        for (let j = 0; j < 3; j++) {
          const a = j * 2.094 + step.delay * 7;
          wire(
            c,
            to,
            { x: to.x + Math.cos(a) * reach, y: to.y + Math.sin(a) * reach },
            { active: 1, progress: clamp(k), reduced: false },
          );
        }
      }
      c.restore();
    }
    for (const contact of e.contacts ?? []) {
      const k = (age - contact.delay) / 0.2;
      if (k < 0 || k > 1.6) continue;
      c.save();
      c.globalAlpha = k > 1 ? clamp(1 - (k - 1) / 0.6) : 1;
      wire(c, contact.from, contact.to, { active: 1, progress: clamp(k), reduced });
      c.restore();
    }
    for (const n of e.pops) {
      const k = (age - n.delay) / 0.55;
      if (k < 0) {
        singleOrb(c, n, n.color, 40, this.atlas);
        if (n.kind === 'conductor') nodeRune(c, n);
        continue;
      }
      if (k > 1) continue;
      c.save();
      c.globalAlpha = 1 - k;
      singleOrb(c, n, n.color, 40 * (1 - k * 0.6), this.atlas);
      if (n.kind === 'conductor') nodeRune(c, n, 40, 1);
      ring(c, n, 15 + k * (reduced ? 9 : 55), '#92eaff', 3 * (1 - k) + 1);
      if (!reduced) this.shards(c, n, k, '#bcf4ff', 12);
      c.restore();
    }
  }
  shards(c, p, k, color, n) {
    c.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI * 2) / n + 0.4,
        dist = 15 + 60 * k,
        x = p.x + Math.cos(a) * dist,
        y = p.y + Math.sin(a) * dist + 20 * k * k;
      c.save();
      c.translate(x, y);
      c.rotate(a + k * 3);
      c.fillRect(-3, -6, (1 - k) * 6 + 1, (1 - k) * 12 + 1);
      c.restore();
    }
  }
}
