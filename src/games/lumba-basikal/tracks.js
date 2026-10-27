/**
 * The three litar. Each is one closed loop (one lap, start = finish), laid
 * out as control points in metres; everything else is placed by `at`, a
 * fraction of the way round (0 = the start line), and `lat`, metres to the
 * right (+) or left (-) of the middle of the road.
 *
 * Add a track by adding an entry here; the race, the AI, the checkpoints and
 * the scenery are all built from it.
 *
 * width      road width (m); `narrow` lists stretches that are narrower
 * surface    'tar' (grey) or 'tanah' (red earth)
 * bridges    jambatan kayu over a stream (the road narrows and humps over it)
 * hills      a stretch of road over a bukit kecil: { at, len (fraction), h (m) }
 * mud        lumpur patches that slow you down
 * shortcuts  a narrow dirt path across the inside of a bend, from `from` to `to`
 * obstacles  ayam | lopak | lubang | batu | ranting | motosikal | orang
 * scenery    houses / warung / kebun / palms placed beside the road
 *
 * Kamarul's skill isn't set by the litar: it follows yours (progression/adapters.js).
 */
export const TRACKS = [
  {
    id: 'mudah',
    level: 'LITAR 1',
    stars: 1,
    name: 'Jalan Kampung',
    description: 'Laluan mudah. Sesuai untuk pemanas badan.',
    color: '#3f9d4a',
    surface: 'tar',
    width: 8,
    points: [
      [0, -60], [60, -62], [105, -40], [118, 0], [100, 45], [55, 62], [0, 58], [-50, 62], [-95, 40], [-110, 0], [-90, -45], [-45, -60],
    ],
    narrow: [],
    bridges: [{ at: 0.43 }],
    hills: [],
    mud: [],
    shortcuts: [],
    checkpoints: [0.25, 0.5, 0.75],
    finalStretch: 0.86,
    obstacles: [
      { type: 'lopak', at: 0.18, lat: 1.6 },
      { type: 'ayam', at: 0.33, lat: -1.5 },
      { type: 'batu', at: 0.62, lat: 2.4 },
      { type: 'ayam', at: 0.71, lat: 1 },
      { type: 'lopak', at: 0.79, lat: -2 },
      { type: 'lubang', at: 0.55, lat: -1.8 },
    ],
    scenery: { houses: 9, warung: [{ at: 0.08, side: 1 }], kebun: [], palms: 26, trees: 70 },
  },
  {
    id: 'biasa',
    level: 'LITAR 2',
    stars: 2,
    name: 'Lorong Kampung',
    description: 'Jalan lebih sempit. Kena pandai kawal basikal.',
    color: '#e7a92a',
    surface: 'tanah',
    width: 5.6,
    points: [
      [0, -52], [42, -56], [74, -38], [66, -8], [88, 18], [78, 50], [44, 56], [22, 34], [-6, 50], [-42, 56], [-72, 36], [-60, 6], [-84, -24], [-52, -50],
    ],
    narrow: [{ from: 0.6, to: 0.66, width: 4.2 }],
    bridges: [{ at: 0.3 }],
    hills: [],
    mud: [],
    shortcuts: [{ from: 0.455, to: 0.535, width: 2.2 }],
    checkpoints: [0.25, 0.5, 0.75],
    finalStretch: 0.86,
    obstacles: [
      { type: 'ayam', at: 0.12, lat: 0.8 },
      { type: 'lopak', at: 0.2, lat: -1 },
      { type: 'motosikal', at: 0.4 },
      { type: 'ayam', at: 0.58, lat: -0.6 },
      { type: 'lopak', at: 0.64, lat: 0.9 },
      { type: 'ranting', at: 0.7, lat: -1.2 },
      { type: 'orang', at: 0.8 },
      { type: 'batu', at: 0.92, lat: 1.5 },
      { type: 'lubang', at: 0.16, lat: 1.2 },
      { type: 'lubang', at: 0.68, lat: -0.9 },
      { type: 'lubang', at: 0.88, lat: 0.4 },
    ],
    scenery: { houses: 8, warung: [{ at: 0.9, side: -1 }], kebun: [{ from: 0.55, to: 0.7, side: 1 }], palms: 20, trees: 80 },
  },
  {
    id: 'jaguh',
    level: 'LITAR 3',
    stars: 3,
    name: 'Litar Cabaran',
    description: 'Laluan paling susah. Banyak selekoh dan jalan sempit.',
    color: '#d9483b',
    surface: 'tanah',
    width: 4.4,
    points: [
      [0, -46], [32, -50], [52, -30], [36, -8], [56, 12], [82, 2], [97, 27], [72, 47], [42, 38], [22, 58], [-10, 48], [-20, 22], [-46, 32], [-72, 17], [-62, -10], [-82, -32], [-52, -52], [-26, -38],
    ],
    narrow: [{ from: 0.2, to: 0.26, width: 3.4 }, { from: 0.83, to: 0.88, width: 3.4 }],
    bridges: [{ at: 0.33 }, { at: 0.74 }],
    hills: [{ at: 0.5, len: 0.08, h: 2.2 }],
    mud: [{ at: 0.42, lat: 0, len: 9, w: 4.4 }, { at: 0.62, lat: 0.8, len: 6, w: 3 }],
    shortcuts: [{ from: 0.555, to: 0.635, width: 1.8, mud: true }],
    checkpoints: [0.25, 0.5, 0.75],
    finalStretch: 0.87,
    obstacles: [
      { type: 'batu', at: 0.1, lat: -0.9 },
      { type: 'ranting', at: 0.16, lat: 0.8 },
      { type: 'ayam', at: 0.28, lat: 0.4 },
      { type: 'motosikal', at: 0.46 },
      { type: 'batu', at: 0.67, lat: 1.1 },
      { type: 'orang', at: 0.79 },
      { type: 'ayam', at: 0.9, lat: -0.8 },
      { type: 'ranting', at: 0.95, lat: 0.6 },
      { type: 'lubang', at: 0.07, lat: 0.9 },
      { type: 'lubang', at: 0.37, lat: -0.6 },
      { type: 'lubang', at: 0.53, lat: 0.5 },
      { type: 'lubang', at: 0.71, lat: -1.0 },
    ],
    scenery: { houses: 6, warung: [{ at: 0.04, side: -1 }], kebun: [{ from: 0.06, to: 0.18, side: -1 }], palms: 16, trees: 110 },
  },
]

export const getTrack = (id) => TRACKS.find((t) => t.id === id) ?? TRACKS[0]
