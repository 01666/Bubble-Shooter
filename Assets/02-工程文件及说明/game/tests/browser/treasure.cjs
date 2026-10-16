const { chromium, browserPath } = require('../helpers/browser.cjs');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const { EndlessGame, MemoryStore } = await import('../../src/core/index.mjs');
  const out = path.resolve(__dirname, '../../../output/verification/v1.5.1/treasure');
  fs.mkdirSync(out, { recursive: true });
  const server = spawn(process.execPath, [path.resolve(__dirname, '../../tools/server.mjs')], {
    env: { ...process.env, GAME_PORT: '4227' },
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
    browser = await chromium.launch({
      executablePath: browserPath(),
      headless: true,
      args: ['--enable-webgl', '--ignore-gpu-blocklist'],
    });
    const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    const url = 'http://127.0.0.1:4227/?test=1';
    async function boot(state) {
      await page.goto(url);
      if (state) {
        await page.evaluate(
          (s) => localStorage.setItem('bubble-integrated-v15-machine', JSON.stringify(s)),
          state,
        );
        await page.reload();
      }
      await page.waitForFunction(() => window.testGame?.ready);
      await page.waitForFunction(() => testGame.stats().feedback.treasure?.award > 0);
    }
    await boot();
    const before = await page.evaluate(() => testGame.snapshot());
    assert.equal(
      (await page.evaluate(() => testGame.stats().feedback.treasure)).award,
      before.stage.award,
    );
    await page.locator('#cabinet').screenshot({ path: path.join(out, 'free.png') });
    await page.keyboard.press('Space');
    await page.waitForFunction(() => testGame.events().some((e) => e.type === 'freeShotExited'));
    assert.deepEqual((await page.evaluate(() => testGame.snapshot())).stage, before.stage);
    assert.equal(await page.evaluate(() => testGame.stats().feedback.confirmedPaper), false);
    await page.reload();
    await page.waitForFunction(() => window.testGame?.ready);
    assert.deepEqual((await page.evaluate(() => testGame.snapshot())).stage, before.stage);
    checks.push('公开奖量等于已保存奖量；免费试射与刷新保持本轮目标');
    function fixture(progress) {
      const g = new EndlessGame(),
        s = g.exportState();
      s.board = [3, 4, 5].slice(progress).map((col, i) => ({
        id: 'target-' + (i + progress),
        source: 'system',
        r: 0,
        c: col,
        color: 0,
        kind: 'target',
        stageId: 1,
        ...g.pos(0, col),
      }));
      s.stage = {
        id: 1,
        targetIds: ['target-0', 'target-1', 'target-2'],
        collectedIds: ['target-0', 'target-1'].slice(0, progress),
        award: 8,
      };
      s.content.reserve = [];
      s.content.credit = 0;
      s.content.initialSystemCount = s.board.length;
      s.network.id = null;
      s.loadedColor = 0;
      s.nextColor = 0;
      return new EndlessGame({ store: new MemoryStore(s) }).exportState();
    }
    await boot(fixture(2));
    assert.equal((await page.evaluate(() => testGame.stats().feedback.treasure)).progress, 2);
    await page.locator('#cabinet').screenshot({ path: path.join(out, 'one-left.png') });
    await page.setViewportSize({ width: 360, height: 800 });
    await page.locator('#cabinet').screenshot({ path: path.join(out, 'narrow.png') });
    await page.evaluate(() => {
      const input = document.getElementById('reduce');
      input.checked = true;
      input.dispatchEvent(new Event('change'));
    });
    await page.locator('#cabinet').screenshot({ path: path.join(out, 'reduced.png') });
    await page.setViewportSize({ width: 1100, height: 1000 });
    await page.evaluate(() => {
      const input = document.getElementById('reduce');
      input.checked = false;
      input.dispatchEvent(new Event('change'));
    });
    await boot(fixture(0));
    await page.keyboard.press('KeyC');
    await page.waitForFunction(() => testGame.snapshot().paidAmmo === 10);
    await page.evaluate(() => {
      testGame.aim(0);
      testGame.fire();
    });
    await page.waitForFunction(
      () =>
        testGame.stats().feedback.rewardFlights.units > 0 &&
        testGame.stats().feedback.rewardFlights.arrivals === 0,
    );
    assert.equal(
      await page.evaluate(() => testGame.stats().scene.rewardPulseActive),
      false,
      'flight starts before number pulse',
    );
    await page.waitForFunction(() => testGame.stats().feedback.treasure?.open > 0.5);
    const opening = await page.evaluate(() => ({
      treasure: testGame.stats().feedback.treasure,
      events: testGame.events(),
      snapshot: testGame.snapshot(),
      pet: testGame.stats().pet,
    }));
    assert.equal(opening.treasure.award, 8);
    assert.equal(opening.treasure.progress, 3);
    assert.equal(opening.events.filter((e) => e.type === 'stageBonusEarned').length, 1);
    assert.equal(opening.events.find((e) => e.type === 'stageBonusEarned').payload.count, 8);
    assert.equal(opening.snapshot.paidAmmo, 9);
    assert.equal(opening.pet.mode, 'complete');
    await page.locator('#cabinet').screenshot({ path: path.join(out, 'opening.png') });
    await page.waitForFunction(
      () => testGame.stats().feedback.confirmedPaper && testGame.snapshot().tickets.confirmed > 0,
    );
    await page.locator('#cabinet').screenshot({ path: path.join(out, 'ticket-ribbon.png') });
    await page.waitForFunction(
      () =>
        testGame.stats().feedback.rewardFlights.pops > 0 &&
        testGame.stats().feedback.rewardFlights.flying > 0 &&
        testGame.stats().scene.rewardPulseActive,
    );
    await page.keyboard.press('KeyP');
    await page.locator('#cabinet').screenshot({ path: path.join(out, 'flying-tickets.png') });
    await page.keyboard.press('KeyP');
    await page.waitForFunction(
      () =>
        testGame.stats().feedback.rewardFlights.queued === 0 &&
        testGame.stats().feedback.rewardFlights.flying === 0,
    );
    const flights = await page.evaluate(() => testGame.stats().feedback.rewardFlights);
    assert.equal(flights.units, opening.snapshot.tickets.earned);
    assert.equal(
      flights.arrivals,
      flights.units,
      'each earned ticket produces exactly one +1 arrival',
    );
    const ticks = await page.evaluate(
      () => testGame.audio().history.filter((e) => e.cue === 'score_tick').length,
    );
    assert.equal(ticks, flights.arrivals, 'each visible +1 has a synchronized score ping');
    checks.push('普通获票与宝箱加奖：每张仅产生一个+1，且每次+1同步一声得分音效');
    await page.waitForFunction(() => testGame.stats().feedback.treasure?.stageId === 2);
    const next = await page.evaluate(() => testGame.snapshot());
    assert.equal(
      (await page.evaluate(() => testGame.stats().feedback.treasure)).award,
      next.stage.award,
    );
    await page.reload();
    await page.waitForFunction(() => window.testGame?.ready);
    const restored = await page.evaluate(() => testGame.snapshot());
    assert.deepEqual(restored.stage, next.stage);
    assert.equal(restored.paidAmmo, next.paidAmmo);
    assert.equal(restored.tickets.earned, next.tickets.earned);
    assert.equal(
      await page.evaluate(() => testGame.stats().feedback.rewardFlights.units),
      0,
      '刷新不重播旧获票',
    );
    checks.push(
      '测试盘面同一发收齐3星，只发一次固定8张奖励；宠物与开箱同步；下一轮奖量正确；刷新保留余球和总获票',
    );
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(out, 'report.json'),
      JSON.stringify(
        {
          passed: true,
          checks,
          errors,
          screenshots: 'one-left/opening use isolated QA fixtures, never user storage',
        },
        null,
        2,
      ),
    );
    console.log(checks.join('\n'));
  } finally {
    await browser?.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
