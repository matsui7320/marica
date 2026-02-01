import * as THREE from 'three';

const EMBER_COUNT = 500;
const ASH_COUNT = 300;
const BOX_W = 80;
const BOX_H = 50;
const BOX_D = 80;

const EMBER_PALETTE = [
  new THREE.Color(0xff6622),
  new THREE.Color(0xff3311),
  new THREE.Color(0xffaa33),
  new THREE.Color(0xff4400),
  new THREE.Color(0xffcc11),
];

export class VolcanoEffect {
  readonly emberPoints: THREE.Points;
  readonly ashPoints: THREE.Points;

  private ePos: Float32Array;
  private eVel: Float32Array;
  private aPos: Float32Array;
  private aVel: Float32Array;

  constructor() {
    // ── Embers (rising bright particles) ──
    this.ePos = new Float32Array(EMBER_COUNT * 3);
    this.eVel = new Float32Array(EMBER_COUNT * 3);
    const eCol = new Float32Array(EMBER_COUNT * 3);

    for (let i = 0; i < EMBER_COUNT; i++) {
      const i3 = i * 3;
      this.ePos[i3]     = (Math.random() - 0.5) * BOX_W;
      this.ePos[i3 + 1] = Math.random() * BOX_H - BOX_H * 0.5;
      this.ePos[i3 + 2] = (Math.random() - 0.5) * BOX_D;

      this.eVel[i3]     = (Math.random() - 0.5) * 1.0;
      this.eVel[i3 + 1] = 1 + Math.random() * 3;
      this.eVel[i3 + 2] = (Math.random() - 0.5) * 1.0;

      const c = EMBER_PALETTE[Math.floor(Math.random() * EMBER_PALETTE.length)];
      eCol[i3] = c.r; eCol[i3 + 1] = c.g; eCol[i3 + 2] = c.b;
    }

    const eGeo = new THREE.BufferGeometry();
    eGeo.setAttribute('position', new THREE.BufferAttribute(this.ePos, 3));
    eGeo.setAttribute('color', new THREE.BufferAttribute(eCol, 3));

    this.emberPoints = new THREE.Points(eGeo, new THREE.PointsMaterial({
      size: 0.18,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    }));
    this.emberPoints.frustumCulled = false;

    // ── Ash (slowly falling grey flecks) ──
    this.aPos = new Float32Array(ASH_COUNT * 3);
    this.aVel = new Float32Array(ASH_COUNT * 3);

    for (let i = 0; i < ASH_COUNT; i++) {
      const i3 = i * 3;
      this.aPos[i3]     = (Math.random() - 0.5) * BOX_W;
      this.aPos[i3 + 1] = Math.random() * BOX_H - BOX_H * 0.5;
      this.aPos[i3 + 2] = (Math.random() - 0.5) * BOX_D;

      this.aVel[i3]     = (Math.random() - 0.5) * 0.4;
      this.aVel[i3 + 1] = -(0.3 + Math.random() * 0.5);
      this.aVel[i3 + 2] = (Math.random() - 0.5) * 0.4;
    }

    const aGeo = new THREE.BufferGeometry();
    aGeo.setAttribute('position', new THREE.BufferAttribute(this.aPos, 3));

    this.ashPoints = new THREE.Points(aGeo, new THREE.PointsMaterial({
      color: 0x555555,
      size: 0.12,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      sizeAttenuation: true,
    }));
    this.ashPoints.frustumCulled = false;
  }

  update(dt: number, cameraPosition: THREE.Vector3): void {
    const hW = BOX_W * 0.5, hH = BOX_H * 0.5, hD = BOX_D * 0.5;
    const cx = cameraPosition.x, cy = cameraPosition.y, cz = cameraPosition.z;

    // Embers — rise with turbulence
    for (let i = 0; i < EMBER_COUNT; i++) {
      const i3 = i * 3;
      this.eVel[i3]     += (Math.random() - 0.5) * 2.0 * dt;
      this.eVel[i3 + 2] += (Math.random() - 0.5) * 2.0 * dt;
      this.eVel[i3]     = Math.max(-1.5, Math.min(1.5, this.eVel[i3]));
      this.eVel[i3 + 2] = Math.max(-1.5, Math.min(1.5, this.eVel[i3 + 2]));

      this.ePos[i3]     += this.eVel[i3] * dt;
      this.ePos[i3 + 1] += this.eVel[i3 + 1] * dt;
      this.ePos[i3 + 2] += this.eVel[i3 + 2] * dt;

      const ry = this.ePos[i3 + 1] - cy;
      if (ry > hH
        || this.ePos[i3] - cx < -hW || this.ePos[i3] - cx > hW
        || this.ePos[i3 + 2] - cz < -hD || this.ePos[i3 + 2] - cz > hD) {
        this.ePos[i3]     = cx + (Math.random() - 0.5) * BOX_W;
        this.ePos[i3 + 1] = cy - hH;
        this.ePos[i3 + 2] = cz + (Math.random() - 0.5) * BOX_D;
        this.eVel[i3]     = (Math.random() - 0.5) * 1.0;
        this.eVel[i3 + 1] = 1 + Math.random() * 3;
        this.eVel[i3 + 2] = (Math.random() - 0.5) * 1.0;
      }
    }
    (this.emberPoints.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;

    // Ash — drift down
    for (let i = 0; i < ASH_COUNT; i++) {
      const i3 = i * 3;
      this.aVel[i3]     += (Math.random() - 0.5) * 0.5 * dt;
      this.aVel[i3 + 2] += (Math.random() - 0.5) * 0.5 * dt;
      this.aVel[i3]     = Math.max(-0.5, Math.min(0.5, this.aVel[i3]));
      this.aVel[i3 + 2] = Math.max(-0.5, Math.min(0.5, this.aVel[i3 + 2]));

      this.aPos[i3]     += this.aVel[i3] * dt;
      this.aPos[i3 + 1] += this.aVel[i3 + 1] * dt;
      this.aPos[i3 + 2] += this.aVel[i3 + 2] * dt;

      const ry = this.aPos[i3 + 1] - cy;
      if (ry < -hH
        || this.aPos[i3] - cx < -hW || this.aPos[i3] - cx > hW
        || this.aPos[i3 + 2] - cz < -hD || this.aPos[i3 + 2] - cz > hD) {
        this.aPos[i3]     = cx + (Math.random() - 0.5) * BOX_W;
        this.aPos[i3 + 1] = cy + hH;
        this.aPos[i3 + 2] = cz + (Math.random() - 0.5) * BOX_D;
        this.aVel[i3]     = (Math.random() - 0.5) * 0.4;
        this.aVel[i3 + 1] = -(0.3 + Math.random() * 0.5);
        this.aVel[i3 + 2] = (Math.random() - 0.5) * 0.4;
      }
    }
    (this.ashPoints.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose(): void {
    this.emberPoints.geometry.dispose();
    (this.emberPoints.material as THREE.PointsMaterial).dispose();
    this.ashPoints.geometry.dispose();
    (this.ashPoints.material as THREE.PointsMaterial).dispose();
  }
}
