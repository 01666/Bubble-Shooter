const B = globalThis.BABYLON;
export const WIDTH = 900,
  SCALE = 900 / 9.9,
  DIAMETER = 0.88 * SCALE;
export const COLORS = ['#ef2554', '#228bff', '#31df96', '#ffc733', '#aa61f7'];
export const orbBoxes = [
  [69, 85, 445, 451],
  [575, 85, 952, 451],
  [1088, 85, 1466, 451],
  [78, 571, 456, 938],
  [577, 571, 955, 938],
];
const deviceBoxes = {
  turret: [55, 35, 617, 635],
  base: [640, 368, 1235, 637],
  feeder: [56, 815, 633, 1150],
  collector: [748, 639, 1128, 1218],
};
const petBoxes = {
  head: [32, 100, 436, 422],
  blink: [430, 100, 829, 422],
  body: [891, 97, 1190, 418],
  farWing: [57, 470, 417, 797],
  wing: [476, 481, 786, 800],
  tail: [843, 529, 1219, 786],
  farArm: [52, 882, 421, 1120],
  arm: [514, 879, 787, 1137],
  feet: [861, 941, 1225, 1141],
};
B.Effect.ShadersStore.cutoutVertexShader = `precision highp float;attribute vec3 position;attribute vec2 uv;uniform mat4 worldViewProjection;varying vec2 vUV;void main(){vUV=uv;gl_Position=worldViewProjection*vec4(position,1.);}`;
B.Effect.ShadersStore.cutoutFragmentShader = `precision highp float;varying vec2 vUV;uniform sampler2D atlas;uniform vec4 rect;uniform float brightness;uniform float clock;uniform float orb;uniform float seed;void main(){vec2 q=vec2(rect.x+vUV.x*rect.z,1.-rect.y-(1.-vUV.y)*rect.w);vec4 c=texture2D(atlas,q);if(c.a<.10)discard;vec3 rgb=c.rgb*brightness;if(orb>0.5){vec2 p=(vUV-.5)*2.;float r=length(p);if(r>.985)discard;float glint=pow(max(0.,1.-length((p-vec2(-.36+.06*sin(clock*.35+seed),.53)) /vec2(.27,.07))),3.);rgb+=vec3(.09)*glint;float arc=exp(-pow((r-.83)*35.,2.))*max(0.,sin(atan(p.y,p.x)*2.+clock*.4+seed))*.035;rgb+=vec3(.2,.5,.6)*arc;}gl_FragColor=vec4(rgb,c.a);}`;
B.Effect.ShadersStore.capsuleVertexShader = `precision highp float;attribute vec3 position;attribute vec3 normal;uniform mat4 worldViewProjection;uniform mat4 world;varying vec3 n;varying vec3 p;void main(){n=normalize(mat3(world)*normal);p=position;gl_Position=worldViewProjection*vec4(position,1.);}`;
B.Effect.ShadersStore.capsuleFragmentShader = `precision highp float;varying vec3 n;varying vec3 p;uniform vec3 color;uniform float clock;uniform float seed;void main(){vec3 N=normalize(n);float facing=max(0.,-N.z);float rim=pow(1.-facing,2.5);vec3 L=normalize(vec3(-.4,.72,-.65));float diffuse=max(0.,dot(N,L));vec3 rgb=color*(.38+.58*diffuse);float core=smoothstep(.55,.76,facing);rgb=mix(rgb,color*(.57+.28*diffuse),core*.5);float band=exp(-pow((N.y+.37+.025*sin(clock*.5+seed))*13.,2.));rgb+=color*.23*band*facing;vec3 H=normalize(L+vec3(0.,0.,-1.));float spec=pow(max(0.,dot(N,H)),95.);float spec2=pow(max(0.,dot(N,normalize(vec3(.55,-.6,-.7)))),160.);rgb+=vec3(.84,.93,1.)*spec*.95+vec3(1.,.78,.4)*spec2*.21;rgb=mix(rgb,vec3(.52,.75,.81)*.48+color*.35,rim*.65);float shell=exp(-pow((facing-.36)*22.,2.));rgb+=vec3(.15,.21,.24)*shell;gl_FragColor=vec4(rgb,1.);}`;
export function point(p) {
  return { x: 450 + p.x * SCALE, y: 180 + (7 - p.y) * SCALE };
}
export class Region {
  constructor(canvas, start, end) {
    this.canvas = canvas;
    this.start = start;
    this.end = end;
    this.engine = new B.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
    this.engine.setHardwareScalingLevel(1 / Math.min(devicePixelRatio, 1.5));
    this.scene = new B.Scene(this.engine);
    this.scene.clearColor = new B.Color4(0.025, 0.05, 0.09, 1);
    this.camera = new B.FreeCamera(
      'orthographic',
      new B.Vector3(450, -(start + end) / 2, -2000),
      this.scene,
    );
    this.camera.setTarget(new B.Vector3(450, -(start + end) / 2, 0));
    this.camera.mode = B.Camera.ORTHOGRAPHIC_CAMERA;
    this.camera.minZ = 0.1;
    this.camera.maxZ = 4000;
    this.camera.orthoLeft = -450;
    this.camera.orthoRight = 450;
    this.camera.orthoTop = (end - start) / 2;
    this.camera.orthoBottom = -(end - start) / 2;
    this.textures = {};
    this.materials = [];
    this.objects = [];
    this.balls = new Map();
    this.parts = {};
    this.fx = [];
    this.clock = 0;
    this.energy = 0;
    this.ack = 0;
    this.petMode = 'idle';
    this.petUntil = 0;
    this.aim = 0;
    this.recoil = 0;
    this.tilt = 0;
    for (const name of ['room-clean', 'orbs', 'apparatus', 'dragon-parts']) {
      this.textures[name] = new B.Texture(
        `/assets/images/${name}.png`,
        this.scene,
        false,
        true,
        B.Texture.TRILINEAR_SAMPLINGMODE,
      );
      this.textures[name].hasAlpha = name !== 'room-clean';
      this.textures[name].wrapU = this.textures[name].wrapV = B.Texture.CLAMP_ADDRESSMODE;
    }
    this.sprite(
      'room',
      this.textures['room-clean'],
      [0, 0, 941, 1672],
      [941, 1672],
      450,
      800,
      900,
      1600,
      100,
      false,
    );
    this.root = new B.TransformNode('independent-moving-objects', this.scene);
  }
  viewport(start, end, width) {
    this.start = start;
    this.end = end;
    this.canvas.width = width;
    this.canvas.height = Math.round((width * (end - start)) / 900);
    this.canvas.style.height = this.canvas.height + 'px';
    this.camera.position.y = -(start + end) / 2;
    this.camera.setTarget(new B.Vector3(450, -(start + end) / 2, 0));
    this.camera.orthoTop = (end - start) / 2;
    this.camera.orthoBottom = -(end - start) / 2;
    this.engine.resize();
  }
  sprite(name, texture, box, size, x, y, w, h, z = -10, parent = true, orb = false) {
    const mesh = B.MeshBuilder.CreatePlane(name, { width: w, height: h }, this.scene);
    mesh.position.set(x, -y, z);
    const m = new B.ShaderMaterial(
      name + '-material',
      this.scene,
      { vertex: 'cutout', fragment: 'cutout' },
      {
        attributes: ['position', 'uv'],
        uniforms: ['worldViewProjection', 'rect', 'brightness', 'clock', 'orb', 'seed'],
        samplers: ['atlas'],
        needAlphaBlending: true,
        needAlphaTesting: true,
      },
    );
    m.setTexture('atlas', texture);
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
    m.setFloat('clock', 0);
    m.setFloat('orb', orb ? 1 : 0);
    m.setFloat('seed', Math.random() * 6);
    m.backFaceCulling = false;
    mesh.material = m;
    mesh.isPickable = false;
    if (parent) mesh.parent = this.root;
    this.materials.push(m);
    mesh.onDisposeObservable.add(() => {
      this.materials = this.materials.filter((item) => item !== m);
      m.dispose(false, false);
    });
    return mesh;
  }
  sphere(name, color, x, y, diameter, scheme = 'hybrid', z = -30) {
    let mesh;
    if (scheme === 'hybrid')
      mesh = this.sprite(
        name,
        this.textures.orbs,
        orbBoxes[color],
        [1536, 1024],
        x,
        y,
        diameter,
        diameter,
        z,
        true,
        true,
      );
    else {
      mesh = B.MeshBuilder.CreateSphere(name, { diameter, segments: 32 }, this.scene);
      mesh.position.set(x, -y, z);
      mesh.parent = this.root;
      const m = new B.ShaderMaterial(
        name + '-material',
        this.scene,
        { vertex: 'capsule', fragment: 'capsule' },
        {
          attributes: ['position', 'normal'],
          uniforms: ['worldViewProjection', 'world', 'color', 'clock', 'seed'],
        },
      );
      m.setColor3('color', B.Color3.FromHexString(COLORS[color]));
      m.setFloat('clock', 0);
      m.setFloat('seed', Math.random() * 6);
      mesh.material = m;
      this.materials.push(m);
      mesh.onDisposeObservable.add(() => {
        this.materials = this.materials.filter((item) => item !== m);
        m.dispose(false, false);
      });
    }
    mesh.metadata = { color, diameter, scheme };
    return mesh;
  }
  shadow(name, x, y, w, h) {
    const t = new B.DynamicTexture(name + '-shadow', { width: 256, height: 96 }, this.scene, false);
    const c = t.getContext(),
      g = c.createRadialGradient(128, 48, 4, 128, 48, 100);
    g.addColorStop(0, 'rgba(0,8,18,.72)');
    g.addColorStop(1, 'rgba(0,8,18,0)');
    c.scale(1, 0.46);
    c.fillStyle = g;
    c.fillRect(0, 0, 256, 208);
    t.update();
    t.hasAlpha = true;
    return this.sprite(name, t, [0, 0, 256, 96], [256, 96], x, y, w, h, 2);
  }
  label(name, text, x, y, w = 150, h = 32) {
    const t = new B.DynamicTexture(name, { width: 512, height: 112 }, this.scene, false);
    const c = t.getContext();
    c.clearRect(0, 0, 512, 112);
    c.font = '600 83px "Microsoft YaHei", sans-serif';
    c.textAlign = 'center';
    c.fillStyle = '#eddba8';
    c.shadowColor = '#141b21';
    c.shadowBlur = 4;
    c.fillText(text, 256, 86);
    t.update();
    t.hasAlpha = true;
    const mesh = this.sprite(name, t, [0, 0, 512, 112], [512, 112], x, y, w, h, -90);
    mesh.metadata = { texture: t };
    mesh.onDisposeObservable.add(() => t.dispose());
    return mesh;
  }
  apparatus() {
    this.shadow('cannon-contact', 465, 1430, 385, 88);
    this.shadow('dragon-contact', 178, 1415, 260, 70);
    this.shadow('collector-contact', 779, 1405, 205, 68);
    const part = (name, x, y, w, h, z) =>
      (this.parts[name] = this.sprite(
        name,
        this.textures.apparatus,
        deviceBoxes[name],
        [1254, 1254],
        x,
        y,
        w,
        h,
        z,
      ));
    part('base', 458, 1395, 345, 146, -10);
    part('feeder', 602, 1315, 205, 127, -22);
    part('collector', 781, 1230, 185, 282, -18).material.setFloat('brightness', 0.58);
    const joint = new B.TransformNode('barrel-pivot', this.scene);
    joint.parent = this.root;
    joint.position.set(450, -1370, -30);
    this.joint = joint;
    const barrel = part('turret', 0, -137, 252, 269, 0);
    barrel.parent = joint;
    barrel.position.set(0, 137, 0);
    this.loaded = this.sphere('current-loaded', 1, 0, -143, 96, this.scheme, -3);
    this.loaded.parent = joint;
    this.loaded.position.set(0, 143, -3); // current ball sits in the transparent load window
    this.next = this.sphere('next-in-feeder', 2, 657, 1255, 89, this.scheme, -45);
    this.label('earned-label', '赢得彩票', 781, 1135, 135, 31);
    this.label('device-label', '等待出票', 783, 1330, 128, 29);
    this.rig();
  }
  rig() {
    const rig = new B.TransformNode('pet-rig', this.scene);
    rig.parent = this.root;
    rig.position.set(178, -1390, -40);
    this.pet = rig;
    const part = (name, x, y, w, h, z) => {
      const m = this.sprite(
        name,
        this.textures['dragon-parts'],
        petBoxes[name],
        [1254, 1254],
        x,
        y,
        w,
        h,
        z,
      );
      m.parent = rig;
      m.position.set(x, -y, z);
      this.parts[name] = m;
      return m;
    };
    part('tail', -65, -47, 135, 85, 4);
    part('farWing', -44, -166, 121, 111, 3);
    part('feet', 0, 0, 135, 60, -1);
    part('body', 0, -102, 100, 112, 0);
    part('farArm', 44, -90, 87, 53, -1);
    part('wing', -28, -155, 95, 97, -2);
    part('arm', 31, -91, 61, 63, -4);
    part('head', 22, -226, 155, 124, -5);
    for (const [name, x, y] of [
      ['tail', 55, 0],
      ['farWing', 51, -39],
      ['wing', 40, -34],
      ['farArm', -35, 18],
      ['arm', 24, 22],
      ['head', 0, -52],
    ])
      this.parts[name].setPivotPoint(new B.Vector3(x, y, 0));
  }
  board(snapshot, scheme) {
    this.scheme = scheme;
    const alive = new Set();
    for (const p of snapshot.board) {
      alive.add(p.id);
      let mesh = this.balls.get(p.id);
      if (mesh && (mesh.metadata.scheme !== scheme || mesh.metadata.color !== p.color)) {
        mesh.dispose();
        this.balls.delete(p.id);
        mesh = null;
      }
      const q = point(p);
      if (!mesh) {
        mesh = this.sphere(p.id, p.color, q.x, q.y, DIAMETER, scheme, -30);
        this.balls.set(p.id, mesh);
      }
      mesh.metadata.home = { ...q };
      mesh.position.set(q.x, -q.y, -30);
    }
    for (const [id, m] of this.balls)
      if (!alive.has(id)) {
        m.dispose();
        this.balls.delete(id);
      }
    if (this.pendingImpact && this.balls.has(this.pendingImpact)) {
      this.balls.get(this.pendingImpact).metadata.hitUntil = this.clock + 0.28;
      this.pendingImpact = null;
    }
    if (!snapshot.projectile && this.projectile) {
      this.projectile.dispose();
      this.projectile = null;
    }
    if (snapshot.projectile) {
      const p = snapshot.projectile,
        q = point(p);
      if (!this.projectile)
        this.projectile = this.sphere('in-flight', p.color, q.x, q.y, DIAMETER, scheme, -45);
      this.projectile.position.set(q.x, -q.y, -45);
      this.projectile.scaling.set(1.06, 1.08, 1);
    }
    if (
      !this.sample ||
      this.sample.metadata.scheme !== scheme ||
      this.sample.metadata.color !== snapshot.loadedColor
    ) {
      if (this.sample) this.sample.dispose();
      this.sample = this.sphere(
        'actual-size-load-sample',
        snapshot.loadedColor,
        774,
        896,
        DIAMETER,
        scheme,
        -25,
      );
    }
    this.guide(snapshot);
  }
  guide(snapshot) {
    const a = snapshot.angle,
      dx = Math.sin(a),
      dy = Math.cos(a),
      origin = { x: 0, y: -6.25 };
    let limit = 11.5;
    for (const b of snapshot.board) {
      const x = b.x - origin.x,
        y = b.y - origin.y,
        along = x * dx + y * dy,
        side = Math.abs(x * dy - y * dx);
      if (along > 0 && side < 0.88)
        limit = Math.min(limit, along - Math.sqrt(0.88 * 0.88 - side * side));
    }
    const lines = [];
    for (let i = 0; i < 18; i++) {
      const d = 3.5 + (Math.max(0, limit - 3.5) * i) / 18,
        q = point({ x: dx * d, y: origin.y + dy * d }),
        q2 = point({ x: dx * (d + 0.035), y: origin.y + dy * (d + 0.035) });
      lines.push([new B.Vector3(q.x, -q.y, -50), new B.Vector3(q2.x, -q2.y, -50)]);
    }
    this.aimLine = B.MeshBuilder.CreateLineSystem(
      'core-space-aim-guide',
      { lines, updatable: true, instance: this.aimLine },
      this.scene,
    );
    this.aimLine.parent = this.root;
    this.aimLine.color = new B.Color3(0.34, 0.75, 1);
  }
  response(action) {
    if (action.type === 'earned') {
      this.energy = 1;
      this.petMode = 'cheer';
      this.petUntil = this.clock + 1.7;
      for (let i = 0; i < 3; i++) {
        const f = this.label('earned-ticket', '▰', 450 + i * 35, 920, 28, 18);
        this.fx.push({ mesh: f, kind: 'ticket', age: 0, x: 450 + i * 35, y: 920 });
      }
    }
    if (action.type === 'ack') this.ack = 1;
    if (action.type === 'fire') {
      this.recoil = 1;
      this.petMode = 'fire';
      this.petUntil = this.clock + 0.6;
    }
    if (action.type === 'hit') {
      this.recoil = 0.5;
      this.petMode = 'hit';
      this.petUntil = this.clock + 0.4;
      const q = point(action);
      for (const m of this.balls.values())
        if (
          Number.isFinite(q.x) &&
          Math.hypot(m.metadata.home.x - q.x, m.metadata.home.y - q.y) < 110
        )
          m.metadata.hitUntil = this.clock + 0.25;
    }
    if (action.type === 'resolve') {
      this.tilt = action.dropped.length ? 0.2 : action.direct.length ? 0.1 : 0.05;
      this.petMode = action.dropped.length ? 'cheer' : action.direct.length ? 'small' : 'hit';
      this.petUntil = this.clock + 1.5;
      if (action.attached) this.pendingImpact = action.attached.id;
      for (const p of action.direct) {
        const q = point(p);
        for (let i = 0; i < 3; i++) {
          const m = this.fragment(p.color, q, i);
          this.fx.push({
            mesh: m,
            kind: 'shard',
            age: 0,
            x: q.x,
            y: q.y,
            vx: (i - 1) * 130,
            vy: -80 - i * 20,
          });
        }
      }
      for (const p of action.dropped) {
        const q = point(p);
        const m = this.sphere('falling-capsule', p.color, q.x, q.y, DIAMETER, this.scheme, -55);
        this.fx.push({
          mesh: m,
          kind: 'drop',
          age: 0,
          x: q.x,
          y: q.y,
          vx: (p.c - 4.5) * 30,
          vy: 45,
        });
      }
    }
  }
  fragment(color, q, index) {
    const mesh = this.sphere('shell-wedge', color, q.x, q.y, DIAMETER, this.scheme, -55),
      data = new B.VertexData(),
      positions = [0, 0, 0],
      uvs = [0.5, 0.5],
      indices = [],
      normals = [0, 0, -1];
    for (let k = 0; k <= 4; k++) {
      const a = ((index * 2) / 3 + k / 6) * Math.PI,
        x = Math.cos(a) * DIAMETER * 0.48,
        y = Math.sin(a) * DIAMETER * 0.48;
      positions.push(x, y, 0);
      uvs.push(x / DIAMETER + 0.5, y / DIAMETER + 0.5);
      normals.push(0, 0, -1);
      if (k > 0) indices.push(0, k, k + 1);
    }
    data.positions = positions;
    data.uvs = uvs;
    data.indices = indices;
    data.normals = normals;
    data.applyToMesh(mesh);
    mesh.material.backFaceCulling = false;
    return mesh;
  }
  replaceLoaded(color, next, scheme) {
    if (!this.joint) return;
    if (this.loaded) this.loaded.dispose();
    if (this.next) this.next.dispose();
    this.loaded = this.sphere('current-loaded', color, 0, 0, 96, scheme, -3);
    this.loaded.parent = this.joint;
    this.loaded.position.set(0, 143, -3);
    this.next = this.sphere('next-in-feeder', next, 657, 1255, 89, scheme, -45);
  }
  tick(dt) {
    this.engine.beginFrame();
    this.clock += dt;
    for (const m of this.materials) if (!m.isDisposed) m.setFloat('clock', this.clock);
    this.energy = Math.max(0, this.energy - dt * 1.8);
    this.ack = Math.max(0, this.ack - dt * 4);
    this.recoil = Math.max(0, this.recoil - dt * 4);
    this.tilt = Math.max(0, this.tilt - dt);
    this.camera.rotation.z = Math.sin(this.clock * 70) * this.tilt * 0.008;
    // World-only tilt. HUD labels remain unshaken.
    for (const m of this.balls.values()) {
      const home = m.metadata.home;
      m.position.x = home.x + Math.sin(this.clock * 70) * this.tilt * 5;
      m.position.y = -home.y;
      const impact = Math.max(0, (m.metadata.hitUntil || 0) - this.clock) / 0.25;
      const breathe = 1 + Math.sin(this.clock * 0.8 + home.x * 0.03) * 0.004;
      m.scaling.set(
        breathe + Math.sin(impact * 7) * impact * 0.12,
        2 - breathe - Math.sin(impact * 7) * impact * 0.1,
        1,
      );
    }
    if (this.joint) {
      this.joint.rotation.z = -this.aim;
      this.joint.position.y = -1370 - this.recoil * 7;
      this.loaded.scaling.set(1 + this.recoil * 0.08, 1 - this.recoil * 0.11, 1);
      this.parts.collector.material.setFloat('brightness', 0.58 + this.energy * 0.3);
    }
    if (this.pet) {
      const t = this.clock,
        mode = t < this.petUntil ? this.petMode : 'idle',
        cheer = mode === 'cheer' ? Math.sin((this.petUntil - t) * 8) * 0.13 : 0;
      this.parts.head.position.y = 226 + Math.sin(t * 2) * 2;
      this.parts.head.rotation.z =
        this.aim * 0.13 + cheer + (mode === 'fire' ? this.recoil * 0.12 : 0);
      this.parts.body.scaling.y = 1 + Math.sin(t * 2) * 0.015;
      this.parts.wing.rotation.z = Math.sin(t * 2.1) * 0.045 - cheer * 2;
      this.parts.farWing.rotation.z = Math.sin(t * 2.1 + 0.5) * 0.045 - cheer * 1.6;
      this.parts.tail.rotation.z = Math.sin(t * 1.8) * 0.08;
      this.parts.arm.rotation.z =
        mode === 'small' ? Math.sin(t * 12) * 0.25 : mode === 'cheer' ? -0.65 : 0;
      this.parts.farArm.rotation.z = mode === 'cheer' ? -0.42 : 0;
      const head = this.parts.head.material,
        b = petBoxes[t % 4.8 < 0.13 ? 'blink' : 'head'];
      head.setVector4(
        'rect',
        new B.Vector4(b[0] / 1254, b[1] / 1254, (b[2] - b[0]) / 1254, (b[3] - b[1]) / 1254),
      );
    }
    this.fx = this.fx.filter((f) => {
      f.age += dt;
      const a = f.age;
      if (f.kind === 'ticket') {
        const k = Math.min(1, a / 1.0),
          ease = 1 - (1 - k) ** 3;
        f.mesh.position.set(
          f.x + (781 - f.x) * ease,
          -(f.y + (1100 - f.y) * ease - 70 * Math.sin(k * Math.PI)),
          -75,
        );
      } else {
        f.mesh.position.x = f.x + f.vx * a;
        f.mesh.position.y = -(f.y + f.vy * a + 280 * a * a);
        f.mesh.rotation.z = a * (f.kind === 'shard' ? 3 : 0.6);
        if (f.kind === 'shard') f.mesh.scaling.scaleInPlace(Math.max(0.8, 1 - dt * 1.6));
        if (f.kind === 'drop' && a > 0.8) {
          f.x = f.mesh.position.x;
          f.y = -f.mesh.position.y;
          f.mesh.dispose();
          f.mesh = this.label('drop-to-ticket', '▰', f.x, f.y, 36, 23);
          f.age = 0;
          f.kind = 'ticket';
          return true;
        }
      }
      if (a > (f.kind === 'drop' ? 1.3 : 1)) {
        f.mesh.dispose();
        return false;
      }
      return true;
    });
    this.scene.render();
    this.engine.endFrame();
  }
  async ready() {
    await this.scene.whenReadyAsync();
  }
  stats() {
    return {
      meshes: this.scene.meshes.length,
      materials: this.materials.length,
      width: this.engine.getRenderWidth(),
      height: this.engine.getRenderHeight(),
      sphereDiameter: (DIAMETER * this.engine.getRenderWidth()) / 900,
      scheme: this.scheme,
    };
  }
}
