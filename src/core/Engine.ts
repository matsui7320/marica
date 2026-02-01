import * as THREE from 'three';

export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly container: HTMLElement;
  private animationId = 0;
  private frameCallback: ((time: number) => void) | null = null;

  constructor() {
    this.container = document.getElementById('game-container')!;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    window.addEventListener('resize', this.onResize);
  }

  private onResize = (): void => {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  start(callback: (time: number) => void): void {
    this.frameCallback = callback;
    const loop = (time: number) => {
      this.animationId = requestAnimationFrame(loop);
      this.frameCallback!(time);
    };
    this.animationId = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.animationId);
  }

  get width(): number { return window.innerWidth; }
  get height(): number { return window.innerHeight; }
  get aspect(): number { return window.innerWidth / window.innerHeight; }

  dispose(): void {
    this.stop();
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}
