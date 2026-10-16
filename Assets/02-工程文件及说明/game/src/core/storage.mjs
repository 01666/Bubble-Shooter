// A store must save the entire machine snapshot atomically or throw without replacing it.
export class MemoryStore {
  constructor(initial = null) {
    this.value = structuredClone(initial);
    this.durable = false;
  }
  load() {
    return structuredClone(this.value);
  }
  save(value) {
    this.value = structuredClone(value);
  }
}
// Caller supplies browser Storage. Not a production power-loss guarantee.
export class BrowserJsonStore {
  constructor(storage, key = 'bubble-endless-prototype-v1') {
    this.storage = storage;
    this.key = key;
    this.durable = 'browser-best-effort';
  }
  load() {
    const raw = this.storage.getItem(this.key);
    return raw === null ? null : JSON.parse(raw);
  }
  save(value) {
    this.storage.setItem(this.key, JSON.stringify(value));
  }
}
