// Embedded jewels follow the host orb's center and scale, rather than flat glyph stamps.
export function specialOrb(c, p, kind, { time = 0, radius = 40, reduced = false } = {}) {
  c.save();
  c.translate(p.x, p.y);
  c.scale(radius / 40, radius / 40);
  const gold = kind === 'target',
    electric = kind === 'conductor';
  const tint = electric ? '#72ebff' : gold ? '#ffdc60' : '#ffaf53';
  const clock = reduced ? 0 : time,
    phase = (p.x + p.y) * 0.019;
  const pulse = 0.5 + 0.5 * Math.sin(clock * 2.8 + phase);
  const aura = c.createRadialGradient(0, 0, 12, 0, 0, 38);
  aura.addColorStop(0, electric ? '#71ebff45' : '#ffbd6045');
  aura.addColorStop(1, 'transparent');
  c.fillStyle = aura;
  c.beginPath();
  c.arc(0, 0, 38, 0, Math.PI * 2);
  c.fill();
  const glass = c.createRadialGradient(-7, -10, 1, 0, 0, 25);
  glass.addColorStop(0, '#ffffff45');
  glass.addColorStop(0.5, '#10244818');
  glass.addColorStop(1, '#071527a0');
  c.fillStyle = glass;
  c.beginPath();
  c.arc(0, 0, 25, 0, Math.PI * 2);
  c.fill();
  c.shadowColor = tint;
  c.shadowBlur = reduced ? 8 : 10 + 8 * pulse;
  const count = gold ? 10 : electric ? 4 : 8;
  const points = Array.from({ length: count }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / count;
    const r = gold && i % 2 ? 9 : electric ? 20 : 18;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
  });
  for (let i = 0; i < count; i++) {
    const a = points[i],
      b = points[(i + 1) % count];
    c.fillStyle = i < count / 2 ? tint : electric ? '#207ab0' : '#bd671d';
    c.beginPath();
    c.moveTo(-3, -4);
    c.lineTo(a.x, a.y);
    c.lineTo(b.x, b.y);
    c.closePath();
    c.fill();
    c.fillStyle = `rgba(255,255,240,${0.06 + 0.22 * Math.max(0, Math.sin(clock * 2 + phase - i * 0.7))})`;
    c.fill();
  }
  c.shadowBlur = 0;
  c.strokeStyle = '#fff6d8';
  c.lineWidth = 1.3;
  c.beginPath();
  points.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
  c.closePath();
  c.stroke();
  if (electric) {
    c.strokeStyle = '#eaffff';
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(3, -12);
    c.lineTo(-6, 1);
    c.lineTo(5, -1);
    c.lineTo(-3, 12);
    c.stroke();
  } else if (!gold) {
    c.fillStyle = '#fff0b5';
    c.beginPath();
    c.arc(-3, -4, 5, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#ffc166';
    c.lineWidth = 1.6;
    for (let i = 0; i < 2; i++) {
      c.beginPath();
      c.ellipse(0, 0, 25, 10, (reduced ? 0 : time * 0.6) + (i * Math.PI) / 2, 0, Math.PI * 2);
      c.stroke();
    }
  }
  c.strokeStyle = tint;
  c.lineWidth = 2.8;
  const turn = clock * 1.8 + phase;
  c.beginPath();
  c.arc(0, 0, 32, turn, turn + 1.4);
  c.stroke();
  c.fillStyle = '#fff6d1';
  c.shadowColor = tint;
  c.shadowBlur = reduced ? 0 : 12;
  c.beginPath();
  c.arc(Math.cos(turn + 1.4) * 32, Math.sin(turn + 1.4) * 32, 3.8, 0, Math.PI * 2);
  c.fill();
  c.shadowBlur = 0;
  c.strokeStyle = '#ffffffc0';
  c.beginPath();
  c.arc(-1, -1, 23, 3.7, 4.6);
  c.stroke();
  c.restore();
}
