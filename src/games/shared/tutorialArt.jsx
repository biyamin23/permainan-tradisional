/**
 * Little animated pictures for the tutorials (SVG, 320 × 180). Each one shows
 * just the thing a step asks you to do: where to tap, which way things move.
 */

const INK = '#3b2414'
const GLOW = '#ffd45e'
const GO = '#4ccf5a'
const CREAM = '#fbf3e2'

function Svg({ children, bg = '#efe2c6', label }) {
  return (
    <svg className="tut-art__svg" viewBox="0 0 320 180" role="img" aria-label={label}>
      <rect width="320" height="180" fill={bg} />
      <defs>
        <marker id="tut-head" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill={INK} />
        </marker>
        <marker id="tut-head-w" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="#fff" />
        </marker>
      </defs>
      {children}
    </svg>
  )
}

/** A pulsing finger: the tip sits on (x, y). */
function Tap({ x, y }) {
  return (
    <g transform={`translate(${x} ${y})`} className="tut-tap">
      <circle r="11" className="tut-tap__ring" />
      <text x="3" y="21" fontSize="22" textAnchor="middle" className="tut-tap__hand">
        👆
      </text>
    </g>
  )
}

function Label({ x, y, children, size = 11, anchor = 'middle', fill = INK, weight = 800 }) {
  return (
    <text x={x} y={y} fontSize={size} fontWeight={weight} textAnchor={anchor} fill={fill} className="tut-art__text">
      {children}
    </text>
  )
}

function Bubble({ x, y, children, fill = GO, w = 64 }) {
  return (
    <g className="tut-pop">
      <rect x={x - w / 2} y={y - 11} width={w} height="20" rx="10" fill={fill} />
      <Label x={x} y={y + 3} fill="#fff" size={10.5}>
        {children}
      </Label>
    </g>
  )
}

/** A button like the ones at the bottom of the game screen. */
function Btn({ x, y, w = 78, children, hot = false }) {
  return (
    <g className={hot ? 'tut-btn is-hot' : 'tut-btn'}>
      <rect x={x} y={y} width={w} height="28" rx="14" fill={hot ? GO : CREAM} stroke={hot ? '#2c7a3b' : '#c9b48c'} strokeWidth="2" />
      <Label x={x + w / 2} y={y + 18} fill={hot ? '#fff' : INK} size={10.5}>
        {children}
      </Label>
    </g>
  )
}

/* ------------------------------------------------------------------ congkak */

const PIT_X = [70, 100, 130, 160, 190, 220, 250]
const TOP = 70
const BOTTOM = 110

function Seeds({ x, y, n = 3 }) {
  const spots = [
    [-3, -3],
    [3, -2],
    [0, 3],
    [-4, 3],
    [4, 3],
    [0, -5],
  ]
  return spots.slice(0, n).map(([dx, dy], i) => <circle key={i} cx={x + dx} cy={y + dy} r="2.6" fill="#f4e3b5" />)
}

function CongkakBoard({ empty = [], full = [], quiet = false, children }) {
  return (
    <>
      {!quiet && (
        <Label x={160} y={36}>
          Barisan Aisyah
        </Label>
      )}
      <rect x="12" y="46" width="296" height="88" rx="44" fill="#a8703c" stroke="#6b3f1e" strokeWidth="3" />
      <ellipse cx="40" cy="90" rx="17" ry="30" fill="#5a3418" />
      <ellipse cx="280" cy="90" rx="17" ry="30" fill="#5a3418" />
      {PIT_X.map((x) =>
        [TOP, BOTTOM].map((y) => {
          const key = `${x}-${y}`
          return (
            <g key={key}>
              <circle cx={x} cy={y} r="11" fill="#5a3418" />
              {!empty.includes(key) && <Seeds x={x} y={y} n={full.includes(key) ? 6 : 3} />}
            </g>
          )
        }),
      )}
      <Label x={160} y={152}>
        Barisan kamu
      </Label>
      <Label x={40} y={152} size={10}>
        Rumah kamu
      </Label>
      {!quiet && (
        <Label x={280} y={36} size={10}>
          Rumah Aisyah
        </Label>
      )}
      {children}
    </>
  )
}

function Glow({ cx, cy, r = 14 }) {
  return <circle cx={cx} cy={cy} r={r} fill="none" stroke={GLOW} strokeWidth="4" className="tut-glow" />
}

export function CongkakGoal() {
  return (
    <Svg label="Papan congkak">
      <CongkakBoard />
      <Glow cx={40} cy={90} r={22} />
    </Svg>
  )
}

export function CongkakPick() {
  return (
    <Svg label="Tekan lubang di barisan kamu">
      <CongkakBoard />
      <Glow cx={190} cy={BOTTOM} />
      <Tap x={190} y={BOTTOM + 2} />
    </Svg>
  )
}

const SOW_PATH = `M190 ${BOTTOM} L70 ${BOTTOM} C52 ${BOTTOM} 40 106 40 90 C40 74 52 ${TOP} 70 ${TOP} L250 ${TOP}`

export function CongkakSow() {
  return (
    <Svg label="Guli bergerak ke kiri, masuk rumah, ke barisan Aisyah">
      <CongkakBoard empty={['190-110']} />
      <path d={SOW_PATH} fill="none" stroke={INK} strokeWidth="2" strokeDasharray="5 5" markerEnd="url(#tut-head)" opacity="0.7" />
      <circle r="5" fill={GLOW} stroke={INK} strokeWidth="1.5">
        <animateMotion dur="3.2s" repeatCount="indefinite" path={SOW_PATH} />
      </circle>
    </Svg>
  )
}

export function CongkakLast() {
  return (
    <Svg label="Guli terakhir masuk rumah: main lagi">
      <CongkakBoard quiet />
      <path d={`M100 ${BOTTOM} L70 ${BOTTOM} C52 ${BOTTOM} 44 104 42 96`} fill="none" stroke={INK} strokeWidth="2" strokeDasharray="5 5" markerEnd="url(#tut-head)" />
      <Bubble x={56} y={20} w={70}>
        Main lagi!
      </Bubble>
      <path d={`M160 ${TOP - 30} q20 -10 30 10`} fill="none" stroke={INK} strokeWidth="2" markerEnd="url(#tut-head)" />
      <Glow cx={190} cy={TOP} />
      <Bubble x={226} y={20} w={110}>
        Lubang berisi: kaut!
      </Bubble>
    </Svg>
  )
}

export function CongkakShoot() {
  return (
    <Svg label="Tembak: ambil guli lubang bertentangan">
      <CongkakBoard quiet empty={['130-110']} full={['130-70']} />
      <Glow cx={130} cy={BOTTOM} />
      <Glow cx={130} cy={TOP} />
      <path d={`M130 ${TOP + 12} L130 ${BOTTOM - 13}`} stroke={INK} strokeWidth="2" markerEnd="url(#tut-head)" />
      <path d={`M118 ${BOTTOM + 4} Q70 128 50 108`} fill="none" stroke={INK} strokeWidth="2" strokeDasharray="5 4" markerEnd="url(#tut-head)" />
      <Bubble x={200} y={20} w={70} fill="#c0412f">
        Tembak!
      </Bubble>
    </Svg>
  )
}

/* ---------------------------------------------------------------------- dam */

const D0X = 62
const D0Y = 18
const SQ = 18
const at = (r, c) => [D0X + c * SQ + SQ / 2, D0Y + r * SQ + SQ / 2]

function DamBoard({ pieces = 'full', children }) {
  const squares = []
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      squares.push(<rect key={`${r}${c}`} x={D0X + c * SQ} y={D0Y + r * SQ} width={SQ} height={SQ} fill={(r + c) % 2 ? '#6b4426' : '#e9d3a6'} />)
  const men = []
  if (pieces === 'full') {
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) {
        if ((r + c) % 2 === 0 || (r > 2 && r < 5)) continue
        const [x, y] = at(r, c)
        men.push(<Man key={`${r}${c}`} x={x} y={y} blue={r > 4} />)
      }
  }
  return (
    <>
      <rect x={D0X - 4} y={D0Y - 4} width={SQ * 8 + 8} height={SQ * 8 + 8} rx="4" fill="#4a2c16" />
      {squares}
      {men}
      {pieces === 'full' && (
        <>
          <Label x={D0X - 12} y={D0Y + 30} anchor="end">
            Pak Tam
          </Label>
          <Label x={D0X - 12} y={D0Y + 128} anchor="end">
            Kamu
          </Label>
        </>
      )}
      {children}
    </>
  )
}

function Man({ x, y, blue, king = false }) {
  return (
    <g>
      <circle cx={x} cy={y} r="7" fill={blue ? '#3d7fd1' : '#c8473a'} stroke="#fff" strokeWidth="1.5" />
      {king && (
        <text x={x} y={y + 4} fontSize="10" textAnchor="middle">
          👑
        </text>
      )}
    </g>
  )
}

function Dot({ r, c }) {
  const [x, y] = at(r, c)
  return <circle cx={x} cy={y} r="5" fill={GLOW} className="tut-glow" />
}

export function DamGoal() {
  return (
    <Svg label="Papan dam">
      <DamBoard />
    </Svg>
  )
}

export function DamMove() {
  const [sx, sy] = at(5, 2)
  const [tx, ty] = at(4, 3)
  return (
    <Svg label="Pilih buah, kemudian tekan bulatan kuning">
      <DamBoard pieces="few">
        <Man {...{ x: at(2, 5)[0], y: at(2, 5)[1] }} />
        <Man x={at(6, 5)[0]} y={at(6, 5)[1]} blue />
        <circle cx={sx} cy={sy} r="10" fill="none" stroke={GLOW} strokeWidth="3" className="tut-glow" />
        <Man x={sx} y={sy} blue />
        <Dot r={4} c={1} />
        <Dot r={4} c={3} />
        <Tap x={tx} y={ty} />
      </DamBoard>
      <Label x={218} y={70} anchor="start" size={11}>
        1. Tekan buah biru
      </Label>
      <Label x={218} y={92} anchor="start" size={11}>
        2. Tekan bulatan
      </Label>
      <Label x={218} y={106} anchor="start" size={11}>
        kuning
      </Label>
    </Svg>
  )
}

export function DamCapture() {
  const [sx, sy] = at(5, 2)
  const [ex, ey] = at(4, 3)
  return (
    <Svg label="Makan: lompat atas buah lawan">
      <DamBoard pieces="few">
        <g>
          <Man x={ex} y={ey} />
          <animate attributeName="opacity" values="1;1;0;0" keyTimes="0;0.45;0.55;1" dur="2.4s" repeatCount="indefinite" />
        </g>
        <Dot r={3} c={4} />
        <g>
          <Man x={sx} y={sy} blue />
          <animateMotion dur="2.4s" repeatCount="indefinite" keyPoints="0;0;1;1" keyTimes="0;0.15;0.5;1" calcMode="linear" path="M0 0 Q14 -34 36 -36" />
        </g>
      </DamBoard>
      <Bubble x={264} y={70} w={84} fill="#c0412f">
        Wajib makan!
      </Bubble>
    </Svg>
  )
}

export function DamKing() {
  const [x, y] = at(0, 3)
  return (
    <Svg label="Sampai hujung jadi haji">
      <DamBoard pieces="few">
        {[
          [-1, -1],
          [-1, 1],
          [1, -1],
          [1, 1],
        ].map(([dr, dc]) =>
          dr < 0 ? null : (
            <path key={`${dr}${dc}`} d={`M${x} ${y} l${dc * 28} ${dr * 28}`} stroke={INK} strokeWidth="2.5" markerEnd="url(#tut-head)" />
          ),
        )}
        <circle cx={x} cy={y} r="11" fill="none" stroke={GLOW} strokeWidth="3" className="tut-glow" />
        <Man x={x} y={y} blue king />
        <Man x={at(3, 4)[0]} y={at(3, 4)[1]} />
      </DamBoard>
      <Bubble x={264} y={50} w={74}>
        Naik haji!
      </Bubble>
      <Label x={264} y={80} size={11}>
        Gerak &amp; makan
      </Label>
      <Label x={264} y={95} size={11}>
        depan dan
      </Label>
      <Label x={264} y={110} size={11}>
        belakang
      </Label>
    </Svg>
  )
}

/* ---------------------------------------------------------------- sepak raga */

const RAGA_POS = [
  [160, 150],
  [48, 109],
  [90, 42],
  [230, 42],
  [272, 109],
]

function Padang({ children, you = true }) {
  return (
    <>
      <ellipse cx="160" cy="92" rx="120" ry="62" fill="#79a85a" stroke="#fff" strokeWidth="2.5" />
      <ellipse cx="160" cy="92" rx="38" ry="19" fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="5 4" />
      {RAGA_POS.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="13" fill={i === 0 && you ? '#f2b33d' : '#4f7fae'} stroke="#fff" strokeWidth="2" />
          <Label x={x} y={y + 4} fill="#fff" size={12}>
            {i + 1}
          </Label>
        </g>
      ))}
      {you && (
        <Label x={184} y={166} anchor="start">
          Kamu
        </Label>
      )}
      {children}
    </>
  )
}

function RagaBallMark({ path, dur = '1.6s' }) {
  return (
    <circle r="6" fill="#d9a85b" stroke="#7a4a1e" strokeWidth="1.5">
      <animateMotion dur={dur} repeatCount="indefinite" path={path} />
    </circle>
  )
}

export function RagaGoal() {
  const path = 'M90 34 Q160 -20 230 34 Q160 -20 90 34'
  return (
    <Svg label="Pasukan kawal bola" bg="#b9d39a">
      <Padang />
      <RagaBallMark path={path} dur="2.4s" />
      <Bubble x={160} y={100} w={60}>
        +1 mata
      </Bubble>
    </Svg>
  )
}

export function RagaServe() {
  return (
    <Svg label="Lambung kepada pemain 3, 4 atau 5" bg="#b9d39a">
      <Padang>
        {[2, 3, 4].map((t) => {
          const [x, y] = RAGA_POS[t]
          return <path key={t} d={`M160 136 Q${(160 + x) / 2} ${(136 + y) / 2 - 20} ${x} ${y + 15}`} fill="none" stroke="#fff" strokeWidth="2.5" strokeDasharray="6 4" markerEnd="url(#tut-head-w)" />
        })}
        <Bubble x={160} y={16} w={100}>
          Lambung 3, 4, 5
        </Bubble>
      </Padang>
    </Svg>
  )
}

/** The timing ring used by Sepak Raga and Teng-Teng, with the buttons beside it. */
function RingArt({ buttons, label, pulses = false }) {
  return (
    <Svg label={label} bg="#b9d39a">
      <circle cx="88" cy="90" r="70" fill="#79a85a" />
      <circle cx="88" cy="90" r="9" fill="#d9a85b" stroke="#7a4a1e" strokeWidth="1.5" />
      <circle cx="88" cy="90" r="26" fill="none" stroke="#fff" strokeWidth="5" />
      <circle cx="88" cy="90" r="60" fill="none" strokeWidth="5" stroke={GLOW}>
        <animate attributeName="r" values="60;26;60" dur="1.8s" repeatCount="indefinite" />
        <animate attributeName="stroke" values={`${GLOW};${GO};${GLOW}`} keyTimes="0;0.4;0.6" calcMode="discrete" dur="1.8s" repeatCount="indefinite" />
      </circle>
      {pulses && (
        <Label x={88} y={174} size={10}>
          mengecil &amp; mengembang 3 kali
        </Label>
      )}
      <g>
        <Bubble x={240} y={24} w={112}>
          Tekan sekarang!
        </Bubble>
        <animate attributeName="opacity" values="0;1;0" keyTimes="0;0.4;0.6" calcMode="discrete" dur="1.8s" repeatCount="indefinite" />
      </g>
      {buttons.map((b, i) => (
        <Btn key={b.text} x={184} y={46 + i * 36} w={116} hot={b.hot}>
          {b.text}
        </Btn>
      ))}
    </Svg>
  )
}

export function RagaRing() {
  return <RingArt label="Tekan bila gelang jadi hijau" buttons={[{ text: 'Hantar ↖' }, { text: '⬆ Timang', hot: true }, { text: 'Hantar ↗' }]} />
}

export function RagaChoose() {
  return (
    <Svg label="Timang atau hantar" bg="#b9d39a">
      <Padang>
        <path d="M160 136 Q160 100 160 110" fill="none" />
        <path d="M150 140 Q120 90 96 58" fill="none" stroke="#fff" strokeWidth="2.5" strokeDasharray="6 4" markerEnd="url(#tut-head-w)" />
        <path d="M170 140 Q200 90 224 58" fill="none" stroke="#fff" strokeWidth="2.5" strokeDasharray="6 4" markerEnd="url(#tut-head-w)" />
        <circle cx="160" cy="118" r="6" fill="#d9a85b" stroke="#7a4a1e" strokeWidth="1.5">
          <animate attributeName="cy" values="132;104;132" dur="0.9s" repeatCount="indefinite" />
        </circle>
        <Label x={160} y={86} size={10} fill="#fff">
          seberang
        </Label>
      </Padang>
      <Bubble x={56} y={22} w={92} fill="#c0412f">
        Maks 3 sentuhan
      </Bubble>
    </Svg>
  )
}

export function RagaEnd() {
  return (
    <Svg label="Bola jatuh: mati" bg="#b9d39a">
      <rect x="20" y="20" width="280" height="34" rx="17" fill={CREAM} />
      <Label x={160} y={42} size={12}>
        Pusingan 1/3 · Lambungan 1/3 · ⏱ 1:30
      </Label>
      <ellipse cx="110" cy="140" rx="34" ry="8" fill="#5f8a44" />
      <circle cx="110" cy="128" r="10" fill="#d9a85b" stroke="#7a4a1e" strokeWidth="1.5">
        <animate attributeName="cy" values="70;130;124;130" keyTimes="0;0.5;0.65;1" dur="1.6s" repeatCount="indefinite" />
      </circle>
      <Label x={110} y={100} size={22} fill="#c0412f">
        ✕
      </Label>
      <Bubble x={110} y={166} w={84} fill="#c0412f">
        Bola mati
      </Bubble>
      <Label x={230} y={96} size={12}>
        Mata paling
      </Label>
      <Label x={230} y={112} size={12}>
        banyak menang
      </Label>
      <Label x={230} y={138} size={24}>
        🏆
      </Label>
    </Svg>
  )
}

/* --------------------------------------------------------------- teng-teng */

const CELLS = [
  { n: 1, x: 40, y: 74, h: 32 },
  { n: 2, x: 72, y: 74, h: 32 },
  { n: 3, x: 104, y: 74, h: 32 },
  { n: 4, x: 136, y: 58, h: 32 },
  { n: 5, x: 136, y: 90, h: 32 },
  { n: 6, x: 168, y: 74, h: 32 },
  { n: 7, x: 200, y: 58, h: 32 },
  { n: 8, x: 200, y: 90, h: 32 },
]
const centre = (n) => {
  if (n === 9) return [252, 90]
  const c = CELLS[n - 1]
  return [c.x + 16, c.y + c.h / 2]
}

function Court({ glow = [], children, numbers = true }) {
  return (
    <>
      <line x1="30" y1="40" x2="30" y2="140" stroke="#fff" strokeWidth="3" strokeDasharray="6 4" />
      {CELLS.map((c) => (
        <rect key={c.n} x={c.x} y={c.y} width="32" height={c.h} fill={glow.includes(c.n) ? 'rgba(255,212,94,0.75)' : 'none'} stroke="#fff" strokeWidth="2.5" className={glow.includes(c.n) ? 'tut-glow' : undefined} />
      ))}
      <path d="M232 58 H254 A32 32 0 0 1 254 122 H232 Z" fill={glow.includes(9) ? 'rgba(255,212,94,0.75)' : 'none'} stroke="#fff" strokeWidth="2.5" />
      {numbers &&
        [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => {
          const [x, y] = centre(n)
          return (
            <Label key={n} x={x} y={y + 4} fill="rgba(255,255,255,0.85)" size={12}>
              {n}
            </Label>
          )
        })}
      {children}
    </>
  )
}

function Kid({ x = 16, y = 90, head = false }) {
  return (
    <g>
      <circle cx={x} cy={y - 14} r="6" fill="#e0aa78" />
      <path d={`M${x - 6} ${y - 7} h12 v14 h-12 z`} fill="#f2c95a" />
      <path d={`M${x - 5} ${y + 7} v10 M${x + 5} ${y + 7} v10`} stroke="#4fb6b0" strokeWidth="3" />
      {head && <circle cx={x} cy={y - 23} r="4" fill="#c46a3a" stroke="#fff" strokeWidth="1" />}
    </g>
  )
}

function Gundu({ n, dx = 8, dy = 8 }) {
  const [x, y] = centre(n)
  return <circle cx={x + dx} cy={y + dy} r="4" fill="#c46a3a" stroke="#fff" strokeWidth="1" />
}

const SAND = '#d9bf93'

export function TengGoal() {
  const [hx, hy] = centre(6)
  const [rx, ry] = centre(2)
  return (
    <Svg label="Gelanggang teng-teng" bg={SAND}>
      <Court>
        <Kid />
        <text x={hx} y={hy - 2} fontSize="16" textAnchor="middle">
          🏠
        </text>
        <Label x={hx} y={44} size={10}>
          Rumah kamu
        </Label>
        <text x={rx} y={ry - 2} fontSize="16" textAnchor="middle" opacity="0.8">
          🏡
        </text>
        <Label x={rx} y={148} size={10}>
          Rumah Rukiah
        </Label>
      </Court>
    </Svg>
  )
}

export function TengThrow() {
  const x1 = centre(1)[0]
  const x9 = centre(9)[0]
  return (
    <Svg label="Tahan untuk baling, lepas di petak sasaran" bg={SAND}>
      <Court glow={[3]}>
        <Kid />
        <Label x={centre(3)[0]} y={58} size={10}>
          sasaran
        </Label>
        <g>
          <path d="M-7 0 h14 l-7 12 z" fill="#c0412f" transform="translate(0 26)" />
          <animateTransform attributeName="transform" type="translate" values={`${x1} 0;${x9} 0;${x1} 0`} dur="3s" repeatCount="indefinite" />
        </g>
      </Court>
      <rect x="40" y="150" width="226" height="12" rx="6" fill="rgba(59,36,20,0.25)" />
      <rect x="40" y="150" width="226" height="12" rx="6" fill={GO}>
        <animate attributeName="width" values="12;226;12" dur="3s" repeatCount="indefinite" />
      </rect>
      <Label x={290} y={160} size={10}>
        kuasa
      </Label>
    </Svg>
  )
}

export function TengFeet() {
  const foot = (n, icon) => {
    const [x, y] = centre(n)
    return (
      <text key={n} x={x} y={y + 6} fontSize="15" textAnchor="middle">
        {icon}
      </text>
    )
  }
  return (
    <Svg label="Kaki mana untuk setiap petak" bg={SAND}>
      <Court numbers={false}>
        {foot(1, '🦶')}
        {foot(3, '🦶')}
        {foot(6, '🦶')}
        <text x={152} y={96} fontSize="15" textAnchor="middle">
          👣
        </text>
        <text x={216} y={96} fontSize="15" textAnchor="middle">
          👣
        </text>
        {foot(9, '👣')}
        <Gundu n={2} dx={0} dy={0} />
        <Label x={centre(2)[0]} y={68} size={14}>
          ⤴
        </Label>
      </Court>
    </Svg>
  )
}

export function TengRing() {
  return <RingArt label="Pilih kaki, tekan bila hijau" pulses buttons={[{ text: '🦶 Sebelah kaki', hot: true }, { text: '👣 Dua kaki' }, { text: '⤴ Langkau' }]} />
}

export function TengBack() {
  const [gx, gy] = centre(2)
  return (
    <Svg label="Balik dan ambil gundu" bg={SAND}>
      <Court>
        <Gundu n={2} dx={0} dy={8} />
        <path d="M268 132 Q160 160 92 132" fill="none" stroke={INK} strokeWidth="2" strokeDasharray="5 4" markerEnd="url(#tut-head)" />
        <Kid x={gx + 32} y={gy + 2} />
        <text x={gx} y={gy - 18} fontSize="16" textAnchor="middle">
          🤲
        </text>
      </Court>
      <Btn x={176} y={14} w={124} hot>
        🤲 Ambil gundu
      </Btn>
      <Label x={20} y={30} anchor="start" size={10.5}>
        Berhenti sebelum gundu
      </Label>
    </Svg>
  )
}

export function TengTimbang() {
  return (
    <Svg label="Timbang: jaga imbangan" bg={SAND}>
      <g transform="translate(70 110) scale(2.6) translate(-16 -90)">
        <g>
          <Kid head />
          <animateTransform attributeName="transform" type="rotate" values="-8 16 107;8 16 107;-8 16 107" dur="2.4s" repeatCount="indefinite" />
        </g>
      </g>
      <rect x="150" y="40" width="150" height="14" rx="7" fill={CREAM} stroke="#c9b48c" strokeWidth="2" />
      <rect x="205" y="40" width="40" height="14" fill="rgba(76,207,90,0.6)" />
      <rect x="222" y="34" width="6" height="26" rx="3" fill={INK}>
        <animate attributeName="x" values="190;254;190" dur="2.4s" repeatCount="indefinite" />
      </rect>
      <Btn x={150} y={72} w={70}>
        ◀ Kiri
      </Btn>
      <Btn x={230} y={72} w={70}>
        Kanan ▶
      </Btn>
      <Btn x={170} y={118} w={110} hot>
        🙌 Sambut
      </Btn>
      <Label x={225} y={168} size={10}>
        Akhir sekali: sambut gundu
      </Label>
    </Svg>
  )
}

export function TengHouse() {
  const [hx, hy] = centre(7)
  return (
    <Svg label="Baling tanpa lihat, dapat rumah" bg={SAND}>
      <Court>
        <Kid />
        <text x={16} y={60} fontSize="16" textAnchor="middle">
          🙈
        </text>
        <path d={`M24 70 Q120 0 ${hx} ${hy - 6}`} fill="none" stroke={INK} strokeWidth="2" strokeDasharray="5 4" markerEnd="url(#tut-head)" />
        <text x={hx} y={hy + 6} fontSize="18" textAnchor="middle" className="tut-pop">
          🏠
        </text>
      </Court>
      <Bubble x={250} y={160} w={110}>
        Rumah baru kamu!
      </Bubble>
    </Svg>
  )
}
