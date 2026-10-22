import { useEffect, useMemo, useRef, useState } from 'react'
import { sfx } from '../../audio/engine'
import { usePlayerState } from '../../state/playerState'
import {
  ExitButton,
  IntroPanel,
  NextHint,
  OsomPanel,
  PlayerCard,
  ResultPanel,
  RulesButton,
  RulesSheet,
  Scene,
  Speech,
  recordsSummary,
  usePlayerLook,
  useTurnToast,
} from '../shared/GameShell'
import { CAPTAIN, PAK_TEAM, pasukanKamu } from './cast'
import { LAMBUNGAN, MAX_TOUCHES, PLAYERS, ROUNDS, TEAM_THEM, TEAM_YOU, TURN_SECONDS } from './engine'
import { loadRecords, saveResult } from './records'
import { RagaView } from './RagaView'
import { useRagaMatch } from './useRagaMatch'
import './sepakRaga.css'

/**
 * Sepak Raga on the padang: you and four kampung kids against Geng Pak-pak,
 * taking turns in the circle. When the ball comes to you, tap as the yellow
 * ring meets the white one: Timang to keep it, or pass across the circle.
 */

const LEVELS = [
  { id: 'mudah', label: 'Mudah', note: 'Pak-pak baru balik kerja, kaki masih penat. Masa ketik lebih panjang.' },
  { id: 'biasa', label: 'Biasa', note: 'Geng Pak-pak main macam biasa petang-petang.' },
  { id: 'pakar', label: 'Pakar', note: 'Bekas juara sepak raga daerah. Masa ketik pendek.' },
]

const RULES = [
  'Osom dahulu (batu, air, burung). Yang menang, pasukannya main dulu dalam setiap pusingan.',
  'Lima pemain berdiri di bulatan besar (6 m), bernombor 1 hingga 5 ikut arah jam. Kamu pemain 1.',
  'Pemain 1 mula setiap lambungan: lambung bola dengan tangan kepada pemain 3, 4 atau 5.',
  'Selepas itu tangan dan lengan tak boleh kena bola. Guna kaki, lutut atau kepala.',
  'Seorang boleh sentuh paling banyak 3 kali berturut-turut. Sentuhan ke-3 mesti hantar kepada kawan.',
  'Setiap hantaran mesti melintasi bulatan kecil (2 m) di tengah, jadi hantar kepada pemain di seberang, bukan sebelah kamu.',
  'Penerima lambungan pertama tak boleh hantar balik kepada pemain 1.',
  'Setiap hantaran yang disambut elok dapat 1 mata. Setiap pemain mesti sentuh bola sekurang-kurangnya sekali dalam setiap 20 mata.',
  'Bola mati bila jatuh ke tanah, disentuh lebih 3 kali, atau hantaran tak melintasi bulatan kecil.',
  'Setiap pasukan ada 3 lambungan dalam satu pusingan, dan main 3 pusingan. Masa setiap giliran dipendekkan kepada 90 saat (peraturan rasmi 10 minit).',
  'Mata paling banyak menang. Kalau seri, pasukan yang lebih lama mengawal bola menang.',
  'Cara main di telefon: bila bola datang kepada kamu, ketik butang tepat ketika gelang kuning bertemu gelang putih (jadi hijau).',
]

const TEAM_NAMES = ['Pasukan kamu', 'Geng Pak-pak']

const clock = (sec) => {
  const s = Math.max(0, Math.ceil(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function useTeams() {
  const player = usePlayerLook()
  const gender = usePlayerState((s) => s.playerGender)
  const teams = useMemo(() => [pasukanKamu(player, gender), PAK_TEAM], [player, gender])
  return { player, teams }
}

/** A still view of the padang behind the opening panels. */
function useStillView() {
  return useRef({ acts: [0, 1].map(() => Array.from({ length: PLAYERS }, () => ({ t: -99, kind: 'sila' }))), flight: null, window: null, clockNow: () => 0 })
}

function Intro({ level, setLevel, records, player, teams, onStart, onExit, osom, onOsomDone }) {
  const [showRules, setShowRules] = useState(false)
  const still = useStillView()
  return (
    <Scene
      className="sr"
      top={
        <>
          <ExitButton onExit={onExit} />
          <RulesButton onOpen={() => setShowRules(true)} />
        </>
      }
      them={<PlayerCard side="them" name="Geng Pak-pak" color={CAPTAIN.color} img={CAPTAIN.img} score={0} unit="mata" />}
      you={<PlayerCard side="you" name={player.name} color={player.color} img={player.img} score={0} unit="mata" />}
      board={null}
    >
      <div className="sr-stage">
        <RagaView g={still} teams={teams} team={TEAM_THEM} scores={[0, 0]} round={1} />
      </div>
      {osom ? (
        <OsomPanel opponent="Pak Nyaa" onDone={onOsomDone} />
      ) : (
        <IntroPanel
          title="Geng Pak-pak cabar budak-budak main sepak raga!"
          opponent="Geng Pak-pak"
          levels={LEVELS}
          level={level}
          setLevel={setLevel}
          recordsLine={recordsSummary(records, records.best ? `mata terbaik ${records.best}` : null)}
          onStart={onStart}
        />
      )}
      {showRules && <RulesSheet game="sepak raga" rules={RULES} onClose={() => setShowRules(false)} />}
    </Scene>
  )
}

function Result({ result, onAgain, onExit }) {
  const win = result.winner === TEAM_YOU
  const title = win ? 'Pasukan kamu menang!' : result.winner === TEAM_THEM ? 'Geng Pak-pak menang!' : 'Seri!'
  const line = win
    ? 'Pak Nyaa angkat topi. "Budak-budak ni boleh tahan!"'
    : result.winner === TEAM_THEM
      ? 'Pak Dil senyum. "Esok petang datang lagi, kita latih."'
      : 'Sama kuat! Semua ketawa.'
  const extra = result.tiebreak && result.winner !== null ? 'Mata seri, jadi pasukan yang lebih lama mengawal bola menang.' : null
  return (
    <ResultPanel
      title={title}
      win={win}
      mine={result.scores[0]}
      theirs={result.scores[1]}
      myName={TEAM_NAMES[0]}
      theirName={TEAM_NAMES[1]}
      line={line}
      extra={extra}
      onAgain={onAgain}
      onExit={onExit}
    />
  )
}

function Mate({ m, num, onClick, disabled, hot, note }) {
  return (
    <button type="button" className={`sr-act ${hot ? 'is-hot' : ''}`} onClick={onClick} disabled={disabled}>
      <span className="sr-act__face" style={{ '--c': m.color ?? '#5a8a4a' }}>
        {m.img ? <img src={m.img} alt="" /> : <span>{m.name[0]}</span>}
        <span className="sr-act__num">{num}</span>
      </span>
      <span className="sr-act__text">
        <strong>{note}</strong>
        {m.name}
      </span>
    </button>
  )
}

function Match({ level, starter, teams, player, onExit, onRecords, onRematch }) {
  const [rematch, setRematch] = useState(false)
  const [showRules, setShowRules] = useState(false)
  const m = useRagaMatch({ level, starter, teams })
  const s = m.state
  const yourTeam = s.team === TEAM_YOU
  const toast = useTurnToast({ yourTurn: yourTeam, finished: Boolean(s.result), banner: s.banner, theirName: 'Geng Pak-pak' })

  useEffect(() => {
    if (s.result) onRecords(saveResult(s.result))
  }, [s.result, onRecords])

  // keyboard: Space = timang, ← / → = pass across
  useEffect(() => {
    const onKey = (e) => {
      if (e.repeat) return
      const [left, right] = m.legal
      if (s.phase === 'serve' && ['1', '2', '3'].includes(e.key)) m.serveTo([2, 3, 4][Number(e.key) - 1])
      if (!m.yourBall) return
      if (e.key === ' ') {
        e.preventDefault()
        m.play(s.rally.touches < MAX_TOUCHES - 1 ? 'timang' : left)
      }
      if (e.key === 'ArrowLeft' && left !== undefined) m.play(left)
      if (e.key === 'ArrowRight' && right !== undefined) m.play(m.legal.length > 1 ? right : left)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [m, s])

  const mates = teams[TEAM_YOU]
  const canTimang = m.yourBall && s.rally.touches < MAX_TOUCHES - 1
  const tapStage = () => {
    if (!m.yourBall) return
    m.play(canTimang ? 'timang' : m.legal[0])
  }

  let next = null
  let actions = null
  if (!s.result) {
    if (!yourTeam) {
      next = { icon: '👀', text: `Geng Pak-pak sedang main · lambungan ${s.lambungan}/${LAMBUNGAN}` }
      actions = (
        <button type="button" className="gs-pill sr-skip" onClick={m.skip} disabled={s.phase === 'turnEnd'}>
          Langkau <span aria-hidden="true">⏩</span>
        </button>
      )
    } else if (s.phase === 'serve') {
      next = { icon: '🙌', text: 'Kamu pemain 1. Lambung bola kepada pemain 3, 4 atau 5.' }
      actions = (
        <div className="sr-acts">
          {[2, 3, 4].map((t) => (
            <Mate key={t} m={mates[t]} num={t + 1} note="Lambung" hot onClick={() => m.serveTo(t)} />
          ))}
        </div>
      )
    } else {
      const touchNo = s.rally.touches + 1
      next = m.yourBall
        ? { icon: '🎯', text: `Bola datang! Ketik bila gelang jadi hijau · sentuhan ${touchNo}/${MAX_TOUCHES}${touchNo === MAX_TOUCHES ? ' (mesti hantar)' : ''}` }
        : s.phase === 'live'
          ? { icon: '⏳', text: `Bersedia… bola pada ${mates[s.rally.holder]?.name ?? ''}` }
          : null
      const [a, b] = m.legal.length ? m.legal : [2, 3]
      actions = (
        <div className="sr-acts">
          <Mate m={mates[a]} num={a + 1} note="Hantar ↖" hot={m.yourBall} disabled={!m.yourBall || !m.legal.includes(a)} onClick={() => m.play(a)} />
          <button type="button" className={`sr-act sr-act--timang ${canTimang ? 'is-hot' : ''}`} onClick={() => m.play('timang')} disabled={!canTimang}>
            <span className="sr-act__icon" aria-hidden="true">
              ⬆
            </span>
            <span className="sr-act__text">
              <strong>Timang</strong>
              kawal bola
            </span>
          </button>
          {b !== undefined && m.legal.length > 1 && (
            <Mate m={mates[b]} num={b + 1} note="Hantar ↗" hot={m.yourBall} disabled={!m.yourBall} onClick={() => m.play(b)} />
          )}
        </div>
      )
    }
  }

  const again = () => {
    sfx.select()
    setRematch(true)
  }

  return (
    <Scene
      className="sr"
      top={
        <>
          <ExitButton onExit={onExit} />
          {actions && !yourTeam ? actions : null}
          <RulesButton onOpen={() => setShowRules(true)} />
        </>
      }
      them={
        <PlayerCard side="them" name="Geng Pak-pak" color={CAPTAIN.color} img={CAPTAIN.img} score={s.scores[1]} unit="mata" active={!yourTeam && !s.result}>
          <Speech says={s.speech} />
        </PlayerCard>
      }
      you={<PlayerCard side="you" name={player.name} color={player.color} img={player.img} score={s.scores[0]} unit="mata" active={yourTeam && !s.result} />}
      toast={toast}
      board={<div className="sr-board" />}
      bottom={
        <>
          <NextHint next={next} yours={m.yourBall || s.phase === 'serve'} />
          {yourTeam && actions}
        </>
      }
    >
      <div className="sr-stage" onPointerDown={tapStage}>
        <RagaView g={m.g} teams={teams} team={s.team} scores={s.scores} round={s.round} cheering={s.phase === 'turnEnd'} />
      </div>
      <div className="sr-status" aria-live="off">
        <span>
          Pusingan {s.round}/{ROUNDS} · Lambungan {s.lambungan}/{LAMBUNGAN}
        </span>
        <span className={`sr-clock ${s.timeLeft < 15 ? 'is-low' : ''}`}>⏱ {clock(s.timeLeft ?? TURN_SECONDS)}</span>
        <span className="sr-count">
          <b>{s.rally.points}</b> timbangan
        </span>
      </div>
      {s.lastQuality?.perfect && (
        <p className="sr-nice" key={s.lastQuality.key}>
          Cantik!
        </p>
      )}
      {s.result && !rematch && <Result result={s.result} onAgain={again} onExit={onExit} />}
      {rematch && (
        <OsomPanel
          opponent="Pak Nyaa"
          onDone={onRematch}
        />
      )}
      {showRules && <RulesSheet game="sepak raga" rules={RULES} onClose={() => setShowRules(false)} />}
    </Scene>
  )
}

/** Each new game (after osom) is a fresh match. */
function MatchHolder({ firstStarter, ...props }) {
  const [game, setGame] = useState({ n: 0, starter: firstStarter })
  return <Match key={game.n} {...props} starter={game.starter} onRematch={(who) => setGame((g) => ({ n: g.n + 1, starter: who }))} />
}

export function SepakRagaGame({ onExit }) {
  const { player, teams } = useTeams()
  const [phase, setPhase] = useState('intro') // intro → osom → play
  const [starter, setStarter] = useState(TEAM_YOU)
  const [level, setLevel] = useState('biasa')
  const [records, setRecords] = useState(loadRecords)
  const onRecords = useMemo(() => (next) => setRecords(next), [])

  if (phase !== 'play') {
    return (
      <Intro
        level={level}
        setLevel={setLevel}
        records={records}
        player={player}
        teams={teams}
        onExit={onExit}
        onStart={() => {
          sfx.select()
          setPhase('osom')
        }}
        osom={phase === 'osom'}
        onOsomDone={(who) => {
          setStarter(who)
          setPhase('play')
        }}
      />
    )
  }
  return <MatchHolder level={level} player={player} teams={teams} firstStarter={starter} onExit={onExit} onRecords={onRecords} />
}
