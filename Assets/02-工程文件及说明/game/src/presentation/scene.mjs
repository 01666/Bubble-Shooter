import { FullScene, point, DIAMETER } from './scene-base.mjs';
import { PearlGuide } from './guide.mjs';
const B = globalThis.BABYLON;
B.Effect.ShadersStore.connectorVertexShader = B.Effect.ShadersStore.cutoutVertexShader;
B.Effect.ShadersStore.connectorFragmentShader =
  'precision highp float; varying vec2 vUV; uniform sampler2D atlas; uniform vec4 rect; uniform float brightness; void main(){vec2 q=vec2(rect.x+vUV.x*rect.z,1.-rect.y-(1.-vUV.y)*rect.w);vec4 c=texture2D(atlas,q);float overlapFade=smoothstep(0.,.18,vUV.y);if(c.a<.05)discard;gl_FragColor=vec4(c.rgb*brightness,c.a*overlapFade);}';
export class PresentationScene extends FullScene {
  sprite(...args) {
    const mesh = super.sprite(...args);
    if (
      ['continuous-painted-neck-shoulders', 'left-shin-bridge', 'right-shin-bridge'].includes(
        args[0],
      )
    ) {
      const old = mesh.material;
      this.materials = this.materials.filter((m) => m !== old);
      old.dispose();
      const box = args[2],
        size = args[3],
        m = new B.ShaderMaterial(
          args[0] + '-feathered-overlap',
          this.scene,
          { vertex: 'connector', fragment: 'connector' },
          {
            attributes: ['position', 'uv'],
            uniforms: ['worldViewProjection', 'rect', 'brightness'],
            samplers: ['atlas'],
            needAlphaBlending: true,
          },
        );
      m.setTexture('atlas', args[1]);
      m.setVector4(
        'rect',
        new B.Vector4(
          box[0] / size[0],
          box[1] / size[1],
          (box[2] - box[0]) / size[0],
          (box[3] - box[1]) / size[1],
        ),
      );
      m.setFloat('brightness', 1);
      m.backFaceCulling = false;
      mesh.material = m;
      this.materials.push(m);
      mesh.onDisposeObservable.add(() => {
        this.materials = this.materials.filter((x) => x !== m);
        m.dispose();
      });
    }
    return mesh;
  }
  constructor(canvas, audio) {
    super(canvas);
    this.audio = audio;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.textures.neck = new B.Texture(
      '/assets/images/neck-shoulders.png',
      this.scene,
      false,
      true,
      B.Texture.TRILINEAR_SAMPLINGMODE,
    );
    this.textures.neck.hasAlpha = true;
    this.guidePool = new PearlGuide(this);
    this.headAngle = 0;
    this.trail = [];
    for (let i = 0; i < 5; i++) {
      const m = this.guidePool.make('short-flight-trail-' + i, false, 15 - i * 2);
      m.setEnabled(false);
      this.trail.push(m);
    }
    this.history = [];
  }
  rig() {
    super.rig();
    const upper = new B.TransformNode('shared-torso-breath', this.scene);
    upper.parent = this.pet;
    upper.position.y = 90;
    this.upper = upper;
    for (const name of ['body', 'head', 'arm', 'farArm', 'wing', 'farWing']) {
      const m = this.parts[name];
      m.parent = upper;
      m.position.y -= 90;
    }
    // Neck overlaps torso's socket and chin. Head pivots at shared neck joint, not at its own rectangle edge.
    const neck = this.sprite(
      'continuous-painted-neck-shoulders',
      this.textures.neck,
      [330, 386, 742, 1070],
      [887, 1774],
      11,
      -80,
      36,
      72,
      -3,
    );
    neck.parent = upper;
    neck.position.set(11, 80, -3);
    this.parts.neck = neck;
    const joint = new B.TransformNode('neck-head-joint', this.scene);
    joint.parent = upper;
    joint.position.set(14, 85, -4);
    this.headJoint = joint;
    this.parts.head.parent = joint;
    this.parts.head.position.set(8, 51, -2);
    this.parts.head.setPivotPoint(B.Vector3.Zero());
    this.parts.body.scaling.y = 1.28; // torso overlap grows toward the existing standing feet; root and head centers stay fixed
    // The arm/shoulder overlap grows inward without changing the pet root or station.
    this.parts.arm.position.x = 24;
    this.parts.farArm.position.x = 34;
    this.parts.head.material.setFloat('brightness', 1);
  }
  guide(trace) {
    this.trace = trace;
    this.guidePool.update(trace);
  }
  sync(s, trace, scheme) {
    const previous = new Map(
      [...this.balls].map(([id, m]) => [
        id,
        {
          home: m.metadata.home,
          x: m.position.x,
          y: -m.position.y,
        },
      ]),
    );
    super.sync(s, trace, scheme);
    for (const [id, m] of this.balls) {
      const old = previous.get(id),
        to = m.metadata.home;
      if (old?.home && Math.hypot(old.home.x - to.x, old.home.y - to.y) > 0.5) {
        m.metadata.boardMotion = {
          from: { x: old.x, y: old.y },
          to,
          at: this.clock,
          duration: this.reduced ? 0.14 : 0.48,
        };
      }
      this.placeBoardBall(m);
    }
    if (s.projectile) {
      const q = point(s.projectile);
      this.history.unshift(q);
      if (this.history.length > 7) this.history.pop();
    } else this.history = [];
  }
  placeBoardBall(m) {
    const motion = m.metadata.boardMotion;
    if (!motion) return;
    const k = Math.max(0, Math.min(1, (this.clock - motion.at) / motion.duration));
    const e = k * k * (3 - 2 * k);
    m.position.set(
      motion.from.x + (motion.to.x - motion.from.x) * e,
      -(motion.from.y + (motion.to.y - motion.from.y) * e),
      -30,
    );
    if (k >= 1) delete m.metadata.boardMotion;
  }
  startRefill(payload) {
    const shifting = this.isBoardMoving();
    for (const b of payload.added ?? []) {
      const m = this.balls.get(b.id);
      if (!m) continue;
      const to = m.metadata.home;
      m.metadata.spawnUntil = this.clock + 1.15;
      m.metadata.boardMotion = {
        from: { x: to.x, y: to.y - (this.reduced ? 14 : 60) },
        to,
        at: this.clock + (shifting && !this.reduced ? 0.12 : 0),
        duration: this.reduced ? 0.14 : 0.44,
      };
      this.placeBoardBall(m);
    }
  }
  isBoardMoving() {
    return [...this.balls.values()].some((m) => m.metadata.boardMotion);
  }
  boardPoint(b) {
    const m = this.balls.get(b.id);
    return m ? { x: m.position.x, y: -m.position.y } : point(b);
  }
  startLoad(payload) {
    if (payload.mode !== 'paid') return;
    this.loadTransfer?.mesh.dispose();
    const mesh = this.sphere(
      'next-ball-in-transit',
      payload.loadedAfter,
      this.nextSocket.x,
      this.nextSocket.y,
      DIAMETER,
      this.scheme,
      -100,
    );
    this.loadTransfer = {
      mesh,
      at: this.clock,
      duration: this.reduced ? 0.16 : 0.38,
      color: payload.loadedAfter,
    };
    this.loaded.setEnabled(false);
    this.next.setEnabled(false);
  }
  tickLoader() {
    const s = this.snapshot;
    if (!s) return;
    const transfer = this.loadTransfer;
    if (transfer) {
      const k = Math.min(1, Math.max(0, (this.clock - transfer.at) / transfer.duration)),
        e = k * k * (3 - 2 * k),
        x = this.nextSocket.x + (this.pivot.x - this.nextSocket.x) * e,
        y =
          this.nextSocket.y +
          (this.pivot.y - this.nextSocket.y) * e -
          (this.reduced ? 0 : Math.sin(Math.PI * k) * 22);
      transfer.mesh.position.set(x, -y, -100);
      const size =
        this.nextSocket.diameter / DIAMETER + (1 - this.nextSocket.diameter / DIAMETER) * e;
      transfer.mesh.scaling.set(size, size, 1);
      this.loaded.setEnabled(false);
      this.next.setEnabled(false);
      if (k >= 1) {
        transfer.mesh.dispose();
        this.loadTransfer = null;
        this.loadArrival = this.clock;
      }
    }
    if (!this.loadTransfer) {
      const separated =
        !s.projectile ||
        Math.hypot(s.projectile.x, s.projectile.y - this.config.cannonY) > 2 * this.config.radius;
      this.loaded.setEnabled(separated);
      const pulse = Math.max(0, 1 - (this.clock - (this.loadArrival ?? -10)) / 0.18);
      this.loaded.scaling.x *= 1 + pulse * 0.08;
      this.loaded.scaling.y *= 1 - pulse * 0.05;
      this.next.setEnabled(!s.loading);
      if (!s.loading && this.previewWasLoading) this.previewAt = this.clock;
      const k = Math.min(1, (this.clock - (this.previewAt ?? -10)) / 0.2),
        scale = (this.nextSocket.diameter / DIAMETER) * (0.76 + 0.24 * (1 - (1 - k) ** 3));
      this.next.scaling.set(scale, scale, 1);
    }
    this.previewWasLoading = !!s.loading;
  }
  response(a) {
    if (a.type === 'maintenance') return;
    super.response(a);
    if (a.type === 'fire') {
      this.audio?.play('fire');
    }
    if (a.type === 'hit') {
      this.guidePool.bounce(a);
      this.audio?.play('bounce');
    }
    if (a.type === 'ack') this.audio?.play('confirmed');
  }
  fragment(color, q, index, count = 4) {
    const mesh = this.sphere('curved-shell-fragment', color, q.x, q.y, DIAMETER, 'refined', -78),
      v = new B.VertexData(),
      positions = [],
      uvs = [],
      normals = [],
      indices = [];
    for (let j = 0; j <= 4; j++) {
      const a = (index * Math.PI * 2) / count + ((j / 4) * Math.PI * 1.45) / count;
      for (const radius of [0.3, 0.48]) {
        const x = Math.cos(a) * DIAMETER * radius,
          y = Math.sin(a) * DIAMETER * radius;
        positions.push(x, y, 0);
        uvs.push(x / DIAMETER + 0.5, y / DIAMETER + 0.5);
        normals.push(0, 0, -1);
      }
      if (j > 0) {
        const k = j * 2;
        indices.push(k - 2, k - 1, k, k, k - 1, k + 1);
      }
    }
    v.positions = positions;
    v.uvs = uvs;
    v.normals = normals;
    v.indices = indices;
    v.applyToMesh(mesh);
    return mesh;
  }
  petPose(mode = this.clock < this.petUntil ? this.petMode : 'idle') {
    const t = this.clock,
      scale = this.reduced ? 0.35 : 1,
      cheer = mode === 'cheer' ? Math.sin((this.petUntil - t) * 8) * 0.06 * scale : 0,
      target = Math.max(
        -0.14,
        Math.min(0.14, this.aim * 0.069 + cheer + (mode === 'fire' ? this.recoil * 0.055 : 0)),
      );
    this.headAngle += (target - this.headAngle) * 0.2;
    this.headJoint.rotation.z = this.headAngle;
    this.upper.scaling.y = 1 + Math.sin(t * 2) * 0.013 * scale;
    this.upper.rotation.z = mode === 'small' ? Math.sin(t * 7) * 0.014 * scale : 0;
    this.parts.neck.rotation.z = this.headAngle * 0.25;
    this.parts.neck.setPivotPoint(new B.Vector3(0, 38, 0));
    this.parts.wing.rotation.z = Math.sin(t * 2.1) * 0.034 * scale - cheer * 0.65;
    this.parts.farWing.rotation.z = Math.sin(t * 2.1 + 0.5) * 0.034 * scale - cheer * 0.5;
    this.parts.tail.rotation.z = Math.sin(t * 1.8) * 0.06 * scale;
    this.parts.arm.rotation.z =
      mode === 'small' ? Math.sin(t * 10) * 0.17 * scale : mode === 'cheer' ? -0.4 * scale : 0;
    this.parts.farArm.rotation.z = mode === 'cheer' ? -0.25 * scale : 0;
    const box = t % 5 < 0.1 ? [430, 100, 829, 422] : [32, 100, 436, 422];
    this.parts.head.material.setVector4(
      'rect',
      new B.Vector4(
        box[0] / 1254,
        box[1] / 1254,
        (box[2] - box[0]) / 1254,
        (box[3] - box[1]) / 1254,
      ),
    );
    this.parts.head.position.set(8, 51, -2);
  }
  tick(dt) {
    this.engine.beginFrame();
    this.clock += dt;
    for (const m of this.materials) m.setFloat('clock', this.clock);
    this.energy = Math.max(0, this.energy - dt * 0.7);
    this.ack = Math.max(0, this.ack - dt * 0.9);
    this.recoil = Math.max(0, this.recoil - dt * 4);
    this.tilt = Math.max(0, this.tilt - dt);
    this.root.rotation.z = this.reduced ? 0 : Math.sin(this.clock * 65) * this.tilt * 0.005;
    this.root.setPivotPoint(new B.Vector3(450, -800, 0));
    for (const m of this.balls.values()) {
      this.placeBoardBall(m);
      const h = Math.max(0, (m.metadata.hitUntil || 0) - this.clock) / 0.32,
        age = 1.15 - Math.max(0, (m.metadata.spawnUntil || 0) - this.clock),
        k = Math.max(0, Math.min(1, (age - 0.25) / 0.55)),
        spawn =
          age < 0.8 ? (this.reduced ? 0 : -0.28 * (1 - k) ** 3 + 0.035 * Math.sin(Math.PI * k)) : 0,
        b = 1 + Math.sin(this.clock * 1.7 + m.metadata.home.x * 0.03) * (this.reduced ? 0 : 0.035);
      m.scaling.set(b + h * 0.12 + spawn, 2 - b - h * 0.1 + spawn, 1);
    }
    this.parts.shell.scaling.y = 1 - this.recoil * 0.04;
    this.parts.collector?.material.setFloat(
      'brightness',
      0.95 + this.energy * (this.reduced ? 0.04 : 0.12),
    );
    this.loaded.scaling.set(1 + this.recoil * 0.04, 1 - this.recoil * 0.04, 1);
    if (this.projectile) {
      const a = Math.max(0, (this.projectileImpact || 0) - this.clock) / 0.12;
      this.projectile.scaling.set(1 + a * 0.09, 1 - a * 0.09, 1);
    }
    this.petPose();
    this.guidePool.tick(dt, !!this.snapshot?.projectile || this.isBoardMoving(), this.reduced);
    this.trail.forEach((m, i) => {
      const q = this.history[i + 1],
        current = this.history[0];
      m.setEnabled(
        !!q &&
          !this.reduced &&
          !!this.projectile &&
          Math.hypot(q.x - current.x, q.y - current.y) < DIAMETER * 0.85,
      );
      if (q) {
        m.position.set(q.x, -q.y, -76);
        m.material.setFloat('opacity', 0.18 * (1 - i / 6));
        m.material.setFloat('brightness', 1);
      }
    });
    this.tickLoader();
    if (this.snapshot) this.updateHUD(this.snapshot);
    this.scene.render();
    this.engine.endFrame();
    this.captureTrack?.requestFrame();
  }
  updateHUD(s) {
    const previous = this.hudSignature;
    super.updateHUD(s);
    const key = [s.paidAmmo, s.tickets.pending, this.ack > 0].join(':');
    if (this.extraHUDKey === key && previous === this.hudSignature) return;
    this.extraHUDKey = key;
    const c = this.hud.getContext();
    c.clearRect(647, 1364, 218, 55);
    c.clearRect(647, 1475, 218, 46);
    this.hud.update();
  }
  resetEffects() {
    this.history = [];
    this.energy = this.ack = this.tilt = 0;
    this.petUntil = 0;
    this.audio?.stopEffects();
  }
  stats() {
    return {
      ...super.stats(),
      feedback: { groups: 0 },
      guide: this.guidePool.stats(),
      loader: {
        active: !!this.loadTransfer,
        color: this.loadTransfer?.color,
        position: this.loadTransfer
          ? { x: this.loadTransfer.mesh.position.x, y: -this.loadTransfer.mesh.position.y }
          : null,
        loadedVisible: this.loaded?.isEnabled(),
        previewVisible: this.next?.isEnabled(),
      },
      reduced: this.reduced,
      boardMoving: this.isBoardMoving(),
      rewardPulseActive: !this.reduced && this.clock - (this.rewardPulseAt ?? -10) < 0.18,
      displayedPending: this.displayPending ?? this.snapshot?.tickets.pending,
    };
  }
}
