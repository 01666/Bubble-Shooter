import { spreadCell } from '../special-placement.mjs';
import { SLOT_DURATION, SLOT_REWARDS, random, fallback } from './rewards.mjs';
const copy = (v) => structuredClone(v);
// Fix prize type and amount at spin start. Preserve independent random-stream order.
export function startPetSlot(g, s, emit, causeId) {
  const a = s.petSlots;
  if (a.state === 'spinning') return false;
  const roll = random(s) * 100;
  let cumulative = 0;
  const reward = SLOT_REWARDS.find((r) => (cumulative += r.weight) > roll);
  let pending = {
    spinId: 'pet-spin-' + ++a.sequence,
    rewardType: reward.type,
    label: reward.label,
    count: 1,
    duration: SLOT_DURATION,
    effectSeed: (s.rng ^ a.sequence ^ 0x974f) >>> 0,
  };
  if (reward.type === 'tickets') pending.count = 8 + Math.floor(random(s) * 9);
  if (reward.type === 'ammo') pending.count = 3 + Math.floor(random(s) * 3);
  if (reward.type === 'specials') {
    pending.count = 2 + Math.floor(random(s) * 4);
    const candidates = s.board.filter((b) => b.source === 'system' && !b.kind);
    const chosen = [],
      anchors = s.board.filter((b) => b.kind);
    while (chosen.length < pending.count && candidates.length) {
      const b = spreadCell(g, s, candidates, [...anchors, ...chosen]);
      chosen.push(b);
      candidates.splice(candidates.indexOf(b), 1);
    }
    pending.targetIds = chosen.map((b) => b.id);
    if (chosen.length !== pending.count) pending = fallback(pending, 'insufficientOrdinaryBalls');
  }
  if (reward.type === 'lightning') {
    const board = s.board,
      byCell = new Map(board.map((b) => [b.r + ',' + b.c, b]));
    const pairable = board.filter((b) =>
      g.neighbors(b.r, b.c, s.parity).some(([r, c]) => byCell.has(r + ',' + c)),
    );
    const path = pairable.length ? [pairable[Math.floor(random(s) * pairable.length)]] : [];
    const limit = 4 + Math.floor(random(s) * 4);
    while (path.length && path.length < limit) {
      const from = path[path.length - 1];
      const candidates = g
        .neighbors(from.r, from.c, s.parity)
        .map(([r, c]) => byCell.get(r + ',' + c))
        .filter((b) => b && !path.includes(b));
      if (!candidates.length) break;
      path.push(candidates[Math.floor(random(s) * candidates.length)]);
    }
    pending.targetIds = path.map((b) => b.id);
    pending.count = path.length;
    pending.electricPaths = path.slice(1).map((b, i) => ({
      fromId: path[i].id,
      toId: b.id,
      from: { x: path[i].x, y: path[i].y },
      to: { x: b.x, y: b.y },
    }));
    if (path.length < 2) pending = fallback(pending, 'noConnectedLightningTargets');
  }
  if (reward.type === 'fullClear') {
    pending.targetIds = s.board.map((b) => b.id);
    pending.count = pending.targetIds.length;
    if (!pending.count) pending = fallback(pending, 'emptyBoard');
  }
  if (reward.type === 'dual') {
    const colors = [...new Set(s.board.map((b) => b.color))].filter((c) => c !== s.loadedColor);
    if (s.assist.state !== 'charging' || !colors.length)
      pending = fallback(pending, 'dualUnavailable');
    else pending.secondaryColor = colors[Math.floor(random(s) * colors.length)];
  }
  Object.assign(a, {
    charge: 3,
    state: 'spinning',
    spinId: pending.spinId,
    remaining: SLOT_DURATION,
    pending,
  });

  emit('petSlotStarted', copy(pending), causeId);
  return true;
}
