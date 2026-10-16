// Only committed events create effects; effects never update a ticket balance.
export class EventView {
  constructor() {
    this.seen = new Set();
    this.earned = 0;
    this.confirmed = 0;
    this.reaction = 'idle';
  }
  consume(events) {
    const out = [];
    for (const e of events) {
      if (this.seen.has(e.eventId)) continue;
      this.seen.add(e.eventId);
      const p = e.payload;
      if (e.type === 'paidShotResolved') {
        out.push({ type: 'resolve', ...p });
        this.reaction = p.dropped.length ? 'cheer' : p.direct.length ? 'small' : 'hit';
      }
      if (e.type === 'ticketsEarned') {
        this.earned++;
        out.push({ type: 'earned', count: p.count });
      }
      if (e.type === 'dispenseConfirmed' && p.delta > 0) {
        this.confirmed++;
        out.push({ type: 'ack', delta: p.delta });
      }
      if (e.type === 'shotAccepted') out.push({ type: 'fire', mode: p.mode });
      if (e.type === 'bounce' || e.type === 'freeShotDeflected') out.push({ type: 'hit', ...p });
      if (e.type === 'boardMaintained') out.push({ type: 'maintenance', removed: p.removed });
    }
    return out;
  }
}
