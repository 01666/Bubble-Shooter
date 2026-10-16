import { position } from './geometry.mjs';
import { pickBoardColor } from './board-colors.mjs';
import { decorateIncoming } from './special-placement.mjs';

// Waves come from above, never from the holes a player just earned.
export function initializeFlow(g, s) {
  s.content.flow ??= { version: 1, pressure: 0, threshold: 4, grace: 0, sinceWave: 0, waves: 0 };
  s.content.flow.pending ??= null;
  s.content.flow.recoveryArmed ??= false;
}

export function flowHeight(g, s) {
  const fronts = Array.from({ length: g.config.cols }, (_, c) =>
    Math.max(0, ...s.board.filter((b) => b.c === c).map((b) => b.r + 1)),
  ).sort((a, b) => a - b);
  return { bulk: fronts[Math.floor(fronts.length * 0.6)], max: Math.max(...fronts) };
}

export function tickFlow(g, s, dt, emit) {
  const f = s.content.flow;
  if (!f?.pending || s.projectile) return false;
  f.pending.delay = Math.max(0, f.pending.delay - dt);
  if (f.pending.delay > 0) return false;
  const p = f.pending;
  f.pending = null;
  let changed = false;
  for (let i = 0; i < p.rows; i++) {
    if (!wave(g, s, emit, p.shotId, p.cause)) break;
    changed = true;
  }
  if (changed) {
    f.pressure = 0;
    f.sinceWave = 0;
    f.recoveryArmed = false;
    f.threshold = 3 + Math.floor(g.random(s) * 3);
  }
  return changed;
}

function wave(g, s, emit, shotId, cause) {
  const q = g.config,
    available = s.content.reserve.length + s.content.credit;
  const count = s.board.length ? q.cols : Math.min(q.cols, available);
  if (!count || available < count) return false;
  const parity = s.parity ^ 1;
  const moved = s.board.map((b) => ({
    id: b.id,
    from: { r: b.r, c: b.c },
    to: { r: b.r + 1, c: b.c },
  }));
  const shifted = s.board.map((b) => ({ ...b, r: b.r + 1, ...position(b.r + 1, b.c, parity, q) }));
  const added = [],
    reused = [];
  for (let c = 0; c < count; c++) {
    let b;
    if (s.content.reserve.length) {
      b = { ...s.content.reserve.shift() };
      reused.push(b.id);
      Object.assign(b, { r: 0, c, ...position(0, c, parity, q) });
    } else {
      b = g.make(s, 0, c, pickBoardColor(g, s, [...shifted, ...added], 0, c, parity));
      Object.assign(b, { source: 'system', ...position(0, c, parity, q) });
      s.content.credit--;
    }
    added.push(b);
  }
  s.parity = parity;
  s.board = [...shifted, ...added];
  decorateIncoming(g, s, added);
  s.content.refills++;
  s.content.serial++;
  s.content.flow.waves++;
  emit('boardRepositioned', { reason: 'ceilingAdvance', moved, gain: 0 }, shotId);
  emit(
    'boardRefilled',
    { cause, added: structuredClone(added), reusedIds: reused, creditAfter: s.content.credit },
    shotId,
  );
  return true;
}

export function advanceFlow(g, s, emit, shotId, result = {}) {
  initializeFlow(g, s);
  const f = s.content.flow,
    clear = (result.directCount ?? 0) > 0;
  if (result.blocked) return;
  f.sinceWave++;
  if (clear) {
    f.pressure = Math.max(0, f.pressure - 1);
    if ((result.directCount ?? 0) + (result.dropCount ?? 0) >= 12 && !f.recoveryArmed) {
      f.grace = 1;
      f.recoveryArmed = true;
    }
  } else if (!result.blocked) f.pressure = Math.min(f.threshold, f.pressure + 1);
  const resting = f.grace > 0;
  if (resting && !clear) f.grace--;
  else if (resting && (result.directCount ?? 0) + (result.dropCount ?? 0) < 12) f.grace--;
  const { bulk, max: height } = flowHeight(g, s);
  const depleted = bulk < g.config.densityBaseRows - 1 && f.sinceWave >= 2 && !resting;
  const pressure =
    !clear && bulk < g.config.densityBaseRows && f.pressure >= f.threshold && !resting;
  // A tall board pauses the ceiling; the endless-mode safety valve handles physical jams.
  const safeHeight = Math.floor(
    (g.config.top - g.config.radius - g.config.dangerY) / g.config.rowHeight,
  );
  if (
    (depleted || pressure || !height) &&
    height < safeHeight &&
    (!f.pending || !height) &&
    s.content.reserve.length + s.content.credit >= (height ? g.config.cols : 1)
  ) {
    const rows = !height
      ? 7 + Math.floor(g.random(s) * 2)
      : depleted
        ? Math.min(6, 7 - bulk + Math.floor(g.random(s) * 2))
        : 1;
    // A full clear invalidates a previously planned shallow recovery wave.
    // Replace it now, rather than entering two rows and catching up several shots later.
    f.pending = {
      shotId,
      cause: !height ? 'emptyBoardWave' : depleted ? 'recoveryWave' : 'pressureWave',
      rows: Math.min(rows, safeHeight - height),
      delay: clear ? 1.45 : 0.7,
    };
    emit('boardWaveIncoming', { ...f.pending, bulkHeight: bulk, gain: 0 }, shotId);
  }
  emit(
    'boardPressureChanged',
    {
      pressure: f.pressure,
      threshold: f.threshold,
      grace: f.grace,
      waves: f.waves,
      ceilingPaused: bulk >= g.config.densityBaseRows || height >= safeHeight,
      gain: 0,
    },
    shotId,
  );
}

export function validateFlow(g, s) {
  if (!g.config.densityEnabled) return;
  const f = s.content?.flow;
  if (
    !f ||
    f.version !== 1 ||
    ![3, 4, 5].includes(f.threshold) ||
    ['pressure', 'grace', 'sinceWave', 'waves'].some(
      (k) => !Number.isSafeInteger(f[k]) || f[k] < 0,
    ) ||
    f.pressure > f.threshold ||
    f.grace > 2
  )
    throw Error('Invalid ceiling wave state');
  if (
    typeof f.recoveryArmed !== 'boolean' ||
    (f.pending &&
      (!Number.isFinite(f.pending.delay) ||
        f.pending.delay < 0 ||
        !Number.isSafeInteger(f.pending.rows) ||
        f.pending.rows < 1 ||
        f.pending.rows > 8))
  )
    throw Error('Invalid pending wave');
}
