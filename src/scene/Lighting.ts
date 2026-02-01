import * as THREE from 'three';

export type EnvType = 'meadow' | 'volcano' | 'coastal' | 'frozen' | 'night';

export class Lighting {
  readonly sunLight: THREE.DirectionalLight;
  readonly ambientLight: THREE.AmbientLight;
  readonly hemisphereLight: THREE.HemisphereLight;
  readonly fillLight: THREE.DirectionalLight;
  readonly rimLight: THREE.DirectionalLight;

  constructor(envType: EnvType = 'meadow') {
    switch (envType) {
      case 'night':
        // Moonlight — dim blue-white
        this.sunLight = new THREE.DirectionalLight(0x8899cc, 0.6);
        this.sunLight.position.set(-80, 140, 60);
        this.fillLight = new THREE.DirectionalLight(0x334466, 0.25);
        this.fillLight.position.set(60, 40, -40);
        this.rimLight = new THREE.DirectionalLight(0x6688bb, 0.2);
        this.rimLight.position.set(-30, 80, -100);
        this.ambientLight = new THREE.AmbientLight(0x101828, 0.5);
        this.hemisphereLight = new THREE.HemisphereLight(0x1a2244, 0x080810, 0.4);
        break;

      case 'frozen':
        // Cold winter light — pale blue-white sun
        this.sunLight = new THREE.DirectionalLight(0xdde8ff, 1.8);
        this.sunLight.position.set(100, 130, 80);
        this.fillLight = new THREE.DirectionalLight(0x99bbdd, 0.5);
        this.fillLight.position.set(-80, 60, -50);
        this.rimLight = new THREE.DirectionalLight(0xbbccee, 0.3);
        this.rimLight.position.set(-30, 100, -100);
        this.ambientLight = new THREE.AmbientLight(0x4060880, 0.5);
        this.hemisphereLight = new THREE.HemisphereLight(0x99bbdd, 0x445566, 0.6);
        break;

      case 'volcano':
        // Hot reddish light with warm ambient
        this.sunLight = new THREE.DirectionalLight(0xffaa66, 1.6);
        this.sunLight.position.set(80, 120, 60);
        this.fillLight = new THREE.DirectionalLight(0xff6633, 0.4);
        this.fillLight.position.set(-60, 30, -40);
        this.rimLight = new THREE.DirectionalLight(0xff8844, 0.3);
        this.rimLight.position.set(-30, 80, -100);
        this.ambientLight = new THREE.AmbientLight(0x402020, 0.5);
        this.hemisphereLight = new THREE.HemisphereLight(0x885533, 0x331a0a, 0.5);
        break;

      case 'coastal':
        // Warm golden light — afternoon sun
        this.sunLight = new THREE.DirectionalLight(0xfff0c0, 2.0);
        this.sunLight.position.set(100, 140, 80);
        this.fillLight = new THREE.DirectionalLight(0x88bbee, 0.45);
        this.fillLight.position.set(-80, 60, -50);
        this.rimLight = new THREE.DirectionalLight(0xffddaa, 0.35);
        this.rimLight.position.set(-30, 100, -100);
        this.ambientLight = new THREE.AmbientLight(0x3a4860, 0.45);
        this.hemisphereLight = new THREE.HemisphereLight(0x88ccee, 0x886644, 0.55);
        break;

      default: // meadow
        this.sunLight = new THREE.DirectionalLight(0xfff0d6, 2.2);
        this.sunLight.position.set(100, 160, 80);
        this.fillLight = new THREE.DirectionalLight(0x8ab4f8, 0.4);
        this.fillLight.position.set(-80, 60, -50);
        this.rimLight = new THREE.DirectionalLight(0xffe8c0, 0.3);
        this.rimLight.position.set(-30, 100, -100);
        this.ambientLight = new THREE.AmbientLight(0x384060, 0.4);
        this.hemisphereLight = new THREE.HemisphereLight(0x88bbee, 0x445522, 0.55);
        break;
    }

    // Shadow setup (shared)
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(4096, 4096);
    this.sunLight.shadow.camera.left = -100;
    this.sunLight.shadow.camera.right = 100;
    this.sunLight.shadow.camera.top = 100;
    this.sunLight.shadow.camera.bottom = -100;
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 500;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
  }

  addTo(scene: THREE.Scene): void {
    scene.add(this.sunLight);
    scene.add(this.sunLight.target);
    scene.add(this.fillLight);
    scene.add(this.rimLight);
    scene.add(this.ambientLight);
    scene.add(this.hemisphereLight);
  }

  updateShadowTarget(x: number, z: number): void {
    this.sunLight.position.set(x + 100, 160, z + 80);
    this.sunLight.target.position.set(x, 0, z);
  }
}
