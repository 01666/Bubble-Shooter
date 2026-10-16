// Brief wordless character reactions. One voice at a time; no spoken synthesis.
export function characterCall(audio, mood = 'happy') {
  if (!audio.canPlay()) return false;
  const c = audio.context,
    now = c.currentTime;
  if (audio.voiceSource || now - (audio.lastCharacterCall ?? -100) < 3) return false;
  audio.lastCharacterCall = now;
  const sr = c.sampleRate,
    duration = mood === 'wow' ? 0.32 : 0.22,
    buffer = c.createBuffer(1, Math.ceil(sr * duration), sr),
    data = buffer.getChannelData(0);
  let phase = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / sr,
      k = t / duration,
      envelope = Math.sin(Math.PI * k) ** 1.8,
      pitch =
        (mood === 'wow' ? 390 : 470) +
        (mood === 'wow' ? 210 : 120) * Math.sin(k * Math.PI) -
        60 * k;
    phase += (2 * Math.PI * pitch) / sr;
    data[i] =
      envelope * 0.2 * (Math.sin(phase) + 0.23 * Math.sin(phase * 2) + 0.08 * Math.sin(phase * 3));
  }
  const source = c.createBufferSource();
  source.buffer = buffer;
  source.connect(audio.voice);
  audio.voiceSource = source;
  source.onended = () => {
    if (audio.voiceSource === source) audio.voiceSource = null;
    source.disconnect();
  };
  source.start();
  audio.record({ character: mood, at: now });
  return true;
}
