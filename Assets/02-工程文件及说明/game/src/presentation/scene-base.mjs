import { Region, SCALE, DIAMETER, orbBoxes } from './sprite-layer.mjs';
const B = globalThis.BABYLON;
export { SCALE, DIAMETER };
export const point = (p) => ({ x: 450 + p.x * SCALE, y: 160 + (7 - p.y) * SCALE });
const refinedBoxes = [
  [63, 79, 459, 465],
  [568, 79, 969, 466],
  [1079, 80, 1476, 466],
  [63, 555, 459, 942],
  [568, 555, 969, 943],
];
export class FullScene extends Region {
  sprite(...args) {
    const mesh = super.sprite(...args);
    mesh.renderingGroupId = args[0] === 'room' ? 0 : 1;
    return mesh;
  }
  constructor(canvas) {
    super(canvas, 0, 1600);
    this.scheme = 'refined';
    for (const name of ['orbs-refined', 'mechanics']) {
      const t = new B.Texture(
        `/assets/images/${name}.png`,
        this.scene,
        false,
        true,
        B.Texture.TRILINEAR_SAMPLINGMODE,
      );
      t.hasAlpha = true;
      t.wrapU = t.wrapV = B.Texture.CLAMP_ADDRESSMODE;
      this.textures[name] = t;
    }
    this.marks = [];
    this.tickets = [];
    this.hud = new B.DynamicTexture(
      'independent-authoritative-HUD',
      { width: 900, height: 1600 },
      this.scene,
      false,
    );
    this.hud.hasAlpha = true;
    this.hud.update();
    this.hudLayer = new B.Layer('stable-HUD', null, this.scene, false);
    this.hudLayer.texture = this.hud;
    this.hudImage = new Image();
    this.hudImage.src = '/assets/images/mechanics.png';
  }
  sphere(name, color, x, y, diameter, scheme = this.scheme, z = -30) {
    const old = scheme === 'before',
      mesh = this.sprite(
        name,
        this.textures[old ? 'orbs' : 'orbs-refined'],
        old ? orbBoxes[color] : refinedBoxes[color],
        [1536, 1024],
        x,
        y,
        diameter,
        diameter,
        z,
        true,
        true,
      );
    mesh.metadata = { color, diameter, scheme };
    return mesh;
  }
  apparatus(config, muzzleDistance) {
    this.config = config;
    const pivot = point({ x: 0, y: config.cannonY });
    this.pivot = pivot;
    this.muzzleDistance = muzzleDistance * SCALE;
    this.scene.setRenderingOrder(
      1,
      null,
      null,
      (a, b) => b.getMesh().getAbsolutePosition().z - a.getMesh().getAbsolutePosition().z,
    );
    this.shadow('base-contact', 450, 1518, 390, 80);
    this.shadow('pet-contact', 145, 1525, 205, 48);
    this.shadow('warehouse-contact', 753, 1530, 260, 48);
    this.sprite(
      'base',
      this.textures.apparatus,
      [640, 368, 1235, 637],
      [1254, 1254],
      450,
      1485,
      340,
      110,
      -10,
    );
    const tex = this.textures.mechanics;
    // The preview shares the cannon's blue-and-gold mounting language, with a clear gap before the ticket receiver.
    this.nextSocket = { x: 584, y: 1430, diameter: 74 };
    const feederTexture = new B.DynamicTexture(
        'integrated-next-ball-cradle',
        { width: 270, height: 300 },
        this.scene,
        false,
      ),
      fc = feederTexture.getContext();
    fc.clearRect(0, 0, 270, 300);
    const body = fc.createLinearGradient(0, 180, 0, 280);
    body.addColorStop(0, '#176a91');
    body.addColorStop(0.45, '#144567');
    body.addColorStop(1, '#071d38');
    fc.lineJoin = 'round';
    fc.lineCap = 'round';
    fc.lineWidth = 18;
    fc.strokeStyle = '#071629';
    fc.beginPath();
    fc.moveTo(22, 248);
    fc.lineTo(101, 232);
    fc.lineTo(135, 200);
    fc.stroke();
    fc.lineWidth = 9;
    fc.strokeStyle = '#c79c55';
    fc.stroke();
    fc.lineWidth = 3;
    fc.strokeStyle = '#75deef';
    fc.stroke();
    fc.fillStyle = body;
    fc.strokeStyle = '#d5b46e';
    fc.lineWidth = 5;
    fc.beginPath();
    fc.roundRect(107, 161, 140, 119, 25);
    fc.fill();
    fc.stroke();
    let glow = fc.createRadialGradient(177, 164, 4, 177, 164, 79);
    glow.addColorStop(0, 'rgba(122,245,255,.65)');
    glow.addColorStop(1, 'rgba(28,134,203,0)');
    fc.fillStyle = glow;
    fc.fillRect(99, 85, 156, 156);
    fc.fillStyle = '#071c30';
    fc.strokeStyle = '#f7d99a';
    fc.lineWidth = 7;
    fc.beginPath();
    fc.ellipse(177, 168, 68, 25, 0, 0, Math.PI * 2);
    fc.fill();
    fc.stroke();
    fc.strokeStyle = '#75efff';
    fc.lineWidth = 3;
    fc.beginPath();
    fc.ellipse(177, 168, 59, 18, 0, 0, Math.PI * 2);
    fc.stroke();
    fc.font = '700 32px "Microsoft YaHei",sans-serif';
    fc.textAlign = 'center';
    fc.fillStyle = '#ffedbb';
    fc.fillText('下一球', 177, 258);
    fc.fillStyle = '#75e6ed';
    fc.beginPath();
    fc.moveTo(135, 212);
    fc.lineTo(153, 220);
    fc.lineTo(135, 228);
    fc.closePath();
    fc.fill();
    fc.beginPath();
    fc.moveTo(201, 212);
    fc.lineTo(219, 220);
    fc.lineTo(201, 228);
    fc.closePath();
    fc.fill();
    feederTexture.hasAlpha = true;
    feederTexture.update();
    this.parts.feeder = this.sprite(
      'cannon-connected-next-ball-cradle',
      feederTexture,
      [0, 0, 270, 300],
      [270, 300],
      563,
      1440,
      135,
      150,
      -24,
    );
    this.parts.feeder.onDisposeObservable.add(() => feederTexture.dispose());
    this.joint = new B.TransformNode('core-cannon-pivot', this.scene);
    this.joint.parent = this.root;
    this.joint.position.set(pivot.x, -pivot.y, -30);
    // UV cropping removes the generated long neck, not any board object. Independent real nozzle is placed by core fire geometry.
    this.parts.shell = this.sprite(
      'compact-blue-housing',
      tex,
      [30, 200, 642, 678],
      [1254, 1254],
      0,
      34.9,
      240,
      187,
      0,
    );
    this.parts.shell.parent = this.joint;
    this.parts.shell.position.set(0, -34.9, 0);
    const socketTexture = new B.DynamicTexture(
        'blue-gold-loaded-socket',
        { width: 256, height: 256 },
        this.scene,
        false,
      ),
      sc = socketTexture.getContext();
    sc.clearRect(0, 0, 256, 256);
    sc.fillStyle = '#07213a';
    sc.strokeStyle = '#dbb770';
    sc.lineWidth = 10;
    sc.beginPath();
    sc.arc(128, 128, 112, 0, Math.PI * 2);
    sc.fill();
    sc.stroke();
    sc.lineWidth = 4;
    sc.strokeStyle = '#73d8ed';
    sc.beginPath();
    sc.arc(128, 128, 99, 0, Math.PI * 2);
    sc.stroke();
    socketTexture.hasAlpha = true;
    socketTexture.update();
    const loadSocket = this.sprite(
      'loaded-ball-housing-socket',
      socketTexture,
      [0, 0, 256, 256],
      [256, 256],
      0,
      0,
      108,
      108,
      -4,
    );
    loadSocket.parent = this.joint;
    loadSocket.position.set(0, 0, -4);
    loadSocket.onDisposeObservable.add(() => socketTexture.dispose());
    const light = new B.HemisphericLight(
      'soft-room-light',
      new B.Vector3(-0.5, 0.8, -1),
      this.scene,
    );
    light.intensity = 0.75;
    const ring = B.MeshBuilder.CreateTorus(
      'visible-gold-muzzle',
      { diameter: 95, thickness: 7, tessellation: 48 },
      this.scene,
    );
    ring.parent = this.joint;
    ring.position.set(0, this.muzzleDistance, -10);
    ring.rotation.x = Math.PI / 2;
    ring.scaling.z = 0.32;
    const gold = new B.StandardMaterial('muzzle-gold', this.scene);
    gold.diffuseColor = new B.Color3(0.8, 0.45, 0.12);
    gold.specularColor = new B.Color3(1, 0.9, 0.6);
    gold.specularPower = 64;
    gold.emissiveColor = new B.Color3(0.15, 0.08, 0.02);
    ring.material = gold;
    ring.renderingGroupId = 1;
    this.muzzle = ring;
    const opening = B.MeshBuilder.CreateDisc(
      'dark-emission-opening',
      { radius: 43, tessellation: 48 },
      this.scene,
    );
    opening.parent = this.joint;
    opening.position.set(0, this.muzzleDistance, -5);
    opening.scaling.y = 0.32;
    opening.renderingGroupId = 1;
    const dark = new B.StandardMaterial('nozzle-depth', this.scene);
    dark.diffuseColor = new B.Color3(0.008, 0.03, 0.055);
    dark.emissiveColor = new B.Color3(0.008, 0.03, 0.055);
    dark.backFaceCulling = false;
    opening.material = dark;
    this.rig();
    this.pet.position.set(142, -1510, -40);
    this.pet.scaling.setAll(0.68);
  }
  guide(trace) {
    this.trace = trace;
    if (this.aimLine) this.aimLine.dispose();
    const lines = [];
    for (let i = 1; i < trace.points.length; i += 2) {
      const a = point(trace.points[i - 1]),
        b = point(trace.points[i]);
      lines.push([new B.Vector3(a.x, -a.y, -90), new B.Vector3(b.x, -b.y, -90)]);
    }
    if (lines.length) {
      this.aimLine = B.MeshBuilder.CreateLineSystem('unmodified-core-trace', { lines }, this.scene);
      this.aimLine.parent = this.root;
      this.aimLine.color = new B.Color3(0.5, 0.83, 0.88);
      this.aimLine.alpha = 0.8;
    }
    if (this.contactMarker) this.contactMarker.dispose();
    if (trace.points.length) {
      const p = point(trace.points.at(-1));
      this.contactMarker = this.label('predicted-contact', '·', p.x, p.y, 25, 25);
    }
  }
  sync(s, trace, scheme = this.scheme) {
    this.scheme = scheme;
    this.aim = s.angle;
    this.joint.rotation.z = -s.angle;
    const alive = new Set();
    for (const p of s.board) {
      alive.add(p.id);
      let m = this.balls.get(p.id);
      if (m && (m.metadata.color !== p.color || m.metadata.scheme !== scheme)) {
        m.dispose();
        this.balls.delete(p.id);
        m = null;
      }
      const q = point(p);
      if (!m) {
        m = this.sphere(p.id, p.color, q.x, q.y, DIAMETER, scheme);
        this.balls.set(p.id, m);
      }
      m.metadata.home = q;
      m.position.set(q.x, -q.y, -30);
    }
    for (const [id, m] of this.balls)
      if (!alive.has(id)) {
        m.dispose();
        this.balls.delete(id);
      }
    if (s.projectile) {
      const p = s.projectile,
        q = point(p);
      if (!this.projectile || this.projectile.metadata.color !== p.color) {
        this.projectile?.dispose();
        this.projectile = this.sphere(
          'actual-core-projectile',
          p.color,
          q.x,
          q.y,
          DIAMETER,
          scheme,
          -80,
        );
      }
      this.projectile.position.set(q.x, -q.y, -80);
    } else {
      this.projectile?.dispose();
      this.projectile = null;
    }
    for (const [key, color] of [
      ['loaded', s.loadedColor],
      ['next', s.nextColor],
    ])
      if (
        !this[key] ||
        this[key].metadata.color !== color ||
        this[key].metadata.scheme !== scheme
      ) {
        this[key]?.dispose();
        this[key] = this.sphere(key, color, 0, 0, DIAMETER, scheme, -8);
        if (key === 'loaded') {
          this[key].parent = this.joint;
          this[key].position.set(0, 0, -8);
        } else {
          this[key].position.set(this.nextSocket.x, -this.nextSocket.y, -45);
          this[key].scaling.setAll(this.nextSocket.diameter / DIAMETER);
        }
      }
    this.loaded.setEnabled(
      !s.projectile ||
        Math.hypot(s.projectile.x, s.projectile.y - this.config.cannonY) > 2 * this.config.radius,
    );
    if (this.pendingImpact && this.balls.has(this.pendingImpact)) {
      this.balls.get(this.pendingImpact).metadata.hitUntil = this.clock + 0.2;
      this.pendingImpact = null;
    }
    if (trace) this.guide(trace);
    this.updateHUD(s);
  }
  updateHUD(s) {
    this.snapshot = s;
    const signature = [
      s.paidAmmo,
      this.displayPending ?? s.tickets.pending,
      s.dispenserFault,
      s.loadedColor,
      s.projectile?.mode,
      this.energy > 0,
      this.ack > 0,
      Math.round(Math.max(0, 1 - (this.clock - (this.rewardPulseAt ?? -10)) / 0.18) * 10),
      this.lastGain,
      this.config.ballsPerCoin,
      this.debug,
      this.debug ? s.angle : 0,
    ].join(':');
    if (this.hudSignature === signature && this.hudImage.complete) return;
    this.hudSignature = signature;
    const c = this.hud.getContext();
    c.clearRect(0, 0, 900, 1600);
    const plate = (x, y, w, h) => {
      if (this.hudImage.complete && this.hudImage.naturalWidth)
        c.drawImage(this.hudImage, 18, 879, 638, 247, x - w / 2, y - h / 2, w, h);
    };
    const text = (txt, x, y, size, color = '#ffe4a2', maxWidth = 260) => {
      c.font = `400 ${size}px ArcadeDisplay,"Microsoft YaHei",sans-serif`;
      while (c.measureText(txt).width > maxWidth && size > 16) {
        size--;
        c.font = `400 ${size}px ArcadeDisplay,sans-serif`;
      }
      c.textAlign = 'center';
      c.fillStyle = color;
      c.shadowColor = '#07182b';
      c.shadowBlur = 3;
      c.lineWidth = 3;
      c.strokeStyle = '#052239';
      c.strokeText(txt, x, y + 2);
      if (color === '#ffe4a2') {
        const g = c.createLinearGradient(0, y - size, 0, y + 4);
        g.addColorStop(0, '#fffbea');
        g.addColorStop(0.45, '#ffe6a9');
        g.addColorStop(1, '#efae4d');
        c.fillStyle = g;
      }
      c.fillText(txt, x, y);
    };
    plate(228, 70, 365, 106);
    plate(672, 70, 365, 106);
    text('可发射泡泡数', 154, 81, 25, '#ffe4a2', 155);
    text(String(s.paidAmmo).padStart(2, '0'), 310, 84, 46, '#ffe4a2', 110);
    text('待出彩票', 601, 81, 27, '#ffe4a2', 132);
    const rewardPulse = this.reduced
      ? 0
      : Math.max(0, 1 - (this.clock - (this.rewardPulseAt ?? -10)) / 0.18);
    c.save();
    c.translate(754, 84 - rewardPulse * 7);
    c.scale(1 + rewardPulse * 0.18, 1 + rewardPulse * 0.18);
    c.translate(-754, -84);
    text(String(this.displayPending ?? s.tickets.pending), 754, 84, 46, '#ffe4a2', 110);
    c.restore();
    plate(450, 1563, 790, 64);
    const free = s.paidAmmo === 0 && s.projectile?.mode !== 'paid';
    text(
      free
        ? `免费试射选色 · 投币后消除获票`
        : `每币 ${this.config.ballsPerCoin} 球 · 投币后消除获票`,
      450,
      1572,
      26,
      free ? '#ffdc77' : '#bee6e1',
    );

    if (this.debug) {
      c.shadowBlur = 0;
      c.strokeStyle = '#74cbd9';
      c.lineWidth = 2;
      c.setLineDash([9, 8]);
      for (const y of [1180, point({ x: 0, y: this.config.dangerY }).y, 1340]) {
        c.beginPath();
        c.moveTo(36, y);
        c.lineTo(864, y);
        c.stroke();
      }
      c.setLineDash([]);
      text('游玩区下缘 1180', 170, 1173, 20, '#a3e5ee');
      text('核心危险线 -4.65', 175, 1248, 20, '#a3e5ee');
      text('操作装置避让边界 1340', 181, 1334, 20, '#a3e5ee');
      c.strokeRect(50, 1314, 160, 218);
      c.strokeRect(633, 1340, 240, 200);
      const p = this.muzzlePoint();
      c.strokeStyle = '#ffe793';
      c.beginPath();
      c.arc(p.x, p.y, 8, 0, Math.PI * 2);
      c.stroke();
      c.beginPath();
      c.arc(this.pivot.x, this.pivot.y, 8, 0, Math.PI * 2);
      c.stroke();
    }
    this.hud.update();
  }
  response(a) {
    if (a.type === 'fire') {
      this.recoil = 1;
      this.petMode = 'fire';
      this.petUntil = this.clock + 0.5;
    }
    if (a.type === 'hit') {
      const q = point(a);
      this.projectileImpact = this.clock + 0.12;
      for (const m of this.balls.values())
        if (Math.hypot(m.metadata.home.x - q.x, m.metadata.home.y - q.y) < DIAMETER * 1.5)
          m.metadata.hitUntil = this.clock + 0.2;
    }
    if (a.type === 'earned') {
      this.energy = 1;
      this.lastGain = a.count;
    }
    if (a.type === 'ack') this.ack = 1;
    if (a.type === 'resolve') {
      this.petMode = a.dropped.length ? 'cheer' : a.direct.length ? 'small' : 'idle';
      this.petUntil = this.clock + 1.4;
      this.tilt = a.dropped.length ? 0.15 : a.direct.length ? 0.07 : 0.025;
      if (a.attached) {
        this.pendingImpact = a.attached.id;
        const q = point(a.attached);
        const m = this.label('committed-attached-position', '◇', q.x, q.y, 24, 24);
        this.fx.push({ mesh: m, kind: 'marker', age: 0, x: q.x, y: q.y });
        this.lastAttached = a.attached;
      }
      for (const p of a.direct) {
        const q = point(p);
        for (let i = 0; i < 3; i++)
          this.fx.push({
            mesh: this.fragment(p.color, q, i),
            kind: 'shard',
            age: 0,
            x: q.x,
            y: q.y,
            vx: (i - 1) * 130,
            vy: -90 - i * 20,
          });
      }
      for (const p of a.dropped) {
        const q = point(p);
        this.fx.push({
          mesh: this.sphere('committed-drop', p.color, q.x, q.y, DIAMETER),
          kind: 'drop',
          age: 0,
          x: q.x,
          y: q.y,
          vx: (p.c - 4.5) * 25,
          vy: 40,
        });
      }
    }
  }
  tick(dt) {
    this.engine.beginFrame();
    this.clock += dt;
    for (const m of this.materials) m.setFloat('clock', this.clock);
    this.energy = Math.max(0, this.energy - dt * 0.7);
    this.ack = Math.max(0, this.ack - dt * 0.9);
    this.recoil = Math.max(0, this.recoil - dt * 4);
    this.tilt = Math.max(0, this.tilt - dt);
    this.root.rotation.z = Math.sin(this.clock * 65) * this.tilt * 0.006;
    this.root.setPivotPoint(new B.Vector3(450, -800, 0));
    for (const m of this.balls.values()) {
      const h = Math.max(0, (m.metadata.hitUntil || 0) - this.clock) / 0.2,
        b = 1 + Math.sin(this.clock * 0.8 + m.metadata.home.x * 0.03) * 0.003;
      m.scaling.set(b + h * 0.06, 2 - b - h * 0.05, 1);
    }
    this.parts.shell.scaling.y = 1 - this.recoil * 0.045;

    this.loaded.scaling.set(1 + this.recoil * 0.05, 1 - this.recoil * 0.05, 1);
    if (this.projectile) {
      const impact = Math.max(0, (this.projectileImpact || 0) - this.clock) / 0.12;
      this.projectile.scaling.set(1 + impact * 0.1, 1 - impact * 0.1, 1);
    }
    const t = this.clock,
      mode = t < this.petUntil ? this.petMode : 'idle',
      cheer = mode === 'cheer' ? Math.sin((this.petUntil - t) * 8) * 0.13 : 0;
    this.parts.head.position.y = 226 + Math.sin(t * 2) * 2;
    this.parts.head.rotation.z =
      this.aim * 0.12 + cheer + (mode === 'fire' ? this.recoil * 0.12 : 0);
    this.parts.body.scaling.y = 1 + Math.sin(t * 2) * 0.015;
    this.parts.wing.rotation.z = Math.sin(t * 2.1) * 0.045 - cheer * 2;
    this.parts.farWing.rotation.z = Math.sin(t * 2.1 + 0.5) * 0.045 - cheer * 1.6;
    this.parts.tail.rotation.z = Math.sin(t * 1.8) * 0.08;
    this.parts.arm.rotation.z =
      mode === 'small' ? Math.sin(t * 12) * 0.25 : mode === 'cheer' ? -0.65 : 0;
    this.parts.farArm.rotation.z = mode === 'cheer' ? -0.42 : 0;
    this.fx = this.fx.filter((f) => {
      f.age += dt;
      const a = f.age;
      if (f.kind === 'ticket') {
        const k = Math.min(1, a),
          ease = 1 - (1 - k) ** 3;
        f.mesh.position.set(
          f.x + (753 - f.x) * ease,
          -(f.y + (110 - f.y) * ease - 70 * Math.sin(k * Math.PI)),
          -95,
        );
      } else if (f.kind !== 'marker') {
        f.mesh.position.set(f.x + f.vx * a, -(f.y + f.vy * a + 280 * a * a), -95);
        f.mesh.rotation.z = a * 2;
        if (f.kind === 'drop' && a > 0.75) {
          f.x = f.mesh.position.x;
          f.y = -f.mesh.position.y;
          f.mesh.dispose();
          f.mesh = this.label('cosmetic-won-ticket', '▰', f.x, f.y, 36, 23);
          f.kind = 'ticket';
          f.age = 0;
          return true;
        }
      }
      if (a > (f.kind === 'marker' ? 0.6 : 1)) {
        f.mesh.dispose();
        return false;
      }
      return true;
    });
    if (this.snapshot) this.updateHUD(this.snapshot);
    this.scene.render();
    this.engine.endFrame();
    this.captureTrack?.requestFrame();
  }
  muzzlePoint() {
    this.joint.computeWorldMatrix(true);
    this.muzzle.computeWorldMatrix(true);
    const p = this.muzzle.getAbsolutePosition();
    return { x: p.x, y: -p.y };
  }
  renderedPoint(core) {
    const q = point(core),
      p = B.Vector3.TransformCoordinates(
        new B.Vector3(q.x, -q.y, -80),
        this.root.computeWorldMatrix(true),
      );
    return { x: p.x, y: -p.y };
  }
}
