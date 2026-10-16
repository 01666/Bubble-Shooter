// Standalone simulation. Does not import core, client app, storage or hardware.
import { PresentationScene } from '../../src/presentation/scene.mjs';
import { drawDragon } from '../../src/feedback/pet/dragon.mjs';
import { drawChest, drawStar } from '../../src/feedback/effects-ui/treasure.mjs';
import { RewardFlights } from '../../src/feedback/effects-ui/reward-flights.mjs';
import { MechanismDirector } from '../../src/feedback/mechanisms/director.mjs';
import { MechanismRenderer } from '../../src/feedback/mechanisms/renderer.mjs';
import { CoreMechanismBridge, corePoint } from '../../src/feedback/mechanisms/core-bridge.mjs';
import { fixture, hitEvents } from './mock-fixtures.mjs';
import { clamp, text, dualOrb } from '../../src/feedback/mechanisms/art.mjs';
import { LivingRoom } from '../../src/feedback/environment/background.mjs';
import { bindRoomLayer } from '../../src/feedback/environment/room-layer.mjs';
import { OrbMaterialPolish } from '../../src/feedback/orbs/orb-material.mjs';
import { ArcadeAudio } from '../../src/feedback/audio/audio.mjs';
import { RewardVoice } from '../../src/feedback/rewards/reward-voice.mjs';
import { RewardWords } from '../../src/feedback/rewards/reward-words.mjs';
import { ProgressBridge } from '../../src/feedback/rewards/progress-bridge.mjs';
import { PreviewRecorder } from './recorder.mjs';
import { VOICE_LIBRARY } from '../../src/feedback/rewards/voice-library.mjs';
const $ = (id) => document.getElementById(id),
  scene = new PresentationScene($('scene'), null),
  canvas = $('effects'),
  c = canvas.getContext('2d');
canvas.width = 900;
canvas.height = 1600;
const atlas = new Image();
atlas.src = '/assets/images/orbs-refined.png';
const director = new MechanismDirector(),
  bridge = new CoreMechanismBridge(director),
  renderer = new MechanismRenderer(director, { atlas });
const tickets = new RewardFlights(() => {
  state.tickets.pending++;
  scene.rewardPulseAt = scene.clock;
});
const audio = new ArcadeAudio({ autoVoice: false, bindLifecycle: false }),
  words = new RewardWords(),
  voice = new RewardVoice(audio, { onText: (cue) => words.show(cue) }),
  room = new LivingRoom(),
  roomLayer = bindRoomLayer(scene, room),
  polish = new OrbMaterialPolish(scene),
  progress = new ProgressBridge({ room, voice }),
  recorder = new PreviewRecorder();
let transportKey = '',
  focused = !document.hidden;
const feed = (events, s) => {
  bridge.consume(events, s);
  progress.consume(events, s);
};
for (const button of document.querySelectorAll('button')) button.disabled = true;
let state = fixture(),
  mode = null,
  time = 0,
  hit = null,
  hitDone = false,
  sequence = 100,
  ticketDone = false,
  bonusDone = false,
  phase = '模拟盘面 · 点击成功蓄一格';
scene.apparatus({ cannonY: -6.25, radius: 0.44, ballsPerCoin: 10, dangerY: -4.65 }, 0.88);
scene.pet.setEnabled(false);
scene.petPose = () => {};
await Promise.all([
  scene.ready(),
  atlas.decode(),
  scene.hudImage.decode(),
  document.fonts.load('400 26px ArcadeDisplay'),
]);
const resize = () => scene.viewport(0, 1600, Math.round($('cabinet').clientWidth));
new ResizeObserver(resize).observe($('cabinet'));
resize();
function reset(ready = false) {
  state = fixture();
  if (ready) {
    state.assist.charge = 3;
    state.assist.state = 'ready';
  }
  scene.sync(state);
  bridge.restore(state);
  progress.restore(state);
  words.clear();
  tickets.clear();
  mode = null;
  time = 0;
  hit = null;
  hitDone = ticketDone = bonusDone = false;
  phase = ready ? '恢复快照：已就绪，不重播准备庆祝' : '模拟盘面 · 点击成功蓄一格';
  $('scrub').value = '0';
  render(0);
}
function charge() {
  if (mode) {
    reset();
  }
  if (state.assist.charge >= 3) return;
  const before = state.assist.charge++;
  sequence += 10;
  const shotId = `mock-charge-${sequence}`,
    b = state.board[15];
  const events = [
    {
      eventId: `event-${sequence}`,
      type: 'paidShotResolved',
      payload: { shotId, direct: [b], dropped: [], electricIds: [] },
    },
    {
      eventId: `event-${sequence + 1}`,
      type: 'assistChargeChanged',
      payload: { interfaceVersion: 1, shotId, before, after: state.assist.charge, threshold: 3 },
    },
  ];
  if (state.assist.charge === 3) {
    state.assist.state = 'ready';
    events.push({
      eventId: `event-${sequence + 2}`,
      type: 'assistReady',
      payload: { interfaceVersion: 1, boostId: 'mock-assist', primaryColor: 1, secondaryColor: 2 },
    });
  }
  feed(events, state);
  phase = `模拟成功消除 · 蓄能 ${state.assist.charge}/3`;
}
function launch(nextMode) {
  reset(true);
  mode = nextMode;
  if (mode === 'one') state.board.find((b) => b.id === 'mock-green').color = 4;
  if (mode === 'miss') {
    state.loadedColor = 0;
    state.assist.primaryColor = 0;
    state.assist.secondaryColor = 4;
  }
  hit = hitEvents(state, mode, (sequence += 20));
  state.assist.state = 'inFlight';
  state.assist.charge = 0;
  feed(
    [
      {
        eventId: `event-${sequence - 1}`,
        type: 'assistShotAccepted',
        payload: {
          interfaceVersion: 1,
          shotId: hit.shotId,
          boostId: 'mock-assist',
          primaryColor: 1,
          secondaryColor: 2,
        },
      },
    ],
    state,
  );
  phase = '模拟双彩发射 · 弹道仅用于预览';
}
function advance(dt) {
  if (mode) time += dt;
  const reduced = $('reduced').checked;
  director.enabled = !$('off').checked;
  renderer.enabled = director.enabled;
  const busy = mode === 'combined' && time >= 2.6 && time < 4.5;
  if (mode && time < 1.25) {
    const k = clamp((time - 0.12) / 1.13),
      from = { x: 450, y: 1366 },
      to = hit.impact;
    const q = { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k };
    state.projectile = {
      x: ((q.x - 450) * 9.9) / 900,
      y: 7 - ((q.y - 160) * 9.9) / 900,
      color: state.assist.primaryColor,
      mode: 'paid',
      assist: {
        primaryColor: state.assist.primaryColor,
        secondaryColor: state.assist.secondaryColor,
        boostId: 'mock-assist',
      },
    };
  } else if (mode && !hitDone) {
    hitDone = true;
    state.projectile = null;
    state.loadedColor = state.nextColor;
    state.nextColor = 0;
    state.paidAmmo--;
    const gone = new Set([...hit.direct, ...hit.dropped].map((b) => b.id));
    state.board = state.board.filter((b) => !gone.has(b.id));
    if (mode === 'miss') {
      state.board.push({ ...hit.hit });
    }
    state.assist.state = 'charging';
    state.assist.secondaryColor = null;
    state.network.nodes = state.network.nodes.filter((n) => !gone.has(n.id));
    state.network.edges = state.network.edges.filter(
      (e) => !gone.has(e.fromId) && !gone.has(e.toId),
    );
    feed(hit.events, state);
    if (audio.context && audio.enabled) {
      audio.playCue(mode === 'combined' ? 'chain' : 'clear');
    }
    phase =
      mode === 'miss'
        ? '模拟失败：主色正常吸附，不庆祝'
        : mode === 'dropped'
          ? '模拟仅掉落节点：无电流'
          : mode === 'one'
            ? '模拟仅蓝色成立：无绿色爆破'
            : '模拟双彩→真实形状路径导电→掉落→收星→宝箱→飞票';
  }
  if (mode && time > 3.4 && !ticketDone) {
    ticketDone = true;
    const n = hit.direct.length + hit.dropped.length * 2;
    if (n)
      tickets.add(
        `mock-normal-${sequence}`,
        n,
        hit.direct.map(corePoint).length ? hit.direct.map(corePoint) : hit.dropped.map(corePoint),
        director.clock,
      );
  }
  if (mode === 'combined' && time > 3.7 && !bonusDone) {
    bonusDone = true;
    progress.consume(
      [
        {
          eventId: `event-${sequence + 8}`,
          type: 'stageBonusEarned',
          causeId: hit.shotId,
          payload: { shotId: hit.shotId, count: 8 },
        },
      ],
      state,
    );
    audio.playCue('stage_complete');
    tickets.add(`mock-bonus-${sequence}`, 8, [{ x: 274, y: 1428 }], director.clock);
  }
  director.update(dt, { reduced, priorityBusy: busy });
  room.update(dt, { reduced, quality: $('quality').value });
  progress.update(dt);
  voice.update(dt);
  words.update(dt, { reduced });
  tickets.update(director.clock);
  scene.reduced = reduced;
  scene.sync(state);
}
function render(dt) {
  director.enabled = !$('off').checked;
  renderer.enabled = director.enabled;
  director.reduced = $('reduced').checked;
  director.priorityBusy = mode === 'combined' && time >= 2.6 && time < 4.5;
  const enabled = !$('original').checked;
  if (polish.enabled !== enabled) polish.setEnabled(enabled);
  roomLayer.update({ aim: state.angle, enabled });
  polish.update(
    [...scene.balls.values(), scene.loaded, scene.next, scene.projectile, scene.loadTransfer?.mesh],
    room.time,
    { quality: $('quality').value, reduced: $('reduced').checked },
  );
  scene.tick(dt);
  c.clearRect(0, 0, 900, 1600);
  const pose = director.petPose({
    breath: Math.sin(director.clock * 2) * 2,
    wing: Math.sin(director.clock * 2) * 0.05,
    tail: Math.sin(director.clock * 1.8) * 0.12,
    eyes: 1,
  });
  drawDragon(c, pose);
  const busy = mode === 'combined' && time > 2.6 && time < 4.5;
  const open =
    mode === 'combined' ? clamp((time - 3.2) / 0.4) * (1 - clamp((time - 4.3) / 0.5)) : 0;
  drawChest(c, {
    progress: mode === 'combined' && time >= 3.2 ? 3 : 2,
    open,
    time: director.clock,
    reduced: director.reduced,
  });
  if (mode === 'combined' && time >= 2.7 && time < 3.2) {
    const k = (time - 2.7) / 0.5,
      from = corePoint(hit.dropped[0]);
    drawStar(
      c,
      from.x + (274 - from.x) * k,
      from.y + (1430 - from.y) * k - Math.sin(k * Math.PI) * 45,
      17,
      true,
    );
  }
  if (mode && time > 1.25 && time < 2.65)
    for (const b of hit.dropped) {
      const q = corePoint(b),
        k = clamp((time - 1.95) / 0.7);
      c.save();
      c.globalAlpha = 1 - k;
      const p = { x: q.x, y: q.y + (director.reduced ? 20 : 240) * k * k };
      // Two identical halves reuse atlas shading for ordinary falling cells.
      const boxes = [
          [63, 79, 459, 465],
          [568, 79, 969, 466],
          [1079, 80, 1476, 466],
          [63, 555, 459, 942],
          [568, 555, 969, 943],
        ],
        box = boxes[b.color];
      c.drawImage(
        atlas,
        box[0],
        box[1],
        box[2] - box[0],
        box[3] - box[1],
        p.x - 40,
        p.y - 40,
        80,
        80,
      );
      c.restore();
    }
  const loadedMesh = scene.loaded,
    lp = loadedMesh?.getAbsolutePosition(),
    pp = state.projectile ? scene.renderedPoint(state.projectile) : null;
  const overlay = renderer.draw(c, {
    nodePoint: (n) => {
      const ball = state.board.find((b) => b.id === n.id);
      return ball ? scene.boardPoint(ball) : n;
    },
    alivePoints: state.board.map((b) => ({ ...scene.boardPoint(b), id: b.id })),
    priorityBusy: busy,
    collar: { x: 144 + (pose.step ?? 0), y: 1429 - (pose.hop ?? 0) + (pose.breath ?? 0) * 0.68 },
    loaded: lp ? { x: lp.x, y: -lp.y, visible: !state.projectile, radius: 40 } : null,
    projectile: pp
      ? { ...pp, visible: true, colors: bridge.liveProjectile(state), radius: 40 }
      : null,
  });
  // These are presentation-only visibility flags, never physics or source snapshots.
  scene.loaded?.setEnabled(
    !overlay.loaded &&
      (!state.projectile || Math.hypot(state.projectile.x, state.projectile.y + 6.25) > 0.88),
  );
  scene.projectile?.setEnabled(!overlay.projectile);
  tickets.draw(c, director.clock, director.reduced, (...args) => text(c, ...args));
  progress.drawTargets(c, corePoint);
  words.draw(c);
  for (const b of state.board.filter((b) => b.kind === 'bomb')) {
    const p = scene.boardPoint(b);
    c.fillStyle = '#081726';
    c.strokeStyle = '#ffd383';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(p.x + 18, p.y - 18, 11, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    text(c, '爆', p.x + 18, p.y - 14, 14);
  }
  c.fillStyle = '#07182de8';
  c.fillRect(50, 1540, 800, 59);
  text(c, '模拟表现 · 不计入正式余球或彩票账务', 450, 1577, 24);
  $('status').textContent = phase;
  $('diagnostics').textContent = JSON.stringify(
    {
      mock: true,
      mode,
      time: Math.round(time * 100) / 100,
      ...director.stats(),
      adapter: bridge.stats(),
      tickets: tickets.stats(),
      room: room.stats(),
      roomLayer: roomLayer.stats(),
      orb: polish.stats(),
      voice: voice.stats(),
    },
    null,
    2,
  );
  if (mode) $('scrub').value = String(Math.min(time, 7));
  recorder.frame([$('scene'), canvas]);
}
$('charge').onclick = charge;
for (const [id, m] of [
  ['launch', 'combined'],
  ['one', 'one'],
  ['miss', 'miss'],
  ['dropped', 'dropped'],
])
  $(id).onclick = () => launch(m);
$('restore').onclick = () => reset(true);
$('reset').onclick = () => reset();
$('low').onclick = () => {
  reset();
  state.paidAmmo = 2;
  const ball = state.board.find((b) => b.id === 'mock-green');
  ball.kind = 'bomb';
  progress.consume(
    [
      {
        eventId: `event-${(sequence += 20)}`,
        type: 'lowOpportunityAppeared',
        payload: {
          interfaceVersion: 1,
          opportunityId: 'mock-low-' + sequence,
          shotId: 'mock-low-shot',
          remainingAmmo: 2,
          ballId: ball.id,
          specialType: 'bomb',
          ball: { ...ball },
          access: 'current',
        },
      },
    ],
    state,
  );
  scene.sync(state);
  phase = '模拟真实登场事件 · 最后两球，不承诺中奖';
};
$('sound').onclick = async () => {
  await audio.unlock();
  audio.free = false;
  audio.applyMix();
  await voice.load({ legacy: $('legacy').checked });
  $('audio-status').textContent = $('legacy').checked
    ? '旧系统合成稿对照；不是自然配音验收。'
    : '已开启原BGM与音效；自然配音缺席时准确文字降级。';
};
$('legacy').onchange = async () => {
  if (audio.context) await voice.load({ legacy: $('legacy').checked });
};
for (const [key, line] of Object.entries(VOICE_LIBRARY)) {
  const item = document.createElement('p');
  item.textContent = line.line + ' · 自然配音待补';
  if (line.legacy) {
    const player = document.createElement('audio');
    player.controls = true;
    player.preload = 'none';
    player.src = line.legacy;
    player.setAttribute('aria-label', '旧草稿试听 ' + key);
    item.append(player);
  }
  $('auditions').append(item);
}
$('record').onclick = async () => {
  try {
    await audio.unlock();
    audio.free = false;
    audio.applyMix();
    $('background-run').checked = true;
    $('pause').checked = false;
    launch('combined');
    recorder.start(audio);
    $('audio-status').textContent = '正在录制：含原BGM／音效，无新真人配音。';
    $('record').disabled = true;
    setTimeout(async () => {
      const blob = await recorder.stop();
      $('download').href = URL.createObjectURL(blob);
      $('download').hidden = false;
      $('audio-status').textContent = '7秒演示已生成（含BGM与音效音轨，真人配音仍待补）';
      $('record').disabled = false;
      const report = document.createElement('a');
      report.textContent = '保存录制轨道验证';
      report.download = 'stage-polish-recording.json';
      report.href = URL.createObjectURL(
        new Blob([JSON.stringify(recorder.report, null, 2)], { type: 'application/json' }),
      );
      $('download').after(report);
    }, 7200);
  } catch (e) {
    $('audio-status').textContent = '录制失败：' + e.message;
  }
};
$('scrub').oninput = () => {
  const t = Number($('scrub').value),
    m = mode ?? 'combined';
  launch(m);
  for (let k = 0; k < t; k += 0.05) advance(Math.min(0.05, t - k));
  $('pause').checked = true;
  render(0);
};
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const paused = $('pause').checked || (!focused && !$('background-run').checked),
    key = [paused, $('mute').checked].join(':');
  if (key !== transportKey) {
    transportKey = key;
    voice.setTransport({ paused, muted: $('mute').checked });
    audio.setPaused(paused);
    audio.setMuted($('mute').checked);
    if (paused) words.clear();
  }
  if (!paused) {
    advance(dt);
    render(dt);
  } else render(0);
  requestAnimationFrame(frame);
}
reset();
for (const button of document.querySelectorAll('button')) button.disabled = false;
requestAnimationFrame(frame);
addEventListener('pagehide', () => {
  recorder.dispose();
  voice.dispose();
  audio.dispose();
  roomLayer.dispose();
  room.dispose();
  polish.dispose();
  director.dispose();
  scene.scene.dispose();
  scene.engine.dispose();
});
addEventListener('blur', () => {
  focused = false;
});
addEventListener('focus', () => {
  focused = !document.hidden;
});
document.addEventListener('visibilitychange', () => {
  focused = !document.hidden;
});
document.addEventListener('pointerdown', () => {
  if (!document.hidden) focused = true;
});
