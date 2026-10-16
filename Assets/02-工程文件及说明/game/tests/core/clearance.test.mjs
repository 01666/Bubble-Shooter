import assert from 'node:assert/strict';
import { EndlessGame } from '../../src/core/index.mjs';
const events = [],
  g = new EndlessGame({ seed: 42, onEvent: (e) => events.push(e) });
g.coin({ receiptId: 'qa', coins: 1 });
for (let i = 0; i < 90; i++) {
  if (!g.s.paidAmmo) g.coin({ receiptId: 'qa-' + i });
  g.setAim(0);
  g.fire();
  while (g.s.projectile) g.advance(0.05);
  g.advance(0.25);
  assert.ok(g.s.board.every((b) => b.y - g.config.radius > g.config.dangerY));
  g.validate(g.s);
}
assert.ok(
  events.some((e) => e.type === 'boardMaintained' && e.payload.reason === 'apparatusClearance'),
);
console.log('90发连续铺球均未越过器具安全线，暂存守恒与账务校验通过');
