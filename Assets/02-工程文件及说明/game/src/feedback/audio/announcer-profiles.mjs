export const ANNOUNCER_LINES = Object.freeze({
  nice: { file: 'nice.wav', label: 'NICE!', priority: 1 },
  wow: { file: 'wow.mp3', label: 'WOW!', priority: 2 },
  awesome: { file: 'awesome.wav', label: 'AWESOME!', priority: 3 },
  congratulations: { file: 'congratulations.wav', label: 'CONGRATULATIONS!', priority: 4 },
});

export const ANNOUNCER_VOICES = Object.freeze({
  aimee: {
    label: '女声 A · 游戏播报',
    files: {
      nice: 'aimee-clear.wav',
      wow: 'female-wow.mp3',
      awesome: 'aimee-win.wav',
      congratulations: 'aimee-congratulations.wav',
    },
  },
  kenney: {
    label: '女声 B · 简洁明亮',
    files: {
      nice: 'kenney-correct.ogg',
      wow: 'female-wow.mp3',
      awesome: 'kenney-power-up.ogg',
      congratulations: 'kenney-congratulations.ogg',
    },
  },
  male: {
    label: '男声 · 原版',
    files: Object.fromEntries(Object.entries(ANNOUNCER_LINES).map(([k, v]) => [k, v.file])),
  },
  off: { label: '关闭真人播报', files: {} },
});
