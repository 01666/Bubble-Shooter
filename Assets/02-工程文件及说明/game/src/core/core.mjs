import { initializeCombo } from './combo.mjs';
import { initializePetSlots, petSlotsView, tickPetSlot } from './pet-slots.mjs';
import { tickPetChain } from './pet-chain.mjs';
import { validateState } from './state-validation.mjs';
import { initializeAmmoBonus } from './ammo-bonus.mjs';
import { settleShot } from './settlement.mjs';
import { beginStage, decorate } from './special.mjs';
import { configWith } from './config.mjs';
import { MemoryStore } from './storage.mjs';
import { newLedger, pendingTickets, prepare, sent, confirm, uncertain } from './ledger.mjs';
import { seedPolicy, initializeDensity } from './board-policy.mjs';
import { tickFlow } from './endless-flow.mjs';
import { flight, predict, metrics, options, position, neighbors } from './geometry.mjs';
import {
  initializeMechanics,
  assistView,
  networkView,
  acceptAssist,
  updateNetwork,
} from './mechanics.mjs';
import {
  initializeLowOpportunity,
  lowOpportunityView,
  lowOpportunityCoin,
} from './low-opportunity.mjs';
const copy = (v) => structuredClone(v);
export const cellKey = (r, c) => `${r},${c}`;
export class EndlessGame {
  constructor({
    config = {},
    store = new MemoryStore(),
    onEvent = () => {},
    seed = 20261010,
    petSlotsEnabled = true,
  } = {}) {
    this.config = configWith(config);
    this.petSlotsEnabled = petSlotsEnabled;
    this.store = store;
    this.onEvent = onEvent;
    this.fault = null;
    this.lastListenerError = null;
    let saved = store.load();
    if (saved) {
      if (saved.config?.boardPolicy) saved.config = copy(configWith(saved.config));
      if (saved.schemaVersion !== 1 || JSON.stringify(saved.config) !== JSON.stringify(this.config))
        throw new Error('Saved configuration/schema mismatch; explicit migration required');
      this.s = copy(saved);
      this.s.refundedShots ??= 0;
      initializeAmmoBonus(this.s);
      initializeMechanics(this, this.s, { legacy: true });
      initializeLowOpportunity(this, this.s);
      initializeDensity(this, this.s);
      initializeCombo(this.s);
      initializePetSlots(this, this.s);
      this.validate(this.s);
      let recovered = false;
      for (const b of this.s.ledger.batches)
        if (b.status === 'inFlight') {
          b.status = 'uncertain';
          recovered = true;
        }
      if (recovered) this.s.revision++;
      this.validate(this.s);
      store.save(this.s);
    } else {
      this.s = {
        schemaVersion: 1,
        config: copy(this.config),
        revision: 0,
        eventSequence: 0,
        rng: seed >>> 0,
        angle: 0,
        paidAmmo: 0,
        paidShots: 0,
        shotSequence: 0,
        bubbleSequence: 0,
        receipts: {},
        board: [],
        parity: 0,
        projectile: null,
        cooldown: 0,
        state: 'ready',
        ledger: newLedger(),
      };
      this.s.refundedShots = 0;
      initializeAmmoBonus(this.s);
      this.seedBoard(this.s);
      beginStage(this, this.s);
      this.s.loadedColor = this.randomColor(this.s);
      this.s.nextColor = this.randomColor(this.s);
      initializeMechanics(this, this.s);
      initializeLowOpportunity(this, this.s);
      initializeDensity(this, this.s);
      initializeCombo(this.s);
      initializePetSlots(this, this.s);
      this.validate(this.s);
      store.save(this.s);
    }
  }
  random(s) {
    s.rng = (Math.imul(s.rng, 1664525) + 1013904223) >>> 0;
    return s.rng / 4294967296;
  }
  randomColor(s) {
    return this.config.colors[Math.floor(this.random(s) * this.config.colors.length)];
  }
  pos(r, c, parity = this.s.parity) {
    return position(r, c, parity, this.config);
  }
  make(s, r, c, color) {
    return {
      id: `bubble-${++s.bubbleSequence}`,
      source: 'player',
      bornShot: s.paidShots + 1,
      r,
      c,
      color,
      ...this.pos(r, c, s.parity),
    };
  }
  neighbors(r, c, parity = this.s.parity) {
    return neighbors(r, c, parity, this.config.cols);
  }
  seedBoard(s) {
    seedPolicy(this, s);
  }
  validate(s) {
    return validateState(this, s);
  }
  tx(fn) {
    if (this.fault) throw new Error('Storage fault; restore from durable state before continuing');
    const draft = copy(this.s),
      events = [];
    const emit = (type, payload = {}, causeId = null) => events.push({ type, payload, causeId });
    const result = fn(draft, emit);
    draft.revision++;
    const wrapped = events.map((e) => ({
      ...e,
      eventId: `event-${++draft.eventSequence}`,
      revision: draft.revision,
      configVersion: this.config.version,
    }));
    this.validate(draft);
    try {
      this.store.save(draft);
    } catch (error) {
      this.fault = String(error.message || error);
      throw error;
    }
    this.s = draft;
    for (const e of wrapped)
      try {
        this.onEvent(copy(e));
      } catch (error) {
        this.lastListenerError = String(error.message || error);
      }
    return result;
  }
  setAim(angle) {
    if (!Number.isFinite(angle)) throw new Error('Invalid angle');
    return this.tx((s) => {
      s.angle = Math.max(-this.config.maxAim, Math.min(this.config.maxAim, angle));
    });
  }
  coin({ receiptId, coins = 1 }) {
    if (typeof receiptId !== 'string' || !receiptId || !Number.isSafeInteger(coins) || coins <= 0)
      throw new Error('Invalid coin receipt');
    return this.tx((s, emit) => {
      const old = Object.hasOwn(s.receipts, receiptId) ? s.receipts[receiptId] : undefined;
      if (old !== undefined) {
        if (old !== coins) throw new Error('Conflicting coin receipt');
        return false;
      }
      const addedAmmo = coins * this.config.ballsPerCoin;
      if (!Number.isSafeInteger(addedAmmo) || !Number.isSafeInteger(s.paidAmmo + addedAmmo))
        throw new Error('Ammo overflow');
      Object.defineProperty(s.receipts, receiptId, {
        value: coins,
        enumerable: true,
        writable: true,
        configurable: true,
      });
      s.paidAmmo += addedAmmo;
      emit(
        'coinCredited',
        { receiptId, addedAmmo, ammoAfter: s.paidAmmo, loadedColor: s.loadedColor },
        receiptId,
      );
      lowOpportunityCoin(this, s, emit, receiptId);
      return true;
    });
  }
  fire() {
    return this.tx((s, emit) => {
      if (s.projectile || s.cooldown > 0 || s.content.flow?.pending) {
        emit('shotRejected', { reason: 'busy' });
        return false;
      }
      const mode = s.paidAmmo > 0 ? 'paid' : 'free',
        color = s.loadedColor,
        shotId = `shot-${++s.shotSequence}`;
      if (mode === 'paid') {
        s.paidAmmo--;
        s.loadedColor = s.nextColor;
      } else {
        s.loadedColor =
          this.config.colors[(this.config.colors.indexOf(color) + 1) % this.config.colors.length];
      }
      const dx = Math.sin(s.angle),
        dy = Math.cos(s.angle);
      s.projectile = {
        shotId,
        mode,
        color,
        x: dx * 0.7,
        y: this.config.cannonY + dy * 0.7,
        vx: dx * this.config.speed,
        vy: dy * this.config.speed,
        deflected: false,
      };
      s.state = `${mode}Flight`;
      emit(
        'shotAccepted',
        {
          shotId,
          mode,
          shot: copy(s.projectile),
          ammoAfter: s.paidAmmo,
          loadedAfter: s.loadedColor,
          nextAfter: s.nextColor,
        },
        shotId,
      );
      acceptAssist(this, s, s.projectile, emit);
      return true;
    });
  }
  advance(dt) {
    if (!Number.isFinite(dt) || dt < 0) throw new Error('Invalid elapsed time');
    if (
      !dt ||
      (!this.s.projectile &&
        this.s.cooldown === 0 &&
        !this.s.content.flow?.pending &&
        this.s.petSlots.state !== 'spinning' &&
        !this.s.petSlots.chainRemaining &&
        !this.s.petSlots.deadlineShotId)
    )
      return;
    // Clamp physics catch-up: hidden tab/idle does not evolve or descend the board.
    return this.tx((s, emit) => {
      const elapsed = Math.min(dt, this.config.maxFrameSeconds);
      tickPetChain(s, elapsed, emit);
      s.cooldown = Math.max(0, s.cooldown - elapsed);
      const n = Math.ceil(elapsed / 0.005);
      for (let i = 0; i < n && s.projectile; i++) this.step(s, elapsed / n, emit);
      if (s.petSlots.state === 'spinning') tickPetSlot(this, s, elapsed, emit);
      if (!s.projectile && s.content.flow?.pending) {
        const causeId = s.content.flow.pending.shotId;
        const before = networkView(this, s),
          refills = s.content.refills;
        if (tickFlow(this, s, elapsed, emit)) {
          if (s.petSlots.chainRemaining > 0) s.petSlots.chainGrace = 0.55;
          decorate(this, s);
          updateNetwork(this, s, emit, causeId, before, refills, true);
          const eligible = [...new Set(s.board.map((b) => b.color))];
          if (eligible.length && !eligible.includes(s.nextColor)) {
            s.nextColor = eligible[Math.floor(this.random(s) * eligible.length)];
            emit('previewLoaded', { color: s.nextColor, eligibleColors: eligible }, causeId);
          }
        }
        s.cooldown = Math.max(s.cooldown, s.content.flow.pending?.delay ?? 0);
      }
    });
  }
  step(s, dt, emit) {
    const p = s.projectile,
      q = this.config,
      f = flight(s.board, q, p, dt);
    for (const b of f.bounces) emit('bounce', { shotId: p.shotId, ...b }, p.shotId);
    if (p.mode === 'free' && p.deflected) {
      if (p.y < q.cannonY - q.radius) {
        s.projectile = null;
        s.cooldown = q.cooldown;
        s.state = 'ready';
        emit('freeShotExited', { shotId: p.shotId }, p.shotId);
      }
      return;
    }
    if (f.contact) {
      if (p.mode === 'free') {
        p.deflected = true;
        p.vx = -p.vx;
        p.vy = -Math.abs(p.vy);
        emit('freeShotDeflected', { shotId: p.shotId, x: p.x, y: p.y }, p.shotId);
      } else this.settle(s, f.hit, emit);
    }
  }
  detached(s) {
    const byCell = new Map(s.board.map((b) => [cellKey(b.r, b.c), b])),
      seen = new Set(),
      queue = s.board.filter((b) => b.r === 0);
    while (queue.length) {
      const b = queue.pop();
      if (seen.has(b.id)) continue;
      seen.add(b.id);
      for (const [r, c] of this.neighbors(b.r, b.c, s.parity)) {
        const a = byCell.get(cellKey(r, c));
        if (a && !seen.has(a.id)) queue.push(a);
      }
    }
    return s.board.filter((b) => !seen.has(b.id));
  }
  settle(s, hit, emit) {
    return settleShot(this, s, hit, emit);
  }
  prepareDispense() {
    return this.tx((s, emit) => {
      const b = prepare(s.ledger);
      if (b) emit('dispensePrepared', { batchId: b.id, count: b.requested }, b.id);
      return b;
    });
  }
  sendDispense(batchId) {
    return this.tx((s, emit) => {
      sent(s.ledger, batchId);
      emit('dispenseSent', { batchId, count: 1 }, batchId);
    });
  }
  confirmDispense(evidence) {
    return this.tx((s, emit) => {
      const delta = confirm(s.ledger, evidence);
      if (delta)
        emit(
          'dispenseConfirmed',
          { ...evidence, delta, pending: pendingTickets(s.ledger) },
          evidence.batchId,
        );
      return delta;
    });
  }
  markDispenseUncertain(batchId) {
    return this.tx((s, emit) => {
      if (uncertain(s.ledger, batchId)) emit('dispenseUncertain', { batchId }, batchId);
    });
  }
  exportState() {
    return copy(this.s);
  }
  snapshot() {
    const s = this.s;
    return {
      combo: copy(s.combo),
      petSlots: petSlotsView(s),
      mechanicsVersion: s.mechanicsVersion,
      assist: assistView(this, s),
      network: networkView(this, s),
      lowOpportunity: lowOpportunityView(this, s),
      stage: {
        id: s.stage.id,
        collected: s.stage.collectedIds.length,
        total: 3,
        award: s.stage.award,
        available: s.stage.targetIds.length - s.stage.collectedIds.length,
      },
      loading: !!s.projectile && s.projectile.mode === 'paid',
      boardPolicy: this.config.boardPolicy,
      refundedShots: s.refundedShots,
      content: copy(s.content),
      schemaVersion: 1,
      revision: s.revision,
      state: this.fault ? 'storageFault' : s.state,
      storageFault: this.fault,
      configVersion: this.config.version,
      paidAmmo: s.paidAmmo,
      ammoBonusTotal: s.ammoBonus.total,
      loadedColor: s.loadedColor,
      nextColor: s.nextColor,
      angle: s.angle,
      paidShots: s.paidShots,
      board: copy(s.board),
      projectile: copy(s.projectile),
      tickets: {
        earned: s.ledger.earned,
        confirmed: s.ledger.confirmed,
        pending: pendingTickets(s.ledger),
        uncertain: s.ledger.batches
          .filter((b) => b.status === 'uncertain')
          .reduce((n, b) => n + b.requested - b.confirmed, 0),
      },
      dispenserState: s.ledger.batches.find((b) => b.status !== 'confirmed')?.status ?? 'idle',
      durability: this.store.durable ?? 'unspecified',
    };
  }
  trace(angle = this.s.angle) {
    if (!Number.isFinite(angle)) throw Error('Invalid angle');
    const a = Math.max(-this.config.maxAim, Math.min(this.config.maxAim, angle));
    const p = predict(this.s.board, this.s.parity, this.config, a);
    return {
      points: p.points,
      target: copy(p.hit),
      landing: copy(p.landing),
      mode: this.s.paidAmmo > 0 ? 'paid' : 'free',
    };
  }
  opportunities(color = this.s.loadedColor) {
    return options(
      this.s.board,
      this.s.parity,
      this.config,
      color,
      this.config.opportunitySamples,
      this.s.assist.state === 'ready' ? this.s.assist.secondaryColor : null,
    );
  }
  boardMetrics() {
    return metrics(this.s.board, this.s.parity, this.config, this.s.loadedColor);
  }
}
