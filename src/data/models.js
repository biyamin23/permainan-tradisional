/**
 * 3D models (GLB, public/models/) that replace the primitive stand-ins.
 * Each model is in metres, Y up, origin at the centre of its footprint on the
 * ground, front facing +Z. Set `url: null` to fall back to the stand-in.
 * The files are shrunk with KHR_mesh_quantization (int16 positions, int8
 * normals, uint16 UVs and indices).
 *
 * `collider` is the solid box(es) used with the model: [halfExtents, centre].
 * `floor` notes walkable heights measured from the model, for placing people.
 */
export const MODELS = {
  // 9.8 × 14.1 m with the serambi (y 1.37, x ±3.9, z 1.45…4.9) and stairs at the front
  tokwan: {
    url: '/models/rumah_tok_wan.glb',
    colliders: [[[4.4, 1.6, 6.0], [0, 1.6, -1.05]], [[1.1, 0.8, 1.0], [0, 0.8, 5.8]]],
    serambi: { y: 1.37, xMin: -3.9, xMax: 3.9, zMin: 1.45, zMax: 4.9 },
    stairsTop: [0, 1.13, 5.2],
  },
  // neighbours: three houses, about 7 × 8.6 m
  rumah: {
    urls: ['/models/rumah_jiran_1.glb', '/models/rumah_jiran_2.glb', '/models/rumah_jiran_3.glb'],
    colliders: [[[3.6, 1.6, 4.4], [0, 1.6, 0]]],
  },
  // warung: 9.8 × 6.75 m; enclosed kitchen at the back (z < -0.6), open floor in front
  warung: {
    url: '/models/warung_kopi.glb',
    colliders: [[[4.5, 1.4, 1.45], [0, 1.4, -2.0]], [[0.12, 0.6, 1.7], [-4.15, 0.6, 1.05]], [[0.12, 0.6, 1.7], [4.15, 0.6, 1.05]]],
    floor: { xMin: -4.0, xMax: 4.0, zMin: -0.45, zMax: 2.65 },
  },
  // sekolah: L-shaped, 20.6 × 11.3 m
  sekolah: {
    url: '/models/sekolah_kampung.glb',
    colliders: [[[6.9, 1.6, 3.2], [-3.4, 1.6, 2.2]], [[5.4, 1.6, 3.4], [5.0, 1.6, -2.3]]],
  },
  // arched bridge, 3.16 × 8 m; plank tops 1.03 m up at the ends, 1.55 m mid-span.
  // It is sunk `sink` m into the ground so the ends meet the road.
  jambatan: { url: '/models/jambatan_kayu.glb', size: [3.16, 8], deck: { end: 1.03, mid: 1.55 }, sink: 0.78 },
  // stepped rocks with water, 7.4 × 5.8 m, water spilling towards +z
  airTerjun: { url: '/models/air_terjun_batu.glb' },
  sampan: { url: '/models/sampan.glb' },
  basikal: { url: '/models/basikal_tua.glb' },
  kelapa: { url: '/models/pokok_kelapa.glb' },
  // Sepak Raga (url: null = the stand-in until the model files arrive)
  // bola raga: rotan asli (new, light) and rotan lama (old, dark); 14 cm across, centred
  raga: { url: '/models/bola_raga.glb' },
  ragaLama: { url: '/models/bola_raga_lama.glb' },
  bangku: { url: '/models/bangku_kayu_panjang.glb' }, // 2.5 × 0.37 m, seat 0.45 m up
  // easel scoreboard, 1.15 × 1.56 m; the chalk face (scores drawn on it) is 1.04 × 0.72 m,
  // centred at y 1.09, z 0.16, leaning back 0.106 rad
  papanMata: { url: '/models/papan_mata_kayu.glb', face: { position: [0, 1.089, 0.166], tilt: -0.106, size: [1.0, 0.69] } },
  // padang lamp post, 5.45 m, two lamps on a cross-arm
  lampuPadang: { url: '/models/tiang_lampu_padang.glb' },
  // picnic table with its benches, 2.15 m square, top 0.76 m up
  meja: { url: '/models/meja_kayu.glb' },
  // Teng-teng: the gundu (5–7 cm, lying flat), a pair of selipar and a stick of kapur
  gunduGenting: { url: '/models/gundu_genting.glb' },
  gunduBatu: { url: '/models/gundu_batu.glb' },
  gunduTin: { url: '/models/gundu_tin.glb' },
  selipar: { url: '/models/selipar_jepun.glb' },
  // Amru and Sameer (life/Rascals.jsx): one static mesh each, 1.72 m, feet at 0,
  // facing +z; rigged at load by life/autoRig.js, shown at the kampung kids' height
  amru: { url: '/models/npc_amru.glb' },
  sameer: { url: '/models/npc_sameer.glb' },
  kapur: { url: '/models/kapur_tulis.glb' },
}
