const { chromium } = require('../helpers/browser.cjs');
const assert = require('assert/strict'),
  fs = require('fs'),
  p = require('path');
(async () => {
  const b = await chromium.launch({
    executablePath: require('../helpers/browser.cjs').browserPath(),
    headless: true,
  });
  try {
    const page = await b.newPage({ viewport: { width: 1200, height: 1000 } });
    await page.goto('http://127.0.0.1:4210/?test=1');
    await page.waitForFunction(() => testGame?.ready);
    await page.keyboard.press('KeyC');
    await page.waitForTimeout(300);
    const g = await page.evaluate(() => testGame.stats().scene.guide);
    assert.ok(g.visibleLength < g.totalLength * 0.82);
    assert.equal(g.endpointVisible, false);
    assert.ok(g.pearls.length > 3);
    for (let i = 1; i < g.pearls.length; i++) {
      assert.ok(g.pearls[i].scale < g.pearls[i - 1].scale);
      assert.ok(g.pearls[i].alpha < g.pearls[i - 1].alpha);
    }
    assert.deepEqual(g.trace, await page.evaluate(() => testGame.trace(testGame.snapshot().angle)));
    await page.waitForTimeout(200);
    assert.equal(
      (await page.evaluate(() => testGame.stats().scene.guide)).visibleLength,
      g.visibleLength,
    );
    await page
      .locator('#cabinet')
      .screenshot({ path: p.join(__dirname, '../../../output/verification/v1.0/guide.png') });
    fs.writeFileSync(
      p.join(__dirname, '../../../output/verification/v1.0/guide-report.json'),
      JSON.stringify({
        taper: true,
        fade: true,
        endpointHidden: true,
        stableWhileAiming: true,
        physicsUnchanged: true,
      }),
    );
    console.log('渐小渐淡、隐藏落点、静止稳定与原始弹道一致检查通过');
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
