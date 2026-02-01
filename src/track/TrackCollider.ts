import * as THREE from 'three';
import { TrackSpline } from './TrackSpline';
import { SurfaceInfo, SurfaceType } from '../kart/KartPhysics';

export class TrackCollider {
  private spline: TrackSpline;
  private lastT = new Map<number, number>();

  constructor(spline: TrackSpline) {
    this.spline = spline;
  }

  query(position: THREE.Vector3, kartId: number = 0): SurfaceInfo {
    const hint = this.lastT.get(kartId);
    const t = this.spline.findClosestT(position, hint);
    this.lastT.set(kartId, t);
    return this.buildSurfaceInfo(t, position);
  }

  /** Query surface at an exact t-parameter (no nearest-point search). */
  queryAtT(t: number, kartId: number = 0): SurfaceInfo {
    t = ((t % 1) + 1) % 1;
    this.lastT.set(kartId, t);
    return this.buildSurfaceInfo(t);
  }

  private buildSurfaceInfo(t: number, position?: THREE.Vector3): SurfaceInfo {
    const sp = this.spline.getPointAt(t);

    // Lateral offset: project kart position onto the cross-section
    let lateralOffset = 0;
    if (position) {
      const toKart = position.clone().sub(sp.position);
      lateralOffset = toKart.dot(sp.binormal);
    }

    // Height at kart's lateral position on the (possibly banked) track surface
    const height = sp.position.y + sp.normal.y * 0 + sp.binormal.y * lateralOffset;

    // Surface type based on lateral offset
    const hw = sp.width * 0.5;
    let surfaceType: SurfaceType = sp.surface as SurfaceType;
    if (Math.abs(lateralOffset) > hw) {
      surfaceType = 'offroad';
    }

    return {
      height,
      normal: sp.normal.clone(),
      binormal: sp.binormal.clone(),
      tangent: sp.tangent.clone(),
      centerPosition: sp.position.clone(),
      lateralOffset,
      trackWidth: sp.width,
      surfaceType,
      t,
      splineLength: this.spline.totalLength,
    };
  }

  getSpline(): TrackSpline {
    return this.spline;
  }
}
