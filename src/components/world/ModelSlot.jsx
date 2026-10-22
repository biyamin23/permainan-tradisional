import { Component, Suspense, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'

/**
 * Shows a GLB model when one is configured (data/models.js), otherwise the
 * primitive stand-in. If the model fails to load, the stand-in stays.
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

function Model({ url, scale = 1, rotationY = 0, offset = [0, 0, 0] }) {
  const { scene } = useGLTF(url)
  // each placement gets its own copy so the same file can be used many times
  const object = useMemo(() => {
    const copy = scene.clone(true)
    copy.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true
        o.receiveShadow = true
      }
    })
    return copy
  }, [scene])
  return <primitive object={object} scale={scale} rotation={[0, rotationY, 0]} position={offset} />
}

export function ModelSlot({ model, url, fallback }) {
  const src = url ?? model?.url
  if (!src) return fallback
  return (
    <Fallback fallback={fallback}>
      <Suspense fallback={fallback}>
        <Model url={src} scale={model?.scale} rotationY={model?.rotationY} offset={model?.offset} />
      </Suspense>
    </Fallback>
  )
}
