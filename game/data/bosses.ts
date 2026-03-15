export enum BossType {
  VINE_GUARDIAN = 'vine_guardian',
  DEEP_SEA_LEVIATHAN = 'deep_sea_leviathan',
  CRYSTAL_GOLEM = 'crystal_golem',
  MAGMA_WYRM = 'magma_wyrm',
  CORE_SENTINEL = 'core_sentinel',
  MOTHERSHIP = 'mothership',
  VOID_LORD = 'void_lord',
}

export enum BossAI {
  VINE = 'vine',           // ground, vine attacks, summon slugs
  LEVIATHAN = 'leviathan', // swimming, charge + bubble attacks
  GOLEM = 'golem',         // ground, slam + crystal rain
  WYRM = 'wyrm',           // flying serpent, fire breath + dive
  SENTINEL = 'sentinel',   // flying, laser + shield phases
  MOTHERSHIP = 'mothership', // flying, drone spawns + beam
  VOID_LORD = 'void_lord',   // final boss, multi-phase void attacks
}

export interface BossPhase {
  hpThreshold: number // trigger when hp% drops below this
  speed: number
  damage: number
  attackInterval: number // ms between attacks
}

export interface SummonIngredient {
  itemId: number
  count: number
}

export interface AltarDef {
  bossType: BossType
  biomeYMin: number      // min Y tile coord for placement
  biomeYMax: number      // max Y tile coord for placement
  color: number          // altar visual color
  ingredients: SummonIngredient[]
  runestonesPerWorld: number // how many runestones to scatter
}

export interface BossDef {
  type: BossType
  name: string
  maxHp: number
  damage: number
  speed: number
  color: number
  width: number
  height: number
  ai: BossAI
  phases: BossPhase[]
  dropItemId: number // jetpack component
  summonItemId: number // item used to summon (legacy, kept for recipe output)
  xp: number
}

export const BOSS_DEFS: Record<BossType, BossDef> = {
  [BossType.VINE_GUARDIAN]: {
    type: BossType.VINE_GUARDIAN,
    name: 'Vine Guardian',
    maxHp: 300,
    damage: 15,
    speed: 60,
    color: 0x33aa33,
    width: 32,
    height: 40,
    ai: BossAI.VINE,
    phases: [
      { hpThreshold: 1.0, speed: 60, damage: 15, attackInterval: 2000 },
      { hpThreshold: 0.5, speed: 80, damage: 20, attackInterval: 1500 },
    ],
    dropItemId: 180, // Fuel Cell Casing
    summonItemId: 170, // Vine Beacon
    xp: 100,
  },
  [BossType.DEEP_SEA_LEVIATHAN]: {
    type: BossType.DEEP_SEA_LEVIATHAN,
    name: 'Deep Sea Leviathan',
    maxHp: 500,
    damage: 20,
    speed: 70,
    color: 0x1155aa,
    width: 40,
    height: 20,
    ai: BossAI.LEVIATHAN,
    phases: [
      { hpThreshold: 1.0, speed: 70, damage: 20, attackInterval: 2500 },
      { hpThreshold: 0.5, speed: 100, damage: 30, attackInterval: 1800 },
    ],
    dropItemId: 181, // Thrust Regulator
    summonItemId: 171, // Tidal Pearl
    xp: 150,
  },
  [BossType.CRYSTAL_GOLEM]: {
    type: BossType.CRYSTAL_GOLEM,
    name: 'Crystal Golem',
    maxHp: 800,
    damage: 30,
    speed: 40,
    color: 0x66ddff,
    width: 36,
    height: 44,
    ai: BossAI.GOLEM,
    phases: [
      { hpThreshold: 1.0, speed: 40, damage: 30, attackInterval: 3000 },
      { hpThreshold: 0.6, speed: 55, damage: 40, attackInterval: 2200 },
      { hpThreshold: 0.3, speed: 70, damage: 50, attackInterval: 1500 },
    ],
    dropItemId: 182, // Pressure Valve
    summonItemId: 172, // Crystal Lens
    xp: 250,
  },
  [BossType.MAGMA_WYRM]: {
    type: BossType.MAGMA_WYRM,
    name: 'Magma Wyrm',
    maxHp: 1000,
    damage: 35,
    speed: 80,
    color: 0xff4400,
    width: 30,
    height: 30,
    ai: BossAI.WYRM,
    phases: [
      { hpThreshold: 1.0, speed: 80, damage: 35, attackInterval: 2000 },
      { hpThreshold: 0.5, speed: 110, damage: 45, attackInterval: 1500 },
      { hpThreshold: 0.2, speed: 140, damage: 55, attackInterval: 1000 },
    ],
    dropItemId: 183, // Energy Capacitor
    summonItemId: 173, // Magma Core
    xp: 350,
  },
  [BossType.CORE_SENTINEL]: {
    type: BossType.CORE_SENTINEL,
    name: 'Core Sentinel',
    maxHp: 1200,
    damage: 40,
    speed: 60,
    color: 0xaa22ff,
    width: 28,
    height: 28,
    ai: BossAI.SENTINEL,
    phases: [
      { hpThreshold: 1.0, speed: 60, damage: 40, attackInterval: 2500 },
      { hpThreshold: 0.6, speed: 80, damage: 50, attackInterval: 1800 },
      { hpThreshold: 0.25, speed: 100, damage: 60, attackInterval: 1200 },
    ],
    dropItemId: 184, // Ignition Core
    summonItemId: 174, // Void Sigil
    xp: 450,
  },
  [BossType.MOTHERSHIP]: {
    type: BossType.MOTHERSHIP,
    name: 'Mothership',
    maxHp: 1500,
    damage: 50,
    speed: 50,
    color: 0xff44ff,
    width: 48,
    height: 32,
    ai: BossAI.MOTHERSHIP,
    phases: [
      { hpThreshold: 1.0, speed: 50, damage: 50, attackInterval: 3000 },
      { hpThreshold: 0.7, speed: 60, damage: 60, attackInterval: 2500 },
      { hpThreshold: 0.4, speed: 75, damage: 70, attackInterval: 1800 },
      { hpThreshold: 0.15, speed: 90, damage: 80, attackInterval: 1200 },
    ],
    dropItemId: 185, // Navigation Module
    summonItemId: 175, // Signal Beacon
    xp: 600,
  },
  [BossType.VOID_LORD]: {
    type: BossType.VOID_LORD,
    name: 'The Void Lord',
    maxHp: 5000,
    damage: 80,
    speed: 100,
    color: 0x9900ff,
    width: 128,
    height: 192,
    ai: BossAI.VOID_LORD,
    phases: [
      { hpThreshold: 1.0, speed: 100, damage: 80, attackInterval: 2000 },
      { hpThreshold: 0.75, speed: 120, damage: 100, attackInterval: 1600 },
      { hpThreshold: 0.5, speed: 140, damage: 120, attackInterval: 1200 },
      { hpThreshold: 0.25, speed: 160, damage: 150, attackInterval: 800 },
    ],
    dropItemId: 380, // Trophy of the Void Lord
    summonItemId: 370, // Void Lord Summon Token
    xp: 5000,
  },
}

import { TileType, WORLD_HEIGHT, SURFACE_Y, UNDERGROUND_Y, DEEP_UNDERGROUND_Y, CORE_Y } from '../world/TileRegistry'

const SURFACE = SURFACE_Y
const UNDERGROUND = UNDERGROUND_Y
const DEEP = DEEP_UNDERGROUND_Y
const CORE = CORE_Y

// Altar definitions — one altar per boss, placed during world gen
export const ALTAR_DEFS: Partial<Record<BossType, AltarDef>> = {
  [BossType.VINE_GUARDIAN]: {
    bossType: BossType.VINE_GUARDIAN,
    biomeYMin: SURFACE - 20,
    biomeYMax: SURFACE + 30,
    color: 0x33aa33,
    ingredients: [
      { itemId: TileType.WOOD, count: 10 },
      { itemId: TileType.LEAVES, count: 20 },
      { itemId: 105, count: 5 }, // Plant Fiber
    ],
    runestonesPerWorld: 3,
  },
  [BossType.DEEP_SEA_LEVIATHAN]: {
    bossType: BossType.DEEP_SEA_LEVIATHAN,
    biomeYMin: SURFACE - 10,
    biomeYMax: UNDERGROUND,
    color: 0x1155aa,
    ingredients: [
      { itemId: TileType.CORAL, count: 15 },
      { itemId: TileType.SAND, count: 20 },
      { itemId: 105, count: 8 }, // Plant Fiber
    ],
    runestonesPerWorld: 3,
  },
  [BossType.CRYSTAL_GOLEM]: {
    bossType: BossType.CRYSTAL_GOLEM,
    biomeYMin: UNDERGROUND,
    biomeYMax: DEEP,
    color: 0x66ddff,
    ingredients: [
      { itemId: 100, count: 6 }, // Iron Bar
      { itemId: TileType.DIAMOND_ORE, count: 4 },
      { itemId: 104, count: 3 }, // Glass
    ],
    runestonesPerWorld: 2,
  },
  [BossType.MAGMA_WYRM]: {
    bossType: BossType.MAGMA_WYRM,
    biomeYMin: DEEP,
    biomeYMax: CORE,
    color: 0xff4400,
    ingredients: [
      { itemId: 101, count: 5 }, // Diamond
      { itemId: 102, count: 3 }, // Titanium Bar
      { itemId: 100, count: 4 }, // Iron Bar
    ],
    runestonesPerWorld: 2,
  },
  [BossType.CORE_SENTINEL]: {
    bossType: BossType.CORE_SENTINEL,
    biomeYMin: CORE,
    biomeYMax: WORLD_HEIGHT,
    color: 0xaa22ff,
    ingredients: [
      { itemId: 103, count: 5 }, // Carbon Plate
      { itemId: 102, count: 4 }, // Titanium Bar
      { itemId: 101, count: 3 }, // Diamond
    ],
    runestonesPerWorld: 2,
  },
  [BossType.MOTHERSHIP]: {
    bossType: BossType.MOTHERSHIP,
    biomeYMin: SURFACE - 20,
    biomeYMax: SURFACE + 10,
    color: 0xff44ff,
    ingredients: [
      { itemId: 103, count: 10 }, // Carbon Plate
      { itemId: 102, count: 5 },  // Titanium Bar
      { itemId: 101, count: 5 },  // Diamond
    ],
    runestonesPerWorld: 2,
  },
}
