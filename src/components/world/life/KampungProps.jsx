import { useMemo } from 'react'
import { HOUSE, NEIGHBOUR_HOUSES, WARUNG, px } from '../../../data/kampungLayout'
import { MODELS } from '../../../data/models'
import { NPCS } from '../../../data/npcs'
import { PartsBundle } from '../InstancedParts'
import { createRandom, mergeBundles, part, pick, randomBetween } from '../kit'
import { ModelSlot } from '../ModelSlot'

/**
 * Small things people leave about, put where they'd be: a tempayan of water
 * and selipar at the foot of each house's stairs, pots of bunga by some
 * doors, a baldi by the clothesline, guni and crates by the warung, a bubu
 * (fish trap) and a pail by Pak Abu. One prop library (the builders below),
 * placed by zone; nothing scattered at random, nothing on a path.
 * All kit parts: one draw call per shape for the lot.
 */

// ---------------------------------------------------------------- the library
// Each builder takes a world position and yaw and returns kit parts.
const rot = (x, z, yaw, lx, lz) => [x + lx * Math.cos(yaw) + lz * Math.sin(yaw), z - lx * Math.sin(yaw) + lz * Math.cos(yaw)]

export const PROPS = {
  /** Big glazed water jar with a coconut-shell gayung on the lid. */
  tempayan(x, z, yaw) {
    const [gx, gz] = rot(x, z, yaw, 0.08, 0)
    const [hx, hz] = rot(x, z, yaw, 0.25, 0)
    return {
      ball: [part([x, 0.36, z], [0.62, 0.68, 0.62], [0, yaw, 0], '#6b3a22')],
      cylinder: [part([x, 0.7, z], [0.36, 0.06, 0.36], [0, 0, 0], '#5a2e1a'), part([x, 0.74, z], [0.42, 0.03, 0.42], [0, 0, 0], '#8a6a45')],
      blob: [part([gx, 0.8, gz], [0.15, 0.08, 0.15], [0, 0, 0], '#4a3424')],
      // the gayung's handle
      box: [part([hx, 0.8, hz], [0.25, 0.025, 0.03], [0, yaw, 0], '#7a5232')],
    }
  },
  /** A terracotta pot of bunga kertas or keladi. */
  pasu(x, z, yaw, random) {
    const flower = pick(random, ['#e9779a', '#d9473b', '#f2c14e', '#f5efe2'])
    return {
      taperedCylinder: [part([x, 0.17, z], [0.32, 0.34, 0.32], [Math.PI, yaw, 0], '#b5603a')],
      blob: [part([x, 0.48, z], [0.42, 0.34, 0.42], [random(), yaw, 0], '#4f8a3a'), part([x + 0.06, 0.62, z + 0.04], [0.14, 0.12, 0.14], [0, 0, 0], flower)],
    }
  },
  /** Plastic baldi. */
  baldi(x, z, yaw, random) {
    return { taperedCylinder: [part([x, 0.16, z], [0.32, 0.32, 0.32], [Math.PI, yaw, 0], pick(random, ['#3a6ea5', '#d9473b', '#3cb371']))] }
  },
  /** A guni (sack) of rice or coconuts, slumped. */
  guni(x, z, yaw, random) {
    return { blob: [part([x, 0.28, z], [0.55, 0.62, 0.45], [randomBetween(random, -0.1, 0.1), yaw, 0], '#c9b07a')] }
  },
  /** Wooden crate (of empty bottles at the warung). */
  peti(x, z, yaw) {
    return { box: [part([x, 0.2, z], [0.6, 0.4, 0.42], [0, yaw, 0], '#9b7048'), part([x, 0.41, z], [0.5, 0.03, 0.34], [0, yaw, 0], '#5d3f27')] }
  },
  /** Bubu: a rattan fish trap, on its side. */
  bubu(x, z, yaw) {
    const [mx, mz] = rot(x, z, yaw, 0, 0.46)
    return {
      taperedCylinder: [part([x, 0.22, z], [0.4, 0.9, 0.4], [Math.PI / 2, yaw, 0], '#b98a4a', 'YXZ')],
      // the rim of its mouth
      cylinder: [part([mx, 0.22, mz], [0.32, 0.04, 0.32], [Math.PI / 2, yaw, 0], '#8a6438', 'YXZ')],
    }
  },
  /** Firewood, stacked. */
  kayu(x, z, yaw) {
    const cylinder = []
    for (let k = 0; k < 6; k++) {
      const [lx, lz] = rot(x, z, yaw, (k % 3) * 0.14 - 0.14, 0)
      cylinder.push(part([lx, 0.07 + Math.floor(k / 3) * 0.13, lz], [0.12, 0.85, 0.12], [Math.PI / 2, yaw, 0], k % 2 ? '#7a5232' : '#6b4a2e', 'YXZ'))
    }
    return { cylinder }
  },
}

// ---------------------------------------------------------------- the zones
/** House zone: around the foot of the front stairs (house-local x, z). */
const HOUSE_SPOTS = [
  { kind: 'tempayan', at: [-2.5, 5.0] },
  { kind: 'pasu', at: [2.4, 4.9] },
  { kind: 'pasu', at: [2.95, 4.75] },
  { kind: 'baldi', at: [-3.1, 4.85] },
  { kind: 'kayu', at: [3.6, -2.0] },
]

function houseProps(house, index) {
  const random = createRandom(700 + index)
  const yaw = house.rotationY
  const bundles = []
  const slippers = []
  for (const spot of HOUSE_SPOTS) {
    // every house has its tempayan; the rest, some houses
    if (spot.kind !== 'tempayan' && random() < 0.45) continue
    const [x, z] = rot(house.position[0], house.position[2], yaw, spot.at[0], spot.at[1])
    bundles.push(PROPS[spot.kind](x, z, yaw + randomBetween(random, -0.3, 0.3), random))
  }
  // selipar left at the bottom of the stairs (someone's home)
  if (random() < 0.7) {
    const [x, z] = rot(house.position[0], house.position[2], yaw, randomBetween(random, -0.5, 0.5), 5.3)
    slippers.push({ x, z, yaw: yaw + randomBetween(random, -0.6, 0.6) })
  }
  return { bundles, slippers }
}

function buildProps() {
  const bundles = []
  const slippers = []
  NEIGHBOUR_HOUSES.forEach((h, i) => {
    const r = houseProps(h, i)
    bundles.push(...r.bundles)
    slippers.push(...r.slippers)
  })
  const random = createRandom(733)
  // warung: guni and crates by the kitchen wall
  const wy = WARUNG.rotationY
  const w = (lx, lz) => rot(WARUNG.position[0], WARUNG.position[2], wy, lx, lz)
  bundles.push(PROPS.guni(...w(-5.1, -1.6), wy + 0.3, random), PROPS.guni(...w(-5.2, -0.9), wy - 0.2, random))
  bundles.push(PROPS.peti(...w(5.0, -1.8), wy), PROPS.peti(...w(5.05, -1.25), wy + 0.1))
  // Tok Wan's yard: the tempayan by his stairs, kayu api round the side
  const ty = HOUSE.rotationY
  const t = (lx, lz) => rot(HOUSE.position[0], HOUSE.position[2], ty, lx, lz)
  bundles.push(PROPS.tempayan(...t(-3.3, 5.0), ty), PROPS.kayu(...t(5.6, -2.5), ty + Math.PI / 2))
  // Pak Abu's spot on the river: a bubu and a pail of bait
  const abu = NPCS.find((n) => n.id === 'pak-abu')
  const ay = abu.rotationY
  const a = (lx, lz) => rot(abu.position[0], abu.position[2], ay, lx, lz)
  bundles.push(PROPS.bubu(...a(-1.1, -1.3), ay + 1.2), PROPS.baldi(...a(0.9, -1.0), ay, random))
  // the clothesline: a baldi of pegs
  const [cx, cz] = px(420, 400)
  bundles.push(PROPS.baldi(cx + 1.4, cz + 0.6, 0, random))
  return { bundle: mergeBundles(...bundles), slippers }
}

export function KampungProps() {
  const { bundle, slippers } = useMemo(buildProps, [])
  return (
    <>
      <PartsBundle bundle={bundle} />
      {slippers.map((s, i) => (
        <group key={i} position={[s.x, 0, s.z]} rotation={[0, s.yaw, 0]}>
          <ModelSlot model={MODELS.selipar} fallback={null} />
        </group>
      ))}
    </>
  )
}
