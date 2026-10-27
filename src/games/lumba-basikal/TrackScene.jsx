import { useEffect, useMemo } from 'react'
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  IcosahedronGeometry,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  SRGBColorSpace,
} from 'three'
import { PersonModel } from '../../components/character/PersonModel'
import { ModelSlot } from '../../components/world/ModelSlot'
import { kidLook } from '../../components/world/npc/kidLooks'
import { MODELS } from '../../data/models'
import { BRIDGE_HALF, BRIDGE_WIDTH } from './track'

/**
 * Everything you ride past: the road itself (tar or red earth, verges,
 * shortcut paths, lumpur), jambatan over streams, the start/finish arch with
 * bunting, checkpoint flags, and the kampung around it (houses, a warung,
 * coconut palms, trees, a kebun, hills), placed so nothing sits on the road.
 */

const ROAD_COLOR = { tar: '#68645d', tanah: '#b9774b' }
const VERGE_COLOR = { tar: '#a98a5e', tanah: '#c99566' }
const GRASS = '#86ad4c'

// small deterministic random, so a litar always looks the same
function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/** Triangle strip along the loop between two lateral offsets. */
function strip(track, inner, outer, yAt, skip, lift = 0.02) {
  const pos = []
  const p = { x: 0, z: 0 }
  const q = { x: 0, z: 0 }
  const corner = []
  for (let i = 0; i <= track.n; i++) {
    const k = track.wrap(i)
    track.point(k, inner(k), p)
    track.point(k, outer(k), q)
    corner.push([p.x, yAt(k, inner(k)) + lift, p.z, q.x, yAt(k, outer(k)) + lift, q.z])
  }
  for (let i = 0; i < track.n; i++) {
    if (skip?.(i) || skip?.(track.wrap(i + 1))) continue
    const [ax, ay, az, bx, by, bz] = corner[i]
    const [cx, cy, cz, dx, dy, dz] = corner[i + 1]
    pos.push(ax, ay, az, bx, by, bz, cx, cy, cz, bx, by, bz, dx, dy, dz, cx, cy, cz)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  g.computeVertexNormals()
  return g
}

function useMaterial(color, extra) {
  return useMemo(() => new MeshStandardMaterial({ color, roughness: 1, side: DoubleSide, ...extra }), [color, extra])
}

function Road({ track }) {
  const surface = track.def.surface
  const roadMat = useMaterial(ROAD_COLOR[surface])
  const vergeMat = useMaterial(VERGE_COLOR[surface])
  const bankMat = useMaterial('#9aa456')
  const geos = useMemo(() => {
    const half = (i) => track.width[i] / 2
    const onBridge = (i) => track.bridgeAt[i] >= 0
    const y = (i, lat) => track.heightAt(i, lat)
    return {
      road: strip(track, (i) => -half(i), half, y, onBridge, 0.03),
      vergeL: strip(track, (i) => -half(i) - 0.8, (i) => -half(i), y, onBridge, 0.02),
      vergeR: strip(track, half, (i) => half(i) + 0.8, y, onBridge, 0.02),
      // the slopes of the bukit down to the grass
      bankL: strip(track, (i) => -half(i) - 0.8, (i) => -half(i) - 0.8 - track.height[i] * 1.6 - 0.01, (i, lat) => (lat === -half(i) - 0.8 ? track.height[i] : 0), (i) => onBridge(i) || track.height[i] < 0.02, 0.015),
      bankR: strip(track, (i) => half(i) + 0.8, (i) => half(i) + 0.8 + track.height[i] * 1.6 + 0.01, (i, lat) => (lat === half(i) + 0.8 ? track.height[i] : 0), (i) => onBridge(i) || track.height[i] < 0.02, 0.015),
    }
  }, [track])
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos])
  return (
    <group>
      <mesh geometry={geos.road} material={roadMat} receiveShadow />
      <mesh geometry={geos.vergeL} material={vergeMat} receiveShadow />
      <mesh geometry={geos.vergeR} material={vergeMat} receiveShadow />
      <mesh geometry={geos.bankL} material={bankMat} receiveShadow />
      <mesh geometry={geos.bankR} material={bankMat} receiveShadow />
      {surface === 'tar' && <CentreLine track={track} />}
    </group>
  )
}

/** White dashes down the middle of a tar road. */
function CentreLine({ track }) {
  const mesh = useMemo(() => {
    const count = Math.floor(track.n / 6)
    const m = new InstancedMesh(new BufferGeometry().copy(new CylinderGeometry(0.06, 0.06, 2, 4)).rotateX(Math.PI / 2).scale(1, 0.15, 1), new MeshStandardMaterial({ color: '#efe9da', roughness: 0.9 }), count)
    const o = new Object3D()
    for (let k = 0; k < count; k++) {
      const i = k * 6
      if (track.bridgeAt[i] >= 0) {
        o.scale.setScalar(0)
      } else {
        o.scale.setScalar(1)
      }
      o.position.set(track.px[i], track.height[i] + 0.045, track.pz[i])
      o.rotation.set(0, Math.atan2(track.tx[i], track.tz[i]), 0)
      o.updateMatrix()
      m.setMatrixAt(k, o.matrix)
    }
    return m
  }, [track])
  return <primitive object={mesh} />
}

/** Streams under the jambatan, the bridges themselves. */
function Bridges({ track }) {
  return track.bridges.map((b, k) => (
    <group key={k} position={[b.x, 0, b.z]} rotation={[0, b.angle, 0]}>
      <ModelSlot model={MODELS.jambatan} offset={[0, -MODELS.jambatan.sink, 0]} fallback={<BridgeStandIn />} />
      {/* the stream crosses under it */}
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[60, BRIDGE_HALF * 1.2]} />
        <meshStandardMaterial color="#4c8fae" roughness={0.25} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[60, BRIDGE_HALF * 1.2 + 1.6]} />
        <meshStandardMaterial color="#7b5a36" roughness={1} />
      </mesh>
    </group>
  ))
}

function BridgeStandIn() {
  return (
    <mesh position={[0, 0.4, 0]}>
      <boxGeometry args={[BRIDGE_WIDTH + 0.2, 0.3, BRIDGE_HALF * 2]} />
      <meshStandardMaterial color="#8a5d36" />
    </mesh>
  )
}

/** Lumpur patches and the shortcut paths. */
function Patches({ track }) {
  return (
    <group>
      {track.mud.map((m, k) => (
        <mesh key={`m${k}`} position={[m.x, track.height[m.i] + 0.04, m.z]} rotation={[-Math.PI / 2, 0, m.angle]} scale={[m.w / 2, m.len / 2, 1]} receiveShadow>
          <circleGeometry args={[1, 24]} />
          <meshStandardMaterial color="#8a6038" roughness={0.35} metalness={0.05} />
        </mesh>
      ))}
      {track.shortcuts.map((sc, k) => (
        <mesh key={`s${k}`} position={[(sc.ax + sc.bx) / 2, 0.025, (sc.az + sc.bz) / 2]} rotation={[-Math.PI / 2, 0, Math.atan2(sc.dx, sc.dz)]} receiveShadow>
          <planeGeometry args={[sc.half * 2, sc.len + 1]} />
          <meshStandardMaterial color={sc.mud ? '#98693f' : '#b4865a'} roughness={sc.mud ? 0.6 : 1} />
        </mesh>
      ))}
    </group>
  )
}

const textCache = new Map()
function textTexture(text, { bg = '#c0412f', fg = '#fff8e8', w = 512, h = 128, size = 72 } = {}) {
  const key = `${text}|${bg}|${fg}|${w}|${h}`
  if (textCache.has(key)) return textCache.get(key)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const x = c.getContext('2d')
  x.fillStyle = bg
  x.fillRect(0, 0, w, h)
  x.fillStyle = fg
  x.font = `900 ${size}px "Baloo 2", "Nunito", sans-serif`
  x.textAlign = 'center'
  x.textBaseline = 'middle'
  x.fillText(text, w / 2, h / 2 + 4)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  textCache.set(key, t)
  return t
}

function checkerTexture() {
  if (textCache.has('checker')) return textCache.get('checker')
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 32
  const x = c.getContext('2d')
  for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) {
    x.fillStyle = (i + j) % 2 ? '#2a221c' : '#fbf6ea'
    x.fillRect(i * 8, j * 8, 8, 8)
  }
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  textCache.set('checker', t)
  return t
}

/** The start / finish arch with its banner and bunting, and the line on the road. */
function StartArch({ track }) {
  const w = track.width[0] / 2 + 1.2
  const angle = Math.atan2(track.tx[0], track.tz[0])
  const flags = useMemo(() => ['#e8645a', '#f2c14e', '#4fb6c9', '#5fb35a', '#e9779a'], [])
  return (
    <group position={[track.px[0], 0, track.pz[0]]} rotation={[0, angle, 0]}>
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[track.width[0], 0.9]} />
        <meshStandardMaterial map={checkerTexture()} roughness={0.9} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * w, 2.1, 0]} castShadow>
          <cylinderGeometry args={[0.12, 0.14, 4.2, 8]} />
          <meshStandardMaterial color="#7a5232" />
        </mesh>
      ))}
      <mesh position={[0, 3.7, 0]} castShadow>
        <boxGeometry args={[w * 2 + 0.3, 0.9, 0.08]} />
        <meshStandardMaterial attach="material-4" map={textTexture('MULA · TAMAT')} />
        <meshStandardMaterial attach="material-5" map={textTexture('MULA · TAMAT')} />
        <meshStandardMaterial attach="material-0" color="#c0412f" />
        <meshStandardMaterial attach="material-1" color="#c0412f" />
        <meshStandardMaterial attach="material-2" color="#c0412f" />
        <meshStandardMaterial attach="material-3" color="#c0412f" />
      </mesh>
      {/* bunting from the arch out to the side poles */}
      {[-1, 1].map((s) =>
        Array.from({ length: 9 }, (_, k) => {
          const u = k / 8
          const x = s * (w + u * 5)
          const y = 4.1 - u * 1.6 - Math.sin(u * Math.PI) * 0.4
          return (
            <mesh key={`${s}${k}`} position={[x, y, 0]} rotation={[0, 0, Math.PI]}>
              <coneGeometry args={[0.16, 0.3, 3]} />
              <meshStandardMaterial color={flags[k % flags.length]} side={DoubleSide} />
            </mesh>
          )
        }),
      )}
      {[-1, 1].map((s) => (
        <mesh key={`p${s}`} position={[s * (w + 5), 1.25, 0]}>
          <cylinderGeometry args={[0.06, 0.07, 2.5, 6]} />
          <meshStandardMaterial color="#7a5232" />
        </mesh>
      ))}
    </group>
  )
}

/** A flag on each side of the road at every checkpoint. */
function CheckpointFlags({ track }) {
  return track.checkpoints.map((s, k) => {
    const i = track.idxAt(s)
    const angle = Math.atan2(track.tx[i], track.tz[i])
    const half = track.width[i] / 2 + 0.9
    return (
      <group key={k} position={[track.px[i], track.height[i], track.pz[i]]} rotation={[0, angle, 0]}>
        {[-1, 1].map((side) => (
          <group key={side} position={[side * half, 0, 0]}>
            <mesh position={[0, 1.1, 0]}>
              <cylinderGeometry args={[0.04, 0.05, 2.2, 6]} />
              <meshStandardMaterial color="#5a3d26" />
            </mesh>
            <mesh position={[side * -0.32, 1.95, 0]} rotation={[0, side > 0 ? Math.PI : 0, 0]}>
              <planeGeometry args={[0.62, 0.42]} />
              <meshStandardMaterial map={textTexture(String(k + 1), { bg: '#f2c14e', fg: '#3b2414', w: 128, h: 96, size: 80 })} side={DoubleSide} />
            </mesh>
          </group>
        ))}
      </group>
    )
  })
}

/** Places for scenery that keep clear of the road (and of each other). */
function usePlacements(track) {
  return useMemo(() => {
    const rand = rng(track.def.id.length * 977 + track.n)
    const taken = []
    const clearOfRoad = (x, z, clear) => {
      for (let i = 0; i < track.n; i += 2) {
        const d = Math.hypot(track.px[i] - x, track.pz[i] - z) - track.width[i] / 2
        if (d < clear) return false
      }
      for (const sc of track.shortcuts) {
        const ax = x - sc.ax
        const az = z - sc.az
        const along = Math.max(0, Math.min(sc.len, ax * sc.dx + az * sc.dz))
        if (Math.hypot(ax - sc.dx * along, az - sc.dz * along) < clear) return false
      }
      for (const b of track.bridges) if (Math.hypot(b.x - x, b.z - z) < clear + 6) return false
      return true
    }
    const free = (x, z, r) => taken.every((t) => Math.hypot(t[0] - x, t[1] - z) > t[2] + r)
    const nearRoad = (at, side, dist) => {
      const i = Math.round(at * track.n) % track.n
      const lat = side * (track.width[i] / 2 + dist)
      const p = track.point(i, lat, { x: 0, z: 0 })
      return { x: p.x, z: p.z, face: Math.atan2(track.px[i] - p.x, track.pz[i] - p.z) }
    }
    const place = (count, { clear, minD, maxD, size }) => {
      const out = []
      for (let tries = 0; out.length < count && tries < count * 40; tries++) {
        const at = rand()
        const side = rand() < 0.5 ? -1 : 1
        const d = minD + rand() * (maxD - minD)
        const p = nearRoad(at, side, d)
        if (!clearOfRoad(p.x, p.z, clear) || !free(p.x, p.z, size)) continue
        taken.push([p.x, p.z, size])
        out.push({ ...p, r: rand() })
      }
      return out
    }
    const sc = track.def.scenery
    // the arch area stays open
    taken.push([track.px[0], track.pz[0], 9])
    const warung = sc.warung
      .map((w) => nearRoad(w.at, w.side, 8))
      .filter((p) => clearOfRoad(p.x, p.z, 5.5))
    warung.forEach((p) => taken.push([p.x, p.z, 7]))
    const houses = place(sc.houses, { clear: 7.5, minD: 9, maxD: 16, size: 7 })
    const kebun = []
    for (const k of sc.kebun) {
      for (let a = k.from; a < k.to; a += 0.012) {
        for (let row = 0; row < 3; row++) {
          const p = nearRoad(a, k.side, 4 + row * 2.4)
          if (clearOfRoad(p.x, p.z, 2.6) && free(p.x, p.z, 0.8)) kebun.push(p)
        }
      }
    }
    kebun.forEach((p) => taken.push([p.x, p.z, 1]))
    const palms = place(sc.palms, { clear: 3.5, minD: 4, maxD: 14, size: 2 })
    const trees = place(sc.trees, { clear: 4, minD: 5, maxD: 42, size: 2.5 })
    // kids cheering by the line
    const crowd = [-1, 1, 1, -1].map((side, k) => ({ ...nearRoad((track.n - 4 + k * 3) / track.n, side, 1.6 + (k % 2) * 0.8) }))
    return { warung, houses, kebun, palms, trees, crowd }
  }, [track])
}

/** Many trees in two draws: trunks and crowns. */
function Trees({ spots }) {
  const meshes = useMemo(() => {
    const trunk = new InstancedMesh(new CylinderGeometry(0.16, 0.24, 2.4, 6).translate(0, 1.2, 0), new MeshStandardMaterial({ color: '#6b4a2e', flatShading: true }), spots.length)
    const crown = new InstancedMesh(new IcosahedronGeometry(1.7, 0).translate(0, 3.3, 0), new MeshStandardMaterial({ color: '#ffffff', flatShading: true }), spots.length)
    const o = new Object3D()
    const greens = ['#4f8a3a', '#5a9440', '#457d34', '#669c45'].map((c) => new Color(c))
    spots.forEach((p, k) => {
      const s = 0.8 + p.r * 0.7
      o.position.set(p.x, 0, p.z)
      o.rotation.set(0, p.r * 6.28, 0)
      o.scale.set(s, s * (0.9 + p.r * 0.3), s)
      o.updateMatrix()
      trunk.setMatrixAt(k, o.matrix)
      crown.setMatrixAt(k, o.matrix)
      crown.setColorAt(k, greens[k % greens.length])
    })
    trunk.castShadow = crown.castShadow = true
    return [trunk, crown]
  }, [spots])
  return meshes.map((m, k) => <primitive key={k} object={m} />)
}

/** Kebun pisang: rows of banana plants. */
function Kebun({ spots }) {
  const meshes = useMemo(() => {
    if (!spots.length) return []
    const stem = new InstancedMesh(new CylinderGeometry(0.1, 0.14, 1.6, 5).translate(0, 0.8, 0), new MeshStandardMaterial({ color: '#7c8f3a', flatShading: true }), spots.length)
    const leaves = new InstancedMesh(new ConeGeometry(1.1, 1.2, 5).translate(0, 2.0, 0), new MeshStandardMaterial({ color: '#6fae3c', flatShading: true }), spots.length)
    const o = new Object3D()
    spots.forEach((p, k) => {
      o.position.set(p.x, 0, p.z)
      o.rotation.set(0, k * 1.7, 0)
      o.scale.setScalar(0.85 + (k % 3) * 0.12)
      o.updateMatrix()
      stem.setMatrixAt(k, o.matrix)
      leaves.setMatrixAt(k, o.matrix)
    })
    stem.castShadow = leaves.castShadow = true
    return [stem, leaves]
  }, [spots])
  return meshes.map((m, k) => <primitive key={k} object={m} />)
}

function Hills({ track }) {
  const spots = useMemo(() => {
    let cx = 0
    let cz = 0
    for (let i = 0; i < track.n; i++) {
      cx += track.px[i]
      cz += track.pz[i]
    }
    cx /= track.n
    cz /= track.n
    return Array.from({ length: 14 }, (_, k) => {
      const a = (k / 14) * Math.PI * 2 + 0.3
      const r = 175 + (k % 3) * 25
      return { x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, h: 30 + (k % 4) * 12, w: 50 + (k % 3) * 18 }
    })
  }, [track])
  return spots.map((s, k) => (
    <mesh key={k} position={[s.x, s.h / 2 - 2, s.z]}>
      <coneGeometry args={[s.w, s.h, 7]} />
      <meshStandardMaterial color={k % 2 ? '#5f8f45' : '#6b9a4c'} flatShading />
    </mesh>
  ))
}

export function TrackScene({ track, watch }) {
  const spots = usePlacements(track)
  const looks = useMemo(() => spots.crowd.map((_, k) => kidLook(300 + k, k % 2 === 0)), [spots])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[700, 700]} />
        <meshStandardMaterial color={GRASS} roughness={1} />
      </mesh>
      <Road track={track} />
      <Patches track={track} />
      <Bridges track={track} />
      <StartArch track={track} />
      <CheckpointFlags track={track} />
      <Hills track={track} />
      <Trees spots={spots.trees} />
      <Kebun spots={spots.kebun} />
      {spots.houses.map((p, k) => (
        <group key={`h${k}`} position={[p.x, 0, p.z]} rotation={[0, p.face, 0]} scale={0.9}>
          <ModelSlot url={MODELS.rumah.urls[k % MODELS.rumah.urls.length]} fallback={null} />
        </group>
      ))}
      {spots.warung.map((p, k) => (
        <group key={`w${k}`} position={[p.x, 0, p.z]} rotation={[0, p.face, 0]}>
          <ModelSlot model={MODELS.warung} fallback={null} />
        </group>
      ))}
      {spots.palms.map((p, k) => (
        <group key={`p${k}`} position={[p.x, 0, p.z]} rotation={[0, p.r * 6.28, 0]} scale={0.8 + p.r * 0.4}>
          <ModelSlot model={MODELS.kelapa} fallback={null} />
        </group>
      ))}
      {spots.crowd.map((p, k) => (
        <group key={`c${k}`} position={[p.x, 0, p.z]} rotation={[0, p.face, 0]}>
          <PersonModel build="kid" look={looks[k]} pose={k % 2 ? 'clap' : 'cheer'} detail={false} watch={watch} />
        </group>
      ))}
    </group>
  )
}
