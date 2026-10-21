import { CharacterCreation } from './components/character/CharacterCreation'
import { LandingPage } from './components/landing/LandingPage'
import { KampungExperience } from './components/world/KampungExperience'
import { SCREENS, isWorldScreen, usePlayerState } from './state/playerState'

/**
 * Screen router. Flow:
 * landing → character → kampung → gameMode → gameSelection
 * The 3D kampung stays mounted while the game menus are open on top of it.
 */
export default function App() {
  const screen = usePlayerState((s) => s.currentScreen)

  return (
    <main className="app">
      {screen === SCREENS.LANDING && <LandingPage />}
      {screen === SCREENS.CHARACTER && <CharacterCreation />}
      {isWorldScreen(screen) && <KampungExperience />}
    </main>
  )
}
