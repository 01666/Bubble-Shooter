import { protectedPathIds } from './protection.mjs';
import { metrics, position } from './geometry.mjs';
import { initializeFlow, advanceFlow } from './endless-flow.mjs';
import { pickBoardColor } from './board-colors.mjs';
function ensure(s) {
  s.content ??= {
    credit: 0,
    serial: 0,
    reserve: [],
    refills: 0,
    maintenances: 0,
    retiredPlayer: 0,
    retiredSystem: 0,
  };
}
function newSystem(g, s, r, c, color) {
  const b = g.make(s, r, c, color);
  b.source = 'system';
  return b;
}
export function densityRows(g, s) {
  return Math.min(
    g.config.densityBaseRows + 2,
    Math.floor((g.config.top - g.config.radius - g.config.dangerY) / g.config.rowHeight),
  );
}
function moduleCells(lane, serial, q) {
  const c = lane * 3,
    k = serial % q.colors.length,
    at = (i) => q.colors[(k + i) % q.colors.length];
  return serial % 2 === 0
    ? [
        [0, c, at(3)],
        [1, c, at(0)],
        [1, c + 1, at(0)],
        [2, c, at(1)],
        [2, c + 1, at(1)],
        [3, c, at(2)],
        [3, c + 1, at(2)],
      ]
    : [
        [0, c, at(3)],
        [0, c + 1, at(4)],
        [1, c, at(0)],
        [2, c, at(1)],
        [2, c + 1, at(1)],
        [3, c, at(2)],
        [3, c + 1, at(2)],
      ];
}
export function seedPolicy(g, s) {
  ensure(s);
  s.board = [];
  s.parity = 0;
  if (g.config.densityEnabled) {
    const target = Math.max(g.config.densityTarget, g.config.cols * g.config.densityBaseRows);
    for (let r = 0; s.board.length < target; r++)
      for (let c = 0; c < g.config.cols && s.board.length < target; c++) {
        s.board.push(newSystem(g, s, r, c, pickBoardColor(g, s, s.board, r, c)));
      }
    s.content.initialSystemCount = s.board.length;
    return;
  }
  if (g.config.boardPolicy === 'pockets') {
    // Seeded variation keeps three supported pockets and the same 21-ball inventory.
    const palette = [...g.config.colors];
    for (let i = palette.length - 1; i > 0; i--) {
      const j = Math.floor(g.random(s) * (i + 1));
      [palette[i], palette[j]] = [palette[j], palette[i]];
    }
    for (let lane = 0; lane < 3; lane++) {
      const variant = Math.floor(g.random(s) * 40);
      for (const [r, c, color] of moduleCells(lane, variant, g.config))
        s.board.push(newSystem(g, s, r, c, palette[g.config.colors.indexOf(color)]));
      s.content.serial++;
    }
  } else {
    const base = Math.floor(g.random(s) * g.config.colors.length);
    for (let r = 0; r < g.config.initialRows; r++)
      for (let c = 0; c < g.config.cols; c++)
        s.board.push(
          newSystem(
            g,
            s,
            r,
            c,
            g.config.colors[
              (base + Math.floor(c / 2) + Math.floor(r / 2)) % g.config.colors.length
            ],
          ),
        );
  }
  s.content.initialSystemCount = s.board.length;
}
// Explicit once-only content-budget expansion for old public boards. No ticket award or reroll.
export function initializeDensity(g, s) {
  if (g.config.densityEnabled) initializeFlow(g, s);
  if (!g.config.densityEnabled || s.content.densityVersion === 2) return;
  const previous = s.content.initialSystemCount;
  const target = Math.max(
    previous,
    g.config.densityTarget,
    g.config.cols * g.config.densityPeakRows,
  );
  s.content.credit += target - previous;
  s.content.initialSystemCount = target;
  s.content.densityVersion = 2;
  s.content.expansionGranted = target - previous;
  // Loading a save never fills holes or rerolls a player's public board.
}
export function creditHarvest(s, direct, dropped) {
  ensure(s);
  s.content.credit += [...direct, ...dropped].filter((b) => b.source === 'system').length;
}
// Only already-existing unharvested objects enter reserve. No random new content on maintenance.
function retire(g, s, emit, shotId, blocked) {
  const q = g.config,
    publicMetrics = metrics(s.board, s.parity, q, s.loadedColor);
  const openCorridor =
    !q.densityEnabled &&
    q.boardPolicy === 'pockets' &&
    publicMetrics.colorsWithClear < q.minimumClearColors &&
    publicMetrics.height >= 6 &&
    publicMetrics.density > 0.6;
  const apparatusClearance = s.board.some((b) => b.y - q.radius <= q.dangerY),
    boundary = q.densityEnabled ? densityRows(g, s) : openCorridor ? 4 : q.pressureRow,
    protectedIds = protectedPathIds(g, s),
    removed = s.board.filter(
      (b) =>
        b.y - q.radius <= q.dangerY || (b.r >= boundary && (blocked || !protectedIds.has(b.id))),
    );
  if (blocked && !removed.length) {
    const max = Math.max(0, ...s.board.map((b) => b.r));
    removed.push(...s.board.filter((b) => b.r === max));
  }
  if (!removed.length) return;
  const ids = new Set(removed.map((b) => b.id));
  s.board = s.board.filter((b) => !ids.has(b.id));
  const detached = g.detached(s);
  for (const b of detached) {
    if (!ids.has(b.id)) {
      removed.push(b);
      ids.add(b.id);
    }
  }
  s.board = s.board.filter((b) => !ids.has(b.id));
  s.content.reserve.push(...removed);
  s.content.maintenances++;
  s.content.retiredPlayer += removed.filter((b) => b.source === 'player').length;
  s.content.retiredSystem += removed.filter((b) => b.source === 'system').length;
  emit(
    'boardMaintained',
    {
      reason: apparatusClearance
        ? 'apparatusClearance'
        : openCorridor
          ? 'openCorridor'
          : blocked
            ? 'blockedFrontier'
            : 'pressureFrontier',
      boundary,
      removed: structuredClone(removed),
      reseeded: false,
      gain: 0,
      emergency: blocked || apparatusClearance,
      protectedIds: [...protectedIds],
      playerRemoved: removed.filter((b) => b.source === 'player').length,
    },
    shotId,
  );
}
function reuse(g, s, emit, shotId) {
  if (!s.content.reserve.length) return;
  const occupied = new Set(s.board.map((b) => `${b.r},${b.c}`)),
    moved = [];
  for (
    let r = 0;
    r < (g.config.densityEnabled ? densityRows(g, s) : 4) && moved.length < g.config.refillBatchMax;
    r++
  )
    for (let c = 0; c < g.config.cols && moved.length < g.config.refillBatchMax; c++) {
      if (!s.content.reserve.length) break;
      if (occupied.has(`${r},${c}`)) continue;
      if (r && !g.neighbors(r, c, s.parity).some(([rr, cc]) => occupied.has(`${rr},${cc}`)))
        continue;
      const b = s.content.reserve.shift(),
        from = { r: b.r, c: b.c };
      Object.assign(b, { r, c, ...position(r, c, s.parity, g.config) });
      s.board.push(b);
      occupied.add(`${r},${c}`);
      moved.push({ id: b.id, from, to: { r, c }, color: b.color, source: b.source });
    }
  if (moved.length)
    emit('boardRepositioned', { reason: 'reuseSameInventory', moved, gain: 0 }, shotId);
}
function boundPlayerReserve(g, s, emit, shotId) {
  const players = s.content.reserve
      .filter((b) => b.source === 'player')
      .sort((a, b) => (a.bornShot || 0) - (b.bornShot || 0)),
    excess = Math.max(0, players.length - g.config.maxPlayerReserve);
  if (!excess) return;
  const discarded = players.slice(0, excess),
    ids = new Set(discarded.map((b) => b.id));
  s.content.reserve = s.content.reserve.filter((b) => !ids.has(b.id));
  emit(
    'constructionRetired',
    {
      reason: 'boundedOlderPlayerReserve',
      removed: structuredClone(discarded),
      limit: g.config.maxPlayerReserve,
      gain: 0,
    },
    shotId,
  );
}
function refillPockets(g, s, emit, shotId) {
  const q = g.config,
    occupied = new Set(s.board.map((b) => `${b.r},${b.c}`));
  for (let lane = 0; lane < 3; lane++) {
    const old = s.board.filter((b) => b.c >= lane * 3 && b.c <= lane * 3 + 1);
    // Preserve every surviving lower player construction; no overwriting/recoloring.
    if (old.some((b) => b.r > 1) || old.length > 2) continue;
    const cells = moduleCells(lane, s.content.serial, q).filter(
      ([r, c]) => !occupied.has(`${r},${c}`),
    );
    if (!cells.length || cells.length > q.refillBatchMax || s.content.credit < cells.length)
      continue;
    const added = cells.map(([r, c, color]) => newSystem(g, s, r, c, color)),
      candidate = [...s.board, ...added];
    if (g.detached({ ...s, board: candidate }).length) continue;
    s.board = candidate;
    s.content.credit -= added.length;
    s.content.serial++;
    s.content.refills++;
    for (const b of added) occupied.add(`${b.r},${b.c}`);
    emit(
      'boardRefilled',
      { cause: 'vacantPocket', added: structuredClone(added), creditAfter: s.content.credit },
      shotId,
    );
    break;
  }
}
function refillSafeRow(g, s, emit, shotId) {
  const q = g.config,
    m = metrics(s.board, s.parity, q, s.loadedColor);
  if (
    m.height >= q.pressureRow - 1 ||
    s.content.credit < q.cols ||
    !(m.count < q.targetCount || m.colorsWithClear < q.minimumClearColors)
  )
    return;
  const parity = s.parity ^ 1,
    shifted = s.board.map((b) => ({ ...b, r: b.r + 1, ...position(b.r + 1, b.c, parity, q) }));
  const base = s.content.serial % q.colors.length,
    added = Array.from({ length: q.cols }, (_, c) =>
      newSystem(g, s, 0, c, q.colors[(base + Math.floor(c / 2)) % q.colors.length]),
    );
  added.forEach((b) => Object.assign(b, position(b.r, b.c, parity, q)));
  const candidate = [...shifted, ...added];
  if (g.detached({ ...s, parity, board: candidate }).length) return;
  s.parity = parity;
  s.board = candidate;
  s.content.credit -= added.length;
  s.content.serial++;
  s.content.refills++;
  emit(
    'boardRefilled',
    { cause: 'safeRow', added: structuredClone(added), creditAfter: s.content.credit },
    shotId,
  );
}
export function evolve(g, s, emit, shotId, blocked, result = {}) {
  ensure(s);
  const q = g.config;
  retire(g, s, emit, shotId, blocked);
  boundPlayerReserve(g, s, emit, shotId);
  if (q.densityEnabled) {
    advanceFlow(g, s, emit, shotId, { ...result, blocked });
    emit(
      'boardOpportunity',
      {
        ...metrics(s.board, s.parity, q, s.loadedColor),
        policy: 'ceilingWaves',
        reserve: s.content.reserve.length,
        credit: s.content.credit,
      },
      shotId,
    );
    return;
  }
  // Reserve always takes precedence over any new generation; restoration never rolls new colors.
  reuse(g, s, emit, shotId);
  if (s.content.reserve.length) return;
  if (q.boardPolicy === 'pockets') refillPockets(g, s, emit, shotId);
  else refillSafeRow(g, s, emit, shotId);
  if (!s.board.length && s.content.credit) {
    const n = Math.min(q.cols, s.content.credit, q.refillBatchMax),
      added = [];
    for (let c = 0; c < n; c++)
      added.push(
        newSystem(g, s, 0, c, q.colors[(s.content.serial + Math.floor(c / 2)) % q.colors.length]),
      );
    s.board = added;
    s.content.credit -= n;
    s.content.serial++;
    s.content.refills++;
    emit('boardRefilled', { cause: 'earnedEmpty', added: structuredClone(added) }, shotId);
  }
  emit(
    'boardOpportunity',
    {
      ...metrics(s.board, s.parity, q, s.loadedColor),
      policy: q.boardPolicy,
      reserve: s.content.reserve.length,
      credit: s.content.credit,
    },
    shotId,
  );
}
