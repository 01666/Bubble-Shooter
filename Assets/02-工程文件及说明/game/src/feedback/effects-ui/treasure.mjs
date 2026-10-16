// Code-native blue/gold treasure art; presentation only, no random draws or rewards.
export const starSlot = (i, open = 0) => ({ x: 720 + i * 35, y: 1430 - open * 11.25 });
export function drawStar(c, x, y, radius, lit = true) {
  c.save();
  c.translate(x, y);
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5,
      r = i % 2 ? radius * 0.46 : radius;
    c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  c.closePath();
  const gold = c.createLinearGradient(0, -radius, 0, radius);
  gold.addColorStop(0, lit ? '#fff9ca' : '#547590');
  gold.addColorStop(0.5, lit ? '#ffcf55' : '#29495e');
  gold.addColorStop(1, lit ? '#c47a20' : '#152e45');
  c.fillStyle = gold;
  c.strokeStyle = lit ? '#fff0a8' : '#678599';
  c.lineWidth = 2;
  c.shadowColor = '#ffcc55';
  c.shadowBlur = lit ? 8 : 0;
  c.fill();
  c.stroke();
  c.restore();
}
export function drawChest(c, { progress, open = 0, time = 0, reduced = false }) {
  c.save();
  c.translate(755, 1455);
  c.fillStyle = '#020e27aa';
  c.beginPath();
  c.ellipse(0, 57, 79, 14, 0, 0, Math.PI * 2);
  c.fill();
  if (progress >= 2 || open > 0) {
    const glow = c.createRadialGradient(0, -8, 8, 0, -8, 100);
    glow.addColorStop(
      0,
      `rgba(255,211,96,${open ? 0.65 : reduced ? 0.22 : 0.24 + Math.sin(time * 3) * 0.06})`,
    );
    glow.addColorStop(1, 'transparent');
    c.fillStyle = glow;
    c.fillRect(-100, -108, 200, 200);
  }
  // Side face gives the small chest depth without covering the cannon.
  c.fillStyle = '#855323';
  c.strokeStyle = '#ffd780';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(60, -6);
  c.lineTo(76, -21);
  c.lineTo(76, 37);
  c.lineTo(60, 52);
  c.closePath();
  c.fill();
  c.stroke();
  const body = c.createLinearGradient(0, -6, 0, 52);
  body.addColorStop(0, '#3b83bd');
  body.addColorStop(0.3, '#163f78');
  body.addColorStop(1, '#07152f');
  c.fillStyle = body;
  c.beginPath();
  c.roundRect(-70, -6, 130, 58, 8);
  c.fill();
  c.stroke();
  c.fillStyle = '#d29b45';
  c.fillRect(-57, -6, 10, 57);
  c.fillRect(37, -6, 10, 57);
  c.strokeStyle = '#e6b85b';
  c.lineWidth = 4;
  c.strokeRect(-63, 1, 116, 43);
  if (open > 0) {
    c.fillStyle = '#ffe596';
    c.beginPath();
    c.ellipse(-5, -8, 60, 12, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.save();
  c.translate(0, -open * 20);
  c.scale(1, 1 - open * 0.35);
  const lid = c.createLinearGradient(0, -50, 0, -6);
  lid.addColorStop(0, '#f6d47e');
  lid.addColorStop(0.24, '#386b91');
  lid.addColorStop(1, '#102a49');
  c.fillStyle = lid;
  c.beginPath();
  c.roundRect(-70, -50, 130, 44, [24, 24, 4, 4]);
  c.fill();
  c.stroke();
  c.fillStyle = '#e6b85b';
  c.fillRect(-57, -44, 10, 37);
  c.fillRect(37, -44, 10, 37);
  c.strokeStyle = '#ffedba';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(-56, -37);
  c.quadraticCurveTo(-5, -57, 48, -37);
  c.stroke();
  c.restore();
  c.fillStyle = '#ffd677';
  c.beginPath();
  c.roundRect(-17, -10, 26, 30, 5);
  c.fill();
  c.fillStyle = '#3b270d';
  c.beginPath();
  c.arc(-4, 1, 4, 0, Math.PI * 2);
  c.fill();
  c.fillRect(-6, 2, 4, 8);
  c.restore();
  for (let i = 0; i < 3; i++) {
    const q = starSlot(i, open);
    c.save();
    c.fillStyle = '#061a35ee';
    c.strokeStyle = i < progress ? '#edc467' : '#6b89a3';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(q.x, q.y, 12, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.restore();
    drawStar(c, q.x, q.y, 9, i < progress);
  }
}
