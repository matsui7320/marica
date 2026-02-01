import * as THREE from 'three';

/**
 * Animated meteor shower for the night sky.
 * Each meteor is rendered as a trail of points that streak diagonally downward.
 */

const METEOR_COUNT = 18;
const TRAIL_LENGTH = 28; // points per meteor trail (dense, continuous)
const TOTAL_POINTS = METEOR_COUNT * TRAIL_LENGTH;
const SKY_RADIUS = 350; // distance from camera
const TRAIL_SPACING = 1.8; // tight spacing for continuous streak

const METEOR_COLORS = [
  new THREE.Color(0xffffff),  // white
  new THREE.Color(0xd0e4ff),  // cool blue-white
  new THREE.Color(0xffe8c8),  // warm gold
  new THREE.Color(0xffd0ff),  // pink
  new THREE.Color(0xc8ffe0),  // green tint
];

interface Meteor {
  // Direction unit vector (always diagonally downward)
  direction: THREE.Vector3;
  // Current head position (relative to camera, on sky sphere)
  headPos: THREE.Vector3;
  // Speed (units/sec)
  speed: number;
  // Lifetime remaining
  life: number;
  maxLife: number;
  // Color index
  colorIdx: number;
  // Brightness multiplier
  brightness: number;
}

export class MeteorShowerEffect {
  readonly points: THREE.Points;
  private positions: Float32Array;
  private colors: Float32Array;
  private sizes: Float32Array;
  private meteors: Meteor[] = [];

  constructor() {
    this.positions = new Float32Array(TOTAL_POINTS * 3);
    this.colors = new Float32Array(TOTAL_POINTS * 3);
    this.sizes = new Float32Array(TOTAL_POINTS);

    // Hide all initially
    for (let i = 0; i < TOTAL_POINTS; i++) {
      this.positions[i * 3 + 1] = -9999;
      this.sizes[i] = 0;
    }

    // Create meteors with staggered spawns
    for (let i = 0; i < METEOR_COUNT; i++) {
      this.meteors.push(this.spawnMeteor(true));
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

    this.points = new THREE.Points(geometry, new THREE.PointsMaterial({
      size: 2.5,
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    }));
    this.points.frustumCulled = false;
  }

  private spawnMeteor(stagger: boolean): Meteor {
    // Direction: always diagonally downward
    // Angle from vertical: 20-60 degrees, always going down
    const azimuth = Math.random() * Math.PI * 2; // random horizontal direction
    const elevation = -(0.3 + Math.random() * 0.7); // -0.3 to -1.0 (downward)
    const horizontal = Math.cos(elevation);

    const direction = new THREE.Vector3(
      horizontal * Math.cos(azimuth),
      Math.sin(elevation), // negative = downward
      horizontal * Math.sin(azimuth),
    ).normalize();

    // Starting position on the upper sky hemisphere
    const startAzimuth = Math.random() * Math.PI * 2;
    const startElevation = 0.2 + Math.random() * 0.6; // upper sky (above horizon)
    const startH = Math.cos(startElevation);
    const headPos = new THREE.Vector3(
      startH * Math.cos(startAzimuth) * SKY_RADIUS,
      Math.sin(startElevation) * SKY_RADIUS,
      startH * Math.sin(startAzimuth) * SKY_RADIUS,
    );

    // Varied speed classes
    const speedClass = Math.random();
    let speed: number;
    let brightness: number;
    if (speedClass < 0.5) {
      speed = 30 + Math.random() * 25;    // slow faint
      brightness = 0.3 + Math.random() * 0.3;
    } else if (speedClass < 0.85) {
      speed = 60 + Math.random() * 40;    // medium
      brightness = 0.5 + Math.random() * 0.3;
    } else {
      speed = 110 + Math.random() * 60;   // fast bright fireball
      brightness = 0.8 + Math.random() * 0.2;
    }

    const maxLife = 1.5 + Math.random() * 3.5;

    return {
      direction,
      headPos,
      speed,
      life: stagger ? Math.random() * maxLife : maxLife, // stagger initial spawns
      maxLife,
      colorIdx: Math.floor(Math.random() * METEOR_COLORS.length),
      brightness,
    };
  }

  update(dt: number, cameraPosition: THREE.Vector3): void {
    for (let mi = 0; mi < METEOR_COUNT; mi++) {
      let m = this.meteors[mi];

      m.life -= dt;
      if (m.life <= 0) {
        m = this.spawnMeteor(false);
        this.meteors[mi] = m;
      }

      // Move head
      m.headPos.add(m.direction.clone().multiplyScalar(m.speed * dt));

      // Life ratio for fade in/out
      const lifeRatio = m.life / m.maxLife;
      const fadeIn = Math.min(lifeRatio * 5, 1.0);  // quick fade-in at start
      const fadeOut = Math.min((1 - lifeRatio) * 3, 1.0); // fade near end... actually reverse
      const fade = Math.min(fadeIn, 1.0 - Math.max(0, (1 - lifeRatio - 0.7) * 3.33));

      const baseColor = METEOR_COLORS[m.colorIdx];
      const baseIdx = mi * TRAIL_LENGTH;

      for (let ti = 0; ti < TRAIL_LENGTH; ti++) {
        const pi = (baseIdx + ti) * 3;
        const si = baseIdx + ti;

        // Trail point position: head minus direction * trail offset
        const trailOffset = ti * TRAIL_SPACING;
        const px = cameraPosition.x + m.headPos.x - m.direction.x * trailOffset;
        const py = cameraPosition.y + m.headPos.y - m.direction.y * trailOffset;
        const pz = cameraPosition.z + m.headPos.z - m.direction.z * trailOffset;

        this.positions[pi] = px;
        this.positions[pi + 1] = py;
        this.positions[pi + 2] = pz;

        // Trail fades along its length (head is brightest)
        const trailFade = 1.0 - (ti / TRAIL_LENGTH);
        const intensity = m.brightness * fade * trailFade * trailFade;

        this.colors[pi] = baseColor.r * intensity;
        this.colors[pi + 1] = baseColor.g * intensity;
        this.colors[pi + 2] = baseColor.b * intensity;

        // Head point is larger, trail gets smaller
        this.sizes[si] = (ti === 0 ? 2.5 : 1.5) * trailFade * fade;
      }
    }

    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.points.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    (this.points.geometry.attributes.size as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose(): void {
    this.points.geometry.dispose();
    (this.points.material as THREE.PointsMaterial).dispose();
  }
}
