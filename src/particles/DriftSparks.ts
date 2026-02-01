import * as THREE from 'three';
import { ParticlePool } from './ParticlePool';
import { DriftStage } from '../kart/DriftSystem';
import { DRIFT_COLOR_BLUE, DRIFT_COLOR_ORANGE, DRIFT_COLOR_PINK, SPARK_LIFETIME } from '../constants';
import { randomRange } from '../utils/math';

const stageColors = {
  [DriftStage.None]: new THREE.Color(0x4488ff),
  [DriftStage.Blue]: new THREE.Color(DRIFT_COLOR_BLUE),
  [DriftStage.Orange]: new THREE.Color(DRIFT_COLOR_ORANGE),
  [DriftStage.Pink]: new THREE.Color(DRIFT_COLOR_PINK),
};

// Secondary brighter colors per stage
const stageColorsBright = {
  [DriftStage.None]: new THREE.Color(0x88bbff),
  [DriftStage.Blue]: new THREE.Color(0x66ccff),
  [DriftStage.Orange]: new THREE.Color(0xffdd44),
  [DriftStage.Pink]: new THREE.Color(0xff88cc),
};

export class DriftSparks {
  private timer = 0;

  update(
    pool: ParticlePool,
    position: THREE.Vector3,
    forward: THREE.Vector3,
    driftDir: number,
    stage: DriftStage,
    dt: number,
  ): void {
    if (stage === DriftStage.None) return;

    // Higher emit rate for later stages
    const emitRate = stage === DriftStage.Pink ? 0.008 : stage === DriftStage.Orange ? 0.012 : 0.018;

    this.timer += dt;
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), forward).normalize();

    while (this.timer >= emitRate) {
      this.timer -= emitRate;

      // Emit from both rear wheels
      for (const wheelSide of [-0.8, 0.8]) {
        const emitPos = position.clone()
          .add(forward.clone().multiplyScalar(0.8))
          .add(right.clone().multiplyScalar(wheelSide));
        emitPos.y += 0.05 + randomRange(0, 0.1);

        // Sparks fly outward and upward
        const outward = right.clone().multiplyScalar(wheelSide * randomRange(1, 3));
        const vel = new THREE.Vector3(
          outward.x + randomRange(-1, 1),
          randomRange(1.5, 5),
          outward.z + randomRange(-1, 1),
        );

        const useAlt = Math.random() > 0.6;
        const colors = useAlt ? stageColorsBright : stageColors;
        const color = colors[stage] ?? colors[DriftStage.Blue];
        const size = 0.2 + (stage as number) * 0.15 + randomRange(0, 0.15);

        pool.emit(emitPos, vel, color, size, SPARK_LIFETIME);
      }

      // Extra ground trail sparks in higher stages
      if (stage >= DriftStage.Orange && Math.random() > 0.4) {
        const trailPos = position.clone()
          .add(forward.clone().multiplyScalar(0.6 + randomRange(0, 0.4)))
          .add(right.clone().multiplyScalar(driftDir * randomRange(-0.3, -1.2)));
        trailPos.y += 0.02;

        const trailVel = new THREE.Vector3(
          randomRange(-0.5, 0.5),
          randomRange(0.2, 1),
          randomRange(-0.5, 0.5),
        );

        const color = stageColors[stage];
        pool.emit(trailPos, trailVel, color, 0.15, SPARK_LIFETIME * 0.6);
      }
    }
  }

  reset(): void {
    this.timer = 0;
  }
}
