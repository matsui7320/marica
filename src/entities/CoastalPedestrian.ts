import * as THREE from 'three';
import { TrackSpline } from '../track/TrackSpline';
import { Kart } from '../kart/Kart';

// ── Constants ──
const ROADSIDE_COUNT = 20;       // peds along the coastal roadside only
const BEACH_COUNT = 15;          // peds on the beach / near water
const HOUSE_AREA_COUNT = 20;     // peds near beach house clusters
const PED_WALK_SPEED = 1.6;
const PED_ALERT_RANGE = 18;
const PED_WALK_MIN = 3;
const PED_WALK_MAX = 8;
const PED_IDLE_MIN = 2;
const PED_IDLE_MAX = 6;
const PED_SCALE = 1.8;           // 1.2 base × 1.5 = 1.8
const PED_Y_OFFSET = 0.15;

// Beach house cluster layout (must match BeachHouse.ts)
const SHORE_X = 130;
const CLUSTER_COUNT = 5;
const CLUSTER_Z_START = -600;
const CLUSTER_Z_SPACING = 250;

const enum PedState {
  Idle,
  Walking,
  Alert,
}

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

function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

/** Beach slope Y (matches TrackEnvironment) */
function beachY(x: number): number {
  const t = (x - SHORE_X) / 100;
  return 0.3 - t * 2.5;
}

// ── Outfit colour palettes ──
interface Outfit {
  shirt: number;
  pants: number;
  skin: number;
  hair: number;
  hat: number | null;
}

const SKIN_TONES = [0xf5d0a9, 0xe8b88a, 0xd4956b, 0xba7a4e, 0x8d5a3c];
const HAIR_COLORS = [0x1a1a1a, 0x4a3520, 0x8b6f47, 0xd4a55a, 0xaa3322];
const SHIRT_COLORS = [0xee4444, 0x4488ee, 0xeeee44, 0x44cc66, 0xffffff, 0xff8833, 0xcc44cc, 0x44dddd];
const PANTS_COLORS = [0x334488, 0x886633, 0xddddcc, 0x555555, 0xcc6644];
const HAT_COLORS = [0xee3333, 0xffffff, 0x3366cc, 0xffcc33, null, null, null];

// ── Leg pivot ──
interface LegPivot {
  pivot: THREE.Group;
  upper: THREE.Mesh;
  lower: THREE.Mesh;
}

// ── Arm pivot ──
interface ArmPivot {
  pivot: THREE.Group;
  upper: THREE.Mesh;
  lower: THREE.Mesh;
}

// ── Per-pedestrian data ──
interface PedData {
  group: THREE.Group;
  bodyMesh: THREE.Mesh;
  position: THREE.Vector3;
  heading: number;
  displayHeading: number;
  speed: number;
  displaySpeed: number;
  state: PedState;
  stateTimer: number;
  targetHeading: number;
  walkCycle: number;
  bodyBounce: number;
  headPivot: THREE.Group;
  legs: { L: LegPivot; R: LegPivot };
  arms: { L: ArmPivot; R: ArmPivot };
  groundY: number;
  displayY: number;
  isBeachPed: boolean;  // true = on beach (uses beachY), false = roadside (uses spline)
}

export class CoastalPedestrians {
  readonly group = new THREE.Group();
  private peds: PedData[] = [];
  private rng: () => number;

  constructor() {
    this.rng = mulberry32(161803);
  }

  spawn(spline: TrackSpline): void {
    this.clear();
    const rng = this.rng;

    // ── 1. Roadside peds — only on the +X (coastal/beach) side of the track ──
    let placed = 0;
    for (let attempt = 0; placed < ROADSIDE_COUNT && attempt < ROADSIDE_COUNT * 8; attempt++) {
      const t = rng();
      const sp = spline.getPointAt(t);

      // Only place on the +X side (coastal side, toward shore)
      const side = 1;
      const edgeDist = 2 + rng() * 5;
      const dist = sp.width * 0.5 + edgeDist;

      const pos = sp.position.clone()
        .add(sp.binormal.clone().multiplyScalar(side * dist));

      // Verify it's on the +X side (toward coast)
      if (pos.x < sp.position.x) continue;

      // Reject if on road
      const closestT = spline.findClosestT(pos);
      const closestSp = spline.getPointAt(closestT);
      const dx = pos.x - closestSp.position.x;
      const dz = pos.z - closestSp.position.z;
      const xzDist = Math.sqrt(dx * dx + dz * dz);
      if (xzDist < closestSp.width * 0.5) continue;

      pos.y = this.getGroundY(closestSp, xzDist) + PED_Y_OFFSET;

      this.placePed(rng, pos, false);
      placed++;
    }

    // ── 2. Beach house area peds — clustered near each house cluster ──
    placed = 0;
    const pedsPerCluster = Math.ceil(HOUSE_AREA_COUNT / CLUSTER_COUNT);
    for (let c = 0; c < CLUSTER_COUNT; c++) {
      const clusterZ = CLUSTER_Z_START + c * CLUSTER_Z_SPACING;
      const clusterX = SHORE_X - 10;

      for (let p = 0; p < pedsPerCluster && placed < HOUSE_AREA_COUNT; p++) {
        // Scatter around the house cluster area
        const px = clusterX + rng() * 40 - 5;  // spread in X around houses
        const pz = clusterZ + (rng() - 0.5) * 80; // spread in Z along cluster
        const py = beachY(px) + PED_Y_OFFSET;

        const pos = new THREE.Vector3(px, py, pz);
        this.placePed(rng, pos, true);
        placed++;
      }
    }

    // ── 3. Beach peds — scattered on the sand between shore and water ──
    placed = 0;
    for (let attempt = 0; placed < BEACH_COUNT && attempt < BEACH_COUNT * 4; attempt++) {
      const px = SHORE_X + 10 + rng() * 70;  // on beach, X=140..210
      const pz = -500 + rng() * 900;          // spread along Z
      const py = beachY(px) + PED_Y_OFFSET;

      // Don't place too deep in water
      if (py < -1.5) continue;

      const pos = new THREE.Vector3(px, py, pz);
      this.placePed(rng, pos, true);
      placed++;
    }
  }

  private placePed(rng: () => number, pos: THREE.Vector3, isBeachPed: boolean): void {
    const heading = rng() * Math.PI * 2;
    const outfit = this.randomOutfit(rng);
    const ped = this.buildPedMesh(rng, outfit);

    ped.group.position.copy(pos);
    ped.group.rotation.y = heading + Math.PI;

    ped.position = pos.clone();
    ped.heading = heading;
    ped.displayHeading = heading;
    ped.targetHeading = heading;
    ped.groundY = pos.y;
    ped.displayY = pos.y;
    ped.isBeachPed = isBeachPed;
    ped.state = rng() > 0.5 ? PedState.Idle : PedState.Walking;
    ped.stateTimer = PED_IDLE_MIN + rng() * (PED_IDLE_MAX - PED_IDLE_MIN);
    if (ped.state === PedState.Walking) {
      ped.speed = PED_WALK_SPEED;
      ped.stateTimer = PED_WALK_MIN + rng() * (PED_WALK_MAX - PED_WALK_MIN);
    }

    this.group.add(ped.group);
    this.peds.push(ped);
  }

  private randomOutfit(rng: () => number): Outfit {
    return {
      skin: SKIN_TONES[Math.floor(rng() * SKIN_TONES.length)],
      hair: HAIR_COLORS[Math.floor(rng() * HAIR_COLORS.length)],
      shirt: SHIRT_COLORS[Math.floor(rng() * SHIRT_COLORS.length)],
      pants: PANTS_COLORS[Math.floor(rng() * PANTS_COLORS.length)],
      hat: HAT_COLORS[Math.floor(rng() * HAT_COLORS.length)],
    };
  }

  /** Match TrackEnvironment.groundY exactly */
  private getGroundY(sp: { position: THREE.Vector3; width: number }, xzDist: number): number {
    const hw = sp.width * 0.5;
    const edgeDist = xzDist - hw;
    if (edgeDist <= 0) return sp.position.y;
    const t = Math.min(Math.max((edgeDist - 12) / 30, 0), 1);
    const s = t * t * (3 - 2 * t);
    const baseY = sp.position.y * (1 - s) + (-0.5) * s;
    const zOffset = 0.35 * (1 - Math.min(edgeDist / 15, 1));
    return baseY - zOffset;
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Procedural human mesh — natural proportions, feet at Y≈0
  //  Total height ≈ 1.7 local units. Feet bottom at Y=0.
  // ──────────────────────────────────────────────────────────────────────────

  private buildPedMesh(rng: () => number, outfit: Outfit): PedData {
    const group = new THREE.Group();

    const skinMat = new THREE.MeshStandardMaterial({ color: outfit.skin, roughness: 0.7 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: outfit.shirt, roughness: 0.6 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: outfit.pants, roughness: 0.65 });
    const hairMat = new THREE.MeshStandardMaterial({ color: outfit.hair, roughness: 0.85 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.7 });

    const s = (m: THREE.Mesh) => { m.castShadow = true; m.receiveShadow = true; };

    // All Y values are absolute from ground (Y=0 = feet bottom)

    // ── Torso — smooth tapered cylinder for natural shape ──
    const torsoGeo = new THREE.CylinderGeometry(0.16, 0.14, 0.55, 16);
    const torso = new THREE.Mesh(torsoGeo, shirtMat);
    torso.position.y = 1.18;
    s(torso);
    group.add(torso);

    // Chest volume — subtle sphere to round out upper torso
    const chestGeo = new THREE.SphereGeometry(0.17, 14, 10);
    const chest = new THREE.Mesh(chestGeo, shirtMat);
    chest.position.y = 1.28;
    chest.scale.set(1, 0.7, 0.75);
    s(chest);
    group.add(chest);

    // ── Hips/waist — smooth transition to legs ──
    const hipsGeo = new THREE.CylinderGeometry(0.14, 0.16, 0.2, 16);
    const hips = new THREE.Mesh(hipsGeo, pantsMat);
    hips.position.y = 0.85;
    s(hips);
    group.add(hips);

    // ── Shoulder bridge — connects torso to arms ──
    for (const side of [-1, 1]) {
    const bridgeGeo = new THREE.SphereGeometry(0.09, 12, 10);
    const bridge = new THREE.Mesh(bridgeGeo, shirtMat);
    bridge.position.set(side * 0.16, 1.42, 0);
    bridge.scale.set(1.1, 0.7, 0.8);
    s(bridge);
    group.add(bridge);
    }

    // ── Neck ──
    const neckGeo = new THREE.CylinderGeometry(0.055, 0.06, 0.12, 12);
    const neck = new THREE.Mesh(neckGeo, skinMat);
    neck.position.y = 1.5;
    s(neck);
    group.add(neck);

    // ── Head pivot ──
    const headPivot = new THREE.Group();
    headPivot.position.y = 1.58;
    group.add(headPivot);

    // Head
    const headGeo = new THREE.SphereGeometry(0.14, 16, 12);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 0.05;
    head.scale.set(1, 1.08, 0.92);
    s(head);
    headPivot.add(head);

    // Hair
    const hairGeo = new THREE.SphereGeometry(0.15, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.y = 0.08;
    s(hair);
    headPivot.add(hair);

    // Back of hair
    const backHairGeo = new THREE.SphereGeometry(0.12, 12, 8);
    const backHair = new THREE.Mesh(backHairGeo, hairMat);
    backHair.position.set(0, 0.0, 0.06);
    backHair.scale.set(0.9, 0.7, 0.6);
    headPivot.add(backHair);

    // Hat (optional)
    if (outfit.hat !== null) {
      const hatMat = new THREE.MeshStandardMaterial({ color: outfit.hat, roughness: 0.5 });
      const brimGeo = new THREE.CylinderGeometry(0.22, 0.23, 0.02, 18);
      const brim = new THREE.Mesh(brimGeo, hatMat);
      brim.position.y = 0.16;
      s(brim);
      headPivot.add(brim);
      const crownGeo = new THREE.SphereGeometry(0.12, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
      const crown = new THREE.Mesh(crownGeo, hatMat);
      crown.position.y = 0.17;
      s(crown);
      headPivot.add(crown);
    }

    // ── Legs — pivot at hip, feet reach Y=0 ──
    // Hip pivot at Y=0.78, foot bottom at Y=0 → leg length = 0.78
    const buildLeg = (xOff: number): LegPivot => {
      const pivot = new THREE.Group();
      pivot.position.set(xOff, 0.78, 0);
      group.add(pivot);

      // Thigh
      const upperGeo = new THREE.CylinderGeometry(0.07, 0.06, 0.38, 14);
      const upper = new THREE.Mesh(upperGeo, pantsMat);
      upper.position.y = -0.2;
      s(upper);
      pivot.add(upper);

      // Shin
      const lowerGeo = new THREE.CylinderGeometry(0.058, 0.048, 0.36, 14);
      const lower = new THREE.Mesh(lowerGeo, skinMat);
      lower.position.y = -0.56;
      s(lower);
      pivot.add(lower);

      // Foot — flat rounded box sitting on ground
      const footGeo = new THREE.CylinderGeometry(0.04, 0.055, 0.13, 12);
      footGeo.rotateX(Math.PI * 0.5);
      const foot = new THREE.Mesh(footGeo, shoeMat);
      foot.position.set(0, -0.76, -0.02);
      foot.scale.set(1.1, 1, 1.2);
      s(foot);
      pivot.add(foot);

      return { pivot, upper, lower };
    };

    const legL = buildLeg(-0.08);
    const legR = buildLeg(0.08);

    // ── Arms — natural proportions ──
    const buildArm = (xOff: number): ArmPivot => {
      const pivot = new THREE.Group();
      pivot.position.set(xOff, 1.4, 0);
      group.add(pivot);

      // Shoulder cap
      const shoulderGeo = new THREE.SphereGeometry(0.05, 10, 8);
      const shoulder = new THREE.Mesh(shoulderGeo, shirtMat);
      shoulder.position.y = -0.02;
      pivot.add(shoulder);

      // Upper arm
      const upperGeo = new THREE.CylinderGeometry(0.045, 0.04, 0.3, 12);
      const upper = new THREE.Mesh(upperGeo, shirtMat);
      upper.position.y = -0.18;
      s(upper);
      pivot.add(upper);

      // Forearm
      const lowerGeo = new THREE.CylinderGeometry(0.038, 0.03, 0.28, 12);
      const lower = new THREE.Mesh(lowerGeo, skinMat);
      lower.position.y = -0.46;
      s(lower);
      pivot.add(lower);

      // Hand
      const handGeo = new THREE.SphereGeometry(0.03, 8, 6);
      const hand = new THREE.Mesh(handGeo, skinMat);
      hand.position.y = -0.62;
      pivot.add(hand);

      return { pivot, upper, lower };
    };

    const armL = buildArm(-0.2);
    const armR = buildArm(0.2);

    group.scale.setScalar(PED_SCALE);

    return {
      group,
      bodyMesh: torso,
      position: new THREE.Vector3(),
      heading: 0,
      displayHeading: 0,
      speed: 0,
      displaySpeed: 0,
      state: PedState.Idle,
      stateTimer: 0,
      targetHeading: 0,
      walkCycle: 0,
      bodyBounce: 0,
      headPivot,
      legs: { L: legL, R: legR },
      arms: { L: armL, R: armR },
      groundY: 0,
      displayY: 0,
      isBeachPed: false,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Update
  // ──────────────────────────────────────────────────────────────────────────

  update(dt: number, karts: Kart[], spline: TrackSpline): void {
    for (const ped of this.peds) {
      this.updatePed(ped, dt, karts, spline);
      this.animatePed(ped, dt);
    }
  }

  private updatePed(ped: PedData, dt: number, karts: Kart[], spline: TrackSpline): void {
    // Find nearest kart
    let nearestDist = Infinity;
    const nearestDir = new THREE.Vector3();

    for (const kart of karts) {
      const dx = kart.state.position.x - ped.position.x;
      const dz = kart.state.position.z - ped.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestDir.set(dx, 0, dz).normalize();
      }
    }

    ped.stateTimer -= dt;

    // ── State machine ──
    switch (ped.state) {
      case PedState.Idle:
        if (nearestDist < PED_ALERT_RANGE) {
          ped.state = PedState.Alert;
          ped.stateTimer = 0.5 + Math.random() * 1.0;
        } else if (ped.stateTimer <= 0) {
          ped.state = PedState.Walking;
          ped.stateTimer = PED_WALK_MIN + Math.random() * (PED_WALK_MAX - PED_WALK_MIN);
          ped.targetHeading = ped.heading + (Math.random() - 0.5) * Math.PI * 1.2;
          ped.speed = PED_WALK_SPEED;
        }
        if (ped.state === PedState.Idle) ped.speed = 0;
        break;

      case PedState.Walking:
        if (nearestDist < PED_ALERT_RANGE) {
          ped.state = PedState.Alert;
          ped.stateTimer = 0.5 + Math.random() * 1.0;
          ped.speed = 0;
        } else if (ped.stateTimer <= 0) {
          ped.state = PedState.Idle;
          ped.stateTimer = PED_IDLE_MIN + Math.random() * (PED_IDLE_MAX - PED_IDLE_MIN);
          ped.speed = 0;
        }
        break;

      case PedState.Alert:
        ped.targetHeading = Math.atan2(nearestDir.x, nearestDir.z);
        ped.speed = 0;
        if (nearestDist > PED_ALERT_RANGE || ped.stateTimer <= 0) {
          ped.state = PedState.Idle;
          ped.stateTimer = PED_IDLE_MIN + Math.random() * (PED_IDLE_MAX - PED_IDLE_MIN);
        }
        break;

    }

    // ── Smooth heading ──
    let headingDiff = ped.targetHeading - ped.heading;
    while (headingDiff > Math.PI) headingDiff -= Math.PI * 2;
    while (headingDiff < -Math.PI) headingDiff += Math.PI * 2;
    const turnRate = 2.5;
    ped.heading += Math.sign(headingDiff) * Math.min(Math.abs(headingDiff), turnRate * dt);

    let dispDiff = ped.heading - ped.displayHeading;
    while (dispDiff > Math.PI) dispDiff -= Math.PI * 2;
    while (dispDiff < -Math.PI) dispDiff += Math.PI * 2;
    ped.displayHeading += dispDiff * Math.min(1, 6 * dt);

    ped.displaySpeed = damp(ped.displaySpeed, ped.speed, 5, dt);

    // ── Move ──
    const effectiveSpeed = ped.displaySpeed;
    if (effectiveSpeed > 0.1) {
      ped.position.x += Math.sin(ped.heading) * effectiveSpeed * dt;
      ped.position.z += Math.cos(ped.heading) * effectiveSpeed * dt;
    }

    // ── Ground Y ──
    if (ped.isBeachPed) {
      ped.groundY = beachY(ped.position.x) + PED_Y_OFFSET;
    } else {
      const closestT = spline.findClosestT(ped.position);
      const sp = spline.getPointAt(closestT);
      const tdx = ped.position.x - sp.position.x;
      const tdz = ped.position.z - sp.position.z;
      const trackDist = Math.sqrt(tdx * tdx + tdz * tdz);
      const edgeDist = trackDist - sp.width * 0.5;
      if (edgeDist < 3) {
        const awayHeading = Math.atan2(tdx, tdz);
        let diff = awayHeading - ped.targetHeading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const urgency = 1 - Math.max(edgeDist, 0) / 3;
        ped.targetHeading += diff * urgency * 0.6;
        if (edgeDist < 1.5) {
          ped.targetHeading = awayHeading;
        }
      }
      ped.groundY = this.getGroundY(sp, trackDist) + PED_Y_OFFSET;
    }

    // Smooth Y transition — prevents popping and ensures no floating/sinking
    ped.displayY = damp(ped.displayY, ped.groundY, 15, dt);
    ped.position.y = ped.displayY;

    ped.group.position.copy(ped.position);
    ped.group.rotation.y = ped.displayHeading + Math.PI;
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Walk animation — bipedal gait with arm swing
  // ──────────────────────────────────────────────────────────────────────────

  private animatePed(ped: PedData, dt: number): void {
    const speed = ped.displaySpeed;
    const isMoving = speed > 0.2;
    const speedNorm = Math.min(speed / PED_WALK_SPEED, 1);

    if (isMoving) {
      ped.walkCycle += dt * speed * 3.5;
    }
    const phase = ped.walkCycle;

    // ── Leg animation ──
    const stride = isMoving ? 0.3 + speedNorm * 0.15 : 0;

    const phaseL = Math.sin(phase);
    const phaseR = Math.sin(phase + Math.PI);

    const legLambda = isMoving ? 12 : 6;
    ped.legs.L.pivot.rotation.x = damp(ped.legs.L.pivot.rotation.x, phaseL * stride, legLambda, dt);
    ped.legs.R.pivot.rotation.x = damp(ped.legs.R.pivot.rotation.x, phaseR * stride, legLambda, dt);

    const kneeAmount = 0.25;
    for (const key of ['L', 'R'] as const) {
      const hipAngle = ped.legs[key].pivot.rotation.x;
      const kneeBend = hipAngle < 0 ? Math.abs(hipAngle) * kneeAmount : 0;
      ped.legs[key].lower.rotation.x = damp(ped.legs[key].lower.rotation.x, kneeBend, 10, dt);
    }

    // ── Arm swing ──
    const armSwing = isMoving ? 0.2 + speedNorm * 0.1 : 0;

    ped.arms.L.pivot.rotation.x = damp(ped.arms.L.pivot.rotation.x, phaseR * armSwing, legLambda, dt);
    ped.arms.R.pivot.rotation.x = damp(ped.arms.R.pivot.rotation.x, phaseL * armSwing, legLambda, dt);

    for (const key of ['L', 'R'] as const) {
      const shoulderAngle = ped.arms[key].pivot.rotation.x;
      const elbowBend = shoulderAngle > 0 ? shoulderAngle * 0.4 : 0;
      ped.arms[key].lower.rotation.x = damp(ped.arms[key].lower.rotation.x, -elbowBend, 10, dt);
    }

    // ── Body bounce ──
    if (isMoving) {
      ped.bodyBounce += dt * speed * 7.0;
    }
    const bounceAmp = isMoving ? 0.015 * speedNorm : 0;
    const bounceY = Math.abs(Math.sin(ped.bodyBounce)) * bounceAmp;
    ped.bodyMesh.position.y = damp(ped.bodyMesh.position.y, 1.18 + bounceY, 10, dt);

    // ── Body forward lean ──
    const leanTarget = isMoving ? -0.03 : 0;
    ped.bodyMesh.rotation.x = damp(ped.bodyMesh.rotation.x, leanTarget, 5, dt);

    // ── Body lateral sway ──
    const swayAmp = isMoving ? 0.02 * speedNorm : 0;
    const sway = Math.sin(phase * 0.5) * swayAmp;
    ped.bodyMesh.rotation.z = damp(ped.bodyMesh.rotation.z, sway, 8, dt);

    // ── Head animation ──
    if (ped.state === PedState.Alert) {
      ped.headPivot.rotation.x = damp(ped.headPivot.rotation.x, -0.1, 4, dt);
    } else if (isMoving) {
      const headBob = Math.sin(phase * 1.0) * 0.03;
      ped.headPivot.rotation.x = damp(ped.headPivot.rotation.x, headBob, 6, dt);
    } else {
      ped.headPivot.rotation.x = damp(ped.headPivot.rotation.x, 0, 3, dt);
    }
  }

  clear(): void {
    for (const ped of this.peds) {
      this.group.remove(ped.group);
    }
    this.peds.length = 0;
  }

  dispose(): void {
    this.clear();
  }
}
