const boxes = [
  [63, 79, 459, 465],
  [568, 79, 969, 466],
  [1079, 80, 1476, 466],
  [63, 555, 459, 942],
  [568, 555, 969, 943],
];
export const stablePhase = (id) => {
  let h = 2166136261;
  for (const ch of String(id)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return ((h >>> 0) / 4294967296) * 6.283;
};
const fragment = `precision highp float;varying vec2 vUV;uniform sampler2D atlas;uniform vec4 rect;uniform float clock;uniform float brightness;uniform float seed;uniform float detail;
void main(){vec2 q=vec2(rect.x+vUV.x*rect.z,1.-rect.y-(1.-vUV.y)*rect.w);vec4 c=texture2D(atlas,q);vec2 p=(vUV-.5)*2.;float r=length(p);if(c.a<.10||r>.985)discard;
float l=dot(c.rgb,vec3(.2126,.7152,.0722));vec3 rgb=clamp(mix(vec3(l),c.rgb,1.08),0.,1.)*brightness;
float turn=.22*sin(clock*.85+seed);float sheen=exp(-pow(length((p-vec2(-.26+turn,.47))/vec2(.30,.11)),2.5));
float rim=exp(-pow((r-.84)*31.,2.))*max(0.,dot(normalize(p+.0001),normalize(vec2(-.6,.7))));
float rare=pow(max(0.,sin(clock*.9+seed*2.37)),18.);vec2 star=p-vec2(.43,-.38);float pin=exp(-dot(star,star)*500.)+ .35*exp(-abs(star.x)*180.-abs(star.y)*16.)+.35*exp(-abs(star.y)*180.-abs(star.x)*16.);
float drift=.5+.5*sin(atan(p.y,p.x)*2.-clock*1.3+seed);
float sweep=exp(-pow((p.y-.48*sin(clock*1.4+seed)+p.x*.24)/.16,2.))*(1.-smoothstep(.65,.98,r))*detail;
rgb=mix(rgb,vec3(.85,.94,1.),sweep*.38);
rgb+=vec3(.30,.32,.34)*sheen*(.65+.35*detail)+vec3(.12,.18,.20)*rim*(.6+drift*.8)+vec3(.55,.48,.32)*pin*rare*detail;
gl_FragColor=vec4(clamp(rgb,0.,1.),c.a);}`;
// Opt-in scene plugin; original sprite material remains active until shader compilation completes.
export class OrbMaterialPolish {
  constructor(scene) {
    this.scene = scene;
    this.records = new Map();
    this.enabled = true;
    const B = globalThis.BABYLON;
    B.Effect.ShadersStore.polishOrbVertexShader = B.Effect.ShadersStore.cutoutVertexShader;
    B.Effect.ShadersStore.polishOrbFragmentShader = fragment;
  }
  update(meshes, time, { quality = 'medium', reduced = false } = {}) {
    if (!this.enabled) return;
    const B = globalThis.BABYLON;
    for (const mesh of meshes) {
      if (!mesh || mesh.isDisposed() || mesh.metadata?.scheme !== 'refined') continue;
      let r = this.records.get(mesh);
      if (!r) {
        const color = mesh.metadata.color,
          b = boxes[color];
        if (!b) continue;
        const material = new B.ShaderMaterial(
          'polish-' + mesh.name,
          this.scene.scene,
          { vertex: 'polishOrb', fragment: 'polishOrb' },
          {
            attributes: ['position', 'uv'],
            uniforms: ['worldViewProjection', 'rect', 'brightness', 'clock', 'seed', 'detail'],
            samplers: ['atlas'],
            needAlphaBlending: true,
            needAlphaTesting: true,
          },
        );
        material.backFaceCulling = false;
        material.setTexture('atlas', this.scene.textures['orbs-refined']);
        material.setVector4(
          'rect',
          new B.Vector4(b[0] / 1536, b[1] / 1024, (b[2] - b[0]) / 1536, (b[3] - b[1]) / 1024),
        );
        r = { original: mesh.material, material };
        r.observer = mesh.onDisposeObservable.add(() => {
          material.dispose(false, false);
          this.records.delete(mesh);
        });
        this.records.set(mesh, r);
      }
      r.material.setFloat('clock', reduced ? 0 : time);
      r.material.setFloat('seed', stablePhase(mesh.name));
      r.material.setFloat('detail', quality === 'low' || reduced ? 0 : 1);
      r.material.setFloat('brightness', 1);
      if (r.material.isReady(mesh)) mesh.material = r.material;
    }
  }
  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) this.clear();
  }
  clear() {
    for (const [mesh, r] of this.records) {
      if (!mesh.isDisposed()) {
        if (mesh.material === r.material) mesh.material = r.original;
        mesh.onDisposeObservable.remove(r.observer);
      }
      r.material.dispose(false, false);
    }
    this.records.clear();
  }
  stats() {
    return {
      materials: this.records.size,
      applied: [...this.records].filter(([m, r]) => m.material === r.material).length,
      enabled: this.enabled,
    };
  }
  dispose() {
    this.clear();
    this.enabled = false;
  }
}
