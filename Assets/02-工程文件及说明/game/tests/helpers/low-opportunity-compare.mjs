// Actual core runs: low-ammo on/off, repeated single-coin entry versus top-up timing.
// This is an opportunity/structure smoke comparison, not commercial return calibration.
import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { EndlessGame, MemoryStore } from '../../src/core/index.mjs';
import { seeded, finish } from './strategies.mjs';

const start = performance.now(),
  rows = [],
  sampleEvents = [],
  sampleCheckpoints = [];
for (const enabled of [false, true])
  for (const seed of [11, 77])
    for (const strategy of ['random', 'greedy'])
      for (const purchaseMode of ['empty', 'earlyTopup']) {
        let game = new EndlessGame({ seed, config: { lowOpportunityEnabled: enabled } });
        const rng = seeded(seed),
          counts = {},
          reasons = {},
          rewards = [],
          initial = game.snapshot();
        let receipt = 0,
          restores = 0,
          maxHeight = 0,
          maxPlayerReserve = 0,
          noRewardRun = 0,
          maxNoRewardRun = 0;
        const capture = enabled && seed === 77 && strategy === 'greedy' && purchaseMode === 'empty';
        const listen = (e) => {
          counts[e.type] = (counts[e.type] ?? 0) + 1;
          if (e.type.startsWith('lowOpportunity'))
            reasons[`${e.type}:${e.payload.reason ?? 'none'}`] =
              (reasons[`${e.type}:${e.payload.reason ?? 'none'}`] ?? 0) + 1;
          if (capture) sampleEvents.push(e);
        };
        game.onEvent = listen;
        for (let i = 0; i < 1000; i++) {
          if (game.s.paidAmmo === 0 || (purchaseMode === 'earlyTopup' && game.s.paidAmmo <= 3)) {
            // Only zero balance can free-select, as confirmed by the product.
            if (!game.s.paidAmmo) {
              let best = game.s.loadedColor,
                bestScore = -1;
              for (const color of game.config.colors) {
                const value = Math.max(
                  0,
                  ...game.opportunities(color).map((m) => m.direct.length + 2 * m.dropped.length),
                );
                if (value > bestScore) {
                  best = color;
                  bestScore = value;
                }
              }
              if (strategy === 'greedy')
                while (game.s.loadedColor !== best) {
                  game.fire();
                  finish(game);
                }
            }
            game.coin({ receiptId: `comparison-${++receipt}` });
          }
          const moves = strategy === 'greedy' ? game.opportunities() : [];
          moves.sort(
            (a, b) =>
              b.direct.length + 2 * b.dropped.length - a.direct.length - 2 * a.dropped.length,
          );
          game.setAim(
            strategy === 'random' ? (rng() * 2 - 1) * game.config.maxAim : (moves[0]?.angle ?? 0),
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
          const gain = game.s.ledger.earned - before;
          rewards.push(gain);
          noRewardRun = gain ? 0 : noRewardRun + 1;
          maxNoRewardRun = Math.max(maxNoRewardRun, noRewardRun);
          maxHeight = Math.max(maxHeight, ...game.s.board.map((b) => b.r + 1));
          maxPlayerReserve = Math.max(
            maxPlayerReserve,
            game.s.content.reserve.filter((b) => b.source === 'player').length,
          );
          if (game.s.board.some((b) => b.y - game.config.radius <= game.config.dangerY))
            throw Error('Unsafe board');
          if (
            capture &&
            (i < 10 || sampleEvents.slice(-4).some((e) => e.type === 'lowOpportunityAppeared'))
          )
            sampleCheckpoints.push({ paidAttempt: i + 1, snapshot: game.snapshot() });
        }
        const opportunity = game.snapshot().lowOpportunity;
        if (purchaseMode === 'earlyTopup' && opportunity.usedSlots)
          throw Error('Top-ups before threshold cannot qualify');
        rows.push({
          enabled,
          seed,
          strategy,
          purchaseMode,
          paidAttempts: 1000,
          restores,
          coins: receipt,
          refunds: game.s.refundedShots,
          meanTicketsPerAttempt: rewards.reduce((a, b) => a + b, 0) / 1000,
          zeroRewardRate: rewards.filter((v) => !v).length / 1000,
          maxNoRewardRun,
          maxTicketsPerAttempt: Math.max(...rewards),
          maintenance: game.s.content.maintenances,
          maxHeight,
          maxPlayerReserve,
          opportunitySlots: opportunity.usedSlots,
          appeared: counts.lowOpportunityAppeared ?? 0,
          counts,
          reasons,
          remainingAmmo: game.s.paidAmmo,
          pendingTickets: game.snapshot().tickets.pending,
        });
        if (capture) {
          fs.writeFileSync(
            new URL('../fixtures/low-opportunity-events.json', import.meta.url),
            JSON.stringify(
              {
                interfaceVersion: 2,
                status: 'isolated-actual-core-automatic-events-not-human-play',
                initial,
                checkpoints: sampleCheckpoints,
                events: sampleEvents,
                final: game.snapshot(),
              },
              null,
              2,
            ),
          );
        }
      }
const result = {
  status: 'small-opportunity-comparison-not-commercial-validation',
  automaticOnly: true,
  humanPlayMinutes: 0,
  actualWallSeconds: (performance.now() - start) / 1000,
  rows,
};
fs.writeFileSync(
  new URL('../fixtures/low-opportunity-comparison.json', import.meta.url),
  JSON.stringify(result, null, 2),
);
console.log(
  JSON.stringify({
    actualWallSeconds: result.actualWallSeconds,
    rows: rows.map(({ counts, reasons, ...r }) => r),
  }),
);
