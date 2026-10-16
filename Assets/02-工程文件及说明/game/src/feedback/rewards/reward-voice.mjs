import { VOICE_LIBRARY } from './voice-library.mjs';
export class RewardVoice {
  constructor(audio, { library = VOICE_LIBRARY, onText = () => {} } = {}) {
    this.audio = audio;
    this.library = library;
    this.onText = onText;
    this.buffers = new Map();
    this.queue = [];
    this.seen = new Set();
    this.cool = new Map();
    this.time = 0;
    this.active = null;
    this.errors = [];
    this.history = [];
    this.muted = false;
    this.paused = false;
    this.focused = true;
    this.pendingStart = null;
  }
  async load({ legacy = false, fetcher = globalThis.fetch } = {}) {
    this.buffers.clear();
    for (const [key, line] of Object.entries(this.library)) {
      const file = line.file || (legacy ? line.legacy : null);
      if (!file) continue;
      try {
        const r = await fetcher(file);
        if (!r.ok) throw Error('HTTP ' + r.status);
        const buffer = await this.audio.context.decodeAudioData(await r.arrayBuffer());
        this.buffers.set(key, buffer);
      } catch (e) {
        this.errors.push(key + ': ' + e.message);
      }
    }
  }
  restore({ eventSequence = 0 } = {}) {
    this.cancel();
    this.seen.clear();
    this.cool.clear();
    this.cursor = eventSequence;
  }
  offer(cue) {
    if (!cue.id || this.seen.has(cue.id) || (cue.sequence && cue.sequence <= (this.cursor ?? 0)))
      return;
    this.seen.add(cue.id);
    if (this.seen.size > 2048) this.seen.delete(this.seen.values().next().value);
    const cfg = this.library[cue.kind];
    if (!cfg) return;
    const candidate = { ...cue, priority: cfg.priority, at: this.time, ttl: 1.4 };
    // Merge each shot into one semantic announcement, preserving the highest-value narrative.
    const index = this.queue.findIndex((c) => c.shotId && c.shotId === cue.shotId);
    if (index >= 0) {
      if (this.queue[index].priority < candidate.priority) this.queue[index] = candidate;
    } else this.queue.push(candidate);
    this.queue.sort((a, b) => b.priority - a.priority || a.at - b.at);
    this.queue = this.queue.slice(0, 3);
  }
  outputClock() {
    const c = this.audio.context;
    if (!c) return 0;
    const stamp = c.getOutputTimestamp?.();
    return Number.isFinite(stamp?.contextTime)
      ? stamp.contextTime
      : Math.max(0, c.currentTime - (c.baseLatency ?? 0) - (c.outputLatency ?? 0));
  }
  present(cue, mode, start = null) {
    this.onText({ ...cue, mode, audioStart: start });
    this.history.push({ id: cue.id, kind: cue.kind, mode, start, shown: this.outputClock() });
    if (this.history.length > 64) this.history.shift();
  }
  update(dt) {
    if (this.paused || !this.focused) return;
    this.time += Math.min(0.1, Math.max(0, dt));
    if (this.pendingStart && this.outputClock() >= this.pendingStart.start) {
      this.present(this.pendingStart.cue, 'audio', this.pendingStart.start);
      this.pendingStart = null;
    }
    this.queue = this.queue.filter((c) => this.time - c.at <= c.ttl);
    const cue = this.queue[0];
    if (!cue) return;
    if (this.active && cue.priority <= this.active.priority) return;
    if (this.time - (this.cool.get(cue.kind) ?? -100) < this.library[cue.kind].cooldown) {
      this.queue.shift();
      this.present(cue, 'voice-cooldown');
      return;
    }
    if (this.active) this.stopVoice();
    this.queue.shift();
    this.cool.set(cue.kind, this.time);
    const a = this.audio,
      c = a.context,
      buffer = this.buffers.get(cue.kind);
    if (this.muted || !a.enabled || !c || c.state !== 'running' || !buffer) {
      this.present(cue, this.muted ? 'muted' : !buffer ? 'text-only' : 'locked');
      return;
    }
    if (a.voiceSource) {
      this.present(cue, 'voice-busy');
      return;
    }
    const source = c.createBufferSource();
    source.buffer = buffer;
    source.connect(a.voice);
    const start = c.currentTime + 0.04;
    this.active = { source, priority: cue.priority };
    a.voiceSource = source;
    this.pendingStart = { cue, start, source };
    source.onended = () => {
      if (a.voiceSource === source) a.voiceSource = null;
      if (this.active?.source === source) this.active = null;
      if (this.pendingStart?.source === source) this.pendingStart = null;
      source.disconnect();
    };
    try {
      source.start(start);
      a.duck(buffer.duration + 0.12, 0.32);
    } catch (e) {
      this.errors.push('start: ' + e.message);
      this.stopVoice();
      this.present(cue, 'audio-failed');
    }
  }
  stopVoice() {
    const source = this.active?.source;
    if (source) {
      try {
        source.stop();
      } catch {}
      source.disconnect();
      if (this.audio.voiceSource === source) this.audio.voiceSource = null;
    }
    this.active = null;
    this.pendingStart = null;
  }
  cancel() {
    this.stopVoice();
    this.queue = [];
  }
  setTransport({ paused = this.paused, focused = this.focused, muted = this.muted } = {}) {
    this.paused = paused;
    this.focused = focused;
    this.muted = muted;
    if (paused || !focused || muted) this.cancel();
  }
  stats() {
    return {
      queued: this.queue.length,
      active: !!this.active,
      pendingStart: !!this.pendingStart,
      buffers: this.buffers.size,
      seen: this.seen.size,
      errors: [...this.errors],
      history: [...this.history],
    };
  }
  dispose() {
    this.cancel();
    this.buffers.clear();
    this.seen.clear();
    this.onText = () => {};
  }
}
