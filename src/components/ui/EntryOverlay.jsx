import { useEffect, useState } from 'react'
import { START_HOUR, describeTime } from '../../state/timeOfDay'

const START = describeTime(Math.floor(START_HOUR * 60))

/** Cinematic title card while the kampung loads and the camera glides in. */
export function EntryOverlay() {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 3400)
    return () => clearTimeout(timer)
  }, [])

  if (!visible) return null
  return (
    <div className="entry-overlay" aria-hidden="true">
      <p className="entry-overlay__kicker">
        {START.name} Sabtu · {START.label}
      </p>
      <h2 className="entry-overlay__title">Kampung Tok Wan</h2>
      <div className="motif-band" />
    </div>
  )
}
