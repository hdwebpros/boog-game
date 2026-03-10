export enum BossType {
  VINE_GUARDIAN = 'vine_guardian',
  DEEP_SEA_LEVIATHAN = 'deep_sea_leviathan',
  CRYSTAL_GOLEM = 'crystal_golem',
  MAGMA_WYRM = 'magma_wyrm',
  CORE_SENTINEL = 'core_sentinel',
  MOTHERSHIP = 'mothership',
}

export enum BossAI {
  VINE = 'vine',           // ground, vine attacks, summon slugs
  LEVIATHAN = 'leviathan', // swimming, charge + bubble attacks
  GOLEM = 'golem',         // ground, slam + crystal rain
  WYRM = 'wyrm',           // flying serpent, fire breath + dive
  SENTINEL = 'sentinel',   // flying, laser + shield phases
  MOTHERSHIP = 'mothership', // flying, drone spawns + beam
}

export interface BossPhase {
  hpThreshold: number // trigger when hp% drops below this
  speed: number
  damage: number
  attackInterval: number // ms between attacks
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
  summonItemId: number // item used to summon
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
}
