import * as THREE from 'three';
import { ParticlePool } from './ParticlePool';
import { DUST_LIFETIME } from '../constants';
import { randomRange } from '../utils/math';

const dustColor = new THREE.Color(0x8B7355);

export class DustTrail {
  private timer = 0;
  private emitRate = 0.04;

  update(
    pool: ParticlePool,
    position: THREE.Vector3,
    forward: THREE.Vector3,
    speed: number,
    isDrifting: boolean,
    isOffroad: boolean,
    dt: number,
  ): void {
    if (speed < 5 && !isDrifting) return;

    const rate = isDrifting ? this.emitRate * 0.5 : (isOffroad ? this.emitRate * 0.3 : this.emitRate);
    this.timer += dt;

    while (this.timer >= rate) {
      this.timer -= rate;

      const emitPos = position.clone().add(forward.clone().multiplyScalar(1));
      emitPos.y += 0.1;
      emitPos.x += randomRange(-0.5, 0.5);
      emitPos.z += randomRange(-0.5, 0.5);

      const vel = new THREE.Vector3(
        randomRange(-1, 1),
        randomRange(0.5, 2),
        randomRange(-1, 1),
      );

      const color = isOffroad ? dustColor : new THREE.Color(0x999999);
      pool.emit(emitPos, vel, color, randomRange(0.2, 0.5), DUST_LIFETIME);
    }
  }

  reset(): void {
    this.timer = 0;
  }
}
