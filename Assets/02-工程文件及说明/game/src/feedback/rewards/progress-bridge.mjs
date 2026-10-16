// Business events only: no dispatch from fly-ticket callbacks, balance animations or maintenance.
import { drawOpportunityArrival } from '../orbs/opportunity-arrival.mjs';
export class ProgressBridge {
  constructor({ room, voice } = {}) {
    this.room = room;
    this.voice = voice;
    this.seen = new Set();
    this.targets = [];
    this.clock = 0;
    this.cursor = 0;
  }
  restore(s, { eventSequence = 0 } = {}) {
    this.cursor = eventSequence;
    this.seen.clear();
    this.targets = [];
    this.room.restore(s);
    this.voice.restore({ eventSequence });
  }
  consume(events, s) {
    const fresh = (events ?? []).filter((e) => {
      const seq = Number(/^event-(\d+)$/.exec(e.eventId)?.[1]) || 0;
      if (!e.eventId || this.seen.has(e.eventId) || (seq && seq <= this.cursor)) return false;
      this.seen.add(e.eventId);
      if (this.seen.size > 2048) this.seen.delete(this.seen.values().next().value);
      return true;
    });
    this.room.consume(fresh, s);
    const shots = new Map();
    for (const e of fresh) {
      const p = e.payload ?? {},
        shotId = p.shotId ?? e.causeId;
      let r = shots.get(shotId);
      if (!r) {
        r = { shotId, events: [] };
        shots.set(shotId, r);
      }
      r.events.push(e);
    }
    for (const e of fresh)
      if (e.type === 'lowOpportunityAppeared') {
        const p = e.payload ?? {};
        if (![1, 2].includes(p.interfaceVersion) || !p.ball || ![1, 2].includes(p.remainingAmmo))
          continue;
        this.targets.push({ ball: { ...p.ball }, at: this.clock, id: p.opportunityId });
        if (this.targets.length > 5) this.targets.shift();
      } else if (e.type === 'networkCreated') {
        this.voice.offer({
          id: e.eventId,
          shotId: e.payload?.shotId,
          kind: 'network',
          label: '导电泡泡登场',
          sub: '消除导电球，闪电随机击掉沿途不同颜色的球',
        });
      }
    for (const e of fresh)
      if (e.type === 'paidShotResolved' && [1, 2].includes(e.payload?.remainingAmmo)) {
        this.voice.offer({
          id: e.eventId + '-ammo',
          shotId: e.eventId + '-ammo',
          kind: 'low',
          label: e.payload.remainingAmmo === 2 ? '还剩两球了' : '还剩一球了',
          sub: '投币可补充泡泡，继续游玩',
        });
      }
    for (const r of shots.values()) {
      const find = (type) => r.events.find((e) => e.type === type),
        result = find('paidShotResolved')?.payload,
        bonus = find('stageBonusEarned'),
        network = find('networkActivated'),
        star = find('targetsCollected'),
        ready = find('assistReady');
      const ammo = find('ammoBonusEarned');
      let cue;
      if (bonus) {
        const n = bonus.payload.count;
        if (Number.isSafeInteger(n) && n > 0)
          cue = {
            kind: 'chest',
            label: `宝箱加奖 +${n}张彩票`,
            sub: result
              ? `本发获得 ${result.earnedDelta ?? result.gain + n}张彩票${ammo ? ` · 赠${ammo.payload.count}颗泡泡` : ''}`
              : undefined,
            event: bonus,
          };
      } else if (ammo) {
        cue = {
          kind: 'ammo',
          label: `大消除！赠送${ammo.payload.count}颗泡泡`,
          sub: `清掉${ammo.payload.clearedCount}颗 · 获得${result?.gain ?? 0}张彩票`,
          event: ammo,
        };
      } else if (result && result.gain > 0) {
        const chain = find('explosionResolved'),
          kind =
            (chain?.payload.triggers?.length ?? 0) > 1
              ? 'chain'
              : result.dropped?.length >= 6
                ? 'drop'
                : network
                  ? 'network'
                  : 'success';
        cue = {
          kind,
          label: `获得 ${result.gain}张彩票`,
          sub:
            kind === 'chain'
              ? '连锁消除'
              : kind === 'network'
                ? '导电爆发'
                : kind === 'drop'
                  ? '大片掉落'
                  : '消除成功',
          event: find('paidShotResolved'),
        };
      } else if (star) cue = { kind: 'star', label: '星星收到啦', event: star };
      else if (ready)
        cue = {
          kind: 'ready',
          label: '双彩就绪',
          sub: '下一发两种颜色，分别参与三消',
          event: ready,
        };
      if (cue)
        this.voice.offer({
          ...cue,
          id: cue.event.eventId,
          shotId: r.shotId,
          sequence: Number(/^event-(\d+)$/.exec(cue.event.eventId)?.[1]) || 0,
        });
    }
  }
  update(dt, { paused = false } = {}) {
    if (!paused) this.clock += Math.min(0.1, Math.max(0, dt));
    this.targets = this.targets.filter((t) => this.clock - t.at < 2.2);
  }
  drawTargets(c, mapPoint) {
    c.save();
    c.beginPath();
    c.rect(18, 119, 864, 970);
    c.clip();
    for (const t of this.targets) {
      const k = this.clock - t.at,
        p = mapPoint(t.ball);
      drawOpportunityArrival(c, p, k, { reduced: this.room.reduced });
    }
    c.restore();
  }
}
