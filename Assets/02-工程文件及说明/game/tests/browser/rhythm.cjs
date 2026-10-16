const { chromium, browserPath } = require('../helpers/browser.cjs');
const { spawn } = require('node:child_process');
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
(async () => {
  const out = path.resolve(__dirname, '../../../output/verification/v1.5.1/rhythm');
  fs.mkdirSync(out, { recursive: true });
  const server = spawn(process.execPath, [path.resolve(__dirname, '../../tools/server.mjs')], {
    env: { ...process.env, GAME_PORT: '4234' },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let browser;
  const errors = [],
    counts = [],
    heights = [];
  try {
    await new Promise((res, rej) => {
      server.stdout.once('data', res);
      server.once('error', rej);
    });
    browser = await chromium.launch({ executablePath: browserPath(), headless: true });
    const page = await browser.newPage({ viewport: { width: 1100, height: 1050 } });
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    const { EndlessGame } = await import('../../src/core/index.mjs');
    await page.addInitScript(
      (saved) => {
        if (!sessionStorage.getItem('seeded')) {
          localStorage.setItem('bubble-integrated-v15-machine', JSON.stringify(saved));
          sessionStorage.setItem('seeded', '1');
        }
      },
      new EndlessGame({ seed: 817 }).exportState(),
    );
    await page.goto('http://127.0.0.1:4234/?test=1');
    await page.waitForFunction(() => window.testGame?.ready);
    await page.locator('summary').filter({ hasText: '维护' }).click();
    await page.getByText('QA：保持试玩运行').locator('input').check();
    await page.locator('#game').click({ force: true });
    const initial = await page.evaluate(() => testGame.visual().balls);
    const width = Math.max(...initial.map((b) => b.x)) - Math.min(...initial.map((b) => b.x)) + 80;
    const height = Math.max(...initial.map((b) => b.y)) - Math.min(...initial.map((b) => b.y)) + 80;
    const footprint = (width * height) / (900 * 1600);
    assert.ok(footprint > 0.32 && footprint < 0.36);
    await page.locator('#cabinet').screenshot({ path: path.join(out, 'dense-free.png') });
    const before = await page.evaluate(() => testGame.upgrade());
    await page.waitForTimeout(900);
    const after = await page.evaluate(() => testGame.upgrade());
    assert.ok(after.roomLayer.updates > before.roomLayer.updates);
    assert.ok(after.polish.applied >= 72, 'shader must actually replace live materials');
    const captureOrb = async () =>
      page.evaluate(() => {
        const game = document.getElementById('game'),
          b = testGame.visual().balls[0];
        const c = document.createElement('canvas');
        c.width = 64;
        c.height = 64;
        const x = c.getContext('2d');
        x.drawImage(
          game,
          ((b.x - 32) * game.width) / 900,
          ((b.y - 32) * game.height) / 1600,
          (64 * game.width) / 900,
          (64 * game.height) / 1600,
          0,
          0,
          64,
          64,
        );
        return [...x.getImageData(0, 0, 64, 64).data];
      });
    const firstPixels = await captureOrb();
    await page.waitForTimeout(1100);
    const secondPixels = await captureOrb();
    const pixelMotion =
      firstPixels.reduce((n, v, i) => n + Math.abs(v - secondPixels[i]), 0) / firstPixels.length;
    assert.ok(pixelMotion > 1.5, `real orb pixels must change, measured ${pixelMotion}`);
    await page.evaluate(() => {
      window.audit = { active: true, frames: 0, bad: [] };
      function sample() {
        if (!audit.active) return;
        for (const b of testGame.visual().balls)
          if (!b.visible || !Number.isFinite(b.scaleX) || b.scaleX < 0.65) {
            if (audit.bad.length < 10) audit.bad.push(b.id);
          }
        audit.frames++;
        requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    });
    let peakFootprint = 0;
    for (let i = 0; i < 60; i++) {
      await page.waitForFunction(
        () => testGame.idle && !testGame.stats().scene.boardMoving,
        {},
        { timeout: 15000 },
      );
      if (await page.evaluate(() => testGame.snapshot().paidAmmo === 0))
        await page.keyboard.press('KeyC');
      const previous = await page.evaluate(
        () =>
          testGame
            .events()
            .filter((e) => e.type === 'paidShotResolved')
            .at(-1)?.eventId,
      );
      if (i % 3 === 0) await page.evaluate((i) => testGame.aim(Math.sin(i * 1.731) * 1.1), i);
      else await page.evaluate(() => testGame.bestAim());
      await page.keyboard.press('Space');
      await page.waitForFunction(
        (id) =>
          testGame
            .events()
            .filter((e) => e.type === 'paidShotResolved')
            .at(-1)?.eventId !== id,
        previous,
        { timeout: 15000 },
      );
      counts.push(await page.evaluate(() => testGame.snapshot().board.length));
      await page.waitForFunction(() => testGame.idle && !testGame.stats().scene.boardMoving);
      heights.push(
        await page.evaluate(() => {
          const s = testGame.snapshot();
          return Array.from({ length: 9 }, (_, c) =>
            Math.max(0, ...s.board.filter((b) => b.c === c).map((b) => b.r + 1)),
          ).sort((a, b) => a - b)[5];
        }),
      );
      if (i === 7) {
        await page.waitForTimeout(300);
        await page.locator('#cabinet').screenshot({ path: path.join(out, 'dense-last-two.png') });
      }
      if (i === 17) {
        await page.waitForFunction(() => testGame.idle && !testGame.stats().scene.boardMoving);
        peakFootprint = await page.evaluate(() => {
          const bs = testGame.visual().balls;
          return (
            ((Math.max(...bs.map((b) => b.x)) - Math.min(...bs.map((b) => b.x)) + 80) *
              (Math.max(...bs.map((b) => b.y)) - Math.min(...bs.map((b) => b.y)) + 80)) /
            (900 * 1600)
          );
        });
        assert.ok(peakFootprint > 0 && peakFootprint < 0.7);
        await page.locator('#cabinet').screenshot({ path: path.join(out, 'peak-tide.png') });
      }
    }
    await page.waitForFunction(() => testGame.idle && !testGame.stats().scene.boardMoving);
    const audit = await page.evaluate(() => {
      audit.active = false;
      return audit;
    });
    assert.deepEqual(audit.bad, []);
    assert.ok(audit.frames > 100);
    assert.ok(
      new Set(counts).size > 5,
      'clears leave real space rather than restoring a fixed count',
    );
    await page.locator('#cabinet').screenshot({ path: path.join(out, 'dense-played.png') });
    const state = await page.evaluate(() => testGame.snapshot());
    assert.ok(state.lowOpportunity.sequence >= 1);
    await page.reload();
    await page.waitForFunction(() => window.testGame?.ready);
    const restored = await page.evaluate(() => testGame.snapshot());
    assert.deepEqual(restored.board, state.board);
    assert.equal(restored.paidAmmo, state.paidAmmo);
    assert.deepEqual(errors, []);
    const report = {
      footprint,
      peakFootprint,
      pixelMotion,
      heights,
      bandFraction: heights.filter((n) => n >= 7 && n <= 8).length / heights.length,
      counts,
      audit,
      errors,
      opportunity: state.lowOpportunity,
      checks: [
        '随机初始盘面60次键盘射击，消除留空与顶部波次推进',
        '补球逐帧无异常隐藏或缩放',
        '动态背景持续刷新、72球材质实际替换及球体像素变化',
        '刷新保留公共布局与余球',
      ],
    };
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    console.log(
      JSON.stringify({
        footprint,
        peakFootprint,
        pixelMotion,
        bandFraction: heights.filter((n) => n >= 7 && n <= 8).length / heights.length,
        heights,
        counts,
        frames: audit.frames,
        errors,
      }),
    );
  } finally {
    await browser?.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
