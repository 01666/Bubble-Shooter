export function bindRoomLayer(scene, room) {
  const B = globalThis.BABYLON,
    texture = new B.DynamicTexture(
      'living-room-local-light',
      { width: 450, height: 800 },
      scene.scene,
      false,
    );
  texture.hasAlpha = true;
  texture.getContext().clearRect(0, 0, 450, 800);
  texture.update();
  const mesh = B.MeshBuilder.CreatePlane(
    'living-room-depth-layer',
    { width: 900, height: 1600 },
    scene.scene,
  );
  mesh.position.set(450, -800, 75);
  mesh.renderingGroupId = 0;
  mesh.isPickable = false;
  const material = new B.StandardMaterial('living-room-transparent', scene.scene);
  material.diffuseTexture = texture;
  material.emissiveColor = B.Color3.White();
  material.disableLighting = true;
  material.useAlphaFromDiffuseTexture = true;
  material.backFaceCulling = false;
  mesh.material = material;
  let last = -100,
    quality = '',
    updates = 0;
  return {
    mesh,
    texture,
    update({ aim = 0, enabled = true } = {}) {
      mesh.setEnabled(enabled);
      if (!enabled) return;
      const size = room.quality === 'low' ? 300 : room.quality === 'high' ? 900 : 450;
      if (quality !== room.quality) {
        texture.scaleTo(size, Math.round((size * 1600) / 900));
        quality = room.quality;
        last = -100;
      }
      if (room.time - last < (room.quality === 'low' ? 0.1 : 0.05)) return;
      last = room.time;
      const c = texture.getContext();
      c.clearRect(0, 0, c.canvas.width, c.canvas.height);
      c.save();
      c.scale(c.canvas.width / 900, c.canvas.height / 1600);
      room.draw(c, { aim });
      c.restore();
      texture.update();
      updates++;
    },
    stats: () => ({ updates, width: texture.getSize().width, height: texture.getSize().height }),
    dispose() {
      mesh.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}
