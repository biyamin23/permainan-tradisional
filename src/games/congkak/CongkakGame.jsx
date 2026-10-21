import { useEffect, useMemo, useState } from 'react'
import { sfx } from '../../audio/engine'
import { usePlayerState } from '../../state/playerState'
import { CongkakBoard } from './CongkakBoard'
import { OPPONENT, PLAYER } from './engine'
import { loadRecords, saveResult } from './records'
import { useCongkakMatch } from './useCongkakMatch'
import './congkak.css'

/**
 * Congkak — solo against Aiman, the kid at the wakaf.
 * intro (pick difficulty) → match → result (with personal records).
 */

const LEVELS = [
  { id: 'mudah', label: 'Mudah', note: 'Aiman baru belajar' },
  { id: 'biasa', label: 'Biasa', note: 'Aiman main bersungguh' },
  { id: 'pakar', label: 'Pakar', note: 'Aiman juara kampung' },
]

const RULES = [
  'Setiap lubang kecil diisi 7 biji. Rumah (lubang besar) bermula kosong.',
  'Pilih satu lubang di sebelah kamu. Agihkan biji satu demi satu menuju rumah kamu, kemudian ke sebelah lawan.',
  'Biji terakhir masuk rumah sendiri? Kamu main lagi!',
  'Biji terakhir jatuh di lubang berisi? Kaut semua dan teruskan agihan.',
  'Biji terakhir jatuh di lubang kosong sebelah kamu? Tembak! Ambil biji lubang bertentangan masuk rumah kamu.',
  'Bila satu pihak kehabisan biji, permainan tamat. Siapa paling banyak biji dalam rumah, dia menang!',
]

function Intro({ level, setLevel, onStart, onExit, records }) {
  const [showRules, setShowRules] = useState(false)
  return (
    <div className="cg-intro">
      <div className="cg-intro__card">
        <div className="cg-intro__board" aria-hidden="true">
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} />
          ))}
        </div>
        <p className="modal__kicker">Mod Solo · Wakaf Kampung</p>
        <h2 className="cg-intro__title">Congkak</h2>
        <p className="cg-intro__lead">
          <span aria-hidden="true">🧒</span> Aiman cabar kamu! Pilih tahap:
        </p>

        <div className="cg-levels" role="radiogroup" aria-label="Tahap">
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
              <span className="cg-level__label">{l.label}</span>
              <span className="cg-level__note">{l.note}</span>
            </button>
          ))}
        </div>

        {records.wins + records.losses + records.draws > 0 && (
          <p className="cg-records">
            Rekod kamu: <strong>{records.wins}</strong> menang · {records.losses} kalah · {records.draws} seri · skor terbaik{' '}
            <strong>{records.best}</strong>
          </p>
        )}

        <button type="button" className="btn btn--primary btn--wide" onClick={onStart}>
          <span className="btn__shine" aria-hidden="true" />
          MULA MAIN
        </button>

        <div className="cg-intro__links">
          <button type="button" className="text-button" onClick={() => setShowRules((v) => !v)} aria-expanded={showRules}>
            {showRules ? 'Tutup cara bermain' : 'Cara bermain'}
          </button>
          <button type="button" className="text-button" onClick={onExit}>
            ← Balik ke kampung
          </button>
        </div>

        {showRules && (
          <ol className="cg-rules">
            {RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}

function ResultCard({ result, playerName, onAgain, onExit, saved }) {
  const [you, them] = result.scores
  const outcome = result.winner === PLAYER ? 'win' : result.winner === OPPONENT ? 'lose' : 'draw'
  const copy = {
    win: { emoji: '🏆', title: 'Kamu menang!', text: `Hebat, ${playerName}! Aiman minta lawan lagi.` },
    lose: { emoji: '😅', title: 'Aiman menang', text: 'Tak apa, cuba lagi. Biasa la, kalah menang adat bermain.' },
    draw: { emoji: '🤝', title: 'Seri!', text: 'Sama kuat. Satu pusingan lagi?' },
  }[outcome]
  return (
    <div className="cg-result" role="alertdialog" aria-live="assertive">
      <div className={`cg-result__card is-${outcome}`}>
        <span className="cg-result__emoji" aria-hidden="true">
          {copy.emoji}
        </span>
        <h3 className="cg-result__title">{copy.title}</h3>
        <p className="cg-result__score">
          <span>
            Kamu <strong>{you}</strong>
          </span>
          <span className="cg-result__vs">–</span>
          <span>
            <strong>{them}</strong> Aiman
          </span>
        </p>
        <p className="cg-result__text">{copy.text}</p>
        {saved?.newBest && <p className="cg-result__badge">⭐ Rekod baharu: {you} biji!</p>}
        <div className="cg-result__actions">
          <button type="button" className="btn btn--primary btn--wide" onClick={onAgain}>
            <span className="btn__shine" aria-hidden="true" />
            MAIN LAGI
          </button>
          <button type="button" className="text-button" onClick={onExit}>
            ← Balik ke kampung
          </button>
        </div>
      </div>
    </div>
  )
}

function Match({ level, playerName, onExit, onRecords }) {
  const [starter, setStarter] = useState(PLAYER)
  const match = useCongkakMatch({ level, starter })
  const { pits, turn, animating, hand, flash, banner, result, fast, setFast, playHouse, skip, restart, scores } = match
  const [saved, setSaved] = useState(null)

  useEffect(() => {
    if (!result) return
    const s = saveResult(result)
    setSaved(s)
    onRecords(s.records)
  }, [result, onRecords])

  const levelLabel = LEVELS.find((l) => l.id === level)?.label
  const status = result
    ? 'Permainan tamat'
    : animating
      ? turn === PLAYER
        ? 'Mengagih biji… (ketik papan untuk cepatkan)'
        : 'Aiman sedang mengagih…'
      : turn === PLAYER
        ? 'Giliran kamu — pilih satu lubang di sebelah kamu'
        : 'Aiman sedang berfikir…'

  const again = () => {
    sfx.select()
    const nextStarter = 1 - starter
    setStarter(nextStarter)
    setSaved(null)
    restart(nextStarter)
  }

  return (
    <div className="cg-match">
      <header className="cg-bar cg-bar--top">
        <button type="button" className="cg-icon-btn" onClick={onExit} aria-label="Keluar ke kampung">
          ✕
        </button>
        <div className={`cg-player cg-player--them ${turn === OPPONENT && !result ? 'is-turn' : ''}`}>
          <span className="cg-player__avatar" aria-hidden="true">
            🧒
          </span>
          <span className="cg-player__meta">
            <span className="cg-player__name">Aiman</span>
            <span className="cg-player__level">{levelLabel}</span>
          </span>
          <span className="cg-player__score">{scores[1]}</span>
        </div>
        <button
          type="button"
          className={`cg-icon-btn ${fast ? 'is-on' : ''}`}
          onClick={() => setFast((v) => !v)}
          aria-pressed={fast}
          aria-label="Laju"
          title="Laju"
        >
          ⏩
        </button>
      </header>

      <p className={`cg-status ${turn === PLAYER && !animating && !result ? 'is-yours' : ''}`}>{status}</p>

      {/* tap anywhere around the board during a move to finish it instantly */}
      <div className={`cg-board-wrap ${animating ? 'is-skippable' : ''}`} onClick={animating ? skip : undefined}>
        <CongkakBoard
          pits={pits}
          turn={turn}
          animating={animating}
          hand={hand}
          flash={flash}
          finished={Boolean(result)}
          onPlay={playHouse}
        />
        {banner && (
          <div className={`cg-banner is-${banner.tone}`} key={banner.key}>
            {banner.text}
          </div>
        )}
      </div>

      <footer className="cg-bar cg-bar--bottom">
        <div className={`cg-player cg-player--you ${turn === PLAYER && !result ? 'is-turn' : ''}`}>
          <span className="cg-player__avatar" aria-hidden="true">
            ⭐
          </span>
          <span className="cg-player__meta">
            <span className="cg-player__name">{playerName || 'Kamu'}</span>
            <span className="cg-player__level">Rumah kamu</span>
          </span>
          <span className="cg-player__score">{scores[0]}</span>
        </div>
      </footer>

      {result && <ResultCard result={result} playerName={playerName || 'kawan'} onAgain={again} onExit={onExit} saved={saved} />}
    </div>
  )
}

export function CongkakGame({ onExit }) {
  const playerName = usePlayerState((s) => s.playerName)
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
