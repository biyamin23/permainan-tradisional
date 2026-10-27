import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MeshStandardMaterial, Vector3 } from 'three'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useNpcBody } from '../../../state/npcBodies'
import { PersonModel } from '../../character/PersonModel'
import { InstancedParts, PartsBundle } from '../InstancedParts'
import { GEO, MAT, part } from '../kit'
import { ProximityBubble } from '../npc/ProximityBubble'
import { worldRuntime } from '../../../state/worldRuntime'
import { MODELS } from '../../../data/models'
import { ModelSlot } from '../ModelSlot'

/**
 * Kedai kopi by the main road: a zinc-roofed shed with a counter at the back
 * and wooden tables, where the old men of the kampung sit over kopi O and a
 * game of dam. Pak Tam is the one at the dam board; talk to him to play.
 * Local frame: the open front faces +z (the spot rotates it to face the road).
 */

const W = 7.6 // along x
const D = 5.6 // along z
const WOOD = '#6e4a2c'
const WOOD_DARK = '#57391f'
const TABLE = '#8a6440'

// with the GLB warung the tables stand in a row on its open front floor
const GLB = Boolean(MODELS.warung.url)
const TABLES = GLB
  ? [{ x: 0, z: 1.1 }, { x: -2.65, z: 1.1 }, { x: 2.65, z: 1.1 }]
  : [{ x: 0.7, z: 0.5 }, { x: -2.4, z: 0.9 }, { x: 2.9, z: -0.7 }]
const DAM_TABLE = TABLES[0]
// the model is see-through while you stand inside or at its open front
const insideWarung = (p) => Math.abs(p.x) < 5.4 && p.z > -3.6 && p.z < 5.6
const BENCH_GAP = 0.78 // table centre to bench centre

function addTable(box, cylinder, { x, z }) {
  const topY = 0.76
  box.push(part([x, topY, z], [1.3, 0.06, 0.9], [0, 0, 0], TABLE))
  for (const dx of [-0.56, 0.56]) for (const dz of [-0.36, 0.36]) box.push(part([x + dx, topY / 2, z + dz], [0.07, topY, 0.07], [0, 0, 0], WOOD_DARK))
  // a bench on each long side
  for (const side of [-1, 1]) {
    const bz = z + side * BENCH_GAP
    box.push(part([x, 0.45, bz], [1.4, 0.06, 0.3], [0, 0, 0], TABLE))
    for (const dx of [-0.6, 0.6]) box.push(part([x + dx, 0.22, bz], [0.06, 0.44, 0.24], [0, 0, 0], WOOD_DARK))
  }
  // a glass of water and a little jar of toothpicks, like every kedai kopi table
  cylinder.push(part([x - 0.5, topY + 0.07, z - 0.3], [0.06, 0.1, 0.06], [0, 0, 0], '#cfe0dc'))
  cylinder.push(part([x - 0.4, topY + 0.06, z - 0.32], [0.05, 0.08, 0.05], [0, 0, 0], '#e8dfc9'))
}

/** Cup of kopi on a saucer. */
function addCup(cylinder, x, y, z) {
  cylinder.push(part([x, y + 0.006, z], [0.14, 0.012, 0.14], [0, 0, 0], '#f1ece0'))
  cylinder.push(part([x, y + 0.045, z], [0.085, 0.07, 0.085], [0, 0, 0], '#f6f2e8'))
  cylinder.push(part([x, y + 0.081, z], [0.07, 0.004, 0.07], [0, 0, 0], '#3a2214'))
}

function buildKedai() {
  const box = []
  const cylinder = []
  // cement floor
  box.push(part([0, 0.02, 0], [W, 0.04, D], [0, 0, 0], '#b8b0a2'))
  // posts
  for (const x of [-W / 2 + 0.15, 0, W / 2 - 0.15]) {
    for (const z of [-D / 2 + 0.15, D / 2 - 0.15]) {
      box.push(part([x, 1.4, z], [0.14, 2.8, 0.14], [0, 0, 0], WOOD))
    }
  }
  // beams under the roof
  box.push(part([0, 2.7, D / 2 - 0.15], [W + 0.2, 0.14, 0.14], [0, 0, 0], WOOD))
  box.push(part([0, 3.1, -D / 2 + 0.15], [W + 0.2, 0.14, 0.14], [0, 0, 0], WOOD))
  // back wall of planks
  box.push(part([0, 1.45, -D / 2 + 0.05], [W, 2.9, 0.08], [0, 0, 0], '#86603d'))
  for (let y = 0.3; y < 2.9; y += 0.34) box.push(part([0, y, -D / 2 + 0.1], [W, 0.025, 0.01], [0, 0, 0], '#6b4a2c'))
  // counter with the kettle, kuih jars and cups
  box.push(part([-1.7, 0.5, -D / 2 + 0.55], [3.0, 1.0, 0.6], [0, 0, 0], '#7a5232'))
  box.push(part([-1.7, 1.03, -D / 2 + 0.55], [3.1, 0.06, 0.7], [0, 0, 0], '#5a3a22'))
  cylinder.push(part([-2.8, 1.2, -D / 2 + 0.55], [0.26, 0.28, 0.26], [0, 0, 0], '#c9c2b2'))
  cylinder.push(part([-2.8, 1.36, -D / 2 + 0.55], [0.12, 0.05, 0.12], [0, 0, 0], '#3a3a3a'))
  ;[
    ['#e2b44a', -2.1],
    ['#7fb35a', -1.75],
    ['#d0674f', -1.4],
  ].forEach(([kuih, x]) => {
    cylinder.push(part([x, 1.18, -D / 2 + 0.5], [0.22, 0.24, 0.22], [0, 0, 0], '#d8e6e2'))
    cylinder.push(part([x, 1.13, -D / 2 + 0.5], [0.18, 0.12, 0.18], [0, 0, 0], kuih))
    cylinder.push(part([x, 1.32, -D / 2 + 0.5], [0.23, 0.04, 0.23], [0, 0, 0], '#c43d3d'))
  })
  for (let i = 0; i < 4; i++) addCup(cylinder, -0.95 + (i % 2) * 0.18, 1.06, -D / 2 + 0.45 + Math.floor(i / 2) * 0.18)
  // shelf of tins
  box.push(part([1.6, 1.8, -D / 2 + 0.22], [2.6, 0.05, 0.3], [0, 0, 0], '#5a3a22'))
  ;['#c43d3d', '#e2b44a', '#2f6f9a', '#e8e1d0', '#3f7a4a', '#c8642f'].forEach((tin, i) => {
    cylinder.push(part([0.6 + i * 0.4, 1.95, -D / 2 + 0.22], [0.2, 0.26, 0.2], [0, 0, 0], tin))
  })
  // signboard on the front beam: green with a cream panel
  box.push(part([0, 2.42, D / 2 - 0.1], [2.8, 0.46, 0.05], [0, 0, 0], '#2f5f3a'))
  box.push(part([0, 2.42, D / 2 - 0.07], [2.5, 0.3, 0.02], [0, 0, 0], '#efe2c6'))
  addCup(cylinder, -0.9, 2.38, D / 2 - 0.02)

  return { box, cylinder }
}

/** Tables, the dam game and the cups: kept when a GLB warung replaces the shell. */
function buildFurniture() {
  const box = []
  const cylinder = []
  for (const t of TABLES) addTable(box, cylinder, t)

  // the dam board and its bottle caps
  const by = 0.79
  const { x: dx, z: dz } = DAM_TABLE
  box.push(part([dx, by + 0.012, dz], [0.6, 0.024, 0.6], [0, 0, 0], '#ddb47c'))
  const q = 0.07
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 0) continue
      const x = dx - 0.245 + c * q
      const z = dz - 0.245 + r * q
      box.push(part([x, by + 0.026, z], [q * 0.94, 0.004, q * 0.94], [0, 0, 0], '#b9874f'))
      // a game in progress: a few caps each, some taken off the board
      const red = r <= 2 && (r * 3 + c) % 4 !== 0
      const blue = r >= 5 && (r * 5 + c) % 3 !== 0
      if (red || blue) cylinder.push(part([x, by + 0.036, z], [0.05, 0.014, 0.05], [0, 0, 0], red ? '#c2402f' : '#2f6fd1'))
    }
  }
  // eaten caps lined up beside the board
  for (let i = 0; i < 4; i++) cylinder.push(part([dx + 0.4, by + 0.01, dz - 0.2 + i * 0.07], [0.05, 0.014, 0.05], [0, 0, 0], i < 3 ? '#2f6fd1' : '#c2402f'))
  addCup(cylinder, dx - 0.45, by - 0.03, dz - 0.2)
  addCup(cylinder, dx - 0.45, by - 0.03, dz + 0.25)
  // table two: kopi for two and a plate of kuih
  const t2 = TABLES[1]
  addCup(cylinder, t2.x - 0.2, 0.76, t2.z - 0.22)
  addCup(cylinder, t2.x + 0.15, 0.76, t2.z + 0.22)
  cylinder.push(part([t2.x + 0.3, 0.8, t2.z - 0.1], [0.3, 0.015, 0.3], [0, 0, 0], '#f1ece0'))
  box.push(part([t2.x + 0.26, 0.83, t2.z - 0.12], [0.1, 0.05, 0.06], [0, 0, 0], '#7fb35a'))
  box.push(part([t2.x + 0.36, 0.83, t2.z - 0.06], [0.1, 0.05, 0.06], [0, 0, 0], '#d0674f'))
  // table three: a folded newspaper and a cup
  const t3 = TABLES[2]
  box.push(part([t3.x - 0.1, 0.795, t3.z], [0.42, 0.012, 0.3], [0, 0.2, 0], '#e9e6dc'))
  addCup(cylinder, t3.x + 0.35, 0.76, t3.z - 0.15)

  return { box, cylinder }
}

/** Single-slope zinc roof, lower at the front, with ridges. Kept apart so it can fade. */
function buildRoof() {
  const box = []
  const slope = Math.atan2(0.5, D + 1)
  box.push(part([0, 2.92, 0], [W + 0.9, 0.05, D + 1], [slope, 0, 0], '#a7aeb1'))
  for (let i = 0; i < 15; i++) {
    const x = -W / 2 - 0.3 + i * 0.6
    box.push(part([x, 2.955, 0], [0.06, 0.03, D + 1], [slope, 0, 0], i % 5 === 2 ? '#9a7458' : '#8e969a'))
  }
  return { box }
}

const PARTS = buildKedai()
const FURNITURE = buildFurniture()
const ROOF = buildRoof()
const roofMaterial = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.88, flatShading: true, transparent: true, opacity: 1 })
const _local = new Vector3()

/**
 * The roof fades away while you're inside or right at the front of the
 * kedai, so the camera can see the tables and the dam board.
 */
function FadingRoof() {
  const group = useRef()
  useFrame((_, delta) => {
    const g = group.current
    if (!g) return
    _local.copy(worldRuntime.playerPosition)
    g.worldToLocal(_local)
    const inside = Math.abs(_local.x) < W / 2 + 1.2 && _local.z > -D / 2 - 1 && _local.z < D / 2 + 3
    const target = inside ? 0.12 : 1
    const k = 1 - Math.exp(-6 * Math.min(delta, 0.1))
    roofMaterial.opacity += (target - roofMaterial.opacity) * k
    roofMaterial.depthWrite = roofMaterial.opacity > 0.95
    g.visible = roofMaterial.opacity > 0.02
    // a see-through roof shouldn't throw a solid shadow on the tables
    const shadow = roofMaterial.opacity > 0.6
    if (g.userData.shadow !== shadow) {
      g.userData.shadow = shadow
      g.traverse((o) => {
        if (o.isMesh) o.castShadow = shadow
      })
    }
  })
  return (
    <group ref={group}>
      <PartsBundle bundle={ROOF} material={roofMaterial} castShadow />
    </group>
  )
}
// bulb hanging over the dam table: dark by day, glowing at night
const BULB = [part([DAM_TABLE.x, 2.3, DAM_TABLE.z], [0.16, 0.2, 0.16], [0, 0, 0], '#ffffff')]
const CORD = [part([DAM_TABLE.x, 2.55, DAM_TABLE.z], [0.015, 0.4, 0.015], [0, 0, 0], '#2a2a2a')]

const ELDER_BASE = { bottomType: 'pelikat', hair: '#cfcac0', beard: true, slipper: '#3b2a20' }

/** An old man of the kampung, seated (or standing) with a physical body. */
function Elder({ look, pose = 'sitDrink', position, rotationY = 0, phase = 0, detail = false, cup = false }) {
  const body = useRef(null)
  useNpcBody(body, { radius: 0.3, halfHeight: 0.5 })
  const full = useMemo(() => ({ ...ELDER_BASE, ...look }), [look])
  const hand = cup ? (
    <mesh position={[0, -0.02, 0.02]} material={MAT.kit} geometry={GEO.cylinder} scale={[0.08, 0.07, 0.08]} />
  ) : null
  return (
    <group ref={body} position={position} rotation={[0, rotationY, 0]}>
      <PersonModel build="adult" elder look={full} pose={pose} phase={phase} detail={detail} rightHand={hand} watch={worldRuntime.playerPosition} />
    </group>
  )
}

// Pak Tam, as in his picture: white patterned kopiah, grey beard, checked shirt
const PAK_TAM = { shirt: '#cdbf9c', bottom: '#5b4a3a', headwear: 'kopiah', headwearColor: '#f1ece2', accent: '#8a7a5a' }
const FRIENDS = [
  { shirt: '#e8e4da', bottom: '#4a5a6a', headwear: 'songkok' },
  { shirt: '#5f7f9a', bottom: '#3f3a34', headwear: 'kopiah' },
  { shirt: '#8a3b3b', bottom: '#4b3a2c', headwear: 'kopiah', headwearColor: '#e8e1d0' },
  { shirt: '#6f8a5a', bottom: '#3d3a33', headwear: 'cap', headwearColor: '#d8cdb2' },
  { shirt: '#d9d2c0', bottom: '#5b4636', headwear: null, hair: '#e2ded6' },
]
const SEAT_Y = 0.48

export function KedaiKopi({ game }) {
  const [x, z] = game.spot.position
  const { x: tx, z: tz } = DAM_TABLE
  const t2 = TABLES[1]
  const t3 = TABLES[2]
  return (
    <RigidBody type="fixed" colliders={false} position={[x, 0, z]} rotation={[0, game.spot.rotationY ?? 0, 0]}>
      {/* walls, counter and tables are solid; the front stays open */}
      {GLB ? (
        MODELS.warung.colliders.map(([half, center], i) => <CuboidCollider key={`w${i}`} args={half} position={center} />)
      ) : (
        <>
          <CuboidCollider args={[W / 2, 1.45, 0.08]} position={[0, 1.45, -D / 2 + 0.05]} />
          <CuboidCollider args={[1.55, 0.55, 0.36]} position={[-1.7, 0.55, -D / 2 + 0.55]} />
          {[-W / 2 + 0.15, 0, W / 2 - 0.15].map((px) => (
            <CuboidCollider key={`p${px}`} args={[0.1, 1.4, 0.1]} position={[px, 1.4, D / 2 - 0.15]} />
          ))}
        </>
      )}
      {TABLES.map((t) => (
        <CuboidCollider key={`${t.x}`} args={[0.72, 0.4, BENCH_GAP + 0.16]} position={[t.x, 0.4, t.z]} />
      ))}
      <ModelSlot
        model={MODELS.warung}
        fadeWhen={insideWarung}
        fallback={
          <>
            <PartsBundle bundle={PARTS} />
            <FadingRoof />
          </>
        }
      />
      <PartsBundle bundle={FURNITURE} />
      <InstancedParts geometry={GEO.ball} material={MAT.glow} parts={BULB} castShadow={false} />
      <InstancedParts geometry={GEO.cylinder} parts={CORD} castShadow={false} />

      {/* the dam game: Pak Tam (facing the road) against his old friend */}
      <Elder look={PAK_TAM} pose="sitPlay" position={[tx, SEAT_Y, tz - BENCH_GAP]} rotationY={0} detail />
      <Elder look={FRIENDS[0]} pose="sitThink" position={[tx, SEAT_Y, tz + BENCH_GAP]} rotationY={Math.PI} phase={0.7} />
      {/* a friend standing by, watching the game */}
      <Elder look={FRIENDS[4]} pose="idle" position={[tx + 1.15, 0.04, tz + 0.1]} rotationY={-Math.PI / 2} phase={1.4} />
      {/* kopi and sembang at the next tables */}
      <Elder look={FRIENDS[1]} pose="sitDrink" position={[t2.x, SEAT_Y, t2.z - BENCH_GAP]} rotationY={0} phase={0.3} cup />
      <Elder look={FRIENDS[2]} pose="sitDrink" position={[t2.x, SEAT_Y, t2.z + BENCH_GAP]} rotationY={Math.PI} phase={2.1} cup />
      <Elder look={FRIENDS[3]} pose="sitDrink" position={[t3.x, SEAT_Y, t3.z - BENCH_GAP]} rotationY={0} phase={1.1} cup />

      <ProximityBubble lines={game.lines} position={[tx, 2.0, tz - BENCH_GAP]} maxDistance={game.spot.radius + 6} interval={4200} />
    </RigidBody>
  )
}
