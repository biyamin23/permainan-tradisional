import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { sfx } from '../../audio/engine'
import { getGameById } from '../../data/games'
import { TUTORIALS } from './tutorials'
import './tutorial.css'

/** Which game is open, so the shared Cara main button can show its tutorial. */
export const TutorialGame = createContext(null)
export const useTutorialGame = () => useContext(TutorialGame)
export const hasTutorial = (id) => Boolean(TUTORIALS[id])

/**
 * Pop-up "cara main": one picture and one thing to do per step.
 * Swipe or use the buttons; the full rules list is one tap away.
 */
export function Tutorial({ gameId, rules, onClose }) {
  const steps = TUTORIALS[gameId] ?? []
  const game = getGameById(gameId)
  const [i, setI] = useState(0)
  const [showRules, setShowRules] = useState(false)
  const swipe = useRef(null)
  const last = i === steps.length - 1
  const step = steps[i]

  const go = (to) => {
    if (to < 0 || to >= steps.length) return
    sfx.tap()
    setI(to)
  }
  const close = () => {
    sfx.select()
    onClose()
  }

  // keys stay with the tutorial while it is open (Esc must not leave the game)
  useEffect(() => {
    const onKey = (e) => {
      if (!['Escape', 'ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(e.key)) return
      e.stopImmediatePropagation()
      e.preventDefault()
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1))
      if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
        if (i === steps.length - 1) onClose()
        else setI((n) => n + 1)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [i, steps.length, onClose])

  if (!step) return null
  const Art = step.art

  return (
    <div
      className="tut"
      role="dialog"
      aria-modal="true"
      aria-label={`Cara main ${game?.name ?? ''}`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="tut__card">
        <header className="tut__head">
          <span className="tut__kicker">
            <span aria-hidden="true">{game?.emoji ?? '🎲'}</span> Cara main {game?.name}
            {!showRules && (
              <span className="tut__count">
                {' '}
                · {i + 1}/{steps.length}
              </span>
            )}
          </span>
          <button type="button" className="tut__skip" onClick={close}>
            Langkau
          </button>
        </header>

        {showRules ? (
          <div className="tut__rules">
            <h3>Peraturan penuh</h3>
            <ol>
              {rules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ol>
          </div>
        ) : (
          <div
            className="tut__body"
            onPointerDown={(e) => {
              swipe.current = e.clientX
            }}
            onPointerUp={(e) => {
              if (swipe.current === null) return
              const dx = e.clientX - swipe.current
              swipe.current = null
              if (dx < -40) go(i + 1)
              if (dx > 40) go(i - 1)
            }}
          >
            <div className="tut__art" key={`art-${i}`}>
              <Art />
            </div>
            <div className="tut__text" key={`text-${i}`}>
              <h2 className="tut__title">{step.title}</h2>
              <p className="tut__copy">{step.body}</p>
              {step.tip && (
                <p className="tut__tip">
                  <span aria-hidden="true">💡</span> {step.tip}
                </p>
              )}
            </div>
          </div>
        )}

        {!showRules && (
          <div className="tut__dots" role="tablist" aria-label="Langkah">
            {steps.map((s, n) => (
              <button
                key={s.title}
                type="button"
                role="tab"
                aria-selected={n === i}
                aria-label={`Langkah ${n + 1}`}
                className={`tut__dot ${n === i ? 'is-on' : ''} ${n < i ? 'is-done' : ''}`}
                onClick={() => go(n)}
              />
            ))}
          </div>
        )}

        <footer className="tut__foot">
          {showRules ? (
            <button type="button" className="tut__btn tut__btn--soft" onClick={() => setShowRules(false)}>
              ‹ Balik ke tutorial
            </button>
          ) : (
            <>
              <button type="button" className="tut__btn tut__btn--soft" onClick={() => go(i - 1)} disabled={i === 0}>
                ‹ Kembali
              </button>
              {last ? (
                <button type="button" className="tut__btn tut__btn--go" onClick={close}>
                  Jom main!
                </button>
              ) : (
                <button type="button" className="tut__btn tut__btn--next" onClick={() => go(i + 1)}>
                  Seterusnya ›
                </button>
              )}
            </>
          )}
        </footer>
        {rules?.length > 0 && !showRules && (
          <button type="button" className="tut__more" onClick={() => setShowRules(true)}>
            Baca peraturan penuh
          </button>
        )}
      </div>
    </div>
  )
}
