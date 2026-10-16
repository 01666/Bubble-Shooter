export const GOLD = '#e9c77c';
export const CYAN = '#9ceeff';
export const LABELS = Object.freeze({
  tickets: '彩票奖励',
  lightning: '连锁闪电',
  specials: '特殊泡泡',
  ammo: '赠送泡泡',
  dual: '双彩助攻',
  fullClear: '全屏消除',
});
export const REWARDS = Object.keys(LABELS);
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export function caption(c, value, x, y, size = 26, color = '#fff2c6') {
  c.font = `400 ${size}px ArcadeDisplay, "Microsoft YaHei", sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.lineJoin = 'round';
  c.lineWidth = Math.max(3, size / 8);
  c.strokeStyle = '#081d32';
  c.strokeText(value, x, y);
  c.fillStyle = color;
  c.fillText(value, x, y);
}
export function panel(c, x, y, w, h, radius = 20) {
  const bronze = c.createLinearGradient(x, y, x + w, y + h);
  bronze.addColorStop(0, '#ffe4a4');
  bronze.addColorStop(0.2, '#91703b');
  bronze.addColorStop(0.5, '#e3c078');
  bronze.addColorStop(0.8, '#574329');
  bronze.addColorStop(1, '#d8ad60');
  c.fillStyle = bronze;
  c.beginPath();
  c.roundRect(x, y, w, h, radius);
  c.fill();
  const inside = c.createLinearGradient(x, y, x, y + h);
  inside.addColorStop(0, '#183b55');
  inside.addColorStop(0.52, '#071b30');
  inside.addColorStop(1, '#20475b');
  c.fillStyle = inside;
  c.beginPath();
  c.roundRect(x + 5, y + 5, w - 10, h - 10, radius - 3);
  c.fill();
  c.strokeStyle = '#83ccd988';
  c.lineWidth = 1;
  c.beginPath();
  c.roundRect(x + 10, y + 10, w - 20, h - 20, radius - 6);
  c.stroke();
  for (const px of [x + 17, x + w - 17])
    for (const py of [y + 17, y + h - 17]) {
      c.fillStyle = GOLD;
      c.beginPath();
      c.arc(px, py, 3, 0, Math.PI * 2);
      c.fill();
    }
}
export function icon(c, type, x, y, radius = 34, time = 0) {
  c.save();
  c.translate(x, y);
  c.scale(radius / 34, radius / 34);
  c.lineWidth = 3;
  c.strokeStyle = GOLD;
  c.fillStyle = '#16465b';
  c.shadowColor = type === 'lightning' ? CYAN : GOLD;
  c.shadowBlur = 9;
  if (type === 'tickets') {
    c.rotate(-0.15);
    c.fillStyle = '#ebc879';
    c.beginPath();
    c.roundRect(-27, -17, 54, 34, 5);
    c.fill();
    c.strokeStyle = '#6e4a22';
    c.stroke();
    c.setLineDash([3, 3]);
    c.beginPath();
    c.moveTo(13, -14);
    c.lineTo(13, 14);
    c.stroke();
    c.setLineDash([]);
    c.strokeStyle = '#fff4ce';
    c.beginPath();
    c.moveTo(-18, -5);
    c.lineTo(4, -5);
    c.moveTo(-18, 5);
    c.lineTo(4, 5);
    c.stroke();
  } else if (type === 'lightning') {
    c.fillStyle = '#d9faff';
    c.strokeStyle = '#4ad3ff';
    c.beginPath();
    c.moveTo(7, -30);
    c.lineTo(-23, 5);
    c.lineTo(-3, 5);
    c.lineTo(-8, 30);
    c.lineTo(24, -7);
    c.lineTo(5, -7);
    c.closePath();
    c.fill();
    c.stroke();
  } else if (type === 'specials') {
    const g = c.createRadialGradient(-9, -10, 1, 0, 0, 28);
    g.addColorStop(0, '#ffee9e');
    g.addColorStop(0.35, '#fb9c31');
    g.addColorStop(1, '#742e15');
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 3, 25, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.strokeStyle = '#fff4b6';
    c.beginPath();
    c.moveTo(1, -19);
    c.quadraticCurveTo(4, -32, 17, -25);
    c.stroke();
    c.beginPath();
    c.arc(18, -25, 4, 0, Math.PI * 2);
    c.fill();
  } else if (type === 'ammo' || type === 'dual') {
    const colors = type === 'dual' ? ['#4ad6ff', '#dc86ff'] : ['#71eaff', '#62aaff'];
    for (let i = 0; i < 2; i++) {
      const px = i ? 12 : -12,
        py = i ? 8 : -7;
      const g = c.createRadialGradient(px - 6, py - 6, 1, px, py, 21);
      g.addColorStop(0, '#f7ffff');
      g.addColorStop(0.22, colors[i]);
      g.addColorStop(1, '#103e6b');
      c.fillStyle = g;
      c.beginPath();
      c.arc(px, py, 21, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    }
  } else {
    c.fillStyle = '#fff2b1';
    c.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 6,
        r = i % 2 ? 10 : 32;
      const px = Math.cos(a) * r,
        py = Math.sin(a) * r;
      if (i) c.lineTo(px, py);
      else c.moveTo(px, py);
    }
    c.closePath();
    c.fill();
    c.stroke();
    c.strokeStyle = CYAN;
    c.beginPath();
    c.arc(0, 0, 36, time * 0.5, time * 0.5 + 4);
    c.stroke();
  }
  c.restore();
}
