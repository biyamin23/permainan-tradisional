/**
 * The kampung is laid out after the illustrated map "Peta Kampung Halaman"
 * (public/peta/peta-kampung.webp, 1536 × 1024). Places are written in that
 * picture's pixel coordinates and converted to world metres here, so the 3D
 * kampung and the Peta screen always agree. +x is east (right on the map),
 * +z is south (down).
 */
export const MAP_SIZE = [1536, 1024]
export const MAP_SCALE = 0.11 // metres per map pixel

/** Map pixel → world [x, z] in metres. */
export const px = (u, v) => [(u - MAP_SIZE[0] / 2) * MAP_SCALE, (v - MAP_SIZE[1] / 2) * MAP_SCALE]

/** World [x, z] → map pixel [u, v]. */
export const toMap = (x, z) => [x / MAP_SCALE + MAP_SIZE[0] / 2, z / MAP_SCALE + MAP_SIZE[1] / 2]
