import { configWith } from './config.mjs';
import { EndlessGame } from './core.mjs';
import { MemoryStore } from './storage.mjs';
// Pure, opt-in migration. Caller backs up both machine and device stores before installation.
export function migrateV2State(old, { boardPolicy = 'pockets', ...overrides } = {}) {
  if (!old || old.schemaVersion !== 1 || old.content) throw Error('Expected a v2 machine snapshot');
  if (old.projectile || old.cooldown > 0)
    throw Error('Migration requires an idle, settled boundary');
  const keys = [
    'ballsPerCoin',
    'colors',
    'cols',
    'spacing',
    'rowHeight',
    'top',
    'radius',
    'wall',
    'cannonY',
    'dangerY',
    'speed',
    'maxAim',
    'cooldown',
    'maxFrameSeconds',
    'directTickets',
    'dropTickets',
    'simulatedTicketsPerSecond',
  ];
  const inherited = Object.fromEntries(keys.map((k) => [k, old.config[k]])),
    config = configWith({ ...inherited, boardPolicy, ...overrides });
  for (const k of [
    'ballsPerCoin',
    'colors',
    'cols',
    'spacing',
    'rowHeight',
    'top',
    'radius',
    'wall',
    'cannonY',
  ])
    if (JSON.stringify(config[k]) !== JSON.stringify(old.config[k]))
      throw Error(`Explicit resource/geometry migration required: ${k}`);
  const s = structuredClone(old);
  s.config = structuredClone(config);
  s.refundedShots ??= 0;
  // V2 had no origin tags. Conservatively treat existing inventory as a one-time initial pool,
  // not as newly generated rewards; preserve every identity/color and disclose unknown provenance.
  s.board = s.board.map((b) => ({ ...b, source: 'system', legacyOriginUnknown: true }));
  s.content = {
    credit: 0,
    serial: 0,
    reserve: [],
    refills: 0,
    maintenances: 0,
    retiredPlayer: 0,
    retiredSystem: 0,
    initialSystemCount: s.board.length,
  };
  return new EndlessGame({ config, store: new MemoryStore(s) }).exportState();
}
