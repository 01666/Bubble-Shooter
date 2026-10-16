import { clamp, validColor, validPoint } from './art.mjs';
// Consumes explicit presentation packets. No core import, random selection or ledger writes.
export class MechanismDirector {
  constructor({ onCue = () => {}, enabled = true } = {}) {
    this.onCue = onCue;
    this.enabled = enabled;
    this.clock = 0;
    this.effects = [];
    this.seen = new Set();
    this.retired = new Map();
    this.snapshot = {
      assist: { charge: 0, ready: false, colors: [] },
      network: { nodes: [], edges: [] },
    };
    this.reduced = false;
    this.priorityBusy = false;
    this.cursor = 0;
    this.readyAt = -10;
    this.lastImpact = -10;
    this.readyCuePending = false;
  }
  restore(snapshot, { eventSequence = 0 } = {}) {
    this.clear();
    this.cursor = eventSequence;
    this.sync(snapshot);
    this.readyAt = -10;
  }
  clear() {
    this.priorityBusy = false;
    this.effects = [];
    this.seen.clear();
    this.retired.clear();
    this.lastImpact = -10;
    this.readyCuePending = false;
  }
  sync(s) {
    const assist = s?.assist ?? {},
      network = s?.network ?? {};
    const nodes = (network.enabled === false ? [] : (network.nodes ?? []))
      .filter((n) => n?.id && validPoint(n) && validColor(n.color))
      .slice(0, 3)
      .map((n) => ({ ...n }));
    const ids = new Set(nodes.map((n) => n.id));
    const edges = (network.edges ?? [])
      .filter((e) => e.from !== e.to && ids.has(e.from) && ids.has(e.to))
      .slice(0, 3)
      .map((e) => ({ ...e }));
    this.snapshot = {
      ...s,
      assist: {
        ...assist,
        charge: assist.enabled === false ? 0 : clamp(assist.charge ?? 0, 0, 3),
        ready: assist.enabled !== false && !!assist.ready,
        colors: (assist.colors ?? []).filter(validColor).slice(0, 2),
      },
      network: { ...network, nodes, edges },
    };
  }
  cue(name, shotId, intensity = 1) {
    if (!this.enabled) return;
    if (name === 'mechanism-impact') {
      if (this.clock - this.lastImpact < 0.22) return;
      this.lastImpact = this.clock;
    }
    this.onCue({ name, shotId, intensity: clamp(intensity, 0, 1), clock: this.clock });
  }
  consume(packets, snapshot) {
    if (snapshot) this.sync(snapshot);
    if (!this.enabled) return;
    for (const p of packets ?? []) {
      if (!p.id || this.seen.has(p.id) || (p.sequence && p.sequence <= this.cursor)) continue;
      this.seen.add(p.id);
      if (this.seen.size > 2048) this.seen.delete(this.seen.values().next().value);
      if (p.sequence) this.cursor = Math.max(this.cursor, p.sequence);
      if (p.kind === 'charge' && validPoint(p.from)) {
        this.add({ kind: 'charge', from: { ...p.from }, life: 0.65, shotId: p.shotId });
        this.cue('assist-charge', p.shotId, 0.4);
      }
      if (p.kind === 'ready') {
        this.readyAt = this.clock;
        this.readyCuePending = true;
        this.add({ kind: 'ready', life: 0.8, shotId: p.shotId });
      }
      if (p.kind === 'fire') {
        this.readyCuePending = false;
        this.add({ kind: 'fire', life: 0.6, shotId: p.shotId });
        this.cue('assist-fire', p.shotId, 0.6);
      }
      if (p.kind === 'resolve') this.resolve(p);
    }
  }
  add(effect) {
    this.effects.push({ ...effect, at: this.clock, age: 0 });
    if (this.effects.length > 32) this.effects.shift();
  }
  resolve(p) {
    const before = this.retired.size,
      groups = [],
      electric = p.electric ?? {};
    const removed = new Set(electric.removedIds ?? []);
    for (const g of p.colorGroups ?? []) {
      if (!validColor(g.color)) continue;
      const cells = [];
      for (const b of g.cells ?? []) {
        if (!b.id || !validPoint(b) || this.retired.has(b.id) || removed.has(b.id)) continue;
        this.retired.set(b.id, this.clock);
        cells.push({ ...b });
      }
      if (cells.length) groups.push({ color: g.color, cells });
    }
    const nodes = (electric.nodes ?? []).filter((n) => n.id && validPoint(n)).slice(0, 24);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const steps = (electric.steps ?? [])
      .filter((e) => byId.has(e.from) && byId.has(e.to) && e.from !== e.to)
      .slice(0, 24)
      .map((e) => ({ ...e, delay: clamp(e.delay ?? 0, 0, 1.2) }));
    const pops = [];
    const contacts = (electric.contacts ?? [])
      .filter((e) => byId.has(e.fromId) && e.toId && validPoint(e.from) && validPoint(e.to))
      .slice(0, 9)
      .map((e) => ({ ...e, delay: clamp(e.delay ?? 0, 0, 1.2) }));
    for (const n of nodes) {
      if (!removed.has(n.id) || this.retired.has(n.id)) continue;
      this.retired.set(n.id, this.clock);
      pops.push({ ...n, delay: clamp(n.delay ?? 0, 0, 1.4) });
    }
    // Matched network nodes are owned by electric art, once, even if also in a color group.
    for (const g of groups) g.cells = g.cells.filter((b) => !removed.has(b.id));
    const active = pops.length || groups.some((g) => g.cells.length) || steps.length;
    if (active) {
      this.add({
        kind: 'resolve',
        shotId: p.shotId,
        impact: p.impact,
        groups: groups.filter((g) => g.cells.length),
        nodes,
        steps,
        contacts,
        pops,
        roots: (electric.rootIds ?? []).filter((id) => byId.has(id)),
        life: 2,
      });
      this.cue('mechanism-impact', p.shotId, steps.length ? 0.85 : 0.55);
    }
    // A node only dropped is never in steps/pops unless explicitly removed by conductivity.
    for (const b of p.dropped ?? []) if (b.id) this.retired.set(b.id, this.clock);
    if (this.retired.size - before > 0 && groups.length)
      this.add({ kind: 'celebrate', life: 1.1, shotId: p.shotId });
    while (this.retired.size > 512) this.retired.delete(this.retired.keys().next().value);
  }
  update(dt, { paused = false, reduced = false, priorityBusy = false } = {}) {
    this.reduced = reduced;
    this.priorityBusy = priorityBusy;
    if (paused) return;
    const elapsed = clamp(Number(dt) || 0, 0, 0.1);
    this.clock += elapsed;
    for (const e of this.effects) e.age = this.clock - e.at;
    this.effects = this.effects.filter((e) => e.age < e.life);
    if (!priorityBusy && this.readyCuePending && this.snapshot.assist.ready) {
      this.readyCuePending = false;
      this.cue('assist-ready', null, 0.5);
    }
  }
  petPose(base = {}, { busy = false } = {}) {
    if (busy || this.priorityBusy || !this.enabled) return { ...base };
    const effect = [...this.effects]
      .reverse()
      .find((e) => ['charge', 'ready', 'fire', 'celebrate'].includes(e.kind));
    const k = effect ? Math.sin(Math.PI * clamp(effect.age / effect.life)) : 0;
    const ready = !!this.snapshot.assist.ready;
    const kind = effect?.kind;
    return {
      ...base,
      look: clamp((base.look ?? 0) + (ready ? 0.2 : 0), -0.45, 0.45),
      head: clamp((base.head ?? 0) - k * 0.08, -0.18, 0.18),
      nod: (base.nod ?? 0) - k * 3,
      right: clamp(
        (base.right ?? 0) -
          (kind === 'fire' ? 1.2 : kind === 'celebrate' ? 1.6 : 0.65) * k -
          (ready ? 0.3 : 0),
        -2.2,
        2.2,
      ),
      left: (base.left ?? 0) + (kind === 'ready' ? 0.5 : 0) * k,
      mouth: Math.max(base.mouth ?? 0, kind === 'celebrate' ? 0.6 * k : 0),
      hop: this.reduced ? 0 : (base.hop ?? 0) + (kind === 'celebrate' ? 6 * k : 0),
    };
  }
  get claimedIds() {
    if (!this.enabled) return new Set();
    return new Set(
      this.effects
        .filter((e) => e.kind === 'resolve')
        .flatMap((e) => [
          ...e.groups.flatMap((g) => g.cells.map((b) => b.id)),
          ...e.pops.map((b) => b.id),
        ]),
    );
  }
  retirementPlan(shotId) {
    const e = this.effects.find((e) => e.kind === 'resolve' && e.shotId === shotId);
    if (!e || !this.enabled) return null;
    return {
      shotId,
      directIds: e.groups.flatMap((g) => g.cells.map((b) => b.id)),
      electricIds: e.pops.map((n) => n.id),
      dropDelay: Math.max(
        0.45,
        ...e.pops.map((n) => n.delay + 0.45),
        ...(e.contacts ?? []).map((n) => n.delay + 0.2),
      ),
      life: e.life,
    };
  }
  stats() {
    return {
      clock: this.clock,
      effects: this.effects.length,
      seen: this.seen.size,
      retired: this.retired.size,
      claimed: [...this.claimedIds],
      ready: this.snapshot.assist.ready,
      charge: this.snapshot.assist.charge,
      lightning: this.effects
        .filter((e) => e.kind === 'resolve' && e.steps.length)
        .map((e) => ({
          shotId: e.shotId,
          age: e.age,
          nodes: e.nodes.length,
          steps: e.steps.length,
          pops: e.pops.length,
        })),
    };
  }
  dispose() {
    this.clear();
    this.enabled = false;
    this.onCue = () => {};
  }
}
