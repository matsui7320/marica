import * as THREE from 'three';
import {
  EffectComposer, EffectPass, RenderPass,
  BloomEffect, VignetteEffect, ToneMappingEffect,
  ToneMappingMode,
} from 'postprocessing';

export class PostProcessing {
  readonly composer: EffectComposer;
  private bloomEffect: BloomEffect;
  private vignetteEffect: VignetteEffect;
  private baseBloomIntensity = 0.5;
  private targetBloom = 0.5;
  private targetVignette = 0.4;
  private currentBloom = 0.5;
  private currentVignette = 0.4;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.composer = new EffectComposer(renderer);

    const renderPass = new RenderPass(scene, camera);
    this.composer.addPass(renderPass);

    this.bloomEffect = new BloomEffect({
      intensity: this.baseBloomIntensity,
      luminanceThreshold: 0.55,
      luminanceSmoothing: 0.3,
      mipmapBlur: true,
    });

    this.vignetteEffect = new VignetteEffect({
      darkness: 0.4,
      offset: 0.3,
    });

    const toneMappingEffect = new ToneMappingEffect({
      mode: ToneMappingMode.ACES_FILMIC,
    });

    const effectPass = new EffectPass(camera, this.bloomEffect, this.vignetteEffect, toneMappingEffect);
    this.composer.addPass(effectPass);
  }

  setBoostMode(active: boolean): void {
    this.targetBloom = active ? 1.4 : this.baseBloomIntensity;
    this.targetVignette = active ? 0.65 : 0.4;
  }

  triggerHit(): void {
    // Spike bloom and vignette briefly
    this.currentBloom = 2.0;
    this.currentVignette = 0.8;
  }

  triggerStar(): void {
    this.currentBloom = 1.8;
  }

  render(dt: number): void {
    // Smooth bloom/vignette transitions
    this.currentBloom += (this.targetBloom - this.currentBloom) * Math.min(dt * 6, 1);
    this.currentVignette += (this.targetVignette - this.currentVignette) * Math.min(dt * 6, 1);

    this.bloomEffect.intensity = this.currentBloom;
    this.vignetteEffect.darkness = this.currentVignette;

    this.composer.render(dt);
  }

  setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
  }
}
