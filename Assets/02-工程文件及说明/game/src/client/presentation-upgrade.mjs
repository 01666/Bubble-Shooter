import { createMechanismFeedback, sceneOrbModels } from '../feedback/mechanisms/integration.mjs';
import { LivingRoom } from '../feedback/environment/background.mjs';
import { bindRoomLayer } from '../feedback/environment/room-layer.mjs';
import { OrbMaterialPolish } from '../feedback/orbs/orb-material.mjs';
import { RewardVoice } from '../feedback/rewards/reward-voice.mjs';
import { RewardWords } from '../feedback/rewards/reward-words.mjs';
import { ProgressBridge } from '../feedback/rewards/progress-bridge.mjs';
import { specialOrb } from '../feedback/orbs/special-orbs.mjs';
import { PetSlotFeedback } from '../feedback/pet-slots/index.mjs';
import { ArcadeAnnouncer } from '../feedback/audio/arcade-announcer.mjs';
import { PET_SLOT_LAYOUT } from '../feedback/pet-slots/layout.mjs';

// This single host owns event ordering and visual retirement, without gameplay writes.
export class PresentationUpgrade {
  constructor(scene, audio, atlas) {
    this.scene = scene;
    this.audio = audio;
    this.announcer = new ArcadeAnnouncer(audio);
    this.words = new RewardWords();
    this.voice = new RewardVoice(audio, { onText: (cue) => this.words.show(cue) });
    this.room = new LivingRoom();
    this.petSlots = new PetSlotFeedback({ audio, room: this.room, mapPoint: (b) => this.point(b) });
    this.roomLayer = bindRoomLayer(scene, this.room);
    this.polish = new OrbMaterialPolish(scene);
    this.progress = new ProgressBridge({ room: this.room, voice: this.voice });
    this.bombShots = new Set();
    this.arrivalIds = new Set();
    this.mechanisms = createMechanismFeedback({
      atlas,
      mapPoint: (b) => this.point(b),
      onCue: (cue) => {
        const names = { 'assist-charge': 'target_1', 'assist-ready': 'earned' };
        if (cue.name === 'mechanism-impact') {
          if (!this.bombShots.has(cue.shotId)) audio.playCue('clear', { gain: 0.8 });
        } else if (names[cue.name])
          audio.playCue(names[cue.name], { gain: cue.name === 'assist-charge' ? 0.32 : 0.65 });
      },
    });
    this.quality = 'medium';
    this.transport = '';
    this.legacyVoice = false;
    this.voiceContext = null;
  }
  point(b) {
    const mesh = this.scene.balls.get(b.id);
    if (mesh) {
      mesh.computeWorldMatrix(true);
      const p = mesh.getAbsolutePosition();
      return { x: p.x, y: -p.y };
    }
    return this.scene.renderedPoint(b);
  }
  restore(s, options) {
    this.mechanisms.renderer.petSlotEnabled = s.petSlots?.mode === 'slots';
    this.arrivalIds.clear();
    this.mechanisms.restore(s, options);
    this.progress.restore(s, options);
    this.words.clear();
    this.petSlots.restore(s);
    this.announcer.restore();
  }
  consume(batch, s) {
    this.mechanisms.renderer.petSlotEnabled = s.petSlots?.mode === 'slots';
    this.petSlots.consume(batch, s);
    this.announcer.consume(batch);
    for (const e of batch) {
      const id = e.payload?.opportunityId;
      if (e.type === 'lowOpportunityAppeared' && id && !this.arrivalIds.has(id)) {
        this.arrivalIds.add(id);
        if (this.arrivalIds.size > 128)
          this.arrivalIds.delete(this.arrivalIds.values().next().value);
        this.audio.playCue('target_3', { gain: 0.85, rate: 1.12 });
        this.room.revealOpportunity(id);
      }
    }
    for (const e of batch)
      if (e.type === 'explosionResolved') {
        this.bombShots.add(e.payload?.shotId ?? e.causeId);
        if (this.bombShots.size > 256) this.bombShots.delete(this.bombShots.values().next().value);
      }
    this.mechanisms.consume(
      batch.filter((e) => e.payload?.rewardSource !== 'petSlots' || e.type === 'assistReady'),
      s,
    );
    this.progress.consume(batch, s);
  }
  setTransport({ paused, focused, muted }) {
    const key = [paused, focused, muted].join(':');
    if (key === this.transport) return;
    this.transport = key;
    this.voice.setTransport({ paused, focused, muted });
    if (paused || !focused) this.words.clear();
  }
  update(dt, s, feedback) {
    const paused = !!s.uiPaused;
    this.busy = !!(s.dispenserFault || s.tickets.uncertain || s.storageFault || paused);
    this.mechanisms.update(dt, {
      paused,
      reduced: this.scene.reduced,
      priorityBusy: this.busy || s.paidAmmo === 0 || feedback.stages.length > 0,
    });
    this.room.update(dt, { paused, reduced: this.scene.reduced, quality: this.quality });
    this.progress.update(dt, { paused });
    this.voice.update(dt);
    this.announcer.update(dt);
    this.words.update(dt, { paused, reduced: this.scene.reduced });
    this.petSlots.update(dt, s, {
      paused,
      reduced: this.scene.reduced,
      quality: this.quality,
      priorityBusy: this.busy,
    });
    feedback.slotPriority = !!this.petSlots.result;
    feedback.externalNotice = !this.busy && (!!this.words.active || feedback.slotPriority);
    this.roomLayer.update({ aim: s.angle });
    // Empty natural-voice slots fall back to captions. System drafts require explicit opt-in.
    if (this.audio.context && this.voiceContext !== this.audio.context) {
      this.voiceContext = this.audio.context;
      void this.voice.load({ legacy: this.legacyVoice });
    }
  }
  draw(s, feedback, pose) {
    this.polish.update(
      [
        ...this.scene.balls.values(),
        this.scene.loaded,
        this.scene.next,
        this.scene.projectile,
        this.scene.loadTransfer?.mesh,
      ],
      this.room.time,
      { quality: this.quality, reduced: this.scene.reduced },
    );
    const models = sceneOrbModels(this.scene, s);
    for (const b of s.board) {
      const mesh = this.scene.balls.get(b.id);
      if (mesh?.isVisible && ['target', 'bomb'].includes(b.kind))
        specialOrb(feedback.ctx, this.point(b), b.kind, {
          time: this.room.time,
          reduced: this.scene.reduced,
          radius: 40 * mesh.scaling.x,
        });
    }
    const painted = this.mechanisms.draw(feedback.ctx, {
      ...models,
      nodePoint: (n) => this.point(n),
      alivePoints: s.board.map((b) => ({ ...this.point(b), id: b.id })),
      collar: {
        x: PET_SLOT_LAYOUT.pet.x + 3 * PET_SLOT_LAYOUT.pet.scale + (pose?.step ?? 0),
        y:
          PET_SLOT_LAYOUT.pet.y -
          119 * PET_SLOT_LAYOUT.pet.scale -
          (pose?.hop ?? 0) +
          (pose?.breath ?? 0) * PET_SLOT_LAYOUT.pet.scale,
      },
      priorityBusy: this.busy || s.paidAmmo === 0 || feedback.stages.length > 0,
    });
    this.mechanisms.applyOrbVisibility(models, painted);
    this.progress.drawTargets(feedback.ctx, (b) => this.point(b));
    if (!this.busy && !this.petSlots.result) this.words.draw(feedback.ctx);
    this.petSlots.suppressCombo = !!this.words.active || feedback.stages.length > 0;
    this.petSlots.draw(feedback.ctx, s);
  }
  petPose(pose, pet) {
    const mechanismPose = this.mechanisms.petPose(pose, {
      busy: ['target', 'complete', 'fault'].includes(pet?.controller.active?.mode),
    });
    return this.petSlots.petPose(mechanismPose, pet);
  }
  async setLegacyVoice(value) {
    this.legacyVoice = !!value;
    if (this.audio.context) await this.voice.load({ legacy: this.legacyVoice });
  }
  stats() {
    return {
      mechanisms: this.mechanisms.stats(),
      petSlots: this.petSlots.stats(),
      announcer: this.announcer.stats(),
      room: this.room.stats(),
      roomLayer: this.roomLayer.stats(),
      polish: this.polish.stats(),
      voice: this.voice.stats(),
      words: this.words.active,
      quality: this.quality,
    };
  }
  dispose() {
    this.voice.dispose();
    this.petSlots.dispose();
    this.announcer.dispose();
    this.mechanisms.dispose();
    this.roomLayer.dispose();
    this.room.dispose();
    this.polish.dispose();
  }
}
