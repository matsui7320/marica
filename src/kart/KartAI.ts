import * as THREE from 'three';
import { Kart } from './Kart';
import { updateKartPhysics, SurfaceInfo } from './KartPhysics';
import { DriftSystem } from './DriftSystem';
import { TrackSpline } from '../track/TrackSpline';
import { AI_LOOKAHEAD_DISTANCE, AI_PATH_NOISE_EASY, AI_PATH_NOISE_HARD, KART_MAX_SPEED, DRIFT_MIN_SPEED } from '../constants';
import { angleDiff, clamp, randomRange } from '../utils/math';
import { ItemType } from '../items/ItemDistribution';

export interface AIConfig {
  difficulty: number;    // 0 (easy) to 1 (hard)
  pathNoise: number;
  reactionDelay: number;
  driftSkill: number;    // 0..1
}

export class KartAI {
  private config: AIConfig;
  private driftSystem = new DriftSystem();
  private pathOffset = 0;
  private offsetTimer = 0;
  private targetOffset = 0;
  private itemUseDelay = 0;
  // Stuck detection
  private stuckTimer = 0;
  private lastProgressT = 0;
  private stuckRecoveryTimer = 0;
  private stuckSteerDir = 1;

  constructor(difficulty: number) {
    const d = clamp(difficulty, 0, 1);
    this.config = {
      difficulty: d,
      pathNoise: AI_PATH_NOISE_EASY * (1 - d) + AI_PATH_NOISE_HARD * d,
      reactionDelay: 0.4 * (1 - d) + 0.05 * d,
      driftSkill: d,
    };
  }

  update(
    kart: Kart,
    spline: TrackSpline,
    dt: number,
    getSurface: (pos: THREE.Vector3, tOverride?: number) => SurfaceInfo | null,
    allKarts: Kart[],
  ): { useItem: boolean; itemType: ItemType | null } {
    let useItem = false;
    let itemType: ItemType | null = null;

    if (kart.finished || kart.state.spinTimer > 0 || kart.state.hitTimer > 0) {
      updateKartPhysics(kart.state, 0, 0, 0, false, dt, getSurface);
      return { useItem: false, itemType: null };
    }

    // Vary path offset periodically
    this.offsetTimer -= dt;
    if (this.offsetTimer <= 0) {
      this.offsetTimer = randomRange(1, 3);
      this.targetOffset = randomRange(-this.config.pathNoise, this.config.pathNoise);
    }
    this.pathOffset += (this.targetOffset - this.pathOffset) * 2 * dt;

    // Look ahead on spline
    const currentT = kart.state.lapProgress;
    const lookAheadT = currentT + AI_LOOKAHEAD_DISTANCE / spline.totalLength;
    const targetPoint = spline.getPointAt(lookAheadT);

    // Apply lateral offset
    const offsetVec = targetPoint.position.clone()
      .add(targetPoint.binormal.clone().multiplyScalar(this.pathOffset));

    // On anti-gravity the t-based physics handles track following automatically,
    // so the AI just accelerates with no steering (Y-flattened look-ahead breaks
    // on vertical loops where the target is above/below the kart).
    if (kart.state.onAntiGravity) {
      updateKartPhysics(kart.state, 1, 0, 0, false, dt, getSurface);
      return { useItem: false, itemType: null };
    }

    // ── Stuck detection ──
    // Track progress change; if near-zero for a while, the kart is stuck
    const progressDelta = Math.abs(kart.state.lapProgress - this.lastProgressT);
    // Handle wrap-around (0.99 → 0.01)
    const wrappedDelta = Math.min(progressDelta, 1 - progressDelta);
    this.lastProgressT = kart.state.lapProgress;

    if (kart.state.speed < KART_MAX_SPEED * 0.05 && wrappedDelta < 0.0001) {
      this.stuckTimer += dt;
    } else {
      this.stuckTimer = Math.max(0, this.stuckTimer - dt * 2);
    }

    // If stuck for over 1.2s, enter recovery
    if (this.stuckTimer > 1.2) {
      this.stuckRecoveryTimer = 1.0;
      this.stuckTimer = 0;
    }

    if (this.stuckRecoveryTimer > 0) {
      this.stuckRecoveryTimer -= dt;

      // Look slightly ahead on spline to find the track center we should aim for
      const aheadT = currentT + 0.005;
      const sp = spline.getPointAt(aheadT);
      const toCenter = sp.position.clone().sub(kart.state.position);
      toCenter.y = 0;
      const centerAngle = Math.atan2(toCenter.x, toCenter.z);
      const escDiff = angleDiff(kart.state.heading, centerAngle);

      // First phase: reverse to get unstuck. Second phase: drive toward center.
      if (this.stuckRecoveryTimer > 0.6) {
        // Reverse + steer toward center
        const rSteer = clamp(-escDiff * 3, -1, 1);
        updateKartPhysics(kart.state, 0, 0.8, -rSteer, false, dt, getSurface);
      } else {
        // Drive forward toward track center
        const fSteer = clamp(-escDiff * 4, -1, 1);
        updateKartPhysics(kart.state, 1, 0, fSteer, false, dt, getSurface);
      }
      return { useItem: false, itemType: null };
    }

    // Steering
    const toTarget = offsetVec.clone().sub(kart.state.position);
    toTarget.y = 0;
    const targetAngle = Math.atan2(toTarget.x, toTarget.z);
    const diff = angleDiff(kart.state.heading, targetAngle);
    // Adaptive steering gain: stronger for sharper angles and lower speeds
    const steerGain = 2.5 + Math.abs(diff) * 1.5;
    // Negate because physics uses heading -= steer * rate
    const steer = clamp(-diff * steerGain, -1, 1);

    // Acceleration
    const speedRatio = Math.abs(kart.state.speed) / KART_MAX_SPEED;
    let accel = 1;
    let brake = 0;

    // Slow down for sharp turns
    if (Math.abs(diff) > 0.5 && speedRatio > 0.7) {
      accel = 0.5;
      if (Math.abs(diff) > 1.0) {
        brake = 0.3;
        accel = 0;
      }
    }

    // Drift logic
    let driftHeld = false;
    if (this.config.driftSkill > 0.3) {
      const shouldDrift = Math.abs(diff) > 0.4 && kart.state.speed > DRIFT_MIN_SPEED;
      if (shouldDrift) {
        driftHeld = true;
      }
      this.driftSystem.update(kart.state, steer, driftHeld, dt);
    }

    // Apply physics
    updateKartPhysics(kart.state, accel, brake, steer, driftHeld, dt, getSurface);

    // Item usage AI
    if (this.itemUseDelay > 0) {
      this.itemUseDelay -= dt;
    } else if (kart.heldItem) {
      const decision = this.shouldUseItem(kart, allKarts);
      if (decision) {
        useItem = true;
        itemType = kart.heldItem as ItemType;
        kart.heldItem = null;
        this.itemUseDelay = randomRange(1, 3);
      }
    }

    return { useItem, itemType };
  }

  private shouldUseItem(kart: Kart, allKarts: Kart[]): boolean {
    const item = kart.heldItem;
    if (!item) return false;

    switch (item) {
      case 'mushroom':
        // Use on straights
        return Math.random() < 0.3;

      case 'banana':
        // Drop when being chased
        return kart.racePosition <= 3 && Math.random() < 0.2;

      case 'greenShell':
        // Fire when near opponents
        return this.nearbyOpponent(kart, allKarts, 15);

      case 'redShell':
        // Use when not in first
        return kart.racePosition > 1;

      case 'star':
        // Use immediately
        return true;

      case 'lightning':
        // Use when behind
        return kart.racePosition >= 4;

      default:
        return false;
    }
  }

  private nearbyOpponent(kart: Kart, allKarts: Kart[], radius: number): boolean {
    for (const other of allKarts) {
      if (other.index === kart.index) continue;
      const d = kart.state.position.distanceTo(other.state.position);
      if (d < radius) return true;
    }
    return false;
  }

  getDriftSystem(): DriftSystem {
    return this.driftSystem;
  }
}
