import { matchGroups, expandMechanisms } from './mechanics.mjs';
export function neighbors(r, c, parity, cols) {
  const shift = (r + parity) & 1 ? 1 : -1;
  return [
    [r, c - 1],
    [r, c + 1],
    [r - 1, c],
    [r - 1, c + shift],
    [r + 1, c],
    [r + 1, c + shift],
  ].filter(([r, c]) => r >= 0 && c >= 0 && c < cols);
}
export function position(r, c, parity, q) {
  return {
    x: (c - (q.cols - 1) / 2) * q.spacing + ((r + parity) & 1 ? q.spacing / 2 : 0) - q.spacing / 4,
    y: q.top - r * q.rowHeight,
  };
}
// Exact circle intersections, same authority for flight, preview and opportunity sampling.
export function flight(board, q, p, seconds) {
  let left = seconds;
  const bounces = [],
    points = [{ x: p.x, y: p.y }];
  for (let segment = 0; segment < 32 && left > 1e-9; segment++) {
    let t = left,
      type = 'none',
      hit = null;
    const bound = q.wall - q.radius;
    const wall = p.vx > 0 ? (bound - p.x) / p.vx : p.vx < 0 ? (-bound - p.x) / p.vx : Infinity;
    if (wall >= -1e-8 && wall <= t) {
      t = Math.max(0, wall);
      type = 'wall';
    }
    if (!p.deflected && p.vy > 0) {
      const top = (q.top - p.y) / p.vy;
      if (top >= 0 && top <= t) {
        t = top;
        type = 'top';
      }
    }
    if (!p.deflected) {
      const rr = (2 * q.radius - 0.016) ** 2,
        a = p.vx * p.vx + p.vy * p.vy;
      for (const b of board) {
        const ox = p.x - b.x,
          oy = p.y - b.y,
          B = 2 * (ox * p.vx + oy * p.vy),
          C = ox * ox + oy * oy - rr,
          dis = B * B - 4 * a * C;
        if (dis < 0) continue;
        let at = C <= 0 ? 0 : (-B - Math.sqrt(dis)) / (2 * a);
        if (at >= -1e-8 && at <= t + 1e-10) {
          at = Math.max(0, at);
          if (
            at < t - 1e-10 ||
            type !== 'bubble' ||
            b.r < hit.r ||
            (b.r === hit.r && b.c < hit.c)
          ) {
            t = at;
            hit = b;
            type = 'bubble';
          }
        }
      }
    }
    p.x += p.vx * t;
    p.y += p.vy * t;
    left -= t;
    points.push({ x: p.x, y: p.y });
    if (type === 'bubble' || type === 'top') return { hit, contact: true, bounces, points };
    if (type === 'wall') {
      p.vx = -p.vx;
      bounces.push({ x: p.x, y: p.y });
      continue;
    }
    break;
  }
  return { hit: null, contact: false, bounces, points };
}
export function landing(board, parity, q, p, hit) {
  const occupied = new Set(board.map((b) => `${b.r},${b.c}`));
  const cells = hit
    ? neighbors(hit.r, hit.c, parity, q.cols)
    : Array.from({ length: q.cols }, (_, c) => [0, c]);
  const options = cells
    .filter(([r, c]) => !occupied.has(`${r},${c}`))
    .map(([r, c]) => ({ r, c, ...position(r, c, parity, q) }));
  options.sort(
    (a, b) =>
      (a.x - p.x) ** 2 + (a.y - p.y) ** 2 - ((b.x - p.x) ** 2 + (b.y - p.y) ** 2) ||
      a.r - b.r ||
      a.c - b.c,
  );
  return options[0] ?? null;
}
export function predict(board, parity, q, angle) {
  const dx = Math.sin(angle),
    dy = Math.cos(angle),
    p = {
      x: dx * 0.7,
      y: q.cannonY + dy * 0.7,
      vx: dx * q.speed,
      vy: dy * q.speed,
      deflected: false,
    };
  const f = flight(board, q, p, 5);
  return {
    ...f,
    landing: f.contact ? landing(board, parity, q, p, f.hit) : null,
    terminal: p,
    angle,
  };
}
export function outcome(board, parity, q, cell, color, secondaryColor = null) {
  if (!cell) return { direct: [], dropped: [], board, groupSize: 0 };
  let id = 'prediction';
  while (board.some((b) => b.id === id)) id += '-next';
  const added = { ...cell, id, color, source: 'player' },
    state = { board: [...board, added], parity },
    facade = { config: q, neighbors: (r, c) => neighbors(r, c, parity, q.cols) },
    matched = matchGroups(facade, state, added, secondaryColor),
    groupSize = Math.max(...matched.groups.map((a) => a.size));
  if (!matched.direct.length)
    return { direct: [], dropped: [], board: [...board, added], groupSize, groups: matched.groups };
  const group = expandMechanisms(facade, state, matched.direct).direct;
  const cleared = new Set(group.map((b) => b.id)),
    remaining = board.filter((b) => !cleared.has(b.id)),
    anchored = new Set(),
    todo = remaining.filter((b) => b.r === 0),
    remainingMap = new Map(remaining.map((b) => [`${b.r},${b.c}`, b]));
  while (todo.length) {
    const b = todo.pop();
    if (anchored.has(b.id)) continue;
    anchored.add(b.id);
    for (const [r, c] of neighbors(b.r, b.c, parity, q.cols)) {
      const a = remainingMap.get(`${r},${c}`);
      if (a && !anchored.has(a.id)) todo.push(a);
    }
  }
  const dropped = remaining.filter((b) => !anchored.has(b.id));
  return {
    direct: group,
    dropped,
    board: remaining.filter((b) => anchored.has(b.id)),
    groupSize,
    groups: matched.groups,
  };
}
export function options(
  board,
  parity,
  q,
  color,
  samples = q.opportunitySamples,
  secondaryColor = null,
) {
  const cells = new Map();
  for (let i = 0; i < samples; i++) {
    const angle = -q.maxAim + (2 * q.maxAim * i) / (samples - 1),
      p = predict(board, parity, q, angle);
    if (p.landing) {
      const k = `${p.landing.r},${p.landing.c}`;
      if (!cells.has(k)) cells.set(k, { angle, ...p.landing });
    }
  }
  return [...cells.values()].map((cell) => ({
    ...outcome(board, parity, q, cell, color, secondaryColor),
    cell,
    angle: cell.angle,
  }));
}
export function metrics(board, parity, q, loadedColor) {
  const sampled = options(board, parity, q, loadedColor),
    all = q.colors.map((color) => ({
      color,
      moves: sampled.map((m) => outcome(board, parity, q, m.cell, color)),
    }));
  const height = board.length ? Math.max(...board.map((b) => b.r)) + 1 : 0;
  return {
    height,
    count: board.length,
    density: height ? board.length / (height * q.cols) : 0,
    legalCells: sampled.length,
    immediate: sampled.filter((m) => m.direct.length).length,
    dropMoves: sampled.filter((m) => m.dropped.length).length,
    paving: sampled.filter((m) => !m.direct.length && m.groupSize === 2).length,
    colorsWithClear: all.filter((c) => c.moves.some((m) => m.direct.length)).length,
    allColorClearMoves: all.reduce((n, c) => n + c.moves.filter((m) => m.direct.length).length, 0),
    maxDrop: Math.max(0, ...sampled.map((m) => m.dropped.length)),
  };
}
