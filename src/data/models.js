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
    stairsTop: [0, 1.37, 5.0],
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
  // arched bridge, 3.16 × 8 m; deck 0.9 m up at the ends, 1.47 m in the middle
  jambatan: { url: '/models/jambatan_kayu.glb', size: [3.16, 8], deck: { end: 0.95, mid: 1.47 } },
  // stepped rocks with water, 7.4 × 5.8 m, water spilling towards +z
  airTerjun: { url: '/models/air_terjun_batu.glb' },
  sampan: { url: '/models/sampan.glb' },
  basikal: { url: '/models/basikal_tua.glb' },
  kelapa: { url: '/models/pokok_kelapa.glb' },
}
