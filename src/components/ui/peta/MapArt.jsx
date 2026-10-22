import { memo } from 'react'
import {
  BOUNDS,
  BRIDGES,
  CLOTHESLINE,
  HOUSE,
  HUTAN,
  KEBUN_KELAPA,
  LAMAN_GASING,
  MAP_SIZE,
  NEIGHBOUR_HOUSES,
  PADANG_GALAH,
  PADANG_LAPANG,
  PADANG_SEPAK,
  PASIR_GULI,
  PONDOK_SAWAH,
  RIVERS,
  ROADS,
  SAWAH,
  SCARECROW,
  SCHOOL,
  TAMAN,
  WARUNG,
  WATERFALL,
  YARD_FENCE,
  toMap,
} from '../../../data/kampungLayout'
import { games } from '../../../data/games'
import { treeLayout } from '../../world/Trees'
import { SAMPAN } from '../../world/Props'

/**
 * The Peta artwork: a storybook top-down drawing of the kampung, generated from
 * the same layout data as the 3D world, so everything is where you'll find it.
 * Drawn in map pixels (MAP_SIZE); 1 m = K px.
 */

const K = 1 / 0.11
const [W, H] = MAP_SIZE
const deg = (rad) => (rad * 180) / Math.PI
const m = (x, z) => toMap(x, z)
const rect = (r) => {
  const [u0, v0] = m(r.xMin, r.zMin)
  const [u1, v1] = m(r.xMax, r.zMax)
  return { x: u0, y: v0, width: u1 - u0, height: v1 - v0 }
}

function seeded(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/** Smooth path through world points (Catmull-Rom → cubic Bézier). */
function smoothPath(points) {
  const p = points.map(([x, z]) => m(x, z))
  let d = `M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i]
    const p1 = p[i]
    const p2 = p[i + 1]
    const p3 = p[i + 2] ?? p2
    const t = 0.18
    const c1 = [p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t]
    const c2 = [p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t]
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }
  return d
}

// ---------------------------------------------------------------- symbols
const TREE_GREENS = [
  ['#4b8a36', '#5f9c40', '#7cb551'],
  ['#3f7a31', '#558f3b', '#72a94b'],
  ['#56913b', '#69a344', '#8cc05a'],
]

function Symbols() {
  return (
    <defs>
      <pattern id="pt-grass" width="26" height="26" patternUnits="userSpaceOnUse">
        <rect width="26" height="26" fill="#a9cc62" />
        <path d="M4 6l1.5-3 1.5 3M17 15l1.5-3 1.5 3M9 22l1.5-3 1.5 3" stroke="#93ba52" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      </pattern>
      <pattern id="pt-padi" width="18" height="12" patternUnits="userSpaceOnUse">
        <rect width="18" height="12" fill="#c7cf62" />
        <path d="M2 10v-5M6 10v-6M10 10v-5M14 10v-6" stroke="#a8b64a" strokeWidth="1.6" strokeLinecap="round" />
      </pattern>
      <pattern id="pt-padi2" width="18" height="12" patternUnits="userSpaceOnUse">
        <rect width="18" height="12" fill="#d8cc5e" />
        <path d="M2 10v-5M6 10v-6M10 10v-5M14 10v-6" stroke="#bba947" strokeWidth="1.6" strokeLinecap="round" />
      </pattern>
      <pattern id="pt-sand" width="14" height="14" patternUnits="userSpaceOnUse">
        <rect width="14" height="14" fill="#e8d29a" />
        <circle cx="3" cy="4" r="1" fill="#d4ba7c" />
        <circle cx="10" cy="10" r="1" fill="#d4ba7c" />
      </pattern>
      <pattern id="pt-zinc" width="8" height="8" patternUnits="userSpaceOnUse">
        <rect width="8" height="8" fill="#b4ada2" />
        <rect width="3" height="8" fill="#a1998d" />
      </pattern>
      <radialGradient id="gr-vignette" cx="50%" cy="50%" r="72%">
        <stop offset="70%" stopColor="#3b2414" stopOpacity="0" />
        <stop offset="100%" stopColor="#3b2414" stopOpacity="0.32" />
      </radialGradient>

      {TREE_GREENS.map(([dark, mid, light], i) => (
        <g id={`sy-tree${i}`} key={i}>
          <circle cx="4" cy="6" r="15" fill="#2f4a1c" opacity="0.28" />
          <circle cx="-5" cy="2" r="10" fill={dark} />
          <circle cx="5" cy="3" r="10" fill={dark} />
          <circle cx="0" cy="-3" r="11" fill={mid} />
          <circle cx="-3" cy="-6" r="5.5" fill={light} />
        </g>
      ))}
      <g id="sy-fruit">
        <use href="#sy-tree0" />
        <circle cx="-6" cy="1" r="2" fill="#d8283a" />
        <circle cx="4" cy="-4" r="2" fill="#d8283a" />
        <circle cx="6" cy="5" r="2" fill="#e0452a" />
        <circle cx="-1" cy="6" r="2" fill="#d8283a" />
      </g>
      <g id="sy-palm">
        <circle cx="5" cy="7" r="13" fill="#2f4a1c" opacity="0.24" />
        {Array.from({ length: 8 }, (_, k) => (
          <path
            key={k}
            d="M0 0 Q 7 -4 18 1 Q 8 3 0 0Z"
            fill={k % 2 ? '#5f9a3c' : '#77ad4a'}
            stroke="#3f6f2a"
            strokeWidth="0.8"
            transform={`rotate(${k * 45 + 10})`}
          />
        ))}
        <circle r="3" fill="#7a5d2c" />
      </g>
      <g id="sy-banana">
        <circle cx="3" cy="5" r="9" fill="#2f4a1c" opacity="0.22" />
        {Array.from({ length: 5 }, (_, k) => (
          <ellipse key={k} cx="6" cy="0" rx="7" ry="3.4" fill={k % 2 ? '#8bbc52' : '#7db04a'} transform={`rotate(${k * 72})`} />
        ))}
      </g>
      <g id="sy-bush">
        <circle cx="-2" cy="1" r="5.5" fill="#3f7a34" />
        <circle cx="3" cy="-1" r="5" fill="#4f8a3a" />
      </g>
      <g id="sy-bushf">
        <use href="#sy-bush" />
        <circle cx="-3" cy="-1" r="1.4" fill="#ee4a5a" />
        <circle cx="3" cy="2" r="1.4" fill="#d8283a" />
        <circle cx="2" cy="-4" r="1.4" fill="#ee4a5a" />
      </g>
    </defs>
  )
}

// ---------------------------------------------------------------- ground
function Ground() {
  const random = seeded(11)
  const blotches = Array.from({ length: 70 }, () => ({
    cx: random() * W,
    cy: random() * H,
    rx: 30 + random() * 90,
    ry: 20 + random() * 60,
    dark: random() < 0.55,
  }))
  return (
    <g>
      <rect width={W} height={H} fill="url(#pt-grass)" />
      {blotches.map((b, i) => (
        <ellipse key={i} cx={b.cx} cy={b.cy} rx={b.rx} ry={b.ry} fill={b.dark ? '#8fb84f' : '#bcd877'} opacity="0.35" />
      ))}
      {[PADANG_LAPANG, PADANG_GALAH, TAMAN].map((r, i) => (
        <rect key={i} {...rect(r)} rx="40" fill="#bcd877" opacity="0.85" />
      ))}
      <rect {...rect(PASIR_GULI)} rx="50" fill="url(#pt-sand)" />
      <circle cx={m(...LAMAN_GASING.center)[0]} cy={m(...LAMAN_GASING.center)[1]} r={LAMAN_GASING.radius * K} fill="#d8b47a" />
      <SepakCourt />
      <GalahCourt />
    </g>
  )
}

/** Sepak raga: the 6 m circle with the 2 m circle inside, on bare earth. */
function SepakCourt() {
  const r = rect(PADANG_SEPAK)
  const spot = games.find((g) => g.id === 'sepak-raga').spot.position
  const [cx, cy] = m(spot[0], spot[1])
  return (
    <g>
      <rect {...r} rx="16" fill="#b2d36d" />
      <circle cx={cx} cy={cy} r={4.1 * K} fill="#d6b27a" />
      <circle cx={cx} cy={cy} r={3 * K} fill="none" stroke="#f6f3e6" strokeWidth="3" />
      <circle cx={cx} cy={cy} r={1 * K} fill="none" stroke="#f6f3e6" strokeWidth="2.5" />
    </g>
  )
}

function GalahCourt() {
  const r = rect(PADANG_GALAH)
  const cx = r.x + r.width / 2
  const cy = r.y + r.height / 2
  const w = 6 * K
  const h = 9 * K
  return (
    <g stroke="#f6f3e6" strokeWidth="2.5" fill="none" opacity="0.9">
      <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} />
      <line x1={cx} y1={cy - h / 2} x2={cx} y2={cy + h / 2} />
      {[-1.5, 1.5].map((dz) => (
        <line key={dz} x1={cx - w / 2} y1={cy + dz * K} x2={cx + w / 2} y2={cy + dz * K} />
      ))}
    </g>
  )
}

function Sawah() {
  const r = rect(SAWAH)
  const plotW = 11 * K
  const plotH = 4.5 * K
  const plots = []
  let i = 0
  for (let y = r.y; y < r.y + r.height - 1; y += plotH) {
    for (let x = r.x; x < r.x + r.width - 1; x += plotW) {
      plots.push({ x, y, w: Math.min(plotW, r.x + r.width - x), h: Math.min(plotH, r.y + r.height - y), alt: (i++ + Math.floor(y / plotH)) % 3 === 0 })
    }
  }
  const [hu, hv] = m(PONDOK_SAWAH.position[0], PONDOK_SAWAH.position[2])
  const [su, sv] = m(SCARECROW.position[0], SCARECROW.position[2])
  return (
    <g>
      <rect x={r.x - 4} y={r.y - 4} width={r.width + 8} height={r.height + 8} rx="6" fill="#8f7a45" />
      {plots.map((p, k) => (
        <rect key={k} x={p.x + 2.5} y={p.y + 2.5} width={p.w - 5} height={p.h - 5} rx="2" fill={p.alt ? 'url(#pt-padi2)' : 'url(#pt-padi)'} />
      ))}
      {/* pondok sawah */}
      <g transform={`translate(${hu} ${hv})`}>
        <rect x="-17" y="-15" width="38" height="36" fill="#2f4a1c" opacity="0.25" />
        <rect x="-20" y="-20" width="38" height="36" fill="#a07a44" stroke="#6d4f2a" strokeWidth="2" />
        <line x1="-1" y1="-20" x2="-1" y2="16" stroke="#6d4f2a" strokeWidth="2" />
      </g>
      {/* orang-orang */}
      <g transform={`translate(${su} ${sv})`} stroke="#5a3e24" strokeWidth="3" strokeLinecap="round">
        <line x1="-9" y1="0" x2="9" y2="0" />
        <line x1="0" y1="-4" x2="0" y2="9" />
        <circle r="4.5" cy="-3" fill="#e2b85a" stroke="#8a6a2e" strokeWidth="1.5" />
      </g>
    </g>
  )
}

// ---------------------------------------------------------------- water
function Rivers() {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      {RIVERS.map((r) => (
        <path key={`b${r.id}`} d={smoothPath(r.points)} stroke="#e4d29c" strokeWidth={(r.width + 2.6) * K} />
      ))}
      {RIVERS.map((r) => (
        <path key={`w${r.id}`} d={smoothPath(r.points)} stroke="#4fa9cc" strokeWidth={r.width * K} />
      ))}
      {RIVERS.map((r) => (
        <path key={`d${r.id}`} d={smoothPath(r.points)} stroke="#3c93ba" strokeWidth={r.width * K * 0.42} opacity="0.55" />
      ))}
      {RIVERS.map((r) => (
        <path
          key={`s${r.id}`}
          d={smoothPath(r.points)}
          stroke="#d8f2fa"
          strokeWidth="2.2"
          strokeDasharray="14 34"
          opacity="0.85"
          transform="translate(0 -4)"
        />
      ))}
    </g>
  )
}

function Waterfall() {
  const [u, v] = m(...WATERFALL.at)
  const random = seeded(77)
  const rocks = Array.from({ length: 16 }, (_, i) => {
    const a = -Math.PI * 0.85 + (i / 15) * Math.PI * 1.7
    const d = 40 + random() * 26
    return { x: Math.sin(a) * d, y: -Math.cos(a) * d * 0.8 - 6, r: 13 + random() * 13, c: random() < 0.5 ? '#8d8a80' : '#a29e92' }
  })
  return (
    <g transform={`translate(${u} ${v})`}>
      {rocks.map((r, i) => (
        <g key={i}>
          <circle cx={r.x + 4} cy={r.y + 5} r={r.r} fill="#2f4a1c" opacity="0.25" />
          <circle cx={r.x} cy={r.y} r={r.r} fill={r.c} stroke="#6f6c63" strokeWidth="1.5" />
          <circle cx={r.x - r.r * 0.3} cy={r.y - r.r * 0.3} r={r.r * 0.35} fill="#c4c0b4" />
        </g>
      ))}
      <ellipse cx="0" cy="18" rx="34" ry="24" fill="#4fa9cc" />
      <path d="M-14 -34 L-12 14 M-4 -38 L-3 16 M6 -36 L5 15 M14 -32 L12 12" stroke="#f4fbff" strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="0" cy="16" rx="24" ry="10" fill="#e8f7fc" opacity="0.9" />
    </g>
  )
}

function Bridges() {
  return (
    <g>
      {BRIDGES.map((b, i) => {
        const [u, v] = m(b.x, b.z)
        const w = b.width * K
        const l = (b.length + 1) * K
        const planks = []
        for (let y = -l / 2 + 4; y < l / 2; y += 7) planks.push(y)
        return (
          <g key={i} transform={`translate(${u} ${v}) rotate(${-deg(b.rotationY)})`}>
            <rect x={-w / 2 + 4} y={-l / 2 + 6} width={w} height={l} fill="#1f3a4a" opacity="0.3" />
            <rect x={-w / 2} y={-l / 2} width={w} height={l} rx="3" fill="#a8744a" />
            {planks.map((y) => (
              <line key={y} x1={-w / 2} y1={y} x2={w / 2} y2={y} stroke="#86582f" strokeWidth="1.4" />
            ))}
            <rect x={-w / 2 - 2} y={-l / 2} width="5" height={l} rx="2" fill="#6b4226" />
            <rect x={w / 2 - 3} y={-l / 2} width="5" height={l} rx="2" fill="#6b4226" />
          </g>
        )
      })}
    </g>
  )
}

function Sampan() {
  return (
    <g>
      {SAMPAN.map((s, i) => {
        const [u, v] = m(s.position[0], s.position[2])
        return (
          <g key={i} transform={`translate(${u} ${v}) rotate(${-deg(s.rotationY)})`}>
            <path d="M0 -22 C9 -12 9 12 0 22 C-9 12 -9 -12 0 -22Z" fill="#7a4f2c" stroke="#4f3219" strokeWidth="1.6" />
            <path d="M0 -15 C5 -8 5 8 0 15 C-5 8 -5 -8 0 -15Z" fill="#a9774a" />
            <line x1="-5" y1="-3" x2="5" y2="-3" stroke="#4f3219" strokeWidth="2" />
            <line x1="-5" y1="6" x2="5" y2="6" stroke="#4f3219" strokeWidth="2" />
          </g>
        )
      })}
    </g>
  )
}

// ---------------------------------------------------------------- roads
function Roads() {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      {ROADS.map((r) => (
        <path key={`e${r.id}`} d={smoothPath(r.points)} stroke="#b9854a" strokeWidth={(r.width + 0.9) * K} />
      ))}
      {ROADS.map((r) => (
        <path key={`f${r.id}`} d={smoothPath(r.points)} stroke="#ddb170" strokeWidth={r.width * K} />
      ))}
      {ROADS.map((r) => (
        <path key={`c${r.id}`} d={smoothPath(r.points)} stroke="#ebc88f" strokeWidth={r.width * K * 0.3} />
      ))}
    </g>
  )
}

// ---------------------------------------------------------------- buildings
/** A pitched roof seen from above: ridge along the local z axis. */
function Roof({ x = 0, z = 0, w, d, light, dark, ridgeAcross = false, eave = '#5c2416' }) {
  const pw = w * K
  const pd = d * K
  const left = { x: x * K - pw / 2, y: z * K - pd / 2 }
  return (
    <g>
      <rect x={left.x + 7} y={left.y + 9} width={pw} height={pd} rx="3" fill="#2f2a14" opacity="0.28" />
      <rect x={left.x} y={left.y} width={pw} height={pd} rx="3" fill={light} stroke={eave} strokeWidth="2.5" />
      {ridgeAcross ? (
        <rect x={left.x + 1.5} y={left.y + pd / 2} width={pw - 3} height={pd / 2 - 1.5} fill={dark} />
      ) : (
        <rect x={left.x + pw / 2} y={left.y + 1.5} width={pw / 2 - 1.5} height={pd - 3} fill={dark} />
      )}
      {ridgeAcross ? (
        <line x1={left.x} y1={left.y + pd / 2} x2={left.x + pw} y2={left.y + pd / 2} stroke={eave} strokeWidth="3" />
      ) : (
        <line x1={left.x + pw / 2} y1={left.y} x2={left.x + pw / 2} y2={left.y + pd} stroke={eave} strokeWidth="3" />
      )}
    </g>
  )
}

function placed(b) {
  const [u, v] = m(b.position[0], b.position[2])
  return `translate(${u} ${v}) rotate(${-deg(b.rotationY)})`
}

const NEIGHBOUR_ROOFS = [
  ['#c9553a', '#a33f29'],
  ['#b8613e', '#924a2d'],
  ['#d06a3c', '#a9522c'],
]

function Buildings() {
  return (
    <g>
      {/* Rumah Tok Wan: main house, lower serambi roof and stairs */}
      <g transform={placed(HOUSE)}>
        <rect x={-0.7 * K} y={4.9 * K} width={1.4 * K} height={2 * K} fill="#8a5a32" stroke="#5c3a1e" strokeWidth="1.5" />
        <Roof z={-2.9} w={9.6} d={9.2} light="#c4472f" dark="#9e3422" />
        <Roof z={3.3} w={9.2} d={4.2} light="#d3593c" dark="#ad4329" ridgeAcross />
      </g>
      {NEIGHBOUR_HOUSES.map((h, i) => {
        const [light, dark] = NEIGHBOUR_ROOFS[i % 3]
        return (
          <g key={i} transform={placed(h)}>
            <rect x={-0.6 * K} y={4.4 * K} width={1.2 * K} height={1.6 * K} fill="#8a5a32" stroke="#5c3a1e" strokeWidth="1.5" />
            <Roof w={8} d={9.4} light={light} dark={dark} />
          </g>
        )
      })}
      {/* Sekolah: two long blocks */}
      <g transform={placed(SCHOOL)}>
        <Roof x={-3.4} z={2.2} w={14.6} d={7.2} light="#c94a32" dark="#a23824" ridgeAcross />
        <Roof x={5} z={-2.3} w={11.6} d={7.6} light="#c94a32" dark="#a23824" ridgeAcross />
        <rect x={-12 * K} y={7 * K} width={22 * K} height={1.2 * K} rx="4" fill="#d9d2c0" opacity="0.8" />
        <g transform={`translate(${-14.5 * K} ${7.2 * K})`}>
          <circle r="4" fill="#d8d8d8" stroke="#888" />
          <rect x="2" y="-14" width="16" height="10" fill="#c4302b" />
          <rect x="2" y="-14" width="7" height="5" fill="#1f3f8a" />
        </g>
      </g>
      {/* Warung kopi: zinc roof with a sign */}
      <g transform={placed(WARUNG)}>
        <rect x={-4.8 * K + 7} y={-3.6 * K + 9} width={9.6 * K} height={6.8 * K} fill="#2f2a14" opacity="0.28" />
        <rect x={-4.8 * K} y={-3.6 * K} width={9.6 * K} height={6.8 * K} rx="3" fill="url(#pt-zinc)" stroke="#6b6156" strokeWidth="2.5" />
        <rect x={-4.8 * K} y={-3.6 * K} width={9.6 * K} height={6.8 * K} rx="3" fill="#b0603a" opacity="0.18" />
        <rect x={-2.6 * K} y={2.7 * K} width={5.2 * K} height={1.1 * K} rx="3" fill="#8a2c22" stroke="#5c1d16" strokeWidth="1.5" />
        <text x="0" y={3.25 * K} className="peta-art__sign">WARUNG</text>
      </g>
    </g>
  )
}

function YardBits() {
  const [cu, cv] = m(CLOTHESLINE.position[0], CLOTHESLINE.position[2])
  const colors = ['#e2622b', '#2f6fd1', '#f2c14e', '#d9473b', '#3f8a7a']
  return (
    <g>
      {YARD_FENCE.map(([x1, z1, x2, z2], i) => {
        const [a, b] = m(x1, z1)
        const [c, d] = m(x2, z2)
        return <line key={i} x1={a} y1={b} x2={c} y2={d} stroke="#8a5a32" strokeWidth="3" strokeDasharray="10 4" />
      })}
      <g transform={`translate(${cu} ${cv})`}>
        <line x1="-26" y1="0" x2="26" y2="0" stroke="#6b4a2e" strokeWidth="1.5" />
        {colors.map((c, i) => (
          <rect key={c} x={-22 + i * 9} y="-1" width="7" height="10" fill={c} />
        ))}
      </g>
    </g>
  )
}

// ---------------------------------------------------------------- plants
function Plants() {
  const { plants } = treeLayout()
  return (
    <g>
      {plants.map((p, i) => {
        const [u, v] = m(p.x, p.z)
        let href = `#sy-tree${i % 3}`
        let s = p.size
        if (p.kind === 'palm') href = '#sy-palm'
        else if (p.kind === 'banana') href = '#sy-banana'
        else if (p.kind === 'bush') href = p.fruit ? '#sy-bushf' : '#sy-bush'
        else if (p.fruit) href = '#sy-fruit'
        if (p.kind === 'tree') s *= 1.25
        return <use key={i} href={href} transform={`translate(${u.toFixed(1)} ${v.toFixed(1)}) scale(${s.toFixed(2)})`} />
      })}
    </g>
  )
}

// ---------------------------------------------------------------- labels
function Label({ at, children, size = 24, rotate = 0 }) {
  return (
    <text x={at[0]} y={at[1]} className="peta-art__label" fontSize={size} transform={rotate ? `rotate(${rotate} ${at[0]} ${at[1]})` : undefined}>
      {children}
    </text>
  )
}
const centre = (r) => {
  const { x, y, width, height } = rect(r)
  return [x + width / 2, y + height / 2]
}

function Labels() {
  const [hu, hv] = m(HOUSE.position[0], HOUSE.position[2])
  const [su, sv] = m(SCHOOL.position[0], SCHOOL.position[2])
  const [fu, fv] = m(...WATERFALL.at)
  return (
    <g>
      <Label at={[centre(SAWAH)[0], centre(SAWAH)[1] + 8]}>Sawah Padi</Label>
      <Label at={[rect(KEBUN_KELAPA).x + rect(KEBUN_KELAPA).width - 70, rect(KEBUN_KELAPA).y + rect(KEBUN_KELAPA).height - 6]}>Kebun Kelapa</Label>
      <Label at={[centre(HUTAN)[0] - 40, rect(HUTAN).y + 30]}>Hutan Kecil</Label>
      <Label at={[fu - 112, fv + 24]} size={20}>Air Terjun</Label>
      <Label at={[hu - 150, hv + 60]} size={20}>Rumah Tok Wan</Label>
      <Label at={[su - 30, sv - 52]} size={21}>Sekolah</Label>
      <Label at={[rect(PADANG_LAPANG).x + 100, rect(PADANG_LAPANG).y + rect(PADANG_LAPANG).height - 16]} size={21}>Padang Lapang</Label>
      <Label at={[centre(PADANG_GALAH)[0] - 70, rect(PADANG_GALAH).y + rect(PADANG_GALAH).height - 18]} size={21}>Padang Kampung</Label>
      <text className="peta-art__label peta-art__label--water" fontSize="22">
        <textPath href="#peta-sungai" startOffset="34%">
          Sungai Kampung
        </textPath>
      </text>
      <text className="peta-art__label peta-art__label--road" fontSize="17">
        <textPath href="#peta-jalan" startOffset="64%">
          Jalan Kampung
        </textPath>
      </text>
    </g>
  )
}

function Compass() {
  return (
    <g transform={`translate(${W - 74} ${H - 86})`}>
      <circle r="40" fill="#fbf3e2" stroke="#7a4a24" strokeWidth="3" opacity="0.92" />
      <path d="M0 -32 L8 0 L0 6 L-8 0Z" fill="#c4472f" />
      <path d="M0 32 L8 0 L0 -6 L-8 0Z" fill="#7a4a24" />
      <text y="-42" className="peta-art__label" fontSize="20">
        U
      </text>
    </g>
  )
}

/** Everything outside the playable kampung fades into thick trees. */
function Edge() {
  const b = rect(BOUNDS)
  return (
    <g>
      <rect width={W} height={H} fill="url(#gr-vignette)" pointerEvents="none" />
      <rect x={b.x} y={b.y} width={b.width} height={b.height} rx="24" fill="none" stroke="#3f6a2a" strokeWidth="3" strokeDasharray="2 10" opacity="0.5" />
    </g>
  )
}

export const MapArt = memo(function MapArt() {
  return (
    <svg className="peta-art" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <Symbols />
      <defs>
        <path id="peta-sungai" d={smoothPath(RIVERS[1].points)} />
        <path id="peta-jalan" d={smoothPath(ROADS[0].points)} />
      </defs>
      <Ground />
      <Sawah />
      <Rivers />
      <Waterfall />
      <Roads />
      <Bridges />
      <Sampan />
      <YardBits />
      <Buildings />
      <Plants />
      <Labels />
      <Compass />
      <Edge />
    </svg>
  )
})
