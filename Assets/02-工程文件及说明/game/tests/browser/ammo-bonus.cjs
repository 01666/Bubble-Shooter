const { chromium, browserPath } = require('../helpers/browser.cjs');
const { spawn } = require('node:child_process');
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
(async () => {
  const { EndlessGame } = await import('../../src/core/index.mjs');
  const g = new EndlessGame({ seed: 817 });
  g.coin({ receiptId: 'gift-qa' });
  g.tx((st) => {
    st.board = Array.from({ length: 6 }, (_, c) => ({
      id: 'gift-target-' + c,
      r: 0,
      c,
      color: 0,
      source: 'system',
      ...g.pos(0, c),
    }));
    st.content.reserve = [];
    st.content.credit = 0;
    st.content.initialSystemCount = 6;
    st.stage.targetIds = [];
    st.stage.collectedIds = [];
    st.network.id = null;
    st.loadedColor = st.nextColor = 0;
    st.bombPlan = 0;
  });
  const move = { angle: 0 },
    saved = g.exportState();
  const out = path.resolve(__dirname, '../../../output/verification/v1.5.5/ammo-bonus');
  fs.mkdirSync(out, { recursive: true });
  const server = spawn(process.execPath, [path.resolve(__dirname, '../../tools/server.mjs')], {
    env: { ...process.env, GAME_PORT: '4242' },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let browser;
  const errors = [];
  try {
    await new Promise((r, j) => {
      server.stdout.once('data', r);
      server.once('error', j);
    });
    browser = await chromium.launch({ executablePath: browserPath(), headless: true });
    const page = await browser.newPage({ viewport: { width: 1100, height: 1050 } });
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.addInitScript((s) => {
      if (!sessionStorage.getItem('fixture-installed')) {
        localStorage.setItem('bubble-integrated-v15-machine', JSON.stringify(s));
        sessionStorage.setItem('fixture-installed', '1');
      }
    }, saved);
    await page.goto('http://127.0.0.1:4242/?test=1');
    await page.waitForFunction(() => window.testGame?.ready);
    await page.locator('#game').click({ force: true });
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(() => testGame.audio().buffers === 34);
    await page.evaluate((a) => testGame.aim(a), move.angle);
    await page.locator('#cabinet').screenshot({ path: path.join(out, 'pet-and-scene.png') });
    await page.keyboard.press('Space');
    await page.waitForFunction(() => testGame.events().some((e) => e.type === 'ammoBonusEarned'));
    await page.waitForFunction(() => testGame.upgrade().words?.label.includes('赠送2颗泡泡'));
    await page.locator('#cabinet').screenshot({ path: path.join(out, 'gift-award.png') });
    const state = await page.evaluate(() => testGame.snapshot());
    assert.equal(state.paidAmmo, 11);
    assert.equal(state.ammoBonusTotal, 2);
    assert.equal(state.tickets.earned, 7);
    const clips = await page.evaluate(
      () => testGame.audio().history.filter((e) => e.cue === 'ammo_bonus').length,
    );
    assert.equal(clips, 1);
    await page.keyboard.press('KeyP');
    await page.waitForTimeout(40);
    const scene = await page.evaluate(() => testGame.visual());
    await page.waitForTimeout(200);
    assert.equal((await page.evaluate(() => testGame.visual())).clock, scene.clock);
    await page.keyboard.press('KeyP');
    await page.waitForTimeout(2300);
    await page.reload();
    await page.waitForFunction(() => window.testGame?.ready);
    assert.equal((await page.evaluate(() => testGame.snapshot())).ammoBonusTotal, 2);
    assert.equal((await page.evaluate(() => testGame.snapshot())).paidAmmo, 11);
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(out, 'report.json'),
      JSON.stringify(
        { giftedBalls: 2, ammoAfter: 11, earned: 7, bonusSounds: clips, errors },
        null,
        2,
      ),
    );
    console.log(
      'Seven cleared balls grant two balls; explicit gift caption, one reward sound, pause and reload passed',
    );
  } finally {
    await browser?.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
