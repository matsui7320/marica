import * as THREE from 'three';

export type EnvType = 'meadow' | 'volcano' | 'coastal' | 'frozen' | 'night';

export class SkyBox {
  readonly mesh: THREE.Mesh;

  constructor(envType: EnvType = 'meadow') {
    const res = envType === 'night' ? 4096 : 512;
    const canvas = document.createElement('canvas');
    canvas.width = res;
    canvas.height = res;
    const ctx = canvas.getContext('2d')!;
    const rng = mulberry32(99);

    switch (envType) {
      case 'night':
        this.drawNightSky(ctx, rng);
        break;
      case 'frozen':
        this.drawFrozenSky(ctx, rng);
        break;
      case 'volcano':
        this.drawVolcanoSky(ctx, rng);
        break;
      case 'coastal':
        this.drawCoastalSky(ctx, rng);
        break;
      default:
        this.drawMeadowSky(ctx, rng);
        break;
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.LinearFilter;

    const geo = new THREE.SphereGeometry(800, 32, 32);
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(geo, mat);
  }

  // ── Meadow: bright blue day with sun and fluffy clouds ──
  private drawMeadowSky(ctx: CanvasRenderingContext2D, rng: () => number): void {
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, '#0a1855');
    gradient.addColorStop(0.12, '#1842a0');
    gradient.addColorStop(0.28, '#2e72d0');
    gradient.addColorStop(0.42, '#4a9ae8');
    gradient.addColorStop(0.55, '#5cb8f0');
    gradient.addColorStop(0.68, '#82ccf4');
    gradient.addColorStop(0.82, '#aaddfa');
    gradient.addColorStop(1.0, '#cceeff');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);

    // Sun glow
    this.drawSunGlow(ctx, 380, 180, '#ffffdc', '#ffc864');

    // Fluffy clouds
    this.drawClouds(ctx, rng, 18, 'rgba(255,255,255,', 200, 180);

    // Faint stars in upper portion
    this.drawStars(ctx, rng, 30, 120, 0.3, 0.5);
  }

  // ── Volcano: fiery orange-red sky with ash clouds ──
  private drawVolcanoSky(ctx: CanvasRenderingContext2D, rng: () => number): void {
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, '#1a0808');
    gradient.addColorStop(0.15, '#3a1212');
    gradient.addColorStop(0.3, '#6a2020');
    gradient.addColorStop(0.45, '#8a3a1a');
    gradient.addColorStop(0.6, '#a85522');
    gradient.addColorStop(0.75, '#c07730');
    gradient.addColorStop(0.88, '#cc8844');
    gradient.addColorStop(1.0, '#aa6633');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);

    // Lava glow on horizon
    const lavaGrad = ctx.createRadialGradient(256, 480, 0, 256, 480, 250);
    lavaGrad.addColorStop(0, 'rgba(255,100,20,0.4)');
    lavaGrad.addColorStop(0.5, 'rgba(200,60,10,0.15)');
    lavaGrad.addColorStop(1.0, 'rgba(200,60,10,0)');
    ctx.fillStyle = lavaGrad;
    ctx.fillRect(0, 0, 512, 512);

    // Dark ash clouds
    this.drawClouds(ctx, rng, 14, 'rgba(60,40,30,', 220, 200);

    // Embers / floating sparks
    for (let i = 0; i < 40; i++) {
      const x = rng() * 512;
      const y = 280 + rng() * 200;
      const r = 0.5 + rng() * 1.5;
      const a = 0.3 + rng() * 0.5;
      ctx.fillStyle = `rgba(255,${100 + Math.floor(rng() * 100)},20,${a})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Coastal: warm sunset sky with golden light ──
  private drawCoastalSky(ctx: CanvasRenderingContext2D, rng: () => number): void {
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, '#0c1a44');
    gradient.addColorStop(0.1, '#1a3a88');
    gradient.addColorStop(0.25, '#2868c0');
    gradient.addColorStop(0.4, '#3a90dd');
    gradient.addColorStop(0.55, '#55b8ee');
    gradient.addColorStop(0.7, '#88ccee');
    gradient.addColorStop(0.82, '#bbddee');
    gradient.addColorStop(0.92, '#ffeedd');
    gradient.addColorStop(1.0, '#ffcc99');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);

    // Sun near horizon — golden
    this.drawSunGlow(ctx, 300, 420, '#ffffcc', '#ffaa44');

    // Warm-tinted clouds
    this.drawClouds(ctx, rng, 12, 'rgba(255,240,220,', 240, 180);

    // Seabirds (V-shapes)
    ctx.strokeStyle = 'rgba(40,40,60,0.25)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const bx = 100 + rng() * 300;
      const by = 200 + rng() * 120;
      const bw = 6 + rng() * 10;
      ctx.beginPath();
      ctx.moveTo(bx - bw, by + 3);
      ctx.quadraticCurveTo(bx, by - 3, bx + bw, by + 3);
      ctx.stroke();
    }
  }

  // ── Frozen: pale wintery sky with aurora hints ──
  private drawFrozenSky(ctx: CanvasRenderingContext2D, rng: () => number): void {
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, '#0a1030');
    gradient.addColorStop(0.1, '#162050');
    gradient.addColorStop(0.22, '#1c3872');
    gradient.addColorStop(0.35, '#305888');
    gradient.addColorStop(0.5, '#5088aa');
    gradient.addColorStop(0.65, '#78aabb');
    gradient.addColorStop(0.78, '#a0ccdd');
    gradient.addColorStop(0.9, '#c8e0ea');
    gradient.addColorStop(1.0, '#e0eef5');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);

    // Pale sun
    this.drawSunGlow(ctx, 400, 200, 'rgba(255,255,240,0.6)', 'rgba(200,220,255,0)');

    // Aurora borealis bands
    for (let band = 0; band < 3; band++) {
      const y = 40 + band * 50 + rng() * 40;
      ctx.save();
      ctx.globalAlpha = 0.06 + rng() * 0.08;
      const aGrad = ctx.createLinearGradient(0, y - 30, 0, y + 30);
      const hue = 120 + band * 40 + rng() * 30; // greens to teals
      aGrad.addColorStop(0, `hsla(${hue},80%,60%,0)`);
      aGrad.addColorStop(0.3, `hsla(${hue},80%,60%,1)`);
      aGrad.addColorStop(0.5, `hsla(${hue + 20},70%,70%,1)`);
      aGrad.addColorStop(0.7, `hsla(${hue},80%,60%,1)`);
      aGrad.addColorStop(1, `hsla(${hue},80%,60%,0)`);
      ctx.fillStyle = aGrad;
      // Wavy band
      ctx.beginPath();
      ctx.moveTo(0, y + 30);
      for (let x = 0; x <= 512; x += 4) {
        const wave = Math.sin(x * 0.015 + band * 2) * 15 + Math.sin(x * 0.04 + band) * 5;
        ctx.lineTo(x, y + wave);
      }
      ctx.lineTo(512, y + 30);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Ice crystals / snowflakes
    for (let i = 0; i < 50; i++) {
      const x = rng() * 512;
      const y = rng() * 400;
      const r = 0.5 + rng() * 1.5;
      const a = 0.2 + rng() * 0.5;
      ctx.fillStyle = `rgba(200,230,255,${a})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Thin clouds
    this.drawClouds(ctx, rng, 8, 'rgba(200,220,240,', 180, 200);
  }

  // ── Night: 4096x4096 fine pinpoint starfield ──
  private drawNightSky(ctx: CanvasRenderingContext2D, rng: () => number): void {
    const S = 4096;

    // Deep space gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, S);
    gradient.addColorStop(0, '#010008');
    gradient.addColorStop(0.1, '#020214');
    gradient.addColorStop(0.25, '#040422');
    gradient.addColorStop(0.4, '#06062e');
    gradient.addColorStop(0.55, '#080838');
    gradient.addColorStop(0.7, '#0a0c40');
    gradient.addColorStop(0.85, '#0c1244');
    gradient.addColorStop(1.0, '#070e28');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, S, S);

    // ── Subtle nebula tints ──
    for (let n = 0; n < 6; n++) {
      const nx = rng() * S;
      const ny = rng() * S * 0.75;
      const nr = 200 + rng() * 400;
      const hue = rng() * 360;
      const nGrad = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
      nGrad.addColorStop(0, `hsla(${hue},50%,25%,0.025)`);
      nGrad.addColorStop(0.6, `hsla(${hue},40%,20%,0.01)`);
      nGrad.addColorStop(1, `hsla(${hue},40%,20%,0)`);
      ctx.fillStyle = nGrad;
      ctx.fillRect(0, 0, S, S);
    }

    // ── Milky Way — diagonal band of dense fine dust ──
    ctx.save();
    ctx.translate(S / 2, S / 2);
    ctx.rotate(-0.45);
    ctx.translate(-S / 2, -S / 2);

    // Glow layers
    for (let layer = 0; layer < 3; layer++) {
      const bandY = S * 0.4;
      const bandH = 350 + layer * 150;
      const mwGrad = ctx.createLinearGradient(0, bandY - bandH, 0, bandY + bandH);
      const a = 0.02 - layer * 0.005;
      mwGrad.addColorStop(0, 'rgba(70,90,170,0)');
      mwGrad.addColorStop(0.3, `rgba(80,100,190,${a})`);
      mwGrad.addColorStop(0.5, `rgba(100,120,210,${a * 1.4})`);
      mwGrad.addColorStop(0.7, `rgba(80,100,190,${a})`);
      mwGrad.addColorStop(1, 'rgba(70,90,170,0)');
      ctx.fillStyle = mwGrad;
      ctx.fillRect(0, 0, S, S);
    }

    // Dense Milky Way fine dust — many tiny points
    for (let i = 0; i < 8000; i++) {
      const x = rng() * S;
      const spread = (rng() + rng() + rng()) / 3;
      const y = S * 0.4 + (spread - 0.5) * 800;
      const r = 0.2 + rng() * 0.8;
      const a = 0.03 + rng() * 0.1;
      const hue = 195 + rng() * 70;
      ctx.fillStyle = `hsla(${hue},35%,78%,${a})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Star color palette
    const starColors = [
      'rgba(255,255,255,',
      'rgba(215,228,255,',
      'rgba(255,248,220,',
      'rgba(180,200,255,',
      'rgba(255,215,190,',
      'rgba(210,255,245,',
    ];

    // ── Layer 1: Massive field of faint pinpoint stars ──
    for (let i = 0; i < 12000; i++) {
      const x = rng() * S;
      const y = rng() * (S * 0.96);
      const r = 0.2 + rng() * 0.6;
      const a = 0.08 + rng() * 0.25;
      ctx.fillStyle = `rgba(210,218,240,${a})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Layer 2: Visible small stars with slight color ──
    for (let i = 0; i < 3000; i++) {
      const x = rng() * S;
      const y = rng() * (S * 0.94);
      const r = 0.4 + rng() * 1.0;
      const a = 0.3 + rng() * 0.6;
      const c = starColors[Math.floor(rng() * starColors.length)];
      ctx.fillStyle = `${c}${a})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Layer 3: Slightly brighter stars (still small, no spikes) ──
    for (let i = 0; i < 400; i++) {
      const x = rng() * S;
      const y = rng() * (S * 0.92);
      const r = 0.8 + rng() * 1.4;
      const a = 0.5 + rng() * 0.5;
      const c = starColors[Math.floor(rng() * starColors.length)];

      // Tiny soft glow
      const gGrad = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
      gGrad.addColorStop(0, `${c}${a * 0.5})`);
      gGrad.addColorStop(0.5, `${c}${a * 0.1})`);
      gGrad.addColorStop(1, `${c}0)`);
      ctx.fillStyle = gGrad;
      ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);

      // Core dot
      ctx.fillStyle = `${c}${a})`;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // (Shooting stars are now handled by MeteorShowerEffect as animated particles)

    // ── Moon — small crescent ──
    const mx = S * 0.06, my = S * 0.05, mr = S * 0.018;
    const moonGlow = ctx.createRadialGradient(mx, my, 0, mx, my, mr * 5);
    moonGlow.addColorStop(0, 'rgba(180,200,255,0.08)');
    moonGlow.addColorStop(0.5, 'rgba(150,180,255,0.02)');
    moonGlow.addColorStop(1, 'rgba(150,180,255,0)');
    ctx.fillStyle = moonGlow;
    ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = '#dde6ff';
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#050818';
    ctx.beginPath();
    ctx.arc(mx + mr * 0.35, my - mr * 0.1, mr * 0.88, 0, Math.PI * 2);
    ctx.fill();

    // ── Horizon glow ──
    const hzGrad = ctx.createLinearGradient(0, S * 0.9, 0, S);
    hzGrad.addColorStop(0, 'rgba(8,12,35,0)');
    hzGrad.addColorStop(0.6, 'rgba(10,16,45,0.2)');
    hzGrad.addColorStop(1, 'rgba(6,10,30,0.4)');
    ctx.fillStyle = hzGrad;
    ctx.fillRect(0, 0, S, S);
  }

  // ── Helpers ──

  private drawSunGlow(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    inner: string, outer: string,
  ): void {
    const grad = ctx.createRadialGradient(x, y, 0, x, y, 80);
    grad.addColorStop(0, inner);
    grad.addColorStop(0.2, inner.replace('0.9)', '0.5)').replace(')', ')'));
    grad.addColorStop(0.5, outer.replace(')', '').includes('rgba') ? outer : `${outer}44`);
    grad.addColorStop(1.0, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);
  }

  private drawClouds(
    ctx: CanvasRenderingContext2D, rng: () => number,
    count: number, colorPrefix: string,
    baseY: number, rangeY: number,
  ): void {
    for (let i = 0; i < count; i++) {
      const cx = rng() * 512;
      const cy = baseY + rng() * rangeY;
      const w = 40 + rng() * 80;
      const h = 15 + rng() * 25;
      const alpha = 0.15 + rng() * 0.25;
      const puffs = 3 + Math.floor(rng() * 4);
      for (let p = 0; p < puffs; p++) {
        const px = cx + (rng() - 0.5) * w * 0.8;
        const py = cy + (rng() - 0.5) * h * 0.5;
        const pr = 12 + rng() * 25;
        const cloudGrad = ctx.createRadialGradient(px, py, 0, px, py, pr);
        cloudGrad.addColorStop(0, `${colorPrefix}${alpha})`);
        cloudGrad.addColorStop(0.6, `${colorPrefix}${alpha * 0.5})`);
        cloudGrad.addColorStop(1.0, `${colorPrefix}0)`);
        ctx.fillStyle = cloudGrad;
        ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
      }
    }
  }

  private drawStars(
    ctx: CanvasRenderingContext2D, rng: () => number,
    count: number, maxY: number,
    minAlpha: number, alphaRange: number,
  ): void {
    for (let i = 0; i < count; i++) {
      const sx = rng() * 512;
      const sy = rng() * maxY;
      const sr = 0.5 + rng() * 1.2;
      const sa = minAlpha + rng() * alphaRange;
      ctx.fillStyle = `rgba(255, 255, 255, ${sa})`;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  dispose(): void {
    (this.mesh.material as THREE.MeshBasicMaterial).map?.dispose();
    (this.mesh.material as THREE.MeshBasicMaterial).dispose();
    this.mesh.geometry.dispose();
  }
}

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
