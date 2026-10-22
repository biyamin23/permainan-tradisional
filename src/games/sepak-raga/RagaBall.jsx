import { useMemo } from 'react'
import { CanvasTexture, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace } from 'three'
import { MODELS } from '../../data/models'
import { ModelSlot } from '../../components/world/ModelSlot'

/**
 * Bola raga: a woven rattan ball. Until the GLB arrives it is a sphere with a
 * painted weave (crossing rattan strips over dark gaps).
 */

let weave = null
function weaveMaterial() {
  if (weave) return weave
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 128
  const x = c.getContext('2d')
  x.fillStyle = '#3b2612'
  x.fillRect(0, 0, 256, 128)
  const strip = (dir) => {
    for (let i = -8; i < 16; i++) {
      x.save()
      x.translate(i * 32, 0)
      x.transform(1, 0, dir * 0.9, 1, 0, 0)
      const grad = x.createLinearGradient(0, 0, 18, 0)
      grad.addColorStop(0, '#b98745')
      grad.addColorStop(0.5, '#e6c07a')
      grad.addColorStop(1, '#b98745')
      x.fillStyle = grad
      x.fillRect(0, 0, 18, 128)
      x.restore()
    }
  }
  strip(1)
  strip(-1)
  const tex = new CanvasTexture(c)
  tex.wrapS = tex.wrapT = RepeatWrapping
  tex.repeat.set(2, 1)
  tex.colorSpace = SRGBColorSpace
  weave = new MeshStandardMaterial({ map: tex, roughness: 0.75 })
  return weave
}

export function RagaBall({ radius = 0.1 }) {
  const material = useMemo(() => weaveMaterial(), [])
  const fallback = (
    <mesh castShadow material={material}>
      <sphereGeometry args={[radius, 18, 12]} />
    </mesh>
  )
  // the GLB is ~14 cm across; scale it to the radius asked for
  return <ModelSlot model={MODELS.raga} fallback={fallback} scale={radius / 0.07} />
}
