import { expandMechanisms } from './mechanics.mjs';
import { spreadCell } from './special-placement.mjs';
// Experimental rules. Separate persisted draw stream; not production secure RNG.
export function beginStage(g, s) {
  const id = (s.stage?.id || 0) + 1;
  s.bonusRng = (Math.imul(s.bonusRng ?? s.rng ^ 0xa531f2, 1664525) + 1013904223) >>> 0;
  const u = s.bonusRng / 4294967296;
  s.stage = { id, targetIds: [], collectedIds: [], award: u < 0.6 ? 4 : u < 0.9 ? 8 : 16 };
  decorate(g, s);
}
export function decorate(g, s) {
  const inventory = [...s.board, ...s.content.reserve];
  // Stage targets bind to existing system inventory: no free new balls or rerolls.
  const candidates = s.board
    .filter((b) => b.source === 'system' && !b.kind)
    .sort((a, b) => b.r - a.r || a.c - b.c);
  while (s.stage.targetIds.length < 3 && candidates.length) {
    const b = g.config.densityEnabled ? spreadCell(g, s, candidates) : candidates[0];
    candidates.splice(candidates.indexOf(b), 1);
    b.kind = 'target';
    b.stageId = s.stage.id;
    s.stage.targetIds.push(b.id);
  }
  const bombs = inventory.filter((b) => b.kind === 'bomb').length;
  if (bombs < 2 && (s.bombPlan === undefined || s.content.refills - s.bombPlan >= 3)) {
    const ordinary = s.board.filter((b) => b.source === 'system' && !b.kind);
    const b = g.config.densityEnabled
      ? spreadCell(g, s, ordinary)
      : ordinary.sort((a, b) => b.r - a.r || b.c - a.c)[0];
    if (b) {
      b.kind = 'bomb';
      s.bombPlan = s.content.refills;
    }
  }
}
export function expandExplosion(g, s, direct) {
  return expandMechanisms(g, s, direct);
}
export function collectStage(s, removed) {
  const added = removed.filter(
    (b) => b.kind === 'target' && b.stageId === s.stage.id && !s.stage.collectedIds.includes(b.id),
  );
  s.stage.collectedIds.push(...added.map((b) => b.id));
  return added;
}
