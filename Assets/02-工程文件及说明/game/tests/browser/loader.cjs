const { chromium } = require('../helpers/browser.cjs');
const { spawn } = require('node:child_process'),
  path = require('node:path'),
  fs = require('node:fs'),
  assert = require('node:assert/strict');
(async () => {
  const server = spawn(process.execPath, [path.join(__dirname, '../../tools/server.mjs')], {
    env: { ...process.env, GAME_PORT: '4226' },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let browser;
  try {
    await new Promise((ok, no) => {
      server.stdout.once('data', ok);
      server.once('error', no);
    });
    browser = await chromium.launch({
      executablePath: require('../helpers/browser.cjs').browserPath(),
      headless: true,
      args: ['--enable-webgl', '--ignore-gpu-blocklist'],
    });
    const context = await browser.newContext({ viewport: { width: 900, height: 1600 } }),
      page = await context.newPage(),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('http://127.0.0.1:4226/?test=1');
    await page.waitForFunction(() => window.testGame?.ready);
    await page.waitForTimeout(400);
    const initial = await page.evaluate(() => testGame.snapshot());
    await page.keyboard.press('Space');
    await page.waitForTimeout(100);
    assert.equal(
      await page.evaluate(() => testGame.stats().scene.loader.active),
      false,
      '免费试射不取走下一球',
    );
    await page.waitForFunction(() => testGame.idle);
    await page.keyboard.press('KeyC');
    await page.waitForFunction(() => testGame.snapshot().paidAmmo === 10);
    const before = await page.evaluate(() => testGame.snapshot());
    await page.keyboard.press('Space');
    await page.waitForFunction(() => testGame.stats().scene.loader.active);
    const start = await page.evaluate(() => testGame.stats().scene.loader);
    assert.equal(start.color, before.nextColor);
    assert.equal(start.loadedVisible, false);
    assert.equal(start.previewVisible, false);
    await page.waitForTimeout(120);
    const mid = await page.evaluate(() => testGame.stats().scene.loader);
    assert.ok(mid.active);
    assert.ok(mid.position.x < start.position.x && mid.position.x > 450);
    await page.locator('#cabinet').screenshot({
      path: path.join(__dirname, '../../../output/verification/v1.0', 'loading.png'),
    });
    await page.waitForFunction(() => !testGame.stats().scene.loader.active);
    await page.waitForFunction(() => testGame.idle);
    const after = await page.evaluate(() => testGame.snapshot());
    assert.equal(after.loadedColor, before.nextColor);
    assert.equal(after.paidAmmo, 9);
    assert.equal(await page.evaluate(() => testGame.stats().scene.loader.previewVisible), true);
    await page.reload();
    await page.waitForFunction(() => testGame.ready);
    assert.deepEqual((await page.evaluate(() => testGame.snapshot())).board, after.board);
    await page.locator('#cabinet').screenshot({
      path: path.join(__dirname, '../../../output/verification/v1.0', 'final-ui.png'),
    });
    const other = await browser.newContext();
    const page2 = await other.newPage();
    await page2.goto('http://127.0.0.1:4226/?test=1');
    await page2.waitForFunction(() => testGame.ready);
    assert.notDeepEqual((await page2.evaluate(() => testGame.snapshot())).board, initial.board);
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        checks: [
          '免费试射不取预览球',
          '付费装填沿曲线移动，原位球隐藏',
          '装填颜色与预览一致，仅扣1球',
          '装填完成恢复预览',
          '刷新继续公共盘面',
          '新建机器随机盘面',
        ],
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
