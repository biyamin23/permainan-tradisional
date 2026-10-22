import { useEffect, useRef, useState } from 'react'
import { sfx } from '../../audio/engine'
import { GENDERS, usePlayerState } from '../../state/playerState'
import './gameShell.css'

/**
 * The screen every table game shares (Congkak, Dam…): players' cards at the
 * top, the board in the middle, a big message for what just happened, and at
 * the bottom what to do next plus the buttons. A game passes its own board,
 * background class and words.
 */

// the player's avatar and sleeve colour follow the character they made
const PLAYER_IMG = { [GENDERS.LELAKI]: '/avatars/pemain-lelaki.webp', [GENDERS.PEREMPUAN]: '/avatars/pemain-perempuan.webp' }
const PLAYER_COLOR = { [GENDERS.LELAKI]: '#2f4fb5', [GENDERS.PEREMPUAN]: '#e98fae' }

export function usePlayerLook() {
  const name = usePlayerState((s) => s.playerName) || 'Kamu'
  const gender = usePlayerState((s) => s.playerGender)
  return {
    name,
    img: PLAYER_IMG[gender] ?? PLAYER_IMG[GENDERS.LELAKI],
    color: PLAYER_COLOR[gender] ?? PLAYER_COLOR[GENDERS.LELAKI],
  }
}

/**
 * Big message over the board: whose turn it now is, then anything the game
 * shouts about (`banner` = { text, tone, key }).
 */
export function useTurnToast({ yourTurn, finished, banner, theirName }) {
  const [toast, setToast] = useState(null)
  useEffect(() => {
    if (finished) return
    setToast({
      text: yourTurn ? 'Giliran kamu!' : `Giliran ${theirName}!`,
      tone: yourTurn ? 'you' : 'them',
      key: `turn-${Math.random()}`,
    })
  }, [yourTurn, finished, theirName])
  useEffect(() => {
    if (banner) setToast({ text: banner.text, tone: banner.tone, key: banner.key })
  }, [banner])
  return toast
}

export function Scene({ className = '', top, them, you, toast, board, bottom, children }) {
  return (
    <div className={`gs ${className}`}>
      <div className="gs-hud">
        {them}
        {you}
      </div>
      <div className="gs-table" />
      <div className="gs-board-wrap">
        <div className="gs-toast-slot" aria-live="polite">
          {toast && (
            <p className={`gs-toast ${toast.tone ? `is-${toast.tone}` : ''} ${toast.text.length > 22 ? 'is-long' : ''}`} key={toast.key}>
              {toast.text}
            </p>
          )}
        </div>
        {board}
      </div>
      {/* everything you press sits at the bottom, within reach of your thumb */}
      <div className="gs-dock">
        <div className="gs-bottom">{bottom}</div>
        <div className="gs-top">{top}</div>
      </div>
      {children}
    </div>
  )
}

/** A player's card: picture, name, whose turn (green light) and the score. */
export function PlayerCard({ side, name, color, img, score, unit = 'mata', active, children }) {
  return (
    <div
      className={`gs-card gs-card--${side} ${active ? 'is-active' : ''}`}
      aria-label={`${name}, ${score} ${unit}${active ? ', sedang bermain' : ''}`}
    >
      <span className="gs-avatar" style={{ '--c': color }} aria-hidden="true">
        {img ? <img src={img} alt="" width="96" height="96" decoding="async" /> : name.slice(0, 1).toUpperCase()}
      </span>
      <span className="gs-card__text" aria-hidden="true">
        <span className="gs-card__name">{name}</span>
        <span className="gs-card__row">
          <span className={`gs-dot ${active ? 'is-on' : ''}`} />
          <span className="gs-card__score">{score}</span>
        </span>
      </span>
      {children}
    </div>
  )
}

/** What the opponent says, in a bubble hanging from their card. */
export function Speech({ says }) {
  if (!says) return null
  return (
    <p className="gs-speech" key={says.key} role="status">
      {says.text}
    </p>
  )
}

/** What to do next, always at the bottom. */
export function NextHint({ next, yours }) {
  if (!next) return null
  return (
    <p className={`gs-next ${yours ? 'is-yours' : ''}`}>
      <span className="gs-next__icon" aria-hidden="true">
        {next.icon}
      </span>
      {next.text}
    </p>
  )
}

export function ExitButton({ onExit }) {
  return (
    <button type="button" className="gs-pill" onClick={onExit}>
      <span className="gs-pill__chev" aria-hidden="true">
        ‹
      </span>{' '}
      Keluar
    </button>
  )
}

export function RulesButton({ onOpen }) {
  return (
    <button type="button" className="gs-pill" onClick={onOpen}>
      <span className="gs-pill__q" aria-hidden="true">
        ?
      </span>{' '}
      Cara main
    </button>
  )
}

export function RulesSheet({ game, rules, onClose }) {
  return (
    <div className="gs-sheet" role="dialog" aria-label={`Cara main ${game}`}>
      <div className="gs-panel gs-panel--rules">
        <h3 className="gs-panel__title">Cara main</h3>
        <ol className="gs-rules">
          {rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ol>
        <button type="button" className="gs-btn gs-btn--go" onClick={onClose}>
          Faham
        </button>
      </div>
    </div>
  )
}

/** Hold-to-speed-up button: only fast while it's pressed (finger, mouse, Space/Enter). */
export function HoldFast({ fast, setFast, active }) {
  const on = () => setFast(true)
  const off = () => setFast(false)
  useEffect(() => {
    window.addEventListener('blur', off)
    return () => window.removeEventListener('blur', off)
  })
  return (
    <button
      type="button"
      className={`gs-pill gs-pill--fast gs-hold ${fast ? 'is-on' : ''} ${active ? '' : 'is-idle'}`}
      aria-pressed={fast}
      aria-label="Tekan dan tahan untuk laju 2 kali"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId)
        on()
      }}
      onPointerUp={off}
      onPointerCancel={off}
      onLostPointerCapture={off}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault()
          on()
        }
      }}
      onKeyUp={off}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span aria-hidden="true">⏩</span> {fast ? 'Laju 2×' : 'Tahan: 2×'}
    </button>
  )
}

/** Opening panel: the invitation, level choice and the start button. */
export function IntroPanel({ title, opponent, levels, level, setLevel, recordsLine, onStart }) {
  const current = levels.find((l) => l.id === level)
  return (
    <div className="gs-sheet">
      <div className="gs-panel">
        <h2 className="gs-panel__title">{title}</h2>
        <p className="gs-panel__label">Pilih tahap {opponent}</p>
        <div className="gs-levels" role="radiogroup" aria-label={`Tahap ${opponent}`}>
          {levels.map((l) => (
            <button
              key={l.id}
              type="button"
              role="radio"
              aria-checked={level === l.id}
              className={`gs-level ${level === l.id ? 'is-selected' : ''}`}
              onClick={() => {
                sfx.tap()
                setLevel(l.id)
              }}
            >
              {l.label}
            </button>
          ))}
        </div>
        <p className="gs-panel__note">{current?.note}</p>
        {recordsLine && <p className="gs-panel__small">{recordsLine}</p>}
        <button type="button" className="gs-btn gs-btn--go" onClick={onStart}>
          Mula main
        </button>
      </div>
    </div>
  )
}

/** End of a match: who won, the final count, play again or go back. */
export function ResultPanel({ title, win, mine, theirs, myName, theirName, line, extra, onAgain, onExit }) {
  return (
    <div className="gs-sheet" role="alertdialog" aria-live="assertive">
      <div className="gs-panel">
        <h2 className={`gs-panel__title gs-panel__title--big ${win ? 'is-win' : ''}`}>{title}</h2>
        <div className="gs-final">
          <span className="gs-final__side">
            <span className="gs-final__num">{mine}</span>
            {myName}
          </span>
          <span className="gs-final__vs">lawan</span>
          <span className="gs-final__side">
            <span className="gs-final__num">{theirs}</span>
            {theirName}
          </span>
        </div>
        <p className="gs-panel__note">{line}</p>
        {extra && <p className="gs-panel__small">{extra}</p>}
        <button type="button" className="gs-btn gs-btn--go" onClick={onAgain}>
          Main lagi
        </button>
        <button type="button" className="gs-btn gs-btn--plain" onClick={onExit}>
          Balik ke kampung
        </button>
      </div>
    </div>
  )
}

/** "Menang 3, kalah 2 · …" summary line for the opening panel. */
export function recordsSummary(records, bestLabel) {
  const played = records.wins + records.losses + records.draws
  if (played === 0) return null
  return `Menang ${records.wins}, kalah ${records.losses}${records.draws ? `, seri ${records.draws}` : ''}${bestLabel ? ` · ${bestLabel}` : ''}`
}

// ---------------------------------------------------------------- osom
// Kampung rock-paper-scissors: batu, air, burung.
// Batu menang burung (hempap), burung menang air (minum), air menang batu (tenggelam).
const OSOM = [
  { id: 'batu', label: 'Batu', icon: '🪨', beats: 'burung' },
  { id: 'air', label: 'Air', icon: '💧', beats: 'batu' },
  { id: 'burung', label: 'Burung', icon: '🐦', beats: 'air' },
]
const osomById = (id) => OSOM.find((o) => o.id === id)
const WHY_WIN = {
  batu: 'Batu hempap burung.',
  air: 'Batu tenggelam dalam air.',
  burung: 'Burung minum air.',
}

/**
 * Osom before every match decides who starts. `onDone(0)` when you start,
 * `onDone(1)` when the opponent does.
 */
export function OsomPanel({ opponent, onDone }) {
  const [stage, setStage] = useState('choose') // choose | shake | reveal
  const [mine, setMine] = useState(null)
  const [theirs, setTheirs] = useState(null)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  const pick = (id) => {
    if (stage !== 'choose') return
    sfx.tap()
    setMine(id)
    setTheirs(OSOM[Math.floor(Math.random() * OSOM.length)].id)
    setStage('shake')
    timer.current = setTimeout(() => {
      setStage('reveal')
      sfx.pop()
    }, 1100)
  }

  const draw = stage === 'reveal' && mine === theirs
  const youWin = stage === 'reveal' && !draw && osomById(mine).beats === theirs
  const winnerPick = youWin ? mine : theirs

  const again = () => {
    sfx.tap()
    setMine(null)
    setTheirs(null)
    setStage('choose')
  }

  return (
    <div className="gs-sheet" role="dialog" aria-label="Osom untuk tentukan siapa mula">
      <div className="gs-panel gs-osom">
        <h2 className="gs-panel__title">{stage === 'choose' ? 'Osom! Siapa mula dulu?' : stage === 'shake' ? 'O… som!' : draw ? 'Seri!' : youWin ? 'Kamu menang osom!' : `${opponent} menang osom.`}</h2>

        {stage === 'choose' && (
          <>
            <p className="gs-panel__label">Pilih satu</p>
            <div className="gs-osom__picks">
              {OSOM.map((o) => (
                <button key={o.id} type="button" className="gs-osom__pick" onClick={() => pick(o.id)}>
                  <span className="gs-osom__icon" aria-hidden="true">
                    {o.icon}
                  </span>
                  {o.label}
                </button>
              ))}
            </div>
            <p className="gs-osom__rules">Batu menang burung · Burung menang air · Air menang batu</p>
          </>
        )}

        {stage !== 'choose' && (
          <div className={`gs-osom__duel ${stage === 'shake' ? 'is-shaking' : ''}`}>
            <span className="gs-osom__hand">
              <span className="gs-osom__icon" aria-hidden="true">
                {stage === 'shake' ? '✊' : osomById(mine).icon}
              </span>
              <span className="gs-osom__who">Kamu{stage === 'reveal' ? ` · ${osomById(mine).label}` : ''}</span>
            </span>
            <span className="gs-osom__vs">lawan</span>
            <span className="gs-osom__hand">
              <span className="gs-osom__icon" aria-hidden="true">
                {stage === 'shake' ? '✊' : osomById(theirs).icon}
              </span>
              <span className="gs-osom__who">
                {opponent}
                {stage === 'reveal' ? ` · ${osomById(theirs).label}` : ''}
              </span>
            </span>
          </div>
        )}

        {stage === 'reveal' && (
          <>
            <p className="gs-panel__note">
              {draw ? 'Sama pilihan. Osom sekali lagi!' : `${WHY_WIN[winnerPick]} ${youWin ? 'Kamu mula dulu.' : `${opponent} mula dulu.`}`}
            </p>
            {draw ? (
              <button type="button" className="gs-btn gs-btn--go" onClick={again}>
                Osom lagi
              </button>
            ) : (
              <button
                type="button"
                className="gs-btn gs-btn--go"
                onClick={() => {
                  sfx.select()
                  onDone(youWin ? 0 : 1)
                }}
              >
                Jom mula!
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
