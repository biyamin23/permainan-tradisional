import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { sfx } from '../../audio/engine'
import { games, isGameAvailable } from '../../data/games'
import { MAP_SIZE, toMap } from '../../data/mapCoords'
import { arrivalFor } from '../../data/kampungLayout'
import { worldRuntime } from '../../state/worldRuntime'
import './peta.css'

// games that aren't drawn on the picture get a pin of our own
const DRAWN_ON_MAP = new Set(games.map((g) => g.id).filter((id) => id !== 'police-thief'))
const pct = ([u, v]) => ({ left: `${(u / MAP_SIZE[0]) * 100}%`, top: `${(v / MAP_SIZE[1]) * 100}%` })

/**
 * Peta Kampung: the illustrated map of the kampung. Tap a game's pin (or pick
 * it from the list) and "Pergi ke sini" takes you straight there.
 */
export function PetaMap({ onClose }) {
  const [selected, setSelected] = useState(null)
  const scroller = useRef(null)
  const me = toMap(worldRuntime.playerPosition.x, worldRuntime.playerPosition.z)
  const game = games.find((g) => g.id === selected)

  // open centred on where you are
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    const inner = el.firstElementChild
    el.scrollLeft = (me[0] / MAP_SIZE[0]) * inner.offsetWidth - el.clientWidth / 2
    el.scrollTop = (me[1] / MAP_SIZE[1]) * inner.offsetHeight - el.clientHeight / 2
    // only on open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' || e.key === 'm' || e.key === 'M') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const pick = (id) => {
    sfx.tap()
    setSelected(id)
  }

  const go = () => {
    if (!game) return
    // arrive on dry ground beside the spot, looking at it
    worldRuntime.teleport = arrivalFor(game)
    sfx.select()
    onClose()
  }

  return (
    <div className="peta" role="dialog" aria-label="Peta kampung">
      <div className="peta__head">
        <h2 className="peta__title">Peta Kampung</h2>
        <button type="button" className="peta__close" onClick={onClose} aria-label="Tutup peta">
          ✕
        </button>
      </div>

      <div className="peta__scroll" ref={scroller}>
        <div className="peta__map">
          <img src="/peta/peta-kampung.webp" alt="Peta Kampung Halaman" width={MAP_SIZE[0]} height={MAP_SIZE[1]} draggable="false" />
          {games.map((g) => (
            <button
              key={g.id}
              type="button"
              className={`peta__pin ${DRAWN_ON_MAP.has(g.id) ? '' : 'is-drawn'} ${isGameAvailable(g) ? 'is-open' : ''} ${selected === g.id ? 'is-selected' : ''}`}
              style={pct(g.map)}
              onClick={() => pick(g.id)}
              aria-label={`${g.number}. ${g.name}`}
            >
              {!DRAWN_ON_MAP.has(g.id) && <span className="peta__pin-num">{g.number}</span>}
            </button>
          ))}
          <span className="peta__me" style={pct(me)} aria-label="Kamu di sini">
            <span className="peta__me-label">Kamu</span>
          </span>
        </div>
      </div>

      <div className="peta__sheet">
        {game ? (
          <div className="peta__card">
            <span className="peta__num" style={{ '--c': game.accent }}>
              {game.number}
            </span>
            <span className="peta__info">
              <strong>{game.name}</strong>
              <small>
                {game.place} · {isGameAvailable(game) ? 'Boleh main' : 'Akan datang'}
              </small>
            </span>
            <button type="button" className="peta__go" onClick={go}>
              Pergi ke sini
            </button>
          </div>
        ) : (
          <p className="peta__hint">Ketik nombor permainan pada peta, atau pilih di bawah.</p>
        )}
        <div className="peta__list">
          {games.map((g) => (
            <button
              key={g.id}
              type="button"
              className={`peta__chip ${selected === g.id ? 'is-selected' : ''} ${isGameAvailable(g) ? 'is-open' : ''}`}
              onClick={() => pick(g.id)}
            >
              <span className="peta__chip-num" style={{ '--c': g.accent }}>
                {g.number}
              </span>
              {g.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
