import * as THREE from 'three';
import { ParticlePool } from './ParticlePool';
import { BOOST_FLAME_COLOR, FLAME_LIFETIME } from '../constants';
import { randomRange } from '../utils/math';

const flameCore = new THREE.Color(0xffffff);
const flameInner = new THREE.Color(0xffdd44);
const flameMid = new THREE.Color(BOOST_FLAME_COLOR);
const flameOuter = new THREE.Color(0xff4400);
const flameTip = new THREE.Color(0xaa1100);

export class BoostFlame {
  private timer = 0;

  update(
    pool: ParticlePool,
    position: THREE.Vector3,
    forward: THREE.Vector3,
    isBoosting: boolean,
    dt: number,
  ): void {
    if (!isBoosting) return;

    const emitRate = 0.008;
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), forward).normalize();

    this.timer += dt;
    while (this.timer >= emitRate) {
      this.timer -= emitRate;

      // Emit from both exhaust pipes
      for (const side of [-0.25, 0.25]) {
        const emitPos = position.clone()
          .add(forward.clone().multiplyScalar(1.3))
          .add(right.clone().multiplyScalar(side));
        emitPos.y += 0.3;
        emitPos.x += randomRange(-0.05, 0.05);
        emitPos.z += randomRange(-0.05, 0.05);

        const vel = forward.clone().multiplyScalar(randomRange(4, 10));
        vel.y += randomRange(0.3, 1.5);
        vel.x += randomRange(-0.5, 0.5);
        vel.z += randomRange(-0.5, 0.5);

        // Color varies from white core to red tip
        const r = Math.random();
        const color = r < 0.15 ? flameCore :
                      r < 0.35 ? flameInner :
                      r < 0.6 ? flameMid :
                      r < 0.85 ? flameOuter : flameTip;

        pool.emit(emitPos, vel, color, randomRange(0.2, 0.55), FLAME_LIFETIME);
      }

      // Smoke trail (darker, larger, slower)
      if (Math.random() > 0.6) {
        const smokePos = position.clone()
          .add(forward.clone().multiplyScalar(1.6))
          .add(right.clone().multiplyScalar(randomRange(-0.3, 0.3)));
        smokePos.y += 0.4;

        const smokeVel = forward.clone().multiplyScalar(randomRange(1, 3));
        smokeVel.y += randomRange(0.5, 2);

        const grey = 0.2 + Math.random() * 0.15;
        const smokeColor = new THREE.Color(grey, grey, grey);
        pool.emit(smokePos, smokeVel, smokeColor, randomRange(0.3, 0.7), FLAME_LIFETIME * 1.5);
      }
    }
  }

  reset(): void {
    this.timer = 0;
  }
}
