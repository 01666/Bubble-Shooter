import { LINES, ACTIONS } from './lines.mjs';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const neutral = () => ({
  head: 0,
  look: 0,
  nod: 0,
  breath: 0,
  left: 0,
  right: 0,
  wing: 0,
  tail: 0,
  eyes: 1,
  mouth: 0,
  hop: 0,
  step: 0,
});
export class PetFeedback {
  constructor({ onSpeech = () => {}, reducedMotion = false } = {}) {
    this.time = 0;
    this.active = null;
    this.pose = neutral();
    this.seen = new Set();
    this.floor = 0;
    this.ready = false;
    this.dead = false;
    this.cool = new Map();
    this.lineCool = new Map();
    this.onSpeech = onSpeech;
    this.reducedMotion = reducedMotion;
    this.snapshot = {};
    this.bubble = null;
    this.lastFault = false;
    this.generation = 0;
  }
  // Must run before consume. Seeds a persisted event cursor; never synthesizes rewards.
  prime(snapshot, { eventSequence = 0 } = {}) {
    this.floor = eventSequence;
    this.snapshot = snapshot ?? {};
    this.ready = true;
    this.lastFault = this.hasFault(this.snapshot);
  }
  hasFault(s) {
    return !!(
      s.storageFault ||
      s.tickets?.uncertain > 0 ||
      s.dispenserFault ||
      s.dispenserState === 'uncertain'
    );
  }
  request(mode, lineKey = mode) {
    const a = ACTIONS[mode];
    if (!a || this.time < (this.cool.get(mode) ?? -1)) return false;
    if (this.active && a.priority <= ACTIONS[this.active.mode].priority) return false;
    const old = this.active;
    this.generation++;
    if (old?.speech && !old.speechEnded)
      this.onSpeech({ phase: 'cancel', token: old.token, id: old.speech.id });
    const speech = LINES[lineKey];
    this.active = {
      mode,
      start: this.time,
      token: `pet-${this.generation}`,
      speech: speech && this.time >= (this.lineCool.get(speech.id) ?? -1) ? speech : null,
      spoken: false,
      speechEnded: false,
    };
    this.bubble = null;
    this.cool.set(mode, this.time + a.cooldown);
    return true;
  }
  consume(events, snapshot) {
    if (this.dead) return;
    if (!this.ready) throw Error('Call prime(snapshot, {eventSequence}) before consume');
    this.snapshot = snapshot ?? this.snapshot;
    const candidates = [];
    for (const e of events ?? []) {
      if (!e.eventId) continue;
      const seq = Number(/^event-(\d+)$/.exec(e.eventId)?.[1]);
      if (this.seen.has(e.eventId) || (seq && seq <= this.floor)) continue;
      this.seen.add(e.eventId);
      if (this.seen.size > 2048) this.seen.delete(this.seen.values().next().value);
      if (seq) this.floor = Math.max(this.floor, seq);
      const p = e.payload ?? {};
      if (e.type === 'coinCredited') candidates.push(['welcome']);
      if (e.type === 'dispenseConfirmed' && p.delta > 0) candidates.push(['ticket']);
      if (e.type === 'shotAccepted') candidates.push([p.mode === 'free' ? 'free' : 'fire']);
      if (e.type === 'paidShotResolved') {
        if ((p.dropped?.length ?? 0) >= 6) candidates.push(['drop']);
        else if (p.direct?.length) candidates.push(['clear']);
      }
      if (e.type === 'explosionResolved' && p.triggers?.length) candidates.push(['blast']);
      // Target/opening reactions are driven by the committed EffectsUI arrival cues.
      if (e.type === 'boardRefilled') candidates.push(['refill']);
      if (e.type === 'boardMaintained') candidates.push(['tidy']);
      if (e.type === 'dispenseUncertain') candidates.push(['fault']);
    }
    const fault = this.hasFault(this.snapshot);
    if (fault && !this.lastFault) candidates.push(['fault']);
    this.lastFault = fault;
    // A transaction's blast/target/stage events outrank its later resolve/refill.
    candidates.sort((a, b) => ACTIONS[b[0]].priority - ACTIONS[a[0]].priority);
    for (const [mode, line] of candidates) if (this.request(mode, line)) break;
  }
  update(dt, snapshot = this.snapshot) {
    if (this.dead) return null;
    this.snapshot = snapshot;
    this.time += clamp(Number(dt) || 0, 0, 0.1);
    let a = this.active;
    const age = a ? this.time - a.start : 0;
    if (a && age > ACTIONS[a.mode].duration) {
      if (a.speech && a.spoken && !a.speechEnded)
        this.onSpeech({ phase: 'end', token: a.token, id: a.speech.id });
      this.active = null;
      this.bubble = null;
      a = null;
    }
    const p = neutral(),
      t = this.time,
      mode = a?.mode ?? 'idle';
    p.look = clamp((snapshot?.angle ?? 0) * 0.35, -0.3, 0.3);
    p.breath = Math.sin(t * 2) * 2;
    p.tail = Math.sin(t * 1.8) * 0.14;
    p.wing = Math.sin(t * 2.1) * 0.07;
    if (snapshot?.projectile) {
      p.look = clamp(snapshot.projectile.x * 0.1, -0.35, 0.35);
      p.head = -0.1;
    }
    p.eyes = t % 4.7 < 0.12 ? 0.08 : 1;
    if (mode === 'idle' && snapshot?.stage?.collected === 2 && !this.hasFault(snapshot)) {
      p.right = -0.55;
      p.left = 0.35;
      p.head = -0.06;
      p.look = 0.18;
      p.wing = Math.sin(t * 3) * 0.045;
    }
    const envelope = a ? Math.sin(Math.PI * clamp(age / ACTIONS[mode].duration, 0, 1)) : 0;
    if (mode === 'fire') {
      p.look += 0.2 * envelope;
      p.head = -0.15 * envelope;
      p.right = -0.65 * envelope;
      p.nod = 4 * envelope;
      p.eyes = 1;
    }
    if (mode === 'welcome') {
      p.right = -1.4 * envelope + Math.sin(age * 13) * 0.35 * envelope;
      p.left = 0.45 * envelope;
      p.head = -0.08 * envelope;
      p.mouth = 0.5 * envelope;
    }
    if (mode === 'ticket') {
      p.look = 0.45 * envelope;
      p.right = -1.2 * envelope;
      p.head = -0.1 * envelope;
      p.nod = Math.sin(age * 8) * 4 * envelope;
    }
    if (mode === 'clear') {
      p.nod = Math.sin(age * 7) * 5 * envelope;
      p.right = -0.8 * envelope;
      p.mouth = 0.4 * envelope;
    }
    if (mode === 'blast') {
      const shock = age < 0.45 ? Math.sin((age / 0.45) * Math.PI) : 0;
      p.nod = shock * 5;
      p.head = -shock * 0.1;
      p.eyes = shock > 0.5 ? 0.45 : 1;
      p.right = -0.85 * envelope;
      p.left = 0.45 * envelope;
      p.wing = 0.16 * envelope;
    }
    if (mode === 'drop') {
      p.right = -2.15 * envelope;
      p.left = 1.9 * envelope;
      p.nod = -3 * envelope;
      p.wing = 0.2 * envelope;
      p.mouth = 0.8 * envelope;
      p.hop = Math.max(0, Math.sin(age * 9)) * 10 * envelope;
    }
    if (mode === 'target') {
      p.step = 22 * envelope;
      p.right = -1.6 * envelope;
      p.left = 0.7 * envelope;
      p.look = 0.22 * envelope;
      p.head = -0.08 * envelope;
    }
    if (mode === 'complete') {
      const lift = clamp(age / 0.35, 0, 1) * (1 - clamp((age - 1.3) / 1.5, 0, 1));
      p.look = 0.22 * lift;
      p.step = 18 * lift;
      p.right = -2.5 * lift;
      p.left = 2.2 * lift;
      p.nod = -4 * envelope;
      p.wing = Math.sin(age * 10) * 0.16 * envelope;
      p.mouth = 0.8 * envelope;
      p.hop = Math.max(0, Math.sin(age * 10)) * 20 * envelope;
    }
    if (mode === 'free') {
      p.right = -0.55 * envelope + Math.sin(age * 8) * 0.2 * envelope;
      p.look = -0.12 * envelope;
    }
    if (mode === 'refill') {
      p.right = -0.65 * envelope;
      p.look = 0.15 * envelope;
    }
    if (mode === 'tidy') {
      p.right = -0.4 * envelope;
      p.left = 0.3 * envelope;
      p.nod = 2 * envelope;
    }
    if (mode === 'fault') {
      p.right = -0.3 * envelope;
      p.head = 0.06 * envelope;
      p.eyes = 0.85;
      p.mouth = 0.15;
    }
    if (a?.speech && age >= a.speech.start && age <= a.speech.end) {
      this.bubble = { ...a.speech, token: a.token };
      p.mouth = 0.35 + 0.22 * Math.sin(age * 17);
      if (!a.spoken) {
        a.spoken = true;
        this.lineCool.set(a.speech.id, this.time + a.speech.cooldown);
        this.onSpeech({
          phase: 'start',
          token: a.token,
          ...a.speech,
          remaining: a.speech.end - age,
        });
      }
    } else if (a?.spoken && this.bubble) {
      this.bubble = null;
      a.speechEnded = true;
      this.onSpeech({ phase: 'end', token: a.token, id: a.speech.id });
    }
    const k = 1 - Math.exp(-Math.min(0.1, dt) * 12);
    for (const key of Object.keys(p)) {
      if (
        this.reducedMotion &&
        ['head', 'nod', 'wing', 'tail', 'breath', 'hop', 'step'].includes(key)
      )
        p[key] = 0;
      this.pose[key] += (p[key] - this.pose[key]) * k;
    }
    return {
      mode,
      pose: { ...this.pose },
      bubble: this.bubble,
      status: {
        paidAmmo: snapshot?.paidAmmo ?? 0,
        pending: snapshot?.tickets?.pending ?? 0,
        fault: this.hasFault(snapshot),
      },
    };
  }
  dispose() {
    if (this.dead) return;
    if (this.active?.speech && !this.active.speechEnded)
      this.onSpeech({ phase: 'cancel', token: this.active.token, id: this.active.speech.id });
    this.dead = true;
    this.active = null;
    this.bubble = null;
    this.seen.clear();
  }
}
