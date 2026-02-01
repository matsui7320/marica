import { InputState } from '../core/InputManager';
import { Kart } from './Kart';
import { updateKartPhysics, SurfaceInfo } from './KartPhysics';
import * as THREE from 'three';

export class KartController {
  update(
    kart: Kart,
    input: InputState,
    dt: number,
    getSurface: (pos: THREE.Vector3, tOverride?: number) => SurfaceInfo | null,
  ): void {
    if (kart.finished) return;

    updateKartPhysics(
      kart.state,
      input.accelerate,
      input.brake,
      input.steer,
      input.drift,
      dt,
      getSurface,
    );
  }
}
