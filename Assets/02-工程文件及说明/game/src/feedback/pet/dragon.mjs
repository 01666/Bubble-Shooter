// Original code-native art. Coordinates relative to fixed ground, independent of scene.
const path = (c, d, fill, stroke = '#142d3e', width = 1.7) => {
  c.fillStyle = fill;
  c.strokeStyle = stroke;
  c.lineWidth = width;
  const p = new Path2D(d);
  c.fill(p);
  if (stroke) c.stroke(p);
};
const ellipse = (c, x, y, rx, ry, fill, stroke = null) => {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = 1.6;
    c.stroke();
  }
};
function grad(c, x, y, r, a, b) {
  const g = c.createRadialGradient(x - r * 0.32, y - r * 0.35, r * 0.06, x, y, r);
  const rgb = (hex) =>
    hex
      .slice(1)
      .match(/../g)
      .map((v) => parseInt(v, 16));
  const mix = (u, v, k) => 'rgb(' + u.map((n, i) => Math.round(n + (v[i] - n) * k)).join(',') + ')';
  const light = rgb(a),
    dark = rgb(b);
  g.addColorStop(0, a);
  g.addColorStop(0.28, mix(light, dark, 0.24));
  g.addColorStop(0.72, b);
  g.addColorStop(1, mix(dark, [8, 23, 34], 0.4));
  return g;
}
function wing(c, x, y, flip, angle) {
  c.save();
  c.translate(x, y);
  c.scale(flip, 1);
  c.rotate(angle);
  path(
    c,
    'M0 0 Q-38-49-78-27 Q-53-8-63 32 Q-32 15-22 54 Q-8 20 0 0Z',
    grad(c, -35, 0, 60, '#e5d1a8', '#886b45'),
  );
  path(c, 'M0 0 Q-38-49-78-27 M0 0 Q-47-14-63 32 M0 0 L-22 54', 'transparent', '#9e845b', 2.4);
  c.restore();
}
function arm(c, x, y, angle, far = false) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  path(
    c,
    'M-11-2 C-22 17-16 45 1 50 C18 57 29 41 24 31 C20 23 9 22 8 3 Q0-11-11-2Z',
    grad(c, 0, 20, 42, far ? '#5799ae' : '#82c4d5', '#204c63'),
  );
  for (let i = 0; i < 3; i++) ellipse(c, 13 + i * 5, 42 - i * 2, 3.3, 5.5, '#f8deb1');
  ellipse(c, -8, 9, 3, 4, '#cfaa58');
  c.restore();
}
export function drawDragon(c, pose = {}, { x = 142, y = 1510, scale = 0.68, debug = false } = {}) {
  const p = {
    head: 0,
    look: 0,
    nod: 0,
    breath: 0,
    left: 0,
    right: 0,
    wing: 0,
    tail: 0,
    eyes: 1,
    mouth: 0,
    hop: 0,
    step: 0,
    ...pose,
  };
  c.save();
  c.translate(x, y);
  c.scale(scale, scale);
  ellipse(c, 0, 5, 79, 12, '#00152366');
  ellipse(c, 0, 5, 82, 13, '#0b224188', '#d4b565');
  c.translate((p.step || 0) / scale, -(p.hop || 0) / scale);
  c.save();
  c.translate(-36, -44);
  c.rotate(p.tail);
  path(
    c,
    'M15 19 C-22 27-83 16-90-28 C-87-49-68-56-57-53 C-78-28-48-8-12-18Z',
    grad(c, -40, -12, 70, '#74afc5', '#183c53'),
  );
  path(c, 'M-85-32 L-89-49 L-75-42 M-63-11 L-66-26 L-49-15 M-33-5 L-30-20 L-17-7', '#d3be90');
  c.restore();
  wing(c, 28, -123, -1, -p.wing);
  wing(c, -30, -124, 1, p.wing);
  // One continuous chest/shoulder/neck silhouette, regenerated from the chin anchor.
  const hy = -196 + p.nod + p.breath,
    hx = 8 + p.look * 24;
  path(
    c,
    `M-35-23 C-62-42-55-101-42-127 C-36-145 ${hx - 28} ${hy + 39} ${hx - 26} ${hy + 22} Q${hx + 2} ${hy + 8} ${hx + 29} ${hy + 24} C${hx + 28} ${hy + 48} 42-143 49-114 C64-77 57-38 30-22 Q0-9-35-23Z`,
    grad(c, -8, -111, 120, '#87c9d5', '#25495f'),
  );
  path(
    c,
    `M-24-27 C-42-67-30-116-17-140 Q${hx - 12} ${hy + 43} ${hx + 17} ${hy + 31} C25-139 39-113 34-65 Q29-24-24-27Z`,
    grad(c, 3, -100, 100, '#efdfb9', '#997449'),
    '#cfaa58',
    1,
  );
  for (let i = 0; i < 4; i++) {
    c.beginPath();
    c.moveTo(-27 + i, -111 + i * 20);
    c.quadraticCurveTo(4, -102 + i * 20, 33 - i, -111 + i * 20);
    c.strokeStyle = '#b49d7966';
    c.lineWidth = 1.5;
    c.stroke();
  }
  for (const [sx, sy, r] of [
    [-38, -92, 4],
    [-41, -76, 3],
    [-33, -110, 3],
    [40, -87, 4],
    [44, -72, 3],
  ])
    ellipse(c, sx, sy, r, r * 1.3, '#234c9955');
  // Cool edge reflection from the room and warm local lantern bounce.
  path(c, 'M-43-49 C-53-79-46-111-32-136', 'transparent', '#9ce7eb88', 2.2);
  path(c, 'M43-104 Q57-65 29-30', 'transparent', '#dfb77270', 2.5);
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 3; col++) {
      const sx = -38 + col * 5,
        sy = -88 + row * 10;
      path(c, `M${sx - 2} ${sy} Q${sx} ${sy + 4} ${sx + 3} ${sy}`, 'transparent', '#a9d7d330', 0.9);
    }
  // Gold collar and sapphire star medallion tie the companion to the machine's trim.
  path(c, 'M-34-144 Q6-128 39-145 L42-133 Q5-112-36-133Z', '#e9ba5d', '#765227', 2);
  ellipse(c, 3, -119, 15, 17, grad(c, 0, -123, 21, '#b7edff', '#1653ad'), '#fff0b3');
  path(
    c,
    'M3-131 L6-123 L15-123 L8-117 L11-109 L3-114 L-5-109 L-2-117 L-9-123 L0-123Z',
    '#fff0b3',
    null,
  );
  arm(c, -40, -116, p.left, true);
  if (p.handleTarget) {
    const tx = (p.handleTarget.x - x - (p.step || 0)) / scale,
      ty = (p.handleTarget.y - y + (p.hop || 0)) / scale;
    const mx = (41 + tx) / 2,
      my = (-113 + ty) / 2 + 10;
    path(
      c,
      `M34 -116 Q${mx} ${my - 12} ${tx} ${ty - 11} Q${tx + 15} ${ty - 3} ${tx + 8} ${ty + 10} Q${tx - 4} ${ty + 17} ${tx - 12} ${ty + 6} Q${mx} ${my + 10} 35 -98Z`,
      grad(c, mx, my, 65, '#8bc7d3', '#244b61'),
    );
    for (let i = 0; i < 3; i++) ellipse(c, tx - 4 + i * 6, ty + 7, 3, 5, '#f8deb1');
  } else arm(c, 41, -113, p.right);
  // Feet always have identical contact coordinates, no whole-body scaling or root translation.
  for (const fx of [-28, 30]) {
    path(
      c,
      `M${fx - 17}-36 Q${fx - 29}-15 ${fx - 23}-5 Q${fx - 5}9 ${fx + 24}-3 C${fx + 33}-17 ${fx + 10}-25 ${fx + 14}-35Z`,
      grad(c, fx, -17, 37, '#86bdcc', '#24485c'),
    );
    for (let i = 0; i < 3; i++) ellipse(c, fx - 12 + i * 12, -3, 5.8, 8.2, '#f5dfb3', '#b1a682');
  }
  // Head turns around the neck at y+35. Broad chin covers the connected neck for all limits.
  c.save();
  c.translate(hx, hy + 35);
  c.rotate(p.head);
  c.translate(0, -35);
  path(c, 'M-39-20 C-63-44-73-33-74-18 L-48 4Z', '#c6b986');
  path(c, 'M32-32 C39-67 52-60 52-38 L48-16Z', '#f1ddb3');
  path(c, 'M-31-43 C-40-75-53-69-50-42Z', '#f2dfb5');
  path(c, 'M-47 12 Q-89-6-79 20 L-53 35Z', '#4c83c1');
  path(c, 'M-58 3 Q-79 3-71 18 L-57 21Z', '#e8c5a2');
  path(
    c,
    'M-50 31 C-72 5-57-48-22-59 C7-76 43-49 50-22 C76-19 83 4 71 27 C51 63-28 75-50 31Z',
    grad(c, -4, -9, 90, '#92cad3', '#325d72'),
  );
  path(c, 'M-14-57 L-15-75 L1-63 M8-60 L16-77 L26-56', '#e4b85f');
  path(c, 'M-39-38 Q-10-66 28-45 L25-37 Q-8-56-35-30Z', '#f3cf80', '#9a6c2f', 1.5);
  ellipse(c, -4, -48, 6, 8, '#80dfff', '#fff4c6');
  path(c, 'M-41-16 Q-46-35-26-43', 'transparent', '#d4f3ff99', 2);
  path(c, 'M46-12 Q69-5 60 23', 'transparent', '#e6bd8170', 2.5);
  const glint = c.createLinearGradient(-30, -55, 35, -25);
  glint.addColorStop(0, '#c2f4ef50');
  glint.addColorStop(1, '#c2f4ef00');
  ellipse(c, -12, -40, 23, 8, glint);
  // Soft cheek/continuous muzzle rather than neck slices.
  ellipse(c, 21, 28, 49, 31, grad(c, 14, 22, 55, '#f0dfc1', '#b18c5e'));
  const look = p.look * 15;
  for (const [ex, ey, rx] of [
    [-17, -13, 15],
    [35, -21, 12],
  ]) {
    c.save();
    c.translate(ex, ey);
    c.scale(1, Math.max(0.06, p.eyes));
    ellipse(c, 0, 0, rx, 22, '#ece8db', '#35575d');
    ellipse(c, 4 + look * 0.3, 2, rx * 0.68, 17, '#ac853a');
    ellipse(c, 5 + look * 0.3, 1, rx * 0.45, 15, '#101e25');
    ellipse(c, 1 + look * 0.3, -7, 3.6, 4.5, '#f0fcff');
    ellipse(c, 8 + look * 0.3, 6, 2, 2, '#fff0c9');
    c.restore();
  }
  path(c, 'M-33-36 Q-19-44-4-36 M23-43 Q34-48 44-39', 'transparent', '#3d6c73', 4);
  ellipse(c, -28, 27, 14, 8, '#b9876040');
  ellipse(c, 54, 13, 9, 6, '#b9876040');
  for (const [sx, sy, r] of [
    [-43, 13, 3],
    [-44, 23, 2],
    [-40, 32, 2],
    [-34, 9, 2],
  ])
    ellipse(c, sx, sy, r, r * 1.2, '#579fa066');
  ellipse(c, 48, 4, 3, 2, '#557d6b');
  ellipse(c, 21, 10, 3, 2, '#557d6b');
  if (p.mouth > 0.12) {
    path(
      c,
      `M5 31 Q30 43 55 25 Q50 ${44 + p.mouth * 13} 29 ${49 + p.mouth * 10} Q14 50 5 31Z`,
      '#432d30',
      '#789b88',
      1,
    );
    ellipse(c, 31, 48 + p.mouth * 5, 11, 4, '#ee927b');
    path(c, 'M12 34 L14 42 L18 36 M44 31 L43 39 L39 33', '#fff7df', null);
  } else path(c, 'M7 34 Q29 49 54 28', 'transparent', '#588274', 2);
  if (debug) {
    c.strokeStyle = '#ff56aa';
    c.lineWidth = 1;
    c.strokeRect(-31, 17, 63, 45);
  }
  c.restore();
  if (debug) {
    c.strokeStyle = '#76e8ff';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(-90, 5);
    c.lineTo(90, 5);
    c.stroke();
    ellipse(c, hx, hy + 35, 3, 3, '#ff56aa');
  }
  c.restore();
  return {
    mouth: { x: x + (p.step || 0) + (hx + 58) * scale, y: y - (p.hop || 0) + (hy + 26) * scale },
    feet: [
      { x: x - 28 * scale, y: y + 5 * scale },
      { x: x + 30 * scale, y: y + 5 * scale },
    ],
  };
}
export function drawBubble(c, bubble, mouth, { x = 219, y = 1282, width = 290 } = {}) {
  if (!bubble) return;
  c.save();
  c.strokeStyle = '#dfc782';
  c.lineWidth = 2;
  c.fillStyle = '#102c42f2';
  c.beginPath();
  c.roundRect(x, y, width, 57, 16);
  c.fill();
  c.stroke();
  path(
    c,
    `M${x + 22} ${y + 57} L${mouth.x} ${mouth.y - 7} L${x + 44} ${y + 57}`,
    '#102c42',
    '#dfc782',
    2,
  );
  c.font = '600 21px "Microsoft YaHei",sans-serif';
  c.fillStyle = '#fff1c9';
  c.textAlign = 'center';
  c.fillText(bubble.text, x + width / 2, y + 36);
  c.restore();
}
export function drawPetLayer(c, frame, options = {}) {
  c.clearRect(0, 0, c.canvas.width, c.canvas.height);
  const anchors = drawDragon(c, frame.pose, options);
  drawBubble(c, frame.bubble, anchors.mouth, options.bubble);
  return anchors;
}
