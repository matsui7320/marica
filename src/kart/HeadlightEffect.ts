import * as THREE from 'three';

/**
 * Custom shader-based headlight effect for road surfaces.
 * Supports up to 8 karts (player + 7 NPC).
 */

const MAX_LIGHTS = 8;

// Shared uniforms — updated every frame from all karts
export const headlightUniforms = {
  uHLPositions: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3()) },
  uHLDirections: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3(0, 0, -1)) },
  uHLCount: { value: 0 },
};

const vertexPreamble = /* glsl */ `
varying vec3 vHLWorldPos;
`;

const vertexMain = /* glsl */ `
vHLWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
`;

const fragmentPreamble = /* glsl */ `
varying vec3 vHLWorldPos;
uniform vec3 uHLPositions[${MAX_LIGHTS}];
uniform vec3 uHLDirections[${MAX_LIGHTS}];
uniform int uHLCount;
`;

// ~120° cone (half-angle 60°, cos60°=0.5), soft edges, dim glow
const fragmentMain = /* glsl */ `
if (uHLCount > 0) {
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    if (i >= uHLCount) break;

    vec3 toFrag = vHLWorldPos - uHLPositions[i];
    float dist = length(toFrag);
    vec3 toFragDir = toFrag / max(dist, 0.001);

    float forwardAmount = dot(toFragDir, uHLDirections[i]);

    // ~120° cone with soft edges
    float cone = smoothstep(0.15, 0.55, forwardAmount);

    // Gentle distance falloff
    float atten = 1.0 - smoothstep(3.0, 30.0, dist);

    float brightness = cone * atten * 0.12;
    outgoingLight += vec3(1.0, 0.92, 0.78) * brightness;
  }
}
`;

/**
 * Patch a MeshStandardMaterial to include custom headlight calculations.
 */
export function applyHeadlightShader(material: THREE.MeshStandardMaterial): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uHLPositions = headlightUniforms.uHLPositions;
    shader.uniforms.uHLDirections = headlightUniforms.uHLDirections;
    shader.uniforms.uHLCount = headlightUniforms.uHLCount;

    // --- Vertex shader ---
    shader.vertexShader = vertexPreamble + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      '#include <worldpos_vertex>\n' + vertexMain,
    );

    // --- Fragment shader ---
    shader.fragmentShader = fragmentPreamble + shader.fragmentShader;

    let injected = false;
    for (const target of ['#include <opaque_fragment>', '#include <output_fragment>']) {
      if (shader.fragmentShader.includes(target)) {
        shader.fragmentShader = shader.fragmentShader.replace(
          target,
          fragmentMain + '\n' + target,
        );
        injected = true;
        break;
      }
    }
    if (!injected) {
      shader.fragmentShader = shader.fragmentShader.replace(
        /}\s*$/,
        fragmentMain + '\n}',
      );
    }
  };

  material.customProgramCacheKey = () => 'headlight_' + material.uuid;
  material.needsUpdate = true;
}

/**
 * Update all headlight uniforms from kart array. Call every render frame.
 */
export function updateAllHeadlightUniforms(
  karts: { renderPosition: THREE.Vector3; state: { heading: number } }[],
): void {
  const count = Math.min(karts.length, MAX_LIGHTS);
  headlightUniforms.uHLCount.value = count;

  for (let i = 0; i < count; i++) {
    const kart = karts[i];
    const sinH = Math.sin(kart.state.heading);
    const cosH = Math.cos(kart.state.heading);

    headlightUniforms.uHLPositions.value[i].set(
      kart.renderPosition.x + sinH * 1.5,
      kart.renderPosition.y + 0.5,
      kart.renderPosition.z + cosH * 1.5,
    );
    headlightUniforms.uHLDirections.value[i].set(sinH, 0, cosH);
  }
}
