import * as THREE from 'three';
import { Kart } from '../kart/Kart';

export class ItemDefense {
  readonly mesh: THREE.Mesh | null;
  private kart: Kart;
  private itemType: string;
  active = true;

  constructor(kart: Kart, itemType: string) {
    this.kart = kart;
    this.itemType = itemType;

    if (itemType === 'banana') {
      const geo = new THREE.TorusGeometry(0.3, 0.12, 8, 12, Math.PI * 1.5);
      const mat = new THREE.MeshStandardMaterial({ color: 0xffdd00 });
      this.mesh = new THREE.Mesh(geo, mat);
    } else if (itemType === 'greenShell' || itemType === 'redShell') {
      const geo = new THREE.SphereGeometry(0.4, 12, 12);
      const color = itemType === 'greenShell' ? 0x00aa44 : 0xcc0000;
      const mat = new THREE.MeshStandardMaterial({ color });
      this.mesh = new THREE.Mesh(geo, mat);
    } else {
      this.mesh = null;
    }
  }

  update(): void {
    if (!this.mesh || !this.active) return;
    // Position behind kart
    const behind = this.kart.forward.clone().multiplyScalar(1.5);
    this.mesh.position.copy(this.kart.renderPosition).add(behind);
    this.mesh.position.y += 0.5;
    this.mesh.rotation.y += 0.05;
  }

  destroy(): void {
    this.active = false;
    if (this.mesh) {
      this.mesh.visible = false;
    }
  }

  getType(): string {
    return this.itemType;
  }
}
