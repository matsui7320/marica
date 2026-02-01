import * as THREE from 'three';

const PARTICLE_COUNT = 800;
const BOX_WIDTH = 80;
const BOX_HEIGHT = 40;
const BOX_DEPTH = 80;

export class SnowEffect {
  readonly points: THREE.Points;
  private positions: Float32Array;
  private velocities: Float32Array;

  constructor() {
    this.positions = new Float32Array(PARTICLE_COUNT * 3);
    this.velocities = new Float32Array(PARTICLE_COUNT * 3);

    // Initialize particles randomly within the box (centered at origin)
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      this.positions[i3] = (Math.random() - 0.5) * BOX_WIDTH;
      this.positions[i3 + 1] = Math.random() * BOX_HEIGHT - BOX_HEIGHT * 0.5;
      this.positions[i3 + 2] = (Math.random() - 0.5) * BOX_DEPTH;

      this.velocities[i3] = (Math.random() - 0.5) * 0.6;     // vx: ±0.3
      this.velocities[i3 + 1] = -(2 + Math.random() * 2);     // vy: -2 to -4
      this.velocities[i3 + 2] = (Math.random() - 0.5) * 0.6;  // vz: ±0.3
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0xeeeeff,
      size: 0.15,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
  }

  update(dt: number, cameraPosition: THREE.Vector3): void {
    const halfW = BOX_WIDTH * 0.5;
    const halfH = BOX_HEIGHT * 0.5;
    const halfD = BOX_DEPTH * 0.5;
    const cx = cameraPosition.x;
    const cy = cameraPosition.y;
    const cz = cameraPosition.z;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;

      // Move particle
      this.positions[i3] += this.velocities[i3] * dt;
      this.positions[i3 + 1] += this.velocities[i3 + 1] * dt;
      this.positions[i3 + 2] += this.velocities[i3 + 2] * dt;

      // Check bounds relative to camera and respawn at top
      const rx = this.positions[i3] - cx;
      const ry = this.positions[i3 + 1] - cy;
      const rz = this.positions[i3 + 2] - cz;

      if (ry < -halfH || rx < -halfW || rx > halfW || rz < -halfD || rz > halfD) {
        this.positions[i3] = cx + (Math.random() - 0.5) * BOX_WIDTH;
        this.positions[i3 + 1] = cy + halfH;
        this.positions[i3 + 2] = cz + (Math.random() - 0.5) * BOX_DEPTH;

        this.velocities[i3] = (Math.random() - 0.5) * 0.6;
        this.velocities[i3 + 1] = -(2 + Math.random() * 2);
        this.velocities[i3 + 2] = (Math.random() - 0.5) * 0.6;
      }
    }

    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose(): void {
    this.points.geometry.dispose();
    (this.points.material as THREE.PointsMaterial).dispose();
  }
}
