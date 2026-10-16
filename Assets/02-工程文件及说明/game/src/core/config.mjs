export const PROTOTYPE_CONFIG = Object.freeze({
  version: 'experimental-special-v4-1',
  status: 'prototype-values-not-production-return',
  boardPolicy: 'pockets',
  pressureRow: 8,
  refillBatchMax: 9,
  maxPlayerReserve: 18,
  minimumClearColors: 2,
  opportunitySamples: 61,
  ballsPerCoin: 10,
  colors: Object.freeze([0, 1, 2, 3, 4]),
  matchMinimum: 3,
  directTickets: 1,
  dropTickets: 2,
  refillEveryPaidShots: 5,
  lowCount: 18,
  targetCount: 45,
  initialRows: 5,
  cols: 9,
  spacing: 0.94,
  rowHeight: 0.814,
  top: 7,
  radius: 0.44,
  wall: 4.55,
  cannonY: -6.25,
  dangerY: -4.65,
  speed: 19,
  maxAim: 1.16,
  cooldown: 0.2,
  maxFrameSeconds: 0.25,
  simulatedTicketsPerSecond: 4,
  assistEnabled: true,
  assistThreshold: 3,
  conductiveEnabled: true,
  conductiveMaxNodes: 3,
  conductiveRefillGap: 3,
  conductivePaidGap: 2,
  lowOpportunityEnabled: true,
  lowOpportunityBombLimit: 12, // Deprecated save-compatibility field; no longer caps opportunity batches.
  densityEnabled: true,
  densityTarget: 63,
  densityBaseRows: 8,
  densityPeakRows: 12,
});
export function configWith(overrides = {}) {
  if (overrides.boardPolicy && !['safeRows', 'pockets'].includes(overrides.boardPolicy))
    throw Error('Invalid board policy');
  const allowed = new Set(Object.keys(PROTOTYPE_CONFIG));
  for (const k of Object.keys(overrides))
    if (!allowed.has(k)) throw new Error(`Unknown config: ${k}`);
  const c = structuredClone({ ...PROTOTYPE_CONFIG, ...overrides });
  if (
    typeof c.assistEnabled !== 'boolean' ||
    typeof c.conductiveEnabled !== 'boolean' ||
    typeof c.lowOpportunityEnabled !== 'boolean' ||
    typeof c.densityEnabled !== 'boolean' ||
    c.conductiveMaxNodes < 2 ||
    c.conductiveMaxNodes > 3
  )
    throw Error('Invalid mechanics configuration');
  for (const k of [
    'pressureRow',
    'refillBatchMax',
    'minimumClearColors',
    'opportunitySamples',
    'ballsPerCoin',
    'matchMinimum',
    'refillEveryPaidShots',
    'targetCount',
    'initialRows',
    'cols',
    'assistThreshold',
    'conductiveMaxNodes',
    'conductiveRefillGap',
    'conductivePaidGap',
    'densityTarget',
    'densityBaseRows',
    'densityPeakRows',
    'lowOpportunityBombLimit',
  ])
    if (!Number.isSafeInteger(c[k]) || c[k] < 1) throw new Error(`Invalid ${k}`);
  for (const k of ['directTickets', 'dropTickets', 'lowCount', 'maxPlayerReserve'])
    if (!Number.isSafeInteger(c[k]) || c[k] < 0) throw new Error(`Invalid ${k}`);
  for (const k of [
    'spacing',
    'rowHeight',
    'radius',
    'wall',
    'speed',
    'maxAim',
    'maxFrameSeconds',
    'simulatedTicketsPerSecond',
  ])
    if (!Number.isFinite(c[k]) || c[k] <= 0) throw new Error(`Invalid ${k}`);
  for (const k of ['top', 'cannonY', 'dangerY', 'cooldown'])
    if (!Number.isFinite(c[k])) throw new Error(`Invalid ${k}`);
  if (c.cooldown < 0 || c.maxAim >= Math.PI / 2 || c.maxFrameSeconds > 1)
    throw new Error('Invalid flight limits');
  if (
    !Array.isArray(c.colors) ||
    !c.colors.length ||
    new Set(c.colors).size !== c.colors.length ||
    c.colors.some((v) => !Number.isSafeInteger(v) || v < 0)
  )
    throw new Error('Invalid colors');
  const safeRows = Math.ceil((c.top - c.radius - c.dangerY) / c.rowHeight);
  if (
    c.initialRows > safeRows ||
    c.targetCount > c.cols * safeRows ||
    c.lowCount > c.targetCount ||
    c.targetCount < c.cols ||
    c.densityTarget < c.cols ||
    c.lowOpportunityBombLimit < 2 ||
    c.lowOpportunityBombLimit > 18 ||
    c.densityBaseRows < 7 ||
    c.densityPeakRows < c.densityBaseRows ||
    c.densityPeakRows >= safeRows ||
    c.densityTarget > c.cols * Math.min(c.pressureRow, 7)
  )
    throw new Error('Unsafe refill capacity');
  if (c.cannonY >= c.dangerY || c.dangerY >= c.top || c.wall <= 2 * c.radius)
    throw new Error('Invalid geometry');
  const maxX = ((c.cols - 1) / 2 + 0.25) * c.spacing;
  if (maxX + c.radius > c.wall) throw new Error('Columns exceed wall');
  if (
    c.pressureRow > safeRows - 1 ||
    c.opportunitySamples < 3 ||
    c.refillBatchMax < c.cols ||
    c.cols !== 9
  )
    throw Error('Invalid board limits');
  return Object.freeze({ ...c, colors: Object.freeze(c.colors) });
}
