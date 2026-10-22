import { CHILD_LOOKS } from '../../components/character/ChildModel'
import { kidLook } from '../../components/world/npc/kidLooks'
import { GENDERS } from '../../state/playerState'

/**
 * Who plays. Geng Pak-pak: five uncles of the kampung, dressed like their
 * portraits (public/avatars/*.webp). Pasukan kamu: you and four kampung kids.
 * Order is the player number 1–5, clockwise round the circle.
 */

const SKIN = '#e0aa78'
const BLACK = '#1d1b1b'

export const GENG_PAK = [
  {
    id: 'pak-nyaa',
    name: 'Pak Nyaa',
    img: '/avatars/pak-nyaa.webp',
    color: '#4f7fae',
    look: {
      skin: SKIN,
      headwear: 'cap',
      headwearColor: BLACK,
      capBackward: true,
      hair: '#1b1210',
      top: 'tee',
      shirt: '#f1efe8',
      accent: '#dedad0',
      bottom: '#3d4048',
      bottomType: 'seluar',
      slipper: '#2a2a2a',
      facialHair: 'goatee',
      mouth: 'grin',
    },
    lines: ['Hoi, sambut!', 'Jangan bagi jatuh!', 'Cantik tu!'],
  },
  {
    id: 'pak-dil',
    name: 'Pak Dil',
    img: '/avatars/pak-dil.webp',
    color: '#6b7a48',
    look: {
      skin: SKIN,
      headwear: 'songkok',
      hair: '#1b1210',
      top: 'baju',
      shirt: '#5f6b3e',
      accent: '#3e4528',
      bottom: '#2f2b27',
      bottomType: 'seluar',
      slipper: '#3b2a20',
      facialHair: 'beard',
      mouth: 'grin',
    },
    lines: ['Bismillah, mula!', 'Kemas, kemas!'],
  },
  {
    id: 'pok-pa',
    name: 'Pok Pa',
    img: '/avatars/pok-pa.webp',
    color: '#b8603e',
    look: {
      skin: SKIN,
      hair: '#3a2416',
      hairStyle: 'curly',
      top: 'singlet',
      shirt: BLACK,
      bottom: '#4a4f5a',
      bottomType: 'shorts',
      slipper: '#1e1e1e',
      facialHair: 'mustache',
      mouth: 'line',
    },
    lines: ['Haa, tengok sepak kuda aku!', 'Lagi!'],
  },
  {
    id: 'pak-mi',
    name: 'Pak Mi',
    img: '/avatars/pak-mi.webp',
    color: '#7a5f9a',
    look: {
      skin: SKIN,
      hair: '#141010',
      top: 'kemeja',
      shirt: '#f4f1ea',
      accent: '#e2ddd2',
      bagStrap: '#2b2622',
      bottom: '#8a7a5c',
      bottomType: 'seluar',
      slipper: '#3b2a20',
      facialHair: 'goatee',
      mouth: 'grin',
    },
    lines: ['Balik kerja terus main!', 'Ok, ok, sikit lagi!'],
  },
  {
    id: 'pak-ming',
    name: 'Pak Ming',
    img: '/avatars/pak-ming.webp',
    color: '#4f9a9a',
    look: {
      skin: SKIN,
      headwear: 'songkok',
      hair: '#141010',
      top: 'baju',
      shirt: '#a9bce4',
      accent: '#7d90c0',
      bottom: '#97a9d4',
      bottomType: 'seluar',
      slipper: '#2a2a2a',
      mouth: 'smile',
    },
    lines: ['Tenang, tenang.', 'Alhamdulillah!'],
  },
]

const KID_MATES = [
  { name: 'Amin', seed: 21, girl: false },
  { name: 'Farah', seed: 22, girl: true },
  { name: 'Hakim', seed: 23, girl: false },
  { name: 'Aisyah', seed: 1, girl: true },
]

/** Your team: you are player 1 (you start each lambungan), then four kids. */
export function pasukanKamu(player, gender) {
  return [
    { id: 'kamu', name: player.name, img: player.img, color: player.color, build: 'kid', look: CHILD_LOOKS[gender] ?? CHILD_LOOKS[GENDERS.LELAKI], you: true },
    ...KID_MATES.map((k) => ({ id: k.name.toLowerCase(), name: k.name, build: 'kid', look: kidLook(k.seed, k.girl) })),
  ]
}

export const PAK_TEAM = GENG_PAK.map((p) => ({ ...p, build: 'adult' }))
export const CAPTAIN = GENG_PAK[0]
