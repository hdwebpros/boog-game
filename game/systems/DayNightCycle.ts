// Day/Night cycle system
// A full day lasts ~8 minutes real-time (480 seconds)
// Night is darker, spawns more enemies, and enables night-only monsters

const DAY_LENGTH = 480 // seconds per full cycle
const DAWN_START = 0.20  // 20% — sunrise begins
const DAWN_END = 0.30    // 30% — full daylight
const DUSK_START = 0.70  // 70% — sunset begins
const DUSK_END = 0.80    // 80% — full night

export class DayNightCycle {
  /** 0..1 representing progress through the day (0 = midnight, 0.5 = noon) */
  time = 0.25 // start at dawn

  update(dt: number) {
    this.time = (this.time + dt / DAY_LENGTH) % 1
  }

  /** Returns true if it's currently "night" (for spawn rules) */
  get isNight(): boolean {
    return this.time < DAWN_START || this.time >= DUSK_END
  }

  /** Returns true during transition periods (dawn/dusk) */
  get isTwilight(): boolean {
    return (this.time >= DAWN_START && this.time < DAWN_END) ||
           (this.time >= DUSK_START && this.time < DUSK_END)
  }

  /**
   * Returns darkness alpha for the overlay (0 = fully lit, up to ~0.55 at midnight).
   * Underground areas use their own darkness so this is mainly for surface.
   */
  get darkness(): number {
    if (this.time >= DAWN_END && this.time < DUSK_START) {
      // Full day — no darkness
      return 0
    }
    if (this.time >= DAWN_START && this.time < DAWN_END) {
      // Dawn transition
      const t = (this.time - DAWN_START) / (DAWN_END - DAWN_START)
      return 0.55 * (1 - t)
    }
    if (this.time >= DUSK_START && this.time < DUSK_END) {
      // Dusk transition
      const t = (this.time - DUSK_START) / (DUSK_END - DUSK_START)
      return 0.55 * t
    }
    // Full night — max darkness
    return 0.55
  }

  /** Spawn rate multiplier — more enemies at night */
  get spawnMultiplier(): number {
    return this.isNight ? 2.0 : 1.0
  }

  /** Time of day label for UI */
  get label(): string {
    if (this.time < DAWN_START) return 'Night'
    if (this.time < DAWN_END) return 'Dawn'
    if (this.time < DUSK_START) return 'Day'
    if (this.time < DUSK_END) return 'Dusk'
    return 'Night'
  }

  /** Sky tint color for the overlay — smoothly interpolated */
  get tintColor(): number {
    const NIGHT = { r: 0x0a, g: 0x0a, b: 0x2a }
    const DAWN  = { r: 0x2a, g: 0x1a, b: 0x0a }
    const DUSK  = { r: 0x1a, g: 0x0a, b: 0x2a }
    const BLACK = { r: 0, g: 0, b: 0 }

    if (this.time >= DAWN_END && this.time < DUSK_START) {
      // Full day — overlay alpha is 0 so color doesn't matter
      return 0x000000
    }

    if (this.time >= DAWN_START && this.time < DAWN_END) {
      // Dawn: night blue → warm orange → black
      const t = (this.time - DAWN_START) / (DAWN_END - DAWN_START)
      if (t < 0.5) return DayNightCycle.lerpColor(NIGHT, DAWN, t * 2)
      return DayNightCycle.lerpColor(DAWN, BLACK, (t - 0.5) * 2)
    }

    if (this.time >= DUSK_START && this.time < DUSK_END) {
      // Dusk: black → purple → night blue
      const t = (this.time - DUSK_START) / (DUSK_END - DUSK_START)
      if (t < 0.5) return DayNightCycle.lerpColor(BLACK, DUSK, t * 2)
      return DayNightCycle.lerpColor(DUSK, NIGHT, (t - 0.5) * 2)
    }

    // Full night
    return 0x0a0a2a
  }

  private static lerpColor(
    a: { r: number; g: number; b: number },
    b: { r: number; g: number; b: number },
    t: number
  ): number {
    const r = Math.round(a.r + (b.r - a.r) * t)
    const g = Math.round(a.g + (b.g - a.g) * t)
    const bl = Math.round(a.b + (b.b - a.b) * t)
    return (r << 16) | (g << 8) | bl
  }
}
