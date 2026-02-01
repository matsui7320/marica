import * as THREE from 'three';

export class ScreenShake {
  intensity = 0;
  private decay = 8;

  trigger(amount: number): void {
    this.intensity = Math.max(this.intensity, amount);
  }

  update(dt: number, camera?: THREE.Camera): number {
    if (this.intensity > 0.001) {
      this.intensity *= Math.exp(-this.decay * dt);

      // Apply shake to camera if provided
      if (camera) {
        const shakeX = (Math.random() - 0.5) * this.intensity * 0.5;
        const shakeY = (Math.random() - 0.5) * this.intensity * 0.5;
        camera.position.x += shakeX;
        camera.position.y += shakeY;
      }

      return this.intensity;
    }
    this.intensity = 0;
    return 0;
  }
}
