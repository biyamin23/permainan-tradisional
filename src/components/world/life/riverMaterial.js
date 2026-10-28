import { MAT } from '../kit'
import { lifeUniforms } from './wind'

/**
 * The sungai's water: the old flat water material with a few soft layers
 * painted on in the shader, all moving downstream.
 *
 *   1. base colour, deeper in the middle, lighter and sandier at the edges
 *   2. a broad flowing pattern (slow bands that stretch along the current)
 *   3. small bright glints that drift with it
 *   4. a thin, flickering line of foam where the water meets the bank
 *
 * The river is drawn as instanced kit parts (one box per stretch, one round
 * piece at each bend), each turned to face downstream, so the flow direction
 * is simply the instance's own +z axis and the instance's centre lies on the
 * middle of the river. Each part's instance colour carries, in its red
 * channel, how far down the river its centre is (in metres), so the pattern
 * runs on unbroken from one stretch to the next.
 */

export const FLOW_SPEED = 0.9 // metres a second, roughly what the leaves do

let material = null

export function riverMaterial() {
  if (material) return material
  material = MAT.water.clone()
  material.opacity = 0.93
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = lifeUniforms.uTime
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec2 vRiver;
        varying float vHalfWidth;`,
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        {
          vec4 lw = vec4(transformed, 1.0);
          vec3 axisZ = vec3(0.0, 0.0, 1.0);
          vec3 axisX = vec3(1.0, 0.0, 0.0);
          vec3 centre = vec3(0.0);
          #ifdef USE_INSTANCING
            lw = instanceMatrix * lw;
            axisZ = instanceMatrix[2].xyz;
            axisX = instanceMatrix[0].xyz;
            centre = instanceMatrix[3].xyz;
          #endif
          lw = modelMatrix * lw;
          vec2 flow = normalize(axisZ.xz);
          vec2 side = vec2(-flow.y, flow.x);
          vec2 rel = lw.xz - centre.xz;
          float along0 = 0.0;
          #ifdef USE_INSTANCING_COLOR
            along0 = instanceColor.r;
          #endif
          vRiver = vec2(along0 + dot(rel, flow), dot(rel, side));  // (along, across) in metres
          vHalfWidth = max(0.5, length(axisX) * 0.5);
        }`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        varying vec2 vRiver;
        varying float vHalfWidth;`,
      )
      .replace(
        '#include <color_fragment>',
        `{
          // (the instance colour holds the distance downstream, not a colour)
          diffuseColor.rgb = diffuse;
          float t = uTime * ${FLOW_SPEED.toFixed(2)};
          float a = vRiver.x - t;
          float c = vRiver.y;
          // 0 in the middle, 1 at the bank (worked out here: every vertex is on a bank)
          float vEdge = clamp(abs(c) / vHalfWidth, 0.0, 1.0);
          // 2: broad bands stretched along the current, wobbling side to side
          float band = sin(a * 0.9 + sin(c * 1.1 + a * 0.15) * 1.6) * 0.5 + 0.5;
          float band2 = sin(a * 0.37 - c * 0.6 + sin(a * 0.11) * 2.0) * 0.5 + 0.5;
          float flowPattern = band * 0.6 + band2 * 0.4;
          // 1: deeper in the middle, shallow and sandy at the edges
          vec3 deep = diffuseColor.rgb * vec3(0.78, 0.9, 0.95);
          // (colours here are linear: 0.2 is already a fairly light tone)
          vec3 shallow = mix(diffuseColor.rgb, vec3(0.2, 0.33, 0.24), 0.5);
          vec3 col = mix(deep, shallow, smoothstep(0.55, 1.0, vEdge));
          col *= 0.93 + flowPattern * 0.14;
          // 3: glints: small bright streaks drifting with the water
          // (long along the current, thin across it, and wobbling so they don't line up)
          float w = c + sin(a * 0.45) * 0.6;
          float g1 = sin(a * 0.7 + w * 4.3) * sin(a * 0.31 - w * 1.9 + 1.7);
          float g2 = sin(a * 0.52 - w * 3.7 + 4.0) * sin(a * 0.23 + w * 1.3);
          float glint = smoothstep(0.86, 0.99, g1) + smoothstep(0.9, 0.995, g2) * 0.7;
          col += vec3(0.45, 0.55, 0.55) * glint * 0.3 * (1.0 - vEdge * 0.6);
          // 4: foam where the water laps the bank
          float lap = sin(a * 1.7 + uTime * 1.3 + c * 3.0) * 0.5 + 0.5;
          col = mix(col, vec3(0.6, 0.64, 0.58), smoothstep(0.9, 0.99, vEdge) * (0.3 + lap * 0.35));
          diffuseColor.rgb = col;
        }`,
      )
  }
  return material
}
