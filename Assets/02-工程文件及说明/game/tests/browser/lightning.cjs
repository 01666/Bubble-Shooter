const { chromium, browserPath } = require('../helpers/browser.cjs');
const { spawn } = require('node:child_process');
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');

(async () => {
  const { EndlessGame, MemoryStore } = await import('../../src/core/index.mjs');
  const g = new EndlessGame({ seed: 31 });
  const s = g.exportState();
  s.board = [];
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 9; c++)
      s.board.push({
        id: `electric-${r}-${c}`,
        source: 'system',
        r,
        c,
        color: r === 3 && [3, 4].includes(c) ? 0 : (r + c) % 5,
        ...(r === 3 && c === 4 ? { kind: 'conductor', networkId: 'network-1' } : {}),
        ...(r === 0 && c < 3 ? { kind: 'target', stageId: 1 } : {}),
        ...g.pos(r, c),
      });
  s.content.reserve = [];
  s.content.credit = 0;
  s.content.initialSystemCount = 36;
  s.stage = {
    id: 1,
    award: 8,
    collectedIds: [],
    targetIds: s.board.filter((b) => b.kind === 'target').map((b) => b.id),
  };
  s.network = {
    sequence: 1,
    id: 'network-1',
    nextEligibleRefill: 999,
    lastActivatedShot: null,
    lastEndedShot: null,
  };
  s.bombPlan = 999;
  s.loadedColor = 0;
  s.nextColor = 1;
  const h = new EndlessGame({ config: g.config, store: new MemoryStore(s) });
  h.coin({ receiptId: 'electric-qa' });
  const move = h
    .opportunities()
    .filter((m) => m.direct.some((b) => b.kind === 'conductor'))
    .sort((a, b) => b.direct.length - a.direct.length)[0];
  assert.ok(move);
  const out = path.resolve(__dirname, '../../../output/verification/v1.5.1/lightning');
  fs.mkdirSync(out, { recursive: true });
  const server = spawn(process.execPath, [path.resolve(__dirname, '../../tools/server.mjs')], {
    env: { ...process.env, GAME_PORT: '4233' },
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
    const page = await browser.newPage({ viewport: { width: 1100, height: 1050 } });
    await page.addInitScript(
      (saved) => localStorage.setItem('bubble-integrated-v15-machine', JSON.stringify(saved)),
      h.exportState(),
    );
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.goto('http://127.0.0.1:4233/?test=1');
    await page.waitForFunction(() => window.testGame?.ready);
    await page.locator('summary').filter({ hasText: '维护' }).click();
    await page.getByText('QA：保持试玩运行').locator('input').check();
    await page.locator('#game').click({ force: true });
    await page.evaluate((angle) => testGame.aim(angle), move.angle);
    await page.keyboard.press('Space');
    await page.waitForFunction(() =>
      testGame.upgrade().mechanisms.director.lightning.some((e) => e.age > 0.35 && e.age < 0.85),
    );
    const live = await page.evaluate(() => ({
      effects: testGame.upgrade().mechanisms.director.lightning,
      events: testGame.events(),
      snapshot: testGame.snapshot(),
    }));
    const shot = live.events.filter((e) => e.type === 'paidShotResolved').at(-1).payload;
    const propagated = live.events.find((e) => e.type === 'networkPropagated').payload;
    assert.equal(shot.explosionCount, 0, 'pure electricity, no bomb effect hides the test');
    assert.ok(propagated.struckBalls.some((b) => !b.kind && b.color !== 0));
    assert.ok(live.effects.some((e) => e.steps >= 3 && e.pops >= 4));
    assert.equal(new Set(shot.electricIds).size, shot.electricCount);
    await page.locator('#cabinet').screenshot({ path: path.join(out, 'chain-lightning.png') });
    await page.waitForTimeout(2200);
    assert.equal(await page.evaluate(() => testGame.upgrade().mechanisms.director.effects), 0);
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(out, 'report.json'),
      JSON.stringify(
        {
          live,
          errors,
          checks: [
            '真实键盘命中导电球',
            '无炸弹干扰的跨颜色电击',
            '真实相邻路径进入渲染器并截图',
            '事件与彩票去重、效果到期回收',
          ],
        },
        null,
        2,
      ),
    );
    console.log(
      JSON.stringify({ electricCount: shot.electricCount, steps: propagated.steps.length, errors }),
    );
  } finally {
    await browser?.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
