// Small fixed-seed comparison. Not commercial return tuning or human play.
import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { EndlessGame, MemoryStore } from '../../src/core/index.mjs';
import { finish, seeded } from './strategies.mjs';

const started = performance.now(),
  rows = [];
for (const enabled of [false, true])
  for (const seed of [11, 77])
    for (const strategy of ['random', 'greedy']) {
      let game = new EndlessGame({
        seed,
        config: { assistEnabled: enabled, conductiveEnabled: enabled },
      });
      const rng = seeded(seed),
        counts = {},
        rewards = [];
      let maxHeight = 0,
        maxReserve = 0,
        restores = 0;
      const listen = (e) => {
        counts[e.type] = (counts[e.type] ?? 0) + 1;
      };
      game.onEvent = listen;
      game.coin({ receiptId: 'comparison-credit', coins: 110 });
      for (let i = 0; i < 1000; i++) {
        const options = strategy === 'greedy' ? game.opportunities() : [];
        options.sort(
          (a, b) => b.direct.length + 2 * b.dropped.length - a.direct.length - 2 * a.dropped.length,
        );
        game.setAim(
          strategy === 'random' ? (rng() * 2 - 1) * game.config.maxAim : (options[0]?.angle ?? 0),
        );
        const before = game.s.ledger.earned;
        game.fire();
        if (i % 71 === 0) {
          game = new EndlessGame({
            config: game.config,
            store: new MemoryStore(game.exportState()),
          });
          game.onEvent = listen;
          restores++;
        }
        finish(game);
        game.validate(game.s);
        rewards.push(game.s.ledger.earned - before);
        maxHeight = Math.max(maxHeight, ...game.s.board.map((b) => b.r + 1));
        maxReserve = Math.max(maxReserve, game.s.content.reserve.length);
        if (game.s.board.some((b) => b.y - game.config.radius <= game.config.dangerY))
          throw Error('Unsafe board');
      }
      rows.push({
        enabled,
        seed,
        strategy,
        paidAttempts: 1000,
        paidConsumed: 1000 - game.s.refundedShots,
        refunds: game.s.refundedShots,
        restores,
        meanTicketsPerAttempt: rewards.reduce((a, b) => a + b, 0) / 1000,
        zeroRewardRate: rewards.filter((v) => !v).length / 1000,
        maxTicketsPerAttempt: Math.max(...rewards),
        maxHeight,
        maxReserve,
        maintenance: game.s.content.maintenances,
        counts,
        remainingAmmo: game.s.paidAmmo,
        pendingTickets: game.snapshot().tickets.pending,
      });
    }
const result = {
  status: 'development-small-comparison-not-commercial-validation',
  automaticOnly: true,
  humanPlayMinutes: 0,
  actualWallSeconds: (performance.now() - started) / 1000,
  rows,
};
fs.mkdirSync(new URL('../fixtures/', import.meta.url), { recursive: true });
fs.writeFileSync(
  new URL('../fixtures/mechanics-comparison.json', import.meta.url),
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result));
