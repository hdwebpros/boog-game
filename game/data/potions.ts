/** Buff definitions for the potion system.
 *  Each buff has a unique type, duration, color, and stat modifiers. */

export type BuffType =
  | 'ironskin'
  | 'swiftness'
  | 'spelunker'
  | 'night_owl'
  | 'featherfall'
  | 'rage'
  | 'regeneration'
  | 'mana_regen'
  | 'thorns'
  | 'water_walking'
  | 'giant'
  | 'archery'
  | 'magic_power'
  | 'mining'
  | 'endurance'
  | 'wrath'
  | 'forcefield'

export interface BuffDef {
  type: BuffType
  name: string
  description: string
  color: number
  duration: number // ms
  /** Stat modifiers applied while active */
  defenseBonus?: number
  moveSpeedMult?: number
  noFallDamage?: boolean
  damageMult?: number        // all damage
  meleeDamageMult?: number
  rangedDamageMult?: number
  magicDamageMult?: number
  hpRegen?: number           // HP per second
  manaRegenMult?: number
  thornsPct?: number         // % of damage reflected
  waterWalking?: boolean
  maxHpBonus?: number
  mineSpeedMult?: number
  damageTakenMult?: number   // multiplier on incoming damage (< 1 = reduction)
  spelunker?: boolean        // highlight ores
  nightVision?: boolean      // see in dark
}

export const BUFF_DEFS: Record<BuffType, BuffDef> = {
  ironskin: {
    type: 'ironskin', name: 'Ironskin', description: '+10 defense',
    color: 0xddaa44, duration: 60000,
    defenseBonus: 10,
  },
  swiftness: {
    type: 'swiftness', name: 'Swiftness', description: '+30% move speed',
    color: 0x44ddff, duration: 60000,
    moveSpeedMult: 1.3,
  },
  spelunker: {
    type: 'spelunker', name: 'Spelunker', description: 'Ores glow through walls',
    color: 0xffcc00, duration: 90000,
    spelunker: true,
  },
  night_owl: {
    type: 'night_owl', name: 'Night Owl', description: 'See in the dark',
    color: 0xaacc44, duration: 120000,
    nightVision: true,
  },
  featherfall: {
    type: 'featherfall', name: 'Featherfall', description: 'No fall damage',
    color: 0xddddff, duration: 90000,
    noFallDamage: true,
  },
  rage: {
    type: 'rage', name: 'Rage', description: '+15% melee damage',
    color: 0xff4444, duration: 45000,
    meleeDamageMult: 1.15,
  },
  regeneration: {
    type: 'regeneration', name: 'Regeneration', description: 'Regen 2 HP/s',
    color: 0xff66aa, duration: 60000,
    hpRegen: 2,
  },
  mana_regen: {
    type: 'mana_regen', name: 'Mana Surge', description: '+50% mana regen',
    color: 0x6644ff, duration: 60000,
    manaRegenMult: 1.5,
  },
  thorns: {
    type: 'thorns', name: 'Thorns', description: 'Reflect 25% damage taken',
    color: 0x44aa44, duration: 45000,
    thornsPct: 0.25,
  },
  water_walking: {
    type: 'water_walking', name: 'Water Walking', description: 'Walk on water',
    color: 0x2288ff, duration: 120000,
    waterWalking: true,
  },
  giant: {
    type: 'giant', name: 'Giant', description: '+25 max HP',
    color: 0xcc8844, duration: 60000,
    maxHpBonus: 25,
  },
  archery: {
    type: 'archery', name: 'Archery', description: '+20% ranged damage',
    color: 0x88cc44, duration: 60000,
    rangedDamageMult: 1.2,
  },
  magic_power: {
    type: 'magic_power', name: 'Magic Power', description: '+20% magic damage',
    color: 0xaa44ff, duration: 60000,
    magicDamageMult: 1.2,
  },
  mining: {
    type: 'mining', name: 'Mining', description: '+25% mining speed',
    color: 0xffaa44, duration: 90000,
    mineSpeedMult: 1.25,
  },
  endurance: {
    type: 'endurance', name: 'Endurance', description: '-15% damage taken',
    color: 0x4488cc, duration: 45000,
    damageTakenMult: 0.85,
  },
  wrath: {
    type: 'wrath', name: 'Wrath', description: '+25% all damage',
    color: 0xff2222, duration: 30000,
    damageMult: 1.25,
  },
  forcefield: {
    type: 'forcefield', name: 'Forcefield', description: 'Immune to damage',
    color: 0x44ddff, duration: 8000,
    damageTakenMult: 0,
  },
}

/** Maps potion item ID → buff type it grants */
export const POTION_BUFF_MAP: Record<number, BuffType> = {
  193: 'forcefield',
  400: 'ironskin',
  401: 'swiftness',
  402: 'spelunker',
  403: 'night_owl',
  404: 'featherfall',
  405: 'rage',
  406: 'regeneration',
  407: 'mana_regen',
  408: 'thorns',
  409: 'water_walking',
  410: 'giant',
  411: 'archery',
  412: 'magic_power',
  413: 'mining',
  414: 'endurance',
  415: 'wrath',
}
