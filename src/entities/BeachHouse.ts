import * as THREE from 'three';

// ── Constants ──
const CLUSTER_COUNT = 5;           // number of clusters along coast
const CLUSTER_Z_START = -600;
const CLUSTER_Z_SPACING = 250;     // spacing between clusters
const CLUSTER_MIN = 2;             // min houses per cluster
const CLUSTER_MAX = 4;             // max houses per cluster
const HOUSE_Z_GAP = 35;            // Z gap between houses within a cluster
const HOUSE_SCALE = 4.2;           // overall scale (prev 6 × 0.7)

const SHORE_X = 130;               // matches TrackEnvironment shoreX
const PALMS_PER_HOUSE_MIN = 4;
const PALMS_PER_HOUSE_MAX = 7;
const PALM_TRUNK_HEIGHT = 7;
const PALM_TRUNK_BEND = 1.2;
const PALM_FRONDS = 5;

// ── Colour variants ──
interface HouseVariant {
  roofColor: number;
  norenColor: number;
  umbrellaColor: number;
}

const VARIANTS: HouseVariant[] = [
  { roofColor: 0xb8634a, norenColor: 0x1a3a5a, umbrellaColor: 0xcc2222 }, // A
  { roofColor: 0x3a2a1a, norenColor: 0x8a1a1a, umbrellaColor: 0x2244aa }, // B
  { roofColor: 0x3a3a3a, norenColor: 0x2a4a1a, umbrellaColor: 0xccaa22 }, // C
];

// ── Seeded RNG ──
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Get beach Y at a given X position (matches TrackEnvironment slope) */
function beachY(x: number): number {
  const t = (x - SHORE_X) / 100;
  return 0.3 - t * 2.5;
}

// Surfboard bright colours
const SURFBOARD_COLORS = [0xff4444, 0x44aaff, 0xffee22, 0x44dd66, 0xff88cc, 0xff8822];

// ── Procedural texture helpers ──

function makeWoodTexture(baseR: number, baseG: number, baseB: number): THREE.CanvasTexture {
  const w = 128, h = 128;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = `rgb(${baseR},${baseG},${baseB})`;
  ctx.fillRect(0, 0, w, h);
  // Wood grain lines
  for (let y = 0; y < h; y += 2) {
    const off = Math.sin(y * 0.15) * 3;
    const bri = 0.85 + Math.sin(y * 0.3 + off) * 0.15;
    ctx.fillStyle = `rgba(${Math.floor(baseR * bri)},${Math.floor(baseG * bri)},${Math.floor(baseB * bri)},0.6)`;
    ctx.fillRect(0, y, w, 1);
  }
  // Knots
  for (let i = 0; i < 4; i++) {
    const kx = Math.random() * w, ky = Math.random() * h;
    ctx.beginPath();
    ctx.arc(kx, ky, 3 + Math.random() * 4, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${Math.floor(baseR * 0.6)},${Math.floor(baseG * 0.6)},${Math.floor(baseB * 0.6)},0.5)`;
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

function makeWallTexture(): THREE.CanvasTexture {
  const w = 128, h = 128;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  // Base cream
  ctx.fillStyle = '#f5f0e8';
  ctx.fillRect(0, 0, w, h);
  // Subtle plaster texture noise
  for (let i = 0; i < 3000; i++) {
    const bri = 230 + Math.floor(Math.random() * 25);
    ctx.fillStyle = `rgba(${bri},${bri - 8},${bri - 20},0.25)`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  // Horizontal board lines
  for (let y = 0; y < h; y += 16) {
    ctx.fillStyle = 'rgba(180,170,150,0.15)';
    ctx.fillRect(0, y, w, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

function makeRoofTexture(r: number, g: number, b: number): THREE.CanvasTexture {
  const w = 128, h = 64;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, w, h);
  // Tile rows
  for (let row = 0; row < h; row += 8) {
    const offsetX = (row / 8) % 2 === 0 ? 0 : 12;
    ctx.strokeStyle = `rgba(0,0,0,0.15)`;
    ctx.lineWidth = 0.5;
    for (let x = offsetX; x < w; x += 24) {
      ctx.strokeRect(x, row, 24, 8);
    }
    // Slight shade variation per row
    const shade = 0.9 + Math.sin(row * 0.4) * 0.1;
    ctx.fillStyle = `rgba(${Math.floor(r * shade)},${Math.floor(g * shade)},${Math.floor(b * shade)},0.2)`;
    ctx.fillRect(0, row, w, 8);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  return tex;
}

function makeNorenTexture(r: number, g: number, b: number): THREE.CanvasTexture {
  const w = 32, h = 64;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, w, h);
  // Vertical stripe pattern (traditional noren)
  ctx.fillStyle = `rgba(255,255,255,0.08)`;
  ctx.fillRect(6, 0, 3, h);
  ctx.fillRect(22, 0, 3, h);
  // Bottom fringe hint
  for (let x = 0; x < w; x += 4) {
    ctx.fillStyle = `rgba(0,0,0,0.1)`;
    ctx.fillRect(x, h - 6, 2, 6);
  }
  // Kanji-style decorative mark (simple circle motif)
  ctx.strokeStyle = `rgba(255,255,255,0.2)`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(w / 2, h * 0.35, 7, 0, Math.PI * 2);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

function makeAwningTexture(): THREE.CanvasTexture {
  const w = 128, h = 32;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  // Red and white stripes
  for (let x = 0; x < w; x += 16) {
    ctx.fillStyle = (x / 16) % 2 === 0 ? '#cc3333' : '#f0eeee';
    ctx.fillRect(x, 0, 16, h);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  return tex;
}

function makePalmLeafTexture(): THREE.CanvasTexture {
  const w = 128, h = 256;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, '#276e30');
  grad.addColorStop(0.35, '#3aad4e');
  grad.addColorStop(0.5, '#48c25a');
  grad.addColorStop(0.65, '#3aad4e');
  grad.addColorStop(1, '#276e30');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  // Central rachis
  ctx.strokeStyle = '#2a6e1e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(64, 0);
  ctx.lineTo(64, h);
  ctx.stroke();
  // Side pinnae
  ctx.strokeStyle = '#328a3a';
  ctx.lineWidth = 1;
  for (let v = 12; v < h; v += 16) {
    ctx.beginPath(); ctx.moveTo(64, v); ctx.lineTo(4, v + 20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(64, v); ctx.lineTo(124, v + 20); ctx.stroke();
  }
  // Noise
  const imgData = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 18;
    imgData.data[i] = Math.min(255, Math.max(0, imgData.data[i] + n));
    imgData.data[i + 1] = Math.min(255, Math.max(0, imgData.data[i + 1] + n));
    imgData.data[i + 2] = Math.min(255, Math.max(0, imgData.data[i + 2] + n));
  }
  ctx.putImageData(imgData, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function hexToRgb(hex: number): [number, number, number] {
  return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
}

export class BeachHouses {
  readonly group = new THREE.Group();
  private houses: THREE.Group[] = [];
  private rng: () => number;

  private materials: Map<string, THREE.MeshStandardMaterial> = new Map();
  private textures: THREE.Texture[] = [];

  constructor() {
    this.rng = mulberry32(271828);
  }

  private getMatKeyed(key: string, opts: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
    let mat = this.materials.get(key);
    if (!mat) {
      mat = new THREE.MeshStandardMaterial(opts);
      this.materials.set(key, mat);
    }
    return mat;
  }

  private trackTex(tex: THREE.Texture): THREE.Texture {
    this.textures.push(tex);
    return tex;
  }

  spawn(): void {
    this.clear();
    const rng = this.rng;
    let variantIdx = 0;

    for (let c = 0; c < CLUSTER_COUNT; c++) {
      const clusterZ = CLUSTER_Z_START + c * CLUSTER_Z_SPACING;
      const clusterX = (SHORE_X - 15) + rng() * 10; // just inside shore edge, road-side
      const count = CLUSTER_MIN + Math.floor(rng() * (CLUSTER_MAX - CLUSTER_MIN + 1));

      const rowStart = clusterZ - ((count - 1) * HOUSE_Z_GAP) / 2;

      for (let h = 0; h < count; h++) {
        const variant = VARIANTS[variantIdx % 3];
        variantIdx++;

        const z = rowStart + h * HOUSE_Z_GAP;
        const x = clusterX + (rng() - 0.5) * 4;
        const y = beachY(x);
        const yRot = (rng() - 0.5) * 0.1;

        const house = this.buildHouse(variant, rng);
        house.position.set(x, y, z);
        house.rotation.y = yRot;
        house.scale.set(HOUSE_SCALE, HOUSE_SCALE, HOUSE_SCALE);

        this.group.add(house);
        this.houses.push(house);

        // ── Place palm trees around this house ──
        const palmCount = PALMS_PER_HOUSE_MIN + Math.floor(rng() * (PALMS_PER_HOUSE_MAX - PALMS_PER_HOUSE_MIN + 1));
        // House footprint is roughly ±5 × ±4 in local coords, scaled by HOUSE_SCALE
        const halfW = 6 * HOUSE_SCALE;
        const halfD = 5 * HOUSE_SCALE;
        for (let p = 0; p < palmCount; p++) {
          const palmScale = 0.85 + rng() * 0.35;
          const angle = (p / palmCount) * Math.PI * 2 + rng() * 0.8;
          // Place in a wider ring well away from the house
          const dist = 1.6 + rng() * 0.8;
          const px = x + Math.cos(angle) * halfW * dist;
          const pz = z + Math.sin(angle) * halfD * dist;
          const py = beachY(px);

          const palm = this.buildPalmTree(rng, palmScale);
          palm.position.set(px, py, pz);
          this.group.add(palm);
          this.houses.push(palm); // tracked for cleanup
        }
      }
    }
  }

  private buildPalmTree(rng: () => number, scale: number): THREE.Group {
    const palm = new THREE.Group();

    const setShadow = (m: THREE.Mesh) => {
      m.castShadow = true;
      m.receiveShadow = true;
    };

    // ── Trunk (bent cylinder) ──
    const trunkGeo = new THREE.CylinderGeometry(0.10, 0.24, PALM_TRUNK_HEIGHT, 8, 12);
    const tPos = trunkGeo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < tPos.count; i++) {
      const y = tPos.getY(i);
      const t = (y + PALM_TRUNK_HEIGHT / 2) / PALM_TRUNK_HEIGHT;
      tPos.setX(i, tPos.getX(i) + PALM_TRUNK_BEND * Math.pow(t, 2.2));
    }
    tPos.needsUpdate = true;
    trunkGeo.computeVertexNormals();

    const trunkMat = this.getMatKeyed('palmTrunk', { color: 0x8a7a68, roughness: 0.95 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = PALM_TRUNK_HEIGHT * 0.5;
    setShadow(trunk);
    palm.add(trunk);

    // ── Coconuts ──
    const coconutGeo = new THREE.SphereGeometry(0.40, 7, 5);
    const coconutMat = this.getMatKeyed('coconut', { color: 0x6b4c1e, roughness: 0.95 });
    const topY = PALM_TRUNK_HEIGHT;
    const topX = PALM_TRUNK_BEND;
    const coconutCount = rng() > 0.6 ? 3 : 2;
    for (let c = 0; c < coconutCount; c++) {
      const cAngle = (c / coconutCount) * Math.PI * 2 + rng() * 0.8;
      const cDist = 0.18;
      const nut = new THREE.Mesh(coconutGeo, coconutMat);
      nut.position.set(
        topX + Math.cos(cAngle) * cDist,
        topY - 0.25 + rng() * 0.12,
        Math.sin(cAngle) * cDist,
      );
      const cs = 0.8 + rng() * 0.4;
      nut.scale.set(cs, cs * 1.15, cs);
      setShadow(nut);
      palm.add(nut);
    }

    // ── Fronds ──
    const leafTex = this.trackTex(makePalmLeafTexture());
    const frondMat = this.getMatKeyed('palmFrond', {
      map: leafTex, color: 0x44aa55, roughness: 0.82, side: THREE.DoubleSide,
    });
    const frondDarkMat = this.getMatKeyed('palmFrondDark', {
      map: leafTex, color: 0x226630, roughness: 0.85, side: THREE.DoubleSide,
    });

    // Helper to bend frond geometry
    const bendFrond = (geo: THREE.BufferGeometry, length: number, curve: number) => {
      const pos = geo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const z = pos.getZ(i);
        const ft = Math.max(0, z) / length;
        pos.setY(i, pos.getY(i) - curve * ft * ft);
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
    };

    const frondGeo = new THREE.ConeGeometry(0.65, 4.5, 4, 8);
    frondGeo.rotateX(Math.PI / 2);
    frondGeo.translate(0, 0, 2.25);
    bendFrond(frondGeo, 4.5, 30);

    const frondDarkGeo = new THREE.ConeGeometry(0.50, 3.8, 4, 8);
    frondDarkGeo.rotateX(Math.PI / 2);
    frondDarkGeo.translate(0, 0, 1.9);
    bendFrond(frondDarkGeo, 3.8, 4.8);

    for (let f = 0; f < PALM_FRONDS; f++) {
      const angle = (f / PALM_FRONDS) * Math.PI * 2 + rng() * 0.5;
      const droop = 0.45 + rng() * 0.55;
      const fScale = 0.9 + rng() * 0.35;
      const spread = 0.35;
      const ox = topX + Math.sin(angle) * spread;
      const oz = Math.cos(angle) * spread;

      // Main frond
      const frond = new THREE.Mesh(frondGeo, frondMat);
      frond.position.set(ox, topY + 0.15, oz);
      frond.rotation.order = 'YXZ';
      frond.rotation.set(-droop, angle, 0);
      frond.scale.set(fScale * 0.55, fScale * 0.16, fScale * 1.1);
      setShadow(frond);
      palm.add(frond);

      // Dark under-frond
      const dFrond = new THREE.Mesh(frondDarkGeo, frondDarkMat);
      dFrond.position.set(ox, topY + 0.02, oz);
      dFrond.rotation.order = 'YXZ';
      dFrond.rotation.set(-droop - 0.18, angle + 0.1, 0);
      dFrond.scale.set(fScale * 0.45, fScale * 0.12, fScale * 0.95);
      setShadow(dFrond);
      palm.add(dFrond);
    }

    // Apply lean and scale
    const leanX = (rng() - 0.5) * 0.18;
    const leanZ = (rng() - 0.5) * 0.18;
    const yRot = rng() * Math.PI * 2;
    palm.rotation.set(leanX, yRot, leanZ);
    palm.scale.set(scale, scale, scale);

    return palm;
  }

  private buildHouse(v: HouseVariant, rng: () => number): THREE.Group {
    const house = new THREE.Group();

    // ── Textured materials ──
    const woodTex = this.trackTex(makeWoodTexture(139, 111, 71));
    const woodMat = this.getMatKeyed('wood', { map: woodTex, roughness: 0.8 });

    const darkWoodTex = this.trackTex(makeWoodTexture(90, 74, 58));
    const darkWoodMat = this.getMatKeyed('darkWood', { map: darkWoodTex, roughness: 0.85 });

    const wallTex = this.trackTex(makeWallTexture());
    const creamMat = this.getMatKeyed('wall', { map: wallTex, roughness: 0.9 });

    const [rr, rg, rb] = hexToRgb(v.roofColor);
    const roofKey = `roof_${v.roofColor}`;
    const roofTex = this.trackTex(makeRoofTexture(rr, rg, rb));
    const roofMat = this.getMatKeyed(roofKey, { map: roofTex, roughness: 0.75 });

    const counterTex = this.trackTex(makeWoodTexture(170, 119, 68));
    const counterMat = this.getMatKeyed('counter', { map: counterTex, roughness: 0.3, metalness: 0.2 });

    const [nr, ng, nb] = hexToRgb(v.norenColor);
    const norenKey = `noren_${v.norenColor}`;
    const norenTex = this.trackTex(makeNorenTexture(nr, ng, nb));
    const norenMat = this.getMatKeyed(norenKey, { map: norenTex, side: THREE.DoubleSide });

    const awningTex = this.trackTex(makeAwningTexture());
    const awningMat = this.getMatKeyed('awning', { map: awningTex, roughness: 0.7 });

    const setShadow = (m: THREE.Mesh) => {
      m.castShadow = true;
      m.receiveShadow = true;
    };

    // ── 1. Raised wooden deck ──
    const deckGeo = new THREE.BoxGeometry(10, 0.25, 8);
    const deck = new THREE.Mesh(deckGeo, woodMat);
    deck.position.y = 1.0;
    setShadow(deck);
    house.add(deck);

    // Support posts
    const postGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.0, 8);
    for (const [px, py, pz] of [
      [-4, 0.5, -3], [-4, 0.5, 0], [-4, 0.5, 3],
      [4, 0.5, -3], [4, 0.5, 0], [4, 0.5, 3],
      [0, 0.5, -3], [0, 0.5, 3],
    ]) {
      const post = new THREE.Mesh(postGeo, darkWoodMat);
      post.position.set(px, py, pz);
      setShadow(post);
      house.add(post);
    }

    // ── 2. Main walls ──
    const wallGeo = new THREE.BoxGeometry(7, 2.5, 5);
    const walls = new THREE.Mesh(wallGeo, creamMat);
    walls.position.set(-0.5, 2.375, 0);
    setShadow(walls);
    house.add(walls);

    // ── 3. Dark wood trim ──
    const trimH = new THREE.BoxGeometry(7.1, 0.1, 0.1);
    const trimV = new THREE.BoxGeometry(0.1, 2.5, 0.1);
    for (const tz of [-2.5, 2.5]) {
      for (const ty of [1.15, 3.6]) {
        const t = new THREE.Mesh(trimH, darkWoodMat);
        t.position.set(-0.5, ty, tz);
        setShadow(t);
        house.add(t);
      }
    }
    for (const tx of [-4, 3]) {
      for (const tz of [-2.5, 2.5]) {
        const t = new THREE.Mesh(trimV, darkWoodMat);
        t.position.set(tx, 2.375, tz);
        setShadow(t);
        house.add(t);
      }
    }

    // ── 4. Overhanging roof ──
    const roofGeo = new THREE.BoxGeometry(9, 0.35, 4.2);
    const roofL = new THREE.Mesh(roofGeo, roofMat);
    roofL.position.set(-0.5, 4.0, -1.8);
    roofL.rotation.x = 0.25;
    setShadow(roofL);
    house.add(roofL);

    const roofR = new THREE.Mesh(roofGeo, roofMat);
    roofR.position.set(-0.5, 4.0, 1.8);
    roofR.rotation.x = -0.25;
    setShadow(roofR);
    house.add(roofR);

    const ridgeGeo = new THREE.BoxGeometry(9.2, 0.15, 0.4);
    const ridge = new THREE.Mesh(ridgeGeo, darkWoodMat);
    ridge.position.set(-0.5, 4.35, 0);
    setShadow(ridge);
    house.add(ridge);

    // ── 5. Counter/bar ──
    const counterGeo = new THREE.BoxGeometry(0.3, 1.0, 4);
    const counter = new THREE.Mesh(counterGeo, counterMat);
    counter.position.set(3.3, 1.65, 0);
    setShadow(counter);
    house.add(counter);

    const counterTopGeo = new THREE.BoxGeometry(0.8, 0.08, 4.2);
    const counterTop = new THREE.Mesh(counterTopGeo, counterMat);
    counterTop.position.set(3.2, 2.18, 0);
    setShadow(counterTop);
    house.add(counterTop);

    // ── 6. Awning ──
    const awningGeo = new THREE.BoxGeometry(7, 0.05, 2.5);
    const awning = new THREE.Mesh(awningGeo, awningMat);
    awning.position.set(-0.5, 3.5, -4.0);
    setShadow(awning);
    house.add(awning);

    const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.5, 8);
    for (const [ppx, ppy, ppz] of [[-3, 2.25, -5], [2, 2.25, -5], [-3, 2.25, -3], [2, 2.25, -3]]) {
      const pole = new THREE.Mesh(poleGeo, darkWoodMat);
      pole.position.set(ppx, ppy, ppz);
      setShadow(pole);
      house.add(pole);
    }

    // ── 7. Noren curtains (暖簾) ──
    const norenCount = 5 + Math.floor(rng() * 3);
    const norenGeo = new THREE.BoxGeometry(0.6, 1.2, 0.04);
    for (let n = 0; n < norenCount; n++) {
      const noren = new THREE.Mesh(norenGeo, norenMat);
      const nx = -3 + n * (6 / (norenCount - 1));
      noren.position.set(nx, 3.0, -2.52);
      setShadow(noren);
      house.add(noren);
    }

    // ── 8. Paper lanterns (提灯) ──
    const lanternMat = new THREE.MeshStandardMaterial({
      color: 0xffaa66,
      emissive: 0xffaa66,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.85,
    });
    this.materials.set('lantern_' + Math.random(), lanternMat);
    const lanternBodyGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.5, 10);
    const lanternCapGeo = new THREE.SphereGeometry(0.15, 8, 6);
    for (let l = 0; l < 3; l++) {
      const lx = -2 + l * 2;
      const lanternBody = new THREE.Mesh(lanternBodyGeo, lanternMat);
      lanternBody.position.set(lx, 3.7, -2.6);
      house.add(lanternBody);

      const capTop = new THREE.Mesh(lanternCapGeo, lanternMat);
      capTop.position.set(lx, 3.98, -2.6);
      house.add(capTop);

      const capBot = new THREE.Mesh(lanternCapGeo, lanternMat);
      capBot.position.set(lx, 3.42, -2.6);
      house.add(capBot);
    }

    // ── 9. Surfboards ──
    const surfGeo = new THREE.BoxGeometry(0.5, 2.0, 0.08);
    const surfCount = 2 + Math.floor(rng() * 2);
    for (let s = 0; s < surfCount; s++) {
      const sColor = SURFBOARD_COLORS[Math.floor(rng() * SURFBOARD_COLORS.length)];
      const surfMat = new THREE.MeshStandardMaterial({ color: sColor, roughness: 0.4, metalness: 0.1 });
      this.materials.set('surf_' + Math.random(), surfMat);
      const surf = new THREE.Mesh(surfGeo, surfMat);
      const sx = -3.5 + s * 1.5;
      surf.position.set(sx, 2.1, 2.6);
      surf.rotation.x = -0.26;
      setShadow(surf);
      house.add(surf);
    }

    // ── 10. Beach umbrellas ──
    const umbrellaPoleGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.5, 8);
    const umbrellaCanopyGeo = new THREE.ConeGeometry(1.5, 0.5, 12);
    const umbrellaMat = new THREE.MeshStandardMaterial({ color: v.umbrellaColor, roughness: 0.6 });
    this.materials.set('umb_' + Math.random(), umbrellaMat);
    for (let u = 0; u < 2; u++) {
      const uz = -2 + u * 4;
      const ux = 5.5 + rng() * 2;

      const pole = new THREE.Mesh(umbrellaPoleGeo, darkWoodMat);
      pole.position.set(ux, 1.25, uz);
      setShadow(pole);
      house.add(pole);

      const canopy = new THREE.Mesh(umbrellaCanopyGeo, umbrellaMat);
      canopy.position.set(ux, 2.6, uz);
      canopy.rotation.x = Math.PI;
      setShadow(canopy);
      house.add(canopy);
    }

    // ── 11. Lounge chairs ──
    const chairMat = new THREE.MeshStandardMaterial({ color: 0xf8f8f8, roughness: 0.5 });
    this.materials.set('chair_' + Math.random(), chairMat);
    const chairSeatGeo = new THREE.BoxGeometry(0.8, 0.06, 1.8);
    const chairBackGeo = new THREE.BoxGeometry(0.8, 0.8, 0.06);
    const chairLegGeo = new THREE.BoxGeometry(0.06, 0.35, 0.06);
    for (let c = 0; c < 2; c++) {
      const cz = -1.5 + c * 3;
      const cx = 6 + rng() * 1.5;

      const seat = new THREE.Mesh(chairSeatGeo, chairMat);
      seat.position.set(cx, 0.35, cz);
      setShadow(seat);
      house.add(seat);

      const back = new THREE.Mesh(chairBackGeo, chairMat);
      back.position.set(cx, 0.7, cz - 0.85);
      back.rotation.x = -0.3;
      setShadow(back);
      house.add(back);

      for (const [lx, lz] of [[-0.3, -0.7], [0.3, -0.7], [-0.3, 0.7], [0.3, 0.7]]) {
        const leg = new THREE.Mesh(chairLegGeo, chairMat);
        leg.position.set(cx + lx, 0.15, cz + lz);
        setShadow(leg);
        house.add(leg);
      }
    }

    // ── 12. Drink cooler ──
    const coolerMat = new THREE.MeshStandardMaterial({ color: 0x2266cc, roughness: 0.5 });
    this.materials.set('cooler_' + Math.random(), coolerMat);
    const coolerGeo = new THREE.BoxGeometry(0.6, 0.5, 0.4);
    const cooler = new THREE.Mesh(coolerGeo, coolerMat);
    cooler.position.set(2.8, 1.38, 1.5);
    setShadow(cooler);
    house.add(cooler);

    // ── 13. Menu board ──
    const signPoleGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.8, 8);
    const signPole = new THREE.Mesh(signPoleGeo, darkWoodMat);
    signPole.position.set(4.5, 1.0, -3.2);
    setShadow(signPole);
    house.add(signPole);

    const signBoardGeo = new THREE.BoxGeometry(0.8, 0.6, 0.05);
    const signBoard = new THREE.Mesh(signBoardGeo, creamMat);
    signBoard.position.set(4.5, 1.7, -3.2);
    setShadow(signBoard);
    house.add(signBoard);

    // ── 14. Flower pots ──
    const potGeo = new THREE.CylinderGeometry(0.2, 0.15, 0.3, 8);
    const potMat = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.8 });
    this.materials.set('pot_' + Math.random(), potMat);
    const flowerGeo = new THREE.SphereGeometry(0.15, 6, 6);
    const flowerColors = [0xff6699, 0xffcc33, 0xff4466];
    for (let f = 0; f < 3; f++) {
      const fx = -4.2;
      const fz = -2 + f * 2;
      const pot = new THREE.Mesh(potGeo, potMat);
      pot.position.set(fx, 1.28, fz);
      setShadow(pot);
      house.add(pot);

      const flowerMat = new THREE.MeshStandardMaterial({ color: flowerColors[f % 3] });
      this.materials.set('flower_' + Math.random(), flowerMat);
      const flower = new THREE.Mesh(flowerGeo, flowerMat);
      flower.position.set(fx, 1.55, fz);
      house.add(flower);
    }

    return house;
  }

  clear(): void {
    for (const h of this.houses) {
      this.group.remove(h);
    }
    this.houses.length = 0;
  }

  dispose(): void {
    this.clear();
    for (const mat of this.materials.values()) {
      mat.dispose();
    }
    this.materials.clear();
    for (const tex of this.textures) {
      tex.dispose();
    }
    this.textures.length = 0;
  }
}
