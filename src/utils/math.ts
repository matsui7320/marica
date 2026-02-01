import * as THREE from 'three';

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function damp(a: number, b: number, lambda: number, dt: number): number {
  return lerp(a, b, 1 - Math.exp(-lambda * dt));
}

export function dampV3(out: THREE.Vector3, target: THREE.Vector3, lambda: number, dt: number): THREE.Vector3 {
  const f = 1 - Math.exp(-lambda * dt);
  out.x += (target.x - out.x) * f;
  out.y += (target.y - out.y) * f;
  out.z += (target.z - out.z) * f;
  return out;
}

export function wrapAngle(angle: number): number {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

export function angleDiff(a: number, b: number): number {
  return wrapAngle(b - a);
}

export function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function randomSign(): number {
  return Math.random() < 0.5 ? -1 : 1;
}

const _v = new THREE.Vector3();

export function projectOnPlane(out: THREE.Vector3, v: THREE.Vector3, normal: THREE.Vector3): THREE.Vector3 {
  _v.copy(normal).multiplyScalar(v.dot(normal));
  out.copy(v).sub(_v);
  return out;
}

export function positionSuffix(pos: number): string {
  if (pos === 1) return 'st';
  if (pos === 2) return 'nd';
  if (pos === 3) return 'rd';
  return 'th';
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${m}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}
