import { useCallback, useEffect, useMemo, useState } from 'react'
import { sfx } from '../../audio/engine'
import {
  ExitButton,
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

const LEVELS = [
  { id: 'mudah', label: 'Mudah', note: 'Pak Tam main sambil sembang, selalu leka.' },
  { id: 'biasa', label: 'Biasa', note: 'Pak Tam main betul-betul.' },
  { id: 'pakar', label: 'Pakar', note: 'Pak Tam juara dam kedai kopi ni.' },
]

const RULES = [
  'Setiap pemain ada 12 buah (penutup botol) di petak gelap. Buah kamu yang biru, di bawah.',
  'Buah bergerak satu petak serong ke depan.',
  'Makan: lompat ke depan atas buah lawan yang bersebelahan ke petak kosong di belakangnya. Buah biasa tak boleh undur atau makan ke belakang.',
  'Makan itu wajib. Kalau selepas melompat boleh makan lagi, teruskan dalam giliran yang sama.',
  'Buah yang sampai ke hujung papan naik haji. Haji boleh gerak ke depan dan ke belakang, terbang serong sejauh mana pun, dan makan dari jauh.',
  'Kamu menang bila semua buah Pak Tam habis atau dia tak boleh bergerak lagi.',
]


function Result({ result, playerName, onAgain, onExit }) {
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
      onAgain={onAgain}
      onExit={onExit}
    />
  )
}

function Intro({ level, setLevel, records, player, onStart, onExit }) {
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
      <IntroPanel
        title="Pak Tam ajak kamu main dam. Kopi dah sampai!"
        opponent="Pak Tam"
        levels={LEVELS}
        level={level}
        setLevel={setLevel}
        recordsLine={recordsSummary(records)}
        onStart={onStart}
      />
      {showRules && <RulesSheet game="dam" rules={RULES} onClose={() => setShowRules(false)} />}
    </Scene>
  )
}

const WHY = {
  'must-capture': ['Wajib makan! Pilih buah yang bercahaya.', 'bad'],
  blocked: ['Buah tu tak boleh gerak. Pilih buah yang bercahaya.', 'bad'],
  theirs: ['Itu buah Pak Tam. Buah kamu yang biru.', 'bad'],
  chain: ['Teruskan makan! Ketik bulatan kuning.', 'bad'],
  wait: ['Sabar, giliran Pak Tam.', 'them'],
}

function Match({ level, player, onExit, onRecords }) {
  const [starter, setStarter] = useState(PLAYER)
  const [showRules, setShowRules] = useState(false)
  const m = useDamMatch({ level, starter })
  const yourTurn = m.turn === PLAYER && !m.result
  const toast = useTurnToast({ yourTurn, finished: Boolean(m.result), banner: m.banner, theirName: 'Pak Tam' })

  useEffect(() => {
    if (m.result) onRecords(saveResult(m.result))
  }, [m.result, onRecords])

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
          ? { icon: '👆', text: 'Teruskan makan! Ketik bulatan kuning.' }
          : m.selected !== null
            ? { icon: '👆', text: 'Ketik bulatan kuning untuk gerak. Ketik buah lain untuk tukar.' }
            : m.mustCapture
              ? { icon: '⚠️', text: 'Wajib makan! Pilih buah yang bercahaya.' }
              : { icon: '👆', text: 'Pilih buah biru yang bercahaya.' }
      : m.busy
        ? { icon: '⏳', text: 'Pak Tam sedang bergerak…' }
        : { icon: '☕', text: 'Pak Tam hirup kopi sambil berfikir…' }

  const again = () => {
    sfx.select()
    const nextStarter = 1 - starter
    setStarter(nextStarter)
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
      {m.result && <Result result={m.result} playerName={player.name} onAgain={again} onExit={onExit} />}
      {showRules && <RulesSheet game="dam" rules={RULES} onClose={() => setShowRules(false)} />}
    </Scene>
  )
}

export function DamGame({ onExit }) {
  const player = usePlayerLook()
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
        player={player}
        onExit={onExit}
        onStart={() => {
          sfx.select()
          setPhase('play')
        }}
      />
    )
  }
  return <Match level={level} player={player} onExit={onExit} onRecords={onRecords} />
}

