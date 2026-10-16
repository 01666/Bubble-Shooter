const { chromium, browserPath } = require('../helpers/browser.cjs');
const { spawn } = require('node:child_process');
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
(async () => {
  const { EndlessGame } = await import('../../src/core/index.mjs');
  const g = new EndlessGame({ seed: 817 });
  g.coin({ receiptId: 'isolated-burst-credit' });
  g.tx((s) => {
    s.paidAmmo = 3;
    s.paidShots = 7;
    s.lowOpportunity.cadenceSeed = 17;
    for (const b of s.board.filter((b) => !b.kind && b.r < 4).slice(0, 14)) b.kind = 'bomb';
  });
  const move = g.opportunities().find((m) => !m.direct.length && m.cell);
  assert.ok(move, 'fixture must have a genuine non-clearing landing');
  g.setAim(move.angle);
  const saved = g.exportState();
  const out = path.resolve(__dirname, '../../../output/verification/v1.5.5/burst');
  fs.mkdirSync(out, { recursive: true });
  const server = spawn(process.execPath, [path.resolve(__dirname, '../../tools/server.mjs')], {
    env: { ...process.env, GAME_PORT: '4241' },
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
    await page.goto('http://127.0.0.1:4241/?test=1');
    await page.waitForFunction(() => window.testGame?.ready);
    await page.locator('#game').click({ force: true });
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(() => testGame.audio().buffers === 34);
    await page.evaluate((a) => testGame.aim(a), move.angle);
    await page.locator('#cabinet').screenshot({ path: path.join(out, 'pet-and-scene.png') });
    await page.keyboard.press('Space');
    await page.waitForFunction(
      () => testGame.events().filter((e) => e.type === 'lowOpportunityAppeared').length === 5,
    );
    await page.waitForTimeout(180);
    await page.locator('#cabinet').screenshot({ path: path.join(out, 'five-ball-arrival.png') });
    const state = await page.evaluate(() => testGame.snapshot());
    assert.equal(state.lowOpportunity.targets.length, 5);
    assert.equal(state.board.filter((b) => b.kind === 'bomb').length, 20);
    assert.equal(state.tickets.earned, 0);
    const clips = await page.evaluate(
      () => testGame.audio().history.filter((e) => e.cue === 'target_3').length,
    );
    assert.equal(clips, 1, 'one group sound, not five stacked sounds');
    await page.keyboard.press('KeyP');
    await page.waitForTimeout(40);
    const scene = await page.evaluate(() => testGame.visual());
    await page.waitForTimeout(200);
    assert.equal((await page.evaluate(() => testGame.visual())).clock, scene.clock);
    await page.keyboard.press('KeyP');
    await page.waitForTimeout(2300);
    await page.reload();
    await page.waitForFunction(() => window.testGame?.ready);
    assert.equal((await page.evaluate(() => testGame.snapshot())).lowOpportunity.targets.length, 5);
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(out, 'report.json'),
      JSON.stringify(
        { specialBalls: 5, totalBombs: 20, earned: 0, arrivalSounds: clips, errors },
        null,
        2,
      ),
    );
    console.log(
      'Five new bombs appear despite 15 existing bombs; one group sound, no tickets, pause and reload passed',
    );
  } finally {
    await browser?.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
