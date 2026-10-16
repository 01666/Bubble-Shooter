import { drawCombo } from './combo.mjs';
import { drawMachine } from './machine.mjs';
import { drawEffects } from './effects.mjs';
import { petLeverPoint } from './layout.mjs';
import { clamp } from './art.mjs';
// Committed result presentation only: this module never chooses rewards or changes ammo.
export class PetSlotFeedback {
  constructor({ audio, room, mapPoint = (b) => b } = {}) {
    this.audio = audio;
    this.room = room;
    this.mapPoint = mapPoint;
    this.time = 0;
    this.seen = new Set();
    this.started = new Set();
    this.resolved = new Set();
    this.spin = null;
    this.result = null;
    this.effects = [];
    this.comboFlash = 0;
    this.chainNotice = null;
    this.snapshot = {};
    this.reduced = false;
    this.priorityBusy = false;
    this.quality = 'medium';
    this.dead = false;
    this.cues = [];
    this.played = 0;
    this.suppressCombo = false;
  }
  restore(snapshot = {}) {
    this.snapshot = snapshot;
    this.spin = null;
    this.result = null;
    this.effects = [];
    this.cues = [];
    this.seen.clear();
    this.started.clear();
    this.resolved.clear();
    this.comboFlash = 0;
    this.chainNotice = null;
    const p = snapshot.petSlots;
    if (p?.state === 'spinning' && p.pending) {
      const duration = p.pending.duration ?? p.duration ?? 2.6;
      this.spin = {
        ...p.pending,
        spinId: p.spinId ?? p.pending.spinId,
        duration,
        elapsed: clamp(duration - (p.remaining ?? duration), 0, duration),
        restored: true,
      };
      this.started.add(this.spin.spinId);
    }
    if (p?.lastResult?.spinId) this.resolved.add(p.lastResult.spinId);
  }
  cue(name, options = {}) {
    if (this.dead) return;
    this.audio?.playCue?.(name, options);
    this.played++;
  }
  consume(batch = [], snapshot = this.snapshot) {
    if (this.dead) return;
    this.snapshot = snapshot;
    for (const e of batch) {
      const p = e.payload ?? e;
      const id =
        e.eventId ?? `${e.type}:${p.spinId ?? p.shotId ?? ''}:${p.after ?? p.streak ?? ''}`;
      if (this.seen.has(id)) continue;
      this.seen.add(id);
      if (this.seen.size > 2048) this.seen.delete(this.seen.values().next().value);
      if (e.type === 'petChainEnded') {
        this.chainNotice = {
          text: p.reason === 'timeout' ? '时间到 · 连消重来' : '未消除 · 连消重来',
          age: 0,
        };
      } else if (e.type === 'comboChanged') {
        if (p.streak >= 2 && !p.ended) {
          this.comboFlash = 0.65;
          if (p.tier > (p.previousTier ?? 0)) {
            this.cue('target_' + Math.min(3, Math.max(1, p.tier)), {
              gain: 0.6,
              rate: 1 + 0.08 * p.tier,
            });
          }
        }
      } else if (e.type === 'petChargeChanged') {
        if (p.after > p.before) this.cue('target_1', { gain: 0.34, rate: 1 + p.after * 0.1 });
      } else if (e.type === 'petSlotStarted' && !this.started.has(p.spinId)) {
        this.started.add(p.spinId);
        this.spin = { ...p, duration: p.duration ?? 2.6, elapsed: 0, restored: false };
        this.cue('stage_complete', { gain: 0.65, rate: 1.2 });
        this.cues = [0.3, 0.53, 0.73, 0.9, 1.05, 1.2, 1.4, 1.65, 1.88, 2.13, 2.38]
          .filter((at) => at < this.spin.duration)
          .map((at, i) => ({ at, rate: 0.95 + (i % 3) * 0.06 }));
      } else if (e.type === 'petSlotResolved' && !this.resolved.has(p.spinId)) {
        this.resolved.add(p.spinId);
        this.spin = null;
        this.cues = [];
        this.result = { ...p, age: 0, life: 1.65 };
        this.cue(
          p.rewardType === 'lightning'
            ? 'chain'
            : p.rewardType === 'fullClear'
              ? 'explosion'
              : 'stage_reward',
          { gain: 0.8, rate: p.rewardType === 'ammo' ? 1.13 : 1 },
        );
        this.room?.consume?.(
          [
            {
              eventId: `pet-slot-room-${p.spinId}`,
              type:
                p.rewardType === 'lightning'
                  ? 'networkActivated'
                  : p.rewardType === 'specials'
                    ? 'explosionResolved'
                    : 'stageBonusEarned',
              payload: {},
            },
          ],
          snapshot,
        );
        const point = (b) => {
          try {
            const v = this.mapPoint(b);
            return Number.isFinite(v?.x) && Number.isFinite(v?.y) ? { ...v, id: b.id } : null;
          } catch {
            return null;
          }
        };
        const paths = (p.electricPaths ?? [])
          .map((path) => {
            const balls = Array.isArray(path)
              ? path
              : (path.points ?? path.balls ?? [path.from, path.to]);
            return balls.filter(Boolean).map(point).filter(Boolean);
          })
          .filter((path) => path.length >= 2);
        this.effects.push({
          type: p.rewardType,
          age: 0,
          life: p.rewardType === 'fullClear' ? 1.6 : 1.35,
          removed: (p.removed ?? []).map(point).filter(Boolean),
          added: (p.added ?? []).map(point).filter(Boolean),
          paths,
        });
        if (this.effects.length > 4) this.effects.shift();
      }
    }
    if (this.started.size > 256) this.started.delete(this.started.values().next().value);
    if (this.resolved.size > 256) this.resolved.delete(this.resolved.values().next().value);
  }
  update(
    dt,
    snapshot = this.snapshot,
    { paused = false, reduced = false, quality = 'medium', priorityBusy = false } = {},
  ) {
    this.snapshot = snapshot;
    this.reduced = reduced;
    this.quality = quality;
    this.priorityBusy = priorityBusy;
    if (this.dead || paused) return;
    dt = clamp(dt, 0, 0.1);
    this.time += dt;
    this.comboFlash = Math.max(0, this.comboFlash - dt);
    if (this.chainNotice) {
      this.chainNotice.age += dt;
      if (this.chainNotice.age > 1.6) this.chainNotice = null;
    }
    if (this.spin) {
      this.spin.elapsed = Math.min(this.spin.duration, this.spin.elapsed + dt);
      // The persisted authoritative countdown wins; no browser timer can award or reveal a result.
      if (snapshot.petSlots?.state === 'spinning' && Number.isFinite(snapshot.petSlots.remaining))
        this.spin.elapsed = clamp(
          this.spin.duration - snapshot.petSlots.remaining,
          0,
          this.spin.duration,
        );
      for (const cue of this.cues)
        if (!cue.played && this.spin.elapsed >= cue.at) {
          cue.played = true;
          if (!this.spin.restored) this.cue('bounce', { gain: 0.25, rate: cue.rate });
        }
    }
    if (this.result) {
      this.result.age += dt;
      if (this.result.age >= this.result.life) this.result = null;
    }
    for (const effect of this.effects) effect.age += dt;
    this.effects = this.effects.filter((e) => e.age < e.life);
  }
  get active() {
    return !!(this.spin || this.result);
  }
  get busy() {
    return this.active;
  }
  draw(c, snapshot = this.snapshot) {
    if (this.dead) return;
    c.save();
    this.drawEffects(c);
    if (snapshot.petSlots?.mode !== 'legacy') this.drawMachine(c);
    if (!this.priorityBusy) {
      if (!this.active && !this.suppressCombo) this.drawCombo(c, snapshot);
    }
    c.restore();
  }
  drawCombo(...args) {
    return drawCombo.apply(this, args);
  }
  drawMachine(...args) {
    return drawMachine.apply(this, args);
  }
  drawEffects(...args) {
    return drawEffects.apply(this, args);
  }
  petPose(pose = {}, pet) {
    if (this.dead || pet?.controller?.active?.mode === 'fault') return pose;
    const handle = petLeverPoint(this.spin?.elapsed ?? 0, this.reduced);
    return {
      ...pose,
      handleTarget: handle,
      look: 0.25,
      head: 0.07,
      right: this.spin ? 0.7 : 0.1,
      hop: this.spin ? 0 : (pose.hop ?? 0),
      step: 0,
      mouth: this.result ? 0.55 : (pose.mouth ?? 0.12),
    };
  }
  stats() {
    return {
      active: this.active,
      spinning: !!this.spin,
      revealing: !!this.result,
      spinId: this.spin?.spinId ?? this.result?.spinId ?? null,
      elapsed: this.spin?.elapsed ?? 0,
      effects: this.effects.length,
      cues: this.played,
      reduced: this.reduced,
      seen: this.seen.size,
    };
  }
  dispose() {
    this.dead = true;
    this.spin = null;
    this.result = null;
    this.effects = [];
    this.cues = [];
  }
}
