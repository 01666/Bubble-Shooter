import { point, DIAMETER } from './scene-base.mjs';
const B = globalThis.BABYLON;
B.Effect.ShadersStore.pearlVertexShader = B.Effect.ShadersStore.cutoutVertexShader;
B.Effect.ShadersStore.pearlFragmentShader =
  'precision highp float; varying vec2 vUV; uniform sampler2D atlas; uniform vec4 rect; uniform float brightness; uniform float opacity; void main(){vec2 q=vec2(rect.x+vUV.x*rect.z,1.-rect.y-(1.-vUV.y)*rect.w);vec4 c=texture2D(atlas,q);if(c.a<.02)discard;gl_FragColor=vec4(c.rgb*brightness,c.a*opacity);}';
export class PearlGuide {
  constructor(s) {
    this.s = s;
    this.pool = [];
    this.turns = [];
    this.fade = 1;
    this.mode = 'paid';
    const t = new B.DynamicTexture(
        'shared-pearl-atlas',
        { width: 256, height: 128 },
        s.scene,
        false,
      ),
      c = t.getContext();
    c.clearRect(0, 0, 256, 128);
    let g = c.createRadialGradient(55, 45, 1, 64, 64, 56);
    g.addColorStop(0, '#edffff');
    g.addColorStop(0.22, '#a4f9ff');
    g.addColorStop(0.65, 'rgba(41,165,255,.85)');
    g.addColorStop(1, 'rgba(27,128,255,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(64, 64, 56, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#e9ffff';
    c.beginPath();
    c.ellipse(49, 45, 9, 5, -0.5, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = 4;
    c.strokeStyle = '#9eeeff';
    c.shadowColor = '#1d9bff';
    c.shadowBlur = 8;
    c.beginPath();
    c.arc(192, 64, 43, 0, Math.PI * 2);
    c.stroke();
    t.hasAlpha = true;
    t.update();
    this.texture = t;
    const sprite = (name, ring, size) => this.make(name, ring, size);
    for (let i = 0; i < 64; i++) {
      const m = sprite('pooled-core-trace-pearl-' + i, false, 22);
      m.setEnabled(false);
      this.pool.push(m);
    }
    for (let i = 0; i < 10; i++) {
      const m = sprite('pooled-trace-turn-' + i, true, 27);
      m.setEnabled(false);
      this.turns.push(m);
    }
    this.end = sprite('predicted-contact-outline', true, (DIAMETER * 64) / 43);
    this.end.setEnabled(false);
    this.impact = sprite('committed-wall-contact-spark', true, 34);
    this.impact.setEnabled(false);
    this.impactUntil = 0;
    this.points = [];
    this.variant = Math.random();
    this.visibleLength = 0;
    this.totalLength = 0;
  }
  bounce(payload) {
    const q = point(payload);
    this.impact.position.set(q.x, -q.y, -94);
    this.impactUntil = this.s.clock + 0.18;
  }
  make(name, ring, size) {
    const m = B.MeshBuilder.CreatePlane(name, { width: size, height: size }, this.s.scene);
    m.parent = this.s.root;
    m.position.z = -92;
    m.renderingGroupId = 1;
    const mat = new B.ShaderMaterial(
      name + '-material',
      this.s.scene,
      { vertex: 'pearl', fragment: 'pearl' },
      {
        attributes: ['position', 'uv'],
        uniforms: ['worldViewProjection', 'rect', 'brightness', 'opacity'],
        samplers: ['atlas'],
        needAlphaBlending: true,
      },
    );
    mat.backFaceCulling = false;
    mat.setTexture('atlas', this.texture);
    mat.setVector4('rect', new B.Vector4(ring ? 0.5 : 0, 0, 0.5, 1));
    mat.setFloat('brightness', 1);
    mat.setFloat('opacity', 1);
    m.material = mat;
    return m;
  }
  newShot() {
    this.variant = Math.random();
    if (this.trace) this.update(this.trace);
  }
  update(trace) {
    this.trace = trace;
    this.mode = trace.mode;
    const path = trace.points.map(point),
      lengths = path.slice(1).map((b, i) => Math.hypot(b.x - path[i].x, b.y - path[i].y)),
      total = lengths.reduce((a, b) => a + b, 0);
    const limit = Math.min(800, total * 0.78) * (0.97 + this.variant * 0.04);
    this.totalLength = total;
    this.visibleLength = limit;
    const samples = [];
    let next = 8,
      walked = 0;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1],
        b = path[i],
        len = lengths[i - 1];
      while (next <= walked + len && next < limit && samples.length < 64) {
        const k = len ? (next - walked) / len : 0;
        if (k >= 0)
          samples.push({
            x: a.x + (b.x - a.x) * k,
            y: a.y + (b.y - a.y) * k,
            segment: i,
            distance: next,
          });
        next += 35 + 14 * (next / Math.max(1, limit));
      }
      walked += len;
    }
    this.points = samples;
    this.pool.forEach((m, i) => {
      m.setEnabled(i < samples.length);
      if (i < samples.length) {
        m.position.set(samples[i].x, -samples[i].y, -92);
        m.material.setVector4('rect', new B.Vector4(0, 0, 0.5, 1));
      }
    });
    // Endpoint and bounce coordinates remain private to the physics prediction, not drawn.
    this.turns.forEach((m) => m.setEnabled(false));
    this.end.setEnabled(false);
    this.bounceSamples = [];
  }
  tick(dt, flying, reduced) {
    this.fade = Math.max(0, Math.min(1, this.fade + (flying ? -dt * 8 : dt * 5)));
    for (let i = 0; i < this.pool.length; i++) {
      const m = this.pool[i],
        p = this.points[i],
        k = p ? Math.min(1, p.distance / Math.max(1, this.visibleLength)) : 1,
        alpha = this.fade * 0.9 * (1 - k) ** 1.45,
        scale = 0.14 + 0.86 * (1 - k) ** 0.85;
      m.setEnabled(!!p && alpha > 0.018);
      m.scaling.set(scale, scale, 1);
      m.material.setFloat('opacity', alpha);
      m.material.setFloat(
        'brightness',
        reduced ? 0.9 : 0.88 + 0.055 * Math.sin(this.s.clock * 2 - i * 0.22),
      );
    }
    this.end.setEnabled(false);
    this.turns.forEach((m) => m.setEnabled(false));
    const a = Math.max(0, (this.impactUntil - this.s.clock) / 0.18);
    this.impact.setEnabled(a > 0);
    this.impact.material.setFloat('opacity', a * (reduced ? 0.4 : 1));
  }
  stats() {
    return {
      capacity: this.pool.length,
      count: this.points.length,
      visibleLength: this.visibleLength,
      totalLength: this.totalLength,
      endpointVisible: this.end.isEnabled(),
      pearls: this.pool
        .filter((m) => m.isEnabled())
        .map((m) => ({ scale: m.scaling.x, alpha: m.material._floats.opacity })),
      mode: this.mode,
      fade: this.fade,
      points: this.points,
      turns: this.bounceSamples || [],
      trace: this.trace,
    };
  }
}
