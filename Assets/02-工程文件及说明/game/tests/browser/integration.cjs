const { chromium } = require('../helpers/browser.cjs');
const { spawn } = require('node:child_process'),
  fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
(async () => {
  const out = path.join(__dirname, '../../../output/verification/v1.0');
  fs.mkdirSync(out, { recursive: true });
  const server = spawn(process.execPath, [path.join(__dirname, '../../tools/server.mjs')], {
    env: { ...process.env, GAME_PORT: '4225' },
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
      executablePath: require('../helpers/browser.cjs').browserPath(),
      headless: true,
      args: ['--enable-webgl', '--ignore-gpu-blocklist'],
    });
    const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.goto('http://127.0.0.1:4225/?test=1');
    await page.waitForFunction(() => window.testGame?.ready);
    await page.waitForTimeout(300);
    assert.equal(await page.locator('#free').isVisible(), true);
    await page.locator('#cabinet').screenshot({ path: path.join(out, 'free.png') });
    await page.evaluate(() => testGame.aim(0));
    let aimClock = await page.evaluate(() => testGame.visual().clock);
    await page.keyboard.down('ArrowRight');
    await page.waitForFunction((t) => testGame.visual().clock >= t + 0.065, aimClock);
    await page.keyboard.up('ArrowRight');
    const tap = (await page.evaluate(() => testGame.snapshot())).angle;
    assert.ok(tap > 0 && tap < 0.045, '短按角度应小于0.045弧度');
    await page.evaluate(() => testGame.aim(0));
    aimClock = await page.evaluate(() => testGame.visual().clock);
    await page.keyboard.down('ArrowRight');
    await page.waitForFunction((t) => testGame.visual().clock >= t + 0.65, aimClock);
    await page.keyboard.up('ArrowRight');
    const hold = (await page.evaluate(() => testGame.snapshot())).angle;
    assert.ok(hold > 0.17 && hold < 0.49, '长按渐进速度');
    await page.evaluate(() => testGame.aim(0));
    await page.keyboard.down('Shift');
    aimClock = await page.evaluate(() => testGame.visual().clock);
    await page.keyboard.down('ArrowRight');
    await page.waitForFunction((t) => testGame.visual().clock >= t + 0.65, aimClock);
    await page.keyboard.up('ArrowRight');
    await page.keyboard.up('Shift');
    const fine = (await page.evaluate(() => testGame.snapshot())).angle;
    assert.ok(fine > 0 && fine < hold * 0.65);
    await page.evaluate(() => testGame.aim(0));
    checks.push('真实按键短按微调、长按加速和Shift精细控制');
    const initial = await page.evaluate(() => testGame.snapshot());
    assert.equal(initial.board.filter((b) => b.kind === 'target').length, 3);
    assert.ok(initial.board.some((b) => b.kind === 'bomb'));
    assert.ok(initial.network.nodes.length <= 3);
    assert.equal(await page.locator('#feedback').isVisible(), true);
    checks.push('统一反馈层和特殊球标记启用');
    await page.keyboard.press('Space');
    await page.waitForFunction(() => testGame.events().some((e) => e.type === 'freeShotExited'));
    const free = await page.evaluate(() => testGame.snapshot());
    assert.deepEqual(free.board, initial.board);
    assert.deepEqual(free.stage, initial.stage);
    assert.equal(free.tickets.earned, 0);
    checks.push('免费换球不改盘不获票，常驻提示');
    await page.keyboard.press('KeyC');
    await page.waitForFunction(() => testGame.snapshot().paidAmmo === 10);
    assert.equal((await page.evaluate(() => testGame.snapshot())).loadedColor, free.loadedColor);
    assert.equal(await page.locator('#free').isVisible(), false);
    await page.waitForFunction(
      () => testGame.audio().baseMusicInstances === 1 && testGame.audio().buffers === 34,
    );
    checks.push('键盘投币10球保色，提示退出，音乐解锁');
    await page.locator('summary').filter({ hasText: '维护' }).click();
    await page.click('#jam');
    for (let i = 0; i < 10; i++) {
      await page.waitForFunction(() => testGame.idle);
      await page.evaluate(() => {
        let best = -1,
          angle = 0;
        const s = testGame.snapshot();
        for (let a = -1.1; a < 1.1; a += 0.035) {
          const t = testGame.trace(a).target;
          if (!t) continue;
          const score =
            (t.color === s.loadedColor ? 10 : 0) +
            s.board.filter(
              (b) => b.color === s.loadedColor && Math.hypot(b.x - t.x, b.y - t.y) < 1.5,
            ).length;
          if (score > best) {
            best = score;
            angle = a;
          }
        }
        testGame.aim(angle);
        testGame.fire();
      });
      await page.waitForFunction(() => !testGame.snapshot().projectile);
      await page.waitForTimeout(240);
    }
    const played = await page.evaluate(() => testGame.snapshot());
    assert.equal(played.paidAmmo, 0);
    assert.ok(played.tickets.earned > 0);
    assert.equal(played.tickets.pending, played.tickets.earned);
    assert.equal(await page.locator('#device-fault').isVisible(), true);
    assert.equal(await page.locator('#free').isVisible(), false);
    checks.push('卡票时故障提示优先，无免费提示叠加');
    await page.reload();
    await page.waitForFunction(() => window.testGame?.ready);
    const restored = await page.evaluate(() => testGame.snapshot());
    assert.deepEqual(restored.board, played.board);
    assert.deepEqual(restored.stage, played.stage);
    checks.push('公共阶段进度刷新保留');
    assert.equal(restored.tickets.earned, played.tickets.earned);
    checks.push('刷新保留盘面和彩票账务');
    await page.waitForFunction(
      () => testGame.snapshot().tickets.pending === 0,
      {},
      { timeout: 30000 },
    );
    checks.push('自动出票确认后待出票归零');
    await page.click('#coin');
    await page.waitForFunction(() => testGame.snapshot().paidAmmo === 10);
    await page.locator('#cabinet').screenshot({ path: path.join(out, 'paid.png') });
    checks.push('投币按钮与键盘统一');
    const base = await page.evaluate(() => testGame.snapshot().tickets.earned);
    await page.evaluate(() => testGame.fastShots(24));
    await page.waitForTimeout(100);
    await page.locator('#cabinet').screenshot({ path: path.join(out, 'burst.png') });
    await page.waitForTimeout(2300);
    const committed = await page.evaluate(() => testGame.events());
    assert.ok(committed.some((e) => e.type === 'explosionResolved'));
    assert.ok(
      (await page.evaluate(() => testGame.snapshot().tickets.earned)) > base,
      '真实消除增加彩票；随机盘面不要求固定24发完成星星目标',
    );
    const merged = await page.evaluate(() => testGame.stats().feedback);
    assert.equal(
      merged.sessionEarned,
      (await page.evaluate(() => testGame.snapshot().tickets.earned)) - base,
    );
    assert.ok(
      !merged.diagnostics.some(
        (d) => d.code === 'missing-shotId' || d.code === 'bonus-without-target-event',
      ),
    );
    checks.push('24发真实核心事件正确合并，爆炸及已产生的奖励准确累计');
    await page.keyboard.press('KeyP');
    await page.waitForFunction(() => testGame.audio().state === 'suspended');
    await page.keyboard.press('KeyP');
    await page.waitForFunction(() => testGame.audio().state === 'running');
    await page.evaluate(() => {
      for (let i = 0; i < 10; i++) document.getElementById('music').click();
    });
    assert.equal((await page.evaluate(() => testGame.audio())).baseMusicInstances, 1);
    checks.push('暂停恢复与重复解锁无叠加音乐');
    await page.setViewportSize({ width: 360, height: 900 });
    await page.waitForTimeout(300);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(out, 'narrow.png'), fullPage: true });
    const stats = await page.evaluate(() => testGame.stats());
    assert.equal(stats.scene.feedback.groups, 0);
    assert.ok(stats.pet);
    assert.deepEqual((await page.evaluate(() => testGame.audio())).errors, []);
    assert.deepEqual(errors, []);
    checks.push('旧消除特效已关闭，新宠物和34项音频正常');
    checks.push('360px无溢出，无浏览器异常');
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ checks, errors }, null, 2));
    console.log(JSON.stringify({ checks, errors }));
  } finally {
    await browser?.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
