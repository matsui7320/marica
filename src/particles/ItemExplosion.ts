import * as THREE from 'three';
import { ParticlePool } from './ParticlePool';
import { randomRange } from '../utils/math';

const white = new THREE.Color(0xffffff);
const yellow = new THREE.Color(0xffdd44);

export class ItemExplosion {
  static emit(pool: ParticlePool, position: THREE.Vector3, color: number, count: number = 30): void {
    const mainColor = new THREE.Color(color);
    const brightColor = mainColor.clone().lerp(white, 0.5);
    const darkColor = mainColor.clone().multiplyScalar(0.6);

    // Main burst — spherical
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = randomRange(4, 12);

      const vel = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.cos(phi) * speed * 0.8 + 3,
        Math.sin(phi) * Math.sin(theta) * speed,
      );

      const r = Math.random();
      const c = r < 0.3 ? brightColor : r < 0.7 ? mainColor : darkColor;
      pool.emit(position.clone(), vel, c, randomRange(0.25, 0.6), randomRange(0.3, 0.7));
    }

    // Ring burst — horizontal ring of particles
    const ringCount = Math.floor(count * 0.5);
    for (let i = 0; i < ringCount; i++) {
      const angle = (i / ringCount) * Math.PI * 2;
      const speed = randomRange(6, 10);

      const vel = new THREE.Vector3(
        Math.cos(angle) * speed,
        randomRange(0.5, 2),
        Math.sin(angle) * speed,
      );

      pool.emit(
        position.clone(),
        vel,
        Math.random() > 0.5 ? yellow : brightColor,
        randomRange(0.15, 0.35),
        randomRange(0.2, 0.5),
      );
    }

    // Sparks — small fast particles
    for (let i = 0; i < 8; i++) {
      const vel = new THREE.Vector3(
        randomRange(-15, 15),
        randomRange(5, 15),
        randomRange(-15, 15),
      );
      pool.emit(position.clone(), vel, white, randomRange(0.08, 0.15), randomRange(0.15, 0.3));
    }
  }
}
