import { drawPrizeBurst } from '../arcade/prize-burst.mjs';
import { drawChest, drawStar, starSlot } from './treasure.mjs';
import { RewardFlights } from './reward-flights.mjs';
import { blastLayers } from '../impact-vfx.mjs';
// Presentation only. No gameplay imports, timer, RAF, audio node or ledger writes.
export const CONFIG = Object.freeze({
  width: 900,
  height: 1600,
  maxGroups: 8,
  maxShots: 64,
  maxRecords: 40,
  largeDrop: 6,
  joinWindow: 0,
  life: 1.5,
  targetFlight: 0.52,
  stageLife: 2.05,
});
export const point = (b) => ({ x: 450 + b.x * (900 / 9.9), y: 160 + (7 - b.y) * (900 / 9.9) });
const colors = ['#ef2554', '#228bff', '#31df96', '#ffc733', '#aa61f7'];
const boxes = [
  [63, 79, 459, 465],
  [568, 79, 969, 466],
  [1079, 80, 1476, 466],
  [63, 555, 459, 942],
  [568, 555, 969, 943],
];
const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n)),
  ease = (t) => 1 - (1 - clamp(t)) ** 3;
const validPoint = (b) => Number.isFinite(b?.x) && Number.isFinite(b?.y);
const amount = (n) => (Number.isSafeInteger(n) && n >= 0 ? n : null);
export class EffectsUI {
  constructor({
    canvas,
    atlas = null,
    onCue = () => {},
    onCamera = () => {},
    onNotice = () => {},
    reduced = false,
    mapPoint = point,
    showMarkers = false,
    retirementPlan = () => null,
  } = {}) {
    if (!canvas) throw Error('EffectsUI requires overlay canvas');
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    canvas.width = 900;
    canvas.height = 1600;
    this.atlas = atlas;
    this.onCue = onCue;
    this.onCamera = onCamera;
    this.onNotice = onNotice;
    this.mapPoint = mapPoint;
    this.reduced = reduced;
    this.showMarkers = showMarkers;
    this.retirementPlan = retirementPlan;
    this.clock = 0;
    this.rewardFlights = new RewardFlights(() => this.onCue({ name: 'reward-unit-arrive' }));
    this.pending = new Map();
    this.groups = [];
    this.stages = [];
    this.seen = new Set();
    this.watermark = 0;
    this.revision = -1;
    this.cache = new Map();
    this.board = [];
    this.snapshot = null;
    this.records = [];
    this.notices = [];
    this.freshCells = new Map();
    this.receiptPapers = [];
    this.sessionEarned = 0;
    this.sessionStarted = false;
    this.disposed = false;
    this.diagnostics = [];
    this.counters = { consumed: 0, duplicates: 0, evicted: 0, cues: 0 };
  }
  // Call once before forwarding new committed events. Restore skips all old revisions.
  restore(snapshot, { eventSequence = 0 } = {}) {
    this.clear();
    this.records = [];
    this.diagnostics = [];
    this.seen.clear();
    this.watermark = eventSequence;
    this.revision = snapshot?.revision ?? -1;
    this.snapshot = structuredClone(snapshot);
    this.board = snapshot?.board ?? [];
    this.cache = new Map(
      [...this.board, ...(snapshot?.content?.reserve ?? [])].map((b) => [b.id, { ...b }]),
    );
    this.stage = { id: snapshot?.stage?.id, collected: snapshot?.stage?.collected ?? 0 };
    this.sessionEarned = 0;
    this.sessionStarted = true;
  }
  clear() {
    this.rewardFlights.clear();
    this.pending.clear();
    this.groups = [];
    this.stages = [];
    this.notices = [];
    this.freshCells.clear();
    this.receiptPapers = [];
    this.refillNotice = null;
    this.ctx.clearRect(0, 0, 900, 1600);
    this.onCamera({ x: 0, y: 0 });
  }
  consume(events, snapshot) {
    if (this.disposed) return;
    // Preserve previous positions before accepting next authoritative snapshot.
    for (const e of events ?? []) {
      const n = /^event-(\d+)$/.exec(e.eventId ?? '');
      if (
        !e.eventId ||
        this.seen.has(e.eventId) ||
        (n && Number(n[1]) <= this.watermark) ||
        (Number.isFinite(e.revision) && e.revision <= this.revision)
      ) {
        this.counters.duplicates++;
        continue;
      }
      this.seen.add(e.eventId);
      // Numeric gameplay event IDs use the monotonic watermark; UUID feeds require host revision fencing.
      if (this.seen.size > 2048) {
        const retired = this.seen.values().next().value,
          seq = /^event-(\d+)$/.exec(retired);
        if (seq) this.watermark = Math.max(this.watermark, Number(seq[1]));
        this.seen.delete(retired);
      }
      this.counters.consumed++;
      const p = structuredClone(e.payload ?? {}),
        shot = e.shotId ?? p.shotId;
      if (e.type === 'petSlotResolved') {
        const sources = (p.removed ?? []).map((b) => this.mapPoint(b));
        this.rewardFlights.add(
          p.spinId + ':slot',
          p.actualTicketDelta ?? 0,
          sources.length ? sources : [{ x: 450, y: 1100 }],
          this.clock,
        );
        continue;
      }
      // Slot feedback owns its reward narrative; its aggregate ticket delta flies once above.
      if (p.rewardSource === 'petSlots') continue;
      if (
        ['explosionResolved', 'paidShotResolved', 'targetsCollected', 'stageBonusEarned'].includes(
          e.type,
        )
      ) {
        if (!shot) {
          this.warn('missing-shotId', e.type);
          continue;
        }
        let s = this.pending.get(shot);
        if (!s) {
          s = {
            shotId: shot,
            at: this.clock,
            events: [],
            positions: new Map(this.cache),
            stage: this.snapshot?.stage,
          };
          this.pending.set(shot, s);
        }
        s.events.push({ type: e.type, p });
        if (e.type === 'paidShotResolved') s.result = p;
        for (const b of [...(p.direct ?? []), ...(p.dropped ?? []), ...(p.triggers ?? [])])
          s.positions.set(b.id, b);
      } else if (e.type === 'dispenseConfirmed' && p.delta > 0) {
        this.receiptPapers.push({ at: this.clock, delta: p.delta });
        if (this.receiptPapers.length > 6) this.receiptPapers.shift();
      } else if (e.type === 'boardWaveIncoming') this.notice('泡泡补充 · 新一波即将从顶部进入');
      else if (['boardRefilled', 'boardRepositioned', 'boardMaintained'].includes(e.type))
        this.boardEvent(e.type, p, snapshot, shot);
    }
    while (this.pending.size > CONFIG.maxShots) {
      const id = this.pending.keys().next().value,
        s = this.pending.get(id);
      if (s.result) this.flush(s);
      else this.warn('pending-overflow', id);
      this.pending.delete(id);
      this.counters.evicted++;
    }
    if (snapshot) {
      this.snapshot = structuredClone(snapshot);
      this.board = snapshot.board ?? [];
      for (const b of [...this.board, ...(snapshot.content?.reserve ?? [])])
        this.cache.set(b.id, { ...b });
      const keep = new Set([...this.board, ...(snapshot.content?.reserve ?? [])].map((b) => b.id));
      for (const id of this.cache.keys()) if (!keep.has(id)) this.cache.delete(id);
    }
  }
  warn(code, detail) {
    this.diagnostics.push({ code, detail });
    if (this.diagnostics.length > 30) this.diagnostics.shift();
  }
  cue(name, g, at, data = {}) {
    if (g.cues.has(name + at)) return;
    g.cues.add(name + at);
    this.counters.cues++;
    this.onCue({ name, shotId: g.shotId, at, clock: this.clock, ...data });
  }
  add(g) {
    g.age = 0;
    g.cues = new Set();
    this.groups.push(g);
    while (this.groups.length > CONFIG.maxGroups) {
      this.groups.shift();
      this.counters.evicted++;
    }
  }
  notice(text) {
    this.notices.push({ text, at: this.clock, visibleAt: null });
    if (this.notices.length > 3) this.notices.shift();
    this.onNotice(text);
  }
  boardEvent(type, p, snapshot, shotId) {
    // The scene already animates the whole ceiling move. Do not draw 72 overlapping gold rings.
    if (type === 'boardRepositioned' && p.reason === 'ceilingAdvance') return;
    const cells =
      type === 'boardRefilled'
        ? (p.added ?? [])
        : type === 'boardMaintained'
          ? (p.removed ?? [])
          : (p.moved ?? []).map((m) => {
              const to = snapshot?.board?.find((b) => b.id === m.id),
                from = this.cache.get(m.id);
              return { ...m, ...to, from: validPoint(from) ? this.mapPoint(from) : null };
            });
    if (type === 'boardRefilled')
      for (const b of cells)
        this.freshCells.set(b.id, { until: this.clock + 1.5, at: this.clock, shotId });
    this.add({
      type,
      life: type === 'boardRefilled' ? 1.45 : 0.65,
      cells: cells.map((b) => ({ ...b, q: validPoint(b) ? this.mapPoint(b) : null })),
    });
    this.notice(
      type === 'boardRefilled'
        ? p.cause === 'emptyBoardWave'
          ? '泡泡补充 · 清空成功，新一波登场'
          : ['pressureWave', 'recoveryWave'].includes(p.cause)
            ? '泡泡补充 · 顶部推进一排'
            : `泡泡补充 +${cells.length} 球`
        : type === 'boardRepositioned'
          ? `原球归位 · ${cells.length} 球 · 原色保留`
          : `盘面整理 · ${cells.length} 球暂存 · 无彩票奖励`,
    );
    if (type === 'boardRefilled') this.refillNotice = this.notices.at(-1);
  }
  flush(s) {
    const r = s.result;
    if (!r) return;
    const explosions = s.events
      .filter((e) => e.type === 'explosionResolved')
      .flatMap((e) => e.p.triggers ?? []);
    const triggers = [...new Map(explosions.map((b) => [b.id, b])).values()].filter(validPoint);
    const direct = (r.direct ?? []).filter(validPoint),
      dropped = (r.dropped ?? []).filter(validPoint);
    const plan = this.retirementPlan(s.shotId);
    const owned = new Set([...(plan?.directIds ?? []), ...(plan?.electricIds ?? [])]);
    const g = {
      type: 'shot',
      shotId: s.shotId,
      at: s.at,
      life: Math.max(CONFIG.life, plan?.life ?? 0),
      result: r,
      direct: direct.filter((b) => !owned.has(b.id)),
      dropped,
      mechanismOwned: owned.size > 0,
      dropAt: plan?.dropDelay ?? 0.22,
      triggers,
      gain: amount(r.gain),
      grade:
        triggers.length > 1
          ? 'chain'
          : triggers.length
            ? 'bomb'
            : dropped.length >= CONFIG.largeDrop
              ? 'largeDrop'
              : direct.length
                ? 'clear'
                : 'attach',
    };
    this.add(g);
    if (g.gain > 0)
      this.rewardFlights.add(
        `shot-${s.shotId}`,
        g.gain,
        [...direct, ...dropped].map((b) => this.mapPoint(b)),
        this.clock + Math.max(0.3, (plan?.dropDelay ?? 0) + 0.3),
      );
    if (g.gain !== null) this.sessionEarned += g.gain;
    else this.warn('missing-gain', s.shotId);
    for (const e of s.events.filter((e) => e.type === 'targetsCollected')) {
      const p = e.p,
        ids = p.targetIds ?? [],
        before = Math.max(0, p.progress - ids.length);
      const flights = ids.map((id, i) => {
        const b = s.positions.get(id);
        if (!validPoint(b)) this.warn('missing-target-position', id);
        return {
          id,
          from: validPoint(b) ? this.mapPoint(b) : null,
          slot: Math.min(2, before + i),
          delay: 0.19 + i * 0.09,
        };
      });
      const bonus = s.events.find(
        (e) => e.type === 'stageBonusEarned' && e.p.stageId === p.stageId,
      )?.p;
      this.stages.push({
        stageId: p.stageId,
        award: bonus?.count ?? (s.stage?.id === p.stageId ? s.stage.award : null),
        before,
        progress: p.progress,
        flights,
        bonus: bonus ? amount(bonus.count) : null,
        age: -(plan?.dropDelay ?? 0),
        cues: new Set(),
        shotId: s.shotId,
        life: bonus ? CONFIG.stageLife : 1.05,
      });
      if (bonus && amount(bonus.count) !== null) this.sessionEarned += bonus.count;
    }
    if (this.stages.length > CONFIG.maxGroups)
      this.stages.splice(0, this.stages.length - CONFIG.maxGroups);
    const orphan = s.events.find(
      (e) =>
        e.type === 'stageBonusEarned' &&
        !s.events.some((t) => t.type === 'targetsCollected' && t.p.stageId === e.p.stageId),
    );
    if (orphan) {
      const count = amount(orphan.p.count);
      if (count !== null) this.sessionEarned += count;
      this.stages.push({
        stageId: orphan.p.stageId,
        award: count,
        before: 3,
        progress: 3,
        flights: [],
        bonus: count,
        age: 0,
        cues: new Set(),
        shotId: s.shotId,
        life: CONFIG.stageLife,
      });
      this.warn('bonus-without-target-event', s.shotId);
    }
    this.records.push({
      shotId: s.shotId,
      grade: g.grade,
      triggers: triggers.map((b) => b.id),
      direct: direct.length,
      dropped: dropped.length,
      gain: g.gain,
      bonus: r.bonus ?? 0,
    });
    if (this.records.length > CONFIG.maxRecords) this.records.shift();
  }
  update(dt, snapshot) {
    if (this.disposed) return;
    this.clock += Math.max(0, Math.min(0.1, dt));
    if (snapshot) {
      this.snapshot = structuredClone(snapshot);
      this.board = snapshot.board ?? [];
    }
    for (const [id, s] of this.pending) {
      if (s.result && this.clock - s.at >= CONFIG.joinWindow) {
        this.flush(s);
        this.pending.delete(id);
      } else if (this.clock - s.at > 2) {
        this.warn('incomplete-shot', id);
        this.pending.delete(id);
      }
    }
    const c = this.ctx;
    c.clearRect(0, 0, 900, 1600);
    for (const [id, until] of this.freshCells)
      if (until.until < this.clock || !this.board.some((b) => b.id === id))
        this.freshCells.delete(id);
    let camera = { x: 0, y: 0 };
    if (this.showMarkers)
      for (const b of this.board) {
        if (b.kind) {
          const q = this.mapPoint(b);
          if (b.kind === 'target') {
            const ready = this.snapshot?.stage?.collected === 2;
            this.ring(q, 35, 0.9, ready ? 4 : 2, '#fff2a0');
            if (ready)
              this.ring(
                q,
                42,
                this.reduced ? 0.45 : 0.45 + Math.sin(this.clock * 3) * 0.12,
                2,
                '#ffcf55',
              );
            drawStar(c, q.x, q.y, 19);
          } else if (b.kind === 'bomb') {
            this.ring(q, 35, 0.9, 2, '#ffb576');
            this.text('✹', q.x, q.y + 12, 35);
          }
        }
      }
    for (const g of this.groups) {
      g.age += Math.max(0, Math.min(0.1, dt));
      if (g.type === 'shot') {
        c.save();
        c.beginPath();
        c.rect(18, 119, 864, 970);
        c.clip();
        for (const b of this.board)
          if (this.freshCells.has(b.id) && g.at <= this.freshCells.get(b.id).at) {
            const q = this.mapPoint(b);
            c.beginPath();
            c.rect(0, 0, 900, 1600);
            c.moveTo(q.x + 51, q.y);
            c.arc(q.x, q.y, 51, 0, Math.PI * 2);
            c.clip('evenodd');
          }
        this.drawShot(g);
        c.restore();
        if (!this.reduced && g.triggers.length && g.age > 0.09 && g.age < 0.23) {
          const k = (1 - (g.age - 0.09) / 0.14) * 11;
          camera = { x: Math.sin(g.age * 110) * k, y: Math.cos(g.age * 90) * k * 0.55 };
        }
      } else this.drawBoard(g);
    }
    this.groups = this.groups.filter((g) => g.age < g.life);
    // Target narratives are serial; incoming authoritative boards remain interactive.
    const active = this.stages[0];
    if (active && !this.slotPriority) {
      active.age += Math.max(0, Math.min(0.1, dt));
      this.drawStage(active);
    }
    this.drawDispensed();
    this.drawHUD();
    this.rewardFlights.update(this.clock);
    this.rewardFlights.draw(c, this.clock, this.reduced, (...args) => this.text(...args));
    this.stages = this.stages.filter((s) => s.age < s.life);
    this.onCamera(camera);
  }
  orb(b, q, size = 80, alpha = 1) {
    const c = this.ctx;
    c.save();
    c.globalAlpha = alpha;
    if (this.atlas?.complete && this.atlas.naturalWidth) {
      const box = boxes[b.color % 5];
      c.drawImage(
        this.atlas,
        box[0],
        box[1],
        box[2] - box[0],
        box[3] - box[1],
        q.x - size / 2,
        q.y - size / 2,
        size,
        size,
      );
    } else {
      const gr = c.createRadialGradient(q.x - 12, q.y - 15, 2, q.x, q.y, size / 2);
      gr.addColorStop(0, '#e7ffff');
      gr.addColorStop(0.2, colors[b.color % 5]);
      gr.addColorStop(1, '#102d53');
      c.fillStyle = gr;
      c.beginPath();
      c.arc(q.x, q.y, size / 2, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }
  line(a, b, color, width = 3, alpha = 1) {
    const c = this.ctx;
    c.save();
    c.globalAlpha = clamp(alpha);
    c.strokeStyle = color;
    c.lineWidth = width;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(a.x, a.y);
    c.lineTo(b.x, b.y);
    c.stroke();
    c.restore();
  }
  ring(q, r, alpha = 1, width = 7, color = '#ffd17d') {
    if (r <= 0) return;
    const c = this.ctx;
    c.save();
    c.globalAlpha = clamp(alpha);
    c.strokeStyle = color;
    c.lineWidth = width;
    c.beginPath();
    c.arc(q.x, q.y, r, 0, Math.PI * 2);
    c.stroke();
    c.restore();
  }
  text(t, x, y, size = 26, color = '#ffe4a2') {
    const c = this.ctx;
    c.save();
    c.textAlign = 'center';
    c.font = `400 ${size}px ArcadeDisplay,"Microsoft YaHei",sans-serif`;
    while (c.measureText(t).width > 560 && size > 17)
      c.font = `400 ${--size}px ArcadeDisplay,sans-serif`;
    c.lineJoin = 'round';
    c.lineWidth = 3;
    c.strokeStyle = '#041526';
    c.strokeText(t, x, y + 2);
    c.shadowColor = '#0008';
    c.shadowBlur = 3;
    c.shadowOffsetY = 2;
    c.fillStyle = color;
    if (color === '#ffe4a2') {
      const g = c.createLinearGradient(0, y - size, 0, y + 2);
      g.addColorStop(0, '#fffdf1');
      g.addColorStop(0.45, '#ffe9b4');
      g.addColorStop(1, '#efac45');
      c.fillStyle = g;
    }
    c.fillText(t, x, y);
    c.restore();
  }
  panel(x, y, w, h) {
    const c = this.ctx;
    c.save();
    c.fillStyle = '#082741ed';
    c.strokeStyle = '#c3a66c';
    c.lineWidth = 2;
    c.beginPath();
    c.roundRect(x, y, w, h, 14);
    c.fill();
    c.stroke();
    c.restore();
  }
  occupied(b) {
    const q = this.mapPoint(b);
    return this.board.some(
      (n) => n.id !== b.id && Math.hypot(this.mapPoint(n).x - q.x, this.mapPoint(n).y - q.y) < 55,
    );
  }
  drawShot(g) {
    const a = g.age,
      r = this.reduced;
    // Snap ripple follows the authoritative attached cell, including non-clearing shots.
    const hit = g.result.attached;
    if (validPoint(hit) && a < 0.42 && !this.occupied(hit)) {
      const q = this.mapPoint(hit),
        k = clamp(a / 0.42),
        col = colors[hit.color % 5];
      this.ring(q, 37 + ease(k) * 33, (1 - k) * 0.95, r ? 3 : 6, '#eaffff');
      this.ring(q, 32 + ease(k) * 24, (1 - k) * 0.8, 3, col);
      if (!r) {
        const c = this.ctx;
        c.save();
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = (1 - k) * 0.5;
        const glow = c.createRadialGradient(q.x, q.y, 16, q.x, q.y, 62);
        glow.addColorStop(0, col);
        glow.addColorStop(1, 'transparent');
        c.fillStyle = glow;
        c.fillRect(q.x - 62, q.y - 62, 124, 124);
        c.restore();
        for (let j = 0; j < 6; j++) {
          const angle = (j * Math.PI) / 3,
            rad = 43 + ease(k) * 32,
            p = { x: q.x + Math.cos(angle) * rad, y: q.y + Math.sin(angle) * rad };
          this.line(
            { x: p.x - Math.cos(angle) * 9, y: p.y - Math.sin(angle) * 9 },
            p,
            '#edffff',
            3,
            1 - k,
          );
        }
      }
    }

    if (a >= 0.02 && g.triggers.length)
      this.cue('charge', g, 0.02, { intensity: g.triggers.length });
    if (a >= 0.09) {
      if (g.triggers.length || g.direct.length)
        this.cue(g.triggers.length ? 'explosion-impact' : 'match-clear', g, 0.09, {
          intensity: g.triggers.length,
        });
      else if (hit && !g.mechanismOwned) this.cue('attach', g, 0.09);
    }
    this.drawCelebration(g);
    // Ordinary matches never become a bomb even when the cleared count is large.
    for (const [i, b] of g.direct.entries()) {
      const q = this.mapPoint(b),
        t = a - 0.055 - Math.min(i * 0.012, 0.09);
      if (this.occupied(b)) continue;
      if (t < 0.18) {
        const fade = clamp(Math.max(0, t) / 0.18);
        this.orb(b, q, 80 * (1 - ease(fade) * 0.24), 1 - fade);
      }
      if (t >= 0.03 && t < 0.38) {
        const k = clamp((t - 0.03) / 0.35);
        this.ring(q, 36 + k * 22, (1 - k) * 0.7, r ? 2 : 4, colors[b.color % 5]);
        if (!r)
          for (let j = 0; j < 3; j++) {
            const ang = j * 2.094 + i * 0.73,
              dx = Math.cos(ang),
              dy = Math.sin(ang),
              dist = 32 + k * 52;
            this.line(
              { x: q.x + dx * (dist - 11), y: q.y + dy * (dist - 11) },
              { x: q.x + dx * dist, y: q.y + dy * dist },
              colors[b.color % 5],
              4,
              (1 - k) * 0.8,
            );
          }
      }
    }
    for (const [i, b] of g.triggers.entries()) {
      const q = this.mapPoint(b),
        t = a - 0.09 - i * 0.065;
      if (i < 4) blastLayers(this.ctx, q, t, { reduced: r, primary: i === 0 });
      if (t < 0 && t > -0.1) this.ring(q, 43 + Math.sin(-t * 30) * 3, 0.9, 8);
      if (t >= 0 && t < 0.43) {
        const k = t / 0.43;
        this.ring(q, 40 + ease(k) * 118, 1 - k, r ? 4 : 13);
        this.ring(q, 33 + ease(k) * 93, (1 - k) * 0.65, 4, '#b1f5ff');
        if (!r)
          for (let j = 0; j < 6; j++) {
            const ang = (j * Math.PI) / 3,
              dx = Math.cos(ang),
              dy = Math.sin(ang),
              dist = 52 + ease(k) * 106;
            this.line(
              { x: q.x + dx * (dist - 22), y: q.y + dy * (dist - 22) },
              { x: q.x + dx * dist, y: q.y + dy * dist },
              '#ffe1a0',
              7,
              1 - k,
            );
          }
      }
      if (i && t >= 0 && t < 0.18) {
        this.cue('explosion-chain', g, 0.09 + i * 0.065, { index: i });
        if (!r) this.line(this.mapPoint(g.triggers[i - 1]), q, '#ffcf78', 9, 1 - t / 0.18);
      }
    }
    if (g.dropped.length) {
      if (a >= g.dropAt)
        this.cue(g.dropped.length >= CONFIG.largeDrop ? 'drop-large' : 'drop-small', g, 0.22, {
          count: g.dropped.length,
        });
      // All detached cells keep a shared fall clock, communicating one unsupported group.
      const t = a - g.dropAt;
      if (t < 0)
        for (const b of g.dropped) {
          if (!this.occupied(b)) this.orb(b, this.mapPoint(b), 80);
        }
      if (t >= 0 && t < 0.43) {
        const qs = g.dropped.map((b) => this.mapPoint(b));
        if (t < 0.12 && !r) {
          const xs = qs.map((q) => q.x),
            ys = qs.map((q) => q.y);
          this.line(
            { x: Math.min(...xs) - 24, y: Math.min(...ys) - 48 },
            { x: Math.max(...xs) + 24, y: Math.min(...ys) - 48 },
            '#88e9fb',
            3,
            1 - t / 0.12,
          );
        }
        for (const b of g.dropped) {
          if (this.occupied(b)) continue;
          const q = this.mapPoint(b);
          this.orb(
            b,
            { x: q.x + (r ? 0 : Math.sin(t * 4) * 12), y: q.y + (r ? 0 : 110 * t + 520 * t * t) },
            80,
            1 - clamp(t / 0.43) ** 2,
          );
        }
      }
    }
    if (g.gain !== null && g.gain > 0 && a >= 1.05)
      this.cue('tickets-arrive', g, 1.05, { count: g.gain });
  }
  drawCelebration(g) {
    const t = g.age - 0.09;
    if (t < 0 || t > 1.25 || (!g.direct.length && !g.dropped.length && !g.triggers.length)) return;
    const bomb = g.triggers.length,
      hero = bomb || g.dropped.length >= 6,
      total = g.direct.length + g.dropped.length,
      c = this.ctx;
    const cells = bomb ? g.triggers : g.direct.length ? g.direct : g.dropped,
      qs = cells.map((b) => this.mapPoint(b)),
      center = {
        x: qs.reduce((n, q) => n + q.x, 0) / qs.length,
        y: qs.reduce((n, q) => n + q.y, 0) / qs.length,
      };
    c.save();
    c.beginPath();
    c.rect(18, 119, 864, 970);
    c.clip();
    const fade = Math.max(0, 1 - t / 1.25),
      impact = Math.sin(Math.PI * clamp(t / 0.45));
    if (!this.reduced) {
      const radius = hero ? 410 : 180;
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = impact * (hero ? 0.4 : 0.18);
      const glow = c.createRadialGradient(center.x, center.y, 5, center.x, center.y, radius);
      glow.addColorStop(0, '#fff3bc');
      glow.addColorStop(0.3, bomb ? '#ff9c42' : '#69dfff');
      glow.addColorStop(1, 'transparent');
      c.fillStyle = glow;
      c.fillRect(center.x - radius, center.y - radius, radius * 2, radius * 2);
      c.restore();
    }
    if (t < 0.6) {
      const k = ease(t / 0.6);
      this.ring(
        center,
        35 + k * (hero ? 390 : 125),
        (1 - t / 0.6) * 0.95,
        this.reduced ? 3 : hero ? 18 : 5,
        bomb ? '#ffcd7d' : '#9df4ff',
      );
    }
    if (!this.reduced) {
      // Stable deterministic trajectories prevent frame-to-frame random flicker.
      const n = Math.min(hero ? 84 : 28, 12 + total * 5 + bomb * 20),
        speed = hero ? 440 : 170;
      for (let i = 0; i < n; i++) {
        const a = i * 2.39996,
          base = qs[i % qs.length],
          v = speed * (0.45 + (i % 7) / 10),
          p = { x: base.x + Math.cos(a) * v * t, y: base.y + Math.sin(a) * v * t + 145 * t * t },
          col = ['#ffe6a5', '#a4f4ff', '#ffad61'][i % 3],
          tail = { x: p.x - Math.cos(a) * 12, y: p.y - Math.sin(a) * 12 };
        this.line(tail, p, col, 2 + (i % 3), fade);
        if (i % 5 === 0) {
          this.line({ x: p.x - 5, y: p.y }, { x: p.x + 5, y: p.y }, '#fff8db', 2, fade);
          this.line({ x: p.x, y: p.y - 5 }, { x: p.x, y: p.y + 5 }, '#fff8db', 2, fade);
        }
      }
      if (hero) {
        for (let i = 0; i < 48; i++) {
          const age = t - (i % 5) * 0.025;
          if (age < 0) continue;
          const x = 44 + (i % 24) * 35 + Math.sin(age * 2 + i) * 16,
            y = 140 + age * 320 + (i % 6) * 130,
            alpha = Math.sin(Math.PI * clamp(age / 1.16)) * 0.85;
          this.line({ x, y: y - 24 }, { x, y }, i % 2 ? '#ffe9b3' : '#9befff', 4, alpha);
          if (i % 3 === 0) {
            c.save();
            c.globalAlpha = alpha;
            c.translate(x, y);
            c.rotate(age * 2 + i);
            c.fillStyle = '#ffe3a0';
            c.beginPath();
            c.moveTo(0, -8);
            c.lineTo(5, 0);
            c.lineTo(0, 8);
            c.lineTo(-5, 0);
            c.closePath();
            c.fill();
            c.restore();
          }
        }
      }
      if (hero && t < 0.48) {
        for (let i = 0; i < Math.min(12, qs.length); i++) {
          const from = center,
            to = qs[i],
            scale = 1 + t * 2.3,
            dx = (to.x - from.x) * scale,
            dy = (to.y - from.y) * scale,
            len = Math.hypot(dx, dy) || 1;
          let prev = from;
          for (let j = 1; j <= 7; j++) {
            const f = j / 7,
              bend = Math.sin(j * 2.3 + i) * 16 * (1 - f),
              next = {
                x: from.x + dx * f - (dy / len) * bend,
                y: from.y + dy * f + (dx / len) * bend,
              };
            this.line(prev, next, '#ffb956', 8, (1 - t / 0.48) * 0.5);
            this.line(prev, next, '#fff5c9', 2.5, 1 - t / 0.48);
            prev = next;
          }
        }
      }
    }
    c.restore();
  }
  drawBoard(g) {
    const t = g.age,
      r = this.reduced;
    if (g.type === 'boardRefilled') {
      if (t < 0.25) return;
      const k = clamp((t - 0.25) / 1.15),
        alpha = Math.sin(Math.PI * k) * 0.42;
      for (const [i, b] of g.cells.entries()) {
        const live = this.board.find((n) => n.id === b.id);
        if (!live) continue;
        const q = this.mapPoint(live),
          color = colors[b.color % 5];
        // One smooth, non-oscillating envelope: no bright rings on top of other new rings.
        const c = this.ctx;
        c.save();
        c.globalAlpha = alpha;
        c.globalCompositeOperation = 'lighter';
        const gl = c.createRadialGradient(q.x, q.y, 30, q.x, q.y, 55);
        gl.addColorStop(0, color);
        gl.addColorStop(1, 'transparent');
        c.fillStyle = gl;
        c.fillRect(q.x - 55, q.y - 55, 110, 110);
        c.restore();
        if (!r && i < 8) {
          const x = q.x - 27 + 54 * k,
            y = q.y - 24;
          this.line({ x: x - 4, y }, { x: x + 4, y }, '#f6ffff', 2, alpha);
          this.line({ x, y: y - 4 }, { x, y: y + 4 }, '#f6ffff', 2, alpha);
        }
      }
      return;
    }
    if (t > 0.63) return;
    for (const b of g.cells) {
      const q = b.q;
      if (!q) continue;
      if (g.type === 'boardMaintained') {
        if (this.occupied(b)) continue;
        this.ring(q, 36 + t * 12, (1 - t / 0.63) * 0.5, 2, '#a5bed4');
      } else {
        this.ring(q, 46 + Math.sin(t * 9) * 4, (1 - t / 0.63) * 0.8, 4, '#ffda86');
        if (!r && t < 0.4 && b.from) {
          const k = ease(t / 0.4),
            p = { x: b.from.x + (q.x - b.from.x) * k, y: b.from.y + (q.y - b.from.y) * k };
          this.line(b.from, p, '#ffda86', 3, (1 - k) * 0.6);
        }
      }
    }
  }
  drawStage(s) {
    const t = s.age;
    if (t < 0) return;
    for (const f of s.flights) {
      const a = t - f.delay,
        k = clamp(a / CONFIG.targetFlight),
        to = starSlot(f.slot);
      if (a >= CONFIG.targetFlight)
        this.cue('target-slot', s, f.delay + CONFIG.targetFlight, {
          slot: f.slot,
          stageId: s.stageId,
        });
      if (a < 0 || k >= 1 || !f.from) continue;
      const e = this.reduced ? 1 : ease(k),
        q = {
          x: f.from.x + (to.x - f.from.x) * e,
          y: f.from.y + (to.y - f.from.y) * e - (this.reduced ? 0 : 80 * Math.sin(k * Math.PI)),
        };
      drawStar(this.ctx, q.x, q.y, 22);
    }
    const arrived = s.flights.every((f) => t >= f.delay + CONFIG.targetFlight),
      reveal = Math.max(0.84, ...s.flights.map((f) => f.delay + CONFIG.targetFlight + 0.12));
    if (s.bonus !== null && arrived && t >= reveal) {
      if (
        !this.snapshot?.dispenserFault &&
        !this.snapshot?.tickets?.uncertain &&
        !this.snapshot?.uiPaused &&
        !this.externalNotice
      ) {
        drawPrizeBurst(this.ctx, {
          title: `宝箱 +${s.bonus} 张！`,
          detail: '三星集齐 · 宝箱开启',
          age: t - reveal,
          life: s.life - reveal,
          reduced: this.reduced,
          y: 1030,
          size: 66,
        });
        const refill = this.currentRefill();
        if (refill) {
          this.text(refill.text, 450, 1207, 22, '#bdeaff');
          if (refill.visibleAt === null) refill.visibleAt = this.clock;
        }
      }
      this.cue('stage-reveal', s, reveal, { count: s.bonus, stageId: s.stageId });
      this.rewardFlights.add(
        `stage-${s.stageId}`,
        s.bonus,
        [{ x: 755, y: 1428 }],
        this.clock + 0.1,
      );
      if (t >= reveal + 0.75)
        this.cue('stage-tickets-arrive', s, reveal + 0.75, { count: s.bonus, stageId: s.stageId });
    }
  }
  drawDispensed() {
    const c = this.ctx;
    this.receiptPapers = this.receiptPapers.filter((p) => this.clock - p.at < 1.6);
    const latest = this.receiptPapers.at(-1),
      fault = this.snapshot?.dispenserFault || this.snapshot?.tickets?.uncertain > 0;
    const age = latest ? this.clock - latest.at : Infinity;
    this.confirmedPaper = !!latest;
    if (fault) this.text('出票待检查', 662, 115, 17, '#ffbfa0');
    else if (age < 1.2) this.text('出票中', 662, 115, 17, '#98ffdb');
  }
  currentRefill() {
    const n = this.refillNotice;
    return n?.text.startsWith('泡泡补充') &&
      this.clock - n.at < 6 &&
      (n.visibleAt === null || this.clock - n.visibleAt < 1.8)
      ? n
      : null;
  }
  drawHUD() {
    const s = this.stages[0];
    let id = this.snapshot?.stage?.id ?? this.stage?.id,
      award = this.snapshot?.stage?.award,
      progress = this.snapshot?.stage?.collected ?? this.stage?.collected ?? 0;
    if (s && s.age < s.life) {
      id = s.stageId;
      award = s.award;
      progress = s.before + s.flights.filter((f) => s.age >= f.delay + CONFIG.targetFlight).length;
    }
    const reveal = s
      ? Math.max(0.84, ...s.flights.map((f) => f.delay + CONFIG.targetFlight + 0.12))
      : 0;
    const open = s?.bonus !== null && s ? ease((s.age - reveal) / 0.32) : 0;
    if (open > 0 && !this.reduced)
      for (let i = 0; i < 11; i++) {
        const a = -Math.PI + (i * Math.PI) / 10;
        this.line(
          { x: 755 + Math.cos(a) * 42, y: 1460 + Math.sin(a) * 42 },
          { x: 755 + Math.cos(a) * (95 + open * 100), y: 1460 + Math.sin(a) * (95 + open * 100) },
          '#ffe5a0',
          4,
          clamp((s.life - s.age) / 0.35) * 0.7,
        );
      }
    drawChest(this.ctx, { progress, open, time: this.clock, reduced: this.reduced });
    this.text(`宝箱 +${award ?? '—'}票`, 755, 1370, 27);
    this.text(
      `★ ${progress}/3 · ${open > 0 ? '已开启' : '还差' + (3 - progress) + '颗星'}`,
      755,
      1401,
      21,
      '#d8f2ff',
    );
    this.treasure = { stageId: id, award, progress, open };
    const n = this.currentRefill() ?? this.notices.at(-1);
    const noticeReady =
      n && this.clock - n.at < 6 && (n.visibleAt === null || this.clock - n.visibleAt < 1.8);
    const reward = [...this.groups]
      .reverse()
      .find((g) => g.type === 'shot' && g.gain > 0 && g.age >= 0.33 && g.age < 1.4);
    this.refillHint = noticeReady && n.text.startsWith('泡泡补充') ? n.text : null;
    this.bannerKind =
      this.snapshot?.dispenserFault || this.snapshot?.tickets?.uncertain > 0
        ? 'fault'
        : this.snapshot?.uiPaused
          ? 'paused'
          : s?.bonus !== null && s
            ? 'stage'
            : this.snapshot?.paidAmmo === 0 && this.snapshot?.projectile?.mode !== 'paid'
              ? 'free'
              : noticeReady
                ? 'notice'
                : reward
                  ? 'reward'
                  : null;
    if (this.bannerKind === 'free' && this.refillHint && n.visibleAt === null)
      n.visibleAt = this.clock;
    if (this.externalNotice && !['fault', 'paused'].includes(this.bannerKind)) {
      this.bannerKind = 'reward-voice';
      return;
    }
    if (this.bannerKind === 'reward') {
      this.panel(140, 1110, 620, 80);
      this.text(`本发获票 +${reward.gain} 张`, 450, 1162, 32);
    } else if (this.bannerKind === 'notice') {
      if (n.visibleAt === null) n.visibleAt = this.clock;
      this.panel(140, 1110, 620, reward ? 106 : 80);
      this.text(n.text, 450, reward ? 1146 : 1162, 30, '#bdeaff');
      if (reward) this.text(`本发获票 +${reward.gain} 张`, 450, 1190, 29);
    }
  }
  stats() {
    return {
      ...this.counters,
      treasure: this.treasure,
      rewardFlights: this.rewardFlights.stats(),
      confirmedPaper: this.confirmedPaper,
      bannerKind: this.bannerKind,
      refillHint: this.refillHint,
      freshCells: this.freshCells.size,
      groups: this.groups.length,
      stages: this.stages.length,
      pending: this.pending.size,
      cachedCells: this.cache.size,
      seen: this.seen.size,
      sessionEarned: this.sessionEarned,
      records: structuredClone(this.records),
      diagnostics: structuredClone(this.diagnostics),
      disposed: this.disposed,
    };
  }
  dispose() {
    if (this.disposed) return;
    this.clear();
    this.seen.clear();
    this.cache.clear();
    this.snapshot = null;
    this.board = [];
    this.records = [];
    this.atlas = null;
    this.disposed = true;
  }
}
