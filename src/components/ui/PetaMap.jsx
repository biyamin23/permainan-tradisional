import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { sfx } from '../../audio/engine'
import { games, isGameAvailable } from '../../data/games'
import { HOUSE, MAP_SIZE, arrivalFor, toMap } from '../../data/kampungLayout'
import { worldRuntime } from '../../state/worldRuntime'
import { MapArt } from './peta/MapArt'
import './peta.css'

const ASPECT = MAP_SIZE[0] / MAP_SIZE[1]
const ZOOMS = [1, 1.6, 2.4]
const MAX_ZOOM = 3
const pct = ([u, v]) => ({ left: `${(u / MAP_SIZE[0]) * 100}%`, top: `${(v / MAP_SIZE[1]) * 100}%` })

// where each game's pin goes: on its spot (Congkak: up on Tok Wan's serambi)
const pinAt = (g) =>
  g.id === 'congkak' ? toMap(HOUSE.position[0] - 1.7, HOUSE.position[2] + 3) : toMap(g.spot.position[0], g.spot.position[1])

/**
 * Peta Kampung: a drawn map of the kampung, generated from the same layout as
 * the 3D world. Drag to look around, pinch or use +/− to zoom, tap a game and
 * "Pergi ke sini" takes you straight there.
 */
export function PetaMap({ onClose }) {
  const [selected, setSelected] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [box, setBox] = useState({ w: 0, h: 0 })
  const scroller = useRef(null)
  const zoomRef = useRef(zoom)
  const anchor = useRef(null)
  const me = toMap(worldRuntime.playerPosition.x, worldRuntime.playerPosition.z)
  // the map point at the middle of the view (kept across resizes); opens on you
  const view = useRef({ fx: me[0] / MAP_SIZE[0], fy: me[1] / MAP_SIZE[1] })
  const facing = -worldRuntime.cameraYaw
  const game = games.find((g) => g.id === selected)

  // at zoom 1 a wide screen shows the whole kampung; a phone fills the height and scrolls sideways
  const baseW = box.w / Math.max(box.h, 1) > ASPECT ? box.h * ASPECT : Math.max(box.w, box.h * ASPECT)
  const mapW = baseW * zoom
  const mapH = mapW / ASPECT

  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  /** Zoom keeping the map point under (cx, cy) (scroller coords) where it is. */
  const zoomTo = useCallback((next, cx, cy) => {
    const el = scroller.current
    if (!el) return
    const z = Math.min(MAX_ZOOM, Math.max(1, next))
    const px = cx ?? el.clientWidth / 2
    const py = cy ?? el.clientHeight / 2
    const inner = el.firstElementChild
    anchor.current = {
      fx: (el.scrollLeft + px - inner.offsetLeft) / inner.offsetWidth,
      fy: (el.scrollTop + py - inner.offsetTop) / inner.offsetHeight,
      px,
      py,
    }
    zoomRef.current = z
    setZoom(z)
  }, [])

  // after a zoom (or on open), put the anchored point back under the finger
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el || !box.w) return
    const inner = el.firstElementChild
    const a = anchor.current ?? { ...view.current, px: el.clientWidth / 2, py: el.clientHeight / 2 }
    el.scrollLeft = inner.offsetLeft + a.fx * inner.offsetWidth - a.px
    el.scrollTop = inner.offsetTop + a.fy * inner.offsetHeight - a.py
    anchor.current = null
  }, [zoom, box.w, box.h])

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const onScroll = () => {
      const inner = el.firstElementChild
      view.current = {
        fx: (el.scrollLeft + el.clientWidth / 2 - inner.offsetLeft) / inner.offsetWidth,
        fy: (el.scrollTop + el.clientHeight / 2 - inner.offsetTop) / inner.offsetHeight,
      }
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // drag with a mouse; pinch and ctrl+wheel to zoom
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    let pinch = null
    let drag = null
    const mid = (t) => {
      const r = el.getBoundingClientRect()
      return [(t[0].clientX + t[1].clientX) / 2 - r.left, (t[0].clientY + t[1].clientY) / 2 - r.top]
    }
    const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    const onTouchStart = (e) => {
      if (e.touches.length === 2) pinch = { d: dist(e.touches), z: zoomRef.current }
    }
    const onTouchMove = (e) => {
      if (!pinch || e.touches.length !== 2) return
      e.preventDefault()
      const [cx, cy] = mid(e.touches)
      const next = pinch.z * (dist(e.touches) / pinch.d)
      if (Math.abs(next - zoomRef.current) > 0.02) zoomTo(next, cx, cy)
    }
    const onTouchEnd = (e) => {
      if (e.touches.length < 2) pinch = null
    }
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const r = el.getBoundingClientRect()
      zoomTo(zoomRef.current * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX - r.left, e.clientY - r.top)
    }
    const onDown = (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || e.target.closest('button')) return
      drag = { x: e.clientX, y: e.clientY, l: el.scrollLeft, t: el.scrollTop }
      el.classList.add('is-dragging')
    }
    const onMove = (e) => {
      if (!drag) return
      el.scrollLeft = drag.l - (e.clientX - drag.x)
      el.scrollTop = drag.t - (e.clientY - drag.y)
    }
    const onUp = () => {
      drag = null
      el.classList.remove('is-dragging')
    }
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [zoomTo])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' || e.key === 'm' || e.key === 'M') onClose()
      if (e.key === '+' || e.key === '=') zoomTo(zoomRef.current * 1.4)
      if (e.key === '-') zoomTo(zoomRef.current / 1.4)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, zoomTo])

  const pick = (id, center = false) => {
    sfx.tap()
    setSelected(id)
    const el = scroller.current
    const g = games.find((x) => x.id === id)
    if (center && el && g) {
      const [u, v] = pinAt(g)
      const inner = el.firstElementChild
      el.scrollTo({
        left: inner.offsetLeft + (u / MAP_SIZE[0]) * inner.offsetWidth - el.clientWidth / 2,
        top: inner.offsetTop + (v / MAP_SIZE[1]) * inner.offsetHeight - el.clientHeight / 2,
        behavior: 'smooth',
      })
    }
  }

  const go = () => {
    if (!game) return
    // arrive on dry ground beside the spot, looking at it
    worldRuntime.teleport = arrivalFor(game)
    sfx.select()
    onClose()
  }

  const stepZoom = (dir) => {
    sfx.tap()
    const next = dir > 0 ? ZOOMS.find((z) => z > zoom + 0.01) ?? MAX_ZOOM : [...ZOOMS].reverse().find((z) => z < zoom - 0.01) ?? 1
    zoomTo(next)
  }

  return (
    <div className="peta" role="dialog" aria-label="Peta kampung">
      <div className="peta__head">
        <div className="peta__sign">
          <span className="peta__title">Peta Kampung</span>
          <span className="peta__subtitle">Main · Kenal · Sayang</span>
        </div>
        <button type="button" className="peta__close" onClick={onClose} aria-label="Tutup peta">
          ✕
        </button>
      </div>

      <div className="peta__frame">
        <div className="peta__scroll" ref={scroller}>
          <div className={`peta__map ${mapW < 760 ? 'is-small' : ''}`} style={{ width: mapW || undefined, height: mapH || undefined }}>
            <MapArt />
            <span className="peta__me" style={pct(me)} aria-label="Kamu di sini">
              <span className="peta__me-arrow" style={{ transform: `rotate(${facing}rad)` }} />
              <span className="peta__me-dot" />
              <span className="peta__me-label">Kamu</span>
            </span>
            {games.map((g) => {
              const open = isGameAvailable(g)
              return (
                <button
                  key={g.id}
                  type="button"
                  className={`peta__pin ${open ? 'is-open' : ''} ${selected === g.id ? 'is-selected' : ''}`}
                  style={{ ...pct(pinAt(g)), '--c': g.accent }}
                  onClick={() => pick(g.id)}
                  aria-label={`${g.number}. ${g.name}${open ? '' : ' (akan datang)'}`}
                >
                  <span className="peta__pin-head">
                    <span>{g.number}</span>
                  </span>
                  <span className="peta__pin-name">{g.name}</span>
                </button>
              )
            })}
          </div>
        </div>
        <div className="peta__zoom">
          <button type="button" onClick={() => stepZoom(1)} disabled={zoom >= MAX_ZOOM - 0.01} aria-label="Zum masuk">
            +
          </button>
          <button type="button" onClick={() => stepZoom(-1)} disabled={zoom <= 1.01} aria-label="Zum keluar">
            −
          </button>
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
                {game.place} · {isGameAvailable(game) ? <b className="peta__ok">Boleh main</b> : 'Akan datang'}
              </small>
            </span>
            <button type="button" className="peta__go" onClick={go}>
              Pergi ke sini
            </button>
          </div>
        ) : (
          <p className="peta__card peta__card--hint">Tekan permainan pada peta atau senarai di bawah.</p>
        )}
        <div className="peta__list">
          {games.map((g) => (
            <button
              key={g.id}
              type="button"
              className={`peta__chip ${selected === g.id ? 'is-selected' : ''} ${isGameAvailable(g) ? 'is-open' : ''}`}
              onClick={() => pick(g.id, true)}
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
