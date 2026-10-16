import { earn, pendingTickets } from '../ledger.mjs';
import { grantSlotAmmo } from '../ammo-bonus.mjs';
import { creditHarvest, evolve } from '../board-policy.mjs';
import { collectStage, beginStage, decorate } from '../special.mjs';
import { endNetwork, networkView, updateNetwork } from '../mechanics.mjs';
import { harvestLowOpportunity } from '../low-opportunity.mjs';
const copy = (v) => structuredClone(v);
// Apply one committed prize through the existing ticket, ammo and board ledgers.
export function settleSlotReward(g, s, p, emit) {
  let removed = [],
    dropped = [],
    added = [];
  if (p.rewardType === 'tickets') {
    const rewardId = p.spinId + ':tickets';
    if (earn(s.ledger, rewardId, p.count))
      emit(
        'ticketsEarned',
        { rewardId, count: p.count, pending: pendingTickets(s.ledger) },
        p.spinId,
      );
  } else if (p.rewardType === 'ammo') {
    const count = grantSlotAmmo(s, p.spinId, p.count);
    if (count)
      emit(
        'ammoBonusEarned',
        {
          shotId: p.spinId,
          rewardId: p.spinId + ':ammo',
          count,
          source: 'petSlots',
          ammoAfter: s.paidAmmo,
        },
        p.spinId,
      );
  } else if (p.rewardType === 'dual') {
    Object.assign(s.assist, {
      charge: g.config.assistThreshold,
      state: 'ready',
      boostId: 'assist-' + ++s.assist.sequence,
      secondaryColor: p.secondaryColor,
    });
    emit(
      'assistReady',
      {
        interfaceVersion: 1,
        shotId: p.spinId,
        charge: s.assist.charge,
        threshold: g.config.assistThreshold,
        state: 'ready',
        boostId: s.assist.boostId,
        primaryColor: s.loadedColor,
        secondaryColor: p.secondaryColor,
        remainingAmmo: s.paidAmmo,
      },
      p.spinId,
    );
  } else if (p.rewardType === 'specials') {
    for (const id of p.targetIds) {
      const b = s.board.find((b) => b.id === id);
      if (!b || b.kind || b.source !== 'system')
        throw Error('Persisted special reward target changed during spin');
      b.kind = 'bomb';
      added.push(copy(b));
    }
  } else {
    const beforeNetwork = networkView(g, s),
      refills = s.content.refills;
    const ids = new Set(p.targetIds);
    removed = s.board.filter((b) => ids.has(b.id));
    if (removed.length !== ids.size)
      throw Error('Persisted clear reward target changed during spin');
    s.board = s.board.filter((b) => !ids.has(b.id));
    dropped = g.detached(s);
    const drops = new Set(dropped.map((b) => b.id));
    s.board = s.board.filter((b) => !drops.has(b.id));
    if (p.rewardType === 'lightning')
      emit(
        'networkPropagated',
        {
          interfaceVersion: 1,
          shotId: p.spinId,
          networkId: s.network.id,
          seeds: removed.slice(0, 1),
          activatedNodes: [],
          struckBalls: copy(removed),
          steps: copy(p.electricPaths),
          bombContacts: [],
          edges: beforeNetwork.edges,
          activatedCount: 0,
          rewardSource: 'petSlots',
        },
        p.spinId,
      );
    harvestLowOpportunity(s, removed, dropped, emit, p.spinId);
    const targets = collectStage(s, [...removed, ...dropped]);
    if (targets.length)
      emit(
        'targetsCollected',
        {
          shotId: p.spinId,
          rewardSource: 'petSlots',
          stageId: s.stage.id,
          targetIds: targets.map((b) => b.id),
          progress: s.stage.collectedIds.length,
          total: 3,
          remainingTargets: 3 - s.stage.collectedIds.length,
          award: s.stage.award,
          targets: copy(targets),
        },
        p.spinId,
      );
    const gain = removed.length * g.config.directTickets + dropped.length * g.config.dropTickets;
    const rewardId = p.spinId + ':clear';
    if (earn(s.ledger, rewardId, gain))
      emit('ticketsEarned', { rewardId, count: gain, pending: pendingTickets(s.ledger) }, p.spinId);
    creditHarvest(s, removed, dropped);
    endNetwork(g, s, emit, p.spinId);
    const complete = s.stage.collectedIds.length === 3;
    if (complete) {
      const rewardId = 'stage-' + s.stage.id;
      if (earn(s.ledger, rewardId, s.stage.award)) {
        emit(
          'stageBonusEarned',
          {
            shotId: p.spinId,
            rewardSource: 'petSlots',
            stageId: s.stage.id,
            rewardId,
            count: s.stage.award,
          },
          p.spinId,
        );
        emit(
          'ticketsEarned',
          { rewardId, count: s.stage.award, pending: pendingTickets(s.ledger) },
          p.spinId,
        );
      }
      beginStage(g, s);
    } else decorate(g, s);
    // A reward is not another paid shot. Only an empty board schedules its earned recovery wave.
    if (!s.board.length)
      evolve(g, s, emit, p.spinId, false, {
        directCount: removed.length,
        dropCount: dropped.length,
      });
    updateNetwork(g, s, emit, p.spinId, beforeNetwork, refills, false);
  }
  return { removed, dropped, added };
}
