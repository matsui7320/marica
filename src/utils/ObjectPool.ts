export class ObjectPool<T> {
  private pool: T[] = [];
  private active: T[] = [];
  private factory: () => T;
  private reset: (obj: T) => void;

  constructor(factory: () => T, reset: (obj: T) => void, initialSize: number) {
    this.factory = factory;
    this.reset = reset;
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(factory());
    }
  }

  acquire(): T {
    const obj = this.pool.pop() ?? this.factory();
    this.active.push(obj);
    return obj;
  }

  release(obj: T): void {
    const idx = this.active.indexOf(obj);
    if (idx !== -1) {
      this.active.splice(idx, 1);
      this.reset(obj);
      this.pool.push(obj);
    }
  }

  releaseAll(): void {
    for (const obj of this.active) {
      this.reset(obj);
      this.pool.push(obj);
    }
    this.active.length = 0;
  }

  getActive(): readonly T[] {
    return this.active;
  }

  get activeCount(): number {
    return this.active.length;
  }
}
