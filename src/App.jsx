import { Suspense, lazy, useEffect } from 'react'
import { LandingPage } from './components/landing/LandingPage'
import { SoundToggle } from './components/ui/SoundToggle'
import { authStore, initAuth, screenAfterLogin, takeReturnFlag } from './cloud/auth'
import { SCREENS, isWorldScreen, playerActions, playerStore, usePlayerState } from './state/playerState'

// The landing page loads on its own. Three.js, physics and the kampung come in
// separate chunks, fetched in the background while the player reads the landing.
const loadCharacter = () => import('./components/character/CharacterCreation')
const loadKampung = () => import('./components/world/KampungExperience')
const CharacterCreation = lazy(() => loadCharacter().then((m) => ({ default: m.CharacterCreation })))
// development only: progression numbers and simulators (not in production builds)
const DevProgressPanel = import.meta.env.DEV ? lazy(() => import('./components/progress/DevProgressPanel')) : null

const LoginScreen = lazy(() => import('./components/login/LoginScreen').then((m) => ({ default: m.LoginScreen })))
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

  // who is logged in; coming back from Google (or a password email) carries straight on
  useEffect(() => {
    const back = takeReturnFlag()
    initAuth().then(() => {
      const { status, recovery } = authStore.getState()
      if (playerStore.getState().currentScreen !== SCREENS.LANDING) return
      if (recovery) playerActions.goTo(SCREENS.LOGIN)
      else if (back && status === 'in') playerActions.goTo(screenAfterLogin())
    })
  }, [])

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
        {screen === SCREENS.LOGIN && <LoginScreen />}
        {screen === SCREENS.CHARACTER && <CharacterCreation />}
        {isWorldScreen(screen) && <KampungExperience />}
      </Suspense>
      {/* the landing has its own sound button */}
      {!isWorldScreen(screen) && screen !== SCREENS.LANDING && <SoundToggle className="sound-toggle--floating" />}
      {DevProgressPanel && (
        <Suspense fallback={null}>
          <DevProgressPanel />
        </Suspense>
      )}
    </main>
  )
}
