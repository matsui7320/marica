import * as THREE from 'three';
import { ParticlePool } from './ParticlePool';
import { randomRange } from '../utils/math';

const burstWhite = new THREE.Color(0xffffff);
const burstYellow = new THREE.Color(0xffdd44);
const burstOrange = new THREE.Color(0xff8800);

export class MushroomBurst {
  static emit(pool: ParticlePool, position: THREE.Vector3, forward: THREE.Vector3): void {
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), forward).normalize();

    // Radial burst of speed particles
    for (let i = 0; i < 30; i++) {
      const angle = (i / 30) * Math.PI * 2;
      const r = randomRange(0.5, 2);
      const pos = position.clone();
      pos.y += randomRange(0.3, 1.5);

      const vel = new THREE.Vector3(
        Math.cos(angle) * r + forward.x * randomRange(2, 6),
        randomRange(0.5, 3),
        Math.sin(angle) * r + forward.z * randomRange(2, 6),
      );

      const rnd = Math.random();
      const color = rnd < 0.3 ? burstWhite : rnd < 0.7 ? burstYellow : burstOrange;
      pool.emit(pos, vel, color, randomRange(0.2, 0.5), randomRange(0.3, 0.6));
    }

    // Exhaust burst from behind
    for (let i = 0; i < 15; i++) {
      const pos = position.clone()
        .add(forward.clone().multiplyScalar(1.2))
        .add(right.clone().multiplyScalar(randomRange(-0.3, 0.3)));
      pos.y += randomRange(0.2, 0.6);

      const vel = forward.clone().multiplyScalar(randomRange(6, 14));
      vel.y += randomRange(0.5, 2);
      vel.x += randomRange(-1, 1);
      vel.z += randomRange(-1, 1);

      const rnd = Math.random();
      const color = rnd < 0.5 ? burstWhite : burstOrange;
      pool.emit(pos, vel, color, randomRange(0.3, 0.6), randomRange(0.2, 0.5));
    }
  }
}
