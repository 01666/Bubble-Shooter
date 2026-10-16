// Explicit user-triggered preview recorder. Video and existing audio master share one stream.
export class PreviewRecorder {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 450;
    this.canvas.height = 800;
    this.ctx = this.canvas.getContext('2d');
    this.recorder = null;
  }
  start(audio) {
    if (!globalThis.MediaRecorder || !this.canvas.captureStream)
      throw Error('MediaRecorder unavailable');
    if (!audio.context) throw Error('先开启试听，录制才能带音轨');
    const stream = this.canvas.captureStream(24),
      destination = audio.context.createMediaStreamDestination();
    const bus = audio.ceiling || audio.master;
    bus.connect(destination);
    const analyser = audio.context.createAnalyser();
    analyser.fftSize = 256;
    bus.connect(analyser);
    this.analyser = analyser;
    this.samples = new Float32Array(256);
    this.peak = 0;
    for (const track of destination.stream.getAudioTracks()) stream.addTrack(track);
    const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(
      (m) => MediaRecorder.isTypeSupported(m),
    );
    this.chunks = [];
    this.recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1800000 });
    this.recorder.ondataavailable = (e) => {
      if (e.data.size) this.chunks.push(e.data);
    };
    this.recorder.onstop = () => {
      bus.disconnect(destination);
      bus.disconnect(analyser);
      analyser.disconnect();
      for (const track of stream.getTracks()) track.stop();
      this.blob = new Blob(this.chunks, { type: this.recorder.mimeType });
      this.report = {
        mime: this.recorder.mimeType,
        tracks: stream.getTracks().map((t) => t.kind),
        nonzeroAudioPeak: this.peak,
        naturalVoiceIncluded: false,
      };
      this.resolve?.(this.blob);
    };
    this.recorder.start();
  }
  frame(layers) {
    if (this.recorder?.state !== 'recording') return;
    this.ctx.clearRect(0, 0, 450, 800);
    for (const layer of layers) this.ctx.drawImage(layer, 0, 0, 450, 800);
    this.analyser.getFloatTimeDomainData(this.samples);
    for (const sample of this.samples) this.peak = Math.max(this.peak, Math.abs(sample));
  }
  stop() {
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.recorder.stop();
    });
  }
  dispose() {
    if (this.recorder?.state === 'recording') this.recorder.stop();
  }
}
