import { Component, Suspense, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { Vector3 } from 'three'
import { worldRuntime } from '../../state/worldRuntime'

/**
 * Shows a GLB model when one is configured (data/models.js), otherwise the
 * primitive stand-in. If the model fails to load, the stand-in stays.
 *
 * fadeWhen(localPlayerPosition) → true makes the whole model see-through
 * while it holds (e.g. you're inside the warung, so the camera can see in).
 */
class Fallback extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.warn('[kampung] model failed to load, keeping the stand-in:', error)
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

const _local = new Vector3()

function Model({ url, scale = 1, rotationY = 0, offset = [0, 0, 0], fadeWhen }) {
  const { scene } = useGLTF(url)
  const group = useRef()
  // each placement gets its own copy so the same file can be used many times
  const { object, materials } = useMemo(() => {
    const copy = scene.clone(true)
    const mats = []
    copy.traverse((o) => {
      if (!o.isMesh) return
      o.castShadow = true
      o.receiveShadow = true
      if (fadeWhen) {
        o.material = o.material.clone()
        o.material.transparent = true
        mats.push(o.material)
      }
    })
    return { object: copy, materials: mats }
  }, [scene, fadeWhen])

  useFrame((_, delta) => {
    if (!fadeWhen || !group.current) return
    _local.copy(worldRuntime.playerPosition)
    group.current.worldToLocal(_local)
    const target = fadeWhen(_local) ? 0.22 : 1
    const k = 1 - Math.exp(-6 * Math.min(delta, 0.1))
    for (const m of materials) {
      m.opacity += (target - m.opacity) * k
      m.depthWrite = m.opacity > 0.95
    }
    const solid = materials[0] ? materials[0].opacity > 0.6 : true
    if (group.current.userData.solid !== solid) {
      group.current.userData.solid = solid
      object.traverse((o) => {
        if (o.isMesh) o.castShadow = solid
      })
    }
  })

  return (
    <group ref={group}>
      <primitive object={object} scale={scale} rotation={[0, rotationY, 0]} position={offset} />
    </group>
  )
}

export function ModelSlot({ model, url, fallback, scale, rotationY, offset, fadeWhen }) {
  const src = url ?? model?.url
  if (!src) return fallback
  return (
    <Fallback fallback={fallback}>
      <Suspense fallback={fallback}>
        <Model
          url={src}
          scale={scale ?? model?.scale}
          rotationY={rotationY ?? model?.rotationY}
          offset={offset ?? model?.offset}
          fadeWhen={fadeWhen}
        />
      </Suspense>
    </Fallback>
  )
}

/** Start downloading model files early (e.g. while the kampung loads). */
export function preloadModels(urls) {
  urls.filter(Boolean).forEach((u) => useGLTF.preload(u))
}
