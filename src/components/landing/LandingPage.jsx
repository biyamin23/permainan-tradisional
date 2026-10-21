import { useEffect, useRef, useState } from 'react'
import { initAudio, sfx } from '../../audio/engine'
import { SCREENS, playerActions } from '../../state/playerState'
import { LandingScenery } from './LandingScenery'

const LEAVE_DURATION = 750

export function LandingPage() {
  const [leaving, setLeaving] = useState(false)
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  const start = () => {
    if (leaving) return
    initAudio()
    sfx.select()
    setLeaving(true)
    timer.current = setTimeout(() => playerActions.goTo(SCREENS.CHARACTER), LEAVE_DURATION)
  }

  return (
    <section className={`landing ${leaving ? 'is-leaving' : ''}`}>
      <LandingScenery />

      <div className="landing__content">
        <p className="landing__kicker">
          <span className="landing__kicker-line" />
          Kampung · Petang · Kenangan
          <span className="landing__kicker-line" />
        </p>

        <h1 className="landing__title">
          <span className="landing__title-row">Permainan</span>
          <span className="landing__title-row landing__title-row--accent">Tradisional</span>
          <span className="landing__title-row">Malaysia</span>
        </h1>

        <p className="landing__subtitle">Jom kembali ke zaman kanak-kanak.</p>

        <button type="button" className="btn btn--primary btn--hero" onClick={start}>
          <span className="btn__shine" aria-hidden="true" />
          JOM BALIK KAMPUNG
          <span className="btn__arrow" aria-hidden="true">
            →
          </span>
        </button>

        <p className="landing__tagline">Main. Kenang. Ulang kembali.</p>
      </div>

      <div className="motif-band motif-band--bottom" aria-hidden="true" />
    </section>
  )
}
