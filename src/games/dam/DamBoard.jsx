import { memo } from 'react'
import { colOf, isDark, isKing, ownerOf, rowOf } from './engine'

/**
 * The dam board from the kedai kopi: a plank of light wood with the grid
 * scored into it, played with bottle caps. Yours are blue, Pak Tam's are red.
 * A haji is two caps stacked with a star.
 */

const SQUARES = Array.from({ length: 64 }, (_, sq) => sq)

function Cap({ value, id, sq, selected, movable, fading, isMoving }) {
  const owner = ownerOf(value)
  const className = [
    'dm-cap',
    owner === 0 ? 'is-mine' : 'is-theirs',
    isKing(value) ? 'is-haji' : '',
    selected ? 'is-selected' : '',
    movable ? 'is-movable' : '',
    fading ? 'is-eaten' : '',
    isMoving ? 'is-moving' : '',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <span
      className={className}
      data-cap={id}
      style={{ '--r': rowOf(sq), '--c': colOf(sq) }}
      aria-hidden="true"
    >
      <span className="dm-cap__top" />
    </span>
  )
}

export const DamBoard = memo(function DamBoard({
  board,
  ids,
  selected = null,
  targets = [],
  movable = [],
  moving = null,
  fading = [],
  lastMove = null,
  onSquare,
}) {
  const caps = []
  ids.forEach((id, sq) => {
    if (id === null) return
    const isMoving = moving && moving.id === id
    caps.push(
      <Cap
        key={id}
        id={id}
        value={board[sq]}
        sq={isMoving ? moving.sq : sq}
        selected={sq === selected}
        movable={movable.includes(sq)}
        fading={fading.includes(sq)}
        isMoving={Boolean(isMoving)}
      />,
    )
  })

  return (
    <div className="dm-board" role="grid" aria-label="Papan dam">
      <div className="dm-grid">
        {SQUARES.map((sq) => {
          const dark = isDark(sq)
          const v = board[sq]
          const isTarget = targets.includes(sq)
          const wasMove = lastMove && (lastMove.from === sq || lastMove.to === sq)
          const label = v
            ? `${ownerOf(v) === 0 ? 'Buah kamu' : 'Buah Pak Tam'}${isKing(v) ? ' (haji)' : ''}`
            : isTarget
              ? 'Gerak ke sini'
              : 'Petak kosong'
          return (
            <button
              key={sq}
              type="button"
              className={`dm-sq ${dark ? 'is-dark' : ''} ${isTarget ? 'is-target' : ''} ${wasMove ? 'is-last' : ''}`}
              data-sq={sq}
              disabled={!dark}
              tabIndex={dark ? 0 : -1}
              aria-label={dark ? label : undefined}
              aria-hidden={dark ? undefined : true}
              onClick={dark ? () => onSquare?.(sq) : undefined}
            />
          )
        })}
      </div>
      <div className="dm-caps">{caps}</div>
    </div>
  )
})
