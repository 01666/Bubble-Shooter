const { chromium } = require('../helpers/browser.cjs');
const fs = require('fs'),
  p = require('path'),
  assert = require('assert/strict');
(async () => {
  const browser = await chromium.launch({
    executablePath: require('../helpers/browser.cjs').browserPath(),
    headless: true,
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
    await page.goto('http://127.0.0.1:4210/?test=1');
    await page.waitForFunction(() => testGame?.ready);
    await page.keyboard.press('KeyC');
    let snap = false,
      refill = false;
    for (let i = 0; i < 18 && (!snap || !refill); i++) {
      await page.waitForFunction(() => testGame.idle);
      const count = await page.evaluate(() => testGame.events().length);
      await page.evaluate(() => {
        if (!testGame.snapshot().paidAmmo) document.getElementById('coin').click();
      });
      await page.waitForTimeout(60);
      await page.evaluate(() => {
        const s = testGame.snapshot();
        let best = -1,
          angle = 0;
        for (let a = -1.1; a < 1.1; a += 0.03) {
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
      await page.waitForTimeout(90);
      const ev = await page.evaluate((n) => testGame.events().slice(n), count),
        v = await page.evaluate(() => testGame.visual());
      if (!snap && ev.some((e) => e.type === 'paidShotResolved' && e.payload.attached)) {
        assert.ok(v.groups.some((g) => g.type === 'shot' && g.attached && g.age < 0.42));
        await page
          .locator('#cabinet')
          .screenshot({ path: p.join(__dirname, '../../../output/verification/v1.0/attach.png') });
        snap = true;
      }
      if (!refill && ev.some((e) => e.type === 'boardRefilled')) {
        assert.ok(v.groups.some((g) => g.type === 'boardRefilled' && g.cells > 0 && g.age < 1.1));
        assert.ok(v.balls.some((b) => b.spawnUntil > v.clock && Math.abs(b.scaleX - 1) > 0.005));
        await page
          .locator('#cabinet')
          .screenshot({ path: p.join(__dirname, '../../../output/verification/v1.0/refill.png') });
        refill = true;
      }
      await page.waitForTimeout(150);
    }
    assert.ok(snap, '真实吸附应有接触特效');
    assert.ok(refill, '真实补球应有入场缩放与光环');
    fs.writeFileSync(
      p.join(__dirname, '../../../output/verification/v1.0/vfx-report.json'),
      JSON.stringify({ attachment: snap, refillElastic: refill }),
    );
    console.log('真实吸附和补球动画验证通过');
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
