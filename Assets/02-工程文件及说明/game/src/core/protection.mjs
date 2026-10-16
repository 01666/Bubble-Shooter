export function protectedPathIds(g, s) {
  const recent = s.board.filter((b) => b.source === 'player' && b.bornShot > s.paidShots - 6),
    byCell = new Map(s.board.map((b) => [`${b.r},${b.c}`, b])),
    keep = new Set();
  for (const start of recent) {
    const q = [start],
      parents = new Map([[start.id, null]]);
    let top = null;
    while (q.length) {
      const b = q.shift();
      if (b.r === 0) {
        top = b;
        break;
      }
      for (const [r, c] of g.neighbors(b.r, b.c, s.parity)) {
        const n = byCell.get(`${r},${c}`);
        if (n && !parents.has(n.id)) {
          parents.set(n.id, b);
          q.push(n);
        }
      }
    }
    keep.add(start.id);
    while (top) {
      keep.add(top.id);
      top = parents.get(top.id);
    }
  }
  return keep;
}
