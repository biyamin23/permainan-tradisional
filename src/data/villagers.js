import { px } from './kampungLayout'

/**
 * Villagers who go about their petang: they walk between places in the
 * kampung along the roads (components/world/life/navigation.js) and do
 * something when they get there. Nothing here is a mission; it's so the
 * kampung carries on living while you stand and watch.
 *
 * PLACES: where people go. `face` is the yaw (radians) they turn to on
 * arrival; `seat` makes it a sitting place (a bench is put there, see
 * components/world/life/Villagers.jsx); `spread` lets several people stand
 * there without standing in each other; `say` is what they might call out.
 *
 * ACTIVITIES: { pose, hand, dur: [min, max] seconds }. The pose names are the
 * PersonModel poses (characterAnimation.js); 'play' is kids chasing each
 * other round the spot, 'talk' turns to whoever else is there.
 */

const place = (u, v, extra = {}) => {
  const [x, z] = px(u, v)
  return { x, z, face: 0, spread: 1.2, ...extra }
}

export const PLACES = {
  // across the road from the warung, a bench to watch the dam game from
  warung: place(1206, 562, { face: Math.PI, seat: true, say: ['Kopi O satu!', 'Ramai orang petang ni.'] }),
  // on the north bank of the sungai, by the batu seremban kids
  tebing: place(452, 500, { face: 0, spread: 1.6, river: true, say: ['Air sungai tenang hari ni.', 'Banyak ikan agaknya.'] }),
  // the school gate at the end of the road
  sekolah: place(904, 312, { face: Math.PI, spread: 1.4, say: ['Esok sekolah, jangan lupa kerja rumah!'] }),
  // the taman: grass between kejar-kejar and police & thief
  taman: place(884, 372, { face: 0.6, spread: 2.6, play: true, say: ['Jom main!', 'Kejar aku kalau boleh!'] }),
  // a bench at the edge of the taman, by the school road
  bangkuTaman: place(800, 452, { face: 2.4, seat: true, say: ['Penat jalan…'] }),
  // watching the gasing at the laman
  gasing: place(722, 664, { face: 1.2, spread: 1.5, say: ['Wah, lama gasing tu pusing!'] }),
  // the road outside Rumah Hijau, Kak Ros's house
  rumahHijau: place(728, 588, { face: -1.2, spread: 1, home: true }),
  // the road by Tok Wan's gate
  pagarTokWan: place(560, 452, { face: Math.PI, spread: 1.4, say: ['Assalamualaikum Tok Wan!'] }),
}

export const VILLAGERS = [
  {
    id: 'kak-ros',
    name: 'Kak Ros',
    build: 'adult',
    look: {
      shirt: '#c2527a',
      bottom: '#7a3f8a',
      bottomType: 'kain',
      longTop: true,
      headwear: 'tudung',
      headwearColor: '#f5efe2',
      slipper: '#d9473b',
    },
    speed: 1.15,
    carry: 'bakul',
    start: 'rumahHijau',
    places: { warung: 3, tebing: 1, gasing: 2, rumahHijau: 2, pagarTokWan: 1 },
    greet: ['Assalamualaikum!', 'Eh, cucu Tok Wan!'],
  },
  {
    id: 'pak-leman',
    name: 'Pak Leman',
    build: 'adult',
    elder: true,
    look: {
      shirt: '#e6dcc4',
      bottom: '#4a5a3a',
      bottomType: 'pelikat',
      headwear: 'songkok',
      hair: '#bdb8ae',
      beard: true,
      slipper: '#3b2a20',
    },
    speed: 0.9,
    start: 'warung',
    places: { warung: 3, sekolah: 1, bangkuTaman: 3, pagarTokWan: 2, gasing: 1 },
    greet: ['Assalamualaikum, nak!', 'Dah makan?'],
  },
  {
    id: 'amin',
    name: 'Amin',
    build: 'kid',
    kid: { seed: 41, girl: false },
    speed: 2.6,
    run: true,
    start: 'taman',
    places: { taman: 4, gasing: 2, tebing: 2 },
    greet: ['Jom main!', 'Kau main apa tadi?'],
  },
  {
    id: 'siti',
    name: 'Siti',
    build: 'kid',
    kid: { seed: 42, girl: true },
    speed: 2.5,
    run: true,
    // goes wherever Amin goes, a step behind
    follow: 'amin',
    start: 'taman',
    places: { taman: 1 },
    greet: ['Hai!', 'Tunggu aku, Amin!'],
  },
]

/** What people do at a place, by kind of place and person. */
export function activitiesFor(person, where) {
  if (where.seat) return [{ pose: 'sitThink', dur: [10, 20] }, { pose: 'sit', dur: [8, 16] }]
  if (person.build === 'kid') {
    if (where.play) return [{ pose: 'play', dur: [10, 18] }, { pose: 'cheer', dur: [2, 4] }, { pose: 'play', dur: [8, 14] }]
    if (where.river) return [{ pose: 'idle', dur: [2, 4] }, { pose: 'skip', dur: [3, 4] }, { pose: 'clap', dur: [1.5, 2.5] }, { pose: 'skip', dur: [3, 4] }]
    return [{ pose: 'cheer', dur: [2, 3] }, { pose: 'clap', dur: [3, 6] }, { pose: 'idle', dur: [3, 6] }]
  }
  if (where.home) return [{ pose: 'sweep', hand: 'broom', dur: [12, 22] }, { pose: 'idle', dur: [3, 6] }]
  return [{ pose: 'talk', dur: [6, 14] }, { pose: 'idle', dur: [3, 8] }, { pose: 'talk', dur: [4, 10] }]
}
