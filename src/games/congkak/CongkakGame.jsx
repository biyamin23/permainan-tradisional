import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { sfx, voice } from '../../audio/engine'
import { GENDERS, usePlayerState } from '../../state/playerState'
import { CongkakBoard } from './CongkakBoard'
import { OPPONENT, PLAYER, createBoard } from './engine'
import { Hands } from './Hands'
import { loadRecords, saveResult } from './records'
import { useCongkakMatch } from './useCongkakMatch'
import { SABAR_URLS } from './voices'
import './congkak.css'

/**
 * Congkak at the wakaf: the board lies on a mengkuang mat, Aisyah sits across
 * from you. The same scene is used to choose a level, to play and to show the
 * result, so nothing pulls you out of the moment.
 */

const LEVELS = [
  { id: 'mudah', label: 'Mudah', note: 'Aisyah baru belajar main.' },
  { id: 'biasa', label: 'Biasa', note: 'Aisyah main bersungguh-sungguh.' },
  { id: 'pakar', label: 'Pakar', note: 'Aisyah juara congkak kampung ni.' },
]

const RULES = [
  'Setiap lubang kecil ada 7 biji. Rumah (lubang besar) bermula kosong. Rumah kamu di sebelah kiri kamu.',
  'Pilih satu lubang di barisan kamu. Agihkan biji satu demi satu ikut arah jam: ke kiri sepanjang barisan kamu, masuk rumah kamu, kemudian ke barisan Aisyah. Rumah Aisyah dilangkau.',
  'Biji terakhir masuk rumah kamu: main lagi.',
  'Biji terakhir jatuh dalam lubang yang berisi: kaut semua dan terus agihkan.',
  'Biji terakhir jatuh dalam lubang kosong di barisan kamu: tembak. Biji itu dan semua biji di lubang bertentangan masuk rumah kamu.',
  'Bila satu pihak tiada biji lagi, pihak satu lagi kutip baki di barisannya. Biji paling banyak dalam rumah menang.',
]

const START = createBoard()

/** Laju 2×: works only while held down (finger, mouse, or Space/Enter). */
function HoldFast({ fast, setFast, active }) {
  const on = () => setFast(true)
  const off = () => setFast(false)
  useEffect(() => {
    window.addEventListener('blur', off)
    return () => window.removeEventListener('blur', off)
  })
  return (
    <button
      type="button"
      className={`cg-pill cg-pill--fast cg-hold ${fast ? 'is-on' : ''} ${active ? '' : 'is-idle'}`}
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

/** A player's card in the top bar: who, whose turn, and the score in big type. */
function PlayerCard({ side, name, color, img, score, active, children }) {
  return (
    <div className={`cg-card cg-card--${side} ${active ? 'is-active' : ''}`} aria-label={`${name}, ${score} guli${active ? ', sedang bermain' : ''}`}>
      <span className="cg-avatar" style={{ '--c': color }} aria-hidden="true">
        {img ? <img src={img} alt="" width="96" height="96" decoding="async" /> : name.slice(0, 1).toUpperCase()}
      </span>
      <span className="cg-card__text" aria-hidden="true">
        <span className="cg-card__name">{name}</span>
        <span className="cg-card__row">
          <span className={`cg-dot ${active ? 'is-on' : ''}`} />
          <span className="cg-card__score">{score}</span>
        </span>
      </span>
      {children}
    </div>
  )
}

const AISYAH_COLOR = '#e9b52f'
const AISYAH_IMG = '/congkak/aisyah.webp'
const PLAYER_IMG = { [GENDERS.LELAKI]: '/congkak/pemain-lelaki.webp', [GENDERS.PEREMPUAN]: '/congkak/pemain-perempuan.webp' }

/**
 * One layout for every screen, top to bottom: exit, the two players (turn and
 * score), what just happened, the board, and what to do next.
 */
function Scene({ top, them, you, toast, board, bottom, children }) {
  return (
    <div className="cg">
      <div className="cg-hud">
        {them}
        {you}
      </div>
      <div className="cg-table" />
      <div className="cg-board-wrap">
        <div className="cg-toast-slot" aria-live="polite">
          {toast && (
            <p className={`cg-toast ${toast.tone ? `is-${toast.tone}` : ''}`} key={toast.key}>
              {toast.text}
            </p>
          )}
        </div>
        {board}
      </div>
      {/* everything you press sits at the bottom, within reach of your thumb */}
      <div className="cg-dock">
        <div className="cg-bottom">{bottom}</div>
        <div className="cg-top">{top}</div>
      </div>
      {children}
    </div>
  )
}

function Speech({ says }) {
  if (!says) return null
  return (
    <p className="cg-speech" key={says.key} role="status">
      {says.text}
    </p>
  )
}

function Rules({ onClose }) {
  return (
    <div className="cg-sheet" role="dialog" aria-label="Cara main congkak">
      <div className="cg-panel cg-panel--rules">
        <h3 className="cg-panel__title">Cara main</h3>
        <ol className="cg-rules">
          {RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ol>
        <button type="button" className="cg-btn cg-btn--go" onClick={onClose}>
          Faham
        </button>
      </div>
    </div>
  )
}

function ExitButton({ onExit }) {
  return (
    <button type="button" className="cg-pill" onClick={onExit}>
      <span className="cg-pill__chev" aria-hidden="true">‹</span> Keluar
    </button>
  )
}

function RulesButton({ onOpen }) {
  return (
    <button type="button" className="cg-pill" onClick={onOpen}>
      <span className="cg-pill__q" aria-hidden="true">?</span> Cara main
    </button>
  )
}

function Intro({ level, setLevel, records, playerName, playerColor, playerImg, onStart, onExit }) {
  const [showRules, setShowRules] = useState(false)
  const current = LEVELS.find((l) => l.id === level)
  const played = records.wins + records.losses + records.draws

  return (
    <Scene
      top={
        <>
          <ExitButton onExit={onExit} />
          <RulesButton onOpen={() => setShowRules(true)} />
        </>
      }
      them={<PlayerCard side="them" name="Aisyah" color={AISYAH_COLOR} img={AISYAH_IMG} score={0} />}
      you={<PlayerCard side="you" name={playerName} color={playerColor} img={playerImg} score={0} />}
      board={<CongkakBoard pits={START} />}
    >
      <div className="cg-sheet">
        <div className="cg-panel">
          <h2 className="cg-panel__title">Aisyah ajak kamu main congkak!</h2>
          <p className="cg-panel__label">Pilih tahap Aisyah</p>
          <div className="cg-levels" role="radiogroup" aria-label="Tahap Aisyah">
            {LEVELS.map((l) => (
              <button
                key={l.id}
                type="button"
                role="radio"
                aria-checked={level === l.id}
                className={`cg-level ${level === l.id ? 'is-selected' : ''}`}
                onClick={() => {
                  sfx.tap()
                  setLevel(l.id)
                }}
              >
                {l.label}
              </button>
            ))}
          </div>
          <p className="cg-panel__note">{current.note}</p>
          {played > 0 && (
            <p className="cg-panel__small">
              Menang {records.wins}, kalah {records.losses}
              {records.draws ? `, seri ${records.draws}` : ''} · skor terbaik {records.best} biji
            </p>
          )}
          <button type="button" className="cg-btn cg-btn--go" onClick={onStart}>
            Mula main
          </button>
        </div>
      </div>
      {showRules && <Rules onClose={() => setShowRules(false)} />}
    </Scene>
  )
}

function Result({ result, saved, playerName, onAgain, onExit }) {
  const [you, them] = result.scores
  const title = result.winner === PLAYER ? 'Kamu menang!' : result.winner === OPPONENT ? 'Aisyah menang!' : 'Seri!'
  const line =
    result.winner === PLAYER
      ? 'Aisyah tersenyum kelat. Dia nak lawan lagi.'
      : result.winner === OPPONENT
        ? 'Kalah menang adat bermain. Cuba sekali lagi.'
        : 'Sama kuat. Satu pusingan lagi?'
  return (
    <div className="cg-sheet" role="alertdialog" aria-live="assertive">
      <div className="cg-panel">
        <h2 className={`cg-panel__title cg-panel__title--big ${result.winner === PLAYER ? 'is-win' : ''}`}>{title}</h2>
        <div className="cg-final">
          <span className="cg-final__side">
            <span className="cg-final__num">{you}</span>
            {playerName}
          </span>
          <span className="cg-final__vs">lawan</span>
          <span className="cg-final__side">
            <span className="cg-final__num">{them}</span>
            Aisyah
          </span>
        </div>
        <p className="cg-panel__note">{line}</p>
        {saved?.newBest && <p className="cg-panel__small">Skor terbaik baharu: {you} biji!</p>}
        <button type="button" className="cg-btn cg-btn--go" onClick={onAgain}>
          Main lagi
        </button>
        <button type="button" className="cg-btn cg-btn--plain" onClick={onExit}>
          Balik ke kampung
        </button>
      </div>
    </div>
  )
}

// sleeves match the avatars: blue baju Melayu, pink baju kurung
const SLEEVES = { [GENDERS.LELAKI]: '#2f4fb5', [GENDERS.PEREMPUAN]: '#e98fae' }

function Match({ level, playerName, playerColor, playerImg, onExit, onRecords }) {
  const [starter, setStarter] = useState(PLAYER)
  const { pits, turn, animating, hand, flash, banner, speech, result, fast, setFast, playHouse, skip, restart, scores, say } =
    useCongkakMatch({ level, starter })
  const [saved, setSaved] = useState(null)
  const [hoverPit, setHoverPit] = useState(null)
  const [slap, setSlap] = useState(null)
  const [toast, setToast] = useState(null)
  const lastSlap = useRef(0)
  const boardRef = useRef(null)

  useEffect(() => voice.preload(SABAR_URLS), [])

  // what just happened, in big type over the board: whose turn it now is,
  // then anything worth shouting about (tembak, main lagi…)
  useEffect(() => {
    if (result) return
    setToast({ text: turn === PLAYER ? 'Giliran kamu!' : 'Giliran Aisyah!', tone: turn === PLAYER ? 'you' : 'them', key: `turn-${Math.random()}` })
  }, [turn, result])
  useEffect(() => {
    if (banner) setToast({ text: banner.text, tone: banner.tone, key: banner.key })
  }, [banner])

  /** Every tap on a hole: play it, or explain why not (with a tepis on Aisyah's turn). */
  const onPitTap = useCallback(
    (index, event) => {
      const outcome = playHouse(index)
      if (outcome === 'wait') {
        event?.stopPropagation()
        if (Date.now() - lastSlap.current > 900) {
          lastSlap.current = Date.now()
          setSlap({ pit: index, key: lastSlap.current })
          // she tells you off (recorded voice) right as her hand lands
          setTimeout(() => voice.playFromGroup('sabar', SABAR_URLS), 280)
        }
      } else if (outcome === 'theirs') {
        event?.stopPropagation()
        say('Itu lubang Aisyah. Pilih lubang di barisan bawah.', 'bad')
      } else if (outcome === 'empty') {
        say('Lubang tu kosong. Pilih yang ada guli.', 'bad')
      }
    },
    [playHouse, say],
  )

  useEffect(() => {
    if (!result) return
    const s = saveResult(result)
    setSaved(s)
    onRecords(s.records)
  }, [result, onRecords])

  const yourTurn = turn === PLAYER && !result
  // what to do next, always at the bottom of the screen
  const next = result
    ? null
    : yourTurn
      ? animating
        ? { icon: '👆', text: 'Ketik papan untuk langkau' }
        : { icon: '👆', text: 'Ketik lubang yang bercahaya untuk ambil guli' }
      : animating
        ? { icon: '⏳', text: 'Aisyah sedang mengagih guli…' }
        : { icon: '⏳', text: 'Tunggu, Aisyah sedang berfikir…' }

  const again = () => {
    sfx.select()
    const nextStarter = 1 - starter
    setStarter(nextStarter)
    setSaved(null)
    restart(nextStarter)
  }

  const theirTurn = turn === OPPONENT && !result

  return (
    <Scene
      top={
        <>
          <ExitButton onExit={onExit} />
          {!result && <HoldFast fast={fast} setFast={setFast} active={animating} />}
        </>
      }
      them={
        <PlayerCard
          side="them"
          name="Aisyah"
          color={AISYAH_COLOR}
          img={AISYAH_IMG}
          score={scores[1]}
          active={theirTurn}
        >
          <Speech says={speech} />
        </PlayerCard>
      }
      you={<PlayerCard side="you" name={playerName} color={playerColor} img={playerImg} score={scores[0]} active={yourTurn} />}
      toast={toast}
      board={
        <div className={`cg-board-hit ${animating ? 'is-skippable' : ''}`} onClick={animating ? skip : undefined}>
          <CongkakBoard
            pits={pits}
            canPlay={yourTurn && !animating}
            flash={flash}
            onPlay={onPitTap}
            onHover={(i) => setHoverPit(i !== null && i < 7 && pits[i] > 0 ? i : null)}
            boardRef={boardRef}
          >
            <Hands
              boardRef={boardRef}
              sowing={hand}
              turn={turn}
              animating={animating}
              finished={Boolean(result)}
              hoverPit={yourTurn && !animating ? hoverPit : null}
              slap={slap}
              playerSleeve={playerColor}
              moveMs={fast ? 135 : 265}
            />
          </CongkakBoard>
        </div>
      }
      bottom={
        next && (
          <>
            <p className={`cg-next ${yourTurn && !animating ? 'is-yours' : ''}`}>
              <span className="cg-next__icon" aria-hidden="true">
                {next.icon}
              </span>
              {next.text}
            </p>
          </>
        )
      }
    >
      {result && <Result result={result} saved={saved} playerName={playerName} onAgain={again} onExit={onExit} />}
    </Scene>
  )
}

export function CongkakGame({ onExit }) {
  const playerName = usePlayerState((s) => s.playerName) || 'Kamu'
  const gender = usePlayerState((s) => s.playerGender)
  const playerColor = SLEEVES[gender] ?? SLEEVES[GENDERS.LELAKI]
  const playerImg = PLAYER_IMG[gender] ?? PLAYER_IMG[GENDERS.LELAKI]
  const [phase, setPhase] = useState('intro')
  const [level, setLevel] = useState('biasa')
  const [records, setRecords] = useState(loadRecords)
  const onRecords = useMemo(() => (next) => setRecords(next), [])

  if (phase === 'intro') {
    return (
      <Intro
        level={level}
        setLevel={setLevel}
        records={records}
        playerName={playerName}
        playerColor={playerColor}
        playerImg={playerImg}
        onExit={onExit}
        onStart={() => {
          sfx.select()
          setPhase('play')
        }}
      />
    )
  }
  return <Match level={level} playerName={playerName} playerColor={playerColor} playerImg={playerImg} onExit={onExit} onRecords={onRecords} />
}
