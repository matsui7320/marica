import { PHYSICS_DT, MAX_PHYSICS_STEPS } from '../constants';

export class Clock {
  private accumulator = 0;
  private lastTime = 0;
  private started = false;
  alpha = 0;

  tick(timeMs: number, physicsStep: (dt: number) => void): void {
    if (!this.started) {
      this.lastTime = timeMs;
      this.started = true;
      return;
    }

    let frameDt = (timeMs - this.lastTime) / 1000;
    this.lastTime = timeMs;

    // Clamp large frame gaps
    if (frameDt > 0.1) frameDt = 0.1;

    this.accumulator += frameDt;

    let steps = 0;
    while (this.accumulator >= PHYSICS_DT && steps < MAX_PHYSICS_STEPS) {
      physicsStep(PHYSICS_DT);
      this.accumulator -= PHYSICS_DT;
      steps++;
    }

    this.alpha = this.accumulator / PHYSICS_DT;
  }

  reset(): void {
    this.accumulator = 0;
    this.started = false;
    this.alpha = 0;
  }
}
