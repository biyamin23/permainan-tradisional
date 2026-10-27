import { clamp, lerp, smoothstep } from './rules'

/**
 * DynamicDifficultyManager's adapters: each game turns the one difficulty
 * number (0..1, never shown) into things that make sense for that game.
 * No adapter makes an opponent cheat: they only change how well it plays
 * (how deep it looks, how often it slips) or, for the reaction games, how
 * much timing room you get, within limits a person can always manage.
 *
 * Roughly: d 0.1 ≈ the old "Mudah", d 0.5 ≈ "Biasa", d 0.9 ≈ "Pakar".
 */

export const ADAPTERS = {
  /** Aisyah: plans further ahead and slips less. Same rules as you. */
  congkak(d) {
    return {
      // chance she just picks any legal pit (a beginner's understandable slip)
      mistake: lerp(0.6, 0.02, smoothstep(0.08, 0.85, d)),
      // turns looked ahead: 1 = best for this turn only, up to 4 = sees your replies
      plies: d < 0.3 ? 1 : d < 0.55 ? 2 : d < 0.78 ? 3 : 4,
      // she counts guli in the pits she leaves you (strategic awareness)
      guard: lerp(0, 1, smoothstep(0.35, 0.8, d)),
    }
  },

  /** Pak Tam: searches deeper, blunders less. */
  dam(d) {
    return {
      depth: Math.round(lerp(1, 7, smoothstep(0.08, 0.92, d))),
      blunder: lerp(0.38, 0.0, smoothstep(0.08, 0.9, d)),
      ms: Math.round(lerp(150, 900, d)),
    }
  },

  /** Your timing window narrows a little; Geng Pak-pak get steadier. */
  'sepak-raga'(d) {
    return {
      timing: lerp(0.22, 0.11, smoothstep(0.08, 0.9, d)), // seconds either side, never under 0.11
      you: lerp(0.97, 0.955, d), // your teammates' clean-touch chance
      them: lerp(0.93, 0.975, smoothstep(0.08, 0.9, d)), // Geng Pak-pak's
    }
  },

  /** Rukiah gets steadier; your rhythm gets a bit quicker and the throw a little less forgiving. */
  'ting-ting'(d) {
    const t = smoothstep(0.08, 0.9, d)
    return {
      timing: { w: lerp(0.2, 0.11, t), beat: lerp(0.8, 0.54, t), aimNoise: lerp(0.06, 0.12, t) },
      ai: { aim: lerp(0.2, 0.08, t), hop: lerp(0.975, 0.993, t), pick: lerp(0.95, 0.985, t), timbang: lerp(0.72, 0.92, t) },
      aimLap: lerp(3.2, 2.0, t), // seconds for the throw meter to go up and back
      drift: lerp(0.55, 1, t), // how fast the gundu on your head wanders in timbang
    }
  },

  /**
   * Kamarul: mostly smarter, only a little faster. Higher difficulty buys
   * better cornering, braking for bends, seeing hazards, shortcuts and pecut
   * timing; his top-speed share only goes 0.9 → 1.05.
   */
  'lumba-basikal'(d) {
    const t = smoothstep(0.05, 0.92, d)
    return {
      pace: lerp(0.9, 1.05, t),
      corner: lerp(4.5, 7.0, t), // lateral grip he dares to use in bends (m/s²)
      avoid: lerp(0.45, 0.97, t), // chance he spots a lubang/batu in time
      shortcut: lerp(0, 0.92, smoothstep(0.25, 0.85, d)),
      boost: lerp(0.15, 1, t), // how readily he pecut-s, and saves it for the end
      mistakes: lerp(0.07, 0.006, t),
      reaction: lerp(0.6, 0.12, t),
      catchUp: lerp(0.94, 1.12, t),
      aggression: lerp(0.3, 1, t),
    }
  },
}

/** The game's tuning for a difficulty (clamped 0..1 first). */
export const tuningFor = (gameId, d) => ADAPTERS[gameId]?.(clamp(d, 0, 1)) ?? {}
