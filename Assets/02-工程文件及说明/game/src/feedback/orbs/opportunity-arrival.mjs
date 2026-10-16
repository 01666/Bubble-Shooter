// A birth/reveal effect, not an explosion and never a reward trigger.
export function drawOpportunityArrival(c, p, age, { reduced = false } = {}) {
  const life = 2.2;
  if (age < 0 || age >= life) return;
  const fade = Math.min(1, age / 0.09, (life - age) / 0.45);
  c.save();
  c.translate(p.x, p.y);
  c.globalCompositeOperation = 'lighter';
  const glow = c.createRadialGradient(0, 0, 25, 0, 0, reduced ? 60 : 95);
  glow.addColorStop(0, `rgba(255,214,108,${fade * 0.18})`);
  glow.addColorStop(0.48, `rgba(255,164,40,${fade * 0.42})`);
  glow.addColorStop(1, 'rgba(255,157,32,0)');
  c.fillStyle = glow;
  c.fillRect(-95, -95, 190, 190);
  if (!reduced) {
    for (let ring = 0; ring < 2; ring++) {
      const k = Math.max(0, Math.min(1, (age - ring * 0.14) / 0.75));
      if (!k || k >= 1) continue;
      c.globalAlpha = (1 - k) * fade;
      c.strokeStyle = ring ? '#82edff' : '#ffefaf';
      c.lineWidth = 5 * (1 - k) + 1;
      c.shadowColor = c.strokeStyle;
      c.shadowBlur = 14;
      c.beginPath();
      c.arc(0, 0, 36 + 66 * k, 0, Math.PI * 2);
      c.stroke();
    }
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4 + age * 0.65;
      const distance = age < 0.3 ? 84 - age * 115 : 47 + (age - 0.3) * 25;
      c.globalAlpha = fade * Math.max(0, 1 - age / 1.8);
      c.strokeStyle = i % 2 ? '#81e2ff' : '#ffdb80';
      c.lineWidth = 2.4;
      c.beginPath();
      c.moveTo(Math.cos(angle) * distance, Math.sin(angle) * distance);
      c.lineTo(Math.cos(angle) * (distance + 10), Math.sin(angle) * (distance + 10));
      c.stroke();
    }
  }
  c.shadowBlur = reduced ? 0 : 13;
  c.shadowColor = '#fabb50';
  c.globalAlpha = fade * 0.8;
  c.strokeStyle = '#ffe5a0';
  c.lineWidth = reduced ? 2 : 3;
  c.beginPath();
  c.arc(0, 0, 45, 0, Math.PI * 2);
  c.stroke();
  // Four moving brackets keep each new target legible after the initial pulse.
  for (let i = 0; i < 4; i++) {
    const start = (i * Math.PI) / 2 + (reduced ? 0 : age * 0.3);
    c.beginPath();
    c.arc(0, 0, 52, start, start + 0.35);
    c.stroke();
  }
  c.restore();
}
