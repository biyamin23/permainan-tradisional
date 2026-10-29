/**
 * The five basikal you can race. Everything a bike does comes from here:
 * the race sim reads these numbers, the picker shows them as bars.
 *
 * maxSpeed     m/s at full pedal (≈ km/j ÷ 3.6)
 * acceleration m/s² from a standstill (it tapers off near max speed)
 * handling     0..1 how sharply it turns
 * braking      m/s² of brake
 * stability    0..1 how little a knock (ayam, batu, lopak) upsets it
 * modelPath    GLB in public/models (metres, ground at y 0, front +Z)
 * scale        drawn this much bigger (the kids' bike is modelled for a
 *              toddler; our kampung kids are a size up)
 * minLevel     overall Level needed to ride it (the five from
 *              low_poly_bicycles.glb, CC-BY-4.0 by EdwinRC on Sketchfab, are
 *              for Level 10 and up)
 */
export const BICYCLES = [
  {
    id: 'bmx',
    name: 'BMX Krom',
    modelPath: '/models/basikal_bmx_krom.glb',
    maxSpeed: 8.4,
    acceleration: 4.3,
    handling: 0.95,
    braking: 9,
    stability: 0.45,
    description: 'Ringan dan lincah. Sesuai untuk masuk selekoh dengan cepat.',
  },
  {
    id: 'chopper',
    name: 'Chopper Biru',
    modelPath: '/models/basikal_chopper_biru.glb',
    maxSpeed: 8.5,
    acceleration: 3.7,
    handling: 0.78,
    braking: 8,
    stability: 0.7,
    description: 'Seimbang dan mudah dikawal. Pilihan selamat untuk semua litar.',
  },
  {
    id: 'tua',
    name: 'Basikal Tua',
    modelPath: '/models/basikal_tua_hitam_bakul.glb',
    maxSpeed: 9.2,
    acceleration: 2.6,
    handling: 0.55,
    braking: 6,
    stability: 0.95,
    description: 'Stabil tetapi berat. Lambat bermula, tapi laju di jalan lurus.',
  },
  {
    id: 'mini',
    name: 'Mini Biru',
    modelPath: '/models/basikal_mini_biru_bakul.glb',
    maxSpeed: 8.0,
    acceleration: 4.7,
    handling: 0.82,
    braking: 8.5,
    stability: 0.6,
    description: 'Ringan, pecutan paling bagus. Cepat laju semula lepas selekoh.',
  },
  {
    id: 'kanak',
    name: 'Basikal Kanak-kanak',
    modelPath: '/models/basikal_kanak_kanak_biru.glb',
    maxSpeed: 7.0,
    acceleration: 4.0,
    handling: 0.88,
    braking: 9.5,
    stability: 1,
    scale: 1.35,
    description: 'Sangat stabil dengan roda sisi. Tak mudah goyang, tapi tak berapa laju.',
  },

  // ---------------------------------------------------------------- Level 10+
  {
    // a proper mountain bike: knobbly tyres, suspension fork, gears
    id: 'gunung',
    name: 'Gunung Merah',
    modelPath: '/models/basikal_gunung_merah.glb',
    minLevel: 10,
    maxSpeed: 9.6,
    acceleration: 4.2,
    handling: 0.86,
    braking: 9.5,
    stability: 0.88,
    description: 'Basikal gunung bergear. Laju, cengkam kuat, tak gentar lubang dan lumpur.',
  },
  {
    // tiny wheels, a square frame and a tall seat post: odd, but it goes
    id: 'kotak',
    name: 'Kotak Oren',
    modelPath: '/models/basikal_kotak_oren.glb',
    minLevel: 10,
    maxSpeed: 8.7,
    acceleration: 5.2,
    handling: 0.93,
    braking: 8.5,
    stability: 0.5,
    description: 'Rangka segi empat, roda kecil. Pecutan paling ganas, tapi mudah tergelincir.',
  },
  {
    // a penny-farthing: one enormous wheel, pedalled at the hub
    id: 'gergasi',
    name: 'Roda Gergasi',
    modelPath: '/models/basikal_roda_gergasi.glb',
    minLevel: 10,
    maxSpeed: 10.6,
    acceleration: 2.1,
    handling: 0.42,
    braking: 5,
    stability: 0.35,
    description: 'Roda depan gergasi. Paling laju di jalan lurus, tapi susah membelok dan senang jatuh.',
  },
  {
    // a low chopper trike with fat back wheels and tall bars
    id: 'trike',
    name: 'Trike Raja Jalanan',
    modelPath: '/models/basikal_trike_chopper.glb',
    minLevel: 10,
    maxSpeed: 9.1,
    acceleration: 3.1,
    handling: 0.6,
    braking: 7.5,
    stability: 1,
    description: 'Tiga roda, rendah dan bergaya. Langsung tak goyang bila terlanggar.',
  },
  {
    // a racing BMX: light, stiff, made for corners
    id: 'bmx-pro',
    name: 'BMX Hijau Pro',
    modelPath: '/models/basikal_bmx_hijau.glb',
    minLevel: 10,
    maxSpeed: 9.2,
    acceleration: 4.9,
    handling: 1,
    braking: 10,
    stability: 0.55,
    description: 'BMX lumba. Membelok paling tajam dan brek paling kuat.',
  },
]

/** Whether someone at overall `level` may ride `bike`. */
export const canRide = (bike, level) => level >= (bike.minLevel ?? 0)

export const getBicycle = (id) => BICYCLES.find((b) => b.id === id) ?? BICYCLES[0]

// 1..5 bars for the picker, relative to the slowest and fastest bike
const range = (key) => {
  const v = BICYCLES.map((b) => b[key])
  return [Math.min(...v), Math.max(...v)]
}
const bars = (key, value) => {
  const [lo, hi] = range(key)
  return Math.round(1 + ((value - lo) / (hi - lo || 1)) * 4)
}
export const statBars = (b) => ({
  Kelajuan: bars('maxSpeed', b.maxSpeed),
  Pecutan: bars('acceleration', b.acceleration),
  Kawalan: bars('handling', b.handling + b.stability * 0.3),
})
