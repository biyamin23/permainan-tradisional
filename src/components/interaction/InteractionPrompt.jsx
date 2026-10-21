import { SCREENS, usePlayerState } from '../../state/playerState'
import { useInteractionState } from '../../state/uiState'
import { getZoneById, interactWithActiveZone } from './InteractionSystem'

/** "Tekan E untuk berinteraksi" pill. Tappable on touch screens. */
export function InteractionPrompt() {
  const activeZoneId = useInteractionState((s) => s.activeZoneId)
  const screen = usePlayerState((s) => s.currentScreen)
  const zone = activeZoneId ? getZoneById(activeZoneId) : null

  if (!zone || screen !== SCREENS.KAMPUNG) return null

  return (
    <div className="interaction-prompt" key={zone.id}>
      <span className="interaction-prompt__label">{zone.label}</span>
      <button type="button" className="interaction-prompt__pill" onClick={interactWithActiveZone}>
        <kbd className="keycap">E</kbd>
        <span>{zone.prompt}</span>
      </button>
    </div>
  )
}
