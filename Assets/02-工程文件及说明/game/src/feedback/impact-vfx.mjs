// Layered energy, bounded geometry and continuous envelopes; no frame-random flicker.
export function blastLayers(c, p, age, { reduced = false, primary = true } = {}) {
  if (age < 0 || age > 1.05) return;
  const k = age / 1.05,
    fade = (1 - k) ** 2,
    reach = (primary ? 370 : 210) * (1 - (1 - k) ** 3);
  c.save();
  c.globalCompositeOperation = 'lighter';
  const glow = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, Math.max(1, reach));
  glow.addColorStop(0, `rgba(255,242,204,${fade * 0.62})`);
  glow.addColorStop(0.15, `rgba(255,183,56,${fade * 0.44})`);
  glow.addColorStop(0.48, `rgba(255,112,23,${fade * 0.17})`);
  glow.addColorStop(1, 'transparent');
  c.fillStyle = glow;
  c.fillRect(p.x - reach, p.y - reach, reach * 2, reach * 2);
  for (let layer = 0; layer < (reduced ? 1 : 3); layer++) {
    c.strokeStyle = layer === 1 ? '#98ddff' : '#ffe5a4';
    c.globalAlpha = fade * (layer === 0 ? 0.9 : 0.45);
    c.lineWidth = (layer === 0 ? 12 : 4) * (1 - k) + 1;
    c.shadowColor = '#ffae44';
    c.shadowBlur = reduced ? 0 : 20;
    c.beginPath();
    c.ellipse(
      p.x,
      p.y,
      Math.max(1, reach * (1 - layer * 0.13)),
      Math.max(1, reach * (layer === 2 ? 0.38 : 1 - layer * 0.13)),
      0,
      0,
      Math.PI * 2,
    );
    c.stroke();
  }
  if (!reduced)
    for (let j = 0; j < (primary ? 28 : 12); j++) {
      const a = j * 2.39996,
        speed = 0.6 + (j % 7) / 9,
        dist = 35 + reach * speed;
      const x = p.x + Math.cos(a) * dist,
        y = p.y + Math.sin(a) * dist + 75 * k * k;
      c.globalAlpha = fade * (j % 3 ? 0.8 : 0.55);
      c.strokeStyle = j % 3 ? '#fff1bd' : '#ff9442';
      c.lineWidth = 2 + (j % 4);
      c.beginPath();
      c.moveTo(x - Math.cos(a) * (18 + 25 * k), y - Math.sin(a) * (18 + 25 * k));
      c.lineTo(x, y);
      c.stroke();
      if (j % 4 === 0) {
        c.beginPath();
        c.arc(x, y, 2 + 3 * fade, 0, Math.PI * 2);
        c.fillStyle = '#fff2c8';
        c.fill();
      }
    }
  if (!reduced && age < 0.32) {
    c.globalAlpha = (1 - age / 0.32) * 0.65;
    c.fillStyle = '#fff2c9';
    c.fillRect(p.x - reach, p.y - 2, reach * 2, 4);
  }
  c.restore();
}
