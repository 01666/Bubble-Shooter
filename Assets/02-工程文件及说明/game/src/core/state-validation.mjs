import { validateCombo } from './combo.mjs';
import { validatePetSlots } from './pet-slots.mjs';
import { validateFlow } from './endless-flow.mjs';
import { validateAmmoBonus } from './ammo-bonus.mjs';
import { validateMechanics } from './mechanics.mjs';
import { validateLowOpportunity } from './low-opportunity.mjs';
import { validateLedger } from './ledger.mjs';
const cellKey = (r, c) => `${r},${c}`;
// Validate the full draft before every durable commit. Does not publish events.
export function validateState(g, s) {
  validateAmmoBonus(s);
  validateCombo(s);
  validatePetSlots(s);
  validateFlow(g, s);
  validateMechanics(g, s);
  validateLowOpportunity(g, s);
  if (
    !s.stage ||
    new Set(s.stage.targetIds).size !== s.stage.targetIds.length ||
    new Set(s.stage.collectedIds).size !== s.stage.collectedIds.length ||
    s.stage.collectedIds.some((id) => !s.stage.targetIds.includes(id)) ||
    ![4, 8, 16].includes(s.stage.award)
  )
    throw Error('Invalid stage');
  validateLedger(s.ledger);
  if (!s.content || !Number.isSafeInteger(s.content.credit) || s.content.credit < 0)
    throw Error('Invalid generation credit');
  const inventory = [...s.board, ...s.content.reserve];
  if (new Set(inventory.map((b) => b.id)).size !== inventory.length)
    throw Error('Duplicate inventory id');
  const systemCount = inventory.filter((b) => b.source === 'system').length;
  s.content.initialSystemCount ??= systemCount + s.content.credit;
  if (systemCount + s.content.credit !== s.content.initialSystemCount)
    throw Error('Content conservation failed');
  if (s.boardPolicy && s.boardPolicy !== g.config.boardPolicy) throw Error('Policy mismatch');
  for (const k of [
    'revision',
    'eventSequence',
    'paidAmmo',
    'paidShots',
    'shotSequence',
    'bubbleSequence',
  ])
    if (!Number.isSafeInteger(s[k]) || s[k] < 0) throw new Error(`Invalid state ${k}`);
  const cells = new Set(),
    ids = new Set();
  for (const b of s.board) {
    const k = cellKey(b.r, b.c);
    if (
      cells.has(k) ||
      ids.has(b.id) ||
      !Number.isInteger(b.r) ||
      b.r < 0 ||
      !Number.isInteger(b.c) ||
      b.c < 0 ||
      b.c >= g.config.cols ||
      !g.config.colors.includes(b.color)
    )
      throw new Error('Invalid board');
    const p = g.pos(b.r, b.c, s.parity);
    if (Math.abs(p.x - b.x) > 1e-8 || Math.abs(p.y - b.y) > 1e-8)
      throw new Error('Invalid board position');
    cells.add(k);
    ids.add(b.id);
  }
  if (
    !g.config.colors.includes(s.loadedColor ?? g.config.colors[0]) ||
    !g.config.colors.includes(s.nextColor ?? g.config.colors[0])
  )
    throw new Error('Invalid loaded color');
  if (
    !Number.isFinite(s.angle) ||
    Math.abs(s.angle) > g.config.maxAim ||
    !Number.isFinite(s.cooldown) ||
    s.cooldown < 0 ||
    ![0, 1].includes(s.parity) ||
    !Number.isInteger(s.rng) ||
    s.rng < 0 ||
    s.rng > 0xffffffff
  )
    throw new Error('Invalid motion state');
  if (s.projectile) {
    const p = s.projectile;
    if (
      !['paid', 'free'].includes(p.mode) ||
      !g.config.colors.includes(p.color) ||
      ![p.x, p.y, p.vx, p.vy].every(Number.isFinite) ||
      s.state !== `${p.mode}Flight`
    )
      throw new Error('Invalid projectile');
  } else if (s.state !== 'ready') throw new Error('Invalid idle state');
  const purchased = Object.values(s.receipts).reduce((n, c) => {
    if (!Number.isSafeInteger(c) || c <= 0) throw new Error('Invalid receipt');
    return n + c * g.config.ballsPerCoin;
  }, 0);
  if (
    !Number.isSafeInteger(s.refundedShots) ||
    s.refundedShots < 0 ||
    s.refundedShots > s.paidShots
  )
    throw new Error('Invalid refunded shots');
  if (
    !Number.isSafeInteger(purchased) ||
    purchased +
      s.ammoBonus.total -
      s.paidShots +
      s.refundedShots -
      (s.projectile?.mode === 'paid' ? 1 : 0) !==
      s.paidAmmo
  )
    throw new Error('Ammo ledger invariant failed');
}
