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
  lookOf,
  recordsSummary,
  usePlayerLook,
  useTurnToast,
} from '../shared/GameShell'
import { OnlineLobby } from '../online/OnlineLobby'
import { createMatch, explainMatchError, joinMatch, settledOffBoard } from '../../cloud/match'
import { GAME_MODES } from '../../state/playerState'
import { useProgressSession } from '../../components/progress/Progress'
import { completeGame } from '../../progression/engine'
import { CongkakBoard } from './CongkakBoard'
import { MAX_ROUNDS, OPPONENT, PLAYER, burntCount, createBoard } from './engine'
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

function Result({ result, saved, reward, playerName, onAgain, onExit, theirName = 'Aisyah', online = false, rematch = false }) {
  const [you, them] = result.scores
  const title = result.winner === PLAYER ? 'Kamu menang!' : result.winner === OPPONENT ? `${theirName} menang!` : 'Seri!'
  const burntLine = `${result.rounds} pusingan · kampung terbakar: kamu ${result.burnt[0]}, ${theirName} ${result.burnt[1]}`
  const mood =
    result.winner === PLAYER
      ? online
        ? 'Hebat! Ajak dia lawan sekali lagi.'
        : 'Aisyah tersenyum kelat. Dia nak lawan lagi.'
      : result.winner === OPPONENT
        ? 'Kalah menang adat bermain. Cuba sekali lagi.'
        : 'Sama kuat. Lawan sekali lagi?'
  const line = rematch
    ? `${theirName} ajak main lagi! Tekan Main lagi untuk terima.`
    : result.reason === 'tinggal'
      ? result.winner === PLAYER
        ? `${theirName} dah keluar. Kamu menang.`
        : `Kamu keluar dari perlawanan. ${theirName} menang.`
      : result.reason === 'terputus'
        ? result.winner === PLAYER
          ? `${theirName} terputus terlalu lama. Kamu menang.`
          : `Kamu terputus terlalu lama. ${theirName} menang.`
        : result.tieBreak
          ? `Guli sama banyak, tapi ${result.winner === PLAYER ? theirName : 'kamu'} lebih banyak kampung terbakar. ${burntLine}.`
          : `${mood} ${burntLine}.`
  return (
    <ResultPanel
      title={title}
      win={result.winner === PLAYER}
      mine={you}
      theirs={them}
      myName={playerName}
      theirName={theirName}
      line={line}
      extra={saved?.newBest ? `Skor terbaik baharu: ${you} biji!` : null}
      reward={reward}
      onAgain={onAgain}
      onExit={onExit}
    />
  )
}

const AWAY_CLAIM_S = 60 // online: your friend's connection has been gone this long: you may claim the win

/**
 * A match against Aisyah, or (with `online` = { net, onLeave, onNewMatch })
 * against a friend over the internet.
 */
function Match({ player, onExit, onRecords, online = null }) {
  const net = online?.net ?? null
  const rival = net ? lookOf(net.opponent) : { name: 'Aisyah', img: AISYAH_IMG, color: AISYAH_COLOR }
  // Aisyah's play for this match follows your Congkak progress
  const [match, setMatch] = useState(0)
  const session = useProgressSession('congkak', match)
  const [reward, setReward] = useState(null)
  const m = useCongkakMatch({ level: session.tuning, net, them: rival.name })
  const { pits, burnt, round, phase, youPick, canSkip, canFast, turn, movers, animating, hands, flash, banner, speech, fast, setFast, playHouse, skip, restart, scores, say } = m
  // online: the other player left, or dropped out too long: you win
  const [forfeit, setForfeit] = useState(null)
  const result = m.result ?? forfeit
  const [exitArmed, setExitArmed] = useState(false)
  const [awaySince, setAwaySince] = useState(null)
  const [clock, setClock] = useState(Date.now())
  // a match that was already over when you opened it gives no XP again
  const overBefore = useRef(net ? net.match.status !== 'playing' : false)
  const [saved, setSaved] = useState(null)
  const [hoverPit, setHoverPit] = useState(null)
  const [slap, setSlap] = useState(null)
  const lastSlap = useRef(0)
  const boardRef = useRef(null)

  useEffect(() => voice.preload(SABAR_URLS), [])

  // what just happened, in big type over the board
  const toast = useTurnToast({ yourTurn: phase === 'opening' || (phase === 'play' && turn === PLAYER), finished: Boolean(result), banner, theirName: rival.name })

  const forfeitResult = (reason, winner = PLAYER) => ({
    scores,
    burnt: [burntCount(burnt, PLAYER), burntCount(burnt, OPPONENT)],
    rounds: round,
    winner,
    tieBreak: false,
    reason,
  })

  // online: the other player walked away, or the match was settled while you were away
  // (checked from the render after the board was rebuilt, so the scores are right)
  const rebuiltSeen = useRef(false)
  useEffect(() => {
    if (!net || result) return
    if (net.opponentLeft) return setForfeit(forfeitResult('tinggal'))
    if (!rebuiltSeen.current) {
      rebuiltSeen.current = net.loaded
      return
    }
    const settled = settledOffBoard(net.match, net.seat)
    if (settled) setForfeit(forfeitResult(settled.reason, settled.winner === 'me' ? PLAYER : settled.winner === 'them' ? OPPONENT : null))
  }) // eslint-disable-line react-hooks/exhaustive-deps

  // online: their connection dropped: count how long
  const friendOnline = net ? net.opponentOnline : true
  useEffect(() => {
    if (friendOnline || result) {
      setAwaySince(null)
      return undefined
    }
    setAwaySince((t) => t ?? Date.now())
    const id = setInterval(() => setClock(Date.now()), 1000)
    return () => clearInterval(id)
  }, [friendOnline, result])
  const awayFor = awaySince ? Math.floor((clock - awaySince) / 1000) : 0

  /** Every tap on a hole: play it, or explain why not (with a tepis on Aisyah's turn). */
  const onPitTap = useCallback(
    (index, event) => {
      const outcome = playHouse(index)
      // picking again mid-start: don't let the same tap skip ahead
      if (outcome === 'played') event?.stopPropagation()
      if (outcome === 'wait' && net) {
        event?.stopPropagation()
        say(`Sabar, giliran ${rival.name}.`, 'them')
      } else if (outcome === 'wait') {
        event?.stopPropagation()
        if (Date.now() - lastSlap.current > 900) {
          lastSlap.current = Date.now()
          setSlap({ pit: index, key: lastSlap.current })
          // she tells you off (recorded voice) right as her hand lands
          setTimeout(() => voice.playFromGroup('sabar', SABAR_URLS), 280)
        }
      } else if (outcome === 'theirs') {
        event?.stopPropagation()
        say(`Itu lubang ${rival.name}. Pilih lubang di barisan bawah.`, 'bad')
      } else if (outcome === 'empty') {
        say('Lubang tu kosong. Pilih yang ada guli.', 'bad')
      } else if (outcome === 'burnt') {
        say('Kampung tu terbakar. Pilih kampung lain.', 'bad')
      }
    },
    [playHouse, say, net, rival.name],
  )

  useEffect(() => {
    if (!result || overBefore.current) return
    overBefore.current = Boolean(net)
    if (net) {
      const winnerSeat = result.winner === null ? null : result.winner === PLAYER ? net.seat : 1 - net.seat
      net.finish(winnerSeat, { scores: result.scores, burnt: result.burnt, rounds: result.rounds, reason: result.reason ?? null })
    }
    const s = saveResult(result)
    setSaved(s)
    onRecords(s.records)
    const [you, them] = result.scores
    setReward(completeGame(session, { won: result.winner === PLAYER, draw: result.winner === null, score: you, theirs: them, margin: you - them }))
  }, [result, onRecords, session, net])

  const opening = phase === 'opening' && !result
  const together = phase === 'together' && !result
  const yourTurn = (opening || together || (phase === 'play' && turn === PLAYER)) && !result
  // you can pick a kampung right now
  const canTap = (opening || (together && youPick) || (phase === 'play' && turn === PLAYER && !animating)) && !result
  // what to do next, always at the bottom of the screen
  const them = rival.name
  const next = result
    ? null
    : !friendOnline
      ? { icon: '📶', text: `${them} terputus. Menunggu dia kembali… (${awayFor}s)` }
      : opening && m.myOpening !== null
        ? { icon: '⏳', text: m.friendReady ? 'Satu, dua, tiga…' : `Menunggu ${them} pilih kampung…` }
    : opening
      ? { icon: '👆', text: `Pusingan ${round}: pilih satu kampung. Kamu dan ${them} mula serentak!${net && m.friendReady ? ` ${them} dah sedia.` : ''}` }
      : phase === 'between'
        ? { icon: '🔄', text: 'Isi semula kampung…' }
        : together
          ? youPick
            ? { icon: '👆', text: `Masuk rumah! Terus pilih kampung dan sambung, jangan tunggu ${them}` }
            : net && m.dead[PLAYER]
              ? { icon: '⏳', text: `Guli kamu mati. ${them} masih mengagih…` }
              : net && m.dead[OPPONENT]
                ? { icon: '👐', text: `${them} dah mati. Teruskan!` }
            : !canSkip
              ? { icon: '👐', text: 'Serentak! Masuk rumah, terus pilih kampung lagi' }
              : movers.includes(PLAYER)
                ? { icon: '👐', text: `${them} dah mati. Tekan papan untuk langkau` }
                : { icon: '⏳', text: 'Guli kamu mati. Tekan papan untuk langkau' }
          : yourTurn
            ? animating
              ? { icon: '👆', text: canSkip ? 'Tekan papan untuk langkau' : 'Guli sedang diagih…' }
              : { icon: '👆', text: 'Tekan kampung yang bercahaya untuk ambil guli' }
            : animating
              ? { icon: '⏳', text: `${them} sedang mengagih guli…` }
              : { icon: '⏳', text: `Tunggu, ${them} sedang berfikir…` }

  // Main lagi: straight into a new match, both starting together again
  // (online: accept your friend's invite, or send one)
  const [againBusy, setAgainBusy] = useState(false)
  const again = async () => {
    sfx.select()
    if (net) {
      if (againBusy) return
      setAgainBusy(true)
      try {
        if (net.rematch) online.onNewMatch(await joinMatch(net.rematch))
        else {
          const fresh = await createMatch('congkak')
          net.offerRematch(fresh.code)
          online.onNewMatch(fresh)
        }
      } catch (e) {
        say(explainMatchError(e), 'bad')
        setAgainBusy(false)
      }
      return
    }
    setSaved(null)
    setReward(null)
    setMatch((r) => r + 1)
    restart()
  }

  // online, leaving mid-game gives the win away: tap twice
  const exit = () => {
    if (!net) return onExit()
    if (result || exitArmed) return online.onLeave()
    setExitArmed(true)
    say('Keluar sekarang dikira kalah. Tekan Keluar sekali lagi.', 'bad')
    setTimeout(() => setExitArmed(false), 3000)
    return undefined
  }

  const theirTurn = (opening || together || (phase === 'play' && turn === OPPONENT)) && !result

  return (
    <Scene
      className="cg"
      top={
        <>
          <ExitButton onExit={exit} />
          {!result && <HoldFast fast={fast} setFast={setFast} active={canFast} />}
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
          name={rival.name}
          color={rival.color}
          img={rival.img}
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
              theirSleeve={net ? rival.color : undefined}
              moveMs={fast && canFast ? 135 : 265}
            />
          </CongkakBoard>
        </div>
      }
      bottom={
        <>
          <NextHint next={next} yours={canTap && friendOnline} />
          {net && !result && !friendOnline && awayFor >= AWAY_CLAIM_S && (
            <button
              type="button"
              className="gs-btn gs-btn--go ol-away"
              onClick={() => {
                sfx.select()
                setForfeit(forfeitResult('terputus'))
              }}
            >
              Tuntut kemenangan
            </button>
          )}
        </>
      }
    >
      {result && (
        <Result
          result={result}
          saved={saved}
          reward={reward}
          playerName={player.name}
          theirName={rival.name}
          online={Boolean(net)}
          rematch={Boolean(net?.rematch)}
          onAgain={again}
          onExit={net ? online.onLeave : onExit}
        />
      )}
    </Scene>
  )
}

/** Main dengan kawan: the lobby, then the match. */
function OnlineCongkak({ player, onExit, onRecords }) {
  const frame = (panel) => (
    <Scene
      className="cg"
      top={<ExitButton onExit={onExit} />}
      them={<PlayerCard side="them" name="Kawan" color={AISYAH_COLOR} img={lookOf().img} score={0} unit="guli" />}
      you={<PlayerCard side="you" name={player.name} color={player.color} img={player.img} score={0} unit="guli" />}
      board={<CongkakBoard pits={START} />}
    >
      {panel}
    </Scene>
  )
  return (
    <OnlineLobby gameId="congkak" frame={frame} onExit={onExit}>
      {({ net, leave, onNewMatch }) => <Match player={player} onExit={onExit} onRecords={onRecords} online={{ net, onLeave: leave, onNewMatch }} />}
    </OnlineLobby>
  )
}

export function CongkakGame({ mode, onExit }) {
  const player = usePlayerLook()
  const [phase, setPhase] = useState('intro') // intro → play (no osom: you both start together)
  const [records, setRecords] = useState(loadRecords)
  const onRecords = useMemo(() => (next) => setRecords(next), [])

  if (mode === GAME_MODES.MULTIPLAYER) return <OnlineCongkak player={player} onExit={onExit} onRecords={onRecords} />

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
