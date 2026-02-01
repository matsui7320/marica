import * as THREE from 'three';
import { ParticlePool } from './ParticlePool';
import { STAR_COLOR } from '../constants';
import { randomRange } from '../utils/math';

const starColor = new THREE.Color(STAR_COLOR);
const whiteColor = new THREE.Color(0xffffff);

export class StarSparkle {
  private timer = 0;

  update(pool: ParticlePool, position: THREE.Vector3, active: boolean, dt: number): void {
    if (!active) return;

    this.timer += dt;
    while (this.timer >= 0.03) {
      this.timer -= 0.03;

      const emitPos = position.clone();
      emitPos.x += randomRange(-1, 1);
      emitPos.y += randomRange(0, 2);
      emitPos.z += randomRange(-1, 1);

      const vel = new THREE.Vector3(
        randomRange(-3, 3),
        randomRange(1, 5),
        randomRange(-3, 3),
      );

      const color = Math.random() > 0.5 ? starColor : whiteColor;
      pool.emit(emitPos, vel, color, randomRange(0.2, 0.5), 0.5);
    }
  }

  reset(): void {
    this.timer = 0;
  }
}
