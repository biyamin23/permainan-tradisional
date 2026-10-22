/**
 * 3D models (GLB) that replace the primitive stand-ins, once they exist.
 * Put the file in public/models/ and fill in its entry here. Leave `url`
 * null to keep the built-in stand-in. Models are expected in metres, Y up,
 * origin at the centre of the footprint on the ground, front facing +Z;
 * `scale` / `rotationY` / `offset` correct small differences.
 *
 * Colliders stay the stand-in's, so a model should keep roughly the same
 * footprint (sizes noted below).
 */
export const MODELS = {
  // Tok Wan's house: 8 × 7 m body + 2.6 m serambi at the front (+z), floor 1.4 m up
  tokwan: { url: null, scale: 1, rotationY: 0, offset: [0, 0, 0] },
  // neighbours' houses: same footprint as Tok Wan's
  rumah: { urls: [], scale: 1, rotationY: 0, offset: [0, 0, 0] },
  // the warung / kedai kopi: 7.6 × 5.6 m, open front (+z)
  warung: { url: null, scale: 1, rotationY: 0, offset: [0, 0, 0] },
  // sekolah: about 32 × 18 m, two blocks
  sekolah: { url: null, scale: 1, rotationY: 0, offset: [0, 0, 0] },
  // wooden bridge: about 8 m long (along z) and 3 m wide
  jambatan: { url: null, scale: 1, rotationY: 0, offset: [0, 0, 0] },
}
