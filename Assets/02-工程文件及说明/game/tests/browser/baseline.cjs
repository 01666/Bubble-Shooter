const { chromium, browserPath } = require('../helpers/browser.cjs');
const { spawn } = require('node:child_process');
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
(async () => {
  const root = path.resolve(__dirname, '../..');
  const baseline = path.resolve(
    process.argv[2] || path.join(root, '../output/refactor-baseline/v1.7.3/game'),
  );
  const baseVersion = JSON.parse(
    fs.readFileSync(path.join(baseline, 'package.json'), 'utf8'),
  ).version;
  const currentVersion = JSON.parse(
    fs.readFileSync(path.join(root, 'package.json'), 'utf8'),
  ).version;
  const out = path.resolve(root, '../output/verification/v' + currentVersion);
  fs.mkdirSync(out, { recursive: true });
  const servers = [];
  let browser;
  const errors = [],
    results = [];
  try {
    for (const [folder, port] of [
      [baseline, 4235],
      [root, 4236],
    ]) {
      const server = spawn(process.execPath, [path.join(folder, 'tools/server.mjs')], {
        env: { ...process.env, GAME_PORT: String(port) },
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      servers.push(server);
      await new Promise((resolve, reject) => {
        server.stdout.once('data', resolve);
        server.once('error', reject);
        server.once('exit', () => reject(Error('server exited')));
      });
    }
    const { EndlessGame } = await import('../../src/core/index.mjs');
    const saved = new EndlessGame({ seed: 817 }).exportState();
    browser = await chromium.launch({
      executablePath: browserPath(),
      headless: true,
      args: ['--enable-webgl', '--ignore-gpu-blocklist'],
    });
    const pages = [];
    for (const port of [4235, 4236]) {
      const page = await browser.newPage({ viewport: { width: 1100, height: 1050 } });
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
      });
      await page.addInitScript((s) => {
        localStorage.setItem('bubble-integrated-v15-machine', JSON.stringify(s));
        let seed = 83917,
          clock = 0,
          pending = [];
        Math.random = () => {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          return seed / 4294967296;
        };
        Object.defineProperty(performance, 'now', { value: () => clock });
        window.requestAnimationFrame = (fn) => {
          pending.push(fn);
          return pending.length;
        };
        window.__qaFrame = () => {
          clock += 1000 / 60;
          const batch = pending;
          pending = [];
          for (const fn of batch) fn(clock);
        };
      }, saved);
      await page.goto(`http://127.0.0.1:${port}/?test=1`);
      await page.waitForFunction(
        () => {
          __qaFrame();
          return window.testGame?.ready;
        },
        null,
        { polling: 30 },
      );
      // Keep both isolated pages running while their identical manual frame clocks advance.
      await page.evaluate(() => {
        const q = [...document.querySelectorAll('input')].find((e) =>
          e.parentElement.textContent.includes('QA：保持试玩运行'),
        );
        q.checked = true;
        q.dispatchEvent(new Event('change'));
      });
      pages.push(page);
    }
    async function step(n) {
      for (let i = 0; i < n; i++) {
        for (const p of pages) await p.evaluate(() => __qaFrame());
        if (i % 10 === 0) await new Promise((r) => setTimeout(r, 15));
      }
    }
    async function capture(label) {
      const snapshots = [];
      for (let i = 0; i < 2; i++) {
        const p = pages[i];
        await p.locator('#cabinet').screenshot({
          path: path.join(out, `${label}-${i === 0 ? baseVersion : currentVersion}.png`),
        });
        snapshots.push(
          await p.evaluate(() => {
            const c = document.createElement('canvas');
            c.width = 450;
            c.height = 800;
            const ctx = c.getContext('2d');
            ctx.drawImage(document.querySelector('#game'), 0, 0, 450, 800);
            ctx.drawImage(document.querySelector('#feedback'), 0, 0, 450, 800);
            return {
              pixels: [...ctx.getImageData(0, 0, 450, 800).data],
              state: testGame.snapshot(),
              visual: testGame.visual(),
            };
          }),
        );
      }
      assert.deepEqual(snapshots[1].state, snapshots[0].state, label + ' gameplay');
      assert.deepEqual(snapshots[1].visual, snapshots[0].visual, label + ' animation positions');
      const a = snapshots[0].pixels,
        b = snapshots[1].pixels;
      const mad = a.reduce((sum, n, i) => sum + Math.abs(n - b[i]), 0) / a.length;
      assert.ok(mad < 0.1, `${label} pixel difference ${mad}`);
      results.push({ label, meanAbsolutePixelDifference: mad });
    }
    await step(90);
    await capture('free');
    for (const p of pages) await p.keyboard.press('KeyC');
    await step(12);
    await capture('paid');
    for (const p of pages) {
      await p.evaluate(() => testGame.bestAim());
      await p.keyboard.press('Space');
    }
    await step(8);
    await capture('flight-loader');
    await step(60);
    await capture('clear-reward');
    await step(180);
    await capture('settled');
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(out, 'visual-equivalence.json'),
      JSON.stringify(
        { baseline: baseVersion, candidate: currentVersion, results, errors, passed: true },
        null,
        2,
      ),
    );
    console.log(JSON.stringify({ results, errors }));
  } finally {
    await browser?.close();
    for (const server of servers) server.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
