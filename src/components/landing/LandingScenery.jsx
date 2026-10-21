import { memo } from 'react'

/**
 * Golden-hour kampung silhouette drawn entirely in SVG + CSS:
 * setting sun, layered bukit, a rumah kampung on stilts with lamp-lit windows,
 * swaying coconut palms, a child flying a wau, birds and drifting leaves.
 */

const GROUND_Y = 756

function coconutPalm({ x, height, lean, scale = 1 }) {
  const topX = x + lean * height
  const topY = GROUND_Y - height
  const trunk = `M${x - 7 * scale} ${GROUND_Y + 4} Q${x + lean * height * 0.15} ${GROUND_Y - height * 0.55} ${topX - 2} ${topY} L${topX + 3} ${topY + 2} Q${x + lean * height * 0.15 + 8 * scale} ${GROUND_Y - height * 0.55} ${x + 7 * scale} ${GROUND_Y + 4} Z`
  const angles = [-172, -140, -112, -78, -45, -14, 14]
  const fronds = angles.map((deg, i) => {
    const a = (deg * Math.PI) / 180
    const length = (88 + (i % 3) * 14) * scale
    const droop = Math.abs(Math.cos(a)) * length * 0.42
    const tipX = topX + Math.cos(a) * length
    const tipY = topY + Math.sin(a) * length * 0.55 + droop
    const c1x = topX + Math.cos(a) * length * 0.5
    const c1y = topY + Math.sin(a) * length * 0.55 - 18 * scale
    const c2x = topX + Math.cos(a) * length * 0.55
    const c2y = c1y + 16 * scale
    return `M${topX} ${topY} Q${c1x} ${c1y} ${tipX} ${tipY} Q${c2x} ${c2y} ${topX} ${topY + 3} Z`
  })
  return { trunk, fronds, topX, topY }
}

const PALMS = [
  { x: 120, height: 340, lean: -0.12, delay: 0 },
  { x: 205, height: 255, lean: 0.14, delay: 1.2, scale: 0.85 },
  { x: 690, height: 300, lean: 0.2, delay: 0.6, scale: 0.95 },
  { x: 1215, height: 375, lean: -0.18, delay: 1.8 },
  { x: 1318, height: 280, lean: 0.1, delay: 0.3, scale: 0.85 },
].map((p) => ({ ...p, ...coconutPalm(p) }))

function House() {
  return (
    <g className="scenery__house">
      {/* stilts */}
      {[338, 380, 425, 470, 512].map((x) => (
        <rect key={x} x={x} y={688} width={8} height={70} />
      ))}
      <rect x={326} y={600} width={200} height={92} rx={2} />
      {/* roof */}
      <path d="M300 612 L426 512 L552 612 L540 618 L426 528 L312 618 Z" />
      <path d="M326 604 L426 524 L526 604 Z" />
      {/* lit windows */}
      <rect className="scenery__window" x={350} y={628} width={30} height={32} rx={2} />
      <rect className="scenery__window" x={472} y={628} width={30} height={32} rx={2} />
      <rect className="scenery__window scenery__window--door" x={410} y={622} width={32} height={66} rx={2} />
      <path className="scenery__window" d="M426 556 L436 568 L426 580 L416 568 Z" />
      {/* serambi */}
      <rect x={526} y={646} width={78} height={10} />
      <path d="M520 618 L612 640 L612 648 L520 628 Z" />
      <rect x={598} y={640} width={6} height={50} />
      {/* stairs */}
      <path d="M604 656 L640 758 L630 758 L596 660 Z" />
      {/* fence */}
      {Array.from({ length: 11 }, (_, i) => (
        <rect key={i} x={250 + i * 13} y={726} width={5} height={32} />
      ))}
      <rect x={248} y={734} width={142} height={4} />
    </g>
  )
}

function Palm({ palm }) {
  return (
    <g className="scenery__palm">
      <path d={palm.trunk} />
      <g
        className="scenery__fronds"
        style={{ transformOrigin: `${palm.topX}px ${palm.topY}px`, animationDelay: `${palm.delay}s` }}
      >
        {palm.fronds.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    </g>
  )
}

function WauKid() {
  return (
    <g>
      {/* string */}
      <path className="scenery__string" d="M872 718 Q1010 560 1092 318" />
      {/* child */}
      <g className="scenery__kid">
        <circle cx={862} cy={700} r={10} />
        <path d="M852 712 Q862 708 872 712 L876 738 L868 738 L866 756 L860 756 L858 738 L850 738 Z" />
        <path d="M869 716 L878 704 L882 707 L873 720 Z" />
      </g>
      {/* wau bulan */}
      <g className="scenery__wau" style={{ transformOrigin: '1092px 318px' }}>
        <path
          d="M1092 210 L1104 226 L1138 240 L1152 252 L1130 260 L1104 268 L1100 290 L1124 300 L1140 296 L1130 314 L1112 324 L1092 328 L1072 324 L1054 314 L1044 296 L1060 300 L1084 290 L1080 268 L1054 260 L1032 252 L1046 240 L1080 226 Z"
          fill="#c9342c"
        />
        <path
          d="M1092 226 L1100 236 L1122 246 L1104 254 L1094 262 L1096 288 L1112 300 L1092 312 L1072 300 L1088 288 L1090 262 L1080 254 L1062 246 L1084 236 Z"
          fill="#f2c14e"
        />
        <path d="M1092 246 L1098 258 L1092 270 L1086 258 Z" fill="#1f7a7a" />
        <path d="M1092 206 V330 M1036 250 Q1092 232 1148 250" stroke="#3a1d1a" strokeWidth="2" fill="none" />
        <path d="M1032 252 L1026 280 M1152 252 L1158 280" stroke="#f2c14e" strokeWidth="3" strokeLinecap="round" />
      </g>
    </g>
  )
}

function Birds() {
  const flock = [
    [0, 0, 1],
    [34, 14, 0.8],
    [62, -6, 0.9],
    [90, 20, 0.7],
  ]
  return (
    <g className="scenery__birds">
      {flock.map(([x, y, s], i) => (
        <path
          key={i}
          className="scenery__bird"
          style={{ animationDelay: `${i * 0.18}s` }}
          d={`M${x} ${y} q${8 * s} ${-7 * s} ${16 * s} 0 q${8 * s} ${-7 * s} ${16 * s} 0`}
        />
      ))}
    </g>
  )
}

const LEAVES = [
  { left: 6, delay: 0, duration: 13, size: 18, hue: 0 },
  { left: 18, delay: 4, duration: 15, size: 14, hue: 1 },
  { left: 31, delay: 8.5, duration: 12, size: 20, hue: 2 },
  { left: 44, delay: 2, duration: 16, size: 13, hue: 0 },
  { left: 57, delay: 10, duration: 14, size: 17, hue: 1 },
  { left: 66, delay: 6, duration: 13, size: 15, hue: 2 },
  { left: 78, delay: 1, duration: 17, size: 19, hue: 0 },
  { left: 88, delay: 7.5, duration: 12.5, size: 14, hue: 1 },
  { left: 94, delay: 12, duration: 15, size: 16, hue: 2 },
  { left: 12, delay: 14, duration: 14, size: 12, hue: 1 },
  { left: 50, delay: 16, duration: 13, size: 18, hue: 2 },
]

function FallingLeaves() {
  return (
    <div className="leaves" aria-hidden="true">
      {LEAVES.map((leaf, i) => (
        <span
          key={i}
          className={`leaf leaf--${leaf.hue}`}
          style={{
            left: `${leaf.left}%`,
            width: `${leaf.size}px`,
            height: `${leaf.size * 0.55}px`,
            animationDelay: `${leaf.delay}s, ${leaf.delay}s`,
            animationDuration: `${leaf.duration}s, ${leaf.duration / 4}s`,
          }}
        />
      ))}
    </div>
  )
}

const MOTES = Array.from({ length: 22 }, (_, i) => ({
  left: (i * 37) % 100,
  top: 30 + ((i * 23) % 55),
  delay: (i * 0.7) % 6,
  size: 2 + (i % 3),
}))

export const LandingScenery = memo(function LandingScenery({ dimmed = false }) {
  return (
    <div className={`scenery ${dimmed ? 'scenery--dimmed' : ''}`} aria-hidden="true">
      <svg className="scenery__svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMax slice">
        <defs>
          <radialGradient id="sunCore" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff7d6" />
            <stop offset="55%" stopColor="#ffd27a" />
            <stop offset="100%" stopColor="#ff9f4a" />
          </radialGradient>
          <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffd59a" stopOpacity="0.75" />
            <stop offset="45%" stopColor="#ff9f5a" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#ff7a4a" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="shimmer" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#ffd58a" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ffd58a" stopOpacity="0" />
          </linearGradient>
        </defs>

        <circle cx="1030" cy="640" r="560" fill="url(#sunGlow)" />
        <circle className="scenery__sun" cx="1030" cy="640" r="104" fill="url(#sunCore)" />

        <path
          className="scenery__hills scenery__hills--far"
          d="M0 610 C160 540 300 560 420 592 C560 520 720 532 860 586 C980 540 1140 522 1260 576 C1340 556 1400 560 1440 572 V900 H0 Z"
        />
        <path
          className="scenery__hills scenery__hills--mid"
          d="M0 682 C200 624 360 652 520 672 C700 632 900 642 1080 676 C1220 652 1340 646 1440 662 V900 H0 Z"
        />

        {/* sawah water catching the light */}
        <g className="scenery__shimmer">
          <rect x="880" y="700" width="300" height="5" rx="2.5" fill="url(#shimmer)" />
          <rect x="930" y="714" width="200" height="4" rx="2" fill="url(#shimmer)" />
          <rect x="970" y="726" width="120" height="3" rx="1.5" fill="url(#shimmer)" />
        </g>

        <path
          className="scenery__land"
          d="M0 760 C240 732 520 746 760 752 C1000 760 1220 740 1440 748 V900 H0 Z"
        />

        {/* bushes */}
        <g className="scenery__land">
          <ellipse cx="60" cy="756" rx="70" ry="26" />
          <ellipse cx="560" cy="758" rx="60" ry="18" />
          <ellipse cx="760" cy="756" rx="46" ry="16" />
          <ellipse cx="1390" cy="752" rx="80" ry="28" />
          <ellipse cx="1150" cy="756" rx="52" ry="16" />
        </g>

        <House />
        {PALMS.map((palm) => (
          <Palm key={palm.x} palm={palm} />
        ))}
        <WauKid />

        <g transform="translate(560 250)">
          <Birds />
        </g>
      </svg>

      <div className="motes">
        {MOTES.map((m, i) => (
          <span
            key={i}
            className="mote"
            style={{ left: `${m.left}%`, top: `${m.top}%`, width: m.size, height: m.size, animationDelay: `${m.delay}s` }}
          />
        ))}
      </div>
      <FallingLeaves />
      <div className="scenery__vignette" />
      <div className="scenery__grain" />
    </div>
  )
})
