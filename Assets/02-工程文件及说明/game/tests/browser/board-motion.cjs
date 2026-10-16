const { chromium, browserPath } = require('../helpers/browser.cjs');
const { spawn } = require('node:child_process');
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
(async () => {
  const out = path.resolve(__dirname, '../../../output/verification/v1.5.1/board-motion');
  fs.mkdirSync(out, { recursive: true });
  const server = spawn(process.execPath, [path.resolve(__dirname, '../../tools/server.mjs')], {
    env: { ...process.env, GAME_PORT: '4228' },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let browser;
  const errors = [];
  try {
    await new Promise((resolve, reject) => {
      server.stdout.once('data', resolve);
      server.once('error', reject);
    });
    browser = await chromium.launch({ executablePath: browserPath(), headless: true });
    const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } });
    page.on('pageerror', (e) => errors.push(e.message));
    const { EndlessGame } = await import('../../src/core/index.mjs');
    const saved = new EndlessGame({ seed: 817 }).exportState();
    await page.addInitScript(
      (state) => localStorage.setItem('bubble-integrated-v15-machine', JSON.stringify(state)),
      saved,
    );
    await page.goto('http://127.0.0.1:4228/?test=1');
    await page.waitForFunction(() => window.testGame?.ready);
    const result = await page.evaluate(async () => {
      const { PresentationScene } = await import('/src/presentation/scene.mjs');
      const { EndlessGame } = await import('/src/core/index.mjs');
      const g = new EndlessGame(),
        initial = g.snapshot(),
        saved = JSON.stringify(g.exportState());
      const canvas = document.createElement('canvas');
      canvas.id = 'motion-fixture';
      canvas.style.width = '540px';
      canvas.style.height = '960px';
      document.body.append(canvas);
      const scene = new PresentationScene(canvas);
      const probe = new EndlessGame();
      probe.fire();
      const p = probe.snapshot().projectile;
      scene.apparatus(g.config, Math.hypot(p.x, p.y - g.config.cannonY));
      scene.viewport(0, 1600, 540);
      await scene.ready();
      scene.pet.setEnabled(false);
      scene.petPose = () => {};
      scene.reduced = false;
      scene.sync(initial, g.trace(), 'refined');
      scene.tick(0);
      const restoredWithoutMovement = !scene.isBoardMoving();
      const id = initial.board[0].id,
        start = scene.boardPoint(initial.board[0]);
      const next = structuredClone(initial);
      next.board = initial.board.map((b) => ({ ...b, r: b.r + 1, ...g.pos(b.r + 1, b.c, 1) }));
      const added = Array.from({ length: 9 }, (_, c) => ({
        id: 'qa-row-' + c,
        r: 0,
        c,
        color: c % 5,
        ...g.pos(0, c, 1),
      }));
      next.board.push(...added);
      scene.sync(next, null, 'refined');
      scene.startRefill({ added });
      const first = scene.boardPoint(next.board[0]);
      scene.tick(0.16);
      const mid = scene.boardPoint(next.board[0]),
        target = scene.balls.get(id).metadata.home;
      scene.sync(next, null, 'refined');
      const repeatedSyncStable =
        JSON.stringify(scene.boardPoint(next.board[0])) === JSON.stringify(mid);
      const incoming = scene.balls.get(added[0].id);
      const rowEntering = -incoming.position.y < incoming.metadata.home.y;
      window.motionQA = { scene, next, initial, g };
      return {
        restoredWithoutMovement,
        repeatedSyncStable,
        start,
        first,
        mid,
        target,
        rowEntering,
        unchangedCore: saved === JSON.stringify(g.exportState()),
      };
    });
    assert.ok(result.restoredWithoutMovement);
    assert.ok(result.repeatedSyncStable, '逐帧同步不打断当前动画');
    assert.deepEqual(result.first, result.start, '移盘首帧保持原位置');
    assert.ok(
      result.mid.y > result.start.y && result.mid.y < result.target.y,
      '中间帧在原位与目标之间',
    );
    assert.ok(result.rowEntering);
    assert.ok(result.unchangedCore);
    await page.locator('#motion-fixture').screenshot({ path: path.join(out, 'moving.png') });
    const end = await page.evaluate(() => {
      const { scene, next } = motionQA;
      scene.tick(0.5);
      return {
        moving: scene.isBoardMoving(),
        q: scene.boardPoint(next.board[0]),
        target: scene.balls.get(next.board[0].id).metadata.home,
      };
    });
    assert.equal(end.moving, false);
    assert.deepEqual(end.q, end.target);
    await page.locator('#motion-fixture').screenshot({ path: path.join(out, 'settled.png') });
    const reduced = await page.evaluate(() => {
      const { scene, initial } = motionQA;
      scene.reduced = true;
      scene.sync(initial, null, 'refined');
      scene.tick(0.15);
      return {
        moving: scene.isBoardMoving(),
        point: scene.boardPoint(initial.board[0]),
        target: scene.balls.get(initial.board[0].id).metadata.home,
      };
    });
    assert.equal(reduced.moving, false);
    assert.deepEqual(reduced.point, reduced.target);
    await page.getByText('QA：保持试玩运行').locator('input').check();
    await page.locator('#game').click({ force: true });
    let found = false;
    for (let i = 0; i < 40 && !found; i++) {
      await page.waitForFunction(() => testGame.idle && !testGame.stats().scene.boardMoving);
      if (await page.evaluate(() => testGame.snapshot().paidAmmo === 0))
        await page.keyboard.press('KeyC');
      const before = await page.evaluate(
        () =>
          testGame
            .events()
            .filter((e) => e.type === 'paidShotResolved')
            .at(-1)?.eventId,
      );
      await page.evaluate(() => testGame.bestAim());
      await page.keyboard.press('Space');
      await page.waitForFunction(
        (n) =>
          testGame
            .events()
            .filter((e) => e.type === 'paidShotResolved')
            .at(-1)?.eventId !== n,
        before,
      );
      await page.waitForFunction(() => testGame.stats().scene.boardMoving || testGame.idle);
      found = await page.evaluate(
        () => testGame.stats().scene.boardMoving && testGame.snapshot().paidAmmo > 0,
      );
    }
    assert.ok(found, '真实付费补球应启动入场过渡');
    const buffered = await page.evaluate(() => {
      const ammo = testGame.snapshot().paidAmmo;
      const count = testGame.events().filter((e) => e.type === 'shotAccepted').length;
      for (let i = 0; i < 2; i++) {
        dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
        dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
      }
      return { ammo, count };
    });
    await page.waitForFunction(
      (n) => testGame.events().filter((e) => e.type === 'shotAccepted').length > n,
      buffered.count,
    );
    const shot = await page.evaluate(() => ({
      ammo: testGame.snapshot().paidAmmo,
      count: testGame.events().filter((e) => e.type === 'shotAccepted').length,
      moving: testGame.stats().scene.boardMoving,
    }));
    assert.equal(shot.ammo, buffered.ammo - 1);
    assert.equal(shot.count, buffered.count + 1);
    assert.equal(shot.moving, false, '到位后才发出一次暂存输入');
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(out, 'report.json'),
      JSON.stringify(
        {
          passed: true,
          result,
          end,
          reduced,
          buffered,
          shot,
          errors,
          fixture: 'isolated browser storage and presentation snapshots; no user state changed',
        },
        null,
        2,
      ),
    );
    console.log(
      '移盘首帧、中间帧、准确到位、新层延后入场、初始恢复和减少动态模式通过；核心状态未变',
    );
  } finally {
    await browser?.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
