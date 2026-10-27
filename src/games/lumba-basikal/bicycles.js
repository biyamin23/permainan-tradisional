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
]

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
