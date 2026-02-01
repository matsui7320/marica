import * as THREE from 'three';

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = `
  uniform float intensity;
  uniform float time;
  uniform float hitFlash;
  uniform vec3 tintColor;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center);
    float angle = atan(center.y, center.x);

    // Multiple layers of radial lines at different scales
    float lines1 = sin(angle * 40.0 + time * 5.0) * 0.5 + 0.5;
    lines1 = pow(lines1, 6.0);

    float lines2 = sin(angle * 80.0 - time * 8.0) * 0.5 + 0.5;
    lines2 = pow(lines2, 10.0);

    float lines3 = sin(angle * 20.0 + time * 3.0) * 0.5 + 0.5;
    lines3 = pow(lines3, 4.0) * 0.5;

    float lines = lines1 + lines2 * 0.4 + lines3 * 0.3;

    // Edge mask with falloff
    float edgeMask = smoothstep(0.15, 0.45, dist);
    float outerFade = smoothstep(0.5, 0.35, dist) * 0.3 + 0.7;

    // Animated flicker
    float flicker = hash(vec2(floor(angle * 20.0), floor(time * 12.0)));
    flicker = step(0.5, flicker);

    // Streaks — long thin lines
    float streak = smoothstep(0.48, 0.5, dist) * pow(lines1, 2.0) * 0.6;

    float alpha = (lines * edgeMask * outerFade * flicker + streak) * intensity;

    // Tint color with white core
    vec3 col = mix(tintColor, vec3(1.0), 0.5 + lines2 * 0.5);

    // Hit flash overlay
    if (hitFlash > 0.0) {
      col = mix(col, vec3(1.0, 0.3, 0.1), hitFlash * 0.5);
      alpha = max(alpha, hitFlash * edgeMask * 0.6);
    }

    gl_FragColor = vec4(col, alpha * 0.45);
  }
`;

export class SpeedLines {
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private _intensity = 0;
  private _hitFlash = 0;

  constructor() {
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        intensity: { value: 0 },
        time: { value: 0 },
        hitFlash: { value: 0 },
        tintColor: { value: new THREE.Color(1, 1, 1) },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const geo = new THREE.PlaneGeometry(2, 2);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 999;
  }

  update(dt: number, isBoosting: boolean): void {
    const target = isBoosting ? 1 : 0;
    this._intensity += (target - this._intensity) * 5 * dt;
    this.material.uniforms.intensity.value = this._intensity;
    this.material.uniforms.time.value += dt;

    // Hit flash decay
    if (this._hitFlash > 0) {
      this._hitFlash = Math.max(0, this._hitFlash - dt * 3);
      this.material.uniforms.hitFlash.value = this._hitFlash;
    }
  }

  triggerHit(): void {
    this._hitFlash = 1;
    this.material.uniforms.hitFlash.value = 1;
  }

  setTint(r: number, g: number, b: number): void {
    (this.material.uniforms.tintColor.value as THREE.Color).setRGB(r, g, b);
  }

  dispose(): void {
    this.material.dispose();
    this.mesh.geometry.dispose();
  }
}
