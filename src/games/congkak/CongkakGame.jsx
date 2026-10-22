import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { sfx, voice } from '../../audio/engine'
import {
  ExitButton,
  HoldFast,
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
  'Mula-mula osom (batu, air, burung) untuk tentukan siapa main dulu. Batu menang burung, burung menang air, air menang batu.',
  'Setiap lubang kecil ada 7 biji. Rumah (lubang besar) bermula kosong. Rumah kamu di sebelah kiri kamu.',
  'Pilih satu lubang di barisan kamu. Agihkan biji satu demi satu ikut arah jam: ke kiri sepanjang barisan kamu, masuk rumah kamu, kemudian ke barisan Aisyah. Rumah Aisyah dilangkau.',
  'Biji terakhir masuk rumah kamu: main lagi.',
  'Biji terakhir jatuh dalam lubang yang berisi: kaut semua dan terus agihkan.',
  'Biji terakhir jatuh dalam lubang kosong di barisan kamu: tembak. Biji itu dan semua biji di lubang bertentangan masuk rumah kamu.',
  'Tapi tembak hanya dibenarkan selepas kamu cukup satu pusingan, iaitu biji kamu pernah melalui rumah kamu sendiri. Sebelum itu, biji terakhir hanya tinggal di lubang tu dan giliran tamat.',
  'Bila satu pihak tiada biji lagi, pihak satu lagi kutip baki di barisannya. Biji paling banyak dalam rumah menang.',
]

const START = createBoard()

const AISYAH_COLOR = '#e9b52f'
const AISYAH_IMG = '/avatars/aisyah.webp'

function Intro({ level, setLevel, records, player, onStart, onExit, osom, onOsomDone }) {
  const [showRules, setShowRules] = useState(false)
  return (
    <Scene
      className="cg"
      top={
        <>
          <ExitButton onExit={onExit} />
          <RulesButton onOpen={() => setShowRules(true)} />
        </>
      }
      them={<PlayerCard side="them" name="Aisyah" color={AISYAH_COLOR} img={AISYAH_IMG} score={0} unit="guli" />}
      you={<PlayerCard side="you" name={player.name} color={player.color} img={player.img} score={0} unit="guli" />}
      board={<CongkakBoard pits={START} />}
    >
      {osom ? (
        <OsomPanel opponent="Aisyah" onDone={onOsomDone} />
      ) : (
      <IntroPanel
        title="Aisyah ajak kamu main congkak!"
        opponent="Aisyah"
        levels={LEVELS}
        level={level}
        setLevel={setLevel}
        recordsLine={recordsSummary(records, `skor terbaik ${records.best} biji`)}
        onStart={onStart}
      />
      )}
      {showRules && <RulesSheet game="congkak" rules={RULES} onClose={() => setShowRules(false)} />}
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
    <ResultPanel
      title={title}
      win={result.winner === PLAYER}
      mine={you}
      theirs={them}
      myName={playerName}
      theirName="Aisyah"
      line={line}
      extra={saved?.newBest ? `Skor terbaik baharu: ${you} biji!` : null}
      onAgain={onAgain}
      onExit={onExit}
    />
  )
}

function Match({ level, player, firstStarter, onExit, onRecords }) {
  const [starter, setStarter] = useState(firstStarter)
  const [rematch, setRematch] = useState(false)
  const { pits, turn, animating, hand, flash, banner, speech, result, fast, setFast, playHouse, skip, restart, scores, say } =
    useCongkakMatch({ level, starter })
  const [saved, setSaved] = useState(null)
  const [hoverPit, setHoverPit] = useState(null)
  const [slap, setSlap] = useState(null)
  const lastSlap = useRef(0)
  const boardRef = useRef(null)

  useEffect(() => voice.preload(SABAR_URLS), [])

  // what just happened, in big type over the board
  const toast = useTurnToast({ yourTurn: turn === PLAYER, finished: Boolean(result), banner, theirName: 'Aisyah' })

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

  // Main lagi: osom again to decide who starts
  const again = () => {
    sfx.select()
    setRematch(true)
  }
  const startAgain = (nextStarter) => {
    setRematch(false)
    setStarter(nextStarter)
    setSaved(null)
    restart(nextStarter)
  }

  const theirTurn = turn === OPPONENT && !result

  return (
    <Scene
      className="cg"
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
          unit="guli"
          active={theirTurn}
        >
          <Speech says={speech} />
        </PlayerCard>
      }
      you={<PlayerCard side="you" name={player.name} color={player.color} img={player.img} score={scores[0]} unit="guli" active={yourTurn} />}
      toast={toast}
      board={
        <div className={`gs-board-hit ${animating ? 'is-skippable' : ''}`} onClick={animating ? skip : undefined}>
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
              playerSleeve={player.color}
              moveMs={fast ? 135 : 265}
            />
          </CongkakBoard>
        </div>
      }
      bottom={<NextHint next={next} yours={yourTurn && !animating} />}
    >
      {result && !rematch && <Result result={result} saved={saved} playerName={player.name} onAgain={again} onExit={onExit} />}
      {rematch && <OsomPanel opponent="Aisyah" onDone={startAgain} />}
    </Scene>
  )
}

export function CongkakGame({ onExit }) {
  const player = usePlayerLook()
  const [phase, setPhase] = useState('intro') // intro → osom → play
  const [starter, setStarter] = useState(PLAYER)
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
  return <Match level={level} player={player} firstStarter={starter} onExit={onExit} onRecords={onRecords} />
}
