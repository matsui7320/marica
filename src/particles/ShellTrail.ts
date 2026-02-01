import * as THREE from 'three';
import { ParticlePool } from './ParticlePool';
import { randomRange } from '../utils/math';

const greenTrailColor = new THREE.Color(0x44ff88);
const greenTrailAlt = new THREE.Color(0x88ffaa);
const redTrailColor = new THREE.Color(0xff4444);
const redTrailAlt = new THREE.Color(0xff8866);
const redGlowColor = new THREE.Color(0xff2200);

export class ShellTrail {
  private timer = 0;

  emitGreen(pool: ParticlePool, position: THREE.Vector3): void {
    this.timer += 1 / 60;
    if (this.timer < 0.03) return;
    this.timer = 0;

    for (let i = 0; i < 2; i++) {
      const pos = position.clone();
      pos.x += randomRange(-0.2, 0.2);
      pos.y += randomRange(0.1, 0.4);
      pos.z += randomRange(-0.2, 0.2);

      const vel = new THREE.Vector3(
        randomRange(-0.5, 0.5),
        randomRange(0.3, 1.5),
        randomRange(-0.5, 0.5),
      );

      const color = Math.random() > 0.5 ? greenTrailColor : greenTrailAlt;
      pool.emit(pos, vel, color, randomRange(0.1, 0.25), 0.3);
    }
  }

  emitRed(pool: ParticlePool, position: THREE.Vector3): void {
    this.timer += 1 / 60;
    if (this.timer < 0.02) return;
    this.timer = 0;

    // Main trail
    for (let i = 0; i < 3; i++) {
      const pos = position.clone();
      pos.x += randomRange(-0.25, 0.25);
      pos.y += randomRange(0.1, 0.5);
      pos.z += randomRange(-0.25, 0.25);

      const vel = new THREE.Vector3(
        randomRange(-0.8, 0.8),
        randomRange(0.5, 2),
        randomRange(-0.8, 0.8),
      );

      const r = Math.random();
      const color = r < 0.4 ? redTrailColor : r < 0.7 ? redTrailAlt : redGlowColor;
      pool.emit(pos, vel, color, randomRange(0.12, 0.3), 0.35);
    }
  }

  reset(): void {
    this.timer = 0;
  }
}
