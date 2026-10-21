import { initAudio, sfx } from '../../audio/engine'
import { cycleSoundMode, useAudioState } from '../../state/audioState'
import { showToast } from '../../state/uiState'

const MODES = {
  all: { icon: '🔊', label: 'Bunyi & muzik' },
  sfx: { icon: '🔉', label: 'Bunyi sahaja' },
  off: { icon: '🔇', label: 'Senyap' },
}

/** Cycles: sound + music → sound only → silent. */
export function SoundToggle({ className = '', announce = false }) {
  const mode = useAudioState((s) => s.mode)
  const current = MODES[mode] ?? MODES.all

  const onClick = () => {
    initAudio()
    const next = cycleSoundMode()
    if (next !== 'off') sfx.tap()
    if (announce) showToast(MODES[next].label)
  }

  return (
    <button type="button" className={`sound-toggle ${className}`} onClick={onClick} aria-label={`Bunyi: ${current.label}`} title={current.label}>
      <span aria-hidden="true">{current.icon}</span>
    </button>
  )
}
