// Arcade prize typography and radial energy. Presentation only; no lottery or accounting.
export function drawPrizeBurst(
  c,
  {
    title,
    detail = '',
    age = 0,
    life = 1.8,
    reduced = false,
    color = '#ffc947',
    x = 450,
    y = 1030,
    size = 64,
    intensity = 1,
  } = {},
) {
  const k = Math.max(0, Math.min(1, age / life));
  const fade = Math.max(0, Math.min(1, (life - age) / 0.3));
  const entry = Math.min(1, age / 0.16);
  const scale = reduced ? 1 : 0.68 + 0.32 * entry + Math.sin(entry * Math.PI) * 0.2;
  c.save();
  c.translate(x, y);
  c.globalAlpha = fade;
  if (!reduced) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    const glow = c.createRadialGradient(0, 0, 15, 0, 0, 340);
    glow.addColorStop(0, '#ffdf8455');
    glow.addColorStop(1, '#ffad0000');
    c.fillStyle = glow;
    c.fillRect(-340, -300, 680, 600);
    for (let i = 0; i < 18; i++) {
      const a = (i * Math.PI) / 9 + age * 0.18,
        r = 95 + k * 180;
      c.globalAlpha = fade * (0.14 + 0.13 * Math.sin(i + 1) ** 2);
      c.fillStyle = i % 3 ? color : '#c9ffff';
      c.beginPath();
      c.moveTo(Math.cos(a) * 25, Math.sin(a) * 25);
      c.lineTo(
        Math.cos(a - 0.038) * (r + 85 * intensity),
        Math.sin(a - 0.038) * (r + 85 * intensity),
      );
      c.lineTo(
        Math.cos(a + 0.038) * (r + 85 * intensity),
        Math.sin(a + 0.038) * (r + 85 * intensity),
      );
      c.closePath();
      c.fill();
    }
    c.globalAlpha = fade * 0.8;
    for (let i = 0; i < Math.round(28 * intensity); i++) {
      const a = i * 2.39996,
        r = 60 + ((i * 37) % 160) + k * 140;
      const px = Math.cos(a) * r,
        py = Math.sin(a) * r * 0.55 + k * k * 55;
      c.save();
      c.translate(px, py);
      c.rotate(a + age * 2);
      c.fillStyle = i % 2 ? '#ffe899' : '#84f6ff';
      c.fillRect(-3, -8, 6, 16);
      c.restore();
    }
    c.restore();
  }
  c.globalAlpha = fade;
  c.scale(scale, scale);
  c.rotate(reduced ? 0 : -0.035);
  c.font = `400 ${size}px ArcadeDisplay, "Microsoft YaHei", sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.lineJoin = 'round';
  const width = c.measureText(title || '').width;
  if (width > 710) c.scale(710 / width, 1);
  c.lineWidth = 15;
  c.strokeStyle = '#04152d';
  c.strokeText(title, 0, 6);
  c.lineWidth = 8;
  c.strokeStyle = '#975312';
  c.strokeText(title, 0, 0);
  c.lineWidth = 3;
  c.strokeStyle = '#fff0a5';
  c.strokeText(title, 0, 0);
  const gold = c.createLinearGradient(0, -size / 2, 0, size / 2);
  gold.addColorStop(0, '#fffde2');
  gold.addColorStop(0.42, color);
  gold.addColorStop(0.52, '#fff2be');
  gold.addColorStop(1, '#e99417');
  c.fillStyle = gold;
  c.shadowColor = color;
  c.shadowBlur = reduced ? 0 : 18;
  c.fillText(title, 0, 0);
  c.shadowBlur = 0;
  if (detail) {
    c.font = '400 26px ArcadeDisplay, "Microsoft YaHei", sans-serif';
    c.lineWidth = 6;
    c.strokeStyle = '#061731';
    c.strokeText(detail, 0, size * 0.75);
    c.fillStyle = '#dcfaff';
    c.fillText(detail, 0, size * 0.75);
  }
  c.restore();
}
