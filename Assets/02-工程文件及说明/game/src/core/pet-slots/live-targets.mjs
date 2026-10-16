import { spreadCell } from '../special-placement.mjs';
import { fallback } from './rewards.mjs';
const copy = (v) => structuredClone(v);
// Rebind visual effects to the live board after an in-flight shot finishes.
export function liveReward(g, s, stored) {
  const p = copy(stored);
  let seed = p.effectSeed ?? 0x974f;
  const draw = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  if (p.rewardType === 'specials') {
    const candidates = s.board.filter((b) => b.source === 'system' && !b.kind),
      chosen = [];
    if (candidates.length < p.count) return fallback(p, 'liveBoardHasInsufficientTargets');
    while (chosen.length < p.count) {
      const b = spreadCell(g, s, candidates, [...s.board.filter((b) => b.kind), ...chosen]);
      chosen.push(b);
      candidates.splice(candidates.indexOf(b), 1);
    }
    p.targetIds = chosen.map((b) => b.id);
  } else if (p.rewardType === 'lightning') {
    const byCell = new Map(s.board.map((b) => [b.r + ',' + b.c, b]));
    const candidates = s.board.filter((b) =>
      g.neighbors(b.r, b.c, s.parity).some(([r, c]) => byCell.has(r + ',' + c)),
    );
    const path = candidates.length ? [candidates[Math.floor(draw() * candidates.length)]] : [];
    while (path.length && path.length < stored.count) {
      const from = path.at(-1),
        next = g
          .neighbors(from.r, from.c, s.parity)
          .map(([r, c]) => byCell.get(r + ',' + c))
          .filter((b) => b && !path.includes(b));
      if (!next.length) break;
      path.push(next[Math.floor(draw() * next.length)]);
    }
    if (path.length < 2) return fallback(p, 'liveBoardHasNoLightningPath');
    p.count = path.length;
    p.targetIds = path.map((b) => b.id);
    p.electricPaths = path.slice(1).map((b, i) => ({
      fromId: path[i].id,
      toId: b.id,
      from: { x: path[i].x, y: path[i].y },
      to: { x: b.x, y: b.y },
    }));
  } else if (p.rewardType === 'fullClear') {
    p.targetIds = s.board.map((b) => b.id);
    p.count = p.targetIds.length;
    if (!p.count) return fallback(p, 'liveBoardAlreadyCleared');
  } else if (p.rewardType === 'dual') {
    const colors = [...new Set(s.board.map((b) => b.color))].filter((c) => c !== s.loadedColor);
    if (s.assist.state !== 'charging' || !colors.length) return fallback(p, 'liveDualUnavailable');
    p.secondaryColor = colors.includes(p.secondaryColor)
      ? p.secondaryColor
      : colors[Math.floor(draw() * colors.length)];
  }
  return p;
}
