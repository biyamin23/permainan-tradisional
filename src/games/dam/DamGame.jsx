import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { sfx } from '../../audio/engine'
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
  lookOf,
  recordsSummary,
  usePlayerLook,
  useTurnToast,
} from '../shared/GameShell'
import { streamFor } from '../shared/rng'
import { OnlineLobby } from '../online/OnlineLobby'
import { createMatch, explainMatchError, joinMatch, settledOffBoard } from '../../cloud/match'
import { GAME_MODES } from '../../state/playerState'
import { useProgressSession } from '../../components/progress/Progress'
import { completeGame } from '../../progression/engine'
import { DamBoard } from './DamBoard'
import { OPPONENT, PLAYER } from './engine'
import { loadRecords, saveResult } from './records'
import { useDamMatch } from './useDamMatch'
import './dam.css'

/**
 * Dam at the kedai kopi, against Pak Tam. Same screen as Congkak: players at
 * the top, the board on the table, what to do next and the buttons at the
 * bottom.
 */

const PAK_TAM_IMG = '/avatars/pak-tam.webp'
const PAK_TAM_COLOR = '#8a7a5a'


const RULES = [
  'Mula-mula osom (batu, air, burung) untuk tentukan siapa main dulu. Batu menang burung, burung menang air, air menang batu.',
  'Setiap pemain ada 12 buah (penutup botol) di petak gelap. Buah kamu yang biru, di bawah.',
  'Buah bergerak satu petak serong ke depan.',
  'Makan: lompat ke depan atas buah lawan yang bersebelahan ke petak kosong di belakangnya. Buah biasa tak boleh undur atau makan ke belakang.',
  'Makan itu wajib. Kalau selepas melompat boleh makan lagi, teruskan dalam giliran yang sama.',
  'Buah yang sampai ke hujung papan naik haji. Haji masih gerak satu petak serong, tapi boleh ke depan dan ke belakang, dan boleh makan ke belakang.',
  'Kamu menang bila semua buah Pak Tam habis atau dia tak boleh bergerak lagi.',
]


function Result({ result, reward, playerName, onAgain, onExit }) {
  const [mine, theirs] = result.pieces
  const win = result.winner === PLAYER
  const title = win ? 'Kamu menang!' : result.winner === OPPONENT ? 'Pak Tam menang!' : 'Seri!'
  const line = win
    ? 'Pak Tam ketawa besar. "Esok kita lawan lagi, ya!"'
    : result.winner === OPPONENT
      ? 'Pak Tam hirup kopi. "Belajar lagi, cu."'
      : 'Lama sangat tak ada siapa makan. Seri.'
  return (
    <ResultPanel
      title={title}
      win={win}
      mine={mine}
      theirs={theirs}
      myName={playerName}
      theirName="Pak Tam"
      line={line}
      extra="Nombor di atas ialah buah yang masih tinggal di papan."
      reward={reward}
      onAgain={onAgain}
      onExit={onExit}
    />
  )
}

function Intro({ records, player, onStart, onExit, osom, onOsomDone }) {
  const [showRules, setShowRules] = useState(false)
  return (
    <Scene
      className="dm dm--intro"
      top={
        <>
          <ExitButton onExit={onExit} />
          <RulesButton onOpen={() => setShowRules(true)} />
        </>
      }
      them={<PlayerCard side="them" name="Pak Tam" color={PAK_TAM_COLOR} img={PAK_TAM_IMG} score={12} unit="buah" />}
      you={<PlayerCard side="you" name={player.name} color={player.color} img={player.img} score={12} unit="buah" />}
      board={null}
    >
      {osom ? (
        <OsomPanel opponent="Pak Tam" onDone={onOsomDone} />
      ) : (
      <IntroPanel
        title="Pak Tam ajak kamu main dam. Kopi dah sampai!"
        opponent="Pak Tam"
        recordsLine={recordsSummary(records)}
        onStart={onStart}
      />
      )}
      {showRules && <RulesSheet game="dam" rules={RULES} onClose={() => setShowRules(false)} />}
    </Scene>
  )
}

const WHY = {
  'must-capture': ['Wajib makan! Pilih buah yang bercahaya.', 'bad'],
  blocked: ['Buah tu tak boleh gerak. Pilih buah yang bercahaya.', 'bad'],
  theirs: ['Itu buah Pak Tam. Buah kamu yang biru.', 'bad'],
  chain: ['Teruskan makan! Tekan bulatan kuning.', 'bad'],
  wait: ['Sabar, giliran Pak Tam.', 'them'],
}

function Match({ player, firstStarter, onExit, onRecords }) {
  const [starter, setStarter] = useState(firstStarter)
  const [rematch, setRematch] = useState(false)
  const [showRules, setShowRules] = useState(false)
  // Pak Tam's play for this match follows your Dam progress
  const [round, setRound] = useState(0)
  const session = useProgressSession('dam', round)
  const [reward, setReward] = useState(null)
  const m = useDamMatch({ level: session.tuning, starter })
  const yourTurn = m.turn === PLAYER && !m.result
  const toast = useTurnToast({ yourTurn, finished: Boolean(m.result), banner: m.banner, theirName: 'Pak Tam' })

  useEffect(() => {
    if (!m.result) return
    onRecords(saveResult(m.result))
    const [mine, theirs] = m.result.pieces
    setReward(completeGame(session, { won: m.result.winner === PLAYER, draw: m.result.winner === null, score: mine, theirs, lost: 12 - mine }))
  }, [m.result, onRecords, session])

  const { tapSquare, say } = m
  const onSquare = useCallback(
    (sq) => {
      const outcome = tapSquare(sq)
      const why = WHY[outcome]
      if (why) say(why[0], why[1])
    },
    [tapSquare, say],
  )

  const next = m.result
    ? null
    : yourTurn
      ? m.busy
        ? { icon: '✋', text: 'Buah sedang bergerak…' }
        : m.path.length
          ? { icon: '👆', text: 'Teruskan makan! Tekan bulatan kuning.' }
          : m.selected !== null
            ? { icon: '👆', text: 'Tekan bulatan kuning untuk gerak. Tekan buah lain untuk tukar.' }
            : m.mustCapture
              ? { icon: '⚠️', text: 'Wajib makan! Pilih buah yang bercahaya.' }
              : { icon: '👆', text: 'Pilih buah biru yang bercahaya.' }
      : m.busy
        ? { icon: '⏳', text: 'Pak Tam sedang bergerak…' }
        : { icon: '☕', text: 'Pak Tam hirup kopi sambil berfikir…' }

  // Main lagi: osom again to decide who starts
  const again = () => {
    sfx.select()
    setRematch(true)
  }
  const startAgain = (nextStarter) => {
    setRematch(false)
    setStarter(nextStarter)
    setReward(null)
    setRound((r) => r + 1)
    m.restart(nextStarter)
  }

  return (
    <Scene
      className="dm"
      top={
        <>
          <ExitButton onExit={onExit} />
          <RulesButton onOpen={() => setShowRules(true)} />
        </>
      }
      them={
        <PlayerCard
          side="them"
          name="Pak Tam"
          color={PAK_TAM_COLOR}
          img={PAK_TAM_IMG}
          score={m.pieces[1]}
          unit="buah"
          active={m.turn === OPPONENT && !m.result}
        >
          <Speech says={m.speech} />
        </PlayerCard>
      }
      you={
        <PlayerCard side="you" name={player.name} color={player.color} img={player.img} score={m.pieces[0]} unit="buah" active={yourTurn} />
      }
      toast={toast}
      board={
        <DamBoard
          board={m.board}
          ids={m.ids}
          selected={m.path.length ? m.path[m.path.length - 1] : m.selected}
          targets={yourTurn && !m.busy ? m.targets : []}
          movable={m.movable}
          moving={m.moving}
          fading={m.fading}
          lastMove={m.lastMove}
          onSquare={onSquare}
        />
      }
      bottom={<NextHint next={next} yours={yourTurn && !m.busy} />}
    >
      {m.result && !rematch && <Result result={m.result} reward={reward} playerName={player.name} onAgain={again} onExit={onExit} />}
      {rematch && <OsomPanel opponent="Pak Tam" onDone={startAgain} />}
      {showRules && <RulesSheet game="dam" rules={RULES} onClose={() => setShowRules(false)} />}
    </Scene>
  )
}


// ---------------------------------------------------------------- online

const AWAY_CLAIM_S = 60 // your friend's connection has been gone this long: you may claim the win

/** Dam against a friend: same table, their moves come over the internet. */
function OnlineMatch({ net, player, onLeave, onNewMatch, onRecords }) {
  const them = lookOf(net.opponent)
  // who starts comes from the match's seed, so both screens agree
  const starter = useMemo(
    () => ((streamFor(net.match.seed, 'starter')() < 0.5 ? 0 : 1) === net.seat ? PLAYER : OPPONENT),
    [net.match.seed, net.seat],
  )
  const session = useProgressSession('dam', 0)
  const [reward, setReward] = useState(null)
  const [forfeit, setForfeit] = useState(null) // the other player left: you win
  const [showRules, setShowRules] = useState(false)
  const [exitArmed, setExitArmed] = useState(false)
  const [awaySince, setAwaySince] = useState(null)
  const [now, setNow] = useState(Date.now())
  // a match that was already over when you opened it gives no XP again
  const overBefore = useRef(net.match.status !== 'playing')
  const m = useDamMatch({ level: session.tuning, starter, net, them: them.name })
  const result = m.result ?? forfeit
  const yourTurn = m.turn === PLAYER && !result
  const toast = useTurnToast({ yourTurn, finished: Boolean(result), banner: m.banner, theirName: them.name })

  // the other player walked away
  const rebuiltSeen = useRef(false)
  useEffect(() => {
    if (result) return
    if (net.opponentLeft) {
      setForfeit({ winner: PLAYER, reason: 'tinggal', pieces: m.pieces })
      return
    }
    // settled while you were away (they claimed the win, or you'd left);
    // checked from the render after the board was rebuilt, so the count is right
    if (!rebuiltSeen.current) {
      rebuiltSeen.current = net.loaded
      return
    }
    const settled = settledOffBoard(net.match, net.seat)
    if (settled) setForfeit({ winner: settled.winner === 'me' ? PLAYER : settled.winner === 'them' ? OPPONENT : null, reason: settled.reason, pieces: m.pieces })
  }, [net.opponentLeft, net.match, net.seat, net.loaded, result, m.pieces])

  // their connection dropped: count how long
  useEffect(() => {
    if (net.opponentOnline || result) {
      setAwaySince(null)
      return undefined
    }
    setAwaySince((t) => t ?? Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [net.opponentOnline, result])
  const awayFor = awaySince ? Math.floor((now - awaySince) / 1000) : 0

  // the end: report it, keep the record, give XP (once)
  const { finish } = net
  useEffect(() => {
    if (!result || overBefore.current) return
    overBefore.current = true
    const winnerSeat = result.winner === null ? null : result.winner === PLAYER ? net.seat : 1 - net.seat
    finish(winnerSeat, { pieces: result.pieces, reason: result.reason })
    onRecords(saveResult(result))
    const [mine, theirs] = result.pieces
    setReward(completeGame(session, { won: result.winner === PLAYER, draw: result.winner === null, score: mine, theirs, lost: 12 - mine }))
  }, [result, finish, net.seat, onRecords, session])

  const { tapSquare, say } = m
  const onSquare = useCallback(
    (sq) => {
      const outcome = tapSquare(sq)
      if (outcome === 'wait') return say(`Sabar, giliran ${them.name}.`, 'them')
      if (outcome === 'theirs') return say(`Itu buah ${them.name}. Buah kamu yang biru.`, 'bad')
      const why = WHY[outcome]
      if (why) say(why[0], why[1])
      return undefined
    },
    [tapSquare, say, them.name],
  )

  // leaving mid-game gives the win away: tap twice
  const exit = () => {
    if (result) return onLeave()
    if (exitArmed) return onLeave()
    setExitArmed(true)
    say('Keluar sekarang dikira kalah. Tekan Keluar sekali lagi.', 'bad')
    setTimeout(() => setExitArmed(false), 3000)
    return undefined
  }

  const claim = () => {
    sfx.select()
    setForfeit({ winner: PLAYER, reason: 'terputus', pieces: m.pieces })
  }

  // Main lagi: accept their invite, or send one
  const [againBusy, setAgainBusy] = useState(false)
  const again = async () => {
    if (againBusy) return
    sfx.select()
    setAgainBusy(true)
    try {
      if (net.rematch) onNewMatch(await joinMatch(net.rematch))
      else {
        const fresh = await createMatch('dam')
        net.offerRematch(fresh.code)
        onNewMatch(fresh)
      }
    } catch (e) {
      say(explainMatchError(e), 'bad')
      setAgainBusy(false)
    }
  }

  const next = result
    ? null
    : !net.opponentOnline
      ? { icon: '📶', text: `${them.name} terputus. Menunggu dia kembali… (${awayFor}s)` }
      : yourTurn
        ? m.busy
          ? { icon: '✋', text: 'Buah sedang bergerak…' }
          : m.path.length
            ? { icon: '👆', text: 'Teruskan makan! Tekan bulatan kuning.' }
            : m.selected !== null
              ? { icon: '👆', text: 'Tekan bulatan kuning untuk gerak. Tekan buah lain untuk tukar.' }
              : m.mustCapture
                ? { icon: '⚠️', text: 'Wajib makan! Pilih buah yang bercahaya.' }
                : { icon: '👆', text: 'Pilih buah biru yang bercahaya.' }
        : m.busy
          ? { icon: '⏳', text: `${them.name} sedang bergerak…` }
          : { icon: '🤔', text: `${them.name} sedang berfikir…` }

  const win = result?.winner === PLAYER
  const title = win ? 'Kamu menang!' : result?.winner === OPPONENT ? `${them.name} menang!` : 'Seri!'
  const line = net.rematch
    ? `${them.name} ajak main lagi! Tekan Main lagi untuk terima.`
    : result?.reason === 'tinggal'
      ? win
        ? `${them.name} dah keluar. Kamu menang.`
        : `Kamu keluar dari perlawanan. ${them.name} menang.`
      : result?.reason === 'terputus'
        ? win
          ? `${them.name} terputus terlalu lama. Kamu menang.`
          : `Kamu terputus terlalu lama. ${them.name} menang.`
        : win
          ? 'Hebat! Ajak dia lawan sekali lagi.'
          : result?.winner === OPPONENT
            ? 'Kalah menang adat bermain. Cuba lagi!'
            : 'Lama sangat tak ada siapa makan. Seri.'

  return (
    <Scene
      className="dm"
      top={
        <>
          <ExitButton onExit={exit} />
          <RulesButton onOpen={() => setShowRules(true)} />
        </>
      }
      them={
        <PlayerCard side="them" name={them.name} color={them.color} img={them.img} score={m.pieces[1]} unit="buah" active={m.turn === OPPONENT && !result} />
      }
      you={<PlayerCard side="you" name={player.name} color={player.color} img={player.img} score={m.pieces[0]} unit="buah" active={yourTurn} />}
      toast={toast}
      board={
        <DamBoard
          board={m.board}
          ids={m.ids}
          selected={m.path.length ? m.path[m.path.length - 1] : m.selected}
          targets={yourTurn && !m.busy ? m.targets : []}
          movable={result ? [] : m.movable}
          moving={m.moving}
          fading={m.fading}
          lastMove={m.lastMove}
          onSquare={onSquare}
        />
      }
      bottom={
        <>
          <NextHint next={next} yours={yourTurn && !m.busy && net.opponentOnline} />
          {!result && !net.opponentOnline && awayFor >= AWAY_CLAIM_S && (
            <button type="button" className="gs-btn gs-btn--go ol-away" onClick={claim}>
              Tuntut kemenangan
            </button>
          )}
        </>
      }
    >
      {result && (
        <ResultPanel
          title={title}
          win={win}
          mine={result.pieces[0]}
          theirs={result.pieces[1]}
          myName={player.name}
          theirName={them.name}
          line={line}
          extra="Nombor di atas ialah buah yang masih tinggal di papan."
          reward={reward}
          onAgain={again}
          onExit={onLeave}
        />
      )}
      {showRules && <RulesSheet game="dam" rules={RULES} onClose={() => setShowRules(false)} />}
    </Scene>
  )
}

/** Main dengan kawan: the lobby, then the match. */
function OnlineDam({ player, onExit, onRecords }) {
  const frame = (panel) => (
    <Scene
      className="dm dm--intro"
      top={<ExitButton onExit={onExit} />}
      them={<PlayerCard side="them" name="Kawan" color={PAK_TAM_COLOR} img={lookOf().img} score={12} unit="buah" />}
      you={<PlayerCard side="you" name={player.name} color={player.color} img={player.img} score={12} unit="buah" />}
      board={null}
    >
      {panel}
    </Scene>
  )
  return (
    <OnlineLobby gameId="dam" frame={frame} onExit={onExit}>
      {({ net, leave, onNewMatch }) => <OnlineMatch net={net} player={player} onLeave={leave} onNewMatch={onNewMatch} onRecords={onRecords} />}
    </OnlineLobby>
  )
}

export function DamGame({ mode, onExit }) {
  const player = usePlayerLook()
  const [phase, setPhase] = useState('intro') // intro → osom → play
  const [starter, setStarter] = useState(PLAYER)
  const [records, setRecords] = useState(loadRecords)
  const onRecords = useMemo(() => (next) => setRecords(next), [])

  if (mode === GAME_MODES.MULTIPLAYER) return <OnlineDam player={player} onExit={onExit} onRecords={onRecords} />

  if (phase !== 'play') {
    return (
      <Intro
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
  return <Match player={player} firstStarter={starter} onExit={onExit} onRecords={onRecords} />
}

