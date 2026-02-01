import * as THREE from 'three';
import { ParticlePool } from './ParticlePool';
import { randomRange } from '../utils/math';

interface BoltMaterial {
  mat: THREE.MeshBasicMaterial;
  baseOpacity: number;
}

interface ActiveBolt {
  group: THREE.Group;
  timer: number;
  maxTime: number;
  materials: BoltMaterial[];
  /** Time of scheduled re-strike flash (-1 = already fired) */
  restrikeAt: number;
  impactPos: THREE.Vector3;
  scene: THREE.Scene;
  pool: ParticlePool;
}

/**
 * Lightning bolt strike effect — procedural zigzag bolts falling from
 * the sky onto a target position. Used when lightning item hits karts.
 */
export class LightningStrike {
  private activeBolts: ActiveBolt[] = [];

  strike(position: THREE.Vector3, scene: THREE.Scene, pool: ParticlePool): void {
    const group = new THREE.Group();
    const materials: BoltMaterial[] = [];

    const skyPos = position.clone();
    skyPos.y += 70;
    skyPos.x += randomRange(-4, 4);
    skyPos.z += randomRange(-4, 4);

    // ── Main bolt: thick bright white-blue core ──
    const mainPath = generateZigzag(skyPos, position, 12, 3.5);
    const mainCurve = new THREE.CatmullRomCurve3(mainPath);

    const mainMat = makeBoltMat(0xeeeeff, 1.0);
    materials.push({ mat: mainMat, baseOpacity: 1.0 });
    const mainGeo = new THREE.TubeGeometry(mainCurve, 24, 0.28, 5, false);
    group.add(new THREE.Mesh(mainGeo, mainMat));

    // ── Glow around bolt ──
    const glowMat = makeBoltMat(0x99aaff, 0.3);
    materials.push({ mat: glowMat, baseOpacity: 0.3 });
    const glowGeo = new THREE.TubeGeometry(mainCurve, 24, 0.5, 5, false);
    group.add(new THREE.Mesh(glowGeo, glowMat));

    // ── Branch bolts (1-2 small forks) ──
    const branchCount = 1 + Math.floor(Math.random() * 2);
    for (let b = 0; b < branchCount; b++) {
      const startIdx = 2 + Math.floor(Math.random() * 6);
      const branchStart = mainPath[Math.min(startIdx, mainPath.length - 2)];
      const branchEnd = branchStart.clone();
      branchEnd.x += randomRange(-5, 5);
      branchEnd.y -= randomRange(8, 18);
      branchEnd.z += randomRange(-5, 5);

      const branchPath = generateZigzag(branchStart, branchEnd, 4, 1.5);
      const branchCurve = new THREE.CatmullRomCurve3(branchPath);

      const branchMat = makeBoltMat(0xccccff, 0.6);
      materials.push({ mat: branchMat, baseOpacity: 0.6 });
      const branchGeo = new THREE.TubeGeometry(branchCurve, 8, 0.08, 4, false);
      group.add(new THREE.Mesh(branchGeo, branchMat));
    }

    // ── Small ground flash (subtle ring at impact) ──
    const ringMat = makeBoltMat(0x8899ff, 0.35);
    materials.push({ mat: ringMat, baseOpacity: 0.35 });
    const ringGeo = new THREE.RingGeometry(0.2, 2.5, 16);
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(position);
    ring.position.y += 0.15;
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);

    const maxTime = 1.2;
    scene.add(group);
    this.activeBolts.push({
      group, timer: maxTime, maxTime, materials,
      restrikeAt: maxTime - randomRange(0.25, 0.4),
      impactPos: position.clone(),
      scene, pool,
    });

    // ── Spark particles at impact ──
    emitSparks(pool, position, 15);
  }

  update(dt: number, scene: THREE.Scene): void {
    for (let i = this.activeBolts.length - 1; i >= 0; i--) {
      const bolt = this.activeBolts[i];
      bolt.timer -= dt;

      if (bolt.timer <= 0) {
        scene.remove(bolt.group);
        disposeBolt(bolt);
        this.activeBolts.splice(i, 1);
        continue;
      }

      const lifeRatio = bolt.timer / bolt.maxTime;

      // ── Re-strike flash: secondary bright flash partway through ──
      if (bolt.restrikeAt > 0 && bolt.timer < bolt.restrikeAt) {
        bolt.restrikeAt = -1;
        // Momentary full brightness + secondary spark burst
        for (const { mat, baseOpacity } of bolt.materials) {
          mat.opacity = baseOpacity;
        }
        emitSparks(bolt.pool, bolt.impactPos, 8);
        continue; // skip normal fade this frame
      }

      // Flicker: random blinks increase as bolt fades
      let flicker = 1.0;
      if (lifeRatio < 0.5) {
        // Aggressive flicker in last half
        const flickerChance = 0.3 + (1 - lifeRatio / 0.5) * 0.4;
        flicker = Math.random() > flickerChance ? 1.0 : 0.1;
      } else if (lifeRatio < 0.75) {
        // Occasional flicker in middle
        flicker = Math.random() > 0.15 ? 1.0 : 0.3;
      }

      for (const { mat, baseOpacity } of bolt.materials) {
        mat.opacity = baseOpacity * lifeRatio * flicker;
      }
    }
  }

  dispose(scene: THREE.Scene): void {
    for (const bolt of this.activeBolts) {
      scene.remove(bolt.group);
      disposeBolt(bolt);
    }
    this.activeBolts.length = 0;
  }
}

// ── Helpers ──

function makeBoltMat(color: number, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

function generateZigzag(
  start: THREE.Vector3, end: THREE.Vector3,
  segments: number, spread: number,
): THREE.Vector3[] {
  const points: THREE.Vector3[] = [start.clone()];
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const p = start.clone().lerp(end, t);
    p.x += (Math.random() - 0.5) * spread;
    p.z += (Math.random() - 0.5) * spread;
    points.push(p);
  }
  points.push(end.clone());
  return points;
}

function emitSparks(pool: ParticlePool, pos: THREE.Vector3, count: number): void {
  const white = new THREE.Color(0xffffff);
  const blue = new THREE.Color(0x6688ff);
  const yellow = new THREE.Color(0xffee88);

  // Small radial burst of sparks
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = randomRange(2, 8);
    const vel = new THREE.Vector3(
      Math.cos(angle) * speed,
      randomRange(1, 6),
      Math.sin(angle) * speed,
    );
    const r = Math.random();
    const c = r < 0.4 ? white : r < 0.7 ? blue : yellow;
    pool.emit(
      pos.clone().add(new THREE.Vector3(0, 0.5, 0)),
      vel, c,
      randomRange(0.08, 0.25),
      randomRange(0.2, 0.5),
    );
  }

  // A few upward sparks
  for (let i = 0; i < 4; i++) {
    const vel = new THREE.Vector3(
      randomRange(-1, 1),
      randomRange(5, 12),
      randomRange(-1, 1),
    );
    pool.emit(
      pos.clone().add(new THREE.Vector3(0, 0.3, 0)),
      vel, white,
      randomRange(0.08, 0.15),
      randomRange(0.15, 0.35),
    );
  }
}

function disposeBolt(bolt: ActiveBolt): void {
  bolt.group.traverse(child => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      (child.material as THREE.Material).dispose();
    }
  });
}
