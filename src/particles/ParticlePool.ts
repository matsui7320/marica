import * as THREE from 'three';
import { PARTICLE_POOL_SIZE } from '../constants';

export interface Particle {
  alive: boolean;
  life: number;
  maxLife: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  size: number;
  color: THREE.Color;
  index: number;
}

export class ParticlePool {
  readonly mesh: THREE.InstancedMesh;
  private particles: Particle[] = [];
  private dummy = new THREE.Object3D();
  private colorAttr: THREE.InstancedBufferAttribute;

  constructor() {
    const geo = new THREE.PlaneGeometry(0.15, 0.15);
    const mat = new THREE.MeshBasicMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexColors: true,
    });

    // Use InstancedMesh with per-instance color
    this.mesh = new THREE.InstancedMesh(geo, mat, PARTICLE_POOL_SIZE);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;

    // Per-instance colors
    const colors = new Float32Array(PARTICLE_POOL_SIZE * 3);
    this.colorAttr = new THREE.InstancedBufferAttribute(colors, 3);
    this.mesh.instanceColor = this.colorAttr;

    // Initialize all particles as dead (zero scale)
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      this.particles.push({
        alive: false,
        life: 0,
        maxLife: 1,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        size: 0.1,
        color: new THREE.Color(1, 1, 1),
        index: i,
      });
      this.dummy.scale.setScalar(0);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  emit(
    position: THREE.Vector3,
    velocity: THREE.Vector3,
    color: THREE.Color,
    size: number,
    lifetime: number,
  ): Particle | null {
    for (const p of this.particles) {
      if (!p.alive) {
        p.alive = true;
        p.life = lifetime;
        p.maxLife = lifetime;
        p.position.copy(position);
        p.velocity.copy(velocity);
        p.size = size;
        p.color.copy(color);
        return p;
      }
    }
    return null;
  }

  update(dt: number, camera: THREE.Camera): void {
    let needsUpdate = false;

    for (const p of this.particles) {
      if (!p.alive) continue;

      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        this.dummy.scale.setScalar(0);
        this.dummy.position.set(0, -1000, 0);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(p.index, this.dummy.matrix);
        needsUpdate = true;
        continue;
      }

      // Move
      p.position.add(p.velocity.clone().multiplyScalar(dt));
      p.velocity.y -= 5 * dt; // gravity

      // Scale by life
      const lifeRatio = p.life / p.maxLife;
      const scale = p.size * lifeRatio;

      this.dummy.position.copy(p.position);
      this.dummy.scale.setScalar(scale);
      // Billboard: face camera
      this.dummy.lookAt(camera.position);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(p.index, this.dummy.matrix);

      // Color with fade
      const ci = p.index * 3;
      this.colorAttr.array[ci] = p.color.r * lifeRatio;
      this.colorAttr.array[ci + 1] = p.color.g * lifeRatio;
      this.colorAttr.array[ci + 2] = p.color.b * lifeRatio;

      needsUpdate = true;
    }

    if (needsUpdate) {
      this.mesh.instanceMatrix.needsUpdate = true;
      this.colorAttr.needsUpdate = true;
    }
  }

  clear(): void {
    for (const p of this.particles) {
      p.alive = false;
    }
  }
}
