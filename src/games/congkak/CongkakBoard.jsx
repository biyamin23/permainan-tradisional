import { memo } from 'react'
import { PLAYER, isStore } from './engine'

/**
 * Carved wooden congkak board. Landscape: a long board (player's row at the
 * bottom, stores at the ends). Portrait phones: the board stands upright with
 * your rumah at the bottom, closest to your thumbs.
 */

// grid placement for both orientations
function placement(index) {
  if (index === 15) return { h: [1, '1 / span 2'], v: ['1 / span 2', 1] }
  if (index === 7) return { h: [9, '1 / span 2'], v: ['1 / span 2', 9] }
  if (index < 7) return { h: [index + 2, 2], v: [2, index + 2] }
  const j = index - 8
  return { h: [8 - j, 1], v: [1, 8 - j] }
}

const SEED_COLORS = ['#f4ead6', '#efe0c2', '#f8f1e2', '#e9d8b6', '#f1e6cf']
const GOLDEN = 2.399963

function Seeds({ count, store }) {
  const cap = store ? 40 : 14
  const shown = Math.min(count, cap)
  const spread = store ? 40 : 34
  const dots = []
  for (let i = 0; i < shown; i++) {
    const r = Math.sqrt((i + 0.5) / cap) * spread
    const a = i * GOLDEN
    dots.push(
      <span
        key={i}
        className="cg-seed"
        style={{
          left: `${50 + Math.cos(a) * r}%`,
          top: `${50 + Math.sin(a) * r * (store ? 1.15 : 1)}%`,
          background: SEED_COLORS[i % SEED_COLORS.length],
          transform: `translate(-50%, -50%) rotate(${(i * 47) % 180}deg)`,
        }}
      />,
    )
  }
  return <span className="cg-seeds">{dots}</span>
}

function Pit({ index, count, playable, active, handCount, flashing, onPlay }) {
  const place = placement(index)
  const store = isStore(index)
  const mine = index <= 7
  const style = {
    '--h-col': place.h[0],
    '--h-row': place.h[1],
    '--v-col': place.v[0],
    '--v-row': place.v[1],
  }
  const className = [
    'cg-pit',
    store ? 'cg-pit--store' : '',
    mine ? 'is-mine' : 'is-theirs',
    playable ? 'is-playable' : '',
    active ? 'is-active' : '',
    flashing ? 'is-flashing' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const content = (
    <>
      <span className="cg-pit__hole">
        <Seeds count={count} store={store} />
      </span>
      <span className="cg-pit__count">{count}</span>
      {active && handCount > 0 && <span className="cg-hand">✋ {handCount}</span>}
    </>
  )

  if (store) {
    return (
      <div className={className} style={style} aria-label={`Rumah ${mine ? 'kamu' : 'lawan'}: ${count} biji`}>
        {content}
      </div>
    )
  }
  return (
    <button
      type="button"
      className={className}
      style={style}
      aria-disabled={!playable}
      onClick={() => onPlay(index)}
      aria-label={`${mine ? 'Lubang kamu' : 'Lubang lawan'} ${mine ? index + 1 : index - 7}: ${count} biji`}
    >
      {content}
    </button>
  )
}

export const CongkakBoard = memo(function CongkakBoard({ pits, turn, animating, hand, flash, finished, onPlay }) {
  const canPlay = !animating && !finished && turn === PLAYER
  return (
    <div
      className={`cg-board ${animating ? 'is-animating' : ''}`}
      role="group"
      aria-label="Papan congkak"
    >
      {pits.map((count, index) => (
        <Pit
          key={`${index}-${flash && flash.pits.includes(index) ? flash.key : 0}`}
          index={index}
          count={count}
          playable={canPlay && index < 7 && count > 0}
          active={hand?.pit === index}
          handCount={hand?.pit === index ? hand.count : 0}
          flashing={Boolean(flash && flash.pits.includes(index))}
          onPlay={onPlay}
        />
      ))}
    </div>
  )
})
