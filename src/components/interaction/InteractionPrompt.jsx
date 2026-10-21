import { SCREENS, usePlayerState } from '../../state/playerState'
import { useInteractionState } from '../../state/uiState'
import { getZoneById, interactWithActiveZone } from './InteractionSystem'

/**
 * Desktop: "Tekan E untuk berinteraksi" pill in the centre.
 * Touch: a big round action button in the bottom-right corner (thumb zone),
 * mirroring the joystick on the left.
 */
export function InteractionPrompt({ isTouch }) {
  const activeZoneId = useInteractionState((s) => s.activeZoneId)
  const screen = usePlayerState((s) => s.currentScreen)
  const zone = activeZoneId ? getZoneById(activeZoneId) : null

  if (!zone || screen !== SCREENS.KAMPUNG) return null

  if (isTouch) {
    return (
      <div className="action-zone" key={zone.id}>
        <span className="action-zone__label">{zone.label}</span>
        <button
          type="button"
          className={`action-button ${zone.isObjective ? 'is-objective' : ''}`}
          onClick={interactWithActiveZone}
          aria-label={`${zone.actionLabel ?? 'Lihat'}: ${zone.label}`}
        >
          <span className="action-button__icon" aria-hidden="true">
            {zone.actionIcon ?? '✋'}
          </span>
          <span className="action-button__text">{zone.actionLabel ?? 'Lihat'}</span>
        </button>
      </div>
    )
  }

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
