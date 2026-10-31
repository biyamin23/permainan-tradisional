import { memo } from 'react'
import { isStore } from './engine'

/**
 * A carved congkak board seen from above, sown clockwise like the real thing:
 * your rumah is on your left, seeds travel right → left along your row, then
 * left → right along the other side.
 *
 * The board always lies across the screen: Aisyah's row on top, yours at the
 * bottom, your rumah on the left. A kampung that is terbakar (couldn't be
 * filled for a later pusingan) is charred and out of play.
 */

// grid cell for each position ([column, row])
function placement(index) {
  if (index === 7) return [1, '1 / span 2']
  if (index === 15) return [9, '1 / span 2']
  if (index < 7) return [8 - index, 2]
  return [2 + index - 8, 1]
}

const GOLDEN = 2.399963
// glass guli: greens, blues and teals like the old jar of marbles
const GULI = ['#1f9a5a', '#2a6fc9', '#17a3a3', '#3cb371', '#1d5fa8', '#5fbf3a', '#0f8a8a', '#3d86e0']

function Marbles({ count, store }) {
  const cap = store ? 44 : 14
  const shown = Math.min(count, cap)
  const spread = store ? 36 : 30
  const marbles = []
  for (let i = 0; i < shown; i++) {
    const r = Math.sqrt((i + 0.5) / cap) * spread
    const a = i * GOLDEN
    marbles.push(
      <span
        key={i}
        className="cg-guli"
        style={{
          left: `${50 + Math.cos(a) * r}%`,
          top: `${50 + Math.sin(a) * r * (store ? 1.25 : 1)}%`,
          '--g': GULI[(i * 5 + count) % GULI.length],
        }}
      />,
    )
  }
  return marbles
}

function Pit({ index, count, burnt, playable, flashing, onPlay, onHover }) {
  const place = placement(index)
  const store = isStore(index)
  const mine = index <= 7
  const className = [
    'cg-pit',
    store ? 'cg-pit--store' : '',
    mine ? 'is-mine' : 'is-theirs',
    playable ? 'is-playable' : '',
    flashing ? 'is-flashing' : '',
    burnt ? 'is-burnt' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const style = { gridColumn: place[0], gridRow: place[1] }
  const Tag = store ? 'div' : 'button'
  const label = store
    ? `Rumah ${mine ? 'kamu' : 'Aisyah'}, ${count} biji`
    : `${mine ? 'Lubang kamu' : 'Lubang Aisyah'} ${mine ? index + 1 : index - 7}, ${burnt ? 'terbakar' : `${count} biji`}`

  return (
    <Tag
      {...(store
        ? {}
        : {
            type: 'button',
            onClick: (event) => onPlay?.(index, event),
            onPointerEnter: (event) => event.pointerType === 'mouse' && onHover?.(index),
            onPointerLeave: () => onHover?.(null),
            'aria-disabled': !playable,
          })}
      data-pit={index}
      className={className}
      style={style}
      aria-label={label}
    >
      <span className="cg-pit__hole">
        <Marbles count={count} store={store} />
      </span>
      <span className="cg-pit__count" aria-hidden="true">
        {burnt ? '🔥' : count}
      </span>
    </Tag>
  )
}

export const CongkakBoard = memo(function CongkakBoard({ pits, burnt = null, canPlay = false, flash = null, onPlay, onHover, boardRef, children }) {
  return (
    <div className="cg-board" ref={boardRef} role="group" aria-label="Papan congkak">
      {pits.map((count, index) => (
        <Pit
          key={`${index}-${flash && flash.pits.includes(index) ? flash.key : 0}`}
          index={index}
          count={count}
          burnt={Boolean(burnt?.[index])}
          playable={canPlay && index < 7 && count > 0 && !burnt?.[index]}
          flashing={Boolean(flash && flash.pits.includes(index))}
          onPlay={onPlay}
          onHover={onHover}
        />
      ))}
      {children}
    </div>
  )
})
