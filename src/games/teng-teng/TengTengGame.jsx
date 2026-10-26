import { useEffect, useMemo, useRef, useState } from 'react'
import { sfx } from '../../audio/engine'
import { CHILD_LOOKS } from '../../components/character/ChildModel'
import { GENDERS, usePlayerState } from '../../state/playerState'
import {
  ExitButton,
  HowToButton,
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
import { logEvent } from '../../cloud/events'
import { RUKIAH } from './cast'
import { PETAK, THEM, YOU, housesOf, reachOf } from './engine'
import { loadRecords, saveResult } from './records'
import { TengView } from './TengView'
import { AIM_LAP, aimPower, powerForReach, useTengMatch } from './useTengMatch'
import './tengTeng.css'

/**
 * Teng-teng on the lorong, 1 lawan 1 against Rukiah. Throw your gundu into
 * the next petak, hop the court without stepping on a line, pick it up on the
 * way back; after all nine, timbang, then throw for a rumah.
 */

const LEVELS = [
  { id: 'mudah', label: 'Mudah', note: 'Rukiah baru belajar. Butang yang betul akan bercahaya.' },
  { id: 'biasa', label: 'Biasa', note: 'Rukiah main macam biasa petang-petang.' },
  { id: 'pakar', label: 'Pakar', note: 'Rukiah juara teng-teng satu lorong. Rentak lebih laju.' },
]

const GUNDU_CHOICES = [
  { id: 'genting', label: 'Genting', img: '/teng/gundu-genting.webp', note: 'Pecahan genting bumbung' },
  { id: 'batu', label: 'Batu sungai', img: '/teng/gundu-batu.webp', note: 'Leper dan licin' },
  { id: 'tin', label: 'Penutup tin', img: '/teng/gundu-tin.webp', note: 'Diketuk sampai leper' },
]

const GOALS = [1, 2, 3]

const RULES = [
  'Osom dahulu. Yang menang main dulu.',
  'Ada 9 petak: 1, 2, 3 seorang; 4 dan 5 bersebelahan; 6; 7 dan 8 bersebelahan; 9 kepala.',
  'Berdiri di garisan, belakangkan gelanggang, dan baling gundu ke petak giliran kamu (mula petak 1). Gundu mesti masuk petak itu tanpa kena garisan.',
  'Lompat sebelah kaki di petak seorang, dua kaki di petak bersebelahan dan di kepala (9).',
  'Petak yang ada gundu, dan rumah orang lain, tak boleh dipijak: langkau.',
  'Masa balik, berhenti sebelum petak gundu, ambil gundu, kemudian lompat keluar.',
  'Pijak garisan, salah kaki, pijak petak bergundu atau tersilap baling: mati, giliran lawan.',
  'Habis 9 petak: timbang. Letak gundu atas kepala, lompat seluruh petak, kemudian jatuhkan dan sambut.',
  'Lulus timbang: baling gundu tanpa lihat. Petak kosong yang dikenanya jadi rumah kamu. Rumah orang lain mesti dilangkau.',
  'Rumah paling banyak menang. (Permainan penuh sampai semua petak berpunya; di sini kita main sampai sasaran rumah.)',
  'Di telefon: tekan dan tahan untuk baling. Meter kuasa dan anak panah naik dari petak 1 ke 9, kemudian turun balik. Lepas bila anak panah di petak yang betul. Masa lompat, tekan Lompat bila gelang jadi hijau: kaki yang betul dipilih sendiri.',
]

// one Lompat button: the right move is picked for you, the timing is yours
const MOVES = {
  sebelah: { icon: '🦶', note: 'sebelah kaki' },
  dua: { icon: '👣', note: 'dua kaki' },
  langkau: { icon: '⤴', note: 'langkau petak' },
  ambil: { icon: '🤲', note: 'ambil gundu' },
}

/** Power meter while you hold: fills from petak 1 up to 9, then back down. */
function PowerMeter({ r, level, target }) {
  const fill = useRef(null)
  const arrow = useRef(null)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const aim = r.current.aim
      if (aim) {
        const u = aimPower(aim.t0, AIM_LAP[level])
        if (fill.current) fill.current.style.transform = `scaleY(${u})`
        if (arrow.current) arrow.current.style.bottom = `${u * 100}%`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [r, level])
  // one tick per row of petak
  const rows = [1, 2, 3, 4, 6, 7, 9]
  return (
    <div className="tt-meter" aria-hidden="true">
      <div className="tt-meter__bar">
        <div className="tt-meter__fill" ref={fill} />
        {rows.map((id) => (
          <span key={id} className={`tt-meter__tick ${target && PETAK.find((p) => p.id === target)?.row === PETAK.find((p) => p.id === id).row ? 'is-target' : ''}`} style={{ bottom: `${powerForReach(reachOf(id)) * 100}%` }}>
            {id === 4 ? '4·5' : id === 7 ? '7·8' : id}
          </span>
        ))}
        <span className="tt-meter__arrow" ref={arrow}>
          ▶
        </span>
      </div>
      <p className="tt-meter__label">Kuasa</p>
    </div>
  )
}

function Intro({ player, level, setLevel, gundu, setGundu, goal, setGoal, records, onStart, onExit, osom, onOsomDone }) {
  const [showRules, setShowRules] = useState(false)
  const note = LEVELS.find((l) => l.id === level)?.note
  return (
    <Scene
      className="tt tt--intro"
      top={
        <>
          <ExitButton onExit={onExit} />
          <RulesButton onOpen={() => setShowRules(true)} />
        </>
      }
      them={<PlayerCard side="them" name={RUKIAH.name} color={RUKIAH.color} img={RUKIAH.img} score={0} unit="rumah" />}
      you={<PlayerCard side="you" name={player.name} color={player.color} img={player.img} score={0} unit="rumah" />}
      board={null}
    >
      {osom ? (
        <OsomPanel opponent={RUKIAH.name} onDone={onOsomDone} />
      ) : (
        <div className="gs-sheet">
          <div className="gs-panel">
            <h2 className="gs-panel__title">Rukiah dah lukis petak. Jom main teng-teng!</h2>
            <p className="gs-panel__label">Tahap Rukiah</p>
            <div className="gs-levels" role="radiogroup" aria-label="Tahap">
              {LEVELS.map((l) => (
                <button key={l.id} type="button" role="radio" aria-checked={level === l.id} className={`gs-level ${level === l.id ? 'is-selected' : ''}`} onClick={() => (sfx.tap(), setLevel(l.id))}>
                  {l.label}
                </button>
              ))}
            </div>
            <p className="gs-panel__note">{note}</p>
            <p className="gs-panel__label">Gundu kamu</p>
            <div className="tt-gundus" role="radiogroup" aria-label="Gundu">
              {GUNDU_CHOICES.map((g) => (
                <button key={g.id} type="button" role="radio" aria-checked={gundu === g.id} className={`tt-gundu ${gundu === g.id ? 'is-selected' : ''}`} onClick={() => (sfx.tap(), setGundu(g.id))}>
                  <span className="tt-gundu__pic">
                    <img src={g.img} alt="" width="300" height="300" />
                  </span>
                  <span className="tt-gundu__name">{g.label}</span>
                  <span className="tt-gundu__note">{g.note}</span>
                </button>
              ))}
            </div>
            <p className="gs-panel__label">Main sampai dapat</p>
            <div className="gs-levels" role="radiogroup" aria-label="Sasaran rumah">
              {GOALS.map((n) => (
                <button key={n} type="button" role="radio" aria-checked={goal === n} className={`gs-level ${goal === n ? 'is-selected' : ''}`} onClick={() => (sfx.tap(), setGoal(n))}>
                  {n} rumah
                </button>
              ))}
            </div>
            {recordsSummary(records) && <p className="gs-panel__small">{recordsSummary(records)}</p>}
            <button
              type="button"
              className="gs-btn gs-btn--go"
              onClick={() => {
                logEvent('start', 'ting-ting')
                onStart()
              }}
            >
              Mula main
            </button>
            <HowToButton />
          </div>
        </div>
      )}
      {showRules && <RulesSheet game="teng-teng" rules={RULES} onClose={() => setShowRules(false)} />}
    </Scene>
  )
}

function Result({ result, playerName, onAgain, onExit }) {
  const win = result.winner === YOU
  const title = win ? 'Kamu menang!' : result.winner === THEM ? 'Rukiah menang!' : 'Seri!'
  const line = win ? 'Rukiah tepuk tangan. "Esok kita main lagi!"' : result.winner === THEM ? 'Rukiah senyum lebar. "Latih lagi, ya!"' : 'Sama banyak rumah. Seri!'
  return (
    <ResultPanel
      title={title}
      win={win}
      mine={result.houses[0]}
      theirs={result.houses[1]}
      myName={playerName}
      theirName={RUKIAH.name}
      line={line}
      extra="Nombor di atas ialah rumah masing-masing."
      onAgain={onAgain}
      onExit={onExit}
    />
  )
}

function Match({ level, starter, goal, gundu, player, look, onExit, onRecords, onRematch }) {
  const [rematch, setRematch] = useState(false)
  const [showRules, setShowRules] = useState(false)
  const m = useTengMatch({ level, starter, goal })
  const s = m.s
  const g = s.game
  const yourTurn = g.turn === YOU && s.phase !== 'done'
  const toast = useTurnToast({ yourTurn, finished: Boolean(s.result), banner: s.banner, theirName: RUKIAH.name })
  const holding = useRef(false)

  useEffect(() => {
    if (s.result) onRecords(saveResult(s.result))
  }, [s.result, onRecords])

  // keyboard: Space (hold) to throw; Space / Enter to hop, pick up and catch; ← → lean
  useEffect(() => {
    const down = (e) => {
      if (e.repeat) return
      if (e.key === ' ') {
        e.preventDefault()
        if (s.phase === 'aim') m.holdThrow()
      }
      if (e.key === ' ' && s.ring) m.press(s.ring.kind)
      if (e.key === 'Enter' && s.ring) m.press(s.ring.kind)
      if (e.key === 'ArrowLeft') m.lean(-1)
      if (e.key === 'ArrowRight') m.lean(1)
    }
    const up = (e) => {
      if (e.key === ' ') m.releaseThrow()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [m, s])

  const looks = useMemo(() => [look, RUKIAH.look], [look])
  const rukiahGundu = gundu === 'tin' ? 'genting' : 'tin'
  const stage = g.players[g.turn]
  const status = stage.stage === 'timbang' ? 'Timbang' : stage.stage === 'rumah' ? 'Cari rumah' : `Petak ${stage.target}`

  let next = null
  let actions = null
  if (!s.result) {
    if (!yourTurn) {
      next = { icon: '👀', text: `Rukiah sedang main · ${status}` }
      actions = (
        <button type="button" className="gs-pill tt-skip" onClick={m.skip} disabled={s.phase === 'dead'}>
          Langkau <span aria-hidden="true">⏩</span>
        </button>
      )
    } else if (s.phase === 'aim') {
      const blind = stage.stage === 'rumah'
      next = blind
        ? { icon: '🙈', text: 'Baling tanpa lihat. Petak kosong yang kena jadi rumah kamu!' }
        : { icon: '🎯', text: `Tahan: anak panah naik dari petak 1 ke 9, kemudian turun. Lepas bila tepat di petak ${stage.target}.` }
      actions = (
        <button
          type="button"
          className={`tt-throw ${s.aim ? 'is-holding' : ''}`}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture?.(e.pointerId)
            holding.current = true
            m.holdThrow()
          }}
          onPointerUp={() => {
            if (holding.current) m.releaseThrow()
            holding.current = false
          }}
          onPointerCancel={() => {
            if (holding.current) m.releaseThrow()
            holding.current = false
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {s.aim ? 'Lepas!' : blind ? 'Tahan untuk baling (tanpa lihat)' : 'Tahan untuk baling'}
        </button>
      )
    } else if (s.phase === 'timbang') {
      next = { icon: '⚖️', text: 'Jaga imbangan! Condong ke arah sebaliknya.' }
      actions = (
        <div className="tt-acts tt-acts--lean">
          <button type="button" className="tt-act" onPointerDown={() => m.lean(-1)}>
            ◀ Kiri
          </button>
          <div className="tt-balance" aria-label="Imbangan">
            <span style={{ left: `${50 + s.balance * 46}%` }} className={Math.abs(s.balance) > 0.7 ? 'is-danger' : ''} />
          </div>
          <button type="button" className="tt-act" onPointerDown={() => m.lean(1)}>
            Kanan ▶
          </button>
        </div>
      )
    } else if (s.phase === 'catch') {
      next = { icon: '🙌', text: 'Gundu jatuh dari kepala. Sambut!' }
      actions = (
        <div className="tt-acts">
          <button type="button" className="tt-act is-hot" onPointerDown={() => m.press('sambut')}>
            🙌 Sambut!
          </button>
        </div>
      )
    } else if (s.phase === 'hop' || s.phase === 'fly') {
      const move = MOVES[s.ring?.kind] ?? null
      next = move ? { icon: move.icon, text: 'Tekan Lompat bila gelang jadi hijau.' } : { icon: '⏳', text: 'Bersedia…' }
      actions = (
        <button type="button" className={`tt-jump ${move ? 'is-ready' : ''}`} disabled={!move} onPointerDown={() => move && m.press(s.ring.kind)}>
          <span className="tt-jump__icon" aria-hidden="true">
            {move?.icon ?? '🦶'}
          </span>
          <span className="tt-jump__text">
            {s.ring?.kind === 'ambil' ? 'Ambil!' : 'Lompat!'}
            <small>{move?.note ?? 'bersedia…'}</small>
          </span>
        </button>
      )
    }
  }

  return (
    <Scene
      className="tt"
      top={
        <>
          <ExitButton onExit={onExit} />
          {!yourTurn && actions}
          <RulesButton onOpen={() => setShowRules(true)} />
        </>
      }
      them={
        <PlayerCard side="them" name={RUKIAH.name} color={RUKIAH.color} img={RUKIAH.img} score={housesOf(g, THEM)} unit="rumah" active={!yourTurn && !s.result}>
          <Speech says={s.speech} />
        </PlayerCard>
      }
      you={<PlayerCard side="you" name={player.name} color={player.color} img={player.img} score={housesOf(g, YOU)} unit="rumah" active={yourTurn && !s.result} />}
      toast={toast}
      board={<div className="tt-board" />}
      bottom={
        <>
          <NextHint next={next} yours={yourTurn} />
          {yourTurn && actions}
        </>
      }
    >
      <div className="tt-stage">
        <TengView r={m.r} looks={looks} gundu={[gundu, rukiahGundu]} houses={g.houses} colors={[player.color, RUKIAH.color]} />
      </div>
      <div className="tt-status" aria-live="off">
        <span>{g.turn === YOU ? player.name : RUKIAH.name}</span>
        <b>{status}</b>
        <span>· sasaran {goal} rumah</span>
      </div>
      {yourTurn && s.aim && <PowerMeter r={m.r} level={level} target={stage.stage === 'petak' ? stage.target : null} />}
      {s.lastGood?.perfect && (
        <p className="tt-nice" key={s.lastGood.key}>
          Cantik!
        </p>
      )}
      {s.result && !rematch && <Result result={s.result} playerName={player.name} onAgain={() => (sfx.select(), setRematch(true))} onExit={onExit} />}
      {rematch && <OsomPanel opponent={RUKIAH.name} onDone={onRematch} />}
      {showRules && <RulesSheet game="teng-teng" rules={RULES} onClose={() => setShowRules(false)} />}
    </Scene>
  )
}

function MatchHolder({ firstStarter, ...props }) {
  const [game, setGame] = useState({ n: 0, starter: firstStarter })
  return <Match key={game.n} {...props} starter={game.starter} onRematch={(who) => setGame((x) => ({ n: x.n + 1, starter: who }))} />
}

export function TengTengGame({ onExit }) {
  const player = usePlayerLook()
  const gender = usePlayerState((st) => st.playerGender)
  const look = CHILD_LOOKS[gender] ?? CHILD_LOOKS[GENDERS.LELAKI]
  const [phase, setPhase] = useState('intro')
  const [starter, setStarter] = useState(YOU)
  const [level, setLevel] = useState('biasa')
  const [gundu, setGundu] = useState('genting')
  const [goal, setGoal] = useState(2)
  const [records, setRecords] = useState(loadRecords)
  const onRecords = useMemo(() => (next) => setRecords(next), [])

  if (phase !== 'play') {
    return (
      <Intro
        player={player}
        level={level}
        setLevel={setLevel}
        gundu={gundu}
        setGundu={setGundu}
        goal={goal}
        setGoal={setGoal}
        records={records}
        onExit={onExit}
        onStart={() => (sfx.select(), setPhase('osom'))}
        osom={phase === 'osom'}
        onOsomDone={(who) => {
          setStarter(who)
          setPhase('play')
        }}
      />
    )
  }
  return <MatchHolder level={level} goal={goal} gundu={gundu} player={player} look={look} firstStarter={starter} onExit={onExit} onRecords={onRecords} />
}
