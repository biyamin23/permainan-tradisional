# Permainan Tradisional Malaysia

> Jom kembali ke zaman kanak-kanak.

A web-based 3D experience where the player returns to a nostalgic Malaysian kampung, becomes a child again, and discovers traditional games.

**Phase 1 (this version):** the full core flow. You can walk around the kampung and open the game menus, but the games themselves aren't built yet.

```
Landing → Character creation → Enter kampung → Kampung hub → Solo / Multiplayer → Game selection
```

## Run it

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

## Controls

| Action | Keyboard / mouse | Tablet |
| --- | --- | --- |
| Move | `W` `A` `S` `D` or arrow keys | On-screen joystick |
| Run | `Shift` | Push joystick to the edge |
| Interact | `E` | Tap the prompt |
| Rotate camera | Drag | Drag the screen |
| Zoom | Mouse wheel | — |
| Close menu | `Esc` | ✕ button |

Head for the **padang** (follow the arrow at the top right) and press `E` to open *"Petang ni nak main apa?"*.

## Tech

React 18 · Vite 5 · Three.js · React Three Fiber · @react-three/drei · @react-three/rapier

Everything in the world is built from Three.js primitive geometry. There are no GLB models, textures or image assets. Parts are drawn with `InstancedMesh` (one draw call per geometry type), so the whole kampung stays light.

## Project structure

```
src/
  App.jsx                       Screen router
  main.jsx
  styles/global.css             Visual system (palette, typography, UI)

  state/
    createStore.js              Tiny store on useSyncExternalStore (works inside and outside <Canvas>)
    playerState.js              playerName, playerGender, selectedGameMode, currentScreen (+ actions)
    uiState.js                  Active interaction zone, toast messages
    input.js                    Keyboard + joystick input
    worldRuntime.js             Per-frame values (player position, camera yaw), outside React

  data/
    games.js                    Game registry: drives the game selection UI
    interactables.js            Interaction zones: drive the "Tekan E" system
    kampungLayout.js            Where everything in the kampung is placed

  components/
    landing/                    LandingPage, LandingScenery (SVG/CSS golden-hour kampung)
    character/                  CharacterCreation, CharacterPreview, ChildModel (shared kid model)
    world/                      KampungWorld (Canvas + Physics), Environment, House, Trees, Water,
                                Fence, Fields (sawah), PlayArea (padang), Wakaf, Life, Lighting,
                                Player, Camera, kit.js + InstancedParts (primitive "kit of parts")
    interaction/                InteractionSystem (zones, E key, handlers), InteractionPrompt
    game/                       GameModeSelection, GameSelection, GameCard, GameIcon
    ui/                         HUD, Toast, Modal, TouchJoystick, EntryOverlay
```

## Extending

**Add or unlock a game:** edit `src/data/games.js`. The cards are generated from that data. Set `status: 'available'` to unlock a game.

**Add an interaction spot:** add a zone to `src/data/interactables.js`:

```js
{
  id: 'gasing-court',
  label: 'Gelanggang Gasing',
  prompt: 'Tekan E untuk main gasing',
  position: [x, z],
  radius: 4,
  action: 'startGame',
  gameId: 'gasing',
}
```

Then register a handler for the new action:

```js
import { registerInteractionHandler } from './components/interaction/InteractionSystem'

registerInteractionHandler('startGame', (zone) => {
  // open the game with zone.gameId
})
```

**Add a screen:** add it to `SCREENS` in `src/state/playerState.js` and render it in `App.jsx`. If it should keep the 3D kampung underneath, also add it to `WORLD_SCREENS`.

## Not in Phase 1

Supabase, auth, database, real multiplayer, leaderboards, XP, achievements, actual gameplay (Congkak, Gasing, …), GLB assets, inventory, shops.
