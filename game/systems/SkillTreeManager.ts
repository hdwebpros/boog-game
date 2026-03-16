import { SKILLS, SKILL_MAP, SUPER_TREES, SUPER_TREE_MAP, xpForLevel, PARAGON_CATEGORIES, PARAGON_MAP } from '../data/skills'
import type { SkillBranch } from '../data/skills'

export interface SkillModifiers {
  meleeDamageMult: number
  rangedDamageMult: number
  magicDamageMult: number
  attackSpeedMult: number
  critChance: number
  maxHpBonus: number
  hpRegen: number
  defenseBonus: number
  healOnKillPct: number
  mineSpeedMult: number
  miningRangeBonus: number
  doubleDropChance: number
  maxManaBonus: number
  manaRegenMult: number
  manaShieldPct: number
  moveSpeedMult: number
  fallDamageMult: number
  doubleJump: boolean
  jetpackFuelMult: number
  lowHpDamageMult: number
  // Super skill modifiers
  lifeStealPct: number
  undying: boolean
  arcaneStrikes: boolean
  manaOverload: boolean
  aoeMining: boolean
  // Ascension modifiers
  voidDamageMultiplier: number
  killHealPercent: number
  dodgeChance: number
  allDamageMultiplier: number
  damageReduction: number
  allStatsMultiplier: number
}

export class SkillTreeManager {
  unlockedSkills: Set<string> = new Set()
  xp = 0
  level = 0
  skillPoints = 0
  /** Paragon points allocated per category id */
  paragonPoints: Record<string, number> = {}
  /** Total paragon levels earned (for display) */
  paragonLevel = 0

  private cachedModifiers: SkillModifiers | null = null

  /** Check if every skill in the tree has been unlocked */
  allSkillsUnlocked(): boolean {
    return SKILLS.every(s => this.unlockedSkills.has(s.id))
  }

  /** Add XP and check for level ups. Returns number of levels gained. */
  addXP(amount: number): number {
    this.xp += amount
    let levelsGained = 0
    while (this.xp >= xpForLevel(this.level + 1)) {
      this.level++
      // If all skills are unlocked, new points go to unspent paragon pool
      // otherwise they go to skill points as normal
      if (this.allSkillsUnlocked() && this.skillPoints === 0) {
        this.paragonLevel++
        this.skillPoints++ // still goes to skillPoints, spent via allocateParagon
      } else {
        this.skillPoints++
      }
      levelsGained++
    }
    return levelsGained
  }

  /** Allocate a paragon point to a category. Returns true if successful. */
  allocateParagon(categoryId: string): boolean {
    if (this.skillPoints < 1) return false
    if (!this.allSkillsUnlocked()) return false
    if (!PARAGON_MAP[categoryId]) return false
    this.skillPoints--
    this.paragonPoints[categoryId] = (this.paragonPoints[categoryId] ?? 0) + 1
    this.cachedModifiers = null
    return true
  }

  /** Get total paragon points spent across all categories */
  totalParagonSpent(): number {
    let total = 0
    for (const cat of PARAGON_CATEGORIES) {
      total += this.paragonPoints[cat.id] ?? 0
    }
    return total
  }

  /** XP needed for next level */
  xpToNextLevel(): number {
    return xpForLevel(this.level + 1)
  }

  /** Check if all skills in a branch (non-super) are unlocked */
  isBranchComplete(branch: SkillBranch): boolean {
    const branchSkills = SKILLS.filter(s => s.branch === branch && !s.superTree)
    return branchSkills.every(s => this.unlockedSkills.has(s.id))
  }

  /** Check if a super tree's requirements are met (both branches fully complete) */
  isSuperTreeUnlocked(superTreeId: string): boolean {
    const st = SUPER_TREE_MAP[superTreeId]
    if (!st) return false
    return st.branches.every(b => this.isBranchComplete(b))
  }

  /** Check if all skills in a super tree are unlocked (tree is completed) */
  isSuperTreeComplete(superTreeId: string): boolean {
    const stSkills = SKILLS.filter(s => s.superTree === superTreeId)
    return stSkills.length > 0 && stSkills.every(s => this.unlockedSkills.has(s.id))
  }

  /** Count how many super trees are fully completed */
  completedSuperTreeCount(): number {
    return SUPER_TREES.filter(st => this.isSuperTreeComplete(st.id)).length
  }

  /** Reset all skills and paragon points, refunding all spent points */
  resetSkills(): void {
    // Calculate total points spent on skills
    let refunded = 0
    for (const skillId of this.unlockedSkills) {
      const s = SKILL_MAP[skillId]
      if (s) refunded += s.cost
    }
    // Add back paragon points
    for (const cat of PARAGON_CATEGORIES) {
      refunded += this.paragonPoints[cat.id] ?? 0
    }
    this.unlockedSkills.clear()
    this.paragonPoints = {}
    this.skillPoints += refunded
    this.cachedModifiers = null
  }

  /** Check if a skill can be unlocked */
  canUnlock(skillId: string): boolean {
    const skill = SKILL_MAP[skillId]
    if (!skill) return false
    if (this.unlockedSkills.has(skillId)) return false
    if (this.skillPoints < skill.cost) return false
    // Super tree skill: requires both branches complete
    if (skill.superTree && !this.isSuperTreeUnlocked(skill.superTree)) return false
    if (skill.requires && !this.unlockedSkills.has(skill.requires)) return false
    // Multiple prerequisites (all required)
    if (skill.prerequisites && !skill.prerequisites.every(p => this.unlockedSkills.has(p))) return false
    // Required number of completed super trees (for ascension skills)
    if (skill.requiredSuperTrees && this.completedSuperTreeCount() < skill.requiredSuperTrees) return false
    return true
  }

  /** Unlock a skill. Returns true if successful. */
  unlock(skillId: string): boolean {
    if (!this.canUnlock(skillId)) return false
    const skill = SKILL_MAP[skillId]!
    this.skillPoints -= skill.cost
    this.unlockedSkills.add(skillId)
    this.cachedModifiers = null // invalidate cache
    return true
  }

  /** Check if a skill is unlocked */
  hasSkill(skillId: string): boolean {
    return this.unlockedSkills.has(skillId)
  }

  /** Get computed stat modifiers from all unlocked skills */
  getModifiers(): SkillModifiers {
    if (this.cachedModifiers) return this.cachedModifiers

    const mods: SkillModifiers = {
      meleeDamageMult: 1,
      rangedDamageMult: 1,
      magicDamageMult: 1,
      attackSpeedMult: 1,
      critChance: 0,
      maxHpBonus: 0,
      hpRegen: 0,
      defenseBonus: 0,
      healOnKillPct: 0,
      mineSpeedMult: 1,
      miningRangeBonus: 0,
      doubleDropChance: 0,
      maxManaBonus: 0,
      manaRegenMult: 1,
      manaShieldPct: 0,
      moveSpeedMult: 1,
      fallDamageMult: 1,
      doubleJump: false,
      jetpackFuelMult: 1,
      lowHpDamageMult: 1,
      lifeStealPct: 0,
      undying: false,
      arcaneStrikes: false,
      manaOverload: false,
      aoeMining: false,
      // Ascension
      voidDamageMultiplier: 1,
      killHealPercent: 0,
      dodgeChance: 0,
      allDamageMultiplier: 1,
      damageReduction: 0,
      allStatsMultiplier: 1,
    }

    for (const skillId of this.unlockedSkills) {
      const s = SKILL_MAP[skillId]
      if (!s) continue
      // Multiplicative stacking for multipliers, additive for flat bonuses
      if (s.meleeDamageMult) mods.meleeDamageMult *= s.meleeDamageMult
      if (s.rangedDamageMult) mods.rangedDamageMult *= s.rangedDamageMult
      if (s.magicDamageMult) mods.magicDamageMult *= s.magicDamageMult
      if (s.attackSpeedMult) mods.attackSpeedMult *= s.attackSpeedMult
      if (s.critChance) mods.critChance += s.critChance
      if (s.maxHpBonus) mods.maxHpBonus += s.maxHpBonus
      if (s.hpRegen) mods.hpRegen += s.hpRegen
      if (s.defenseBonus) mods.defenseBonus += s.defenseBonus
      if (s.healOnKillPct) mods.healOnKillPct += s.healOnKillPct
      if (s.mineSpeedMult) mods.mineSpeedMult *= s.mineSpeedMult
      if (s.miningRangeBonus) mods.miningRangeBonus += s.miningRangeBonus
      if (s.doubleDropChance) mods.doubleDropChance += s.doubleDropChance
      if (s.maxManaBonus) mods.maxManaBonus += s.maxManaBonus
      if (s.manaRegenMult) mods.manaRegenMult *= s.manaRegenMult
      if (s.manaShieldPct) mods.manaShieldPct += s.manaShieldPct
      if (s.moveSpeedMult) mods.moveSpeedMult *= s.moveSpeedMult
      if (s.fallDamageMult !== undefined) mods.fallDamageMult *= s.fallDamageMult
      if (s.doubleJump) mods.doubleJump = true
      if (s.jetpackFuelMult) mods.jetpackFuelMult *= s.jetpackFuelMult
      if (s.lowHpDamageMult) mods.lowHpDamageMult *= s.lowHpDamageMult
      // Super modifiers
      if (s.lifeStealPct) mods.lifeStealPct += s.lifeStealPct
      if (s.undying) mods.undying = true
      if (s.arcaneStrikes) mods.arcaneStrikes = true
      if (s.manaOverload) mods.manaOverload = true
      if (s.aoeMining) mods.aoeMining = true
      // Ascension modifiers
      if (s.voidDamageMultiplier) mods.voidDamageMultiplier *= s.voidDamageMultiplier
      if (s.killHealPercent) mods.killHealPercent += s.killHealPercent
      if (s.dodgeChance) mods.dodgeChance += s.dodgeChance
      if (s.allDamageMultiplier) mods.allDamageMultiplier *= s.allDamageMultiplier
      if (s.damageReduction) mods.damageReduction += s.damageReduction
      if (s.allStatsMultiplier) mods.allStatsMultiplier *= s.allStatsMultiplier
    }

    // Apply paragon bonuses
    for (const cat of PARAGON_CATEGORIES) {
      const pts = this.paragonPoints[cat.id] ?? 0
      if (pts <= 0) continue
      const pp = cat.perPoint
      if (pp.maxHpBonus) mods.maxHpBonus += pp.maxHpBonus * pts
      if (pp.defenseBonus) mods.defenseBonus += pp.defenseBonus * pts
      if (pp.maxManaBonus) mods.maxManaBonus += pp.maxManaBonus * pts
      if (pp.meleeDamageMult) mods.meleeDamageMult *= Math.pow(pp.meleeDamageMult, pts)
      if (pp.rangedDamageMult) mods.rangedDamageMult *= Math.pow(pp.rangedDamageMult, pts)
      if (pp.magicDamageMult) mods.magicDamageMult *= Math.pow(pp.magicDamageMult, pts)
      if (pp.mineSpeedMult) mods.mineSpeedMult *= Math.pow(pp.mineSpeedMult, pts)
      if (pp.moveSpeedMult) mods.moveSpeedMult *= Math.pow(pp.moveSpeedMult, pts)
      if (pp.dodgeChance) mods.dodgeChance += pp.dodgeChance * pts
    }

    this.cachedModifiers = mods
    return mods
  }

  /** Serialize for saving */
  toSaveData(): { xp: number; level: number; skillPoints: number; unlockedSkills: string[]; paragonPoints?: Record<string, number>; paragonLevel?: number } {
    return {
      xp: this.xp,
      level: this.level,
      skillPoints: this.skillPoints,
      unlockedSkills: Array.from(this.unlockedSkills),
      paragonPoints: this.totalParagonSpent() > 0 ? { ...this.paragonPoints } : undefined,
      paragonLevel: this.paragonLevel > 0 ? this.paragonLevel : undefined,
    }
  }

  /** Restore from save data */
  loadSaveData(data: { xp: number; level: number; skillPoints: number; unlockedSkills: string[]; paragonPoints?: Record<string, number>; paragonLevel?: number }) {
    this.xp = data.xp
    this.level = data.level
    this.skillPoints = data.skillPoints
    this.unlockedSkills = new Set(data.unlockedSkills)
    this.paragonPoints = data.paragonPoints ? { ...data.paragonPoints } : {}
    this.paragonLevel = data.paragonLevel ?? 0
    this.cachedModifiers = null
  }
}
