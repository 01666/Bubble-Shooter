// Isolated, actual-core sample for presentation adaptation, never imported by the game.
import fs from 'node:fs';
import { EndlessGame } from '../../src/core/index.mjs';
import { finish } from './strategies.mjs';

const game = new EndlessGame({ seed: 20261011 }),
  events = [],
  initial = game.snapshot();
game.onEvent = (e) => events.push(e);
game.coin({ receiptId: 'isolated-interface-sample', coins: 100 });
const checkpoints = [];
for (let i = 0; i < 200; i++) {
  const candidates = game
    .opportunities()
    .sort(
      (a, b) => b.direct.length + 2 * b.dropped.length - a.direct.length - 2 * a.dropped.length,
    );
  game.setAim(candidates[0]?.angle ?? 0);
  game.fire();
  finish(game);
  if (i < 10 || game.s.assist.state === 'ready')
    checkpoints.push({ shot: i + 1, snapshot: game.snapshot() });
}
const supported = [
  'assistChargeChanged',
  'assistReady',
  'assistShotAccepted',
  'dualMatchResolved',
  'assistConsumed',
  'networkCreated',
  'networkUpdated',
  'networkActivated',
  'networkPropagated',
  'networkEnded',
];
for (const type of supported)
  if (!events.some((e) => e.type === type)) throw Error(`Missing sample event ${type}`);
const result = {
  interfaceVersion: 1,
  status: 'development-actual-core-isolated-sample',
  seed: 20261011,
  initial,
  checkpoints,
  events,
  final: game.snapshot(),
  eventCounts: Object.fromEntries(
    supported.map((type) => [type, events.filter((e) => e.type === type).length]),
  ),
};
fs.mkdirSync(new URL('../fixtures/', import.meta.url), { recursive: true });
fs.writeFileSync(
  new URL('../fixtures/mechanics-events.json', import.meta.url),
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result.eventCounts));
