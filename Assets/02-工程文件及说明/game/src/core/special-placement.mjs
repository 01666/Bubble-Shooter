// Choose existing cells with maximum clearance from specials, without moving inventory.
export function spreadCell(g, s, candidates, anchors = s.board.filter((b) => b.kind)) {
  const ranked = candidates.map((ball) => ({
    ball,
    distance: anchors.length
      ? Math.min(...anchors.map((b) => Math.hypot(ball.x - b.x, ball.y - b.y) / g.config.spacing))
      : Infinity,
    jitter: cellJitter(s.rng, ball.id),
  }));
  const separated = ranked.filter((b) => b.distance >= 2.5);
  const pool = separated.length ? separated : ranked;
  pool.sort((a, b) => {
    // Within a well-spaced pool, randomize among the roomiest cells.
    const score = (v) => (Number.isFinite(v.distance) ? v.distance : 5) + v.jitter * 0.65;
    return score(b) - score(a);
  });
  return pool[0]?.ball ?? null;
}

function cellJitter(seed, id) {
  let h = seed >>> 0;
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h / 4294967296;
}

export function decorateIncoming(g, s, added) {
  const candidates = () => added.filter((b) => b.source === 'system' && !b.kind);
  // Reused specials keep identity; newly created full rows carry one or occasionally two bombs.
  const existing = added.filter((b) => b.kind).length;
  const desired = added.length >= g.config.cols && g.random(s) < 0.3 ? 2 : 1;
  for (let i = existing; i < desired; i++) {
    const b = spreadCell(g, s, candidates());
    if (!b) break;
    b.kind = 'bomb';
  }
}
