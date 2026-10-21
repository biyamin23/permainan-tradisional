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
function HoldFast({ fast, setFast }) {
  const on = () => setFast(true)
  const off = () => setFast(false)
  useEffect(() => {
    window.addEventListener('blur', off)
    return () => window.removeEventListener('blur', off)
  })
  return (
    <button
      type="button"
      className={`cg-text-btn cg-hold ${fast ? 'is-on' : ''}`}
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
      {fast ? 'Laju 2×' : 'Tahan: laju 2×'}
    </button>
  )
}

function TurnMark({ on }) {
  return <span className={`cg-mark ${on ? 'is-on' : ''}`} aria-hidden="true" />
}

function Scene({ them, themSays, you, status, statusTone, statusKey, board, top, children }) {
  return (
    <div className="cg">
      <div className="cg-top">{top}</div>
      <div className="cg-mat">
        <div className="cg-side cg-side--them">
          {them}
          {themSays && (
            <p
              className="cg-speech"
              key={themSays.key}
              role="status"
            >
              {themSays.text}
            </p>
          )}
        </div>
        <div className="cg-board-wrap">{board}</div>
        <div className="cg-side cg-side--you">{you}</div>
        <p className={`cg-status ${statusTone ? `is-${statusTone}` : ''}`} key={statusKey} aria-live="polite">
          {status}
        </p>
      </div>
      {children}
    </div>
  )
}

function Rules({ onClose }) {
  return (
    <div className="cg-sheet" role="dialog" aria-label="Cara main congkak">
      <div className="cg-plaque cg-plaque--rules">
        <h3 className="cg-plaque__title">Cara main</h3>
        <ol className="cg-rules">
          {RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ol>
        <button type="button" className="cg-btn" onClick={onClose}>
          Faham
        </button>
      </div>
    </div>
  )
}

function Intro({ level, setLevel, records, playerName, onStart, onExit }) {
  const [showRules, setShowRules] = useState(false)
  const current = LEVELS.find((l) => l.id === level)
  const played = records.wins + records.losses + records.draws

  return (
    <Scene
      top={
        <>
          <button type="button" className="cg-text-btn" onClick={onExit}>
            Keluar
          </button>
          <button type="button" className="cg-text-btn" onClick={() => setShowRules(true)}>
            Cara main
          </button>
        </>
      }
      them={<span className="cg-name">Aisyah</span>}
      you={<span className="cg-name">{playerName}</span>}
      board={<CongkakBoard pits={START} />}
    >
      <div className="cg-sheet">
        <div className="cg-plaque">
          <h2 className="cg-plaque__title">Aisyah ajak kamu main congkak.</h2>
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
          <p className="cg-plaque__note">{current.note}</p>
          {played > 0 && (
            <p className="cg-plaque__small">
              Menang {records.wins}, kalah {records.losses}
              {records.draws ? `, seri ${records.draws}` : ''}. Skor terbaik {records.best} biji.
            </p>
          )}
          <button type="button" className="cg-btn cg-btn--main" onClick={onStart}>
            Mula main
          </button>
        </div>
      </div>
      {showRules && <Rules onClose={() => setShowRules(false)} />}
    </Scene>
  )
}

function Result({ result, saved, onAgain, onExit }) {
  const [you, them] = result.scores
  const title = result.winner === PLAYER ? 'Kamu menang.' : result.winner === OPPONENT ? 'Aisyah menang.' : 'Seri.'
  const line =
    result.winner === PLAYER
      ? 'Aisyah tersenyum kelat. Dia nak lawan lagi.'
      : result.winner === OPPONENT
        ? 'Kalah menang adat bermain. Cuba sekali lagi.'
        : 'Sama kuat. Satu pusingan lagi?'
  return (
    <div className="cg-sheet" role="alertdialog" aria-live="assertive">
      <div className="cg-plaque">
        <h2 className="cg-plaque__title cg-plaque__title--big">{title}</h2>
        <p className="cg-score">
          <span>{you}</span> lawan <span>{them}</span>
        </p>
        <p className="cg-plaque__note">{line}</p>
        {saved?.newBest && <p className="cg-plaque__small">Skor terbaik baharu: {you} biji.</p>}
        <button type="button" className="cg-btn cg-btn--main" onClick={onAgain}>
          Main lagi
        </button>
        <button type="button" className="cg-text-btn" onClick={onExit}>
          Balik ke kampung
        </button>
      </div>
    </div>
  )
}

const SLEEVES = { [GENDERS.LELAKI]: '#2b9aa0', [GENDERS.PEREMPUAN]: '#e9779a' }

function Match({ level, playerName, onExit, onRecords }) {
  const [starter, setStarter] = useState(PLAYER)
  const { pits, turn, animating, hand, flash, banner, speech, result, fast, setFast, playHouse, skip, restart, scores, say } =
    useCongkakMatch({ level, starter })
  const [saved, setSaved] = useState(null)
  const [hoverPit, setHoverPit] = useState(null)
  const [slap, setSlap] = useState(null)
  const lastSlap = useRef(0)
  const boardRef = useRef(null)
  const gender = usePlayerState((s) => s.playerGender)

  useEffect(() => voice.preload(SABAR_URLS), [])

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
        say('Itu lubang Aisyah. Pilih lubang di barisan kamu.')
      } else if (outcome === 'empty') {
        say('Lubang tu kosong. Pilih lubang yang ada biji.')
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
  const defaultStatus = result
    ? ''
    : animating
      ? turn === PLAYER
        ? 'Ketik papan untuk habiskan agihan.'
        : 'Aisyah sedang mengagih.'
      : yourTurn
        ? null
        : 'Aisyah sedang berfikir.'
  const status =
    banner?.text ??
    defaultStatus ?? (
      <>
        Giliran kamu. Pilih satu lubang di barisan{' '}
        <span className="cg-hint--upright">kanan</span>
        <span className="cg-hint--flat">bawah</span>.
      </>
    )

  const again = () => {
    sfx.select()
    const next = 1 - starter
    setStarter(next)
    setSaved(null)
    restart(next)
  }

  const levelLabel = LEVELS.find((l) => l.id === level)?.label

  return (
    <Scene
      top={
        <>
          <button type="button" className="cg-text-btn" onClick={onExit}>
            Keluar
          </button>
          <HoldFast fast={fast} setFast={setFast} />
        </>
      }
      them={
        <>
          <TurnMark on={turn === OPPONENT && !result} />
          <span className="cg-name">Aisyah</span>
          <span className="cg-name__meta">tahap {levelLabel.toLowerCase()}</span>
          <span className="cg-tally" aria-label={`Aisyah ${scores[1]} biji`}>
            {scores[1]}
          </span>
        </>
      }
      you={
        <>
          <TurnMark on={yourTurn} />
          <span className="cg-name">{playerName}</span>
          <span className="cg-tally" aria-label={`Kamu ${scores[0]} biji`}>
            {scores[0]}
          </span>
        </>
      }
      status={status}
      themSays={speech}
      statusTone={banner?.tone}
      statusKey={banner?.key ?? 'default'}
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
              playerSleeve={SLEEVES[gender]}
              moveMs={fast ? 135 : 265}
            />
          </CongkakBoard>
        </div>
      }
    >
      {result && <Result result={result} saved={saved} onAgain={again} onExit={onExit} />}
    </Scene>
  )
}

export function CongkakGame({ onExit }) {
  const playerName = usePlayerState((s) => s.playerName) || 'Kamu'
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
        onExit={onExit}
        onStart={() => {
          sfx.select()
          setPhase('play')
        }}
      />
    )
  }
  return <Match level={level} playerName={playerName} onExit={onExit} onRecords={onRecords} />
}
