import * as THREE from 'three';
import {
  KART_MAX_SPEED, KART_ACCELERATION, KART_BRAKE_DECEL, KART_COAST_DECEL,
  KART_REVERSE_MAX_SPEED, KART_REVERSE_ACCEL, KART_STEER_RATE, KART_STEER_SPEED_FACTOR,
  KART_GRIP, KART_DRIFT_GRIP, GRAVITY, DRIFT_ANGLE_ADDITION, DRIFT_INNER_STEER_FACTOR,
  OFFROAD_SPEED_FACTOR, WALL_PUSH_FORCE, WALL_SPEED_LOSS,
  KART_COLLISION_RADIUS, KART_BOUNCE_FACTOR,
} from '../constants';
import { clamp, wrapAngle } from '../utils/math';

export type SurfaceType = 'road' | 'offroad' | 'boost' | 'jump' | 'antigravity';

export interface SurfaceInfo {
  height: number;
  normal: THREE.Vector3;
  binormal: THREE.Vector3;
  tangent: THREE.Vector3;
  centerPosition: THREE.Vector3;
  lateralOffset: number;
  trackWidth: number;
  surfaceType: SurfaceType;
  t: number;
  splineLength: number;
}

export interface KartState {
  position: THREE.Vector3;
  prevPosition: THREE.Vector3;
  velocity: THREE.Vector3;
  heading: number;
  speed: number;
  verticalVelocity: number;
  isGrounded: boolean;
  isDrifting: boolean;
  driftDirection: number; // -1 or 1
  steerAngle: number;
  boostTimer: number;
  boostPower: number;
  spinTimer: number;
  shrinkTimer: number;
  starTimer: number;
  isHit: boolean;
  hitTimer: number;
  lapProgress: number; // 0..1 along spline
  onAntiGravity: boolean;
  trackNormal: THREE.Vector3;
  trackTangent: THREE.Vector3;
}

export function createKartState(): KartState {
  return {
    position: new THREE.Vector3(),
    prevPosition: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    heading: 0,
    speed: 0,
    verticalVelocity: 0,
    isGrounded: true,
    isDrifting: false,
    driftDirection: 0,
    steerAngle: 0,
    boostTimer: 0,
    boostPower: 0,
    spinTimer: 0,
    shrinkTimer: 0,
    starTimer: 0,
    isHit: false,
    hitTimer: 0,
    lapProgress: 0,
    onAntiGravity: false,
    trackNormal: new THREE.Vector3(0, 1, 0),
    trackTangent: new THREE.Vector3(0, 0, 1),
  };
}

export function updateKartPhysics(
  state: KartState,
  accel: number,
  brake: number,
  steer: number,
  driftHeld: boolean,
  dt: number,
  getSurface: (pos: THREE.Vector3, tOverride?: number) => SurfaceInfo | null,
): void {
  state.prevPosition.copy(state.position);

  // Timers
  if (state.boostTimer > 0) state.boostTimer -= dt;
  if (state.spinTimer > 0) {
    state.spinTimer -= dt;
    state.speed *= 0.95;
    if (!state.onAntiGravity) {
      state.heading += dt * 8; // spin visual
      return;
    }
    // On anti-gravity: fall through to anti-gravity block with zero input
    accel = 0; brake = 0; steer = 0;
  }
  if (state.hitTimer > 0) {
    state.hitTimer -= dt;
    state.speed *= 0.98;
    if (state.hitTimer <= 0) state.isHit = false;
    if (!state.onAntiGravity) {
      return;
    }
    // On anti-gravity: fall through to anti-gravity block with zero input
    accel = 0; brake = 0; steer = 0;
  }

  // Surface query — when already on anti-gravity, use t-based lookup to prevent
  // findClosestT from jumping to the wrong side of a vertical loop.
  const wasOnAntiGravity = state.onAntiGravity;
  const surface = state.onAntiGravity
    ? getSurface(state.position, state.lapProgress)
    : getSurface(state.position);
  const maxSpeed = getMaxSpeed(state, surface);

  // ── Surface-gravity: road-perpendicular gravity + t-based track following ──
  // Gravity acts only perpendicular to the road surface (holds kart on road).
  // No tangential gravity component — the kart drives at the same speed
  // regardless of whether the road goes uphill, inverted, or downhill.
  if (surface && surface.surfaceType === 'antigravity') {
    state.onAntiGravity = true;
    state.trackNormal.copy(surface.normal);
    state.trackTangent.copy(surface.tangent);

    // Acceleration / braking (identical to normal road)
    if (accel > 0 && state.speed >= 0) {
      if (state.speed < maxSpeed) {
        state.speed += KART_ACCELERATION * accel * dt;
        if (state.speed > maxSpeed) state.speed = maxSpeed;
      }
    } else if (brake > 0) {
      if (state.speed > 0) {
        state.speed -= KART_BRAKE_DECEL * brake * dt;
        if (state.speed < 0) state.speed = 0;
      } else {
        state.speed -= KART_REVERSE_ACCEL * brake * dt;
      }
    } else {
      if (state.speed > 0) {
        state.speed -= KART_COAST_DECEL * dt;
        if (state.speed < 0) state.speed = 0;
      } else if (state.speed < 0) {
        state.speed += KART_COAST_DECEL * dt;
        if (state.speed > 0) state.speed = 0;
      }
    }

    if (state.speed > maxSpeed) {
      state.speed -= KART_COAST_DECEL * 2 * dt;
      if (state.speed < maxSpeed) state.speed = maxSpeed;
    }
    if (state.speed < -KART_REVERSE_MAX_SPEED) state.speed = -KART_REVERSE_MAX_SPEED;

    // Prevent stalling on anti-gravity — maintain a minimum forward speed so karts
    // don't get stuck on vertical loops after spin/hit recovery
    const AG_MIN_SPEED = KART_MAX_SPEED * 0.15;
    if (state.speed >= 0 && state.speed < AG_MIN_SPEED) {
      state.speed = AG_MIN_SPEED;
    }

    // Advance t-parameter directly along the spline arc
    const advanceT = (state.speed * dt) / surface.splineLength;
    const newT = ((surface.t + advanceT) % 1 + 1) % 1;

    // Compute current lateral offset from actual kart position vs spline center
    // (queryAtT doesn't pass position, so surface.lateralOffset may be 0)
    // Clamp to track bounds to prevent phantom offsets from binormal rotation between frames.
    const toKart = state.position.clone().sub(surface.centerPosition);
    const rawLateral = toKart.dot(surface.binormal);
    const currentLateral = clamp(rawLateral, -surface.trackWidth * 0.5, surface.trackWidth * 0.5);

    // Lateral movement from steering
    const speedFactor = 1 - (Math.abs(state.speed) / KART_MAX_SPEED) * KART_STEER_SPEED_FACTOR;
    const latSpeed = steer * KART_STEER_RATE * speedFactor * Math.abs(state.speed) * 0.3;
    let newLateral = currentLateral + latSpeed * dt;

    // Wall collision — clamp to track width (no speed penalty on anti-gravity
    // because binormal rotation between frames can cause phantom lateral jumps)
    const hw = surface.trackWidth * 0.5;
    if (Math.abs(newLateral) > hw) {
      newLateral = Math.sign(newLateral) * hw;
    }

    // Query spline at advanced t to get new frame
    const newSurface = getSurface(state.position, newT);
    if (newSurface) {
      // Place kart exactly on spline: center + lateral offset along binormal
      state.position.copy(newSurface.centerPosition)
        .add(newSurface.binormal.clone().multiplyScalar(newLateral));

      state.lapProgress = newT;
      state.trackNormal.copy(newSurface.normal);
      state.trackTangent.copy(newSurface.tangent);

      // Update heading to match tangent direction (for smooth transition out)
      state.heading = Math.atan2(newSurface.tangent.x, newSurface.tangent.z);
      state.velocity.copy(newSurface.tangent).multiplyScalar(state.speed);
    }

    state.verticalVelocity = 0;
    state.isGrounded = true;
    state.steerAngle = steer;
    return;
  }

  // Not on anti-gravity
  state.onAntiGravity = false;
  // Store actual surface normal/tangent for slope-following visual tilt
  if (surface) {
    state.trackNormal.copy(surface.normal);
    state.trackTangent.copy(surface.tangent);
  } else {
    state.trackNormal.set(0, 1, 0);
    state.trackTangent.set(Math.sin(state.heading), 0, Math.cos(state.heading));
  }

  // ── Anti-gravity exit: force-snap to ground ──
  // When the kart just left an anti-gravity section, its Y position was set by
  // the 3D spline snap (centerPosition + binormal * lateral).  In normal physics
  // the ground height comes from a different code-path (findClosestT → height),
  // which can disagree — especially near a vertical loop where findClosestT may
  // latch onto a nearby loop point with a much higher Y, causing the kart to
  // get snapped upward and float.  Fix: on the transition frame, force-snap Y
  // to the known-good surface height and zero out vertical state.
  if (wasOnAntiGravity && surface) {
    state.position.y = surface.height;
    state.verticalVelocity = 0;
    state.isGrounded = true;
  }

  // Acceleration / braking
  if (accel > 0 && state.speed >= 0) {
    if (state.speed < maxSpeed) {
      state.speed += KART_ACCELERATION * accel * dt;
      if (state.speed > maxSpeed) state.speed = maxSpeed;
    }
  } else if (brake > 0) {
    if (state.speed > 0) {
      state.speed -= KART_BRAKE_DECEL * brake * dt;
      if (state.speed < 0) state.speed = 0;
    } else {
      state.speed -= KART_REVERSE_ACCEL * brake * dt;
    }
  } else {
    // Coast deceleration
    if (state.speed > 0) {
      state.speed -= KART_COAST_DECEL * dt;
      if (state.speed < 0) state.speed = 0;
    } else if (state.speed < 0) {
      state.speed += KART_COAST_DECEL * dt;
      if (state.speed > 0) state.speed = 0;
    }
  }

  // Clamp speed
  if (state.speed > maxSpeed) {
    state.speed -= KART_COAST_DECEL * 2 * dt;
    if (state.speed < maxSpeed) state.speed = maxSpeed;
  }
  if (state.speed < -KART_REVERSE_MAX_SPEED) {
    state.speed = -KART_REVERSE_MAX_SPEED;
  }

  // Steering
  const speedFactor = 1 - (Math.abs(state.speed) / KART_MAX_SPEED) * KART_STEER_SPEED_FACTOR;
  let steerRate = KART_STEER_RATE * speedFactor;

  if (state.isDrifting) {
    // Drift steering: can steer more into the drift
    const driftSteer = steer * DRIFT_INNER_STEER_FACTOR + state.driftDirection * DRIFT_ANGLE_ADDITION;
    state.heading -= driftSteer * steerRate * dt;
  } else {
    state.heading -= steer * steerRate * dt;
  }
  state.heading = wrapAngle(state.heading);
  state.steerAngle = steer;

  // Velocity from heading and speed
  // Physics convention: heading=0 means +Z. Forward = (sin(h), 0, cos(h))
  const grip = state.isDrifting ? KART_DRIFT_GRIP : KART_GRIP;
  const fwdX = Math.sin(state.heading);
  const fwdZ = Math.cos(state.heading);
  const targetVx = fwdX * state.speed;
  const targetVz = fwdZ * state.speed;

  state.velocity.x += (targetVx - state.velocity.x) * grip;
  state.velocity.z += (targetVz - state.velocity.z) * grip;

  // Gravity / vertical
  if (!state.isGrounded) {
    state.verticalVelocity -= GRAVITY * dt;
  }
  state.velocity.y = state.verticalVelocity;

  // Move
  state.position.add(state.velocity.clone().multiplyScalar(dt));

  // Ground projection — always snap to surface
  if (surface) {
    const groundY = surface.height;

    // Safety: if the surface height is vastly above the kart, the surface query
    // likely latched onto a wrong spline segment (e.g. a nearby vertical loop).
    // In that case, skip the snap so gravity brings the kart down naturally.
    const heightDiff = groundY - state.position.y;
    if (heightDiff > 4.0) {
      state.isGrounded = false;
    } else if (state.position.y <= groundY + 0.1) {
      state.position.y = groundY;
      if (state.verticalVelocity < 0) state.verticalVelocity = 0;
      state.isGrounded = true;
      // On slopes, set vertical velocity to follow terrain surface
      const ny = surface.normal.y;
      if (ny < 0.98) {
        const nx = surface.normal.x, nz = surface.normal.z;
        const climbRate = -(state.velocity.x * nx + state.velocity.z * nz) / Math.max(ny, 0.1);
        state.verticalVelocity = climbRate;
      }
    } else if (state.position.y > groundY + 1.5) {
      state.isGrounded = false;
    } else {
      // Pull towards ground — stronger on slopes to prevent floating
      const snapStrength = surface.normal.y < 0.95 ? 0.6 : 0.3;
      state.position.y += (groundY - state.position.y) * snapStrength;
      state.isGrounded = true;
      if (state.verticalVelocity < 0) state.verticalVelocity = 0;
    }

    // Wall collision — push back along track binormal and redirect velocity
    const hw = surface.trackWidth * 0.5;
    if (Math.abs(surface.lateralOffset) > hw) {
      const excess = Math.abs(surface.lateralOffset) - hw;
      const pushDir = surface.lateralOffset > 0 ? -1 : 1;
      // Push kart back onto track using the binormal direction
      state.position.x += surface.binormal.x * pushDir * excess * 0.8;
      state.position.z += surface.binormal.z * pushDir * excess * 0.8;
      state.speed *= WALL_SPEED_LOSS;

      // Remove velocity component going into the wall (along binormal)
      const vDotB = state.velocity.x * surface.binormal.x + state.velocity.z * surface.binormal.z;
      // Only cancel if velocity is going INTO the wall (opposite of push direction)
      if (vDotB * pushDir < 0) {
        state.velocity.x -= surface.binormal.x * vDotB;
        state.velocity.z -= surface.binormal.z * vDotB;
      }
    }

    state.lapProgress = surface.t;
  }
}

function getMaxSpeed(state: KartState, surface: SurfaceInfo | null): number {
  let max = KART_MAX_SPEED;

  if (surface?.surfaceType === 'offroad') {
    max *= OFFROAD_SPEED_FACTOR;
  }

  if (state.boostTimer > 0) {
    max *= (1 + state.boostPower);
  }

  if (state.starTimer > 0) {
    max *= 1.25;
  }

  if (state.shrinkTimer > 0) {
    max *= (1 - 0.4);
  }

  return max;
}

export function resolveKartCollision(a: KartState, b: KartState): void {
  // Skip collision for anti-gravity karts — on vertical loops the position is
  // snapped to the spline each frame (push-back has no effect), and the XZ-only
  // speed recalculation would zero out speed when velocity is mostly in Y.
  if (a.onAntiGravity || b.onAntiGravity) return;

  const dx = b.position.x - a.position.x;
  const dz = b.position.z - a.position.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  const minDist = KART_COLLISION_RADIUS * 2;

  if (dist < minDist && dist > 0.001) {
    const nx = dx / dist;
    const nz = dz / dist;
    const overlap = minDist - dist;

    // Push apart
    a.position.x -= nx * overlap * 0.5;
    a.position.z -= nz * overlap * 0.5;
    b.position.x += nx * overlap * 0.5;
    b.position.z += nz * overlap * 0.5;

    // Elastic response
    const relVx = b.velocity.x - a.velocity.x;
    const relVz = b.velocity.z - a.velocity.z;
    const relDotN = relVx * nx + relVz * nz;

    if (relDotN < 0) {
      const impulse = relDotN * KART_BOUNCE_FACTOR;
      a.velocity.x += impulse * nx;
      a.velocity.z += impulse * nz;
      b.velocity.x -= impulse * nx;
      b.velocity.z -= impulse * nz;

      // Recalculate speed as projection of velocity onto heading (not magnitude).
      // This prevents rear-end collisions from pushing a stopped kart forward.
      const aFwdX = Math.sin(a.heading), aFwdZ = Math.cos(a.heading);
      const bFwdX = Math.sin(b.heading), bFwdZ = Math.cos(b.heading);
      a.speed = a.velocity.x * aFwdX + a.velocity.z * aFwdZ;
      b.speed = b.velocity.x * bFwdX + b.velocity.z * bFwdZ;
    }
  }
}

export function applyBoost(state: KartState, power: number, duration: number): void {
  state.boostTimer = duration;
  state.boostPower = power;
  state.speed = Math.max(state.speed, KART_MAX_SPEED * (1 + power * 0.5));
}

export function applyHit(state: KartState, spinDuration: number): void {
  if (state.starTimer > 0) return;
  state.spinTimer = spinDuration;
  state.speed *= 0.3;
  state.isHit = true;
  state.hitTimer = spinDuration + 1.0;
}
