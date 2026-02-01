import * as THREE from 'three';
import { Kart } from '../../kart/Kart';
import { applyHit } from '../../kart/KartPhysics';
import { BANANA_SPIN_DURATION } from '../../constants';

export interface BananaEntity {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  active: boolean;
  ownerId: number;
}

export function createBanana(position: THREE.Vector3, ownerId: number): BananaEntity {
  const group = new THREE.Group();

  // ── Banana body — curved tapered tube via Lathe + path ──
  // Build a curved spine (arc) with tapered cross-section
  const SEGS = 16;
  const ARC = Math.PI * 1.3;       // bend angle
  const RADIUS = 0.35;             // arc radius
  const points: THREE.Vector3[] = [];

  for (let i = 0; i <= SEGS; i++) {
    const t = i / SEGS;
    const angle = t * ARC;
    // Position along arc
    const cx = Math.cos(angle) * RADIUS;
    const cy = Math.sin(angle) * RADIUS;
    // Taper: thick in middle, thin at tips (banana shape)
    const taper = Math.sin(t * Math.PI);  // 0 at ends, 1 at middle
    const r = 0.02 + taper * 0.1;         // min 0.02, max 0.12
    points.push(new THREE.Vector3(cx, cy, r));
  }

  // Build tube manually — ring of vertices at each spine point
  const RING_SEGS = 10;
  const verts: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= SEGS; i++) {
    const t = i / SEGS;
    const angle = t * ARC;
    const cx = points[i].x;
    const cy = points[i].y;
    const r = points[i].z;  // radius stored in z

    // Tangent along arc
    const tx = -Math.sin(angle);
    const ty = Math.cos(angle);

    // Normal & binormal (arc is in XY plane, binormal is Z)
    for (let j = 0; j <= RING_SEGS; j++) {
      const phi = (j / RING_SEGS) * Math.PI * 2;
      // Cross-section: slightly flattened (banana has ridges)
      const flatScale = 1 + 0.15 * Math.cos(phi * 5);  // 5 subtle ridges
      const rx = r * flatScale;
      const rz = r * 0.85 * flatScale;  // slightly flatter depth

      // Offset from spine in normal (radial outward) and Z
      const nx = -ty;
      const ny = tx;
      const ox = nx * rx * Math.cos(phi);
      const oy = ny * rx * Math.cos(phi);
      const oz = rz * Math.sin(phi);

      verts.push(cx + ox, cy + oy, oz);
      // Normal for lighting
      const nl = Math.sqrt(ox * ox + oy * oy + oz * oz) || 1;
      normals.push(ox / nl, oy / nl, oz / nl);
      uvs.push(t, j / RING_SEGS);
    }
  }

  // Indices
  for (let i = 0; i < SEGS; i++) {
    for (let j = 0; j < RING_SEGS; j++) {
      const a = i * (RING_SEGS + 1) + j;
      const b = a + RING_SEGS + 1;
      indices.push(a, b, a + 1);
      indices.push(a + 1, b, b + 1);
    }
  }

  const bodyGeo = new THREE.BufferGeometry();
  bodyGeo.setIndex(indices);
  bodyGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  bodyGeo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  bodyGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  bodyGeo.computeVertexNormals();

  // Banana peel texture via canvas
  const texCanvas = document.createElement('canvas');
  texCanvas.width = 128;
  texCanvas.height = 64;
  const ctx = texCanvas.getContext('2d')!;
  // Base yellow gradient (slightly greener at tips)
  const grad = ctx.createLinearGradient(0, 0, 128, 0);
  grad.addColorStop(0, '#7a8a20');    // green-brown stem end
  grad.addColorStop(0.08, '#f5d800');
  grad.addColorStop(0.5, '#ffdd00');  // bright yellow middle
  grad.addColorStop(0.92, '#f5d800');
  grad.addColorStop(1, '#6b4226');    // brown tip
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 64);
  // Brown speckles
  for (let i = 0; i < 60; i++) {
    const bx = 15 + Math.random() * 98;
    const by = Math.random() * 64;
    const bs = 1 + Math.random() * 2;
    ctx.fillStyle = `rgba(100,70,20,${0.15 + Math.random() * 0.25})`;
    ctx.fillRect(bx, by, bs, bs);
  }
  // Ridge lines along length (subtle darker stripes)
  for (let r = 0; r < 5; r++) {
    const ry = (r + 0.5) * (64 / 5);
    ctx.strokeStyle = 'rgba(180,160,0,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(10, ry);
    ctx.lineTo(118, ry + (Math.random() - 0.5) * 3);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(texCanvas);

  const bodyMat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.55,
    metalness: 0.02,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  group.add(body);

  // ── Stem nub (top end) ──
  const stemGeo = new THREE.CylinderGeometry(0.015, 0.025, 0.06, 8);
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x5a4a20, roughness: 0.9 });
  const stem = new THREE.Mesh(stemGeo, stemMat);
  // Position at start of arc (angle=0)
  stem.position.set(RADIUS, 0, 0);
  stem.rotation.z = -Math.PI * 0.3;
  group.add(stem);

  // ── Bottom tip nub ──
  const tipGeo = new THREE.ConeGeometry(0.02, 0.05, 8);
  const tipMat = new THREE.MeshStandardMaterial({ color: 0x4a3a18, roughness: 0.9 });
  const tip = new THREE.Mesh(tipGeo, tipMat);
  const endAngle = ARC;
  tip.position.set(Math.cos(endAngle) * RADIUS, Math.sin(endAngle) * RADIUS, 0);
  tip.rotation.z = endAngle + Math.PI * 0.5;
  group.add(tip);

  group.rotation.x = Math.PI / 2;
  group.position.copy(position);
  group.position.y += 0.3;

  return {
    mesh: group as any,
    position: position.clone(),
    active: true,
    ownerId,
  };
}

export function checkBananaCollision(banana: BananaEntity, kart: Kart): boolean {
  if (!banana.active) return false;
  if (kart.index === banana.ownerId && kart.state.speed > 0) return false; // briefly ignore own banana

  const dx = kart.state.position.x - banana.position.x;
  const dz = kart.state.position.z - banana.position.z;
  if (dx * dx + dz * dz < 2.5) {
    banana.active = false;
    banana.mesh.visible = false;
    applyHit(kart.state, BANANA_SPIN_DURATION);
    return true;
  }
  return false;
}
