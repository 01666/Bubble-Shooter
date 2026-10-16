import { MIX, CUES, VOICE_LINES, mapEvent } from './cues.mjs';
import { createScoreTick, createAmmoBonus } from './score-tick.mjs';
export { MIX, CUES, VOICE_LINES, mapEvent };
export class ArcadeAudio {
  constructor({
    baseUrl = new URL('../../../assets/audio/', import.meta.url).href,
    autoVoice = true,
    onVoice = () => {},
    bindLifecycle = true,
  } = {}) {
    this.baseUrl = baseUrl;
    this.autoVoice = autoVoice;
    this.onVoice = onVoice;
    this.context = null;
    this.buffers = new Map();
    this.loading = null;
    this.music = null;
    this.layers = [];
    this.active = new Set();
    this.seen = new Set();
    this.lastCue = new Map();
    this.lastVoice = new Map();
    this.timers = new Set();
    this.history = [];
    this.errors = [];
    this.enabled = true;
    this.paused = false;
    this.focused = true;
    this.free = true;
    this.progress = 0;
    this.volumes = { master: MIX.master, bgm: MIX.bgm, sfx: MIX.sfx, voice: MIX.voice };
    this.duckUntil = 0;
    this.lastSpoken = -Infinity;
    this.disposed = false;
    this.finishing = false;
    this.voiceSource = null;
    if (bindLifecycle && globalThis.document) {
      this.blur = () => this.setFocused(false);
      this.focus = () => this.setFocused(!document.hidden);
      this.visibility = () => this.setFocused(!document.hidden);
      globalThis.addEventListener('blur', this.blur);
      globalThis.addEventListener('focus', this.focus);
      document.addEventListener('visibilitychange', this.visibility);
    }
  }
  async unlock() {
    if (this.disposed) return false;
    const C = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!C) {
      this.errors = ['Web Audio unavailable'];
      return false;
    }
    if (!this.context) {
      const c = (this.context = new C());
      this.master = c.createGain();
      this.bgm = c.createGain();
      this.sfx = c.createGain();
      this.voice = c.createGain();
      this.baseGain = c.createGain();
      this.driveGain = c.createGain();
      this.goalGain = c.createGain();
      this.limiter = c.createDynamicsCompressor();
      Object.assign(this.limiter.threshold, { value: -8 });
      this.limiter.knee.value = 5;
      this.limiter.ratio.value = 12;
      this.limiter.attack.value = 0.002;
      this.limiter.release.value = 0.14;
      this.baseGain.connect(this.bgm);
      this.driveGain.connect(this.bgm);
      this.goalGain.connect(this.bgm);
      this.bgm.connect(this.master);
      this.sfx.connect(this.master);
      this.voice.connect(this.master);
      this.master.connect(this.limiter);
      this.ceiling = c.createWaveShaper();
      this.ceiling.curve = Float32Array.from(
        { length: 4097 },
        (_, i) => (0.92 * Math.tanh((i / 2048 - 1) * 1.2)) / Math.tanh(1.2),
      );
      this.limiter.connect(this.ceiling);
      this.ceiling.connect(c.destination);
      this.applyMix();
      this.loading = this.load();
    }
    try {
      if (!this.paused && this.focused) await this.context.resume();
      await this.loading;
      if (this.disposed) return false;
      this.startMusic();
      return this.errors.length === 0;
    } catch (e) {
      this.errors.push('unlock: ' + e.message);
      return false;
    }
  }
  async load() {
    await Promise.all(
      [
        'bgm_base',
        'bgm_drive',
        'bgm_goal',
        ...Object.keys(CUES),
        ...Object.keys(VOICE_LINES).map((id) => 'voice-' + id),
      ].map(async (name) => {
        try {
          if (name === 'ammo_bonus') {
            this.buffers.set(name, createAmmoBonus(this.context));
            return;
          }
          if (name === 'score_tick') {
            this.buffers.set(name, createScoreTick(this.context));
            return;
          }
          const r = await fetch(new URL(name + '.wav', this.baseUrl));
          if (!r.ok) throw Error('HTTP ' + r.status);
          const b = await this.context.decodeAudioData(await r.arrayBuffer());
          if (!this.disposed) this.buffers.set(name, b);
        } catch (e) {
          this.errors.push(name + ': ' + e.message);
        }
      }),
    );
  }
  startMusic() {
    if (
      this.disposed ||
      this.music ||
      !this.enabled ||
      this.paused ||
      !this.focused ||
      this.context?.state !== 'running' ||
      !this.buffers.has('bgm_base')
    )
      return;
    const c = this.context,
      at = c.currentTime + 0.04;
    for (const [name, bus] of [
      ['bgm_base', this.baseGain],
      ['bgm_drive', this.driveGain],
      ['bgm_goal', this.goalGain],
    ]) {
      if (!this.buffers.has(name)) continue;
      const s = c.createBufferSource();
      s.buffer = this.buffers.get(name);
      s.loop = true;
      s.loopEnd = this.buffers.get('bgm_base').duration;
      s.connect(bus);
      s.start(at);
      this.layers.push(s);
      if (name === 'bgm_base') this.music = s;
    }
    this.musicEpoch = at;
    this.applyMix();
  }
  later(seconds, fn) {
    const id = setTimeout(() => {
      this.timers.delete(id);
      if (!this.disposed && !this.paused && this.focused) fn();
    }, seconds * 1000);
    this.timers.add(id);
  }
  ramp(node, v, time = 0.055) {
    if (!node || !this.context) return;
    const p = node.gain,
      t = this.context.currentTime;
    p.cancelScheduledValues(t);
    p.setTargetAtTime(v, t, time);
  }
  applyMix() {
    if (!this.context) return;
    this.ramp(this.master, this.enabled ? this.volumes.master : 0);
    this.ramp(this.sfx, this.volumes.sfx);
    this.ramp(this.voice, this.volumes.voice);
    this.ramp(
      this.bgm,
      this.volumes.bgm * (this.context.currentTime < this.duckUntil ? this.duckLevel : 1),
    );
    this.ramp(this.baseGain, this.finishing ? 0.18 : this.free ? 0.4 : 1, 0.18);
    this.ramp(this.driveGain, this.free || this.finishing ? 0 : 0.22, 0.2);
    this.ramp(this.goalGain, !this.free && !this.finishing && this.progress >= 2 ? 0.32 : 0, 0.2);
  }
  duck(seconds, level = MIX.duckImpact) {
    const now = this.context.currentTime;
    this.duckLevel = now < this.duckUntil ? Math.min(this.duckLevel, level) : level;
    this.duckUntil = Math.max(this.duckUntil, now + seconds);
    this.applyMix();
    this.later(seconds + 0.03, () => {
      if (this.context.currentTime >= this.duckUntil) {
        this.duckLevel = 1;
        this.applyMix();
      }
    });
  }
  setSnapshot(s) {
    if (!s) return;
    this.free = s.paidAmmo === 0 && s.projectile?.mode !== 'paid';
    this.progress = s.stage?.collected ?? 0;
    this.applyMix();
  }
  consume(events, snapshot) {
    if (snapshot) this.setSnapshot(snapshot);
    for (const e of events) {
      if (!e?.eventId || this.seen.has(e.eventId)) continue;
      this.seen.add(e.eventId);
      if (this.seen.size > 4096) this.seen.delete(this.seen.values().next().value);
      if (!this.canPlay()) continue;
      for (const item of mapEvent(e)) {
        const fn = () => this.playCue(item.name, item);
        if (item.delay) this.later(item.delay, fn);
        else fn();
      }
      const p = e.payload || {};
      if (e.type === 'stageBonusEarned') {
        this.finishing = true;
        this.applyMix();
        this.later(1.6, () => {
          this.finishing = false;
          this.applyMix();
        });
      }
      if (this.autoVoice) {
        let id,
          delay = 0.45;
        if (e.type === 'shotAccepted' && p.mode === 'free') id = 'free_swap';
        if (e.type === 'explosionResolved') {
          id = 'explosion';
          delay = 1.2;
        }
        if (e.type === 'paidShotResolved' && p.dropped?.length >= 6) {
          id = 'big_drop';
          delay = 1.5;
        }
        if (e.type === 'targetsCollected' && p.progress === 2) {
          id = 'one_target_left';
          delay = 0.7;
        }
        if (e.type === 'stageBonusEarned') {
          id = 'stage_bonus';
          delay = 2;
        }
        if (e.type === 'boardRefilled') {
          id = 'new_bubbles';
          delay = 0.85;
        }
        if (e.type === 'boardMaintained') id = 'maintenance';
        if (id) this.requestVoice(id, delay, e.eventId);
      }
    }
  }
  canPlay() {
    return (
      !this.disposed &&
      this.enabled &&
      !this.paused &&
      this.focused &&
      this.context?.state === 'running'
    );
  }
  requestVoice(id, delay, causeId) {
    const priority = {
      stage_bonus: 9,
      explosion: 8,
      big_drop: 7,
      one_target_left: 6,
      maintenance: 4,
      new_bubbles: 2,
      free_swap: 1,
    }[id];
    if (this.pendingVoice && this.pendingVoice.priority >= priority) return;
    this.pendingVoice = { id, priority, causeId };
    const entry = this.pendingVoice;
    this.later(delay, () => {
      if (this.pendingVoice !== entry) return;
      this.pendingVoice = null;
      this.say(id, { causeId });
    });
  }
  scoreTick() {
    if (!this.canPlay()) return false;
    const now = this.context.currentTime;
    this.scoreRun = now - (this.lastScoreAt ?? -Infinity) > 0.6 ? 0 : (this.scoreRun + 1) % 5;
    this.lastScoreAt = now;
    return this.playCue('score_tick', { rate: 2 ** (this.scoreRun / 12) });
  }
  playCue(name, { gain = 1, rate = 1 } = {}) {
    const cfg = CUES[name],
      c = this.context;
    if (!cfg || !this.canPlay() || !this.buffers.has(name)) return false;
    const now = c.currentTime;
    if (now - (this.lastCue.get(name) ?? -Infinity) < cfg.cooldown) return false;
    // Reserve two short ping voices: a busy explosion must not swallow a visible +1.
    const score = name === 'score_tick';
    const pool = [...this.active].filter((e) => (e.name === 'score_tick') === score);
    if (pool.length >= (score ? 2 : MIX.maxSfx)) {
      const lowest = pool.sort((a, b) => a.priority - b.priority || a.at - b.at)[0];
      if (lowest.priority > cfg.priority) return false;
      lowest.source.stop();
      this.active.delete(lowest);
    }
    this.lastCue.set(name, now);
    const source = c.createBufferSource(),
      g = c.createGain();
    source.buffer = this.buffers.get(name);
    source.playbackRate.value = Math.max(0.8, Math.min(1.3, rate));
    g.gain.value = cfg.gain * Math.min(1, Math.max(0, gain));
    source.connect(g);
    g.connect(this.sfx);
    const entry = { source, name, priority: cfg.priority, at: now };
    this.active.add(entry);
    source.onended = () => {
      this.active.delete(entry);
      source.disconnect();
      g.disconnect();
    };
    source.start();
    this.record({ cue: name, at: now });
    if (cfg.duck) this.duck(cfg.duck);
    return true;
  }
  say(id, { causeId = '', force = false } = {}) {
    if (!VOICE_LINES[id] || !this.canPlay() || this.voiceSource || !this.buffers.has('voice-' + id))
      return false;
    const now = this.context.currentTime;
    if (
      !force &&
      (now - this.lastSpoken < MIX.voiceGap ||
        now - (this.lastVoice.get(id) ?? -Infinity) < (id === 'free_swap' ? 24 : 12))
    )
      return false;
    this.lastSpoken = now;
    this.lastVoice.set(id, now);
    const s = this.context.createBufferSource();
    s.buffer = this.buffers.get('voice-' + id);
    s.connect(this.voice);
    this.voiceSource = s;
    s.onended = () => {
      if (this.voiceSource === s) this.voiceSource = null;
      s.disconnect();
    };
    s.start();
    this.duck(s.buffer.duration + 0.12, MIX.duckVoice);
    this.record({ voice: id, at: now });
    try {
      this.onVoice({ id, text: VOICE_LINES[id], causeId, duration: s.buffer.duration });
    } catch (e) {
      this.errors.push('onVoice: ' + e.message);
    }
    return true;
  }
  record(e) {
    this.history.push(e);
    if (this.history.length > 150) this.history.shift();
  }
  setVolume(bus, value) {
    if (typeof bus === 'number') {
      value = bus;
      bus = 'master';
    }
    if (!Object.hasOwn(this.volumes, bus)) throw Error('Unknown audio bus');
    this.volumes[bus] = Math.max(0, Math.min(1, Number(value) || 0));
    this.applyMix();
  }
  setMuted(muted) {
    this.enabled = !muted;
    if (muted) this.stopTransient();
    this.applyMix();
    if (!muted) this.startMusic();
  }
  toggle() {
    this.setMuted(this.enabled);
    return this.enabled;
  }
  stopTransient() {
    for (const id of this.timers) clearTimeout(id);
    this.timers.clear();
    this.pendingVoice = null;
    for (const v of this.active)
      try {
        v.source.stop();
      } catch {}
    this.active.clear();
    try {
      this.voiceSource?.stop();
    } catch {}
    this.voiceSource = null;
    this.finishing = false;
    this.duckUntil = 0;
    this.duckLevel = 1;
    this.applyMix();
  }
  async setPaused(value) {
    this.paused = !!value;
    await this.syncTransport();
  }
  async setFocused(value) {
    this.focused = !!value;
    await this.syncTransport();
  }
  async syncTransport() {
    if (!this.context || this.disposed) return;
    try {
      if (this.paused || !this.focused) {
        this.stopTransient();
        await this.context.suspend();
      } else {
        await this.context.resume();
        this.startMusic();
      }
    } catch (e) {
      this.errors.push('transport: ' + e.message);
    }
  }
  stats() {
    return {
      state: this.context?.state || 'locked',
      baseMusicInstances: this.music ? 1 : 0,
      synchronizedLayers: this.layers.length,
      stemDurations: Object.fromEntries(
        ['bgm_base', 'bgm_drive', 'bgm_goal']
          .filter((k) => this.buffers.has(k))
          .map((k) => [k, this.buffers.get(k).duration]),
      ),
      sfxVoices: this.active.size,
      voiceActive: !!this.voiceSource,
      buffers: this.buffers.size,
      seenEvents: this.seen.size,
      enabled: this.enabled,
      free: this.free,
      progress: this.progress,
      volumes: { ...this.volumes },
      errors: [...this.errors],
      history: [...this.history],
    };
  }
  dispose() {
    if (this.disposed) return;
    this.stopTransient();
    this.disposed = true;
    for (const s of this.layers)
      try {
        s.stop();
      } catch {}
    this.layers = [];
    this.music = null;
    this.context?.close();
    if (globalThis.document) {
      globalThis.removeEventListener('blur', this.blur);
      globalThis.removeEventListener('focus', this.focus);
      document.removeEventListener('visibilitychange', this.visibility);
    }
    this.buffers.clear();
  }
}
