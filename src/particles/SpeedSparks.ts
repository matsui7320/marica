import * as THREE from 'three';
import { ParticlePool } from './ParticlePool';
import { SPARK_LIFETIME } from '../constants';
import { randomRange } from '../utils/math';

const sparkColor = new THREE.Color(0xffcc44);
const sparkColorBright = new THREE.Color(0xffffaa);
const sparkColorHot = new THREE.Color(0xff8822);

/**
 * Ground sparks emitted from the kart at speed.
 * Particles shoot toward the camera (behind the kart visually)
 * so the player sees them streaking past, giving a sense of speed.
 */
export class SpeedSparks {
  private timer = 0;

  update(
    pool: ParticlePool,
    position: THREE.Vector3,
    forward: THREE.Vector3,
    speed: number,
    isGrounded: boolean,
    dt: number,
  ): void {
    // Emit when moving at any reasonable speed and on the ground
    if (speed < 5 || !isGrounded) return;

    // Faster speed → more sparks (0..1 over speed 5..24)
    const intensity = Math.min((speed - 5) / 19, 1);
    // Fast emission: 0.025s at low, 0.005s at max speed
    const emitRate = 0.025 - intensity * 0.020;

    this.timer += dt;

    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), forward).normalize();

    while (this.timer >= emitRate) {
      this.timer -= emitRate;

      // Emit from kart's rear area (forward vector points toward camera/behind kart visually)
      const side = Math.random() > 0.5 ? 1 : -1;
      const emitPos = position.clone()
        .add(forward.clone().multiplyScalar(randomRange(0.8, 1.5)))
        .add(right.clone().multiplyScalar(side * randomRange(0.2, 0.7)));
      emitPos.y += 0.15;

      // Sparks fly in forward direction (toward camera) and outward with upward bounce
      const flySpeed = randomRange(2, 7) * (0.5 + intensity * 0.5);
      const vel = new THREE.Vector3();
      vel.addScaledVector(forward, flySpeed);
      // Outward spread
      vel.x += right.x * side * randomRange(0.5, 2.5);
      vel.z += right.z * side * randomRange(0.5, 2.5);
      // Upward bounce
      vel.y = randomRange(1.5, 4.5);

      const r = Math.random();
      const color = r < 0.3 ? sparkColorBright : r < 0.6 ? sparkColorHot : sparkColor;
      // Clearly visible size
      const size = 0.5 + intensity * 0.6 + randomRange(0, 0.3);

      pool.emit(emitPos, vel, color, size, SPARK_LIFETIME * (0.6 + intensity * 0.4));

      // At higher speed, extra streak sparks that shoot back fast (toward camera)
      if (intensity > 0.3 && Math.random() < intensity * 0.7) {
        const streakPos = position.clone()
          .add(forward.clone().multiplyScalar(randomRange(0.5, 1.2)))
          .add(right.clone().multiplyScalar(randomRange(-0.5, 0.5)));
        streakPos.y += 0.12;

        const streakVel = forward.clone().multiplyScalar(randomRange(6, 14));
        streakVel.y += randomRange(0.5, 2.0);
        streakVel.x += randomRange(-0.5, 0.5);
        streakVel.z += randomRange(-0.5, 0.5);

        pool.emit(streakPos, streakVel, sparkColorBright, 0.3 + randomRange(0, 0.3), SPARK_LIFETIME * 0.35);
      }
    }
  }

  reset(): void {
    this.timer = 0;
  }
}
