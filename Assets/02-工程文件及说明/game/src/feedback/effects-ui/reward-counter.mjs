// Presentation balance: credits land one at a time; confirmed debits follow them.
// The authoritative ledger and dispenser continue independently.
export class RewardCounter {
  observe(tickets, clock) {
    if (this.earned === undefined) {
      this.earned = tickets.earned;
      this.confirmed = tickets.confirmed;
      this.value = tickets.pending;
      this.waiting = this.debits = 0;
      this.nextDebit = clock;
      return;
    }
    this.waiting += Math.max(0, tickets.earned - this.earned);
    this.debits += Math.max(0, tickets.confirmed - this.confirmed);
    this.earned = tickets.earned;
    this.confirmed = tickets.confirmed;
    if (!this.waiting && this.debits && clock >= this.nextDebit) {
      this.value = Math.max(0, this.value - 1);
      this.debits--;
      this.nextDebit = clock + 0.075;
    }
  }
  arrive(clock) {
    if (!this.waiting) return;
    this.waiting--;
    this.value++;
    this.nextDebit = clock + 0.3;
  }
}
