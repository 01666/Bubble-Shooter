export const PET_SLOT_LAYOUT = Object.freeze({
  pet: { x: 107, y: 1510, scale: 0.65 },
  machine: { x: 172, y: 1353, width: 146, height: 159 },
  leverPivot: { x: 175, y: 1450 },
});
export function petLeverPoint(elapsed = 0, reduced = false) {
  const pull = reduced ? 0 : Math.sin(Math.min(1, Math.max(0, elapsed / 0.55)) * Math.PI);
  return { x: 151, y: 1454 + 18 * pull };
}
