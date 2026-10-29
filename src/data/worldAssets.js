/**
 * What the living kampung is made of, and which pieces are real assets versus
 * stand-ins built from primitives. When a requested asset arrives, drop it in
 * public/ (models/ or audio/), set its path here and switch `status` to
 * 'available'; the systems listed in `usedBy` are where it plugs in.
 *
 * status: available (in the project) | placeholder (primitive stand-in that
 * works today) | requested (asked for; the stand-in is used until it comes)
 */
export const WORLD_ASSETS = [
  // ------------------------------------------------ characters (keep: PersonModel is the house style)
  { id: 'villagers', category: 'character', path: null, status: 'available', usedBy: 'components/character/PersonModel.jsx (all people, procedural rig + poses)' },
  { id: 'amru', category: 'character', path: '/models/npc_amru.glb', status: 'available', animations: [], usedBy: 'life/Rascals.jsx (static mesh, rigged at load by life/autoRig.js)' },
  { id: 'sameer', category: 'character', path: '/models/npc_sameer.glb', status: 'available', animations: [], usedBy: 'life/Rascals.jsx (static mesh, rigged at load by life/autoRig.js)' },

  // ------------------------------------------------ animals
  { id: 'chicken', category: 'animal', path: null, status: 'placeholder', animations: ['idle', 'walk', 'peck', 'run'], usedBy: 'components/world/npc/Animals.jsx' },
  { id: 'cat', category: 'animal', path: '/models/kucing.glb', status: 'available', animations: [], usedBy: 'life/Wildlife.jsx (static mesh, rigged at load by life/autoRig.js autoRigCat; CC-BY-4.0, credit in README)' },
  { id: 'duck', category: 'animal', path: null, status: 'placeholder', animations: ['idle', 'walk', 'swim'], usedBy: 'components/world/npc/Animals.jsx' },
  { id: 'pipit', category: 'animal', path: null, status: 'placeholder', animations: ['hop', 'fly'], usedBy: 'components/world/life/Wildlife.jsx' },
  { id: 'fish', category: 'animal', path: null, status: 'placeholder', usedBy: 'components/world/life/RiverLife.jsx' },

  // ------------------------------------------------ props (GLBs already in public/models)
  { id: 'bangku', category: 'prop', path: '/models/bangku_kayu_panjang.glb', status: 'available', usedBy: 'life/Villagers.jsx (benches people sit on)' },
  { id: 'selipar', category: 'prop', path: '/models/selipar_jepun.glb', status: 'available', usedBy: 'life/KampungProps.jsx' },
  { id: 'sampan', category: 'prop', path: '/models/sampan.glb', status: 'available', usedBy: 'world/Props.jsx' },
  { id: 'tempayan, pasu, baldi, guni, peti, bubu, kayu api, tungku', category: 'prop', path: null, status: 'placeholder', usedBy: 'life/KampungProps.jsx, life/Ambience.jsx (kit parts)' },

  // ------------------------------------------------ environment / vfx (procedural on purpose)
  { id: 'river surface', category: 'environment', path: null, status: 'available', usedBy: 'life/riverMaterial.js (shader, no texture)' },
  { id: 'wind', category: 'vfx', path: null, status: 'available', usedBy: 'life/wind.js (trees, palms, grass, reeds)' },
  { id: 'smoke, ripples, splashes, leaves', category: 'vfx', path: null, status: 'available', usedBy: 'life/Ambience.jsx, life/RiverLife.jsx' },

  // ------------------------------------------------ audio (today: synthesised in audio/engine.js)
  { id: 'river ambience loop', category: 'audio', path: null, status: 'requested', usedBy: 'audio/engine.js startAmbience (stream)' },
  { id: 'kampung petang ambience loop', category: 'audio', path: null, status: 'requested', usedBy: 'audio/engine.js startAmbience' },
  { id: 'splash / fish jump', category: 'audio', path: null, status: 'requested', usedBy: 'life/RiverLife.jsx (worldFx splash, fishJump)' },
  { id: 'cat meow, chicken squawk', category: 'audio', path: null, status: 'requested', usedBy: 'life/Wildlife.jsx, npc/Animals.jsx' },
]
