import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Sky, Stars } from '@react-three/drei'
import { Vector3 } from 'three'
import { SUNRISE, SUNSET, advanceClock, clock, daylightAt, sampleSky } from '../../state/timeOfDay'
import { worldRuntime } from '../../state/worldRuntime'
import { MAT } from './kit'

const SUN_DISTANCE = 60
const SKY_DISTANCE = 300
const _sunDir = new Vector3()
const _lightDir = new Vector3()

/**
 * Sun position for an hour. The sun rises in the east (-x), passes high over
 * the kampung and sets in the west (+x). At night the moon takes over.
 */
function sunDirection(hour, target) {
  const dayLength = SUNSET - SUNRISE
  const t = (hour - SUNRISE) / dayLength // 0 sunrise → 1 sunset
  const angle = t * Math.PI
  return target.set(-Math.cos(angle), Math.sin(angle) * 0.85, -0.22).normalize()
}

/**
 * Day–night cycle: moves the sun and moon, recolours the sky, fog, clouds and
 * lights, and lights up the window/lamp glow material at night. The
 * shadow-casting light follows the player so a modest shadow map stays crisp.
 */
export function Lighting() {
  const { scene } = useThree()
  const sun = useRef()
  const hemi = useRef()
  const fill = useRef()
  const sky = useRef()
  const stars = useRef()
  const moon = useRef()

  useFrame((_, delta) => {
    advanceClock(Math.min(delta, 0.1))
    const hour = clock.hour
    const daylight = daylightAt(hour)
    clock.daylight = daylight
    clock.night = 1 - daylight
    const s = sampleSky(hour)

    sunDirection(hour, _sunDir)
    const sunUp = _sunDir.y > -0.05
    // the shadow light is the sun by day and the moon (opposite side) by night
    _lightDir.copy(_sunDir)
    if (!sunUp) _lightDir.set(0.35, 0.8, 0.3).normalize()

    const p = worldRuntime.playerPosition
    if (sun.current) {
      sun.current.position.set(p.x + _lightDir.x * SUN_DISTANCE, p.y + Math.max(_lightDir.y, 0.15) * SUN_DISTANCE, p.z + _lightDir.z * SUN_DISTANCE)
      sun.current.target.position.set(p.x, p.y, p.z)
      sun.current.target.updateMatrixWorld()
      sun.current.color.copy(s.sun)
      sun.current.intensity = s.sunI
    }
    if (hemi.current) {
      hemi.current.color.copy(s.hemiSky)
      hemi.current.groundColor.copy(s.hemiGround)
      hemi.current.intensity = s.hemi
    }
    if (fill.current) fill.current.intensity = 0.2 + clock.night * 0.25
    if (scene.fog) scene.fog.color.copy(s.fog)

    if (sky.current) {
      const uniforms = sky.current.material.uniforms
      uniforms.sunPosition.value.copy(_sunDir).multiplyScalar(SKY_DISTANCE)
      uniforms.rayleigh.value = 0.6 + daylight * 1.8
      uniforms.turbidity.value = 4 + daylight * 4
    }
    if (stars.current) {
      stars.current.visible = clock.night > 0.35
      stars.current.rotation.y += delta * 0.003
    }
    if (moon.current) {
      moon.current.visible = clock.night > 0.2
      moon.current.position.set(p.x - _sunDir.x * 220, Math.max(60, -_sunDir.y * 220), p.z - _sunDir.z * 220)
    }

    MAT.cloud.color.copy(s.cloud)
    MAT.cloud.emissiveIntensity = s.cloudGlow
    // windows and lamps glow from dusk till dawn
    MAT.glow.color.copy(MAT.glowOff).lerp(MAT.glowOn, clock.night)
    MAT.lampHalo.opacity = clock.night * 0.4
  })

  return (
    <>
      <Sky ref={sky} distance={450000} sunPosition={[70, 15, -14]} turbidity={7} rayleigh={2.2} mieCoefficient={0.006} mieDirectionalG={0.88} />
      <group ref={stars}>
        <Stars radius={180} depth={50} count={2200} factor={5} saturation={0} fade speed={0.6} />
      </group>
      <mesh ref={moon}>
        <sphereGeometry args={[7, 20, 14]} />
        <meshBasicMaterial color="#f6f1dc" fog={false} />
      </mesh>

      <hemisphereLight ref={hemi} args={['#ffe2bd', '#4d6a33', 0.95]} />
      <directionalLight
        ref={sun}
        color="#ffbd7d"
        intensity={2.7}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-34}
        shadow-camera-right={34}
        shadow-camera-top={34}
        shadow-camera-bottom={-34}
        shadow-camera-near={1}
        shadow-camera-far={140}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
      {/* cool fill from the opposite sky; becomes moonlight at night */}
      <directionalLight ref={fill} color="#a9c1ff" intensity={0.35} position={[-40, 30, 40]} />
    </>
  )
}
