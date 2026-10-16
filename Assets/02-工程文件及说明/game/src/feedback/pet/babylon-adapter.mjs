import { PetFeedback } from './controller.mjs';
import { drawDragon, drawBubble } from './dragon.mjs';
import { PET_SLOT_LAYOUT } from '../pet-slots/layout.mjs';
// No Engine, camera, audio hub or requestAnimationFrame is created here.
export function createBabylonPet(
  scene,
  { parent = null, onSpeech, reducedMotion = false, poseModifier = (pose) => pose } = {},
) {
  const B = globalThis.BABYLON,
    controller = new PetFeedback({ onSpeech, reducedMotion });
  const texture = new B.DynamicTexture(
    'pet-v8-original-vector',
    { width: 768, height: 480 },
    scene,
    false,
  );
  texture.hasAlpha = true;
  const mesh = B.MeshBuilder.CreatePlane('pet-v8-layer', { width: 512, height: 320 }, scene);
  mesh.position.set(276, -1390, -115);
  mesh.parent = parent;
  mesh.isPickable = false;
  mesh.renderingGroupId = 1;
  const material = new B.StandardMaterial('pet-v8-alpha', scene);
  material.diffuseTexture = texture;
  material.emissiveColor = B.Color3.White();
  material.disableLighting = true;
  material.backFaceCulling = false;
  material.useAlphaFromDiffuseTexture = true;
  mesh.material = material;
  return {
    controller,
    mesh,
    prime: (s, o) => controller.prime(s, o),
    consume: (e, s) => controller.consume(e, s),
    showBubble: true,
    update(dt, s) {
      const f = controller.update(dt, s);
      if (f) {
        const c = texture.getContext();
        c.clearRect(0, 0, 768, 480);
        c.save();
        c.scale(1.5, 1.5);
        c.translate(-20, -1230);
        f.pose = poseModifier(f.pose);
        const anchors = drawDragon(c, f.pose, PET_SLOT_LAYOUT.pet);
        if (this.showBubble) drawBubble(c, f.bubble, anchors.mouth, { x: 35, y: 1236, width: 300 });
        c.restore();
        texture.update();
      }
      return f;
    },
    dispose() {
      controller.dispose();
      mesh.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}
