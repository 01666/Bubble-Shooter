import { MechanismDirector } from './director.mjs';
import { MechanismRenderer } from './renderer.mjs';
import { CoreMechanismBridge } from './core-bridge.mjs';
// Optional host facade. No RAF, engine, canvas clearing, audio hub or persistence.
export function createMechanismFeedback({
  atlas = null,
  onCue = () => {},
  mapPoint,
  enabled = true,
} = {}) {
  const director = new MechanismDirector({ onCue, enabled });
  const bridge = new CoreMechanismBridge(director, { mapPoint });
  const renderer = new MechanismRenderer(director, { atlas });
  const hidden = new Set();
  const restoreOrbVisibility = () => {
    for (const mesh of hidden) if (!mesh.isDisposed()) mesh.setEnabled(true);
    hidden.clear();
  };
  return {
    director,
    bridge,
    renderer,
    restore: (snapshot, options) => bridge.restore(snapshot, options),
    consume: (events, snapshot) => bridge.consume(events, snapshot),
    update: (dt, options) => director.update(dt, options),
    draw: (context, models) => renderer.draw(context, models),
    restoreOrbVisibility,
    applyOrbVisibility(models, painted) {
      for (const [key, mesh] of [
        ['loaded', models.loadedMesh],
        ['projectile', models.projectileMesh],
      ])
        if (painted[key] && mesh?.isEnabled()) {
          mesh.setEnabled(false);
          hidden.add(mesh);
        }
    },
    petPose: (pose, options) => director.petPose(pose, options),
    retirementPlan: (shotId) => director.retirementPlan(shotId),
    get claimedIds() {
      return director.claimedIds;
    },
    setEnabled(enabled) {
      if (!enabled) restoreOrbVisibility();
      director.enabled = !!enabled;
    },
    stats: () => ({ director: director.stats(), bridge: bridge.stats() }),
    dispose: () => {
      restoreOrbVisibility();
      director.dispose();
    },
  };
}
export function sceneOrbModels(scene, snapshot) {
  const transfer = scene.loadTransfer?.mesh;
  const loaded = transfer?.isEnabled() ? transfer : scene.loaded;
  const model = (mesh) => {
    if (!mesh) return null;
    mesh.computeWorldMatrix(true);
    const p = mesh.getAbsolutePosition();
    return {
      x: p.x,
      y: -p.y,
      radius: ((mesh.metadata?.diameter ?? 80) * Math.abs(mesh.scaling.x)) / 2,
      visible: mesh.isEnabled(),
    };
  };
  return {
    loadedMesh: loaded,
    projectileMesh: scene.projectile,
    loaded: model(loaded),
    projectile: snapshot.projectile?.assist
      ? {
          ...model(scene.projectile),
          colors: [
            snapshot.projectile.assist.primaryColor,
            snapshot.projectile.assist.secondaryColor,
          ],
        }
      : null,
  };
}
