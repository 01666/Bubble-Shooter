// Development/QA only. Disable this entry when packaging a production cabinet.
export function installDebugApi({
  getGame,
  getReady,
  getScene,
  getFeedback,
  getPet,
  getAudio,
  getUpgrade,
  getEvents,
  setQaFocus,
}) {
  const panel = document.createElement('p');
  const keepRunning = document.createElement('input');
  keepRunning.type = 'checkbox';
  const label = document.createElement('label');
  label.append(keepRunning, ' QA：保持试玩运行（允许后台动画）');
  keepRunning.addEventListener('change', () => setQaFocus(keepRunning.checked));
  const shot = document.createElement('button');
  shot.textContent = 'QA：自动瞄准发射一球';
  shot.addEventListener('click', () => {
    if (!getReady()) return;
    const game = getGame();
    const moves = game
      .opportunities()
      .sort((a, b) => b.direct.length + b.dropped.length - a.direct.length - a.dropped.length);
    game.setAim(moves[0]?.angle ?? 0);
    game.fire();
  });
  panel.append(label, shot);
  const timeline = document.createElement('output');
  timeline.setAttribute('aria-label', 'QA奖励时序');
  panel.append(timeline);
  document.querySelector('aside').append(panel);
  let previous = '',
    lines = [];
  function sample() {
    if (getReady()) {
      const s = getGame().snapshot(),
        scene = getScene().stats(),
        f = getFeedback().stats().rewardFlights;
      const key = [s.tickets.earned, scene.displayedPending, f.arrivals].join(':');
      if (key !== previous) {
        previous = key;
        lines.push(
          `获得${s.tickets.earned} 显示${scene.displayedPending} 到达${f.arrivals} +1数量${f.pops}`,
        );
        lines = lines.slice(-24);
        timeline.textContent = lines.join(' → ');
      }
    }
    requestAnimationFrame(sample);
  }
  requestAnimationFrame(sample);
  window.testGame = {
    get ready() {
      return getReady();
    },
    get idle() {
      const game = getGame();
      return game && !game.s.projectile && game.s.cooldown === 0;
    },
    snapshot: () => getGame().snapshot(),
    events: () => structuredClone(getEvents()),
    trace: (a) => getGame().trace(a),
    aim: (a) => getGame().setAim(a),
    bestAim: () => {
      const moves = getGame()
        .opportunities()
        .sort((a, b) => b.direct.length + b.dropped.length - a.direct.length - a.dropped.length);
      getGame().setAim(moves[0]?.angle ?? 0);
    },
    fire: () => getGame().fire(),
    stats: () => ({ scene: getScene().stats(), feedback: getFeedback().stats(), pet: getPet() }),
    visual: () => ({
      groups: getFeedback().groups.map((g) => ({
        type: g.type,
        age: g.age,
        cells: g.cells?.length,
        attached: !!g.result?.attached,
      })),
      balls: [...getScene().balls.values()].map((m) => ({
        id: m.name,
        spawnUntil: m.metadata.spawnUntil ?? 0,
        hitUntil: m.metadata.hitUntil ?? 0,
        scaleX: m.scaling.x,
        scaleY: m.scaling.y,
        x: m.position.x,
        y: -m.position.y,
        home: m.metadata.home,
        boardMotion: m.metadata.boardMotion,
        visible: m.isEnabled(),
      })),
      clock: getScene().clock,
    }),
    audio: () => getAudio().stats(),
    upgrade: () => getUpgrade?.()?.stats(),
    fastShots: (n) => {
      const game = getGame();
      for (let i = 0; i < n; i++) {
        if (!game.s.paidAmmo) game.coin({ receiptId: 'test-' + crypto.randomUUID() });
        const moves = game
          .opportunities()
          .sort(
            (a, b) =>
              b.direct.length +
              0.01 * b.dropped.length +
              0.1 * b.groupSize -
              (a.direct.length + 0.01 * a.dropped.length + 0.1 * a.groupSize),
          );
        game.setAim(moves[0]?.angle || 0);
        game.fire();
        let frames = 0;
        while (game.s.projectile && frames++ < 200) game.advance(0.25);
        game.advance(0.25);
      }
      return game.snapshot();
    },
  };
}
