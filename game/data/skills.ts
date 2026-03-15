export enum SkillBranch {
  COMBAT = 'combat',
  SURVIVAL = 'survival',
  MINING = 'mining',
  MAGIC = 'magic',
  MOBILITY = 'mobility',
  ASCENSION = 'ascension',
}

export interface SkillDef {
  id: string
  name: string
  description: string
  branch: SkillBranch
  tier: number          // 1-3 normal, 4 = super tier
  cost: number          // skill points to unlock
  requires?: string     // prerequisite skill id
  prerequisites?: string[]  // multiple prerequisite skill ids (all required)
  superTree?: string    // if set, belongs to a super tree (requires both branches maxed)
  requiredSuperTrees?: number  // number of super trees that must be completed
  // Stat modifiers (multipliers are 1.0 = no change)
  meleeDamageMult?: number
  rangedDamageMult?: number
  magicDamageMult?: number
  attackSpeedMult?: number
  critChance?: number
  maxHpBonus?: number
  hpRegen?: number          // per second
  defenseBonus?: number
  healOnKillPct?: number    // % of max HP healed on kill
  mineSpeedMult?: number
  miningRangeBonus?: number
  doubleDropChance?: number
  maxManaBonus?: number
  manaRegenMult?: number
  manaShieldPct?: number    // % of damage redirected to mana
  moveSpeedMult?: number
  fallDamageMult?: number
  doubleJump?: boolean
  jetpackFuelMult?: number  // <1 = less fuel used
  lowHpDamageMult?: number  // bonus damage when below 30% HP
  // Super skill modifiers
  lifeStealPct?: number     // heal % of damage dealt
  undying?: boolean          // survive lethal hit (cooldown)
  arcaneStrikes?: boolean    // melee releases magic shockwave
  manaOverload?: boolean     // mana >75%: +100% dmg, drains mana per hit
  aoeMining?: boolean        // mine 3x3 area
  // Ascension modifiers
  voidDamageMultiplier?: number
  killHealPercent?: number
  dodgeChance?: number
  allDamageMultiplier?: number
  damageReduction?: number
  allStatsMultiplier?: number
}

// ── Super Tree Definitions ───────────────────────────
export interface SuperTreeDef {
  id: string
  name: string
  branches: [SkillBranch, SkillBranch]
  color: number
  colorStr: string
  icon: string
}

export const SUPER_TREES: SuperTreeDef[] = [
  {
    id: 'warlord',
    name: 'Warlord',
    branches: [SkillBranch.COMBAT, SkillBranch.SURVIVAL],
    color: 0xff8844,
    colorStr: '#ff8844',
    icon: '!',
  },
  {
    id: 'spellblade',
    name: 'Spellblade',
    branches: [SkillBranch.COMBAT, SkillBranch.MAGIC],
    color: 0xcc44ff,
    colorStr: '#cc44ff',
    icon: '%',
  },
  {
    id: 'trailblazer',
    name: 'Trailblazer',
    branches: [SkillBranch.MINING, SkillBranch.MOBILITY],
    color: 0xffcc22,
    colorStr: '#ffcc22',
    icon: '#',
  },
]

export const SUPER_TREE_MAP: Record<string, SuperTreeDef> = {}
for (const st of SUPER_TREES) SUPER_TREE_MAP[st.id] = st

// XP needed to reach a given level: 50 * level^2
export function xpForLevel(level: number): number {
  return 50 * level * level
}

export const SKILLS: SkillDef[] = [
  // ── Combat Branch ────────────────────────
  {
    id: 'sharp_edge',
    name: 'Sharp Edge',
    description: '+20% melee damage',
    branch: SkillBranch.COMBAT,
    tier: 1,
    cost: 1,
    meleeDamageMult: 1.2,
  },
  {
    id: 'quick_draw',
    name: 'Quick Draw',
    description: '+20% attack speed',
    branch: SkillBranch.COMBAT,
    tier: 1,
    cost: 1,
    attackSpeedMult: 0.8, // lower cooldown = faster
  },
  {
    id: 'power_strike',
    name: 'Power Strike',
    description: '+30% melee damage',
    branch: SkillBranch.COMBAT,
    tier: 2,
    cost: 2,
    requires: 'sharp_edge',
    meleeDamageMult: 1.3,
  },
  {
    id: 'critical_eye',
    name: 'Critical Eye',
    description: '15% chance for 2x damage',
    branch: SkillBranch.COMBAT,
    tier: 2,
    cost: 2,
    requires: 'quick_draw',
    critChance: 0.15,
  },
  {
    id: 'berserker',
    name: 'Berserker',
    description: '+50% damage below 30% HP',
    branch: SkillBranch.COMBAT,
    tier: 3,
    cost: 3,
    requires: 'power_strike',
    lowHpDamageMult: 1.5,
  },

  // ── Survival Branch ──────────────────────
  {
    id: 'tough_skin',
    name: 'Tough Skin',
    description: '+25 max HP',
    branch: SkillBranch.SURVIVAL,
    tier: 1,
    cost: 1,
    maxHpBonus: 25,
  },
  {
    id: 'recovery',
    name: 'Recovery',
    description: 'Regenerate 1 HP/sec',
    branch: SkillBranch.SURVIVAL,
    tier: 1,
    cost: 1,
    hpRegen: 1,
  },
  {
    id: 'iron_body',
    name: 'Iron Body',
    description: '+4 defense',
    branch: SkillBranch.SURVIVAL,
    tier: 2,
    cost: 2,
    requires: 'tough_skin',
    defenseBonus: 4,
  },
  {
    id: 'second_wind',
    name: 'Second Wind',
    description: 'Heal 15% HP on kill',
    branch: SkillBranch.SURVIVAL,
    tier: 2,
    cost: 2,
    requires: 'recovery',
    healOnKillPct: 0.15,
  },

  // ── Mining Branch ────────────────────────
  {
    id: 'efficient_mining',
    name: 'Efficient Mining',
    description: '+30% mine speed',
    branch: SkillBranch.MINING,
    tier: 1,
    cost: 1,
    mineSpeedMult: 1.3,
  },
  {
    id: 'treasure_hunter',
    name: 'Treasure Hunter',
    description: '20% chance for double drops',
    branch: SkillBranch.MINING,
    tier: 1,
    cost: 1,
    doubleDropChance: 0.2,
  },
  {
    id: 'deep_miner',
    name: 'Deep Miner',
    description: '+50% mine speed',
    branch: SkillBranch.MINING,
    tier: 2,
    cost: 2,
    requires: 'efficient_mining',
    mineSpeedMult: 1.5,
  },
  {
    id: 'prospector',
    name: 'Prospector',
    description: '+1.5 mining range',
    branch: SkillBranch.MINING,
    tier: 2,
    cost: 2,
    requires: 'treasure_hunter',
    miningRangeBonus: 1.5,
  },

  // ── Magic Branch ─────────────────────────
  {
    id: 'mana_well',
    name: 'Mana Well',
    description: '+30 max mana',
    branch: SkillBranch.MAGIC,
    tier: 1,
    cost: 1,
    maxManaBonus: 30,
  },
  {
    id: 'arcane_flow',
    name: 'Arcane Flow',
    description: '+50% mana regen',
    branch: SkillBranch.MAGIC,
    tier: 1,
    cost: 1,
    manaRegenMult: 1.5,
  },
  {
    id: 'spell_power',
    name: 'Spell Power',
    description: '+30% magic damage',
    branch: SkillBranch.MAGIC,
    tier: 2,
    cost: 2,
    requires: 'mana_well',
    magicDamageMult: 1.3,
  },
  {
    id: 'mana_shield',
    name: 'Mana Shield',
    description: 'Redirect 25% damage to mana',
    branch: SkillBranch.MAGIC,
    tier: 2,
    cost: 2,
    requires: 'arcane_flow',
    manaShieldPct: 0.25,
  },

  // ── Mobility Branch ──────────────────────
  {
    id: 'swift_feet',
    name: 'Swift Feet',
    description: '+20% move speed',
    branch: SkillBranch.MOBILITY,
    tier: 1,
    cost: 1,
    moveSpeedMult: 1.2,
  },
  {
    id: 'feather_fall',
    name: 'Feather Fall',
    description: '-60% fall damage',
    branch: SkillBranch.MOBILITY,
    tier: 1,
    cost: 1,
    fallDamageMult: 0.4,
  },
  {
    id: 'double_jump',
    name: 'Double Jump',
    description: 'Jump again in mid-air',
    branch: SkillBranch.MOBILITY,
    tier: 2,
    cost: 2,
    requires: 'swift_feet',
    doubleJump: true,
  },
  {
    id: 'fuel_saver',
    name: 'Fuel Saver',
    description: '-40% jetpack fuel use',
    branch: SkillBranch.MOBILITY,
    tier: 2,
    cost: 2,
    requires: 'feather_fall',
    jetpackFuelMult: 0.6,
  },

  // ── Super: Warlord (Combat + Survival) ─────────────
  {
    id: 'blood_oath',
    name: 'Blood Oath',
    description: 'Lifesteal: heal 15% of all damage dealt',
    branch: SkillBranch.COMBAT,
    superTree: 'warlord',
    tier: 4,
    cost: 3,
    lifeStealPct: 0.15,
  },
  {
    id: 'undying_rage',
    name: 'Undying Rage',
    description: 'Survive lethal hit with 1 HP + 3s invulnerability (60s cd)',
    branch: SkillBranch.SURVIVAL,
    superTree: 'warlord',
    tier: 4,
    cost: 4,
    requires: 'blood_oath',
    undying: true,
  },

  // ── Super: Spellblade (Combat + Magic) ─────────────
  {
    id: 'arcane_strikes',
    name: 'Arcane Strikes',
    description: 'Melee hits release a magic shockwave for 50% bonus dmg',
    branch: SkillBranch.MAGIC,
    superTree: 'spellblade',
    tier: 4,
    cost: 3,
    arcaneStrikes: true,
  },
  {
    id: 'mana_overload',
    name: 'Mana Overload',
    description: 'Mana >75%: attacks deal +100% damage, drain 15% max mana',
    branch: SkillBranch.COMBAT,
    superTree: 'spellblade',
    tier: 4,
    cost: 4,
    requires: 'arcane_strikes',
    manaOverload: true,
  },

  // ── Super: Trailblazer (Mining + Mobility) ─────────
  {
    id: 'tunnel_bore',
    name: 'Tunnel Bore',
    description: 'Mine in a 3x3 area instead of single blocks',
    branch: SkillBranch.MINING,
    superTree: 'trailblazer',
    tier: 4,
    cost: 3,
    aoeMining: true,
  },
  {
    id: 'flash_step',
    name: 'Flash Step',
    description: '+50% move speed, immune to fall damage',
    branch: SkillBranch.MOBILITY,
    superTree: 'trailblazer',
    tier: 4,
    cost: 4,
    requires: 'tunnel_bore',
    moveSpeedMult: 1.5,
    fallDamageMult: 0,
  },

  // ── Ascension (God Tier — requires 2+ super trees) ────
  {
    id: 'void_strike',
    name: 'Void Strike',
    description: '+100% damage to void dimension enemies',
    branch: SkillBranch.ASCENSION,
    tier: 5,
    cost: 5,
    requiredSuperTrees: 2,
    voidDamageMultiplier: 2.0,
  },
  {
    id: 'soul_harvest',
    name: 'Soul Harvest',
    description: 'Kills heal 5% max HP',
    branch: SkillBranch.ASCENSION,
    tier: 5,
    cost: 5,
    requiredSuperTrees: 2,
    killHealPercent: 0.05,
  },
  {
    id: 'dimensional_shift',
    name: 'Dimensional Shift',
    description: '20% chance to dodge attacks',
    branch: SkillBranch.ASCENSION,
    tier: 5,
    cost: 5,
    requiredSuperTrees: 2,
    dodgeChance: 0.2,
  },
  {
    id: 'chaos_mastery',
    name: 'Chaos Mastery',
    description: 'All damage +50%',
    branch: SkillBranch.ASCENSION,
    tier: 5,
    cost: 8,
    prerequisites: ['void_strike', 'soul_harvest'],
    requiredSuperTrees: 2,
    allDamageMultiplier: 1.5,
  },
  {
    id: 'void_armor',
    name: 'Void Armor',
    description: '-30% damage taken',
    branch: SkillBranch.ASCENSION,
    tier: 5,
    cost: 8,
    requires: 'dimensional_shift',
    requiredSuperTrees: 2,
    damageReduction: 0.3,
  },
  {
    id: 'ascendant',
    name: 'Ascendant',
    description: 'All stats +25%, permanent void aura',
    branch: SkillBranch.ASCENSION,
    tier: 5,
    cost: 15,
    prerequisites: ['chaos_mastery', 'void_armor'],
    requiredSuperTrees: 2,
    allStatsMultiplier: 1.25,
  },
]

export const SKILL_MAP: Record<string, SkillDef> = {}
for (const s of SKILLS) {
  SKILL_MAP[s.id] = s
}

// Branch display order and colors
export const BRANCH_INFO: Record<SkillBranch, { name: string; icon: string; color: number; colorStr: string }> = {
  [SkillBranch.COMBAT]: { name: 'Combat', icon: '/', color: 0xff4444, colorStr: '#ff4444' },
  [SkillBranch.SURVIVAL]: { name: 'Survival', icon: '+', color: 0x44ff44, colorStr: '#44ff44' },
  [SkillBranch.MINING]: { name: 'Mining', icon: '*', color: 0xffaa44, colorStr: '#ffaa44' },
  [SkillBranch.MAGIC]: { name: 'Magic', icon: '~', color: 0x4488ff, colorStr: '#4488ff' },
  [SkillBranch.MOBILITY]: { name: 'Mobility', icon: '>', color: 0xffff44, colorStr: '#ffff44' },
  [SkillBranch.ASCENSION]: { name: 'Ascension', icon: '@', color: 0xaa00ff, colorStr: '#aa00ff' },
}

export const BRANCH_ORDER: SkillBranch[] = [
  SkillBranch.COMBAT,
  SkillBranch.SURVIVAL,
  SkillBranch.MINING,
  SkillBranch.MAGIC,
  SkillBranch.MOBILITY,
  SkillBranch.ASCENSION,
]
