import { MemoryStore } from './storage.mjs';
// Persist this separate "device" store across restarts; it models physical evidence.
export class SimulatedDispenser {
  constructor({ store = new MemoryStore(), ticketsPerSecond = 4 } = {}) {
    if (!Number.isFinite(ticketsPerSecond) || ticketsPerSecond <= 0)
      throw new Error('Invalid dispense rate');
    this.store = store;
    this.rate = ticketsPerSecond;
    this.elapsed = 0;
    this.jammed = false;
    this.dropNextAck = false;
    this.device = store.load() ?? { physicalCount: 0, batches: {} };
    store.save(this.device);
  }
  evidence(batchId) {
    const b = this.device.batches[batchId];
    return b
      ? { batchId, evidenceId: `sim-physical:${batchId}:${b.count}`, observedTotal: b.count }
      : null;
  }
  tick(game, dt) {
    if (!Number.isFinite(dt) || dt < 0) throw new Error('Invalid elapsed time');
    if (this.jammed) {
      this.elapsed = 0;
      return;
    }
    this.elapsed = Math.min(this.elapsed + dt, 1 / this.rate);
    if (this.elapsed < 1 / this.rate) return;
    this.elapsed = 0;
    const state = game.exportState(),
      active = state.ledger.batches.find((b) => b.status !== 'confirmed');
    // Never automatically retry an uncertain command. reconcile() is an explicit query.
    if (active && active.status !== 'prepared') return;
    const batch = active ?? game.prepareDispense();
    if (!batch) return;
    game.sendDispense(batch.id);
    const draft = structuredClone(this.device);
    if (!draft.batches[batch.id]) {
      draft.batches[batch.id] = { count: batch.requested };
      draft.physicalCount += batch.requested;
    }
    try {
      this.store.save(draft);
    } catch (error) {
      game.markDispenseUncertain(batch.id);
      throw error;
    }
    this.device = draft;
    if (this.dropNextAck) {
      this.dropNextAck = false;
      game.markDispenseUncertain(batch.id);
      return;
    }
    game.confirmDispense(this.evidence(batch.id));
  }
  reconcile(game, batchId) {
    const evidence = this.evidence(batchId);
    if (!evidence) return false;
    game.confirmDispense(evidence);
    return true;
  }
}
