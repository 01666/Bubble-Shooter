// Chinese full-sentence voice slots remain empty. Licensed English reactions live in arcade-announcer.mjs.
// Legacy draft clips are opt-in A/B references only, never claimed as natural or commercially cleared.
export const VOICE_LIBRARY = Object.freeze({
  ammo: { line: '大消除，赠送泡泡！', priority: 90, cooldown: 0, file: null },
  success: {
    line: '消得漂亮！',
    priority: 20,
    cooldown: 9,
    legacy: '/assets/audio/voice-nice_clear.wav',
    file: null,
  },
  chain: {
    line: '连锁引爆！',
    priority: 70,
    cooldown: 7,
    legacy: '/assets/audio/voice-explosion.wav',
    file: null,
  },
  drop: {
    line: '漂亮，掉下来一大片！',
    priority: 65,
    cooldown: 8,
    legacy: '/assets/audio/voice-big_drop.wav',
    file: null,
  },
  ready: { line: '双彩准备好了！', priority: 40, cooldown: 10, file: null },
  network: { line: '导电爆发！', priority: 60, cooldown: 8, file: null },
  star: {
    line: '星星收到啦！',
    priority: 55,
    cooldown: 7,
    legacy: '/assets/audio/voice-target_received.wav',
    file: null,
  },
  chest: {
    line: '宝箱打开，额外彩票来啦！',
    priority: 100,
    cooldown: 4,
    legacy: '/assets/audio/voice-stage_bonus.wav',
    file: null,
  },
  low: { line: '泡泡快用完了，投币继续玩吧！', priority: 50, cooldown: 12, file: null },
});
export const RECORDING_SPEC = {
  format: 'mono WAV, 48kHz/24bit master; normalized playback WAV, no clipping',
  performance:
    '自然中文，短句有呼吸和收尾；普通成功轻，重大连锁惊喜，开箱热烈，登场有期待；不模仿具体真人',
  rights: '配音作者/生成工具、授权用途、商用再分发许可、录制日期和文件SHA-256',
  status: 'natural-voice-assets-pending',
};
