import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { sfx, voice } from '../../audio/engine'
import {
  ExitButton,
  HoldFast,
  IntroPanel,
  NextHint,
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
import { useProgressSession } from '../../components/progress/Progress'
import { completeGame } from '../../progression/engine'
import { CongkakBoard } from './CongkakBoard'
import { MAX_ROUNDS, OPPONENT, PLAYER, createBoard } from './engine'
import { Hands } from './Hands'
import { loadRecords, saveResult } from './records'
import { useCongkakMatch } from './useCongkakMatch'
import { SABAR_URLS } from './voices'
import './congkak.css'

/**
 * Congkak at the wakaf: the board lies on a mengkuang mat, Aisyah sits across
 * from you. The same scene is used to start, to play and to show the result,
 * so nothing pulls you out of the moment. Rules: engine.js.
 */

const RULES = [
  'Setiap kampung (lubang kecil) ada 7 guli. Rumah (lubang besar) bermula kosong. Rumah kamu di sebelah kiri kamu.',
  'Mula serentak: kamu dan Aisyah sama-sama ambil guli dari satu kampung sendiri dan agih pada masa yang sama, satu demi satu dari kanan ke kiri: sepanjang barisan sendiri, masuk rumah sendiri, kemudian ke kampung lawan. Rumah lawan dilangkau.',
  'Guli terakhir jatuh dalam kampung yang berisi: kaut semua dan terus agih.',
  'Guli terakhir masuk rumah sendiri: teruskan dengan mana-mana kampung sendiri. Masa mula serentak, terus ambil dan sambung, tak perlu tunggu lawan.',
  'Guli terakhir jatuh dalam kampung kosong: mati, giliran tamat. Kalau kampung kosong itu milik sendiri dan guli kamu sudah melalui kampung lawan (satu pusingan), kamu tembak: kaut semua guli di kampung lawan yang setentang.',
  'Selepas permulaan, giliran bersilih ganti, setiap giliran sampai gulinya mati. Siapa mati dulu masa mula serentak, dia main dulu.',
  'Tiada guli di kampung sendiri bila tiba giliran? Giliran berpindah kepada lawan. Pusingan tamat bila semua kampung kosong.',
  'Pusingan seterusnya: setiap pemain isi semula kampung, 7 guli setiap satu, dari guli dalam rumah sendiri. Kampung yang tak cukup guli jadi terbakar dan tak boleh digunakan lagi. Yang tak cukup guli untuk satu kampung pun, kalah.',
  `Permainan tamat selepas ${MAX_ROUNDS} pusingan. Guli paling banyak dalam rumah menang. Kalau sama banyak, yang lebih banyak kampung terbakar kalah.`,
]

const START = createBoard()

const AISYAH_COLOR = '#e9b52f'
const AISYAH_IMG = '/avatars/aisyah.webp'

function Intro({ records, player, onStart, onExit }) {
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
      <IntroPanel
        title="Aisyah ajak kamu main congkak!"
        opponent="Aisyah"
        recordsLine={recordsSummary(records, `skor terbaik ${records.best} biji`)}
        onStart={onStart}
      />
      {showRules && <RulesSheet game="congkak" rules={RULES} onClose={() => setShowRules(false)} />}
    </Scene>
  )
}

function Result({ result, saved, reward, playerName, onAgain, onExit }) {
  const [you, them] = result.scores
  const title = result.winner === PLAYER ? 'Kamu menang!' : result.winner === OPPONENT ? 'Aisyah menang!' : 'Seri!'
  const burntLine = `${result.rounds} pusingan · kampung terbakar: kamu ${result.burnt[0]}, Aisyah ${result.burnt[1]}`
  const mood =
    result.winner === PLAYER
      ? 'Aisyah tersenyum kelat. Dia nak lawan lagi.'
      : result.winner === OPPONENT
        ? 'Kalah menang adat bermain. Cuba sekali lagi.'
        : 'Sama kuat. Lawan sekali lagi?'
  const line = result.tieBreak
    ? `Guli sama banyak, tapi ${result.winner === PLAYER ? 'Aisyah' : 'kamu'} lebih banyak kampung terbakar. ${burntLine}.`
    : `${mood} ${burntLine}.`
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
      reward={reward}
      onAgain={onAgain}
      onExit={onExit}
    />
  )
}

function Match({ player, onExit, onRecords }) {
  // Aisyah's play for this match follows your Congkak progress
  const [match, setMatch] = useState(0)
  const session = useProgressSession('congkak', match)
  const [reward, setReward] = useState(null)
  const { pits, burnt, round, phase, youPick, canSkip, turn, movers, animating, hands, flash, banner, speech, result, fast, setFast, playHouse, skip, restart, scores, say } =
    useCongkakMatch({ level: session.tuning })
  const [saved, setSaved] = useState(null)
  const [hoverPit, setHoverPit] = useState(null)
  const [slap, setSlap] = useState(null)
  const lastSlap = useRef(0)
  const boardRef = useRef(null)

  useEffect(() => voice.preload(SABAR_URLS), [])

  // what just happened, in big type over the board
  const toast = useTurnToast({ yourTurn: phase === 'opening' || (phase === 'play' && turn === PLAYER), finished: Boolean(result), banner, theirName: 'Aisyah' })

  /** Every tap on a hole: play it, or explain why not (with a tepis on Aisyah's turn). */
  const onPitTap = useCallback(
    (index, event) => {
      const outcome = playHouse(index)
      // picking again mid-start: don't let the same tap skip ahead
      if (outcome === 'played') event?.stopPropagation()
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
      } else if (outcome === 'burnt') {
        say('Kampung tu terbakar. Pilih kampung lain.', 'bad')
      }
    },
    [playHouse, say],
  )

  useEffect(() => {
    if (!result) return
    const s = saveResult(result)
    setSaved(s)
    onRecords(s.records)
    const [you, them] = result.scores
    setReward(completeGame(session, { won: result.winner === PLAYER, draw: result.winner === null, score: you, theirs: them, margin: you - them }))
  }, [result, onRecords, session])

  const opening = phase === 'opening' && !result
  const together = phase === 'together' && !result
  const yourTurn = (opening || together || (phase === 'play' && turn === PLAYER)) && !result
  // you can pick a kampung right now
  const canTap = (opening || (together && youPick) || (phase === 'play' && turn === PLAYER && !animating)) && !result
  // what to do next, always at the bottom of the screen
  const next = result
    ? null
    : opening
      ? { icon: '👆', text: `Pusingan ${round}: pilih satu kampung. Kamu dan Aisyah mula serentak!` }
      : phase === 'between'
        ? { icon: '🔄', text: 'Isi semula kampung…' }
        : together
          ? youPick
            ? { icon: '👆', text: 'Masuk rumah! Terus pilih kampung dan sambung, jangan tunggu Aisyah' }
            : !canSkip
              ? { icon: '👐', text: 'Serentak! Masuk rumah, terus pilih kampung lagi' }
              : movers.includes(PLAYER)
                ? { icon: '👐', text: 'Aisyah dah mati. Tekan papan untuk langkau' }
                : { icon: '⏳', text: 'Guli kamu mati. Tekan papan untuk langkau' }
          : yourTurn
            ? animating
              ? { icon: '👆', text: 'Tekan papan untuk langkau' }
              : { icon: '👆', text: 'Tekan kampung yang bercahaya untuk ambil guli' }
            : animating
              ? { icon: '⏳', text: 'Aisyah sedang mengagih guli…' }
              : { icon: '⏳', text: 'Tunggu, Aisyah sedang berfikir…' }

  // Main lagi: straight into a new match, both starting together again
  const again = () => {
    sfx.select()
    setSaved(null)
    setReward(null)
    setMatch((r) => r + 1)
    restart()
  }

  const theirTurn = (opening || together || (phase === 'play' && turn === OPPONENT)) && !result

  return (
    <Scene
      className="cg"
      top={
        <>
          <ExitButton onExit={onExit} />
          {!result && <HoldFast fast={fast} setFast={setFast} active={canSkip} />}
          {!result && (
            <span className="cg-round" aria-live="polite">
              Pusingan {round}/{MAX_ROUNDS}
            </span>
          )}
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
        <div className={`gs-board-hit ${canSkip ? 'is-skippable' : ''}`} onClick={canSkip ? skip : undefined}>
          <CongkakBoard
            pits={pits}
            burnt={burnt}
            canPlay={canTap}
            flash={flash}
            onPlay={onPitTap}
            onHover={(i) => setHoverPit(i !== null && i < 7 && pits[i] > 0 && !burnt[i] ? i : null)}
            boardRef={boardRef}
          >
            <Hands
              boardRef={boardRef}
              sowing={hands}
              turn={phase === 'play' ? turn : null}
              ready={opening || (together && youPick)}
              animating={animating}
              finished={Boolean(result)}
              hoverPit={canTap ? hoverPit : null}
              slap={slap}
              playerSleeve={player.color}
              moveMs={fast && canSkip ? 135 : 265}
            />
          </CongkakBoard>
        </div>
      }
      bottom={<NextHint next={next} yours={canTap} />}
    >
      {result && <Result result={result} saved={saved} reward={reward} playerName={player.name} onAgain={again} onExit={onExit} />}
    </Scene>
  )
}

export function CongkakGame({ onExit }) {
  const player = usePlayerLook()
  const [phase, setPhase] = useState('intro') // intro → play (no osom: you both start together)
  const [records, setRecords] = useState(loadRecords)
  const onRecords = useMemo(() => (next) => setRecords(next), [])

  if (phase !== 'play') {
    return (
      <Intro
        records={records}
        player={player}
        onExit={onExit}
        onStart={() => {
          sfx.select()
          setPhase('play')
        }}
      />
    )
  }
  return <Match player={player} onExit={onExit} onRecords={onRecords} />
}
