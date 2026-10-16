import { ANNOUNCER_LINES, ANNOUNCER_VOICES } from './announcer-profiles.mjs';
export { ANNOUNCER_LINES, ANNOUNCER_VOICES } from './announcer-profiles.mjs';
const VOICE_KEY = 'bubble-arcade-announcer-choice';
// Licensed human recordings. No browser speech synthesis and no gameplay writes.
export class ArcadeAnnouncer {
  constructor(audio) {
    this.audio = audio;
    this.buffers = new Map();
    this.seen = new Set();
    this.history = [];
    this.errors = [];
    this.pending = null;
    this.source = null;
    this.lastAt = -100;
    this.context = null;
    this.dead = false;
    this.voice = 'aimee';
    this.generation = 0;
    try {
      const v = globalThis.localStorage?.getItem(VOICE_KEY);
      if (ANNOUNCER_VOICES[v]) this.voice = v;
    } catch {}
  }
  async load() {
    const context = this.audio.context;
    if (!context || this.dead) return;
    if (this.context === context) return this.loading;
    this.context = context;
    const generation = this.generation,
      files = ANNOUNCER_VOICES[this.voice].files;
    this.loading = Promise.all(
      Object.entries(files).map(async ([id, file]) => {
        try {
          const response = await fetch(
            new URL('../../../assets/audio/announcer/' + file, import.meta.url),
          );
          if (!response.ok) throw Error('HTTP ' + response.status);
          const buffer = await context.decodeAudioData(await response.arrayBuffer());
          if (!this.dead && generation === this.generation) this.buffers.set(id, buffer);
        } catch (e) {
          if (generation === this.generation) this.errors.push(id + ': ' + e.message);
        }
      }),
    );
    return this.loading;
  }
  setVoice(voice) {
    if (!ANNOUNCER_VOICES[voice]) return;
    this.stop();
    this.pending = null;
    this.voice = voice;
    this.generation++;
    this.buffers.clear();
    this.errors = [];
    this.context = null;
    this.loading = null;
    this.lastAt = -100;
    try {
      globalThis.localStorage?.setItem(VOICE_KEY, voice);
    } catch {}
    return this.load();
  }
  async preview() {
    await this.load();
    const generation = this.generation,
      token = (this.previewToken ?? 0) + 1;
    this.previewToken = token;
    let delay = 0;
    for (const id of ['nice', 'wow', 'awesome', 'congratulations']) {
      const clip = this.buffers.get(id);
      if (!clip) continue;
      this.audio.later(delay, () => {
        if (generation !== this.generation || token !== this.previewToken || !this.audio.canPlay())
          return;
        this.lastAt = -100;
        this.pending = { id, priority: ANNOUNCER_LINES[id].priority, age: 0 };
      });
      delay += clip.duration + 0.4;
    }
  }
  restore() {
    this.pending = null;
    this.stop();
    this.seen.clear();
  }
  consume(events) {
    let chosen = null;
    const offer = (id, key) => {
      const line = ANNOUNCER_LINES[id];
      if (!chosen || line.priority > chosen.priority) chosen = { id, key, priority: line.priority };
    };
    for (const event of events) {
      if (this.seen.has(event.eventId)) continue;
      this.seen.add(event.eventId);
      if (this.seen.size > 512) this.seen.delete(this.seen.values().next().value);
      const p = event.payload ?? {};
      if (event.type === 'comboChanged' && p.tier > p.previousTier && p.streak >= 2)
        offer(p.tier >= 3 ? 'awesome' : p.tier === 2 ? 'wow' : 'nice', event.eventId);
      if (event.type === 'paidShotResolved' && p.directCount + p.dropCount >= 12)
        offer('wow', event.eventId);
      if (event.type === 'stageBonusEarned') offer('congratulations', event.eventId);
      if (event.type === 'petSlotResolved')
        offer(
          p.rewardType === 'fullClear' || p.rewardType === 'tickets'
            ? 'congratulations'
            : p.rewardType === 'lightning'
              ? 'awesome'
              : p.rewardType === 'ammo'
                ? 'nice'
                : 'wow',
          event.eventId,
        );
    }
    if (chosen) this.pending = { ...chosen, age: 0 };
  }
  update(dt) {
    if (this.dead) return;
    if (this.voice === 'off') {
      this.pending = null;
      this.stop();
      return;
    }
    void this.load();
    if (!this.audio.canPlay()) {
      this.pending = null;
      this.stop();
      return;
    }
    if (!this.pending) return;
    this.pending.age += dt;
    if (this.pending.age > 0.65) {
      this.pending = null;
      return;
    }
    const now = this.audio.context.currentTime,
      { id, priority } = this.pending,
      buffer = this.buffers.get(id);
    if (!buffer || this.audio.voiceSource) return;
    if (now - this.lastAt < (priority >= 3 ? 2.2 : 3.2)) {
      this.pending = null;
      return;
    }
    const source = this.audio.context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = id === 'nice' ? 1.08 : 1;
    source.connect(this.audio.voice);
    this.source = source;
    this.audio.voiceSource = source;
    this.audio.duck(buffer.duration + 0.15, 0.28);
    source.onended = () => {
      if (this.audio.voiceSource === source) this.audio.voiceSource = null;
      if (this.source === source) this.source = null;
      source.disconnect();
    };
    source.start();
    this.lastAt = now;
    this.history.push({ id, at: now });
    if (this.history.length > 32) this.history.shift();
    this.pending = null;
  }
  stop() {
    try {
      this.source?.stop();
    } catch {}
    if (this.audio.voiceSource === this.source) this.audio.voiceSource = null;
    this.source = null;
  }
  stats() {
    return {
      voice: this.voice,
      loaded: this.buffers.size,
      active: !!this.source,
      history: [...this.history],
      errors: [...this.errors],
    };
  }
  dispose() {
    this.dead = true;
    this.stop();
    this.buffers.clear();
  }
}
