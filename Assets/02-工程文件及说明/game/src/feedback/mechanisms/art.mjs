// Original canvas art; reuses the approved orb atlas and blue/gold machine palette.
import { specialOrb } from '../orbs/special-orbs.mjs';
export const COLORS = ['#ef2554', '#228bff', '#31df96', '#ffc733', '#aa61f7'];
const BOXES = [
  [63, 79, 459, 465],
  [568, 79, 969, 466],
  [1079, 80, 1476, 466],
  [63, 555, 459, 942],
  [568, 555, 969, 943],
];
export const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
export const validColor = (c) => Number.isInteger(c) && c >= 0 && c < COLORS.length;
export const validPoint = (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y);
export function text(c, label, x, y, size = 22, color = '#ffe8a5') {
  c.fillStyle = color;
  c.font = `400 ${size}px ArcadeDisplay, sans-serif`;
  c.textAlign = 'center';
  c.fillText(label, x, y);
}
export function ring(c, p, r, color, width = 2) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  c.arc(p.x, p.y, r, 0, Math.PI * 2);
  c.stroke();
}
function half(c, color, p, radius, atlas) {
  if (atlas?.complete && atlas.naturalWidth) {
    const b = BOXES[color];
    c.drawImage(
      atlas,
      b[0],
      b[1],
      b[2] - b[0],
      b[3] - b[1],
      p.x - radius,
      p.y - radius,
      radius * 2,
      radius * 2,
    );
  } else {
    const g = c.createRadialGradient(p.x - radius * 0.3, p.y - radius * 0.4, 2, p.x, p.y, radius);
    g.addColorStop(0, '#fff8ed');
    g.addColorStop(0.18, COLORS[color]);
    g.addColorStop(1, '#081b3b');
    c.fillStyle = g;
    c.beginPath();
    c.arc(p.x, p.y, radius, 0, Math.PI * 2);
    c.fill();
  }
}
export function singleOrb(c, p, color, radius = 40, atlas) {
  if (!validPoint(p) || !validColor(color)) return;
  half(c, color, p, radius, atlas);
}
export function dualOrb(c, p, colors, radius = 40, atlas) {
  if (
    !validPoint(p) ||
    colors?.length !== 2 ||
    !colors.every(validColor) ||
    colors[0] === colors[1]
  )
    return false;
  c.save();
  c.beginPath();
  c.arc(p.x, p.y, radius, 0, Math.PI * 2);
  c.clip();
  half(c, colors[0], p, radius, atlas);
  c.save();
  c.beginPath();
  c.moveTo(p.x, p.y - radius);
  c.lineTo(p.x + radius, p.y - radius);
  c.lineTo(p.x + radius, p.y + radius);
  c.lineTo(p.x, p.y + radius);
  c.closePath();
  c.clip();
  half(c, colors[1], p, radius, atlas);
  c.restore();
  c.strokeStyle = '#ffeeb8';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(p.x, p.y - radius * 0.9);
  c.lineTo(p.x, p.y + radius * 0.9);
  c.stroke();
  c.restore();
  ring(c, p, radius * 0.97, '#e6c679', 2);
  return true;
}
export function nodeRune(c, p, r = 40, time = 0) {
  specialOrb(c, p, 'conductor', { radius: r, time });
}
export function wire(c, a, b, { active = 0, progress = 1, reduced = false } = {}) {
  if (!validPoint(a) || !validPoint(b)) return;
  const dx = b.x - a.x,
    dy = b.y - a.y,
    len = Math.hypot(dx, dy);
  if (len < 1) return;
  const inset = active ? 0 : Math.min(30, len * 0.3),
    s = { x: a.x + (dx / len) * inset, y: a.y + (dy / len) * inset },
    t = { x: b.x - (dx / len) * inset, y: b.y - (dy / len) * inset };
  c.save();
  c.strokeStyle = active ? '#7cdeff' : '#93bdce66';
  c.lineWidth = active ? 13 : 1.7;
  c.shadowColor = '#5accff';
  c.shadowBlur = active && !reduced ? 38 : 0;
  c.beginPath();
  const n = active && !reduced ? 9 : 1;
  for (let i = 0; i <= n; i++) {
    const k = (i / n) * clamp(progress),
      j = active && !reduced && i > 0 && i < n ? Math.sin(i * 2.4 + progress * 11) * 11 : 0;
    const x = s.x + (t.x - s.x) * k - (dy / len) * j,
      y = s.y + (t.y - s.y) * k + (dx / len) * j;
    if (i === 0) c.moveTo(x, y);
    else c.lineTo(x, y);
  }
  c.stroke();
  if (active) {
    c.strokeStyle = '#ecfcff';
    c.lineWidth = 2.5;
    c.stroke();
  }
  c.restore();
}
