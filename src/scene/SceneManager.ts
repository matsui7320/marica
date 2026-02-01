import * as THREE from 'three';

export type EnvType = 'meadow' | 'volcano' | 'coastal' | 'frozen' | 'night';

const FOG_CONFIG: Record<EnvType, { color: number; density: number }> = {
  meadow:  { color: 0x87CEEB, density: 0.003 },
  volcano: { color: 0x885533, density: 0.005 },
  coastal: { color: 0x4db8ff, density: 0.0018 },
  frozen:  { color: 0xc0d8e8, density: 0.004 },
  night:   { color: 0x060818, density: 0.0035 },
};

export class SceneManager {
  readonly scene: THREE.Scene;

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.003);
    this.scene.background = new THREE.Color(0x87CEEB);
  }

  setEnvironment(envType: EnvType): void {
    const cfg = FOG_CONFIG[envType];
    (this.scene.fog as THREE.FogExp2).color.setHex(cfg.color);
    (this.scene.fog as THREE.FogExp2).density = cfg.density;
    (this.scene.background as THREE.Color).setHex(cfg.color);
  }

  add(object: THREE.Object3D): void {
    this.scene.add(object);
  }

  remove(object: THREE.Object3D): void {
    this.scene.remove(object);
  }

  clear(): void {
    while (this.scene.children.length > 0) {
      this.scene.remove(this.scene.children[0]);
    }
  }
}
