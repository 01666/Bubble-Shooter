import { options } from '../../src/core/geometry.mjs';
export const strategyNames = [
  'simple',
  'support',
  'random',
  'freeEntry',
  'takeover',
  'stackAndCash',
];
export function moves(game, color = game.s.loadedColor, samples = 41) {
  return options(
    game.s.board,
    game.s.parity,
    { ...game.config, opportunitySamples: samples },
    color,
    samples,
  );
}
export function choice(game, name, rng, context = {}) {
  const ms = moves(game);
  if (!ms.length) return { angle: 0, direct: [], dropped: [], cell: null };
  const payoff = (m) => m.direct.length + 2 * m.dropped.length;
  if (name === 'random') return { angle: (rng() * 2 - 1) * game.config.maxAim };
  const type =
    name === 'takeover' ? (Math.floor((context.index ?? 0) / 40) % 2 ? 'support' : 'random') : name;
  if (type === 'random') return { angle: (rng() * 2 - 1) * game.config.maxAim };
  if (type === 'stackAndCash' && !context.cash) {
    return ms.sort((a, b) => b.cell.r * 10 - payoff(b) * 50 - (a.cell.r * 10 - payoff(a) * 50))[0];
  }
  if (type === 'simple')
    return ms.sort(
      (a, b) =>
        b.direct.length +
        0.01 * b.dropped.length +
        0.1 * b.groupSize -
        (a.direct.length + 0.01 * a.dropped.length + 0.1 * a.groupSize),
    )[0];
  let best = ms[0],
    score = -Infinity;
  for (const m of ms) {
    const value = payoff(m) + 0.2 * m.groupSize;
    if (value > score) {
      score = value;
      best = m;
    }
  }
  // Limited two-step lookahead uses only the visible next color, not future random draws.
  const paving = ms
    .filter((m) => !m.direct.length)
    .sort((a, b) => b.groupSize - a.groupSize)
    .slice(0, 3);
  for (const m of paving) {
    const future = options(m.board, game.s.parity, game.config, game.s.nextColor, 25);
    const value = Math.max(0, ...future.map(payoff)) * 0.48 + 0.15 * m.groupSize;
    if (value > score) {
      score = value;
      best = m;
    }
  }
  return best;
}
export function bestEntryColor(game) {
  let best = game.s.loadedColor,
    value = -1;
  for (const color of game.config.colors) {
    const opts = moves(game, color);
    const score = Math.max(0, ...opts.map((m) => m.direct.length + 2 * m.dropped.length));
    if (score > value) {
      value = score;
      best = color;
    }
  }
  return best;
}
export function seeded(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
export function finish(game) {
  let frames = 0;
  while (game.s.projectile && frames++ < 200) game.advance(0.25);
  if (game.s.projectile) throw Error('Flight did not finish');
  game.advance(0.25);
  for (let i = 0; i < 20 && (game.s.cooldown > 0 || game.s.content.flow?.pending); i++)
    game.advance(0.25);
  return frames * 0.25;
}
