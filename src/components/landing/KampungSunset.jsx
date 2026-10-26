import { memo } from 'react'

/**
 * The landing scene: a kampung at golden hour, built as separate layers so
 * each can drift with the parallax (see LandingPage). All the "band" layers
 * share one 3000 × 1000 drawing, anchored to the bottom of the screen and
 * cropped at the sides, so a phone sees the middle (x ≈ 1130–1870) and a wide
 * screen sees more fields and trees. Horizon at y 560.
 */

const BAND = { viewBox: '0 0 3000 1000', preserveAspectRatio: 'xMidYMax slice' }

function Band({ depth, className = '', children }) {
  return (
    <div className={`ls-layer ls-band ${className}`} style={{ '--depth': depth }} aria-hidden="true">
      <svg {...BAND}>{children}</svg>
    </div>
  )
}

/** A coconut palm; fronds sway round the crown. */
function Palm({ x, y = 800, h, lean = 0, s = 1, color = '#3f5a2a', trunk = '#6b4a2e', delay = 0, slow = false }) {
  const cx = x + lean * h
  const cy = y - h
  const fronds = [-168, -140, -110, -70, -38, -12, 18, 160]
  return (
    <g>
      <path
        d={`M${x - 9 * s} ${y} Q${x + lean * h * 0.2} ${y - h * 0.55} ${cx - 3 * s} ${cy} L${cx + 4 * s} ${cy + 2} Q${x + lean * h * 0.2 + 10 * s} ${y - h * 0.55} ${x + 9 * s} ${y} Z`}
        fill={trunk}
      />
      <g className={`ls-sway ${slow ? 'is-slow' : ''}`} style={{ transformOrigin: `${cx}px ${cy}px`, animationDelay: `${delay}s` }}>
        {fronds.map((deg, i) => {
          const a = (deg * Math.PI) / 180
          const L = (110 + (i % 3) * 18) * s
          const tipX = cx + Math.cos(a) * L
          const tipY = cy + Math.sin(a) * L * 0.5 + Math.abs(Math.cos(a)) * L * 0.45
          const mx = cx + Math.cos(a) * L * 0.5
          const my = cy + Math.sin(a) * L * 0.5 - 22 * s
          return (
            <path
              key={deg}
              d={`M${cx} ${cy} Q${mx} ${my} ${tipX} ${tipY} Q${mx + 6 * s} ${my + 20 * s} ${cx} ${cy + 5 * s} Z`}
              fill={color}
            />
          )
        })}
        <circle cx={cx} cy={cy + 6 * s} r={9 * s} fill="#5a4320" />
      </g>
    </g>
  )
}

export const SunLayer = memo(function SunLayer() {
  return (
    <Band depth={0.15} className="ls-sun-layer">
      <defs>
        <radialGradient id="ls-sun-glow">
          <stop offset="0" stopColor="#fff2c2" stopOpacity="0.95" />
          <stop offset="0.25" stopColor="#ffd88a" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffb860" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className="ls-sun">
        <circle cx="1495" cy="462" r="330" fill="url(#ls-sun-glow)" />
        <circle cx="1495" cy="462" r="40" fill="#fff6d8" />
      </g>
      {/* birds heading home */}
      <g className="ls-birds" fill="none" stroke="#5b3a2a" strokeWidth="3" strokeLinecap="round">
        <path d="M1560 400 q8 -7 16 0 q8 -7 16 0" />
        <path d="M1610 430 q6 -5 12 0 q6 -5 12 0" />
        <path d="M1530 445 q5 -4 10 0 q5 -4 10 0" />
      </g>
    </Band>
  )
})

export const HillsLayer = memo(function HillsLayer() {
  return (
    <Band depth={0.3}>
      <path
        d="M0 560 L0 470 C220 430 380 500 560 455 C760 405 900 470 1080 450 C1250 432 1330 470 1440 488 C1560 505 1640 470 1760 455 C1900 438 2030 486 2200 470 C2400 450 2560 420 2760 462 C2860 482 2940 470 3000 465 L3000 560 Z"
        fill="#d6a08e"
      />
      <path
        d="M0 600 L0 520 C200 500 340 540 520 515 C700 490 820 520 1000 528 C1180 536 1300 520 1460 534 C1600 546 1720 520 1880 512 C2050 504 2200 540 2400 530 C2600 520 2800 500 3000 520 L3000 600 Z"
        fill="#b9806f"
      />
    </Band>
  )
})

/** Distant fields, the river catching the sunset and the far tree line. */
export const FieldsLayer = memo(function FieldsLayer() {
  const trees = []
  for (let x = 20; x < 3000; x += 46) {
    const r = 22 + ((x * 7) % 13)
    trees.push(<circle key={x} cx={x} cy={566 - ((x * 3) % 9)} r={r} fill={x % 3 ? '#55663a' : '#4c5d34'} />)
  }
  return (
    <Band depth={0.45}>
      <rect x="0" y="560" width="3000" height="440" fill="#97a046" />
      {trees}
      {/* far palms and a couple of roofs */}
      {[260, 640, 980, 1880, 2100, 2480, 2790].map((x, i) => (
        <Palm key={x} x={x} y={575} h={110 + (i % 3) * 20} lean={i % 2 ? 0.08 : -0.06} s={0.5} color="#46582f" trunk="#4e3d29" slow delay={i * 0.7} />
      ))}
      <path d="M1335 598 l26 -18 l26 18 z M1338 598 h46 v14 h-46z" fill="#7a4a34" />
      <path d="M1955 592 l30 -20 l30 20 z M1959 592 h52 v15 h-52z" fill="#7a4a34" />
      {/* sawah rows */}
      <path d="M0 640 C700 630 1300 650 3000 636 L3000 650 C1300 664 700 644 0 654Z" fill="#a9b04f" />
      <path d="M0 700 C800 688 1500 712 3000 694 L3000 706 C1500 724 800 700 0 712Z" fill="#a9b04f" />
      {/* the river, lit by the sun */}
      <path
        d="M0 690 C380 676 640 700 900 690 C1150 680 1300 650 1520 642 C1700 636 1850 650 2050 662 C2300 676 2600 664 3000 650 L3000 676 C2600 692 2300 704 2050 690 C1850 680 1700 664 1520 670 C1300 678 1150 712 900 720 C640 728 380 704 0 718Z"
        fill="#f6c98c"
      />
      <path d="M1420 660 h150 M1450 672 h100 M1475 684 h60" stroke="#fff1cf" strokeWidth="4" strokeLinecap="round" className="ls-glint" />
    </Band>
  )
})

/** Rumah kampung on stilts, palms and the yard. */
export const HouseLayer = memo(function HouseLayer() {
  const planks = []
  for (let y = 612; y < 724; y += 14) planks.push(<path key={y} d={`M1074 ${y} H1384`} stroke="#80492a" strokeWidth="2" />)
  return (
    <Band depth={0.7}>
      {/* yard and the path down to the jetty */}
      <path d="M700 800 C1000 772 1400 776 1700 790 C2000 804 2400 790 3000 800 L3000 1000 L0 1000 L0 806Z" fill="#7f8c3c" />
      <path d="M1380 800 C1460 830 1520 880 1560 1000 L1430 1000 C1420 900 1380 840 1330 802Z" fill="#c69a62" />
      <Palm x={1225} y={796} h={360} lean={-0.08} s={1.05} delay={0} />
      <Palm x={1352} y={790} h={300} lean={0.1} s={0.9} delay={1.4} />
      <Palm x={1905} y={795} h={420} lean={-0.1} s={1.1} delay={0.7} />
      <Palm x={960} y={800} h={330} lean={0.06} delay={2.1} />
      {/* stilts */}
      {[1088, 1150, 1215, 1280, 1345, 1410, 1455].map((x) => (
        <rect key={x} x={x} y="716" width="11" height="86" fill="#4f2f1a" />
      ))}
      {/* walls */}
      <rect x="1070" y="600" width="318" height="126" fill="#98592f" />
      {planks}
      {/* lit windows and door */}
      {[1100, 1180].map((x) => (
        <g key={x}>
          <rect x={x} y="628" width="46" height="54" fill="#ffd07c" className="ls-window" />
          <path d={`M${x + 23} 628 V682 M${x} 655 H${x + 46}`} stroke="#5b3420" strokeWidth="4" />
          <rect x={x - 4} y="624" width="54" height="62" fill="none" stroke="#5b3420" strokeWidth="5" />
        </g>
      ))}
      <rect x="1262" y="618" width="50" height="104" fill="#ffc46a" className="ls-window" />
      <rect x="1258" y="614" width="58" height="110" fill="none" stroke="#5b3420" strokeWidth="5" />
      {/* roof: zinc with a carved gable (tebar layar) */}
      <path d="M1030 616 L1229 470 L1428 616 L1412 624 L1229 490 L1046 624Z" fill="#5e5458" />
      <path d="M1056 606 L1229 480 L1402 606Z" fill="#b8804c" />
      <path d="M1100 600 L1229 506 L1358 600" fill="none" stroke="#8a5632" strokeWidth="5" />
      <path d="M1229 470 L1229 452" stroke="#5e5458" strokeWidth="8" />
      {/* serambi with railing and its own roof */}
      <rect x="1384" y="694" width="96" height="10" fill="#6b3f22" />
      {[1392, 1420, 1448, 1474].map((x) => (
        <rect key={x} x={x} y="664" width="5" height="32" fill="#6b3f22" />
      ))}
      <rect x="1384" y="662" width="96" height="6" fill="#6b3f22" />
      <path d="M1380 632 L1498 652 L1498 662 L1380 644Z" fill="#6b6266" />
      <rect x="1474" y="652" width="7" height="46" fill="#4f2f1a" />
      {/* Jalur Gemilang on the serambi post */}
      <g transform="translate(1395 600)">
        <rect x="0" y="0" width="4" height="64" fill="#4f2f1a" />
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <rect key={i} x="4" y={i * 4} width="34" height="4" fill={i % 2 ? '#f4efe6' : '#c8322c'} />
        ))}
        <rect x="4" y="0" width="16" height="16" fill="#1f3c8a" />
        <circle cx="11" cy="8" r="4" fill="#f5c542" />
        <circle cx="12.6" cy="8" r="3.2" fill="#1f3c8a" />
      </g>
      {/* stairs */}
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={1486 + i * 9} y={706 + i * 19} width="44" height="6" fill="#6b3f22" />
      ))}
      <path d="M1482 702 L1532 800 M1526 702 L1576 800" stroke="#4f2f1a" strokeWidth="5" />
      {/* bunga raya bush and a hen */}
      <ellipse cx="1110" cy="800" rx="64" ry="28" fill="#4d6a2c" />
      {[1080, 1112, 1140, 1096].map((x, i) => (
        <circle key={x} cx={x} cy={788 + (i % 2) * 10} r="7" fill="#d83a35" />
      ))}
      <g transform="translate(1600 806)">
        <ellipse cx="0" cy="0" rx="17" ry="12" fill="#a8582c" />
        <circle cx="14" cy="-12" r="7" fill="#a8582c" />
        <path d="M19 -14 l7 3 l-7 2z" fill="#e9a42a" />
        <path d="M12 -19 q3 -5 6 0" fill="#d83a35" />
        <path d="M-15 -4 q-10 -12 -2 -16 q4 6 6 12z" fill="#6b2f1a" />
        <path d="M-3 12 v8 M5 12 v8" stroke="#e9a42a" strokeWidth="2.5" />
      </g>
    </Band>
  )
})

/** Two kids from behind, sitting on the jetty edge watching the sun go down. */
export const KidsLayer = memo(function KidsLayer() {
  return (
    <Band depth={0.85} className="ls-kids">
      <g transform="translate(-80 -150) translate(1700 990) scale(0.72) translate(-1700 -990)">
      {/* boy */}
      <g className="ls-breathe" style={{ transformOrigin: '1648px 990px' }}>
        <path d="M1572 990 C1570 900 1586 834 1648 830 C1710 834 1726 900 1724 990Z" fill="#3c63a6" />
        <path d="M1648 832 C1622 834 1606 846 1604 870 M1648 832 C1676 834 1692 846 1694 870" stroke="#2f4f88" strokeWidth="5" fill="none" />
        <path d="M1586 900 C1572 930 1574 968 1590 990" stroke="#33589a" strokeWidth="26" strokeLinecap="round" fill="none" />
        <path d="M1712 900 C1730 930 1728 968 1712 990" stroke="#33589a" strokeWidth="26" strokeLinecap="round" fill="none" />
        <rect x="1634" y="806" width="28" height="30" rx="10" fill="#c98c5f" />
        <circle cx="1606" cy="774" r="11" fill="#c98c5f" />
        <circle cx="1690" cy="774" r="11" fill="#c98c5f" />
        <circle cx="1648" cy="766" r="46" fill="#1d1410" />
        <path d="M1606 752 q10 -8 18 2 q8 -10 18 -2 q10 -8 20 2 q10 -6 18 4" fill="none" stroke="#2e2019" strokeWidth="6" strokeLinecap="round" />
      </g>
      {/* girl */}
      <g className="ls-breathe is-late" style={{ transformOrigin: '1770px 990px' }}>
        <path d="M1704 990 C1702 912 1716 856 1770 852 C1824 856 1838 912 1836 990Z" fill="#d9504e" />
        {[
          [1736, 890],
          [1792, 878],
          [1760, 930],
          [1812, 940],
          [1728, 960],
          [1790, 972],
        ].map(([x, y]) => (
          <g key={`${x}${y}`} fill="#f7d7cf">
            <circle cx={x} cy={y} r="5" />
            <circle cx={x + 7} cy={y + 3} r="4" />
            <circle cx={x - 5} cy={y + 5} r="4" />
          </g>
        ))}
        <path d="M1716 916 C1704 944 1706 974 1718 990" stroke="#c94644" strokeWidth="22" strokeLinecap="round" fill="none" />
        <path d="M1826 916 C1840 944 1838 974 1826 990" stroke="#c94644" strokeWidth="22" strokeLinecap="round" fill="none" />
        <rect x="1758" y="830" width="24" height="26" rx="9" fill="#c98c5f" />
        <circle cx="1734" cy="800" r="9" fill="#c98c5f" />
        <circle cx="1806" cy="800" r="9" fill="#c98c5f" />
        <circle cx="1770" cy="792" r="40" fill="#1f1511" />
        {/* ponytail with a red scrunchie */}
        <g className="ls-pony" style={{ transformOrigin: '1800px 790px' }}>
          <path d="M1800 790 C1840 800 1848 850 1830 884 C1824 852 1812 822 1794 806Z" fill="#1f1511" />
          <circle cx="1802" cy="792" r="8" fill="#e5484d" />
        </g>
      </g>
      </g>
    </Band>
  )
})

/** The wooden jetty you're sitting on: planks running towards the view. */
export const DeckLayer = memo(function DeckLayer() {
  const lines = []
  for (let i = -6; i <= 16; i++) {
    const xb = i * 10 - 30
    lines.push(<path key={i} d={`M${50 + (xb - 50) * 0.28} 0 L${xb} 100`} stroke="#6f4022" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />)
  }
  return (
    <div className="ls-layer ls-deck" style={{ '--depth': 1 }} aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <rect x="0" y="0" width="100" height="100" fill="#9c6236" />
        <rect x="0" y="0" width="100" height="100" fill="#6b3f22" opacity="0.18" className="ls-deck-shade" />
        {lines}
        <path d="M0 40 H100 M0 72 H100" stroke="#6f4022" strokeWidth="1" vectorEffect="non-scaling-stroke" opacity="0.6" />
        <rect x="0" y="0" width="100" height="3" fill="#5b331b" />
      </svg>
    </div>
  )
})

/** Foreground: keladi leaves bottom-left, and the lantern on its post at the right. */
export const ForegroundLayer = memo(function ForegroundLayer() {
  return (
    <>
      <div className="ls-layer ls-fg ls-fg--left" style={{ '--depth': 1.15 }} aria-hidden="true">
        <svg viewBox="0 0 300 300" preserveAspectRatio="xMinYMax meet">
          <g className="ls-sway is-leaf" style={{ transformOrigin: '60px 300px' }}>
            <path d="M60 300 C40 230 10 200 0 150 C40 160 90 200 100 260Z" fill="#3e6a2a" />
            <path d="M60 300 C80 220 120 170 170 150 C170 200 130 260 96 300Z" fill="#4c7a30" />
            <path d="M60 300 C70 260 70 240 64 200 M96 300 C120 250 140 210 168 156" stroke="#6f9a44" strokeWidth="3" fill="none" />
          </g>
          <g className="ls-sway is-leaf is-late" style={{ transformOrigin: '20px 300px' }}>
            <path d="M20 300 C0 250 -20 230 -30 200 C10 205 50 240 56 300Z" fill="#355d24" />
          </g>
        </svg>
      </div>
      <div className="ls-layer ls-fg ls-fg--right" style={{ '--depth': 1.15 }} aria-hidden="true">
        <svg viewBox="0 0 120 600" preserveAspectRatio="xMaxYMax meet">
          <rect x="84" y="0" width="36" height="600" fill="#6b3f22" />
          <rect x="84" y="0" width="8" height="600" fill="#86532e" />
          <path d="M84 150 H48 V156 H84" fill="#4f2f1a" />
          <g className="ls-lantern" style={{ transformOrigin: '50px 156px' }}>
            <path d="M50 156 V170" stroke="#2c2420" strokeWidth="3" />
            <defs>
              <radialGradient id="ls-lamp-glow">
                <stop offset="0" stopColor="#ffe3a0" stopOpacity="0.8" />
                <stop offset="1" stopColor="#ffcf6e" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="50" cy="218" r="58" fill="url(#ls-lamp-glow)" className="ls-lantern-glow" />
            <path d="M34 178 H66 L62 188 H38Z" fill="#2c2420" />
            <rect x="36" y="188" width="28" height="58" rx="6" fill="#ffe2a0" className="ls-lantern-flame" />
            <path d="M36 196 V240 M64 196 V240 M50 188 V246" stroke="#2c2420" strokeWidth="3" />
            <path d="M32 246 H68 L64 256 H36Z" fill="#2c2420" />
          </g>
        </svg>
      </div>
    </>
  )
})

/** Slow clouds crossing the sky. */
export const Clouds = memo(function Clouds() {
  const cloud = (
    <svg viewBox="0 0 220 80">
      <path d="M20 66 C0 66 0 40 24 40 C26 18 60 12 74 30 C84 6 128 6 136 34 C150 20 186 26 184 48 C204 46 214 66 194 68Z" fill="currentColor" />
    </svg>
  )
  return (
    <div className="ls-layer ls-clouds" style={{ '--depth': 0.2 }} aria-hidden="true">
      <div className="ls-cloud c1">{cloud}</div>
      <div className="ls-cloud c2">{cloud}</div>
      <div className="ls-cloud c3">{cloud}</div>
    </div>
  )
})

/** A few motes of dust drifting in the warm light. */
export function Dust({ count = 7 }) {
  return (
    <div className="ls-dust" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} style={{ '--i': i }} />
      ))}
    </div>
  )
}
