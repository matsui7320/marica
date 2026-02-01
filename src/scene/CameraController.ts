import * as THREE from 'three';
import { CAM_DISTANCE, CAM_HEIGHT, CAM_LOOK_AHEAD, CAM_FOV_NORMAL, CAM_FOV_BOOST, CAM_FOV_LERP_SPEED } from '../constants';
import { damp } from '../utils/math';

export class CameraController {
  readonly camera: THREE.PerspectiveCamera;
  private currentPos = new THREE.Vector3(0, CAM_HEIGHT, CAM_DISTANCE);
  private targetFov = CAM_FOV_NORMAL;
  private shakeIntensity = 0;
  private shakeDecay = 5;
  // Smoothed track normal for camera orientation
  private smoothNormal = new THREE.Vector3(0, 1, 0);
  // Smoothed forward direction (avoids jitter on steering)
  private smoothForward = new THREE.Vector3(0, 0, 1);

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(CAM_FOV_NORMAL, aspect, 0.5, 1500);
    this.camera.position.copy(this.currentPos);
  }

  update(
    targetPosition: THREE.Vector3,
    targetForward: THREE.Vector3,
    dt: number,
    isBoosting: boolean,
    lookBack: boolean,
    trackNormal?: THREE.Vector3,
  ): void {
    // Smoothly interpolate track normal
    if (trackNormal) {
      this.smoothNormal.lerp(trackNormal, 0.12);
      this.smoothNormal.normalize();
    }

    // Smooth forward direction — fast enough to track steering but no jitter
    this.smoothForward.lerp(targetForward, 0.15).normalize();

    // Slope-aware up direction
    const upDir = new THREE.Vector3(0, 1, 0)
      .lerp(this.smoothNormal, 0.7)
      .normalize();

    // Compute ideal position: directly behind kart at fixed distance
    const behind = lookBack
      ? this.smoothForward.clone()
      : this.smoothForward.clone().negate();

    const idealPos = targetPosition.clone()
      .add(behind.multiplyScalar(CAM_DISTANCE))
      .add(upDir.clone().multiplyScalar(CAM_HEIGHT));

    // Direct lerp — camera snaps to ideal position with high stiffness
    // This guarantees the camera never drifts away at any speed
    this.currentPos.lerp(idealPos, 0.35);

    this.camera.position.copy(this.currentPos);

    // Shake
    if (this.shakeIntensity > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeIntensity;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeIntensity *= Math.exp(-this.shakeDecay * dt);
    }

    // Look at target + ahead, with slope-aware up vector
    const lookTarget = targetPosition.clone()
      .add(targetForward.clone().multiplyScalar(lookBack ? -CAM_LOOK_AHEAD : CAM_LOOK_AHEAD));
    this.camera.up.copy(upDir);
    this.camera.lookAt(lookTarget);

    // FOV
    this.targetFov = isBoosting ? CAM_FOV_BOOST : CAM_FOV_NORMAL;
    this.camera.fov = damp(this.camera.fov, this.targetFov, CAM_FOV_LERP_SPEED, dt);
    this.camera.updateProjectionMatrix();
  }

  shake(intensity: number): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  reset(position: THREE.Vector3, forward: THREE.Vector3): void {
    this.currentPos.copy(position)
      .add(forward.clone().negate().multiplyScalar(CAM_DISTANCE))
      .add(new THREE.Vector3(0, CAM_HEIGHT, 0));
    this.smoothForward.copy(forward);
    this.shakeIntensity = 0;
    this.smoothNormal.set(0, 1, 0);
    this.camera.position.copy(this.currentPos);
  }
}
