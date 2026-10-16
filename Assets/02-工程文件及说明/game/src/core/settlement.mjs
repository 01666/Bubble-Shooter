import { recordCombo } from './combo.mjs';
import { chargePet } from './pet-slots.mjs';
import { beginStage, decorate, collectStage } from './special.mjs';
import { grantAmmoBonus } from './ammo-bonus.mjs';
import { earn, pendingTickets } from './ledger.mjs';
import { creditHarvest, evolve } from './board-policy.mjs';
import {
  networkView,
  matchGroups,
  expandMechanisms,
  endNetwork,
  updateNetwork,
  finishAssist,
} from './mechanics.mjs';
import { harvestLowOpportunity, settleLowOpportunity } from './low-opportunity.mjs';
const copy = (v) => structuredClone(v);
const cellKey = (r, c) => `${r},${c}`;
// Called inside the host transaction. Preserve settlement and event order exactly.
export function settleShot(g, s, hit, emit) {
  const p = s.projectile,
    q = g.config,
    byCell = new Map(s.board.map((b) => [cellKey(b.r, b.c), b]));
  const networkBefore = networkView(g, s),
    refillsBefore = s.content.refills,
    maintenancesBefore = s.content.maintenances,
    earnedBefore = s.ledger.earned;
  let matching = { groups: [], matchedColors: [] },
    electricIds = [],
    explosionCount = 0;
  const candidates = (
    hit ? g.neighbors(hit.r, hit.c, s.parity) : Array.from({ length: q.cols }, (_, c) => [0, c])
  )
    .filter(([r, c]) => !byCell.has(cellKey(r, c)))
    .map(([r, c]) => ({ r, c, ...g.pos(r, c, s.parity) }));
  candidates.sort(
    (a, b) =>
      (a.x - p.x) ** 2 + (a.y - p.y) ** 2 - ((b.x - p.x) ** 2 + (b.y - p.y) ** 2) ||
      a.r - b.r ||
      a.c - b.c,
  );
  s.state = 'resolving';
  let attached = null,
    direct = [],
    dropped = [];
  if (candidates.length) {
    attached = g.make(s, candidates[0].r, candidates[0].c, p.color);
    s.board.push(attached);
    byCell.set(cellKey(attached.r, attached.c), attached);
    matching = matchGroups(g, s, attached, p.assist?.secondaryColor ?? null);
    direct = matching.direct;
    if (p.assist)
      emit(
        'dualMatchResolved',
        {
          interfaceVersion: 1,
          shotId: p.shotId,
          ...p.assist,
          groups: copy(matching.groups),
          matchedColors: matching.matchedColors,
          removedIds: direct.map((b) => b.id),
          attached: copy(attached),
        },
        p.shotId,
      );
    if (direct.length) {
      const expanded = expandMechanisms(g, s, direct);
      direct = expanded.direct;
      electricIds = expanded.electric.struckBalls.map((b) => b.id);
      if (electricIds.length) {
        s.network.lastActivatedShot = s.paidShots + 1;
        emit(
          'networkActivated',
          {
            interfaceVersion: 1,
            shotId: p.shotId,
            networkId: s.network.id,
            seeds: copy(expanded.electric.seeds),
            activatedCount: expanded.electric.activatedNodes.length,
          },
          p.shotId,
        );
        emit(
          'networkPropagated',
          {
            interfaceVersion: 1,
            shotId: p.shotId,
            networkId: s.network.id,
            ...copy(expanded.electric),
            edges: networkBefore.edges,
            activatedCount: expanded.electric.activatedNodes.length,
          },
          p.shotId,
        );
      }
      explosionCount = expanded.triggers.length;
      if (expanded.triggers.length)
        emit(
          'explosionResolved',
          {
            shotId: p.shotId,
            triggers: copy(expanded.triggers),
            removed: copy(direct),
            triggerCount: expanded.triggers.length,
            removedCount: direct.length,
          },
          p.shotId,
        );
      const ids = new Set(direct.map((b) => b.id));
      s.board = s.board.filter((b) => !ids.has(b.id));
      dropped = g.detached(s);
      const drops = new Set(dropped.map((b) => b.id));
      s.board = s.board.filter((b) => !drops.has(b.id));
      endNetwork(g, s, emit, p.shotId);
    }
  }
  harvestLowOpportunity(s, direct, dropped, emit, p.shotId);
  const collected = collectStage(s, [...direct, ...dropped]);
  if (collected.length)
    emit(
      'targetsCollected',
      {
        stageId: s.stage.id,
        targetIds: collected.map((b) => b.id),
        progress: s.stage.collectedIds.length,
        total: 3,
        remainingTargets: 3 - s.stage.collectedIds.length,
        award: s.stage.award,
        targets: copy(collected),
      },
      p.shotId,
    );
  const complete = s.stage.collectedIds.length === 3;
  let bonus = 0;
  if (complete) {
    const rewardId = 'stage-' + s.stage.id;
    if (earn(s.ledger, rewardId, s.stage.award)) {
      bonus = s.stage.award;
      emit('stageBonusEarned', { stageId: s.stage.id, rewardId, count: bonus }, p.shotId);
      emit(
        'ticketsEarned',
        { rewardId, count: bonus, pending: pendingTickets(s.ledger) },
        p.shotId,
      );
    }
  }
  const gain = direct.length * q.directTickets + dropped.length * q.dropTickets,
    rewardId = `${p.shotId}:basic`;
  if (earn(s.ledger, rewardId, gain))
    emit('ticketsEarned', { rewardId, count: gain, pending: pendingTickets(s.ledger) }, p.shotId);
  s.paidShots++;
  const bonusAmmo = attached ? grantAmmoBonus(s, p.shotId, direct, dropped, emit) : 0;
  emit(
    'paidShotResolved',
    {
      shotId: p.shotId,
      attached: copy(attached),
      direct: copy(direct),
      dropped: copy(dropped),
      bonus,
      gain,
      rewardId: gain ? rewardId : null,
      assist: copy(p.assist ?? null),
      matchedColors: matching.matchedColors,
      electricIds,
      directCount: direct.length,
      dropCount: dropped.length,
      explosionCount,
      electricCount: electricIds.length,
      bonusAmmo,
      earnedDelta: s.ledger.earned - earnedBefore,
      pendingTickets: pendingTickets(s.ledger),
      remainingAmmo: s.paidAmmo + (!attached ? 1 : 0),
      stageId: s.stage.id,
      stageAward: s.stage.award,
      lowOpportunityIds: [
        ...new Set(
          [...direct, ...dropped].filter((b) => b.lowOpportunityId).map((b) => b.lowOpportunityId),
        ),
      ],
    },
    p.shotId,
  );
  creditHarvest(s, direct, dropped);
  if (!attached) {
    s.paidAmmo++;
    s.refundedShots++;
    emit(
      'shotRefunded',
      { shotId: p.shotId, reason: 'noLegalCell', ammoAfter: s.paidAmmo },
      p.shotId,
    );
  }
  evolve(g, s, emit, p.shotId, !attached, {
    directCount: direct.length,
    dropCount: dropped.length,
  });
  if (complete) beginStage(g, s);
  else decorate(g, s);
  updateNetwork(g, s, emit, p.shotId, networkBefore, refillsBefore, !!attached, maintenancesBefore);
  const eligible = [...new Set(s.board.map((b) => b.color))];
  if (eligible.length) s.nextColor = eligible[Math.floor(g.random(s) * eligible.length)];
  emit('previewLoaded', { color: s.nextColor, eligibleColors: eligible }, p.shotId);
  recordCombo(s, p.shotId, attached, direct, emit);
  finishAssist(g, s, p, attached, direct, emit);
  settleLowOpportunity(g, s, attached, emit, p.shotId);
  s.projectile = null;
  s.cooldown = Math.max(q.cooldown, s.content.flow?.pending?.delay ?? 0);
  s.state = 'ready';
  chargePet(g, s, p, attached, direct, emit);
}
