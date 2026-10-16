import { validColor, validPoint } from './art.mjs';
export const corePoint = (b) => ({ x: 450 + (b.x * 900) / 9.9, y: 160 + ((7 - b.y) * 900) / 9.9 });
export function assistColors(assist) {
  if (!assist) return [];
  return [...new Set([assist.primaryColor, assist.secondaryColor].filter(validColor))];
}
// Interface v1 adapter. Only explicit core fields determine groups, nodes and connectivity.
export class CoreMechanismBridge {
  constructor(director, { mapPoint = corePoint } = {}) {
    this.director = director;
    this.mapPoint = mapPoint;
    this.cache = new Map();
    this.pending = new Map();
    this.warnings = [];
  }
  snapshot(s) {
    const a = s.assist ?? {},
      n = s.network ?? {};
    return {
      assist: {
        charge: a.charge ?? 0,
        ready: a.state === 'ready',
        colors: assistColors(a),
        boostId: a.boostId,
        enabled: a.enabled !== false,
      },
      network: {
        enabled: n.enabled !== false,
        nodes: (n.nodes ?? []).map((b) => ({ ...b, ...this.mapPoint(b) })),
        edges: (n.edges ?? []).map((e) => ({ from: e.fromId, to: e.toId })),
      },
    };
  }
  restore(s, options) {
    this.cache.clear();
    this.pending.clear();
    this.warnings = [];
    this.remember(s);
    this.director.restore(this.snapshot(s), options);
  }
  remember(s) {
    for (const b of s?.board ?? []) this.cache.set(b.id, { ...b });
  }
  convert(b) {
    return b && validPoint(b) ? { ...b, ...this.mapPoint(b) } : null;
  }
  warn(message) {
    this.warnings.push(message);
    if (this.warnings.length > 24) this.warnings.shift();
  }
  consume(events, snapshot) {
    const packets = [];
    // Cache committed pre-removal coordinates, not the new board's replacement cells.
    for (const e of events ?? []) {
      const p = e.payload ?? {};
      for (const b of [
        ...(p.direct ?? []),
        ...(p.dropped ?? []),
        ...(p.seeds ?? []),
        ...(p.activatedNodes ?? []),
        ...(p.struckBalls ?? []),
      ])
        if (b.id && validPoint(b)) this.cache.set(b.id, { ...b });
      if (p.attached?.id && validPoint(p.attached))
        this.cache.set(p.attached.id, { ...p.attached });
    }
    const results = new Map(
      (events ?? [])
        .filter((e) => e.type === 'paidShotResolved')
        .map((e) => [e.payload.shotId, e.payload]),
    );
    for (const e of events ?? []) {
      const p = e.payload ?? {},
        shot = p.shotId ?? e.causeId,
        seq = Number(/^event-(\d+)$/.exec(e.eventId)?.[1]) || 0;
      if (
        [
          'assistChargeChanged',
          'assistReady',
          'assistShotAccepted',
          'dualMatchResolved',
          'networkActivated',
          'networkPropagated',
        ].includes(e.type) &&
        p.interfaceVersion !== 1
      ) {
        this.warn('unsupported mechanism interfaceVersion');
        continue;
      }
      const base = { id: e.eventId, sequence: seq, shotId: shot };
      if (e.type === 'assistChargeChanged') {
        const b = results.get(p.shotId)?.direct?.[0];
        if (b) packets.push({ ...base, kind: 'charge', from: this.convert(b) });
        else this.warn('charge has no resolved direct position; static collar still updates');
      }
      if (e.type === 'assistReady') packets.push({ ...base, kind: 'ready' });
      if (e.type === 'assistShotAccepted') packets.push({ ...base, kind: 'fire' });
      if (['dualMatchResolved', 'networkActivated', 'networkPropagated'].includes(e.type)) {
        if (!p.shotId) {
          this.warn('mechanism event missing shotId');
          continue;
        }
        let record = this.pending.get(p.shotId);
        if (!record) {
          record = { groups: [], nodes: [], roots: [], steps: [] };
          this.pending.set(p.shotId, record);
        }
        if (e.type === 'dualMatchResolved') {
          record.groups = (p.groups ?? [])
            .filter((g) => g.matched)
            .map((g) => ({ color: g.color, ids: g.ids ?? [] }));
          record.impact = this.convert(p.attached);
        }
        if (e.type === 'networkActivated') record.roots = (p.seeds ?? []).map((b) => b.id);
        if (e.type === 'networkPropagated') {
          record.nodes = p.struckBalls ?? p.activatedNodes ?? [];
          record.steps = p.steps ?? [];
          record.contacts = p.bombContacts ?? [];
          if (p.seeds?.length) record.roots = p.seeds.map((b) => b.id);
        }
      }
      if (e.type === 'paidShotResolved') {
        const record = this.pending.get(p.shotId);
        this.pending.delete(p.shotId);
        if (!record) continue;
        const arrivals = new Map(record.roots.map((id) => [id, 0.14]));
        const steps = record.steps.map((step, index) => {
          const delay = arrivals.get(step.fromId) ?? index * 0.14;
          arrivals.set(step.toId, Math.max(arrivals.get(step.toId) ?? 0, delay + 0.12));
          return { from: step.fromId, to: step.toId, delay };
        });
        const groups = record.groups.map((g) => ({
          color: g.color,
          cells: g.ids.map((id) => this.convert(this.cache.get(id))).filter(Boolean),
        }));
        packets.push({
          ...base,
          kind: 'resolve',
          impact: record.impact,
          colorGroups: groups,
          dropped: (p.dropped ?? []).map((b) => this.convert(b)).filter(Boolean),
          electric: {
            rootIds: record.roots,
            removedIds: p.electricIds ?? [],
            steps,
            contacts: (record.contacts ?? []).map((contact) => ({
              fromId: contact.fromId,
              toId: contact.toId,
              from: this.mapPoint(contact.from),
              to: this.mapPoint(contact.to),
              delay: arrivals.get(contact.fromId) ?? 0.14,
            })),
            nodes: record.nodes
              .map((b) => ({ ...this.convert(b), delay: arrivals.get(b.id) ?? 0.14 }))
              .filter((b) => b.id),
          },
        });
      }
    }
    this.director.consume(packets, this.snapshot(snapshot));
    this.remember(snapshot);
    const alive = new Set((snapshot.board ?? []).map((b) => b.id));
    // Keep at most 512 old coordinates; active packets own their own copies.
    if (this.cache.size > 512)
      for (const id of this.cache.keys())
        if (!alive.has(id)) {
          this.cache.delete(id);
          if (this.cache.size <= 512) break;
        }
    while (this.pending.size > 32) {
      this.warn('incomplete shot record evicted');
      this.pending.delete(this.pending.keys().next().value);
    }
    return packets;
  }
  liveProjectile(s) {
    return s.projectile?.assist ? assistColors(s.projectile.assist) : [];
  }
  stats() {
    return { cached: this.cache.size, pending: this.pending.size, warnings: [...this.warnings] };
  }
}
