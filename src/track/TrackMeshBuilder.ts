import * as THREE from 'three';
import { TrackSpline } from './TrackSpline';
import { TRACK_SPLINE_SEGMENTS } from '../constants';
export class TrackMeshBuilder {
  static build(spline: TrackSpline, envType: string = 'meadow'): { road: THREE.Mesh; offroad: THREE.Mesh } {
    const segments = TRACK_SPLINE_SEGMENTS;
    const vertsPerSeg = 5; // left edge, left lane, center, right lane, right edge

    // Road mesh
    const roadPositions: number[] = [];
    const roadNormals: number[] = [];
    const roadUvs: number[] = [];
    const roadIndices: number[] = [];

    // Offroad (sides)
    const offroadPositions: number[] = [];
    const offroadNormals: number[] = [];
    const offroadUvs: number[] = [];
    const offroadIndices: number[] = [];

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const sp = spline.getPointAt(t);
      const hw = sp.width * 0.5;
      const offroadWidth = 2.7;

      // Cross-section points
      const points = [
        sp.position.clone().add(sp.binormal.clone().multiplyScalar(-hw - offroadWidth)).add(sp.normal.clone().multiplyScalar(-0.3)),
        sp.position.clone().add(sp.binormal.clone().multiplyScalar(-hw)),
        sp.position.clone(),
        sp.position.clone().add(sp.binormal.clone().multiplyScalar(hw)),
        sp.position.clone().add(sp.binormal.clone().multiplyScalar(hw + offroadWidth)).add(sp.normal.clone().multiplyScalar(-0.3)),
      ];

      // Road vertices (indices 1,2,3)
      for (let j = 1; j <= 3; j++) {
        roadPositions.push(points[j].x, points[j].y, points[j].z);
        roadNormals.push(sp.normal.x, sp.normal.y, sp.normal.z);
        roadUvs.push((j - 1) / 2, t * 50);
      }

      // Offroad left (indices 0,1)
      for (let j = 0; j <= 1; j++) {
        offroadPositions.push(points[j].x, points[j].y, points[j].z);
        offroadNormals.push(sp.normal.x, sp.normal.y, sp.normal.z);
        offroadUvs.push(j, t * 20);
      }
      // Offroad right (indices 3,4)
      for (let j = 3; j <= 4; j++) {
        offroadPositions.push(points[j].x, points[j].y, points[j].z);
        offroadNormals.push(sp.normal.x, sp.normal.y, sp.normal.z);
        offroadUvs.push(j - 3, t * 20);
      }

      if (i < segments) {
        const roadBase = i * 3;
        // Road: 2 quads (left lane, right lane)
        roadIndices.push(
          roadBase, roadBase + 3, roadBase + 4,
          roadBase, roadBase + 4, roadBase + 1,
          roadBase + 1, roadBase + 4, roadBase + 5,
          roadBase + 1, roadBase + 5, roadBase + 2,
        );

        // Offroad: left strip + right strip
        const offBase = i * 4;
        offroadIndices.push(
          offBase, offBase + 4, offBase + 5,
          offBase, offBase + 5, offBase + 1,
          offBase + 2, offBase + 6, offBase + 7,
          offBase + 2, offBase + 7, offBase + 3,
        );
      }
    }

    const roadMat = createRoadMaterial(envType);
    const offroadMat = createOffroadMaterial(envType);

    const road = buildMesh(roadPositions, roadNormals, roadUvs, roadIndices, roadMat);
    const offroad = buildMesh(offroadPositions, offroadNormals, offroadUvs, offroadIndices, offroadMat);

    road.receiveShadow = true;
    offroad.receiveShadow = true;

    // Rainbow road shader for Starlight Highway
    if (envType === 'night') {
      applyRainbowRoadShader(roadMat);
      road.onBeforeRender = () => {
        const u = (roadMat as any).__rainbowTimeUniform;
        if (u) u.value = performance.now() * 0.001;
      };
    }

    return { road, offroad };
  }

  /** Create a checkered start/finish line at t=0 */
  static buildStartLine(spline: TrackSpline): THREE.Mesh {
    const sp = spline.getPointAt(0);
    const hw = sp.width * 0.5;

    // Checkered texture
    const size = 128;
    const cells = 8;
    const cellSize = size / cells;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    for (let y = 0; y < cells; y++) {
      for (let x = 0; x < cells; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#ffffff' : '#222222';
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;

    const bandWidth = hw * 2;
    const bandDepth = 2.5;

    const geo = new THREE.PlaneGeometry(bandWidth, bandDepth);
    const mat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.6,
      metalness: 0.0,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    const mesh = new THREE.Mesh(geo, mat);

    // Position at t=0, slightly above road surface
    mesh.position.copy(sp.position);
    mesh.position.addScaledVector(sp.normal, 0.02);

    // Orient: normal of plane = track surface normal, align width along binormal
    const m = new THREE.Matrix4();
    const tangent = sp.tangent.clone().normalize();
    const binormal = sp.binormal.clone().normalize();
    const normal = sp.normal.clone().normalize();
    // PlaneGeometry lies in XY by default, face along +Z
    // We want: plane X → binormal, plane Y → tangent, plane face → normal
    m.makeBasis(binormal, tangent, normal);
    mesh.rotation.setFromRotationMatrix(m);

    mesh.receiveShadow = true;

    return mesh;
  }
}

function buildMesh(
  positions: number[], normals: number[], uvs: number[], indices: number[],
  material: THREE.Material,
): THREE.Mesh {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return new THREE.Mesh(geo, material);
}

function createRoadMaterial(envType: string): THREE.MeshStandardMaterial {
  const isDark = envType === 'night' || envType === 'volcano';
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Base asphalt
  if (envType === 'night') {
    ctx.fillStyle = '#3a3a44';
  } else if (envType === 'volcano') {
    ctx.fillStyle = '#4a3e3a';
  } else {
    ctx.fillStyle = '#4a4a4a';
  }
  ctx.fillRect(0, 0, 512, 512);

  // Asphalt noise (multi-layer for realism)
  const noiseBase = isDark ? 40 : 55;
  const noiseRange = isDark ? 40 : 50;
  for (let i = 0; i < 4000; i++) {
    const v = noiseBase + Math.random() * noiseRange;
    const r = v + Math.random() * 5;
    ctx.fillStyle = `rgb(${r},${v},${v})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  // Larger patches for worn areas
  for (let i = 0; i < 30; i++) {
    const v = (isDark ? 35 : 60) + Math.random() * 25;
    ctx.fillStyle = `rgba(${v},${v},${v}, 0.3)`;
    ctx.beginPath();
    ctx.ellipse(Math.random() * 512, Math.random() * 512, 5 + Math.random() * 15, 3 + Math.random() * 8, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // Red-white curb strips (left edge)
  const curbWidth = 16;
  const stripeHeight = 24;
  for (let y = 0; y < 512; y += stripeHeight * 2) {
    ctx.fillStyle = isDark ? '#881500' : '#cc2200';
    ctx.fillRect(0, y, curbWidth, stripeHeight);
    ctx.fillStyle = isDark ? '#999999' : '#ffffff';
    ctx.fillRect(0, y + stripeHeight, curbWidth, stripeHeight);
  }
  // Right edge curb
  for (let y = 0; y < 512; y += stripeHeight * 2) {
    ctx.fillStyle = isDark ? '#999999' : '#ffffff';
    ctx.fillRect(512 - curbWidth, y, curbWidth, stripeHeight);
    ctx.fillStyle = isDark ? '#881500' : '#cc2200';
    ctx.fillRect(512 - curbWidth, y + stripeHeight, curbWidth, stripeHeight);
  }

  // Center dashed line
  ctx.strokeStyle = isDark ? '#888888' : '#dddddd';
  ctx.lineWidth = 4;
  ctx.setLineDash([28, 24]);
  ctx.beginPath();
  ctx.moveTo(256, 0);
  ctx.lineTo(256, 512);
  ctx.stroke();

  // Subtle lane guide lines
  ctx.strokeStyle = isDark ? 'rgba(150, 150, 150, 0.2)' : 'rgba(200, 200, 200, 0.25)';
  ctx.lineWidth = 2;
  ctx.setLineDash([16, 32]);
  ctx.beginPath();
  ctx.moveTo(128, 0);
  ctx.lineTo(128, 512);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(384, 0);
  ctx.lineTo(384, 512);
  ctx.stroke();

  // Edge solid lines (just inside curbs)
  ctx.setLineDash([]);
  ctx.strokeStyle = isDark ? '#aaaaaa' : '#eeeeee';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(curbWidth + 2, 0); ctx.lineTo(curbWidth + 2, 512);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(512 - curbWidth - 2, 0); ctx.lineTo(512 - curbWidth - 2, 512);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);

  const mat = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: isDark ? 0.5 : 0.75,
    metalness: isDark ? 0.05 : 0.02,
    side: THREE.DoubleSide,
  });

  // Dark stages: self-illuminate the road so it's always visible
  if (envType === 'night') {
    mat.emissive = new THREE.Color(0x2a2a3a);
    mat.emissiveIntensity = 1.4;
    mat.roughness = 0.3;
    mat.metalness = 0.15;
  } else if (envType === 'volcano') {
    mat.emissive = new THREE.Color(0x221a14);
    mat.emissiveIntensity = 1.0;
  }

  return mat;
}

function applyRainbowRoadShader(material: THREE.MeshStandardMaterial): void {
  const timeUniform = { value: 0 };
  (material as any).__rainbowTimeUniform = timeUniform;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRainbowTime = timeUniform;

    // Add uniform + helper function declarations to fragment shader preamble
    const preamble = /* glsl */ `
uniform float uRainbowTime;
float rbHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float rbHash2(vec2 p) { return fract(sin(dot(p, vec2(269.5, 183.3))) * 43758.5453); }
float rbHash3(vec2 p) { return fract(sin(dot(p, vec2(419.2, 371.9))) * 43758.5453); }
vec3 rbHue2rgb(float h) {
  float r = abs(h * 6.0 - 3.0) - 1.0;
  float g = 2.0 - abs(h * 6.0 - 2.0);
  float b = 2.0 - abs(h * 6.0 - 4.0);
  return clamp(vec3(r, g, b), 0.0, 1.0) * 0.85 + 0.15;
}
`;
    shader.fragmentShader = preamble + shader.fragmentShader;

    // Inject rainbow sparkle code before output
    const rainbowCode = /* glsl */ `
    {
      // ── Rainbow road: multi-layer sparkle + glow ──
      vec2 ruv = vMapUv;

      // Skip curb areas
      float curbMask = smoothstep(0.03, 0.07, ruv.x) * smoothstep(0.03, 0.07, 1.0 - ruv.x);

      // ── Layer 1: broad flowing rainbow glow ──
      float glowHue = fract(ruv.y * 0.4 + uRainbowTime * 0.1);
      vec3 glowColor = rbHue2rgb(glowHue);
      float glowWave = 0.5 + 0.5 * sin(ruv.y * 12.0 - uRainbowTime * 2.5);
      outgoingLight += glowColor * glowWave * curbMask * 0.35;

      // ── Layer 2: dense fine sparkles ──
      float totalSparkle = 0.0;
      vec3 sparkleColorSum = vec3(0.0);
      for (int layer = 0; layer < 3; layer++) {
        float scale = (layer == 0) ? 120.0 : (layer == 1) ? 75.0 : 200.0;
        float offsetX = float(layer) * 37.0;
        float offsetY = float(layer) * 53.0;
        vec2 cellUv = ruv * vec2(scale * 0.35, scale) + vec2(offsetX, offsetY);
        vec2 cellId = floor(cellUv);
        vec2 cellFrac = fract(cellUv);

        float h1 = rbHash(cellId);
        float h2v = rbHash2(cellId);
        float h3v = rbHash3(cellId);

        vec2 sparklePos = vec2(0.15 + h1 * 0.7, 0.15 + h2v * 0.7);
        float d = length(cellFrac - sparklePos);

        float radius = 0.08 + h3v * 0.06;
        float sp = 1.0 - smoothstep(0.0, radius, d);
        sp = sp * sp * sp; // sharp bright core

        float pulse = 0.5 + 0.5 * sin(uRainbowTime * (2.5 + h1 * 4.0) + h2v * 6.283);
        float hue = fract(ruv.y * 0.5 + uRainbowTime * 0.15 + h1 * 0.4 + float(layer) * 0.33);
        vec3 col = rbHue2rgb(hue);

        float layerIntensity = (layer == 2) ? 0.6 : 1.0; // finest layer slightly dimmer
        totalSparkle += sp * pulse * layerIntensity;
        sparkleColorSum += col * sp * pulse * layerIntensity;
      }
      outgoingLight += sparkleColorSum * curbMask * 1.0;

      // ── Layer 3: rare bright twinkle stars ──
      {
        float starScale = 40.0;
        vec2 starUv = ruv * vec2(starScale * 0.4, starScale);
        vec2 starId = floor(starUv);
        vec2 starFrac = fract(starUv);
        float sh = rbHash(starId + 999.0);
        float sh2 = rbHash2(starId + 999.0);
        // Only ~30% of cells have a star
        if (sh > 0.7) {
          vec2 starPos = vec2(0.2 + sh * 0.6, 0.2 + sh2 * 0.6);
          float sd = length(starFrac - starPos);
          float starBright = 1.0 - smoothstep(0.0, 0.05, sd);
          starBright = starBright * starBright;
          // Rapid twinkle
          float twinkle = 0.5 + 0.5 * sin(uRainbowTime * (8.0 + sh * 10.0) + sh2 * 6.283);
          float starHue = fract(uRainbowTime * 0.3 + sh);
          outgoingLight += rbHue2rgb(starHue) * starBright * twinkle * curbMask * 1.5;
        }
      }
    }
    `;

    let injected = false;
    for (const target of ['#include <opaque_fragment>', '#include <output_fragment>']) {
      if (shader.fragmentShader.includes(target)) {
        shader.fragmentShader = shader.fragmentShader.replace(
          target,
          rainbowCode + '\n' + target,
        );
        injected = true;
        break;
      }
    }
    if (!injected) {
      shader.fragmentShader = shader.fragmentShader.replace(
        /}\s*$/,
        rainbowCode + '\n}',
      );
    }
  };

  material.customProgramCacheKey = () => 'rainbow_' + material.uuid;
  material.needsUpdate = true;
}

function createOffroadMaterial(envType: string): THREE.MeshStandardMaterial {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  if (envType === 'night') {
    ctx.fillStyle = '#1a2a18';
  } else if (envType === 'volcano') {
    ctx.fillStyle = '#3a2a1a';
  } else {
    ctx.fillStyle = '#4a7a3a';
  }
  ctx.fillRect(0, 0, 128, 128);

  for (let i = 0; i < 500; i++) {
    const g = (envType === 'night' ? 20 : envType === 'volcano' ? 30 : 50) + Math.random() * 60;
    if (envType === 'volcano') {
      ctx.fillStyle = `rgb(${g},${g * 0.6},${g * 0.4})`;
    } else {
      ctx.fillStyle = `rgb(${g * 0.7},${g},${g * 0.5})`;
    }
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 3, 3);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;

  const mat = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.95,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });

  if (envType === 'night') {
    mat.emissive = new THREE.Color(0x0a0f0a);
    mat.emissiveIntensity = 1.0;
  } else if (envType === 'volcano') {
    mat.emissive = new THREE.Color(0x140a06);
    mat.emissiveIntensity = 1.0;
  }

  return mat;
}
