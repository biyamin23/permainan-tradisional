/**
 * Hand-drawn style SVG icons for each traditional game, built in code
 * (no image assets). Unknown ids fall back to a simple star.
 */
const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 3,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

const ICONS = {
  congkak: (
    <>
      <path d="M10 30 Q10 22 18 22 H62 Q70 22 70 30 V36 Q70 44 62 44 H18 Q10 44 10 36 Z" {...stroke} />
      <circle cx="16" cy="33" r="4" fill="currentColor" />
      <circle cx="64" cy="33" r="4" fill="currentColor" />
      {[26, 33, 40, 47, 54].map((x) => (
        <g key={x}>
          <circle cx={x} cy="29" r="2.4" fill="currentColor" opacity="0.75" />
          <circle cx={x} cy="37" r="2.4" fill="currentColor" opacity="0.75" />
        </g>
      ))}
    </>
  ),
  gasing: (
    <>
      <path d="M40 14 V22" {...stroke} />
      <path d="M22 30 Q22 22 40 22 Q58 22 58 30 Q58 38 40 58 Q22 38 22 30 Z" {...stroke} />
      <path d="M24 31 H56" {...stroke} />
      <path d="M14 62 Q40 70 66 62" {...stroke} strokeDasharray="4 5" />
    </>
  ),
  wau: (
    <>
      <path
        d="M40 10 L46 20 L66 26 L50 32 L44 36 L52 44 L64 42 L58 54 L40 60 L22 54 L16 42 L28 44 L36 36 L30 32 L14 26 L34 20 Z"
        {...stroke}
      />
      <path d="M40 10 V60 M18 26 Q40 20 62 26" {...stroke} strokeWidth="2" />
      <path d="M40 60 Q36 66 42 72" {...stroke} strokeWidth="2" />
    </>
  ),
  'batu-seremban': (
    <>
      <path d="M16 50 L22 40 L28 50 Z M34 54 L40 44 L46 54 Z M52 50 L58 40 L64 50 Z" {...stroke} />
      <path d="M36 26 L40 18 L44 26 Z M22 22 L26 16 L30 22 Z" {...stroke} />
      <path d="M40 36 Q40 30 40 30" {...stroke} strokeDasharray="2 4" />
    </>
  ),
  'sepak-raga': (
    <>
      <circle cx="40" cy="38" r="20" {...stroke} />
      <path d="M22 30 Q40 44 58 30 M22 46 Q40 32 58 46 M32 19 Q28 38 32 57 M48 19 Q52 38 48 57" {...stroke} strokeWidth="2" />
    </>
  ),
  guli: (
    <>
      <circle cx="40" cy="40" r="22" {...stroke} strokeDasharray="5 5" />
      <circle cx="34" cy="36" r="6" {...stroke} />
      <circle cx="47" cy="44" r="6" {...stroke} />
      <path d="M31 34 Q34 38 37 34 M44 42 Q47 46 50 42" {...stroke} strokeWidth="2" />
    </>
  ),
  'galah-panjang': (
    <>
      <path d="M14 18 H66 V62 H14 Z M14 40 H66 M40 18 V62 M14 29 H66 M14 51 H66" {...stroke} strokeWidth="2.5" />
      <circle cx="27" cy="34" r="3.5" fill="currentColor" />
      <circle cx="53" cy="46" r="3.5" fill="currentColor" />
    </>
  ),
  'konda-kondi': (
    <>
      <path d="M14 58 L58 30" {...stroke} strokeWidth="5" />
      <path d="M46 20 L62 14" {...stroke} strokeWidth="5" />
      <path d="M12 64 Q24 54 36 62" {...stroke} strokeWidth="2" />
    </>
  ),
  'ting-ting': (
    <>
      <path d="M32 62 H48 V50 H32 Z M32 50 H48 V38 H32 Z M24 38 H40 V26 H24 Z M40 38 H56 V26 H40 Z M32 26 H48 V16 H32 Z" {...stroke} strokeWidth="2.5" />
      <circle cx="40" cy="44" r="2.5" fill="currentColor" />
    </>
  ),
  'tarik-upih': (
    <>
      <path d="M14 54 Q20 34 40 32 Q58 30 66 46 Q56 60 34 60 Q20 60 14 54 Z" {...stroke} />
      <path d="M22 50 Q40 42 60 46" {...stroke} strokeWidth="2" />
      <path d="M66 46 L72 34" {...stroke} />
      <circle cx="36" cy="26" r="5" {...stroke} />
    </>
  ),
}

export function GameIcon({ id, size = 64 }) {
  return (
    <svg viewBox="0 0 80 80" width={size} height={size} aria-hidden="true" focusable="false">
      {ICONS[id] ?? <path d="M40 14 L46 32 H64 L50 42 L56 60 L40 49 L24 60 L30 42 L16 32 H34 Z" {...stroke} />}
    </svg>
  )
}
