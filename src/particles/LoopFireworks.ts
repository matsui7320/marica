import * as THREE from 'three';

/**
 * High-quality fireworks display triggered when the player enters the vertical loop.
 * Ground-level bursts across a wide area, viewed from above on the loop.
 *
 * 12 Shell types: chrysanthemum, peony, ring, willow, kamuro, crossette, brocade,
 *                 palm, dahlia, strobe, horsetail, tourbillon
 * Features: glow texture, per-particle twinkle, warm colour fade, additive glow,
 *           golden waterfalls, multi-layer bursts.
 */

// ── Tunables ────────────────────────────────────────────────
const MAX_P       = 6000;
const FW_GRAVITY  = 7.0;

// Starlight Highway vertical-loop centre
const LCX = -152.5;
const LCZ = -376;

// ── Shell catalogue ─────────────────────────────────────────
type ShellType =
  | 'chrysanthemum' | 'peony' | 'ring' | 'willow' | 'kamuro'
  | 'crossette' | 'brocade' | 'palm' | 'dahlia' | 'strobe'
  | 'horsetail' | 'tourbillon';

const TYPES: ShellType[] = [
  'chrysanthemum', 'peony', 'ring', 'willow', 'kamuro',
  'crossette', 'brocade', 'palm', 'dahlia', 'strobe',
  'horsetail', 'tourbillon',
];
const APEX_TYPES: ShellType[] = [
  'chrysanthemum', 'kamuro', 'peony', 'brocade', 'dahlia', 'horsetail',
];

// Twelve rich colour themes  [primary, secondary, accent]
const TH: number[][] = [
  [0xFFD700, 0xFF8C00, 0xFFFACD],   // gold
  [0xFF1744, 0xFF6E40, 0xFFCDD2],   // red
  [0x2979FF, 0x00B0FF, 0xBBDEFB],   // blue
  [0x00E676, 0x69F0AE, 0xC8E6C9],   // green
  [0xD500F9, 0xE040FB, 0xE1BEE7],   // purple
  [0xFFFFFF, 0xBBBBBB, 0xFFF9C4],   // silver
  [0xFF4081, 0xFF80AB, 0xF8BBD0],   // pink
  [0xFFAB00, 0xFFD740, 0xFFECB3],   // amber
  [0x00BCD4, 0x4DD0E1, 0xB2EBF2],   // cyan
  [0xFF6D00, 0xFF9E40, 0xFFE0B2],   // orange
  [0x76FF03, 0xB2FF59, 0xF1F8E9],   // lime
  [0xF50057, 0xFF4081, 0xFCE4EC],   // magenta
];

const TC: [THREE.Color, THREE.Color, THREE.Color][] = TH.map(
  ([a, b, c]) => [new THREE.Color(a), new THREE.Color(b), new THREE.Color(c)],
);

// ── Helpers ─────────────────────────────────────────────────
function rnd(lo: number, hi: number): number { return lo + Math.random() * (hi - lo); }

function sphereDir(): [number, number, number] {
  const th = Math.random() * Math.PI * 2;
  const ph = Math.acos(1 - 2 * Math.random());
  return [Math.sin(ph) * Math.cos(th), Math.sin(ph) * Math.sin(th), Math.cos(ph)];
}

/** Upper-hemisphere direction (biased upward) */
function upperDir(): [number, number, number] {
  const th = Math.random() * Math.PI * 2;
  const ph = Math.random() * Math.PI * 0.45;
  return [Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)];
}

// ═══════════════════════════════════════════════════════════
export class LoopFireworks {
  // SoA particle storage
  private al: Uint8Array;
  private px: Float32Array; private py: Float32Array; private pz: Float32Array;
  private vx: Float32Array; private vy: Float32Array; private vz: Float32Array;
  private li: Float32Array; private ml: Float32Array;
  private cr: Float32Array; private cg: Float32Array; private cb: Float32Array;
  private sz: Float32Array;
  private dr: Float32Array;
  private tw: Uint8Array;
  private nxt = 0;

  // THREE rendering
  private geo: THREE.BufferGeometry;
  private pBuf: Float32Array;
  private cBuf: Float32Array;
  readonly points: THREE.Points;

  // State
  private on = false;
  private burstTimer = 0;
  private wTimer = 0;
  private alive = 0;
  private playerPos = new THREE.Vector3();

  constructor() {
    const N = MAX_P;

    this.al = new Uint8Array(N);
    this.px = new Float32Array(N); this.py = new Float32Array(N); this.pz = new Float32Array(N);
    this.vx = new Float32Array(N); this.vy = new Float32Array(N); this.vz = new Float32Array(N);
    this.li = new Float32Array(N); this.ml = new Float32Array(N);
    this.cr = new Float32Array(N); this.cg = new Float32Array(N); this.cb = new Float32Array(N);
    this.sz = new Float32Array(N);
    this.dr = new Float32Array(N);
    this.tw = new Uint8Array(N);

    this.pBuf = new Float32Array(N * 3);
    this.cBuf = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) this.pBuf[i * 3] = -9999;

    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pBuf, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.cBuf, 3));

    this.points = new THREE.Points(this.geo, new THREE.PointsMaterial({
      size: 12.0,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      vertexColors: true,
      sizeAttenuation: true,
    }));
    this.points.renderOrder = 999;
    this.points.frustumCulled = false;
  }

  // ── public API ──────────────────────────────────────────
  setActive(active: boolean, playerPosition?: THREE.Vector3): void {
    if (playerPosition) this.playerPos.copy(playerPosition);
    if (active && !this.on) {
      this.burstTimer = 0;
      for (let i = 0; i < 15; i++) this.spawnBurst();
    }
    this.on = active;
  }

  update(dt: number, playerPosition: THREE.Vector3): void {
    this.playerPos.copy(playerPosition);
    if (!this.on && this.alive === 0) return;

    const apex = playerPosition.y > 120;

    if (this.on) {
      this.burstTimer -= dt;
      if (this.burstTimer <= 0) {
        const n = apex ? 12 + Math.floor(Math.random() * 4) : 8 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) this.spawnBurst();
        this.burstTimer = apex ? rnd(0.01, 0.03) : rnd(0.02, 0.06);
      }
      this.wTimer -= dt;
      if (this.wTimer <= 0) { this.wTimer = 0.018; this.emitWaterfall(); }
    }

    // ── Update particles ──
    this.alive = 0;
    for (let i = 0; i < MAX_P; i++) {
      const i3 = i * 3;
      if (!this.al[i]) { this.pBuf[i3] = -9999; continue; }

      this.li[i] -= dt;
      if (this.li[i] <= 0) { this.al[i] = 0; this.pBuf[i3] = -9999; continue; }
      this.alive++;

      // Physics
      this.vy[i] -= FW_GRAVITY * dt;
      const d = this.dr[i];
      this.vx[i] *= d; this.vy[i] *= d; this.vz[i] *= d;
      this.px[i] += this.vx[i] * dt;
      this.py[i] += this.vy[i] * dt;
      this.pz[i] += this.vz[i] * dt;

      // Visual
      const lr = this.li[i] / this.ml[i];
      const fadeIn = lr > 0.92 ? (1 - lr) / 0.08 : 1;
      const fadeOut = lr < 0.25 ? lr / 0.25 : 1;
      const a = fadeIn * fadeOut;
      let twk = 1.0;
      if (this.tw[i] && lr < 0.5) twk = 0.15 + Math.random() * 1.8;
      // Warm colour shift
      const w = 1 - lr;
      const r = this.cr[i] * (1 - w * 0.2) + w * 0.3;
      const gv = this.cg[i] * (1 - w * 0.4) + w * 0.15;
      const b = this.cb[i] * (1 - w * 0.7);

      this.pBuf[i3]     = this.px[i];
      this.pBuf[i3 + 1] = this.py[i];
      this.pBuf[i3 + 2] = this.pz[i];
      this.cBuf[i3]     = r * a * twk;
      this.cBuf[i3 + 1] = gv * a * twk;
      this.cBuf[i3 + 2] = b * a * twk;
    }

    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.color    as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose(): void {
    this.geo.dispose();
    (this.points.material as THREE.PointsMaterial).dispose();
  }

  // ── Spawn a burst ─────────────────────────────────────
  private spawnBurst(): void {
    const bx = LCX + rnd(-450, 450);
    const by = rnd(5, 55);
    const bz = LCZ + rnd(-450, 450);

    const apex = this.playerPos.y > 120;
    const type = apex
      ? APEX_TYPES[Math.floor(Math.random() * APEX_TYPES.length)]
      : TYPES[Math.floor(Math.random() * TYPES.length)];
    const theme = Math.floor(Math.random() * TC.length);

    // Flash
    this.emit(bx, by, bz, 0, 0, 0, 1, 1, 1, rnd(6, 10), 0.10, 1, false);

    switch (type) {
      case 'chrysanthemum': this.bChrysanthemum(bx, by, bz, theme); break;
      case 'peony':         this.bPeony(bx, by, bz, theme);         break;
      case 'ring':          this.bRing(bx, by, bz, theme);          break;
      case 'willow':        this.bWillow(bx, by, bz);               break;
      case 'kamuro':        this.bKamuro(bx, by, bz);               break;
      case 'crossette':     this.bCrossette(bx, by, bz, theme);     break;
      case 'brocade':       this.bBrocade(bx, by, bz);              break;
      case 'palm':          this.bPalm(bx, by, bz, theme);          break;
      case 'dahlia':        this.bDahlia(bx, by, bz, theme);        break;
      case 'strobe':        this.bStrobe(bx, by, bz, theme);        break;
      case 'horsetail':     this.bHorsetail(bx, by, bz);            break;
      case 'tourbillon':    this.bTourbillon(bx, by, bz, theme);    break;
    }
  }

  // ── Golden waterfall ──────────────────────────────────────
  private emitWaterfall(): void {
    for (let i = 0; i < 3; i++) {
      const sx = LCX + rnd(-350, 350);
      const sy = rnd(30, 65);
      const sz = LCZ + rnd(-350, 350);
      this.emit(
        sx, sy, sz,
        rnd(-2, 2), rnd(-6, -2), rnd(-2, 2),
        1.0, 0.82, 0.28,
        rnd(1.0, 2.0), rnd(1.8, 3.0), 0.962, Math.random() < 0.4,
      );
    }
  }

  // ═══════════════════════════════════════════════════════
  //  BURST PATTERNS (12 types)
  // ═══════════════════════════════════════════════════════

  /** Dense sphere with long streaming trails */
  private bChrysanthemum(ox: number, oy: number, oz: number, theme: number): void {
    const [c1, c2, ca] = TC[theme];
    for (let i = 0; i < 60; i++) {
      const [dx, dy, dz] = sphereDir();
      const sp = rnd(26, 42);
      const t = Math.random();
      const isAccent = Math.random() < 0.12;
      const r = isAccent ? ca.r : c1.r + (c2.r - c1.r) * t;
      const g = isAccent ? ca.g : c1.g + (c2.g - c1.g) * t;
      const b = isAccent ? ca.b : c1.b + (c2.b - c1.b) * t;
      this.emit(ox, oy, oz, dx * sp, dy * sp + 4, dz * sp, r, g, b,
        rnd(1.2, 2.8), rnd(2.0, 3.0), 0.960, Math.random() < 0.4);
    }
  }

  /** Large bright sphere, punchy, white core */
  private bPeony(ox: number, oy: number, oz: number, theme: number): void {
    const [c1, c2] = TC[theme];
    for (let i = 0; i < 50; i++) {
      const [dx, dy, dz] = sphereDir();
      const sp = rnd(32, 54);
      const t = Math.random();
      this.emit(ox, oy, oz, dx * sp, dy * sp + 3, dz * sp,
        c1.r + (c2.r - c1.r) * t, c1.g + (c2.g - c1.g) * t, c1.b + (c2.b - c1.b) * t,
        rnd(2.0, 4.0), rnd(1.0, 1.6), 0.982, false);
    }
    for (let i = 0; i < 10; i++) {
      const [dx, dy, dz] = sphereDir();
      const sp = rnd(8, 22);
      this.emit(ox, oy, oz, dx * sp, dy * sp + 2, dz * sp, 1, 1, 1,
        rnd(3.0, 5.0), rnd(0.2, 0.4), 0.97, false);
    }
  }

  /** Expanding ring in a tilted plane */
  private bRing(ox: number, oy: number, oz: number, theme: number): void {
    const [c1, c2] = TC[theme];
    const tiltA = rnd(0, Math.PI * 2);
    const tiltE = rnd(-0.4, 0.4);
    const cosT = Math.cos(tiltE), sinT = Math.sin(tiltE);
    const cosA = Math.cos(tiltA), sinA = Math.sin(tiltA);
    for (let i = 0; i < 40; i++) {
      const a = (i / 65) * Math.PI * 2 + rnd(-0.05, 0.05);
      const sp = rnd(29, 42);
      const rx = Math.cos(a) * sp, ry = Math.sin(a) * sp;
      const x2 = rx * cosA, z2 = rx * sinA;
      const y2 = ry * cosT - z2 * sinT, z3 = ry * sinT + z2 * cosT;
      const t = Math.random();
      this.emit(ox, oy, oz, x2, y2 + 1, z3,
        c1.r + (c2.r - c1.r) * t, c1.g + (c2.g - c1.g) * t, c1.b + (c2.b - c1.b) * t,
        rnd(1.8, 3.0), rnd(1.2, 2.0), 0.976, Math.random() < 0.4);
    }
  }

  /** Graceful drooping arcs like willow branches */
  private bWillow(ox: number, oy: number, oz: number): void {
    const gold1 = new THREE.Color(0xFFD700);
    const gold2 = new THREE.Color(0xFFA000);
    for (let i = 0; i < 45; i++) {
      const [dx, dy, dz] = upperDir();
      const sp = rnd(19, 38);
      const t = Math.random();
      this.emit(ox, oy, oz,
        dx * sp, dy * sp + 8, dz * sp,
        gold1.r + (gold2.r - gold1.r) * t, gold1.g + (gold2.g - gold1.g) * t, gold1.b + (gold2.b - gold1.b) * t,
        rnd(1.0, 2.2), rnd(2.8, 3.8), 0.950, Math.random() < 0.3);
    }
  }

  /** Massive golden cascade */
  private bKamuro(ox: number, oy: number, oz: number): void {
    for (let i = 0; i < 70; i++) {
      const [dx, dy, dz] = sphereDir();
      const sp = rnd(13, 29);
      this.emit(ox, oy, oz, dx * sp, dy * sp + 3, dz * sp,
        rnd(0.95, 1.0), rnd(0.72, 0.88), rnd(0.15, 0.35),
        rnd(0.8, 2.0), rnd(3.0, 4.5), 0.955, true);
    }
  }

  /** Two-stage: fast outer streaks then delayed inner bloom */
  private bCrossette(ox: number, oy: number, oz: number, theme: number): void {
    const [c1, c2, ca] = TC[theme];
    for (let i = 0; i < 18; i++) {
      const [dx, dy, dz] = sphereDir();
      const sp = rnd(48, 67);
      this.emit(ox, oy, oz, dx * sp, dy * sp + 2, dz * sp,
        ca.r, ca.g, ca.b, rnd(2.0, 3.5), rnd(0.2, 0.35), 0.99, false);
    }
    for (let i = 0; i < 35; i++) {
      const [dx, dy, dz] = sphereDir();
      const sp = rnd(13, 29);
      const t = Math.random();
      this.emit(ox + dx * rnd(1, 5), oy + dy * rnd(1, 5), oz + dz * rnd(1, 5),
        dx * sp, dy * sp + 1, dz * sp,
        c1.r + (c2.r - c1.r) * t, c1.g + (c2.g - c1.g) * t, c1.b + (c2.b - c1.b) * t,
        rnd(1.5, 2.5), rnd(1.5, 2.2), 0.966, Math.random() < 0.5);
    }
  }

  /** Twinkling golden/silver brocade */
  private bBrocade(ox: number, oy: number, oz: number): void {
    const useGold = Math.random() < 0.6;
    for (let i = 0; i < 60; i++) {
      const [dx, dy, dz] = sphereDir();
      const sp = rnd(16, 35);
      const s = rnd(0.8, 1.0);
      this.emit(ox, oy, oz, dx * sp, dy * sp + 2, dz * sp,
        useGold ? s : 0.92, useGold ? s * 0.78 : 0.92, useGold ? s * 0.25 : s * 0.88,
        rnd(1.0, 2.0), rnd(2.5, 3.5), 0.955, true);
    }
  }

  /** Palm tree: thick rising trunk + spreading canopy at top */
  private bPalm(ox: number, oy: number, oz: number, theme: number): void {
    const [c1, c2, ca] = TC[theme];
    // Trunk — fast upward streaks
    for (let i = 0; i < 12; i++) {
      const sp = rnd(40, 64);
      this.emit(ox, oy, oz,
        rnd(-2, 2), sp, rnd(-2, 2),
        ca.r, ca.g, ca.b, rnd(2.0, 3.5), rnd(0.6, 1.0), 0.975, false);
    }
    // Canopy — wide hemisphere from elevated point
    const topY = oy + rnd(19, 32);
    for (let i = 0; i < 35; i++) {
      const [dx, dy, dz] = upperDir();
      const sp = rnd(22, 38);
      const t = Math.random();
      this.emit(ox + rnd(-3, 3), topY, oz + rnd(-3, 3),
        dx * sp, dy * sp * 0.4 + 2, dz * sp,
        c1.r + (c2.r - c1.r) * t, c1.g + (c2.g - c1.g) * t, c1.b + (c2.b - c1.b) * t,
        rnd(1.5, 2.8), rnd(2.0, 3.0), 0.958, Math.random() < 0.3);
    }
  }

  /** Multi-layered dahlia — 3 concentric shells at different speeds */
  private bDahlia(ox: number, oy: number, oz: number, theme: number): void {
    const [c1, c2, ca] = TC[theme];
    const layers = [
      { count: 18, speed: [45, 58] as const, color: ca, life: [0.6, 1.0] as const, drag: 0.988 },
      { count: 30, speed: [26, 38] as const, color: c1, life: [1.4, 2.2] as const, drag: 0.968 },
      { count: 20, speed: [10, 19] as const,  color: c2, life: [2.0, 3.2] as const, drag: 0.956 },
    ];
    for (const layer of layers) {
      for (let i = 0; i < layer.count; i++) {
        const [dx, dy, dz] = sphereDir();
        const sp = rnd(layer.speed[0], layer.speed[1]);
        const c = layer.color;
        this.emit(ox, oy, oz, dx * sp, dy * sp + 2, dz * sp,
          c.r, c.g, c.b, rnd(1.5, 3.0), rnd(layer.life[0], layer.life[1]), layer.drag, true);
      }
    }
  }

  /** Rapid white strobing flashes scattered in a sphere */
  private bStrobe(ox: number, oy: number, oz: number, theme: number): void {
    const [c1] = TC[theme];
    for (let i = 0; i < 40; i++) {
      const [dx, dy, dz] = sphereDir();
      const sp = rnd(22, 42);
      // Alternate white and theme colour
      const white = Math.random() < 0.5;
      this.emit(ox, oy, oz, dx * sp, dy * sp + 2, dz * sp,
        white ? 1 : c1.r, white ? 1 : c1.g, white ? 1 : c1.b,
        rnd(2.5, 4.5), rnd(0.3, 0.6), 0.985, true);
    }
    // Delayed second strobe burst (slightly offset)
    for (let i = 0; i < 24; i++) {
      const [dx, dy, dz] = sphereDir();
      const sp = rnd(13, 26);
      this.emit(ox + rnd(-4, 4), oy + rnd(-2, 4), oz + rnd(-4, 4),
        dx * sp, dy * sp + 1, dz * sp,
        1, 1, 1, rnd(3.0, 5.0), rnd(0.15, 0.3), 0.99, true);
    }
  }

  /** Long golden/silver streamers that hang and drip down slowly */
  private bHorsetail(ox: number, oy: number, oz: number): void {
    const silver = Math.random() < 0.4;
    for (let i = 0; i < 55; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.random() * Math.PI * 0.3;  // narrow upward cone
      const sp = rnd(22, 42);
      const dx = Math.sin(ph) * Math.cos(th) * sp;
      const dy = Math.cos(ph) * sp + rnd(6, 16);
      const dz = Math.sin(ph) * Math.sin(th) * sp;
      const s = rnd(0.8, 1.0);
      this.emit(ox, oy, oz, dx, dy, dz,
        silver ? s * 0.9 : s, silver ? s * 0.9 : s * 0.78, silver ? s * 0.85 : s * 0.2,
        rnd(0.8, 1.8), rnd(3.5, 5.0), 0.948, true);
    }
  }

  /** Spiral spinning effect — particles trace helical paths */
  private bTourbillon(ox: number, oy: number, oz: number, theme: number): void {
    const [c1, c2] = TC[theme];
    const arms = 3 + Math.floor(Math.random() * 3);  // 3-5 spiral arms
    const spin = Math.random() < 0.5 ? 1 : -1;
    for (let arm = 0; arm < arms; arm++) {
      const baseAngle = (arm / arms) * Math.PI * 2;
      for (let i = 0; i < 12; i++) {
        const frac = i / 12;
        const angle = baseAngle + spin * frac * Math.PI * 3;
        const sp = rnd(16, 32) * (0.5 + frac * 0.5);
        const dx = Math.cos(angle) * sp;
        const dz = Math.sin(angle) * sp;
        const dy = rnd(13, 29) * (1 - frac * 0.5);
        const t = frac;
        this.emit(ox, oy, oz, dx, dy, dz,
          c1.r + (c2.r - c1.r) * t, c1.g + (c2.g - c1.g) * t, c1.b + (c2.b - c1.b) * t,
          rnd(1.5, 3.0), rnd(1.5, 2.5), 0.965, Math.random() < 0.3);
      }
    }
  }

  // ── Low-level particle emission ─────────────────────────
  private emit(
    x: number, y: number, z: number,
    evx: number, evy: number, evz: number,
    r: number, g: number, b: number,
    size: number, life: number, drag: number, twinkle: boolean,
  ): void {
    const i = this.alloc();
    if (i < 0) return;
    this.al[i] = 1;
    this.px[i] = x; this.py[i] = y; this.pz[i] = z;
    this.vx[i] = evx; this.vy[i] = evy; this.vz[i] = evz;
    this.cr[i] = r; this.cg[i] = g; this.cb[i] = b;
    this.sz[i] = size;
    this.li[i] = life; this.ml[i] = life;
    this.dr[i] = drag;
    this.tw[i] = twinkle ? 1 : 0;
  }

  private alloc(): number {
    for (let scan = 0; scan < MAX_P; scan++) {
      const idx = (this.nxt + scan) % MAX_P;
      if (!this.al[idx]) { this.nxt = (idx + 1) % MAX_P; return idx; }
    }
    return -1;
  }
}
