import * as THREE from 'three';
import { TrackSpline } from './TrackSpline';
import { Kart } from '../kart/Kart';
import { TOTAL_LAPS } from '../constants';

export interface Checkpoint {
  t: number;
  position: THREE.Vector3;
  index: number;
}

export class CheckpointSystem {
  readonly checkpoints: Checkpoint[] = [];
  readonly startLine: Checkpoint;
  private totalCheckpoints: number;
  private prevT = new Map<number, number>();

  constructor(spline: TrackSpline, checkpointIndices: number[], totalControlPoints: number) {
    for (let i = 0; i < checkpointIndices.length; i++) {
      const cpIdx = checkpointIndices[i];
      const t = cpIdx / totalControlPoints;
      const sp = spline.getPointAt(t);
      this.checkpoints.push({
        t,
        position: sp.position.clone(),
        index: i,
      });
    }
    this.totalCheckpoints = this.checkpoints.length;

    const sp0 = spline.getPointAt(0);
    this.startLine = { t: 0, position: sp0.position.clone(), index: -1 };
  }

  updateKart(kart: Kart, currentT: number): { crossedCheckpoint: boolean; crossedFinish: boolean } {
    let crossedCheckpoint = false;
    let crossedFinish = false;

    const prevT = this.prevT.get(kart.index) ?? currentT;

    // Check each checkpoint
    for (const cp of this.checkpoints) {
      if (kart.checkpointsThisLap.has(cp.index)) continue;

      const dist = Math.abs(this.wrapT(currentT - cp.t));
      if (dist < 0.03) {
        kart.checkpointsThisLap.add(cp.index);
        kart.lastCheckpoint = cp.index;
        crossedCheckpoint = true;
      }
    }

    // Check finish line crossing: prevT was near end, currentT is near start
    if (prevT > 0.85 && currentT < 0.15) {
      // Require at least half of checkpoints to count the lap
      if (kart.checkpointsThisLap.size >= Math.max(1, Math.floor(this.totalCheckpoints * 0.5))) {
        kart.currentLap++;
        kart.checkpointsThisLap.clear();
        crossedFinish = true;
      }
    }

    this.prevT.set(kart.index, currentT);
    return { crossedCheckpoint, crossedFinish };
  }

  private wrapT(dt: number): number {
    if (dt > 0.5) dt -= 1;
    if (dt < -0.5) dt += 1;
    return dt;
  }

  isRaceComplete(kart: Kart): boolean {
    return kart.currentLap >= TOTAL_LAPS;
  }

  reset(): void {
    this.prevT.clear();
  }
}
