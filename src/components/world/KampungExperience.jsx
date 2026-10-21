import { useMemo } from 'react'
import { SCREENS, usePlayerState } from '../../state/playerState'
import { GameModeSelection } from '../game/GameModeSelection'
import { GameScreen } from '../game/GameScreen'
import { InteractionPrompt } from '../interaction/InteractionPrompt'
import { useInteractionKey } from '../interaction/InteractionSystem'
import { EntryOverlay } from '../ui/EntryOverlay'
import { HUD } from '../ui/HUD'
import { Toast } from '../ui/Toast'
import { TouchJoystick } from '../ui/TouchJoystick'
import { KampungWorld } from './KampungWorld'

const detectTouch = () =>
  typeof window !== 'undefined' &&
  ('ontouchstart' in window || window.matchMedia?.('(pointer: coarse)').matches)

/** The kampung screen: 3D world + HUD + overlays (mode menu and the game itself). */
export function KampungExperience() {
  const screen = usePlayerState((s) => s.currentScreen)
  const gender = usePlayerState((s) => s.playerGender)
  const isTouch = useMemo(detectTouch, [])
  const exploring = screen === SCREENS.KAMPUNG

  useInteractionKey()

  return (
    <div className={`kampung screen-fade-in ${exploring ? '' : 'is-paused'}`}>
      <KampungWorld gender={gender} controlsEnabled={exploring} />

      <div className={`kampung__ui ${exploring ? '' : 'is-dimmed'}`}>
        <HUD isTouch={isTouch} />
        <InteractionPrompt isTouch={isTouch} />
        <Toast />
        {isTouch && exploring && <TouchJoystick />}
      </div>

      {screen === SCREENS.GAME_MODE && <GameModeSelection />}
      {screen === SCREENS.GAME && <GameScreen />}

      <EntryOverlay />
    </div>
  )
}
