import type { BuffType } from '../data/potions'
import { BUFF_DEFS } from '../data/potions'

export interface ActiveBuff {
  type: BuffType
  remaining: number // ms
  duration: number  // total ms (for progress bar)
}

/** Tracks active timed buffs on the player. */
export class BuffManager {
  private buffs: Map<BuffType, ActiveBuff> = new Map()

  /** Apply a buff (refreshes duration if already active). */
  apply(type: BuffType) {
    const def = BUFF_DEFS[type]
    if (!def) return
    this.buffs.set(type, {
      type,
      remaining: def.duration,
      duration: def.duration,
    })
  }

  /** Remove a specific buff. */
  remove(type: BuffType) {
    this.buffs.delete(type)
  }

  /** Clear all active buffs (e.g. on death). */
  clearAll() {
    this.buffs.clear()
  }

  /** Tick all buff timers. Call once per frame with dt in seconds. */
  update(dt: number) {
    const dtMs = dt * 1000
    for (const [type, buff] of this.buffs) {
      buff.remaining -= dtMs
      if (buff.remaining <= 0) {
        this.buffs.delete(type)
      }
    }
  }

  /** Check if a specific buff is active. */
  has(type: BuffType): boolean {
    return this.buffs.has(type)
  }

  /** Get remaining time for a buff in ms, or 0 if not active. */
  getRemaining(type: BuffType): number {
    return this.buffs.get(type)?.remaining ?? 0
  }

  /** Get all active buffs (for UI rendering). */
  getActiveBuffs(): ActiveBuff[] {
    return Array.from(this.buffs.values())
  }

  // ─── Aggregated stat getters ──────────────────────────────

  getDefenseBonus(): number {
    let total = 0
    for (const buff of this.buffs.values()) {
      const def = BUFF_DEFS[buff.type]
      if (def.defenseBonus) total += def.defenseBonus
    }
    return total
  }

  getMoveSpeedMult(): number {
    let mult = 1
    for (const buff of this.buffs.values()) {
      const def = BUFF_DEFS[buff.type]
      if (def.moveSpeedMult) mult *= def.moveSpeedMult
    }
    return mult
  }

  getDamageMult(): number {
    let mult = 1
    for (const buff of this.buffs.values()) {
      const def = BUFF_DEFS[buff.type]
      if (def.damageMult) mult *= def.damageMult
    }
    return mult
  }

  getMeleeDamageMult(): number {
    let mult = 1
    for (const buff of this.buffs.values()) {
      const def = BUFF_DEFS[buff.type]
      if (def.meleeDamageMult) mult *= def.meleeDamageMult
    }
    return mult
  }

  getRangedDamageMult(): number {
    let mult = 1
    for (const buff of this.buffs.values()) {
      const def = BUFF_DEFS[buff.type]
      if (def.rangedDamageMult) mult *= def.rangedDamageMult
    }
    return mult
  }

  getMagicDamageMult(): number {
    let mult = 1
    for (const buff of this.buffs.values()) {
      const def = BUFF_DEFS[buff.type]
      if (def.magicDamageMult) mult *= def.magicDamageMult
    }
    return mult
  }

  getHpRegen(): number {
    let total = 0
    for (const buff of this.buffs.values()) {
      const def = BUFF_DEFS[buff.type]
      if (def.hpRegen) total += def.hpRegen
    }
    return total
  }

  getManaRegenMult(): number {
    let mult = 1
    for (const buff of this.buffs.values()) {
      const def = BUFF_DEFS[buff.type]
      if (def.manaRegenMult) mult *= def.manaRegenMult
    }
    return mult
  }

  getThornsPct(): number {
    let total = 0
    for (const buff of this.buffs.values()) {
      const def = BUFF_DEFS[buff.type]
      if (def.thornsPct) total += def.thornsPct
    }
    return total
  }

  getMaxHpBonus(): number {
    let total = 0
    for (const buff of this.buffs.values()) {
      const def = BUFF_DEFS[buff.type]
      if (def.maxHpBonus) total += def.maxHpBonus
    }
    return total
  }

  getMineSpeedMult(): number {
    let mult = 1
    for (const buff of this.buffs.values()) {
      const def = BUFF_DEFS[buff.type]
      if (def.mineSpeedMult) mult *= def.mineSpeedMult
    }
    return mult
  }

  getDamageTakenMult(): number {
    let mult = 1
    for (const buff of this.buffs.values()) {
      const def = BUFF_DEFS[buff.type]
      if (def.damageTakenMult) mult *= def.damageTakenMult
    }
    return mult
  }

  hasNoFallDamage(): boolean {
    for (const buff of this.buffs.values()) {
      const def = BUFF_DEFS[buff.type]
      if (def.noFallDamage) return true
    }
    return false
  }

  hasWaterWalking(): boolean {
    return this.has('water_walking')
  }

  hasSpelunker(): boolean {
    return this.has('spelunker')
  }

  hasNightVision(): boolean {
    return this.has('night_owl')
  }

  /** Serialize active buffs for save data. */
  serialize(): { type: BuffType; remaining: number; duration: number }[] {
    return this.getActiveBuffs().map(b => ({
      type: b.type,
      remaining: b.remaining,
      duration: b.duration,
    }))
  }

  /** Restore buffs from save data. */
  deserialize(data: { type: BuffType; remaining: number; duration: number }[]) {
    this.buffs.clear()
    for (const b of data) {
      if (BUFF_DEFS[b.type]) {
        this.buffs.set(b.type, { type: b.type, remaining: b.remaining, duration: b.duration })
      }
    }
  }
}
