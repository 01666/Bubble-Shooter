// Development mechanics interface v1. No ticket prices or physical collision changes.
export const MECHANICS_VERSION = 1;
const copy = (v) => structuredClone(v);
const event = (emit, type, payload, causeId) =>
  emit(type, { interfaceVersion: 1, ...payload }, causeId);

export function initializeMechanics(g, s, { legacy = false } = {}) {
  if (s.mechanicsVersion !== undefined) return;
  s.mechanicsVersion = MECHANICS_VERSION;
  s.assistRng = (s.rng ^ 0x73c921ab) >>> 0;
  s.assist = { charge: 0, sequence: 0, state: 'charging', boostId: null, secondaryColor: null };
  s.network = {
    sequence: 0,
    id: null,
    nextEligibleRefill: s.content.refills + (legacy ? 1 : 0),
    lastActivatedShot: null,
    lastEndedShot: null,
  };
  if (!legacy && g.config.conductiveEnabled) createNetwork(g, s);
}

export function assistView(g, s) {
  return {
    charge: s.assist.charge,
    threshold: g.config.assistThreshold,
    state: s.assist.state,
    boostId: s.assist.boostId,
    secondaryColor: s.assist.secondaryColor,
    primaryColor: s.projectile?.assist?.primaryColor ?? s.loadedColor,
    enabled: g.config.assistEnabled,
  };
}

export function networkView(g, s) {
  const nodes = s.board.filter((b) => b.kind === 'conductor').map(copy),
    byCell = new Map(nodes.map((b) => [`${b.r},${b.c}`, b])),
    edges = [];
  for (const b of nodes)
    for (const [r, c] of g.neighbors(b.r, b.c, s.parity)) {
      const other = byCell.get(`${r},${c}`);
      if (other && other.networkId === b.networkId && b.id < other.id)
        edges.push({
          id: `${b.id}:${other.id}`,
          fromId: b.id,
          toId: other.id,
          from: { x: b.x, y: b.y },
          to: { x: other.x, y: other.y },
        });
    }
  return {
    id: s.network.id,
    nodes,
    edges,
    reserveNodeIds: s.content.reserve.filter((b) => b.kind === 'conductor').map((b) => b.id),
    enabled: g.config.conductiveEnabled,
  };
}

function createNetwork(g, s) {
  const candidates = s.board
      .filter((b) => b.source === 'system' && !b.kind)
      .sort((a, b) => b.r - a.r || a.c - b.c),
    byCell = new Map(candidates.map((b) => [`${b.r},${b.c}`, b]));
  for (const first of candidates) {
    const selected = [],
      seen = new Set(),
      queue = [first];
    while (queue.length && selected.length < g.config.conductiveMaxNodes) {
      const b = queue.shift();
      if (seen.has(b.id)) continue;
      seen.add(b.id);
      selected.push(b);
      for (const [r, c] of g.neighbors(b.r, b.c, s.parity)) {
        const n = byCell.get(`${r},${c}`);
        if (n && !seen.has(n.id)) queue.push(n);
      }
    }
    if (selected.length < 2) continue;
    s.network.id = `network-${++s.network.sequence}`;
    for (const b of selected) {
      b.kind = 'conductor';
      b.networkId = s.network.id;
    }
    s.network.nextEligibleRefill = s.content.refills + g.config.conductiveRefillGap;
    return true;
  }
  return false;
}

export function endNetwork(g, s, emit, shotId) {
  if (s.network.id && ![...s.board, ...s.content.reserve].some((b) => b.kind === 'conductor')) {
    const networkId = s.network.id;
    s.network.id = null;
    s.network.lastEndedShot = s.paidShots + 1;
    event(emit, 'networkEnded', { shotId, networkId, reason: 'harvested' }, shotId);
  }
}

export function updateNetwork(
  g,
  s,
  emit,
  shotId,
  before,
  refillsBefore,
  attached = true,
  maintenancesBefore = s.content.maintenances,
) {
  const latest = Math.max(s.network.lastActivatedShot ?? -1, s.network.lastEndedShot ?? -1),
    cooldown = latest < 0 || s.paidShots - latest >= g.config.conductivePaidGap;
  if (
    attached &&
    g.config.conductiveEnabled &&
    !s.network.id &&
    s.content.refills > refillsBefore &&
    s.content.refills >= s.network.nextEligibleRefill &&
    cooldown &&
    createNetwork(g, s)
  ) {
    event(
      emit,
      'networkCreated',
      { shotId, reason: 'paidRefill', network: networkView(g, s) },
      shotId,
    );
  }
  const after = networkView(g, s);
  if (JSON.stringify(before) !== JSON.stringify(after))
    event(
      emit,
      'networkUpdated',
      {
        shotId,
        reason: s.content.maintenances > maintenancesBefore ? 'maintenance' : 'settlement',
        network: after,
      },
      shotId,
    );
}

export function acceptAssist(g, s, p, emit) {
  if (!g.config.assistEnabled || p.mode !== 'paid' || s.assist.state !== 'ready') return;
  p.assist = {
    boostId: s.assist.boostId,
    primaryColor: p.color,
    secondaryColor: s.assist.secondaryColor,
  };
  s.assist.state = 'inFlight';
  event(emit, 'assistShotAccepted', { shotId: p.shotId, ...p.assist, shot: copy(p) }, p.shotId);
}

export function finishAssist(g, s, p, attached, direct, emit) {
  if (p.assist) {
    if (!attached) {
      s.assist.state = 'ready';
      event(emit, 'assistRefunded', { shotId: p.shotId, ...p.assist }, p.shotId);
    } else {
      const boostId = s.assist.boostId;
      Object.assign(s.assist, {
        charge: 0,
        state: 'charging',
        boostId: null,
        secondaryColor: null,
      });
      event(
        emit,
        'assistConsumed',
        { shotId: p.shotId, boostId, result: direct.length ? 'clear' : 'attached' },
        p.shotId,
      );
    }
    return;
  }
  if (s.petSlots?.mode === 'slots' || !g.config.assistEnabled || !attached || !direct.length)
    return;
  const before = s.assist.charge;
  s.assist.charge++;
  event(
    emit,
    'assistChargeChanged',
    {
      shotId: p.shotId,
      before,
      after: s.assist.charge,
      threshold: g.config.assistThreshold,
      remainingAmmo: s.paidAmmo,
      sourcePoints: direct.map((b) => ({ id: b.id, x: b.x, y: b.y })),
    },
    p.shotId,
  );
  if (s.assist.charge === g.config.assistThreshold) {
    const colors = [...new Set(s.board.map((b) => b.color))].filter((c) => c !== s.loadedColor);
    // Advance only for a real draw; null is an explicit single-color qualification.
    let secondaryColor = null;
    if (colors.length) {
      s.assistRng = (Math.imul(s.assistRng, 1664525) + 1013904223) >>> 0;
      secondaryColor = colors[Math.floor((s.assistRng / 4294967296) * colors.length)];
    }
    Object.assign(s.assist, {
      state: 'ready',
      boostId: `assist-${++s.assist.sequence}`,
      secondaryColor,
    });
    event(
      emit,
      'assistReady',
      {
        shotId: p.shotId,
        primaryColor: s.loadedColor,
        ...assistView(g, s),
        remainingAmmo: s.paidAmmo,
      },
      p.shotId,
    );
  }
}

// Both colors use the fired ball as their starting point, never the other color as a bridge.
export function matchGroups(g, s, attached, secondaryColor = null) {
  const colors = [...new Set([attached.color, secondaryColor].filter((c) => c !== null))],
    byCell = new Map(s.board.map((b) => [`${b.r},${b.c}`, b])),
    ids = new Set(),
    groups = [];
  for (const color of colors) {
    const seen = new Set(),
      queue = [attached];
    while (queue.length) {
      const b = queue.pop();
      if (seen.has(b.id)) continue;
      seen.add(b.id);
      for (const [r, c] of g.neighbors(b.r, b.c, s.parity)) {
        const n = byCell.get(`${r},${c}`);
        if (n && n.color === color && !seen.has(n.id)) queue.push(n);
      }
    }
    const matched = seen.size >= g.config.matchMinimum;
    groups.push({ color, size: seen.size, matched, ids: [...seen] });
    if (matched) for (const id of seen) ids.add(id);
  }
  return {
    direct: s.board.filter((b) => ids.has(b.id)),
    groups,
    matchedColors: groups.filter((a) => a.matched).map((a) => a.color),
  };
}

// Shared bomb/conductor closure: all causal coordinates are taken from the pre-removal board.
export function expandMechanisms(g, s, direct) {
  const byCell = new Map(s.board.map((b) => [`${b.r},${b.c}`, b])),
    ids = new Set(direct.map((b) => b.id)),
    queue = [...direct],
    seen = new Set(),
    triggers = [],
    seeds = [],
    activated = [],
    steps = [],
    bombContacts = [],
    struck = new Map();
  // Stateless seeded choice: prediction, crash replay and settlement use the same path.
  // No opportunity scan consumes gameplay RNG, and no color is changed after firing.
  const hash = (value) => {
    let h = 2166136261;
    for (const ch of String(value)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
    return h;
  };
  const initialIds = new Set(ids);
  const inventory = s.board
    .filter((b) => b.source === 'system')
    .map((b) => b.id)
    .sort()
    .join('|');
  let electricBudget = null;
  while (queue.length) {
    const b = queue.shift();
    if (seen.has(b.id)) continue;
    seen.add(b.id);
    if (b.kind !== 'bomb' && b.kind !== 'conductor') continue;
    if (b.kind === 'bomb') triggers.push(b);
    else {
      activated.push(b);
      struck.set(b.id, b);
      if (electricBudget === null) electricBudget = 3 + (hash(inventory + b.id) % 4);
      const frontier = [b];
      const walked = new Set([b.id]);
      while (frontier.length && electricBudget > 0 && steps.length < 12) {
        const from = frontier.pop();
        const candidates = g
          .neighbors(from.r, from.c, s.parity)
          .map(([r, c]) => byCell.get(`${r},${c}`))
          .filter(
            (n) =>
              n &&
              !walked.has(n.id) &&
              !struck.has(n.id) &&
              (!ids.has(n.id) || initialIds.has(n.id)),
          )
          .sort(
            (a, z) =>
              hash(inventory + b.id + `${from.r},${from.c}:${a.r},${a.c}`) -
              hash(inventory + b.id + `${from.r},${from.c}:${z.r},${z.c}`),
          );
        if (!candidates.length) continue;
        const n = candidates[0];
        walked.add(n.id);
        ids.add(n.id);
        struck.set(n.id, n);
        steps.push({
          fromId: from.id,
          toId: n.id,
          from: { x: from.x, y: from.y },
          to: { x: n.x, y: n.y },
        });
        if (!initialIds.has(n.id)) electricBudget--;
        // Backtrack to a real adjacent fork if the current branch reaches an edge.
        frontier.push(from, n);
        if (n.kind === 'bomb' && !seen.has(n.id) && !initialIds.has(n.id))
          bombContacts.push({
            fromId: from.id,
            toId: n.id,
            from: { x: from.x, y: from.y },
            to: { x: n.x, y: n.y },
          });
        if (n.kind === 'bomb' || n.kind === 'conductor') queue.push(n);
      }
    }
    if (b.kind === 'conductor') continue;
    for (const [r, c] of g.neighbors(b.r, b.c, s.parity)) {
      const n = byCell.get(`${r},${c}`);
      if (!n) continue;
      if (n.kind === 'conductor' && b.kind === 'bomb' && !ids.has(n.id)) seeds.push(n);
      ids.add(n.id);
      if (!seen.has(n.id)) queue.push(n);
    }
  }
  const initial = direct.filter((b) => b.kind === 'conductor');
  return {
    direct: s.board.filter((b) => ids.has(b.id)),
    triggers,
    electric: {
      seeds: [...new Map([...initial, ...seeds].map((b) => [b.id, b])).values()],
      activatedNodes: activated,
      struckBalls: [...struck.values()],
      steps,
      bombContacts,
    },
  };
}

export function validateMechanics(g, s) {
  const a = s.assist,
    n = s.network;
  if (
    s.mechanicsVersion !== 1 ||
    !a ||
    !n ||
    !Number.isSafeInteger(s.assistRng) ||
    s.assistRng < 0 ||
    s.assistRng > 0xffffffff ||
    !Number.isSafeInteger(a.charge) ||
    a.charge < 0 ||
    a.charge > g.config.assistThreshold ||
    !Number.isSafeInteger(a.sequence) ||
    a.sequence < 0 ||
    !['charging', 'ready', 'inFlight'].includes(a.state) ||
    (a.secondaryColor !== null && !g.config.colors.includes(a.secondaryColor))
  )
    throw Error('Invalid assist');
  if (
    (a.state === 'charging') !== a.charge < g.config.assistThreshold ||
    (a.state === 'charging'
      ? a.boostId !== null || a.secondaryColor !== null
      : a.boostId !== `assist-${a.sequence}` || !a.sequence)
  )
    throw Error('Invalid assist qualification');
  const p = s.projectile;
  if (
    (a.state === 'inFlight') !== !!p?.assist ||
    (p?.assist &&
      (p.mode !== 'paid' ||
        p.assist.boostId !== a.boostId ||
        p.assist.primaryColor !== p.color ||
        p.assist.secondaryColor !== a.secondaryColor))
  )
    throw Error('Invalid in-flight assist');
  if (
    !Number.isSafeInteger(n.sequence) ||
    n.sequence < 0 ||
    !Number.isSafeInteger(n.nextEligibleRefill) ||
    n.nextEligibleRefill < 0 ||
    [n.lastActivatedShot, n.lastEndedShot].some(
      (v) => v !== null && (!Number.isSafeInteger(v) || v < 0),
    )
  )
    throw Error('Invalid network counters');
  const nodes = [...s.board, ...s.content.reserve].filter((b) => b.kind === 'conductor');
  if (
    nodes.length > g.config.conductiveMaxNodes ||
    !!nodes.length !== !!n.id ||
    (n.id && n.id !== `network-${n.sequence}`) ||
    nodes.some((b) => b.source !== 'system' || b.networkId !== n.id || b.stageId !== undefined)
  )
    throw Error('Invalid conductive inventory');
}
