import { HOUSE, px } from './kampungLayout'
import { MODELS } from './models'

// Tok Wan sits at the top of his stairs (GLB house or the stand-in)
const STAIRS_TOP = MODELS.tokwan.url ? MODELS.tokwan.stairsTop : [0, 1.275, 6.05]

const [kiahX, kiahZ] = px(612, 432)
const [abuX, abuZ] = px(430, 566)

/**
 * Kampung folk. Kids playing at the game spots are defined with each spot
 * (components/world/spots). Here are the adults you can talk to.
 *
 * look:   colours and clothing for PersonModel
 * pose:   PersonModel pose
 * lines:  what they say when you talk to them (cycled)
 * bubble: short lines shown above their head as you walk past
 */
export const NPCS = [
  {
    id: 'tok-wan',
    name: 'Tok Wan',
    build: 'adult',
    elder: true,
    look: {
      shirt: '#d9d2c0',
      bottom: '#5b4636',
      bottomType: 'pelikat',
      headwear: 'kopiah',
      hair: '#d8d4cc',
      beard: true,
      slipper: '#3b2a20',
    },
    pose: 'sitDangle',
    // sitting at the top of the stairs of his house
    position: [HOUSE.position[0] + STAIRS_TOP[0], STAIRS_TOP[1], HOUSE.position[2] + STAIRS_TOP[2]],
    rotationY: 0,
    zone: { position: [HOUSE.position[0], HOUSE.position[2] + 10.3], radius: 3.4 },
    lines: [
      'Eh, cucu Tok Wan dah balik! Pergilah main dengan budak-budak kampung.',
      'Zaman Tok Wan dulu, gasing Tok Wan paling handal sekampung!',
      'Petang-petang macam ni, seronok main congkak di wakaf.',
      'Jangan main jauh sangat. Nanti Maghrib balik rumah, ya.',
    ],
    bubble: ['Cucu Tok Wan dah balik!', 'Mari sini, sembang dengan Tok Wan.'],
  },
  {
    id: 'mak-cik-kiah',
    name: 'Mak Cik Kiah',
    build: 'adult',
    look: {
      shirt: '#3f8a7a',
      bottom: '#2f6a5e',
      bottomType: 'kain',
      longTop: true,
      headwear: 'tudung',
      headwearColor: '#f2c14e',
      slipper: '#7a3b2a',
    },
    pose: 'sweep',
    hand: 'broom',
    position: [kiahX, 0, kiahZ],
    rotationY: -0.6,
    zone: { position: [kiahX, kiahZ], radius: 2.6 },
    lines: [
      'Nak ke mana tu? Main elok-elok, jangan bergaduh.',
      'Mak Cik baru goreng kuih. Nanti singgah, ya!',
      'Hati-hati dekat sungai tu.',
    ],
    bubble: ['Assalamualaikum!', 'Sapu daun dulu…'],
  },
  {
    id: 'pak-abu',
    name: 'Pak Abu',
    build: 'adult',
    look: {
      shirt: '#7a8a9c',
      bottom: '#3a3f4a',
      bottomType: 'seluar',
      headwear: 'cap',
      headwearColor: '#c9a35a',
      hair: '#2a1d16',
      slipper: '#2a2a2a',
    },
    pose: 'fish',
    hand: 'rod',
    stool: true,
    // on the south bank of the sungai, rod over the water
    position: [abuX, 0, abuZ],
    rotationY: Math.PI,
    zone: { position: [abuX, abuZ + 1], radius: 2.8 },
    lines: [
      'Syhh… nanti ikan lari.',
      'Petang ni dah dapat tiga ekor ikan keli.',
      'Dulu sungai ni tempat budak-budak terjun beramai-ramai.',
    ],
    bubble: ['Syhh…', 'Umpan dah dimakan ke?'],
  },
]

/** Pak Mat cycles up and down the main road. */
export const CYCLIST = {
  id: 'pak-mat',
  name: 'Pak Mat',
  look: {
    shirt: '#c9573a',
    bottom: '#3a3330',
    bottomType: 'seluar',
    headwear: 'songkok',
    hair: '#2a1d16',
    slipper: '#2a2a2a',
  },
  speed: 3.4,
  bubble: ['Kring! Kring!', 'Tumpang lalu!', 'Nak ke kedai sekejap!'],
}

export const getNpcById = (id) => NPCS.find((npc) => npc.id === id)
