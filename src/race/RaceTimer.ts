export class RaceTimer {
  elapsed = 0;
  running = false;

  start(): void {
    this.elapsed = 0;
    this.running = true;
  }

  update(dt: number): void {
    if (this.running) {
      this.elapsed += dt;
    }
  }

  stop(): void {
    this.running = false;
  }

  reset(): void {
    this.elapsed = 0;
    this.running = false;
  }
}
