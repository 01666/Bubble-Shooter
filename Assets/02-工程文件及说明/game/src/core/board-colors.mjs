import { neighbors } from './geometry.mjs';

// Constrain generated colors, never recolor a saved or player-created group.
export function pickBoardColor(g, s, board, r, c, parity = s.parity) {
  const cells = new Map(board.map((b) => [`${b.r},${b.c}`, b]));
  const candidates = g.config.colors.map((color) => {
    const seen = new Set();
    const queue = neighbors(r, c, parity, g.config.cols);
    for (let i = 0; i < queue.length; i++) {
      const [nr, nc] = queue[i],
        key = `${nr},${nc}`,
        b = cells.get(key);
      if (!b || b.color !== color || seen.has(key)) continue;
      seen.add(key);
      queue.push(...neighbors(nr, nc, parity, g.config.cols));
    }
    const size = seen.size + 1;
    let run = 1;
    for (let col = c - 1; col >= 0 && cells.get(`${r},${col}`)?.color === color; col--) run++;
    const weight = [0, 1, 1.25, 0.9, 0.5, 0.22, 0.08][size] ?? 0;
    return { color, size, weight: run > 3 ? 0 : weight };
  });
  let total = candidates.reduce((sum, b) => sum + b.weight, 0);
  // Exceptional crowded old boards: bounded fallback, no retries or board mutation.
  if (!total) {
    const smallest = Math.min(...candidates.map((b) => b.size));
    for (const b of candidates) b.weight = b.size === smallest ? 1 : 0;
    total = candidates.reduce((sum, b) => sum + b.weight, 0);
  }
  let roll = g.random(s) * total;
  for (const b of candidates) {
    roll -= b.weight;
    if (roll < 0) return b.color;
  }
  return candidates.at(-1).color;
}
