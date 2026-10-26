import { Suspense, lazy, useEffect } from 'react'
import { LandingPage } from './components/landing/LandingPage'
import { SoundToggle } from './components/ui/SoundToggle'
import { SCREENS, isWorldScreen, usePlayerState } from './state/playerState'

// The landing page loads on its own. Three.js, physics and the kampung come in
// separate chunks, fetched in the background while the player reads the landing.
const loadCharacter = () => import('./components/character/CharacterCreation')
const loadKampung = () => import('./components/world/KampungExperience')
const CharacterCreation = lazy(() => loadCharacter().then((m) => ({ default: m.CharacterCreation })))
const KampungExperience = lazy(() => loadKampung().then((m) => ({ default: m.KampungExperience })))

function whenIdle(fn) {
  if (typeof window.requestIdleCallback === 'function') return window.requestIdleCallback(fn, { timeout: 2500 })
  return window.setTimeout(fn, 1200)
}

function Loading() {
  return (
    <div className="screen-loading" role="status">
      Memuatkan kampung…
    </div>
  )
}

/**
 * Screen router. Flow:
 * landing → character → kampung → (walk to a game spot) → gameMode → game
 * The 3D kampung stays mounted underneath the mode menu and the game screen.
 */
export default function App() {
  const screen = usePlayerState((s) => s.currentScreen)

  useEffect(() => {
    whenIdle(() => {
      loadCharacter()
      loadKampung()
    })
  }, [])

  return (
    <main className="app">
      {screen === SCREENS.LANDING && <LandingPage />}
      <Suspense fallback={<Loading />}>
        {screen === SCREENS.CHARACTER && <CharacterCreation />}
        {isWorldScreen(screen) && <KampungExperience />}
      </Suspense>
      {/* the landing has its own sound button */}
      {!isWorldScreen(screen) && screen !== SCREENS.LANDING && <SoundToggle className="sound-toggle--floating" />}
    </main>
  )
}
