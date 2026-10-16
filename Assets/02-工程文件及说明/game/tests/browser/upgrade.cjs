const { chromium, browserPath } = require('../helpers/browser.cjs');
const { spawn } = require('node:child_process');
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');

async function fixture({ combined = false } = {}) {
  const { EndlessGame, MemoryStore } = await import('../../src/core/index.mjs');
  const g = new EndlessGame({ seed: 11 });
  const s = g.exportState();
  const cells = combined
    ? [
        [0, 3, 0],
        [0, 2, 0],
        [0, 4, 2, 'conductor'],
        [0, 5, 3, 'conductor'],
        [0, 6, 4, 'bomb'],
        [1, 4, 2],
        [0, 7, 2, 'target'],
        [1, 6, 3, 'target'],
        [2, 6, 1, 'target'],
      ]
    : [
        [0, 2, 0],
        [0, 3, 0],
        [0, 7, 2, 'target'],
        [0, 8, 3, 'target'],
        [1, 8, 1, 'target'],
      ];
  s.board = cells.map(([r, c, color, kind], i) => ({
    id: 'qa-' + i,
    source: 'system',
    r,
    c,
    color,
    ...(kind ? { kind } : {}),
    ...(kind === 'target' ? { stageId: 1 } : {}),
    ...(kind === 'conductor' ? { networkId: 'network-1' } : {}),
    ...g.pos(r, c),
  }));
  s.stage = {
    id: 1,
    collectedIds: [],
    targetIds: s.board.filter((b) => b.kind === 'target').map((b) => b.id),
    award: 8,
  };
  s.content.reserve = [];
  s.content.credit = 0;
  s.content.initialSystemCount = cells.length;
  s.network.sequence = 1;
  s.network.id = combined ? 'network-1' : null;
  s.network.nextEligibleRefill = 999;
  s.bombPlan = 0;
  s.loadedColor = 4;
  s.nextColor = 0;
  const h = new EndlessGame({ store: new MemoryStore(s) });
  h.coin({ receiptId: 'qa-paid-ten' });
  // Isolated QA setup represents seven prior paid consumptions, never installed on the user origin.
  h.tx((st) => {
    st.paidAmmo = 3;
    st.paidShots = 7;
    st.lowOpportunity.cadenceSeed = 1; // Explicit early-window QA fixture.
  });
  if (combined) {
    h.fire();
    h.tx((st, emit) => {
      Object.assign(st.projectile, h.pos(0, 0));
      h.settle(st, null, emit);
    });
    h.advance(0.25);
    assert.equal(h.snapshot().lowOpportunity.last.status, 'appeared');
    h.tx((st) =>
      Object.assign(st.assist, {
        charge: 3,
        state: 'ready',
        sequence: 1,
        boostId: 'assist-1',
        secondaryColor: 2,
      }),
    );
  }
  h.validate(h.s);
  return h.exportState();
}

(async () => {
  const out = path.resolve(__dirname, '../../../output/verification/v1.5.5/upgrade');
  fs.mkdirSync(out, { recursive: true });
  const server = spawn(process.execPath, [path.resolve(__dirname, '../../tools/server.mjs')], {
    env: { ...process.env, GAME_PORT: '4231' },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let browser;
  const errors = [],
    checks = [];
  try {
    await new Promise((resolve, reject) => {
      server.stdout.once('data', resolve);
      server.once('error', reject);
    });
    browser = await chromium.launch({ executablePath: browserPath(), headless: true });
    async function open(state) {
      const context = await browser.newContext({ viewport: { width: 1100, height: 1050 } });
      await context.addInitScript((state) => {
        if (!sessionStorage.getItem('qa-initialized')) {
          localStorage.setItem('bubble-integrated-v15-machine', JSON.stringify(state));
          sessionStorage.setItem('qa-initialized', 'yes');
        }
      }, state);
      const page = await context.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
      });
      await page.goto('http://127.0.0.1:4231/?test=1');
      await page.waitForFunction(() => window.testGame?.ready);
      await page.locator('summary').filter({ hasText: '维护' }).click();
      await page
        .getByText('QA：保持试玩运行')
        .locator('input')
        .check()
        .catch(async () => {
          await page.locator('aside input[type=checkbox]').last().check();
        });
      await page.locator('#game').click({ force: true });
      return { context, page };
    }
    const { context, page } = await open(await fixture({ combined: true }));
    const initial = await page.evaluate(() => testGame.snapshot());
    assert.equal(initial.assist.state, 'ready');
    await page.locator('#cabinet').screenshot({ path: path.join(out, 'ready.png') });
    await page.keyboard.press('KeyP');
    const frozen = await page.evaluate(() => testGame.upgrade().room.time);
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => testGame.upgrade().room.time), frozen);
    await page.keyboard.press('KeyP');
    checks.push('暂停冻结动态背景，恢复继续');
    await page.evaluate(async () => {
      const { EndlessGame, MemoryStore } = await import('/src/core/index.mjs');
      const saved = JSON.parse(localStorage.getItem('bubble-integrated-v15-machine'));
      const g = new EndlessGame({ store: new MemoryStore(saved) });
      const best = g
        .opportunities()
        .filter((m) => m.groups.filter((a) => a.matched).length === 2)
        .sort((a, b) => b.direct.length + b.dropped.length - a.direct.length - a.dropped.length)[0];
      if (!best) throw Error('No real dual route');
      testGame.aim(best.angle);
    });
    await page.keyboard.press('Space');
    await page.waitForTimeout(180);
    const loading = await page.evaluate(() => ({
      visual: testGame.visual(),
      stats: testGame.stats(),
      upgrade: testGame.upgrade(),
    }));
    assert.ok(loading.upgrade.polish.materials > 0);
    assert.equal(loading.upgrade.voice.buffers, 0, 'no natural clips are claimed');
    await page.locator('#cabinet').screenshot({ path: path.join(out, 'flight.png') });
    await page.waitForFunction(
      () => testGame.events().some((e) => e.type === 'networkPropagated'),
      {},
      { timeout: 12000 },
    );
    await page.waitForTimeout(160);
    const result = await page.evaluate(() => ({
      snapshot: testGame.snapshot(),
      events: testGame.events(),
      stats: testGame.stats(),
      upgrade: testGame.upgrade(),
    }));
    const shot = result.events.filter((e) => e.type === 'paidShotResolved').at(-1).payload;
    assert.equal(shot.explosionCount, 3);
    assert.ok(shot.electricCount > 2, 'electricity strikes ordinary balls as well as conductors');
    assert.equal(new Set(shot.electricIds).size, shot.electricCount);
    assert.equal(shot.bonus, 8);
    assert.equal(
      new Set([...shot.direct, ...shot.dropped].map((b) => b.id)).size,
      shot.direct.length + shot.dropped.length,
    );
    assert.ok(result.upgrade.mechanisms.director.claimed.length > 0);
    assert.deepEqual(result.upgrade.mechanisms.bridge.warnings, []);
    assert.ok(
      result.upgrade.mechanisms.director.lightning.some((e) => e.steps >= 3 && e.pops > 3),
      'ordinary-ball lightning paths actually reach the renderer',
    );
    assert.ok(
      result.upgrade.voice.history.some((c) => c.kind === 'chest' && c.mode === 'text-only'),
    );
    assert.equal(result.stats.feedback.bannerKind, 'reward-voice');
    await page.locator('#cabinet').screenshot({ path: path.join(out, 'combined.png') });
    checks.push('真实弹道一发触发双彩、机会炸弹、导电、原炸弹及宝箱，ID去重与文字准确');
    await page.waitForTimeout(2800);
    const after = await page.evaluate(() => testGame.upgrade());
    assert.equal(after.mechanisms.director.effects, 0);
    assert.equal(after.voice.queued, 0);
    assert.equal(after.words, null);
    await page.reload();
    await page.waitForFunction(() => testGame.ready);
    assert.equal(await page.evaluate(() => testGame.upgrade().voice.history.length), 0);
    assert.equal(
      await page.evaluate(() => testGame.snapshot().tickets.earned),
      result.snapshot.tickets.earned,
    );
    checks.push('演出对象到期回收，刷新不重播奖励且保留账务');
    await context.close();

    const second = await open(await fixture());
    await second.page.keyboard.press('Space');
    await second.page.waitForFunction(
      () => testGame.events().some((e) => e.type === 'lowOpportunityAppeared'),
      {},
      { timeout: 12000 },
    );
    const low = await second.page.evaluate(() => ({
      events: testGame.events(),
      snapshot: testGame.snapshot(),
      upgrade: testGame.upgrade(),
    }));
    assert.equal(low.snapshot.paidAmmo, 2);
    assert.ok(low.upgrade.voice.history.some((c) => c.kind === 'low'));
    await second.page.locator('#cabinet').screenshot({ path: path.join(out, 'last-two.png') });
    checks.push('v2真实低余球登场事件接通提示，原球ID变炸弹可见');
    await second.page.selectOption('#quality', 'low');
    await second.page.locator('#reduce').check();
    await second.page.waitForTimeout(300);
    assert.equal(await second.page.evaluate(() => testGame.upgrade().roomLayer.width), 300);
    const samples = await second.page.evaluate(async () => {
      const frames = [];
      for (let i = 0; i < 35; i++) {
        await new Promise(requestAnimationFrame);
        const balls = testGame.visual().balls;
        frames.push(balls.map((b) => [b.id, b.scaleX, b.scaleY, b.visible]));
      }
      return frames;
    });
    assert.ok(
      samples.flat().every((b) => b[1] > 0.65 && b[2] > 0.65 && Number.isFinite(b[1]) && b[3]),
    );
    checks.push('轻量与减少动态可切换，连续帧没有异常缩放或球体消失');
    await second.page.setViewportSize({ width: 360, height: 900 });
    await second.page.waitForTimeout(200);
    assert.ok(await second.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await second.page.screenshot({ path: path.join(out, 'narrow.png') });
    await second.page.setViewportSize({ width: 1100, height: 1050 });
    await second.page.locator('#game').click({ force: true });
    await second.page.evaluate(() => {
      window.frameAudit = { active: true, frames: 0, invisible: [], badScale: [] };
      function sample() {
        if (!frameAudit.active) return;
        for (const b of testGame.visual().balls) {
          if (!b.visible && frameAudit.invisible.length < 10) frameAudit.invisible.push(b.id);
          if (
            (!Number.isFinite(b.scaleX) || b.scaleX < 0.65 || b.scaleY < 0.65) &&
            frameAudit.badScale.length < 10
          )
            frameAudit.badScale.push(b.id);
        }
        frameAudit.frames++;
        requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    });
    for (let i = 0; i < 22; i++) {
      await second.page.waitForFunction(
        () => testGame.idle && !testGame.stats().scene.boardMoving,
        {},
        { timeout: 12000 },
      );
      if (await second.page.evaluate(() => testGame.snapshot().paidAmmo === 0))
        await second.page.keyboard.press('KeyC');
      const previous = await second.page.evaluate(
        () =>
          testGame
            .events()
            .filter((e) => e.type === 'paidShotResolved')
            .at(-1)?.eventId,
      );
      await second.page.evaluate(() => testGame.bestAim());
      await second.page.keyboard.press('Space');
      await second.page.waitForFunction(
        (id) =>
          testGame
            .events()
            .filter((e) => e.type === 'paidShotResolved')
            .at(-1)?.eventId !== id,
        previous,
        { timeout: 12000 },
      );
    }
    const audit = await second.page.evaluate(() => {
      frameAudit.active = false;
      return frameAudit;
    });
    assert.deepEqual(audit.invisible, []);
    assert.deepEqual(audit.badScale, []);
    assert.ok(audit.frames > 100);
    await second.page.locator('#cabinet').screenshot({ path: path.join(out, 'continuous.png') });
    checks.push('连续22发真实键盘射击与补币，逐帧盘面球未异常隐藏或缩放');
    fs.writeFileSync(path.join(out, 'frame-audit.json'), JSON.stringify(audit, null, 2));
    await second.context.close();
    assert.deepEqual(errors, []);
    checks.push('360px布局无溢出，浏览器和着色器无错误');
    fs.writeFileSync(
      path.join(out, 'report.json'),
      JSON.stringify({ checks, errors, shot, low: low.snapshot.lowOpportunity }, null, 2),
    );
    console.log(JSON.stringify({ checks, errors }));
  } finally {
    await browser?.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
