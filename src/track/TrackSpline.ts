import * as THREE from 'three';
import { TrackControlPoint } from './TrackDefinition';
import { TRACK_SPLINE_SEGMENTS } from '../constants';

export interface SplinePoint {
  position: THREE.Vector3;
  tangent: THREE.Vector3;
  normal: THREE.Vector3;
  binormal: THREE.Vector3;
  width: number;
  bank: number;
  surface: string;
}

export class TrackSpline {
  readonly curve: THREE.CatmullRomCurve3;
  readonly controlPoints: TrackControlPoint[];
  readonly totalLength: number;
  private sampledPoints: SplinePoint[] = [];

  constructor(controlPoints: TrackControlPoint[]) {
    this.controlPoints = controlPoints;
    const points = controlPoints.map(cp => new THREE.Vector3(cp.position[0], cp.position[1], cp.position[2]));
    this.curve = new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.3);
    this.totalLength = this.curve.getLength();
    this.samplePoints();
  }

  private samplePoints(): void {
    const numSamples = TRACK_SPLINE_SEGMENTS;
    const cpCount = this.controlPoints.length;

    // Use parallel transport to propagate the reference frame along the curve.
    // This avoids degeneracy when the tangent is near-vertical (e.g. vertical loops)
    // where cross(tangent, globalUp) → 0.
    let prevRefNormal: THREE.Vector3 | null = null;

    for (let i = 0; i <= numSamples; i++) {
      const t = i / numSamples;
      const pos = this.curve.getPointAt(t);
      const tan = this.curve.getTangentAt(t).normalize();

      // Interpolate width and bank from nearest control points.
      // Convert arc-length t → raw spline parameter so CP indices align correctly
      // (getPointAt uses arc-length parameterization but CPs are uniformly spaced in raw param).
      const rawU = this.curve.getUtoTmapping(t, t * this.totalLength);
      const cpT = rawU * cpCount;
      const cpIdx = Math.floor(cpT) % cpCount;
      const cpNext = (cpIdx + 1) % cpCount;
      const cpFrac = cpT - Math.floor(cpT);

      const cp0 = this.controlPoints[cpIdx];
      const cp1 = this.controlPoints[cpNext];

      const width = (cp0.width ?? 12) * (1 - cpFrac) + (cp1.width ?? 12) * cpFrac;

      // Bank interpolation with shortest-path unwrapping
      // Prevents reverse rotation at barrel roll exit (2π→0)
      const bank0 = cp0.bank ?? 0;
      let bank1 = cp1.bank ?? 0;
      let bankDiff = bank1 - bank0;
      if (bankDiff > Math.PI) bankDiff -= 2 * Math.PI;
      else if (bankDiff < -Math.PI) bankDiff += 2 * Math.PI;
      bank1 = bank0 + bankDiff;
      const bank = bank0 * (1 - cpFrac) + bank1 * cpFrac;
      const surface = cpFrac < 0.5 ? (cp0.surface ?? 'road') : (cp1.surface ?? 'road');

      // Compute normal and binormal via parallel transport
      let normal: THREE.Vector3;
      let binormal: THREE.Vector3;

      if (prevRefNormal === null) {
        // Bootstrap first frame from global up
        const up = new THREE.Vector3(0, 1, 0);
        binormal = new THREE.Vector3().crossVectors(tan, up).normalize();
        if (binormal.lengthSq() < 0.0001) binormal.set(1, 0, 0);
        normal = new THREE.Vector3().crossVectors(binormal, tan).normalize();
      } else {
        // Parallel transport: project previous normal onto plane perpendicular to tangent
        normal = prevRefNormal.clone();
        normal.sub(tan.clone().multiplyScalar(normal.dot(tan)));
        const len = normal.length();
        if (len > 0.0001) {
          normal.divideScalar(len);
        } else {
          // Extremely rare fallback
          normal.copy(prevRefNormal);
        }
        binormal = new THREE.Vector3().crossVectors(tan, normal).normalize();
      }

      // Save pre-bank normal for next sample's parallel transport
      prevRefNormal = normal.clone();

      // Apply bank rotation
      if (Math.abs(bank) > 0.001) {
        const bankQuat = new THREE.Quaternion().setFromAxisAngle(tan, bank);
        binormal.applyQuaternion(bankQuat);
        normal.applyQuaternion(bankQuat);
      }

      this.sampledPoints.push({ position: pos, tangent: tan, normal, binormal, width, bank, surface });
    }
  }

  getPointAt(t: number): SplinePoint {
    t = ((t % 1) + 1) % 1;
    const idx = t * TRACK_SPLINE_SEGMENTS;
    const i0 = Math.floor(idx) % this.sampledPoints.length;
    const i1 = (i0 + 1) % this.sampledPoints.length;
    const frac = idx - Math.floor(idx);

    const p0 = this.sampledPoints[i0];
    const p1 = this.sampledPoints[i1];

    return {
      position: new THREE.Vector3().lerpVectors(p0.position, p1.position, frac),
      tangent: new THREE.Vector3().lerpVectors(p0.tangent, p1.tangent, frac).normalize(),
      normal: new THREE.Vector3().lerpVectors(p0.normal, p1.normal, frac).normalize(),
      binormal: new THREE.Vector3().lerpVectors(p0.binormal, p1.binormal, frac).normalize(),
      width: p0.width * (1 - frac) + p1.width * frac,
      bank: p0.bank * (1 - frac) + p1.bank * frac,
      surface: frac < 0.5 ? p0.surface : p1.surface,
    };
  }

  getSampledPoint(index: number): SplinePoint {
    return this.sampledPoints[index % this.sampledPoints.length];
  }

  get sampleCount(): number {
    return this.sampledPoints.length;
  }

  findClosestT(position: THREE.Vector3, hint?: number): number {
    // Coarse search
    let bestT = 0;
    let bestDist = Infinity;
    const coarseSteps = 200;

    const searchStart = hint !== undefined ? hint - 0.1 : 0;
    const searchEnd = hint !== undefined ? hint + 0.1 : 1;

    for (let i = 0; i < coarseSteps; i++) {
      const t = ((searchStart + (searchEnd - searchStart) * (i / coarseSteps)) % 1 + 1) % 1;
      const p = this.curve.getPointAt(t);
      const dist = position.distanceToSquared(p);
      if (dist < bestDist) {
        bestDist = dist;
        bestT = t;
      }
    }

    // Refinement with exponentially decreasing step for sub-meter precision
    let step = 0.001;
    for (let iter = 0; iter < 6; iter++) {
      const tM = ((bestT - step) % 1 + 1) % 1;
      const tP = ((bestT + step) % 1 + 1) % 1;

      const dM = position.distanceToSquared(this.curve.getPointAt(tM));
      const dC = position.distanceToSquared(this.curve.getPointAt(bestT));
      const dP = position.distanceToSquared(this.curve.getPointAt(tP));

      if (dM < dC) bestT = tM;
      else if (dP < dC) bestT = tP;
      step *= 0.4;
    }

    return ((bestT % 1) + 1) % 1;
  }
}
