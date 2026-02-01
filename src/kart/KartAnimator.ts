import { Kart } from './Kart';
import { KART_MAX_SPEED } from '../constants';
import { lerp } from '../utils/math';

export class KartAnimator {
  private wheelRotation = 0;

  update(kart: Kart, dt: number): void {
    const state = kart.state;
    const meshes = kart.meshes;
    const speedRatio = Math.abs(state.speed) / KART_MAX_SPEED;

    // Wheel rolling
    this.wheelRotation += state.speed * dt * 3;
    for (const wheel of meshes.wheels) {
      // Wheels are Groups, rotate on local X for rolling
      wheel.rotation.x = this.wheelRotation;
    }

    // Front wheel steering visual
    const steerVisual = state.steerAngle * 0.35;
    meshes.wheels[0].rotation.z = steerVisual;
    meshes.wheels[1].rotation.z = steerVisual;

    // Body tilt on steering
    const targetTilt = -state.steerAngle * 0.08 * speedRatio;
    meshes.body.rotation.z = lerp(meshes.body.rotation.z, targetTilt, 0.15);

    // Body pitch on acceleration
    const accelPitch = state.speed > 0 ? -0.025 * speedRatio : 0.02;
    meshes.body.rotation.x = lerp(meshes.body.rotation.x, accelPitch, 0.1);

    // Suspension bounce
    if (state.isGrounded && state.verticalVelocity === 0) {
      const suspOffset = Math.sin(Date.now() * 0.003 * speedRatio) * 0.015 * speedRatio;
      meshes.body.position.y = 0.32 + suspOffset;
    }

    // Drift visual: extra body lean
    if (state.isDrifting) {
      const driftLean = state.driftDirection * 0.1;
      meshes.body.rotation.z = lerp(meshes.body.rotation.z, driftLean, 0.1);
    }

    // Driver leans into turns
    const driverLean = -state.steerAngle * 0.12;
    meshes.driver.rotation.z = lerp(meshes.driver.rotation.z, driverLean, 0.1);
    // Driver leans forward when accelerating
    const driverFwd = speedRatio > 0.5 ? -0.08 : 0;
    meshes.driver.rotation.x = lerp(meshes.driver.rotation.x, driverFwd, 0.08);
  }
}
