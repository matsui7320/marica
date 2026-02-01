import * as THREE from 'three';
import { KartMeshes, buildKartMesh } from './KartMeshBuilder';
import { KartState, createKartState, SurfaceInfo } from './KartPhysics';
// Headlight shader uniforms are updated in RaceManager.updateRender()

// Reusable temp objects to avoid per-frame allocations
const _qA = new THREE.Quaternion();
const _qB = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _worldUp = new THREE.Vector3(0, 1, 0);

export class Kart {
  readonly meshes: KartMeshes;
  readonly state: KartState;
  readonly index: number;
  readonly isPlayer: boolean;

  // Interpolated position for rendering
  readonly renderPosition = new THREE.Vector3();
  readonly renderQuaternion = new THREE.Quaternion();
  readonly forward = new THREE.Vector3(0, 0, -1);
  // Smoothed surface normal for visual tilt (avoids jitter)
  private smoothNormal = new THREE.Vector3(0, 1, 0);

  // Headlight state
  private headlightsActive = false;
  // PointLight for illuminating surroundings (guardrails, other karts)
  private headlightPoint: THREE.PointLight | null = null;

  // Item state
  heldItem: string | null = null;
  isDefending = false;

  // Race state
  currentLap = 0;
  lastCheckpoint = -1;
  checkpointsThisLap = new Set<number>();
  finished = false;
  finishTime = 0;
  racePosition = 1;

  constructor(index: number, color: number, isPlayer: boolean) {
    this.index = index;
    this.isPlayer = isPlayer;
    this.meshes = buildKartMesh(color);
    this.state = createKartState();
  }

  interpolateRender(alpha: number): void {
    this.renderPosition.lerpVectors(this.state.prevPosition, this.state.position, alpha);
    this.meshes.group.position.copy(this.renderPosition);

    if (this.state.onAntiGravity) {
      // Anti-gravity: orient kart to track surface with steering lean
      const up = this.state.trackNormal.clone();
      const tangent = this.state.trackTangent.clone();
      const right = new THREE.Vector3().crossVectors(up, tangent).normalize();
      const back = new THREE.Vector3().crossVectors(right, up).normalize();

      // Apply steering yaw: rotate tangent/right around the surface normal
      const steerYaw = -this.state.steerAngle * 0.25;
      if (Math.abs(steerYaw) > 0.001) {
        const yawQuat = new THREE.Quaternion().setFromAxisAngle(up, steerYaw);
        right.applyQuaternion(yawQuat);
        back.applyQuaternion(yawQuat);
      }

      const m4 = new THREE.Matrix4().makeBasis(right, up, back);
      this.renderQuaternion.setFromRotationMatrix(m4);
      this.forward.copy(tangent);
    } else {
      // Normal road: heading rotation + surface tilt
      const fwd = new THREE.Vector3(Math.sin(this.state.heading), 0, Math.cos(this.state.heading));
      this.forward.copy(fwd);

      // Smooth the surface normal to avoid jitter
      this.smoothNormal.lerp(this.state.trackNormal, 0.15).normalize();

      // 1) Heading rotation (always correct, original logic)
      const renderHeading = this.state.heading + Math.PI;
      const headingQuat = _qA.setFromEuler(_euler.set(0, renderHeading, 0));

      // 2) Tilt: rotate world-up to the smoothed surface normal
      const tiltQuat = _qB.setFromUnitVectors(_worldUp, this.smoothNormal);

      // 3) Combine: first heading, then tilt
      this.renderQuaternion.copy(tiltQuat).multiply(headingQuat);
    }
    this.meshes.group.quaternion.copy(this.renderQuaternion);

    // Scale when shrunk
    if (this.state.shrinkTimer > 0) {
      this.meshes.group.scale.setScalar(0.5);
    } else {
      this.meshes.group.scale.setScalar(1);
    }

    // Update PointLight position
    if (this.headlightsActive) {
      this.updatePointLight();
    }
  }

  private updatePointLight(): void {
    if (!this.headlightPoint) return;
    const sinH = Math.sin(this.state.heading);
    const cosH = Math.cos(this.state.heading);

    // Place light ahead of the kart
    const ahead = this.isPlayer ? 6 : 4;
    this.headlightPoint.position.set(
      this.renderPosition.x + sinH * ahead,
      this.renderPosition.y + 1.2,
      this.renderPosition.z + cosH * ahead,
    );
  }

  setHeadlights(on: boolean): void {
    this.headlightsActive = on;

    // PointLight intensity: player brighter, NPC softer
    if (this.headlightPoint) {
      this.headlightPoint.intensity = on ? (this.isPlayer ? 2.0 : 1.0) : 0;
    }

    // Lens glow visual
    for (const lens of this.meshes.headlightLenses) {
      const mat = lens.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = on ? 2.5 : 0.8;
    }
    // Tail lights
    this.meshes.taillightMat.emissiveIntensity = on ? 1.5 : 0.6;
  }

  addToScene(scene: THREE.Scene): void {
    scene.add(this.meshes.group);
  }

  /** Create headlight PointLight — call after addToScene, only for dark stages */
  enableHeadlightPoint(scene: THREE.Scene): void {
    if (this.headlightPoint) return;
    const range = this.isPlayer ? 25 : 15;
    const pl = new THREE.PointLight(0xfff4e0, 0, range, 1.5);
    pl.castShadow = false;
    scene.add(pl);
    this.headlightPoint = pl;
  }

  removeFromScene(scene: THREE.Scene): void {
    scene.remove(this.meshes.group);
    if (this.headlightPoint) {
      this.headlightPoint.dispose();
      scene.remove(this.headlightPoint);
      this.headlightPoint = null;
    }
  }

  setStartPosition(position: THREE.Vector3, heading: number): void {
    this.state.position.copy(position);
    this.state.prevPosition.copy(position);
    this.state.heading = heading;
    this.state.speed = 0;
    this.state.velocity.set(0, 0, 0);
    this.renderPosition.copy(position);
    this.meshes.group.position.copy(position);
    this.meshes.group.rotation.y = heading + Math.PI;

    this.smoothNormal.set(0, 1, 0);
    this.currentLap = 0;
    this.lastCheckpoint = -1;
    this.checkpointsThisLap.clear();
    this.finished = false;
    this.finishTime = 0;
    this.heldItem = null;
    this.isDefending = false;
  }
}
