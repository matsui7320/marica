import * as THREE from 'three';
import { TrackSpline } from '../track/TrackSpline';
import { Kart } from '../kart/Kart';
import { applyHit } from '../kart/KartPhysics';
import { BANANA_SPIN_DURATION } from '../constants';
import type { AudioManager } from '../core/AudioManager';

// ── Cow behavior states ──
const enum CowState {
  Grazing,
  Idle,
  Walking,
  Crossing,  // deliberately crossing the track
  Alert,
  Fleeing,
}

// ── Constants ──
const COW_COUNT = 12;
const COW_COLLISION_RADIUS = 2.2;
const COW_ALERT_RANGE = 25;
const COW_FLEE_RANGE = 10;
const COW_WALK_SPEED = 2.8;
const COW_CROSSING_SPEED = 1.2;
const COW_FLEE_SPEED = 8;
const COW_GRAZE_MIN = 1.5;
const COW_GRAZE_MAX = 4;
const COW_IDLE_MIN = 0.8;
const COW_IDLE_MAX = 2;
const COW_WALK_MIN = 4;
const COW_WALK_MAX = 10;
const COW_CROSSING_DURATION = 8;
const COW_FLEE_DURATION = 2.5;
const COW_HERD_RADIUS = 20;
const COW_HERD_WEIGHT = 0.3;

// ── Seeded RNG ──
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth exponential interpolation */
function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

// ── Leg pivot group ──
interface LegPivot {
  pivot: THREE.Group;    // positioned at hip, rotation.x drives swing
  upper: THREE.Mesh;
  lower: THREE.Mesh;
  hoof: THREE.Mesh;
}

// ── Single cow data ──
interface CowData {
  group: THREE.Group;
  bodyMesh: THREE.Mesh;
  position: THREE.Vector3;
  heading: number;
  displayHeading: number;   // smoothed visual heading
  speed: number;
  displaySpeed: number;     // smoothed visual speed
  state: CowState;
  stateTimer: number;
  targetHeading: number;
  // Animation accumulators
  walkCycle: number;
  tailPhase: number;
  headBob: number;
  bodyBounce: number;       // vertical bounce accumulator
  // Mesh refs for animation
  headPivot: THREE.Group;
  tailPivot: THREE.Group;
  legs: { FL: LegPivot; FR: LegPivot; BL: LegPivot; BR: LegPivot };
  // Ground Y at current position
  groundY: number;
  displayY: number;         // smoothed Y for rendering
  // Moo timer
  mooTimer: number;
}

export class MeadowCows {
  readonly group = new THREE.Group();
  private cows: CowData[] = [];
  private rng: () => number;
  private audio: AudioManager | null = null;

  constructor() {
    this.rng = mulberry32(314159);
  }

  setAudio(audio: AudioManager): void {
    this.audio = audio;
  }

  spawn(spline: TrackSpline): void {
    this.clear();
    const rng = this.rng;

    let placed = 0;
    for (let attempt = 0; placed < COW_COUNT && attempt < COW_COUNT * 6; attempt++) {
      const t = rng();
      const sp = spline.getPointAt(t);
      const side = rng() > 0.5 ? 1 : -1;
      // Some cows spawn close to the track (3+), others farther (up to 25)
      const edgeDist = 3 + rng() * 22;
      const dist = sp.width * 0.5 + edgeDist;

      const pos = sp.position.clone()
        .add(sp.binormal.clone().multiplyScalar(side * dist));

      // Only reject if literally on the road surface
      const closestT = spline.findClosestT(pos);
      const closestSp = spline.getPointAt(closestT);
      const dx = pos.x - closestSp.position.x;
      const dz = pos.z - closestSp.position.z;
      const xzDist = Math.sqrt(dx * dx + dz * dz);
      if (xzDist < closestSp.width * 0.5) continue;

      const groundY = this.getGroundY(closestSp, xzDist);
      pos.y = groundY;

      const heading = rng() * Math.PI * 2;
      const cow = this.buildCowMesh(rng);

      cow.group.position.copy(pos);
      cow.group.scale.setScalar(1.5);
      cow.group.rotation.y = heading + Math.PI;

      cow.position = pos.clone();
      cow.heading = heading;
      cow.displayHeading = heading;
      cow.targetHeading = heading;
      cow.groundY = groundY;
      cow.displayY = groundY;
      cow.state = rng() > 0.5 ? CowState.Grazing : CowState.Idle;
      cow.stateTimer = COW_GRAZE_MIN + rng() * (COW_GRAZE_MAX - COW_GRAZE_MIN);
      cow.mooTimer = 5 + rng() * 15; // first moo after 5-20 seconds

      this.group.add(cow.group);
      this.cows.push(cow);
      placed++;
    }
  }

  /**
   * Get ground Y at a position, given the nearest spline point and XZ distance to it.
   * On or near the track: use track surface height.
   * Far from track: lerp toward ground level.
   */
  private getGroundY(sp: { position: THREE.Vector3; width: number }, xzDist: number): number {
    const hw = sp.width * 0.5;
    const edgeDist = xzDist - hw;
    if (edgeDist <= 0) {
      // On the track surface — use track height directly
      return sp.position.y;
    }
    // Blend from track height to ground level
    const t = Math.min(edgeDist / 10, 1);
    return sp.position.y * (1 - t) + (-0.5) * t;
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Rounded procedural cow mesh
  // ──────────────────────────────────────────────────────────────────────────

  private buildCowMesh(rng: () => number): CowData {
    const group = new THREE.Group();

    const bodyColor = 0xf5f0e8;
    const spotColor = 0x2a1a0e;
    const skinPink = 0xffaaaa;
    const hornColor = 0xd4c4a0;

    const spotMat = new THREE.MeshStandardMaterial({ color: spotColor, roughness: 0.92 });

    // ── Body — stretched sphere, sculpted, with vertex-color spots ──
    const bodyGeo = new THREE.SphereGeometry(1, 20, 14);
    const bArr = bodyGeo.getAttribute('position');

    // Sculpt the body shape
    for (let i = 0; i < bArr.count; i++) {
      let x = bArr.getX(i);
      let y = bArr.getY(i);
      let z = bArr.getZ(i);
      z *= 1.5;
      x *= 0.82;
      y *= 0.62;
      if (y < -0.1) {
        y -= (0.1 + Math.abs(x) * 0.12) * (1 - Math.abs(z) * 0.3);
      }
      const zAbs = Math.abs(z);
      if (zAbs > 1.0) {
        const taper = 1 - (zAbs - 1.0) * 0.15;
        x *= taper;
        y *= taper;
      }
      if (z > 0.5 && z < 1.2) {
        y += 0.06;
      }
      bArr.setXYZ(i, x, y, z);
    }
    bodyGeo.computeVertexNormals();

    // Paint spots directly onto body vertices (no floating geometry)
    const spotCount = 3 + Math.floor(rng() * 3);
    const spotCenters: { x: number; y: number; z: number; r: number }[] = [];
    for (let s = 0; s < spotCount; s++) {
      // Pick a random spot center on the body surface
      spotCenters.push({
        x: (rng() > 0.5 ? 1 : -1) * (0.3 + rng() * 0.4),
        y: (rng() - 0.4) * 0.6,
        z: (rng() - 0.5) * 2.4,
        r: 0.3 + rng() * 0.45, // influence radius
      });
    }

    const colors = new Float32Array(bArr.count * 3);
    const baseCol = new THREE.Color(bodyColor);
    const spotCol = new THREE.Color(spotColor);
    for (let i = 0; i < bArr.count; i++) {
      const vx = bArr.getX(i);
      const vy = bArr.getY(i);
      const vz = bArr.getZ(i);

      // Check if this vertex falls within any spot
      let inSpot = false;
      for (const sc of spotCenters) {
        const dx = vx - sc.x;
        const dy = vy - sc.y;
        const dz = vz - sc.z;
        if (dx * dx + dy * dy * 4 + dz * dz < sc.r * sc.r) {
          inSpot = true;
          break;
        }
      }

      const c = inSpot ? spotCol : baseCol;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    bodyGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const bodyMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 1.2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // ── Neck — tapered cylinder bridging body to head ──
    const neckGeo = new THREE.CylinderGeometry(0.28, 0.38, 0.6, 10);
    const neck = new THREE.Mesh(neckGeo, bodyMat);
    neck.position.set(0, 1.4, 1.35);
    neck.rotation.x = -0.35;
    group.add(neck);

    // ── Head pivot ──
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 1.45, 1.55);

    // Head — rounded using sphere
    const headGeo = new THREE.SphereGeometry(0.42, 14, 10);
    const hArr = headGeo.getAttribute('position');
    for (let i = 0; i < hArr.count; i++) {
      let x = hArr.getX(i);
      let y = hArr.getY(i);
      let z = hArr.getZ(i);
      // Elongate forward
      z *= 1.15;
      // Slightly wider cheeks
      if (z < 0) x *= 1.08;
      // Flatten top a bit
      if (y > 0.2) y *= 0.9;
      hArr.setXYZ(i, x, y, z);
    }
    headGeo.computeVertexNormals();
    const head = new THREE.Mesh(headGeo, new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.88 }));
    head.position.set(0, 0.05, 0.25);
    head.castShadow = true;
    headPivot.add(head);

    // Muzzle — rounded box via sphere
    const muzzleGeo = new THREE.SphereGeometry(0.22, 10, 8);
    const mzArr = muzzleGeo.getAttribute('position');
    for (let i = 0; i < mzArr.count; i++) {
      let x = mzArr.getX(i);
      let y = mzArr.getY(i);
      let z = mzArr.getZ(i);
      x *= 1.3;
      y *= 0.8;
      z *= 0.7;
      mzArr.setXYZ(i, x, y, z);
    }
    muzzleGeo.computeVertexNormals();
    const muzzle = new THREE.Mesh(muzzleGeo, new THREE.MeshStandardMaterial({ color: skinPink, roughness: 0.75 }));
    muzzle.position.set(0, -0.1, 0.6);
    headPivot.add(muzzle);

    // Nostrils
    const nostrilGeo = new THREE.SphereGeometry(0.05, 8, 8);
    const nostrilMat = new THREE.MeshStandardMaterial({ color: 0x553333, roughness: 0.9 });
    for (const sx of [-0.1, 0.1]) {
      const n = new THREE.Mesh(nostrilGeo, nostrilMat);
      n.position.set(sx, -0.12, 0.75);
      headPivot.add(n);
    }

    // Eyes — larger, rounder
    const eyeWhiteGeo = new THREE.SphereGeometry(0.085, 12, 10);
    const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
    const pupilGeo = new THREE.SphereGeometry(0.052, 10, 8);
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x1a1100, roughness: 0.4 });
    const irisMat = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.5 });
    const irisGeo = new THREE.SphereGeometry(0.065, 10, 8);

    for (const sx of [-1, 1]) {
      const ew = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
      ew.position.set(sx * 0.3, 0.12, 0.45);
      headPivot.add(ew);
      const iris = new THREE.Mesh(irisGeo, irisMat);
      iris.position.set(sx * 0.3, 0.12, 0.5);
      headPivot.add(iris);
      const p = new THREE.Mesh(pupilGeo, pupilMat);
      p.position.set(sx * 0.3, 0.12, 0.53);
      headPivot.add(p);
    }

    // Ears — flattened cones, angled outward
    const earGeo = new THREE.ConeGeometry(0.12, 0.28, 8);
    const eArr = earGeo.getAttribute('position');
    for (let i = 0; i < eArr.count; i++) {
      // Flatten ears
      eArr.setZ(i, eArr.getZ(i) * 0.4);
    }
    earGeo.computeVertexNormals();
    const earMat = new THREE.MeshStandardMaterial({ color: skinPink, roughness: 0.85 });
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(earGeo, earMat);
      ear.position.set(sx * 0.4, 0.22, 0.15);
      ear.rotation.set(0.2, sx * 0.3, sx * 1.2);
      headPivot.add(ear);
    }

    // Horns — curved cones
    const hornGeo = new THREE.ConeGeometry(0.05, 0.35, 8);
    const hornMat = new THREE.MeshStandardMaterial({ color: hornColor, roughness: 0.55, metalness: 0.1 });
    for (const sx of [-1, 1]) {
      const horn = new THREE.Mesh(hornGeo, hornMat);
      horn.position.set(sx * 0.25, 0.38, 0.2);
      horn.rotation.z = sx * 0.5;
      horn.rotation.x = -0.15;
      headPivot.add(horn);
    }

    group.add(headPivot);

    // ── Legs — hip-pivot groups with upper + lower segments + hoof ──
    const legConfig = [
      { x: -0.45, z: 1.0, name: 'FL' as const },
      { x: 0.45, z: 1.0, name: 'FR' as const },
      { x: -0.45, z: -1.0, name: 'BL' as const },
      { x: 0.45, z: -1.0, name: 'BR' as const },
    ];

    const upperLen = 0.6;
    const lowerLen = 0.6;
    const legRadius = 0.09;

    const legs = {} as { FL: LegPivot; FR: LegPivot; BL: LegPivot; BR: LegPivot };

    for (const lc of legConfig) {
      // Hip pivot — positioned at body underside
      const pivot = new THREE.Group();
      pivot.position.set(lc.x, 0.82, lc.z);
      group.add(pivot);

      // Upper leg
      const upperGeo = new THREE.CylinderGeometry(legRadius * 1.2, legRadius, upperLen, 8);
      const upper = new THREE.Mesh(upperGeo, bodyMat);
      upper.position.y = -upperLen * 0.5;
      upper.castShadow = true;
      pivot.add(upper);

      // Lower leg (child of pivot, offset below upper)
      const lowerGeo = new THREE.CylinderGeometry(legRadius, legRadius * 0.85, lowerLen, 8);
      const lower = new THREE.Mesh(lowerGeo, bodyMat);
      lower.position.y = -upperLen - lowerLen * 0.5;
      lower.castShadow = true;
      pivot.add(lower);

      // Hoof
      const hoofGeo = new THREE.CylinderGeometry(legRadius * 1.3, legRadius * 1.4, 0.1, 8);
      const hoofMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.95 });
      const hoof = new THREE.Mesh(hoofGeo, hoofMat);
      hoof.position.y = -upperLen - lowerLen - 0.05;
      pivot.add(hoof);

      legs[lc.name] = { pivot, upper, lower, hoof };
    }

    // ── Tail pivot ──
    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, 1.35, -1.45);

    // Tail — tapered cylinder
    const tailGeo = new THREE.CylinderGeometry(0.035, 0.025, 0.9, 8);
    const tail = new THREE.Mesh(tailGeo, bodyMat);
    tail.position.y = -0.45;
    tailPivot.add(tail);

    // Tail tuft — soft blob
    const tuftGeo = new THREE.SphereGeometry(0.09, 8, 8);
    const tuft = new THREE.Mesh(tuftGeo, spotMat);
    tuft.position.y = -0.9;
    tuft.scale.set(1, 1.8, 1);
    tailPivot.add(tuft);

    group.add(tailPivot);

    // ── Udder ──
    if (rng() > 0.4) {
      const udderGeo = new THREE.SphereGeometry(0.18, 10, 8);
      const udderMat = new THREE.MeshStandardMaterial({ color: skinPink, roughness: 0.7 });
      const udder = new THREE.Mesh(udderGeo, udderMat);
      udder.position.set(0, 0.55, -0.5);
      udder.scale.set(1.15, 0.75, 0.95);
      group.add(udder);

      // Teats
      const teatGeo = new THREE.CylinderGeometry(0.025, 0.02, 0.1, 6);
      const teatMat = new THREE.MeshStandardMaterial({ color: 0xeea0a0, roughness: 0.7 });
      for (const sx of [-0.08, 0.08]) {
        for (const sz of [-0.55, -0.45]) {
          const teat = new THREE.Mesh(teatGeo, teatMat);
          teat.position.set(sx, 0.42, sz);
          group.add(teat);
        }
      }
    }

    // ── Bell ──
    const bellGeo = new THREE.SphereGeometry(0.07, 8, 8);
    const bellMat = new THREE.MeshStandardMaterial({ color: 0xccaa44, metalness: 0.6, roughness: 0.3 });
    const bell = new THREE.Mesh(bellGeo, bellMat);
    bell.position.set(0, 1.0, 1.3);
    group.add(bell);

    const strapGeo = new THREE.TorusGeometry(0.32, 0.025, 8, 16);
    const strapMat = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.9 });
    const strap = new THREE.Mesh(strapGeo, strapMat);
    strap.position.set(0, 1.15, 1.2);
    strap.rotation.x = Math.PI / 2;
    strap.rotation.z = Math.PI / 2;
    group.add(strap);

    return {
      group,
      bodyMesh: body,
      position: new THREE.Vector3(),
      heading: 0,
      displayHeading: 0,
      speed: 0,
      displaySpeed: 0,
      state: CowState.Grazing,
      stateTimer: 0,
      targetHeading: 0,
      walkCycle: rng() * Math.PI * 2,
      tailPhase: rng() * Math.PI * 2,
      headBob: 0,
      bodyBounce: 0,
      headPivot,
      tailPivot,
      legs,
      groundY: 0,
      displayY: 0,
      mooTimer: 0,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Update
  // ──────────────────────────────────────────────────────────────────────────

  update(dt: number, karts: Kart[], spline: TrackSpline): void {
    // At most one moo per frame to avoid cacophony
    let mooedThisFrame = false;

    for (const cow of this.cows) {
      this.updateCow(cow, dt, karts, spline);
      this.animateCow(cow, dt);

      // Periodic mooing
      cow.mooTimer -= dt;
      if (cow.mooTimer <= 0 && !mooedThisFrame && this.audio) {
        // Distance-based volume from player kart (first kart)
        let vol = 0.6;
        if (karts.length > 0) {
          const dx = karts[0].state.position.x - cow.position.x;
          const dz = karts[0].state.position.z - cow.position.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          vol = Math.max(0.05, 1.0 - dist / 80);
        }
        this.audio.playMoo(vol);
        mooedThisFrame = true;
        // Next moo in 8-25 seconds — cows moo more when alert/fleeing
        const excited = cow.state === CowState.Alert || cow.state === CowState.Fleeing;
        cow.mooTimer = excited ? 3 + Math.random() * 6 : 8 + Math.random() * 17;
      }
    }
  }

  private updateCow(cow: CowData, dt: number, karts: Kart[], spline: TrackSpline): void {
    // Find nearest kart
    let nearestDist = Infinity;
    let nearestKart: Kart | null = null;
    const nearestDir = new THREE.Vector3();

    for (const kart of karts) {
      const dx = kart.state.position.x - cow.position.x;
      const dz = kart.state.position.z - cow.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestKart = kart;
        nearestDir.set(dx, 0, dz).normalize();
      }
    }

    cow.stateTimer -= dt;

    // ── State machine ──
    switch (cow.state) {
      case CowState.Grazing:
        if (nearestDist < COW_FLEE_RANGE) {
          cow.state = CowState.Fleeing;
          cow.stateTimer = COW_FLEE_DURATION;
          cow.targetHeading = Math.atan2(-nearestDir.x, -nearestDir.z);
          cow.speed = COW_FLEE_SPEED;
        } else if (nearestDist < COW_ALERT_RANGE) {
          cow.state = CowState.Alert;
          cow.stateTimer = 0.5 + Math.random() * 1.0;
        } else if (cow.stateTimer <= 0) {
          cow.state = CowState.Idle;
          cow.stateTimer = COW_IDLE_MIN + Math.random() * (COW_IDLE_MAX - COW_IDLE_MIN);
        }
        cow.speed = 0;
        break;

      case CowState.Idle:
        if (nearestDist < COW_FLEE_RANGE) {
          cow.state = CowState.Fleeing;
          cow.stateTimer = COW_FLEE_DURATION;
          cow.targetHeading = Math.atan2(-nearestDir.x, -nearestDir.z);
          cow.speed = COW_FLEE_SPEED;
        } else if (nearestDist < COW_ALERT_RANGE) {
          cow.state = CowState.Alert;
          cow.stateTimer = 0.5 + Math.random() * 1.0;
        } else if (cow.stateTimer <= 0) {
          cow.state = CowState.Walking;
          cow.stateTimer = COW_WALK_MIN + Math.random() * (COW_WALK_MAX - COW_WALK_MIN);
          // Pick a direction away from track
          cow.targetHeading = cow.heading + (Math.random() - 0.5) * Math.PI * 1.6;
          cow.speed = COW_WALK_SPEED;
          this.applyHerdInfluence(cow);
        }
        cow.speed = 0;
        break;

      case CowState.Walking:
        if (nearestDist < COW_FLEE_RANGE) {
          cow.state = CowState.Fleeing;
          cow.stateTimer = COW_FLEE_DURATION;
          cow.targetHeading = Math.atan2(-nearestDir.x, -nearestDir.z);
          cow.speed = COW_FLEE_SPEED;
        } else if (nearestDist < COW_ALERT_RANGE) {
          cow.state = CowState.Alert;
          cow.stateTimer = 0.5 + Math.random() * 1.0;
          cow.speed = 0;
        } else if (cow.stateTimer <= 0) {
          cow.state = CowState.Grazing;
          cow.stateTimer = COW_GRAZE_MIN + Math.random() * (COW_GRAZE_MAX - COW_GRAZE_MIN);
          cow.speed = 0;
        }
        break;

      case CowState.Crossing:
        // Cow crossing the track — keeps walking in a straight line
        // Flee if a kart gets very close
        if (nearestDist < COW_FLEE_RANGE * 0.7) {
          cow.state = CowState.Fleeing;
          cow.stateTimer = COW_FLEE_DURATION;
          cow.targetHeading = Math.atan2(-nearestDir.x, -nearestDir.z);
          cow.speed = COW_FLEE_SPEED;
        } else if (cow.stateTimer <= 0) {
          cow.state = CowState.Grazing;
          cow.stateTimer = COW_GRAZE_MIN + Math.random() * (COW_GRAZE_MAX - COW_GRAZE_MIN);
          cow.speed = 0;
        }
        break;

      case CowState.Alert:
        if (nearestKart) {
          cow.targetHeading = Math.atan2(nearestDir.x, nearestDir.z);
        }
        cow.speed = 0;
        if (nearestDist < COW_FLEE_RANGE) {
          cow.state = CowState.Fleeing;
          cow.stateTimer = COW_FLEE_DURATION;
          cow.targetHeading = Math.atan2(-nearestDir.x, -nearestDir.z);
          cow.speed = COW_FLEE_SPEED;
        } else if (nearestDist > COW_ALERT_RANGE || cow.stateTimer <= 0) {
          cow.state = CowState.Idle;
          cow.stateTimer = COW_IDLE_MIN + Math.random() * (COW_IDLE_MAX - COW_IDLE_MIN);
        }
        break;

      case CowState.Fleeing:
        if (nearestDist < COW_FLEE_RANGE * 1.5 && nearestKart) {
          cow.targetHeading = Math.atan2(-nearestDir.x, -nearestDir.z);
        }
        cow.speed = COW_FLEE_SPEED;
        if (cow.stateTimer <= 0) {
          cow.state = CowState.Alert;
          cow.stateTimer = 1 + Math.random() * 2;
          cow.speed = 0;
        }
        break;
    }

    // ── Smooth heading ──
    let headingDiff = cow.targetHeading - cow.heading;
    while (headingDiff > Math.PI) headingDiff -= Math.PI * 2;
    while (headingDiff < -Math.PI) headingDiff += Math.PI * 2;
    const turnRate = cow.state === CowState.Fleeing ? 4.0
      : cow.state === CowState.Crossing ? 1.0
      : 2.0;
    cow.heading += Math.sign(headingDiff) * Math.min(Math.abs(headingDiff), turnRate * dt);

    // Smooth display heading (visual only)
    let dispDiff = cow.heading - cow.displayHeading;
    while (dispDiff > Math.PI) dispDiff -= Math.PI * 2;
    while (dispDiff < -Math.PI) dispDiff += Math.PI * 2;
    cow.displayHeading += dispDiff * Math.min(1, 6 * dt);

    // Smooth display speed
    cow.displaySpeed = damp(cow.displaySpeed, cow.speed, 5, dt);

    // ── Move — free movement, avoid road ──
    const effectiveSpeed = cow.displaySpeed;
    if (effectiveSpeed > 0.1) {
      cow.position.x += Math.sin(cow.heading) * effectiveSpeed * dt;
      cow.position.z += Math.cos(cow.heading) * effectiveSpeed * dt;
    }

    // Always update ground Y — use track surface height when on/near track
    const closestT = spline.findClosestT(cow.position);
    const sp = spline.getPointAt(closestT);
    const tdx = cow.position.x - sp.position.x;
    const tdz = cow.position.z - sp.position.z;
    const trackDist = Math.sqrt(tdx * tdx + tdz * tdz);

    // Steer away from road when too close (not fleeing)
    const edgeDist = trackDist - sp.width * 0.5;
    if (edgeDist < 5 && cow.state !== CowState.Fleeing) {
      // Push heading away from road
      const awayHeading = Math.atan2(tdx, tdz);
      let diff = awayHeading - cow.targetHeading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const urgency = 1 - Math.max(edgeDist, 0) / 5; // 0..1, stronger when closer
      cow.targetHeading += diff * urgency * 0.5;
      if (edgeDist < 2) {
        cow.targetHeading = awayHeading;
      }
    }

    cow.groundY = this.getGroundY(sp, trackDist);
    // Smooth Y transition to prevent popping
    cow.displayY = damp(cow.displayY, cow.groundY, 8, dt);
    cow.position.y = cow.displayY;

    // ── Apply to mesh ──
    cow.group.position.copy(cow.position);
    cow.group.rotation.y = cow.displayHeading + Math.PI;
  }

  private applyHerdInfluence(cow: CowData): void {
    let herdX = 0;
    let herdZ = 0;
    let herdCount = 0;

    for (const other of this.cows) {
      if (other === cow) continue;
      const dx = other.position.x - cow.position.x;
      const dz = other.position.z - cow.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < COW_HERD_RADIUS && dist > 0.1) {
        herdX += dx / dist;
        herdZ += dz / dist;
        herdCount++;
      }
    }

    if (herdCount > 0) {
      herdX /= herdCount;
      herdZ /= herdCount;
      const herdHeading = Math.atan2(herdX, herdZ);
      let diff = herdHeading - cow.targetHeading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      cow.targetHeading += diff * COW_HERD_WEIGHT;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Animation — smooth, natural, feet planted
  // ──────────────────────────────────────────────────────────────────────────

  private animateCow(cow: CowData, dt: number): void {
    const speed = cow.displaySpeed;
    const isMoving = speed > 0.3;
    const isFleeing = cow.state === CowState.Fleeing && speed > 3;
    const speedNorm = Math.min(speed / COW_FLEE_SPEED, 1); // 0..1

    // ── Walk cycle ──
    if (isMoving) {
      // Cycle speed scales with movement speed
      const cycleRate = isFleeing ? speed * 2.0 : speed * 2.8;
      cow.walkCycle += dt * cycleRate;
    }
    // Keep cycle going slightly even when stopping for smooth blend-out
    const cyclePhase = cow.walkCycle;

    // ── Leg animation with hip pivots ──
    // Stride amplitude ramps with speed
    const stride = isMoving
      ? (isFleeing ? 0.45 + speedNorm * 0.15 : 0.22 + speedNorm * 0.12)
      : 0;

    // Current stride (smoothed)
    const targetStride = stride;

    // Diagonal gait: FL+BR are paired, FR+BL are paired
    const phaseFLBR = Math.sin(cyclePhase);
    const phaseFRBL = Math.sin(cyclePhase + Math.PI);

    // Pendulum swing at hip pivot: positive = forward, negative = back
    const flAngle = phaseFLBR * targetStride;
    const brAngle = phaseFLBR * targetStride;
    const frAngle = phaseFRBL * targetStride;
    const blAngle = phaseFRBL * targetStride;

    // Apply with damping for smooth stop
    const legLambda = isMoving ? 12 : 6;
    cow.legs.FL.pivot.rotation.x = damp(cow.legs.FL.pivot.rotation.x, flAngle, legLambda, dt);
    cow.legs.FR.pivot.rotation.x = damp(cow.legs.FR.pivot.rotation.x, frAngle, legLambda, dt);
    cow.legs.BL.pivot.rotation.x = damp(cow.legs.BL.pivot.rotation.x, blAngle, legLambda, dt);
    cow.legs.BR.pivot.rotation.x = damp(cow.legs.BR.pivot.rotation.x, brAngle, legLambda, dt);

    // Lower leg: slight counter-rotation to simulate knee bend on backstroke
    // When upper swings back (negative), lower bends forward slightly
    const kneeAmount = isFleeing ? 0.3 : 0.15;
    for (const key of ['FL', 'FR', 'BL', 'BR'] as const) {
      const legPivot = cow.legs[key];
      const hipAngle = legPivot.pivot.rotation.x;
      // Knee bends more when leg swings back
      const kneeBend = hipAngle < 0 ? Math.abs(hipAngle) * kneeAmount : 0;
      legPivot.lower.rotation.x = damp(legPivot.lower.rotation.x, kneeBend, 10, dt);
    }

    // ── Body bounce (vertical) — subtle hop at 2x walk frequency ──
    if (isMoving) {
      cow.bodyBounce += dt * (isFleeing ? speed * 4.0 : speed * 5.6);
    }
    const bounceAmp = isMoving ? (isFleeing ? 0.06 : 0.025) * speedNorm : 0;
    const bounceY = Math.abs(Math.sin(cow.bodyBounce)) * bounceAmp;
    cow.bodyMesh.position.y = damp(cow.bodyMesh.position.y, 1.2 + bounceY, 10, dt);

    // ── Body lateral sway ──
    const swayAmp = isMoving ? 0.015 * speedNorm : 0;
    const sway = Math.sin(cyclePhase * 0.5) * swayAmp;
    cow.bodyMesh.rotation.z = damp(cow.bodyMesh.rotation.z, sway, 8, dt);

    // ── Body forward lean when running ──
    const leanTarget = isFleeing ? -0.08 * speedNorm : 0;
    cow.bodyMesh.rotation.x = damp(cow.bodyMesh.rotation.x, leanTarget, 5, dt);

    // ── Head animation ──
    if (cow.state === CowState.Grazing) {
      cow.headBob += dt * 1.5;
      const grazeAngle = -0.65 + Math.sin(cow.headBob) * 0.06;
      cow.headPivot.rotation.x = damp(cow.headPivot.rotation.x, grazeAngle, 4, dt);
    } else if (cow.state === CowState.Alert) {
      cow.headPivot.rotation.x = damp(cow.headPivot.rotation.x, 0.15, 4, dt);
    } else if (isMoving) {
      // Slight head bob while moving
      const headBobTarget = -0.05 + Math.sin(cyclePhase * 1.0) * 0.04;
      cow.headPivot.rotation.x = damp(cow.headPivot.rotation.x, headBobTarget, 6, dt);
    } else {
      cow.headPivot.rotation.x = damp(cow.headPivot.rotation.x, -0.15, 3, dt);
    }

    // ── Tail ──
    cow.tailPhase += dt * (isMoving ? 5 + speed : 2);
    const tailSwing = isMoving ? 0.35 + speedNorm * 0.2 : 0.12;
    const tailBaseAngle = isFleeing ? -0.5 : -0.3;
    cow.tailPivot.rotation.x = damp(
      cow.tailPivot.rotation.x,
      tailBaseAngle + Math.sin(cow.tailPhase) * tailSwing,
      8, dt,
    );
    cow.tailPivot.rotation.z = damp(
      cow.tailPivot.rotation.z,
      Math.sin(cow.tailPhase * 1.3) * 0.2,
      8, dt,
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Collision
  // ──────────────────────────────────────────────────────────────────────────

  checkCollisions(karts: Kart[]): boolean {
    let playerHit = false;

    for (const cow of this.cows) {
      for (const kart of karts) {
        if (kart.state.spinTimer > 0 || kart.state.hitTimer > 0) continue;
        if (kart.state.starTimer > 0) {
          const dx = cow.position.x - kart.state.position.x;
          const dz = cow.position.z - kart.state.position.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < COW_COLLISION_RADIUS + 1.8) {
            cow.state = CowState.Fleeing;
            cow.stateTimer = COW_FLEE_DURATION * 1.5;
            cow.targetHeading = Math.atan2(dx, dz);
            cow.speed = COW_FLEE_SPEED * 1.5;
          }
          continue;
        }

        const dx = kart.state.position.x - cow.position.x;
        const dz = kart.state.position.z - cow.position.z;
        const distSq = dx * dx + dz * dz;
        const minDist = COW_COLLISION_RADIUS + 1.8;

        if (distSq < minDist * minDist && Math.abs(kart.state.speed) > 2) {
          const dist = Math.sqrt(distSq);
          const nx = dx / dist;
          const nz = dz / dist;

          kart.state.position.x = cow.position.x + nx * minDist;
          kart.state.position.z = cow.position.z + nz * minDist;

          applyHit(kart.state, BANANA_SPIN_DURATION * 0.8);

          kart.state.velocity.x = nx * Math.abs(kart.state.speed) * 0.3;
          kart.state.velocity.z = nz * Math.abs(kart.state.speed) * 0.3;
          kart.state.speed *= 0.2;

          cow.state = CowState.Fleeing;
          cow.stateTimer = COW_FLEE_DURATION;
          cow.targetHeading = Math.atan2(-nx, -nz);
          cow.speed = COW_FLEE_SPEED;

          if (kart.isPlayer) playerHit = true;
        }
      }
    }

    return playerHit;
  }

  clear(): void {
    for (const cow of this.cows) {
      this.group.remove(cow.group);
    }
    this.cows.length = 0;
  }

  dispose(): void {
    this.clear();
  }

  get count(): number {
    return this.cows.length;
  }
}
