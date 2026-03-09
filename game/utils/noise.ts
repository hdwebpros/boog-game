import { createNoise2D } from 'simplex-noise'

/**
 * Seeded PRNG (mulberry32) — deterministic random from a numeric seed.
 */
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Create a 2D simplex noise function seeded with a number.
 */
export function createSeededNoise(seed: number) {
  const rng = mulberry32(seed)
  return createNoise2D(rng)
}

/**
 * Hash a string seed to a numeric seed.
 */
export function hashSeed(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return hash
}
