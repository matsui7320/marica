import * as THREE from 'three';
import { Kart } from '../../kart/Kart';
import { applyHit } from '../../kart/KartPhysics';
import { RED_SHELL_SPEED, RED_SHELL_TURN_RATE, SHELL_HIT_SPIN_DURATION } from '../../constants';

export interface RedShellEntity {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  active: boolean;
  ownerId: number;
  targetId: number;
  lifetime: number;
  age: number;
}

export function createRedShell(
  position: THREE.Vector3,
  heading: number,
  ownerId: number,
  targetId: number,
): RedShellEntity {
  const group = new THREE.Group();

  // Outer shell (slightly flattened sphere)
  const shellGeo = new THREE.SphereGeometry(0.4, 16, 12);
  shellGeo.scale(1, 0.7, 1);
  const shellMat = new THREE.MeshStandardMaterial({
    color: 0xcc0000,
    emissive: 0x660000,
    emissiveIntensity: 0.3,
    roughness: 0.35,
    metalness: 0.15,
  });
  const shell = new THREE.Mesh(shellGeo, shellMat);
  shell.castShadow = true;
  group.add(shell);

  // Shell ridges
  const ridgeGeo = new THREE.TorusGeometry(0.38, 0.025, 4, 20);
  const ridgeMat = new THREE.MeshStandardMaterial({
    color: 0x990000,
    roughness: 0.5,
  });
  for (let i = 0; i < 3; i++) {
    const ridge = new THREE.Mesh(ridgeGeo, ridgeMat);
    ridge.rotation.x = (i / 3) * Math.PI;
    ridge.scale.y = 0.7;
    group.add(ridge);
  }

  // White underbelly
  const bellyGeo = new THREE.SphereGeometry(0.35, 12, 6, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45);
  const bellyMat = new THREE.MeshStandardMaterial({
    color: 0xffffee,
    roughness: 0.6,
  });
  const belly = new THREE.Mesh(bellyGeo, bellyMat);
  belly.scale.set(1, 0.7, 1);
  group.add(belly);

  // Dark star pattern spots on top
  const spotGeo = new THREE.CircleGeometry(0.1, 5);
  const spotMat = new THREE.MeshStandardMaterial({
    color: 0x880000,
    roughness: 0.6,
    side: THREE.DoubleSide,
  });
  const spotPositions = [
    [0, 0.28, 0], [0.2, 0.2, 0.15], [-0.2, 0.2, 0.15],
    [0.15, 0.2, -0.2], [-0.15, 0.2, -0.2],
  ];
  for (const [sx, sy, sz] of spotPositions) {
    const spot = new THREE.Mesh(spotGeo, spotMat);
    spot.position.set(sx, sy, sz);
    spot.lookAt(0, 0.5, 0);
    group.add(spot);
  }

  // Homing glow aura
  const auraGeo = new THREE.SphereGeometry(0.48, 10, 8);
  const auraMat = new THREE.MeshBasicMaterial({
    color: 0xff4400,
    transparent: true,
    opacity: 0.15,
  });
  const aura = new THREE.Mesh(auraGeo, auraMat);
  aura.scale.set(1, 0.7, 1);
  group.add(aura);

  group.position.copy(position);
  group.position.y += 0.4;
  const mesh = group as any;

  const velocity = new THREE.Vector3(
    Math.sin(heading) * RED_SHELL_SPEED,
    0,
    Math.cos(heading) * RED_SHELL_SPEED,
  );

  return {
    mesh,
    position: position.clone(),
    velocity,
    active: true,
    ownerId,
    targetId,
    lifetime: 10,
    age: 0,
  };
}

export function updateRedShell(shell: RedShellEntity, dt: number, targets: Kart[]): void {
  if (!shell.active) return;

  shell.lifetime -= dt;
  shell.age += dt;
  if (shell.lifetime <= 0) {
    shell.active = false;
    shell.mesh.visible = false;
    return;
  }

  // Home towards target — only after a short forward launch phase (0.3s)
  if (shell.age > 0.3 && shell.targetId >= 0) {
    const target = targets.find(k => k.index === shell.targetId);
    if (target) {
      const toTarget = target.state.position.clone().sub(shell.position);
      toTarget.y = 0;
      const dist = toTarget.length();
      if (dist > 0.1) {
        toTarget.normalize();
        const currentDir = shell.velocity.clone().normalize();
        // Clamp lerp factor to [0, 1] for stable steering
        const lerpFactor = Math.min(RED_SHELL_TURN_RATE * dt, 1);
        const newDir = currentDir.lerp(toTarget, lerpFactor).normalize();
        shell.velocity.copy(newDir).multiplyScalar(RED_SHELL_SPEED);
      }
    }
  }

  shell.position.add(shell.velocity.clone().multiplyScalar(dt));
  shell.mesh.position.copy(shell.position);
  shell.mesh.position.y = 0.4;
  shell.mesh.rotation.y += dt * 10;
}

export function checkRedShellCollision(shell: RedShellEntity, kart: Kart): boolean {
  if (!shell.active) return false;
  if (kart.state.starTimer > 0) {
    shell.active = false;
    shell.mesh.visible = false;
    return false;
  }

  const dx = kart.state.position.x - shell.position.x;
  const dz = kart.state.position.z - shell.position.z;
  if (dx * dx + dz * dz < 3) {
    shell.active = false;
    shell.mesh.visible = false;
    applyHit(kart.state, SHELL_HIT_SPIN_DURATION);
    return true;
  }
  return false;
}
