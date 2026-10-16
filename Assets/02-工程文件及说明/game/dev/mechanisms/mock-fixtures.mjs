// Explicit MOCK packets for art preview only. Never imported by the production entry.
import { corePoint } from '../../src/feedback/mechanisms/core-bridge.mjs';
const logic = (x, y) => ({ x: ((x - 450) * 9.9) / 900, y: 7 - ((y - 160) * 9.9) / 900 });
export function fixture() {
  const board = [];
  for (let r = 0; r < 5; r++)
    for (let col = 0; col < 7; col++)
      board.push({
        id: `mock-${r}-${col}`,
        r,
        c: col,
        ...logic(198 + 84 * col + (r % 2) * 42, 300 + 73 * r),
        color: (r + col) % 5,
        source: 'system',
      });
  const ids = ['mock-4-2', 'mock-3-2', 'mock-4-1'],
    colors = [1, 3, 4];
  const nodes = ids.map((id, i) => {
    const b = board.find((b) => b.id === id);
    b.kind = 'conductor';
    b.networkId = 'mock-network';
    b.color = colors[i];
    return { ...b };
  });
  board.find((b) => b.id === 'mock-4-3').color = 2;
  board.push({ id: 'mock-blue', r: 5, c: 1, color: 1, source: 'system', ...logic(324, 665) });
  board.push({ id: 'mock-green', r: 5, c: 3, color: 2, source: 'system', ...logic(492, 665) });
  for (const [i, r, col, x, y] of [
    [0, 6, 4, 534, 738],
    [1, 6, 5, 618, 738],
    [2, 7, 4, 576, 811],
    [3, 7, 5, 660, 811],
    [4, 8, 5, 618, 884],
    [5, 8, 6, 702, 884],
  ])
    board.push({
      id: `mock-hang-${i}`,
      r,
      c: col,
      color: (i + 2) % 5,
      source: 'system',
      kind: i === 0 ? 'target' : undefined,
      ...logic(x, y),
    });
  const edges = [
    [0, 1],
    [0, 2],
  ].map(([a, b]) => ({
    id: `mock-edge-${a}-${b}`,
    fromId: nodes[a].id,
    toId: nodes[b].id,
    from: { x: nodes[a].x, y: nodes[a].y },
    to: { x: nodes[b].x, y: nodes[b].y },
  }));
  return {
    revision: 0,
    angle: 0,
    paidAmmo: 10,
    loadedColor: 1,
    nextColor: 2,
    projectile: null,
    loading: false,
    stage: { id: 1, collected: 2, award: 8 },
    content: { reserve: [] },
    tickets: { earned: 0, confirmed: 0, pending: 0, uncertain: 0 },
    board,
    assist: {
      charge: 0,
      threshold: 3,
      state: 'charging',
      primaryColor: 1,
      secondaryColor: 2,
      boostId: 'mock-assist',
      enabled: true,
    },
    network: { id: 'mock-network', nodes, edges, enabled: true },
  };
}
export function hitEvents(s, mode, sequence = 1) {
  const shotId = `mock-shot-${sequence}`,
    nodes = s.network.nodes,
    hit = {
      id: `mock-projectile-${sequence}`,
      color: s.assist.primaryColor,
      source: 'player',
      ...logic(408, 665),
    },
    blue = [s.board.find((b) => b.id === 'mock-blue'), nodes[0], hit],
    green = [
      s.board.find((b) => b.id === 'mock-green'),
      s.board.find((b) => b.id === 'mock-4-3'),
      hit,
    ];
  const dual =
    mode === 'one' ? blue : mode === 'miss' || mode === 'dropped' ? [] : [...blue, ...green];
  const electric = mode === 'combined' ? nodes : [],
    direct = [...new Map([...dual, ...electric].map((b) => [b.id, b])).values()];
  const dropped =
    mode === 'combined'
      ? s.board.filter((b) => b.id.startsWith('mock-hang'))
      : mode === 'dropped'
        ? [...nodes]
        : [];
  const events = [],
    push = (type, payload) =>
      events.push({
        eventId: `event-${sequence + events.length}`,
        causeId: shotId,
        type,
        payload: { interfaceVersion: 1, shotId, ...payload },
      });
  push('dualMatchResolved', {
    groups: [
      { color: 1, matched: !!dual.length, size: blue.length, ids: blue.map((b) => b.id) },
      { color: 2, matched: mode === 'combined', size: green.length, ids: green.map((b) => b.id) },
    ],
    removedIds: direct.map((b) => b.id),
    attached: hit,
  });
  if (electric.length) {
    push('networkActivated', { seeds: [nodes[0]] });
    push('networkPropagated', {
      activatedNodes: nodes,
      steps: s.network.edges,
      edges: s.network.edges,
    });
  }
  push('paidShotResolved', {
    direct,
    dropped,
    electricIds: electric.map((b) => b.id),
    attached: hit,
    gain: direct.length + dropped.length * 2,
    bonus: mode === 'combined' ? 8 : 0,
    assist: { boostId: 'mock-assist' },
    matchedColors: mode === 'one' ? [1] : mode === 'combined' ? [1, 2] : [],
  });
  return { events, direct, dropped, hit, shotId, impact: corePoint(hit) };
}
