// Public, deterministic low-ammo opportunity. No lottery, ticket gift or physics modification.
import { options, predict } from './geometry.mjs';
const copy = (v) => structuredClone(v);
const purchased = (g, s) =>
  Object.values(s.receipts).reduce((n, coins) => n + coins * g.config.ballsPerCoin, 0);
const consumed = (s) => s.paidShots - s.refundedShots;
const hash = (value) => {
  let h = 2166136261;
  for (const c of String(value)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
};
const low = (s) => s.paidAmmo >= 1 && s.paidAmmo <= 2;
export function opportunityBurstCount(roll) {
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1)
    throw Error('Invalid opportunity count roll');
  return roll < 0.2 ? 5 : roll < 0.4 ? 4 : roll < 0.7 ? 3 : 2;
}
const send = (emit, type, record, s, causeId, extra = {}) =>
  emit(
    type,
    {
      interfaceVersion: 2,
      opportunityId: record.opportunityId,
      ballId: record.ballId,
      specialType: 'bomb',
      remainingAmmo: s.paidAmmo,
      ...extra,
    },
    causeId,
  );

export function initializeLowOpportunity(g, s) {
  if (s.lowOpportunity !== undefined) return;
  const interval = Math.max(3, g.config.ballsPerCoin);
  s.lowOpportunity = {
    version: 2,
    interval,
    cadenceSeed: hash(s.rng + ':low-opportunity'),
    purchaseBaseline: Math.max(
      0,
      purchased(g, s) - s.paidAmmo - (s.projectile?.mode === 'paid' ? 1 : 0),
    ),
    consumeBaseline: consumed(s),
    usedSlots: 0,
    sequence: 0,
    nextEligibleConsumed: interval - 2,
    episodeActive: false,
    episodeQualified: false,
    pending: null,
    last: null,
  };
}

export function lowOpportunityView(g, s) {
  const o = s.lowOpportunity;
  return {
    ...copy(o),
    enabled: g.config.lowOpportunityEnabled,
    fundedSlots: Math.floor((purchased(g, s) - o.purchaseBaseline) / o.interval),
    consumed: consumed(s) - o.consumeBaseline,
    remainingAmmo: s.paidAmmo,
    targets: [
      ...s.board.map((b) => ({ ...b, location: 'board' })),
      ...s.content.reserve.map((b) => ({ ...b, location: 'reserve' })),
    ]
      .filter((b) => b.lowOpportunityId)
      .map(copy),
  };
}

function finishPending(s, emit, causeId, reason, identifiers = {}) {
  const o = s.lowOpportunity,
    record = o.pending;
  if (!record) return;
  Object.assign(record, { status: 'skipped', reason, remainingAmmo: s.paidAmmo });
  o.last = record;
  o.pending = null;
  send(emit, 'lowOpportunityFinished', record, s, causeId, {
    ...identifiers,
    status: 'skipped',
    reason,
  });
}

export function lowOpportunityCoin(g, s, emit, receiptId) {
  // Replenishment may close an unplaced application, never create or erase a target.
  if (s.paidAmmo > 2) {
    finishPending(s, emit, receiptId, 'replenished', { receiptId });
    s.lowOpportunity.episodeActive = false;
    s.lowOpportunity.episodeQualified = false;
  }
}

export function harvestLowOpportunity(s, direct, dropped, emit, shotId) {
  for (const [method, balls] of [
    ['direct', direct],
    ['drop', dropped],
  ])
    for (const b of balls) {
      if (!b.lowOpportunityId) continue;
      const record = { opportunityId: b.lowOpportunityId, ballId: b.id };
      if (
        s.lowOpportunity.last?.opportunityId === b.lowOpportunityId &&
        ![...s.board, ...s.content.reserve].some((n) => n.lowOpportunityId === b.lowOpportunityId)
      )
        Object.assign(s.lowOpportunity.last, {
          status: 'consumed',
          reason: method,
          remainingAmmo: s.paidAmmo,
        });
      send(emit, 'lowOpportunityFinished', record, s, shotId, {
        shotId,
        status: 'consumed',
        reason: method,
        ball: copy(b),
      });
    }
}

function candidate(g, s, selected = []) {
  const eligible = s.board.filter(
    (b) =>
      b.source === 'system' &&
      !b.kind &&
      b.r < g.config.densityPeakRows &&
      b.y - g.config.radius > g.config.dangerY,
  );
  if (!eligible.length) return null;
  const secondary = s.assist.state === 'ready' ? s.assist.secondaryColor : null;
  const current = new Set(
    options(
      s.board,
      s.parity,
      g.config,
      s.loadedColor,
      g.config.opportunitySamples,
      secondary,
    ).flatMap((m) => m.direct.map((b) => b.id)),
  );
  const preview = new Set(
    s.paidAmmo === 2
      ? options(s.board, s.parity, g.config, s.nextColor).flatMap((m) => m.direct.map((b) => b.id))
      : [],
  );
  const publicIds = new Set(
    g.config.colors
      .flatMap((color) => options(s.board, s.parity, g.config, color))
      .flatMap((m) => m.direct.map((b) => b.id)),
  );
  const exposed = new Set();
  for (let i = 0; i < g.config.opportunitySamples; i++) {
    const t = predict(
      s.board,
      s.parity,
      g.config,
      -g.config.maxAim + (2 * g.config.maxAim * i) / (g.config.opportunitySamples - 1),
    ).target;
    if (t) exposed.add(t.id);
  }
  const maxRow = Math.max(...s.board.map((b) => b.r));
  const seed = s.lowOpportunity.pending?.placementSeed ?? s.rng;
  const scored = eligible
    .map((ball) => {
      const access = current.has(ball.id)
        ? 'current'
        : preview.has(ball.id)
          ? 'preview'
          : publicIds.has(ball.id)
            ? 'publicColor'
            : exposed.has(ball.id)
              ? 'exposedFrontier'
              : 'upperInterior';
      // Favor the middle/upper depth; avoid the topmost anchor and the lowest fringe.
      const depth = maxRow ? ball.r / maxRow : 0.45;
      const heightWeight = depth >= 0.2 && depth <= 0.65 ? 8 : depth < 0.2 ? 3 : 1;
      const accessWeight = access === 'upperInterior' ? 0.8 : access === 'current' ? 1.6 : 1.2;
      const u = (hash(seed + ':' + ball.id) + 1) / 4294967297;
      const anchors = [...selected, ...s.board.filter((b) => b.kind)];
      const separation = anchors.length
        ? Math.min(...anchors.map((b) => Math.hypot(ball.x - b.x, ball.y - b.y) / g.config.spacing))
        : Infinity;
      const spacingWeight =
        separation < 1.8 ? 0.025 : separation < 2.5 ? 0.15 : separation < 3.2 ? 0.6 : 1;
      return {
        ball,
        access,
        separation,
        batchSeparation: selected.length
          ? Math.min(
              ...selected.map((b) => Math.hypot(ball.x - b.x, ball.y - b.y) / g.config.spacing),
            )
          : Infinity,
        rank: -Math.log(u) / (heightWeight * accessWeight * spacingWeight),
      };
    })
    .sort((a, b) => a.rank - b.rank || a.ball.c - b.ball.c);
  const batchSpread = scored.filter((b) => b.batchSeparation >= 2.5);
  const base = batchSpread.length ? batchSpread : scored;
  const spread = base.filter((b) => b.separation >= 2.5);
  // Never let accessibility weighting override spacing: crowded boards choose the widest gap.
  const pool = spread.length ? spread : base;
  pool.sort((a, b) => b.separation - a.separation || a.rank - b.rank);
  return pool[0];
}

export function settleLowOpportunity(g, s, attached, emit, shotId) {
  if (!attached || !g.config.lowOpportunityEnabled) return; // Refunds cannot retry or qualify.
  const o = s.lowOpportunity;
  if (!low(s)) {
    finishPending(s, emit, shotId, s.paidAmmo ? 'replenished' : 'noPaidShots', { shotId });
    o.episodeActive = false;
    o.episodeQualified = false;
    return;
  }
  if (!o.episodeActive) {
    o.episodeActive = true;
    o.episodeQualified = false;
  }
  if (!o.episodeQualified) {
    const fundedSlots = Math.floor((purchased(g, s) - o.purchaseBaseline) / o.interval),
      net = consumed(s) - o.consumeBaseline;
    if (o.usedSlots < fundedSlots && net >= o.nextEligibleConsumed) {
      o.cadenceSeed ??= hash(s.rng + ':low-opportunity');
      o.usedSlots++;
      o.sequence++;
      o.episodeQualified = true;
      o.nextEligibleConsumed = net + o.interval; // No catch-up banking of past consumption.
      o.pending = {
        opportunityId: `low-opportunity-${o.sequence}`,
        requestedShotId: shotId,
        status: 'pending',
        specialType: 'bomb',
        remainingAtQualification: s.paidAmmo,
        remainingAmmo: s.paidAmmo,
        ballId: null,
        reason: null,
        placementSeed: hash(s.rng + ':' + o.sequence + ':placement'),
        requestedCount: opportunityBurstCount(
          hash(o.cadenceSeed + ':' + o.sequence + ':count') / 4294967296,
        ),
        appearanceAmmo:
          s.paidAmmo === 1
            ? 1
            : hash((o.cadenceSeed ?? s.rng) + ':' + o.sequence + ':timing') % 100 < 60
              ? 2
              : 1,
      };
      send(emit, 'lowOpportunityQualified', o.pending, s, shotId, {
        shotId,
        interval: o.interval,
        usedSlots: o.usedSlots,
        nextEligibleConsumed: o.nextEligibleConsumed,
      });
    }
  }
  if (!o.pending) return;
  if (s.paidAmmo > (o.pending.appearanceAmmo ?? 2)) return;
  const requestedCount = o.pending.requestedCount ?? 2;
  const available = s.board.filter(
    (b) =>
      b.source === 'system' &&
      !b.kind &&
      b.r < g.config.densityPeakRows &&
      b.y - g.config.radius > g.config.dangerY,
  ).length;
  const chosen = available >= requestedCount ? candidate(g, s) : null;
  const reason = available === 0 ? 'noUsableTarget' : 'insufficientTargets';
  o.pending.remainingAmmo = s.paidAmmo;
  if (!chosen) {
    const changed = o.pending.reason !== reason;
    Object.assign(o.pending, { status: 'deferred', reason });
    if (changed) send(emit, 'lowOpportunityDeferred', o.pending, s, shotId, { shotId, reason });
    return;
  }
  const record = o.pending,
    appearances = [];
  let selection = chosen;
  for (let i = 0; i < requestedCount && selection; i++) {
    const b = selection.ball;
    b.kind = 'bomb';
    b.lowOpportunityId = record.opportunityId;
    appearances.push({ ball: copy(b), access: selection.access });
    selection = candidate(
      g,
      s,
      appearances.map((a) => a.ball),
    );
  }
  Object.assign(record, {
    status: 'appeared',
    ballId: appearances[0].ball.id,
    ballIds: appearances.map((a) => a.ball.id),
    reason: null,
    access: chosen.access,
  });
  o.last = record;
  o.pending = null;
  for (const a of appearances)
    send(emit, 'lowOpportunityAppeared', record, s, shotId, {
      shotId,
      ballId: a.ball.id,
      ball: a.ball,
      access: a.access,
      burstCount: appearances.length,
      requestedCount: record.requestedCount ?? 2,
    });
}

export function validateLowOpportunity(g, s) {
  const o = s.lowOpportunity;
  if (!o || o.version !== 2 || o.interval !== Math.max(3, g.config.ballsPerCoin))
    throw Error('Invalid low opportunity');
  if (
    o.cadenceSeed !== undefined &&
    (!Number.isInteger(o.cadenceSeed) || o.cadenceSeed < 0 || o.cadenceSeed > 0xffffffff)
  )
    throw Error('Invalid opportunity cadence seed');
  for (const record of [o.pending, o.last])
    if (record?.appearanceAmmo !== undefined && ![1, 2].includes(record.appearanceAmmo))
      throw Error('Invalid opportunity timing');
  for (const record of [o.pending, o.last])
    if (record?.requestedCount !== undefined && ![2, 3, 4, 5].includes(record.requestedCount))
      throw Error('Invalid opportunity count');
  for (const k of [
    'purchaseBaseline',
    'consumeBaseline',
    'usedSlots',
    'sequence',
    'nextEligibleConsumed',
  ])
    if (!Number.isSafeInteger(o[k]) || o[k] < 0) throw Error('Invalid opportunity counter');
  const net = consumed(s) - o.consumeBaseline,
    funded = Math.floor((purchased(g, s) - o.purchaseBaseline) / o.interval);
  if (
    net < 0 ||
    funded < o.usedSlots ||
    o.usedSlots !== o.sequence ||
    typeof o.episodeActive !== 'boolean' ||
    typeof o.episodeQualified !== 'boolean' ||
    (o.episodeQualified && !o.episodeActive)
  )
    throw Error('Opportunity funding failed');
  for (const record of [o.pending, o.last])
    if (
      record &&
      (!/^low-opportunity-[1-9]\d*$/.test(record.opportunityId) ||
        Number(record.opportunityId.split('-').at(-1)) > o.sequence ||
        record.specialType !== 'bomb' ||
        !['pending', 'deferred', 'appeared', 'consumed', 'skipped'].includes(record.status) ||
        ![1, 2].includes(record.remainingAtQualification))
    )
      throw Error('Invalid opportunity record');
  if (
    o.pending &&
    (!o.episodeActive ||
      !['pending', 'deferred'].includes(o.pending.status) ||
      o.pending.ballId !== null)
  )
    throw Error('Invalid pending opportunity');
  const targets = [...s.board, ...s.content.reserve].filter((b) => b.lowOpportunityId);
  if (
    [...new Set(targets.map((b) => b.lowOpportunityId))].some(
      (id) => targets.filter((b) => b.lowOpportunityId === id).length > 5,
    ) ||
    targets.some(
      (b) =>
        b.source !== 'system' ||
        b.kind !== 'bomb' ||
        !/^low-opportunity-[1-9]\d*$/.test(b.lowOpportunityId) ||
        Number(b.lowOpportunityId.split('-').at(-1)) > o.sequence,
    )
  )
    throw Error('Invalid opportunity target');
}
