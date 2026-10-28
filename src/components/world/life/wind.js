import { useFrame } from '@react-three/fiber'
import { MAT } from '../kit'

/**
 * One gentle breeze for the whole kampung, done in the vertex shader so
 * hundreds of leaves, fronds, reeds and grass blades move without any
 * per-object JavaScript. Each vertex sways by its world position (so no two
 * trees move in step) and by how high it is (tree tops sway, roots don't;
 * blade tips bend, blade bases stay put). Gusts come and go slowly.
 *
 * The offset is added in view space after the usual projection, so it works
 * with instanced kit parts and GLB meshes alike. Shadows stay still: at this
 * size nobody can tell.
 */

export const lifeUniforms = {
  uTime: { value: 0 },
  uWind: { value: 1 },
}

const MODES = {
  // whole tree parts: weight by world height, sway up to ~7 cm at the crown
  tree: { amp: 0.07, weight: 'smoothstep(1.2, 7.5, lw.y)', speed: 1.1 },
  // big GLB palms (fronds 6–9 m up): a bit more, slower
  palm: { amp: 0.12, weight: 'smoothstep(3.0, 9.0, lw.y)', speed: 0.8 },
  // kit blades (unit cone, base at local y 0, tip at 1): bend at the tip
  grass: { amp: 0.09, weight: 'position.y * position.y', speed: 1.9 },
}

const cache = new Map()

/** A copy of `base` that sways in the wind (shared per base material + mode). */
export function windMaterial(base = MAT.kit, mode = 'tree') {
  const key = `${base.uuid}:${mode}`
  if (cache.has(key)) return cache.get(key)
  const m = MODES[mode]
  const material = base.clone()
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = lifeUniforms.uTime
    shader.uniforms.uWind = lifeUniforms.uWind
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uWind;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        {
          vec4 lw = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            lw = instanceMatrix * lw;
          #endif
          lw = modelMatrix * lw;
          float w = ${m.weight};
          float t = uTime * ${m.speed.toFixed(2)};
          float ph = t + lw.x * 0.21 + lw.z * 0.17;
          // slow gusts rolling across the kampung
          float gust = 0.55 + 0.45 * sin(uTime * 0.31 + lw.x * 0.035 - lw.z * 0.02);
          vec3 sway = vec3(sin(ph) + 0.35 * sin(ph * 2.7 + 1.3), 0.0, 0.5 * cos(ph * 0.83 + 0.7));
          sway *= ${m.amp.toFixed(3)} * w * gust * uWind;
          mvPosition.xyz += mat3(viewMatrix) * sway;
          gl_Position = projectionMatrix * mvPosition;
        }`,
      )
  }
  material.customProgramCacheKey = () => `wind-${mode}`
  cache.set(key, material)
  return material
}

/** Advances the shared clock for every living shader (wind, water). Mount once in the Canvas. */
export function LifeClock() {
  useFrame((_, delta) => {
    lifeUniforms.uTime.value += Math.min(delta, 0.1)
  })
  return null
}
