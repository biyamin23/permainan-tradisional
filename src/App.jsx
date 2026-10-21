import { CharacterCreation } from './components/character/CharacterCreation'
import { LandingPage } from './components/landing/LandingPage'
import { SoundToggle } from './components/ui/SoundToggle'
import { KampungExperience } from './components/world/KampungExperience'
import { SCREENS, isWorldScreen, usePlayerState } from './state/playerState'

/**
 * Screen router. Flow:
 * landing → character → kampung → (walk to a game spot) → gameMode → game
 * The 3D kampung stays mounted underneath the mode menu and the game screen.
 */
export default function App() {
  const screen = usePlayerState((s) => s.currentScreen)

  return (
    <main className="app">
      {screen === SCREENS.LANDING && <LandingPage />}
      {screen === SCREENS.CHARACTER && <CharacterCreation />}
      {isWorldScreen(screen) && <KampungExperience />}
      {!isWorldScreen(screen) && <SoundToggle className="sound-toggle--floating" />}
    </main>
  )
}
