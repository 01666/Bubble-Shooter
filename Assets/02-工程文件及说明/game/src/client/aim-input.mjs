// Presentation input only; never changes collision or rewards.
export class AimInput {
  constructor() {
    this.direction = 0;
    this.held = 0;
  }
  step(dt, digital = 0, axis = 0, fine = false) {
    const d = Math.sign(digital);
    if (d !== this.direction) {
      this.direction = d;
      this.held = 0;
    }
    if (d) this.held += dt;
    else this.held = 0;
    const speed = fine ? 0.16 : 0.26 + 0.48 * Math.min(1, Math.max(0, (this.held - 0.18) / 0.42));
    const a = Math.abs(axis),
      analog =
        a <= 0.16
          ? 0
          : Math.sign(axis) * Math.min(1, (a - 0.16) / 0.84) ** 1.7 * (fine ? 0.16 : 0.74);
    return dt * Math.max(-0.74, Math.min(0.74, d * speed + analog));
  }
  reset() {
    this.direction = 0;
    this.held = 0;
  }
}
