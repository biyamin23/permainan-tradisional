# Permainan Tradisional Malaysia

> Jom kembali ke zaman kanak-kanak.

A web-based 3D experience where the player returns to a nostalgic Malaysian kampung, becomes a child again, and discovers traditional games.

**Phase 1 (this version):** the full core flow. You can walk around a living kampung and find each traditional game at its own spot. **Congkak is fully playable**; the other games are coming.

```
Landing → Character creation → Enter kampung → walk to a game spot → Solo / Multiplayer → straight into that game
```

What's in the kampung:

- **11 game spots**, one per game, each with kids playing it (Congkak at the wakaf, Gasing on the padang, Wau in the open field, Teng-Teng near the road…). Congkak and Dam are open; the others say *akan datang*. The compass in the HUD points to the nearest game you can play.
- **Congkak** (solo vs Aisyah, three levels: Mudah, Biasa, Pakar): traditional rules, sown clockwise with your rumah on your left, relay sowing (*main terus*), extra turn when the last seed lands in your rumah, and *tembak* captures. Hands reach over the board and sow the guli one by one with sound; try to play on Aisyah's turn and her hand slaps yours away while she tells you off in her own voice (five recorded lines, shuffled). Sowing goes at one steady pace; press and hold *Laju 2×* to double it, or tap the board to skip. Wins, losses and your best score are remembered. Mobile-first screen: big round buttons, both players' cards with whose turn it is and their score, a big message for what just happened, glowing holes you can tap, and a bar at the bottom saying what to do next. Aisyah and the player have picture avatars, and the board (drawn in code) sits on a picture of a wooden wakaf table with a mengkuang mat; it always lies across the screen with your row at the bottom and your rumah on the left.
- **Dam** at the **kedai kopi** by the main road, where the old men of the kampung sit over kopi O (solo vs Pak Tam, three levels): 8×8 board played with bottle caps, makan is compulsory and chained, a buah may makan backward, and a buah reaching the far row *naik haji* (flying king). Tap a glowing cap, then a gold ring to move; the screen says when you must makan and what Pak Tam just did.
- **Villagers** you can talk to: Tok Wan on his stairs, Mak Cik Kiah sweeping, Pak Abu fishing by the stream. Pak Mat cycles up and down the road.
- **Animals**: chickens, ducks in the pond, butterflies.
- **Day and night**: a full day passes in 12 minutes (one in-game hour = 30 s). The visit starts at 5:36 petang; the sun sets, stars and the moon come out, windows, pelita and street lamps light up, birds roost and crickets take over. Tap the clock under your name to jump 3 hours ahead.
- **Collisions** with everything solid: houses, fences, trees, water, lamp posts, and every kid and villager (Pak Mat's bicycle will nudge you aside).
- **Sound**, all synthesised in the browser (no audio files): wind, birds, crickets, frogs, the stream, chickens, bicycle bell, footsteps, UI sounds and a gentle kampung tune. Use the 🔊 button to switch between sound + music, sound only and silent.

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
| Run | `Shift` | — (the joystick walks) |
| Interact | `E` | Tap the prompt |
| Rotate camera | Drag | Drag the screen |
| Zoom | Mouse wheel | — |
| Close menu | `Esc` | ✕ button |

Follow the arrow at the top right to Congkak and press `E` (or tap **MAIN** on a phone).

## Tech

React 18 · Vite 5 · Three.js · React Three Fiber · @react-three/drei · @react-three/rapier

Everything in the 3D world is built from Three.js primitive geometry. There are no GLB models or textures in it; the only pictures are the game screens' avatars and table backgrounds (small WebP files in `public/avatars`, `public/congkak` and `public/dam`).

To keep the web app light, the landing page loads first and the 3D kampung, physics and each game are separate chunks fetched in the background; Three.js, physics and React sit in their own long-cached vendor chunks (see `vite.config.js` and `vercel.json`). Parts are drawn with `InstancedMesh` (one draw call per geometry type), so the whole kampung stays light.

## Project structure

```
src/
  App.jsx                       Screen router
  main.jsx
  styles/global.css             Visual system (palette, typography, UI)

  audio/
    engine.js                   Web Audio synth: sfx, ambience, music

  games/
    registry.js                 Game id → component that runs the game
    shared/
      GameShell.jsx             The screen every table game shares: players' cards, big messages,
                                what-to-do-next bar, buttons at the bottom, intro/rules/result panels
      gameShell.css
    dam/
      engine.js                 Dam rules (pure JS) + AI (alpha-beta, mudah/biasa/pakar)
      useDamMatch.js            Tap-to-move, chained makan, Pak Tam's turn, result
      DamBoard.jsx / DamGame.jsx / dam.css / records.js
    congkak/
      engine.js                 Rules (pure JS): sowing, relay, tembak, extra turns, end + AI (mudah/biasa/pakar)
      useCongkakMatch.js        Match state + seed-by-seed animation
      CongkakGame.jsx           Intro, match screen, results
      CongkakBoard.jsx          The lacquered board (portrait/landscape)
      Hands.jsx                 Arms that sow, and Aisyah's tepis
      records.js                Solo records in localStorage
      congkak.css

  state/
    audioState.js               Sound mode (all / sfx / off), remembered per browser
    createStore.js              Tiny store on useSyncExternalStore (works inside and outside <Canvas>)
    playerState.js              playerName, playerGender, selectedGameMode, currentScreen (+ actions)
    uiState.js                  Active interaction zone, toast messages
    input.js                    Keyboard + joystick input
    worldRuntime.js             Per-frame values (player position, camera yaw), outside React
    timeOfDay.js                Kampung clock, sky colour keyframes, daylight factor
    npcBodies.js                Registry that gives NPCs physical bodies

  data/
    games.js                    Game registry: spots, zones, signs and kids are generated from it
    npcs.js                     Villagers you can talk to, and the cyclist
    interactables.js            Interaction zones (generated from games + npcs, plus places)
    kampungLayout.js            Where everything in the kampung is placed

  components/
    landing/                    LandingPage, LandingScenery (SVG/CSS golden-hour kampung)
    character/                  CharacterCreation, CharacterPreview, PersonModel (kids + adults, poses), ChildModel
    world/                      KampungWorld (Canvas + Physics), Environment, House, Trees, Water,
                                Fence, Fields (sawah), GameSpots, Wakaf, Life, Lighting, Player,
                                Camera, AudioDriver, NightLights, Lighting (day–night cycle),
                                kit.js + InstancedParts (primitive "kit of parts")
      spots/                    One scene per game (SpotScenes) and shared props (SpotProps)
      npc/                      Npcs (villagers, cyclist), Animals, NpcColliders, ProximityBubble, kid outfits
    interaction/                InteractionSystem (zones, E key, handlers), InteractionPrompt
    game/                       GameModeSelection, GameScreen, GamePlaceholder, GameIcon
    ui/                         HUD, Toast, Modal, TouchJoystick, SoundToggle, EntryOverlay
```

## Extending

**Add or unlock a game:** edit `src/data/games.js`. Its spot, interaction zone and sign are generated from that data. Set `status: 'available'` to unlock it, add a scene for its spot in `components/world/spots/SpotScenes.jsx`, and register the component that runs it in `src/games/registry.js`.

**Add a villager:** add an entry to `src/data/npcs.js` (look, pose, position, lines). Talking to them works automatically.

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
