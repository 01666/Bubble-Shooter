// A short two-note arcade ping, synthesized once and routed through the normal SFX bus.
export function createAmmoBonus(context) {
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * 0.34), context.sampleRate);
  const pcm = buffer.getChannelData(0),
    notes = [783.99, 987.77, 1174.66, 1567.98];
  for (let i = 0; i < pcm.length; i++) {
    const t = i / context.sampleRate;
    let value = 0;
    for (let n = 0; n < notes.length; n++) {
      const age = t - n * 0.058;
      if (age < 0) continue;
      const envelope =
        Math.min(1, age / 0.003) * Math.exp(-age * 22) * Math.min(1, (0.34 - t) / 0.015);
      value +=
        0.4 *
        envelope *
        (Math.sin(2 * Math.PI * notes[n] * age) + 0.15 * Math.sin(4 * Math.PI * notes[n] * age));
    }
    pcm[i] = Math.max(-0.9, Math.min(0.9, value));
  }
  return buffer;
}
export function createScoreTick(context) {
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * 0.085), context.sampleRate);
  const pcm = buffer.getChannelData(0);
  let phase = 0;
  for (let i = 0; i < pcm.length; i++) {
    const t = i / context.sampleRate;
    const frequency = t < 0.027 ? 1174.66 : 1567.98;
    phase += (2 * Math.PI * frequency) / context.sampleRate;
    const envelope = Math.min(1, t / 0.0025) * Math.exp(-t * 45) * Math.min(1, (0.085 - t) / 0.008);
    pcm[i] =
      envelope * (0.72 * Math.sin(phase) + 0.18 * Math.sin(phase * 2) + 0.1 * Math.sin(phase * 3));
  }
  return buffer;
}
