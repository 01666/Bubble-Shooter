import { createPresentationCues } from '../feedback/audio/presentation-cues.mjs';
// One frame loop coordinates input, committed gameplay, hardware simulation and presentation.
import { STORAGE_KEYS } from './storage-keys.mjs';
import { AimInput } from './aim-input.mjs';
import { characterCall } from '../feedback/audio/character.mjs';
import { EndlessGame, BrowserJsonStore, MemoryStore, SimulatedDispenser } from '../core/index.mjs';
import { EventView } from '../presentation/event-view.mjs';
import { PresentationScene } from '../presentation/scene.mjs';
import { EffectsUI } from '../feedback/effects-ui/effects-ui.mjs';
import { RewardCounter } from '../feedback/effects-ui/reward-counter.mjs';
import { createBabylonPet } from '../feedback/pet/babylon-adapter.mjs';
import { ArcadeAudio } from '../feedback/audio/audio.mjs';
import { PresentationUpgrade } from './presentation-upgrade.mjs';
const $ = (id) => document.getElementById(id),
  audio = new ArcadeAudio({ autoVoice: false, bindLifecycle: false }),
  r = new PresentationScene($('game'), null),
  view = new EventView(),
  keys = new Set(),
  commands = [],
  queue = [],
  events = [];
let game,
  device,
  pet,
  feedback,
  upgrade,
  ready = false,
  fault = false,
  manualPause = false,
  focusPause = false,
  last = performance.now(),
  traceKey = '',
  padHeld = [],
  hadPad = false,
  frameDt = 0,
  frameSnapshot,
  spokenToken = null,
  petFrame = null;
let pendingFire = false;
let qaFocus = false;
function fire() {
  if (manualPause || focusPause) return;
  if (r.isBoardMoving() || game.s.content.flow?.pending) {
    pendingFire = true;
    return;
  }
  game.fire();
}
const atlas = new Image();
atlas.src = '/assets/images/orbs-refined.png';
const status = (t) => ($('status').textContent = t);
const voiceMap = {
  'pet.free.v1': 'free_swap',
  'pet.blast.v1': 'explosion',
  'pet.one-left.v1': 'one_target_left',
  'pet.refill.v1': 'new_bubbles',
  'pet.tidy.v1': 'maintenance',
  'pet.stage.v1': 'stage_bonus',
  'pet.drop.v1': 'big_drop',
  'pet.target.v1': 'target_received',
  'pet.clear.v1': 'nice_clear',
  'pet.dispenser-fault.v1': 'dispenser_fault',
};
function speech(s) {
  if (s.phase === 'start') {
    const critical = s.id === 'pet.dispenser-fault.v1',
      stage = s.id === 'pet.stage.v1';
    if (critical) {
      const now = performance.now(),
        gap = critical ? 30000 : 45000;
      if (now - (lastSpokenAt.get(s.id) || -100000) < gap) return;
      const id = voiceMap[s.id];
      if (audio.say(id, { causeId: s.token })) {
        spokenToken = s.token;
        lastSpokenAt.set(s.id, now);
      }
    } else if (!stage && !upgrade?.voice.active)
      characterCall(audio, ['pet.blast.v1', 'pet.drop.v1'].includes(s.id) ? 'wow' : 'happy');
  } else if (spokenToken === s.token) {
    try {
      audio.voiceSource?.stop();
    } catch {}
    audio.voiceSource = null;
    spokenToken = null;
  }
}
const aimInput = new AimInput();
const rewardCounter = new RewardCounter();
const lastSpokenAt = new Map();
const soundCue = createPresentationCues({ audio, scene: r, rewardCounter, getPet: () => pet });
function committed(e) {
  events.push(e);
  if (events.length > 300) events.shift();
  queue.push(e);
  if (e.type === 'shotRefunded') status('没有合法落点，这一球已退回。');
  if (e.type === 'constructionRetired') status('旧铺路球退役，余球和未出票保留。');
  if (e.type === 'petSlotStarted') status('宠物蓄力已满，正在摇奖……每次都有奖励。');
  if (e.type === 'petSlotResolved') status('宠物奖励：' + e.payload.label);
}
function snapshot() {
  const s = game.snapshot();
  return { ...s, dispenserFault: !!device?.jammed };
}
function safe(fn) {
  if (fault) return;
  try {
    fn();
  } catch (e) {
    fault = true;
    audio.setPaused(true);
    status('运行停止：' + e.message + '。账务保留，请勿清除存储。');
  }
}
function coin() {
  game.coin({ receiptId: 'sim-' + crypto.randomUUID() });
  status('已投1币，增加 ' + game.config.ballsPerCoin + ' 球。');
}
function reconcile() {
  for (const b of game.exportState().ledger.batches)
    if (b.status === 'uncertain' && device.evidence(b.id)) device.reconcile(game, b.id);
}
function pause() {
  pendingFire = false;
  manualPause = !manualPause;
  keys.clear();
  aimInput.reset();
  $('pause').textContent = manualPause ? '继续' : '暂停';
  audio.setPaused(manualPause || focusPause);
}
function sync(s) {
  const key =
    s.board.map((b) => b.id + ':' + b.r + ':' + b.c + ':' + b.color).join('|') +
    ':' +
    s.angle +
    ':' +
    (s.paidAmmo > 0);
  let trace = null;
  if (!s.projectile && key !== traceKey) {
    trace = game.trace();
    traceKey = key;
  }
  r.sync(s, trace);
  r.next?.setEnabled(!s.loading);
  $('loading').hidden = !s.loading;
  $('free').hidden = !(s.paidAmmo === 0 && s.projectile?.mode !== 'paid');
  $('paused').hidden = !(manualPause || focusPause);
  $('ledger').textContent =
    `可发射 ${s.paidAmmo} 球 · 待出彩票 ${s.tickets.pending} 张 · 模拟已出票 ${s.tickets.confirmed} 张`;
  $('device-fault').hidden = !(s.dispenserFault || s.tickets.uncertain > 0 || s.storageFault);
  $('device-fault').textContent = s.dispenserFault
    ? '模拟卡票 · 未出票保留'
    : s.storageFault
      ? '存储异常 · 已停止游玩'
      : '出票待核对 · 未出票保留';
  audio.setSnapshot(s);
}
function drain(s) {
  const batch = queue.splice(0).map((e) => ({ ...e, shotId: e.payload?.shotId ?? e.causeId }));
  upgrade.consume(batch, s);
  feedback.consume(batch, s);
  pet.consume(batch, s);
  audio.consume(
    batch.filter((e) =>
      [
        'coinCredited',
        'ammoBonusEarned',
        'shotAccepted',
        'bounce',
        'freeShotDeflected',
        'dispenseConfirmed',
        'boardRefilled',
        'boardRepositioned',
        'boardMaintained',
      ].includes(e.type),
    ),
    s,
  );
  for (const e of batch) {
    const p = e.payload ?? {};
    if (e.type === 'shotAccepted') {
      r.guidePool.newShot();
      r.startLoad(e.payload);
    }
    if (e.type === 'boardRefilled') r.startRefill(p);
    if (e.type === 'paidShotResolved' && p.attached) {
      const b = p.attached;
      for (const m of r.balls.values()) {
        const q = m.metadata.home;
        if (
          !(m.metadata.spawnUntil > r.clock) &&
          Math.hypot(q.x - (450 + (b.x * 900) / 9.9), q.y - (160 + ((7 - b.y) * 900) / 9.9)) < 95
        )
          m.metadata.hitUntil = r.clock + 0.32;
      }
    }
  }
  for (const a of view.consume(batch)) if (a.type !== 'resolve') r.response(a);
}
async function init() {
  try {
    await document.fonts.load('400 32px ArcadeDisplay');
    game = new EndlessGame({
      seed: crypto.getRandomValues(new Uint32Array(1))[0],
      store: new BrowserJsonStore(localStorage, STORAGE_KEYS.machine),
      onEvent: committed,
    });
    device = new SimulatedDispenser({
      store: new BrowserJsonStore(localStorage, STORAGE_KEYS.device),
      ticketsPerSecond: game.config.simulatedTicketsPerSecond,
    });
    reconcile();
    const probe = new EndlessGame({ store: new MemoryStore() });
    probe.fire();
    const p = probe.snapshot().projectile;
    r.apparatus(game.config, Math.hypot(p.x, p.y - game.config.cannonY));
    r.viewport(0, 1600, Math.round($('cabinet').clientWidth));
    await r.ready();
    await Promise.all([r.hudImage.decode(), atlas.decode()]);
    r.pet.setEnabled(false);
    r.petPose = () => {};
    upgrade = new PresentationUpgrade(r, audio, atlas);
    pet = createBabylonPet(r.scene, {
      reducedMotion: r.reduced,
      onSpeech: speech,
      poseModifier: (pose) => upgrade.petPose(pose, pet),
    });
    feedback = new EffectsUI({
      canvas: $('feedback'),
      atlas,
      reduced: r.reduced,
      showMarkers: false,
      retirementPlan: (shotId) => upgrade.mechanisms.retirementPlan(shotId),
      mapPoint: (b) => r.boardPoint(b),
      onCue: soundCue,
      onNotice: status,
      onCamera: (p) => {
        r.root.position.x = p.x;
        r.root.position.y = p.y;
      },
    });
    const s = snapshot(),
      cursor = game.exportState().eventSequence;
    pet.prime(s, { eventSequence: cursor });
    feedback.restore(s, { eventSequence: cursor });
    upgrade.restore(s, { eventSequence: cursor });
    $('announcer-voice').value = upgrade.announcer.voice;
    rewardCounter.observe(s.tickets, r.clock);
    r.displayPending = rewardCounter.value;
    queue.length = 0;
    sync(s);
    frameSnapshot = s;
    r.scene.onBeforeRenderObservable.add(() => {
      petFrame = pet.update(frameDt, frameSnapshot);
      upgrade.draw(frameSnapshot, feedback, petFrame?.pose);
    });
    ready = true;
    last = performance.now();
    status('按空格试射选颜色；C投币后消泡泡赢票。消除或击落★，集齐3颗加奖。');
  } catch (e) {
    fault = true;
    status('载入失败：' + e.message);
  }
}
$('coin').onclick = () => {
  audio.unlock();
  commands.push(coin);
};
$('music').onclick = () => audio.unlock();
$('mute').onclick = () => ($('mute').textContent = audio.toggle() ? '静音' : '恢复声音');
$('volume').oninput = (e) => audio.setVolume('master', Number(e.target.value));
$('pause').onclick = pause;
$('fullscreen').onclick = () =>
  document.fullscreenElement ? document.exitFullscreen() : $('cabinet').requestFullscreen();
for (const bus of ['bgm', 'sfx', 'voice'])
  $(bus + '-volume').oninput = (e) => audio.setVolume(bus, Number(e.target.value));
$('jam').onclick = () => {
  if (!device) return;
  device.jammed = !device.jammed;
  $('jam').textContent = device.jammed ? '解除卡票' : '模拟卡票';
  status(device.jammed ? '模拟卡票：未出票保留。' : '出票器已恢复。');
};
$('reconcile').onclick = () => commands.push(reconcile);
$('reduce').checked = r.reduced;
$('reduce').onchange = () => (r.reduced = $('reduce').checked);
$('announcer-voice').onchange = () => {
  audio.unlock().then(() => upgrade?.announcer.setVoice($('announcer-voice').value));
};
$('preview-announcer').onclick = () => {
  audio.unlock().then(() => upgrade?.announcer.preview());
};
$('quality').onchange = () => {
  if (upgrade) upgrade.quality = $('quality').value;
};
$('legacy-voice').onchange = () => {
  audio.unlock().then(() => upgrade?.setLegacyVoice($('legacy-voice').checked));
};
addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLSelectElement) return;
  if (
    ['ArrowLeft', 'ArrowRight', 'Space', 'KeyC', 'KeyA', 'KeyD', 'KeyP', 'KeyM', 'KeyF'].includes(
      e.code,
    )
  )
    e.preventDefault();
  if (e.target instanceof HTMLInputElement) return;
  keys.add(e.code);
  if (e.repeat) return;
  audio.unlock();
  if (e.code === 'KeyC') commands.push(coin);
  if (e.code === 'Space')
    commands.push(() => {
      fire();
    });
  if (e.code === 'KeyP') pause();
  if (e.code === 'KeyM') $('mute').click();
  if (e.code === 'KeyF') $('fullscreen').click();
});
addEventListener('keyup', (e) => keys.delete(e.code));
function focus(active) {
  if (qaFocus) active = true;
  pendingFire = false;
  focusPause = !active;
  keys.clear();
  commands.length = 0;
  last = performance.now();
  audio.setFocused(active);
  audio.setPaused(manualPause || focusPause);
}
addEventListener('blur', () => focus(false));
addEventListener('focus', () => focus(!document.hidden));
document.addEventListener('visibilitychange', () => focus(!document.hidden));
new ResizeObserver(() => {
  if (ready) r.viewport(0, 1600, Math.round($('cabinet').clientWidth));
}).observe($('cabinet'));
function loop(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  if (ready && !fault)
    safe(() => {
      while (commands.length) commands.shift()();
      const pad = [...navigator.getGamepads()].find(Boolean);
      if (hadPad && !pad) {
        manualPause = true;
        audio.setPaused(true);
        status('手柄断开，已暂停。');
      }
      hadPad = !!pad;
      let axis = 0;
      let d =
        (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) -
        (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
      if (pad) {
        axis = pad.axes[0] || 0;
        d += (pad.buttons[15]?.pressed ? 1 : 0) - (pad.buttons[14]?.pressed ? 1 : 0);
        const down = pad.buttons.map((b) => b.pressed);
        if (down.some((v, i) => v && !padHeld[i])) audio.unlock();
        if (down[8] && !padHeld[8]) coin();
        if (down[9] && !padHeld[9]) pause();
        if (down[0] && !padHeld[0]) fire();
        padHeld = down;
      } else padHeld = [];
      // Resume Web Audio before advancing reward arrivals; otherwise the first +1
      // after unpausing can land during the asynchronous context.resume() gap.
      const audioResuming =
        audio.enabled && audio.context?.state === 'suspended' && !audio.paused && audio.focused;
      const elapsed = manualPause || focusPause || audioResuming ? 0 : dt;
      if (elapsed) {
        const delta = aimInput.step(dt, d, axis, keys.has('ShiftLeft') || keys.has('ShiftRight'));
        if (delta) game.setAim(game.snapshot().angle + delta);
        if (
          pendingFire &&
          !r.isBoardMoving() &&
          !game.s.content.flow?.pending &&
          game.s.cooldown === 0
        ) {
          pendingFire = false;
          fire();
        }
        game.advance(dt);
      }
      device.tick(game, dt);
      const s = snapshot();
      upgrade.setTransport({
        paused: manualPause || focusPause,
        focused: !focusPause,
        muted: !audio.enabled,
      });
      upgrade.mechanisms.restoreOrbVisibility();
      rewardCounter.observe(s.tickets, r.clock);
      r.displayPending = rewardCounter.value;
      sync(s);
      drain(s);
      feedback.reduced = r.reduced;
      pet.controller.reducedMotion = r.reduced;
      upgrade.update(elapsed, { ...s, uiPaused: manualPause || focusPause }, feedback);
      feedback.update(elapsed, { ...s, uiPaused: manualPause || focusPause });
      r.displayPending = rewardCounter.value;
      pet.showBubble = !feedback.bannerKind && !upgrade.words.active && !upgrade.petSlots.result;
      $('free').hidden = feedback.bannerKind !== 'free' || !!upgrade.petSlots.result;
      $('free').querySelector('small').textContent =
        feedback.refillHint ?? '空格试射 · C 投币 · 试射不消除、不赢票';
      $('device-fault').style.top = '69.4%';
      frameDt = elapsed;
      frameSnapshot = s;
      r.tick(elapsed);
      if (audio.errors.length) status('部分音频载入失败：' + audio.errors.join('; '));
    });
  requestAnimationFrame(loop);
}
init();
requestAnimationFrame(loop);
addEventListener('pagehide', () => {
  ready = false;
  pet?.dispose();
  feedback?.dispose();
  upgrade?.dispose();
  audio.dispose();
  r.scene.dispose();
  r.engine.dispose();
});
window.arcade = { snapshot: () => game?.snapshot() };
// Development hooks are separated from the game orchestration and only loaded in test mode.
if (new URLSearchParams(location.search).get('test') === '1')
  import('./debug-api.mjs').then(({ installDebugApi }) =>
    installDebugApi({
      getGame: () => game,
      getReady: () => ready,
      getScene: () => r,
      getFeedback: () => feedback,
      getPet: () => petFrame,
      getAudio: () => audio,
      getUpgrade: () => upgrade,
      getEvents: () => events,
      setQaFocus: (active) => {
        qaFocus = active;
        focus(active || !document.hidden);
      },
    }),
  );
