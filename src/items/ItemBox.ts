import * as THREE from 'three';
import { ITEM_BOX_RESPAWN_TIME } from '../constants';

export class ItemBox {
  readonly mesh: THREE.Group;
  position: THREE.Vector3;
  active = true;
  respawnTimer = 0;
  private time = 0;
  private outerBox: THREE.Mesh;
  private innerGlow: THREE.Mesh;
  private innerRing: THREE.Mesh;
  private orbitals: THREE.Mesh[] = [];
  private questionMarks: THREE.Mesh[] = [];

  constructor(position: THREE.Vector3) {
    this.position = position.clone();
    this.mesh = new THREE.Group();

    // ── Outer box — translucent with wireframe overlay ──
    const outerGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    const outerMat = new THREE.MeshStandardMaterial({
      color: 0xffcc00,
      emissive: 0xff8800,
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.35,
      metalness: 0.3,
      roughness: 0.1,
      side: THREE.DoubleSide,
    });
    this.outerBox = new THREE.Mesh(outerGeo, outerMat);
    this.outerBox.castShadow = true;
    this.mesh.add(this.outerBox);

    // Wireframe overlay for edges
    const wireGeo = new THREE.BoxGeometry(1.52, 1.52, 1.52);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0xffdd44,
      wireframe: true,
      transparent: true,
      opacity: 0.6,
    });
    const wireBox = new THREE.Mesh(wireGeo, wireMat);
    this.mesh.add(wireBox);

    // ── Edge glow bars (12 edges of cube) ──
    const edgeMat = new THREE.MeshBasicMaterial({
      color: 0xffee88,
      transparent: true,
      opacity: 0.5,
    });
    const edgeLen = 1.5;
    const edgeR = 0.025;
    const half = edgeLen / 2;
    // 4 edges along each axis
    const edgePositions: [number, number, number, string][] = [
      // Bottom face edges (Y = -half)
      [-half, -half, 0, 'z'], [half, -half, 0, 'z'],
      [0, -half, -half, 'x'], [0, -half, half, 'x'],
      // Top face edges (Y = +half)
      [-half, half, 0, 'z'], [half, half, 0, 'z'],
      [0, half, -half, 'x'], [0, half, half, 'x'],
      // Vertical edges
      [-half, 0, -half, 'y'], [half, 0, -half, 'y'],
      [-half, 0, half, 'y'], [half, 0, half, 'y'],
    ];
    for (const [ex, ey, ez, axis] of edgePositions) {
      const edgeGeo = new THREE.CylinderGeometry(edgeR, edgeR, edgeLen, 4);
      if (axis === 'x') edgeGeo.rotateZ(Math.PI / 2);
      else if (axis === 'z') edgeGeo.rotateX(Math.PI / 2);
      const edge = new THREE.Mesh(edgeGeo, edgeMat);
      edge.position.set(ex, ey, ez);
      this.mesh.add(edge);
    }

    // ── Inner glow core — icosahedron ──
    const innerGeo = new THREE.IcosahedronGeometry(0.5, 1);
    const innerMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffaa00,
      emissiveIntensity: 1.2,
      transparent: true,
      opacity: 0.85,
    });
    this.innerGlow = new THREE.Mesh(innerGeo, innerMat);
    this.mesh.add(this.innerGlow);

    // ── Inner spinning ring ──
    const ringGeo = new THREE.TorusGeometry(0.55, 0.03, 8, 32);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xffdd00,
      emissive: 0xffaa00,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.7,
    });
    this.innerRing = new THREE.Mesh(ringGeo, ringMat);
    this.mesh.add(this.innerRing);

    // ── Orbiting particles (6 small glowing spheres) ──
    const orbitalGeo = new THREE.SphereGeometry(0.06, 6, 6);
    const orbitalMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
    });
    for (let i = 0; i < 6; i++) {
      const orb = new THREE.Mesh(orbitalGeo, orbitalMat);
      this.orbitals.push(orb);
      this.mesh.add(orb);
    }

    // ── Question mark on all 6 faces ──
    const qCanvas = document.createElement('canvas');
    qCanvas.width = 128;
    qCanvas.height = 128;
    const ctx = qCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, 128, 128);
    // Glow behind text
    const glow = ctx.createRadialGradient(64, 64, 0, 64, 64, 50);
    glow.addColorStop(0, 'rgba(255, 255, 200, 0.4)');
    glow.addColorStop(1, 'rgba(255, 255, 200, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 128, 128);
    // Question mark with outline
    ctx.font = 'bold 90px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 6;
    ctx.strokeText('?', 64, 68);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('?', 64, 68);

    const qTex = new THREE.CanvasTexture(qCanvas);
    const qGeo = new THREE.PlaneGeometry(1.0, 1.0);
    const qMat = new THREE.MeshBasicMaterial({
      map: qTex,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    // Place on all 6 faces
    const faceConfigs: [number, number, number, number, number, number][] = [
      [0, 0, 0.76, 0, 0, 0],           // front
      [0, 0, -0.76, 0, Math.PI, 0],      // back
      [0.76, 0, 0, 0, Math.PI / 2, 0],   // right
      [-0.76, 0, 0, 0, -Math.PI / 2, 0], // left
      [0, 0.76, 0, -Math.PI / 2, 0, 0],  // top
      [0, -0.76, 0, Math.PI / 2, 0, 0],  // bottom
    ];
    for (const [px, py, pz, rx, ry, rz] of faceConfigs) {
      const qm = new THREE.Mesh(qGeo, qMat);
      qm.position.set(px, py, pz);
      qm.rotation.set(rx, ry, rz);
      this.questionMarks.push(qm);
      this.mesh.add(qm);
    }

    this.mesh.position.copy(position);
    this.mesh.position.y += 1.8;
  }

  update(dt: number): void {
    this.time += dt;

    if (this.active) {
      // Rotate and bob
      this.mesh.rotation.y = this.time * 1.2;
      this.mesh.position.y = this.position.y + 1.8 + Math.sin(this.time * 2.5) * 0.3;

      // Inner glow spins multi-axis
      this.innerGlow.rotation.y = -this.time * 2.5;
      this.innerGlow.rotation.x = this.time * 1.8;
      this.innerGlow.rotation.z = this.time * 0.7;

      // Ring tilts and spins
      this.innerRing.rotation.x = Math.sin(this.time * 1.5) * 0.8;
      this.innerRing.rotation.y = this.time * 3;

      // Orbital particles
      for (let i = 0; i < this.orbitals.length; i++) {
        const angle = this.time * 2.5 + (i / this.orbitals.length) * Math.PI * 2;
        const orbitR = 0.8 + Math.sin(this.time * 3 + i) * 0.15;
        const yOff = Math.sin(angle * 1.5 + i) * 0.3;
        this.orbitals[i].position.set(
          Math.cos(angle) * orbitR,
          yOff,
          Math.sin(angle) * orbitR,
        );
      }

      // Rainbow emissive cycle
      const hue = (this.time * 0.35) % 1;
      (this.outerBox.material as THREE.MeshStandardMaterial).emissive.setHSL(hue, 1, 0.5);
      (this.innerGlow.material as THREE.MeshStandardMaterial).emissive.setHSL((hue + 0.5) % 1, 1, 0.55);
      (this.innerRing.material as THREE.MeshStandardMaterial).emissive.setHSL((hue + 0.33) % 1, 1, 0.5);

      // Pulse scale
      const pulse = 1 + Math.sin(this.time * 4) * 0.06;
      this.outerBox.scale.setScalar(pulse);
    } else {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.active = true;
        this.mesh.visible = true;
      }
    }
  }

  collect(): void {
    this.active = false;
    this.mesh.visible = false;
    this.respawnTimer = ITEM_BOX_RESPAWN_TIME;
  }

  checkCollision(kartPos: THREE.Vector3): boolean {
    if (!this.active) return false;
    const dx = kartPos.x - this.position.x;
    const dz = kartPos.z - this.position.z;
    return (dx * dx + dz * dz) < 4;
  }
}
